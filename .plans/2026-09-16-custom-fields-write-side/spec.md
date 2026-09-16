# Spec — Custom Fields write side (Enroll → Custom Fields)

---

## Goal

Add full create/update/delete for the `custom_columns` object,
completing the last item in `docs/api-roadmap.md` section 10d ("ready
to plan, 2026-09-16"). A Custom Field is a device-defined extra column
added to one of 3 existing tables (`Users`/`Visitors`/`Visits`),
closely related to — but structurally distinct from — User Types
(`.plans/2026-09-16-user-types-write-side/`), which creates a whole
new table rather than a column on an existing one.

**Done looks like:** A new "Custom Fields" tab (list + Add/Edit modal)
where an operator can add a field (pick Table, Type, Name, Mandatory),
rename an existing one, and remove one — with the device's
`object_add_field.fcgi`/`object_remove_fields.fcgi` mechanism fully
hidden behind `CustomFieldsApi`.

---

## Background — live evidence (2026-09-16)

`LIVE_CONFIRMED` via a gated discovery pass
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-custom-fields-discovery` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-discovery`,
both user-approved verbatim). One disposable test field
("ZZ_TestField" on `Visits`) was created, inspected, then fully
deleted — no lasting device change (confirmed by re-querying
`custom_columns` afterward). Full findings, including a process
incident during this pass (an unintended live write reached the
device via a previously-undiscovered endpoint a blocklist-based
capture technique didn't anticipate), are recorded in
`docs/api-roadmap.md` section 10d.

- **The object itself:** `custom_columns` has exactly 4 real columns
  — **and no more**: `id`, `custom_table_id` (FK), `name`,
  `column_name`. This is **device-confirmed, not inferred**: directly
  querying the device for `type`, `mandatory`, `not_null`, or
  `constraint` as a field on `custom_columns` returns a `400` error
  (`"<field> is not a column of table custom_columns"`) for every one
  of those names. **This means a field's Type (Text/Number) and
  Mandatory-ness are write-only at creation time** — baked into the
  physical column's own SQL schema, not independently readable back
  through this device's object-query API (short of parsing the raw
  ~73KB `object_metadata.fcgi` schema dump, which this project's own
  `debugGetObjectMetadataJson()` is explicitly scoped to
  "development/discovery use only... not part of the normal
  application workflow" — repurposing it into this plan's `list()`
  path would violate that existing boundary).
