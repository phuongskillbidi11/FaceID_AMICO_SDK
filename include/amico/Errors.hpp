#pragma once

#include <stdexcept>
#include <string>

namespace amico {

/// Base type for every exception the SDK throws. Messages are built to be
/// useful for debugging without ever including credentials, session
/// values, password hashes, salts, or full sensitive response bodies.
class AmicoError : public std::runtime_error {
public:
    explicit AmicoError(const std::string& message) : std::runtime_error(message) {}
};

/// A caller-supplied `AmicoConfig` value is invalid (bad base URL, negative
/// timeout, zero page-size limit, etc.). Thrown before any network I/O.
class ConfigurationError : public AmicoError {
public:
    explicit ConfigurationError(const std::string& message) : AmicoError(message) {}
};

/// The underlying transport failed before an HTTP response was obtained
/// (DNS failure, connection refused, TLS handshake failure, ...).
class NetworkError : public AmicoError {
public:
    explicit NetworkError(const std::string& message) : AmicoError(message) {}
};

/// The connect or request timeout configured in `AmicoConfig` was exceeded.
class TimeoutError : public NetworkError {
public:
    explicit TimeoutError(const std::string& message) : NetworkError(message) {}
};

/// The peer certificate failed TLS verification.
class TlsVerificationError : public NetworkError {
public:
    explicit TlsVerificationError(const std::string& message) : NetworkError(message) {}
};

/// `login()` failed: bad credentials, or the device otherwise refused to
/// establish a session. Never includes the attempted password.
class AuthenticationError : public AmicoError {
public:
    explicit AuthenticationError(const std::string& message) : AmicoError(message) {}
};

/// An authenticated call was attempted without a valid in-memory session
/// (never logged in, already logged out, or the device rejected the
/// session with HTTP 401).
class InvalidSessionError : public AmicoError {
public:
    explicit InvalidSessionError(const std::string& message) : AmicoError(message) {}
};

/// The device returned a non-2xx HTTP status this SDK does not map to a
/// more specific error type. Carries the raw status code for the caller.
class HttpError : public AmicoError {
public:
    HttpError(int statusCode, const std::string& message)
        : AmicoError(message), statusCode_(statusCode) {}

    int statusCode() const noexcept { return statusCode_; }

private:
    int statusCode_;
};

/// The device responded with a 2xx status and parseable JSON, but the
/// shape did not match what Phase 1's LIVE_CONFIRMED evidence documented
/// (missing required field, wrong type, unexpected top-level shape).
class ProtocolError : public AmicoError {
public:
    explicit ProtocolError(const std::string& message) : AmicoError(message) {}
};

/// The response body could not be parsed as JSON at all.
class JsonParseError : public AmicoError {
public:
    explicit JsonParseError(const std::string& message) : AmicoError(message) {}
};

/// A response body (or header block) exceeded the configured size cap and
/// the transfer was aborted before completion.
class ResponseTooLargeError : public AmicoError {
public:
    explicit ResponseTooLargeError(const std::string& message) : AmicoError(message) {}
};

/// The caller asked for something this read-only SDK deliberately does not
/// implement (e.g. an unwhitelisted object/field, a write operation).
class UnsupportedOperationError : public AmicoError {
public:
    explicit UnsupportedOperationError(const std::string& message) : AmicoError(message) {}
};

}  // namespace amico
