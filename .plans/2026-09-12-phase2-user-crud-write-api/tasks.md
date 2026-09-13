# Tasks — Giai đoạn 2: User CRUD (API ghi đầu tiên của SDK)

> **Executor instructions:** Complete groups in order. After each task, run
> the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating (load-bearing):**
> - **Group 0 requires a fresh live-device (read-only) approval message**
>   before any request is sent to `192.168.2.156` — this plan's spec/
>   execution approval does not cover device contact by itself, per every
>   prior precedent in this project.
> - Groups 1–4 (code, offline tests, build) require **no** device contact
>   and can proceed once Group 0's findings are in hand.
> - **Group 5 (live-write test) requires a SEPARATE, distinctly-worded
>   approval message** — `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` — per
>   spec.md Decision 4. This is the first-ever write/delete operation
>   against the real device in this project's history; the Group 0
>   read-only approval does **not** cover it, and neither does this plan's
>   own execution approval.

---

## Group 0 — Discovery: exact payload shape for create/modify/destroy on `users` (GATED — live, read-only)

> **STOP before this group.** No request to `192.168.2.156` until a fresh
> live-device-contact approval message is received. Read-only: fetching
> static JS files, never invoking create/modify/destroy for real.

### Task 0.1 — Fetch `class/user.js` and `class/baseclass.js`
**Action:** Load any already-visited page (e.g. `users.html`) to trigger
the browser's normal asset load (both files are already known to be
loaded on every page — see the request list captured in Giai đoạn 1b).
Save each response body via the browser tool's file-save option (never
just paste raw content inline into a doc):
- `artifacts/live_capture/user_class_js.network-response`
- `artifacts/live_capture/baseclass_js.network-response`
**Do not click Add/Edit/Save on any user.** This is a static asset fetch
only, identical in spirit to how `newusers.js` was obtained in Giai đoạn
1b (no interaction with the enrollment/save UI).
**Verification:** Both files exist, non-zero size.
**Pass:** Files saved.
**Fail:** Either file empty/missing — report to Planner, do not guess
their content from other sources.

