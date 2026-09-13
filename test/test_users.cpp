#include <doctest/doctest.h>

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "UserProfileResponder.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::test;

namespace {
AmicoClient loggedInClient(FakeTransport** outFakePtr) {
    AmicoConfig config;
    config.baseUrl = "http://192.0.2.1";
    config.username = "TestUser";
    config.password = "placeholder-not-a-real-credential";
    AmicoClient client(config);

    auto fake = std::make_unique<FakeTransport>();
    *outFakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    (*outFakePtr)->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
    client.login();
    return client;
}
}  // namespace

TEST_CASE("scenario 8: user-list parsing maps the confirmed default-filter response") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        CHECK(req.path == "/load_objects.fcgi");
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    std::vector<AmicoUser> users = client.users().list();
    REQUIRE(users.size() == 3);
    CHECK(users[0].id == 5);
    CHECK(users[0].name == "Test User A");
    CHECK(users[1].id == 36);
    CHECK(users[2].id == 4);
    CHECK(fake->requestLog.size() == 20);  // login + users + 6 queries per user
    for (const auto& user : users) {
        CHECK(user.groupIds.empty());
        CHECK(user.groupCount == 0);
        CHECK(user.cardCount == 0);
        CHECK_FALSE(user.isAdministrator);
        CHECK(user.faceCount == 0);
        CHECK(user.bioCount == 0);
        CHECK_FALSE(user.hasPassword);
    }
}

TEST_CASE("scenario 10: pagination -- limit/offset round-trip into the request body") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["limit"] == 20);
        CHECK(body["offset"] == 40);
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    UserQuery query;
    query.limit = 20;
    query.offset = 40;
    client.users().list(query);
}

TEST_CASE("scenario 10b: default page size is used when limit is left at 0") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["limit"] == 50);  // AmicoConfig::defaultPageSize default
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    client.users().list(UserQuery{});
}

TEST_CASE("scenario 11: unknown/extra response fields are ignored, not fatal") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("unknown_extra_field.json"));
    };

    std::vector<AmicoUser> users;
    CHECK_NOTHROW(users = client.users().list());
    REQUIRE(users.size() == 1);
    CHECK(users[0].id == 36);
}

TEST_CASE("scenario 16: AmicoUser cannot represent password/salt even if the fixture includes them") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("sensitive_fields_present.json"));
    };

    std::vector<AmicoUser> users = client.users().list();
    REQUIRE(users.size() == 1);
    CHECK(users[0].id == 36);
    // AmicoUser has no password/salt/panic_password/panic_salt members at
    // all -- this is a compile-time guarantee (see amico/Types.hpp), not
    // just a runtime check. Nothing further to assert here beyond "this
    // compiles and the safe fields still map correctly."
}

TEST_CASE("scenario 21: UsersApi::get(id) found returns the mapped AmicoUser") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        nlohmann::json body = nlohmann::json::parse(req.body);
        REQUIRE(body["where"].size() == 1);
        CHECK(body["where"][0]["field"] == "id");
        CHECK(body["where"][0]["value"] == 36);
        CHECK(body["where"][0].contains("connector") == false);  // single clause needs no connector
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };

    std::optional<AmicoUser> user = client.users().get(36);
    REQUIRE(user.has_value());
    CHECK(user->id == 36);
    CHECK(user->name == "Test User B");
    CHECK(fake->requestLog.size() == 8);  // login + users + 6 profile queries
}

TEST_CASE("scenario 22: UsersApi::get(id) not found returns an empty optional") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_get_not_found.json")); };

    std::optional<AmicoUser> user = client.users().get(999999);
    CHECK_FALSE(user.has_value());
    CHECK(fake->requestLog.size() == 2);  // no profile queries for a missing user
}

