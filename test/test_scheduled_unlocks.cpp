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

// ------------------------- SU-1..SU-10: query builder shapes -------------------------

TEST_CASE("SU-1: buildScheduledUnlocksListBody requests kScheduledUnlockFields") {
    nlohmann::json body = detail::buildScheduledUnlocksListBody();
    CHECK(body["object"] == "scheduled_unlocks");
    CHECK(body["fields"] == detail::kScheduledUnlockFields);
}

TEST_CASE("SU-2: buildScheduledUnlockCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildScheduledUnlockCreateBody("ZZ_ScheduledUnlockTest", "Test message");
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "scheduled_unlocks"},
        {"fields", nlohmann::json::array({"id", "name", "message"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"name"})},
        {"values", nlohmann::json::array({{{"name", "ZZ_ScheduledUnlockTest"}, {"message", "Test message"}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("SU-3: buildScheduledUnlockUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildScheduledUnlockUpdateBody(7, "Renamed", "New message");
    CHECK(body["object"] == "scheduled_unlocks");
    CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}, {"message", "New message"}});
    CHECK(body["where"] == nlohmann::json{{"scheduled_unlocks", {{"id", 7}}}});
}

TEST_CASE("SU-4: buildScheduledUnlockDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildScheduledUnlockDeleteBody(7);
    CHECK(body["object"] == "scheduled_unlocks");
    CHECK(body["where"] == nlohmann::json{{"scheduled_unlocks", {{"id", nlohmann::json::array({7})}}}});
}

TEST_CASE("SU-5: buildScheduledUnlockTimeZoneIdsBody matches the live-captured cross-object where shape") {
    nlohmann::json body = detail::buildScheduledUnlockTimeZoneIdsBody(1);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "time_zones"},
        {"fields", nlohmann::json::array({"id"})},
        {"where", nlohmann::json::array({
            {{"object", "scheduled_unlocks"}, {"field", "id"}, {"value", 1}, {"connector", ") AND ("}},
        })},
        {"order", nlohmann::json::array({"name"})},
        {"limit", 1000},
        {"offset", 0},
    };
    CHECK(body == expected);
}

TEST_CASE("SU-6: buildScheduledUnlockAccessRuleIdBody uses the bare-object where shape") {
    nlohmann::json body = detail::buildScheduledUnlockAccessRuleIdBody(2);
    CHECK(body["object"] == "scheduled_unlock_access_rules");
    CHECK(body["fields"] == nlohmann::json::array({"access_rule_id"}));
    CHECK(body["where"] == nlohmann::json{{"scheduled_unlock_access_rules", {{"scheduled_unlock_id", 2}}}});
}

TEST_CASE("SU-7: buildScheduledUnlockAccessRuleCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildScheduledUnlockAccessRuleCreateBody(2);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "access_rules"},
        {"fields", nlohmann::json::array({"id", "name", "type", "priority"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"name"})},
        {"values", nlohmann::json::array({{
            {"name", "(access_rules automatically created for scheduled_unlocks 2)"},
            {"type", 1}, {"priority", 0},
        }})},
    };
    CHECK(body == expected);
}

