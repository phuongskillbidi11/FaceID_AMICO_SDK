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

nlohmann::json buildTimeZonesListBody() {
    nlohmann::json body;
    body["object"] = "time_zones";
    body["fields"] = nlohmann::json::array({"id", "name"});
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
