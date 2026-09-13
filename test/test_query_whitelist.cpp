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

TEST_CASE("every read builder always emits a non-empty 'fields' array (Decision 4)") {
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

TEST_CASE("write builders always target the hardcoded users object") {
    nlohmann::json createBody = detail::buildUserCreateBody("Test User", "TEST-001");
    CHECK(createBody["object"] == "users");

    nlohmann::json updateBody = detail::buildUserUpdateBody(12345, "Test User", "TEST-001");
    CHECK(updateBody["object"] == "users");

    nlohmann::json deleteBody = detail::buildUserDeleteBody(12345);
    CHECK(deleteBody["object"] == "users");

    // As with the read builders, no overload accepts an object name.
    // The create/update string parameters are values, never field names.
    // create_objects.values is a one-element ARRAY (wire-verified live,
    // 2026-09-12: a bare object was rejected with HTTP 400 -- see
    // ObjectQuery.cpp's comment on buildUserCreateBody); modify_objects.values
    // is a bare object.
    nlohmann::json expectedValues = {{"name", "Test User"}, {"registration", "TEST-001"}};
    CHECK(createBody["values"] == nlohmann::json::array({expectedValues}));
    CHECK(updateBody["values"] == expectedValues);
}

TEST_CASE("the users writable field list never includes password/salt/panic_password/panic_salt") {
    CHECK(detail::kUserWritableFields == std::vector<std::string>{"name", "registration"});
    for (const auto& field : detail::kUserWritableFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}

TEST_CASE("no write builder accepts a caller-supplied where.connector string") {
    // No write-builder signature accepts a connector. Creation has no
    // filter; update and delete have only a fixed users/id filter.
    nlohmann::json createBody = detail::buildUserCreateBody("Test User", "TEST-001");
    CHECK_FALSE(createBody.contains("where"));

    nlohmann::json updateBody = detail::buildUserUpdateBody(12345, "Test User", std::nullopt);
    nlohmann::json updateWhere = {{"users", {{"id", 12345}}}};
    CHECK(updateBody["where"] == updateWhere);

    nlohmann::json deleteBody = detail::buildUserDeleteBody(12345);
    nlohmann::json deleteWhere = {{"users", {{"id", nlohmann::json::array({12345})}}}};
    CHECK(deleteBody["where"] == deleteWhere);
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

TEST_CASE("group/card/administrator write builders always target their hardcoded object") {
    CHECK(detail::buildGroupAddBody(1, 2)["object"] == "user_groups");
    CHECK(detail::buildGroupRemoveBody(1, 2)["object"] == "user_groups");
    CHECK(detail::buildCardAddBody(1, 10, 5)["object"] == "cards");
    CHECK(detail::buildCardRemoveBody(99)["object"] == "cards");
    CHECK(detail::buildAdministratorSetBody(1, true)["object"] == "user_roles");
    CHECK(detail::buildAdministratorSetBody(1, false)["object"] == "user_roles");
}

TEST_CASE("card add builder packs value as areaCode * 4294967296 + cardNumber") {
    nlohmann::json body = detail::buildCardAddBody(7, 10, 5);
    nlohmann::json expectedValues = {{"user_id", 7}, {"value", 10LL * 4294967296LL + 5LL}};
    CHECK(body["values"] == nlohmann::json::array({expectedValues}));
}

TEST_CASE("administrator set builder emits a create shape when granting and a destroy shape when revoking") {
    nlohmann::json grantBody = detail::buildAdministratorSetBody(7, true);
    CHECK(grantBody["values"] == nlohmann::json::array({nlohmann::json{{"user_id", 7}, {"role", 1}}}));
    CHECK_FALSE(grantBody.contains("where"));

    nlohmann::json revokeBody = detail::buildAdministratorSetBody(7, false);
    nlohmann::json expectedWhere = {{"user_roles", {{"user_id", 7}, {"role", 1}}}};
    CHECK(revokeBody["where"] == expectedWhere);
    CHECK_FALSE(revokeBody.contains("values"));
}

TEST_CASE("kUserGroupWritableFields / kCardWritableFields / kUserRoleWritableFields never contain credential field names") {
    CHECK(detail::kUserGroupWritableFields == std::vector<std::string>{"user_id", "group_id"});
    CHECK(detail::kCardWritableFields == std::vector<std::string>{"user_id", "value"});
    CHECK(detail::kUserRoleWritableFields == std::vector<std::string>{"user_id", "role"});

    for (const auto* fields : {&detail::kUserGroupWritableFields, &detail::kCardWritableFields,
                                &detail::kUserRoleWritableFields}) {
        for (const auto& field : *fields) {
            CHECK(field != "password");
            CHECK(field != "salt");
            CHECK(field != "panic_password");
            CHECK(field != "panic_salt");
        }
    }
}

TEST_CASE("buildPasswordSetBody places already-hashed values into the modify shape, never accepting a plaintext-hashing role itself") {
    // This builder takes an ALREADY-HASHED password+salt pair -- hashing
    // itself happens in Client.cpp via the device's own user_hash_password
    // command (see docs/ui-action-protocol-map.md). This test only checks
    // the builder places whatever strings it's given into the correct
    // shape; that Client.cpp actually hashes before calling this is
    // covered separately in test_users.cpp.
    nlohmann::json body = detail::buildPasswordSetBody(42, "HASHED_VALUE_ABC", "SALT_XYZ");
    CHECK(body["object"] == "users");
    CHECK(body["values"]["password"] == "HASHED_VALUE_ABC");
    CHECK(body["values"]["salt"] == "SALT_XYZ");
    nlohmann::json expectedWhere = {{"users", {{"id", 42}}}};
    CHECK(body["where"] == expectedWhere);
}

TEST_CASE("buildUserHasPasswordBody requests only the password field, never salt, for a single user") {
    nlohmann::json body = detail::buildUserHasPasswordBody(7);
    CHECK(body["object"] == "users");
    CHECK(body["fields"] == nlohmann::json::array({"password"}));

    REQUIRE(body["where"].size() == 1);
    CHECK(body["where"][0]["field"] == "id");
    CHECK(body["where"][0]["value"] == 7);
    CHECK(body["where"][0].contains("connector") == false);
}

TEST_CASE("hasPassword/groupIds/count read builders never request the salt field") {
    CHECK(detail::buildUserHasPasswordBody(1)["fields"] == nlohmann::json::array({"password"}));
    CHECK(detail::buildUserGroupIdsBody(1)["fields"] == nlohmann::json::array({"group_id"}));
    CHECK(detail::buildUserIsAdminBody(1)["fields"] == nlohmann::json::array({"user_id"}));
    CHECK(detail::buildCardCountBody(1)["fields"] == nlohmann::json::array({"COUNT(*)"}));
    CHECK(detail::buildFaceCountBody(1)["fields"] == nlohmann::json::array({"COUNT(*)"}));
    CHECK(detail::buildBioCountBody(1)["fields"] == nlohmann::json::array({"COUNT(*)"}));
}

TEST_CASE("no new Group 1 builder accepts a caller-supplied object/field/connector string") {
    // buildGroupAddBody/buildGroupRemoveBody/buildCardAddBody/
    // buildCardRemoveBody/buildAdministratorSetBody/buildPasswordSetBody/
    // buildUserHasPasswordBody/buildUserGroupIdsBody/buildUserIsAdminBody/
    // buildCardCountBody/buildFaceCountBody/buildBioCountBody/
    // buildUserDestroyImageBody (ObjectQuery.hpp) all take only
    // int64_t/bool/std::string VALUE parameters -- never a field/object/
    // connector name. This is a compile-time fact verified by their
    // signatures; no runtime assertion is meaningful here (same pattern
    // as "scenario 18" above).
}
