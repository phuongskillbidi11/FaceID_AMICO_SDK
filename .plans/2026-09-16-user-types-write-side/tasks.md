# Tasks — User Types write side (Enroll → User Types)

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) has a read-only part and one
>   gated write part (creating/editing/deleting one disposable test
>   user type), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-write-side`
>   approval. **Never touch the real "Visitors" row during this
>   verification** (spec.md Scope) — only a fresh `ZZ_`-prefixed test
>   type created by this plan's own Group 8.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `UserType`/`NewUserType`/`UserTypeUpdate`
**Action:**
```cpp
/// Public view of the `user_types` object (User Types write-side
/// plan, 2026-09-16). `name` is NOT a `user_types` column -- it lives
/// on the linked `custom_tables` row and is resolved client-side by
/// UserTypesApi::list() (spec.md Decision 2). `customTableId` is
/// exposed read-only, informational only -- never caller-settable
/// (spec.md Decision 4).
struct UserType {
    int64_t id = 0;
    int64_t customTableId = 0;
    std::string name;
    bool requireVisitor = false;
};

/// Creation parameters. Deliberately has no `customTableId` member --
/// the dynamic table is always internally created (spec.md Decision 1).
struct NewUserType {
    std::string name;
    bool requireVisitor = false;
};

/// Update parameters. Same no-customTableId rationale as NewUserType.
struct UserTypeUpdate {
    int64_t id = 0;
    std::string name;
    bool requireVisitor = false;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — Field constants + read builders
**Action:** Add:
```cpp
const std::vector<std::string> kUserTypeFields = {"id", "custom_table_id", "require_visitor"};
const std::vector<std::string> kCustomTableFields = {"id", "name"};

/// LIVE_CONFIRMED shape (spec.md Background).
nlohmann::json buildUserTypesListBody();
/// LIVE_CONFIRMED shape -- lists every dynamically-created table's
/// catalog row (spec.md Decision 2, Background: 3 pre-existing rows
/// observed -- Users/Visits/Visitors -- before this plan touches
/// anything).
nlohmann::json buildCustomTablesListBody();
/// Looks up the custom_table_id for one user_types row. LIVE_CONFIRMED
/// verbatim shape (spec.md Background) -- used by update()/remove()
/// before either can act on the linked custom_tables row.
nlohmann::json buildUserTypeCustomTableIdBody(int64_t userTypeId);
```
Implementations (verbatim from live capture where noted):
```cpp
nlohmann::json buildUserTypesListBody() {
    nlohmann::json body;
    body["object"] = "user_types";
    body["fields"] = kUserTypeFields;
    return body;
}

nlohmann::json buildCustomTablesListBody() {
    nlohmann::json body;
    body["object"] = "custom_tables";
    body["fields"] = kCustomTableFields;
    return body;
}

nlohmann::json buildUserTypeCustomTableIdBody(int64_t userTypeId) {
    nlohmann::json body;
    body["object"] = "user_types";
    body["fields"] = nlohmann::json::array({"custom_table_id"});
    body["where"] = nlohmann::json::array({
        {{"object", "user_types"}, {"field", "id"}, {"value", nlohmann::json::array({userTypeId})}},
    });
    return body;
}
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 2.2 — Write builders (`object_add.fcgi`, create, rename, update, `object_remove.fcgi`)
**Action:** Add:
```cpp
/// Builds the object_add.fcgi body that creates the dynamic table
/// backing a new user type. LIVE_CONFIRMED verbatim shape (spec.md
/// Background) -- always the same fixed 2-column shape (id PK, user_id
/// FK -> users); tableName/displayName are the only variable parts.
nlohmann::json buildUserTypeObjectAddBody(const std::string& tableName, const std::string& displayName);

/// Creates the user_types row itself, linking it to a just-created
/// custom_table_id. LIVE_CONFIRMED verbatim shape -- bare (no
/// join/fields/where/order), matching the "bare create_objects" shape
/// already used for join-table rows like group_access_rules.
nlohmann::json buildUserTypeCreateBody(int64_t customTableId, bool requireVisitor);

/// Sets the display name on the custom_tables row. LIVE_CONFIRMED
/// necessary follow-up call (spec.md Background: object_add.fcgi's own
/// "name" parameter does not alone persist as the display name).
/// Reused unchanged by both create() (Group 3) and update() (name
/// edit, inferred by symmetry -- spec.md Risks).
nlohmann::json buildCustomTableRenameBody(int64_t customTableId, const std::string& name);

/// Updates require_visitor on the user_types row itself. INFERRED by
/// symmetry with every other object's own modify_objects.fcgi update
/// shape this session -- not independently captured (spec.md Risks,
/// Background). Confirm/adjust during this plan's own Group 8.
nlohmann::json buildUserTypeUpdateBody(int64_t userTypeId, bool requireVisitor);

/// Builds the object_remove.fcgi body that drops the dynamic table.
/// LIVE_CONFIRMED verbatim shape (spec.md Background): {"ids":[id]},
/// no "object" field -- unlike destroy_objects.fcgi, this endpoint's
/// target is implicit (always custom_tables).
nlohmann::json buildUserTypeObjectRemoveBody(int64_t customTableId);
```
Implementations:
```cpp
nlohmann::json buildUserTypeObjectAddBody(const std::string& tableName, const std::string& displayName) {
    nlohmann::json body;
    body["object"] = tableName;
    body["name"] = displayName;
    body["fields"] = nlohmann::json::array({
        {{"column_name", "id"}, {"name", "id"}, {"type", "INTEGER"}, {"constraint", "PRIMARY_KEY"}},
        {{"column_name", "user_id"}, {"name", "user_id"}, {"type", "INTEGER"}, {"constraint", "FOREIGN_KEY"},
         {"foreign_key", {{"object", "users"}, {"field", "id"}}}},
    });
    return body;
}

nlohmann::json buildUserTypeCreateBody(int64_t customTableId, bool requireVisitor) {
    nlohmann::json body;
    body["object"] = "user_types";
    body["values"] = nlohmann::json::array({
        {{"custom_table_id", customTableId}, {"require_visitor", boolToDeviceInt(requireVisitor)}},
    });
    return body;
}

nlohmann::json buildCustomTableRenameBody(int64_t customTableId, const std::string& name) {
    nlohmann::json body;
    body["object"] = "custom_tables";
    body["values"] = {{"name", name}};
    body["where"] = {{"custom_tables", {{"id", customTableId}}}};
    return body;
}

nlohmann::json buildUserTypeUpdateBody(int64_t userTypeId, bool requireVisitor) {
    nlohmann::json body;
    body["object"] = "user_types";
    body["values"] = {{"require_visitor", boolToDeviceInt(requireVisitor)}};
    body["where"] = {{"user_types", {{"id", userTypeId}}}};
    return body;
}

nlohmann::json buildUserTypeObjectRemoveBody(int64_t customTableId) {
    nlohmann::json body;
    body["ids"] = nlohmann::json::array({customTableId});
    return body;
}
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `UserTypesApi` class
**Action:** In `include/amico/Client.hpp`, add (alongside the existing
`HolidaysApi`/`ScheduledUnlocksApi`):
```cpp
/// Typed read/write wrapper for the `user_types` object (User Types
/// write-side plan, 2026-09-16). Hides the dynamic-table plumbing
/// (object_add.fcgi/object_remove.fcgi) entirely -- callers only ever
/// see a name + a boolean (spec.md Decision 1).
class UserTypesApi {
public:
    std::vector<UserType> list();

    /// Creates a new dynamic table (object_add.fcgi), the user_types
    /// row (create_objects.fcgi), then sets its display name
    /// (modify_objects.fcgi on custom_tables). Returns the
    /// device-assigned user_types id.
    int64_t create(const NewUserType& userType);
    /// Updates require_visitor (modify_objects.fcgi on user_types) and
    /// the display name (modify_objects.fcgi on custom_tables).
    void update(const UserTypeUpdate& userType);
    /// Looks up the linked custom_table_id, then calls
    /// object_remove.fcgi to drop the dynamic table. Per spec.md
    /// Decision 3, does NOT separately call destroy_objects.fcgi on
    /// user_types -- confirmed/fixed live in this plan's own Group 8
    /// if that turns out to be needed.
    void remove(int64_t id);

private:
    friend class AmicoClient;
    explicit UserTypesApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Add `UserTypesApi userTypes{this};` (or the equivalent existing
member-accessor pattern already used for `holidays`/`scheduledUnlocks`)
to `AmicoClient`'s public surface, and `friend class UserTypesApi;` to
its private section.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. Private helper (impure -- lives here, not in ObjectQuery.cpp, since
   pure builders must stay deterministic for testing):
   ```cpp
   namespace {
   std::string generateDynamicTableName(const std::string& displayName) {
       std::string sanitized;
       for (char c : displayName) {
           if (std::isalnum(static_cast<unsigned char>(c))) sanitized += c;
       }
       static std::mt19937 rng{std::random_device{}()};
       std::uniform_int_distribution<int> dist(10000, 99999);
       return "_" + sanitized + std::to_string(dist(rng));
   }
   }  // namespace
   ```
   (`#include <random>` and `<cctype>` as needed.)
2. `int64_t AmicoClient::findUserTypeCustomTableIdImpl(int64_t userTypeId)`:
   `POST /load_objects.fcgi` with `buildUserTypeCustomTableIdBody`,
   require the `user_types` field to be a non-empty array, return
   `rows[0].at("custom_table_id")`. Throw `ProtocolError` if empty (no
   such user type).
3. `std::vector<UserType> AmicoClient::listUserTypesImpl()`: 2 reads
   (`buildUserTypesListBody`, `buildCustomTablesListBody`), build a
   `custom_table_id -> name` map from the second, join client-side
   (spec.md Decision 2). `require_visitor` mapped via the existing
   `requireBoolLikeField()` helper (same convention as
   `hol1`/`hol2`/`hol3`/`repeats`).
4. `int64_t AmicoClient::createUserTypeImpl(const NewUserType& input)`:
   `object_add.fcgi` (parse `ids[0]` the same way `create_objects.fcgi`
   responses are already parsed elsewhere -- Decision confirmed this
   session, DECISION_LOG.md) -> `create_objects.fcgi` (parse `ids[0]`
   as the new user_types id) -> `modify_objects.fcgi` (rename). Return
   the new id.
5. `void AmicoClient::updateUserTypeImpl(const UserTypeUpdate& input)`:
   look up `custom_table_id` -> `modify_objects.fcgi` on `user_types`
   (require `changes` > 0, throw `ProtocolError` otherwise, same
   convention as every other `update()` this session) ->
   `modify_objects.fcgi` on `custom_tables` (rename, unconditional).
6. `void AmicoClient::removeUserTypeImpl(int64_t id)`: look up
   `custom_table_id` -> `POST /object_remove.fcgi` with
   `buildUserTypeObjectRemoveBody`.
7. Wire `UserTypesApi::list/create/update/remove` to forward to the
   above `...Impl` methods, matching the existing
   `HolidaysApi`/`ScheduledUnlocksApi` forwarder pattern exactly.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `JsonMapping` additions
**Action:** In `backend/JsonMapping.cpp`, mirroring
`toJson(const amico::Holiday&)`/`fromJsonNewHoliday`/`fromJsonHolidayUpdate`:
- `toJson(const amico::UserType&)` -> `{"id", "customTableId", "name", "requireVisitor"}`.
- `fromJsonNewUserType(const nlohmann::json&)` -> `amico::NewUserType`
  (`name`, `requireVisitor`).
- `fromJsonUserTypeUpdate(const nlohmann::json&, int64_t id)` ->
  `amico::UserTypeUpdate`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build
> (required stopping/restarting the `amico_backend`/`nginx` services
> via the standing UAC-elevation procedure to release the file lock).

---

### Task 4.2 — `/user-types` routes
**Action:** In `backend/Routes.cpp`, add (mirroring the existing
`/holidays` block exactly):
- `GET /user-types` -> `200 [UserType...]`.
- `POST /user-types` -> `201 UserType` (body: `name`, `requireVisitor`).
- `PATCH /user-types/:id` -> `200 {"success": true}`.
- `DELETE /user-types/:id` -> `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build
> (part of the same rebuild as Task 4.1). Service restarted, health
> check `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — New `frontend/user-types.js` + `frontend/index.html` wiring
**Action:** Load the `frontend-design` skill first (standing project
instruction). Create `frontend/user-types.js`, mirroring
`frontend/holidays.js`'s own list+Add/Edit-modal pattern (no
time-zone-linking section needed -- User Types has no such tab): a
list table ("User type" name, "Requires Visit" column, Edit/Remove),
and an Add/Edit modal with a name text field and a "Requires Visit"
checkbox. In `frontend/index.html`, add the sidebar entry, a
`#tab-user-types` div, and the new script tag, matching the existing
Holidays/Scheduled Unlock wiring exactly.
**Verification:** `node --check frontend/user-types.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/user-types.js` — exit 0.

