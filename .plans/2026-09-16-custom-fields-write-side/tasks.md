# Tasks — Custom Fields write side (Enroll → Custom Fields)

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
>   custom field), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-write-side`
>   approval. **Never touch the real "CPF" field during this
>   verification** (spec.md Scope) — only a fresh `ZZ_`-prefixed test
>   field created by this plan's own Group 8.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `CustomField`/`NewCustomField`/`CustomFieldUpdate`
**Action:**
```cpp
/// Public view of the `custom_columns` object (Custom Fields write-
/// side plan, 2026-09-16). `table` is resolved from `custom_table_id`
/// via a join with `custom_tables` (spec.md Background), the same
/// pattern as UserType.name. `type`/`mandatory` are deliberately NOT
/// exposed here -- LIVE_CONFIRMED that `custom_columns` has no such
/// column at all (device returns 400 for either field name); they are
/// write-only, present only on NewCustomField (spec.md Decision 2).
struct CustomField {
    int64_t id = 0;
    int64_t customTableId = 0;
    std::string table;
    std::string name;
};

/// Creation parameters. `table` must be one of "Users"/"Visitors"/
/// "Visits"; `type` must be one of "Text"/"Number" -- both validated
/// against these fixed sets before any device call (spec.md
/// Decision 4).
struct NewCustomField {
    std::string table;
    std::string type;
    std::string name;
    bool mandatory = false;
};

