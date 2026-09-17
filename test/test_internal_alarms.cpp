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
// getInternalAlarmSettings() tests.
HttpResponse respondForInternalAlarmSettings(const HttpRequest& req, const std::string& doorSensorEnabled,
                                              const std::string& forcedAccessEnabled,
                                              const std::string& deviceViolationEnabled,
                                              const std::string& panicFingerEnabled,
                                              const std::string& panicCardEnabled) {
    if (req.path == "/get_configuration.fcgi") {
        nlohmann::json body = nlohmann::json::parse(req.body);
        nlohmann::json expected = {{"alarm", nlohmann::json::array({
                                                         "door_sensor_enabled",
                                                         "door_sensor_delay",
                                                         "door_sensor_alarm_timeout_after_closure",
                                                         "forced_access_enabled",
                                                         "forced_access_debounce",
                                                         "device_violation_enabled",
                                                         "panic_finger_enabled",
                                                         "panic_card_enabled",
                                                         "panic_finger_delay",
                                                     })}};
        CHECK(body == expected);
        return FakeTransport::ok(nlohmann::json{
            {"alarm",
             {{"door_sensor_enabled", doorSensorEnabled},
              {"door_sensor_delay", "10"},
              {"door_sensor_alarm_timeout_after_closure", "20"},
              {"forced_access_enabled", forcedAccessEnabled},
              {"forced_access_debounce", "30"},
              {"device_violation_enabled", deviceViolationEnabled},
              {"panic_finger_enabled", panicFingerEnabled},
              {"panic_card_enabled", panicCardEnabled},
              {"panic_finger_delay", "120"}}}}
            .dump());
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}
}  // namespace

TEST_CASE("getInternalAlarmSettings: full flow, all fields mapped correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        return respondForInternalAlarmSettings(req, "1", "0", "1", "0", "1");
    };

    InternalAlarmSettings settings = client.getInternalAlarmSettings();
    CHECK(settings.doorSensorEnabled == true);
    CHECK(settings.doorSensorDelay == 10);
    CHECK(settings.doorSensorAlarmTimeoutAfterClosure == 20);
    CHECK(settings.forcedAccessEnabled == false);
    CHECK(settings.forcedAccessDebounce == 30);
    CHECK(settings.deviceViolationEnabled == true);
    CHECK(settings.panicFingerEnabled == false);
    CHECK(settings.panicCardEnabled == true);
    CHECK(settings.panicFingerDelay == 120);
}

TEST_CASE("getInternalAlarmSettings: string-boolean fields accept both \"0\" and \"1\"") {
    for (const std::string value : {std::string("0"), std::string("1")}) {
        FakeTransport* fake = nullptr;
        AmicoClient client = loggedInClient(&fake);
        fake->responder = [&value](const HttpRequest& req) {
            return respondForInternalAlarmSettings(req, value, value, value, value, value);
        };

        InternalAlarmSettings settings = client.getInternalAlarmSettings();
        CHECK(settings.doorSensorEnabled == (value == "1"));
        CHECK(settings.forcedAccessEnabled == (value == "1"));
        CHECK(settings.deviceViolationEnabled == (value == "1"));
        CHECK(settings.panicFingerEnabled == (value == "1"));
        CHECK(settings.panicCardEnabled == (value == "1"));
    }
}

namespace {
// Shared synthetic wiring for setInternalAlarmSettings() tests.
HttpResponse respondForSetInternalAlarmSettings(const HttpRequest& req, nlohmann::json* capturedBody) {
    if (req.path == "/set_configuration.fcgi") {
        if (capturedBody) *capturedBody = nlohmann::json::parse(req.body);
        return FakeTransport::ok("{}");
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}

InternalAlarmSettings sampleInternalAlarmSettings() {
    InternalAlarmSettings settings;
    settings.doorSensorEnabled = true;
    settings.doorSensorDelay = 10;
    settings.doorSensorAlarmTimeoutAfterClosure = 20;
    settings.forcedAccessEnabled = false;
    settings.forcedAccessDebounce = 30;
    settings.deviceViolationEnabled = true;
    settings.panicFingerEnabled = false;
    settings.panicCardEnabled = true;
    settings.panicFingerDelay = 120;
    return settings;
}
}  // namespace

TEST_CASE("setInternalAlarmSettings: outgoing body contains all fields as exact JSON strings") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    nlohmann::json captured;
    fake->responder = [&captured](const HttpRequest& req) {
        return respondForSetInternalAlarmSettings(req, &captured);
    };

    client.setInternalAlarmSettings(sampleInternalAlarmSettings());

    REQUIRE(captured.size() == 1);
    REQUIRE(captured.contains("alarm"));
    nlohmann::json expectedAlarm = {
        {"door_sensor_enabled", "1"},
        {"door_sensor_delay", "10"},
        {"door_sensor_alarm_timeout_after_closure", "20"},
        {"forced_access_enabled", "0"},
        {"forced_access_debounce", "30"},
        {"device_violation_enabled", "1"},
        {"panic_finger_enabled", "0"},
        {"panic_card_enabled", "1"},
        {"panic_finger_delay", "120"},
    };
    REQUIRE(captured["alarm"].size() == 9);
    for (const auto& expected : expectedAlarm.items()) {
        REQUIRE(captured["alarm"].contains(expected.key()));
        CHECK(captured["alarm"][expected.key()].is_string());
        CHECK(captured["alarm"][expected.key()] == expected.value());
    }
}

TEST_CASE("setInternalAlarmSettings: plain 200 empty object response succeeds") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForSetInternalAlarmSettings(req, nullptr); };

    CHECK_NOTHROW(client.setInternalAlarmSettings(sampleInternalAlarmSettings()));
}
