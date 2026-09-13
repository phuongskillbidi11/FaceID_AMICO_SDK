// Gated live READ-ONLY smoke test for amico_backend. Disabled by
// default -- requires AMICO_ENABLE_LIVE_TESTS=1 and
// AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD to be set, and a fresh,
// distinct APPROVE_LIVE_DEVICE_TEST:<plan-id> approval message.
//
// This starts the REAL amico_backend server (real AmicoClient, real
// CurlTransport, real device config) on an ephemeral loopback port,
// then calls only read-only routes: /health, /system-information,
// GET /users. There is NO live-write test through the backend --
// every underlying SDK write is already live-verified from Giai đoạn
// 2/2b; this test only proves the HTTP layer itself works end-to-end
// against the real device.

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "BackendConfig.hpp"
#include "Routes.hpp"
#include "amico/Client.hpp"

namespace {
std::string envOrEmpty(const char* name) {
    const char* value = std::getenv(name);
    return value != nullptr ? std::string(value) : std::string();
}
}  // namespace

int main() {
    if (envOrEmpty("AMICO_ENABLE_LIVE_TESTS") != "1") {
        std::cout << "amico_backend_live_smoke_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)\n";
        return 0;
    }

    const auto deviceUrl = envOrEmpty("AMICO_BASE_URL");
    const auto username = envOrEmpty("AMICO_USERNAME");
    const auto password = envOrEmpty("AMICO_PASSWORD");
    if (deviceUrl.empty() || username.empty() || password.empty()) {
        std::cerr << "amico_backend_live_smoke_test: AMICO_ENABLE_LIVE_TESTS=1 but "
                     "AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD are not all set\n";
        return 1;
    }

    bool ok = true;
    try {
        amico::backend::SessionStore sessions;
        auto sessionLock = sessions.acquire();
        std::cout << "1/4 login... ";
        sessions.login(deviceUrl, username, password);
        const auto cookie = "amico_session=" + sessions.sessionToken();
        sessionLock.unlock();
        std::cout << "ok\n";

        httplib::Server svr;
        amico::backend::registerAll(svr, sessions);
        int port = svr.bind_to_any_port("127.0.0.1");
        std::thread serverThread([&svr] { svr.listen_after_bind(); });
        while (!svr.is_running()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }

        httplib::Client http("127.0.0.1", port);
        http.set_default_headers({{"Cookie", cookie}});

        std::cout << "2/4 GET /health... ";
        auto health = http.Get("/health");
        if (!health || health->status != 200) {
            std::cerr << "MISMATCH -- expected 200 from /health\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "3/4 GET /system-information... ";
        auto sysInfo = http.Get("/system-information");
        if (!sysInfo || sysInfo->status != 200) {
            std::cerr << "MISMATCH -- expected 200 from /system-information\n";
            ok = false;
        } else {
            nlohmann::json body = nlohmann::json::parse(sysInfo->body);
            if (!body.contains("serial") || !body.contains("network")) {
                std::cerr << "MISMATCH -- /system-information response missing expected fields\n";
                ok = false;
            } else {
                std::cout << "ok\n";
            }
        }

        std::cout << "4/4 GET /users... ";
        auto users = http.Get("/users");
        if (!users || users->status != 200) {
            std::cerr << "MISMATCH -- expected 200 from /users\n";
            ok = false;
        } else {
            nlohmann::json body = nlohmann::json::parse(users->body);
            if (!body.is_array()) {
                std::cerr << "MISMATCH -- /users response is not a JSON array\n";
                ok = false;
            } else {
                std::cout << "ok (" << body.size() << " user(s))\n";
            }
        }

        svr.stop();
        serverThread.join();
        sessionLock.lock();
        sessions.logout();
    } catch (const std::exception&) {
        std::cerr << "backend live smoke test failed (exception details suppressed to protect credentials)\n";
        ok = false;
    }

    std::cout << (ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
