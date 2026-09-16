#include "ObjectQuery.hpp"

namespace amico::detail {

const std::vector<std::string> kUserFields = {
    "id", "name", "registration", "user_type_id", "begin_time", "end_time", "last_access",
};

const std::vector<std::string> kAccessLogFields = {
    "id", "time", "user_id", "portal_id", "log_type_id", "event", "identifier_id",
};

const std::vector<std::string> kUserWritableFields = {
    "name", "registration",
};

const std::vector<std::string> kUserGroupWritableFields = {
    "user_id", "group_id",
};

const std::vector<std::string> kCardWritableFields = {
    "user_id", "value",
};

const std::vector<std::string> kUserRoleWritableFields = {
    "user_id", "role",
};

const std::vector<std::string> kVisitFields = {
    "id", "visitor_id", "host_id", "begin_time", "end_time", "finished",
};

const std::vector<std::string> kTimeSpanFields = {
    "id", "time_zone_id", "start", "end",
    "sun", "mon", "tue", "wed", "thu", "fri", "sat",
    "hol1", "hol2", "hol3",
};

const std::vector<std::string> kHolidayFields = {
    "id", "name", "start", "hol1", "hol2", "hol3", "repeats", "end",
};

const std::vector<std::string> kScheduledUnlockFields = {
    "id", "name", "message",
};

const std::vector<std::string> kUserTypeFields = {
    "id", "custom_table_id", "require_visitor",
};

const std::vector<std::string> kCustomTableFields = {
    "id", "name", "table_name",
};

const std::vector<std::string> kCustomColumnFields = {
    "id", "custom_table_id", "name", "column_name",
};

nlohmann::json buildUsersListBody(int limit, int offset, std::optional<int64_t> userTypeId) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "users";
    body["fields"] = kUserFields;
    if (userTypeId.has_value()) {
        body["where"] = nlohmann::json::array({
            {{"field", "id"}, {"object", "user_types"}, {"value", *userTypeId}},
        });
    } else {
        body["where"] = nlohmann::json::array({
            {{"field", "user_type_id"}, {"operator", "="}, {"value", 0}, {"connector", "OR"}},
            {{"field", "user_type_id"}, {"operator", "IS NULL"}, {"connector", ") AND ("}},
        });
    }
    body["order"] = nlohmann::json::array({"name"});
    body["limit"] = limit;
    body["offset"] = offset;
    body["finish"] = true;
    return body;
}

nlohmann::json buildUserGetBody(int64_t id) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "users";
    body["fields"] = kUserFields;
    body["where"] = nlohmann::json::array({
        {{"field", "id"}, {"value", id}},
    });
    body["order"] = nlohmann::json::array({"name"});
    body["limit"] = 1;
    body["offset"] = 0;
    return body;
}

namespace {

nlohmann::json buildAccessLogsWhere(std::optional<int64_t> from, std::optional<int64_t> to, const std::optional<std::vector<int64_t>>& userIds, const std::optional<std::vector<int64_t>>& groupIds, const std::optional<std::vector<int64_t>>& timeZoneIds) {
    const auto selected = [](const auto& ids) { return ids && !ids->empty(); };
    if (selected(userIds) || selected(groupIds) || selected(timeZoneIds)) {
        auto where = nlohmann::json::object();
        where["access_logs"] = nlohmann::json::object();
        if (from) where["access_logs"]["time"][">="] = *from;
        if (to) where["access_logs"]["time"]["<="] = *to;
        if (selected(userIds)) where["users"]["id"] = *userIds;
        if (selected(groupIds)) where["groups"]["id"] = *groupIds;
        if (selected(timeZoneIds)) where["time_zones"]["id"] = *timeZoneIds;
        return where;
    }
    // Preserve the legacy request byte-for-byte when no new filter is selected.
    auto where = nlohmann::json::array();
    if (from.has_value()) {
        where.push_back({{"field", "time"}, {"operator", ">="}, {"value", *from}});
    }
    if (to.has_value()) {
        where.push_back({{"field", "time"}, {"operator", "<="}, {"value", *to}});
    }
    return where;
}

}  // namespace

nlohmann::json buildAccessLogsListBody(std::optional<int64_t> from, std::optional<int64_t> to,
                                       int limit, int offset, const std::optional<std::vector<int64_t>>& userIds, const std::optional<std::vector<int64_t>>& groupIds, const std::optional<std::vector<int64_t>>& timeZoneIds) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "access_logs";
    body["fields"] = kAccessLogFields;
    body["where"] = buildAccessLogsWhere(from, to, userIds, groupIds, timeZoneIds);
    body["order"] = nlohmann::json::array({"time", "descending"});
    body["limit"] = limit;
    body["offset"] = offset;
    body["finish"] = true;
    return body;
}

