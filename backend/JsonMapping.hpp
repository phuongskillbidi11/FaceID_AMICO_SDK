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
nlohmann::json toJson(const amico::Visit& visit);

/// Throws nlohmann::json::exception (missing/wrong-typed required
/// field) or std::invalid_argument/std::out_of_range (numeric parsing)
/// on malformed input -- callers (Routes) must catch these and map to
/// 400, never letting them reach ErrorMapping's AmicoError table.
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

}  // namespace amico::backend