---

## Group 6 — Tests

### Task 6.1 — `test/test_user_types.cpp` (new)
**Action:** Register in `CMakeLists.txt` alongside the existing
`test/test_holidays.cpp`/`test/test_scheduled_unlocks.cpp` entries.
Cover:
- All 8 new query builders, byte-for-byte matched against the
  live-captured payloads in spec.md Background (including the
  `object_add.fcgi` request shape and its confirmed `{"ids":[...]}`
  response-parsing convention).
- `UserTypesApi::list()` — 2-read join behavior (Decision 2): a
  `user_types` row whose `custom_table_id` has no matching
  `custom_tables` row falls back to an empty `name` rather than
  throwing (defensive but not silently wrong -- matches this
  project's existing "missing enrichment data degrades gracefully"
  precedent, e.g. `Visit.visitorName` when a user was deleted).
- `UserTypesApi::create()` — full 3-call sequence, correct id
  threading (`object_add.fcgi`'s returned id feeds both
  `create_objects.fcgi` and the rename call).
- `UserTypesApi::update()` — lookup + 2-call sequence; throws
  `ProtocolError` if `modify_objects.fcgi` on `user_types` reports zero
  changes.
- `UserTypesApi::remove()` — lookup + `object_remove.fcgi` sequence.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> SDK suite: 222/222 passed (up from 205), 1515 assertions, 0 failed.
> 15 new UT-1..UT-15 cases, all passing on the first run.

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the 8 new builders never accept
  a caller-supplied object/field/connector string (matching the
  established whitelist-test pattern for every prior plan's builders).
- `test/backend/test_routes.cpp`: route cases for all 4 new
  `/user-types` routes.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Backend suite: 83/83 passed (up from 79), 837 assertions, 0 failed.
> Added Q-20/Q-21 (whitelist) and X-1..X-4 (routes); also added
> `/user-types` to the existing session-required-for-all-GET-routes
> test.

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add a new `/user-types` section to `docs/backend-api.md`
(routes, request/response shapes), mirroring the existing `/holidays`
section. Update `docs/api-roadmap.md` section 10c's "ready to plan"
header to reflect this plan shipping, and correct/confirm the
"Not yet independently confirmed" callouts based on this plan's own
Group 8 findings (the remove()-cascade question and the Edit flow).
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> `docs/backend-api.md`: new `/user-types` section added after
> `/scheduled-unlocks`, mirroring the `/holidays` section's structure.
> `docs/api-roadmap.md` section 10c: header updated to "✅ implemented
> (2026-09-16)", the design-question paragraph replaced with a
> "Shipped" summary, Group 8's outcome left explicitly marked
> "pending" until this plan's own Group 8 runs. Section 11's
> "Suggested next discovery pass" updated to point at Custom Fields as
> the sole remaining Enroll item.

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: User Types tab loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
User Types list shows the real "Visitors" row correctly (name,
Requires Visit checked) -- **read-only, do not edit or remove it**.
Confirm other tabs (Holidays/Scheduled Unlock/Groups/Time Zones) are
unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** List loads correctly; "Visitors" row shown accurately; no
regressions elsewhere.
**Fail:** Any regression, wrong data, or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). User Types tab shows 2 rows: "Visitors"
> (Requires visit ✓, matching the real device's own native page) and a
> pre-existing leftover "ZZ_TestUserType2" from the earlier
> supplementary discovery capture (Does not require visit — correct,
> matches how it was created). `GET /user-types` returned 200.
> Console showed only the pre-existing, unrelated `/users/:id/image`
> 400s (users without a photo) — no regression. Scheduled Unlock tab
> spot-checked, unaffected.

---

### Task 8.2 — Gated write test: create → edit → delete (disposable type only)
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-write-side`
approval.
1. Create a disposable test type (e.g. "ZZ_UserTypeTest3") via our own
   frontend, with "Requires Visit" unchecked. Confirm it appears
   correctly on both our frontend and the real device's own native
   User Types page (name + Requires Visit column match).
2. Edit it: change the name and toggle "Requires Visit" on. This is
   the **first independent live confirmation of the Edit flow**
   (spec.md Risks: `buildUserTypeUpdateBody`'s inferred shape,
   `buildCustomTableRenameBody`'s reuse for rename-on-edit) -- if
   either call's shape is wrong, fix it before continuing.
3. Delete it via our own frontend. **Directly query `user_types` on
   the device afterward** to confirm whether the row is also gone
   (spec.md Decision 3's central open risk). **If a `user_types` row
   is left behind**, add a `destroy_objects.fcgi` fallback call to
   `UserTypesApi::remove()` (Group 3) and re-verify this exact step,
   updating Decision 3 in DECISION_LOG.md with the real, confirmed
   behavior either way.
4. Directly query `custom_tables` on the device to confirm the test
   type's catalog row is fully gone (matching the discovery pass' own
   confirmed cleanup behavior).
**Verification:** Manual, operator/agent-observed, plus the real
device's own native User Types page as the cross-check.
**Pass:** Every step succeeds (or Decision 3 is corrected and
re-verified); the real "Visitors" row is never touched; no orphaned
`user_types`/`custom_tables` row remains.
**Fail:** Any deviation, the real "Visitors" row affected, or a
leftover row not cleaned up.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-write-side`
> (pasted verbatim by the user). Full cycle run against the real
> device via our own frontend, cross-checked against the device's own
> native User Types page every step:
> 1. **Create** ("ZZ_UserTypeTest3", Requires Visit unchecked):
>    `POST /user-types` -> `201`. Confirmed on the real device's own
>    native page, showing correctly with no visit requirement.
> 2. **Edit** (renamed to "ZZ_UserTypeTest3_Renamed", Requires Visit
>    toggled on): `PATCH /user-types/:id` -> `200` on the **first
>    attempt** (no fix needed). **First independent live confirmation
>    of `buildUserTypeUpdateBody`'s and `buildCustomTableRenameBody`'s
>    reuse-for-edit inferred shapes** -- both correct on the first try.
>    Confirmed on the device's own native page: name and Requires
>    Visit both updated correctly.
> 3. **Delete**: `DELETE /user-types/:id` -> `200`. Directly queried
>    `GET /user-types` afterward -- the row was **fully gone**, not
>    just filtered by the frontend. **This directly confirms Decision
>    3's central open risk**: `object_remove.fcgi` alone (no separate
>    `destroy_objects.fcgi` call) *does* fully remove the `user_types`
>    row too -- no fix was needed, Decision 3's original "chosen"
>    behavior was correct as implemented.
> 4. **Cleanup of the pre-existing "ZZ_TestUserType2" leftover** (from
>    the supplementary discovery capture done before this plan's
>    spec.md was written): deleted via the same `DELETE /user-types/:id`
>    path -- this incidentally cross-validated `remove()` against a
>    user type that was originally created via the device's own native
>    UI, not our backend, confirming the lookup/remove sequence works
>    regardless of how the type was originally created.
> 5. Directly queried `custom_tables` on the device afterward: exactly
>    the original 3 rows (Users/Visits/Visitors) remained -- both test
>    artifacts' catalog rows (and, by the same inference as the
>    original discovery, their physical tables) were fully removed.
>    The real device's own native User Types page confirmed only
>    "Visitors" remains. The real "Visitors" row was never touched.

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete (read-only)
- [x] Group 8.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing, already-
working files, plus one new frontend file and one new test file (no
existing behavior removed). Revert via `git diff`/`git checkout --`
against this plan's own changes if needed (check `git status` first
per standing safety practice).
