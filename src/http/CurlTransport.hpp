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
class CurlTransport : public IHttpTransport {
public:
    explicit CurlTransport(std::string baseUrl);

    HttpResponse send(const HttpRequest& request) override;

private:
    std::string baseUrl_;
};

}  // namespace amico
