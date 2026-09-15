#include <doctest/doctest.h>

#include <map>
#include <memory>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "AccessLogLabels.hpp"
#include "FakeTransport.hpp"
#include "ObjectQuery.hpp"
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

TEST_CASE("Groups list builder and SDK send exactly the name-only read shape, plus timeZoneIds per row") {
    const auto expected = nlohmann::json::parse(R"json({"object":"groups","fields":["id","name"]})json");
    CHECK(detail::buildGroupsListBody() == expected);
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    int groupsCalls = 0;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body["object"] == "groups") {
            ++groupsCalls;
            CHECK(nlohmann::json::parse(req.body) == expected);
            return FakeTransport::ok(R"json({"groups":[{"id":1,"name":"Staff"},{"id":2,"name":"Visitors"}]})json");
        }
        // Per-row timeZoneIds lookup (2026-09-16-groups-timezones-write-side).
        CHECK(body["object"] == "time_zones");
        return FakeTransport::ok(nlohmann::json{{"time_zones", nlohmann::json::array({{{"id", 1}}})}}.dump());
    };
    const auto groups = client.groups().list();
    CHECK(groupsCalls == 1);
    REQUIRE(groups.size() == 2);
    CHECK(groups[0].id == 1);
    CHECK(groups[0].name == "Staff");
    CHECK(groups[0].timeZoneIds == std::vector<int64_t>{1});
    CHECK(groups[1].id == 2);
    CHECK(groups[1].name == "Visitors");
    CHECK(groups[1].timeZoneIds == std::vector<int64_t>{1});
}

TEST_CASE("Access logs unset filters preserve full serialized list/count request bodies") {
    // Literal pre-change bodies captured in Task 2.1, not built by the implementation under test.
    const std::string list = R"json({"fields":["id","time","user_id","portal_id","log_type_id","event","identifier_id"],"finish":true,"join":"LEFT","limit":20,"object":"access_logs","offset":0,"order":["time","descending"],"where":[{"field":"time","operator":">=","value":100},{"field":"time","operator":"<=","value":200}]})json";
    const std::string count = R"json({"fields":["COUNT(*)"],"object":"access_logs","where":[{"field":"time","operator":">=","value":100},{"field":"time","operator":"<=","value":200}]})json";
    CHECK(detail::buildAccessLogsListBody(100, 200, 20, 0).dump() == list);
    CHECK(detail::buildAccessLogsCountBody(100, 200).dump() == count);
    const std::vector<int64_t> empty;
    CHECK(detail::buildAccessLogsListBody(100, 200, 20, 0, empty, empty, empty).dump() == list);
    CHECK(detail::buildAccessLogsCountBody(100, 200, empty, empty, empty).dump() == count);
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    int calls = 0;
    fake->responder = [&](const HttpRequest& req) {
        const bool isCount = nlohmann::json::parse(req.body)["fields"] == nlohmann::json::array({"COUNT(*)"});
        CHECK(req.body == (isCount ? count : list));
        ++calls;
        return FakeTransport::ok(isCount ? R"json({"access_logs":[{"COUNT(*)":3}]})json" : readFixture("access_logs_list.json"));
    };
    AccessLogQuery query; query.from = 100; query.to = 200; query.limit = 20;
    CHECK(client.accessLogs().list(query).size() == 3);
    CHECK(client.accessLogs().accessLogsCount(query) == 3);
    CHECK(calls == 2);
}

