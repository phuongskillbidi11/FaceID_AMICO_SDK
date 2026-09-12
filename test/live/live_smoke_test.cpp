// Gated live smoke test. Disabled by default -- requires
// AMICO_ENABLE_LIVE_TESTS=1 and AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD
// to be set. Nine numbered steps, with preflight and login combined:
//   preflight -> login -> session-valid (required true) -> system information
//   -> conditional HTTPS/TLS observation -> list users (small limit)
//   -> get(id) (required present and matching; empty list means PARTIAL)
//   -> list recent access logs (small limit) -> logout -> session-valid
//   after logout (required false). Only confirmed read-only operations.
// Never prints a full user record -- only counts, firmware, and check results.

#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <string>

#include "NetworkSafety.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

namespace {
std::string envOrEmpty(const char* name) {
    const char* value = std::getenv(name);
    return value != nullptr ? std::string(value) : std::string();
}
}  // namespace

int main() {
    if (envOrEmpty("AMICO_ENABLE_LIVE_TESTS") != "1") {
        std::cout << "amico_live_smoke_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)\n";
        return 0;
    }

    amico::AmicoConfig config;
    config.baseUrl = envOrEmpty("AMICO_BASE_URL");
    config.username = envOrEmpty("AMICO_USERNAME");
    config.password = envOrEmpty("AMICO_PASSWORD");

    if (config.baseUrl.empty() || config.username.empty() || config.password.empty()) {
        std::cerr << "amico_live_smoke_test: AMICO_ENABLE_LIVE_TESTS=1 but "
                     "AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD are not all set\n";
        return 1;
    }

    try {
        amico::AmicoClient client(config);

        std::cout << "1/9 preflight+login... ";
        const auto result = amico::detail::reachableThenLogin(client);
        if (!result.reachable) {
            std::cerr << "RESULT: FAIL -- device unreachable: " << result.reachabilityError << "\n";
            return 1;
        }
        std::cout << "ok\n";

        std::cout << "2/9 session valid... ";
        const bool validAfterLogin = client.isSessionValid();
        std::cout << (validAfterLogin ? "true" : "false") << "\n";
        if (!validAfterLogin) {
            std::cerr << "RESULT: FAIL -- session not valid immediately after login\n";
            return 1;
        }

        std::cout << "3/9 system information... ";
        amico::SystemInformation info = client.getSystemInformation();
        std::cout << "firmware=" << info.firmwareVersion << " secbox=" << info.secboxVersion << "\n";

        std::cout << "4/9 HTTPS/TLS observation... ";
        std::unique_ptr<amico::AmicoClient> httpsClient;
        if (info.network.sslEnabled) {
            const auto hostStart = config.baseUrl.find("://") + 3;
            const auto hostEnd = config.baseUrl.find('/', hostStart);
            std::string host = config.baseUrl.substr(hostStart, hostEnd - hostStart);
            // Keep bracketed IPv6 hosts intact; the HTTP port is not the HTTPS port.
            if (host.front() == '[') {
                host = host.substr(0, host.find(']') + 1);
            } else {
                host = host.substr(0, host.find(':'));
            }
            amico::AmicoConfig httpsConfig;
            httpsConfig.baseUrl = "https://" + host;
            httpsClient = std::make_unique<amico::AmicoClient>(httpsConfig);
        }
        const auto probe = amico::detail::probeHttpsIfEnabled(info.network.sslEnabled, httpsClient.get());
        switch (probe.outcome) {
        case amico::detail::TlsProbeOutcome::NotApplicable:
            std::cout << "HTTPS/TLS: not enabled on this device (observed via system information) -- skipped\n";
            break;
        case amico::detail::TlsProbeOutcome::Verified:
            std::cout << "HTTPS/TLS: verified\n";
            break;
        case amico::detail::TlsProbeOutcome::VerifyFailed:
            std::cout << "HTTPS/TLS: verify-failed (expected if self-signed, see selfSignedCertificate="
                      << (info.network.selfSignedCertificate ? "true" : "false") << ")\n";
            break;
        case amico::detail::TlsProbeOutcome::NetworkFailure:
            std::cerr << "RESULT: FAIL -- HTTPS/TLS: network-failure: " << probe.detail << "\n";
            return 1;
        }

        std::cout << "5/9 list users (limit 5)... ";
        amico::UserQuery userQuery;
        userQuery.limit = 5;
        auto users = client.users().list(userQuery);
        std::cout << users.size() << " user(s)\n";

        std::cout << "6/9 get(id)... ";
        const bool getSkipped = users.empty();
        if (getSkipped) {
            std::cout << "get(id): skipped -- no users returned by list()\n";
        } else {
            const auto user = client.users().get(users.front().id);
            const bool matched = user.has_value() && user->id == users.front().id;
            std::cout << "found=" << (user.has_value() ? "true" : "false")
                      << " matched=" << (matched ? "true" : "false") << "\n";
            if (!matched) {
                std::cerr << "RESULT: FAIL -- get(id) did not return the requested user\n";
                return 1;
            }
        }

        std::cout << "7/9 list recent access logs (limit 5)... ";
        amico::AccessLogQuery logQuery;
        logQuery.limit = 5;
        auto logs = client.accessLogs().list(logQuery);
        std::cout << logs.size() << " entr(y/ies)\n";

        std::cout << "8/9 logout... ";
        client.logout();
        std::cout << "ok\n";

        std::cout << "9/9 session valid after logout... ";
        const bool validAfterLogout = client.isSessionValid();
        std::cout << (validAfterLogout ? "true" : "false") << "\n";

        if (validAfterLogout) {
            std::cerr << "RESULT: FAIL -- session still valid after logout\n";
            return 1;
        }
        if (getSkipped) {
            std::cout << "RESULT: PARTIAL -- get(id) skipped because list() returned no users\n";
            return 1;
        }
        std::cout << "RESULT: PASS\n";
        return 0;
    } catch (const amico::AmicoError& e) {
        std::cerr << "RESULT: FAIL -- " << e.what() << "\n";
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "RESULT: FAIL -- unexpected exception: " << e.what() << "\n";
        return 1;
    }
}
