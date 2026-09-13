# Plan Review — Giai đoạn 2: User CRUD (API ghi đầu tiên của SDK)

> Written by the Plan Reviewer, independently of the Planner. Read-only with respect to
> `spec.md`/`tasks.md`/`tests.md` — this file is the only output of this role.

## Verdict

[x] APPROVED
[ ] CHANGES REQUESTED

## Checklist

| Check | Finding |
|---|---|
| Missing requirements | None. Covers create/update/remove for Users, discovery-first (Group 0) before any code is written, matching the user's request and this project's established evidence discipline. |
| Incorrect assumptions | None found. `postAuthenticatedJson("/load_objects.fcgi", ...)`'s existence in `src/Client.cpp` confirms the generic authenticated-POST helper Task 1.5 plans to reuse for the new `/<command>.fcgi` endpoints; the `POST /<command>.fcgi` dispatcher pattern is already well-established from prior discovery passes. |
| Architecture inconsistencies | None. New builders in `src/ObjectQuery.cpp` follow the exact existing purpose-built, hardcoded-field-list pattern (no generic object/field passthrough) — the same discipline as the three existing read builders. `NewUser`/`UserUpdate` structs mirror `AmicoUser`'s existing field set and doc-comment style. |
| Missing edge cases | Well covered: whether `create_objects`/`object_add` are the same command for `users` (Open Question, explicitly gated behind Task 0.3, not guessed); partial vs. full-field update semantics (flagged in Task 1.2); the live-write test's single-test-user, exact-id-only deletion rule (never name-matched) directly addresses the highest-risk edge case (accidentally touching a real user). |
| Missing tests | None. F-1–F-6 cover discovery completeness, credential-field exclusion, builder whitelist tests, offline CRUD cases, live skip-gate, and the actual live-write run; R-1–R-3 cover read-API regression, the existing read-only live smoke test's behavior, and secret scanning. |
| Dependency problems | Correctly sequenced and enforced: Groups 1–4 explicitly must not guess field/command names ahead of Group 0's findings; Group 5 (live-write) is gated separately from Group 0 (live-read) with two distinct approval tokens, never conflated. |
| Security / hardware impact | This is the most safety-conscious plan in the project's history, appropriately so — it is the first plan that can write/delete real device data. Decision 3 (no credential fields ever), Decision 4 (single self-created/self-deleted test user, exact-id deletion only, separate approval gate distinct from every prior read-only gate), and Task 5.2's explicit "critical incident, not a normal test failure" language for any accidental real-user impact are all exactly the right controls for this risk level. |

## Notes

Approved without changes. Two small suggestions for the Executor, neither
blocking:
1. Task 1.5 leaves `create()`'s return type (`int64_t` vs. `AmicoUser`)
   open pending Group 0's finding on whether the device echoes the full
   row back — good, don't pre-decide this; resolve it explicitly in Task
   0.3's write-up before touching Task 1.5's signature.
2. Consider naming the test user with both a timestamp *and* a
   recognizable prefix that's extremely unlikely to collide with any real
   naming convention already seen on this device (`Phat`, `Phuong Hoang`,
   `Trung Dung` are all short, plain human names) — `SDK_TEST_DELETE_ME_<ts>`
   as already specified is good; just don't shorten it later for
   convenience.
