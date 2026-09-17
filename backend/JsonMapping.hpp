#pragma once

// Struct <-> nlohmann::json conversion for the backend's JSON routes.
// Field names match the C++ struct member names exactly -- no
// renaming/reformatting beyond what AmicoUser/AccessLogEntry/
// SystemInformation already represent. hasPassword is always a JSON
// boolean; there is no field anywhere here for a raw password/salt
// value, matching amico_sdk's own hard boundary.

#include <nlohmann/json.hpp>

#include "amico/Types.hpp"

namespace amico::backend {

nlohmann::json toJson(const amico::Group& group);
nlohmann::json toJson(const amico::TimeZone& timeZone);
nlohmann::json toJson(const amico::TimeSpan& span);
nlohmann::json toJson(const amico::AmicoUser& user);
nlohmann::json toJson(const amico::AccessLogEntry& entry);
nlohmann::json toJson(const amico::AccessLogEntry& entry,
                      const std::string& userName, const std::string& employeeId,
                      const std::string& portalName, const std::string& timeZoneName);
nlohmann::json toJson(const amico::SystemInformation& info);
nlohmann::json toJson(const amico::DateTimeSettings& settings);
nlohmann::json toJson(const amico::LicenseInfo& info);
nlohmann::json toJson(const amico::InternalAlarmSettings& settings);
nlohmann::json toJson(const amico::RelayAction& action);
nlohmann::json toJson(const amico::Visit& visit);
nlohmann::json toJson(const amico::Holiday& holiday);
nlohmann::json toJson(const amico::ScheduledUnlock& unlock);
nlohmann::json toJson(const amico::UserType& userType);
nlohmann::json toJson(const amico::CustomField& field);
nlohmann::json toJson(const amico::ReportDefinition& report);
nlohmann::json toJson(const amico::ReportFilter& filter);

/// Throws nlohmann::json::exception (missing/wrong-typed required
/// field) or std::invalid_argument/std::out_of_range (numeric parsing)
/// on malformed input -- callers (Routes) must catch these and map to
/// 400, never letting them reach ErrorMapping's AmicoError table.
amico::InternalAlarmSettings fromJsonInternalAlarmSettings(const nlohmann::json& body);
amico::NewUser fromJsonNewUser(const nlohmann::json& body);
amico::UserUpdate fromJsonUserUpdate(int64_t id, const nlohmann::json& body);
amico::NewVisit fromJsonNewVisit(const nlohmann::json& body);
/// Never parses a "finished" key -- that field has no generic-update
/// path (use POST /visits/:id/finish instead); a caller-supplied
/// "finished" key is silently ignored, matching VisitUpdate having no
/// such member to populate at all
/// (.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md
/// Decision 4).
amico::VisitUpdate fromJsonVisitUpdate(int64_t id, const nlohmann::json& body);
amico::NewGroup fromJsonNewGroup(const nlohmann::json& body);
amico::GroupUpdate fromJsonGroupUpdate(int64_t id, const nlohmann::json& body);
amico::NewTimeZone fromJsonNewTimeZone(const nlohmann::json& body);
amico::TimeZoneUpdate fromJsonTimeZoneUpdate(int64_t id, const nlohmann::json& body);
amico::NewTimeSpan fromJsonNewTimeSpan(int64_t timeZoneId, const nlohmann::json& body);
amico::TimeSpanUpdate fromJsonTimeSpanUpdate(int64_t id, const nlohmann::json& body);
/// Never parses an "end" key -- amico::NewHoliday/HolidayUpdate have
/// no such member (SDK always computes it as start + 86399,
/// .plans/2026-09-15-holidays-write-side/spec.md Decision 1); a
/// caller-supplied "end" key is silently ignored.
amico::NewHoliday fromJsonNewHoliday(const nlohmann::json& body);
amico::HolidayUpdate fromJsonHolidayUpdate(int64_t id, const nlohmann::json& body);
/// Never parses a "timeZoneIds" key -- amico::NewScheduledUnlock/
/// ScheduledUnlockUpdate have no such member (linking is only ever
/// done via POST/DELETE /scheduled-unlocks/:id/timezones/:timeZoneId,
/// .plans/2026-09-15-scheduled-unlock-write-side/spec.md Decision 1);
/// a caller-supplied "timeZoneIds" key is silently ignored.
amico::NewScheduledUnlock fromJsonNewScheduledUnlock(const nlohmann::json& body);
amico::ScheduledUnlockUpdate fromJsonScheduledUnlockUpdate(int64_t id, const nlohmann::json& body);
/// Never parses a "customTableId" key -- amico::NewUserType/
/// UserTypeUpdate have no such member (the dynamic table is always
/// internally created/looked up, .plans/2026-09-16-user-types-write-side/
/// spec.md Decision 1/4); a caller-supplied "customTableId" key is
/// silently ignored.
amico::NewUserType fromJsonNewUserType(const nlohmann::json& body);
amico::UserTypeUpdate fromJsonUserTypeUpdate(int64_t id, const nlohmann::json& body);
/// Never parses "table"/"type"/"mandatory" -- amico::CustomFieldUpdate
/// has no such members (LIVE_CONFIRMED immutable after creation,
/// .plans/2026-09-16-custom-fields-write-side/spec.md Decision 2);
/// caller-supplied keys of those names are silently ignored.
amico::NewCustomField fromJsonNewCustomField(const nlohmann::json& body);
amico::CustomFieldUpdate fromJsonCustomFieldUpdate(int64_t id, const nlohmann::json& body);

}  // namespace amico::backend