TEST_CASE("AccessLogQuery list and count transport shapes cover every filter and date-bound combination") {
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    for (int mask = 0; mask < 8; ++mask) {
        for (int dates = 0; dates < 4; ++dates) {
            CAPTURE(mask); CAPTURE(dates);
            AccessLogQuery query; query.limit = 10; query.offset = 20;
            if (dates & 1) query.from = 100;
            if (dates & 2) query.to = 200;
            if (mask & 1) query.userIds = std::vector<int64_t>{36, 50};
            if (mask & 2) query.groupIds = std::vector<int64_t>{1, 2};
            if (mask & 4) query.timeZoneIds = std::vector<int64_t>{3, 4};
            auto expected = nlohmann::json::array();
            if (mask) {
                expected = {{"access_logs", nlohmann::json::object()}};
                if (dates & 1) expected["access_logs"]["time"][">="] = 100;
                if (dates & 2) expected["access_logs"]["time"]["<="] = 200;
                if (mask & 1) expected["users"] = {{"id", {36, 50}}};
                if (mask & 2) expected["groups"] = {{"id", {1, 2}}};
                if (mask & 4) expected["time_zones"] = {{"id", {3, 4}}};
            } else {
                if (dates & 1) expected.push_back({{"field", "time"}, {"operator", ">="}, {"value", 100}});
                if (dates & 2) expected.push_back({{"field", "time"}, {"operator", "<="}, {"value", 200}});
            }
            CHECK(detail::buildAccessLogsListBody(query.from, query.to, 10, 20, query.userIds, query.groupIds, query.timeZoneIds)["where"] == expected);
            CHECK(detail::buildAccessLogsCountBody(query.from, query.to, query.userIds, query.groupIds, query.timeZoneIds)["where"] == expected);
            int lists = 0, counts = 0;
            fake->responder = [&](const HttpRequest& req) {
                const auto body = nlohmann::json::parse(req.body);
                CHECK(req.path == "/load_objects.fcgi");
                CHECK(body["where"].dump() == expected.dump());
                if (body["fields"] == nlohmann::json::array({"COUNT(*)"})) {
                    ++counts;
                    CHECK_FALSE(body.contains("limit"));
                    CHECK_FALSE(body.contains("offset"));
                    return FakeTransport::ok(R"json({"access_logs":[{"COUNT(*)":3}]})json");
                }
                ++lists;
                CHECK(body["limit"] == 10); CHECK(body["offset"] == 20);
                return FakeTransport::ok(readFixture("access_logs_list.json"));
            };
            CHECK(client.accessLogs().list(query).size() == 3);
            CHECK(client.accessLogs().accessLogsCount(query) == 3);
            CHECK(lists == 1); CHECK(counts == 1);
        }
    }
}

TEST_CASE("scenario 9: access-log parsing maps the confirmed schema, including nullable user_id/portal_id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.path == "/load_objects.fcgi");
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    std::vector<AccessLogEntry> logs = client.accessLogs().list();
    REQUIRE(logs.size() == 3);
    CHECK(logs[0].id == 211);
    REQUIRE(logs[0].userId.has_value());
    CHECK(*logs[0].userId == 36);
    CHECK_FALSE(logs[2].userId.has_value());  // null in the fixture
    CHECK_FALSE(logs[2].portalId.has_value());
}

TEST_CASE("AccessLogQuery.from and .to both become server-side where clauses (spec.md Decision 5)") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        REQUIRE(body["where"].size() == 2);
        CHECK(body["where"][0]["field"] == "time");
        CHECK(body["where"][0]["operator"] == ">=");
        CHECK(body["where"][0]["value"] == 1789151000);
        CHECK(body["where"][1]["field"] == "time");
        CHECK(body["where"][1]["operator"] == "<=");
        CHECK(body["where"][1]["value"] == 1789160000);
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    AccessLogQuery query;
    query.to = 1789160000;
    query.from = 1789151000;
    // No client-side re-filtering happens any more -- the SDK returns
    // exactly what the (fake) server sends back, unfiltered.
    std::vector<AccessLogEntry> logs = client.accessLogs().list(query);
    CHECK(logs.size() == 3);
}

TEST_CASE("AccessLogEntry maps identifierId from the confirmed identifier_id field") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("access_logs_list.json")); };

    std::vector<AccessLogEntry> logs = client.accessLogs().list();
    REQUIRE(logs.size() == 3);
    CHECK(logs[0].identifierId == 1717658368);
}

TEST_CASE("AccessLogQuery with neither from nor to sends an empty where array") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["where"].is_array());
        CHECK(body["where"].empty());
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    client.accessLogs().list();
}

TEST_CASE("L-1: authorizationLabel covers every literal case from report.js's case 'accessevent'") {
    CHECK(detail::authorizationLabel(7) == "Granted");
    CHECK(detail::authorizationLabel(10) == "Granted");
    CHECK(detail::authorizationLabel(11) == "Granted");
    CHECK(detail::authorizationLabel(12) == "Granted");
    CHECK(detail::authorizationLabel(15) == "Granted");
    CHECK(detail::authorizationLabel(6) == "Not authorized");
    CHECK(detail::authorizationLabel(3) == "Not recognized");
    CHECK(detail::authorizationLabel(999) == "Not recognized");  // default case
}

