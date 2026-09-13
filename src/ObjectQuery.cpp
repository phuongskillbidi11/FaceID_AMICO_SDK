#include "ObjectQuery.hpp"

namespace amico::detail {

const std::vector<std::string> kUserFields = {
    "id", "name", "registration", "user_type_id", "begin_time", "end_time", "last_access",
};

const std::vector<std::string> kAccessLogFields = {
    "id", "time", "user_id", "portal_id", "log_type_id", "event",
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

nlohmann::json buildUsersListBody(int limit, int offset) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "users";
    body["fields"] = kUserFields;
    body["where"] = nlohmann::json::array({
        {{"field", "user_type_id"}, {"operator", "="}, {"value", 0}, {"connector", "OR"}},
        {{"field", "user_type_id"}, {"operator", "IS NULL"}, {"connector", ") AND ("}},
    });
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

nlohmann::json buildAccessLogsListBody(std::optional<int64_t> to, int limit, int offset) {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "access_logs";
    body["fields"] = kAccessLogFields;
    if (to.has_value()) {
        body["where"] = nlohmann::json::array({
            {{"field", "time"}, {"operator", "<="}, {"value", *to}},
        });
    } else {
        body["where"] = nlohmann::json::array();
    }
    body["order"] = nlohmann::json::array({"time", "descending"});
    body["limit"] = limit;
    body["offset"] = offset;
    body["finish"] = true;
    return body;
}

nlohmann::json buildUserCreateBody(const std::string& name, const std::string& registration) {
    // "values" is a one-element ARRAY here, not a bare object -- confirmed
    // live (2026-09-12, Task 5.2 attempt #1: a bare-object body was
    // rejected with HTTP 400). messenger.js's Messenger.save() calls
    // this.create([values]) -- only create_objects takes an array;
    // modify_objects (buildUserUpdateBody) takes a bare object, per the
    // same source file.
    nlohmann::json body;
    body["object"] = "users";
    body["values"] = nlohmann::json::array({{{"name", name}, {"registration", registration}}});
    return body;
}

nlohmann::json buildUserUpdateBody(int64_t id, const std::optional<std::string>& name,
                                  const std::optional<std::string>& registration) {
    nlohmann::json body;
    body["object"] = "users";
    body["values"] = nlohmann::json::object();
    if (name.has_value()) {
        body["values"]["name"] = *name;
    }
    if (registration.has_value()) {
        body["values"]["registration"] = *registration;
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

}  // namespace amico::detail
