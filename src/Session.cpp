#include "Session.hpp"

#include <algorithm>
#include <cstring>

namespace amico {

namespace {
void secureZero(std::string& s) {
    if (!s.empty()) {
        // volatile-through-pointer write so the compiler cannot optimize
        // the overwrite away as a dead store before the string is freed.
        volatile char* p = const_cast<volatile char*>(s.data());
        for (std::size_t i = 0; i < s.size(); ++i) {
            p[i] = '\0';
        }
    }
    s.clear();
}
}  // namespace

void Session::set(std::string login, std::string sessionToken) {
    clear();
    login_ = std::move(login);
    token_ = std::move(sessionToken);
}

std::string Session::cookieHeader() const {
    return "login=" + login_ + "; session=" + token_;
}

void Session::clear() noexcept {
    secureZero(login_);
    secureZero(token_);
}

}  // namespace amico
