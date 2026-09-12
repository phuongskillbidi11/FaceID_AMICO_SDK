#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "amico/Config.hpp"
#include "amico/Types.hpp"

namespace amico {

class IHttpTransport;  // defined in src/http/HttpTransport.hpp (internal, not installed)

/// Read-only client for the HID AMICO VL70LF Web UI HTTP protocol.
/// See docs/amico-protocol-map.md / docs/amico-endpoints.md for the
/// captured evidence this class implements against.
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

    /// Typed wrapper over the internal load_objects.fcgi query engine for
    /// the `users` object. Never requests or exposes password/salt/
    /// panic_password/panic_salt.
    class UsersApi {
    public:
        std::vector<AmicoUser> list(const UserQuery& query = {});
        std::optional<AmicoUser> get(int64_t id);

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
