#include <doctest/doctest.h>

#include <memory>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "UserProfileResponder.hpp"
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

    int usersQueryCalls = 0;
    int profileCalls = 0;
    int loginCalls = 0;
    fake->responder = [&](const HttpRequest& req) {
        if (req.path == "/hidlogin.fcgi") {
            ++loginCalls;
            return FakeTransport::ok(readFixture("login_success.json"));
        }
        if (auto response = emptyUserProfileResponse(req)) {
            ++profileCalls;
            return *response;
        }
        ++usersQueryCalls;
        if (usersQueryCalls == 1) {
            return FakeTransport::status(401, "{}");
        }
        return FakeTransport::ok(readFixture("users_list_default_filter.json"));
    };

    std::vector<AmicoUser> users;
    CHECK_NOTHROW(users = client.users().list());
    CHECK(users.size() == 3);
    CHECK(loginCalls == 1);
    CHECK(usersQueryCalls == 2);
    CHECK(profileCalls == 18);  // 6 queries for each of the 3 returned users
}

TEST_CASE("getImage returns exact binary bytes and the device Content-Type") {
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    const std::string bytes("\x89PNG\0\xff", 6);
    fake->responder = [&](const HttpRequest& req) {
        CHECK(req.method == "GET");
        CHECK(req.path == "/user_get_image.fcgi?user_id=36");
        CHECK(req.body.empty());
        bool hasCookie = false;
        for (const auto& header : req.headers) {
            if (header.name == "Cookie") hasCookie = !header.value.empty();
            CHECK(header.name != "Content-Type");
        }
        CHECK(hasCookie);
        auto response = FakeTransport::ok(bytes);
        response.headers.push_back({"Content-Type", "image/png"});
        return response;
    };
    auto image = client.users().getImage(36);
    CHECK(image.bytes == std::vector<uint8_t>(bytes.begin(), bytes.end()));
    CHECK(image.contentType == "image/png");
}

TEST_CASE("getImage defaults to image/jpeg when Content-Type is absent") {
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok("image bytes"); };
    CHECK(client.users().getImage(36).contentType == "image/jpeg");
}

TEST_CASE("getImage reports no image as HttpError 404") {
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::status(404); };
    CHECK_THROWS_WITH_AS(client.users().getImage(36), "no image for user 36", HttpError);
    try {
        client.users().getImage(36);
        FAIL("expected HttpError");
    } catch (const HttpError& error) {
        CHECK(error.statusCode() == 404);
    }
}

TEST_CASE("getImage preserves other HTTP error status codes") {
    FakeTransport* fake = nullptr;
    auto client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::status(500); };
    try {
        client.users().getImage(36);
        FAIL("expected HttpError");
    } catch (const HttpError& error) {
        CHECK(error.statusCode() == 500);
    }
}

TEST_CASE("getImage 401 with autoRelogin=false does not retry") {
    FakeTransport* fake = nullptr;
    auto config = testConfig();
    config.autoRelogin = false;
    auto client = loggedInClient(&fake, config);
    int calls = 0;
    fake->responder = [&](const HttpRequest&) {
        ++calls;
        return FakeTransport::status(401);
    };
    CHECK_THROWS_AS(client.users().getImage(36), InvalidSessionError);
    CHECK(calls == 1);
}

TEST_CASE("getImage 401 with autoRelogin=true retries exactly once after fresh login") {
    FakeTransport* fake = nullptr;
    auto config = testConfig();
    config.autoRelogin = true;
    auto client = loggedInClient(&fake, config);
    bool retryRejected = false;
    SUBCASE("retry succeeds") {}
    SUBCASE("second 401 stops retrying") { retryRejected = true; }
    int imageCalls = 0, loginCalls = 0;
    fake->responder = [&](const HttpRequest& req) {
        if (req.path == "/hidlogin.fcgi") {
            ++loginCalls;
            return FakeTransport::ok(readFixture("login_success.json"));
        }
        CHECK(req.method == "GET");
        CHECK(req.path == "/user_get_image.fcgi?user_id=36");
        ++imageCalls;
        if (imageCalls == 1 || retryRejected) return FakeTransport::status(401);
        return FakeTransport::ok("photo");
    };
    if (retryRejected) {
        CHECK_THROWS_AS(client.users().getImage(36), InvalidSessionError);
    } else {
        auto image = client.users().getImage(36);
        CHECK(std::string(image.bytes.begin(), image.bytes.end()) == "photo");
    }
    CHECK(loginCalls == 1);
    CHECK(imageCalls == 2);
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
            if (auto response = emptyUserProfileResponse(req)) return *response;
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
