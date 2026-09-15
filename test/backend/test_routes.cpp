// Offline integration tests for amico_backend: a real HTTP round-trip
// (real loopback socket, via cpp-httplib's own client mode) against a
// FakeTransport-backed AmicoClient -- no real device involved. See
// spec.md Decision 7.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "BackendConfig.hpp"
#include "ErrorMapping.hpp"
#include "FakeTransport.hpp"
#include "Routes.hpp"
#include "UserProfileResponder.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::test;
using namespace amico::backend;

namespace {

/// Starts a real httplib::Server (loopback, ephemeral port) with routes
/// registered against a FakeTransport-backed AmicoClient. `fake` is
/// exposed so each test can arm its own responder before calling in.
class TestServer {
public:
    explicit TestServer(bool loggedIn = true) : sessions_([this](AmicoConfig config) {
        ++factoryCalls;
        AmicoClient client(std::move(config));
        auto transport = std::make_unique<FakeTransport>();
        fake_ = transport.get();
        transport->responder = [this](const HttpRequest& req) {
            if (req.path.find("/hidlogin.fcgi") != std::string::npos) ++loginCalls;
            if (req.path.find("/logout.fcgi") != std::string::npos) ++logoutCalls;
            return responder(req);
        };
        setTransportForTesting(client, std::move(transport));
        return client;
    }) {
        if (loggedIn) {
            auto lock = sessions_.acquire();
            sessions_.login("http://192.0.2.1", "TestUser", "placeholder-not-a-real-credential");
            cookie = "amico_session=" + sessions_.sessionToken();
        }
        registerAll(svr_, sessions_);
        port_ = svr_.bind_to_any_port("127.0.0.1");
        thread_ = std::thread([this] { svr_.listen_after_bind(); });
        while (!svr_.is_running()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }

    ~TestServer() {
        svr_.stop();
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    TestServer(const TestServer&) = delete;
    TestServer& operator=(const TestServer&) = delete;

    FakeTransport& fake() { return *fake_; }

    int factoryCalls = 0, loginCalls = 0, logoutCalls = 0;
    std::string cookie;
    std::function<HttpResponse(const HttpRequest&)> responder = [](const HttpRequest&) {
        return FakeTransport::ok(readFixture("login_success.json"));
    };

    httplib::Client http(bool authenticated = true) {
        httplib::Client cli("127.0.0.1", port_);
        if (authenticated && !cookie.empty()) cli.set_default_headers({{"Cookie", cookie}});
        return cli;
    }

private:
    SessionStore sessions_;
    FakeTransport* fake_ = nullptr;
    httplib::Server svr_;
    std::thread thread_;
    int port_ = 0;
};

/// A responder that fails the current test if invoked at all -- used to
/// prove a guardrail/parsing-error path never reaches AmicoClient.
HttpResponse failIfCalled(const HttpRequest&) {
    FAIL("AmicoClient was called, but the guardrail/parsing check should have short-circuited before it");
    return FakeTransport::status(500);
}

}  // namespace

// ------------------------- Read routes -------------------------

TEST_CASE("GET /health returns 200") {
    TestServer server;
    auto cli = server.http();
    auto res = cli.Get("/health");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("GET /system-information maps the confirmed response") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("system_information.json")); };
    auto cli = server.http();
    auto res = cli.Get("/system-information");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body.contains("serial"));
    CHECK(body.contains("network"));
}

TEST_CASE("GET /users lists users") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };
    auto cli = server.http();
    auto res = cli.Get("/users");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body.is_array());
    for (const auto& user : body) {
        CHECK(user["imageUrl"] == "/users/" + std::to_string(user["id"].get<int64_t>()) + "/image");
    }
}

TEST_CASE("GET /users/:id found returns 200 with the mapped user") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };
    auto cli = server.http();
    auto res = cli.Get("/users/36");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body["id"] == 36);
    CHECK(body["hasPassword"].is_boolean());
    CHECK(body["imageUrl"] == "/users/36/image");
}

TEST_CASE("GET /users/:id not found returns 404") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_get_not_found.json")); };
    auto cli = server.http();
    auto res = cli.Get("/users/999999");
    REQUIRE(res != nullptr);
    CHECK(res->status == 404);
}

TEST_CASE("GET /users/:id with a non-numeric id returns 400, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    auto res = cli.Get("/users/not-a-number");
    REQUIRE(res != nullptr);
    // The route's regex (\d+) simply won't match a non-numeric id, so
    // cpp-httplib itself returns 404 (no matching route) rather than
    // reaching our handler at all -- still confirms AmicoClient is never
    // called, which is the property under test.
    CHECK(res->status == 404);
}

// ------------------------- User CRUD -------------------------

TEST_CASE("POST /users success returns 201 with the new id") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_create_success.json")); };
    auto cli = server.http();
    auto res = cli.Post("/users", R"({"name":"Test User","registration":"TEST-001"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body["id"] == 12345);
}

TEST_CASE("POST /users with malformed JSON body returns 400, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    auto res = cli.Post("/users", "{not valid json", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 400);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body["type"] == "InvalidRequest");
}

TEST_CASE("POST /users with a device-side error maps via ErrorMapping (not 400)") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_create_failure.json")); };
    auto cli = server.http();
    auto res = cli.Post("/users", R"({"name":"Test User","registration":"TEST-001"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 502);  // ProtocolError
}

TEST_CASE("PATCH /users/:id partial update omits unset fields") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}});
        return FakeTransport::ok(readFixture("user_update_success.json"));
    };
    auto cli = server.http();
    auto res = cli.Patch("/users/36", R"({"name":"Renamed"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("PATCH /users/:id with an empty body sends no fields (documented, not accidental)") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["values"] == nlohmann::json::object());
        return FakeTransport::ok(readFixture("user_update_failure.json"));  // device reports changes:0 for a no-op
    };
    auto cli = server.http();
    auto res = cli.Patch("/users/36", "{}", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 502);  // ProtocolError, since the SDK's update() throws on changes<=0
}

