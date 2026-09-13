# Spec — Giai đoạn 3: Backend API layer (HTTP wrapper over `amico_sdk`)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.

---

## Goal

Build a small, standalone C++ HTTP server (`amico_backend`) that exposes
`amico_sdk`'s existing `AmicoClient` API (Users CRUD + rich profile,
Access Logs, System Information) as a JSON HTTP API — a **thin,
stateless proxy**: every request is served by calling straight through
to the real AMICO device via `amico_sdk`, with no database, no cache,
no business logic beyond what the SDK already implements. This becomes
the integration point Giai đoạn 4's frontend talks to, instead of the
frontend needing to embed/link the C++ SDK directly.

**Done looks like:** `amico_backend` (new executable) starts up, logs
into the real device once using its own config (env vars, same pattern
as existing examples), and serves HTTP+JSON routes 1:1 mirroring every
public method already on `AmicoClient`/`UsersApi`/`AccessLogsApi`.
Offline integration tests drive the real HTTP server (bound to a
loopback ephemeral port) against a `FakeTransport`-backed `AmicoClient`
— no live device contact needed to verify routing/serialization/error-
mapping. A live smoke test (gated, like every prior live test in this
project) confirms the whole stack against the real device once.

---

## Background

Giai đoạn 2/2b built `amico_sdk`'s full current capability: login/
session, Users CRUD, group/card/administrator/image/password writes,
Access Logs, System Information — all offline-tested and live-verified
against the real device (89 cases / 490 assertions; every live-write
method has passed a real device round-trip). Giai đoạn 4 (frontend, not
this plan) needs an HTTP-reachable backend rather than embedding the
C++ SDK directly.

User's explicit choices for this plan (2026-09-13):
- **Language/framework:** C++, reusing `amico_sdk` directly (no
  bindings/IPC to another language).
- **Architecture:** stateless thin proxy — no database, no cache; the
  device is the sole source of truth for every response.

---

## Design decisions

