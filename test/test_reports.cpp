#include <doctest/doctest.h>

#include <map>
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

// ------------------------- RP-1..RP-5: query builder shapes -------------------------

TEST_CASE("RP-1: buildReportsListBody requests kReportFields, no where") {
    nlohmann::json body = detail::buildReportsListBody();
    CHECK(body["object"] == "reports");
    CHECK(body["fields"] == detail::kReportFields);
    CHECK(body.contains("where") == false);
}

TEST_CASE("RP-2: buildReportFiltersListBody uses the nested-where shape") {
    nlohmann::json body = detail::buildReportFiltersListBody(6);
    CHECK(body["object"] == "report_filters");
    CHECK(body["fields"] == detail::kReportFilterFields);
    CHECK(body["where"] == nlohmann::json{{"report_filters", {{"report_id", 6}}}});
}

TEST_CASE("RP-3: buildReportColumnsListBody uses the nested-where shape") {
    nlohmann::json body = detail::buildReportColumnsListBody(1);
    CHECK(body["object"] == "report_columns");
    CHECK(body["fields"] == detail::kReportColumnFields);
    CHECK(body["where"] == nlohmann::json{{"report_columns", {{"report_id", 1}}}});
}

TEST_CASE("RP-4: buildObjectFieldReportColumnsListBody requests the full list, no where") {
    nlohmann::json body = detail::buildObjectFieldReportColumnsListBody();
    CHECK(body["object"] == "object_field_report_columns");
    CHECK(body["fields"] == detail::kObjectFieldReportColumnFields);
    CHECK(body.contains("where") == false);
}

TEST_CASE("RP-5: buildReportGenerateBody matches the live-captured envelope shape verbatim") {
    nlohmann::json where = {{"access_logs", {{"time", {{"type", "day"}, {"interval", 29}, {"finish", 0}}}}}};
    nlohmann::json order = nlohmann::json::array({"descending", "time"});
    nlohmann::json columns = nlohmann::json::array({
        {{"field", "id"}, {"object", "access_logs"}, {"type", "object_field"}},
    });
    nlohmann::json body = detail::buildReportGenerateBody("access_logs", where, order, ";", "\r\n", columns);
    nlohmann::json expected = {
        {"offset", 0}, {"limit", 100000}, {"where", where}, {"order", order},
        {"object", "access_logs"}, {"delimiter", ";"}, {"line_break", "\r\n"},
        {"header", ""}, {"file_name", ""}, {"join", "LEFT"}, {"columns", columns},
    };
    CHECK(body == expected);
}

// ------------------------- RP-6..RP-11: ReportsApi behavior -------------------------

TEST_CASE("RP-6: ReportsApi::list() maps every field and unescapes the line_break/delimiter descriptors") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        // LIVE_CONFIRMED during this plan's own Group 8: the device's
        // own `line_break` value is the literal 4-character descriptor
        // '\','r','\','n' (a C++ raw-string R"(\r\n)" would also work;
        // "\\r\\n" is the same 4 characters via C++'s own backslash
        // escaping), not real CR/LF bytes -- ReportsApi::list() must
        // unescape it.
        return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
            {{"id", 1}, {"name", "ZZ_Report"}, {"file_name", ""}, {"object", "access_logs"},
             {"header", "Time;Event"}, {"delimiter", ";"}, {"line_break", "\\r\\n"}},
        })}}.dump());
    };
    std::vector<ReportDefinition> result = client.reports().list();
    REQUIRE(result.size() == 1);
    CHECK(result[0].id == 1);
    CHECK(result[0].name == "ZZ_Report");
    CHECK(result[0].object == "access_logs");
    CHECK(result[0].header == "Time;Event");
    CHECK(result[0].delimiter == ";");
    CHECK(result[0].lineBreak == "\r\n");
    CHECK(result[0].lineBreak.size() == 2);  // real CR+LF, not the 4-char literal descriptor
}

