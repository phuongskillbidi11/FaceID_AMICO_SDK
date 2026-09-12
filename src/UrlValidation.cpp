#include "UrlValidation.hpp"

#include <algorithm>
#include <cctype>

namespace amico {

namespace {
bool startsWithCaseInsensitive(const std::string& s, const std::string& prefix) {
    if (s.size() < prefix.size()) return false;
    return std::equal(prefix.begin(), prefix.end(), s.begin(),
                       [](char a, char b) { return std::tolower(static_cast<unsigned char>(a)) == std::tolower(static_cast<unsigned char>(b)); });
}
}  // namespace

UrlValidationResult validateBaseUrl(const std::string& url) {
    UrlValidationResult result;

    if (url.find('?') != std::string::npos) {
        result.error = "base URL must not contain a query string";
        return result;
    }
    if (url.find('#') != std::string::npos) {
        result.error = "base URL must not contain a fragment";
        return result;
    }

    std::string scheme;
    std::string rest;
    if (startsWithCaseInsensitive(url, "http://")) {
        scheme = "http://";
        rest = url.substr(scheme.size());
    } else if (startsWithCaseInsensitive(url, "https://")) {
        scheme = "https://";
        rest = url.substr(scheme.size());
    } else {
        result.error = "base URL scheme must be http or https";
        return result;
    }

    if (rest.empty()) {
        result.error = "base URL is missing a host";
        return result;
    }

    // Authority is everything up to the first '/' (if any).
    const auto slashPos = rest.find('/');
    const std::string authority = (slashPos == std::string::npos) ? rest : rest.substr(0, slashPos);
    const std::string path = (slashPos == std::string::npos) ? std::string() : rest.substr(slashPos);

    if (authority.find('@') != std::string::npos) {
        result.error = "base URL must not contain embedded credentials";
        return result;
    }
    if (authority.empty()) {
        result.error = "base URL is missing a host";
        return result;
    }

    std::string normalized = scheme + authority + path;
    while (normalized.size() > scheme.size() + authority.size() && normalized.back() == '/') {
        normalized.pop_back();
    }

    result.ok = true;
    result.normalizedUrl = normalized;
    return result;
}

}  // namespace amico
