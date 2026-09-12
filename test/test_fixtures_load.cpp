#include <doctest/doctest.h>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"

using namespace amico::test;

TEST_CASE("all fixtures except malformed.json parse as valid JSON") {
    const char* validFixtures[] = {
        "login_success.json",
        "login_failure.json",
        "session_valid_true.json",
        "session_valid_false.json",
        "system_information.json",
        "users_list_default_filter.json",
        "user_get_found.json",
        "user_get_not_found.json",
        "access_logs_list.json",
        "missing_required_field.json",
        "unknown_extra_field.json",
        "sensitive_fields_present.json",
    };
    for (const char* name : validFixtures) {
        const std::string contents = readFixture(name);
        REQUIRE_MESSAGE(!contents.empty(), "fixture file was empty or not found: " << name);
        nlohmann::json parsed;
        CHECK_NOTHROW(parsed = nlohmann::json::parse(contents));
    }
}

TEST_CASE("malformed.json is deliberately invalid JSON") {
    const std::string contents = readFixture("malformed.json");
    nlohmann::json parsed;
    CHECK_THROWS(parsed = nlohmann::json::parse(contents));
}