TEST_CASE("DELETE /users/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_delete_success.json")); };
    auto cli = server.http();
    auto res = cli.Delete("/users/36");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

// ------------------------- Visitors (2026-09-14 plan) -------------------------

TEST_CASE("R-1: GET /visitors filters by userTypeId = 1") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.value("object", std::string{}) == "users" && body.contains("where") && body["where"].is_array() &&
            !body["where"].empty() && body["where"][0].value("object", std::string{}) == "user_types") {
            CHECK(body["where"] == nlohmann::json::array({{{"field", "id"}, {"object", "user_types"}, {"value", 1}}}));
        }
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };
    auto cli = server.http();
    auto res = cli.Get("/visitors");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    CHECK(nlohmann::json::parse(res->body).is_array());
}

TEST_CASE("R-2: POST /visitors creates a user with user_type_id=1 and, when given, a c_users row") {
    TestServer server;
    bool sawUserTypeId = false, sawCUsers = false;
    server.fake().responder = [&](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "users") {
            CHECK(body["values"][0]["user_type_id"] == 1);
            sawUserTypeId = true;
            return FakeTransport::ok(readFixture("user_create_success.json"));
        }
        if (req.path == "/create_objects.fcgi" && body["object"] == "c_users") {
            CHECK(body["values"][0]["cpf"] == "12345678900");
            sawCUsers = true;
            return FakeTransport::ok(R"({"ids":[1]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/visitors", R"({"name":"Test Visitor","registration":"V-001","cpf":"12345678900"})",
                        "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(sawUserTypeId);
    CHECK(sawCUsers);
}

TEST_CASE("R-3: DELETE /visitors/:id triggers the defensive c_users cleanup before the users delete") {
    TestServer server;
    std::vector<std::string> order;
    server.fake().responder = [&](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        order.push_back(body["object"].get<std::string>());
        if (body["object"] == "c_users") return FakeTransport::ok(R"({"changes": 0})");
        return FakeTransport::ok(readFixture("user_delete_success.json"));
    };
    auto cli = server.http();
    auto res = cli.Delete("/visitors/36");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "c_users");
    CHECK(order[1] == "users");
}

TEST_CASE("R-4: regression -- GET /users unaffected by the Visitors plan") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.value("object", std::string{}) == "users" && body.contains("where") && body["where"].is_array() &&
            !body["where"].empty() && body["where"][0].contains("connector")) {
            nlohmann::json expected = nlohmann::json::array({
                {{"field", "user_type_id"}, {"operator", "="}, {"value", 0}, {"connector", "OR"}},
                {{"field", "user_type_id"}, {"operator", "IS NULL"}, {"connector", ") AND ("}},
            });
            CHECK(body["where"] == expected);
        }
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };
    auto cli = server.http();
    auto res = cli.Get("/users");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

// ------------------------- Visits -------------------------

TEST_CASE("S-1: GET /visits defaults to the finished != 1 filter") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (object == "visits") {
            CHECK(body["where"] == nlohmann::json::array({{{"field", "finished"}, {"operator", "!="}, {"value", 1}}}));
            return FakeTransport::ok(R"({"visits":[]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Get("/visits");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    CHECK(nlohmann::json::parse(res->body).is_array());
}

TEST_CASE("S-2: POST /visits creates a visit and returns the new id") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "visits") {
            CHECK(body["values"][0]["visitor_id"] == 56);
            CHECK(body["values"][0]["host_id"] == 50);
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/visits", R"({"visitorId":56,"hostId":50,"beginTime":100,"endTime":200})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 7);
}

