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

NewHoliday sampleHoliday() {
    NewHoliday holiday;
    holiday.name = "ZZ_HolidayTest";
    holiday.start = 1789430400;
    holiday.hol1 = true; holiday.hol2 = true; holiday.hol3 = true; holiday.repeats = true;
    return holiday;
}
}  // namespace

// ------------------------- H-1..H-4: query builder shapes -------------------------

TEST_CASE("H-1: buildHolidaysListBody requests kHolidayFields") {
    nlohmann::json body = detail::buildHolidaysListBody();
    CHECK(body["object"] == "holidays");
    CHECK(body["fields"] == detail::kHolidayFields);
}

TEST_CASE("H-2: buildHolidayCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildHolidayCreateBody("ZZ_HolidayTest", 1789430400, true, true, true, true);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "holidays"},
        {"fields", nlohmann::json::array({"id", "name", "start", "hol1", "hol2", "hol3", "repeats", "end"})},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"start"})},
        {"values", nlohmann::json::array({{
            {"name", "ZZ_HolidayTest"}, {"start", 1789430400},
            {"hol1", 1}, {"hol2", 1}, {"hol3", 1}, {"repeats", 1},
            {"end", 1789516799},
        }})},
    };
    CHECK(body == expected);
}

TEST_CASE("H-3: buildHolidayCreateBody encodes hol1/hol2/hol3/repeats as 0/1 integers, not JSON booleans") {
    nlohmann::json body = detail::buildHolidayCreateBody("Mixed", 0, false, true, false, true);
    const auto& values = body["values"][0];
    CHECK(values["hol1"] == 0);
    CHECK(values["hol2"] == 1);
    CHECK(values["hol3"] == 0);
    CHECK(values["repeats"] == 1);
    CHECK_FALSE(values["hol1"].is_boolean());
}

TEST_CASE("H-4: buildHolidayCreateBody always derives end as start + 86399") {
    nlohmann::json body = detail::buildHolidayCreateBody("X", 1000, true, true, true, true);
    CHECK(body["values"][0]["end"] == 1000 + 86399);
}

TEST_CASE("H-5: buildHolidayUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildHolidayUpdateBody(7, "Renamed", 2000, true, false, true, false);
    CHECK(body["object"] == "holidays");
    CHECK(body["values"]["name"] == "Renamed");
    CHECK(body["values"]["start"] == 2000);
    CHECK(body["values"]["hol1"] == 1);
    CHECK(body["values"]["hol2"] == 0);
    CHECK(body["values"]["end"] == 2000 + 86399);
    CHECK(body["where"] == nlohmann::json{{"holidays", {{"id", 7}}}});
}

TEST_CASE("H-6: buildHolidayDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildHolidayDeleteBody(7);
    CHECK(body["object"] == "holidays");
    CHECK(body["where"] == nlohmann::json{{"holidays", {{"id", nlohmann::json::array({7})}}}});
}

// ------------------------- H-7..H-11: HolidaysApi -------------------------

TEST_CASE("H-7: HolidaysApi::list() maps 0/1-integer booleans correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"holidays", nlohmann::json::array({{
            {"id", 1}, {"name", "New Year"}, {"start", 1735689600},
            {"hol1", 1}, {"hol2", 0}, {"hol3", 1}, {"repeats", 1},
            {"end", 1735775999},
        }})}}.dump());
    };
    std::vector<Holiday> holidays = client.holidays().list();
    REQUIRE(holidays.size() == 1);
    CHECK(holidays[0].id == 1);
    CHECK(holidays[0].name == "New Year");
    CHECK(holidays[0].hol1 == true);
    CHECK(holidays[0].hol2 == false);
    CHECK(holidays[0].repeats == true);
    CHECK(holidays[0].end == 1735775999);
}

TEST_CASE("H-8: HolidaysApi::create() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[42]})"); };
    CHECK(client.holidays().create(sampleHoliday()) == 42);
}

TEST_CASE("H-9: HolidaysApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    HolidayUpdate update;
    update.id = 7; update.name = "Renamed"; update.start = 0;
    update.hol1 = update.hol2 = update.hol3 = update.repeats = true;
    CHECK_THROWS_AS(client.holidays().update(update), ProtocolError);
}

TEST_CASE("H-10: HolidaysApi::update() succeeds on a positive changes count") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "holidays");
        CHECK(body["values"]["name"] == "Renamed");
        return FakeTransport::ok(R"({"changes": 1})");
    };

    HolidayUpdate update;
    update.id = 7; update.name = "Renamed"; update.start = 0;
    update.hol1 = update.hol2 = update.hol3 = update.repeats = true;
    CHECK_NOTHROW(client.holidays().update(update));
}

TEST_CASE("H-11: HolidaysApi::remove() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };
    CHECK_THROWS_AS(client.holidays().remove(7), ProtocolError);
}
