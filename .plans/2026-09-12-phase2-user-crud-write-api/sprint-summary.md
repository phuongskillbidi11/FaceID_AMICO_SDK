# Sprint Summary — Giai đoạn 2: User CRUD (API ghi đầu tiên của SDK)

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.
>
> Paste this summary into the next planning prompt under "Previous sprint context"
> so Claude Code starts with accurate state instead of assumptions.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Giai đoạn 2 — User CRUD (Groups 0–5, complete) |
| Plan folder | `.plans/2026-09-12-phase2-user-crud-write-api/` |
| Start date | 2026-09-12 |
| End date | 2026-09-12 |
| Tests | 58 cases / 309 assertions offline (up from 45/250), 0 failed. Group 5 (live write): attempt #1 FAIL (root-caused, fixed), attempt #2 **PASS**. |

---

## Outcome

**Status:** [x] Complete (all Groups 0–5 done and verified, including a
real live create→update→remove cycle against the device) / [ ] Partial / [ ] Abandoned

### What was built (matches tasks.md `[x]` items)
- **Group 0 (live, read-only discovery):** fetched and statically read
  `en_US/js/messenger.js`, `class/user.js`, `class/baseclass.js` — found
  the exact `create_objects`/`modify_objects`/`destroy_objects` payload
  shapes for `users`. Key finding: only `name` and `registration` are
  ever sent by the real web UI's own Save flow — `user_type_id`/
  `begin_time`/`end_time` are **not** writable through any confirmed
  path, narrowing spec.md's original Decision 3 (see `DECISION_LOG.md`'s
  amendment). Also confirmed `create_objects` (row creation) and
  `object_add` (an unrelated, schema-level custom-table command) are
  different commands.
- **Group 1 (SDK code):** `src/ObjectQuery.{hpp,cpp}` — `buildUserCreateBody`,
  `buildUserUpdateBody` (partial-update capable), `buildUserDeleteBody`,
  `kUserWritableFields`. `include/amico/Types.hpp` — `NewUser`,
  `UserUpdate` structs (name/registration only). `include/amico/Client.hpp` /
  `src/Client.cpp` — `UsersApi::create()` (returns device-assigned
  `int64_t` id), `update()`, `remove()`, all throwing `ProtocolError` on
  failure/no-op.
- **Group 2 (offline tests):** `test/test_query_whitelist.cpp` extended
  (object/credential-field/single-id-array assertions for the 3 new
  builders). `test/test_users.cpp` extended with 10 new `TEST_CASE`s
  (success, partial-update field omission, error responses, transport
  timeout propagation) using 6 new sanitized fixtures.
- **Group 3 (docs):** `docs/sdk-usage.md` — new create/update/remove
  usage example. `docs/src-map.md` — updated rows for `ObjectQuery`,
  `Client.hpp`, `Types.hpp`, `test_users.cpp`, `test_query_whitelist.cpp`.
- **Group 4:** full offline build+test gate run once on the fully-edited
  tree — exit 0, zero warnings, 100% test pass.
- **Group 5 (live write, gated):** `test/live/live_write_test.cpp` +
  `amico_live_write_test` CMake target. **Attempt #1 FAIL** — HTTP 400
  from `create_objects.fcgi` (root cause: `values` needed a one-element
  array, not a bare object — Group 0's static read had missed one line
  of `messenger.js`'s control flow). Fixed in `src/ObjectQuery.{hpp,cpp}`,
  docs corrected with an explicit note, both affected offline tests
  fixed, suite re-verified green. **Attempt #2 PASS** — full 6/6 live
  sequence (create → verify → update → verify → remove → verify-gone)
  against the real device, test user `id=37`, zero pre-existing users
  touched. This also live-confirms `update()`'s partial-update design
  (previously just a plausible-but-untested choice).

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| `examples/create_user_example.cpp` | spec.md marked it "cân nhắc" (optional); `docs/sdk-usage.md`'s new snippet already covers the same usage | Only if a future need for a standalone example binary arises |

---

## Discoveries (not in the spec)

- **`user_type_id`/`begin_time`/`end_time` are not writable through any
  confirmed path** — a real, evidence-backed finding that narrowed this
  plan's own original field-set assumption (spec.md Decision 3). How
  those three fields actually get set (if at all, from the web UI) is
  still unknown and out of scope.
- **`object_add` is unrelated to user CRUD** — it's a schema-level
  command for the Settings page's custom-table-import feature
  (`{object, name, id, fields}` — table metadata, not a `users` row).
  Answers spec.md's Open Question 1 conclusively.
- **Passwords are never sent in plaintext** by the real web UI — it
  calls a separate `user_hash_password` command first, then sends only
  the resulting hash/salt. This SDK does not implement password-setting
  in this phase at all (Decision 3), but the finding is recorded so a
  future phase doesn't have to re-discover it.
- **`messenger.js`'s `this.save()` wraps `values` in an array for
  `create` but not for `modify`** (`this.create([values])` vs.
  `this.modify(values)`) — a single line missed in Group 0's first static
  read, caught live by Group 5's attempt #1 (HTTP 400), not by offline
  tests (which only checked internal consistency against the same
  mistaken assumption). The strongest validation yet, in this project,
  of why the live-write gate exists even after thorough static discovery.
- **`update()`'s partial-update capability is now live-confirmed** — Group
  5 attempt #2 sent only `name`, omitted `registration`, and the device
  accepted it correctly. No longer just a plausible engineering choice.
- Passing a very long prompt as a single `codex.execute` argument hits a
  Windows command-line-length limit (~a few KB is fine, a multi-page
  prompt is not) — same finding as the prior plan's Task 3.1. Keep
  Codex prompts per-task/per-file rather than one giant combined prompt.

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| `update()`'s "changes":0 vs. actual server error is not distinguished in the thrown message (both throw generic `ProtocolError`, not surfacing the real error text) | Low — callers still get a clear failure signal, just a less specific one | Only worth fixing if a real caller needs to distinguish the two cases |

---

## Lessons learned

- Reading the *actual* JS a Save button calls (rather than assuming
  fields are writable just because they're readable) caught a real
  scope error before any code was written — validates this project's
  "discovery before implementation" discipline once again.
- Delegate Codex tasks per-file/per-concern (ObjectQuery, then Types,
  then Client, then tests) rather than one giant prompt — avoids the
  Windows command-line length limit and keeps each diff independently
  reviewable.
- Offline tests can only catch *internal* inconsistency — if the static
  discovery itself missed a detail (the array-wrap), the offline test
  written against that same mistaken understanding will happily pass.
  The live-write gate is not redundant with thorough offline testing;
  it catches a different class of error entirely. Treat a live-test
  FAIL on the very first real write attempt as a normal, expected part
  of the process, not a sign something went badly wrong.

---

## What the next sprint must NOT assume

- `create()`/`update()`/`remove()` **have** now been live-verified
  against the real device (Group 5 attempt #2, `id=37`, full round-trip)
  — this is no longer offline-tested-only, but it is still exactly one
  live test run of the happy path; do not assume every edge case (e.g.
  duplicate `registration`, very long names, concurrent edits) has been
  live-tested.
- `user_type_id`/`begin_time`/`end_time` remain read-only through this
  SDK — do not assume a future phase can trivially add write support for
  them without its own fresh discovery pass.
- The two prior plans' `KNOWN_HARNESS_BUG` (self-induced
  `PLAN_DRIFT_DETECTED`) has not been re-investigated or fixed — expect
  the same mechanical `eng verify`/`eng plan drift` noise if this plan's
  state is pushed through `eng workflow advance` while other plans' files
  remain uncommitted.
