#include <doctest/doctest.h>

#include <memory>
#include <string>

#include "FakeTransport.hpp"
#include "NetworkSafety.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::detail;
using namespace amico::test;

namespace {
AmicoClient fakeClient(FakeTransport** outFake, bool https = false) {
    AmicoConfig config;
    config.baseUrl = https ? "https://192.0.2.1" : "http://192.0.2.1";
    config.username = "TestUser";
    config.password = "placeholder-not-a-real-credential";
    AmicoClient client(config);
    auto fake = std::make_unique<FakeTransport>();
    *outFake = fake.get();
    setTransportForTesting(client, std::move(fake));
    return client;
}
}  // namespace

TEST_CASE("checkReachable sends one credential-free GET even with an active session") {
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake);
    SUBCASE("before login") {}
    SUBCASE("after login") {
        fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
        client.login();
        fake->requestLog.clear();
    }
    for (const int status : {200, 401, 500}) {
        fake->requestLog.clear();
        fake->responder = [status](const HttpRequest&) { return FakeTransport::status(status); };
        const AmicoClient& constClient = client;
        CHECK_NOTHROW(constClient.checkReachable());
        REQUIRE(fake->requestLog.size() == 1);
        const auto& request = fake->requestLog.front();
        CHECK(request.method == "GET");
        CHECK(request.path == "/");
        CHECK(request.headers.empty());
        CHECK(request.body.empty());
    }
}

TEST_CASE("reachableThenLogin prevents login after a failed preflight") {
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake);
    fake->responder = [](const HttpRequest&) -> HttpResponse { throw NetworkError("preflight failed"); };
    const auto result = reachableThenLogin(client);
    CHECK_FALSE(result.reachable);
    CHECK_FALSE(result.loggedIn);
    CHECK(result.reachabilityError == "preflight failed");
    REQUIRE(fake->requestLog.size() == 1);
    CHECK(fake->requestLog.front().path == "/");
}

TEST_CASE("reachableThenLogin logs in only after a successful preflight") {
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake);
    fake->responder = [](const HttpRequest& request) {
        if (request.path == "/") return FakeTransport::status(401);
        return FakeTransport::ok(readFixture("login_success.json"));
    };
    const auto result = reachableThenLogin(client);
    CHECK(result.reachable);
    CHECK(result.loggedIn);
    CHECK(result.reachabilityError.empty());
    REQUIRE(fake->requestLog.size() == 2);
    CHECK(fake->requestLog[0].path == "/");
    CHECK(fake->requestLog[1].path == "/hidlogin.fcgi");
}

TEST_CASE("reachableThenLogin propagates login failures unchanged") {
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake);
    fake->responder = [](const HttpRequest& request) -> HttpResponse {
        if (request.path == "/") return FakeTransport::ok("");
        throw AuthenticationError("login refused");
    };
    CHECK_THROWS_AS(reachableThenLogin(client), AuthenticationError);
    CHECK(fake->requestLog.size() == 2);
}

TEST_CASE("disabled HTTPS probe never touches the client") {
    CHECK(probeHttpsIfEnabled(false, nullptr).outcome == TlsProbeOutcome::NotApplicable);
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake, true);
    const auto result = probeHttpsIfEnabled(false, &client);
    CHECK(result.outcome == TlsProbeOutcome::NotApplicable);
    CHECK(result.detail.empty());
    CHECK(fake->requestLog.empty());
}

TEST_CASE("HTTPS probe distinguishes verified, rejected certificate, network and timeout outcomes") {
    FakeTransport* fake = nullptr;
    auto client = fakeClient(&fake, true);
    TlsProbeOutcome expected = TlsProbeOutcome::Verified;
    std::string detail;
    SUBCASE("verified") {
        fake->responder = [](const HttpRequest&) { return FakeTransport::ok(""); };
    }
    SUBCASE("peer verification failure") {
        expected = TlsProbeOutcome::VerifyFailed;
        detail = "untrusted peer";
        fake->responder = [](const HttpRequest&) -> HttpResponse { throw TlsVerificationError("untrusted peer"); };
    }
    SUBCASE("network failure") {
        expected = TlsProbeOutcome::NetworkFailure;
        detail = "connection failed";
        fake->responder = [](const HttpRequest&) -> HttpResponse { throw NetworkError("connection failed"); };
    }
    SUBCASE("timeout") {
        expected = TlsProbeOutcome::NetworkFailure;
        detail = "timed out";
        fake->responder = [](const HttpRequest&) -> HttpResponse { throw TimeoutError("timed out"); };
    }
    const auto result = probeHttpsIfEnabled(true, &client);
    CHECK(result.outcome == expected);
    CHECK(result.detail == detail);
    CHECK(TlsProbeOutcome::VerifyFailed != TlsProbeOutcome::NetworkFailure);
    REQUIRE(fake->requestLog.size() == 1);
    CHECK(fake->requestLog.front().headers.empty());
    CHECK(fake->requestLog.front().body.empty());
}