nlohmann::json buildAccessLogsCountBody(std::optional<int64_t> from, std::optional<int64_t> to, const std::optional<std::vector<int64_t>>& userIds, const std::optional<std::vector<int64_t>>& groupIds, const std::optional<std::vector<int64_t>>& timeZoneIds) {
    nlohmann::json body;
    body["object"] = "access_logs";
    body["fields"] = nlohmann::json::array({"COUNT(*)"});
    body["where"] = buildAccessLogsWhere(from, to, userIds, groupIds, timeZoneIds);
    return body;
}

nlohmann::json buildPortalsListBody() {
    nlohmann::json body;
    body["object"] = "portals";
    body["fields"] = nlohmann::json::array({"id", "name"});
    return body;
}

nlohmann::json buildGroupsListBody() {
    nlohmann::json body;
    body["object"] = "groups";
    body["fields"] = nlohmann::json::array({"id", "name"});
    return body;
}

nlohmann::json buildGroupCreateBody(const std::string& name) {
    // Verbatim shape captured live 2026-09-15 -- includes
    // join/fields/where/order alongside "values", same as
    // buildVisitCreateBody.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "groups";
    body["fields"] = nlohmann::json::array({"id", "name"});
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"name"});
    body["values"] = nlohmann::json::array({{{"name", name}}});
    return body;
}

nlohmann::json buildGroupUpdateBody(int64_t id, const std::string& name) {
    nlohmann::json body;
    body["object"] = "groups";
    body["values"] = {{"name", name}};
    body["where"] = {{"groups", {{"id", id}}}};
    return body;
}

nlohmann::json buildGroupDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "groups";
    body["where"] = {{"groups", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildGroupTimeZoneIdsBody(int64_t groupId) {
    // Verbatim shape captured live 2026-09-16 -- identical
    // cross-object where pattern already used by
    // buildScheduledUnlockTimeZoneIdsBody, just where.object:
    // "groups" instead of "scheduled_unlocks".
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "time_zones";
    body["fields"] = nlohmann::json::array({"id"});
    body["where"] = nlohmann::json::array({
        {{"object", "groups"}, {"field", "id"}, {"value", groupId}, {"connector", ") AND ("}},
    });
    body["order"] = nlohmann::json::array({"name"});
    body["limit"] = 1000;
    body["offset"] = 0;
    return body;
}

nlohmann::json buildGroupAccessRuleIdBody(int64_t groupId) {
    // NOT independently live-captured -- inferred by symmetry with
    // buildScheduledUnlockAccessRuleIdBody (spec.md Decision 1,
    // Risks). Confirm/adjust during this plan's own Group 8.
    nlohmann::json body;
    body["object"] = "group_access_rules";
    body["fields"] = nlohmann::json::array({"access_rule_id"});
    body["where"] = {{"group_access_rules", {{"group_id", groupId}}}};
    return body;
}

nlohmann::json buildGroupAccessRuleCreateBody(int64_t groupId) {
    // Verbatim shape captured live 2026-09-16 -- auto-generated name
    // matches the device's own convention exactly.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "access_rules";
    body["fields"] = nlohmann::json::array({"id", "name", "type", "priority"});
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"name"});
    body["values"] = nlohmann::json::array({{
        {"name", "(access_rules automatically created for groups " + std::to_string(groupId) + ")"},
        {"type", 1}, {"priority", 0},
    }});
    return body;
}

nlohmann::json buildGroupAccessRuleLinkBody(int64_t groupId, int64_t accessRuleId) {
    // Verbatim shape captured live 2026-09-16.
    nlohmann::json body;
    body["object"] = "group_access_rules";
    body["values"] = nlohmann::json::array({
        {{"group_id", groupId}, {"access_rule_id", accessRuleId}},
    });
    return body;
}

nlohmann::json buildTimeZonesListBody() {
    nlohmann::json body;
    body["object"] = "time_zones";
    body["fields"] = nlohmann::json::array({"id", "name"});
    return body;
}

nlohmann::json buildTimeZoneCreateBody(const std::string& name) {
    // Verbatim shape captured live 2026-09-15 -- same extended shape
    // as buildGroupCreateBody/buildVisitCreateBody.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "time_zones";
    body["fields"] = nlohmann::json::array({"id", "name"});
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"name"});
    body["values"] = nlohmann::json::array({{{"name", name}}});
    return body;
}

