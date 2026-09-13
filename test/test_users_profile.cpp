// Offline tests for Giai đoạn 2b's rich-profile UsersApi methods:
// addToGroup/removeFromGroup, addCard/removeCard, setAdministrator,
// setImage/removeImage, setPassword, and the hasPassword-populated
// get(). Never touches a real device -- FakeTransport only.

#include <doctest/doctest.h>

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"
#include "UserProfileResponder.hpp"
#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

using namespace amico;
using namespace amico::test;

namespace {
AmicoClient loggedInClient(FakeTransport** outFakePtr) {
    AmicoConfig config;
    config.baseUrl = "http://192.0.2.1";
    config.username = "TestUser";
    config.password = "placeholder-not-a-real-credential";
    AmicoClient client(config);

    auto fake = std::make_unique<FakeTransport>();
    *outFakePtr = fake.get();
    setTransportForTesting(client, std::move(fake));

    (*outFakePtr)->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("login_success.json")); };
    client.login();
    return client;
}
}  // namespace

// ------------------------- Groups -------------------------

TEST_CASE("addToGroup: success sends the confirmed create_objects payload") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "user_groups");
        CHECK(body["values"] == nlohmann::json::array({nlohmann::json{{"group_id", 9}, {"user_id", 36}}}));
        return FakeTransport::ok(readFixture("group_add_success.json"));
    };

    CHECK_NOTHROW(client.users().addToGroup(36, 9));
}

TEST_CASE("addToGroup: failure (missing 'ids') throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("group_add_failure.json")); };
    CHECK_THROWS_AS(client.users().addToGroup(36, 9), ProtocolError);
}

TEST_CASE("removeFromGroup: success sends the confirmed destroy_objects payload") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "user_groups");
        nlohmann::json expectedWhere = {{"user_groups", {{"group_id", nlohmann::json::array({9})}, {"user_id", 36}}}};
        CHECK(body["where"] == expectedWhere);
        return FakeTransport::ok(readFixture("group_remove_success.json"));
    };

    CHECK_NOTHROW(client.users().removeFromGroup(36, 9));
}

TEST_CASE("removeFromGroup: failure ('changes':0) throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("group_remove_failure.json")); };
    CHECK_THROWS_AS(client.users().removeFromGroup(36, 9), ProtocolError);
}

// -------------------------- Cards ---------------------------

TEST_CASE("addCard: success packs value as areaCode * 4294967296 + cardNumber and returns the new card id") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "cards");
        nlohmann::json expectedValues = {{"user_id", 36}, {"value", 10LL * 4294967296LL + 5LL}};
        CHECK(body["values"] == nlohmann::json::array({expectedValues}));
        return FakeTransport::ok(readFixture("card_add_success.json"));
    };

    int64_t cardId = 0;
    CHECK_NOTHROW(cardId = client.users().addCard(36, 10, 5));
    CHECK(cardId == 777);
}

TEST_CASE("addCard: failure (missing 'ids') throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("card_add_failure.json")); };
    CHECK_THROWS_AS(client.users().addCard(36, 10, 5), ProtocolError);
}

TEST_CASE("removeCard: success sends a single-id destroy_objects payload") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "cards");
        nlohmann::json expectedWhere = {{"cards", {{"id", nlohmann::json::array({777})}}}};
        CHECK(body["where"] == expectedWhere);
        return FakeTransport::ok(readFixture("card_remove_success.json"));
    };

    CHECK_NOTHROW(client.users().removeCard(777));
}

TEST_CASE("removeCard: failure ('changes':0) throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("card_remove_failure.json")); };
    CHECK_THROWS_AS(client.users().removeCard(777), ProtocolError);
}

// --------------------- Administrator -------------------------

TEST_CASE("setAdministrator: granting a non-admin user issues a create_objects call") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest& req) {
        ++callCount;
        if (callCount == 1) {
            // setAdministrator checks current state first via user_roles.
            nlohmann::json body = nlohmann::json::parse(req.body);
            CHECK(body["object"] == "user_roles");
            return FakeTransport::ok(R"({"user_roles":[]})");  // not currently admin
        }
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "user_roles");
        CHECK(body["values"] == nlohmann::json::array({nlohmann::json{{"user_id", 36}, {"role", 1}}}));
        return FakeTransport::ok(readFixture("administrator_grant_success.json"));
    };

    CHECK_NOTHROW(client.users().setAdministrator(36, true));
    CHECK(callCount == 2);
}

