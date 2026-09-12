#include "NetworkSafety.hpp"

#include "amico/Client.hpp"
#include "amico/Errors.hpp"

namespace amico::detail {

SafeLoginResult reachableThenLogin(AmicoClient& client) {
    try {
        client.checkReachable();
    } catch (const AmicoError& e) {
        return {false, e.what(), false};
    }
    client.login();
    return {true, "", true};
}

TlsProbeResult probeHttpsIfEnabled(bool sslEnabled, AmicoClient* httpsClient) {
    if (!sslEnabled) {
        return {TlsProbeOutcome::NotApplicable, ""};
    }
    try {
        httpsClient->checkReachable();
        return {TlsProbeOutcome::Verified, ""};
    } catch (const TlsVerificationError& e) {
        return {TlsProbeOutcome::VerifyFailed, e.what()};
    } catch (const NetworkError& e) {
        return {TlsProbeOutcome::NetworkFailure, e.what()};
    }
}

}  // namespace amico::detail
