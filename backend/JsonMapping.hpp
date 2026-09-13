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

nlohmann::json toJson(const amico::AmicoUser& user);
nlohmann::json toJson(const amico::AccessLogEntry& entry);
nlohmann::json toJson(const amico::SystemInformation& info);

/// Throws nlohmann::json::exception (missing/wrong-typed required
/// field) or std::invalid_argument/std::out_of_range (numeric parsing)
/// on malformed input -- callers (Routes) must catch these and map to
/// 400, never letting them reach ErrorMapping's AmicoError table.
amico::NewUser fromJsonNewUser(const nlohmann::json& body);
amico::UserUpdate fromJsonUserUpdate(int64_t id, const nlohmann::json& body);

}  // namespace amico::backend