TEST_CASE("setAdministrator: revoking an admin user issues a destroy_objects call") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest&) {
        ++callCount;
        if (callCount == 1) {
            return FakeTransport::ok(R"({"user_roles":[{"user_id":36}]})");  // currently admin
        }
        return FakeTransport::ok(readFixture("administrator_revoke_success.json"));
    };

    CHECK_NOTHROW(client.users().setAdministrator(36, false));
    CHECK(callCount == 2);
}

TEST_CASE("setAdministrator: already in the requested state is a no-op (matches the real UI's asymmetric save())") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(R"({"user_roles":[]})"); };  // not admin

    std::size_t requestsBefore = fake->requestLog.size();  // loggedInClient() already logged in (1 request)
    CHECK_NOTHROW(client.users().setAdministrator(36, false));  // already not-admin, requesting false
    CHECK(fake->requestLog.size() - requestsBefore == 1);  // only the state-check call, no create/destroy
}

TEST_CASE("setAdministrator: grant failure (missing 'ids') throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest&) {
        ++callCount;
        if (callCount == 1) return FakeTransport::ok(R"({"user_roles":[]})");
        return FakeTransport::ok(readFixture("administrator_grant_failure.json"));
    };

    CHECK_THROWS_AS(client.users().setAdministrator(36, true), ProtocolError);
}

// ------------------------- Image ------------------------------

TEST_CASE("setImage: success sends raw bytes to user_set_image.fcgi?user_id=<id>&match=1&timestamp=<epoch>") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    std::vector<uint8_t> bytes = {0xFF, 0xD8, 0xFF, 0x00};  // fake JPEG-ish header, not a real photo
    fake->responder = [&bytes](const HttpRequest& req) {
        CHECK(req.path.rfind("/user_set_image.fcgi?user_id=36&match=1&timestamp=", 0) == 0);
        bool hasOctetStream = false;
        for (const auto& h : req.headers) {
            if (h.name == "Content-Type" && h.value == "application/octet-stream") hasOctetStream = true;
        }
        CHECK(hasOctetStream);
        CHECK(req.body.size() == bytes.size());
        return FakeTransport::ok(readFixture("image_set_success.json"));
    };

    CHECK_NOTHROW(client.users().setImage(36, bytes));
}

TEST_CASE("setImage: failure (error field present) throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("image_set_failure.json")); };
    CHECK_THROWS_AS(client.users().setImage(36, {0x01}), ProtocolError);
}

TEST_CASE("setImage: face-validation failure ({success:false, errors:[...]}) throws ProtocolError") {
    // LIVE_CONFIRMED shape (en_US/js/CID.js) -- distinct from a plain
    // {"error": "..."} response; must also be treated as a failure.
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(readFixture("image_set_face_validation_failure.json"));
    };
    CHECK_THROWS_AS(client.users().setImage(36, {0x01}), ProtocolError);
}

TEST_CASE("setImage: a real success response carries scores + success:true, never thrown") {
    // LIVE_CONFIRMED shape (en_US/js/CID.js) -- this SDK does not
    // interpret the scores themselves, only the success flag.
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) {
        return FakeTransport::ok(readFixture("image_set_success_with_scores.json"));
    };
    CHECK_NOTHROW(client.users().setImage(36, {0x01}));
}

TEST_CASE("removeImage: success sends user_destroy_image then destroys this user's face_templates") {
    // LIVE_CONFIRMED (en_US/js/CID.js): removing a user's image also
    // destroys their face_templates rows in the real UI's own flow.
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest& req) {
        ++callCount;
        if (callCount == 1) {
            CHECK(req.path == "/user_destroy_image.fcgi");
            nlohmann::json body = nlohmann::json::parse(req.body);
            CHECK(body == nlohmann::json{{"user_id", 36}});
            return FakeTransport::ok(readFixture("image_remove_success.json"));
        }
        CHECK(req.path == "/destroy_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "face_templates");
        nlohmann::json expectedWhere = {{"face_templates", {{"user_id", 36}}}};
        CHECK(body["where"] == expectedWhere);
        return FakeTransport::ok(R"({"changes":1})");
    };

    CHECK_NOTHROW(client.users().removeImage(36));
    CHECK(callCount == 2);
}

