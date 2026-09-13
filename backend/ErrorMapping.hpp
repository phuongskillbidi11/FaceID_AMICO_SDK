#pragma once

// Exception -> HTTP status + JSON body mapping (spec.md Decision 6).
// Only ever receives exceptions thrown by an AmicoClient call that
// already happened -- request-body parsing errors are a SEPARATE,
// earlier stage handled directly in Routes (see Routes.hpp's own
// comment), never routed through here.

#include <exception>
#include <utility>

#include <nlohmann/json.hpp>

namespace amico::backend {

/// Returns {httpStatus, jsonBody}. jsonBody is always
/// {"error": "<message>", "type": "<ExceptionClassName>"}.
std::pair<int, nlohmann::json> mapException(const std::exception& e);

}  // namespace amico::backend
