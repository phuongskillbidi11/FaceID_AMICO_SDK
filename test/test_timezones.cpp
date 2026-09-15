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

NewTimeSpan sampleSpan(int64_t timeZoneId) {
    NewTimeSpan span;
    span.timeZoneId = timeZoneId;
    span.start = 8 * 3600;
    span.end = 18 * 3600;
    span.sun = false; span.sat = false;
    span.mon = span.tue = span.wed = span.thu = span.fri = true;
    span.hol1 = span.hol2 = span.hol3 = false;
    return span;
}
}  // namespace

// ------------------------- Z-1: time_zones query builder shapes -------------------------

TEST_CASE("Z-1: buildTimeZoneCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildTimeZoneCreateBody("ZZ_TimeZoneTest");
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "time_zones"},
        {"fields", nlohmann::json::array({"id", "name"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"name"})},
        {"values", nlohmann::json::array({{{"name", "ZZ_TimeZoneTest"}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("Z-2: buildTimeZoneUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildTimeZoneUpdateBody(7, "Renamed");
    CHECK(body["object"] == "time_zones");
    CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}});
    CHECK(body["where"] == nlohmann::json{{"time_zones", {{"id", 7}}}});
}

TEST_CASE("Z-3: buildTimeZoneDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildTimeZoneDeleteBody(7);
    CHECK(body["object"] == "time_zones");
    CHECK(body["where"] == nlohmann::json{{"time_zones", {{"id", nlohmann::json::array({7})}}}});
}

// ------------------------- Z-4: time_spans query builder shapes -------------------------

TEST_CASE("Z-4: buildTimeSpansListBody filters by time_zone_id") {
    nlohmann::json body = detail::buildTimeSpansListBody(1);
    CHECK(body["object"] == "time_spans");
    CHECK(body["fields"] == detail::kTimeSpanFields);
    CHECK(body["where"] == nlohmann::json{{"time_spans", {{"time_zone_id", 1}}}});
}

TEST_CASE("Z-5: buildTimeSpanCreateBody matches the confirmed extended create shape") {
    nlohmann::json body = detail::buildTimeSpanCreateBody(sampleSpan(1));
    CHECK(body["join"] == "LEFT");
    CHECK(body["object"] == "time_spans");
    CHECK(body["fields"] == detail::kTimeSpanFields);
    CHECK(body["where"] == nlohmann::json::array());
    CHECK(body["order"] == nlohmann::json::array({"start"}));
    // LIVE_CONFIRMED 2026-09-15: the device rejects a real JSON boolean
    // here (`{"error":"Invalid member 'sun' (int expected, got
    // boolean)","code":1}`) -- expects plain 0/1 integers, not true/false.
    nlohmann::json expectedValues = {
        {"time_zone_id", 1}, {"start", 8 * 3600}, {"end", 18 * 3600},
        {"sun", 0}, {"mon", 1}, {"tue", 1}, {"wed", 1}, {"thu", 1}, {"fri", 1}, {"sat", 0},
        {"hol1", 0}, {"hol2", 0}, {"hol3", 0},
    };
    CHECK(body["values"] == nlohmann::json::array({expectedValues}));
}

TEST_CASE("Z-6: buildTimeSpanUpdateBody never includes time_zone_id") {
    TimeSpanUpdate update;
    update.id = 5; update.start = 0; update.end = 86399;
    update.sun = update.mon = update.tue = update.wed = update.thu = update.fri = update.sat = true;
    update.hol1 = update.hol2 = update.hol3 = true;
    nlohmann::json body = detail::buildTimeSpanUpdateBody(update);
    CHECK(body["object"] == "time_spans");
    CHECK_FALSE(body["values"].contains("time_zone_id"));
    CHECK(body["values"]["start"] == 0);
    CHECK(body["values"]["end"] == 86399);
    CHECK(body["values"]["sun"] == 1);  // encoded as int, not JSON true -- see Z-5
    CHECK(body["where"] == nlohmann::json{{"time_spans", {{"id", 5}}}});
}

TEST_CASE("Z-7: buildTimeSpanDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildTimeSpanDeleteBody(5);
    CHECK(body["object"] == "time_spans");
    CHECK(body["where"] == nlohmann::json{{"time_spans", {{"id", nlohmann::json::array({5})}}}});
}

// ------------------------- Z-8: TimeZonesApi zone create/update/remove -------------------------

TEST_CASE("Z-8: TimeZonesApi::create() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[42]})"); };

    NewTimeZone zone; zone.name = "ZZ_TimeZoneTest";
    CHECK(client.timeZones().create(zone) == 42);
}

TEST_CASE("Z-9: TimeZonesApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    TimeZoneUpdate update; update.id = 7; update.name = "Renamed";
    CHECK_THROWS_AS(client.timeZones().update(update), ProtocolError);
}

TEST_CASE("Z-10: TimeZonesApi::remove() does not special-case any zone id (including id 1)") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["where"] == nlohmann::json{{"time_zones", {{"id", nlohmann::json::array({1})}}}});
        return FakeTransport::ok(R"({"changes": 1})");
    };
    CHECK_NOTHROW(client.timeZones().remove(1));
}

// ------------------------- Z-11: TimeZonesApi span list/create/update/remove -------------------------

TEST_CASE("Z-11: TimeZonesApi::listSpans() maps 0/1-integer booleans correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"time_spans", nlohmann::json::array({{
            {"id", 1}, {"time_zone_id", 1}, {"start", 0}, {"end", 86399},
            {"sun", 1}, {"mon", 1}, {"tue", 1}, {"wed", 1}, {"thu", 1}, {"fri", 1}, {"sat", 1},
            {"hol1", 1}, {"hol2", 0}, {"hol3", 1},
        }})}}.dump());
    };
    std::vector<TimeSpan> spans = client.timeZones().listSpans(1);
    REQUIRE(spans.size() == 1);
    CHECK(spans[0].id == 1);
    CHECK(spans[0].timeZoneId == 1);
    CHECK(spans[0].sun == true);
    CHECK(spans[0].hol2 == false);
    CHECK(spans[0].hol3 == true);
}

TEST_CASE("Z-12: TimeZonesApi::createSpan() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[9]})"); };
    CHECK(client.timeZones().createSpan(sampleSpan(1)) == 9);
}

TEST_CASE("Z-13: TimeZonesApi::updateSpan()/removeSpan() throw ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    TimeSpanUpdate update;
    update.id = 9; update.start = 0; update.end = 86399;
    update.sun = update.mon = update.tue = update.wed = update.thu = update.fri = update.sat = true;
    update.hol1 = update.hol2 = update.hol3 = true;
    CHECK_THROWS_AS(client.timeZones().updateSpan(update), ProtocolError);
    CHECK_THROWS_AS(client.timeZones().removeSpan(9), ProtocolError);
}
