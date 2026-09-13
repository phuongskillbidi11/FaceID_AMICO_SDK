#pragma once

#include <functional>
#include <mutex>
#include <optional>
#include <string>

#include "amico/Client.hpp"

namespace amico::backend {

// All access requires holding acquire() for the whole transaction, including
// cookie validation and use of client(). The returned pointer must not escape
// that lock. One mutex protects the client, token, and URL together.
class SessionStore {
public:
    using ClientFactory = std::function<amico::AmicoClient(amico::AmicoConfig)>;
    explicit SessionStore(ClientFactory factory = {});
    std::unique_lock<std::mutex> acquire() const { return std::unique_lock<std::mutex>(mutex_); }
    void login(const std::string& deviceUrl, const std::string& username, const std::string& password);
    void logout();
    bool checkSessionCookie(const std::string& cookieHeader) const;
    amico::AmicoClient* client() { return activeClient_ ? &*activeClient_ : nullptr; }
    bool isLoggedIn() const { return activeClient_.has_value() && !activeSessionToken_.empty(); }
    std::string deviceUrl() const { return activeDeviceUrl_; }
    std::string sessionToken() const { return activeSessionToken_; }

private:
    mutable std::mutex mutex_;
    ClientFactory factory_;
    std::optional<amico::AmicoClient> activeClient_;
    std::string activeSessionToken_;
    std::string activeDeviceUrl_;
};

}  // namespace amico::backend
