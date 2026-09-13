# Plan Review — Fix: user profile photos never display in the web frontend

**Reviewer:** Claude (Plan Reviewer role)
**Date:** 2026-09-13
**Verdict:** APPROVED (pass 1)

---

## Verification against actual source (not assumed)

- `backend/JsonMapping.cpp:21` confirmed: `j["imageUrl"] = user.imageUrl;`
  — matches spec.md's root-cause claim exactly; Task 2.2's fix targets
  the correct line.
- `src/Client.cpp:422` confirmed: `user.imageUrl = "/user_get_image.fcgi?
  user_id=" + std::to_string(user.id);` — device-relative, matches the
  root-cause analysis.
- `frontend/users.js:56-65` confirmed: the existing `<img>` +
  `onerror -> placeholder` logic already handles both a successful
  image load and a 404 correctly — Decision 2/3's claim that no
  frontend change is needed is verified, not assumed.
- `include/amico/Errors.hpp:59-68` confirmed: `HttpError(int
  statusCode, const std::string& message)` — Task 1.2's plan to throw
  `amico::HttpError(404, ...)` for a missing image, and Task 2.1's plan
  to catch it via `statusCode() == 404`, both use the real constructor
  and accessor correctly.
- `build-exec/vcpkg_installed/x86-windows/include/httplib.h:1781`
  confirmed: `void set_content(const std::string &s, const std::string
  &content_type);` exists — Task 2.1's binary-bytes-via-std::string
  plan is valid, matching how `req.body` is already used elsewhere in
  this codebase for the image-upload path.
- `test/backend/test_routes.cpp:548-568` confirmed: the cookie-gate
  test is a genuine data table (`std::vector<std::pair<method,
  path>>`) iterated in a loop — Task 3.2's plan to add one entry to
  this existing table (rather than write a duplicate one-off test) is
  accurate and matches the file's real structure.
- `test/test_errors.cpp:52-79` confirmed: the existing 401/`autoRelogin`
  test pattern for `list()` is exactly what Task 3.1/Test F-5 plans to
  mirror for `getImage`.
- `include/amico/Types.hpp:44` confirmed: `AmicoUser` struct location
  — Task 1.3's plan to add a `UserImage` struct nearby is a reasonable,
  minimal placement.

No incorrect assumption found in `spec.md`/`tasks.md`/`tests.md` against
the actual current source — a rarity worth noting given this plan's own
spec.md flagged its `getImage`'s `Content-Type` handling as an open
question mid-draft (Task 1.2) and then resolved it explicitly in the
very next task (Task 1.3) rather than leaving it for the Executor to
improvise, which is exactly the discipline this checklist exists to
enforce.

---

## Checklist coverage

- **Missing requirements:** none — spec.md's Goal (real photos render
  for users who have one) is fully covered; the one Open Question
  (device's exact no-image response) is correctly deferred to Group 4
  live verification rather than guessed at in the offline design.
- **Incorrect assumptions:** none found (see verification list above).
- **Architecture inconsistencies:** none — reuses Giai đoạn 5's
  session-cookie gate pattern exactly, reuses the existing
  `HttpError`/`ErrorMapping` hierarchy without inventing a new error
  type, matches the existing authenticated-transport-helper pattern
  (`postAuthenticatedJson`/`postAuthenticatedBinary` → now
  `getAuthenticatedBinary`).
- **Missing edge cases:** none — Task 3.1/tests.md F-1 through F-5
  cover success, missing-header default, 404, other-non-2xx, and both
  `autoRelogin` states; Task 3.2/F-6 through F-8 cover the backend side
  symmetrically (success, 404-passthrough, malformed id, missing/wrong
  cookie).
- **Missing tests:** none — every Group 1/2 change has a corresponding
  Group 3 test; Group 4's live tests correctly target the plan's one
  genuinely unverifiable-offline risk (the device's real no-image
  response shape).
- **Dependency problems:** none — task ordering (SDK helper → SDK
  method → Content-Type resolution → backend route → JSON mapping →
  tests → docs) is sound and matches how Giai đoạn 5's own Group 1
  ordering was structured.
- **Security/hardware impact:** this plan adds one new READ-only route
  behind the existing session-cookie gate — no new write action, no
  credential exposure, no change to the network-exposure guardrail.
  Appropriately scoped as read-only for Group 4's live-approval tier
  (only `APPROVE_LIVE_DEVICE_TEST` needed, never a write-tier token).

## Non-blocking note

`write_scope` in `plan.yaml` was populated with this plan's literal
file list at scaffold time (learned directly from the
`PLAN_DRIFT_DETECTED` root-cause found during Giai đoạn 5) — confirmed
already done before this review, so no repeat of that harness-loop
issue is expected for this plan.
