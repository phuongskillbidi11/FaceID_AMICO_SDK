#pragma once

#include <string>

namespace amico {
class AmicoClient;
}

// Internal orchestration shared by the live runner and offline tests.
namespace amico::detail {

struct SafeLoginResult {
    bool reachable;
    std::string reachabilityError;
    bool loggedIn;
};

SafeLoginResult reachableThenLogin(AmicoClient& client);

enum class TlsProbeOutcome { NotApplicable, Verified, VerifyFailed, NetworkFailure };

struct TlsProbeResult {
    TlsProbeOutcome outcome;
    std::string detail;
};

// httpsClient must be non-null only when sslEnabled is true.
TlsProbeResult probeHttpsIfEnabled(bool sslEnabled, AmicoClient* httpsClient);

}  // namespace amico::detail