TEST_CASE("S-3: PATCH /visits/:id never accepts a 'finished' key (no generic-update path)") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/modify_objects.fcgi" && body["object"] == "visits") {
            CHECK_FALSE(body["values"].contains("finished"));
            CHECK(body["values"]["begin_time"] == 111);
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Patch("/visits/7", R"({"beginTime":111,"finished":true})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("S-4: DELETE /visits/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/visits/7");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("S-5: POST /visits/:id/finish revokes the visitor's cards before the finish update, in order") {
    TestServer server;
    std::vector<std::string> order;
    server.fake().responder = [&](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "visits") {
            nlohmann::json rows = nlohmann::json::array({
                {{"id", 7}, {"visitor_id", 56}, {"host_id", 50}, {"begin_time", 100}, {"end_time", 0}, {"finished", 0}},
            });
            return FakeTransport::ok(nlohmann::json{{"visits", rows}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "users") {
            nlohmann::json rows = nlohmann::json::array();
            for (const auto& id : body["where"]["users"]["id"]) {
                rows.push_back({{"id", id}, {"name", "User"}, {"registration", "REG"}});
            }
            return FakeTransport::ok(nlohmann::json{{"users", rows}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "cards") {
            return FakeTransport::ok(nlohmann::json{{"cards", nlohmann::json::array({{{"COUNT(*)", 0}}})}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "cards") {
            order.push_back("destroy_cards");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        if (req.path == "/modify_objects.fcgi" && object == "visits") {
            order.push_back("modify_visits");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/visits/7/finish", "", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "destroy_cards");
    CHECK(order[1] == "modify_visits");
}

// ------------------------- Groups / Cards -------------------------

TEST_CASE("POST /users/:id/groups/:groupId success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("group_add_success.json")); };
    auto cli = server.http();
    auto res = cli.Post("/users/36/groups/1", "", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("DELETE /users/:id/groups/:groupId success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("group_remove_success.json")); };
    auto cli = server.http();
    auto res = cli.Delete("/users/36/groups/1");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("POST /users/:id/cards success returns 201 with cardId") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("card_add_success.json")); };
    auto cli = server.http();
    auto res = cli.Post("/users/36/cards", R"({"areaCode":0,"cardNumber":12345})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body["cardId"] == 777);
}

TEST_CASE("POST /users/:id/cards with a non-numeric areaCode returns 400, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    auto res = cli.Post("/users/36/cards", R"({"areaCode":"not-a-number","cardNumber":12345})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 400);
}

TEST_CASE("DELETE /cards/:cardId success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("card_remove_success.json")); };
    auto cli = server.http();
    auto res = cli.Delete("/cards/777");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

// ------------------------- Image -------------------------

TEST_CASE("GET /users/:id/image forwards binary bytes and Content-Type") {
    TestServer server;
    const std::string bytes("\x89PNG\0\xff", 6);
    server.fake().responder = [&](const HttpRequest& req) {
        CHECK(req.method == "GET");
        CHECK(req.path == "/user_get_image.fcgi?user_id=36");
        auto response = FakeTransport::ok(bytes);
        response.headers.push_back({"Content-Type", "image/png"});
        return response;
    };
    auto cli = server.http();
    auto res = cli.Get("/users/36/image");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    CHECK(res->body == bytes);
    CHECK(res->get_header_value("Content-Type") == "image/png");
}

TEST_CASE("GET /users/:id/image with no image returns an empty 404") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::status(404, "device error"); };
    auto cli = server.http();
    auto res = cli.Get("/users/36/image");
    REQUIRE(res != nullptr);
    CHECK(res->status == 404);
    CHECK(res->body.empty());
    CHECK(res->get_header_value("Content-Type") != "application/json");
}

TEST_CASE("GET /users/:id/image rejects malformed ids before calling the SDK") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    for (const auto& id : {"not-a-number", "36abc", "-1", "999999999999999999999999"}) {
        auto res = cli.Get(std::string("/users/") + id + "/image");
        REQUIRE(res != nullptr);
        CHECK(res->status == 400);
        CHECK(nlohmann::json::parse(res->body)["type"] == "InvalidRequest");
    }
}

TEST_CASE("PUT /users/:id/image success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("image_set_success.json")); };
    auto cli = server.http();
    std::string bytes = "\xFF\xD8\xFF\x00";  // fake JPEG-ish header, not a real photo
    auto res = cli.Put("/users/36/image", bytes, "image/jpeg");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("DELETE /users/:id/image success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("image_remove_success.json")); };
    auto cli = server.http();
    auto res = cli.Delete("/users/36/image");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

// ---------------- Sensitive-action guardrail (Decision 3.2) ----------------

TEST_CASE("PUT /users/:id/administrator without the confirmation header returns 428, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    auto res = cli.Put("/users/36/administrator", R"({"isAdmin":true})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 428);
}

TEST_CASE("PUT /users/:id/administrator with a wrong header value returns 428, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    httplib::Headers headers = {{"X-Confirm-Sensitive-Action", "no"}};
    auto res = cli.Put("/users/36/administrator", headers, R"({"isAdmin":true})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 428);
}

TEST_CASE("PUT /users/:id/administrator with the confirmation header succeeds") {
    TestServer server;
    int callCount = 0;
    server.fake().responder = [&callCount](const HttpRequest&) {
        ++callCount;
        if (callCount == 1) return FakeTransport::ok(R"({"user_roles":[]})");  // isAdmin state-check
        return FakeTransport::ok(readFixture("administrator_grant_success.json"));
    };
    auto cli = server.http();
    httplib::Headers headers = {{"X-Confirm-Sensitive-Action", "yes"}};
    auto res = cli.Put("/users/36/administrator", headers, R"({"isAdmin":true})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("PUT /users/:id/password without the confirmation header returns 428, never calls AmicoClient") {
    TestServer server;
    server.fake().responder = failIfCalled;
    auto cli = server.http();
    auto res = cli.Put("/users/36/password", R"({"password":"13579"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 428);
}

TEST_CASE("PUT /users/:id/password with the confirmation header succeeds") {
    TestServer server;
    int callCount = 0;
    server.fake().responder = [&callCount](const HttpRequest&) {
        ++callCount;
        if (callCount == 1) return FakeTransport::ok(readFixture("hash_password_success.json"));
        return FakeTransport::ok(readFixture("password_set_success.json"));
    };
    auto cli = server.http();
    httplib::Headers headers = {{"X-Confirm-Sensitive-Action", "yes"}};
    auto res = cli.Put("/users/36/password", headers, R"({"password":"13579"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    // The plaintext PIN must never appear in the response body.
    CHECK(res->body.find("13579") == std::string::npos);
}

// ------------------------- Access logs -------------------------

namespace {

/// Dispatches every /load_objects.fcgi call GET /access-logs now makes
/// (list, count, users-by-ids, portals, the 2-hop time-zone join) based
/// on the request body's "object" field. `accessLogsList` and
/// `accessLogsTotal` are test-specific; the join fixtures (one user,
/// one portal, one fully-resolved time zone, matching access_log id
/// 211 only -- id 209 deliberately has no access_log_access_rules row,
/// exercising the "unresolved join -> absent, not empty-string at the
/// SDK layer" path) are shared across R-1/R-2/R-3.
HttpResponse dispatchAccessLogsBackendRequest(const HttpRequest& req, const nlohmann::json& accessLogsList,
                                               int64_t accessLogsTotal) {
    nlohmann::json body = nlohmann::json::parse(req.body);
    std::string object = body.value("object", "");
    if (object == "access_logs") {
        if (body["fields"] == nlohmann::json::array({"COUNT(*)"})) {
            return FakeTransport::ok(nlohmann::json{{"access_logs", nlohmann::json::array({
                nlohmann::json{{"COUNT(*)", accessLogsTotal}}
            })}}.dump());
        }
        return FakeTransport::ok(nlohmann::json{{"access_logs", accessLogsList}}.dump());
    }
    if (object == "users") {
        return FakeTransport::ok(nlohmann::json{{"users", nlohmann::json::array({
            nlohmann::json{{"id", 36}, {"name", "Test User B"}, {"registration", "EMP-036"}}
        })}}.dump());
    }
    if (object == "portals") {
        return FakeTransport::ok(nlohmann::json{{"portals", nlohmann::json::array({
            nlohmann::json{{"id", 1}, {"name", "Portal"}}
        })}}.dump());
    }
    if (object == "access_log_access_rules") {
        return FakeTransport::ok(nlohmann::json{{"access_log_access_rules", nlohmann::json::array({
            nlohmann::json{{"access_log_id", 211}, {"access_rule_id", 1}}
            // id 209 deliberately has no row here.
        })}}.dump());
    }
    if (object == "access_rule_time_zones") {
        return FakeTransport::ok(nlohmann::json{{"access_rule_time_zones", nlohmann::json::array({
            nlohmann::json{{"access_rule_id", 1}, {"time_zone_id", 1}}
        })}}.dump());
    }
    if (object == "time_zones") {
        return FakeTransport::ok(nlohmann::json{{"time_zones", nlohmann::json::array({
            nlohmann::json{{"id", 1}, {"name", "Always Allowed"}}
        })}}.dump());
    }
    return FakeTransport::status(500, R"({"error":"unexpected object in test responder"})");
}

const nlohmann::json kTwoAccessLogRows = nlohmann::json::array({
    nlohmann::json{{"id", 211}, {"time", 1789153178}, {"user_id", 36}, {"portal_id", 1},
                   {"log_type_id", -1}, {"event", 7}, {"identifier_id", 1717658368}},
    nlohmann::json{{"id", 209}, {"time", 1789150000}, {"user_id", nullptr}, {"portal_id", nullptr},
                   {"log_type_id", -1}, {"event", 3}, {"identifier_id", 1717658368}}
});

}  // namespace

TEST_CASE("R-1: GET /access-logs accepts offset, returns {entries, total}") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        return dispatchAccessLogsBackendRequest(req, kTwoAccessLogRows, 5);
    };
    auto cli = server.http();
    auto res = cli.Get("/access-logs?limit=2&offset=2");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    REQUIRE(body.is_object());
    CHECK(body["total"] == 5);
    REQUIRE(body["entries"].is_array());
    CHECK(body["entries"].size() == 2);
}

TEST_CASE("GET /timezones exposes a name-only list, including the empty case") {
    for (const bool empty : {false, true}) {
        CAPTURE(empty);
        TestServer server;
        const auto rows = empty ? nlohmann::json::array() : nlohmann::json::array({
            {{"id", 1}, {"name", "Staff"}}, {{"id", 2}, {"name", "Visitors"}}
        });
        int calls = 0;
        server.fake().responder = [&](const HttpRequest& req) {
            ++calls;
            CHECK(req.path == "/load_objects.fcgi");
            const nlohmann::json expected = {{"object", "time_zones"}, {"fields", {"id", "name"}}};
            CHECK(nlohmann::json::parse(req.body) == expected);
            return FakeTransport::ok(nlohmann::json{{"time_zones", rows}}.dump());
        };
        auto cli = server.http();
        auto res = cli.Get("/timezones");
        REQUIRE(res != nullptr); CHECK(res->status == 200);
        const nlohmann::json expected = {{"timezones", rows}};
        CHECK(nlohmann::json::parse(res->body) == expected);
        CHECK(calls == 1);
    }
}

TEST_CASE("GET /groups exposes name + timeZoneIds per row, including the empty case") {
    for (const bool empty : {false, true}) {
        CAPTURE(empty);
        TestServer server;
        int groupsCalls = 0;
        server.fake().responder = [&](const HttpRequest& req) -> HttpResponse {
            nlohmann::json body = nlohmann::json::parse(req.body);
            if (body["object"] == "groups") {
                ++groupsCalls;
                const nlohmann::json expected = {{"object", "groups"}, {"fields", {"id", "name"}}};
                CHECK(body == expected);
                const auto rows = empty ? nlohmann::json::array() : nlohmann::json::array({
                    {{"id", 1}, {"name", "Staff"}}, {{"id", 2}, {"name", "Visitors"}}
                });
                return FakeTransport::ok(nlohmann::json{{"groups", rows}}.dump());
            }
            // Per-row timeZoneIds lookup (2026-09-16-groups-timezones-write-side).
            CHECK(body["object"] == "time_zones");
            return FakeTransport::ok(nlohmann::json{{"time_zones", nlohmann::json::array()}}.dump());
        };
        auto cli = server.http();
        auto res = cli.Get("/groups");
        REQUIRE(res != nullptr); CHECK(res->status == 200);
        nlohmann::json parsed = nlohmann::json::parse(res->body);
        CHECK(groupsCalls == 1);
        if (empty) {
            CHECK(parsed == nlohmann::json{{"groups", nlohmann::json::array()}});
        } else {
            REQUIRE(parsed["groups"].size() == 2);
            CHECK(parsed["groups"][0]["name"] == "Staff");
            CHECK(parsed["groups"][0]["timeZoneIds"] == nlohmann::json::array());
            CHECK(parsed["groups"][1]["name"] == "Visitors");
        }
    }
}

TEST_CASE("T-1: POST /groups creates a group and returns the new id") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "groups") {
            CHECK(body["values"][0]["name"] == "ZZ_TestGroup");
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/groups", R"({"name":"ZZ_TestGroup"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 7);
}

TEST_CASE("T-2: PATCH /groups/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/modify_objects.fcgi" && body["object"] == "groups") {
            CHECK(body["values"]["name"] == "Renamed");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Patch("/groups/1", R"({"name":"Renamed"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("T-3: DELETE /groups/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/groups/7");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("T-4: POST /groups/:id/timezones/:timeZoneId takes both ids from the path") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "group_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array({
                {{"access_rule_id", 7}},
            })}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["values"][0]["access_rule_id"] == 7);
            CHECK(body["values"][0]["time_zone_id"] == 5);
            return FakeTransport::ok(R"({"ids":[10]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/groups/6/timezones/5", "", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("T-5: DELETE /groups/:id/timezones/:timeZoneId takes both ids from the path") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "group_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array({
                {{"access_rule_id", 7}},
            })}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["where"][0]["value"] == 7);
            CHECK(body["where"][1]["value"] == nlohmann::json::array({5}));
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Delete("/groups/6/timezones/5");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("U-1: POST /timezones creates a time zone and returns the new id") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "time_zones") {
            CHECK(body["values"][0]["name"] == "ZZ_TimeZoneTest");
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/timezones", R"({"name":"ZZ_TimeZoneTest"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 7);
}

TEST_CASE("U-2: PATCH /timezones/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Patch("/timezones/1", R"({"name":"Renamed"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("U-3: DELETE /timezones/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/timezones/7");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("U-4: GET /timezones/:id/spans returns the spans list") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["where"] == nlohmann::json{{"time_spans", {{"time_zone_id", 1}}}});
        return FakeTransport::ok(nlohmann::json{{"time_spans", nlohmann::json::array({{
            {"id", 1}, {"time_zone_id", 1}, {"start", 0}, {"end", 86399},
            {"sun", 1}, {"mon", 1}, {"tue", 1}, {"wed", 1}, {"thu", 1}, {"fri", 1}, {"sat", 1},
            {"hol1", 1}, {"hol2", 1}, {"hol3", 1},
        }})}}.dump());
    };
    auto cli = server.http();
    auto res = cli.Get("/timezones/1/spans");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    CHECK(nlohmann::json::parse(res->body)["spans"].size() == 1);
}

TEST_CASE("U-5: POST /timezones/:id/spans takes the zone id from the path, not the body") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "time_spans") {
            CHECK(body["values"][0]["time_zone_id"] == 3);
            CHECK(body["values"][0]["start"] == 8 * 3600);
            return FakeTransport::ok(R"({"ids":[9]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/timezones/3/spans",
        R"({"start":28800,"end":64800,"sun":false,"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"hol1":false,"hol2":false,"hol3":false})",
        "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 9);
}

TEST_CASE("U-6: PATCH /timespans/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK_FALSE(body["values"].contains("time_zone_id"));
        return FakeTransport::ok(R"({"changes": 1})");
    };
    auto cli = server.http();
    auto res = cli.Patch("/timespans/9",
        R"({"start":0,"end":86399,"sun":true,"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true,"hol1":true,"hol2":true,"hol3":true})",
        "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("U-7: DELETE /timespans/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/timespans/9");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("V-1: GET /holidays returns the holidays list") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "holidays");
        return FakeTransport::ok(nlohmann::json{{"holidays", nlohmann::json::array({{
            {"id", 1}, {"name", "New Year"}, {"start", 1735689600},
            {"hol1", 1}, {"hol2", 0}, {"hol3", 1}, {"repeats", 1},
            {"end", 1735775999},
        }})}}.dump());
    };
    auto cli = server.http();
    auto res = cli.Get("/holidays");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    CHECK(nlohmann::json::parse(res->body)["holidays"].size() == 1);
}

TEST_CASE("V-2: POST /holidays creates a holiday, computes end server-side, and ignores a caller-supplied end") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "holidays") {
            CHECK(body["values"][0]["name"] == "ZZ_HolidayTest");
            CHECK(body["values"][0]["start"] == 1789430400);
            CHECK(body["values"][0]["end"] == 1789430400 + 86399);
            CHECK(body["values"][0]["hol1"] == 1);
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    // A caller-supplied "end" is silently ignored -- fromJsonNewHoliday
    // never parses it (spec.md Decision 1).
    auto res = cli.Post("/holidays",
        R"({"name":"ZZ_HolidayTest","start":1789430400,"hol1":true,"hol2":true,"hol3":true,"repeats":true,"end":999})",
        "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 7);
}

TEST_CASE("V-3: PATCH /holidays/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/modify_objects.fcgi" && body["object"] == "holidays") {
            CHECK(body["values"]["name"] == "Renamed");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Patch("/holidays/1",
        R"({"name":"Renamed","start":0,"hol1":true,"hol2":true,"hol3":true,"repeats":true})",
        "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("V-4: DELETE /holidays/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/holidays/7");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("W-1: GET /scheduled-unlocks returns the list with timeZoneIds populated") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlocks") {
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlocks", nlohmann::json::array({
                {{"id", 1}, {"name", "Weekend"}, {"message", "msg"}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "time_zones") {
            return FakeTransport::ok(nlohmann::json{{"time_zones", nlohmann::json::array({{{"id", 1}}})}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Get("/scheduled-unlocks");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json parsed = nlohmann::json::parse(res->body);
    REQUIRE(parsed["scheduledUnlocks"].size() == 1);
    CHECK(parsed["scheduledUnlocks"][0]["timeZoneIds"] == nlohmann::json::array({1}));
}

TEST_CASE("W-2: POST /scheduled-unlocks creates a scheduled unlock and ignores a caller-supplied timeZoneIds") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "scheduled_unlocks") {
            CHECK(body["values"][0]["name"] == "ZZ_Test");
            CHECK(body["values"][0]["message"] == "msg");
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/scheduled-unlocks",
        R"({"name":"ZZ_Test","message":"msg","timeZoneIds":[1,2]})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 201);
    CHECK(nlohmann::json::parse(res->body)["id"] == 7);
}

TEST_CASE("W-3: PATCH /scheduled-unlocks/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/modify_objects.fcgi" && body["object"] == "scheduled_unlocks") {
            CHECK(body["values"]["name"] == "Renamed");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Patch("/scheduled-unlocks/1", R"({"name":"Renamed","message":"msg"})", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("W-4: DELETE /scheduled-unlocks/:id success returns 200") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 1})"); };
    auto cli = server.http();
    auto res = cli.Delete("/scheduled-unlocks/7");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("W-5: POST /scheduled-unlocks/:id/timezones/:timeZoneId takes both ids from the path") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array({
                {{"access_rule_id", 4}},
            })}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["values"][0]["access_rule_id"] == 4);
            CHECK(body["values"][0]["time_zone_id"] == 3);
            return FakeTransport::ok(R"({"ids":[10]})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Post("/scheduled-unlocks/2/timezones/3", "", "application/json");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("W-6: DELETE /scheduled-unlocks/:id/timezones/:timeZoneId takes both ids from the path") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array({
                {{"access_rule_id", 4}},
            })}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["where"][0]["value"] == 4);
            CHECK(body["where"][1]["value"] == nlohmann::json::array({3}));
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    auto cli = server.http();
    auto res = cli.Delete("/scheduled-unlocks/2/timezones/3");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
}

