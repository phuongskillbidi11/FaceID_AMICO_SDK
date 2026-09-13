// Gated live WRITE test for Giai đoạn 2b's rich-profile UsersApi methods.
// Disabled by default -- requires AMICO_ENABLE_LIVE_TESTS=1 and
// AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD to be set, and a fresh,
// distinct APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id> approval message
// before it is ever run.
//
// Scope (per .plans/2026-09-12-phase2b.../tasks.md Task 5.1): card
// add/remove, group membership add/remove, image set/remove -- using a
// disposable test user, never a pre-existing one. setAdministrator and
// setPassword are DELIBERATELY NOT exercised here -- they require their
// own separate confirmation (Tasks 5.3/5.4), never bundled into this run.
//
// Safety invariants (same as live_write_test.cpp from Giai đoạn 2):
//   - Always creates its own disposable test user, named
//     "SDK_TEST_DELETE_ME_<unix time>" -- never touches a pre-existing
//     user, never matches by name.
//   - remove() is only ever called with the exact int64_t id returned by
//     this same run's create() call.
//   - Best-effort cleanup runs even if a later step throws.
//   - The test group id (1, "Standard") was confirmed via a read-only
//     live check of the real Groups page before this test was written --
//     it is NOT "Everywhere" (id 2), which would grant broader physical
//     access than appropriate for a disposable test membership.
//
// Sample images: this test reads one of the two user-supplied sample
// photos directly from disk (never invented/generated) -- the operator
// must have these files present at the paths below for the image step
// to run; if absent, the image step is skipped with a clear message
// rather than failing the whole run.

#include <algorithm>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

namespace {
std::string envOrEmpty(const char* name) {
    const char* value = std::getenv(name);
    return value != nullptr ? std::string(value) : std::string();
}

#ifdef _WIN32
// std::ifstream's narrow-string constructor resolves the path through
// the CRT, which interprets a std::string as the current ANSI codepage
// -- NOT UTF-8. A UTF-8-encoded path with non-ASCII characters (e.g.
// this test's Vietnamese sample filenames) silently fails to open under
// that interpretation. MSVC's STL provides a non-standard wchar_t
// overload specifically for this; convert explicitly via
// MultiByteToWideChar(CP_UTF8, ...) rather than relying on the CRT's
// locale-dependent narrow-to-wide conversion.
std::wstring utf8PathToWide(const std::string& utf8) {
    if (utf8.empty()) return std::wstring();
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), nullptr, 0);
    if (size <= 0) return std::wstring();
    std::wstring wide(static_cast<std::size_t>(size), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), &wide[0], size);
    return wide;
}
#endif

