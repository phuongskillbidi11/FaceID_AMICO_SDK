# Plan Review — Visitors (Enroll → Visitors)

**Reviewer:** Claude (plan-reviewer role, same session — normal assurance mode permits this)

## Pass 1 — REJECT (2 blocking issues)

Reviewed spec.md/tasks.md/tests.md against the checklist, cross-checking every claim against
direct reads of the actual current source (not trusting my own tasks.md prose from memory).

### Finding 1 — Task 1.1 doesn't address the now-stale `NewUser`/`UserUpdate` doc comments

`include/amico/Types.hpp`'s current `NewUser`/`UserUpdate` doc comments both state (verbatim):
> "`userTypeId`, `beginTime`, and `endTime` are absent because no confirmed Web UI write payload
> includes them."

Task 1.1 adds `userTypeId` as a real field to exactly these two structs (well — only `NewUser`
per the design; `UserUpdate` correctly does *not* get `userTypeId` per spec.md Decision 3's
"a visitor's type never changes after creation" reasoning). Left as-is, `NewUser`'s comment
would sit directly above a `userTypeId` field it claims doesn't exist — self-contradictory and
confusing to a future reader, and it would erase the historical record of *why* it was
originally omitted (which is still valid context — this plan is adding new, narrower evidence,
not overturning the old finding wholesale).

**Required fix:** Task 1.1 must explicitly say to update both comments: keep the historical
"no confirmed Web UI write payload" note but add that this plan (2026-09-14, Visitors) found
new evidence via direct live class introspection that the *generic "usertype" system* (not the
plain `user.js` `User.save()` the original finding covered) does set `user_type_id` via a
per-type `defaultValue` — cite spec.md's Background section. `UserUpdate`'s comment needs the
same historical-context preservation, noting `userTypeId` was deliberately still left off it
(not an oversight) since Visitors' type is fixed at creation in this plan's scope.

### Finding 2 — Task 4.1/4.2 never mention `fromJsonNewUser`/`fromJsonUserUpdate`, the actual deserialization path

Confirmed via direct read of `backend/JsonMapping.cpp` (lines 71-88): the existing `POST /users`/
`PATCH /users/:id` handlers do **not** parse their request JSON inline in `Routes.cpp` — they
call shared helpers `fromJsonNewUser(body)`/`fromJsonUserUpdate(id, body)` (declared in
`JsonMapping.hpp`), which read exactly `name`/`registration` today. Task 4.1 only covers
`toJson(AmicoUser)` (the *serialization*/response side); Task 4.2 says the `/visitors` route
should "parse an optional `cpf` string field" but never says where — as written, an executor
would plausibly duplicate JSON-parsing logic inline in `Routes.cpp` instead of extending the
already-shared helper, creating two divergent parsing paths for the same concept (one of them
undiscovered/untested).

**Required fix:**
1. Task 4.1 must also extend `fromJsonNewUser`/`fromJsonUserUpdate` to parse an optional `"cpf"`
   field (same `body.contains(...) && !body[...].is_null()` pattern `fromJsonUserUpdate` already
   uses for `registration`) into `NewUser.cpf`/`UserUpdate.cpf`. This function is shared by both
   `/users` and `/visitors` — parsing `cpf` generically there is harmless for `/users` (its own
   frontend never sends that key, so it stays unset) and avoids a second, divergent parsing path.
2. Task 4.2 must explicitly say: the `/visitors` `POST`/`PATCH` handlers call the *same* shared
   `fromJsonNewUser`/`fromJsonUserUpdate` used by `/users`, then set `newUser.userTypeId = 1`
   explicitly in the route handler itself (not parsed from the request body at all — a visitor's
   type is fixed by which route was called, never client-supplied) before calling
   `client.users().create(newUser)`.

## What's already solid (no changes needed)

- **The trailing-default-parameter design for `buildUsersListBody`/`buildUserCreateBody`**
  (Task 2.1) correctly avoids the exact same-type positional-argument hazard the Access Logs
  plan's own Plan Review caught earlier this session — confirmed by checking all 5 existing call
  sites of `buildUsersListBody` and 2 of `buildUserCreateBody` (`src/Client.cpp`,
  `test/test_query_whitelist.cpp`): all are 2-argument calls that remain valid unchanged since
  C++ allows omitting trailing defaulted parameters. No signature-order risk here.
- **`buildUserGetBody`'s "no type filter" claim** (spec.md Decision 1, tasks.md Task 2.1) —
  confirmed via direct read (`src/ObjectQuery.cpp` lines 45-57): its `where` is only
  `[{"field":"id","value":id}]`, no type filter at all. Accurate.
- **`removeUserImage`'s "no throw on zero changes" precedent** (tasks.md Task 3.2's citation for
  the new `c_users` defensive delete) — confirmed via direct read (`src/Client.cpp` lines
  555-566): exact match, including the reasoning in its own comment.
- **`kUserWritableFields` needs no change** — confirmed it is not actually enforced anywhere in
  the code (only asserted against a literal `{"name","registration"}` in one test); this plan's
  new writable surface (`userTypeId` on create, `cpf` on create/update) goes through separate,
  dedicated code paths, not this constant, so it correctly stays untouched and still accurate.
- Every other design decision (separate `/visitors` routes, `c_users` as a second device call,
  the `users.js` → shared-factory refactor) checked against the checklist's remaining categories
  (missing requirements, architecture inconsistencies, missing edge cases/tests, dependency
  problems, security/hardware impact) — no further issues found.

## Summary

2 findings, both mechanical/precision fixes to tasks.md (no spec.md design change needed) —
same pattern as the Access Logs plan's own first review pass.

**Blocking issues:** 2

## Pass 2 — Re-review after Planner's fixes

Re-read the updated `tasks.md` in full (not taking a summary on faith):

1. **Finding 1 fix confirmed**: Task 1.1 now explicitly instructs preserving the historical
   "no confirmed Web UI write payload" note on both `NewUser`/`UserUpdate` while adding the new,
   narrower evidence citation, and explicitly explains why `UserUpdate` still has no `userTypeId`
   (deliberate, not an oversight). No self-contradiction remains.
2. **Finding 2 fix confirmed**: Task 4.1 now explicitly extends `fromJsonNewUser`/
   `fromJsonUserUpdate` (named, with the exact existing pattern to mirror) instead of leaving the
   parsing location unspecified; Task 4.2 now explicitly says `/visitors`' handlers reuse these
   same shared functions and set `userTypeId = 1` in the route handler itself, never from the
   request body. No divergent parsing path risk remains.

No new issues introduced by the fixes (re-checked: the fix correctly identifies `userTypeId` as
route-set, not body-parsed, consistent with spec.md Decision 1/2's own framing).

## Verdict: PASS

Both blocking issues resolved with specific, verifiable fixes. No remaining findings against the
review checklist.

**Blocking issues:** 0