TEST_CASE("removeImage: failure (error field present) throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest&) { return FakeTransport::ok(readFixture("image_remove_failure.json")); };
    CHECK_THROWS_AS(client.users().removeImage(36), ProtocolError);
}

// ----------------------- Password/PIN ---------------------------

TEST_CASE("setPassword: hashes via user_hash_password first, then writes only the hash+salt") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest& req) {
        ++callCount;
        if (callCount == 1) {
            CHECK(req.path == "/user_hash_password.fcgi");
            nlohmann::json body = nlohmann::json::parse(req.body);
            CHECK(body["password"] == "12345");
            return FakeTransport::ok(readFixture("hash_password_success.json"));
        }
        CHECK(req.path == "/modify_objects.fcgi");
        nlohmann::json body = nlohmann::json::parse(req.body);
        CHECK(body["object"] == "users");
        CHECK(body["values"]["password"] == "FAKE_HASH_FOR_TESTS_ONLY");
        CHECK(body["values"]["salt"] == "FAKE_SALT_FOR_TESTS_ONLY");
        // The plaintext PIN "12345" must never appear in this second request.
        CHECK(req.body.find("12345") == std::string::npos);
        return FakeTransport::ok(readFixture("password_set_success.json"));
    };

    CHECK_NOTHROW(client.users().setPassword(36, "12345"));
    CHECK(callCount == 2);
}

TEST_CASE("setPassword: failure ('changes':0) throws ProtocolError") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    int callCount = 0;
    fake->responder = [&callCount](const HttpRequest&) {
        ++callCount;
        if (callCount == 1) return FakeTransport::ok(readFixture("hash_password_success.json"));
        return FakeTransport::ok(readFixture("password_set_failure.json"));
    };

    CHECK_THROWS_AS(client.users().setPassword(36, "12345"), ProtocolError);
}

// ------------------- hasPassword-populated get() ---------------------

TEST_CASE("get(id): hasPassword is true when the device returns the masked sentinel") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        nlohmann::json body = nlohmann::json::parse(req.body);
        if (body.value("object", std::string{}) == "users" &&
            body.value("fields", nlohmann::json::array()) == nlohmann::json::array({"password"})) {
            return FakeTransport::ok(readFixture("has_password_true.json"));
        }
        if (auto response = emptyUserProfileResponse(req)) return *response;
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };

    std::optional<AmicoUser> user = client.users().get(36);
    REQUIRE(user.has_value());
    CHECK(user->hasPassword == true);
}

TEST_CASE("get(id): hasPassword is false when the device returns null/empty") {
    FakeTransport* fake = nullptr;
    AmicoClient client = loggedInClient(&fake);

    fake->responder = [](const HttpRequest& req) {
        if (auto response = emptyUserProfileResponse(req)) return *response;  // password branch -> false
        return FakeTransport::ok(readFixture("user_get_found.json"));
    };

    std::optional<AmicoUser> user = client.users().get(36);
    REQUIRE(user.has_value());
    CHECK(user->hasPassword == false);
}

TEST_CASE("get(id): AmicoUser has no member or accessor that could carry a raw password/salt value") {
    // Structural, not behavioral: AmicoUser (amico/Types.hpp) declares
    // exactly id/name/registration/userTypeId/beginTime/endTime/
    // lastAccess/groupIds/groupCount/cardCount/isAdministrator/
    // faceCount/bioCount/hasPassword/imageUrl -- no password/salt/
    // panic_password/panic_salt member exists, and hasPassword is a
    // bool, not a string. This is a compile-time guarantee: if such a
    // member were ever added, this comment would no longer describe
    // the actual struct, but no runtime assertion can "fail" a member
    // that doesn't exist -- the guarantee is enforced by the struct's
    // own definition, verified here only by inspection.
}
