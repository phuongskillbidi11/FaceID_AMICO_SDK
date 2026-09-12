#include <doctest/doctest.h>

#include "FakeTransport.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::test;

namespace {
AmicoConfig testConfig(std::string username = "TestUser") {
    AmicoConfig config;
    config.baseUrl = "http://192.0.2.1";
    config.username = std::move(username);
    config.password = "placeholder-not-a-real-credential";
    return config;
}
}  // namespace

TEST_CASE("scenario 1: successful login parsing extracts the session field") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    fakePtr->responder = [](const HttpRequest& req) {
        CHECK(req.method == "POST");
        CHECK(req.path == "/hidlogin.fcgi");
        return FakeTransport::ok(readFixture("login_success.json"));
    };

    CHECK_NOTHROW(client.login());
    CHECK(fakePtr->requestLog.size() == 1);
}

TEST_CASE("scenario 2: invalid login (401) maps to AuthenticationError") {
    AmicoClient client(testConfig());
    auto fake = std::make_unique<FakeTransport>();
    FakeTransport* fakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    fakePtr->responder = [](const HttpRequest&) {
        return FakeTransport::status(401, readFixture("login_failure.json"));
    };

    CHECK_THROWS_AS(client.login(), AuthenticationError);
}

TEST_CASE("scenario 3: username case is sent verbatim (documented case-sensitive behavior), placeholder credentials only") {
    // This does not assert anything about the real device -- it proves
    // the SDK does not normalize/lowercase the username itself, which is
    // what "case-sensitive username matching is the device's documented
    // behavior" requires of the client side.
    std::string capturedForm;

    AmicoClient clientLower(testConfig("placeholderuser"));
    auto fakeLower = std::make_unique<FakeTransport>();
    FakeTransport* fakeLowerPtr = fakeLower.get();
    setTransportForTesting(clientLower, std::move(fakeLower));
    fakeLowerPtr->responder = [&](const HttpRequest& req) {
        capturedForm = req.body;
        return FakeTransport::ok(readFixture("login_success.json"));
    };
    clientLower.login();
    CHECK(capturedForm.find("login=placeholderuser") != std::string::npos);

    AmicoClient clientMixed(testConfig("PlaceholderUser"));
    auto fakeMixed = std::make_unique<FakeTransport>();
    FakeTransport* fakeMixedPtr = fakeMixed.get();
    setTransportForTesting(clientMixed, std::move(fakeMixed));
    fakeMixedPtr->responder = [&](const HttpRequest& req) {
        capturedForm = req.body;
        return FakeTransport::ok(readFixture("login_success.json"));
    };
    clientMixed.login();
    CHECK(capturedForm.find("login=PlaceholderUser") != std::string::npos);
}