TEST_CASE("L-2: identificationLabel covers every tag family, including the numerically-verified real value") {
    CHECK(detail::identificationLabel(1717658368) == "Facial");  // LIVE-CAPTURED real value this session
    CHECK(detail::identificationLabel(detail::packIdentifierTag("fac", 0)) == "Facial");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("win", 0)) == "Card");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("mag", 0)) == "Card");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("rfi", 0)) == "Card");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("mif", 0)) == "Card");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("gui", 1)) == "PIN");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("gui", 0)) == "Password");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("qrc", 0)) == "QR Code");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("bio", 0)) == "Biometry");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("rex", 0)) == "REX button");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("web", 0)) == "Web Interface");
    CHECK(detail::identificationLabel(detail::packIdentifierTag("int", 0)) == "Intercom");
}

TEST_CASE("L-3: identificationLabel's pinned 'Unknown' default for an unreachable, unmatched tag") {
    CHECK(detail::identificationLabel(0) == "Unknown");
}

TEST_CASE("L-4: timeZoneNamesForAccessLogIds resolves the 2-hop join; an unresolvable id is absent, not empty-string") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        std::string object = body["object"].get<std::string>();
        if (object == "access_log_access_rules") {
            // access_log 999 has no row here (simulates no matching access rule).
            return FakeTransport::ok(nlohmann::json{
                {"access_log_access_rules", nlohmann::json::array({
                    nlohmann::json{{"access_log_id", 220}, {"access_rule_id", 1}}
                })}
            }.dump());
        }
        if (object == "access_rule_time_zones") {
            return FakeTransport::ok(nlohmann::json{
                {"access_rule_time_zones", nlohmann::json::array({
                    nlohmann::json{{"access_rule_id", 1}, {"time_zone_id", 1}}
                })}
            }.dump());
        }
        if (object == "time_zones") {
            return FakeTransport::ok(nlohmann::json{
                {"time_zones", nlohmann::json::array({
                    nlohmann::json{{"id", 1}, {"name", "Always Allowed"}}
                })}
            }.dump());
        }
        FAIL("unexpected object queried: " << object);
        return FakeTransport::status(500);
    };

    std::map<int64_t, std::string> result = client.accessLogs().timeZoneNamesForAccessLogIds({220, 999});
    REQUIRE(result.size() == 1);
    CHECK(result.at(220) == "Always Allowed");
    CHECK(result.find(999) == result.end());
}

TEST_CASE("L-5: timeZoneNamesForAccessLogIds's tie-break rule -- first row wins, deterministically") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        std::string object = body["object"].get<std::string>();
        if (object == "access_log_access_rules") {
            // access_log 220 has TWO rows -- rule 1 listed first.
            return FakeTransport::ok(nlohmann::json{
                {"access_log_access_rules", nlohmann::json::array({
                    nlohmann::json{{"access_log_id", 220}, {"access_rule_id", 1}},
                    nlohmann::json{{"access_log_id", 220}, {"access_rule_id", 2}}
                })}
            }.dump());
        }
        if (object == "access_rule_time_zones") {
            return FakeTransport::ok(nlohmann::json{
                {"access_rule_time_zones", nlohmann::json::array({
                    nlohmann::json{{"access_rule_id", 1}, {"time_zone_id", 1}}
                })}
            }.dump());
        }
        if (object == "time_zones") {
            return FakeTransport::ok(nlohmann::json{
                {"time_zones", nlohmann::json::array({
                    nlohmann::json{{"id", 1}, {"name", "Always Allowed"}}
                })}
            }.dump());
        }
        FAIL("unexpected object queried: " << object);
        return FakeTransport::status(500);
    };

    std::map<int64_t, std::string> result = client.accessLogs().timeZoneNamesForAccessLogIds({220});
    REQUIRE(result.size() == 1);
    CHECK(result.at(220) == "Always Allowed");
}
