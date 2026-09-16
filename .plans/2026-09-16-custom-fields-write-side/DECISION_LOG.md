# Decision Log — Custom Fields write side

---

## 2026-09-16 — Plan created

**Context:** `docs/api-roadmap.md` section 10d recorded a full
discovery pass finding `custom_columns` structurally related to, but
distinct from, User Types: it adds a column to an *existing* table
(`Users`/`Visitors`/`Visits`) via a previously-undiscovered
`object_add_field.fcgi` endpoint, rather than creating a whole new
table. The discovery pass also surfaced a process incident (an
unintended live write reached the device via this novel endpoint,
which a blocklist-based safe-capture technique copied from every
prior discovery this session didn't anticipate) — reported
transparently to the user and cleaned up with a properly-obtained
write-approval token.

**Decision:** Write a full new plan
(`2026-09-16-custom-fields-write-side`), following User Types' own
established precedent for the API surface (Decision 1: narrow,
purpose-built `CustomFieldsApi`).

**Decided by:** User request ("Commit finding, rồi viết luôn plan
Custom Fields", answered via AskUserQuestion right after the discovery
findings were committed as `cb45e85`).
**Status:** Done.

---

## 2026-09-16 — Supplementary live read confirms `custom_columns`' exact schema (only 4 real columns)

**Context:** Before writing spec.md, a supplementary read-only check
(still covered by the original `APPROVE_LIVE_DEVICE_TEST:2026-09-16-custom-fields-discovery`
approval — no write involved) was run to resolve an open design
question: does `custom_columns` expose a field's Type (Text/Number) or
Mandatory-ness anywhere queryable?

**Finding:** No. Requesting `custom_columns` with `fields: ["type"]`,
`["mandatory"]`, `["not_null"]`, or `["constraint"]` each returned an
explicit `400` error: `"<field> is not a column of table
custom_columns"`. The object has exactly 4 real columns: `id`,
`custom_table_id`, `name`, `column_name`. This is a hard, device-
confirmed constraint, not an inference — it directly resolved spec.md
Decision 2 (`CustomField`'s read view cannot expose `type`/`mandatory`
at all, since the device itself has nowhere to store or return them
outside the physical column's own SQL schema).

**Decided by:** Live-captured evidence (explicit device error
responses). Directly informs spec.md Decision 2 and the immutability
conclusion in Decision 2/Scope (out of scope: editing
table/type/mandatory after creation).
**Status:** Done.

---

## 2026-09-16 — Group 3 implementation correction: `UnsupportedOperationError`, not `std::invalid_argument`

**Context:** spec.md Decision 4 originally said `create()` should throw
`std::invalid_argument` for an unrecognized `table`/`type`. While
implementing Group 3, checking `backend/ErrorMapping.cpp`'s
`mapException()` showed a plain `std::invalid_argument` isn't one of
the `dynamic_cast`-matched `amico::` exception types, so it would have
fallen through to the generic `500 InternalError` case -- wrong for a
client input validation error.

**Decision:** Throw `amico::UnsupportedOperationError` instead (already
defined in `include/amico/Errors.hpp`, previously unused anywhere in
this codebase) -- it already maps to `400` via the existing
`mapException()`, with zero backend changes needed.

**Decided by:** Implementation-time correction, no user input needed
(a straightforward bug-avoidance fix, same category as every prior
plan's own "confirm/fix during implementation" allowance).
**Status:** Done. Updates spec.md Decision 4's own wording.

---

## 2026-09-16 — Group 8 live verification: 2 real bugs found and fixed, then zero bugs on re-run

**Context:** Ran the full gated live test (approved via
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-write-side`):
created a disposable "ZZ_CustomFieldTest" field on `Visits` with
**Type = Number, Mandatory = true** via our own frontend (the first
independent live exercise of both inferred device strings), then
edited (renamed) it, then deleted it. Every step cross-checked against
the real device's own native Custom Fields page.

**Bug 1 (found on the very first attempt):** `createCustomField()`
threw `ProtocolError: missing required field 'table_name'` — the
reused `buildCustomTablesListBody()` (from the User Types plan) only
ever requested `id`/`name`, never `table_name`, since User Types'
own consumer of that builder never needed it. **Fix:** added
`"table_name"` to `kCustomTableFields` directly (harmless for User
Types, which ignores the extra field). Re-ran the full 236-case SDK
suite to confirm no regression before continuing.

**Bug 2 (found on the second attempt, after fixing Bug 1):**
`object_add_field.fcgi` returned `400`. To find the real values
without guessing again, the real device's own native Add form was
used directly (Table=Visits, Type=Number, Mandatory checked), with a
full request+response capture. **Finding:** `type` for Number is
**`"INTEGER"`**, not the inferred `"NUMBER"`; `default_value` is also
type-dependent — `""` for Text, `0` (a JSON number, not a string) for
Number. `"NOT_NULL"` for Mandatory's `constraint` was already correct.
**Fix:** added a `defaultValue` parameter to
`buildCustomFieldObjectAddBody()` and corrected `createCustomField()`'s
type/default-value mapping. The disposable field created via the
native UI during this investigation ("ZZ_NativeTest") was deleted via
the native UI's own Remove flow before continuing, confirming only
that one row was selected (not the real "CPF" row) before confirming.

**Outcome after both fixes:** the full create → edit → delete cycle
succeeded end-to-end via this project's own frontend on the first
subsequent attempt — including `buildCustomFieldUpdateBody`'s
inferred rename shape, which turned out correct without any further
fix needed. A direct `custom_columns` query afterward confirmed
exactly the original 1 row (the real "CPF" field) remained. The real
"CPF" field was never touched at any point.

**Decided by:** Live gated write test, user-approved; both bug fixes
were straightforward implementation corrections requiring no further
user input (matching this project's own "confirm/fix during Group 8"
established pattern).
**Status:** Done. Plan closed.

---
