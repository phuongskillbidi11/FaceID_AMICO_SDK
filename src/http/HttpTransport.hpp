#pragma once

#include <chrono>
#include <cstddef>
#include <string>
#include <vector>

#include "amico/Cancellation.hpp"

namespace amico {

struct HttpHeader {
    std::string name;
    std::string value;
};

struct HttpRequest {
    std::string method;  // "GET" or "POST"
    std::string path;    // e.g. "/hidlogin.fcgi" -- appended to the transport's base URL
    std::vector<HttpHeader> headers;
    std::string body;
    std::chrono::seconds connectTimeout{5};
    std::chrono::seconds requestTimeout{10};
    std::size_t maxResponseBytes = 8 * 1024 * 1024;
    std::size_t maxHeaderBytes = 64 * 1024;
    const CancellationToken* cancellationToken = nullptr;  // optional, not owned
};

struct HttpResponse {
    int statusCode = 0;
    std::vector<HttpHeader> headers;
    std::string body;
};

/// Seam for offline testing (see test/FakeTransport.hpp) -- the only
/// production implementation is CurlTransport.
class IHttpTransport {
public:
    virtual ~IHttpTransport() = default;
    virtual HttpResponse send(const HttpRequest& request) = 0;
};

}  // namespace amico
