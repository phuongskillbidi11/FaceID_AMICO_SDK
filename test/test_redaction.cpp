#include <doctest/doctest.h>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "JsonRedact.hpp"

using namespace amico;
using namespace amico::test;

TEST_CASE("scenario 17: recursive redaction covers nested objects and arrays") {
    nlohmann::json input = nlohmann::json::parse(readFixture("sensitive_fields_present.json"));
    nlohmann::json redacted = redactJson(input);

    const auto& user = redacted["users"][0];
    CHECK(user["password"] == "***REDACTED***");
    CHECK(user["salt"] == "***REDACTED***");
    CHECK(user["id"] == 36);            // non-sensitive fields pass through unchanged
    CHECK(user["name"] == "Test User B");

    CHECK(user["nested"]["session_token_like_field"] == "***REDACTED***");
    CHECK(user["nested"]["array_of_secrets"][0]["authorization"] == "***REDACTED***");
    CHECK(user["nested"]["array_of_secrets"][1]["api_key"] == "***REDACTED***");
}

TEST_CASE("scenario 23: panic_password/panic_salt are redacted by the existing password/salt substring rule") {
    nlohmann::json input = nlohmann::json::parse(readFixture("sensitive_fields_present.json"));
    nlohmann::json redacted = redactJson(input);

    const auto& user = redacted["users"][0];
    REQUIRE(user.contains("panic_password"));
    REQUIRE(user.contains("panic_salt"));
    CHECK(user["panic_password"] == "***REDACTED***");
    CHECK(user["panic_salt"] == "***REDACTED***");
}

TEST_CASE("redaction is case-insensitive on key names") {
    nlohmann::json input = {{"PASSWORD", "x"}, {"Session_Token", "y"}, {"plain_field", "z"}};
    nlohmann::json redacted = redactJson(input);
    CHECK(redacted["PASSWORD"] == "***REDACTED***");
    CHECK(redacted["Session_Token"] == "***REDACTED***");
    CHECK(redacted["plain_field"] == "z");
}