nlohmann::json buildTimeZoneUpdateBody(int64_t id, const std::string& name) {
    nlohmann::json body;
    body["object"] = "time_zones";
    body["values"] = {{"name", name}};
    body["where"] = {{"time_zones", {{"id", id}}}};
    return body;
}

nlohmann::json buildTimeZoneDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "time_zones";
    body["where"] = {{"time_zones", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildTimeSpansListBody(int64_t timeZoneId) {
    nlohmann::json body;
    body["object"] = "time_spans";
    body["fields"] = kTimeSpanFields;
    body["where"] = {{"time_spans", {{"time_zone_id", timeZoneId}}}};
    return body;
}

namespace {
// LIVE_CONFIRMED 2026-09-15: the device rejects a real JSON boolean
// here with `{"error":"Invalid member 'sun' (int expected, got
// boolean)","code":1}` -- it wants a plain 0/1 integer, matching its
// own read-side behavior (mapTimeSpan's requireBoolLikeField, Client.cpp)
// which already reads these back as 0/1 integers, not JSON booleans.
int boolToDeviceInt(bool value) { return value ? 1 : 0; }

nlohmann::json timeSpanValues(int64_t timeZoneId, int64_t start, int64_t end,
                               bool sun, bool mon, bool tue, bool wed, bool thu, bool fri, bool sat,
                               bool hol1, bool hol2, bool hol3) {
    return {
        {"time_zone_id", timeZoneId}, {"start", start}, {"end", end},
        {"sun", boolToDeviceInt(sun)}, {"mon", boolToDeviceInt(mon)}, {"tue", boolToDeviceInt(tue)},
        {"wed", boolToDeviceInt(wed)}, {"thu", boolToDeviceInt(thu)}, {"fri", boolToDeviceInt(fri)},
        {"sat", boolToDeviceInt(sat)},
        {"hol1", boolToDeviceInt(hol1)}, {"hol2", boolToDeviceInt(hol2)}, {"hol3", boolToDeviceInt(hol3)},
    };
}
}  // namespace

nlohmann::json buildTimeSpanCreateBody(const NewTimeSpan& span) {
    // Not independently live-captured -- built by symmetry with the
    // confirmed extended create shape (join/fields/where/order +
    // values), using kTimeSpanFields.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "time_spans";
    body["fields"] = kTimeSpanFields;
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"start"});
    body["values"] = nlohmann::json::array({
        timeSpanValues(span.timeZoneId, span.start, span.end,
                        span.sun, span.mon, span.tue, span.wed, span.thu, span.fri, span.sat,
                        span.hol1, span.hol2, span.hol3),
    });
    return body;
}

nlohmann::json buildTimeSpanUpdateBody(const TimeSpanUpdate& span) {
    nlohmann::json body;
    body["object"] = "time_spans";
    // time_zone_id is deliberately never included -- a span never
    // changes which zone it belongs to in this plan's scope.
    body["values"] = {
        {"start", span.start}, {"end", span.end},
        {"sun", boolToDeviceInt(span.sun)}, {"mon", boolToDeviceInt(span.mon)}, {"tue", boolToDeviceInt(span.tue)},
        {"wed", boolToDeviceInt(span.wed)}, {"thu", boolToDeviceInt(span.thu)}, {"fri", boolToDeviceInt(span.fri)},
        {"sat", boolToDeviceInt(span.sat)},
        {"hol1", boolToDeviceInt(span.hol1)}, {"hol2", boolToDeviceInt(span.hol2)}, {"hol3", boolToDeviceInt(span.hol3)},
    };
    body["where"] = {{"time_spans", {{"id", span.id}}}};
    return body;
}

