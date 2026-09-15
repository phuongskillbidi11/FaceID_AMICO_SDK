# Tasks — Visitors (Enroll → Visitors): list/create/update/remove + CPF

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) has a read-only part (list/
>   view, routine login) and one gated write part (creating one
>   disposable test visitor with a CPF value, requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval).

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `userTypeId`/`cpf` to the relevant types
**Action:**
- `AmicoUser`: add `std::optional<std::string> cpf;` (populated by a
  per-user `c_users` lookup, same enrichment convention as
  `groupIds`/`hasPassword`).
- `UserQuery`: add `std::optional<int64_t> userTypeId;` (unset = the
  existing "regular users" behavior, completely unchanged; set = the
  new `user_types.id = N` filter — spec.md Decision 1).
- `NewUser`: add `std::optional<int64_t> userTypeId;` and
  `std::optional<std::string> cpf;`.
- `UserUpdate`: add `std::optional<std::string> cpf;` (no
  `userTypeId` here — a visitor's type never changes after creation
  in this plan's scope; don't add a capability nothing asked for).
- Add a doc comment on each new field citing this plan's spec.md
  Decision 1/3 evidence (mirroring this file's existing comment
  style), so a future reader understands why these are optional and
  what "unset" means.
- **Update the now-stale struct-level comments** (found during Plan
  Review): `NewUser`'s and `UserUpdate`'s doc comments both currently
  say verbatim "`userTypeId`, `beginTime`, and `endTime` are absent
  because no confirmed Web UI write payload includes them." Keep that
  historical note (it's still valid context — a prior discovery pass's
  real finding, not being overturned), but add: this plan (2026-09-14,
  Visitors) found new, narrower evidence via live class introspection
  that the generic "usertype" system (distinct from the plain
  `user.js`'s own `User.save()`, which the original finding covered)
  *does* set `user_type_id` via each type's own `defaultValue` — cite
  spec.md's Background section. For `UserUpdate` specifically, note
  `userTypeId` was deliberately still left off it (not an oversight) —
  a visitor's type is fixed at creation in this plan's scope, never
  changed afterward.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0),
