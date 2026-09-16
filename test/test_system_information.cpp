#include <doctest/doctest.h>

#include <string>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
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

TEST_CASE("scenario 7: system-information parsing (full confirmed schema)") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.path == "/system_information.fcgi");
        CHECK(req.body.empty());  // confirmed Content-Length: 0, not "null"/"{}"
        return FakeTransport::ok(readFixture("system_information.json"));
    };

    SystemInformation info = client.getSystemInformation();
    CHECK(info.serial == "TEST0000/000000");
    CHECK(info.firmwareVersion == "2.4.5");
    CHECK(info.secboxVersion == "2.2.3");
    CHECK(info.deviceName == "Amico");
    CHECK(info.online == false);
    CHECK(info.network.mac == "AA:BB:CC:DD:EE:FF");
    CHECK(info.network.ip == "192.0.2.10");
    CHECK(info.network.dhcpEnabled == true);
    CHECK(info.network.sslEnabled == false);
}

TEST_CASE("system-information parses self-signed certificate true and false") {
    for (const bool selfSigned : {true, false}) {
        FakeTransport* fake = nullptr;
        AmicoClient client = loggedInClient(&fake);
        auto fixture = nlohmann::json::parse(readFixture("system_information.json"));
        fixture["network"]["self_signed_certificate"] = selfSigned;
        fake->responder = [fixture](const HttpRequest&) { return FakeTransport::ok(fixture.dump()); };

        CHECK(client.getSystemInformation().network.selfSignedCertificate == selfSigned);
    }
}

namespace {
// Shared synthetic (never real-device) fixture wiring for
// getDateTimeSettings() tests: dispatches all 4 underlying calls
// (system_information.fcgi, get_configuration.fcgi x2,
// get_ntp_server.fcgi) from a single responder, matching the
// convention already used in test_reports.cpp for multi-call flows.
HttpResponse respondForDateTimeSettings(const HttpRequest& req, const std::string& ntpEnabled,
                                         const std::string& clock12h, const std::string& monthDayYear) {
    if (req.path == "/system_information.fcgi") {
        return FakeTransport::ok(readFixture("system_information.json"));
    }
    if (req.path == "/get_configuration.fcgi") {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.contains("ntp")) {
            return FakeTransport::ok(nlohmann::json{
                {"ntp", {{"enabled", ntpEnabled}, {"timezone", "Asia/Ho_Chi_Minh"}}}}.dump());
        }
        if (body.contains("general")) {
            return FakeTransport::ok(nlohmann::json{
                {"general", {{"clock_12h_format", clock12h}, {"month_day_year_format", monthDayYear}}}}.dump());
        }
    }
    if (req.path == "/get_ntp_server.fcgi") {
        return FakeTransport::ok(nlohmann::json{{"server1", "pool.ntp.org"}, {"server2", "time.google.com"}}.dump());
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}
}  // namespace

TEST_CASE("getDateTimeSettings: full flow, all fields mapped correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) { return respondForDateTimeSettings(req, "1", "0", "1"); };

    DateTimeSettings settings = client.getDateTimeSettings();
    CHECK(settings.daylightSavingActive == false);  // from system_information.json fixture
    CHECK(settings.ntpEnabled == true);
    CHECK(settings.timezone == "Asia/Ho_Chi_Minh");
    CHECK(settings.clock12HourFormat == false);
    CHECK(settings.monthDayYearFormat == true);
    CHECK(settings.ntpServer1 == "pool.ntp.org");
    CHECK(settings.ntpServer2 == "time.google.com");
}

TEST_CASE("getDateTimeSettings: string-boolean fields accept both \"0\" and \"1\"") {
    for (const std::string value : {std::string("0"), std::string("1")}) {
        FakeTransport* fake = nullptr;
        AmicoClient client = loggedInClient(&fake);
        fake->responder = [&value](const HttpRequest& req) { return respondForDateTimeSettings(req, value, value, value); };

        DateTimeSettings settings = client.getDateTimeSettings();
        CHECK(settings.ntpEnabled == (value == "1"));
        CHECK(settings.clock12HourFormat == (value == "1"));
        CHECK(settings.monthDayYearFormat == (value == "1"));
    }
}

TEST_CASE("getDateTimeSettings: string-boolean field with an invalid value raises ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForDateTimeSettings(req, "yes", "0", "1"); };

    bool threw = false;
    try {
        client.getDateTimeSettings();
    } catch (const ProtocolError& e) {
        threw = true;
        CHECK(std::string(e.what()).find("\"0\" or \"1\"") != std::string::npos);
    }
    CHECK(threw);
}

TEST_CASE("scenario 12: missing required field raises ProtocolError with a useful message") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("missing_required_field.json")); };

    // missing_required_field.json is a users-list-shaped fixture; reuse
    // it against users().list() where the missing field is directly
    // relevant (user_type_id/begin_time/etc. absent).
    bool threw = false;
    try {
        client.users().list();
    } catch (const ProtocolError& e) {
        threw = true;
        CHECK(std::string(e.what()).find("missing required field") != std::string::npos);
    }
    CHECK(threw);
}