nlohmann::json buildTimeSpanDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "time_spans";
    body["where"] = {{"time_spans", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildHolidaysListBody() {
    nlohmann::json body;
    body["object"] = "holidays";
    body["fields"] = kHolidayFields;
    return body;
}

namespace {
// end is a derived, not independently settable field -- the real
// device's own class.js beforeSave hook always computes it this way
// (spec.md Decision 1), and its own Add/Edit form has no End control.
int64_t deriveHolidayEnd(int64_t start) { return start + 86399; }
}  // namespace

nlohmann::json buildHolidayCreateBody(const std::string& name, int64_t start,
                                       bool hol1, bool hol2, bool hol3, bool repeats) {
    // Verbatim shape captured live 2026-09-15 -- same extended shape
    // as buildGroupCreateBody/buildTimeZoneCreateBody. hol1/hol2/hol3/
    // repeats are 0/1 integers (spec.md Decision 2), not JSON booleans.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "holidays";
    body["fields"] = kHolidayFields;
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"start"});
    body["values"] = nlohmann::json::array({{
        {"name", name}, {"start", start},
        {"hol1", boolToDeviceInt(hol1)}, {"hol2", boolToDeviceInt(hol2)}, {"hol3", boolToDeviceInt(hol3)},
        {"repeats", boolToDeviceInt(repeats)},
        {"end", deriveHolidayEnd(start)},
    }});
    return body;
}

nlohmann::json buildHolidayUpdateBody(int64_t id, const std::string& name, int64_t start,
                                       bool hol1, bool hol2, bool hol3, bool repeats) {
    nlohmann::json body;
    body["object"] = "holidays";
    body["values"] = {
        {"name", name}, {"start", start},
        {"hol1", boolToDeviceInt(hol1)}, {"hol2", boolToDeviceInt(hol2)}, {"hol3", boolToDeviceInt(hol3)},
        {"repeats", boolToDeviceInt(repeats)},
        {"end", deriveHolidayEnd(start)},
    };
    body["where"] = {{"holidays", {{"id", id}}}};
    return body;
}

nlohmann::json buildHolidayDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "holidays";
    body["where"] = {{"holidays", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildScheduledUnlocksListBody() {
    nlohmann::json body;
    body["object"] = "scheduled_unlocks";
    body["fields"] = kScheduledUnlockFields;
    return body;
}

nlohmann::json buildScheduledUnlockCreateBody(const std::string& name, const std::string& message) {
    // Verbatim shape captured live 2026-09-15 -- same extended shape
    // as every other object this session.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "scheduled_unlocks";
    body["fields"] = kScheduledUnlockFields;
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"name"});
    body["values"] = nlohmann::json::array({{{"name", name}, {"message", message}}});
    return body;
}

nlohmann::json buildScheduledUnlockUpdateBody(int64_t id, const std::string& name, const std::string& message) {
    nlohmann::json body;
    body["object"] = "scheduled_unlocks";
    body["values"] = {{"name", name}, {"message", message}};
    body["where"] = {{"scheduled_unlocks", {{"id", id}}}};
    return body;
}

nlohmann::json buildScheduledUnlockDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "scheduled_unlocks";
    body["where"] = {{"scheduled_unlocks", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildScheduledUnlockTimeZoneIdsBody(int64_t scheduledUnlockId) {
    // Verbatim shape captured live 2026-09-15 (fields trimmed to
    // id-only -- the live capture also requested "name", which this
    // SDK doesn't need here) -- the device resolves the
    // access_rules/access_rule_time_zones join server-side given a
    // cross-object where clause: where.object ("scheduled_unlocks")
    // differs from the query's own top-level object ("time_zones").
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "time_zones";
    body["fields"] = nlohmann::json::array({"id"});
    body["where"] = nlohmann::json::array({
        {{"object", "scheduled_unlocks"}, {"field", "id"}, {"value", scheduledUnlockId}, {"connector", ") AND ("}},
    });
    body["order"] = nlohmann::json::array({"name"});
    body["limit"] = 1000;
    body["offset"] = 0;
    return body;
}

nlohmann::json buildScheduledUnlockAccessRuleIdBody(int64_t scheduledUnlockId) {
    // NOT independently live-captured -- inferred by symmetry with
    // this session's established bare-object where shape (e.g.
    // buildTimeSpansListBody). Confirm/adjust during this plan's own
    // Group 7 (spec.md Decision 2, Risks).
    nlohmann::json body;
    body["object"] = "scheduled_unlock_access_rules";
    body["fields"] = nlohmann::json::array({"access_rule_id"});
    body["where"] = {{"scheduled_unlock_access_rules", {{"scheduled_unlock_id", scheduledUnlockId}}}};
    return body;
}

nlohmann::json buildScheduledUnlockAccessRuleCreateBody(int64_t scheduledUnlockId) {
    // Verbatim shape captured live 2026-09-15 -- auto-generated name
    // matches the device's own convention exactly.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "access_rules";
    body["fields"] = nlohmann::json::array({"id", "name", "type", "priority"});
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"name"});
    body["values"] = nlohmann::json::array({{
        {"name", "(access_rules automatically created for scheduled_unlocks " + std::to_string(scheduledUnlockId) + ")"},
        {"type", 1}, {"priority", 0},
    }});
    return body;
}

