# Sprint Summary — User profile photo display fix

**Date:** 2026-09-13
**State:** All groups complete (Groups 1-3 implemented by Codex and
independently verified by Claude; Group 4 live verification complete).
No commits made.

## What shipped

Root cause: `AmicoUser.imageUrl` was a path relative to the **device
itself** (`/user_get_image.fcgi?user_id=<id>`), correct for the real
AMICO web UI (served by that device) but wrong for our frontend
(served by `amico_backend` at its own origin) — the browser's request
404'd, silently falling back to the "No image" placeholder even for
users with a real enrolled photo.

Fix: added `UsersApi::getImage(int64_t) -> UserImage{bytes,
contentType}` to the SDK (new `Impl::getAuthenticatedBinary` transport
helper mirroring the existing authenticated POST helpers, same
session/401-retry semantics); added `GET /users/:id/image` to
`amico_backend` (session-cookie gated like every other route, proxies
the real bytes/content-type back to the browser, special-cases a 404
from the SDK into a bare empty-body 404); changed
`backend/JsonMapping.cpp` to build `imageUrl` as `/users/<id>/image`
(backend-relative) instead of passing the SDK's device-relative value
through. No frontend change was needed — `frontend/users.js`'s
existing `<img onerror=placeholder>` logic already handled both
success and failure correctly; it just never had a working URL to try
before.

## Test results (independently re-run by Claude, not just Codex's report)

- Build: exit 0, zero warnings.
- SDK: **95 cases / 517 assertions** (was 89/490; +6/+27, all new,
  `getImage`-specific cases).
- Backend: **41 cases / 476 assertions** (was 38/426; +3/+50).
- All functional tests F-1 through F-9 (tests.md): PASS, confirmed via
  targeted `--test-case` filters, not just the aggregate count.
- Live tests: L-1 fully PASS (real photos now render for all 3 real
  users, confirmed via network inspection: 200, correct
  `Content-Type: image/jpeg`, real byte counts). L-2's scope was
  adjusted — see below.

## Live verification findings

All 3 real users (id 5 "Phat", 36 "Phuong Hoang", 4 "Trung Dung")
already have an enrolled photo, so there was no naturally-occurring
"real user with no photo" case to test the placeholder path against.
Rather than create a disposable test user (a WRITE action that would
require a separate `APPROVE_LIVE_DEVICE_WRITE_TEST` token this plan's
read-only approval does not cover — caught before acting, same
discipline established in Giai đoạn 5), the no-image path was verified
read-only against a definitely-nonexistent user id (9999) directly.

**Finding:** the real device returns `400`, not `404`, for a
nonexistent user id — spec.md's Decision 3 had assumed 404. This
doesn't change the user-visible outcome: `frontend/users.js`'s `<img
onerror>` handler fires on ANY failed image load regardless of HTTP
status code, so the "No image" placeholder still renders correctly
either way — only the network tab's error body shape differs (JSON
vs. empty), which isn't part of this plan's acceptance criteria.
spec.md's Open Question is marked resolved with this correction.

## Process notes

- Codex's first execution attempt hit a real linker failure (`LNK1168:
  cannot open amico_backend.exe for writing`) — root-caused to a stale
  `amico_backend.exe` process left running from Giai đoạn 5's earlier
  live-testing session. `TaskStop` on the bash task that had started it
  had not actually killed the child Windows process — a real gotcha
  worth remembering: always verify with `tasklist` after stopping a
  background server task, don't assume the process is gone. This
  recurred a second time during this plan's own Group 4 cleanup and was
  caught the same way both times.
- Codex found and explicitly reported three genuine gaps/contradictions
  rather than silently guessing: (1) `UserImage`'s richer return type
  superseding the plan's initial bytes-only signature (already
  anticipated and resolved in Task 1.3); (2) a real wording mismatch
  between spec.md ("any non-2xx → empty body") and tasks.md ("only 404
  special-cased") that Plan Review had missed — resolved in favor of
  tasks.md's actual approved behavior, since an `<img>` tag's `onerror`
  doesn't care about body content either way; (3) the existing
  `(\d+)` regex convention can't produce a 400 for genuinely malformed
  (non-numeric) ids since httplib's routing itself would simply not
  match — resolved by using `([^/]+)/image` plus explicit digit
  validation instead, confirmed correct by reading the actual route.

## What's next

Nothing outstanding for this plan.
