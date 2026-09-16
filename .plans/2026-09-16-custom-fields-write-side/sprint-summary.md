# Sprint Summary — Custom Fields write side (Enroll → Custom Fields)

**Plan:** `2026-09-16-custom-fields-write-side`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): new
  `CustomField`/`NewCustomField`/`CustomFieldUpdate` types;
  `CustomFieldsApi` with `list()`/`create()`/`update()`/`remove()`.
  Unlike User Types (which creates a whole new table), this object
  adds a column to an *existing* table (`Users`/`Visitors`/`Visits`)
  via a previously-undiscovered `object_add_field.fcgi`/
  `object_remove_fields.fcgi` pair — a single write call for create,
  simpler than User Types' own 3-call sequence. `table`/`type` are
  validated against fixed known sets before any device call, throwing
  `amico::UnsupportedOperationError` (maps to `400`) on an
  unrecognized value. `CustomField`'s read view deliberately excludes
  `type`/`mandatory` — device-confirmed that `custom_columns` has no
  such column at all (an explicit `400` error for either field name),
  so both are write-only, present only on `NewCustomField`; `table`/
  `type`/`mandatory` are therefore provably immutable after creation,
  not merely assumed. Reuses the existing `buildCustomTablesListBody()`
  (from the User Types plan) for physical-table-name resolution.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`):
  `toJson(CustomField)`; `fromJsonNewCustomField`/
  `fromJsonCustomFieldUpdate` (never parses `table`/`type`/`mandatory`
  on update); new `GET`/`POST`/`PATCH`/`DELETE /custom-fields` routes,
  mirroring the existing `/user-types` route shape.
- **Frontend**: new `frontend/custom-fields.js` — list (Table + Name
  columns only, since Type/Mandatory aren't readable back) + Add modal
  (Table/Type dropdowns, Name, Mandatory) + Edit modal (Name only);
  sidebar entry + `#tab-custom-fields` div + script tag added to
  `frontend/index.html`.
- **Tests**: new `test/test_custom_fields.cpp` (CF-1..CF-12: all 4
  new query builders byte-for-byte matched against live-captured
  payloads for both the Text/non-mandatory and Number/mandatory
  cases; `CustomFieldsApi::list/create/update/remove` full behavior
  including table/type validation and the missing-custom_tables-row
  fallback); 2 new `test_query_whitelist.cpp` cases (Q-22/Q-23); 4 new
  `test/backend/test_routes.cpp` route cases (Y-1..Y-4, including the
  400 case for an unrecognized table). Final counts: SDK 237/237 (up
  from 222), backend 87/87 (up from 79) — both clean, zero
  regressions.
- **Docs**: `docs/backend-api.md` gained a new `/custom-fields`
  section; `docs/api-roadmap.md` section 10d updated from "ready to
  plan" to "✅ implemented", with the `custom_columns` schema
  constraint, the design decisions, and the Group 8 live-verification
  outcome all recorded.

## Live verification (Group 8) — 2 real bugs found and fixed, then zero bugs on re-run

- **8.1 (read-only):** Custom Fields list shows "Users | CPF"
  correctly, matching the real device's own native page. Other tabs
  unaffected.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-write-side`)**:
  - **Bug 1**: `createCustomField()` failed with `ProtocolError:
    missing required field 'table_name'` — the reused
    `buildCustomTablesListBody()` never requested `table_name`
    (User Types' own consumer never needed it). Fixed by adding
    `"table_name"` to `kCustomTableFields`; re-ran the full 236-case
    SDK suite to confirm no regression before continuing.
  - **Bug 2**: `object_add_field.fcgi` returned `400` — the inferred
    `"Number"` device type string was wrong. Used the real device's
    own native Add form directly (Table=Visits, Type=Number, Mandatory
    checked) to capture ground truth: `type` is **`"INTEGER"`**, not
    `"NUMBER"`, and `default_value` is type-dependent (`""` for Text,
    `0` for Number). `"NOT_NULL"` for Mandatory was already correct.
    Fixed `buildCustomFieldObjectAddBody()`'s signature and
    `createCustomField()`'s mapping; added CF-2b and updated CF-7 to
    lock in the corrected values.
  - **Full cycle re-run after both fixes**: created
    "ZZ_CustomFieldTest" (Visits, Number, Mandatory) via our own
    frontend, confirmed on the real device's own native page → renamed
    to "ZZ_CustomFieldTest_Renamed" via `PATCH /custom-fields/:id`,
    succeeding on the **first attempt** (the inferred rename shape was
    correct all along) → deleted via `DELETE /custom-fields/:id`.
    Directly queried `custom_columns` on the device afterward: exactly
    the original 1 row (the real "CPF" field) remained. The real
    "CPF" field was never touched throughout.

## Design question resolved

The design question raised in `docs/api-roadmap.md` section 10d
(narrow API vs. general primitive) is resolved the same way as User
Types: `CustomFieldsApi` is narrow and purpose-built, never exposing a
caller-supplied physical table/column name.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.
