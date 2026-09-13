#pragma once

// Backend-only configuration: env-var parsing plus the network-exposure
// opt-in gate (spec.md Decision 3.1). Never part of the public amico_sdk
// API -- this header is only included by backend/ and test/backend/.

#include <cstdlib>
#include <string>


namespace amico::backend {

struct BackendConfig {
    std::string bindAddress = "127.0.0.1";
    int port = 8080;
    bool allowNetworkExposure = false;
    /// Directory served as static files at "/" (Giai đoạn 4). Relative
    /// paths resolve against the process's working directory.
    std::string frontendDir = "./frontend";
};

inline std::string envOrDefault(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value != nullptr ? std::string(value) : fallback;
}

/// Loads backend listener/static-file settings only. Device credentials arrive
/// in POST /login and are never read from startup environment variables.
inline BackendConfig loadBackendConfig() {
    BackendConfig config;
    config.bindAddress = envOrDefault("BACKEND_BIND_ADDRESS", "127.0.0.1");
    config.port = std::atoi(envOrDefault("BACKEND_PORT", "8080").c_str());
    config.allowNetworkExposure = envOrDefault("BACKEND_ALLOW_NETWORK_EXPOSURE", "") == "1";
    config.frontendDir = envOrDefault("BACKEND_FRONTEND_DIR", "./frontend");
    return config;
}

/// spec.md Decision 3.1: refuses non-loopback bind addresses unless the
/// operator also explicitly set BACKEND_ALLOW_NETWORK_EXPOSURE=1. Returns
/// an empty string if the configuration is safe to start with, otherwise
/// a human-readable reason to print and exit non-zero on.
inline std::string validateNetworkExposure(const BackendConfig& config) {
    const bool isLoopback = config.bindAddress == "127.0.0.1" || config.bindAddress == "localhost";
    if (isLoopback || config.allowNetworkExposure) {
        return "";
    }
    return "refusing to start: BACKEND_BIND_ADDRESS='" + config.bindAddress +
           "' is not loopback, and BACKEND_ALLOW_NETWORK_EXPOSURE=1 was not set. "
           "This server requires a trusted deployment boundary (see docs/backend-api.md) -- "
           "set BACKEND_ALLOW_NETWORK_EXPOSURE=1 only after putting a real auth layer in front of it.";
}

}  // namespace amico::backend
