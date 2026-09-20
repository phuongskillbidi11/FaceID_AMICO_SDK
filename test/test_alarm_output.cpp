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

// Shared synthetic (never real-device) fixture wiring for
// getAlarmOutputSettings() tests.
HttpResponse respondForAlarmOutputSettings(const HttpRequest& req, const std::string& buzzerEnabled,
                                            const std::string& alarmCentralEnabled,
                                            const std::string& playingTimeout) {
    if (req.path == "/get_configuration.fcgi") {
        nlohmann::json body = nlohmann::json::parse(req.body);
        nlohmann::json expected = {
            {"alarm", nlohmann::json::array({"buzzer_enabled", "alarm_central_enabled", "playing_timeout"})}};
        CHECK(body == expected);
        return FakeTransport::ok(nlohmann::json{{"alarm",
                                                   {{"buzzer_enabled", buzzerEnabled},
                                                    {"alarm_central_enabled", alarmCentralEnabled},
                                                    {"playing_timeout", playingTimeout}}}}
                                      .dump());
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}
}  // namespace

TEST_CASE("getAlarmOutputSettings: full flow, all fields mapped correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForAlarmOutputSettings(req, "1", "0", "45"); };

    AlarmOutputSettings settings = client.getAlarmOutputSettings();
    CHECK(settings.buzzerEnabled == true);
    CHECK(settings.maxActivationTimeEnabled == false);
    CHECK(settings.maxActivationTimeSeconds == 45);
}

TEST_CASE("getAlarmOutputSettings: string-boolean fields accept both \"0\" and \"1\"") {
    for (const std::string value : {std::string("0"), std::string("1")}) {
        FakeTransport* fake = nullptr;
        AmicoClient client = loggedInClient(&fake);
        fake->responder = [&value](const HttpRequest& req) {
            return respondForAlarmOutputSettings(req, value, value, "45");
        };

        AlarmOutputSettings settings = client.getAlarmOutputSettings();
        CHECK(settings.buzzerEnabled == (value == "1"));
        CHECK(settings.maxActivationTimeEnabled == (value == "1"));
    }
}

namespace {
// Shared synthetic wiring for setAlarmOutputSettings() tests.
HttpResponse respondForSetAlarmOutputSettings(const HttpRequest& req, nlohmann::json* capturedBody) {
    if (req.path == "/set_configuration.fcgi") {
        if (capturedBody) *capturedBody = nlohmann::json::parse(req.body);
        return FakeTransport::ok("{}");
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}

AlarmOutputSettings sampleAlarmOutputSettings() {
    AlarmOutputSettings settings;
    settings.buzzerEnabled = true;
    settings.maxActivationTimeEnabled = true;
    settings.maxActivationTimeSeconds = 45;
    return settings;
}
}  // namespace

TEST_CASE("setAlarmOutputSettings: outgoing body contains all fields as exact JSON strings") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    nlohmann::json captured;
    fake->responder = [&captured](const HttpRequest& req) {
        return respondForSetAlarmOutputSettings(req, &captured);
    };

    client.setAlarmOutputSettings(sampleAlarmOutputSettings());

    REQUIRE(captured.size() == 1);
    REQUIRE(captured.contains("alarm"));
    nlohmann::json expectedAlarm = {
        {"buzzer_enabled", "1"},
        {"alarm_central_enabled", "1"},
        {"playing_timeout", "45"},
    };
    REQUIRE(captured["alarm"].size() == 3);
    for (const auto& expected : expectedAlarm.items()) {
        REQUIRE(captured["alarm"].contains(expected.key()));
        CHECK(captured["alarm"][expected.key()].is_string());
        CHECK(captured["alarm"][expected.key()] == expected.value());
    }
}

TEST_CASE("setAlarmOutputSettings: playing_timeout is sent as literal \"0\" when maxActivationTimeEnabled is false, "
          "even with a nonzero maxActivationTimeSeconds") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    nlohmann::json captured;
    fake->responder = [&captured](const HttpRequest& req) {
        return respondForSetAlarmOutputSettings(req, &captured);
    };

    AlarmOutputSettings settings = sampleAlarmOutputSettings();
    settings.maxActivationTimeEnabled = false;
    settings.maxActivationTimeSeconds = 999;
    client.setAlarmOutputSettings(settings);

    REQUIRE(captured["alarm"].contains("playing_timeout"));
    CHECK(captured["alarm"]["playing_timeout"] == "0");
    CHECK(captured["alarm"]["alarm_central_enabled"] == "0");
}

TEST_CASE("setAlarmOutputSettings: plain 200 empty object response succeeds") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForSetAlarmOutputSettings(req, nullptr); };

    CHECK_NOTHROW(client.setAlarmOutputSettings(sampleAlarmOutputSettings()));
}
