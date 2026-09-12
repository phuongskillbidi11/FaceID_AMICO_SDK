#include "amico/Client.hpp"

#include <algorithm>
#include <cctype>
#include <sstream>

#include <nlohmann/json.hpp>

#include "ObjectQuery.hpp"
#include "Session.hpp"
#include "UrlValidation.hpp"
#include "amico/Errors.hpp"
#include "http/CurlTransport.hpp"
#include "http/HttpTransport.hpp"

namespace amico {

namespace {

std::string percentEncode(const std::string& value) {
    static const char* hex = "0123456789ABCDEF";
    std::string out;
    out.reserve(value.size());
    for (unsigned char c : value) {
        if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back('%');
            out.push_back(hex[(c >> 4) & 0xF]);
            out.push_back(hex[c & 0xF]);
        }
    }
    return out;
}

std::string buildLoginFormBody(const std::string& login, const std::string& password) {
    return "login=" + percentEncode(login) + "&password=" + percentEncode(password);
}

nlohmann::json parseJsonOrThrow(const std::string& body, const std::string& path) {
    try {
        return nlohmann::json::parse(body);
    } catch (const nlohmann::json::exception&) {
        throw JsonParseError("failed to parse JSON response from " + path);
    }
}

template <typename T>
T requireField(const nlohmann::json& j, const char* key, const std::string& path) {
    auto it = j.find(key);
    if (it == j.end() || it->is_null()) {
        throw ProtocolError(std::string("missing required field '") + key + "' in response from " + path);
    }
    try {
        return it->get<T>();
    } catch (const nlohmann::json::exception&) {
        throw ProtocolError(std::string("field '") + key + "' had an unexpected type in response from " + path);
    }
}

}  // namespace

struct AmicoClient::Impl {
    AmicoConfig config;
    std::unique_ptr<IHttpTransport> transport;
    Session session;

    explicit Impl(AmicoConfig cfg) : config(std::move(cfg)) {
        UrlValidationResult validated = validateBaseUrl(config.baseUrl);
        if (!validated.ok) {
            throw ConfigurationError("invalid AmicoConfig.baseUrl: " + validated.error);
        }
        if (config.maxPageSize <= 0) {
            throw ConfigurationError("AmicoConfig.maxPageSize must be positive");
        }
        transport = std::make_unique<CurlTransport>(validated.normalizedUrl);
    }

    void log(LogLevel level, const std::string& message) const {
        if (config.logSink) config.logSink(level, message);
    }

    HttpRequest baseRequest(const std::string& method, const std::string& path) const {
        HttpRequest req;
        req.method = method;
        req.path = path;
        req.connectTimeout = config.connectTimeout;
        req.requestTimeout = config.requestTimeout;
        req.maxResponseBytes = config.maxResponseBytes;
        req.maxHeaderBytes = config.maxHeaderBytes;
        return req;
    }

    /// Sends an authenticated JSON POST. Throws InvalidSessionError before
    /// sending if there is no session. On HTTP 401, attempts exactly one
    /// re-login + retry if `config.autoRelogin` is enabled; otherwise maps
    /// to InvalidSessionError. Never retries more than once.
    nlohmann::json postAuthenticatedJson(const std::string& path, const nlohmann::json& body, bool isRetry = false) {
        if (!session.isSet()) {
            throw InvalidSessionError("no active session for " + path + " -- call login() first");
        }
        HttpRequest req = baseRequest("POST", path);
        req.headers.push_back({"Content-Type", "application/json"});
        req.headers.push_back({"Cookie", session.cookieHeader()});
        // A null json value means "send a truly empty body" (matches the
        // confirmed Content-Length: 0 requests like system_information.fcgi),
        // as opposed to the literal 4-byte text "null".
        req.body = body.is_null() ? std::string() : body.dump();

        HttpResponse res = transport->send(req);

        if (res.statusCode == 401) {
            if (!isRetry && config.autoRelogin) {
                log(LogLevel::Warning, "session rejected (401); attempting one re-login per autoRelogin config");
                session.clear();
                login();
                return postAuthenticatedJson(path, body, /*isRetry=*/true);
            }
            throw InvalidSessionError("session rejected by device (HTTP 401) for " + path);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw HttpError(res.statusCode, "unexpected HTTP status " + std::to_string(res.statusCode) + " from " + path);
        }
        return parseJsonOrThrow(res.body, path);
    }

