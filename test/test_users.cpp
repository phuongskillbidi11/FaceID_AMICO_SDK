#include <doctest/doctest.h>

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"

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
        CHECK(req.path == "/load_objects.fcgi");
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    std::vector<AmicoUser> users = client.users().list();
    REQUIRE(users.size() == 3);
    CHECK(users[0].id == 5);
    CHECK(users[0].name == "Test User A");
    CHECK(users[1].id == 36);
    CHECK(users[2].id == 4);
}

TEST_CASE("scenario 10: pagination -- limit/offset round-trip into the request body") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
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
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["limit"] == 50);  // AmicoConfig::defaultPageSize default
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    client.users().list(UserQuery{});
}

TEST_CASE("scenario 11: unknown/extra response fields are ignored, not fatal") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("unknown_extra_field.json")); };

    std::vector<AmicoUser> users;
    CHECK_NOTHROW(users = client.users().list());
    REQUIRE(users.size() == 1);
    CHECK(users[0].id == 36);
}

TEST_CASE("scenario 16: AmicoUser cannot represent password/salt even if the fixture includes them") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("sensitive_fields_present.json")); };

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
}

TEST_CASE("scenario 22: UsersApi::get(id) not found returns an empty optional") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("user_get_not_found.json")); };

    std::optional<AmicoUser> user = client.users().get(999999);
    CHECK_FALSE(user.has_value());
}
