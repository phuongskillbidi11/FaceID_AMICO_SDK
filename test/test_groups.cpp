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

// ------------------------- G-9..G-12: Time Zones linking builder shapes -------------------------
// (2026-09-16-groups-timezones-write-side plan)

TEST_CASE("G-9: buildGroupTimeZoneIdsBody matches the live-captured cross-object where shape") {
    nlohmann::json body = detail::buildGroupTimeZoneIdsBody(6);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "time_zones"},
        {"fields", nlohmann::json::array({"id"})},
        {"where", nlohmann::json::array({
            {{"object", "groups"}, {"field", "id"}, {"value", 6}, {"connector", ") AND ("}},
        })},
        {"order", nlohmann::json::array({"name"})},
        {"limit", 1000},
        {"offset", 0},
    };
    CHECK(body == expected);
}

TEST_CASE("G-10: buildGroupAccessRuleIdBody uses the bare-object where shape") {
    nlohmann::json body = detail::buildGroupAccessRuleIdBody(6);
    CHECK(body["object"] == "group_access_rules");
    CHECK(body["fields"] == nlohmann::json::array({"access_rule_id"}));
    CHECK(body["where"] == nlohmann::json{{"group_access_rules", {{"group_id", 6}}}});
}

TEST_CASE("G-11: buildGroupAccessRuleCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildGroupAccessRuleCreateBody(6);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "access_rules"},
        {"fields", nlohmann::json::array({"id", "name", "type", "priority"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"name"})},
        {"values", nlohmann::json::array({{
            {"name", "(access_rules automatically created for groups 6)"},
            {"type", 1}, {"priority", 0},
        }})},
    };
    CHECK(body == expected);
}

TEST_CASE("G-12: buildGroupAccessRuleLinkBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildGroupAccessRuleLinkBody(6, 7);
    nlohmann::json expected = {
        {"object", "group_access_rules"},
        {"values", nlohmann::json::array({{{"group_id", 6}, {"access_rule_id", 7}}})},
    };
    CHECK(body == expected);
}

// ------------------------- G-13..G-16: GroupsApi::addTimeZone/removeTimeZone -------------------------

TEST_CASE("G-13: addTimeZone() creates access_rules + group_access_rules on the first call, in order") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "group_access_rules") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array()}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rules") {
            order.push_back("create_access_rule");
            CHECK(body["values"][0]["name"] == "(access_rules automatically created for groups 6)");
            return FakeTransport::ok(R"({"ids":[7]})");
        }
        if (req.path == "/create_objects.fcgi" && object == "group_access_rules") {
            order.push_back("link_access_rule");
            CHECK(body["values"][0]["group_id"] == 6);
            CHECK(body["values"][0]["access_rule_id"] == 7);
            return FakeTransport::ok(R"({"ids":[9]})");
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            order.push_back("link_time_zone");
            CHECK(body["values"][0]["access_rule_id"] == 7);
            CHECK(body["values"][0]["time_zone_id"] == 1);
            return FakeTransport::ok(R"({"ids":[10]})");
        }
        return FakeTransport::status(500, "{}");
    };

    client.groups().addTimeZone(6, 1);
    REQUIRE(order.size() == 4);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "create_access_rule");
    CHECK(order[2] == "link_access_rule");
    CHECK(order[3] == "link_time_zone");
}

TEST_CASE("G-14: addTimeZone() reuses an existing access_rule on a second call") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "group_access_rules") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array({
                {{"access_rule_id", 7}},
            })}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            order.push_back("link_time_zone");
            CHECK(body["values"][0]["access_rule_id"] == 7);
            CHECK(body["values"][0]["time_zone_id"] == 5);
            return FakeTransport::ok(R"({"ids":[11]})");
        }
        return FakeTransport::status(500, "{}");
    };

    client.groups().addTimeZone(6, 5);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "link_time_zone");
}

TEST_CASE("G-15: removeTimeZone() unlinks via the found access_rule_id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "group_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array({
                {{"access_rule_id", 7}},
            })}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["where"][0]["value"] == 7);
            CHECK(body["where"][1]["value"] == nlohmann::json::array({1}));
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    CHECK_NOTHROW(client.groups().removeTimeZone(6, 1));
}

TEST_CASE("G-16: removeTimeZone() throws ProtocolError when no access_rule exists") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"group_access_rules", nlohmann::json::array()}}.dump());
    };
    CHECK_THROWS_AS(client.groups().removeTimeZone(6, 1), ProtocolError);
}
