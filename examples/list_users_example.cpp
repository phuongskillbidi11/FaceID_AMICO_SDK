// Never prints full user records -- only a count and the id/name pair,
// which are not sensitive (password/salt/panic_* cannot even be
// requested by this SDK -- see src/ObjectQuery.hpp).
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

        amico::UserQuery query;
        query.limit = 20;
        auto users = client.users().list(query);

        std::cout << users.size() << " user(s):\n";
        for (const auto& user : users) {
            std::cout << "  id=" << user.id << " name=" << user.name << "\n";
        }

        client.logout();
        return 0;
    } catch (const amico::AmicoError& e) {
        std::cerr << "failed: " << e.what() << "\n";
        return 1;
    }
}
