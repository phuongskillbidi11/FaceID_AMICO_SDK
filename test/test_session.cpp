#include <doctest/doctest.h>

#include "FakeTransport.hpp"
#include "Session.hpp"
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
}  // namespace

TEST_CASE("scenario 4: cookie header is 'login=<u>; session=<t>'") {
    Session session;
    session.set("TestUser", "opaque-token-abc123");
    CHECK(session.cookieHeader() == "login=TestUser; session=opaque-token-abc123");
}

TEST_CASE("scenario 4b: an authenticated call sends the cookie header built from Session") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    fakePtr->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
    client.login();

    std::string capturedCookie;
    fakePtr->responder = [&](const HttpRequest& req) {
        for (const auto& h : req.headers) {
            if (h.name == "Cookie") capturedCookie = h.value;
        }
        return FakeTransport::ok(readFixture("session_valid_true.json"));
    };
    client.isSessionValid();
    CHECK(capturedCookie.find("login=TestUser") != std::string::npos);
    CHECK(capturedCookie.find("session=") != std::string::npos);
}

TEST_CASE("scenario 5a: session validation true") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));
    fakePtr->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("session_valid_true.json")); };
    CHECK(client.isSessionValid() == true);
}

TEST_CASE("scenario 5b: session validation false") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));
    fakePtr->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("session_valid_false.json")); };
    CHECK(client.isSessionValid() == false);
}

TEST_CASE("scenario 6: logout clears local session state, subsequent authenticated call fails fast") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    fakePtr->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
    client.login();

    fakePtr->responder = [](const HttpRequest& req) {
        CHECK(req.path == "/logout.fcgi");
        return FakeTransport::ok("{}");
    };
    CHECK_NOTHROW(client.logout());

    // No responder set for the next call, but it must fail on the
    // client side (InvalidSessionError) before ever reaching the
    // transport -- proven by requestLog not growing.
    const auto countBefore = fakePtr->requestLog.size();
    CHECK_THROWS_AS(client.getSystemInformation(), InvalidSessionError);
    CHECK(fakePtr->requestLog.size() == countBefore);
}