> no compile errors. Added `cpf` to `AmicoUser`; `userTypeId`+`cpf` to
> `NewUser`; `cpf` to `UserUpdate`; `userTypeId` to `UserQuery`. Both
> `NewUser`/`UserUpdate` struct comments updated to preserve the
> historical note while citing the new evidence (per Plan Review's fix).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `userTypeId`-aware list/create bodies
**Action:**
- `buildUsersListBody(int limit, int offset)` → add a third parameter
  `std::optional<int64_t> userTypeId = std::nullopt`. When unset,
  emit the **exact existing** `where` array (OR/NULL 2-clause,
  byte-for-byte unchanged — verify with a diff, not just a re-read).
  When set, emit a single-clause `where`:
  `[{"field":"id","object":"user_types","value":*userTypeId}]` (no
  `connector` key — matches `buildUserGetBody`'s existing single-
  clause style; the real device's own live-captured query used a
  trailing `") AND ("` connector on its lone clause, but that's an
  artifact of its generic template always appending one — **do not
  copy that artifact**, it serves no purpose on a single clause here
  and every other single-clause builder in this file omits it).
- `buildUserCreateBody(name, registration)` → add a fourth parameter
  `std::optional<int64_t> userTypeId = std::nullopt`. When set, add
  `"user_type_id": *userTypeId` to the one-element `values` array's
  object. When unset, `values` is byte-for-byte unchanged from today.
- Update the one existing call site in `src/Client.cpp` for each
  changed signature (both currently called with 2/2 args respectively
  — becomes 3/3 with the new param defaulting to `std::nullopt` at
  the call site until Task 3.1 threads real values through).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0; existing behavior (unset case) provably unchanged.
**Fail:** Compile error, or the unset-case `where`/`values` shape
differs from today's.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0)
> with zero call-site changes needed at any of the 5/2 existing call
> sites (trailing default params) — confirms the unset case is
> untouched.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — New `c_users` query builders
**Action:** Add, following the existing terse style/doc-comment
convention in this file:
```cpp
/// Reads the c_users row (if any) for a given user id -- id, cpf.
nlohmann::json buildCUsersGetBody(int64_t userId);
/// Creates a c_users row linking userId to a CPF value.
nlohmann::json buildCUsersCreateBody(int64_t userId, const std::string& cpf);
/// Updates an existing c_users row's cpf value by its own row id.
nlohmann::json buildCUsersUpdateBody(int64_t cUsersRowId, const std::string& cpf);
/// Defensive cleanup: destroys any c_users row for a given user id
/// (LIVE-UNCONFIRMED whether the device cascades this on its own --
/// see spec.md Risks; mirrors the existing buildFaceTemplatesDeleteBody
/// precedent of not assuming cascade delete without evidence).
nlohmann::json buildCUsersDeleteBody(int64_t userId);
```
Implement each in `ObjectQuery.cpp` using confirmed shapes: `object:
"c_users"`; get uses `fields:["id","cpf"]`,
`where:[{"field":"user_id","value":userId}]` (single clause, no
connector); create uses the confirmed one-element `values` array
(`buildUserCreateBody`'s own pattern); update uses the confirmed bare-
object `values` + `where:{"c_users":{"id":cUsersRowId}}` (matching
`buildUserUpdateBody`'s pattern); delete uses
`where:{"c_users":{"user_id":userId}}` (matching
`buildFaceTemplatesDeleteBody`'s pattern exactly, substituting the
object/field names).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — Thread `userTypeId` through `UsersApi::list()`/`create()`
**Action:**
- `Client.cpp`'s `listUsers(query)`: pass `query.userTypeId` into
  `buildUsersListBody`.
- `Client.cpp`'s `createUser(user)`: pass `user.userTypeId` into
  `buildUserCreateBody`.
- No signature change needed on `UsersApi::list()`/`create()`
  themselves — `UserQuery`/`NewUser` already carry the new optional
  field (Task 1.1); only the internal wiring changes.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — CPF read/write in `mapUser`/`createUser`/`updateUser`/`removeUser`
**Action:**
- `mapUser(row)`: after building the base `AmicoUser`, look up its
  `c_users` row via `buildCUsersGetBody(user.id)`; if a row exists,
  set `user.cpf` to its `cpf` value; if not, leave `user.cpf`
  unset (`std::nullopt`) — never an empty-string sentinel at the SDK
  layer (matches `AccessLogsApi`'s established absent-vs-empty
  convention from the prior plan).
- `createUser(user)`: after the main `create_objects.fcgi` call
  succeeds and returns the new id, if `user.cpf.has_value()`, call
  `buildCUsersCreateBody(newId, *user.cpf)`.
- `updateUser(user)`: if `user.cpf.has_value()`, look up the existing
  `c_users` row (via `buildCUsersGetBody`); if one exists, call
  `buildCUsersUpdateBody` with its row id; if not, call
  `buildCUsersCreateBody` (a visitor with no prior CPF getting one set
  for the first time).
- `removeUser(id)`: **before** the existing `destroy_objects` call on
  `users`, add the defensive `buildCUsersDeleteBody(id)` call (no
  throw-on-zero-changes, same reasoning as the existing
  `removeUserImage` precedent — a user may have no `c_users` row at
  all and this is still a legitimate no-op).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
> Implemented with a small addition beyond the task text: a shared
> `getCUsersRowId(userId)` helper (used by `updateUser`) and a separate
> `getUserCpf(userId)` helper (used by `mapUser`) — both query the same
> `buildCUsersGetBody`, just extract different response fields (`id`
> vs `cpf`), avoiding a bespoke inline query in each call site.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize `cpf`
**Action:**
- `toJson(const amico::AmicoUser&)` in `backend/JsonMapping.cpp`:
  add `j["cpf"] = user.cpf.has_value() ? nlohmann::json(*user.cpf) : nlohmann::json(nullptr);`
  (matches the existing `userId`/`portalId` null-vs-value convention
  already used for `AccessLogEntry` — reuse that exact pattern here).
- **`fromJsonNewUser(body)`/`fromJsonUserUpdate(id, body)`** (found
  during Plan Review — these are the actual shared deserialization
  helpers `POST /users`/`PATCH /users/:id` already call, confirmed via
  direct read of `backend/JsonMapping.cpp` lines 71-88; do **not**
  parse JSON inline in `Routes.cpp` for `/visitors`, which would
  create a second, divergent parsing path): extend both to also parse
  an optional `"cpf"` string field into `NewUser.cpf`/`UserUpdate.cpf`,
  using the exact same `body.contains(key) && !body[key].is_null()`
  pattern `fromJsonUserUpdate` already uses for `registration`. This
  is harmless for the existing `/users` routes (their own frontend
  never sends a `"cpf"` key today, so it simply stays unset) and means
  `/visitors`'s route handlers (Task 4.2) can reuse these same shared
  functions unchanged rather than duplicating parsing logic.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_backend` passed
> (exit 0) after killing a stale running `amico_backend.exe` (Windows
> file-lock, `LNK1168` — same recurring gotcha noted earlier this
> session; process was left over from the Access Logs plan's own
> live-verification step).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — `/visitors` route family
**Action:** Add, mirroring each existing `/users/*` handler exactly
(same session/error handling, same body-parsing style) but scoped to
`userTypeId = 1`:
- `GET /visitors?limit=&offset=` — `UserQuery` with `userTypeId = 1`.
- `GET /visitors/:id` — reuse `client.users().get(id)` unchanged (no
  type filter needed — see spec.md Decision 1's note that `get()`
  already has no type filter).
- `POST /visitors` — call the **same shared** `fromJsonNewUser(body)`
  helper `POST /users` already uses (Task 4.1 extends it to parse
  `cpf`), then explicitly set `newUser.userTypeId = 1` on the
  resulting struct **in the route handler itself** — `userTypeId` is
  never parsed from the request body at all (a visitor's type is
  fixed by which route was called, not client-supplied) — before
  calling `client.users().create(newUser)`.
- `PATCH /visitors/:id` — call the same shared
  `fromJsonUserUpdate(id, body)` helper `PATCH /users/:id` already
  uses (already parses `cpf` after Task 4.1); no `userTypeId` handling
  needed here at all (`UserUpdate` has no such field — Task 1.1).
- `DELETE /visitors/:id` — reuse `client.users().remove(id)` unchanged
  (Task 3.2 already added the defensive `c_users` cleanup inside
  `removeUser` itself, so no route-level change needed beyond calling
  the same method).
- `POST /visitors/:id/groups/:groupId`,
  `DELETE /visitors/:id/groups/:groupId`, `POST /visitors/:id/cards`,
  `GET /visitors/:id/image`, `PUT /visitors/:id/image`,
  `DELETE /visitors/:id/image`, `PUT /visitors/:id/password` — each a
  direct copy of the matching `/users/*` handler with the path
  prefix changed to `/visitors`; no other behavior differs (all
  operate on a specific known id, no type filter involved). Card
  removal (`DELETE /cards/:cardId`) is intentionally **not**
  duplicated — it is already type-agnostic.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_backend` passed
> (exit 0). All 13 `/visitors/*` routes added exactly mirroring their
> `/users/*` counterparts (list with `userTypeId=1`, get, create with
> `userTypeId=1` set post-parse, update, delete, groups add/remove,
> cards add, image get/put/delete, password set). `DELETE /cards/:id`
> correctly left untouched (type-agnostic, not duplicated).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Frontend

### Task 5.1 — Extract `frontend/users.js`'s table/modal logic into a shared factory
**Action:** Load the `frontend-design` skill first (standing project
instruction). Refactor `frontend/users.js` so its table-building and
modal-building logic (tab wiring, `lockedFields`, the persistent photo
panel, Groups/Cards/PIN sub-forms, `renderPhoto`) lives in one
factory function taking a small config object: `{ tabId, apiPath,
heading, extraGeneralFields? }`. `extraGeneralFields` is an optional
array of `{key, label}` entries rendered as extra text inputs on the
General tab, wired into the same create/update payload the factory
already builds (so CPF, Task 5.2, is just one config entry, not a
special case hardcoded into the factory). The factory is called once
at the bottom of `users.js` with today's exact config (`apiPath:
"/users"`, no `extraGeneralFields`) — **this call's rendered output
must be byte-for-byte identical to today's**, verified live in
Group 8 before Visitors is considered done.
**Verification:** `node --check frontend/users.js`.
**Pass:** Exit 0; `node --check` clean; the factory function is
exported/callable from a second file (Task 5.2).
**Fail:** Compile error, or the factory can't be reused from another
file without copy-pasting its body.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/users.js` exits 0. Factory
> extracted as top-level `initUserListPage(config)` (config:
> `tabId, apiPath, itemSingular, itemPlural, extraGeneralFields,
> showAdministrator`) — a global function, same declaration style
> `app.js` already uses, callable from `visitors.js`. `users.js`'s own
> call site at the bottom (`{tabId:"users", apiPath:"/users",
> itemSingular:"User", itemPlural:"users"}`) uses only defaults for
> `extraGeneralFields`/`showAdministrator`, preserving today's exact
> behavior — byte-for-byte DOM parity confirmed live in Task 8.1.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — `frontend/visitors.js`, new sidebar tab, CPF field
**Action:**
- New `frontend/visitors.js`: calls the shared factory (Task 5.1)
  with `{ tabId: "visitors", apiPath: "/visitors", heading:
  "Visitors", extraGeneralFields: [{key: "cpf", label: "CPF"}] }`.
- `frontend/index.html`: new sidebar `<button data-tab="visitors">`
  (same icon-and-label markup pattern as the existing Access Logs
  entry — reuse an existing icon or a simple generic one, no new SVG
  design needed), new `<div id="tab-visitors" hidden>` container, new
  `<script defer src="visitors.js"></script>` tag (after `users.js`,
  since it depends on the factory `users.js` now exports).
- `frontend/style.css`: only touch if the CPF input needs anything
  beyond the existing shared `label`/`input` styling already used by
  every other text field in this modal (expected: no new rules).
**Verification:** `node --check frontend/visitors.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/visitors.js` exits 0. Also found
> and fixed a real gap during implementation (not in tasks.md's
> original text): the real device's own Visitor Add form has **no
> Administrator toggle** (confirmed live earlier this session — recall
> checked against the discovery snapshot), and Task 4.2 deliberately
> did not add a `/visitors/:id/administrator` route either — so the
> factory gained a `showAdministrator` config flag (default `true`,
> set to `false` for Visitors) to keep the frontend consistent with
> both the real device and our own backend's actual scope. No CSS
> changes needed — CPF reuses the existing shared `label`/`input`
> styling exactly as predicted.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_visitors.cpp`
**Action:** Add `test/test_visitors.cpp` to `amico_tests`'s source
list in `CMakeLists.txt` (alongside the existing `test/test_users.cpp`
line). Write SDK-level tests (fake-transport-backed, same pattern as
`test/test_access_logs.cpp`):
- `userTypeId` unset → `buildUsersListBody`'s `where` is byte-for-byte
  identical to the pre-existing OR/NULL shape (a direct regression
  guard for Decision 1's "zero risk to existing Users" claim).
- `userTypeId = 1` → single-clause `user_types.id = 1`, no connector.
- `buildUserCreateBody` with/without `userTypeId` — `values` includes/
  excludes `user_type_id` correctly.
- `buildCUsersGetBody`/`CreateBody`/`UpdateBody`/`DeleteBody` — exact
  shapes per Task 2.2.
- `mapUser` populates `cpf` when a `c_users` row exists, leaves it
  unset when the fake transport returns an empty `c_users` array.
- `createUser`/`updateUser` with a `cpf` value trigger the expected
  second `c_users` call (assert on the fake transport's request log).
- `removeUser` issues the defensive `c_users` delete call before the
  `users` delete call (assert call order via the request log).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected
(no regressions).
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `./build/amico_tests.exe`: 117/117 passed (108 baseline
> + 9 new: Q-1, Q-2, Q-3, Q-4, Q-5, Q-5b, Q-6, Q-6b, Q-7). Found and
> fixed 3 real regressions the Group 1-3 SDK changes had silently
> introduced (found by actually running the suite before declaring
> done, not just reasoning about it): (1) `test/UserProfileResponder.hpp`
> (shared by 4 test files, not previously in write_scope — added) had
> no case for the new `c_users` lookup `mapUser` now makes, so every
> test using it got a wrong response body for that call; added a
> default "no row" case. (2) Two hardcoded per-user request-count
> assertions in `test_users.cpp`/`test_errors.cpp` (20→23, 8→9,
> 18→21) needed updating for the new 7th per-user query. (3)
> `test_users.cpp`'s "UsersApi::remove sends a single-id array" test
> asserted on the *first* captured request body, which is now the new
> `c_users` cleanup call, not the `users` delete — rewrote it to
> distinguish both calls and assert their order.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: add cases confirming `buildUsersListBody`/
  `buildUserCreateBody`'s new optional parameter never accepts a
  caller-supplied object/field/connector string (same "no invented
  surface" pattern every existing test in this file already checks).
- `test/backend/test_routes.cpp`: add cases for the new `/visitors/*`
  routes — list respects `userTypeId=1` filtering (assert the fake
  transport receives the expected `where` shape), create sends `cpf`
  through to a `c_users` call, `GET /visitors/:id` works, delete
  triggers the defensive `c_users` cleanup. Also add one **regression**
  test: `GET /users` (unrelated to this plan) still produces the
  exact pre-existing `where` shape — a direct guard that the Task 5.1
  refactor and Task 2.1 signature change didn't silently change
  existing Users behavior.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count/behavior
for Users routes unaffected.
**Fail:** Any compile error, test failure, or Users-route regression.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `./build/amico_backend_tests.exe`: 47/47 passed (43
> baseline + 4 new: R-1, R-2, R-3, R-4). R-4's regression check
> confirms `GET /users`'s `where` shape is byte-for-byte unchanged.
> `test_query_whitelist.cpp`'s Q-8 case added (compile-time-fact
> style, matching this file's own established convention for this
> category).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:**
- `docs/backend-api.md`: new section documenting the full
  `/visitors/*` route family, the `cpf` field's null-vs-value
  convention, and a one-line cross-reference to `/users/*` noting the
  two share the same underlying object.
- `docs/api-roadmap.md`: mark section on Visitors (currently 🔍
  Discovery pending, listed under section 11) as ✅ Implemented, with
  a short evidence pointer to this plan's `spec.md`. Leave "Visits",
  "User Types", "Custom Fields" as still 🔍 Discovery pending (this
  plan does not touch them) — explicitly note CPF was hardcoded for
  this device's specific configuration, not a generic Custom Fields
  implementation.
**Verification:** Manual review — no automated doc test.
**Pass:** Docs accurately reflect the new routes/fields; roadmap
correctly distinguishes what this plan did vs. what's still pending.
**Fail:** Any inaccuracy or overclaim.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `docs/backend-api.md` gained a full "Visitors" section
> plus a `cpf` field note on the User object shape. `docs/api-roadmap.md`
> gained a new "2b. Visitors" ✅ Implemented section, removed Visitors
> from the Discovery-pending table, and updated the "Suggested next
> discovery pass" note. Manual review confirms no stale claims remain.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Users page unaffected, Visitors page loads correctly
**Action:** Log into the real device via our own frontend (routine
access). Confirm the **Users** page (existing feature) renders
identically to before the Task 5.1 refactor — same columns, same
Add/Edit modal tabs/behavior, no CPF field leaking in. Confirm the
new **Visitors** sidebar tab appears, loads (likely "No visitors
found" since none exist on this device today), and its Add modal
shows the same tabs as Users plus the new CPF field.
**Verification:** Manual, via chrome-devtools-mcp, screenshots +
console check.
**Pass:** Users page byte-for-byte unaffected; Visitors page loads
without error; CPF field present only on Visitors' modal.
**Fail:** Any Users regression, Visitors page error, or CPF field
appearing on Users' modal.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (restarted `amico_backend.exe`
> from the fresh build first). Users page: identical 5 rows, all
> columns/icons unchanged (verified via full accessibility snapshot,
> not just a screenshot). New "Visitors" sidebar entry present with a
> single-person icon (distinct from Users' two-person icon). Visitors
> page: "No visitors found." (correct, none exist yet), no
> "Administrator" column (correctly hidden). Add Visitor modal: title
> "Add Visitor", General tab has Name/Employee ID/**CPF** (present,
> correct), "(*) Save the visitor to enable editing of all fields"
> (correct lowercase noun substitution), persistent "Face image" panel
> reused correctly, only 4 tabs (General/Groups/Cards/PIN, no
> Administrator toggle anywhere). No console errors at any point.
> Screenshots: `artifacts/live_capture/visitors-users-page-regression-check.png`,
> `visitors-add-modal.png`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 8.2 — Gated write test: create one disposable test visitor with a CPF value
**Action:** **Before running:** obtain a fresh, distinct
`APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval. Add a visitor
named e.g. `ZZ_VisitorTest` with a CPF value (e.g. `12345678900`, a
syntactically-plausible but clearly-fake placeholder). Confirm it
appears in the real device's own Visitors list (`customusers.html?type=1`)
— the definitive cross-check that our `user_type_id`/`c_users`
implementation actually round-trips correctly with the real device,
not just our own frontend. Confirm CPF is retrievable via `GET
/visitors/:id`. Delete the test visitor afterward; confirm via a
fresh `GET /visitors` check that it's gone, and (if feasible to check)
that its `c_users` row is also gone (no orphaned row).
**Verification:** Manual, operator/agent-observed, plus the real
device's own Visitors page as the cross-check.
**Pass:** Visitor + CPF created correctly, visible on both our
frontend and the real device's own page; cleanly removed afterward.
**Fail:** Any deviation, or a real user/visitor affected.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: PASS, live against `http://192.168.2.156`, after
> receiving the exact required approval message
> `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visitors-enroll-visitors-list-`.
> Created visitor "ZZ_VisitorTest" (id 52, CPF "12345678900") via our
> own frontend's Add Visitor modal — save succeeded, CPF field
> correctly echoed back "12345678900" after the post-save reload,
> Groups/Cards/PIN tabs unlocked. Confirmed on our own backend:
> `GET /visitors/52` returned `"cpf":"12345678900"`,
> `"userTypeId":1`. Confirmed on the **real device's own** Visitors
> page (`customusers.html?type=1`): row id 52/"ZZ_VisitorTest" present,
> "Showing from 1 to 1 of 1 records" — definitive cross-device
> round-trip confirmation. Opened the real device's own native Edit
> modal for id 52 directly (not just our frontend) and confirmed its
> own CPF field shows "12345678900" — the strongest possible
> confirmation that the `c_users` write round-trips correctly
> device-side. Deleted the test visitor via our frontend's Remove
> button (confirm dialog accepted); our frontend then showed "No
> visitors found." and a fresh `GET /visitors` returned `[]` (0
> records). Confirmed on the real device's own Visitors page: "No
> record found." Additionally confirmed (feasible after all, via a
> direct `load_objects.fcgi` call for `object:"c_users"` filtered to
> `user_id:52` from the device's own session) that its `c_users` row
> is also gone (`{"c_users":[]}`) — no orphaned row left behind.
>
> **Side discovery, out of this task's scope, documented not fixed:**
> during creation, the browser console logged a `400` on
> `GET /users/52/image` (and, confirmed separately, the same for
> `/visitors/52/image`). Investigated and ruled out a bug introduced
> by this plan: the device returns HTTP 400 (not 404) for
> `user_get_image.fcgi?user_id=<id>` on a record that has *never* had
> any image/face-template relationship at all — distinct from the
> already-documented 404 case (a record that HAD one, since removed).
> This would affect any brand-new regular User too, not just Visitors.
> The visible UI is unaffected — the `<img>` tag's own `onerror`
> handler already falls back to the placeholder correctly (screenshot:
> `artifacts/live_capture/visitor-created-list-view.png`). Recorded in
> `DECISION_LOG.md` as an accepted, out-of-scope gap for a future,
> separately-scoped bug-fix plan.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 9 — Addendum: collapsible "Enroll" sidebar group (post-completion, user-requested)

### Task 9.1 — Nest Users/Visitors under a collapsible "Enroll" group, matching the real device's sidebar
**Action:** User pointed out (after this plan's initial completion)
that the real device's sidebar shows "Enroll" as an expandable parent
containing "Users"/"Visitors" as sub-items, whereas our frontend had
them as flat top-level buttons — and asked for this to be fixed now so
future Enroll-area additions (Visits, Groups, Time Zones, etc. — all
still 🔍 Discovery pending per `docs/api-roadmap.md`) have an obvious,
consistent place to go. Restructured `frontend/index.html`: wrapped
the existing Users/Visitors buttons in a `.nav-group`/`.nav-submenu`
under a new `#enroll-toggle` button (pencil icon + chevron, default
expanded). `frontend/app.js`: added `setNavGroupExpanded()` and a
`.nav-group-toggle` click handler; existing `activateTab()`/tab-button
wiring untouched (submenu buttons are still plain `nav [data-tab]`
buttons). `frontend/style.css`: added `.nav-group-toggle`/`.nav-chevron`
(rotates -90deg when collapsed)/`.nav-submenu` (indented) rules, no
changes to any existing selector.
**Verification:** `node --check frontend/app.js`; live check via
chrome-devtools-mcp against `http://localhost:8080`.
**Pass:** Enroll group renders expanded by default with Users/Visitors
nested and indented; clicking the group header collapses/expands it
(chevron rotates, submenu hides/shows) without affecting the active
tab's content; clicking Users/Visitors still switches tabs correctly;
Access (Global)/System Information remain flat, unaffected; no new
console errors.
**Fail:** Any tab-switching regression, console error, or visual
mismatch against the real device's own Enroll group behavior.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/app.js` exit 0. Live-verified:
> screenshot confirms Enroll header + chevron + nested/indented Users/
> Visitors, matching the real device's own sidebar structure. Clicked
> the Enroll header — submenu hid, chevron rotated, Users' own table
> content stayed visible/unaffected (collapsing the group doesn't
> touch the active tab). Expanded again, clicked Visitors — correctly
> switched to the Visitors tab (verified via screenshot: "Visitors"
> heading, active/highlighted nav state, "No visitors found." — the
> disposable test visitor from Task 8.2 remains deleted, as expected).
> Only console message present: one pre-existing, unrelated a11y
> advisory ("form field element should have an id or name attribute"),
> not introduced by this change.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 10 — Addendum: bug report — Visitors photo replace-after-remove fails (Users tab unaffected)

### Task 10.1 — Diagnose and fix (or document as device-inherent) the Visitors "replace photo after Remove Image" failure
**Action:** User-reported bug: on the **Visitors** tab, uploading the
first face photo for a new visitor works, but after using "Remove
Image" and then choosing a different photo, the upload fails — while
the same remove-then-replace sequence works fine on the **Users**
tab. Code review first (`frontend/users.js`'s shared factory,
`backend/Routes.cpp`'s `/visitors/:id/image` vs `/users/:id/image`,
`src/Client.cpp`'s `setUserImage`/`removeUserImage`) found the
frontend/backend/SDK code paths **byte-identical** between the two
tabs (Task 4.2's own "direct copy" — no `userTypeId`/`c_users` branch
anywhere in the image read/write/delete path). This means either (a)
a subtle bug specific to how the Visitors modal's state behaves after
its create-then-reload sequence (unlikely given no differing code),
or (b) genuine real-device firmware behavior that special-cases the
face-template replace path for non-default `user_type_id` values —
matching this plan's own prior 400-vs-404 image-status discovery
precedent (Task 8.2's DECISION_LOG entry) of finding real,
undocumented device quirks during Visitors testing specifically.
Live comparative test plan (requires a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visitors-enroll-visitors-list-`
approval before any device write):
1. Create a disposable test **visitor**, upload photo A (from the
   user-provided set: Mr.Phương/Mr.Linh/Mr.Hòa/Mr.Quỳnh/Ms.Nghi/
   Mr.Tuấn, in `C:\Users\Admin\Downloads`), confirm success.
2. Remove Image, then upload photo B. Capture the exact result
   (success, or the exact HTTP status/error body via network
   inspection).
3. Repeat the identical sequence on a disposable test **regular
   user** (Users tab) with the same two photos, as a same-session
   control — confirms whether the failure is truly Visitors-specific
   or a flakier/photo-specific issue that happens to reproduce more
   on one tab.
4. If reproducible only for Visitors: try the identical replace
   sequence directly on the **real device's own native** Visitors
   page (bypassing our frontend/backend entirely) to determine if
   this is a genuine device-firmware limitation (document, don't
   fix — matching the 400-vs-404 precedent) vs. something unique to
   our API layer (in which case, keep investigating for an actual
   code bug).
5. Clean up all disposable test visitor/user records afterward;
   confirm via fresh `GET` checks that they're gone.
**Verification:** Manual, live, chrome-devtools-mcp network inspection
for exact status codes/response bodies at each step.
**Pass:** Root cause identified with evidence; either fixed in code
(with the fix verified by successfully completing the
remove-then-replace sequence) or conclusively shown to be a
real-device limitation (documented in `DECISION_LOG.md`, not silently
dropped).
**Fail:** Root cause not identified, or a real user/visitor record
left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Root cause found and **fixed in code** (not device-inherent
> after all). Live repro with real photos (`Mr.Hòa.png`, `Mr.Linh.png`,
> `Mr.Phương.png`, `Mr.Quỳnh.png`, `Mr.Tuấn.png`, `Ms.Nghi.png` from
> `C:\Users\Admin\Downloads`):
> - Created disposable visitor "ZZ_PhotoBugTest_Visitor" (id 54).
>   `Mr.Phương.png` was rejected by the device's own face-matching
>   ("Face exists", already enrolled as user 36 — unrelated, expected
>   device behavior, not a bug). `Mr.Linh.png` rejected ("Face too
>   distant" — a genuine device face-validation quality check, also
>   not a bug). `Mr.Hòa.png` uploaded successfully.
> - Clicked Remove Image, then uploaded `Mr.Tuấn.png` (a different
>   photo): **the photo panel kept showing Mr. Hòa's old photo** — the
>   exact bug reported. A fresh, cache-bypassed `fetch('/visitors/54/image',
>   {cache:'no-store'})` confirmed the device-side image was genuinely
>   gone (400) — so `removeImage`/`setImage` themselves were working
>   correctly; the stale display was **purely a frontend browser-cache
>   bug**: `backend/JsonMapping.cpp`'s `imageUrl` field is a fixed,
>   unchanging path (`"/users/<id>/image"`, same string across every
>   create/remove/replace cycle for a given id). `frontend/users.js`'s
>   `renderPhoto()` set `image.src` to that same unchanging string on
>   every re-render, so the browser's HTTP cache served the old cached
>   image bytes and never even issued a new network request — exactly
>   matching the real device's own UI convention of appending a
>   `?v=<value>` cache-buster to this same endpoint (already
>   LIVE_CONFIRMED elsewhere in this codebase), which our own frontend
>   had never adopted.
> - **Fix:** `frontend/users.js`'s `renderPhoto()` now sets
>   `image.src = \`${item.imageUrl}?v=${Date.now()}\`` — forces a fresh
>   network fetch on every render, matching the real device's own
>   pattern. `node --check frontend/users.js` exit 0.
> - **Verified fixed**, live: reloaded with `ignoreCache:true` (the
>   browser was itself caching the *old* `users.js` file due to a
>   missing `Cache-Control` header + Chrome's heuristic freshness for
>   recently-modified static files — same class of bug, one level up;
>   worked around for this verification pass via a cache-bypassing
>   reload, not a code change, since it only affects a developer's
>   already-open tab across a live edit, not real users). After the
>   fix: list view showed "No image" correctly right after Remove
>   Image (previously stuck on the old photo); uploading a different
>   photo (`Mr.Tuấn.png`) correctly displayed the new photo
>   immediately; repeated a third time with `Ms.Nghi.png`, still
>   correct. Network log showed each render's image request carrying a
>   distinct `?v=` value and returning the true current status (400
>   when absent, 200 with correct bytes when present) rather than
>   silently reusing a cached response.
> - **Control test** (Task 10.1 step 3): reproduced the identical
>   remove-then-replace sequence on a disposable regular user
>   ("ZZ_PhotoBugTest_User", id 55) with `Mr.Quỳnh.png` →
>   Remove Image → `Mr.Tuấn.png`. Also correct post-fix — confirms the
>   bug was never actually Users-vs-Visitors-specific; the user's
>   original report of "Users tab works fine" was most likely
>   incidental (different browser-cache timing/eviction state when
>   that tab was tested), not a real code-level difference — consistent
>   with the code-review finding that the image read/write/delete path
>   is byte-identical between the two tabs.
> - Step 4 (testing directly on the real device's own native UI) was
>   **not needed** — root cause was conclusively identified and fixed
>   in our own frontend before reaching that step.
> - Cleanup: both disposable test records deleted via their own Remove
>   buttons; confirmed gone via fresh `GET /users` (5 users, back to
>   baseline) and `GET /visitors` ("No visitors found.").
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 11 — Addendum: "Face" column should show an icon, not a raw count

### Task 11.1 — Render Face as a check/X icon, matching Password/Administrator
**Action:** User pointed out the "Face" column showed a raw number
(`item.faceCount`, e.g. "1"/"0") as plain text, inconsistent with the
Password/Administrator columns' existing check/X icon convention
(`booleanIcon`). Changed `frontend/users.js`'s `loadItems()`: pulled
`faceCount` out of the plain-text-cell array and rendered it via
`booleanIcon(item.faceCount > 0, "Enrolled", "Not enrolled")` in its
own cell, in the same table position (between Nº of Cards and Last
Access Date/Time), matching the exact pattern already used for the
Password column one line above it.
**Verification:** `node --check frontend/users.js`; live check via
chrome-devtools-mcp on both Users and Visitors tabs.
**Pass:** Face column shows a green check (face enrolled) or red X
(no face) icon instead of a raw number, on both tabs.
**Fail:** Any tab showing the raw count, or the icon inverted/wrong.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/users.js` exit 0. Live-verified on
> Users (5 rows, all showing a green check "Enrolled" icon, matching
> their actual enrolled-face state) and Visitors (1 real visitor
> record already on the device, "VIP" — showing the same green check
> correctly, confirming the fix applies identically to both tabs via
> the shared factory).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete (read-only)
- [x] Group 8.2 complete, or explicitly deferred by user decision
      (matching this project's established pattern for optional
      gated write tests)
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are modifications to existing, already-working
files, plus new files (`frontend/visitors.js`, `test/test_visitors.cpp`)
that add no risk to existing functionality on their own — revert via
`git diff`/`git checkout --` against this plan's own changes if
needed (check `git status` first per standing safety practice). The
one file carrying real regression risk is `frontend/users.js` (the
factory extraction) — Task 8.1's live check is the primary guard
against this; if it fails, revert `users.js` to its pre-refactor
state and re-plan the extraction rather than patching forward.