TEST_CASE("RP-7: ReportsApi::filters() maps every field") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array({
            {{"id", 29}, {"report_id", 6}, {"object", "access_logs"}, {"field", "time"},
             {"value", "{\"type\":\"day\",\"interval\":29,\"finish\":0}"}, {"visible", 1}, {"editable", 1}},
        })}}.dump());
    };
    std::vector<ReportFilter> result = client.reports().filters(6);
    REQUIRE(result.size() == 1);
    CHECK(result[0].id == 29);
    CHECK(result[0].reportId == 6);
    CHECK(result[0].object == "access_logs");
    CHECK(result[0].field == "time");
    CHECK(result[0].value == "{\"type\":\"day\",\"interval\":29,\"finish\":0}");
    CHECK(result[0].visible == true);
    CHECK(result[0].editable == true);
}

namespace {
// Shared synthetic (never real-device) fixture wiring for exportCsv()
// tests: report 1 backed by "access_logs" (has a "time" column, so the
// descending-time order branch applies), one active "time" filter,
// one column resolving to access_logs.time.
HttpResponse respondForExportHappyPath(const HttpRequest& req, std::vector<std::string>& order) {
    nlohmann::json body = nlohmann::json::parse(req.body);
    if (req.path == "/load_objects.fcgi") {
        const auto object = body.value("object", std::string{});
        if (object == "reports") {
            order.push_back("reports");
            return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
                {{"id", 1}, {"name", "ZZ_Report"}, {"file_name", ""}, {"object", "access_logs"},
                 {"header", "Time"}, {"delimiter", ";"}, {"line_break", "\r\n"}},
            })}}.dump());
        }
        if (object == "report_filters") {
            order.push_back("report_filters");
            return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array({
                {{"id", 29}, {"report_id", 1}, {"object", "access_logs"}, {"field", "time"},
                 {"value", "{\"type\":\"day\",\"interval\":29,\"finish\":0}"}, {"visible", 1}, {"editable", 1}},
            })}}.dump());
        }
        if (object == "report_columns") {
            order.push_back("report_columns");
            return FakeTransport::ok(nlohmann::json{{"report_columns", nlohmann::json::array({
                {{"id", 100}, {"report_id", 1}, {"type", 3}, {"sequence", 0}},
            })}}.dump());
        }
        if (object == "object_field_report_columns") {
            order.push_back("object_field_report_columns");
            return FakeTransport::ok(nlohmann::json{{"object_field_report_columns", nlohmann::json::array({
                {{"id", 1}, {"report_column_id", 100}, {"object", "access_logs"}, {"field", "time"}},
            })}}.dump());
        }
    }
    if (req.path == "/report_generate.fcgi") {
        bool isRowQuery = body["where"]["access_logs"].contains("id");
        if (!isRowQuery) {
            order.push_back("id_query");
            // LIVE_CONFIRMED during Group 8: order is [field, direction]
            // (matching buildAccessLogsListBody's own convention), and
            // a "time" filter's JSON descriptor is converted to a
            // >=/<= operator-object, not embedded raw.
            CHECK(body["order"] == nlohmann::json::array({"time", "descending"}));
            CHECK(body["where"]["access_logs"]["time"].contains(">="));
            CHECK(body["where"]["access_logs"]["time"].contains("<="));
            return FakeTransport::ok(std::string("1\r\n2\r\n"));
        }
        order.push_back("row_query");
        CHECK(body["where"]["access_logs"]["id"] == nlohmann::json::array({1, 2}));
        CHECK(body["columns"].size() == 2);  // id + time
        return FakeTransport::ok(std::string("06/09/2026;12:00:00\r\n07/09/2026;13:00:00\r\n"));
    }
    return FakeTransport::status(500, "{}");
}
}  // namespace

TEST_CASE("RP-8: ReportsApi::exportCsv() runs the full generic resolution + two-step flow, override applied") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    std::vector<std::string> order;
    fake->responder = [&](const HttpRequest& req) { return respondForExportHappyPath(req, order); };

    std::map<int64_t, std::string> overrides = {{29, "{\"type\":\"day\",\"interval\":7,\"finish\":0}"}};
    std::string csv = client.reports().exportCsv(1, overrides);

    CHECK(csv == "Time\r\n06/09/2026;12:00:00\r\n07/09/2026;13:00:00\r\n");
    REQUIRE(order.size() == 6);
    CHECK(order[0] == "reports");
    CHECK(order[1] == "report_filters");
    CHECK(order[2] == "report_columns");
    CHECK(order[3] == "object_field_report_columns");
    CHECK(order[4] == "id_query");
    CHECK(order[5] == "row_query");
}

