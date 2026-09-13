// Gated live WRITE test. Disabled by default -- requires
// AMICO_ENABLE_LIVE_TESTS=1 and AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD
// to be set, and a fresh, distinct APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>
// approval message before it is ever run -- unlike live_smoke_test.cpp
// (100% read-only), this test CREATES, UPDATES, and DELETES a real user
// record on the device.
//
// Safety invariants (see .plans/2026-09-12-phase2-user-crud-write-api/
// tasks.md Task 5.1/spec.md Decision 4):
//   - Always creates its own disposable test user, named
//     "SDK_TEST_DELETE_ME_<unix time>" -- never touches a pre-existing
//     user, never matches by name.
//   - remove() is only ever called with the exact int64_t id returned by
//     this same run's create() call -- never a hardcoded or assumed id.
//   - Best-effort cleanup runs even if a later step throws, using that
//     same known id, so a mid-test failure does not necessarily leave the
//     test user behind. If cleanup itself fails, the operator is told
//     explicitly to check the Users page and delete it manually.
//
// Six numbered steps: login -> create -> verify created fields -> update
// one field -> verify updated fields -> remove -> verify gone.

#include <cstdlib>
#include <ctime>
#include <exception>
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
        std::cout << "amico_live_write_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)\n";
        return 0;
    }

    amico::AmicoConfig config;
    config.baseUrl = envOrEmpty("AMICO_BASE_URL");
    config.username = envOrEmpty("AMICO_USERNAME");
    config.password = envOrEmpty("AMICO_PASSWORD");

    if (config.baseUrl.empty() || config.username.empty() || config.password.empty()) {
        std::cerr << "amico_live_write_test: AMICO_ENABLE_LIVE_TESTS=1 but "
                     "AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD are not all set\n";
        return 1;
    }

    const std::string suffix = std::to_string(static_cast<long long>(std::time(nullptr)));
    const std::string testName = "SDK_TEST_DELETE_ME_" + suffix;
    const std::string testRegistration = "SDK-TEST-" + suffix;

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

        std::cout << "3/6 verify created fields via get(id)... ";
        auto created = client.users().get(testUserId);
        if (!created.has_value() || created->name != testName || created->registration != testRegistration) {
            std::cerr << "MISMATCH -- get(id) after create did not return the expected name/registration\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "4/6 update (name only, registration left unset)... ";
        amico::UserUpdate change;
        change.id = testUserId;
        change.name = testName + "_UPDATED";
        client.users().update(change);
        std::cout << "ok\n";

        std::cout << "5/6 verify updated fields via get(id)... ";
        auto updated = client.users().get(testUserId);
        if (!updated.has_value() || updated->name != testName + "_UPDATED" ||
            updated->registration != testRegistration) {
            std::cerr << "MISMATCH -- get(id) after update did not return the expected name "
                         "(and unchanged registration)\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "6/6 remove test user id=" << testUserId << "... ";
        client.users().remove(testUserId);
        std::cout << "ok\n";

        std::cout << "verify removal via get(id)... ";
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

        // Best-effort cleanup: only if create() had already returned an id
        // (never a hardcoded/assumed one) and something later threw before
        // this run's own remove() step ran.
        if (testUserId > 0) {
            try {
                amico::AmicoClient cleanupClient(config);
                cleanupClient.login();
                cleanupClient.users().remove(testUserId);
                cleanupClient.logout();
                std::cerr << "cleanup: removed test user id=" << testUserId << " after the exception above\n";
            } catch (...) {
                std::cerr << "CLEANUP FAILED -- test user id=" << testUserId << " (name '" << testName
                          << "') may still exist on the device. The operator must check the Users page "
                             "and delete it manually if present.\n";
            }
        }
    }

    std::cout << (ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
