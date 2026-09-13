# Plan Review — Giai đoạn 5: Real login + dynamic device targeting

**Reviewer:** Claude (Plan Reviewer role)
**Date:** 2026-09-13
**Verdict (pass 1):** CHANGES REQUESTED
**Verdict (pass 2):** APPROVED

---

## Pass 1 — Finding 1 (blocking) — `GET /health`'s meaning is undefined once the fixed startup client is removed

**Context:** Read `backend/Routes.cpp:70-77` directly. The current
`GET /health` handler calls `client.checkReachable()` against the
single, fixed `AmicoClient` reference passed into `registerAll(...)`
at startup — i.e. "is the (one, pre-configured) device reachable,"
not "is the backend process up." Task 1.3's original text left it
ambiguous whether `/health` is session-gated, and Task 3.1's test
description explicitly hedged on the same open question rather than
resolving it.

**Resolution (pass 2):** Task 1.3 now explicitly states `/health` is
session-gated like every other pre-existing route (no special case;
only `/login`/`/session` are exempt), documents the resulting meaning
change ("is the currently active device session reachable," not "is
the backend process up"), and requires `ErrorMapping.cpp`'s existing
`InvalidSessionError` → 401 `type` string be reused for the
cookie-gate's own 401 response for consistency. Task 3.1's test
description no longer hedges — it explicitly lists `/health` among
the gated routes to test. Task 3.2 now explicitly requires documenting
`/health`'s changed meaning. Confirmed by re-reading the updated
`tasks.md` text — the ambiguity is fully resolved, not deferred to the
Executor.

**Status:** Resolved.

---

## Non-blocking notes (no change required, recorded for the record)

- `backend/ErrorMapping.cpp:29-31` already maps `amico::
  InvalidSessionError` → 401 `{"type":"InvalidSessionError"}` —
  confirmed reused correctly per the pass-2 fix, no new code needed in
  `ErrorMapping.cpp` itself.
- `backend/Routes.hpp:25`'s `registerAll(httplib::Server&,
  amico::AmicoClient&, std::mutex&)` signature is confirmed to need
  the change Task 1.3 describes (swapping the fixed `AmicoClient&`/
  `std::mutex&` pair for a `SessionStore&`) — verified directly
  against the current header.
- Confirmed via direct read of the installed `httplib.h` (lines
  ~5795-5796, ~15337): no dedicated cookie-parsing/building helper
  exists in this `cpp-httplib` version — only plain header-name string
  literals. Task 1.1's manual `Cookie:` parsing approach is correct,
  not a workaround for a missing feature that actually exists
  elsewhere.
- The "a failed login attempt must not disturb an existing valid
  session" requirement is now stated directly in Task 1.3's prose (not
  only in tests.md's Test F-3), so the Executor doesn't have to infer
  it purely from the test description.

---

## Checklist coverage

- **Missing requirements:** none remaining — spec.md's Goal (real
  login + dynamic device targeting) is fully covered by tasks.md's
  Groups 1-3, with Group 4 correctly gated behind a fresh live-device
  approval.
- **Incorrect assumptions:** none — the cookie-parsing claim, the
  `registerAll` signature claim, and the `InvalidSessionError` reuse
  are all confirmed correct against actual source; the `/health`
  ambiguity from pass 1 is now resolved.
- **Architecture inconsistencies:** none — consistent with Giai đoạn
  3's parse-then-call pattern, Giai đoạn 3/4's `KNOWN_HARNESS_BUG`
  precedent, and the network-exposure gate being left unchanged (per
  spec.md Decision 5).
- **Missing edge cases:** none remaining — the "failed login doesn't
  disturb an existing session" case is now covered in both tasks.md
  and tests.md (F-3); `/health`'s gating is now covered in both.
- **Missing tests:** every task group has corresponding tests.md
  coverage; Group 4 (live) correctly deferred to its own gated tests.
- **Dependency problems:** none — task ordering (SessionStore before
  Routes before main.cpp before frontend) is sound.
- **Security/hardware impact:** this plan changes the auth/session
  model directly. The cookie's `SameSite=Lax` CSRF surface is
  correctly named as an accepted risk in spec.md, not silently
  dropped. Network-exposure default is correctly left unchanged. No
  new hardware-state-changing action is introduced (this plan doesn't
  add any new AMICO SDK write call, only changes how existing ones are
  authenticated into).

---

## Verdict: APPROVED

Ready for `eng plan approve` and, once execution approval is obtained
from the user (high-risk, `requires_approval: true`), delegation to
Codex per the user's standing instruction for this plan.