TEST_CASE("RP-8b: ReportsApi::exportCsv() converts a \"time\" filter's day-descriptor into a >=/<= epoch range") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    int64_t capturedFrom = -1, capturedTo = -1;
    fake->responder = [&](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/load_objects.fcgi") {
            const auto object = body.value("object", std::string{});
            if (object == "reports") {
                return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
                    {{"id", 1}, {"name", "ZZ_Report"}, {"file_name", ""}, {"object", "access_logs"},
                     {"header", ""}, {"delimiter", ";"}, {"line_break", "\r\n"}},
                })}}.dump());
            }
            if (object == "report_filters") {
                return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array({
                    {{"id", 29}, {"report_id", 1}, {"object", "access_logs"}, {"field", "time"},
                     {"value", "{\"type\":\"day\",\"interval\":7,\"finish\":0}"}, {"visible", 1}, {"editable", 1}},
                })}}.dump());
            }
            if (object == "report_columns") {
                return FakeTransport::ok(nlohmann::json{{"report_columns", nlohmann::json::array()}}.dump());
            }
            if (object == "object_field_report_columns") {
                return FakeTransport::ok(nlohmann::json{{"object_field_report_columns", nlohmann::json::array()}}.dump());
            }
        }
        if (req.path == "/report_generate.fcgi") {
            bool isRowQuery = body["where"]["access_logs"].contains("id");
            if (!isRowQuery) {
                REQUIRE(body["where"]["access_logs"]["time"].contains(">="));
                REQUIRE(body["where"]["access_logs"]["time"].contains("<="));
                capturedFrom = body["where"]["access_logs"]["time"][">="].get<int64_t>();
                capturedTo = body["where"]["access_logs"]["time"]["<="].get<int64_t>();
                return FakeTransport::ok(std::string(""));
            }
            return FakeTransport::ok(std::string(""));
        }
        return FakeTransport::status(500, "{}");
    };

    client.reports().exportCsv(1, {});
    REQUIRE(capturedFrom >= 0);
    REQUIRE(capturedTo >= 0);
    CHECK(capturedTo > capturedFrom);
    CHECK(capturedTo - capturedFrom == 7 * 86400);
}

TEST_CASE("RP-9: ReportsApi::exportCsv() throws UnsupportedOperationError for a non-type:3 column") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        const auto object = body.value("object", std::string{});
        if (object == "reports") {
            return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
                {{"id", 1}, {"name", "ZZ_Report"}, {"file_name", ""}, {"object", "access_logs"},
                 {"header", ""}, {"delimiter", ";"}, {"line_break", "\r\n"}},
            })}}.dump());
        }
        if (object == "report_filters") {
            return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array()}}.dump());
        }
        if (object == "report_columns") {
            return FakeTransport::ok(nlohmann::json{{"report_columns", nlohmann::json::array({
                {{"id", 100}, {"report_id", 1}, {"type", 1}, {"sequence", 0}},
            })}}.dump());
        }
        if (object == "object_field_report_columns") {
            return FakeTransport::ok(nlohmann::json{{"object_field_report_columns", nlohmann::json::array()}}.dump());
        }
        return FakeTransport::status(500, "{}");
    };
    CHECK_THROWS_AS(client.reports().exportCsv(1, {}), UnsupportedOperationError);
}

