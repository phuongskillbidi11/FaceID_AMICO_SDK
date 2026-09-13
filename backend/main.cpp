// HTTP/JSON proxy with one in-memory, login-selected device session.
#include <iostream>

#include <httplib.h>

#include "BackendConfig.hpp"
#include "Routes.hpp"
#include "SessionStore.hpp"

int main() {
    amico::backend::BackendConfig config = amico::backend::loadBackendConfig();

    // Network-exposure gate checked BEFORE any device login attempt --
    // refusing to bind must never depend on (or trigger) a real
    // credential exchange with the device.
    std::string exposureError = amico::backend::validateNetworkExposure(config);
    if (!exposureError.empty()) {
        std::cerr << "amico_backend: " << exposureError << "\n";
        return 1;
    }

    amico::backend::SessionStore sessions;
    httplib::Server svr;
    amico::backend::registerAll(svr, sessions);

    // Giai đoạn 4: serve the frontend's static files at "/". Per
    // cpp-httplib's actual dispatch order (Server::routing()), the
    // static-file mount is checked BEFORE any registered GET/HEAD route
    // -- not after. None of the routes registered above collide with a
    // planned frontend/ filename, so this is safe as scoped; see
    // docs/backend-api.md.
    if (!svr.set_mount_point("/", config.frontendDir)) {
        std::cerr << "amico_backend: warning: could not mount frontend directory '" << config.frontendDir
                  << "' (does it exist?) -- API routes will still work, but no UI will be served\n";
    }

    std::cout << "amico_backend: listening on " << config.bindAddress << ":" << config.port << "\n";
    if (!svr.listen(config.bindAddress, config.port)) {
        std::cerr << "amico_backend: failed to bind " << config.bindAddress << ":" << config.port << "\n";
        return 1;
    }
    return 0;
}
