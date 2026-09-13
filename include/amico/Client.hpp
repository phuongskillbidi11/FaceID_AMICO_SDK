#pragma once

#include <cstdint>
#include <memory>
#include <optional>
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

    private:
        friend class AmicoClient;
        explicit AccessLogsApi(AmicoClient* owner) : owner_(owner) {}
        AmicoClient* owner_;
    };

    UsersApi& users() { return usersApi_; }
    AccessLogsApi& accessLogs() { return accessLogsApi_; }

    /// Development/discovery use only -- returns the raw ~73KB object
    /// schema from POST /object_metadata.fcgi. Not part of the normal
    /// application workflow; no typed wrapper is provided on purpose.
    std::string debugGetObjectMetadataJson();

private:
    friend class UsersApi;
    friend class AccessLogsApi;

    /// Test-only seam: swaps the internal transport for a fake one so
    /// offline tests never touch a real socket. Declared here (not in a
    /// separate public header) but only usable from code that also
    /// includes the internal, non-installed src/http/HttpTransport.hpp --
    /// ordinary consumers of this public header cannot construct an
    /// IHttpTransport to pass in.
    friend void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport);

    std::vector<AmicoUser> listUsersImpl(const UserQuery& query);
    std::optional<AmicoUser> getUserImpl(int64_t id);
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

    struct Impl;
    std::unique_ptr<Impl> impl_;

    UsersApi usersApi_;
    AccessLogsApi accessLogsApi_;
};

/// See AmicoClient's friend declaration above. Defined in src/Client.cpp;
/// only linkable/meaningful from a translation unit that also has a
/// concrete IHttpTransport (i.e. test code under test/, which includes
/// src/http/HttpTransport.hpp directly).
void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport);

}  // namespace amico