nlohmann::json buildScheduledUnlockAccessRuleLinkBody(int64_t scheduledUnlockId, int64_t accessRuleId) {
    // Verbatim shape captured live 2026-09-15.
    nlohmann::json body;
    body["object"] = "scheduled_unlock_access_rules";
    body["values"] = nlohmann::json::array({
        {{"scheduled_unlock_id", scheduledUnlockId}, {"access_rule_id", accessRuleId}},
    });
    return body;
}

nlohmann::json buildAccessRuleTimeZoneLinkBody(int64_t accessRuleId, int64_t timeZoneId) {
    // Verbatim shape captured live 2026-09-15.
    nlohmann::json body;
    body["object"] = "access_rule_time_zones";
    body["values"] = nlohmann::json::array({
        {{"access_rule_id", accessRuleId}, {"time_zone_id", timeZoneId}},
    });
    return body;
}

nlohmann::json buildAccessRuleTimeZoneUnlinkBody(int64_t accessRuleId, int64_t timeZoneId) {
    // Verbatim shape captured live 2026-09-15.
    nlohmann::json body;
    body["object"] = "access_rule_time_zones";
    body["where"] = nlohmann::json::array({
        {{"object", "access_rule_time_zones"}, {"field", "access_rule_id"}, {"value", accessRuleId}},
        {{"object", "access_rule_time_zones"}, {"field", "time_zone_id"}, {"value", nlohmann::json::array({timeZoneId})}},
    });
    return body;
}

nlohmann::json buildUserTypesListBody() {
    nlohmann::json body;
    body["object"] = "user_types";
    body["fields"] = kUserTypeFields;
    return body;
}

nlohmann::json buildCustomTablesListBody() {
    nlohmann::json body;
    body["object"] = "custom_tables";
    body["fields"] = kCustomTableFields;
    return body;
}

nlohmann::json buildUserTypeCustomTableIdBody(int64_t userTypeId) {
    // Verbatim shape captured live 2026-09-16.
    nlohmann::json body;
    body["object"] = "user_types";
    body["fields"] = nlohmann::json::array({"custom_table_id"});
    body["where"] = nlohmann::json::array({
        {{"object", "user_types"}, {"field", "id"}, {"value", nlohmann::json::array({userTypeId})}},
    });
    return body;
}

nlohmann::json buildUserTypeObjectAddBody(const std::string& tableName, const std::string& displayName) {
    // Verbatim shape captured live 2026-09-16 -- fixed 2-column shape,
    // matching the device's own only-ever-observed usage of this
    // endpoint (spec.md Decision 1).
    nlohmann::json body;
    body["object"] = tableName;
    body["name"] = displayName;
    body["fields"] = nlohmann::json::array({
        {{"column_name", "id"}, {"name", "id"}, {"type", "INTEGER"}, {"constraint", "PRIMARY_KEY"}},
        {{"column_name", "user_id"}, {"name", "user_id"}, {"type", "INTEGER"}, {"constraint", "FOREIGN_KEY"},
         {"foreign_key", {{"object", "users"}, {"field", "id"}}}},
    });
    return body;
}

nlohmann::json buildUserTypeCreateBody(int64_t customTableId, bool requireVisitor) {
    // Verbatim shape captured live 2026-09-16 -- bare create_objects
    // shape (no join/fields/where/order), same convention as
    // group_access_rules/scheduled_unlock_access_rules link rows.
    nlohmann::json body;
    body["object"] = "user_types";
    body["values"] = nlohmann::json::array({
        {{"custom_table_id", customTableId}, {"require_visitor", boolToDeviceInt(requireVisitor)}},
    });
    return body;
}

nlohmann::json buildCustomTableRenameBody(int64_t customTableId, const std::string& name) {
    // Verbatim shape captured live 2026-09-16 -- confirmed necessary
    // follow-up call after object_add.fcgi (spec.md Background).
    nlohmann::json body;
    body["object"] = "custom_tables";
    body["values"] = {{"name", name}};
    body["where"] = {{"custom_tables", {{"id", customTableId}}}};
    return body;
}

