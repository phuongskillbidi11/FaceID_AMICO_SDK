#pragma once

#include <string>

namespace amico {

/// Validates `AmicoConfig::baseUrl`. Throws `ConfigurationError` (declared
/// in amico/Errors.hpp; included by callers, not here, to keep this
/// header's dependency footprint small) via the returned message — see
/// UrlValidation.cpp for the exact rules:
///   - scheme must be "http" or "https"
///   - no embedded credentials ("user:pass@host")
///   - no query string, no fragment
///   - a bare host (optionally with port and a path) is fine; LAN IPs are
///     fully supported
/// Returns the normalized base URL (trailing slash stripped) on success,
/// or an empty optional-like signal via the `error` out-parameter.
struct UrlValidationResult {
    bool ok = false;
    std::string normalizedUrl;
    std::string error;
};

UrlValidationResult validateBaseUrl(const std::string& url);

}  // namespace amico