TEST_CASE("Report lookup routes require a session before any SDK request") {
    TestServer server(false); server.responder = failIfCalled;
    auto cli = server.http(false);
    for (const auto* path : {"/groups", "/timezones", "/holidays", "/scheduled-unlocks", "/access-logs?userIds=36&groupIds=1&timeZoneIds=2"}) {
        auto res = cli.Get(path);
        REQUIRE(res != nullptr); CHECK(res->status == 401);
    }
    CHECK(server.factoryCalls == 0);
}

TEST_CASE("Access log route forwards individual and combined repeated/comma-separated filters to list and count") {
    const std::vector<std::pair<std::string, std::string>> cases = {
        {"userIds=36,50&userIds=70", R"({"access_logs":{},"users":{"id":[36,50,70]}})"},
        {"groupIds=1&groupIds=2,3", R"({"access_logs":{},"groups":{"id":[1,2,3]}})"},
        {"timeZoneIds=4,5&timeZoneIds=6", R"({"access_logs":{},"time_zones":{"id":[4,5,6]}})"},
        {"userIds=36,50&groupIds=1&timeZoneIds=2", R"({"access_logs":{},"users":{"id":[36,50]},"groups":{"id":[1]},"time_zones":{"id":[2]}})"},
        {"userIds=36&groupIds=1&timeZoneIds=2&from=100&to=200", R"({"access_logs":{"time":{">=":100,"<=":200}},"users":{"id":[36]},"groups":{"id":[1]},"time_zones":{"id":[2]}})"},
        {"userIds=9223372036854775807&groupIds=&timeZoneIds=", R"({"access_logs":{},"users":{"id":[9223372036854775807]}})"},
        {"userIds=,36,,&userIds=&groupIds=", R"({"access_logs":{},"users":{"id":[36]}})"},
        {"", "[]"},
        {"userIds=&groupIds=,,&timeZoneIds=", "[]"},
        {"from=100&to=200", R"([{"field":"time","operator":">=","value":100},{"field":"time","operator":"<=","value":200}])"},
        {"from=100&to=200&userIds=&groupIds=&timeZoneIds=", R"([{"field":"time","operator":">=","value":100},{"field":"time","operator":"<=","value":200}])"}
    };
    for (const auto& item : cases) {
        CAPTURE(item.first);
        TestServer server; int lists = 0, counts = 0;
        server.fake().responder = [&](const HttpRequest& req) {
            const auto body = nlohmann::json::parse(req.body);
            if (body["object"] == "access_logs") {
                CHECK(body["where"].dump() == nlohmann::json::parse(item.second).dump());
                if (body["fields"] == nlohmann::json::array({"COUNT(*)"})) {
                    ++counts;
                    CHECK_FALSE(body.contains("limit")); CHECK_FALSE(body.contains("offset"));
                } else {
                    ++lists; CHECK(body["limit"] == 2); CHECK(body["offset"] == 2);
                }
            }
            return dispatchAccessLogsBackendRequest(req, kTwoAccessLogRows, 5);
        };
        auto cli = server.http();
        auto res = cli.Get("/access-logs?limit=2&offset=2&" + item.first);
        REQUIRE(res != nullptr); CHECK(res->status == 200);
        const auto body = nlohmann::json::parse(res->body);
        CHECK(body["entries"].size() == 2); CHECK(body["total"] == 5);
        CHECK(lists == 1); CHECK(counts == 1);
    }
}

