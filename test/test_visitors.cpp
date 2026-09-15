#include <doctest/doctest.h>

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "ObjectQuery.hpp"
#include "UserProfileResponder.hpp"
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

// ------------------------- Q-1/Q-2: userTypeId filter -------------------------

TEST_CASE("Q-1: userTypeId unset produces the exact pre-existing where shape (regression guard)") {
    nlohmann::json body = detail::buildUsersListBody(10, 0);
    nlohmann::json expected = nlohmann::json::array({
        {{"field", "user_type_id"}, {"operator", "="}, {"value", 0}, {"connector", "OR"}},
        {{"field", "user_type_id"}, {"operator", "IS NULL"}, {"connector", ") AND ("}},
    });
    CHECK(body["where"] == expected);
}

TEST_CASE("Q-2: userTypeId = 1 produces the Visitors filter") {
    nlohmann::json body = detail::buildUsersListBody(10, 0, 1);
    nlohmann::json expected = nlohmann::json::array({
        {{"field", "id"}, {"object", "user_types"}, {"value", 1}},
    });
    CHECK(body["where"] == expected);
    CHECK(body["where"][0].contains("connector") == false);
}

// ------------------------- Q-3: buildUserCreateBody -------------------------

TEST_CASE("Q-3: buildUserCreateBody with/without userTypeId") {
    nlohmann::json withoutType = detail::buildUserCreateBody("Test User", "TEST-001");
    nlohmann::json expectedWithout = nlohmann::json::array({{{"name", "Test User"}, {"registration", "TEST-001"}}});
    CHECK(withoutType["values"] == expectedWithout);

    nlohmann::json withType = detail::buildUserCreateBody("Test Visitor", "V-001", 1);
    nlohmann::json expectedWith = nlohmann::json::array(
        {{{"name", "Test Visitor"}, {"registration", "V-001"}, {"user_type_id", 1}}});
    CHECK(withType["values"] == expectedWith);
}

// ------------------------- Q-4: c_users query builders -------------------------

TEST_CASE("Q-4: c_users query builders") {
    nlohmann::json getBody = detail::buildCUsersGetBody(36);
    CHECK(getBody["object"] == "c_users");
    CHECK(getBody["fields"] == nlohmann::json::array({"id", "cpf"}));
    CHECK(getBody["where"] == nlohmann::json::array({{{"field", "user_id"}, {"value", 36}}}));

    nlohmann::json createBody = detail::buildCUsersCreateBody(36, "12345678900");
    CHECK(createBody["object"] == "c_users");
    CHECK(createBody["values"] == nlohmann::json::array({{{"user_id", 36}, {"cpf", "12345678900"}}}));

    nlohmann::json updateBody = detail::buildCUsersUpdateBody(7, "98765432100");
    CHECK(updateBody["object"] == "c_users");
    CHECK(updateBody["values"] == nlohmann::json{{"cpf", "98765432100"}});
    CHECK(updateBody["where"] == nlohmann::json{{"c_users", {{"id", 7}}}});

    nlohmann::json deleteBody = detail::buildCUsersDeleteBody(36);
    CHECK(deleteBody["object"] == "c_users");
    CHECK(deleteBody["where"] == nlohmann::json{{"c_users", {{"user_id", 36}}}});
}

// ------------------------- Q-5: mapUser cpf population -------------------------

TEST_CASE("Q-5: mapUser populates cpf when a c_users row exists, leaves it unset when absent") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.value("object", std::string{}) == "c_users") {
            int64_t userId = body["where"][0]["value"].get<int64_t>();
            if (userId == 36) {
                return FakeTransport::ok(R"({"c_users":[{"id":7,"user_id":36,"cpf":"12345678900"}]})");
            }
            return FakeTransport::ok(R"({"c_users":[]})");
        }
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };

    std::optional<AmicoUser> user36 = client.users().get(36);
    REQUIRE(user36.has_value());
    REQUIRE(user36->cpf.has_value());
    CHECK(*user36->cpf == "12345678900");
}

TEST_CASE("Q-5b: mapUser leaves cpf unset (not empty string) when no c_users row exists") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };

    std::optional<AmicoUser> user = client.users().get(36);
    REQUIRE(user.has_value());
    CHECK_FALSE(user->cpf.has_value());
}

// ------------------------- Q-6: createUser/updateUser trigger a second c_users call -------------------------

TEST_CASE("Q-6: createUser with cpf triggers a second c_users create_objects call") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/create_objects.fcgi" && body["object"] == "users") {
            CHECK(body["values"][0]["user_type_id"] == 1);
            return FakeTransport::ok(R"({"ids":[99]})");
        }
        if (req.path == "/create_objects.fcgi" && body["object"] == "c_users") {
            CHECK(body["values"][0]["user_id"] == 99);
            CHECK(body["values"][0]["cpf"] == "12345678900");
            return FakeTransport::ok(R"({"ids":[1]})");
        }
        return FakeTransport::status(500, "{}");
    };

    NewUser newUser;
    newUser.name = "Test Visitor";
    newUser.registration = "V-001";
    newUser.userTypeId = 1;
    newUser.cpf = "12345678900";
    int64_t id = client.users().create(newUser);
    CHECK(id == 99);
    CHECK(fake->requestLog.size() == 3);  // login + users create + c_users create
}

TEST_CASE("Q-6b: createUser without cpf makes no c_users call at all") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] != "c_users");  // must never be called
        return FakeTransport::ok(R"({"ids":[99]})");
    };

    NewUser newUser;
    newUser.name = "Test User";
    newUser.registration = "U-001";
    int64_t id = client.users().create(newUser);
    CHECK(id == 99);
    CHECK(fake->requestLog.size() == 2);  // login + users create only
}

// ------------------------- Q-7: removeUser defensive c_users cleanup -------------------------

TEST_CASE("Q-7: removeUser issues the defensive c_users cleanup before the users delete") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        order.push_back(body["object"].get<std::string>());
        if (body["object"] == "c_users") {
            return FakeTransport::ok(R"({"changes": 0})");
        }
        return FakeTransport::ok(R"({"changes": 1})");
    };

    client.users().remove(36);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "c_users");
    CHECK(order[1] == "users");
}
