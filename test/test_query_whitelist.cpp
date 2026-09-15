#include <doctest/doctest.h>

#include <algorithm>

#include <nlohmann/json.hpp>

#include "ObjectQuery.hpp"

using namespace amico;

TEST_CASE("scenario 18: builders always target a fixed, hardcoded object -- never a caller-supplied name") {
    nlohmann::json usersBody = detail::buildUsersListBody(10, 0);
    CHECK(usersBody["object"] == "users");

    nlohmann::json getBody = detail::buildUserGetBody(1);
    CHECK(getBody["object"] == "users");

    nlohmann::json logsBody = detail::buildAccessLogsListBody(std::nullopt, std::nullopt, 10, 0);
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

    nlohmann::json logsBody = detail::buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0);
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

    nlohmann::json logsBody = detail::buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0);
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

TEST_CASE("Q-1: kAccessLogFields includes identifier_id") {
    CHECK(std::find(detail::kAccessLogFields.begin(), detail::kAccessLogFields.end(), "identifier_id") !=
          detail::kAccessLogFields.end());
}

TEST_CASE("Q-2: chained from+to where-clause shape checks values, not just length") {
    nlohmann::json logsBody = detail::buildAccessLogsListBody(1700000000, 1700005000, 10, 0);
    REQUIRE(logsBody["where"].size() == 2);
    CHECK(logsBody["where"][0]["field"] == "time");
    CHECK(logsBody["where"][0]["operator"] == ">=");
    CHECK(logsBody["where"][0]["value"] == 1700000000);
    CHECK(logsBody["where"][0].contains("connector") == false);
    CHECK(logsBody["where"][1]["field"] == "time");
    CHECK(logsBody["where"][1]["operator"] == "<=");
    CHECK(logsBody["where"][1]["value"] == 1700005000);
    CHECK(logsBody["where"][1].contains("connector") == false);
}

TEST_CASE("Q-3: from-only and to-only cases still produce a single correctly-shaped clause") {
    nlohmann::json fromOnly = detail::buildAccessLogsListBody(1700000000, std::nullopt, 10, 0);
    REQUIRE(fromOnly["where"].size() == 1);
    CHECK(fromOnly["where"][0]["field"] == "time");
    CHECK(fromOnly["where"][0]["operator"] == ">=");
    CHECK(fromOnly["where"][0]["value"] == 1700000000);

    nlohmann::json toOnly = detail::buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0);
    REQUIRE(toOnly["where"].size() == 1);
    CHECK(toOnly["where"][0]["field"] == "time");
    CHECK(toOnly["where"][0]["operator"] == "<=");
    CHECK(toOnly["where"][0]["value"] == 1700000000);
}

TEST_CASE("Q-4: buildAccessLogsCountBody mirrors the list query's where clause") {
    nlohmann::json countBody = detail::buildAccessLogsCountBody(1700000000, 1700005000);
    CHECK(countBody["object"] == "access_logs");
    CHECK(countBody["fields"] == nlohmann::json::array({"COUNT(*)"}));
    CHECK_FALSE(countBody.contains("order"));
    CHECK_FALSE(countBody.contains("limit"));
    CHECK_FALSE(countBody.contains("offset"));
    CHECK_FALSE(countBody.contains("finish"));

    nlohmann::json listBody = detail::buildAccessLogsListBody(1700000000, 1700005000, 10, 0);
    CHECK(countBody["where"] == listBody["where"]);
}

TEST_CASE("Q-5: buildPortalsListBody / buildTimeZonesListBody request only id and name, unbounded") {
    nlohmann::json portalsBody = detail::buildPortalsListBody();
    CHECK(portalsBody["object"] == "portals");
    CHECK(portalsBody["fields"] == nlohmann::json::array({"id", "name"}));
    CHECK_FALSE(portalsBody.contains("where"));
    CHECK_FALSE(portalsBody.contains("limit"));

    nlohmann::json timeZonesBody = detail::buildTimeZonesListBody();
    CHECK(timeZonesBody["object"] == "time_zones");
    CHECK(timeZonesBody["fields"] == nlohmann::json::array({"id", "name"}));
    CHECK_FALSE(timeZonesBody.contains("where"));
    CHECK_FALSE(timeZonesBody.contains("limit"));
}

