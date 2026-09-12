#include "ObjectQuery.hpp"

namespace amico::detail {

const std::vector<std::string> kUserFields = {
    "id", "name", "registration", "user_type_id", "begin_time", "end_time", "last_access",
};

const std::vector<std::string> kAccessLogFields = {
    "id", "time", "user_id", "portal_id", "log_type_id", "event",
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

}  // namespace amico::detail
