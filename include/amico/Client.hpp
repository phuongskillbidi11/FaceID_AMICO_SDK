#pragma once

#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "amico/Config.hpp"
#include "amico/Types.hpp"

namespace amico {

class IHttpTransport;  // defined in src/http/HttpTransport.hpp (internal, not installed)

/// Client for the HID AMICO VL70LF Web UI HTTP protocol, with read
/// operations and write support for Users create/update/remove plus
/// group membership, cards, the Administrator flag, profile image, and
/// door-entry password/PIN (set-only -- never read back). See
/// docs/amico-protocol-map.md / docs/amico-endpoints.md /
/// docs/ui-action-protocol-map.md for the captured evidence this class
/// implements against.
///
/// Usage:
///   AmicoConfig config;
///   config.baseUrl = std::getenv("AMICO_BASE_URL");
///   config.username = std::getenv("AMICO_USERNAME");
///   config.password = std::getenv("AMICO_PASSWORD");
///   AmicoClient client(config);
///   client.login();
///   auto users = client.users().list();
///   client.logout();
class AmicoClient {
public:
    explicit AmicoClient(AmicoConfig config);
    ~AmicoClient();

    AmicoClient(const AmicoClient&) = delete;
    AmicoClient& operator=(const AmicoClient&) = delete;
    AmicoClient(AmicoClient&&) noexcept;
    AmicoClient& operator=(AmicoClient&&) noexcept;

    /// POST /hidlogin.fcgi. Throws AuthenticationError on bad credentials
    /// (HTTP 401) or ConfigurationError/NetworkError/TimeoutError for
    /// lower-level failures. On success, the session is held in memory
    /// only -- never persisted to disk, never logged.
    void login();

    /// GET /session_is_valid.fcgi.
    bool isSessionValid();

    /// Non-authenticating GET /. Any HTTP response means reachable;
    /// transport errors propagate unchanged. Never sends credentials.
    void checkReachable() const;

    /// POST /system_information.fcgi.
    SystemInformation getSystemInformation();

    /// GET /logout.fcgi. Clears the in-memory session regardless of the
    /// server's response.
    void logout();

    /// Typed read/write wrapper for the `users` object.
    /// Never requests, accepts, or exposes password/salt/
    /// panic_password/panic_salt.
    class UsersApi {
    public:
        std::vector<AmicoUser> list(const UserQuery& query = {});
        std::optional<AmicoUser> get(int64_t id);

        /// Batch name/registration lookup for a set of user ids --
        /// deliberately lighter than list()/get() (no groupIds/
        /// cardCount/faceCount/etc. enrichment, which would be N+1
        /// queries per id for data the access-logs join doesn't need).
        /// An id absent from the device is simply absent from the
        /// returned map. Value is {name, registration}.
        std::map<int64_t, std::pair<std::string, std::string>> getNamesByIds(const std::vector<int64_t>& ids);

        /// POST /create_objects.fcgi. Returns the device-assigned user id.
        int64_t create(const NewUser& user);

        /// POST /modify_objects.fcgi. Throws ProtocolError if no user changed.
        void update(const UserUpdate& user);

        /// POST /destroy_objects.fcgi. Throws ProtocolError if no user removed.
        void remove(int64_t id);

        /// POST /create_objects.fcgi against `user_groups`.
        void addToGroup(int64_t userId, int64_t groupId);
        /// POST /destroy_objects.fcgi against `user_groups`.
        void removeFromGroup(int64_t userId, int64_t groupId);

        /// POST /create_objects.fcgi against `cards`. `value` is packed
        /// from areaCode/cardNumber (see docs/ui-action-protocol-map.md).
        /// Returns the device-assigned card id.
        int64_t addCard(int64_t userId, int64_t areaCode, int64_t cardNumber);
        /// POST /destroy_objects.fcgi against `cards`.
        void removeCard(int64_t cardId);

        /// Grants or revokes the Administrator role. A no-op if the user
        /// is already in the requested state (matches the real UI's own
        /// asymmetric save() behavior -- see docs/ui-action-protocol-map.md).
        void setAdministrator(int64_t userId, bool isAdmin);

        /// GET /user_get_image.fcgi?user_id=<id>. Returns raw image bytes
        /// and the device Content-Type (image/jpeg only if absent).
        /// Throws HttpError(404) when no image exists, HttpError for other
        /// non-2xx statuses except 401 (InvalidSessionError, with optional
        /// single autoRelogin retry). Requires an active session.
        UserImage getImage(int64_t userId);

