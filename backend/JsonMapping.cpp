#include "JsonMapping.hpp"
#include "../src/AccessLogLabels.hpp"

namespace amico::backend {

nlohmann::json toJson(const amico::Group& group) {
    return {{"id", group.id}, {"name", group.name}, {"timeZoneIds", group.timeZoneIds}};
}

nlohmann::json toJson(const amico::TimeZone& timeZone) {
    return {{"id", timeZone.id}, {"name", timeZone.name}};
}

nlohmann::json toJson(const amico::TimeSpan& span) {
    return {
        {"id", span.id}, {"timeZoneId", span.timeZoneId},
        {"start", span.start}, {"end", span.end},
        {"sun", span.sun}, {"mon", span.mon}, {"tue", span.tue}, {"wed", span.wed},
        {"thu", span.thu}, {"fri", span.fri}, {"sat", span.sat},
        {"hol1", span.hol1}, {"hol2", span.hol2}, {"hol3", span.hol3},
    };
}

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
    j["cpf"] = user.cpf.has_value() ? nlohmann::json(*user.cpf) : nlohmann::json(nullptr);
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
    j["identifierId"] = entry.identifierId;
    return j;
}

nlohmann::json toJson(const amico::AccessLogEntry& entry,
                      const std::string& userName, const std::string& employeeId,
                      const std::string& portalName, const std::string& timeZoneName) {
    nlohmann::json j = toJson(entry);
    j["userName"] = userName;
    j["employeeId"] = employeeId;
    j["portalName"] = portalName;
    j["timeZoneName"] = timeZoneName;
    j["authorizationLabel"] = amico::detail::authorizationLabel(entry.event);
    j["identificationLabel"] = amico::detail::identificationLabel(entry.identifierId);
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

nlohmann::json toJson(const amico::DateTimeSettings& settings) {
    return {
        {"time", settings.time}, {"daylightSavingActive", settings.daylightSavingActive},
        {"ntpEnabled", settings.ntpEnabled}, {"timezone", settings.timezone},
        {"clock12HourFormat", settings.clock12HourFormat}, {"monthDayYearFormat", settings.monthDayYearFormat},
        {"ntpServer1", settings.ntpServer1}, {"ntpServer2", settings.ntpServer2},
    };
}

nlohmann::json toJson(const amico::LicenseInfo& info) {
    return {
        {"maxUsers", info.maxUsers}, {"device", info.device},
        {"type", info.type}, {"catraRoleEnabled", info.catraRoleEnabled},
    };
}

nlohmann::json toJson(const amico::InternalAlarmSettings& settings) {
    return {
        {"doorSensorEnabled", settings.doorSensorEnabled},
        {"doorSensorDelay", settings.doorSensorDelay},
        {"doorSensorAlarmTimeoutAfterClosure", settings.doorSensorAlarmTimeoutAfterClosure},
        {"forcedAccessEnabled", settings.forcedAccessEnabled},
        {"forcedAccessDebounce", settings.forcedAccessDebounce},
        {"deviceViolationEnabled", settings.deviceViolationEnabled},
        {"panicFingerEnabled", settings.panicFingerEnabled},
        {"panicCardEnabled", settings.panicCardEnabled},
        {"panicFingerDelay", settings.panicFingerDelay},
    };
}

amico::InternalAlarmSettings fromJsonInternalAlarmSettings(const nlohmann::json& body) {
    amico::InternalAlarmSettings settings;
    settings.doorSensorEnabled = body.at("doorSensorEnabled").get<bool>();
    settings.doorSensorDelay = body.at("doorSensorDelay").get<int64_t>();
    settings.doorSensorAlarmTimeoutAfterClosure =
        body.at("doorSensorAlarmTimeoutAfterClosure").get<int64_t>();
    settings.forcedAccessEnabled = body.at("forcedAccessEnabled").get<bool>();
    settings.forcedAccessDebounce = body.at("forcedAccessDebounce").get<int64_t>();
    settings.deviceViolationEnabled = body.at("deviceViolationEnabled").get<bool>();
    settings.panicFingerEnabled = body.at("panicFingerEnabled").get<bool>();
    settings.panicCardEnabled = body.at("panicCardEnabled").get<bool>();
    settings.panicFingerDelay = body.at("panicFingerDelay").get<int64_t>();
    return settings;
}

amico::AlarmOutputSettings fromJsonAlarmOutputSettings(const nlohmann::json& body) {
    amico::AlarmOutputSettings settings;
    settings.buzzerEnabled = body.at("buzzerEnabled").get<bool>();
    settings.maxActivationTimeEnabled = body.at("maxActivationTimeEnabled").get<bool>();
    settings.maxActivationTimeSeconds = body.at("maxActivationTimeSeconds").get<int64_t>();
    return settings;
}

nlohmann::json toJson(const amico::RelayAction& action) {
    return {
        {"id", action.id},
        {"kind", action.kind == amico::RelayActionKind::Door ? "door" : "secBox"},
        {"label", action.label},
        {"relayNumber", action.relayNumber},
        {"secBoxId", action.secBoxId},
    };
}

nlohmann::json toJson(const amico::AlarmOutputSettings& s) {
    return {
        {"buzzerEnabled", s.buzzerEnabled},
        {"maxActivationTimeEnabled", s.maxActivationTimeEnabled},
        {"maxActivationTimeSeconds", s.maxActivationTimeSeconds},
    };
}

nlohmann::json toJson(const amico::Holiday& holiday) {
    return {
        {"id", holiday.id}, {"name", holiday.name}, {"start", holiday.start},
        {"hol1", holiday.hol1}, {"hol2", holiday.hol2}, {"hol3", holiday.hol3},
        {"repeats", holiday.repeats}, {"end", holiday.end},
    };
}

nlohmann::json toJson(const amico::ScheduledUnlock& unlock) {
    return {
        {"id", unlock.id}, {"name", unlock.name}, {"message", unlock.message},
        {"timeZoneIds", unlock.timeZoneIds},
    };
}

nlohmann::json toJson(const amico::UserType& userType) {
    return {
        {"id", userType.id}, {"customTableId", userType.customTableId},
        {"name", userType.name}, {"requireVisitor", userType.requireVisitor},
    };
}

nlohmann::json toJson(const amico::CustomField& field) {
    return {
        {"id", field.id}, {"customTableId", field.customTableId},
        {"table", field.table}, {"name", field.name},
    };
}

nlohmann::json toJson(const amico::ReportDefinition& report) {
    return {
        {"id", report.id}, {"name", report.name}, {"object", report.object},
        {"header", report.header}, {"delimiter", report.delimiter}, {"lineBreak", report.lineBreak},
    };
}

nlohmann::json toJson(const amico::ReportFilter& filter) {
    return {
        {"id", filter.id}, {"reportId", filter.reportId},
        {"object", filter.object}, {"field", filter.field}, {"value", filter.value},
        {"visible", filter.visible}, {"editable", filter.editable},
    };
}

nlohmann::json toJson(const amico::Visit& visit) {
    nlohmann::json j;
    j["id"] = visit.id;
    j["visitorId"] = visit.visitorId;
    j["hostId"] = visit.hostId;
    j["visitorName"] = visit.visitorName;
    j["hostName"] = visit.hostName;
    j["beginTime"] = visit.beginTime;
    j["endTime"] = visit.endTime;
    j["finished"] = visit.finished;
    j["cardCount"] = visit.cardCount;
    return j;
}

amico::NewUser fromJsonNewUser(const nlohmann::json& body) {
    amico::NewUser user;
    user.name = body.at("name").get<std::string>();
    user.registration = body.at("registration").get<std::string>();
    if (body.contains("cpf") && !body["cpf"].is_null()) {
        user.cpf = body.at("cpf").get<std::string>();
    }
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
    if (body.contains("cpf") && !body["cpf"].is_null()) {
        update.cpf = body.at("cpf").get<std::string>();
    }
    if (body.contains("beginTime") && !body["beginTime"].is_null()) {
        update.beginTime = body.at("beginTime").get<int64_t>();
    }
    if (body.contains("endTime") && !body["endTime"].is_null()) {
        update.endTime = body.at("endTime").get<int64_t>();
    }
    return update;
}

amico::NewVisit fromJsonNewVisit(const nlohmann::json& body) {
    amico::NewVisit visit;
    visit.visitorId = body.at("visitorId").get<int64_t>();
    visit.hostId = body.at("hostId").get<int64_t>();
    visit.beginTime = body.at("beginTime").get<int64_t>();
    if (body.contains("endTime") && !body["endTime"].is_null()) {
        visit.endTime = body.at("endTime").get<int64_t>();
    }
    return visit;
}

amico::VisitUpdate fromJsonVisitUpdate(int64_t id, const nlohmann::json& body) {
    amico::VisitUpdate update;
    update.id = id;
    if (body.contains("visitorId") && !body["visitorId"].is_null()) {
        update.visitorId = body.at("visitorId").get<int64_t>();
    }
    if (body.contains("hostId") && !body["hostId"].is_null()) {
        update.hostId = body.at("hostId").get<int64_t>();
    }
    if (body.contains("beginTime") && !body["beginTime"].is_null()) {
        update.beginTime = body.at("beginTime").get<int64_t>();
    }
    if (body.contains("endTime") && !body["endTime"].is_null()) {
        update.endTime = body.at("endTime").get<int64_t>();
    }
    return update;
}

amico::NewGroup fromJsonNewGroup(const nlohmann::json& body) {
    amico::NewGroup group;
    group.name = body.at("name").get<std::string>();
    return group;
}

amico::GroupUpdate fromJsonGroupUpdate(int64_t id, const nlohmann::json& body) {
    amico::GroupUpdate update;
    update.id = id;
    update.name = body.at("name").get<std::string>();
    return update;
}

amico::NewTimeZone fromJsonNewTimeZone(const nlohmann::json& body) {
    amico::NewTimeZone zone;
    zone.name = body.at("name").get<std::string>();
    return zone;
}

amico::TimeZoneUpdate fromJsonTimeZoneUpdate(int64_t id, const nlohmann::json& body) {
    amico::TimeZoneUpdate update;
    update.id = id;
    update.name = body.at("name").get<std::string>();
    return update;
}

namespace {
// This object has no meaningful partial update -- the frontend always
// sends the full current+edited set of 12 fields, same reasoning as
// Groups' `name`.
template <typename T>
void readTimeSpanFields(T& span, const nlohmann::json& body) {
    span.start = body.at("start").get<int64_t>();
    span.end = body.at("end").get<int64_t>();
    span.sun = body.at("sun").get<bool>();
    span.mon = body.at("mon").get<bool>();
    span.tue = body.at("tue").get<bool>();
    span.wed = body.at("wed").get<bool>();
    span.thu = body.at("thu").get<bool>();
    span.fri = body.at("fri").get<bool>();
    span.sat = body.at("sat").get<bool>();
    span.hol1 = body.at("hol1").get<bool>();
    span.hol2 = body.at("hol2").get<bool>();
    span.hol3 = body.at("hol3").get<bool>();
}
}  // namespace

amico::NewTimeSpan fromJsonNewTimeSpan(int64_t timeZoneId, const nlohmann::json& body) {
    amico::NewTimeSpan span;
    span.timeZoneId = timeZoneId;
    readTimeSpanFields(span, body);
    return span;
}

amico::TimeSpanUpdate fromJsonTimeSpanUpdate(int64_t id, const nlohmann::json& body) {
    amico::TimeSpanUpdate update;
    update.id = id;
    readTimeSpanFields(update, body);
    return update;
}

namespace {
// "end" is deliberately never read here -- NewHoliday/HolidayUpdate
// have no such member (spec.md Decision 1).
template <typename T>
void readHolidayFields(T& holiday, const nlohmann::json& body) {
    holiday.name = body.at("name").get<std::string>();
    holiday.start = body.at("start").get<int64_t>();
    holiday.hol1 = body.at("hol1").get<bool>();
    holiday.hol2 = body.at("hol2").get<bool>();
    holiday.hol3 = body.at("hol3").get<bool>();
    holiday.repeats = body.at("repeats").get<bool>();
}
}  // namespace

amico::NewHoliday fromJsonNewHoliday(const nlohmann::json& body) {
    amico::NewHoliday holiday;
    readHolidayFields(holiday, body);
    return holiday;
}

amico::HolidayUpdate fromJsonHolidayUpdate(int64_t id, const nlohmann::json& body) {
    amico::HolidayUpdate update;
    update.id = id;
    readHolidayFields(update, body);
    return update;
}

namespace {
// "timeZoneIds" is deliberately never read here -- linking is only
// ever done via the dedicated addTimeZone/removeTimeZone routes
// (spec.md Decision 1).
template <typename T>
void readScheduledUnlockFields(T& unlock, const nlohmann::json& body) {
    unlock.name = body.at("name").get<std::string>();
    unlock.message = body.at("message").get<std::string>();
}
}  // namespace

amico::NewScheduledUnlock fromJsonNewScheduledUnlock(const nlohmann::json& body) {
    amico::NewScheduledUnlock unlock;
    readScheduledUnlockFields(unlock, body);
    return unlock;
}

amico::ScheduledUnlockUpdate fromJsonScheduledUnlockUpdate(int64_t id, const nlohmann::json& body) {
    amico::ScheduledUnlockUpdate update;
    update.id = id;
    readScheduledUnlockFields(update, body);
    return update;
}

namespace {
// "customTableId" is deliberately never read here -- the dynamic
// table is always internally created/looked up (spec.md Decision 1/4).
template <typename T>
void readUserTypeFields(T& userType, const nlohmann::json& body) {
    userType.name = body.at("name").get<std::string>();
    userType.requireVisitor = body.at("requireVisitor").get<bool>();
}
}  // namespace

amico::NewUserType fromJsonNewUserType(const nlohmann::json& body) {
    amico::NewUserType userType;
    readUserTypeFields(userType, body);
    return userType;
}

amico::UserTypeUpdate fromJsonUserTypeUpdate(int64_t id, const nlohmann::json& body) {
    amico::UserTypeUpdate update;
    update.id = id;
    readUserTypeFields(update, body);
    return update;
}

amico::NewCustomField fromJsonNewCustomField(const nlohmann::json& body) {
    amico::NewCustomField field;
    field.table = body.at("table").get<std::string>();
    field.type = body.at("type").get<std::string>();
    field.name = body.at("name").get<std::string>();
    field.mandatory = body.at("mandatory").get<bool>();
    return field;
}

amico::CustomFieldUpdate fromJsonCustomFieldUpdate(int64_t id, const nlohmann::json& body) {
    amico::CustomFieldUpdate update;
    update.id = id;
    update.name = body.at("name").get<std::string>();
    return update;
}

}  // namespace amico::backend
