#include "JsonMapping.hpp"

namespace amico::backend {

nlohmann::json toJson(const amico::AmicoUser& user) {
    nlohmann::json j;
    j["id"] = user.id;
    j["name"] = user.name;
    j["registration"] = user.registration;
    j["userTypeId"] = user.userTypeId;
    j["beginTime"] = user.beginTime;
    j["endTime"] = user.endTime;
    j["lastAccess"] = user.lastAccess;
    j["groupIds"] = user.groupIds;
    j["groupCount"] = user.groupCount;
    j["cardCount"] = user.cardCount;
    j["isAdministrator"] = user.isAdministrator;
    j["faceCount"] = user.faceCount;
    j["bioCount"] = user.bioCount;
    j["hasPassword"] = user.hasPassword;
    j["imageUrl"] = "/users/" + std::to_string(user.id) + "/image";
    return j;
}

nlohmann::json toJson(const amico::AccessLogEntry& entry) {
    nlohmann::json j;
    j["id"] = entry.id;
    j["time"] = entry.time;
    j["userId"] = entry.userId.has_value() ? nlohmann::json(*entry.userId) : nlohmann::json(nullptr);
    j["portalId"] = entry.portalId.has_value() ? nlohmann::json(*entry.portalId) : nlohmann::json(nullptr);
    j["logTypeId"] = entry.logTypeId;
    j["event"] = entry.event;
    return j;
}

nlohmann::json toJson(const amico::SystemInformation& info) {
    nlohmann::json j;
    j["serial"] = info.serial;
    j["firmwareVersion"] = info.firmwareVersion;
    j["secboxVersion"] = info.secboxVersion;
    j["deviceName"] = info.deviceName;
    j["deviceId"] = info.deviceId;
    j["online"] = info.online;
    j["network"] = {
        {"mac", info.network.mac},
        {"ip", info.network.ip},
        {"netmask", info.network.netmask},
        {"gateway", info.network.gateway},
        {"sslEnabled", info.network.sslEnabled},
        {"selfSignedCertificate", info.network.selfSignedCertificate},
        {"dhcpEnabled", info.network.dhcpEnabled},
    };
    return j;
}

amico::NewUser fromJsonNewUser(const nlohmann::json& body) {
    amico::NewUser user;
    user.name = body.at("name").get<std::string>();
    user.registration = body.at("registration").get<std::string>();
    return user;
}

amico::UserUpdate fromJsonUserUpdate(int64_t id, const nlohmann::json& body) {
    amico::UserUpdate update;
    update.id = id;
    if (body.contains("name") && !body["name"].is_null()) {
        update.name = body.at("name").get<std::string>();
    }
    if (body.contains("registration") && !body["registration"].is_null()) {
        update.registration = body.at("registration").get<std::string>();
    }
    return update;
}

}  // namespace amico::backend
