#include <doctest/doctest.h>

#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "ObjectQuery.hpp"
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

// ------------------------- V-1: query builder shapes -------------------------

TEST_CASE("V-1: buildVisitsListBody matches the confirmed default filter") {
    nlohmann::json body = detail::buildVisitsListBody(10, 0);
    CHECK(body["object"] == "visits");
    CHECK(body["fields"] == detail::kVisitFields);
    CHECK(body["where"] == nlohmann::json::array({{{"field", "finished"}, {"operator", "!="}, {"value", 1}}}));
    CHECK(body["order"] == nlohmann::json::array({"id"}));
    CHECK(body["limit"] == 10);
    CHECK(body["offset"] == 0);
}

TEST_CASE("V-2: buildVisitGetBody has no finished filter (a specific known id)") {
    nlohmann::json body = detail::buildVisitGetBody(7);
    CHECK(body["object"] == "visits");
    CHECK(body["where"] == nlohmann::json::array({{{"field", "id"}, {"value", 7}}}));
}

TEST_CASE("V-3: buildVisitCreateBody matches the live-captured payload verbatim") {
    nlohmann::json body = detail::buildVisitCreateBody(56, 50, 1789405080, 1789466400);
    nlohmann::json expected = {
        {"join", "LEFT"},
        {"object", "visits"},
        {"fields", detail::kVisitFields},
        {"where", nlohmann::json::array()},
        {"order", nlohmann::json::array({"id"})},
        {"values", nlohmann::json::array({{
            {"visitor_id", 56}, {"host_id", 50}, {"begin_time", 1789405080}, {"end_time", 1789466400}, {"finished", 0},
        }})},
    };
    CHECK(body == expected);
}

TEST_CASE("V-4: buildVisitUpdateBody omits unset fields") {
    nlohmann::json body = detail::buildVisitUpdateBody(7, std::nullopt, std::nullopt, 111, std::nullopt);
    CHECK(body["object"] == "visits");
    CHECK(body["values"] == nlohmann::json{{"begin_time", 111}});
    CHECK(body["where"] == nlohmann::json{{"visits", {{"id", 7}}}});
}

TEST_CASE("V-5: buildVisitDeleteBody uses the one-element array id filter") {
    nlohmann::json body = detail::buildVisitDeleteBody(7);
    CHECK(body["object"] == "visits");
    CHECK(body["where"] == nlohmann::json{{"visits", {{"id", nlohmann::json::array({7})}}}});
}

TEST_CASE("V-6: buildVisitFinishBody sets finished=1 and the given end_time") {
    nlohmann::json body = detail::buildVisitFinishBody(7, 123456);
    CHECK(body["object"] == "visits");
    CHECK(body["values"] == nlohmann::json{{"finished", 1}, {"end_time", 123456}});
    CHECK(body["where"] == nlohmann::json{{"visits", {{"id", 7}}}});
}

TEST_CASE("V-7: buildUserCardsDeleteBody matches class.js's finish-branch literal shape") {
    nlohmann::json body = detail::buildUserCardsDeleteBody(56);
    CHECK(body["object"] == "cards");
    CHECK(body["where"] == nlohmann::json{{"cards", {{"user_id", 56}}}});
}

// ------------------------- V-8: VisitsApi::list()/get() enrichment -------------------------

