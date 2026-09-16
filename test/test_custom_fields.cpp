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

// ------------------------- CF-1..CF-4: query builder shapes -------------------------

TEST_CASE("CF-1: buildCustomColumnsListBody excludes id/user_id/visit_id column names") {
    nlohmann::json body = detail::buildCustomColumnsListBody();
    CHECK(body["object"] == "custom_columns");
    CHECK(body["fields"] == detail::kCustomColumnFields);
    CHECK(body["where"].size() == 3);
    CHECK(body["where"][0]["value"] == "id");
    CHECK(body["where"][1]["value"] == "user_id");
    CHECK(body["where"][2]["value"] == "visit_id");
}

TEST_CASE("CF-2: buildCustomFieldObjectAddBody matches the live-captured Text/non-mandatory payload verbatim") {
    nlohmann::json body = detail::buildCustomFieldObjectAddBody("c_visits", "_ZZTestField64189", "ZZ_TestField", "TEXT", "NONE", "");
    nlohmann::json expected = {
        {"object", "c_visits"}, {"column_name", "_ZZTestField64189"},
        {"name", "ZZ_TestField"}, {"type", "TEXT"}, {"constraint", "NONE"}, {"default_value", ""},
    };
    CHECK(body == expected);
}

TEST_CASE("CF-2b: buildCustomFieldObjectAddBody matches the live-captured Number/mandatory payload verbatim") {
    nlohmann::json body = detail::buildCustomFieldObjectAddBody("c_visits", "_ZZNativeTest25230", "ZZ_NativeTest", "INTEGER", "NOT_NULL", 0);
    nlohmann::json expected = {
        {"object", "c_visits"}, {"column_name", "_ZZNativeTest25230"},
        {"name", "ZZ_NativeTest"}, {"type", "INTEGER"}, {"constraint", "NOT_NULL"}, {"default_value", 0},
    };
    CHECK(body == expected);
}

TEST_CASE("CF-3: buildCustomFieldUpdateBody uses the bare-object values + scalar where.id shape") {
    nlohmann::json body = detail::buildCustomFieldUpdateBody(8, "Renamed");
    CHECK(body["object"] == "custom_columns");
    CHECK(body["values"] == nlohmann::json{{"name", "Renamed"}});
    CHECK(body["where"] == nlohmann::json{{"custom_columns", {{"id", 8}}}});
}

TEST_CASE("CF-4: buildCustomFieldObjectRemoveBody matches the live-captured object_remove_fields.fcgi payload verbatim") {
    nlohmann::json body = detail::buildCustomFieldObjectRemoveBody(8);
    CHECK(body == nlohmann::json{{"ids", nlohmann::json::array({8})}});
}

// ------------------------- CF-5..CF-12: CustomFieldsApi CRUD -------------------------

TEST_CASE("CF-5: CustomFieldsApi::list() joins custom_columns with custom_tables client-side") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "custom_columns") {
            return FakeTransport::ok(nlohmann::json{{"custom_columns", nlohmann::json::array({
                {{"id", 1}, {"custom_table_id", 1}, {"name", "CPF"}, {"column_name", "cpf"}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "custom_tables") {
            return FakeTransport::ok(nlohmann::json{{"custom_tables", nlohmann::json::array({
                {{"id", 1}, {"name", "Users"}},
            })}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    std::vector<CustomField> result = client.customFields().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].id == 1);
    CHECK(result[0].customTableId == 1);
    CHECK(result[0].table == "Users");
    CHECK(result[0].name == "CPF");
}

TEST_CASE("CF-6: CustomFieldsApi::list() falls back to an empty table name when custom_tables has no matching row") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (req.path == "/load_objects.fcgi" && object == "custom_columns") {
            return FakeTransport::ok(nlohmann::json{{"custom_columns", nlohmann::json::array({
                {{"id", 1}, {"custom_table_id", 99}, {"name", "Orphan"}, {"column_name", "orphan"}},
            })}}.dump());
        }
        if (req.path == "/load_objects.fcgi" && object == "custom_tables") {
            return FakeTransport::ok(nlohmann::json{{"custom_tables", nlohmann::json::array()}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    std::vector<CustomField> result = client.customFields().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].table == "");
}

TEST_CASE("CF-7: CustomFieldsApi::create() resolves the physical table name and maps type/mandatory correctly") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/load_objects.fcgi") {
            return FakeTransport::ok(nlohmann::json{{"custom_tables", nlohmann::json::array({
                {{"id", 2}, {"name", "Visits"}, {"table_name", "c_visits"}},
            })}}.dump());
        }
        if (req.path == "/object_add_field.fcgi") {
            CHECK(body["object"] == "c_visits");
            CHECK(body["type"] == "INTEGER");
            CHECK(body["constraint"] == "NOT_NULL");
            CHECK(body["default_value"] == 0);
            return FakeTransport::ok(R"({"ids":[9]})");
        }
        return FakeTransport::status(500, "{}");
    };

    NewCustomField field; field.table = "Visits"; field.type = "Number"; field.name = "ZZ_Test"; field.mandatory = true;
    CHECK(client.customFields().create(field) == 9);
}

TEST_CASE("CF-8: CustomFieldsApi::create() throws UnsupportedOperationError for an unrecognized table") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::status(500, "{}"); };

    NewCustomField field; field.table = "Groups"; field.type = "Text"; field.name = "ZZ_Test";
    CHECK_THROWS_AS(client.customFields().create(field), UnsupportedOperationError);
}

TEST_CASE("CF-9: CustomFieldsApi::create() throws UnsupportedOperationError for an unrecognized type") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::status(500, "{}"); };

    NewCustomField field; field.table = "Users"; field.type = "Boolean"; field.name = "ZZ_Test";
    CHECK_THROWS_AS(client.customFields().create(field), UnsupportedOperationError);
}

TEST_CASE("CF-10: CustomFieldsApi::update() throws ProtocolError on zero changes") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"changes": 0})"); };

    CustomFieldUpdate update; update.id = 1; update.name = "Renamed";
    CHECK_THROWS_AS(client.customFields().update(update), ProtocolError);
}

TEST_CASE("CF-11: CustomFieldsApi::update() succeeds on a positive changes count") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "custom_columns");
        CHECK(body["values"]["name"] == "Renamed");
        return FakeTransport::ok(R"({"changes": 1})");
    };

    CustomFieldUpdate update; update.id = 1; update.name = "Renamed";
    CHECK_NOTHROW(client.customFields().update(update));
}

TEST_CASE("CF-12: CustomFieldsApi::remove() calls object_remove_fields.fcgi directly, no lookup needed") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        CHECK(req.path == "/object_remove_fields.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body == nlohmann::json{{"ids", nlohmann::json::array({1})}});
        return FakeTransport::ok(R"({"ids":[1]})");
    };
    CHECK_NOTHROW(client.customFields().remove(1));
}
