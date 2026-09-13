#include "amico/Client.hpp"

#include <algorithm>
#include <cctype>
#include <ctime>
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

    /// Sends an authenticated raw-binary POST (Content-Type:
    /// application/octet-stream) -- the confirmed wire format for
    /// user_set_image.fcgi (see docs/ui-action-protocol-map.md, Task
    /// 0.6). Mirrors postAuthenticatedJson's session/retry handling.
    nlohmann::json postAuthenticatedBinary(const std::string& path, const std::vector<uint8_t>& bytes,
                                            bool isRetry = false) {
        if (!session.isSet()) {
            throw InvalidSessionError("no active session for " + path + " -- call login() first");
        }
        HttpRequest req = baseRequest("POST", path);
        req.headers.push_back({"Content-Type", "application/octet-stream"});
        req.headers.push_back({"Cookie", session.cookieHeader()});
        req.body.assign(bytes.begin(), bytes.end());

        HttpResponse res = transport->send(req);

        if (res.statusCode == 401) {
            if (!isRetry && config.autoRelogin) {
                log(LogLevel::Warning, "session rejected (401); attempting one re-login per autoRelogin config");
                session.clear();
                login();
                return postAuthenticatedBinary(path, bytes, /*isRetry=*/true);
            }
            throw InvalidSessionError("session rejected by device (HTTP 401) for " + path);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw HttpError(res.statusCode, "unexpected HTTP status " + std::to_string(res.statusCode) + " from " + path);
        }
        return parseJsonOrThrow(res.body, path);
    }

    /// Authenticated GET preserving binary bytes, headers and non-401 statuses.
    /// Uses the same single re-login/retry policy as authenticated POSTs.
    HttpResponse getAuthenticatedBinary(const std::string& path, bool isRetry = false) {
        if (!session.isSet()) {
            throw InvalidSessionError("no active session for " + path + " -- call login() first");
        }
        HttpRequest req = baseRequest("GET", path);
        req.headers.push_back({"Cookie", session.cookieHeader()});
        HttpResponse res = transport->send(req);
        if (res.statusCode == 401) {
            if (!isRetry && config.autoRelogin) {
                log(LogLevel::Warning, "session rejected (401); attempting one re-login per autoRelogin config");
                session.clear();
                login();
                return getAuthenticatedBinary(path, /*isRetry=*/true);
            }
            throw InvalidSessionError("session rejected by device (HTTP 401) for " + path);
        }
        return res;
    }

    /// Throws ProtocolError if the response carries a non-null `error`
    /// field. Used by commands whose success shape isn't otherwise
    /// confirmed (e.g. user_set_image/user_destroy_image) -- an absent
    /// or null `error` is the only confirmed signal available.
    static void checkNoError(const nlohmann::json& response, const std::string& path) {
        if (response.is_object()) {
            auto it = response.find("error");
            if (it != response.end() && !it->is_null()) {
                throw ProtocolError("device returned an error from " + path + ": " + it->dump());
            }
        }
    }

    /// user_set_image's response shape (LIVE_CONFIRMED 2026-09-13, via
    /// en_US/js/CID.js's generic image-field save handler): either a
    /// top-level `error` string, or `{"success":false,"errors":[{code,
    /// message,...}, ...]}` -- a list of face-detection/quality
    /// validation failures (face not detected, not centered, too
    /// distant/close, low sharpness, multiple faces, etc.) -- or
    /// `{"success":true,"scores":{...}}` on success. Never throws for a
    /// successful `scores` response; this SDK does not interpret the
    /// scores themselves (no confirmed pass/fail threshold beyond the
    /// `success` flag).
    static void checkImageSaveResult(const nlohmann::json& response, const std::string& path) {
        if (!response.is_object()) {
            return;
        }
        auto errIt = response.find("error");
        if (errIt != response.end() && !errIt->is_null()) {
            throw ProtocolError("device returned an error from " + path + ": " + errIt->dump());
        }
        auto successIt = response.find("success");
        if (successIt != response.end() && successIt->is_boolean() && *successIt == false) {
            std::string detail;
            auto errorsIt = response.find("errors");
            if (errorsIt != response.end() && errorsIt->is_array()) {
                detail = errorsIt->dump();
            }
            throw ProtocolError("device rejected the image from " + path +
                                 " (face validation failed): " + detail);
        }
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

    int64_t createUser(const NewUser& user) {
        nlohmann::json body = detail::buildUserCreateBody(user.name, user.registration);
        nlohmann::json response = postAuthenticatedJson("/create_objects.fcgi", body);

        nlohmann::json ids = requireField<nlohmann::json>(response, "ids", "/create_objects.fcgi");
        if (!ids.is_array() || ids.empty() || !ids.front().is_number_integer()) {
            throw ProtocolError("field 'ids' had an unexpected type or was empty in response from /create_objects.fcgi");
        }
        return ids.front().get<int64_t>();
    }

    void updateUser(const UserUpdate& user) {
        nlohmann::json body = detail::buildUserUpdateBody(user.id, user.name, user.registration);
        nlohmann::json response = postAuthenticatedJson("/modify_objects.fcgi", body);

        nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/modify_objects.fcgi");
        if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
            throw ProtocolError("field 'changes' was not a positive integer in response from /modify_objects.fcgi");
        }
    }

    void removeUser(int64_t id) {
        nlohmann::json body = detail::buildUserDeleteBody(id);
        nlohmann::json response = postAuthenticatedJson("/destroy_objects.fcgi", body);

        nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/destroy_objects.fcgi");
        if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
            throw ProtocolError("field 'changes' was not a positive integer in response from /destroy_objects.fcgi");
        }
    }

    std::vector<int64_t> getUserGroupIds(int64_t userId) {
        nlohmann::json body = detail::buildUserGroupIdsBody(userId);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);
        auto it = response.find("user_groups");
        if (it == response.end() || !it->is_array()) {
            throw ProtocolError("missing required field 'user_groups' in response from /load_objects.fcgi");
        }
        std::vector<int64_t> ids;
        ids.reserve(it->size());
        for (const auto& row : *it) {
            ids.push_back(requireField<int64_t>(row, "group_id", "/load_objects.fcgi (user_groups)"));
        }
        return ids;
    }

    bool getUserIsAdmin(int64_t userId) {
        nlohmann::json body = detail::buildUserIsAdminBody(userId);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);
        auto it = response.find("user_roles");
        if (it == response.end() || !it->is_array()) {
            throw ProtocolError("missing required field 'user_roles' in response from /load_objects.fcgi");
        }
        return !it->empty();
    }

    /// Runs a COUNT(*)-shaped load_objects query and extracts the count.
    /// Used for cardCount/faceCount/bioCount -- never for password/salt.
    int runCountQuery(const nlohmann::json& body, const std::string& table) {
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);
        auto it = response.find(table);
        if (it == response.end() || !it->is_array() || it->empty()) {
            return 0;
        }
        auto countIt = it->front().find("COUNT(*)");
        if (countIt == it->front().end() || countIt->is_null()) {
            throw ProtocolError("missing 'COUNT(*)' field in response from /load_objects.fcgi (" + table + ")");
        }
        return countIt->get<int>();
    }

    /// Reduces the `password` field to a boolean immediately -- the raw
    /// value never leaves this function, is never logged, and is never
    /// stored on AmicoUser. Per docs/ui-action-protocol-map.md's
    /// hasPassword derivation finding, the device only ever returns a
    /// fixed masked sentinel or empty/null on this field, never the
    /// real hash.
    bool getUserHasPassword(int64_t userId) {
        nlohmann::json body = detail::buildUserHasPasswordBody(userId);
        nlohmann::json response = postAuthenticatedJson("/load_objects.fcgi", body);
        auto it = response.find("users");
        if (it == response.end() || !it->is_array() || it->empty()) {
            throw ProtocolError("missing required field 'users' in response from /load_objects.fcgi");
        }
        auto pwIt = it->front().find("password");
        bool has = pwIt != it->front().end() && !pwIt->is_null() &&
                   !(pwIt->is_string() && pwIt->get<std::string>().empty());
        return has;
    }

    AmicoUser mapUser(const nlohmann::json& row) {
        AmicoUser user;
        user.id = requireField<int64_t>(row, "id", "/load_objects.fcgi (users)");
        user.name = requireField<std::string>(row, "name", "/load_objects.fcgi (users)");
        user.registration = requireField<std::string>(row, "registration", "/load_objects.fcgi (users)");
        user.userTypeId = requireField<int>(row, "user_type_id", "/load_objects.fcgi (users)");
        user.beginTime = requireField<int64_t>(row, "begin_time", "/load_objects.fcgi (users)");
        user.endTime = requireField<int64_t>(row, "end_time", "/load_objects.fcgi (users)");
        user.lastAccess = requireField<int64_t>(row, "last_access", "/load_objects.fcgi (users)");

        user.groupIds = getUserGroupIds(user.id);
        user.groupCount = static_cast<int>(user.groupIds.size());
        user.cardCount = runCountQuery(detail::buildCardCountBody(user.id), "cards");
        user.isAdministrator = getUserIsAdmin(user.id);
        user.faceCount = runCountQuery(detail::buildFaceCountBody(user.id), "face_templates");
        user.bioCount = runCountQuery(detail::buildBioCountBody(user.id), "templates");
        user.hasPassword = getUserHasPassword(user.id);
        user.imageUrl = "/user_get_image.fcgi?user_id=" + std::to_string(user.id);
        return user;
    }

    void addUserToGroup(int64_t userId, int64_t groupId) {
        nlohmann::json body = detail::buildGroupAddBody(userId, groupId);
        nlohmann::json response = postAuthenticatedJson("/create_objects.fcgi", body);
        nlohmann::json ids = requireField<nlohmann::json>(response, "ids", "/create_objects.fcgi");
        if (!ids.is_array() || ids.empty()) {
            throw ProtocolError("field 'ids' had an unexpected type or was empty in response from /create_objects.fcgi");
        }
    }

    void removeUserFromGroup(int64_t userId, int64_t groupId) {
        nlohmann::json body = detail::buildGroupRemoveBody(userId, groupId);
        nlohmann::json response = postAuthenticatedJson("/destroy_objects.fcgi", body);
        nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/destroy_objects.fcgi");
        if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
            throw ProtocolError("field 'changes' was not a positive integer in response from /destroy_objects.fcgi");
        }
    }

    int64_t addUserCard(int64_t userId, int64_t areaCode, int64_t cardNumber) {
        nlohmann::json body = detail::buildCardAddBody(userId, areaCode, cardNumber);
        nlohmann::json response = postAuthenticatedJson("/create_objects.fcgi", body);
        nlohmann::json ids = requireField<nlohmann::json>(response, "ids", "/create_objects.fcgi");
        if (!ids.is_array() || ids.empty() || !ids.front().is_number_integer()) {
            throw ProtocolError("field 'ids' had an unexpected type or was empty in response from /create_objects.fcgi");
        }
        return ids.front().get<int64_t>();
    }

    void removeUserCard(int64_t cardId) {
        nlohmann::json body = detail::buildCardRemoveBody(cardId);
        nlohmann::json response = postAuthenticatedJson("/destroy_objects.fcgi", body);
        nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/destroy_objects.fcgi");
        if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
            throw ProtocolError("field 'changes' was not a positive integer in response from /destroy_objects.fcgi");
        }
    }

    /// A no-op if the user is already in the requested state -- matches
    /// the real UI's own asymmetric UserRole.save() (Task 0.5): it only
    /// ever grants a non-admin or revokes an existing admin, never the
    /// reverse-redundant case.
    void setUserAdministrator(int64_t userId, bool isAdmin) {
        if (getUserIsAdmin(userId) == isAdmin) {
            return;
        }
        nlohmann::json body = detail::buildAdministratorSetBody(userId, isAdmin);
        if (isAdmin) {
            nlohmann::json response = postAuthenticatedJson("/create_objects.fcgi", body);
            nlohmann::json ids = requireField<nlohmann::json>(response, "ids", "/create_objects.fcgi");
            if (!ids.is_array() || ids.empty()) {
                throw ProtocolError("field 'ids' had an unexpected type or was empty in response from /create_objects.fcgi");
            }
        } else {
            nlohmann::json response = postAuthenticatedJson("/destroy_objects.fcgi", body);
            nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/destroy_objects.fcgi");
            if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
                throw ProtocolError("field 'changes' was not a positive integer in response from /destroy_objects.fcgi");
            }
        }
    }

    /// LIVE_CONFIRMED 2026-09-13 (en_US/js/CID.js): the real UI's actual
    /// image-save call site (not the vestigial one in class/user.js)
    /// requires `match=1` and `timestamp=<unix_epoch_seconds>` query
    /// params in addition to `user_id` -- omitting them was the root
    /// cause of this plan's Group 5 attempt #2/#3 HTTP 400s (the PNG-vs-
    /// JPEG fix from attempt #2 was necessary but not sufficient). This
    /// endpoint also enrolls/updates the device's face-recognition
    /// template for this user -- it is NOT a purely cosmetic photo
    /// store, despite spec.md's original Decision 4 assumption; see the
    /// 2026-09-13 DECISION_LOG amendment.
    void setUserImage(int64_t userId, const std::vector<uint8_t>& bytes) {
        auto timestamp = static_cast<int64_t>(std::time(nullptr));
        std::string path = "/user_set_image.fcgi?user_id=" + std::to_string(userId) + "&match=1&timestamp=" +
                            std::to_string(timestamp);
        nlohmann::json response = postAuthenticatedBinary(path, bytes);
        checkImageSaveResult(response, "/user_set_image.fcgi");
    }

    /// LIVE_CONFIRMED 2026-09-13 (en_US/js/CID.js): removing a user's
    /// image also destroys their `face_templates` rows in the real UI's
    /// own flow -- both calls are issued here to match that behavior
    /// exactly, not just the image file itself.
    void removeUserImage(int64_t userId) {
        nlohmann::json body = detail::buildUserDestroyImageBody(userId);
        nlohmann::json response = postAuthenticatedJson("/user_destroy_image.fcgi", body);
        checkNoError(response, "/user_destroy_image.fcgi");

        nlohmann::json faceBody = detail::buildFaceTemplatesDeleteBody(userId);
        postAuthenticatedJson("/destroy_objects.fcgi", faceBody);
        // No throw-on-zero-changes here: a user may have no image (and
        // therefore no face_templates row) yet still legitimately call
        // removeImage() as a no-op cleanup, matching the real UI's own
        // unconditional call at this point in its save flow.
    }

    /// Hashes via the device's own user_hash_password command first
    /// (mirroring the real UI's flow, see docs/ui-action-protocol-map.md's
    /// User CRUD write commands section), then writes only the
    /// resulting hash+salt. plaintextPassword and the hashed result
    /// exist only in this function's local variables -- never logged,
    /// never stored, never returned.
    void setUserPassword(int64_t userId, const std::string& plaintextPassword) {
        nlohmann::json hashRequest;
        hashRequest["password"] = plaintextPassword;
        nlohmann::json hashResponse = postAuthenticatedJson("/user_hash_password.fcgi", hashRequest);
        std::string hashedPassword = requireField<std::string>(hashResponse, "password", "/user_hash_password.fcgi");
        std::string salt = requireField<std::string>(hashResponse, "salt", "/user_hash_password.fcgi");

        nlohmann::json body = detail::buildPasswordSetBody(userId, hashedPassword, salt);
        nlohmann::json response = postAuthenticatedJson("/modify_objects.fcgi", body);
        nlohmann::json changes = requireField<nlohmann::json>(response, "changes", "/modify_objects.fcgi");
        if (!changes.is_number_integer() || changes.get<int64_t>() <= 0) {
            throw ProtocolError("field 'changes' was not a positive integer in response from /modify_objects.fcgi");
        }
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
int64_t AmicoClient::createUserImpl(const NewUser& user) { return impl_->createUser(user); }
void AmicoClient::updateUserImpl(const UserUpdate& user) { impl_->updateUser(user); }
void AmicoClient::removeUserImpl(int64_t id) { impl_->removeUser(id); }
void AmicoClient::addUserToGroupImpl(int64_t userId, int64_t groupId) { impl_->addUserToGroup(userId, groupId); }
void AmicoClient::removeUserFromGroupImpl(int64_t userId, int64_t groupId) { impl_->removeUserFromGroup(userId, groupId); }
int64_t AmicoClient::addUserCardImpl(int64_t userId, int64_t areaCode, int64_t cardNumber) {
    return impl_->addUserCard(userId, areaCode, cardNumber);
}
void AmicoClient::removeUserCardImpl(int64_t cardId) { impl_->removeUserCard(cardId); }
void AmicoClient::setUserAdministratorImpl(int64_t userId, bool isAdmin) { impl_->setUserAdministrator(userId, isAdmin); }
UserImage AmicoClient::getUserImageImpl(int64_t userId) {
    const std::string path = "/user_get_image.fcgi?user_id=" + std::to_string(userId);
    HttpResponse res = impl_->getAuthenticatedBinary(path);
    if (res.statusCode == 404) {
        throw HttpError(404, "no image for user " + std::to_string(userId));
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
        throw HttpError(res.statusCode, "unexpected HTTP status " + std::to_string(res.statusCode) + " from " + path);
    }
    std::string contentType = "image/jpeg";
    for (const auto& header : res.headers) {
        std::string name = header.name;
        std::transform(name.begin(), name.end(), name.begin(),
                       [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        if (name == "content-type") {
            contentType = header.value;
            break;
        }
    }
    return {std::vector<uint8_t>(res.body.begin(), res.body.end()), std::move(contentType)};
}
void AmicoClient::setUserImageImpl(int64_t userId, const std::vector<uint8_t>& bytes) { impl_->setUserImage(userId, bytes); }
void AmicoClient::removeUserImageImpl(int64_t userId) { impl_->removeUserImage(userId); }
void AmicoClient::setUserPasswordImpl(int64_t userId, const std::string& plaintextPassword) {
    impl_->setUserPassword(userId, plaintextPassword);
}
std::vector<AccessLogEntry> AmicoClient::listAccessLogsImpl(const AccessLogQuery& query) { return impl_->listAccessLogs(query); }

std::vector<AmicoUser> AmicoClient::UsersApi::list(const UserQuery& query) { return owner_->listUsersImpl(query); }
std::optional<AmicoUser> AmicoClient::UsersApi::get(int64_t id) { return owner_->getUserImpl(id); }
int64_t AmicoClient::UsersApi::create(const NewUser& user) { return owner_->createUserImpl(user); }
void AmicoClient::UsersApi::update(const UserUpdate& user) { owner_->updateUserImpl(user); }
void AmicoClient::UsersApi::remove(int64_t id) { owner_->removeUserImpl(id); }
void AmicoClient::UsersApi::addToGroup(int64_t userId, int64_t groupId) { owner_->addUserToGroupImpl(userId, groupId); }
void AmicoClient::UsersApi::removeFromGroup(int64_t userId, int64_t groupId) { owner_->removeUserFromGroupImpl(userId, groupId); }
int64_t AmicoClient::UsersApi::addCard(int64_t userId, int64_t areaCode, int64_t cardNumber) {
    return owner_->addUserCardImpl(userId, areaCode, cardNumber);
}
void AmicoClient::UsersApi::removeCard(int64_t cardId) { owner_->removeUserCardImpl(cardId); }
void AmicoClient::UsersApi::setAdministrator(int64_t userId, bool isAdmin) { owner_->setUserAdministratorImpl(userId, isAdmin); }
UserImage AmicoClient::UsersApi::getImage(int64_t userId) { return owner_->getUserImageImpl(userId); }
void AmicoClient::UsersApi::setImage(int64_t userId, const std::vector<uint8_t>& bytes) { owner_->setUserImageImpl(userId, bytes); }
void AmicoClient::UsersApi::removeImage(int64_t userId) { owner_->removeUserImageImpl(userId); }
void AmicoClient::UsersApi::setPassword(int64_t userId, const std::string& plaintextPassword) {
    owner_->setUserPasswordImpl(userId, plaintextPassword);
}
std::vector<AccessLogEntry> AmicoClient::AccessLogsApi::list(const AccessLogQuery& query) { return owner_->listAccessLogsImpl(query); }

void setTransportForTesting(AmicoClient& client, std::unique_ptr<IHttpTransport> transport) {
    client.impl_->transport = std::move(transport);
}

}  // namespace amico