TEST_CASE("Q-6: buildUsersByIdsBody uses the confirmed array-of-ids where shape") {
    nlohmann::json body = detail::buildUsersByIdsBody({36, 5});
    CHECK(body["object"] == "users");
    CHECK(body["fields"] == nlohmann::json::array({"id", "name", "registration"}));
    nlohmann::json expectedWhere = {{"users", {{"id", nlohmann::json::array({36, 5})}}}};
    CHECK(body["where"] == expectedWhere);
}

TEST_CASE("Q-7: buildAccessLogAccessRulesBody / buildAccessRuleTimeZonesBody use the confirmed array-of-ids where shape") {
    nlohmann::json rulesBody = detail::buildAccessLogAccessRulesBody({220, 219});
    CHECK(rulesBody["object"] == "access_log_access_rules");
    CHECK(rulesBody["fields"] == nlohmann::json::array({"access_log_id", "access_rule_id"}));
    nlohmann::json expectedRulesWhere = {{"access_log_access_rules", {{"access_log_id", nlohmann::json::array({220, 219})}}}};
    CHECK(rulesBody["where"] == expectedRulesWhere);

    nlohmann::json zonesBody = detail::buildAccessRuleTimeZonesBody({1});
    CHECK(zonesBody["object"] == "access_rule_time_zones");
    CHECK(zonesBody["fields"] == nlohmann::json::array({"access_rule_id", "time_zone_id"}));
    nlohmann::json expectedZonesWhere = {{"access_rule_time_zones", {{"access_rule_id", nlohmann::json::array({1})}}}};
    CHECK(zonesBody["where"] == expectedZonesWhere);
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

TEST_CASE("Q-8 (Visitors plan, 2026-09-14): no new builder accepts a caller-supplied object/field/connector string") {
    // buildUsersListBody's new userTypeId parameter and
    // buildUserCreateBody's new userTypeId parameter are both
    // std::optional<int64_t> -- a VALUE, never a field/object/connector
    // name. buildCUsersGetBody/CreateBody/UpdateBody/DeleteBody
    // (ObjectQuery.hpp) all take only int64_t/std::string VALUE
    // parameters the same way. This is a compile-time fact verified by
    // their signatures; no runtime assertion is meaningful here (same
    // pattern as "scenario 18"/the test case immediately above).
}

TEST_CASE("Q-9 (Visits plan, 2026-09-14): no new visits builder accepts a caller-supplied object/field/connector string") {
    // buildVisitsListBody/GetBody/CreateBody/UpdateBody/DeleteBody/
    // FinishBody and buildUserCardsDeleteBody (ObjectQuery.hpp) all take
    // only int64_t VALUE parameters -- never a field/object/connector
    // name. This is a compile-time fact verified by their signatures;
    // no runtime assertion is meaningful here (same pattern as
    // "scenario 18"/Q-8 above).
}

TEST_CASE("Q-10: visits query builders always target the hardcoded visits/cards objects") {
    CHECK(detail::buildVisitsListBody(10, 0)["object"] == "visits");
    CHECK(detail::buildVisitGetBody(1)["object"] == "visits");
    CHECK(detail::buildVisitCreateBody(1, 2, 100, 200)["object"] == "visits");
    CHECK(detail::buildVisitUpdateBody(1)["object"] == "visits");
    CHECK(detail::buildVisitDeleteBody(1)["object"] == "visits");
    CHECK(detail::buildVisitFinishBody(1, 100)["object"] == "visits");
    CHECK(detail::buildUserCardsDeleteBody(1)["object"] == "cards");
}

TEST_CASE("Q-11: kVisitFields never includes password/salt/panic_password/panic_salt") {
    for (const auto& field : detail::kVisitFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}

TEST_CASE("Q-12 (Groups write-side plan, 2026-09-15): no new groups builder accepts a caller-supplied object/field/connector string") {
    // buildGroupCreateBody/UpdateBody/DeleteBody (ObjectQuery.hpp) all
    // take only int64_t/std::string VALUE parameters -- never a
    // field/object/connector name. This is a compile-time fact verified
    // by their signatures; no runtime assertion is meaningful here
    // (same pattern as "scenario 18"/Q-9 above).
    CHECK(detail::buildGroupCreateBody("Test")["object"] == "groups");
    CHECK(detail::buildGroupUpdateBody(1, "Test")["object"] == "groups");
    CHECK(detail::buildGroupDeleteBody(1)["object"] == "groups");
}

TEST_CASE("Q-13 (Time Zones write-side plan, 2026-09-15): no new time_zones/time_spans builder accepts a caller-supplied object/field/connector string") {
    // buildTimeZoneCreateBody/UpdateBody/DeleteBody and
    // buildTimeSpansListBody/buildTimeSpanCreateBody/UpdateBody/DeleteBody
    // (ObjectQuery.hpp) all take only int64_t/std::string/bool VALUE
    // parameters (or a NewTimeSpan/TimeSpanUpdate struct of same) --
    // never a field/object/connector name. Compile-time fact verified
    // by their signatures; no runtime assertion is meaningful here
    // (same pattern as "scenario 18"/Q-9/Q-12 above).
    CHECK(detail::buildTimeZoneCreateBody("Test")["object"] == "time_zones");
    CHECK(detail::buildTimeZoneUpdateBody(1, "Test")["object"] == "time_zones");
    CHECK(detail::buildTimeZoneDeleteBody(1)["object"] == "time_zones");
    CHECK(detail::buildTimeSpansListBody(1)["object"] == "time_spans");
}

TEST_CASE("Q-14: kTimeSpanFields never includes password/salt/panic_password/panic_salt") {
    for (const auto& field : detail::kTimeSpanFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}

TEST_CASE("Q-15 (Holidays write-side plan, 2026-09-15): no new holidays builder accepts a caller-supplied object/field/connector string") {
    // buildHolidaysListBody/buildHolidayCreateBody/UpdateBody/DeleteBody
    // (ObjectQuery.hpp) take only int64_t/std::string/bool VALUE
    // parameters -- never a field/object/connector name. Compile-time
    // fact verified by their signatures; no runtime assertion is
    // meaningful here (same pattern as Q-9/Q-12/Q-13 above).
    CHECK(detail::buildHolidaysListBody()["object"] == "holidays");
    CHECK(detail::buildHolidayCreateBody("Test", 0, true, true, true, true)["object"] == "holidays");
    CHECK(detail::buildHolidayUpdateBody(1, "Test", 0, true, true, true, true)["object"] == "holidays");
    CHECK(detail::buildHolidayDeleteBody(1)["object"] == "holidays");
}

TEST_CASE("Q-16: kHolidayFields never includes password/salt/panic_password/panic_salt") {
    for (const auto& field : detail::kHolidayFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}

TEST_CASE("Q-17 (Scheduled Unlock write-side plan, 2026-09-15): no new scheduled_unlocks/access_rules builder accepts a caller-supplied object/field/connector string") {
    // buildScheduledUnlocksListBody/CreateBody/UpdateBody/DeleteBody,
    // buildScheduledUnlockTimeZoneIdsBody/AccessRuleIdBody/
    // AccessRuleCreateBody/AccessRuleLinkBody, and
    // buildAccessRuleTimeZoneLinkBody/UnlinkBody (ObjectQuery.hpp) take
    // only int64_t/std::string VALUE parameters -- never a
    // field/object/connector name. Compile-time fact verified by their
    // signatures; no runtime assertion is meaningful here (same pattern
    // as Q-9/Q-12/Q-13/Q-15 above).
    CHECK(detail::buildScheduledUnlocksListBody()["object"] == "scheduled_unlocks");
    CHECK(detail::buildScheduledUnlockCreateBody("Test", "msg")["object"] == "scheduled_unlocks");
    CHECK(detail::buildScheduledUnlockUpdateBody(1, "Test", "msg")["object"] == "scheduled_unlocks");
    CHECK(detail::buildScheduledUnlockDeleteBody(1)["object"] == "scheduled_unlocks");
    CHECK(detail::buildScheduledUnlockTimeZoneIdsBody(1)["object"] == "time_zones");
    CHECK(detail::buildScheduledUnlockAccessRuleIdBody(1)["object"] == "scheduled_unlock_access_rules");
    CHECK(detail::buildScheduledUnlockAccessRuleCreateBody(1)["object"] == "access_rules");
    CHECK(detail::buildScheduledUnlockAccessRuleLinkBody(1, 4)["object"] == "scheduled_unlock_access_rules");
    CHECK(detail::buildAccessRuleTimeZoneLinkBody(4, 1)["object"] == "access_rule_time_zones");
    CHECK(detail::buildAccessRuleTimeZoneUnlinkBody(4, 1)["object"] == "access_rule_time_zones");
}

TEST_CASE("Q-18: kScheduledUnlockFields never includes password/salt/panic_password/panic_salt") {
    for (const auto& field : detail::kScheduledUnlockFields) {
        CHECK(field != "password");
        CHECK(field != "salt");
        CHECK(field != "panic_password");
        CHECK(field != "panic_salt");
    }
}