std::vector<uint8_t> readFileBytes(const std::string& path) {
#ifdef _WIN32
    std::ifstream file(utf8PathToWide(path), std::ios::binary);
#else
    std::ifstream file(path, std::ios::binary);
#endif
    if (!file) {
        return {};
    }
    return std::vector<uint8_t>((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
}

constexpr int64_t kTestGroupId = 1;  // "Standard" -- confirmed read-only, not "Everywhere" (id 2)
constexpr int64_t kTestAreaCode = 0;
constexpr int64_t kTestCardNumber = 999001;  // arbitrary test value, unlikely to collide with a real card
}  // namespace

int main() {
    if (envOrEmpty("AMICO_ENABLE_LIVE_TESTS") != "1") {
        std::cout << "amico_live_write_profile_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)\n";
        return 0;
    }

    amico::AmicoConfig config;
    config.baseUrl = envOrEmpty("AMICO_BASE_URL");
    config.username = envOrEmpty("AMICO_USERNAME");
    config.password = envOrEmpty("AMICO_PASSWORD");

    if (config.baseUrl.empty() || config.username.empty() || config.password.empty()) {
        std::cerr << "amico_live_write_profile_test: AMICO_ENABLE_LIVE_TESTS=1 but "
                     "AMICO_BASE_URL/AMICO_USERNAME/AMICO_PASSWORD are not all set\n";
        return 1;
    }

    const std::string suffix = std::to_string(static_cast<long long>(std::time(nullptr)));
    const std::string testName = "SDK_TEST_DELETE_ME_" + suffix;
    const std::string testRegistration = "SDK-TEST-PROFILE-" + suffix;

    bool ok = true;
    int64_t testUserId = -1;

    try {
        amico::AmicoClient client(config);

        std::cout << "1/9 login... ";
        client.login();
        std::cout << "ok\n";

        std::cout << "2/9 create test user '" << testName << "'... ";
        amico::NewUser newUser;
        newUser.name = testName;
        newUser.registration = testRegistration;
        testUserId = client.users().create(newUser);
        std::cout << "ok, id=" << testUserId << "\n";

        std::cout << "3/9 addCard(areaCode=" << kTestAreaCode << ", cardNumber=" << kTestCardNumber << ")... ";
        int64_t cardId = client.users().addCard(testUserId, kTestAreaCode, kTestCardNumber);
        std::cout << "ok, cardId=" << cardId << "\n";

        std::cout << "4/9 verify cardCount == 1 via get(id)... ";
        auto afterAddCard = client.users().get(testUserId);
        if (!afterAddCard.has_value() || afterAddCard->cardCount != 1) {
            std::cerr << "MISMATCH -- expected cardCount == 1 after addCard\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "5/9 removeCard(id=" << cardId << ")... ";
        client.users().removeCard(cardId);
        auto afterRemoveCard = client.users().get(testUserId);
        if (!afterRemoveCard.has_value() || afterRemoveCard->cardCount != 0) {
            std::cerr << "MISMATCH -- expected cardCount == 0 after removeCard\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "6/9 addToGroup(groupId=" << kTestGroupId << ", \"Standard\")... ";
        client.users().addToGroup(testUserId, kTestGroupId);
        auto afterAddGroup = client.users().get(testUserId);
        bool groupPresent = afterAddGroup.has_value() &&
                             std::find(afterAddGroup->groupIds.begin(), afterAddGroup->groupIds.end(), kTestGroupId) !=
                                 afterAddGroup->groupIds.end();
        if (!groupPresent) {
            std::cerr << "MISMATCH -- expected groupIds to contain " << kTestGroupId << " after addToGroup\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "7/9 removeFromGroup(groupId=" << kTestGroupId << ")... ";
        client.users().removeFromGroup(testUserId, kTestGroupId);
        auto afterRemoveGroup = client.users().get(testUserId);
        bool groupGone = afterRemoveGroup.has_value() &&
                          std::find(afterRemoveGroup->groupIds.begin(), afterRemoveGroup->groupIds.end(),
                                    kTestGroupId) == afterRemoveGroup->groupIds.end();
        if (!groupGone) {
            std::cerr << "MISMATCH -- expected groupIds to no longer contain " << kTestGroupId
                       << " after removeFromGroup\n";
            ok = false;
        } else {
            std::cout << "ok\n";
        }

        std::cout << "8/9 setImage/removeImage using a user-supplied sample photo... ";
        // Attempt #2 (2026-09-12) found the device requires JPEG-encoded
        // bytes for user_set_image -- the original .png sample was
        // rejected with HTTP 400 (see docs/ui-action-protocol-map.md's
        // "Image encoding requirement" finding). This path points at a
        // one-off local JPEG re-encode of the same sample photo (not
        // shipped SDK code -- setImage() itself does no format
        // conversion; the caller must supply JPEG bytes).
        // Written directly as UTF-8 (this source file is saved as UTF-8,
        // compiled with /utf-8 -- see CMakeLists.txt). If the operator's
        // environment can't resolve this exact filename via the
        // narrow-string ifstream API, readFileBytes() returns empty and
        // this step is SKIPPED below, not treated as a failure.
        const std::string samplePath = "C:\\Users\\Admin\\Downloads\\Ung_Hoang_Phuc_converted.jpg";
        std::vector<uint8_t> photoBytes = readFileBytes(samplePath);
        if (photoBytes.empty()) {
            std::cout << "SKIPPED (sample file not found at expected path -- not counted as a failure)\n";
        } else {
            client.users().setImage(testUserId, photoBytes);
            client.users().removeImage(testUserId);
            std::cout << "ok (setImage + removeImage both completed without error; this SDK's public API has "
                         "no way to read the image back to confirm bytes match, by design -- see "
                         "docs/ui-action-protocol-map.md)\n";
        }

        std::cout << "9/9 remove test user id=" << testUserId << "... ";
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
                          << "') may still exist on the device, possibly with a test card/group/image "
                             "attached. The operator must check the Users page and delete it manually if "
                             "present.\n";
            }
        }
    }

    std::cout << (ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