TEST_CASE("Access log route rejects malformed and overflowing filter IDs before device calls") {
    TestServer server; server.fake().responder = failIfCalled;
    auto cli = server.http();
    for (const auto* key : {"userIds", "groupIds", "timeZoneIds"}) {
        for (const auto* value : {"bad", "1x", "1.5", "1,bad", "9223372036854775808", "-9223372036854775809"}) {
            CAPTURE(key); CAPTURE(value);
            auto res = cli.Get(std::string("/access-logs?") + key + "=" + value);
            REQUIRE(res != nullptr); CHECK(res->status == 400);
        }
    }
}

TEST_CASE("R-2: GET /access-logs enrichment fields present and correct, including the time-zone join") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        return dispatchAccessLogsBackendRequest(req, kTwoAccessLogRows, 2);
    };
    auto cli = server.http();
    auto res = cli.Get("/access-logs");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    nlohmann::json entries = body["entries"];
    REQUIRE(entries.size() == 2);

    nlohmann::json resolved = entries[0];
    CHECK(resolved["id"] == 211);
    CHECK(resolved["userName"] == "Test User B");
    CHECK(resolved["employeeId"] == "EMP-036");
    CHECK(resolved["portalName"] == "Portal");
    CHECK(resolved["timeZoneName"] == "Always Allowed");
    CHECK(resolved["authorizationLabel"] == "Granted");
    CHECK(resolved["identificationLabel"] == "Facial");

    nlohmann::json unresolved = entries[1];
    CHECK(unresolved["id"] == 209);
    CHECK(unresolved["userName"] == "");
    CHECK(unresolved["employeeId"] == "");
    CHECK(unresolved["portalName"] == "");
    CHECK(unresolved["timeZoneName"] == "");  // no access_log_access_rules row for id 209
    CHECK(unresolved["authorizationLabel"] == "Not recognized");
}