nlohmann::json buildUserTypeUpdateBody(int64_t userTypeId, bool requireVisitor) {
    // NOT independently live-captured -- inferred by symmetry with
    // every other object's own modify_objects.fcgi update shape this
    // session (spec.md Risks). Confirm/adjust during this plan's own
    // Group 8.
    nlohmann::json body;
    body["object"] = "user_types";
    body["values"] = {{"require_visitor", boolToDeviceInt(requireVisitor)}};
    body["where"] = {{"user_types", {{"id", userTypeId}}}};
    return body;
}

nlohmann::json buildUserTypeObjectRemoveBody(int64_t customTableId) {
    // Verbatim shape captured live 2026-09-16 -- no "object" field;
    // unlike destroy_objects.fcgi, object_remove.fcgi's target
    // (custom_tables) is implicit.
    nlohmann::json body;
    body["ids"] = nlohmann::json::array({customTableId});
    return body;
}

nlohmann::json buildCustomColumnsListBody() {
    // Verbatim filtered shape captured live 2026-09-16 -- excludes the
    // auto-created id/user_id/visit_id PK/FK columns that User Types'
    // own object_add.fcgi mechanism registers into this same catalog.
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "custom_columns";
    body["fields"] = kCustomColumnFields;
    body["where"] = nlohmann::json::array({
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "id"}, {"operator", "!="}, {"connector", "AND"}},
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "user_id"}, {"operator", "!="}, {"connector", ") AND ("}},
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "visit_id"}, {"operator", "!="}, {"connector", ") AND ("}},
    });
    body["order"] = nlohmann::json::array({"custom_table_id", "id"});
    return body;
}

nlohmann::json buildCustomFieldObjectAddBody(const std::string& physicalTableName,
                                              const std::string& columnName,
                                              const std::string& displayName,
                                              const std::string& deviceType,
                                              const std::string& constraint,
                                              const nlohmann::json& defaultValue) {
    // Verbatim shape captured live 2026-09-16, both the Text/non-
    // mandatory case ("TEXT"/"NONE"/"") and the Number/mandatory case
    // ("INTEGER"/"NOT_NULL"/0), confirmed during this plan's own
    // Group 8 (spec.md Background).
    nlohmann::json body;
    body["object"] = physicalTableName;
    body["column_name"] = columnName;
    body["name"] = displayName;
    body["type"] = deviceType;
    body["constraint"] = constraint;
    body["default_value"] = defaultValue;
    return body;
}

nlohmann::json buildCustomFieldUpdateBody(int64_t customColumnId, const std::string& name) {
    // NOT independently live-captured -- inferred by symmetry with
    // every other object's own modify_objects.fcgi update shape this
    // session (spec.md Risks). Confirm/adjust during this plan's own
    // Group 8.
    nlohmann::json body;
    body["object"] = "custom_columns";
    body["values"] = {{"name", name}};
    body["where"] = {{"custom_columns", {{"id", customColumnId}}}};
    return body;
}

nlohmann::json buildCustomFieldObjectRemoveBody(int64_t customColumnId) {
    // Verbatim shape captured live 2026-09-16 -- {"ids":[id]}, same
    // convention as buildUserTypeObjectRemoveBody.
    nlohmann::json body;
    body["ids"] = nlohmann::json::array({customColumnId});
    return body;
}

nlohmann::json buildUsersByIdsBody(const std::vector<int64_t>& ids) {
    nlohmann::json body;
    body["object"] = "users";
    body["fields"] = nlohmann::json::array({"id", "name", "registration"});
    body["where"] = {{"users", {{"id", ids}}}};
    return body;
}

nlohmann::json buildAccessLogAccessRulesBody(const std::vector<int64_t>& accessLogIds) {
    nlohmann::json body;
    body["object"] = "access_log_access_rules";
    body["fields"] = nlohmann::json::array({"access_log_id", "access_rule_id"});
    body["where"] = {{"access_log_access_rules", {{"access_log_id", accessLogIds}}}};
    return body;
}

nlohmann::json buildAccessRuleTimeZonesBody(const std::vector<int64_t>& accessRuleIds) {
    nlohmann::json body;
    body["object"] = "access_rule_time_zones";
    body["fields"] = nlohmann::json::array({"access_rule_id", "time_zone_id"});
    body["where"] = {{"access_rule_time_zones", {{"access_rule_id", accessRuleIds}}}};
    return body;
}

