#include <doctest/doctest.h>

#include <memory>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"

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

TEST_CASE("scenario 9: access-log parsing maps the confirmed schema, including nullable user_id/portal_id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        CHECK(req.path == "/load_objects.fcgi");
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    std::vector<AccessLogEntry> logs = client.accessLogs().list();
    REQUIRE(logs.size() == 3);
    CHECK(logs[0].id == 211);
    REQUIRE(logs[0].userId.has_value());
    CHECK(*logs[0].userId == 36);
    CHECK_FALSE(logs[2].userId.has_value());  // null in the fixture
    CHECK_FALSE(logs[2].portalId.has_value());
}

TEST_CASE("AccessLogQuery.to becomes a single server-side where clause; .from is applied client-side") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        REQUIRE(body["where"].size() == 1);
        CHECK(body["where"][0]["field"] == "time");
        CHECK(body["where"][0]["operator"] == "<=");
        CHECK(body["where"][0]["value"] == 1789160000);
        CHECK(body["where"][0].contains("connector") == false);
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    AccessLogQuery query;
    query.to = 1789160000;
    query.from = 1789151000;  // fixture rows: 1789153178 (kept), 1789150733 and 1789150000 (both excluded)
    std::vector<AccessLogEntry> logs = client.accessLogs().list(query);
    for (const auto& entry : logs) {
        CHECK(entry.time >= *query.from);
    }
    CHECK(logs.size() == 1);
}

TEST_CASE("AccessLogQuery with neither from nor to sends an empty where array") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["where"].is_array());
        CHECK(body["where"].empty());
        return FakeTransport::ok(readFixture("access_logs_list.json"));
    };

    client.accessLogs().list();
}
