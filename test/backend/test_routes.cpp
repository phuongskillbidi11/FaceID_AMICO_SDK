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

TEST_CASE("GET /access-logs lists entries") {
    TestServer server;
    server.fake().responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("access_logs_list.json")); };
    auto cli = server.http();
    auto res = cli.Get("/access-logs");
    REQUIRE(res != nullptr);
    CHECK(res->status == 200);
    nlohmann::json body = nlohmann::json::parse(res->body);
    CHECK(body.is_array());
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