    void login() {
        HttpRequest req = baseRequest("POST", "/hidlogin.fcgi");
        req.headers.push_back({"Content-Type", "application/x-www-form-urlencoded"});
        req.headers.push_back({"Cookie", "login=" + config.username});
        req.body = buildLoginFormBody(config.username, config.password);

        HttpResponse res = transport->send(req);

        if (res.statusCode == 401) {
            throw AuthenticationError("login failed: invalid username or password");
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw HttpError(res.statusCode, "unexpected HTTP status " + std::to_string(res.statusCode) + " from /hidlogin.fcgi");
        }

        nlohmann::json body = parseJsonOrThrow(res.body, "/hidlogin.fcgi");
        std::string token = requireField<std::string>(body, "session", "/hidlogin.fcgi");
        session.set(config.username, token);
    }

    void checkReachable() const {
        transport->send(baseRequest("GET", "/"));
    }

    bool isSessionValid() {
        HttpRequest req = baseRequest("GET", "/session_is_valid.fcgi");
        if (session.isSet()) {
            req.headers.push_back({"Cookie", session.cookieHeader()});
        }
        HttpResponse res = transport->send(req);
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw HttpError(res.statusCode, "unexpected HTTP status " + std::to_string(res.statusCode) + " from /session_is_valid.fcgi");
        }
        nlohmann::json body = parseJsonOrThrow(res.body, "/session_is_valid.fcgi");
        return requireField<bool>(body, "session_is_valid", "/session_is_valid.fcgi");
    }

    SystemInformation getSystemInformation() {
        nlohmann::json body = postAuthenticatedJson("/system_information.fcgi", nullptr);
        SystemInformation info;
        info.serial = requireField<std::string>(body, "serial", "/system_information.fcgi");
        info.firmwareVersion = requireField<std::string>(body, "version", "/system_information.fcgi");
        info.secboxVersion = requireField<std::string>(body, "secbox_version", "/system_information.fcgi");
        info.deviceName = requireField<std::string>(body, "device_name", "/system_information.fcgi");
        info.deviceId = requireField<std::string>(body, "device_id", "/system_information.fcgi");
        info.online = requireField<bool>(body, "online", "/system_information.fcgi");

        auto netIt = body.find("network");
        if (netIt == body.end() || !netIt->is_object()) {
            throw ProtocolError("missing required field 'network' in response from /system_information.fcgi");
        }
        const nlohmann::json& net = *netIt;
        info.network.mac = requireField<std::string>(net, "mac", "/system_information.fcgi");
        info.network.ip = requireField<std::string>(net, "ip", "/system_information.fcgi");
        info.network.netmask = requireField<std::string>(net, "netmask", "/system_information.fcgi");
        info.network.gateway = requireField<std::string>(net, "gateway", "/system_information.fcgi");
        info.network.sslEnabled = requireField<bool>(net, "ssl_enabled", "/system_information.fcgi");
        info.network.selfSignedCertificate = requireField<bool>(net, "self_signed_certificate", "/system_information.fcgi");
        info.network.dhcpEnabled = requireField<bool>(net, "dhcp_enabled", "/system_information.fcgi");
        return info;
    }

    void logout() {
        try {
            HttpRequest req = baseRequest("GET", "/logout.fcgi");
            if (session.isSet()) {
                req.headers.push_back({"Cookie", session.cookieHeader()});
            }
            transport->send(req);
        } catch (...) {
            session.clear();
            throw;
        }
        session.clear();
    }

    int resolveLimit(int requested) const {
        int limit = requested > 0 ? requested : config.defaultPageSize;
        return std::min(limit, config.maxPageSize);
    }

    std::vector<AmicoUser> listUsers(const UserQuery& query) {
        const int limit = resolveLimit(query.limit);
        nlohmann::json body = detail::buildUsersListBody(limit, query.offset);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);

        auto usersIt = response.find("users");
        if (usersIt == response.end() || !usersIt->is_array()) {
            throw ProtocolError("missing required field 'users' in response from /load_objects.fcgi");
        }

        std::vector<AmicoUser> result;
        result.reserve(usersIt->size());
        for (const auto& row : *usersIt) {
            result.push_back(mapUser(row));
        }
        return result;
    }

    std::optional<AmicoUser> getUser(int64_t id) {
        nlohmann::json body = detail::buildUserGetBody(id);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);

        auto usersIt = response.find("users");
        if (usersIt == response.end() || !usersIt->is_array()) {
            throw ProtocolError("missing required field 'users' in response from /load_objects.fcgi");
        }
        if (usersIt->empty()) {
            return std::nullopt;
        }
        return mapUser(usersIt->front());
    }

    static AmicoUser mapUser(const nlohmann::json& row) {
        AmicoUser user;
        user.id = requireField<int64_t>(row, "id", "/load_objects.fcgi (users)");
        user.name = requireField<std::string>(row, "name", "/load_objects.fcgi (users)");
        user.registration = requireField<std::string>(row, "registration", "/load_objects.fcgi (users)");
        user.userTypeId = requireField<int>(row, "user_type_id", "/load_objects.fcgi (users)");
        user.beginTime = requireField<int64_t>(row, "begin_time", "/load_objects.fcgi (users)");
        user.endTime = requireField<int64_t>(row, "end_time", "/load_objects.fcgi (users)");
        user.lastAccess = requireField<int64_t>(row, "last_access", "/load_objects.fcgi (users)");
        return user;
    }

    std::vector<AccessLogEntry> listAccessLogs(const AccessLogQuery& query) {
        const int limit = resolveLimit(query.limit);
        nlohmann::json body = detail::buildAccessLogsListBody(query.to, limit, 0);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);

        auto logsIt = response.find("access_logs");
        if (logsIt == response.end() || !logsIt->is_array()) {
            throw ProtocolError("missing required field 'access_logs' in response from /load_objects.fcgi");
        }

        std::vector<AccessLogEntry> result;
        result.reserve(logsIt->size());
        for (const auto& row : *logsIt) {
            AccessLogEntry entry;
            entry.id = requireField<int64_t>(row, "id", "/load_objects.fcgi (access_logs)");
            entry.time = requireField<int64_t>(row, "time", "/load_objects.fcgi (access_logs)");
            entry.logTypeId = requireField<int64_t>(row, "log_type_id", "/load_objects.fcgi (access_logs)");
            entry.event = requireField<int64_t>(row, "event", "/load_objects.fcgi (access_logs)");
            if (row.contains("user_id") && !row["user_id"].is_null()) {
                entry.userId = row["user_id"].get<int64_t>();
            }
            if (row.contains("portal_id") && !row["portal_id"].is_null()) {
                entry.portalId = row["portal_id"].get<int64_t>();
            }
            if (!query.from.has_value() || entry.time >= *query.from) {
                result.push_back(std::move(entry));
            }
        }
        return result;
    }

    std::string debugGetObjectMetadataJson() {
        nlohmann::json response = postAuthenticatedJson("/object_metadata.fcgi", nlohmann::json::object());
        return response.dump();
    }
};

