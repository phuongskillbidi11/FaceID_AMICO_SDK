# Spec — Giai đoạn 5: Real login + dynamic device targeting

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.

---

## Goal

Replace `amico_backend`'s fixed, env-var-configured, always-on device
connection (Giai đoạn 3's Decision 2) with a **real login flow**: the
frontend shows a login page (visually modeled on the real AMICO
device's own `login.html`) asking for **Device IP, Username, Password**
— submitting these calls the real device's own login, and only on
success does the backend become usable. The system manages **one
device at a time**, chosen at login (not a fixed device baked in at
backend startup, and not a multi-device fleet dashboard). A real
backend-issued session cookie gates every other route — without it,
the API returns 401, not just "whichever device happened to be
configured."

**Done looks like:** opening the frontend shows a login form (Device
IP/URL, Username, Password, Remember, Log In). Submitting valid
credentials for a reachable device logs in for real (the device
rejects bad credentials exactly as it always has) and reveals the
existing Users/Access Logs/System Information tabs, now operating
against whatever device was just logged into. A Logout action ends the
session (both the backend's own session cookie and the underlying
device session) and returns to the login form. No route works before a
successful login.

---

## Background

Giai đoạn 3 built `amico_backend` around ONE `AmicoClient`, configured
once at process startup from `AMICO_BASE_URL`/`AMICO_USERNAME`/
`AMICO_PASSWORD` env vars, with no login route at all (Decision 2: "no
`/login` route ... every HTTP request the frontend makes is already
'authenticated'"). Giai đoạn 4 built the frontend on top of that
assumption (Decision 5: "no frontend-side authentication ... adding a
frontend-only login would be security theater").

The user's own explicit follow-up request (2026-09-13) changes both of
those decisions deliberately, not by accident:
- **Real login, not theater:** the login form's credentials must be
  checked for real, against the real device (exactly what Decision 5
  argued *against* building without a real backing check — this plan
  provides the missing real check).
- **Multi-device by IP, one at a time:** "mỗi device Face ID sau này
  đều có 1 địa chỉ IP khác nhau... web (FE) + BE của mình sau này chỉ
  cần biết địa chỉ IP của con đó" — the backend must connect to
  whichever device's IP is supplied at login, not a fixed one.
  Confirmed explicitly: **one device managed at a time** (not a
  multi-device dashboard) — switching devices means logging out and
  back in with a different IP.
- **Scope for this plan specifically:** login + the architecture change
  only. Other sidebar areas the real AMICO UI has (Groups, Visitors,
  Time Zones, Holidays, Scheduled Unlock, User Types, Custom Fields,
  Alarms, Reports, Data Tools, Settings) are explicitly **not** in this
  plan — most aren't even implemented in `amico_sdk` yet (only
  partially protocol-documented from earlier discovery phases) — a
  separate future roadmap, not this plan's concern.

---

## Design decisions

### Decision 1 — Backend session model: one active device connection, gated by a real backend-issued session cookie
- **Chosen:** `amico_backend` no longer builds an `AmicoClient` at
  startup. It holds `std::optional<AmicoClient> activeClient` (guarded
  by the existing `clientMutex`) and a `std::string activeSessionToken`
  (empty = nobody logged in). New routes:
  - `POST /login` — body `{"deviceUrl", "username", "password"}`.
    Builds an `AmicoConfig` from these three fields (`autoRelogin =
    true`), constructs a fresh `AmicoClient`, calls `login()`. On
    success: if a previous session existed, logs it out first; stores
    the new client as `activeClient`; generates a new
    cryptographically-random `activeSessionToken` (via
    `std::random_device`, hex-encoded, ≥ 128 bits); sets it as an
    `HttpOnly; SameSite=Lax` cookie (`amico_session=<token>`) on the
    response. On failure: whatever `AmicoClient::login()` throws (e.g.
    `AuthenticationError` → 401) maps via the existing `ErrorMapping`,
    unchanged.
  - `POST /logout` — calls `activeClient->logout()` if set, clears
    `activeClient` and `activeSessionToken`, clears the cookie.
  - `GET /session` — returns `{"loggedIn": true/false}` (and, if
    logged in, the connected device's `deviceUrl` so the frontend can
    display "Connected to <ip>") — the frontend calls this once on
    page load to decide whether to show the login form or the main UI
    (mirrors the real device's own `session_is_valid.fcgi` pattern).
  - **Every other existing route** now requires a valid
    `amico_session` cookie matching `activeSessionToken` (checked in
    `Routes.cpp`, before any route-specific logic) — missing/wrong
    cookie → `401 {"error": "not logged in", "type":
    "InvalidSessionError"}`, `AmicoClient` never touched.
- **Why "one device at a time," not a session-per-browser or
  multi-device store:** the user explicitly confirmed this scope. It
  keeps `amico_backend` at exactly the complexity it already has
  (Giai đoạn 3 Decision 4's single mutex-guarded client) — just
  replacing "configured once at boot" with "configured once at login,
  replaceable by a new login." A determined second browser tab that
  logs in with different credentials *replaces* the active session
  (matching "manage one device at a time," not silently maintaining
  two).
- **Rejected alternatives:** a session-per-browser store (multiple
  concurrent `AmicoClient`s, one per logged-in browser) — rejected,
  explicitly out of scope per the user's own answer, and meaningfully
  more complex (session expiry/cleanup, unknown whether the real
  device even supports multiple concurrent admin sessions — unverified,
  would need its own discovery pass) — reusing the device's own session
  cookie/token directly as the frontend's session cookie (skip issuing
  a separate backend-generated one) — rejected: the device's own
  session token is meant for that device's own cookie-auth scheme, not
  as a generic bearer credential for our unrelated backend's session
  gate; issuing our own decouples the two and avoids relying on
  undocumented specifics of the device's token format.

### Decision 2 — Login page: visually modeled on the real device's `login.html`, plus one added field
- **Chosen:** `frontend/login.html` (or a login view within
  `index.html`, toggled by `GET /session`'s result) reproduces the real
  device's login page's actual structure (confirmed live in earlier
  phases of this project): "Amico" heading, "Web interface for device
  configuration" subtitle, "User" label + textbox, "Password" label +
  password textbox, "Remember password" checkbox, "Log In" button. This
  plan adds **one more required field the real page doesn't have**: a
  "Device IP / URL" text input (e.g. `192.168.2.156` or
  `http://192.168.2.156`), since our frontend must know which device to
  reach — the real device's own login page never needs this because
  it's already served *by* that specific device.
- **Why:** Directly matches the user's explicit ask for visual
  familiarity, while being honest that one field must differ for a
  reason the user already understands (multi-device targeting).
  "Remember password" — see Decision 4 for what this actually persists
  (never the password itself).
- **Rejected alternatives:** Omitting the "Device IP" field and
  hardcoding a single device (rejected — defeats the entire point of
  this plan) — a device *picker* (dropdown of previously-used IPs)
  instead of a free-text field — deferred, not rejected outright, but
  out of scope for this pass (Decision 4's "remember" only remembers
  the last-used IP/username as a convenience, not a full picker UI).

### Decision 3 — `deviceUrl` validation reuses `amico_sdk`'s own existing validator
- **Chosen:** `POST /login`'s handler passes the submitted `deviceUrl`
  straight into `AmicoConfig::baseUrl`, and relies on `AmicoClient`'s
  constructor (`src/UrlValidation.cpp`, already used and tested) to
  reject bad values (embedded credentials, unsupported scheme, query
  string/fragment) — a `ConfigurationError` from that path maps to
  `500` via the existing table (Giai đoạn 3 Decision 6) since the
  *server* (this backend) failed to construct a client, not because
  the caller's JSON body itself was malformed. If the caller omits
  `deviceUrl` (or `username`/`password`) entirely from the request
  body, that's the request-body-parsing stage (Giai đoạn 3's earlier
  amendment) → `400`.
- **Why:** No need to reinvent URL validation — `amico_sdk` already has
  a tested one; reusing it keeps this plan's own code minimal.
- **Rejected alternatives:** A separate frontend-side URL regex check
  — rejected as redundant; the backend's own validation is
  authoritative and already tested, and duplicating it client-side
  would risk the two disagreeing.

### Decision 4 — "Remember password": remembers the IP + username only, never the password, and only in `localStorage`
- **Chosen:** Checking "Remember password" stores `deviceUrl` and
  `username` (not `password`) in the browser's `localStorage`,
  pre-filling them on the next visit. The password field is always
  left blank on load, exactly like the real device's own login page
  behavior for its username field only (the real page pre-fills
  `Admin` as a username default, never a password).
- **Why:** Matches the label's real intent (convenience for
  *returning* to the same device) without ever persisting a plaintext
  credential in browser storage, which would be a real, unforced
  security regression this project's own discipline would not accept
  (see `feedback_never_expose_password_hash.md`'s broader spirit, even
  though that memory is about the device's own stored hash
  specifically — the same reasoning applies to this frontend
  deliberately choosing not to cache a plaintext password anywhere).
- **Rejected alternatives:** Actually remembering the password (matches
  the checkbox's literal label most closely, but rejected outright —
  an unforced credential-storage risk with no real necessity) — not
  implementing "Remember" at all (rejected — the user asked for visual/
  behavioral parity with the real login page, which does have this
  checkbox, even if this plan gives it a safer meaning).

### Decision 5 — Network-exposure guardrail (Giai đoạn 3 Decision 3.1) is unchanged in this plan
- **Chosen:** `BACKEND_BIND_ADDRESS` still defaults to `127.0.0.1`, and
  widening it still requires `BACKEND_ALLOW_NETWORK_EXPOSURE=1`, exactly
  as Giai đoạn 3 left it. This plan does not reconsider or loosen that
  guardrail, even though real login now exists.
- **Why:** Adding real login is a genuine improvement to this system's
  security posture, but reconsidering the network-exposure default is
  a separate decision the user hasn't asked for in this conversation —
  changing it silently as a side effect of this plan would be scope
  creep on a security-relevant default. If the user wants to revisit
  loosening it now that real login exists, that should be its own
  explicit ask.
- **Rejected alternatives:** Loosening the default bind address now
  that login is real — rejected as an unrequested, unrelated change to
  bundle into this plan.

### Decision 6 — Existing routes' behavior is otherwise unchanged
- **Chosen:** Every route from Giai đoạn 3 (`/users`, `/access-logs`,
  `/system-information`, etc.) keeps its exact existing request/
  response contract — the only change is the new session-cookie gate
  in front of all of them, plus the fact that `activeClient` now comes
  from `/login` instead of startup config.
- **Why:** Keeps this plan's blast radius to exactly what changed
  (session/login), not a rewrite of already-tested route logic.

---

## Scope

### In scope
- `backend/BackendConfig.hpp`: remove the startup `AMICO_BASE_URL`/
  `AMICO_USERNAME`/`AMICO_PASSWORD` requirement (they become optional/
  unused — `BACKEND_BIND_ADDRESS`/`PORT`/`ALLOW_NETWORK_EXPOSURE`/
  `FRONTEND_DIR` stay as-is).
- `backend/SessionStore.hpp`/`.cpp` (new): holds `activeClient`/
  `activeSessionToken`, the random-token generator, and the
  cookie-gate check helper used by `Routes.cpp`.
- `backend/Routes.cpp`: add `POST /login`, `POST /logout`,
  `GET /session`; add the session-cookie gate check to every existing
  route (Decision 1).
- `backend/main.cpp`: no longer logs in at startup; starts the server
  immediately with no active device connection.
- `frontend/login.js` (new) + login markup in `frontend/index.html`:
  the login form (Decision 2), `GET /session` check on page load,
  "Remember" behavior (Decision 4), a Logout button/action.
- `frontend/app.js`: `apiFetch` updated so a `401` response from any
  route (session expired/not logged in) redirects back to the login
  view rather than showing a generic error banner.
- Offline integration tests (`test/backend/test_routes.cpp` extended):
  `/login` success + failure (bad device credentials), `/logout`,
  `/session` both states, every existing route returning 401 without a
  valid session cookie and working normally with one.
- Docs: `docs/backend-api.md` updated (new routes, the cookie-gate
  behavior, the removed startup-config requirement);
  `docs/src-map.md` updated.
- A gated live verification pass (Group 4-equivalent): real login
  against the real device (valid + deliberately invalid credentials),
  confirming the previously-deferred Giai đoạn 4 Group 4 checks now
  work end-to-end starting from the login screen.

### Out of scope (explicitly excluded)
- **Multi-device / multi-session support** — explicitly ruled out by
  the user's own answer (one device at a time).
- **Any other sidebar area** (Groups, Visitors, Time Zones, Holidays,
  Scheduled Unlock, User Types, Custom Fields, Alarms, Reports, Data
  Tools, Settings) — explicitly deferred by the user's own answer to a
  future roadmap.
- **Loosening the network-exposure default** — Decision 5; a separate
  future ask if the user wants it.
- **A device picker / history of previously-used IPs beyond the single
  "remembered" one** — Decision 2's rejected-alternatives note.
- **Rate-limiting login attempts / lockout after repeated failures** —
  the real device itself doesn't appear to implement this either (no
  evidence found in any prior discovery phase); not invented here.
- **HTTPS/TLS for the session cookie** — this backend still speaks
  plain HTTP (Giai đoạn 3's own scope boundary, unchanged); the session
  cookie is `HttpOnly`+`SameSite=Lax` but not `Secure`, consistent with
  the existing plain-HTTP deployment model.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `backend/BackendConfig.hpp` | Modify | Remove startup device-credential requirement |
| `backend/SessionStore.hpp` / `.cpp` | Create | Active-session state + random token generation + cookie-gate helper |
| `backend/Routes.cpp` | Modify | Add `/login`/`/logout`/`/session`; add the cookie gate to every existing route |
| `backend/main.cpp` | Modify | No login-at-startup; start immediately with no device connected |
| `frontend/index.html` | Modify | Login view markup |
| `frontend/login.js` | Create | Login form logic, `GET /session` check, Remember behavior, Logout |
| `frontend/app.js` | Modify | `apiFetch` redirects to login view on `401` |
| `test/backend/test_routes.cpp` | Modify | New cases for login/logout/session/cookie-gate |
| `docs/backend-api.md` | Modify | Document the new routes and session model |
| `docs/src-map.md` | Modify | Update rows |

---

## Risks and unknowns

- **Whether the real device supports being logged into from a
  completely fresh `AmicoClient` repeatedly without issue (e.g. any
  server-side rate limiting on `/hidlogin.fcgi`) is not fully
  characterized** — Giai đoạn 1/2's discovery didn't specifically probe
  this; low risk given normal interactive use, but worth a note.
- **Cookie-based session gating introduces a real CSRF surface** (a
  malicious page could trigger a state-changing request using the
  browser's ambient cookie) that didn't exist when the backend had no
  concept of a session at all. `SameSite=Lax` mitigates the most common
  case (cross-site `GET` navigation) but does not fully eliminate
  same-site or `SameSite=None` vectors from other tabs on the same
  origin. Given this system's own accepted trust boundary (Giai đoạn 3
  Decision 3: no real access control beyond the login itself, meant for
  a trusted local network), this is judged acceptable for this pass,
  but is a real, named tradeoff, not an oversight.
- **`localStorage`'s "remembered" device IP/username is per-browser,
  not synced/shared** — expected and fine, just worth stating so a
  future reader doesn't expect it to persist across browsers/devices.

---

## Open questions

- [ ] None blocking.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal is a working login screen gating a working device connection |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items, each reasoned |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Reuses existing route/error-mapping/JSON infrastructure, only adds the session layer |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Every scope item traces directly to the login-gates-everything goal |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