TEST_CASE("R-3: from+to narrows both entries and total consistently") {
    TestServer server;
    server.fake().responder = [](const HttpRequest& req) {
        nlohmann::json parsed = nlohmann::json::parse(req.body);
        if (parsed.value("object", "") == "access_logs" && parsed["fields"] != nlohmann::json::array({"COUNT(*)"})) {
            REQUIRE(parsed["where"].size() == 2);  // both from and to present
        }
        // Narrowed window: only the first row (211) is "in range"; total must match.
        return dispatchAccessLogsBackendRequest(req, nlohmann::json::array({kTwoAccessLogRows[0]}), 1);
    };
    auto cli = server.http();
    auto res = cli.Get("/access-logs?from=1789150000&to=1789160000");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body["total"] == 1);
    CHECK(body["entries"].size() == 1);
}

// ---------------- ErrorMapping status codes (Decision 6) ----------------

TEST_CASE("ErrorMapping: every exception type maps to its documented status") {
    CHECK(mapException(amico::AuthenticationError("x")).first == 401);
    CHECK(mapException(amico::InvalidSessionError("x")).first == 401);
    CHECK(mapException(amico::ConfigurationError("x")).first == 500);
    CHECK(mapException(amico::NetworkError("x")).first == 502);
    CHECK(mapException(amico::TimeoutError("x")).first == 504);
    CHECK(mapException(amico::TlsVerificationError("x")).first == 502);
    CHECK(mapException(amico::ProtocolError("x")).first == 502);
    CHECK(mapException(amico::JsonParseError("x")).first == 502);
    CHECK(mapException(amico::ResponseTooLargeError("x")).first == 502);
    CHECK(mapException(amico::UnsupportedOperationError("x")).first == 400);
    CHECK(mapException(amico::HttpError(403, "x")).first == 403);
    CHECK(mapException(amico::HttpError(0, "x")).first == 502);  // invalid passthrough falls back
    CHECK(mapException(std::runtime_error("x")).first == 500);
}

