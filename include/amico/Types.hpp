#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

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
/// `password`, `salt`, `panic_password`, or `panic_salt` member.
/// `hasPassword` is the one exception to "never requested": the SDK
/// does request the `password` field internally (see
/// ObjectQuery::buildUserHasPasswordBody), but only to reduce it to
/// this boolean before it ever reaches a public type — per
/// docs/ui-action-protocol-map.md's "hasPassword derivation" finding,
/// the device only ever returns a masked sentinel or empty/null on this
/// field, never the real hash. There is no member, getter, or code path
/// anywhere in this SDK that can return the raw string.
struct AmicoUser {
    int64_t id = 0;
    std::string name;
    std::string registration;
    int userTypeId = 0;
    int64_t beginTime = 0;
    int64_t endTime = 0;
    int64_t lastAccess = 0;

    /// Ids of the groups this user belongs to (`user_groups`,
    /// JS_CONFIRMED — see docs/ui-action-protocol-map.md, Task 0.3).
    std::vector<int64_t> groupIds;
    /// `groupIds.size()` at the time `get()`/`list()` populated this
    /// object — a convenience mirror of the Users table's "Nº of
    /// Groups" column, not a separately-fetched value.
    int groupCount = 0;
    /// Number of cards (`cards` table) assigned to this user
    /// (JS_CONFIRMED — Task 0.4).
    int cardCount = 0;
    /// Whether this user currently holds the Administrator role
    /// (`user_roles`, JS_CONFIRMED — Task 0.5).
    bool isAdministrator = false;
    /// Number of face templates enrolled for this user (count only —
    /// this SDK never exposes raw biometric template data). Directly
    /// affected by `UsersApi::setImage()`/`removeImage()` — confirmed
    /// live 2026-09-13 that the "profile image" upload is coupled to
    /// face-recognition enrollment, not a separate cosmetic photo (see
    /// docs/ui-action-protocol-map.md's Image section).
    int faceCount = 0;
    /// Number of other biometric templates (e.g. fingerprint) enrolled
    /// for this user (count only, same rationale as `faceCount`).
    int bioCount = 0;
    /// Whether a door-entry password/PIN is set for this user
    /// (JS_CONFIRMED derivation — see the struct-level comment above).
    /// The actual value is never retrievable through this SDK; use
    /// `AmicoClient::UsersApi::setPassword()` to change it.
    bool hasPassword = false;
    /// URL path for this user's profile photo
    /// (`/user_get_image.fcgi?user_id=<id>`, LIVE_CONFIRMED) — a URL,
    /// not pre-fetched image bytes; empty if the user has no photo.
    std::string imageUrl;
};

/// Raw profile photo and its device-provided media type.
struct UserImage {
    std::vector<uint8_t> bytes;
    std::string contentType;
};

/// Creation parameters for the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member — those
/// fields are never accepted for writes by this SDK, so the type simply
/// cannot represent them. `userTypeId`, `beginTime`, and `endTime` are
/// absent because no confirmed Web UI write payload includes them.
/// There is no `id` member; the device assigns it when creating the user.
struct NewUser {
    std::string name;
    std::string registration;
};

/// Update parameters for the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member — those
/// fields are never accepted for writes by this SDK, so the type simply
/// cannot represent them. `userTypeId`, `beginTime`, and `endTime` are
/// absent because no confirmed Web UI write payload includes them.
/// Callers set only the fields they want to change.
struct UserUpdate {
    int64_t id = 0;
    std::optional<std::string> name;
    std::optional<std::string> registration;
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