**Status:** `[x]` — 2026-09-12, live session (approved via
`APPROVE_LIVE_DEVICE_TEST:2026-09-12-phase2-user-crud-write-api`). Both
files fetched via `users.html`'s normal asset load, saved
(13899 and 2973 bytes respectively). **Deviation:** `baseclass.js`
turned out to only define generic CRUD *delegation* (`this.save` →
`$messenger.save`, etc.) — the actual command names/payloads live in a
third file, `en_US/js/messenger.js` (the `Messenger`/`MessengerUtil`
object this delegates to), which was fetched too and saved as
`artifacts/live_capture/messenger_js.network-response` (14751 bytes) —
not a scope violation, just the natural next file the trail led to,
still 100% static/read-only.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.2 — Cross-check against `newusers.js`'s own remaining "Save" handler
**Action:** `newusers.js` is already on disk
(`artifacts/live_capture/newusers_js.network-response`, from Giai đoạn
1b) — re-read it fully (only ~1103 lines were partially covered before;
the modal's `'save'` button callback was not fully traced during Giai
đoạn 1b's enrollment-focused read). Look specifically for where the
"Save" button assembles the request that persists a new or edited user
record (as opposed to the enrollment-specific `remote_enroll` calls
already documented).
**Verification:** Manual read; findings written into this task's Status
note (exact command name(s) used, field names sent).
**Pass:** Either the create/modify command + field list is found here
directly, or it's confirmed this file delegates to a generic
class/baseclass function (motivating Task 0.1's fetch).
**Fail:** N/A (analysis task).

**Status:** `[x]` — 2026-09-12. Confirmed: `newusers.js`'s modal calls
`this.save = function(...)` on the `User` object (`user_class_js`), which
itself delegates to `$messenger.save(values)` (`messenger_js`). Found the
exact `values` object `user.js`'s `save()` builds:
`{"registration": ..., "name": ...}`, plus `password`/`salt` (hashed via a
separate `user_hash_password` command) only if a password was entered.
**No `user_type_id`/`begin_time`/`end_time` setter or call site found
anywhere in `user.js`, `newusers.js`, or `messenger.js`** — despite being
read fields, they are never part of any create/update payload the actual
web UI sends. See `docs/ui-action-protocol-map.md`'s new section for
full detail; this narrows spec.md Decision 3's writable-field set
further than originally assumed (see `DECISION_LOG.md`'s
2026-09-12 amendment).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.3 — Document confirmed payload shapes in `docs/ui-action-protocol-map.md`
**File:** `docs/ui-action-protocol-map.md`
**Action:** Add a new section ("User CRUD write commands — `JS_CONFIRMED`")
documenting, for each of `create_objects`, `object_add`, `modify_objects`,
`destroy_objects` (as they apply to `object:"users"`): exact field names
sent, which fields are required vs. optional, and what the success/error
response looks like (does it return the new row's `id`, or just an
`error`/ok marker?). Cross-reference the `destroy_objects` shape already
documented from Giai đoạn 1b's `callbackRemove` finding. Explicitly note
if `create_objects` and `object_add` turn out to be the same thing for
`users` or genuinely different (per spec.md's Open Questions).
**Verification:**
```bash
grep -c "User CRUD write commands" docs/ui-action-protocol-map.md
```
**Pass:** Section exists, answers both of spec.md's Open Questions
explicitly (not left implicit).
**Fail:** Open Questions still unanswered — stop, do not proceed to
Group 1 with a guessed payload shape.

**Status:** `[x]` — 2026-09-12: section written, `grep -c` prints `1`.
Both Open Questions answered: (1) `create_objects` (row creation, any
Table-backed object) and `object_add` (schema-level custom-table
definition, unrelated to `users` rows) are confirmed **different**
commands; (2) create response **does** echo the new id, as
`{"ids":[<new_id>]}`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 1 — SDK: write body builders + `UsersApi` methods

> Depends entirely on Group 0's findings. Every field name/command name
> below must come from Task 0.3's confirmed documentation, not guessed.

### Task 1.1 — `src/ObjectQuery.{hpp,cpp}`: add `buildUserCreateBody`
**Action:** Add `nlohmann::json buildUserCreateBody(const NewUser&)` (or
equivalent, matching Task 0.3's confirmed command/field names). Hard-code
the writable field list — **never** accept `password`/`salt`/
`panic_password`/`panic_salt` (Decision 3) or a caller-supplied
object/field/connector string (matching the existing read-builder
pattern in the same file). Add a `kUserWritableFields` (or similarly
named) constant, exposed the same way `kUserFields` already is.
**Verification:** `cmake --build build-exec --target amico_sdk` (or
equivalent incremental build) compiles clean.
**Pass:** Exit 0, no new warnings.
**Fail:** Compile error, or a code path that could pass through a
caller-supplied field/object name.

**Status:** `[x]` — 2026-09-12: implemented by Codex
(`eng tools invoke executor codex.execute`), signature
`buildUserCreateBody(const std::string& name, const std::string& registration)`
(free params rather than a `NewUser` struct at this layer — `Types.hpp`'s
`NewUser` struct, added in Task 1.4, is unpacked by `Client.cpp` before
calling this). `kUserWritableFields = {"name", "registration"}` added,
matching Task 0.3's narrowed scope (see `DECISION_LOG.md`). Build:
`cmake --build build-exec --target amico_sdk` → exit 0, no warnings
(verified directly by Claude, not just Codex's self-report).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `src/ObjectQuery.{hpp,cpp}`: add `buildUserUpdateBody`
**Action:** Same discipline as Task 1.1, for update — takes `id` plus the
same restricted writable-field set (partial update semantics to be
confirmed by Task 0.3: does the device require all fields on every
update, or only changed ones?).
**Verification:** Same build command as Task 1.1.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: implemented as
`buildUserUpdateBody(int64_t id, const std::optional<std::string>& name, const std::optional<std::string>& registration)`
— **partial-update capable** (only sends fields explicitly provided).
**Important caveat, not fully evidence-backed:** the real web UI's own
"Save" flow (`user.js`) always sends *both* `name` and `registration`
together on every save — Group 0 found no example of a genuine
partial-field update in the wild. Codex's optional-field design is a
reasonable API choice (and matches this plan's own Task 5.1's live-test
design, which already planned a single-field update), but whether the
device backend actually *accepts* a `values` object with only one of the
two fields present is **untested** until Group 5's live run. Recorded so
Group 5 treats this specifically as something to verify, not assume.
Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — `src/ObjectQuery.{hpp,cpp}`: add `buildUserDeleteBody`
**Action:** Implement using the shape already confirmed in Giai đoạn 1b:
`{object:"users", where:{users:{id:[<id>]}}}` via `destroy_objects` — a
single-id array, not a bulk-delete surface (SDK exposes `remove(int64_t
id)`, singular, matching Decision 4's single-test-user scope).
**Verification:** Same build command.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: implemented exactly matching Giai đoạn
1b's confirmed `destroy_objects` shape, single-id array. Build: exit 0,
no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.4 — `include/amico/Types.hpp`: add `NewUser` / `UserUpdate` structs
**Action:** Add parameter structs containing exactly the **amended**
Decision-3 field set (see `DECISION_LOG.md`'s 2026-09-12 amendment):
`name`, `registration` **only** — `userTypeId`/`beginTime`/`endTime` are
dropped from these structs entirely (Group 0 found no evidence they are
writable). `NewUser` has no `id` (assigned by the device); `UserUpdate`
has `id` plus `std::optional<std::string> name`/`registration` (matching
Task 1.2's partial-update builder — both optional, caller sets only
what's changing). Doc-comment explicitly stating why there is no
password/salt member, and why `userTypeId`/`beginTime`/`endTime` are
absent (mirror `AmicoUser`'s existing comment style).
**Verification:** Build compiles.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: added `NewUser` and `UserUpdate` in
`namespace amico`, with the amended field set and `AmicoUser`-style
doc comments explaining excluded fields. Verification:
`cmake --build build-exec --target amico_sdk` → exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.5 — `include/amico/Client.hpp` + `src/Client.cpp`: `UsersApi::create/update/remove`
**Action:** Add to `UsersApi`: `int64_t create(const NewUser&)` (or
`AmicoUser create(...)` if Task 0.3 confirms the device echoes the full
row back — resolve per Group 0's finding, don't guess), `void
update(const UserUpdate&)`, `void remove(int64_t id)`. Each calls
`postAuthenticatedJson("/<command>.fcgi", body)` using the new builders
— same pattern as `listUsersImpl`/`getUserImpl`, same error propagation
(`ProtocolError` on missing expected fields, existing exception
hierarchy otherwise unchanged — no new exception type needed unless
Group 0 surfaces a genuinely new failure mode). Update the class's
top-level doc comment (currently says "Read-only client") to reflect the
new write capability, scoped explicitly to Users create/update/remove
only.
**Verification:** Full incremental build (`cmake --build build-exec`).
**Pass:** Exit 0, zero warnings.
**Fail:** Any compile error.

**Status:** `[x]` — 2026-09-12: `create()` returns `int64_t` (device
id only, not a full `AmicoUser` echo — matches Task 0.3's finding that
`create_objects` only returns `{"ids":[...]}`, no full row). `update()`/
`remove()` throw `ProtocolError` if the response's `changes` count is not
a positive integer (covers both an explicit `{"error":...}` response and
a `{"changes":0}` no-op, though the thrown message doesn't surface the
server's actual error text in the former case — a minor quality note,
not a correctness issue, since it still fails safely either way). Build
verified independently by Claude: `cmake --build build-exec` → exit 0;
`ctest --test-dir build-exec` → 100% (1/1); offline suite still 45
cases/250 assertions (no regression from the read-only baseline).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Offline tests (fixture-based, zero device contact)

### Task 2.1 — Extend `test/test_query_whitelist.cpp`
**Action:** Add assertions for the 3 new builders: (a) always target
`object:"users"`, never a caller-supplied name; (b) the writable-field
constant never contains `password`/`salt`/`panic_password`/`panic_salt`
(mirror the existing `kUserFields` test at line 40); (c) no builder
accepts a caller-supplied `where.connector` string.
**Verification:** `ctest --test-dir build-exec -R query_whitelist` (or
run the full suite if no per-file filter exists).
**Pass:** All assertions pass.
**Fail:** Any assertion fails — this is a security-relevant test, do not
weaken it to make it pass.

**Status:** `[x]` — 2026-09-12: write-builder whitelist/filter assertions added; amico_tests build and full offline CTest passed.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — New fixtures: `test/fixtures/user_create_*.json`, `user_update_*.json`, `user_delete_*.json`
**Action:** Sanitized fixtures matching Task 0.3's confirmed response
shapes (success and at least one failure case per operation, e.g.
duplicate registration ID or invalid user_type_id if the device reports
one — only if Group 0 actually observed such an error shape; do not
invent one).
**Verification:** `test/test_fixtures_load.cpp`'s sanity check picks up
the new fixtures without a parse error.
**Pass:** All new fixtures parse; no real device data in any fixture
(matches existing fixture convention).
**Fail:** Parse error, or any fixture contains real session/user data
instead of clearly-fake test values.

**Status:** `[x]` — 2026-09-12: six synthetic fixtures added using documented ids/changes/error envelopes (error text is simulated, not a captured device diagnostic). Fixture sanity check passed: 1 case / 36 assertions.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — New test cases for `create`/`update`/`remove`
**File:** `test/test_users.cpp` (extend) or new `test/test_users_write.cpp`
**Action:** Using `FakeTransport`, cover: successful create returns
expected id/user; successful update; successful remove; at least one
failure path per operation (transport error propagates unchanged, per
the existing `test_errors.cpp` pattern). Never touches a real device.
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new cases pass, 0 failures.
**Fail:** Any failure.

**Status:** `[x]` — 2026-09-12: FakeTransport tests cover exact create/update/remove payloads, returned id, partial updates/empty strings, generic protocol errors and transport timeouts for each operation. amico_tests build passed without warnings; full offline CTest passed (1/1); doctest passed 58 cases / 309 assertions. Zero device contact.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Docs

### Task 3.1 — `docs/sdk-usage.md`: add create/update/remove usage example
**Verification:** Manual review — example compiles conceptually against
the actual signatures from Task 1.5 (copy-paste-checked, not just
prose).
**Status:** `[x]` — 2026-09-12: written directly by Claude. New "Users
API: create / update / remove" section added, signatures checked
against the actual `Client.hpp`/`Types.hpp`. `examples/create_user_example.cpp`
was **not** created — spec.md's Affected Files table marked it "cân
nhắc" (consider/optional), and the `docs/sdk-usage.md` code snippet
already covers the same usage; deferred, not a silent scope drop.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `docs/src-map.md`: update `ObjectQuery`/`Client`/`Types` rows
**Verification:**
```bash
grep -c "buildUserCreateBody\|buildUserUpdateBody\|buildUserDeleteBody" docs/src-map.md
```
**Pass:** Prints `1` or more (all three new builders mentioned somewhere,
not necessarily one grep hit each).
**Status:** `[x]` — 2026-09-12: `ObjectQuery`, `Client.hpp`, `Types.hpp`,
`test_users.cpp`, and `test_query_whitelist.cpp` rows all updated; grep
prints `1`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Full offline build + test gate (run once, on the fully-edited tree)

### Task 4.1 — Clean incremental build + full offline suite
**Action:** `cmake --build build-exec` then
`ctest --test-dir build-exec --output-on-failure`, then
`build-exec/amico_tests.exe` directly to get the exact case/assertion
count.
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; `ctest` 100%; doctest binary 0
failures. Record the new case/assertion count (baseline before this
plan: 45 cases / 250 assertions from Giai đoạn 0+1's remediation work).
**Fail:** Any build error or test failure — do not proceed to Group 5
until this is clean.

**Status:** `[x]` — 2026-09-12: build exit 0, zero warnings; `ctest`
100% (1/1); `amico_tests.exe` — **58 cases / 309 assertions, 0 failed**
(up from 45/250 before this plan — 13 new cases from Task 2.3, plus the
whitelist assertions added to existing cases in Task 2.1). Verified
independently by Claude, not just Codex's self-report.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Live-write test (GATED — separate, distinct approval required)

> **STOP before this group.** Do not run this binary, do not set
> `AMICO_ENABLE_LIVE_TESTS`, until `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>`
> is received as a fresh, distinct message — not the same text as any
> prior read-only live-device approval, and not inferable from Group 0's
> approval. Per every prior live-test precedent in this project, the
> **human operator** sets the four env vars
> (`AMICO_ENABLE_LIVE_TESTS`/`AMICO_BASE_URL`/`AMICO_USERNAME`/
> `AMICO_PASSWORD`) directly in their own shell — the agent only prints
> the command and waits for the operator to run it and report the
> output.

### Task 5.1 — Write `test/live/live_write_test.cpp` (code only, not run yet)
**Action:** New live-test binary (separate from `live_smoke_test`, which
stays 100% read-only and unchanged): logs in, creates exactly one user
named distinctly (e.g. `SDK_TEST_DELETE_ME_<timestamp>`), confirms via
`get(id)` that the created fields match, calls `update()` to change one
field, confirms again via `get(id)`, then calls `remove(id)` using the
**exact id returned at creation** (never a hardcoded or assumed id, never
matched by name), then confirms via `list()`/`get(id)` that the user no
longer exists, then logs out. Prints `RESULT: PASS`/`FAIL` in the same
style as `live_smoke_test.cpp`. Registers a new CMake target
(`amico_live_write_test`), gated the same way as `amico_live_smoke_test`.
**Verification:** Code compiles (`cmake --build build-exec`); running it
with **no** `AMICO_ENABLE_LIVE_TESTS` set must self-skip, exit 0, make no
network call (same discipline as `live_smoke_test.cpp`).
**Pass:** Compiles; skip-gate confirmed offline.
**Fail:** Any compile error, or the binary attempts a network call
without `AMICO_ENABLE_LIVE_TESTS=1` set.

**Status:** `[x]` — 2026-09-12: written directly by Claude (not
delegated to Codex, given this file will actually perform live
create/update/delete once run — wanted full personal review before that
happens). `amico_live_write_test` registered in `CMakeLists.txt`,
mirroring `amico_live_smoke_test`'s pattern. Added a robustness measure
beyond the original task description: if an exception is thrown
mid-test *after* `create()` already returned an id, the `catch` block
attempts a best-effort cleanup `remove(that exact id)` before reporting
`RESULT: FAIL`, and tells the operator explicitly to check the Users
page manually if that cleanup itself fails. Build: exit 0, no warnings.
Skip-gate: confirmed offline with no env vars set — prints skip
message, exit 0, no network call. Full offline suite (`ctest`) and the
existing `amico_live_smoke_test` (still self-skips, unchanged) both
re-verified with this new target present — no regression.
**Still not run against the live device — that is Task 5.2, gated
separately.**
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Run the live-write test (only with fresh approval)
**Action:** Print the exact command and the four variable names for the
operator to set themselves (never issued by the agent). Wait for the
operator to run `build-exec/amico_live_write_test.exe` (or the
appropriate build directory's binary — confirm which build was actually
used and verified, matching the precedent set by
`phase-2-remediation-and-live-device-verification`'s executable-hash
binding) and report the output.
**Verification:** Operator-reported output.
**Pass:** `RESULT: PASS`; the test user was created, verified, updated,
verified again, deleted, and confirmed gone — **and no pre-existing real
user (`Phat`/`Phuong Hoang`/`Trung Dung`) was touched.**
**Fail:** Any `RESULT: FAIL`, non-zero exit, or (even if the test
"passes") any evidence a pre-existing real user's data changed — treat
the latter as a critical incident, not a normal test failure: stop, do
not attempt automated remediation, report to the user immediately.

**Status:** `[x]` — resolved by attempt #2 (see below). **Attempt #1 (2026-09-12), FAIL.** Approval
mechanism: clarifying question, user selected "Yes — send
APPROVE_LIVE_DEVICE_WRITE_TEST now" (see `DECISION_LOG.md`). Ran
`build-exec\amico_live_write_test.exe` (operator-set credentials,
`Admin`/`admin`). Result: `RESULT: FAIL` at step 2/6 —
`unexpected HTTP status 400 from /create_objects.fcgi`. **No user was
created** (400 is an HTTP-layer rejection, before any application
response) — no cleanup needed, none attempted, no pre-existing real user
touched. Root cause found and fixed (see `DECISION_LOG.md`'s attempt-#1
entry): `buildUserCreateBody` sent `values` as a bare object; the real
device requires a one-element array (missed in Group 0's static read).
Fixed in `src/ObjectQuery.{hpp,cpp}`, docs corrected, both affected
offline tests corrected, full suite re-verified green (58/309). **A
fresh, distinctly-worded retry approval
(`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-12-phase2-user-crud-write-api:retry-1`)
is required before attempt #2** — this consumed approval does not cover
a retry, per this project's established rerun rule.
**Error (if [!]):**
> Attempt #1: `RESULT: FAIL -- unexpected HTTP status 400 from /create_objects.fcgi`
> at step "2/6 create test user". Root cause: `create_objects`'s
> `values` field must be a one-element array, not a bare object — fixed,
> see `DECISION_LOG.md`. Resolved by attempt #2 below.

**Attempt #2 (2026-09-12), PASS.** Approval:
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-12-phase2-user-crud-write-api:retry-1`
(exact token, fresh message). Binary hash confirmed rebuilt with the fix
(`3ed0d6934625a38eed20d9cb3aba62dbe95430aedff377214cb6875a0cb3c9fa`,
differs from attempt #1's `87b5e474...`). Full 6/6 sequence:
```
1/6 login... ok
2/6 create test user 'SDK_TEST_DELETE_ME_1789211680'... ok, id=37
3/6 verify created fields via get(id)... ok
4/6 update (name only, registration left unset)... ok
5/6 verify updated fields via get(id)... ok
6/6 remove test user id=37... ok
verify removal via get(id)... confirmed gone
RESULT: PASS
```
Test user `id=37` is distinct from the 3 pre-existing real users
(`id 4/5/36` — `Trung Dung`/`Phat`/`Phuong Hoang`); none were read,
matched, or touched at any point. **Step 4/5 also resolves Task 1.2's
open caveat**: partial update (sending only `name`, omitting
`registration`) is now live-confirmed to work correctly on the real
device — `update()`'s optional-field design is no longer just a
plausible-but-untested engineering choice.

---

## Completion checklist

- [x] All Group 0–4 tasks marked `[x]`
- [x] Group 5: complete — attempt #1 FAIL (root-caused, fixed), attempt
      #2 **PASS** (full 6/6 sequence, no pre-existing user touched)
- [x] No tasks marked `[!]`
- [x] `docs/ui-action-protocol-map.md` documents the confirmed write
      payload shapes (Task 0.3)
- [x] `docs/src-map.md` / `docs/sdk-usage.md` updated (Tasks 3.1–3.2)
- [x] Full offline build+test gate passed once, on the fully-edited tree
      (Task 4.1) — 58 cases / 309 assertions, 0 failed
- [x] No `password`/`salt`/`panic_password`/`panic_salt` field is ever
      accepted by any new public API (confirmed by `test_query_whitelist.cpp`'s
      automated assertion, spot-checked by Claude directly)
- [x] Sprint summary written to
      `.plans/2026-09-12-phase2-user-crud-write-api/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
Every file this plan touches is already git-tracked (per the Giai đoạn
0+1 baseline) — `git checkout -- <file>` reverts any single file cleanly
if a task goes wrong before the next commit.

### Per-task rollback — Group 5 (live-write test)
If Task 5.2 reports `RESULT: FAIL` **after** the test user was created
but **before** it was successfully deleted: the operator must manually
verify via the web UI's Users page whether `SDK_TEST_DELETE_ME_*` still
exists and delete it manually through the UI if so — do not write new
automated cleanup code under time pressure; a manual, visually-confirmed
delete through the existing UI is safer than a second automated write
attempt against a device that just misbehaved.