namespace {
std::function<HttpResponse(const HttpRequest&)> visitsFakeResponder(nlohmann::json visitsRows) {
    return [visitsRows](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (object == "visits") {
            return FakeTransport::ok(nlohmann::json{{"visits", visitsRows}}.dump());
        }
        if (object == "users") {
            // buildUsersByIdsBody shape -- return a name per requested id.
            nlohmann::json rows = nlohmann::json::array();
            for (const auto& id : body["where"]["users"]["id"]) {
                rows.push_back({{"id", id}, {"name", "User " + id.dump()}, {"registration", "REG-" + id.dump()}});
            }
            return FakeTransport::ok(nlohmann::json{{"users", rows}}.dump());
        }
        if (object == "cards") {
            // Raw string literals ending in `*)"` collide with R"(...)"'s
            // own closing delimiter -- build via json object construction
            // instead (same reasoning as UserProfileResponder.hpp).
            return FakeTransport::ok(nlohmann::json{{"cards", nlohmann::json::array({{{"COUNT(*)", 2}}})}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
}
}  // namespace

TEST_CASE("V-8: VisitsApi::list() populates visitorName/hostName/cardCount") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    nlohmann::json rows = nlohmann::json::array({
        {{"id", 1}, {"visitor_id", 56}, {"host_id", 50}, {"begin_time", 100}, {"end_time", 200}, {"finished", 0}},
    });
    fake->responder = visitsFakeResponder(rows);

    std::vector<Visit> visits = client.visits().list();
    REQUIRE(visits.size() == 1);
    CHECK(visits[0].id == 1);
    CHECK(visits[0].visitorId == 56);
    CHECK(visits[0].hostId == 50);
    CHECK(visits[0].visitorName == "User 56");
    CHECK(visits[0].hostName == "User 50");
    CHECK(visits[0].cardCount == 2);
    CHECK(visits[0].finished == false);
}

TEST_CASE("V-8b: VisitsApi::get() returns nullopt when absent, populates otherwise") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = visitsFakeResponder(nlohmann::json::array());
    CHECK_FALSE(client.visits().get(999).has_value());

    nlohmann::json rows = nlohmann::json::array({
        {{"id", 7}, {"visitor_id", 56}, {"host_id", 50}, {"begin_time", 100}, {"end_time", 0}, {"finished", 1}},
    });
    fake->responder = visitsFakeResponder(rows);
    std::optional<Visit> visit = client.visits().get(7);
    REQUIRE(visit.has_value());
    CHECK(visit->finished == true);
}

// ------------------------- V-9: create/update/remove -------------------------

TEST_CASE("V-9: VisitsApi::create() returns the new id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"ids":[42]})"); };

    NewVisit visit;
    visit.visitorId = 56; visit.hostId = 50; visit.beginTime = 100; visit.endTime = 200;
    CHECK(client.visits().create(visit) == 42);
}

TEST_CASE("V-10: VisitsApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    VisitUpdate update; update.id = 7; update.beginTime = 111;
    CHECK_THROWS_AS(client.visits().update(update), ProtocolError);
}

TEST_CASE("V-11: VisitsApi::remove() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    CHECK_THROWS_AS(client.visits().remove(7), ProtocolError);
}

// ------------------------- V-12: finish() ordering and not-found -------------------------

TEST_CASE("V-12: VisitsApi::finish() revokes the visitor's cards before the finish update, in order") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    nlohmann::json rows = nlohmann::json::array({
        {{"id", 7}, {"visitor_id", 56}, {"host_id", 50}, {"begin_time", 100}, {"end_time", 0}, {"finished", 0}},
    });
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "visits") {
            return FakeTransport::ok(nlohmann::json{{"visits", rows}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "users") {
            nlohmann::json usersRows = nlohmann::json::array();
            for (const auto& id : body["where"]["users"]["id"]) {
                usersRows.push_back({{"id", id}, {"name", "User"}, {"registration", "REG"}});
            }
            return FakeTransport::ok(nlohmann::json{{"users", usersRows}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "cards") {
            return FakeTransport::ok(nlohmann::json{{"cards", nlohmann::json::array({{{"COUNT(*)", 0}}})}}.dump());
        }
        if (req.path == "/destroy_objects.fcgi" && object == "cards") {
            order.push_back("destroy_cards");
            return FakeTransport::ok(R"({"changes": 3})");
        }
        if (req.path == "/modify_objects.fcgi" && object == "visits") {
            order.push_back("modify_visits");
            CHECK(body["values"]["finished"] == 1);
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };

    client.visits().finish(7);
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "destroy_cards");
    CHECK(order[1] == "modify_visits");
}

TEST_CASE("V-13: VisitsApi::finish() throws ProtocolError when the visit doesn't exist") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"visits":[]})"); };

    CHECK_THROWS_AS(client.visits().finish(999), ProtocolError);
}