/// Update parameters. Deliberately has no table/type/mandatory member
/// -- LIVE_CONFIRMED immutable after creation, since custom_columns
/// has nowhere to store them (spec.md Decision 2).
struct CustomFieldUpdate {
    int64_t id = 0;
    std::string name;
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

### Task 2.1 — Field constants + read/write builders
**Action:** Add:
```cpp
const std::vector<std::string> kCustomColumnFields = {"id", "custom_table_id", "name", "column_name"};

/// Lists every real custom field, excluding the auto-created id/
/// user_id/visit_id PK/FK columns that User Types' own object_add.fcgi
/// mechanism registers into this same catalog (spec.md Background --
/// custom_columns is shared between both objects). LIVE_CONFIRMED
/// filtered shape.
nlohmann::json buildCustomColumnsListBody();

/// Builds the object_add_field.fcgi body that adds a column to an
/// existing physical table. LIVE_CONFIRMED verbatim shape for the
/// Text/non-mandatory case (spec.md Background); deviceType/
/// constraint for Number/Mandatory are inferred (spec.md Risks).
nlohmann::json buildCustomFieldObjectAddBody(const std::string& physicalTableName,
                                              const std::string& columnName,
                                              const std::string& displayName,
                                              const std::string& deviceType,
                                              const std::string& constraint);

/// Renames a custom field. NOT independently live-captured -- only
/// `name` is possibly editable at all (spec.md Decision 2). Confirm/
/// adjust during this plan's own Group 8.
nlohmann::json buildCustomFieldUpdateBody(int64_t customColumnId, const std::string& name);

/// Builds the object_remove_fields.fcgi body that drops a custom
/// field. LIVE_CONFIRMED verbatim shape (spec.md Background):
/// {"ids":[id]}, no "object" field -- same convention as
/// buildUserTypeObjectRemoveBody.
nlohmann::json buildCustomFieldObjectRemoveBody(int64_t customColumnId);
```
Implementations:
```cpp
nlohmann::json buildCustomColumnsListBody() {
    nlohmann::json body;
    body["join"] = "LEFT";
    body["object"] = "custom_columns";
    body["fields"] = kCustomColumnFields;
    body["where"] = nlohmann::json::array({
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "id"}, {"operator", "!="}, {"connector", "AND"}},
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "user_id"}, {"operator", "!="}, {"connector", ") AND ("}},
        {{"object", "custom_columns"}, {"field", "column_name"}, {"value", "visit_id"}, {"operator", "!="}, {"connector", ") AND ("}},
    });
    body["order"] = nlohmann::json::array({"custom_table_id", "id"});
    return body;
}

nlohmann::json buildCustomFieldObjectAddBody(const std::string& physicalTableName,
                                              const std::string& columnName,
                                              const std::string& displayName,
                                              const std::string& deviceType,
                                              const std::string& constraint) {
    nlohmann::json body;
    body["object"] = physicalTableName;
    body["column_name"] = columnName;
    body["name"] = displayName;
    body["type"] = deviceType;
    body["constraint"] = constraint;
    body["default_value"] = "";
    return body;
}

nlohmann::json buildCustomFieldUpdateBody(int64_t customColumnId, const std::string& name) {
    nlohmann::json body;
    body["object"] = "custom_columns";
    body["values"] = {{"name", name}};
    body["where"] = {{"custom_columns", {{"id", customColumnId}}}};
    return body;
}

nlohmann::json buildCustomFieldObjectRemoveBody(int64_t customColumnId) {
    nlohmann::json body;
    body["ids"] = nlohmann::json::array({customColumnId});
    return body;
}
```
Note: table-name resolution ("Users"/"Visitors"/"Visits" -> physical
`table_name`) reuses the *existing* `buildCustomTablesListBody()`
(added by the User Types plan) directly -- no new builder needed for
that step.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `CustomFieldsApi` class
**Action:** In `include/amico/Client.hpp`, add (alongside the existing
`UserTypesApi`):
```cpp
/// Typed read/write wrapper for the `custom_columns` object (Custom
/// Fields write-side plan, 2026-09-16). Hides the
/// object_add_field.fcgi/object_remove_fields.fcgi plumbing entirely.
class CustomFieldsApi {
public:
    std::vector<CustomField> list();

    /// Validates `table`/`type` against their fixed known sets
    /// (spec.md Decision 4), resolves the physical table name via
    /// custom_tables, then calls object_add_field.fcgi. Returns the
    /// device-assigned custom_columns id. Throws UnsupportedOperationError
    /// for an unrecognized table/type.
    int64_t create(const NewCustomField& field);
    /// Renames a custom field (modify_objects.fcgi on custom_columns).
    /// Throws ProtocolError if nothing changed.
    void update(const CustomFieldUpdate& field);
    /// Calls object_remove_fields.fcgi to drop the field.
    void remove(int64_t id);

private:
    friend class AmicoClient;
    explicit CustomFieldsApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Add the `CustomFieldsApi& customFields()` accessor, `friend class
CustomFieldsApi;`, and `CustomFieldsApi customFieldsApi_{this};`
member, matching the existing `UserTypesApi` wiring exactly.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. Private helper (impure -- lives here, not in ObjectQuery.cpp, same
   rationale as `generateDynamicTableName()`):
   ```cpp
   namespace {
   /// Preserves underscores in the sanitized name (spec.md Decision 3
   /// -- LIVE_CONFIRMED this differs from generateDynamicTableName()'s
   /// own underscore-stripping behavior for User Types).
   std::string generateColumnName(const std::string& displayName) {
       std::string sanitized;
       for (char c : displayName) {
           if (std::isalnum(static_cast<unsigned char>(c)) || c == '_') sanitized += c;
       }
       static std::mt19937 rng{std::random_device{}()};
       std::uniform_int_distribution<int> dist(10000, 99999);
       return "_" + sanitized + std::to_string(dist(rng));
   }
   }  // namespace
   ```
2. `std::vector<CustomField> AmicoClient::listCustomFieldsImpl()`: 2
   reads (`buildCustomColumnsListBody`, `buildCustomTablesListBody`),
   build a `custom_table_id -> table display name` map from the
   second, join client-side (same N+1-avoiding pattern as
   `UserTypesApi::list()`, spec.md Decision 2/User Types' own
   Decision 2).
3. `int64_t AmicoClient::createCustomFieldImpl(const NewCustomField& input)`:
   - Validate `input.table` is one of `"Users"`/`"Visitors"`/`"Visits"`
     and `input.type` is one of `"Text"`/`"Number"`, else throw
     `UnsupportedOperationError` (spec.md Decision 4).
   - Look up the physical `table_name` for `input.table` via
     `buildCustomTablesListBody()`'s response, matching by `name`.
   - Map `type` -> device string: `"Text"` -> `"TEXT"`, `"Number"` ->
     `"NUMBER"` (inferred, spec.md Risks). Map `mandatory` -> `constraint`:
     `false` -> `"NONE"`, `true` -> `"NOT_NULL"` (inferred, spec.md Risks).
   - `object_add_field.fcgi` (parse `ids[0]` the same way
     `create_objects.fcgi`/`object_add.fcgi` responses are already
     parsed elsewhere). Return the new id.
4. `void AmicoClient::updateCustomFieldImpl(const CustomFieldUpdate& input)`:
   `modify_objects.fcgi` on `custom_columns` (require `changes` > 0,
   throw `ProtocolError` otherwise, same convention as every other
   `update()` this session).
5. `void AmicoClient::removeCustomFieldImpl(int64_t id)`: `POST
   /object_remove_fields.fcgi` with `buildCustomFieldObjectRemoveBody`.
6. Wire `CustomFieldsApi::list/create/update/remove` forwarders,
   matching the existing `UserTypesApi` forwarder pattern exactly.
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
`toJson(const amico::UserType&)`/`fromJsonNewUserType`/
`fromJsonUserTypeUpdate`:
- `toJson(const amico::CustomField&)` -> `{"id", "customTableId", "table", "name"}`.
- `fromJsonNewCustomField(const nlohmann::json&)` -> `amico::NewCustomField`
  (`table`, `type`, `name`, `mandatory`).
- `fromJsonCustomFieldUpdate(const nlohmann::json&, int64_t id)` ->
  `amico::CustomFieldUpdate` (`name` only).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build.

---

### Task 4.2 — `/custom-fields` routes
**Action:** In `backend/Routes.cpp`, add (mirroring the existing
`/user-types` block exactly):
- `GET /custom-fields` -> `200 [CustomField...]`.
- `POST /custom-fields` -> `201 CustomField` (body: `table`, `type`,
  `name`, `mandatory`). A thrown `amico::UnsupportedOperationError`
  (unrecognized table/type) maps to `400` automatically via the
  existing `respondError`/`mapException` path -- no special-casing
  needed.
- `PATCH /custom-fields/:id` -> `200 {"success": true}` (body: `name`
  only).
- `DELETE /custom-fields/:id` -> `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build
> (required stopping/restarting the `amico_backend`/`nginx` services
> via the standing UAC-elevation procedure; the first UAC prompt was
> dismissed, retried successfully). Health check
> `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — New `frontend/custom-fields.js` + `frontend/index.html` wiring
**Action:** Load the `frontend-design` skill first (standing project
instruction). Create `frontend/custom-fields.js`, mirroring
`frontend/user-types.js`'s own list+Add/Edit-modal pattern: a list
table (**Table**, **Name** columns only, per spec.md Decision 2 -- no
Type/Mandatory column, since neither is readable back), Edit/Remove.
Add modal: a Table `<select>` (Users/Visitors/Visits), a Type
`<select>` (Text/Number), a Name text field, a Mandatory checkbox.
Edit modal: **Name only** (Table/Type/Mandatory shown as read-only
labels or omitted entirely, matching their confirmed immutability). In
`frontend/index.html`, add the sidebar entry, a `#tab-custom-fields`
div, and the new script tag, matching the existing User
Types/Holidays wiring exactly.
**Verification:** `node --check frontend/custom-fields.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/custom-fields.js` — exit 0.

---

## Group 6 — Tests

### Task 6.1 — `test/test_custom_fields.cpp` (new)
**Action:** Register in `CMakeLists.txt` alongside the existing
`test/test_user_types.cpp` entry. Cover:
- All 4 new query builders, byte-for-byte matched against the
  live-captured payloads in spec.md Background (including
  `object_add_field.fcgi`'s confirmed request shape and the
  `object_remove_fields.fcgi` request+response pair).
- `CustomFieldsApi::list()` — 2-read join behavior, same pattern as
  `UserTypesApi::list()`'s own test.
- `CustomFieldsApi::create()` — table/type validation (both valid and
  invalid inputs, expecting `UnsupportedOperationError` for unrecognized
  values), correct physical-table-name resolution, correct
  type/constraint mapping.
- `CustomFieldsApi::update()` — throws `ProtocolError` on zero
  changes; succeeds on a positive count.
- `CustomFieldsApi::remove()` — single-call sequence.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> SDK suite: 234/234 passed (up from 222), 1546 assertions, 0 failed.
> 12 new CF-1..CF-12 cases, all passing on the first run.

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the 4 new builders never accept
  a caller-supplied object/field/connector string beyond the already-
  validated table/type/name/constraint values.
- `test/backend/test_routes.cpp`: route cases for all 4 new
  `/custom-fields` routes, including the `400` response for an
  invalid `table`/`type`.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> SDK suite: 236/236 passed (up from 234, Q-22/Q-23 added). Backend
> suite: 87/87 passed (up from 83), 856 assertions, 0 failed. Added
> Y-1..Y-4 routes (including the 400 case for an unrecognized table)
> and `/custom-fields` to the session-required-for-all-GET-routes
> test.

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add a new `/custom-fields` section to
`docs/backend-api.md`, mirroring the existing `/user-types` section.
Update `docs/api-roadmap.md` section 10d's "ready to plan" header to
reflect this plan shipping, and correct/confirm the "Not yet
independently confirmed" callouts based on this plan's own Group 8
findings (Number's device string, Mandatory's constraint string, the
Edit flow).
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> `docs/backend-api.md`: new `/custom-fields` section added after
> `/user-types`, mirroring its structure. `docs/api-roadmap.md`
> section 10d: header updated to "✅ implemented (2026-09-16)", the
> "Ready to plan" paragraph replaced with a "Shipped" summary; Group
> 8's outcome left explicitly marked "pending" until this plan's own
> Group 8 runs.

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Custom Fields tab loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
Custom Fields list shows the real "CPF" field correctly (Table:
Users) -- **read-only, do not edit or remove it**. Confirm other tabs
(User Types/Holidays/Scheduled Unlock) are unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** List loads correctly; "CPF" row shown accurately; no
regressions elsewhere.
**Fail:** Any regression, wrong data, or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). Custom Fields tab shows 1 row: "Users | CPF"
> — matching the real device's own native page exactly. `GET
> /custom-fields` returned 200. Console showed only the pre-existing,
> unrelated `/users/:id/image` 400s (users without a photo) — no
> regression.

---

### Task 8.2 — Gated write test: create (Number + Mandatory) → edit → delete
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-write-side`
approval.
1. Create a disposable test field on `Visits` (e.g. "ZZ_CustomFieldTest")
   with **Type = Number, Mandatory = true** via our own frontend --
   the first independent live confirmation of both inferred strings
   (spec.md Risks: the `"NUMBER"` device type and `"NOT_NULL"`
   constraint). If either is wrong, fix it before continuing. Confirm
   on the real device's own native Custom Fields page.
