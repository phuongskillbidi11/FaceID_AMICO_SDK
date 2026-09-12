#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace amico {

/// POST /system_information.fcgi — confirmed schema (Phase 1, LIVE_CONFIRMED).
/// Only the fields this SDK's callers need are surfaced; the raw response
/// has more (uptime, memory, biometrics limits, auth802_1x) that callers
/// can get to later if a real need shows up — not invented here.
struct NetworkInfo {
    std::string mac;
    std::string ip;
    std::string netmask;
    std::string gateway;
    bool sslEnabled = false;
    bool selfSignedCertificate = false;
    bool dhcpEnabled = false;
};

struct SystemInformation {
    std::string serial;
    std::string firmwareVersion;  // "version", e.g. "2.4.5"
    std::string secboxVersion;    // "secbox_version" (EAM), e.g. "2.2.3"
    std::string deviceName;
    std::string deviceId;
    bool online = false;
    NetworkInfo network;
};

/// Public user-facing view of the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member — those
/// fields are never requested from the device by this SDK in the first
/// place (see ObjectQuery's fields-always-explicit rule), so there is no
/// value to drop here; the type simply cannot represent them.
struct AmicoUser {
    int64_t id = 0;
    std::string name;
    std::string registration;
    int userTypeId = 0;
    int64_t beginTime = 0;
    int64_t endTime = 0;
    int64_t lastAccess = 0;
};

/// List query for `AmicoClient::UsersApi::list()`. Intentionally has no
/// search/sort field — the real Web UI has no user-triggered sort control
/// on this page (confirmed in the P1 discovery pass), and adding search
/// now would be scope beyond the original request.
struct UserQuery {
    int limit = 0;   // 0 -> AmicoConfig::defaultPageSize
    int offset = 0;
};

/// Public view of the `access_logs` object.
struct AccessLogEntry {
    int64_t id = 0;
    int64_t time = 0;
    std::optional<int64_t> userId;
    std::optional<int64_t> portalId;
    int64_t logTypeId = 0;
    int64_t event = 0;
};

/// `to` becomes a server-side `where` clause (`time <= to`); `from` is
/// applied as a client-side filter on the page the server returns — see
/// the design decision in docs/amico-protocol-map.md about why a second
/// server-side clause was not used (no confirmed evidence for chaining
/// two `where` clauses against this object).
struct AccessLogQuery {
    std::optional<int64_t> from;
    std::optional<int64_t> to;
    int limit = 0;  // 0 -> AmicoConfig::defaultPageSize
};

}  // namespace amico