### Decision 1 — HTTP library: `cpp-httplib`, not Drogon
- **Chosen:** [`cpp-httplib`](https://github.com/yhirose/cpp-httplib) —
  a single-header, synchronous C++ HTTP server/client library,
  available via vcpkg (`cpp-httplib` port; **Task 0.1 verifies this
  before anything else is built** — do not assume, per this project's
  discovery-before-implementation discipline).
- **Why:** `amico_sdk` itself is synchronous/blocking (libcurl calls
  block the calling thread) — there is no async I/O anywhere in the
  stack this backend would sit on top of, so an async framework
  (Drogon) buys nothing here and adds a much heavier dependency
  footprint (its own event loop, ORM, JSON layer we'd bypass in favor
  of the already-used `nlohmann::json`). `cpp-httplib` integrates with
  one `#include`, matches this project's existing vcpkg-based
  dependency style, and a simple thread-pool-per-request model is
  sufficient for a single physical device backend (see Decision 4 on
  concurrency).
- **Rejected alternatives:** Drogon (rejected: async complexity with no
  payoff, heavier footprint) — Boost.Beast (rejected: much more
  boilerplate for the same synchronous-server outcome).

### Decision 2 — One backend-held device session; no login endpoint
- **Chosen:** `amico_backend` reads its OWN `AmicoConfig` from
  environment variables at startup (`AMICO_BASE_URL`/`AMICO_USERNAME`/
  `AMICO_PASSWORD`, exactly matching every existing example binary's
  convention) with `autoRelogin = true`, logs in once, and holds a
  single shared `AmicoClient` instance for the lifetime of the process.
  There is **no `/login` route** — the frontend never sees or handles
  AMICO device credentials at all; every HTTP request the frontend
  makes is already "authenticated" as far as the device is concerned,
  because the backend's one session handles it transparently
  (`autoRelogin` self-heals a 401 exactly once per call, per the SDK's
  existing behavior).
- **Why:** Matches "thin stateless proxy" — the backend holds exactly
  one piece of state (the device session), not per-frontend-user
  sessions, which the user's own architecture choice explicitly ruled
  out building.
- **Rejected alternatives:** Per-request login (rejected: wasteful,
  the device's own login flow is not designed for high-frequency
  calls) — accepting device credentials as an HTTP body on every
  request (rejected: pointless if the backend already holds one fixed
  set of credentials in its own config; also needlessly increases the
  surface where credentials could leak into logs).

### Decision 3 — No auth layer for the backend's own HTTP API; two technical guardrails instead of docs-only warnings
- **Chosen:** No JWT/session/API-key system for `amico_backend`'s own
  HTTP surface (per the user's explicit "stateless proxy" choice). In
  place of that, two **enforced, technical** guardrails (user's
  explicit request, 2026-09-13 — not just documentation this time):
  1. **Bind-address opt-in gate.** Default bind address is `127.0.0.1`
     (`BACKEND_BIND_ADDRESS` env var, default port `8080` via
     `BACKEND_PORT`). If `BACKEND_BIND_ADDRESS` is set to anything
     other than `127.0.0.1`/`localhost`, the server **refuses to
     start** (prints a clear error, exits non-zero) **unless**
     `BACKEND_ALLOW_NETWORK_EXPOSURE=1` is also set. Widening exposure
     requires two deliberate env vars, not one, and not silence.
  2. **Sensitive-action confirmation header.** `PUT
     /users/:id/administrator` and `PUT /users/:id/password` both
     require a request header `X-Confirm-Sensitive-Action: yes`. Its
     absence returns `428 Precondition Required` with a body
     explaining exactly why (naming the required header) — the request
     is never executed against the device without it. This is **not**
     authentication (anyone who can set the header can still act) — it
     is a deliberate-action speed bump that stops accidental/looping/
     mistyped calls from silently executing a credential-adjacent
     write, which was this plan's actual concern.
- **Why this needs to be said plainly:** `UsersApi::setPassword()` and
  `setAdministrator()` were tagged "always ask a human before each live
  execution" in `feedback_write_api_risk_tiers.md` — but that gate was
  a **conversational practice between this session and the user**, not
  something enforced by the SDK library itself. Once wrapped in an
  HTTP endpoint, that human-in-the-loop gate does not exist unless
  something in the backend re-creates an equivalent — the two
  guardrails above are that re-creation, at the "prevent accidents"
  level (not the "prevent a determined bad actor" level, which would
  require real auth — still explicitly out of scope, see below).
- **Rejected alternatives:** Building a full auth layer now (rejected —
  explicitly out of scope per the user's own architecture choice, and
  a large enough feature to deserve its own plan) — docs-only warnings
  with no enforced mechanism (rejected 2026-09-13 — the user explicitly
  asked for both guardrails to be real, checked code, not just written
  guidance) — requiring the confirmation header on every route,
  including read-only ones (rejected — pure friction with no benefit
  where there's nothing destructive to guard against).

### Decision 4 — Concurrency: one shared `AmicoClient` behind a mutex
- **Chosen:** `cpp-httplib`'s default thread-pool server dispatches
  each request on a worker thread; all worker threads share ONE
  `AmicoClient` instance, serialized by a single `std::mutex` around
  every call into it.
- **Why:** `AmicoClient`'s `Impl` (session, transport) is not
  documented or tested as thread-safe, and the real device is a single
  physical unit — concurrent calls would not go any faster against it,
  they'd just risk interleaved session state. Serializing is simple,
  correct, and costs nothing in practice (device round-trips already
  dominate latency).
- **Rejected alternatives:** A connection/client pool (rejected —
  significant complexity for no real throughput benefit against one
  physical device); making `AmicoClient` itself thread-safe (rejected —
  out of scope, a much bigger SDK-level change with no current need).

### Decision 5 — Route surface: direct 1:1 mapping, no new business logic
- **Chosen:** Every route is a thin translation of one existing
  `AmicoClient`/`UsersApi`/`AccessLogsApi` public method — see Scope In
  for the exact list. No route combines multiple SDK calls, adds
  caching, or invents a capability the SDK doesn't already have.
- **Why:** Keeps this plan's own principle ("thin stateless proxy")
  honest — the backend's only job is protocol translation (HTTP+JSON
  in, C++ calls out, C++ results back to JSON), not new functionality.

### Decision 6 — Error mapping: typed exception → HTTP status + JSON body
- **Chosen:** A single `mapException()` helper catches every
  `amico::AmicoError` subclass (see `include/amico/Errors.hpp`) and
  maps it to an HTTP status + `{"error": "<message>", "type":
  "<ExceptionClassName>"}` body:
  | Exception | HTTP status |
  |---|---|
  | `AuthenticationError` | 401 |
  | `InvalidSessionError` | 401 |
  | `ConfigurationError` | 500 (server misconfiguration, not the caller's fault) |
  | `NetworkError` (base, not `TimeoutError`) | 502 |
  | `TimeoutError` | 504 |
  | `TlsVerificationError` | 502 |
  | `HttpError` | passes through the device's own `statusCode()` if it's a valid HTTP status, else 502 |
  | `ProtocolError` | 502 (the device responded, but not in the confirmed shape — a backend/device problem, not the caller's) |
  | `JsonParseError` (the SDK's own type — a malformed **device** response) | 502 |
  | `ResponseTooLargeError` | 502 |
  | `UnsupportedOperationError` | 400 |
  | any other `std::exception` (after the request-body case below is excluded) | 500 |
- **Request-body parsing is a SEPARATE, earlier stage — not part of the
  table above.** Every route handler that reads a JSON body (or
  path/query params it must parse to a number, e.g. `:id`, `:groupId`,
  `areaCode`/`cardNumber`) wraps that parsing in its own `try/catch`
  for `nlohmann::json::exception` (and `std::invalid_argument`/
  `std::out_of_range` from numeric parsing) — this is the **caller's**
  mistake, not the server's, so it returns `400 Bad Request` with
  `{"error": "<what was wrong>", "type": "InvalidRequest"}` **before**
  the handler ever calls into `AmicoClient`. Found by Plan Review
  (`review.md`, pass 1): without this, a malformed request body would
  fall through the table above to the generic 500 branch, wrongly
  telling the caller "the server is broken" for their own mistake.
- **Why:** Consistent, predictable mapping the frontend can rely on;
  never leaks a raw exception message that might contain sensitive
  detail (the SDK's own error messages are already documented as
  redacted — see `Errors.hpp`'s class comments); and now correctly
  distinguishes "you sent something invalid" (400) from "something
  went wrong talking to the device" (502/504/etc.) from "the backend
  itself is misconfigured" (500).

### Decision 7 — Testing: reuse `FakeTransport` via a real HTTP round-trip
- **Chosen:** New offline integration tests start `amico_backend`'s
  HTTP server bound to `127.0.0.1:0` (ephemeral port) with a
  `FakeTransport`-backed `AmicoClient` (using the existing
  `setTransportForTesting` seam), then drive it with `cpp-httplib`'s
  own HTTP **client** mode — a real HTTP request/response round-trip,
  fully offline (no real device, no real socket to the internet/LAN).
- **Why:** Matches this project's established "offline-testable via
  the same DI seam" pattern from `amico_sdk` itself, extended one layer
  up — proves routing, JSON (de)serialization, and error-mapping
  without needing live-device gating for ordinary test runs.

---

## Scope

### In scope
- New CMake target `amico_backend` (executable), new directory
  `backend/` (parallel to `src/`, `include/`, `test/`):
  `backend/main.cpp`, `backend/Routes.{hpp,cpp}`,
  `backend/JsonMapping.{hpp,cpp}` (struct ↔ `nlohmann::json`),
  `backend/ErrorMapping.{hpp,cpp}`, `backend/BackendConfig.hpp`.
- Routes (all JSON in/out except the image routes, which pass through
  raw bytes):
  - `GET /health` — `checkReachable()`, no device session needed.
  - `GET /system-information` — `getSystemInformation()`.
  - `GET /users?limit=&offset=` — `UsersApi::list()`.
  - `GET /users/:id` — `UsersApi::get()`; 404 if not found.
  - `POST /users` — `UsersApi::create()`.
  - `PATCH /users/:id` — `UsersApi::update()` (partial; unset JSON
    fields map to `std::nullopt`).
  - `DELETE /users/:id` — `UsersApi::remove()`.
  - `POST /users/:id/groups/:groupId` — `addToGroup()`.
  - `DELETE /users/:id/groups/:groupId` — `removeFromGroup()`.
  - `POST /users/:id/cards` (body `{areaCode, cardNumber}`) —
    `addCard()`.
  - `DELETE /cards/:cardId` — `removeCard()`.
  - `PUT /users/:id/administrator` (body `{isAdmin: bool}`) —
    `setAdministrator()`. **Requires header
    `X-Confirm-Sensitive-Action: yes` (Decision 3) — 428 without it.**
  - `PUT /users/:id/image` (raw JPEG body, `Content-Type:
    image/jpeg`) — `setImage()`.
  - `DELETE /users/:id/image` — `removeImage()`.
  - `PUT /users/:id/password` (body `{password: string}`) —
    `setPassword()` — **requires header `X-Confirm-Sensitive-Action:
    yes` (Decision 3) — 428 without it; documented in
    `docs/backend-api.md` as security-sensitive; the request body is
    never logged.**
  - `GET /access-logs?from=&to=&limit=` — `AccessLogsApi::list()`.
- `docs/backend-api.md` (new) — every route, request/response JSON
  shape, error-mapping table, and Decision 3's security warning.
- `docs/src-map.md` updated with the new `backend/` files.
- Offline integration tests (Decision 7) covering every route's
  success + at least one error path.
- One gated live smoke test (read-only: `/health`,
  `/system-information`, `GET /users`) — mirrors `amico_live_smoke_test`'s
  existing gating convention exactly; a live WRITE smoke test through
  the backend is explicitly **out of scope** (see below — the SDK's own
  live-write tests already cover the underlying calls; re-proving the
  same device writes through one more layer isn't worth the live-device
  risk budget for this MVP pass).
- `vcpkg.json` — add `cpp-httplib` dependency (after Task 0.1 confirms
  availability).

### Out of scope (explicitly excluded)
- **Any auth/session system for the backend's own HTTP API** —
  explicitly ruled out by the user's own architecture choice (Decision
  3); flagged as a real, accepted risk, not silently absorbed.
- **TLS termination** — this server speaks plain HTTP; assumed to run
  behind a reverse proxy or on a trusted local network. Not building a
  certificate/TLS story in this pass.
- **Rate limiting / abuse protection** — no frontend exists yet to
  generate meaningful load; premature for this MVP.
- **A live WRITE smoke test through the backend** — the underlying SDK
  writes are already live-verified (Giai đoạn 2/2b); this plan only
  needs to prove the HTTP layer routes/serializes correctly, which the
  offline integration tests (Decision 7) already do without live-device
  risk.
- **Face/fingerprint hardware enrollment routes** (`remote_enroll`
  etc.) — not implemented in `amico_sdk` itself yet, so nothing to wrap.
- **Any endpoint the SDK doesn't already implement** (firmware update,
  factory reset, license change, master password change) — the backend
  cannot expose what the SDK doesn't have; if a future plan adds these
  to the SDK, this backend would need its own follow-up plan given
  Decision 3's risk already flagged for the two credential-adjacent
  endpoints that DO exist.
- **The Giai đoạn 4 frontend itself** — a separate, future plan.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `vcpkg.json` | Modify | Add `cpp-httplib` dependency |
| `CMakeLists.txt` | Modify | New `amico_backend` executable target, new `amico_backend_tests` target, new gated `amico_backend_live_smoke_test` target |
| `backend/main.cpp` | Create | Server bootstrap: read `BackendConfig`, construct `AmicoClient`, log in, register routes, start `cpp-httplib` server |
| `backend/Routes.hpp` / `.cpp` | Create | Route handler registration + request parsing/dispatch for every route in Scope In |
| `backend/JsonMapping.hpp` / `.cpp` | Create | `AmicoUser`/`AccessLogEntry`/`SystemInformation`/`NewUser`/`UserUpdate` ↔ `nlohmann::json` conversion |
| `backend/ErrorMapping.hpp` / `.cpp` | Create | Decision 6's exception → HTTP status + JSON body mapping |
| `backend/BackendConfig.hpp` | Create | Env-var parsing (`AMICO_BASE_URL`/`USERNAME`/`PASSWORD`, `BACKEND_BIND_ADDRESS`, `BACKEND_PORT`, `BACKEND_ALLOW_NETWORK_EXPOSURE`) + the bind-address opt-in gate validation (Decision 3.1) |
| `test/backend/test_routes.cpp` | Create | Offline integration tests (Decision 7) |
| `test/backend/live_backend_smoke_test.cpp` | Create | Gated, read-only live smoke test |
| `docs/backend-api.md` | Create | Full route/request/response/error documentation + Decision 3's security warning |
| `docs/src-map.md` | Modify | Add rows for the new `backend/` files |

---

## Risks and unknowns

- **`cpp-httplib` availability via vcpkg is unverified** — Task 0.1
  must confirm this before any other work proceeds; if unavailable,
  escalate to the user for a fallback library choice rather than
  guessing.
- **Decision 3's accepted risk (no auth layer) is real, not
  theoretical** — anyone who can reach this server's bind address can
  invoke `setPassword`/`setAdministrator` with no confirmation step.
  Mitigated only by the loopback-only default bind address; the
  operator must not widen this without adding a real auth layer first.
- **Image upload routes need a raw-body (non-JSON) request path** —
  `cpp-httplib` supports this natively (raw request body access), but
  this is a different code path from every other (JSON) route and
  needs its own careful test coverage.
- **`AmicoClient`'s thread-safety is unconfirmed** — Decision 4's mutex
  serialization is the mitigation; if a future perf need arises, this
  would need real profiling before considering removing the mutex.
- **The two Decision 3 guardrails are accident-prevention, not
  security** — worth restating so a future reader doesn't mistake them
  for real access control. Both need explicit offline test coverage:
  server startup refusing to bind to a non-loopback address without
  `BACKEND_ALLOW_NETWORK_EXPOSURE=1`, and both sensitive routes
  returning 428 without the confirmation header (and succeeding with
  it, using the fake-transport-backed test server).

---

## Open questions

- [ ] None blocking — Task 0.1 (cpp-httplib availability) is the only
      unresolved item, and it is a discovery task, not a design
      ambiguity.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal is a runnable server with a clear route surface |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items, each with reasoning |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | New `backend/` directory kept separate from `src/`/`include/` — doesn't touch the already-verified SDK |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Every route traces directly to an existing, already-tested `AmicoClient` method |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
