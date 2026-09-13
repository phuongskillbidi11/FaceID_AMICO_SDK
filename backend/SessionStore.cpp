#include "SessionStore.hpp"

#include <random>
#include <utility>

namespace amico::backend {

SessionStore::SessionStore(ClientFactory factory) : factory_(std::move(factory)) {}

void SessionStore::login(const std::string& deviceUrl, const std::string& username,
                         const std::string& password) {
    amico::AmicoConfig config;
    config.baseUrl = deviceUrl;
    config.username = username;
    config.password = password;
    config.autoRelogin = true;
    auto candidate = factory_ ? factory_(std::move(config)) : amico::AmicoClient(std::move(config));

    // Prepare allocations/randomness before authenticating or touching the old session.
    std::string nextUrl = deviceUrl;
    std::string token;
    token.reserve(32);
    std::random_device random;
    std::uniform_int_distribution<unsigned int> byte(0, 255);
    constexpr char hex[] = "0123456789abcdef";
    for (int i = 0; i < 16; ++i) {
        const auto value = byte(random);
        token.push_back(hex[value >> 4]);
        token.push_back(hex[value & 15]);
    }
    candidate.login();  // Failure leaves every part of the old session untouched.
    if (activeClient_) {
        // SDK logout clears its local session even if the old device is offline.
        // A cleanup failure must not discard the newly authenticated session.
        try { activeClient_->logout(); } catch (...) {}
    }
    activeClient_.emplace(std::move(candidate));
    activeSessionToken_.swap(token);
    activeDeviceUrl_.swap(nextUrl);
}

void SessionStore::logout() {
    // Revoke locally regardless of whether remote logout can be delivered.
    auto previous = std::move(activeClient_);
    activeClient_.reset();
    activeSessionToken_.clear();
    activeDeviceUrl_.clear();
    if (previous) previous->logout();
}

bool SessionStore::checkSessionCookie(const std::string& cookieHeader) const {
    if (!isLoggedIn()) return false;
    bool found = false;
    bool matches = false;
    std::size_t start = 0;
    while (start < cookieHeader.size()) {
        const auto end = cookieHeader.find(';', start);
        auto part = cookieHeader.substr(start, end == std::string::npos ? end : end - start);
        const auto first = part.find_first_not_of(" \t");
        if (first != std::string::npos) {
            part = part.substr(first, part.find_last_not_of(" \t") - first + 1);
            const auto equal = part.find('=');
            if (equal != std::string::npos && part.substr(0, equal) == "amico_session") {
                if (found) return false;  // Ambiguous duplicate session cookies are rejected.
                found = true;
                matches = part.substr(equal + 1) == activeSessionToken_;
            }
        }
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return found && matches;
}

}  // namespace amico::backend