2. Edit it: rename it. First independent live confirmation of
   `buildCustomFieldUpdateBody`'s inferred shape.
3. Delete it via our own frontend. Directly query `custom_columns` on
   the device afterward to confirm the row is gone.
**Verification:** Manual, operator/agent-observed, plus the real
device's own native Custom Fields page as the cross-check.
**Pass:** Every step succeeds (or an inferred string is fixed and
re-verified); the real "CPF" field is never touched; no orphaned
`custom_columns` row remains.
**Fail:** Any deviation, the real "CPF" field affected, or a leftover
row not cleaned up.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-write-side`
> (pasted verbatim by the user). Two real bugs found and fixed live
> before this could pass:
> 1. **Bug 1**: `buildCustomTablesListBody()` (reused from User Types)
>    only requested `id`/`name`, never `table_name` -- but
>    `createCustomField()` needs `table_name` to resolve the physical
>    table. Fixed by adding `"table_name"` to `kCustomTableFields`
>    (harmless for User Types' own consumer, which never reads it).
>    All 236 existing tests re-verified passing after the fix.
> 2. **Bug 2**: the inferred `"Number"` device type string was wrong
>    -- confirmed via the real device's own native Add form (captured
>    request+response) that it is **`"INTEGER"`**, not `"NUMBER"`.
>    `default_value` is also type-dependent: `""` for Text, `0` (a
>    JSON number) for Number -- also confirmed live. Fixed
>    `buildCustomFieldObjectAddBody`'s signature (added a
>    `defaultValue` parameter) and `createCustomField()`'s mapping;
>    `"NOT_NULL"` for Mandatory was already correct. Added CF-2b and
>    updated CF-7 to lock in the corrected values; full re-run: SDK
>    237/237, backend 87/87, both clean.
> 3. **Full cycle re-run after both fixes, via our own frontend**:
>    created "ZZ_CustomFieldTest" (Visits, Number, Mandatory) -> `POST
>    /custom-fields` succeeded, confirmed on the real device's own
>    native page ("Visits | Number | ZZ_CustomFieldTest") -> renamed to
>    "ZZ_CustomFieldTest_Renamed" via `PATCH /custom-fields/:id`,
>    succeeded on the **first attempt** (confirms
>    `buildCustomFieldUpdateBody`'s inferred shape was correct all
>    along) -> deleted via `DELETE /custom-fields/:id`. Directly
>    queried `custom_columns` on the device afterward: exactly the
>    original 1 row (the real "CPF" field) remained. The real "CPF"
>    field was never touched throughout.

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
