# Spec — User Types write side (Enroll → User Types)

---

## Goal

Add full create/update/delete for the `user_types` object, closing the
last open item from `docs/api-roadmap.md` section 10c ("ready to plan,
2026-09-16"). Unlike every prior write-side plan this session, a User
Type is not a plain row: creating one **dynamically creates a real
physical database table on the device** (`object_add.fcgi`), and
deleting one removes it again (`object_remove.fcgi`) — both endpoints
undocumented until this project's own discovery pass found them.

**Done looks like:** A new "User Types" tab (mirroring
`frontend/holidays.js`/`frontend/scheduled-unlock.js`'s own list+modal
pattern) where an operator can add a user type (name + "Requires
Visit" checkbox), edit one, and remove one — with the underlying
dynamic-table plumbing fully hidden behind `UserTypesApi`.

---

## Background — live evidence (2026-09-16, two discovery passes)

`LIVE_CONFIRMED` via two gated cycles against the real device: the
original discovery
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-user-types-gap` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-gap`, full
findings in `docs/api-roadmap.md` section 10c) plus one supplementary
capture run just before this spec was written (same live-write
approval window, one additional disposable type,
"ZZ_TestUserType2", created and left for the user to remove manually
via the device's own UI after this SDK's capture was done). Both
passes used a broad passthrough XHR interceptor (not just the 4
standard `*_objects.fcgi` endpoints, since this object's write path
uses novel endpoint names).

- **The object itself:** `user_types` has only 3 real columns: `id`,
  `custom_table_id` (FK → `custom_tables`), `require_visitor`
  (boolean, 0/1). The device's own `usertypes.html` list only shows
  "User type" (the display name) and "Requires Visit" — the name is
  **not** a `user_types` column at all; it lives on the linked
  `custom_tables` row (`custom_tables.name`).
- **`custom_tables`** is a small shared catalog object (`id`, `name`,
  `table_name`) already used, on this device, by 3 other unrelated
  features before this plan touches anything: `{"id":1,"name":"Users","table_name":"c_users"}`
  (the CPF custom field, Visitors plan), `{"id":2,"name":"Visits","table_name":"c_visits"}`,
  `{"id":3,"name":"Visitors","table_name":"_visitors"}` (the built-in
  Visitors user type itself). This means **User Types and Custom
  Fields share the same underlying mechanism** (`docs/api-roadmap.md`
  section 11's own note) — out of scope here, see Scope.
- **Confirmed create sequence** (`object_add.fcgi` → `create_objects.fcgi`
  → `modify_objects.fcgi`), all 3 calls fired sequentially by the
  device's own Add form:
  1. `POST /object_add.fcgi`:
     ```json
     {"object":"_ZZ_TestUserType72250","name":"ZZ_TestUserType",
      "fields":[
        {"column_name":"id","name":"id","type":"INTEGER","constraint":"PRIMARY_KEY"},
        {"column_name":"user_id","name":"user_id","type":"INTEGER","constraint":"FOREIGN_KEY","foreign_key":{"object":"users","field":"id"}}
      ]}
     ```
     **Response (newly captured this pass): `{"ids":[5]}`** — confirms
     `object_add.fcgi` follows the exact same `{"ids":[...]}` response
     convention as `create_objects.fcgi`. The generated table name
     follows the pattern `_<sanitized-display-name><5-digit-random-suffix>`
     — purely cosmetic (the device does not appear to validate this
     string beyond needing it to be a legal, non-colliding SQL
     identifier), so this SDK does not need to reproduce the exact
     sanitization algorithm the web UI uses, only produce a legal,
     unique-enough name.
  2. `POST /create_objects.fcgi` on `user_types`:
     `{"custom_table_id":<id from step 1>,"require_visitor":0}` →
     returns the new `user_types` row's own id (`{"ids":[...]}`,
     standard convention, already used everywhere else this session).
  3. `POST /modify_objects.fcgi` on `custom_tables`, id from step 1:
     `{"name":"ZZ_TestUserType"}` — sets the display name. **Confirmed
     necessary**: `object_add.fcgi`'s own `"name"` parameter does not
     alone persist as the display name shown in the list; this
     follow-up call is required.
- **Confirmed delete sequence**: a lookup, then the new endpoint:
  1. `POST /load_objects.fcgi`: `{"object":"user_types","fields":["custom_table_id"],"where":[{"object":"user_types","field":"id","value":[<userTypeId>]}]}`.
  2. `POST /object_remove.fcgi`: `{"ids":[<custom_table_id from step 1>]}`.

  Only these 2 calls were observed in the device's own Remove flow —
  **no separate `destroy_objects.fcgi` call against `user_types`
  itself was seen**. Re-querying `custom_tables` afterward showed
  exactly the original 3 rows (the test row, id 4, fully gone) —
  strong evidence `object_remove.fcgi` also drops the physical table,
  not just the catalog row.
- **Not independently captured (inferred, flagged as risk below):**
  - Whether the `user_types` row itself disappears automatically once
    its `custom_table_id`'s target is removed (most likely via a
    device-side FK cascade on `custom_table_id`, mirroring the
    `object_add.fcgi` create payload's own use of `FOREIGN_KEY`
    constraints), or whether an explicit `destroy_objects.fcgi` call
    against `user_types` is also required. The observed 2-call
    sequence suggests the former, but this was not independently
    verified by querying `user_types` after the delete.
  - The Edit/rename flow (the discovery pass only tested Create then
    Delete, never Edit) — inferred by symmetry with the create
    sequence's own `modify_objects.fcgi` rename step: editing the name
    likely fires the same `custom_tables` rename call, editing
    "Requires Visit" likely fires a `modify_objects.fcgi` on
    `user_types` itself for `require_visitor`.
  - Whether deleting a User Type with existing enrolled users of that
    type is blocked, cascades, or corrupts those users' custom-table
    rows — not tested (would require creating real users of a test
    type first; explicitly out of scope, see Scope).