AmicoClient::AmicoClient(AmicoConfig config)
    : impl_(std::make_unique<Impl>(std::move(config))), usersApi_(this), accessLogsApi_(this) {}

AmicoClient::~AmicoClient() = default;

AmicoClient::AmicoClient(AmicoClient&& other) noexcept
    : impl_(std::move(other.impl_)), usersApi_(this), accessLogsApi_(this) {}

AmicoClient& AmicoClient::operator=(AmicoClient&& other) noexcept {
    if (this != &other) {
        impl_ = std::move(other.impl_);
    }
    return *this;
}

void AmicoClient::login() { impl_->login(); }
void AmicoClient::checkReachable() const { impl_->checkReachable(); }
bool AmicoClient::isSessionValid() { return impl_->isSessionValid(); }
SystemInformation AmicoClient::getSystemInformation() { return impl_->getSystemInformation(); }
void AmicoClient::logout() { impl_->logout(); }
std::string AmicoClient::debugGetObjectMetadataJson() { return impl_->debugGetObjectMetadataJson(); }

std::vector<AmicoUser> AmicoClient::listUsersImpl(const UserQuery& query) { return impl_->listUsers(query); }
std::optional<AmicoUser> AmicoClient::getUserImpl(int64_t id) { return impl_->getUser(id); }
std::vector<AccessLogEntry> AmicoClient::listAccessLogsImpl(const AccessLogQuery& query) { return impl_->listAccessLogs(query); }

std::vector<AmicoUser> AmicoClient::UsersApi::list(const UserQuery& query) { return owner_->listUsersImpl(query); }
std::optional<AmicoUser> AmicoClient::UsersApi::get(int64_t id) { return owner_->getUserImpl(id); }
std::vector<AccessLogEntry> AmicoClient::AccessLogsApi::list(const AccessLogQuery& query) { return owner_->listAccessLogsImpl(query); }

void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport) {
    client.impl_->transport = std::move(transport);
}

}  // namespace amico