TEST_CASE("RP-10: ReportsApi::exportCsv() uses ascending-id order for a report with no time column") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/load_objects.fcgi") {
            const auto object = body.value("object", std::string{});
            if (object == "reports") {
                return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
                    {{"id", 5}, {"name", "ZZ_Users"}, {"file_name", ""}, {"object", "users"},
                     {"header", "Name"}, {"delimiter", ";"}, {"line_break", "\r\n"}},
                })}}.dump());
            }
            if (object == "report_filters") {
                return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array()}}.dump());
            }
            if (object == "report_columns") {
                return FakeTransport::ok(nlohmann::json{{"report_columns", nlohmann::json::array({
                    {{"id", 200}, {"report_id", 5}, {"type", 3}, {"sequence", 0}},
                })}}.dump());
            }
            if (object == "object_field_report_columns") {
                return FakeTransport::ok(nlohmann::json{{"object_field_report_columns", nlohmann::json::array({
                    {{"id", 2}, {"report_column_id", 200}, {"object", "users"}, {"field", "name"}},
                })}}.dump());
            }
        }
        if (req.path == "/report_generate.fcgi") {
            CHECK(body["order"] == nlohmann::json::array({"id", "ascending"}));
            bool isRowQuery = body["where"]["users"].contains("id");
            if (!isRowQuery) return FakeTransport::ok(std::string("1\r\n"));
            return FakeTransport::ok(std::string("ZZ_User\r\n"));
        }
        return FakeTransport::status(500, "{}");
    };
    std::string csv = client.reports().exportCsv(5, {});
    CHECK(csv == "Name\r\nZZ_User\r\n");
}

TEST_CASE("RP-10b: ReportsApi::exportCsv() does not duplicate the id column when the report's own columns already include it") {
    // LIVE_CONFIRMED during this plan's own Group 8: the real "Users"
    // report's own object_field_report_columns already lists
    // users.id as its own first entry (unlike Access-style reports,
    // where "id" is only ever implicit/internal) -- prepending it
    // unconditionally produced a duplicate id column and a
    // header/row-count mismatch. This locks in the fix.
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest& req) -> HttpResponse {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (req.path == "/load_objects.fcgi") {
            const auto object = body.value("object", std::string{});
            if (object == "reports") {
                return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array({
                    {{"id", 5}, {"name", "ZZ_Users"}, {"file_name", ""}, {"object", "users"},
                     {"header", "Id;Name"}, {"delimiter", ";"}, {"line_break", "\r\n"}},
                })}}.dump());
            }
            if (object == "report_filters") {
                return FakeTransport::ok(nlohmann::json{{"report_filters", nlohmann::json::array()}}.dump());
            }
            if (object == "report_columns") {
                return FakeTransport::ok(nlohmann::json{{"report_columns", nlohmann::json::array({
                    {{"id", 200}, {"report_id", 5}, {"type", 3}, {"sequence", 0}},
                    {{"id", 201}, {"report_id", 5}, {"type", 3}, {"sequence", 1}},
                })}}.dump());
            }
            if (object == "object_field_report_columns") {
                return FakeTransport::ok(nlohmann::json{{"object_field_report_columns", nlohmann::json::array({
                    {{"id", 2}, {"report_column_id", 200}, {"object", "users"}, {"field", "id"}},
                    {{"id", 3}, {"report_column_id", 201}, {"object", "users"}, {"field", "name"}},
                })}}.dump());
            }
        }
        if (req.path == "/report_generate.fcgi") {
            bool isRowQuery = body["where"]["users"].contains("id");
            if (!isRowQuery) return FakeTransport::ok(std::string("4\r\n"));
            // Exactly 2 columns (id, name) -- no duplicate leading id.
            CHECK(body["columns"].size() == 2);
            CHECK(body["columns"][0]["field"] == "id");
            CHECK(body["columns"][1]["field"] == "name");
            return FakeTransport::ok(std::string("4;ZZ_User\r\n"));
        }
        return FakeTransport::status(500, "{}");
    };
    std::string csv = client.reports().exportCsv(5, {});
    CHECK(csv == "Id;Name\r\n4;ZZ_User\r\n");
}

TEST_CASE("RP-11: ReportsApi::exportCsv() throws ProtocolError when the report id does not exist") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);
    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(nlohmann::json{{"reports", nlohmann::json::array()}}.dump());
    };
    CHECK_THROWS_AS(client.reports().exportCsv(999, {}), ProtocolError);
}
