#pragma once

#include <string>

#include "http/HttpTransport.hpp"

namespace amico {

/// libcurl-based production transport.
///   - TLS certificate verification is always on for https:// URLs; there
///     is no configuration knob to disable it (per the task brief).
///   - Redirects are never followed (CURLOPT_FOLLOWLOCATION = 0): the
///     simplest way to guarantee no cross-host redirect and no credential
///     forwarding across a redirect is to never redirect at all.
///   - Response body and header size are capped; exceeding either aborts
///     the transfer and results in a ResponseTooLargeError.
///   - Reuses one CURL easy handle across every send() call (created once,
///     destroyed with this object) so libcurl can keep the underlying
///     TCP/HTTP connection to the device alive between requests instead of
///     paying a fresh TCP handshake every single call -- many endpoints in
///     this SDK internally fan out into several sequential device requests
///     (e.g. per-user enrichment queries), so this matters a lot in
///     practice; see 2026-09-14 perf investigation notes. All options are
///     still set fresh on every send() call (unchanged behavior), only the
///     handle itself (and therefore its connection cache) persists.
class CurlTransport : public IHttpTransport {
public:
    explicit CurlTransport(std::string baseUrl);
    ~CurlTransport() override;
    CurlTransport(const CurlTransport&) = delete;
    CurlTransport& operator=(const CurlTransport&) = delete;

    HttpResponse send(const HttpRequest& request) override;

private:
    std::string baseUrl_;
    void* curl_ = nullptr;  // CURL*; void* to avoid leaking <curl/curl.h> into this header
};

}  // namespace amico
