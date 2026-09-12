#pragma once

// Offline test double for amico::IHttpTransport. No socket, no network --
// every offline test in this suite runs through this class instead of
// CurlTransport.

#include <fstream>
#include <functional>
#include <sstream>
#include <string>
#include <vector>

#include "http/HttpTransport.hpp"

namespace amico::test {

inline std::string readFixture(const std::string& name) {
#ifndef AMICO_TEST_FIXTURES_DIR
#error "AMICO_TEST_FIXTURES_DIR must be defined by the build (see CMakeLists.txt)"
#endif
    std::string path = std::string(AMICO_TEST_FIXTURES_DIR) + "/" + name;
    std::ifstream file(path, std::ios::binary);
    std::ostringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

class FakeTransport : public IHttpTransport {
public:
    /// Called for every request; the test sets this to decide what comes
    /// back (a canned HttpResponse) or to throw (TimeoutError,
    /// ResponseTooLargeError, NetworkError, ...) to exercise error mapping.
    std::function<HttpResponse(const HttpRequest&)> responder;

    std::vector<HttpRequest> requestLog;

    HttpResponse send(const HttpRequest& request) override {
        requestLog.push_back(request);
        if (!responder) {
            HttpResponse res;
            res.statusCode = 500;
            res.body = R"({"error":"FakeTransport has no responder configured for this test"})";
            return res;
        }
        return responder(request);
    }

    static HttpResponse ok(const std::string& jsonBody) {
        HttpResponse res;
        res.statusCode = 200;
        res.body = jsonBody;
        return res;
    }

    static HttpResponse status(int code, const std::string& jsonBody = "{}") {
        HttpResponse res;
        res.statusCode = code;
        res.body = jsonBody;
        return res;
    }
};

}  // namespace amico::test
