#include "http/CurlTransport.hpp"

#include <curl/curl.h>

#include <cstring>
#include <memory>

#include "amico/Errors.hpp"

namespace amico {

namespace {

constexpr const char* kUserAgent = "AmicoCppSdk/0.1 (+https://github.com/; read-only client)";

struct WriteContext {
    std::string* buffer = nullptr;
    std::size_t maxBytes = 0;
    bool exceeded = false;
};

struct HeaderContext {
    std::vector<HttpHeader>* headers = nullptr;
    std::size_t maxBytes = 0;
    std::size_t totalBytes = 0;
    bool exceeded = false;
};

std::size_t writeCallback(char* ptr, std::size_t size, std::size_t nmemb, void* userdata) {
    auto* ctx = static_cast<WriteContext*>(userdata);
    const std::size_t bytes = size * nmemb;
    if (ctx->buffer->size() + bytes > ctx->maxBytes) {
        ctx->exceeded = true;
        return 0;  // abort transfer
    }
    ctx->buffer->append(ptr, bytes);
    return bytes;
}

std::size_t headerCallback(char* buffer, std::size_t size, std::size_t nitems, void* userdata) {
    auto* ctx = static_cast<HeaderContext*>(userdata);
    const std::size_t bytes = size * nitems;
    ctx->totalBytes += bytes;
    if (ctx->totalBytes > ctx->maxBytes) {
        ctx->exceeded = true;
        return 0;  // abort transfer
    }
    std::string line(buffer, bytes);
    const auto colon = line.find(':');
    if (colon != std::string::npos) {
        std::string name = line.substr(0, colon);
        std::string value = line.substr(colon + 1);
        // trim
        auto trim = [](std::string& s) {
            while (!s.empty() && (s.front() == ' ' || s.front() == '\t')) s.erase(s.begin());
            while (!s.empty() && (s.back() == '\r' || s.back() == '\n' || s.back() == ' ')) s.pop_back();
        };
        trim(name);
        trim(value);
        if (!name.empty()) {
            ctx->headers->push_back({name, value});
        }
    }
    return bytes;
}

int progressCallback(void* clientp, curl_off_t, curl_off_t, curl_off_t, curl_off_t) {
    const auto* token = static_cast<const CancellationToken*>(clientp);
    if (token != nullptr && token->isCancelled()) {
        return 1;  // non-zero aborts the transfer
    }
    return 0;
}

struct CurlSlistDeleter {
    void operator()(curl_slist* list) const { curl_slist_free_all(list); }
};

}  // namespace

CurlTransport::CurlTransport(std::string baseUrl) : baseUrl_(std::move(baseUrl)) {}

HttpResponse CurlTransport::send(const HttpRequest& request) {
    CURL* curl = curl_easy_init();
    if (curl == nullptr) {
        throw NetworkError("failed to initialize HTTP transport");
    }

    std::string url = baseUrl_ + request.path;
    std::string responseBody;
    std::vector<HttpHeader> responseHeaders;

    WriteContext writeCtx{&responseBody, request.maxResponseBytes, false};
    HeaderContext headerCtx{&responseHeaders, request.maxHeaderBytes, 0, false};

    std::unique_ptr<curl_slist, CurlSlistDeleter> headerList;
    for (const auto& h : request.headers) {
        curl_slist* updated = curl_slist_append(headerList.release(), (h.name + ": " + h.value).c_str());
        headerList.reset(updated);
    }

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_USERAGENT, kUserAgent);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, static_cast<long>(request.connectTimeout.count() * 1000));
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, static_cast<long>(request.requestTimeout.count() * 1000));
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headerList.get());

    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &writeCtx);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, headerCallback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &headerCtx);

    if (request.cancellationToken != nullptr) {
        curl_easy_setopt(curl, CURLOPT_XFERINFOFUNCTION, progressCallback);
        curl_easy_setopt(curl, CURLOPT_XFERINFODATA, request.cancellationToken);
        curl_easy_setopt(curl, CURLOPT_NOPROGRESS, 0L);
    }

    if (request.method == "POST") {
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, request.body.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(request.body.size()));
    } else {
        curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
    }

    const CURLcode rc = curl_easy_perform(curl);

    if (writeCtx.exceeded || headerCtx.exceeded) {
        curl_easy_cleanup(curl);
        throw ResponseTooLargeError("response exceeded the configured size limit for " + request.path);
    }

    if (rc != CURLE_OK) {
        const std::string message = curl_easy_strerror(rc);
        curl_easy_cleanup(curl);
        if (rc == CURLE_OPERATION_TIMEDOUT) {
            throw TimeoutError("request to " + request.path + " timed out: " + message);
        }
        if (rc == CURLE_PEER_FAILED_VERIFICATION || rc == CURLE_SSL_ISSUER_ERROR) {
            throw TlsVerificationError("TLS certificate verification failed for " + request.path + ": " + message);
        }
        throw NetworkError("request to " + request.path + " failed: " + message);
    }

    long statusCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &statusCode);
    curl_easy_cleanup(curl);

    HttpResponse response;
    response.statusCode = static_cast<int>(statusCode);
    response.headers = std::move(responseHeaders);
    response.body = std::move(responseBody);
    return response;
}

}  // namespace amico
