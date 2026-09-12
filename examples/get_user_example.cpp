// Usage: set AMICO_USER_ID to the numeric id to look up (defaults to the
// first user found via a small list() call if unset).
#include <cstdlib>
#include <iostream>
#include <string>

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

        int64_t userId = 0;
        if (const char* idEnv = std::getenv("AMICO_USER_ID")) {
            userId = std::stoll(idEnv);
        } else {
            amico::UserQuery query;
            query.limit = 1;
            auto users = client.users().list(query);
            if (users.empty()) {
                std::cout << "no users found on this device\n";
                client.logout();
                return 0;
            }
            userId = users.front().id;
        }

        auto user = client.users().get(userId);
        if (!user.has_value()) {
            std::cout << "no user found with id=" << userId << "\n";
        } else {
            std::cout << "id=" << user->id << " name=" << user->name << "\n";
        }

        client.logout();
        return 0;
    } catch (const amico::AmicoError& e) {
        std::cerr << "failed: " << e.what() << "\n";
        return 1;
    }
}