- **`Table` accepts exactly 3 options** (confirmed via the real
  device's own Add form dropdown): `Users`, `Visitors`, `Visits` —
  matching `custom_tables`' 3 pre-existing catalog rows (`id:1
  name:"Users" table_name:"c_users"`, `id:2 name:"Visits"
  table_name:"c_visits"`, `id:3 name:"Visitors"
  table_name:"_visitors"`).
- **`Type` accepts exactly 2 options**: `Text`, `Number` (confirmed via
  the real device's own Add form dropdown).
- **Confirmed create sequence** — a single write call, simpler than
  User Types' own 3-call sequence (no separate rename-follow-up
  needed; the `name` parameter persists correctly on the first call):
  ```json
  POST /object_add_field.fcgi
  {"object":"c_visits","column_name":"_ZZ_TestField64189",
   "name":"ZZ_TestField","type":"TEXT","constraint":"NONE","default_value":""}
  ```
  `object` is the **physical table name** (`c_visits`), resolved via a
  `custom_tables` lookup for the chosen display table first (this
  project's own already-existing `buildCustomTablesListBody()`, added
  by the User Types plan, is directly reusable here — no new builder
  needed for this step). `column_name` follows the same
  `_<sanitized-name><random-suffix>` convention as `object_add.fcgi`'s
  own table-naming, except **underscores in the display name are
  preserved** here (`"ZZ_TestField"` → `"_ZZ_TestField64189"`), unlike
  User Types' own column-stripping (`"ZZ_TestUserType"` →
  `"_ZZTestUserType72250"`) — a real, observed difference, not a
  typo; this plan's own naming helper must NOT reuse User Types'
  `generateDynamicTableName()` verbatim (Decision 2).
- **`type` was only captured for the Text case (`"TEXT"`)** — the
  Number case's exact device string was never independently exercised
  this pass (flagged as a Risk).
- **`constraint`/`default_value` were `"NONE"`/`""`** for this
  non-mandatory field — the Mandatory checkbox's effect on these
  fields was never independently exercised this pass either (flagged
  as a Risk).
- **Confirmed delete sequence** — a single write call, no lookup
  needed (the id is already known from the list row):
  ```json
  POST /object_remove_fields.fcgi   {"ids":[8]}   ->   {"ids":[8]}
  ```
  (`8` is the `custom_columns.id` of the test field.) This is the
  first live-confirmed response body for this endpoint family —
  `{"ids":[...]}`, matching the `object_add.fcgi`/`create_objects.fcgi`
  convention already established elsewhere this session.
- **Cleanup confirmed complete**: re-querying `custom_columns`
  afterward showed exactly the original 1 row (the real, pre-existing
  "CPF" field on `Users`) — the test field's catalog row was fully
  removed. `GET /visits` on this project's own backend was also
  spot-checked afterward with no regression.
- **Not captured / not independently confirmed:**
  - The `Number` type's exact device string.
  - The `Mandatory` checkbox's exact `constraint` value (guessed
    `"NOT_NULL"` by symmetry with `"NONE"`, not captured).
  - The Edit flow (this pass only tested create then delete, same
    limitation as User Types' own first discovery pass) — though
    given `custom_columns`' own confirmed 4-column shape (Background,
    above), only `name` can possibly be editable via
    `modify_objects.fcgi`; `table`/`type`/`mandatory` are **provably
    immutable after creation**, not merely assumed, since neither is
    stored anywhere on `custom_columns` itself.
  - Whether `object_remove_fields.fcgi` physically drops the
    underlying SQL column (same un-provable-via-this-API caveat as
    User Types' own physical-table-drop finding).

---

## Design decisions

### Decision 1 — Purpose-built `CustomFieldsApi`, matching User Types' own precedent
- **Chosen:** `CustomFieldsApi` exposes only `list()`/
  `create(NewCustomField)`/`update(CustomFieldUpdate)`/`remove(id)`.
  The caller only ever picks one of the 3 known table names, one of
  the 2 known types, a display name, and Mandatory — never a
  caller-supplied physical table/column name or arbitrary SQL type
  string.
- **Why:** Direct continuation of User Types' own Decision 1 rationale
  (`.plans/2026-09-16-user-types-write-side/spec.md`) — this project's
  consistent precedent against exposing device-internal dynamic-schema
  plumbing as a general primitive.
- **Rejected alternatives:** none seriously considered — this mirrors
  proven, already-accepted design.

### Decision 2 — `CustomField` (read view) exposes only `id`/`customTableId`/`table`/`name`; `type`/`mandatory` are write-only, present only on `NewCustomField`
- **Chosen:** Because `custom_columns` is device-confirmed to have
  only 4 real columns (Background) — `type` and `mandatory` are
  **not queryable at all**, not merely omitted from a convenience
  read. `CustomField` therefore cannot expose them; `NewCustomField`
  carries `type`/`mandatory` as create-only inputs.
  `CustomFieldUpdate` carries only `id`/`name` — `table`/`type`/
  `mandatory` are provably immutable after creation and have no
  member on this type at all.
- **Why:** This is not a design preference but a hard device
  constraint, directly confirmed via a `400` error for every
  alternative field name tried. Exposing a `type`/`mandatory` member
  on `CustomField` that the device can never actually populate would
  be worse than omitting it — either permanently empty/default (silent
  wrong data) or requiring a heavyweight `object_metadata.fcgi` parse
  that this project has already scoped away from the normal
  application workflow.
- **Rejected alternatives:** Parsing `object_metadata.fcgi`'s raw
  schema dump to resolve `type` per field on `list()` — rejected as
  repurposing an explicitly debug-only capability
  (`debugGetObjectMetadataJson()`'s own doc comment) into a
  production-path read, adding real complexity for a purely cosmetic
  parity with the native UI's own "Type" list column.

### Decision 3 — A dedicated column-name-generation helper, not reusing User Types' `generateDynamicTableName()`
- **Chosen:** A new, separate helper (e.g. `generateColumnName()`)
  that preserves underscores in the sanitized name, matching the
  live-captured evidence (`"ZZ_TestField"` → `"_ZZ_TestField64189"`,
  underscore kept) rather than stripping them
  (`generateDynamicTableName()`'s own confirmed behavior for User
  Types: `"ZZ_TestUserType"` → `"_ZZTestUserType72250"`, underscore
  stripped).
- **Why:** Live-captured evidence directly shows these two objects'
  sanitization behavior differs — reusing the wrong helper would
  produce a column name that doesn't match the real device's own UI
  convention (cosmetic only, not a device requirement, but worth
  matching given it costs nothing extra).
- **Rejected alternatives:** Reusing `generateDynamicTableName()`
  as-is — rejected since the live evidence directly contradicts it for
  this object.

### Decision 4 — Validate `table`/`type` against fixed known sets before ever calling the device
- **Chosen:** `CustomFieldsApi::create()` validates the caller's
  `table` against the 3 known values (`"Users"`/`"Visitors"`/
  `"Visits"`) and `type` against the 2 known values (`"Text"`/
  `"Number"`) before issuing any device call, throwing
  `amico::UnsupportedOperationError` (matching this project's
  "validate at system boundaries" convention; corrected during Group 3
  implementation from an initially-planned `std::invalid_argument`,
  which would have surfaced as an incorrect `500` through the
  backend's existing exception mapping — see DECISION_LOG.md) on
  anything else.
- **Why:** These are genuinely fixed, closed sets (confirmed via the
  real device's own Add form, which offers no other options) — silent
  passthrough of an unrecognized value would fail deep inside a device
  call with a much less clear error, or worse, silently target the
  wrong physical table if a caller's string happened to collide with
  something unexpected.
- **Rejected alternatives:** No validation, passthrough only —
  rejected as a boundary-validation gap this project consistently
  avoids elsewhere (e.g. `UsersApi`'s registration format checks).

---

## Scope

### In scope
- SDK: `CustomField`/`NewCustomField`/`CustomFieldUpdate` types;
  `CustomFieldsApi` with `list()`/`create()`/`update()`/`remove()`;
  new query builders (`buildCustomColumnsListBody`,
  `buildCustomFieldObjectAddBody`, `buildCustomFieldUpdateBody`,
  `buildCustomFieldObjectRemoveBody`), reusing the existing
  `buildCustomTablesListBody()` from the User Types plan directly; a
  new `generateColumnName()` helper (Decision 3).
- Backend: `GET/POST/PATCH/DELETE /custom-fields`, mirroring the
  existing `/user-types` route shape.
- Frontend: new `frontend/custom-fields.js` — list (Table + Name
  columns only, per Decision 2) + Add modal (Table/Type
  dropdowns + Name + Mandatory) + Edit modal (Name only, per Decision
  2's immutability finding).
- Tests: query-builder tests (byte-for-byte against the live-captured
  payloads), `CustomFieldsApi` CRUD tests including the
  table/type validation (Decision 4), backend route tests, whitelist
  coverage.
- Docs: `docs/backend-api.md` new `/custom-fields` section;
  `docs/api-roadmap.md` section 10d updated to point at this plan once
  shipped.
- Live verification (Group 8): a disposable test field, full
  create → edit (name only) → delete cycle, confirming/correcting the
  `Number` type string and the `Mandatory` constraint string (spec.md
  Risks) live. **Never touch the real "CPF" field** on `Users` during
  verification.

### Out of scope
- **Editing `table`/`type`/`mandatory` after creation** — provably
  impossible via this device's own object-query API (Decision 2);
  `CustomFieldUpdate` has no such members at all.
- **A general dynamic-schema primitive** — same rejection as User
  Types' own Decision 1.
- **Resolving `type` via `object_metadata.fcgi` parsing** — explicitly
  rejected, Decision 2.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `CustomField`/`NewCustomField`/`CustomFieldUpdate` structs |
| `include/amico/Client.hpp` | Modify | New `CustomFieldsApi` class |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | New query builders; reuse of `buildCustomTablesListBody()` |
| `src/Client.cpp` | Modify | `CustomFieldsApi` implementation + `generateColumnName()` helper + table/type validation |
| `backend/JsonMapping.cpp` | Modify | `toJson(CustomField)`, `fromJsonNewCustomField`, `fromJsonCustomFieldUpdate` |
| `backend/Routes.cpp` | Modify | `GET/POST/PATCH/DELETE /custom-fields` |
| `frontend/custom-fields.js` | New | List + Add/Edit modal |
| `frontend/index.html` | Modify | Sidebar entry, tab div, script tag |
| `test/test_custom_fields.cpp` | New | Query builder + `CustomFieldsApi` tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `CMakeLists.txt` | Modify | Register `test/test_custom_fields.cpp` |
| `docs/backend-api.md` | Modify | New `/custom-fields` section |
| `docs/api-roadmap.md` | Modify | Section 10d updated to reflect shipped status |

---

## Risks and unknowns

- **`Number` type's exact device string is inferred (`"NUMBER"`), not
  captured** — confirm/adjust during this plan's own Group 8.
- **Mandatory's exact `constraint` string is inferred
  (`"NOT_NULL"`), not captured** — confirm/adjust during Group 8.
- **Edit (`name` rename)'s exact `modify_objects.fcgi` shape is
  inferred, not captured** — confirm/adjust during Group 8, same
  category of risk as every prior plan's own inferred update() shape.
- **Whether `object_remove_fields.fcgi` also drops the physical SQL
  column** — same accepted, un-provable-via-this-API caveat as User
  Types.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | The `custom_columns` schema constraint (Decision 2) is device-confirmed via explicit error responses, not guessed; only Number/Mandatory's exact strings and the Edit shape are inferred, clearly flagged |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed, each with a clear, evidence-backed reason |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 14 files/changes, each tied to a decision; reuses `buildCustomTablesListBody()` rather than duplicating |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Only 2 small inferred strings and the Edit shape deferred to Group 8, matching this session's own consistent pattern |

**Total: 36/40 → 9.0/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked
("Commit finding, rồi viết luôn plan Custom Fields") to write this
plan immediately after the discovery findings were committed.
**Confirmed on:** 2026-09-16
