#pragma once

#include <optional>

#include <nlohmann/json.hpp>

#include "FakeTransport.hpp"

namespace amico::test {

// Opt in inside responders that return users. Unrecognized requests remain
// the caller's responsibility, so unexpected queries cannot silently succeed.
inline std::optional<HttpResponse> emptyUserProfileResponse(const HttpRequest& request) {
    if (request.method != "POST" || request.path != "/load_objects.fcgi") return std::nullopt;

    const auto body = nlohmann::json::parse(request.body);
    const auto object = body.value("object", std::string{});
    const auto fields = body.value("fields", nlohmann::json::array());
    if (object == "user_groups" && fields == nlohmann::json::array({"group_id"})) {
        return FakeTransport::ok(R"({"user_groups":[]})");
    }
    if (object == "user_roles" && fields == nlohmann::json::array({"user_id"})) {
        return FakeTransport::ok(R"({"user_roles":[]})");
    }
    if ((object == "cards" || object == "face_templates" || object == "templates") &&
        fields == nlohmann::json::array({"COUNT(*)"})) {
        return FakeTransport::ok(nlohmann::json{{object, nlohmann::json::array({{{"COUNT(*)", 0}}})}}.dump());
    }
    // This must be distinguished from the original users list/get query.
    if (object == "users" && fields == nlohmann::json::array({"password"})) {
        return FakeTransport::ok(R"({"users":[{"password":""}]})");
    }
    // Visitors plan (2026-09-14): mapUser() now also looks up cpf via a
    // c_users query -- default to "no row" (no CPF) so every existing
    // test using this responder doesn't need to know about it.
    if (object == "c_users" && fields == nlohmann::json::array({"id", "cpf"})) {
        return FakeTransport::ok(R"({"c_users":[]})");
    }
    return std::nullopt;
}

}  // namespace amico::test