nlohmann::json buildUserCreateBody(const std::string& name, const std::string& registration,
                                    std::optional<int64_t> userTypeId) {
    // "values" is a one-element ARRAY here, not a bare object -- confirmed
    // live (2026-09-12, Task 5.2 attempt #1: a bare-object body was
    // rejected with HTTP 400). messenger.js's Messenger.save() calls
    // this.create([values]) -- only create_objects takes an array;
    // modify_objects (buildUserUpdateBody) takes a bare object, per the
    // same source file.
    nlohmann::json body;
    body["object"] = "users";
    nlohmann::json values = {{"name", name}, {"registration", registration}};
    if (userTypeId.has_value()) {
        values["user_type_id"] = *userTypeId;
    }
    body["values"] = nlohmann::json::array({values});
    return body;
}

nlohmann::json buildUserUpdateBody(int64_t id, const std::optional<std::string>& name,
                                  const std::optional<std::string>& registration,
                                  std::optional<int64_t> beginTime, std::optional<int64_t> endTime) {
    nlohmann::json body;
    body["object"] = "users";
    body["values"] = nlohmann::json::object();
    if (name.has_value()) {
        body["values"]["name"] = *name;
    }
    if (registration.has_value()) {
        body["values"]["registration"] = *registration;
    }
    if (beginTime.has_value()) {
        body["values"]["begin_time"] = *beginTime;
    }
    if (endTime.has_value()) {
        body["values"]["end_time"] = *endTime;
    }
    body["where"] = {{"users", {{"id", id}}}};
    return body;
}

nlohmann::json buildUserDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "users";
    body["where"] = {{"users", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildGroupAddBody(int64_t userId, int64_t groupId) {
    nlohmann::json body;
    body["object"] = "user_groups";
    body["values"] = nlohmann::json::array({{{"group_id", groupId}, {"user_id", userId}}});
    return body;
}

nlohmann::json buildGroupRemoveBody(int64_t userId, int64_t groupId) {
    nlohmann::json body;
    body["object"] = "user_groups";
    body["where"] = {{"user_groups", {{"group_id", nlohmann::json::array({groupId})}, {"user_id", userId}}}};
    return body;
}

nlohmann::json buildCardAddBody(int64_t userId, int64_t areaCode, int64_t cardNumber) {
    nlohmann::json body;
    body["object"] = "cards";
    body["values"] = nlohmann::json::array({{{"user_id", userId}, {"value", areaCode * 4294967296LL + cardNumber}}});
    return body;
}

nlohmann::json buildCardRemoveBody(int64_t cardId) {
    nlohmann::json body;
    body["object"] = "cards";
    body["where"] = {{"cards", {{"id", nlohmann::json::array({cardId})}}}};
    return body;
}

nlohmann::json buildAdministratorSetBody(int64_t userId, bool isAdmin) {
    nlohmann::json body;
    body["object"] = "user_roles";
    if (isAdmin) {
        body["values"] = nlohmann::json::array({{{"user_id", userId}, {"role", 1}}});
    } else {
        body["where"] = {{"user_roles", {{"user_id", userId}, {"role", 1}}}};
    }
    return body;
}

nlohmann::json buildPasswordSetBody(int64_t userId, const std::string& hashedPassword,
                                     const std::string& salt) {
    nlohmann::json body;
    body["object"] = "users";
    body["values"] = {{"password", hashedPassword}, {"salt", salt}};
    body["where"] = {{"users", {{"id", userId}}}};
    return body;
}

nlohmann::json buildUserHasPasswordBody(int64_t id) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "users";
    body["fields"] = nlohmann::json::array({"password"});
    body["where"] = nlohmann::json::array({
        {{"field", "id"}, {"value", id}},
    });
    body["limit"] = 1;
    body["offset"] = 0;
    return body;
}

nlohmann::json buildUserGroupIdsBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "user_groups";
    body["fields"] = nlohmann::json::array({"group_id"});
    body["where"] = {{"user_groups", {{"user_id", userId}}}};
    return body;
}

nlohmann::json buildUserIsAdminBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "user_roles";
    body["fields"] = nlohmann::json::array({"user_id"});
    body["where"] = {{"user_roles", {{"user_id", userId}}}};
    return body;
}

nlohmann::json buildCardCountBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "cards";
    body["fields"] = nlohmann::json::array({"COUNT(*)"});
    body["where"] = {{"users", {{"id", userId}}}};
    return body;
}

nlohmann::json buildFaceCountBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "face_templates";
    body["fields"] = nlohmann::json::array({"COUNT(*)"});
    body["where"] = {{"users", {{"id", userId}}}};
    return body;
}

