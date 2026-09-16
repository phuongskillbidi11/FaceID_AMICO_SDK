#include "ErrorMapping.hpp"

#include "amico/Errors.hpp"

namespace amico::backend {

namespace {
nlohmann::json errorBody(const std::exception& e, const char* typeName) {
    return {{"error", e.what()}, {"type", typeName}};
}
}  // namespace

std::pair<int, nlohmann::json> mapException(const std::exception& e) {
    // Order matters: most-derived types first, so a subclass is never
    // reported under its base class's status (e.g. TimeoutError must
    // not be caught as a generic NetworkError).
    if (const auto* err = dynamic_cast<const amico::TimeoutError*>(&e)) {
        return {504, errorBody(*err, "TimeoutError")};
    }
    if (const auto* err = dynamic_cast<const amico::TlsVerificationError*>(&e)) {
        return {502, errorBody(*err, "TlsVerificationError")};
    }
    if (const auto* err = dynamic_cast<const amico::NetworkError*>(&e)) {
        return {502, errorBody(*err, "NetworkError")};
    }
    if (const auto* err = dynamic_cast<const amico::AuthenticationError*>(&e)) {
        return {401, errorBody(*err, "AuthenticationError")};
    }
    if (const auto* err = dynamic_cast<const amico::InvalidSessionError*>(&e)) {
        return {401, errorBody(*err, "InvalidSessionError")};
    }
    if (const auto* err = dynamic_cast<const amico::ConfigurationError*>(&e)) {
        return {500, errorBody(*err, "ConfigurationError")};
    }
    if (const auto* err = dynamic_cast<const amico::HttpError*>(&e)) {
        int status = err->statusCode();
        if (status < 100 || status > 599) {
            status = 502;
        }
        return {status, errorBody(*err, "HttpError")};
    }
    if (const auto* err = dynamic_cast<const amico::ProtocolError*>(&e)) {
        return {502, errorBody(*err, "ProtocolError")};
    }
    if (const auto* err = dynamic_cast<const amico::JsonParseError*>(&e)) {
        return {502, errorBody(*err, "JsonParseError")};
    }
    if (const auto* err = dynamic_cast<const amico::ResponseTooLargeError*>(&e)) {
        return {502, errorBody(*err, "ResponseTooLargeError")};
    }
    if (const auto* err = dynamic_cast<const amico::UnsupportedOperationError*>(&e)) {
        return {400, errorBody(*err, "UnsupportedOperationError")};
    }
    if (const auto* err = dynamic_cast<const amico::ActionDeniedError*>(&e)) {
        return {409, errorBody(*err, "ActionDeniedError")};
    }
    return {500, errorBody(e, "InternalError")};
}

}  // namespace amico::backend
