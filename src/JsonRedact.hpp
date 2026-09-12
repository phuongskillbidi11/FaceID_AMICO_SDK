#pragma once

#include <nlohmann/json.hpp>

namespace amico {

/// Recursively redacts any JSON object key whose name contains (case-
/// insensitive substring match) one of: password, hash, salt, session,
/// token, cookie, authorization, api_key. Recurses through nested objects
/// and arrays. Note this substring rule already covers `panic_password`/
/// `panic_salt` (contain "password"/"salt") without needing dedicated
/// patterns — see test/test_redaction.cpp for the proof.
///
/// This is a diagnostics/logging safety net, not the primary defense —
/// the primary defense is that ObjectQuery's builders never request these
/// fields from the device in the first place (see src/ObjectQuery.hpp).
nlohmann::json redactJson(const nlohmann::json& input);

}  // namespace amico