        /// POST /user_set_image.fcgi?user_id=<id>&match=1&timestamp=<epoch>,
        /// raw application/octet-stream body (LIVE_CONFIRMED wire format,
        /// including the match/timestamp params -- 2026-09-13). `bytes`
        /// MUST be JPEG-encoded -- the device rejects other formats (e.g.
        /// PNG) with HTTP 400. This SDK does not convert image formats
        /// itself; the caller provides JPEG bytes (see
        /// docs/ui-action-protocol-map.md's Image encoding requirement).
        /// **Important:** this endpoint enrolls/updates the device's
        /// face-recognition template for this user -- it is NOT a purely
        /// cosmetic photo store. Throws ProtocolError if the device's
        /// face-detection/quality validation rejects the image (face not
        /// detected, not centered, too distant/close, low sharpness,
        /// multiple faces, etc.) -- the exception message includes the
        /// device's own error details.
        void setImage(int64_t userId, const std::vector<uint8_t>& bytes);
        /// POST /user_destroy_image.fcgi, then destroys this user's
        /// face_templates rows too (LIVE_CONFIRMED 2026-09-13 -- matches
        /// the real UI's own paired behavior; see setImage()'s note on
        /// why these are coupled).
        void removeImage(int64_t userId);

        /// Sets a door-entry password/PIN. Hashes via the device's own
        /// `user_hash_password` command first (mirroring the real UI),
        /// then writes only the resulting hash+salt -- this SDK never
        /// reads a password/salt value back through any API. Always
        /// confirm with the user before each live call to this method
        /// (see feedback_write_api_risk_tiers.md).
        void setPassword(int64_t userId, const std::string& plaintextPassword);

    private:
        friend class AmicoClient;
        explicit UsersApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    /// Typed wrapper over the internal load_objects.fcgi query engine for
    /// the `access_logs` object.
    class AccessLogsApi {
    public:
        std::vector<AccessLogEntry> list(const AccessLogQuery& query = {});
        int64_t accessLogsCount(const AccessLogQuery& query = {});

        /// Resolves each given access_log id's time-zone name via the
        /// real 2-hop join (`access_logs` has no direct `time_zone_id`
        /// -- LIVE-CAPTURED schema, spec.md Decision 2b). An id is
        /// absent from the returned map if it has no matching
        /// `access_log_access_rules` row, or that row's access_rule has
        /// no matching `access_rule_time_zones` row (not present with
        /// an empty string -- the caller decides how to render "no
        /// time zone"). If more than one row exists at either hop
        /// (both junction tables are logically many-to-many), the
        /// first row returned by the device is used -- a deterministic,
        /// documented tie-break, not an arbitrary pick.
        std::map<int64_t, std::string> timeZoneNamesForAccessLogIds(const std::vector<int64_t>& accessLogIds);

    private:
        friend class AmicoClient;
        explicit AccessLogsApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    /// Typed wrapper over the internal load_objects.fcgi query engine for
    /// the `portals` object.
    class PortalsApi {
    public:
        std::vector<Portal> list();

    private:
        friend class AmicoClient;
        explicit PortalsApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    /// Typed read/write wrapper for the `groups` object.
    class GroupsApi {
    public:
        std::vector<Group> list();

        /// POST /create_objects.fcgi. Returns the device-assigned group id.
        int64_t create(const NewGroup& group);
        /// POST /modify_objects.fcgi. Throws ProtocolError if no group changed.
        void update(const GroupUpdate& group);
        /// POST /destroy_objects.fcgi. Throws ProtocolError if no group
        /// removed. This SDK does not special-case any group id
        /// (including the real UI's own protected id-1 default group) --
        /// see .plans/2026-09-15-groups-write-side/spec.md Decision 2; if
        /// the device itself rejects the write, that surfaces as a normal
        /// ProtocolError like any other rejected write.
        void remove(int64_t id);

    private:
        friend class AmicoClient;
        explicit GroupsApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    /// Typed wrapper over the internal load_objects.fcgi query engine for
    /// the `time_zones` object.
    class TimeZonesApi {
    public:
        std::vector<TimeZone> list();

    private:
        friend class AmicoClient;
        explicit TimeZonesApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    /// Typed read/write wrapper for the `visits` object (Visits plan,
    /// 2026-09-14). A visit's Cards are the visitor's own `cards` rows --
    /// use UsersApi::addCard()/removeCard() with the visit's visitorId,
    /// not a method on this class
    /// (.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md
    /// Decision 3).
    class VisitsApi {
    public:
        std::vector<Visit> list(const VisitQuery& query = {});
        std::optional<Visit> get(int64_t id);

        /// POST /create_objects.fcgi. Returns the device-assigned visit id.
        int64_t create(const NewVisit& visit);

        /// POST /modify_objects.fcgi. Throws ProtocolError if no visit changed.
        void update(const VisitUpdate& visit);