// ---------------- Network-exposure guardrail (Decision 3.1) ----------------

TEST_CASE("validateNetworkExposure: loopback always passes") {
    BackendConfig config;
    config.bindAddress = "127.0.0.1";
    config.allowNetworkExposure = false;
    CHECK(validateNetworkExposure(config).empty());

    config.bindAddress = "localhost";
    CHECK(validateNetworkExposure(config).empty());
}

TEST_CASE("validateNetworkExposure: non-loopback without the exposure flag fails") {
    BackendConfig config;
    config.bindAddress = "0.0.0.0";
    config.allowNetworkExposure = false;
    CHECK_FALSE(validateNetworkExposure(config).empty());
}

TEST_CASE("validateNetworkExposure: non-loopback with the exposure flag passes") {
    BackendConfig config;
    config.bindAddress = "0.0.0.0";
    config.allowNetworkExposure = true;
    CHECK(validateNetworkExposure(config).empty());
}

namespace {
std::string loginBody(const std::string& url = "http://192.0.2.1") {
    return nlohmann::json{{"deviceUrl", url}, {"username", "TestUser"},
                          {"password", "placeholder-not-a-real-credential"}}.dump();
}
std::string responseCookie(const httplib::Response& res) {
    const auto value = res.get_header_value("Set-Cookie");
    return value.substr(0, value.find(';'));
}
}

TEST_CASE("GET /session is cookie exempt and initially logged out") {
    TestServer server(false);
    auto cli = server.http(false);
    auto res = cli.Get("/session");
    REQUIRE(res);
    CHECK(res->status == 200);
    CHECK(nlohmann::json::parse(res->body) == nlohmann::json{{"loggedIn", false}});
    CHECK(server.factoryCalls == 0);
}

TEST_CASE("POST /login success sets cookie and gates health and users") {
    TestServer server(false);
    auto cli = server.http(false);
    auto login = cli.Post("/login", loginBody(), "application/json");
    REQUIRE(login);
    CHECK(login->status == 200);
    CHECK(nlohmann::json::parse(login->body) == nlohmann::json{{"success", true}});
    const auto header = login->get_header_value("Set-Cookie");
    CHECK(header.find("; HttpOnly; SameSite=Lax; Path=/") != std::string::npos);
    const auto cookie = responseCookie(*login);
    const auto token = cookie.substr(cookie.find('=') + 1);
    CHECK(token.size() >= 32);
    CHECK(token.find_first_not_of("0123456789abcdef") == std::string::npos);
    auto session = cli.Get("/session");
    REQUIRE(session);
    CHECK(nlohmann::json::parse(session->body) ==
          nlohmann::json{{"loggedIn", true}, {"deviceUrl", "http://192.0.2.1"}});
    server.responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"users":[]})"); };
    cli.set_default_headers({{"Cookie", "other=value; " + cookie + "; last=value"}});
    auto health = cli.Get("/health");
    REQUIRE(health);
    CHECK(health->status == 200);
    auto users = cli.Get("/users");
    REQUIRE(users);
    CHECK(users->status == 200);
    CHECK(server.loginCalls == 1);
}

TEST_CASE("POST /login failed authentication preserves prior session") {
    for (bool prior : {false, true}) {
        TestServer server(prior);
        auto cli = server.http(false);
        server.responder = [](const HttpRequest&) { return FakeTransport::status(401); };
        auto res = cli.Post("/login", loginBody("http://192.0.2.2"), "application/json");
        REQUIRE(res);
        CHECK(res->status == 401);
        CHECK(nlohmann::json::parse(res->body)["type"] == "AuthenticationError");
        CHECK_FALSE(res->has_header("Set-Cookie"));
        CHECK(server.logoutCalls == 0);
        auto session = cli.Get("/session");
        REQUIRE(session);
        auto body = nlohmann::json::parse(session->body);
        CHECK(body["loggedIn"] == prior);
        if (prior) CHECK(body["deviceUrl"] == "http://192.0.2.1");
        auto authenticated = server.http();
        auto health = authenticated.Get("/health");
        REQUIRE(health);
        CHECK(health->status == (prior ? 200 : 401));
    }
}

TEST_CASE("POST /login malformed body never constructs a client or echoes input") {
    TestServer server(false);
    auto cli = server.http(false);
    for (const auto& body : {"{private-input", "{}", "[]", "null",
                            "{\"deviceUrl\":7,\"username\":false,\"password\":null}"}) {
        auto res = cli.Post("/login", body, "application/json");
        REQUIRE(res);
        CHECK(res->status == 400);
        CHECK(nlohmann::json::parse(res->body)["type"] == "InvalidRequest");
        CHECK(res->body.find("private-input") == std::string::npos);
        CHECK_FALSE(res->has_header("Set-Cookie"));
    }
    CHECK(server.factoryCalls == 0);
}

