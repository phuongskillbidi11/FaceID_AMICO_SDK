#include <doctest/doctest.h>

#include <nlohmann/json.hpp>

#include "ObjectQuery.hpp"

using namespace amico;

TEST_CASE("scenario 18: builders always target a fixed, hardcoded object -- never a caller-supplied name") {
    nlohmann::json usersBody = detail::buildUsersListBody(10, 0);
    CHECK(usersBody["object"] == "users");

    nlohmann::json getBody = detail::buildUserGetBody(1);
    CHECK(getBody["object"] == "users");

    nlohmann::json logsBody = detail::buildAccessLogsListBody(std::nullopt, 10, 0);
    CHECK(logsBody["object"] == "access_logs");

    // There is no overload of any of these three functions that accepts
    // an object name string -- this is a compile-time fact, not just a
    // runtime one. (If such an overload existed, this file would need a
    // negative-compilation test; none exists, so none is needed.)
}

TEST_CASE("every builder always emits a non-empty 'fields' array (Decision 4)") {
    nlohmann::json usersBody = detail::buildUsersListBody(10, 0);
    REQUIRE(usersBody.contains("fields"));
    CHECK(usersBody["fields"].is_array());
    CHECK_FALSE(usersBody["fields"].empty());

    nlohmann::json getBody = detail::buildUserGetBody(1);
    REQUIRE(getBody.contains("fields"));
    CHECK_FALSE(getBody["fields"].empty());

    nlohmann::json logsBody = detail::buildAccessLogsListBody(1700000000, 10, 0);
    REQUIRE(logsBody.contains("fields"));
    CHECK_FALSE(logsBody["fields"].empty());
}

TEST_CASE("the users field list never includes password/salt/panic_password/panic_salt") {
    for (const auto& field : detail::kUserFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}

TEST_CASE("scenario 19: no builder accepts a caller-supplied where.connector string") {
    // buildUsersListBody's two hardcoded where-clauses use fixed connector
    // values ("OR", ") AND (") that match the confirmed real UI query --
    // not something a caller passed in. buildUserGetBody's single clause
    // has no connector key at all (matches the LIVE_CONFIRMED single-
    // clause shape). buildAccessLogsListBody's single clause likewise has
    // no connector key.
    nlohmann::json usersBody = detail::buildUsersListBody(10, 0);
    REQUIRE(usersBody["where"].size() == 2);
    CHECK(usersBody["where"][0]["connector"] == "OR");
    CHECK(usersBody["where"][1]["connector"] == ") AND (");

    nlohmann::json getBody = detail::buildUserGetBody(1);
    REQUIRE(getBody["where"].size() == 1);
    CHECK(getBody["where"][0].contains("connector") == false);

    nlohmann::json logsBody = detail::buildAccessLogsListBody(1700000000, 10, 0);
    REQUIRE(logsBody["where"].size() == 1);
    CHECK(logsBody["where"][0].contains("connector") == false);
}