        /// POST /destroy_objects.fcgi. Throws ProtocolError if no visit
        /// removed. Does NOT revoke the visitor's cards (spec.md Risks).
        void remove(int64_t id);

        /// Marks a visit concluded: revokes every card currently issued to
        /// its visitor, then sets finished=1/end_time=now on the visit
        /// itself (spec.md Decision 4 -- mirrors the real device's own
        /// two-step save() side effect). Throws ProtocolError if the
        /// visit doesn't exist -- this codebase has no dedicated
        /// "not found" exception type; every other not-found case here
        /// (e.g. a 404 on image reads) already uses either HttpError or
        /// ProtocolError depending on the underlying HTTP shape, and a
        /// missing visit surfaces via a `visits: []` load_objects
        /// response, matching ProtocolError's existing usage for
        /// unexpected/empty response shapes.
        void finish(int64_t id);

    private:
        friend class AmicoClient;
        explicit VisitsApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    UsersApi& users() { return usersApi_; }
    AccessLogsApi& accessLogs() { return accessLogsApi_; }
    PortalsApi& portals() { return portalsApi_; }
    GroupsApi& groups() { return groupsApi_; }
    TimeZonesApi& timeZones() { return timeZonesApi_; }
    VisitsApi& visits() { return visitsApi_; }

    /// Development/discovery use only -- returns the raw ~73KB object
    /// schema from POST /object_metadata.fcgi. Not part of the normal
    /// application workflow; no typed wrapper is provided on purpose.
    std::string debugGetObjectMetadataJson();

private:
    friend class UsersApi;
    friend class AccessLogsApi;
    friend class PortalsApi;
    friend class GroupsApi;
    friend class TimeZonesApi;
    friend class VisitsApi;

    /// Test-only seam: swaps the internal transport for a fake one so
    /// offline tests never touch a real socket. Declared here (not in a
    /// separate public header) but only usable from code that also
    /// includes the internal, non-installed src/http/HttpTransport.hpp --
    /// ordinary consumers of this public header cannot construct an
    /// IHttpTransport to pass in.
    friend void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport);

    std::vector<AmicoUser> listUsersImpl(const UserQuery& query);
    std::optional<AmicoUser> getUserImpl(int64_t id);
    std::map<int64_t, std::pair<std::string, std::string>> getUserNamesByIdsImpl(const std::vector<int64_t>& ids);
    int64_t createUserImpl(const NewUser& user);
    void updateUserImpl(const UserUpdate& user);
    void removeUserImpl(int64_t id);
    void addUserToGroupImpl(int64_t userId, int64_t groupId);
    void removeUserFromGroupImpl(int64_t userId, int64_t groupId);
    int64_t addUserCardImpl(int64_t userId, int64_t areaCode, int64_t cardNumber);
    void removeUserCardImpl(int64_t cardId);
    void setUserAdministratorImpl(int64_t userId, bool isAdmin);
    UserImage getUserImageImpl(int64_t userId);
    void setUserImageImpl(int64_t userId, const std::vector<uint8_t>& bytes);
    void removeUserImageImpl(int64_t userId);
    void setUserPasswordImpl(int64_t userId, const std::string& plaintextPassword);
    std::vector<AccessLogEntry> listAccessLogsImpl(const AccessLogQuery& query);
    int64_t accessLogsCountImpl(const AccessLogQuery& query);
    std::vector<Portal> listPortalsImpl();
    std::vector<Group> listGroupsImpl();
    int64_t createGroupImpl(const NewGroup& group);
    void updateGroupImpl(const GroupUpdate& group);
    void removeGroupImpl(int64_t id);
    std::vector<TimeZone> listTimeZonesImpl();
    std::map<int64_t, std::string> timeZoneNamesForAccessLogIdsImpl(const std::vector<int64_t>& accessLogIds);
    std::vector<Visit> listVisitsImpl(const VisitQuery& query);
    std::optional<Visit> getVisitImpl(int64_t id);
    int64_t createVisitImpl(const NewVisit& visit);
    void updateVisitImpl(const VisitUpdate& visit);
    void removeVisitImpl(int64_t id);
    void finishVisitImpl(int64_t id);

    struct Impl;
    std::unique_ptr<Impl> impl_;

    UsersApi usersApi_;
    AccessLogsApi accessLogsApi_;
    PortalsApi portalsApi_{this};
    GroupsApi groupsApi_{this};
    TimeZonesApi timeZonesApi_{this};
    VisitsApi visitsApi_{this};
};

/// See AmicoClient's friend declaration above. Defined in src/Client.cpp;
/// only linkable/meaningful from a translation unit that also has a
/// concrete IHttpTransport (i.e. test code under test/, which includes
/// src/http/HttpTransport.hpp directly).
void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport);

}  // namespace amico
