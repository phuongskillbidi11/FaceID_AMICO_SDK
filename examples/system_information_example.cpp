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
        amico::SystemInformation info = client.getSystemInformation();
        std::cout << "device: " << info.deviceName << "\n";
        std::cout << "firmware: " << info.firmwareVersion << "\n";
        std::cout << "secbox (EAM): " << info.secboxVersion << "\n";
        std::cout << "online: " << (info.online ? "yes" : "no") << "\n";
        client.logout();
        return 0;
    } catch (const amico::AmicoError& e) {
        std::cerr << "failed: " << e.what() << "\n";
        return 1;
    }
}