TEST_CASE("SU-8: buildScheduledUnlockAccessRuleLinkBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildScheduledUnlockAccessRuleLinkBody(2, 4);
    nlohmann::json expected = {
        {"object", "scheduled_unlock_access_rules"},
        {"values", nlohmann::json::array({{{"scheduled_unlock_id", 2}, {"access_rule_id", 4}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("SU-9: buildAccessRuleTimeZoneLinkBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildAccessRuleTimeZoneLinkBody(4, 1);
    nlohmann::json expected = {
        {"object", "access_rule_time_zones"},
        {"values", nlohmann::json::array({{{"access_rule_id", 4}, {"time_zone_id", 1}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("SU-10: buildAccessRuleTimeZoneUnlinkBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildAccessRuleTimeZoneUnlinkBody(4, 1);
    nlohmann::json expected = {
        {"object", "access_rule_time_zones"},
        {"where", nlohmann::json::array({
            {{"object", "access_rule_time_zones"}, {"field", "access_rule_id"}, {"value", 4}},
            {{"object", "access_rule_time_zones"}, {"field", "time_zone_id"}, {"value", nlohmann::json::array({1})}},
        })},
    };
    CHECK(body == expected);
}

// ------------------------- SU-11..SU-15: ScheduledUnlocksApi base CRUD -------------------------

TEST_CASE("SU-11: ScheduledUnlocksApi::list() populates timeZoneIds via the join-resolving read") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlocks") {
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlocks", nlohmann::json::array({
                {{"id", 1}, {"name", "Weekend"}, {"message", "msg"}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "time_zones") {
            return FakeTransport::ok(nlohmann::json{{"time_zones", nlohmann::json::array({
                {{"id", 1}}, {{"id", 3}},
            })}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    std::vector<ScheduledUnlock> result = client.scheduledUnlocks().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].id == 1);
    CHECK(result[0].name == "Weekend");
    CHECK(result[0].message == "msg");
    CHECK(result[0].timeZoneIds == std::vector<int64_t>{1, 3});
}

TEST_CASE("SU-12: ScheduledUnlocksApi::create() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[42]})"); };

    NewScheduledUnlock unlock; unlock.name = "ZZ_Test"; unlock.message = "msg";
    CHECK(client.scheduledUnlocks().create(unlock) == 42);
}

TEST_CASE("SU-13: ScheduledUnlocksApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    ScheduledUnlockUpdate update; update.id = 7; update.name = "Renamed"; update.message = "msg";
    CHECK_THROWS_AS(client.scheduledUnlocks().update(update), ProtocolError);
}

TEST_CASE("SU-14: ScheduledUnlocksApi::update() succeeds on a positive changes count") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "scheduled_unlocks");
        CHECK(body["values"]["name"] == "Renamed");
        return FakeTransport::ok(R"({"changes": 1})");
    };

    ScheduledUnlockUpdate update; update.id = 7; update.name = "Renamed"; update.message = "msg";
    CHECK_NOTHROW(client.scheduledUnlocks().update(update));
}

TEST_CASE("SU-15: ScheduledUnlocksApi::remove() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };
    CHECK_THROWS_AS(client.scheduledUnlocks().remove(7), ProtocolError);
}

// ------------------------- SU-16..SU-19: time-zone linking -------------------------

TEST_CASE("SU-16: addTimeZone() creates access_rules + scheduled_unlock_access_rules on the first call, in order") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array()}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rules") {
            order.push_back("create_access_rule");
            CHECK(body["values"][0]["name"] == "(access_rules automatically created for scheduled_unlocks 2)");
            return FakeTransport::ok(R"({"ids":[4]})");
        }
        if (req.path == "/create_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            order.push_back("link_access_rule");
            CHECK(body["values"][0]["scheduled_unlock_id"] == 2);
            CHECK(body["values"][0]["access_rule_id"] == 4);
            return FakeTransport::ok(R"({"ids":[9]})");
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            order.push_back("link_time_zone");
            CHECK(body["values"][0]["access_rule_id"] == 4);
            CHECK(body["values"][0]["time_zone_id"] == 1);
            return FakeTransport::ok(R"({"ids":[10]})");
        }
        return FakeTransport::status(500, "{}");
    };

    client.scheduledUnlocks().addTimeZone(2, 1);
    REQUIRE(order.size() == 4);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "create_access_rule");
    CHECK(order[2] == "link_access_rule");
    CHECK(order[3] == "link_time_zone");
}

TEST_CASE("SU-17: addTimeZone() reuses an existing access_rule on a second call") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array({
                {{"access_rule_id", 4}},
            })}}.dump());
        }
        if (req.path == "/create_objects.fcgi" && object == "access_rule_time_zones") {
            order.push_back("link_time_zone");
            CHECK(body["values"][0]["access_rule_id"] == 4);
            CHECK(body["values"][0]["time_zone_id"] == 3);
            return FakeTransport::ok(R"({"ids":[11]})");
        }
        return FakeTransport::status(500, "{}");
    };

    client.scheduledUnlocks().addTimeZone(2, 3);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "link_time_zone");
}

TEST_CASE("SU-18: removeTimeZone() unlinks via the found access_rule_id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "scheduled_unlock_access_rules") {
            return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array({
                {{"access_rule_id", 4}},
            })}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "access_rule_time_zones") {
            CHECK(body["where"][0]["value"] == 4);
            CHECK(body["where"][1]["value"] == nlohmann::json::array({1}));
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };
    CHECK_NOTHROW(client.scheduledUnlocks().removeTimeZone(2, 1));
}

TEST_CASE("SU-19: removeTimeZone() throws ProtocolError when no access_rule exists") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"scheduled_unlock_access_rules", nlohmann::json::array()}}.dump());
    };
    CHECK_THROWS_AS(client.scheduledUnlocks().removeTimeZone(2, 1), ProtocolError);
}
