#pragma once

#include <string>

namespace amico {

/// In-memory-only holder for the two cookies every authenticated request
/// needs (see docs/amico-auth-flow.md — LIVE_CONFIRMED both are required
/// together). Never serialized to disk. `clear()` overwrites the backing
/// memory before releasing it; the destructor calls `clear()` but never
/// makes a network call (logout is a separate, explicit, caller-driven
/// operation on AmicoClient).
class Session {
public:
    Session() = default;
    ~Session() { clear(); }

    Session(const Session&) = delete;
    Session& operator=(const Session&) = delete;
    Session(Session&&) = default;
    Session& operator=(Session&&) = default;

    void set(std::string login, std::string sessionToken);
    bool isSet() const noexcept { return !login_.empty() && !token_.empty(); }

    /// "login=<u>; session=<t>" — value never logged; callers must not
    /// print this string.
    std::string cookieHeader() const;

    void clear() noexcept;

private:
    std::string login_;
    std::string token_;
};

}  // namespace amico