nlohmann::json buildBioCountBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "templates";
    body["fields"] = nlohmann::json::array({"COUNT(*)"});
    body["where"] = {{"users", {{"id", userId}}}};
    return body;
}

nlohmann::json buildUserDestroyImageBody(int64_t userId) {
    nlohmann::json body;
    body["user_id"] = userId;
    return body;
}

nlohmann::json buildFaceTemplatesDeleteBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "face_templates";
    body["where"] = {{"face_templates", {{"user_id", userId}}}};
    return body;
}

nlohmann::json buildCUsersGetBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "c_users";
    body["fields"] = nlohmann::json::array({"id", "cpf"});
    body["where"] = nlohmann::json::array({
        {{"field", "user_id"}, {"value", userId}},
    });
    return body;
}

nlohmann::json buildCUsersCreateBody(int64_t userId, const std::string& cpf) {
    nlohmann::json body;
    body["object"] = "c_users";
    body["values"] = nlohmann::json::array({{{"user_id", userId}, {"cpf", cpf}}});
    return body;
}

nlohmann::json buildCUsersUpdateBody(int64_t cUsersRowId, const std::string& cpf) {
    nlohmann::json body;
    body["object"] = "c_users";
    body["values"] = {{"cpf", cpf}};
    body["where"] = {{"c_users", {{"id", cUsersRowId}}}};
    return body;
}

nlohmann::json buildCUsersDeleteBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "c_users";
    body["where"] = {{"c_users", {{"user_id", userId}}}};
    return body;
}

nlohmann::json buildVisitsListBody(int limit, int offset) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "visits";
    body["fields"] = kVisitFields;
    body["where"] = nlohmann::json::array({
        {{"field", "finished"}, {"operator", "!="}, {"value", 1}},
    });
    body["order"] = nlohmann::json::array({"id"});
    body["limit"] = limit;
    body["offset"] = offset;
    body["finish"] = true;
    return body;
}

nlohmann::json buildVisitGetBody(int64_t id) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "visits";
    body["fields"] = kVisitFields;
    body["where"] = nlohmann::json::array({
        {{"field", "id"}, {"value", id}},
    });
    body["order"] = nlohmann::json::array({"id"});
    body["limit"] = 1;
    body["offset"] = 0;
    return body;
}

nlohmann::json buildVisitCreateBody(int64_t visitorId, int64_t hostId,
                                     int64_t beginTime, int64_t endTime) {
    // Verbatim shape captured live 2026-09-14 (spec.md Background) --
    // unlike buildUserCreateBody, this real capture includes
    // join/fields/where/order alongside "values".
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "visits";
    body["fields"] = kVisitFields;
    body["where"] = nlohmann::json::array();
    body["order"] = nlohmann::json::array({"id"});
    body["values"] = nlohmann::json::array({{
        {"visitor_id", visitorId},
        {"host_id", hostId},
        {"begin_time", beginTime},
        {"end_time", endTime},
        {"finished", 0},
    }});
    return body;
}

nlohmann::json buildVisitUpdateBody(int64_t id, std::optional<int64_t> visitorId,
                                     std::optional<int64_t> hostId,
                                     std::optional<int64_t> beginTime,
                                     std::optional<int64_t> endTime) {
    nlohmann::json body;
    body["object"] = "visits";
    body["values"] = nlohmann::json::object();
    if (visitorId.has_value()) {
        body["values"]["visitor_id"] = *visitorId;
    }
    if (hostId.has_value()) {
        body["values"]["host_id"] = *hostId;
    }
    if (beginTime.has_value()) {
        body["values"]["begin_time"] = *beginTime;
    }
    if (endTime.has_value()) {
        body["values"]["end_time"] = *endTime;
    }
    body["where"] = {{"visits", {{"id", id}}}};
    return body;
}

nlohmann::json buildVisitDeleteBody(int64_t id) {
    nlohmann::json body;
    body["object"] = "visits";
    body["where"] = {{"visits", {{"id", nlohmann::json::array({id})}}}};
    return body;
}

nlohmann::json buildVisitFinishBody(int64_t id, int64_t endTime) {
    nlohmann::json body;
    body["object"] = "visits";
    body["values"] = {{"finished", 1}, {"end_time", endTime}};
    body["where"] = {{"visits", {{"id", id}}}};
    return body;
}

nlohmann::json buildUserCardsDeleteBody(int64_t userId) {
    nlohmann::json body;
    body["object"] = "cards";
    body["where"] = {{"cards", {{"user_id", userId}}}};
    return body;
}

}  // namespace amico::detail