---

## Design decisions

### Decision 1 — Purpose-built `UserTypesApi`, not a general dynamic-schema primitive
- **Chosen:** `UserTypesApi` exposes only `list()`/`create(NewUserType)`/
  `update(UserTypeUpdate)`/`remove(id)`. It internally orchestrates the
  full `object_add.fcgi` → `create_objects.fcgi` → `modify_objects.fcgi`
  create sequence and the lookup → `object_remove.fcgi` delete
  sequence. The caller never supplies a table name, column list, or
  any other schema detail — the SDK always creates the exact same
  fixed 2-column shape (`id` PK, `user_id` FK → `users`) captured live,
  matching the device's own only-ever-observed usage of this
  mechanism.
- **Why:** This resolves the design question explicitly raised in
  `docs/api-roadmap.md` section 10c. It directly follows this
  project's own strong, consistent precedent of hiding device-internal
  plumbing behind narrow, purpose-built methods rather than generic
  passthroughs (`access_rules`/`access_rule_time_zones` are never
  exposed directly either — `ScheduledUnlocksApi`/`GroupsApi` hide them
  completely behind `addTimeZone()`/`removeTimeZone()`). A general
  `objectAdd(tableName, fields)` primitive would let a caller create
  arbitrary tables with arbitrary columns on a production access-
  control device — a much larger, unbounded blast radius than anything
  else this SDK exposes, for a capability nothing in this project's
  own roadmap currently needs.
- **Rejected alternatives:** A general `SchemaApi::createTable(...)` /
  `dropTable(...)` primitive — rejected as needlessly dangerous scope
  creep; nothing in this project's backend/frontend needs caller-
  defined table schemas, only the one fixed shape the device's own UI
  itself always uses.

### Decision 2 — Resolve `UserType.name` via one shared `custom_tables` query, not per-row N+1
- **Chosen:** `UserTypesApi::list()` issues exactly 2 reads total: one
  `user_types` list, one `custom_tables` list, joined client-side in
  C++ by `custom_table_id`. `update()`/`remove()` each do one targeted
  lookup (`buildUserTypeCustomTableIdBody(id)`) to get the single
  `custom_table_id` they need.
