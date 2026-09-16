#include "Routes.hpp"

#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

#include "ErrorMapping.hpp"
#include "JsonMapping.hpp"
#include "amico/Errors.hpp"

namespace amico::backend {

namespace {

constexpr const char* kConfirmHeader = "X-Confirm-Sensitive-Action";
constexpr const char* kConfirmValue = "yes";

void respondInvalidRequest(httplib::Response& res, const std::string& detail) {
    nlohmann::json body = {{"error", detail}, {"type", "InvalidRequest"}};
    res.status = 400;
    res.set_content(body.dump(), "application/json");
}

void respondError(httplib::Response& res, const std::exception& e) {
    auto [status, body] = mapException(e);
    res.status = status;
    res.set_content(body.dump(), "application/json");
}

bool requireSession(const httplib::Request& req, httplib::Response& res, const SessionStore& sessions) {
    if (sessions.checkSessionCookie(req.get_header_value("Cookie"))) return true;
    res.status = 401;
    res.set_content(nlohmann::json{{"error", "not logged in"}, {"type", "InvalidSessionError"}}.dump(),
                    "application/json");
    return false;
}

bool requireConfirmationHeader(const httplib::Request& req, httplib::Response& res) {
    if (req.get_header_value(kConfirmHeader) == kConfirmValue) {
        return true;
    }
    nlohmann::json body = {
        {"error", std::string("this action requires the header '") + kConfirmHeader + ": " + kConfirmValue + "'"},
        {"type", "ConfirmationRequired"},
    };
    res.status = 428;
    res.set_content(body.dump(), "application/json");
    return false;
}

/// Parses a required int64 path parameter. Throws std::invalid_argument
/// (caught by every handler's stage-1 try/catch) on a non-numeric value.
int64_t pathParamId(const httplib::Request& req, const std::string& name) {
    const std::string& raw = req.path_params.at(name);
    std::size_t consumed = 0;
    long long value = std::stoll(raw, &consumed);
    if (consumed != raw.size()) {
        throw std::invalid_argument("path parameter '" + name + "' is not a valid integer: '" + raw + "'");
    }
    return static_cast<int64_t>(value);
}

int queryParamInt(const httplib::Request& req, const std::string& name, int fallback) {
    if (!req.has_param(name)) {
        return fallback;
    }
    std::size_t consumed = 0;
    const std::string raw = req.get_param_value(name);
    int value = std::stoi(raw, &consumed);
    if (consumed != raw.size()) {
        throw std::invalid_argument("query parameter '" + name + "' is not a valid integer: '" + raw + "'");
    }
    return value;
}

std::optional<std::vector<int64_t>> queryParamIds(const httplib::Request& req, const std::string& name) {
    std::vector<int64_t> ids;
    const auto range = req.params.equal_range(name);
    for (auto it = range.first; it != range.second; ++it) {
        const auto& raw = it->second;
        std::size_t start = 0;
        while (start < raw.size()) {
            const auto end = raw.find(',', start);
            const auto token = raw.substr(start, end == std::string::npos ? end : end - start);
            if (!token.empty()) {
                std::size_t consumed = 0;
                const auto id = std::stoll(token, &consumed);
                if (consumed != token.size()) {
                    throw std::invalid_argument("query parameter '" + name + "' contains an invalid integer");
                }
                ids.push_back(static_cast<int64_t>(id));
            }
            if (end == std::string::npos) break;
            start = end + 1;
        }
    }
    if (ids.empty()) return std::nullopt;
    return ids;
}

}  // namespace

void registerAll(httplib::Server& svr, SessionStore& sessionStore) {
    svr.Post("/login", [&](const httplib::Request& req, httplib::Response& res) {
        std::string deviceUrl, username, password;
        try {
            const auto body = nlohmann::json::parse(req.body);
            deviceUrl = body.at("deviceUrl").get<std::string>();
            username = body.at("username").get<std::string>();
            password = body.at("password").get<std::string>();
        } catch (const std::exception&) {
            // JSON parser diagnostics may quote the submitted password.
            respondInvalidRequest(res, "expected deviceUrl, username and password strings");
            return;
        }
        auto lock = sessionStore.acquire();
        try {
            sessionStore.login(deviceUrl, username, password);
            res.set_header("Set-Cookie", "amico_session=" + sessionStore.sessionToken() +
                           "; HttpOnly; SameSite=Lax; Path=/");
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            auto [status, body] = mapException(e);
            // Keep the existing type/status mapping without reflecting a device
            // response that might echo credentials into a browser banner.
            body["error"] = "login failed; check the device URL and credentials";
            res.status = status;
            res.set_content(body.dump(), "application/json");
        }
    });

    svr.Post("/logout", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        res.set_header("Set-Cookie", "amico_session=; Max-Age=0; Path=/");
        try {
            sessionStore.logout();
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/session", [&](const httplib::Request&, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        nlohmann::json body = {{"loggedIn", sessionStore.isLoggedIn()}};
        if (sessionStore.isLoggedIn()) body["deviceUrl"] = sessionStore.deviceUrl();
        res.set_header("Cache-Control", "no-store");
        res.set_content(body.dump(), "application/json");
    });

    svr.Get("/health", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            client.checkReachable();
            res.set_content(nlohmann::json{{"status", "ok"}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/system-information", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            res.set_content(toJson(client.getSystemInformation()).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Date and Time settings (2026-09-16-date-time-settings-read) --
    // read-only, no X-Confirm-Sensitive-Action header (nothing here
    // mutates device state).
    svr.Get("/settings/date-time", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            res.set_content(toJson(client.getDateTimeSettings()).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // License Mode (2026-09-16-license-mode-settings-read) -- read-only,
    // no X-Confirm-Sensitive-Action header (nothing here mutates device
    // state).
    svr.Get("/license", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            res.set_content(toJson(client.getLicenseInfo()).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/users", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::UserQuery query;
        try {
            query.limit = queryParamInt(req, "limit", 0);
            query.offset = queryParamInt(req, "offset", 0);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            nlohmann::json arr = nlohmann::json::array();
            for (const auto& user : client.users().list(query)) {
                arr.push_back(toJson(user));
            }
            res.set_content(arr.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            auto user = client.users().get(id);
            if (!user.has_value()) {
                res.status = 404;
                res.set_content(nlohmann::json{{"error", "user not found"}, {"type", "NotFound"}}.dump(),
                                 "application/json");
                return;
            }
            res.set_content(toJson(*user).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/users", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewUser newUser;
        try {
            newUser = fromJsonNewUser(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.users().create(newUser);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::UserUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonUserUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/users/(\d+)/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, groupId = 0;
        try {
            userId = std::stoll(req.matches[1]);
            groupId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().addToGroup(userId, groupId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/users/(\d+)/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, groupId = 0;
        try {
            userId = std::stoll(req.matches[1]);
            groupId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().removeFromGroup(userId, groupId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/users/(\d+)/cards)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, areaCode = 0, cardNumber = 0;
        try {
            userId = std::stoll(req.matches[1]);
            nlohmann::json body = nlohmann::json::parse(req.body);
            areaCode = body.at("areaCode").get<int64_t>();
            cardNumber = body.at("cardNumber").get<int64_t>();
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t cardId = client.users().addCard(userId, areaCode, cardNumber);
            res.status = 201;
            res.set_content(nlohmann::json{{"cardId", cardId}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/cards/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t cardId = 0;
        try {
            cardId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().removeCard(cardId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Put(R"(/users/(\d+)/administrator)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        bool isAdmin = false;
        try {
            userId = std::stoll(req.matches[1]);
            isAdmin = nlohmann::json::parse(req.body).at("isAdmin").get<bool>();
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        if (!requireConfirmationHeader(req, res)) {
            return;
        }
        try {
            client.users().setAdministrator(userId, isAdmin);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Capture malformed IDs too so they receive InvalidRequest after the cookie gate.
    svr.Get(R"(/users/([^/]+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            const std::string raw = req.matches[1];
            if (raw.find_first_not_of("0123456789") != std::string::npos) {
                throw std::invalid_argument("user id must contain only decimal digits");
            }
            userId = std::stoll(raw);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            const auto image = client.users().getImage(userId);
            res.set_content(std::string(image.bytes.begin(), image.bytes.end()), image.contentType);
        } catch (const amico::HttpError& e) {
            if (e.statusCode() == 404) {
                res.status = 404;
                res.body.clear();
            } else {
                respondError(res, e);
            }
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Put(R"(/users/(\d+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            userId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        std::vector<uint8_t> bytes(req.body.begin(), req.body.end());
        try {
            client.users().setImage(userId, bytes);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/users/(\d+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            userId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().removeImage(userId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Password is never logged: `plaintextPassword` only ever lives in
    // this handler's local variable and inside AmicoClient::setPassword()'s
    // own call frame (which itself never logs it -- see Client.hpp).
    svr.Put(R"(/users/(\d+)/password)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        std::string password;
        try {
            userId = std::stoll(req.matches[1]);
            password = nlohmann::json::parse(req.body).at("password").get<std::string>();
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        if (!requireConfirmationHeader(req, res)) {
            return;
        }
        try {
            client.users().setPassword(userId, password);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // ------------------------- Visitors -------------------------
    // Same underlying `users` object as /users/*, filtered to
    // userTypeId=1 -- LIVE-CONFIRMED shape, see
    // .plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md.

    svr.Get("/visitors", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::UserQuery query;
        query.userTypeId = 1;
        try {
            query.limit = queryParamInt(req, "limit", 0);
            query.offset = queryParamInt(req, "offset", 0);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            nlohmann::json arr = nlohmann::json::array();
            for (const auto& user : client.users().list(query)) {
                arr.push_back(toJson(user));
            }
            res.set_content(arr.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get(R"(/visitors/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            auto user = client.users().get(id);
            if (!user.has_value()) {
                res.status = 404;
                res.set_content(nlohmann::json{{"error", "user not found"}, {"type", "NotFound"}}.dump(),
                                 "application/json");
                return;
            }
            res.set_content(toJson(*user).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/visitors", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewUser newUser;
        try {
            newUser = fromJsonNewUser(nlohmann::json::parse(req.body));
            newUser.userTypeId = 1;
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.users().create(newUser);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/visitors/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::UserUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonUserUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/visitors/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/visitors/(\d+)/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, groupId = 0;
        try {
            userId = std::stoll(req.matches[1]);
            groupId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().addToGroup(userId, groupId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/visitors/(\d+)/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, groupId = 0;
        try {
            userId = std::stoll(req.matches[1]);
            groupId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().removeFromGroup(userId, groupId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/visitors/(\d+)/cards)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0, areaCode = 0, cardNumber = 0;
        try {
            userId = std::stoll(req.matches[1]);
            nlohmann::json body = nlohmann::json::parse(req.body);
            areaCode = body.at("areaCode").get<int64_t>();
            cardNumber = body.at("cardNumber").get<int64_t>();
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t cardId = client.users().addCard(userId, areaCode, cardNumber);
            res.status = 201;
            res.set_content(nlohmann::json{{"cardId", cardId}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Capture malformed IDs too so they receive InvalidRequest after the cookie gate.
    svr.Get(R"(/visitors/([^/]+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            const std::string raw = req.matches[1];
            if (raw.find_first_not_of("0123456789") != std::string::npos) {
                throw std::invalid_argument("user id must contain only decimal digits");
            }
            userId = std::stoll(raw);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            const auto image = client.users().getImage(userId);
            res.set_content(std::string(image.bytes.begin(), image.bytes.end()), image.contentType);
        } catch (const amico::HttpError& e) {
            if (e.statusCode() == 404) {
                res.status = 404;
                res.body.clear();
            } else {
                respondError(res, e);
            }
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Put(R"(/visitors/(\d+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            userId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        std::vector<uint8_t> bytes(req.body.begin(), req.body.end());
        try {
            client.users().setImage(userId, bytes);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/visitors/(\d+)/image)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        try {
            userId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.users().removeImage(userId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Password is never logged: `plaintextPassword` only ever lives in
    // this handler's local variable and inside AmicoClient::setPassword()'s
    // own call frame (which itself never logs it -- see Client.hpp).
    svr.Put(R"(/visitors/(\d+)/password)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t userId = 0;
        std::string password;
        try {
            userId = std::stoll(req.matches[1]);
            password = nlohmann::json::parse(req.body).at("password").get<std::string>();
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        if (!requireConfirmationHeader(req, res)) {
            return;
        }
        try {
            client.users().setPassword(userId, password);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // `visits` object -- a genuinely distinct device object from
    // `users`/`visitors` (its own PK/fields), unlike Visitors. See
    // .plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md.
    // A visit's Cards tab reuses /visitors/:id/cards above (keyed by
    // the visit's own visitorId) -- there is no /visits/:id/cards route
    // (spec.md Decision 3).

    svr.Get("/visits", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::VisitQuery query;
        try {
            query.limit = queryParamInt(req, "limit", 0);
            query.offset = queryParamInt(req, "offset", 0);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            nlohmann::json arr = nlohmann::json::array();
            for (const auto& visit : client.visits().list(query)) {
                arr.push_back(toJson(visit));
            }
            res.set_content(arr.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get(R"(/visits/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            auto visit = client.visits().get(id);
            if (!visit.has_value()) {
                res.status = 404;
                res.set_content(nlohmann::json{{"error", "visit not found"}, {"type", "NotFound"}}.dump(),
                                 "application/json");
                return;
            }
            res.set_content(toJson(*visit).dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/visits", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewVisit newVisit;
        try {
            newVisit = fromJsonNewVisit(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.visits().create(newVisit);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/visits/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::VisitUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonVisitUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.visits().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/visits/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.visits().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Real device-side write side effect: revokes every card currently
    // issued to this visit's visitor (spec.md Decision 4/Background).
    // No confirmation header -- matches this project's existing
    // card-removal precedent (DELETE /cards/:id), not the
    // credential/firmware/license tier that does require one.
    svr.Post(R"(/visits/(\d+)/finish)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.visits().finish(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/groups", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& group : client.groups().list()) rows.push_back(toJson(group));
            res.set_content(nlohmann::json{{"groups", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });
    // Groups write side (2026-09-15-groups-write-side) -- this SDK does
    // not special-case the real UI's own protected id-1 default group;
    // a rejected write there surfaces as a normal ProtocolError, same
    // as any other rejected write. See spec.md Decision 2.
    svr.Post("/groups", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewGroup newGroup;
        try {
            newGroup = fromJsonNewGroup(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.groups().create(newGroup);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::GroupUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonGroupUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.groups().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/groups/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.groups().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Groups Time Zones tab (2026-09-16-groups-timezones-write-side) --
    // reuses the exact access_rules/access_rule_time_zones mechanism
    // already shipped for Scheduled Unlock. No X-Confirm-Sensitive-Action
    // header required, same precedent as the rest of this route family.
    svr.Post(R"(/groups/(\d+)/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t groupId = 0, timeZoneId = 0;
        try {
            groupId = std::stoll(req.matches[1]);
            timeZoneId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.groups().addTimeZone(groupId, timeZoneId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/groups/(\d+)/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t groupId = 0, timeZoneId = 0;
        try {
            groupId = std::stoll(req.matches[1]);
            timeZoneId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.groups().removeTimeZone(groupId, timeZoneId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/timezones", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& group : client.timeZones().list()) rows.push_back(toJson(group));
            res.set_content(nlohmann::json{{"timezones", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });
    // Time Zones write side + time_spans CRUD
    // (2026-09-15-timezones-write-side) -- same no-special-casing
    // stance for the protected default zone id as Groups (spec.md
    // Decision 3).
    svr.Post("/timezones", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewTimeZone newZone;
        try {
            newZone = fromJsonNewTimeZone(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.timeZones().create(newZone);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::TimeZoneUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonTimeZoneUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.timeZones().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.timeZones().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get(R"(/timezones/(\d+)/spans)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t timeZoneId = 0;
        try {
            timeZoneId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            auto rows = nlohmann::json::array();
            for (const auto& span : client.timeZones().listSpans(timeZoneId)) rows.push_back(toJson(span));
            res.set_content(nlohmann::json{{"spans", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/timezones/(\d+)/spans)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewTimeSpan newSpan;
        try {
            int64_t timeZoneId = std::stoll(req.matches[1]);
            newSpan = fromJsonNewTimeSpan(timeZoneId, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.timeZones().createSpan(newSpan);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Top-level by the span's own id, not nested under a zone id --
    // same precedent as DELETE /cards/:cardId.
    svr.Patch(R"(/timespans/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::TimeSpanUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonTimeSpanUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.timeZones().updateSpan(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/timespans/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.timeZones().removeSpan(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Holidays (2026-09-15-holidays-write-side) -- no protected-id
    // record for this object (spec.md Background: no `noSave` in
    // class.js), unlike Groups/Time Zones. No X-Confirm-Sensitive-Action
    // header required, same precedent as Groups/Time Zones/Visits.
    svr.Get("/holidays", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& holiday : client.holidays().list()) rows.push_back(toJson(holiday));
            res.set_content(nlohmann::json{{"holidays", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/holidays", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewHoliday newHoliday;
        try {
            newHoliday = fromJsonNewHoliday(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.holidays().create(newHoliday);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/holidays/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::HolidayUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonHolidayUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.holidays().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/holidays/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.holidays().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Scheduled Unlock (2026-09-15-scheduled-unlock-write-side) -- no
    // X-Confirm-Sensitive-Action header required, same precedent as
    // Groups/Time Zones/Holidays/Visits.
    svr.Get("/scheduled-unlocks", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& unlock : client.scheduledUnlocks().list()) rows.push_back(toJson(unlock));
            res.set_content(nlohmann::json{{"scheduledUnlocks", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/scheduled-unlocks", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewScheduledUnlock newUnlock;
        try {
            newUnlock = fromJsonNewScheduledUnlock(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.scheduledUnlocks().create(newUnlock);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/scheduled-unlocks/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::ScheduledUnlockUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonScheduledUnlockUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.scheduledUnlocks().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/scheduled-unlocks/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.scheduledUnlocks().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/scheduled-unlocks/(\d+)/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t scheduledUnlockId = 0, timeZoneId = 0;
        try {
            scheduledUnlockId = std::stoll(req.matches[1]);
            timeZoneId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.scheduledUnlocks().addTimeZone(scheduledUnlockId, timeZoneId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/scheduled-unlocks/(\d+)/timezones/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t scheduledUnlockId = 0, timeZoneId = 0;
        try {
            scheduledUnlockId = std::stoll(req.matches[1]);
            timeZoneId = std::stoll(req.matches[2]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.scheduledUnlocks().removeTimeZone(scheduledUnlockId, timeZoneId);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // User Types (2026-09-16-user-types-write-side) -- no
    // X-Confirm-Sensitive-Action header required, same precedent as
    // Groups/Time Zones/Holidays/Scheduled Unlock/Visits.
    svr.Get("/user-types", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& userType : client.userTypes().list()) rows.push_back(toJson(userType));
            res.set_content(nlohmann::json{{"userTypes", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/user-types", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewUserType newUserType;
        try {
            newUserType = fromJsonNewUserType(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.userTypes().create(newUserType);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/user-types/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::UserTypeUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonUserTypeUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.userTypes().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/user-types/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.userTypes().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Custom Fields (2026-09-16-custom-fields-write-side) -- no
    // X-Confirm-Sensitive-Action header required, same precedent as
    // User Types/Groups/Time Zones/Holidays/Scheduled Unlock/Visits.
    svr.Get("/custom-fields", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& field : client.customFields().list()) rows.push_back(toJson(field));
            res.set_content(nlohmann::json{{"customFields", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post("/custom-fields", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::NewCustomField newField;
        try {
            newField = fromJsonNewCustomField(nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            int64_t id = client.customFields().create(newField);
            res.status = 201;
            res.set_content(nlohmann::json{{"id", id}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Patch(R"(/custom-fields/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::CustomFieldUpdate update;
        try {
            int64_t id = std::stoll(req.matches[1]);
            update = fromJsonCustomFieldUpdate(id, nlohmann::json::parse(req.body));
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.customFields().update(update);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Delete(R"(/custom-fields/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t id = 0;
        try {
            id = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            client.customFields().remove(id);
            res.set_content(nlohmann::json{{"success", true}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    // Reports (2026-09-16-reports-read-export) -- entirely read-only,
    // no X-Confirm-Sensitive-Action header anywhere in this block
    // (spec.md Decision 1: report_generate.fcgi never mutates device
    // state).
    svr.Get("/reports", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        try {
            auto rows = nlohmann::json::array();
            for (const auto& report : client.reports().list()) rows.push_back(toJson(report));
            res.set_content(nlohmann::json{{"reports", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get(R"(/reports/(\d+)/filters)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t reportId = 0;
        try {
            reportId = std::stoll(req.matches[1]);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            auto rows = nlohmann::json::array();
            for (const auto& filter : client.reports().filters(reportId)) rows.push_back(toJson(filter));
            res.set_content(nlohmann::json{{"filters", rows}}.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Post(R"(/reports/(\d+)/export)", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        int64_t reportId = 0;
        std::map<int64_t, std::string> filterOverrides;
        try {
            reportId = std::stoll(req.matches[1]);
            if (!req.body.empty()) {
                nlohmann::json parsed = nlohmann::json::parse(req.body);
                if (parsed.contains("filters")) {
                    for (auto it = parsed["filters"].begin(); it != parsed["filters"].end(); ++it) {
                        int64_t filterId = std::stoll(it.key());
                        filterOverrides[filterId] = it.value().get<std::string>();
                    }
                }
            }
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            std::string csv = client.reports().exportCsv(reportId, filterOverrides);
            std::string reportName;
            for (const auto& report : client.reports().list()) {
                if (report.id == reportId) {
                    reportName = report.name;
                    break;
                }
            }
            res.set_header("Content-Disposition", "attachment; filename=\"" + reportName + ".csv\"");
            res.set_content(csv, "text/csv");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });

    svr.Get("/access-logs", [&](const httplib::Request& req, httplib::Response& res) {
        auto lock = sessionStore.acquire();
        if (!requireSession(req, res, sessionStore)) return;
        auto& client = *sessionStore.client();
        amico::AccessLogQuery query;
        try {
            if (req.has_param("from")) {
                query.from = std::stoll(req.get_param_value("from"));
            }
            if (req.has_param("to")) {
                query.to = std::stoll(req.get_param_value("to"));
            }
            query.userIds = queryParamIds(req, "userIds");
            query.groupIds = queryParamIds(req, "groupIds");
            query.timeZoneIds = queryParamIds(req, "timeZoneIds");
            query.limit = queryParamInt(req, "limit", 0);
            query.offset = queryParamInt(req, "offset", 0);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            std::vector<amico::AccessLogEntry> entries = client.accessLogs().list(query);
            int64_t total = client.accessLogs().accessLogsCount(query);

            std::set<int64_t> userIdSet;
            std::set<int64_t> portalIdSet;
            std::vector<int64_t> accessLogIds;
            accessLogIds.reserve(entries.size());
            for (const auto& entry : entries) {
                if (entry.userId.has_value()) userIdSet.insert(*entry.userId);
                if (entry.portalId.has_value()) portalIdSet.insert(*entry.portalId);
                accessLogIds.push_back(entry.id);
            }
            std::vector<int64_t> userIds(userIdSet.begin(), userIdSet.end());

            auto userNames = client.users().getNamesByIds(userIds);
            std::map<int64_t, std::string> portalNames;
            for (const auto& portal : client.portals().list()) {
                portalNames[portal.id] = portal.name;
            }
            auto timeZoneNames = client.accessLogs().timeZoneNamesForAccessLogIds(accessLogIds);

            nlohmann::json entriesJson = nlohmann::json::array();
            for (const auto& entry : entries) {
                std::string userName, employeeId, portalName, timeZoneName;
                if (entry.userId.has_value()) {
                    auto it = userNames.find(*entry.userId);
                    if (it != userNames.end()) {
                        userName = it->second.first;
                        employeeId = it->second.second;
                    }
                }
                if (entry.portalId.has_value()) {
                    auto it = portalNames.find(*entry.portalId);
                    if (it != portalNames.end()) {
                        portalName = it->second;
                    }
                }
                auto tzIt = timeZoneNames.find(entry.id);
                if (tzIt != timeZoneNames.end()) {
                    timeZoneName = tzIt->second;
                }
                entriesJson.push_back(toJson(entry, userName, employeeId, portalName, timeZoneName));
            }

            nlohmann::json responseBody = {{"entries", entriesJson}, {"total", total}};
            res.set_content(responseBody.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });
}

}  // namespace amico::backend
