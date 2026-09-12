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
