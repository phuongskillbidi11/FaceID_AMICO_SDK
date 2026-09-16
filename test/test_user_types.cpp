#include <doctest/doctest.h>

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

// ------------------------- UT-1..UT-8: query builder shapes -------------------------

TEST_CASE("UT-1: buildUserTypesListBody requests kUserTypeFields") {
    nlohmann::json body = detail::buildUserTypesListBody();
    CHECK(body["object"] == "user_types");
    CHECK(body["fields"] == detail::kUserTypeFields);
}

TEST_CASE("UT-2: buildCustomTablesListBody requests kCustomTableFields") {
    nlohmann::json body = detail::buildCustomTablesListBody();
    CHECK(body["object"] == "custom_tables");
    CHECK(body["fields"] == detail::kCustomTableFields);
}

TEST_CASE("UT-3: buildUserTypeCustomTableIdBody matches the live-captured lookup shape verbatim") {
    nlohmann::json body = detail::buildUserTypeCustomTableIdBody(7);
    nlohmann::json expected = {
        {"object", "user_types"},
        {"fields", nlohmann::json::array({"custom_table_id"})},
        {"where", nlohmann::json::array({
            {{"object", "user_types"}, {"field", "id"}, {"value", nlohmann::json::array({7})}},
        })},
    };
    CHECK(body == expected);
}

TEST_CASE("UT-4: buildUserTypeObjectAddBody matches the live-captured object_add.fcgi payload verbatim") {
    nlohmann::json body = detail::buildUserTypeObjectAddBody("_ZZTest12345", "ZZ_Test");
    nlohmann::json expected = {
        {"object", "_ZZTest12345"},
        {"name", "ZZ_Test"},
        {"fields", nlohmann::json::array({
            {{"column_name", "id"}, {"name", "id"}, {"type", "INTEGER"}, {"constraint", "PRIMARY_KEY"}},
            {{"column_name", "user_id"}, {"name", "user_id"}, {"type", "INTEGER"}, {"constraint", "FOREIGN_KEY"},
             {"foreign_key", {{"object", "users"}, {"field", "id"}}}},
        })},
    };
    CHECK(body == expected);
}

TEST_CASE("UT-5: buildUserTypeCreateBody uses the bare create_objects shape") {
    nlohmann::json body = detail::buildUserTypeCreateBody(5, true);
    nlohmann::json expected = {
        {"object", "user_types"},
        {"values", nlohmann::json::array({{{"custom_table_id", 5}, {"require_visitor", 1}}})},
    };
    CHECK(body == expected);
}

TEST_CASE("UT-6: buildCustomTableRenameBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildCustomTableRenameBody(5, "Renamed");
    CHECK(body["object"] == "custom_tables");
    CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}});
    CHECK(body["where"] == nlohmann::json{{"custom_tables", {{"id", 5}}}});
}

TEST_CASE("UT-7: buildUserTypeUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildUserTypeUpdateBody(7, true);
    CHECK(body["object"] == "user_types");
    CHECK(body["values"] == nlohmann::json{{"require_visitor", 1}});
    CHECK(body["where"] == nlohmann::json{{"user_types", {{"id", 7}}}});
}

TEST_CASE("UT-8: buildUserTypeObjectRemoveBody matches the live-captured object_remove.fcgi payload verbatim") {
    nlohmann::json body = detail::buildUserTypeObjectRemoveBody(5);
    CHECK(body == nlohmann::json{{"ids", nlohmann::json::array({5})}});
}

// ------------------------- UT-9..UT-14: UserTypesApi CRUD -------------------------