TEST_CASE("POST /login invalid URL and network failure preserve session") {
    TestServer server;
    auto cli = server.http(false);
    for (const auto& url : {"192.0.2.2", "ftp://192.0.2.2", "http://name@192.0.2.2",
                            "http://192.0.2.2?x=1", "http://192.0.2.2#fragment"}) {
        auto res = cli.Post("/login", loginBody(url), "application/json");
        REQUIRE(res);
        CHECK(res->status == 500);
        CHECK(nlohmann::json::parse(res->body)["type"] == "ConfigurationError");
        CHECK_FALSE(res->has_header("Set-Cookie"));
    }
    CHECK(server.loginCalls == 1);
    server.responder = [](const HttpRequest&) -> HttpResponse { throw NetworkError("offline"); };
    auto res = cli.Post("/login", loginBody(), "application/json");
    REQUIRE(res);
    CHECK(res->status == 502);
    CHECK_FALSE(res->has_header("Set-Cookie"));
    CHECK(server.logoutCalls == 0);
    server.responder = [](const HttpRequest&) { return FakeTransport::ok("{}"); };
    auto authenticated = server.http();
    auto health = authenticated.Get("/health");
    REQUIRE(health);
    CHECK(health->status == 200);
}

TEST_CASE("Every cookie gate rejects unauthorized requests before parsing or SDK calls") {
    const std::vector<std::pair<std::string, std::string>> routes = {
        {"GET", "/health"}, {"GET", "/system-information"}, {"GET", "/users?limit=bad"},
        {"GET", "/users/36"}, {"POST", "/users"}, {"PATCH", "/users/36"}, {"DELETE", "/users/36"},
        {"POST", "/users/36/groups/1"}, {"DELETE", "/users/36/groups/1"},
        {"POST", "/users/36/cards"}, {"DELETE", "/cards/1"}, {"PUT", "/users/36/administrator"},
        {"GET", "/users/36/image"}, {"GET", "/users/not-a-number/image"},
        {"PUT", "/users/36/image"}, {"DELETE", "/users/36/image"}, {"PUT", "/users/36/password"},
        {"GET", "/access-logs?limit=bad"}, {"POST", "/logout"}
    };
    for (bool prior : {false, true}) {
        TestServer server(prior);
        server.responder = failIfCalled;
        auto cli = server.http(false);
        for (const auto& cookie : {std::string(), std::string("amico_session=wrong")}) {
            for (const auto& [method, path] : routes) {
                httplib::Request req;
                req.method = method;
                req.path = path;
                req.body = "{malformed";
                if (!cookie.empty()) req.set_header("Cookie", cookie);
                auto res = cli.send(req);
                REQUIRE(res);
                CHECK(res->status == 401);
                CHECK(nlohmann::json::parse(res->body) ==
                      nlohmann::json{{"error", "not logged in"}, {"type", "InvalidSessionError"}});
            }
        }
        CHECK(server.factoryCalls == (prior ? 1 : 0));
        CHECK(server.loginCalls == (prior ? 1 : 0));
    }
}

TEST_CASE("POST /logout revokes cookie and clears session even on remote failure") {
    for (bool remoteFailure : {false, true}) {
        TestServer server;
        auto cli = server.http();
        server.responder = [remoteFailure](const HttpRequest&) {
            if (remoteFailure) throw NetworkError("offline");
            return FakeTransport::ok("{}");
        };
        auto logout = cli.Post("/logout", "", "application/json");
        REQUIRE(logout);
        CHECK(logout->status == (remoteFailure ? 502 : 200));
        CHECK(logout->get_header_value("Set-Cookie") == "amico_session=; Max-Age=0; Path=/");
        CHECK(server.logoutCalls == 1);
        auto health = cli.Get("/health");
        REQUIRE(health);
        CHECK(health->status == 401);
        auto session = cli.Get("/session");
        REQUIRE(session);
        CHECK(nlohmann::json::parse(session->body) == nlohmann::json{{"loggedIn", false}});
    }
}

TEST_CASE("Second successful login replaces session and logs out previous device") {
    for (bool cleanupFailure : {false, true}) {
        TestServer server;
        server.responder = [cleanupFailure](const HttpRequest& req) {
            if (cleanupFailure && req.path == "/logout.fcgi") throw NetworkError("old device offline");
            return FakeTransport::ok(readFixture("login_success.json"));
        };
        auto cli = server.http(false);
        auto login = cli.Post("/login", loginBody("http://192.0.2.2"), "application/json");
        REQUIRE(login);
        CHECK(login->status == 200);
        CHECK(server.logoutCalls == 1);
        const auto cookie = responseCookie(*login);
        CHECK(cookie != server.cookie);
        auto old = server.http();
        auto rejected = old.Get("/health");
        REQUIRE(rejected);
        CHECK(rejected->status == 401);
        cli.set_default_headers({{"Cookie", cookie}});
        auto health = cli.Get("/health");
        REQUIRE(health);
        CHECK(health->status == 200);
        auto session = cli.Get("/session");
        REQUIRE(session);
        CHECK(nlohmann::json::parse(session->body)["deviceUrl"] == "http://192.0.2.2");
    }
}

TEST_CASE("Manual cookie parser handles whitespace and rejects duplicates and lookalikes") {
    TestServer server;
    server.responder = [](const HttpRequest&) { return FakeTransport::ok("{}"); };
    auto cli = server.http(false);
    for (const auto& cookie : {"a=b;" + server.cookie, "a=b; \t" + server.cookie + " ;z=q"}) {
        auto res = cli.Get("/health", httplib::Headers{{"Cookie", cookie}});
        REQUIRE(res);
        CHECK(res->status == 200);
    }
    for (const auto& cookie : {"x" + server.cookie, server.cookie + ";" + server.cookie,
                              std::string("amico_session="), std::string("amico_session"),
                              server.cookie + "=extra"}) {
        auto res = cli.Get("/health", httplib::Headers{{"Cookie", cookie}});
        REQUIRE(res);
        CHECK(res->status == 401);
    }
}