TEST_CASE("UsersApi::create sends the confirmed payload and returns the assigned id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.method == "POST");
        CHECK(req.path == "/create_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        nlohmann::json expected = {
            {"object", "users"},
            {"values", nlohmann::json::array({{{"name", "Test User"}, {"registration", "TEST-001"}}})},
        };
        CHECK(body == expected);
        return FakeTransport::ok(readFixture("user_create_success.json"));
    };

    NewUser user;
    user.name = "Test User";
    user.registration = "TEST-001";
    CHECK(client.users().create(user) == 12345);
    CHECK(fake->requestLog.size() == 2);  // login + one write
}

TEST_CASE("UsersApi::update sends both writable fields with a scalar id filter") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.method == "POST");
        CHECK(req.path == "/modify_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        nlohmann::json expected = {
            {"object", "users"},
            {"values", {{"name", "Updated Test User"}, {"registration", "TEST-002"}}},
            {"where", {{"users", {{"id", 12345}}}}},
        };
        CHECK(body == expected);
        return FakeTransport::ok(readFixture("user_update_success.json"));
    };

    UserUpdate user;
    user.id = 12345;
    user.name = "Updated Test User";
    user.registration = "TEST-002";
    CHECK_NOTHROW(client.users().update(user));
    CHECK(fake->requestLog.size() == 2);
}

TEST_CASE("UsersApi::update omits unset fields and preserves explicitly empty strings") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    UserUpdate user;
    user.id = 12345;
    nlohmann::json expectedValues;

    SUBCASE("name only") {
        user.name = "Updated Test User";
        expectedValues = {{"name", "Updated Test User"}};
    }
    SUBCASE("clear registration only") {
        user.registration = "";
        expectedValues = {{"registration", ""}};
    }

    fake->responder = [&](const HttpRequest& req) {
        CHECK(req.path == "/modify_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["values"] == expectedValues);
        return FakeTransport::ok(readFixture("user_update_success.json"));
    };

    CHECK_NOTHROW(client.users().update(user));
}

TEST_CASE("UsersApi::remove sends a single-id array to destroy_objects") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.method == "POST");
        CHECK(req.path == "/destroy_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        nlohmann::json expected = {
            {"object", "users"},
            {"where", {{"users", {{"id", nlohmann::json::array({12345})}}}}},
        };
        CHECK(body == expected);
        return FakeTransport::ok(readFixture("user_delete_success.json"));
    };

    CHECK_NOTHROW(client.users().remove(12345));
    CHECK(fake->requestLog.size() == 2);
}

TEST_CASE("UsersApi::create rejects an error response with ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_create_failure.json")); };
    CHECK_THROWS_AS(client.users().create(NewUser{"Test User", "TEST-001"}), ProtocolError);
}

TEST_CASE("UsersApi::update rejects an error response with ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_update_failure.json")); };
    CHECK_THROWS_AS(client.users().update(UserUpdate{12345, "Updated Test User", std::nullopt}), ProtocolError);
}

TEST_CASE("UsersApi::remove rejects an error response with ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_delete_failure.json")); };
    CHECK_THROWS_AS(client.users().remove(12345), ProtocolError);
}

TEST_CASE("UsersApi::create propagates a transport timeout as TimeoutError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw TimeoutError("simulated timeout"); };
    CHECK_THROWS_AS(client.users().create(NewUser{"Test User", "TEST-001"}), TimeoutError);
    CHECK(fake->requestLog.size() == 2);  // no retry after an uncertain write
}

TEST_CASE("UsersApi::update propagates a transport timeout as TimeoutError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw TimeoutError("simulated timeout"); };
    CHECK_THROWS_AS(client.users().update(UserUpdate{12345, "Updated Test User", std::nullopt}), TimeoutError);
    CHECK(fake->requestLog.size() == 2);
}

TEST_CASE("UsersApi::remove propagates a transport timeout as TimeoutError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw TimeoutError("simulated timeout"); };
    CHECK_THROWS_AS(client.users().remove(12345), TimeoutError);
    CHECK(fake->requestLog.size() == 2);
}
