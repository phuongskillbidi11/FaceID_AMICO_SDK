#include <doctest/doctest.h>

#include <memory>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::test;

namespace {
AmicoConfig testConfig() {
    AmicoConfig config;
    config.baseUrl = "http://192.0.2.1";
    config.username = "TestUser";
    config.password = "placeholder-not-a-real-credential";
    return config;
}

AmicoClient loggedInClient(FakeTransport** outFakePtr, AmicoConfig config = testConfig()) {
    AmicoClient client(config);
    auto fake = std::make_unique<FakeTransport>();
    *outFakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));
    (*outFakePtr)->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
    client.login();
    return client;
}
}  // namespace

TEST_CASE("scenario 13: malformed JSON body raises JsonParseError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("malformed.json")); };
    CHECK_THROWS_AS(client.users().list(), JsonParseError);
}

TEST_CASE("scenario 14: a timeout thrown by the transport propagates as TimeoutError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw TimeoutError("simulated timeout"); };
    CHECK_THROWS_AS(client.users().list(), TimeoutError);
}

TEST_CASE("scenario 15: HTTP 401 on an authenticated call (not login) maps to InvalidSessionError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::status(401, R"({"error":"session expired"})"); };
    CHECK_THROWS_AS(client.users().list(), InvalidSessionError);
}

TEST_CASE("scenario 20: a response exceeding the size limit raises ResponseTooLargeError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw ResponseTooLargeError("simulated oversized response"); };
    CHECK_THROWS_AS(client.users().list(), ResponseTooLargeError);
}

TEST_CASE("autoRelogin defaults to false: a 401 is not retried unless explicitly enabled") {
    FakeTransport* fake = nullptr;
    AmicoConfig config = testConfig();
    CHECK(config.autoRelogin == false);
    AmicoClient client = loggedInClient(&fake, config);

    int callCount = 0;
    fake->responder = [&](const HttpRequest&) {
        ++callCount;
        return FakeTransport::status(401, "{}");
    };
    CHECK_THROWS_AS(client.users().list(), InvalidSessionError);
    CHECK(callCount == 1);  // no retry, no second login attempt
}

TEST_CASE("autoRelogin=true retries exactly once after a fresh login") {
    FakeTransport* fake = nullptr;
    AmicoConfig config = testConfig();
    config.autoRelogin = true;
    AmicoClient client = loggedInClient(&fake, config);

    int loadObjectsCalls = 0;
    int loginCalls = 0;
    fake->responder = [&](const HttpRequest& req) {
        if (req.path == "/hidlogin.fcgi") {
            ++loginCalls;
            return FakeTransport::ok(readFixture("login_success.json"));
        }
        ++loadObjectsCalls;
        if (loadObjectsCalls == 1) {
            return FakeTransport::status(401, "{}");
        }
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    std::vector<AmicoUser> users;
    CHECK_NOTHROW(users = client.users().list());
    CHECK(users.size() == 3);
    CHECK(loginCalls == 1);
    CHECK(loadObjectsCalls == 2);
}

TEST_CASE("ConfigurationError: base URL with a query string is rejected before any request") {
    AmicoConfig config = testConfig();
    config.baseUrl = "http://192.0.2.1/?x=1";
    CHECK_THROWS_AS(AmicoClient{config}, ConfigurationError);
}

TEST_CASE("ConfigurationError: base URL with embedded credentials is rejected") {
    AmicoConfig config = testConfig();
    config.baseUrl = "http://user:pass@192.0.2.1";
    CHECK_THROWS_AS(AmicoClient{config}, ConfigurationError);
}

TEST_CASE("full_sequence: login -> session-valid -> sysinfo -> users.list -> users.get -> accessLogs.list -> logout") {
    AmicoConfig config = testConfig();
    AmicoClient client(config);
    auto fakeOwned = std::make_unique<FakeTransport>();
    FakeTransport* fake = fakeOwned.get();
    setTransportForTesting(client, std::move(fakeOwned));

    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        if (req.path == "/hidlogin.fcgi") return FakeTransport::ok(readFixture("login_success.json"));
        if (req.path == "/session_is_valid.fcgi") return FakeTransport::ok(readFixture("session_valid_true.json"));
        if (req.path == "/system_information.fcgi") return FakeTransport::ok(readFixture("system_information.json"));
        if (req.path == "/logout.fcgi") return FakeTransport::ok("{}");
        if (req.path == "/load_objects.fcgi") {
            nlohmann::json body = nlohmann::json::parse(req.body);
            if (body["object"] == "users" && body["where"].size() == 1) {
                return FakeTransport::ok(readFixture("user_get_found.json"));
            }
            if (body["object"] == "users") {
                return FakeTransport::ok(readFixture("users_list_default_filter.json"));
            }
            if (body["object"] == "access_logs") {
                return FakeTransport::ok(readFixture("access_logs_list.json"));
            }
        }
        return FakeTransport::status(500, "{}");
    };

    CHECK_NOTHROW(client.login());
    CHECK(client.isSessionValid() == true);
    SystemInformation info = client.getSystemInformation();
    CHECK(info.firmwareVersion == "2.4.5");
    CHECK(client.users().list().size() == 3);
    CHECK(client.users().get(36).has_value());
    CHECK(client.accessLogs().list().size() == 3);
    CHECK_NOTHROW(client.logout());
}
