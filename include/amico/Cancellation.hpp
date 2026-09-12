#pragma once

#include <atomic>
#include <memory>

namespace amico {

/// Cooperative cancellation for an in-flight request. Optional on every
/// SDK call; a default-constructed `AmicoClient` call takes no token and
/// cannot be cancelled mid-flight.
///
/// Usage:
///   amico::CancellationToken token;
///   // on another thread: token.cancel();
///   client.users().list(query, &token);
class CancellationToken {
public:
    CancellationToken() : cancelled_(std::make_shared<std::atomic<bool>>(false)) {}

    void cancel() noexcept { cancelled_->store(true, std::memory_order_relaxed); }
    bool isCancelled() const noexcept { return cancelled_->load(std::memory_order_relaxed); }

private:
    std::shared_ptr<std::atomic<bool>> cancelled_;
};

}  // namespace amico
