// Gated live WRITE test for Giai đoạn 2b's Task 5.3 (setAdministrator).
// Disabled by default -- requires AMICO_ENABLE_LIVE_TESTS=1 and
// AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD to be set, AND a fresh,
// distinct confirmation for this exact action (granting/revoking the
// Administrator flag) -- never inferred from any other live-write
// approval, per feedback_write_api_risk_tiers.md's "always ask before
// each live execution" tier.
//
// Scope: create a disposable test user, grant admin, verify true,
// revoke admin, verify false, remove the test user. NEVER run against
// Admin/Phuong Hoang or any pre-existing real user id.

#include <cstdlib>
#include <ctime>
#include <iostream>
#include <string>

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
        std::cout << "amico_live_admin_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)\n";
        return 0;
    }

    amico::AmicoConfig config;
    config.baseUrl = envOrEmpty("AMICO_BASE_URL");
    config.username = envOrEmpty("AMICO_USERNAME");
    config.password = envOrEmpty("AMICO_PASSWORD");

    if (config.baseUrl.empty() || config.username.empty() || config.password.empty()) {
        std::cerr << "amico_live_admin_test: AMICO_ENABLE_LIVE_TESTS=1 but "
                     "AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD are not all set\n";
        return 1;
    }

    const std::string suffix = std::to_string(static_cast<long long>(std::time(nullptr)));
    const std::string testName = "SDK_TEST_DELETE_ME_" + suffix;
    const std::string testRegistration = "SDK-TEST-ADMIN-" + suffix;

    bool ok = true;
    int64_t testUserId = -1;

    try {
        amico::AmicoClient client(config);

        std::cout << "1/6 login... ";
        client.login();
        std::cout << "ok\n";

        std::cout << "2/6 create test user '" << testName << "'... ";
        amico::NewUser newUser;
        newUser.name = testName;
        newUser.registration = testRegistration;
        testUserId = client.users().create(newUser);
        std::cout << "ok, id=" << testUserId << "\n";

        std::cout << "3/6 setAdministrator(true)... ";
        client.users().setAdministrator(testUserId, true);
        auto afterGrant = client.users().get(testUserId);
        if (!afterGrant.has_value() || afterGrant->isAdministrator != true) {
            std::cerr << "MISMATCH -- expected isAdministrator == true after grant\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "4/6 verify isAdministrator == true via get(id)... ok (checked above)\n";

        std::cout << "5/6 setAdministrator(false)... ";
        client.users().setAdministrator(testUserId, false);
        auto afterRevoke = client.users().get(testUserId);
        if (!afterRevoke.has_value() || afterRevoke->isAdministrator != false) {
            std::cerr << "MISMATCH -- expected isAdministrator == false after revoke\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "6/6 remove test user id=" << testUserId << "... ";
        client.users().remove(testUserId);
        auto shouldBeGone = client.users().get(testUserId);
        if (shouldBeGone.has_value()) {
            std::cerr << "MISMATCH -- test user still present after remove()\n";
            ok = false;
        } else {
            std::cout << "confirmed gone\n";
        }

        client.logout();
    } catch (const std::exception& e) {
        std::cerr << "exception: " << e.what() << "\n";
        ok = false;

        if (testUserId > 0) {
            try {
                amico::AmicoClient cleanupClient(config);
                cleanupClient.login();
                cleanupClient.users().remove(testUserId);
                cleanupClient.logout();
                std::cerr << "cleanup: removed test user id=" << testUserId << " after the exception above\n";
            } catch (...) {
                std::cerr << "CLEANUP FAILED -- test user id=" << testUserId << " (name '" << testName
                          << "') may still exist on the device, possibly with Administrator granted. The "
                             "operator must check the Users page and delete/revoke manually if present.\n";
            }
        }
    }

    std::cout << (ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
