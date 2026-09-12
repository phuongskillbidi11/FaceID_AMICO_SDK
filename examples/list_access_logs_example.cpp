#include <cstdlib>
#include <iostream>

#include "amico/Client.hpp"
#include "amico/Config.hpp"
#include "amico/Errors.hpp"

int main() {
    amico::AmicoConfig config;
    config.baseUrl = std::getenv("AMICO_BASE_URL") ? std::getenv("AMICO_BASE_URL") : "";
    config.username = std::getenv("AMICO_USERNAME") ? std::getenv("AMICO_USERNAME") : "";
    config.password = std::getenv("AMICO_PASSWORD") ? std::getenv("AMICO_PASSWORD") : "";

    try {
        amico::AmicoClient client(config);
        client.login();

        amico::AccessLogQuery query;
        query.limit = 20;
        auto logs = client.accessLogs().list(query);

        std::cout << logs.size() << " access log entr(y/ies):\n";
        for (const auto& entry : logs) {
            std::cout << "  id=" << entry.id << " time=" << entry.time << " event=" << entry.event << "\n";
        }

        client.logout();
        return 0;
    } catch (const amico::AmicoError& e) {
        std::cerr << "failed: " << e.what() << "\n";
        return 1;
    }
}