TEST_CASE("UT-9: UserTypesApi::list() joins user_types with custom_tables client-side") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "user_types") {
            return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array({
                {{"id", 1}, {"custom_table_id", 3}, {"require_visitor", 1}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "custom_tables") {
            return FakeTransport::ok(nlohmann::json{{"custom_tables", nlohmann::json::array({
                {{"id", 3}, {"name", "Visitors"}},
            })}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    std::vector<UserType> result = client.userTypes().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].id == 1);
    CHECK(result[0].customTableId == 3);
    CHECK(result[0].name == "Visitors");
    CHECK(result[0].requireVisitor == true);
}

TEST_CASE("UT-10: UserTypesApi::list() falls back to an empty name when custom_tables has no matching row") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "user_types") {
            return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array({
                {{"id", 1}, {"custom_table_id", 99}, {"require_visitor", 0}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "custom_tables") {
            return FakeTransport::ok(nlohmann::json{{"custom_tables", nlohmann::json::array()}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    std::vector<UserType> result = client.userTypes().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].name == "");
}

TEST_CASE("UT-11: UserTypesApi::create() runs object_add -> create_objects -> modify_objects in order, threading ids") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/object_add.fcgi") {
            order.push_back("object_add");
            CHECK(body["name"] == "ZZ_Test");
            return FakeTransport::ok(R"({"ids":[5]})");
        }
        if (req.path == "/create_objects.fcgi") {
            order.push_back("create_objects");
            CHECK(body["values"][0]["custom_table_id"] == 5);
            CHECK(body["values"][0]["require_visitor"] == 0);
            return FakeTransport::ok(R"({"ids":[9]})");
        }
        if (req.path == "/modify_objects.fcgi") {
            order.push_back("modify_objects");
            CHECK(body["object"] == "custom_tables");
            CHECK(body["values"]["name"] == "ZZ_Test");
            CHECK(body["where"] == nlohmann::json{{"custom_tables", {{"id", 5}}}});
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };

    NewUserType userType; userType.name = "ZZ_Test"; userType.requireVisitor = false;
    CHECK(client.userTypes().create(userType) == 9);
    REQUIRE(order.size() == 3);
    CHECK(order[0] == "object_add");
    CHECK(order[1] == "create_objects");
    CHECK(order[2] == "modify_objects");
}

TEST_CASE("UT-12: UserTypesApi::update() looks up custom_table_id then updates both rows") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "user_types") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array({
                {{"custom_table_id", 5}},
            })}}.dump());
        }
        if (req.path == "/modify_objects.fcgi" && object == "user_types") {
            order.push_back("update_user_type");
            CHECK(body["values"]["require_visitor"] == 1);
            return FakeTransport::ok(R"({"changes": 1})");
        }
        if (req.path == "/modify_objects.fcgi" && object == "custom_tables") {
            order.push_back("rename_custom_table");
            CHECK(body["values"]["name"] == "Renamed");
            return FakeTransport::ok(R"({"changes": 1})");
        }
        return FakeTransport::status(500, "{}");
    };

    UserTypeUpdate update; update.id = 1; update.name = "Renamed"; update.requireVisitor = true;
    CHECK_NOTHROW(client.userTypes().update(update));
    REQUIRE(order.size() == 3);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "update_user_type");
    CHECK(order[2] == "rename_custom_table");
}

TEST_CASE("UT-13: UserTypesApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "user_types") {
            return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array({
                {{"custom_table_id", 5}},
            })}}.dump());
        }
        return FakeTransport::ok(R"({"changes": 0})");
    };
    UserTypeUpdate update; update.id = 1; update.name = "Renamed"; update.requireVisitor = true;
    CHECK_THROWS_AS(client.userTypes().update(update), ProtocolError);
}

TEST_CASE("UT-14: UserTypesApi::remove() looks up custom_table_id then calls object_remove.fcgi") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "user_types") {
            order.push_back("lookup");
            return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array({
                {{"custom_table_id", 5}},
            })}}.dump());
        }
        if (req.path == "/object_remove.fcgi") {
            order.push_back("object_remove");
            CHECK(body == nlohmann::json{{"ids", nlohmann::json::array({5})}});
            return FakeTransport::ok(R"({"ids":[5]})");
        }
        return FakeTransport::status(500, "{}");
    };
    CHECK_NOTHROW(client.userTypes().remove(1));
    REQUIRE(order.size() == 2);
    CHECK(order[0] == "lookup");
    CHECK(order[1] == "object_remove");
}

TEST_CASE("UT-15: UserTypesApi::update()/remove() throw ProtocolError when the user type does not exist") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"user_types", nlohmann::json::array()}}.dump());
    };
    CHECK_THROWS_AS(client.userTypes().remove(999), ProtocolError);
}
