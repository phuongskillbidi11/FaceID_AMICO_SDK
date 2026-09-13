#pragma once

#include <httplib.h>
#include "SessionStore.hpp"

namespace amico::backend {

// Existing routes lock the session, check its cookie, parse the request, then
// call the SDK while still holding the lock. Login/session are cookie-exempt.
// Administrator/PIN routes retain their additional confirmation header.
void registerAll(httplib::Server& svr, SessionStore& sessionStore);

}  // namespace amico::backend
