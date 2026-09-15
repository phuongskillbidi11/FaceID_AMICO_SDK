#include <doctest/doctest.h>

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "ObjectQuery.hpp"
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

// ------------------------- G-1: query builder shapes -------------------------

TEST_CASE("G-1: buildGroupCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildGroupCreateBody("ZZ_TestGroup");
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "groups"},
        {"fields", nlohmann::json::array({"id", "name"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"name"})},
        {"values", nlohmann::json::array({{{"name", "ZZ_TestGroup"}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("G-2: buildGroupUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildGroupUpdateBody(7, "Renamed");
    CHECK(body["object"] == "groups");
    CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}});
    CHECK(body["where"] == nlohmann::json{{"groups", {{"id", 7}}}});
}

TEST_CASE("G-3: buildGroupDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildGroupDeleteBody(7);
    CHECK(body["object"] == "groups");
    CHECK(body["where"] == nlohmann::json{{"groups", {{"id", nlohmann::json::array({7})}}}});
}

// ------------------------- G-4: GroupsApi::create/update/remove -------------------------

TEST_CASE("G-4: GroupsApi::create() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[42]})"); };

    NewGroup group;
    group.name = "ZZ_TestGroup";
    CHECK(client.groups().create(group) == 42);
}

TEST_CASE("G-5: GroupsApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    GroupUpdate update; update.id = 7; update.name = "Renamed";
    CHECK_THROWS_AS(client.groups().update(update), ProtocolError);
}

TEST_CASE("G-6: GroupsApi::update() succeeds on a positive changes count") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "groups");
        CHECK(body["values"]["name"] == "Renamed");
        return FakeTransport::ok(R"({"changes": 1})");
    };

    GroupUpdate update; update.id = 7; update.name = "Renamed";
    CHECK_NOTHROW(client.groups().update(update));
}

TEST_CASE("G-7: GroupsApi::remove() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    CHECK_THROWS_AS(client.groups().remove(7), ProtocolError);
}

TEST_CASE("G-8: GroupsApi::remove() does not special-case any group id (including id 1)") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["where"] == nlohmann::json{{"groups", {{"id", nlohmann::json::array({1})}}}});
        return FakeTransport::ok(R"({"changes": 1})");
    };
    // No SDK-level guard against id 1 -- see spec.md Decision 2. If the
    // device itself rejects this, that's a ProtocolError like any other.
    CHECK_NOTHROW(client.groups().remove(1));
}
