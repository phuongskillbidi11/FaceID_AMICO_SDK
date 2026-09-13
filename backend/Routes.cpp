#include "Routes.hpp"

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
            query.limit = queryParamInt(req, "limit", 0);
        } catch (const std::exception& e) {
            respondInvalidRequest(res, e.what());
            return;
        }
        try {
            nlohmann::json arr = nlohmann::json::array();
            for (const auto& entry : client.accessLogs().list(query)) {
                arr.push_back(toJson(entry));
            }
            res.set_content(arr.dump(), "application/json");
        } catch (const std::exception& e) {
            respondError(res, e);
        }
    });
}

}  // namespace amico::backend
