# Decision Log — Fix: user profile photos never display in the web frontend

---

## Decisions

### 2026-09-13 — Expected drift: `KNOWN_HARNESS_BUG`, same category as every prior plan this session
**Context:** `eng plan drift` flags `docs/src-map.md`, `include/amico/
Client.hpp`, `include/amico/Types.hpp`, `src/Client.cpp`, `test/
test_errors.cpp`, `test/test_users.cpp` as changed since this plan's
`planned_at.git_sha`. All six are uncommitted edits from Giai đoạn 2b
(under the standing "no commit" instruction) and are also all inside
this plan's own `write_scope` (populated at scaffold time, per the
lesson learned during Giai đoạn 5's `PLAN_DRIFT_DETECTED` loop).
**Decision:** Treat as expected, benign, additive drift — proceeding
directly to Group 1 execution.
**Reasoning:** Same root cause documented across every prior plan this
session: `eng plan drift`/`eng verify` conflate ALL uncommitted repo
changes with "unexpected changes for this plan" under the standing "no
commit" instruction. These specific files are also genuinely part of
this plan's own planned edits, so the overlap is expected, not a
surprise.
**Alternatives rejected:** Committing Giai đoạn 2b's changes to clear
the drift — rejected, contradicts the standing "no commit" instruction.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-13 — Codex blocked by a stale leftover `amico_backend.exe` process from Giai đoạn 5's live testing
**Context:** Task 2.1's build failed to link (`LNK1168: cannot open
amico_backend.exe for writing`). Root cause: `amico_backend.exe` (PID
69564), started for Giai đoạn 5's live verification, was still running
— the `TaskStop` call used to end that background bash task had not
actually killed the child Windows process.
**Decision:** Force-killed the process directly (`taskkill //PID 69564
//F`); rebuild succeeded immediately.
**Reasoning:** `TaskStop` on a bash wrapper task does not reliably kill
a long-running child process it spawned on Windows — a real gotcha
worth remembering for future live-testing cleanup in this project:
verify with `tasklist` after stopping a background server task, don't
assume it's gone.
**Alternatives rejected:** None — this was a straightforward cleanup,
not a design decision.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-13 — Resolved: spec.md's "any non-2xx → empty body" vs tasks.md's "only 404 special-cased" discrepancy
**Context:** Codex correctly flagged that spec.md's Decision 3 says
"if the device's own response... is a 404 (or any non-2xx), the
backend route returns the same status with no body," while tasks.md's
Task 2.1 (which Plan Review approved) only special-cases 404 —
other exceptions go through the existing `respondError`/`mapException`
JSON-error path. Plan Review missed this wording mismatch.
**Decision:** Honor tasks.md's actual (approved, implemented) behavior:
only 404 gets the empty-body passthrough; genuine errors (500, 502,
etc.) still get the normal JSON error body. spec.md's broader wording
is corrected in spirit here, not literally amended (no re-review
needed for a documentation wording fix).
**Reasoning:** An `<img>` tag's `onerror` handler doesn't care about
response body content at all — the visual outcome (fallback to
placeholder) is identical either way. Keeping genuine errors in the
existing JSON-error shape preserves debuggability (e.g. via browser
devtools' network tab) and consistency with every other route in this
backend, which is more valuable than spec.md's stricter original
wording.
**Alternatives rejected:** Changing the implementation to strip the
body on every non-2xx status — rejected, loses error detail for no
user-visible benefit and breaks this backend's otherwise-universal
JSON-error-shape convention.
**Decided by:** Claude (orchestrator), based on Codex's own finding
**Status:** Active

---

### 2026-09-13 — Group 4 (read-only) live approval received
**Context:** User sent `APPROVE_LIVE_DEVICE_TEST:2026-09-13-fix-user-
profile-photo-not-displaying-in` as a fresh, distinct message.
**Decision:** Proceeding with Task 4.1 — no write action anywhere in
this plan, so this single read-only approval covers all of Group 4.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-13 — Live evidence resolves spec.md's Open Question, with a correction: the device returns 400, not 404, for a nonexistent user id
**Context:** All 3 real users on the device currently have an enrolled
photo (confirmed live: ids 5, 36, 4 all render real JPEGs now, 200 with
`Content-Type: image/jpeg`, byte counts matching real photos) — so
there was no naturally-occurring "real user with no photo" case to test
against. Rather than create a disposable test user (a WRITE action
requiring a separate `APPROVE_LIVE_DEVICE_WRITE_TEST` token this plan's
read-only approval does not cover — caught before acting, same
discipline as Giai đoạn 5's self-correction), tested read-only against
a definitely-nonexistent user id (9999) directly via `curl`.
**Result:** The device responded `400 Bad Request` to `/user_get_image.
fcgi?user_id=9999` — not `404` as spec.md's Decision 3 assumed. Task
2.1's backend route only special-cases `404` for the empty-body
passthrough; a `400` here falls through to the normal
`respondError`/`mapException` JSON-error path instead (confirmed via
this same curl call: `{"error":"unexpected HTTP status 400 from
/user_get_image.fcgi?user_id=9999","type":"HttpError"}`).
**Decision:** No code change needed. `frontend/users.js`'s `<img
onerror=placeholder>` handler fires on ANY failed image load
regardless of HTTP status code (confirmed by reading the browser
`<img>` element's `error` event semantics and by this codebase's own
`image.addEventListener("error", placeholder)` — not status-code
specific) — so the user-visible outcome (clean "No image" placeholder,
no broken-image icon) is identical whether the backend responds with a
bare 404 or a JSON-bodied 400/500/etc. The distinction only affects
whether the browser's network tab shows a JSON error body or an empty
one, which is not part of this plan's acceptance criteria.
**Alternatives rejected:** Creating a disposable test user to observe
an "existing user with a genuinely absent photo" case — deferred; would
require a fresh write-tier approval for a distinction that doesn't
change the user-visible outcome. Can be revisited if ever needed.
**Decided by:** Claude (orchestrator)
**Status:** Active — spec.md's Open Question is resolved (device's
no-image response for a nonexistent id is 400, not 404); the fix's
actual user-visible behavior is unaffected either way.

---

### 2026-09-13 — `eng verify` FAIL: `KNOWN_HARNESS_BUG`, same category as every prior plan this session
**Context:** `eng verify` reports "unexpected changes outside
write_scope" for 15 files, all uncommitted edits from Giai đoạn 0/1/2b
— none belong to this plan.
**Decision:** Treat as expected, benign `KNOWN_HARNESS_BUG` — this
plan's own independently-verified results (offline build/test re-run,
source review, live verification) are the real signal of correctness.
Plan complete: Groups 1-4 all done, all tests PASS.
**Decided by:** Claude (orchestrator)
**Status:** Active — plan complete.

---
