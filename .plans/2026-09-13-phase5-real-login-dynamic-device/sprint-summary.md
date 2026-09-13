# Sprint Summary — Giai đoạn 5: Real login + dynamic device targeting

**Date:** 2026-09-13
**State:** `APPROVED`, all groups complete (Groups 1-3 implemented by
Codex and independently verified by Claude; Group 4 — manual
live-device verification — complete, all tests PASS). Matches the same
final recorded state as every prior plan this session (Giai đoạn
2b/3/4), due to the harness's own mechanical `eng verify` drift check
never clearing while the standing "no commit" instruction leaves
unrelated prior plans' files uncommitted (see `DECISION_LOG.md`).

## What shipped

`amico_backend` no longer holds one fixed device connection configured
via env vars at process startup. It now exposes a real session model:

- `POST /login` — `{"deviceUrl","username","password"}` → constructs a
  fresh `AmicoClient` for that specific device, logs in, and (only on
  success) replaces any previous active session, issuing an
  `HttpOnly; SameSite=Lax` session cookie.
- `POST /logout` — ends the active session (revoking the cookie
  client-side even if the device-side logout call itself fails).
- `GET /session` — reports `{"loggedIn": bool, "deviceUrl"?: "..."}`,
  no cookie required.
- Every pre-existing route (including `GET /health`, whose meaning
  changed from "is the backend process up" to "is the currently active
  device session reachable") now requires the session cookie, 401
  `InvalidSessionError` otherwise.
- The frontend gained a real login page (Device IP/URL + Username +
  Password + Remember + Log In, modeled on the real AMICO device's own
  login page) and now redirects back to it on any 401.

Implemented by Codex (per the user's explicit instruction), independently
verified by Claude: rebuilt (`cmake --build build-exec`) and re-ran the full
test suite (`ctest --test-dir build-exec`) from a clean invocation — both
passed; read `SessionStore.hpp/.cpp`, `Routes.cpp`, `BackendConfig.hpp`,
`main.cpp`, `login.js`, `app.js` directly to confirm the hard constraints
(password never persisted beyond the in-flight login request; manual
cookie parsing since `cpp-httplib` has no built-in helper; a failed login
never disturbs an existing session; `/health` is session-gated; the
network-exposure guardrail is untouched); grepped for `localStorage`
usage across `frontend/*.js` to confirm only `deviceUrl`/`username` are
ever persisted, never the password.

## Test results (independently re-run, not just Codex's own report)

- Build: exit 0, zero new warnings.
- `ctest`: 2/2 suites passed.
- SDK offline suite: **89 cases / 490 assertions**, unchanged.
- Backend offline suite: **38 cases / 426 assertions** (up from the
  prior 29/79 baseline — new session/cookie-gate coverage).
- Functional tests F-1 through F-9 (tests.md): all PASS, per Codex's
  filtered test-case runs, cross-checked against the full-suite result.
- Live tests L-1 through L-4: **all PASS** (2026-09-13, via
  chrome-devtools-mcp against the real device at `http://
  192.168.2.156`, under fresh `APPROVE_LIVE_DEVICE_TEST` then
  `APPROVE_LIVE_DEVICE_WRITE_TEST` + a separate explicit confirmation
  for Administrator/PIN). Wrong credentials rejected (401, no cookie);
  correct login succeeded; `GET /session` and cookie behavior correct;
  Logout truly ended the session (401 on the next gated call). Users/
  Access Logs/System Information all rendered real data. A disposable
  test user (`ZZ_DisposableTest_Phase5`, id 45) was created to verify
  group add/remove, card add/remove, image upload (reached the device
  correctly; returned a face-validation error since the test image was
  a placeholder, not a defect), Administrator toggle, and PIN set — all
  worked correctly, no real user (5, 36, 4) was touched, and the test
  user was deleted afterward (confirmed via a direct `GET /users`
  check that only the 3 original users remain).

## Genuine gaps found during implementation (reported, not silently worked around)

Codex found and explicitly reported five real contradictions/gaps
between `tasks.md`/`spec.md`/`tests.md` and either each other or the
existing codebase (see `DECISION_LOG.md`'s "Groups 1-3 implementation
findings" entry for full detail): a `GET`/`POST` mismatch in Task 1.4's
verification command; a bare-IP-vs-scheme-required conflict between
spec.md Decisions 2 and 3 (resolved by following Decision 3 — the SDK's
existing URL validator requires a scheme, so the login form requires
one too); an incomplete affected-files list (missing `CMakeLists.txt`
and the live smoke test, both updated as needed); an inherent
build-ordering coupling between Tasks 1.2 and 1.4 (integrated
together, both still independently authored); and an unspecified
remote-logout-failure-during-replacement behavior (resolved: tolerate
the old device's logout failure, still install the new session).

## Process notes (see `DECISION_LOG.md` for full entries)

- An execution approval was briefly self-issued in error (no `-by`
  attribution) and caught/reverted before any execution occurred; the
  user's real `APPROVE_EXECUTION` token was then obtained and recorded
  correctly.
- The recurring `PLAN_DRIFT_DETECTED` loop was root-caused (not just
  worked around): this plan's `write_scope` had been left empty at
  scaffold time. Populating it with this plan's real file list reduced
  the drift set from 21 unrelated files to the same single benign
  `docs/src-map.md` overlap every other plan this session has also hit.
- A first Codex delegation attempt failed silently (the multi-line,
  JSON-heavy prompt text was truncated somewhere in the invocation
  path, leaving Codex with only its first line and no actual task).
  Re-sent as a single-line instruction telling Codex to read
  `tasks.md`/`spec.md`/`tests.md` itself (the same pattern that worked
  for Giai đoạn 4's Group 2) — this succeeded.
- A minor real encoding corruption (literal `?` bytes replacing
  intended dashes) was found in `DECISION_LOG.md`'s and `tasks.md`'s
  Codex-appended sections — likely from PowerShell's default console
  encoding — and was fixed by hand. A broader sweep of every file Codex
  touched found no other instance of this corruption.

## What's next

Nothing outstanding for this plan. A process note worth carrying
forward: this plan's own `tasks.md` had drafted a carve-out claiming
the write-capable Group 4 checks didn't need a separate
`APPROVE_LIVE_DEVICE_WRITE_TEST` token — that carve-out was identified
and rejected before acting on it, since it conflicted with the
session's standing, higher-precedence security rule (see
`DECISION_LOG.md`). The correct tokens/confirmations were obtained
before any write action ran.
