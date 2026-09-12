#pragma once

#include <chrono>
#include <cstddef>
#include <functional>
#include <string>
#include <string_view>

namespace amico {

/// Severity for `AmicoConfig::logSink`. The SDK only ever emits diagnostic
/// text that has already passed through the redaction utility
/// (see `docs/sdk-usage.md`) — never raw request/response bodies.
enum class LogLevel { Debug, Info, Warning, Error };

/// Configuration for `AmicoClient`. Every field has a safe, conservative
/// default; nothing here can be used to disable TLS verification or to
/// send more data than the confirmed protocol requires.
struct AmicoConfig {
    /// e.g. "http://192.168.2.156". Validated by `AmicoClient`'s
    /// constructor: no embedded credentials, no unsupported scheme, no
    /// query string or fragment. LAN IPs are fully supported (this is a
    /// local-device SDK).
    std::string baseUrl;

    /// Confirmed wire field name is "login", not "username" — see
    /// docs/amico-auth-flow.md.
    std::string username;
    std::string password;

    std::chrono::seconds connectTimeout{5};
    std::chrono::seconds requestTimeout{10};

    /// Hard cap on a response body's size; a response exceeding this
    /// aborts the transfer and throws `ResponseTooLargeError`.
    std::size_t maxResponseBytes = 8 * 1024 * 1024;  // 8 MiB

    /// Hard cap on the total size of response headers.
    std::size_t maxHeaderBytes = 64 * 1024;  // 64 KiB

    /// Hard cap on `UserQuery::limit` / `AccessLogQuery::limit`, enforced
    /// regardless of what the caller passes in. Keeps a misconfigured
    /// caller (or a future bug) from asking the device for an unbounded
    /// page.
    int maxPageSize = 500;

    /// Default page size used when a query's `limit` is left at 0.
    int defaultPageSize = 50;

    /// If true, a call that receives HTTP 401 on an authenticated request
    /// will attempt exactly one re-login (using the credentials already
    /// held in this config) and retry the original call exactly once.
    /// Default false: the SDK never re-authenticates on its own unless the
    /// caller opts in explicitly, per the task brief.
    bool autoRelogin = false;

    /// Optional sink for redacted diagnostic log lines. Never receives
    /// credentials, session tokens, password hashes, or salts — the SDK
    /// redacts before calling this. No-op if unset.
    std::function<void(LogLevel, std::string_view)> logSink;
};

}  // namespace amico
