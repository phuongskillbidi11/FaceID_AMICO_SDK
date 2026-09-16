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
// listRelayActions() tests: dispatches the 2 underlying
// get_configuration.fcgi calls from a single responder.
HttpResponse respondForRelayActions(const HttpRequest& req, const std::string& relayCount,
                                     const std::string& relayOutMode, const std::string& catraRole) {
    if (req.path == "/get_configuration.fcgi") {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.contains("general")) {
            return FakeTransport::ok(nlohmann::json{
                {"general", {{"relay_count", relayCount}, {"relay_out_mode", relayOutMode}}}}.dump());
        }
        if (body.contains("sec_box")) {
            return FakeTransport::ok(nlohmann::json{{"sec_box", {{"catra_role", catraRole}}}}.dump());
        }
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}
}  // namespace

TEST_CASE("listRelayActions: door + sec_box entries built correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForRelayActions(req, "1", "0", "0"); };

    std::vector<RelayAction> actions = client.listRelayActions();
    REQUIRE(actions.size() == 2);
    CHECK(actions[0].id == "door-1");
    CHECK(actions[0].kind == RelayActionKind::Door);
    CHECK(actions[0].label == "Open relay");
    CHECK(actions[0].relayNumber == 1);
    CHECK(actions[1].id == "sec_box-65793");
    CHECK(actions[1].kind == RelayActionKind::SecBox);
    CHECK(actions[1].label == "Open Door");
    CHECK(actions[1].secBoxId == 65793);
}

TEST_CASE("listRelayActions: catra_role != \"0\" means no sec_box entry") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForRelayActions(req, "1", "0", "1"); };

    std::vector<RelayAction> actions = client.listRelayActions();
    REQUIRE(actions.size() == 1);
    CHECK(actions[0].kind == RelayActionKind::Door);
}

TEST_CASE("listRelayActions: relay_out_mode outside 0/1 means no door entries") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForRelayActions(req, "1", "2", "0"); };

    std::vector<RelayAction> actions = client.listRelayActions();
    REQUIRE(actions.size() == 1);
    CHECK(actions[0].kind == RelayActionKind::SecBox);
}

namespace {
// Shared synthetic wiring for triggerRelayAction() tests: same 2
// config reads as listRelayActions(), plus execute_actions.fcgi.
HttpResponse respondForTrigger(const HttpRequest& req, const std::string& status, nlohmann::json* capturedBody) {
    if (req.path == "/get_configuration.fcgi") {
        return respondForRelayActions(req, "1", "0", "0");
    }
    if (req.path == "/execute_actions.fcgi") {
        if (capturedBody) *capturedBody = nlohmann::json::parse(req.body);
        return FakeTransport::ok(nlohmann::json{{"actions", nlohmann::json::array({{{"status", status}}})}}.dump());
    }
    FAIL("unexpected request path: " << req.path);
    return FakeTransport::ok("{}");
}
}  // namespace

TEST_CASE("triggerRelayAction: success path (non-\"denied\" status)") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForTrigger(req, "ok", nullptr); };

    CHECK_NOTHROW(client.triggerRelayAction("door-1"));
}

TEST_CASE("triggerRelayAction: exact parameters string format for door") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    nlohmann::json captured;
    fake->responder = [&captured](const HttpRequest& req) { return respondForTrigger(req, "ok", &captured); };

    client.triggerRelayAction("door-1");
    REQUIRE(captured["actions"].size() == 1);
    CHECK(captured["actions"][0]["action"] == "door");
    CHECK(captured["actions"][0]["parameters"] == "door=1, reason=3");
}

TEST_CASE("triggerRelayAction: exact parameters string format for sec_box") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    nlohmann::json captured;
    fake->responder = [&captured](const HttpRequest& req) { return respondForTrigger(req, "ok", &captured); };

    client.triggerRelayAction("sec_box-65793");
    REQUIRE(captured["actions"].size() == 1);
    CHECK(captured["actions"][0]["action"] == "sec_box");
    CHECK(captured["actions"][0]["parameters"] == "id=65793, reason=3");
}

TEST_CASE("triggerRelayAction: device \"denied\" status raises ActionDeniedError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForTrigger(req, "denied", nullptr); };

    bool threw = false;
    try {
        client.triggerRelayAction("door-1");
    } catch (const ActionDeniedError& e) {
        threw = true;
        CHECK(std::string(e.what()).find("door-1") != std::string::npos);
    }
    CHECK(threw);
}

TEST_CASE("triggerRelayAction: unknown id raises ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) { return respondForRelayActions(req, "1", "0", "0"); };

    bool threw = false;
    try {
        client.triggerRelayAction("door-999");
    } catch (const ProtocolError& e) {
        threw = true;
        CHECK(std::string(e.what()).find("door-999") != std::string::npos);
    }
    CHECK(threw);
}