- **Why:** Unlike `ScheduledUnlock.timeZoneIds`/`Group.timeZoneIds`
  (a genuinely per-row, potentially-multi-valued relation, which this
  project accepted an N+1 read pattern for), every `user_type` row's
  name lives in the *same* small shared catalog table
  (`custom_tables`) — one extra query resolves every row's name at
  once, so there is no reason to repeat the N+1 pattern here. This is
  strictly better (fewer requests) without added complexity.
- **Rejected alternatives:** Per-row `custom_tables` lookup (mirroring
  the Scheduled Unlock/Groups N+1 precedent literally) — rejected as
  unnecessary; the catalog is not per-row-specific data.

### Decision 3 — `remove()` calls `object_remove.fcgi` only; no speculative `destroy_objects.fcgi` fallback added preemptively
- **Chosen:** `UserTypesApi::remove(id)` performs: lookup
  `custom_table_id` → `POST /object_remove.fcgi` with
  `{"ids":[customTableId]}`. No additional `destroy_objects.fcgi` call
  against `user_types` is added in Group 3 (SDK implementation).
- **Why:** The live-captured native Remove flow shows exactly these 2
  calls and nothing else (Background). Adding an untested,
  speculative extra delete call would violate this project's own
  "don't add error handling/cleanup for scenarios not evidenced"
  principle. Group 8 (this plan's own live verification) will directly
  confirm whether the `user_types` row also disappears; **if it does
  not**, Group 8 is explicitly scoped to add the missing
  `destroy_objects.fcgi` fallback call and re-verify before closing —
  identical to how Scheduled Unlock's/Groups' own inferred
  `buildXAccessRuleIdBody` lookup shapes were confirmed-or-fixed live
  in their own Group 7/8.
- **Risk (accepted, to be resolved live, not guessed):** if the
  fallback turns out to be needed, this decision's own "chosen"
  behavior will be corrected in place during Group 8, with the
  DECISION_LOG.md updated to record the real behavior found.

### Decision 4 — `NewUserType`/`UserTypeUpdate` both carry `name` + `requireVisitor`; no `customTableId` exposed as caller-settable
- **Chosen:** `UserType` (the read view) exposes `id`, `customTableId`
  (read-only, informational — mirrors how other structs expose
  underlying ids), `name`, `requireVisitor`. `NewUserType` and
  `UserTypeUpdate` only ever carry `name`/`requireVisitor` — never a
  `customTableId`, since that value is always internally
  discovered/generated, never supplied by the caller.
- **Why:** Matches Decision 1's stance — the caller interacts with a
  User Type as a simple named+boolean record; the dynamic table is
  pure internal plumbing, never something a caller reads or writes
  directly.
- **Rejected alternatives:** none seriously considered.

---

## Scope

### In scope
- SDK: `UserType`/`NewUserType`/`UserTypeUpdate` types;
  `UserTypesApi` with `list()`/`create()`/`update()`/`remove()`; new
  query builders for all steps in the Background's confirmed
  sequences (`buildUserTypesListBody`, `buildCustomTablesListBody`,
  `buildUserTypeCustomTableIdBody`, `buildUserTypeObjectAddBody`,
  `buildUserTypeCreateBody`, `buildCustomTableRenameBody`,
  `buildUserTypeUpdateBody`, `buildUserTypeObjectRemoveBody`); a small
  internal (non-builder, impure) helper in `src/Client.cpp` to
  generate a unique-enough dynamic table name from a display name
  (random suffix, `<random>`).
- Backend: `GET/POST/PATCH/DELETE /user-types`, mirroring the existing
  Holidays/Scheduled Unlock route shape exactly.
- Frontend: new `frontend/user-types.js` — list + Add/Edit modal
  ("User type" name field, "Requires Visit" checkbox), mirroring
  `frontend/holidays.js`'s own simpler (no time-zone-linking) pattern;
  sidebar entry + `#tab-user-types` div + script tag in
  `frontend/index.html`.
- Tests: query-builder tests (byte-for-byte against the live-captured
  payloads, including the newly-confirmed `object_add.fcgi` response
  shape), `UserTypesApi` CRUD tests, backend route tests, whitelist
  coverage.
- Docs: `docs/backend-api.md` new `/user-types` section;
  `docs/api-roadmap.md` section 10c updated to point at this plan once
  shipped.
- Live verification (Group 8): a disposable test type, full
  create → edit (name + requireVisitor) → delete cycle, confirming
  Decision 3's remove() behavior for real and fixing it live if wrong.
  **Hard rule, called out explicitly because the blast radius here is
  materially larger than any prior object this session:** the live
  test must only ever touch a fresh, disposable `ZZ_`-prefixed test
  type created by this plan's own Group 8 — the real `"Visitors"` row
  (id 1, `custom_table_id` 3, backing the entire already-shipped
  Visits/Visitors feature) must never be edited or deleted during
  verification.

### Out of scope
- **Custom Fields (`customfields.html`)** — confirmed to likely share
  this exact same `custom_tables`/`object_add.fcgi` mechanism
  (`docs/api-roadmap.md` section 11), but is a distinct sidebar area
  with its own discovery needed (e.g. it likely lets an operator add
  arbitrary columns to the `users`/`visits` tables, a different shape
  than User Types' fixed 2-column table). Not touched by this plan.
- **Deleting a User Type with existing enrolled users** — not tested
  live (Background); this SDK's `remove()` will surface whatever error
  the device itself returns (if any) rather than attempting to guess
  or pre-validate a scenario that was never observed.
- **A general dynamic-schema primitive** — explicitly rejected,
  Decision 1.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `UserType`/`NewUserType`/`UserTypeUpdate` structs |
| `include/amico/Client.hpp` | Modify | New `UserTypesApi` class |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | New query builders (list-both-objects, lookup, object_add, create, rename, update, object_remove) |
| `src/Client.cpp` | Modify | `UserTypesApi` implementation + table-name-generation helper |
| `backend/JsonMapping.cpp` | Modify | `toJson(UserType)`, `fromJsonNewUserType`, `fromJsonUserTypeUpdate` |
| `backend/Routes.cpp` | Modify | `GET/POST/PATCH/DELETE /user-types` |
| `frontend/user-types.js` | New | List + Add/Edit modal |
| `frontend/index.html` | Modify | Sidebar entry, tab div, script tag |
| `test/test_user_types.cpp` | New | Query builder + `UserTypesApi` tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `CMakeLists.txt` | Modify | Register `test/test_user_types.cpp` |
| `docs/backend-api.md` | Modify | New `/user-types` section |
| `docs/api-roadmap.md` | Modify | Section 10c updated to reflect shipped status |

---

## Risks and unknowns

- **Decision 3's remove() sequence is the single biggest open risk** —
  whether `object_remove.fcgi` alone also cleans up the `user_types`
  row is inferred, not confirmed. Group 8 will confirm/fix live before
  this plan can close, exactly like every prior plan's own inferred-
  lookup risk this session.
- **Edit/rename flow is inferred, not captured** (Background) — Group
  8 will exercise it directly for the first time.
- **Materially larger blast radius than any prior object this
  session** — a bug here risks leaving an orphaned physical SQL table
  (not just an orphaned row in an existing table like `access_rules`).
  Mitigated by: (a) `remove()`'s sequence is copied verbatim from live
  capture, not guessed; (b) Group 8 only ever touches a disposable
  `ZZ_`-prefixed test type, never the real "Visitors" type.
- **Table-name collision** — the random-suffix naming scheme mirrors
  the device's own UI convention exactly (which is itself not
  collision-proof); not solved more defensively here than the
  reference implementation already is, since the device's own
  `object_add.fcgi` would presumably error on a genuine collision and
  no evidence suggests this is a real-world problem in practice.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | Every shape live-captured across 2 discovery passes except Edit and the remove()-cascade question, both clearly flagged for Group 8 |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed, each with a clear reason; Decision 1 explicitly rejects the more "general/flexible" design in favor of the narrower one |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 14 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Two real open risks (remove-cascade, edit shape) deferred to Group 8 rather than fully pre-confirmed — larger than prior plans' single deferred risk, called out honestly rather than papered over |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked
("Commit finding, rồi viết luôn plan User Types") to write this plan
immediately after the discovery findings were committed.
**Confirmed on:** 2026-09-16
