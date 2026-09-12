#include "JsonRedact.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <string>

namespace amico {

namespace {

constexpr std::array<const char*, 8> kSensitiveSubstrings = {
    "password", "hash", "salt", "session", "token", "cookie", "authorization", "api_key",
};

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                    [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

bool isSensitiveKey(const std::string& key) {
    const std::string lower = toLower(key);
    return std::any_of(kSensitiveSubstrings.begin(), kSensitiveSubstrings.end(),
                        [&](const char* needle) { return lower.find(needle) != std::string::npos; });
}

}  // namespace

nlohmann::json redactJson(const nlohmann::json& input) {
    if (input.is_object()) {
        nlohmann::json out = nlohmann::json::object();
        for (auto it = input.begin(); it != input.end(); ++it) {
            if (isSensitiveKey(it.key())) {
                out[it.key()] = "***REDACTED***";
            } else {
                out[it.key()] = redactJson(it.value());
            }
        }
        return out;
    }
    if (input.is_array()) {
        nlohmann::json out = nlohmann::json::array();
        for (const auto& element : input) {
            out.push_back(redactJson(element));
        }
        return out;
    }
    return input;
}

}  // namespace amico
