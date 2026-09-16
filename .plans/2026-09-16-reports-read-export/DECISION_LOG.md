# Decision Log — Reports (browse definitions + generic CSV export)

---

## 2026-09-16 — Plan created

**Context:** `docs/api-roadmap.md` section 7 recorded a discovery pass
finding the real scope of "Reports" much larger than originally
described (11 report definitions, not 6) and, critically, that the
export column mechanism is entirely server-described metadata
(`report_columns`/`object_field_report_columns`), not something
requiring per-report-type hardcoding as originally assumed.

**Decision:** Write a full new plan (`2026-09-16-reports-read-export`)
covering all 11 report types generically for browsing, filtering, and
CSV export — no narrower slice was needed, since the generic mechanism
covers every report type on this device equally well.

**Decided by:** User request ("Commit finding, rồi viết plan Reports
đầy đủ", answered via AskUserQuestion right after the discovery
findings were committed as `32d1c18`).
**Status:** Done.

---

## 2026-09-16 — Read-only scope: no gated-write step needed

**Context:** Every prior write-side plan this session (Holidays,
Scheduled Unlock, Groups Time Zones, User Types, Custom Fields) needed
a `APPROVE_LIVE_DEVICE_WRITE_TEST` token for its own Group 8, since
each one created/updated/deleted a real device row. This plan is
different: `report_generate.fcgi` (and every other endpoint this plan
touches) is a pure read/query mechanism — nothing here ever mutates
device state.

**Decision:** This plan's own Group 8 only requires
`APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export` (the read
token). There is no write-approval gate at all, correctly matching
this project's own established risk-tiering discipline
(`feedback_write_api_risk_tiers.md`) — gating a pure read as if it
were a write would misapply that discipline, not follow it more
strictly.

**Decided by:** Direct analysis of the feature's own nature (spec.md
Decision 1), not a user decision point — a straightforward application
of the already-established tiering rule.
**Status:** Done. Informs spec.md Decision 1 and this plan's own
Group 8 task structure.

---

## 2026-09-16 — Group 8 live verification: 5 real bugs found and fixed, then zero bugs on re-run

**Context:** This plan's own Group 8 (approved via
`APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export`) turned out
to be the most bug-dense live verification pass this session, because
two of spec.md's own flagged Risks (the id-only query's response
shape, and the multi-filter `where` combination) were both genuinely
unconfirmed, and the export path itself is the largest, most novel
piece of orchestration logic implemented so far.

**Bug 1 (frontend, found immediately on the first Export click)**:
optional id-type filter inputs (`users.id`, `portals.id`, `groups.id`,
`time_zones.id`) were marked `required` by the shared `input()`
helper's own default, blocking form submission whenever they were
correctly left empty (meaning "no filter"). **Fix**: explicitly set
`field.required = false` for every non-`time` filter field in
`frontend/reports.js`.

**Bug 2 (`where` shape, found on the first real export attempt)**:
`report_generate.fcgi` returned `400 {"error":"Invalid operator: type"}`.
Root-caused via a sequence of direct device probes: confirmed the base
id-only-query mechanism worked correctly with an empty `where:{}`
(returning real, correctly-`\r\n`-separated ids); confirmed a
`[from,to]` array under `where.access_logs.time` was silently accepted
but matched zero rows (misleading, not the real fix); then found the
genuinely correct shape by reading this project's own already-shipped
`buildAccessLogsListBody()` (`src/ObjectQuery.cpp`), which already
solves the identical problem for `GET /access-logs`:
`where.access_logs.time[">="]`/`["<="]`, not a raw embedded descriptor
or a bare array. **Fix**: `exportReportCsv()` now special-cases a
`field == "time"` filter, parsing its `{"type":"day","interval":N,"finish":M}`
descriptor and converting it into the confirmed `>=`/`<=`
operator-object shape.

**Bug 3 (`order` shape, found alongside Bug 2's own investigation)**:
the original Giai đoạn 1b discovery capture was read as
`[direction, field]` (e.g. `["descending","time"]`), but the same
already-shipped `buildAccessLogsListBody()` uses `[field, direction]`
(`["time", "descending"]`). Both branches
(`hasTimeField ? [...] : [...]`) were corrected to match.

**Bug 4 (`line_break`/`delimiter` unescaping, found while sanity-
checking the first successful export's actual CSV content)**: the
device's own `reports.line_break` field value is the *literal
4-character descriptor* `\r\n` (backslash, 'r', backslash, 'n'), not
real CR/LF control bytes — confirmed by inspecting `charCodeAt()` on
the fetched value (`[92,114,92,110]`, i.e. `\`,`r`,`\`,`n`). Directly
concatenating it produced CSV text containing a visible literal
`\r\n` sequence instead of an actual line break between the header and
first data row. **Fix**: added `unescapeCStyle()` (a small
backslash-escape decoder for `\r`/`\n`/`\t`/`\\`), applied to both
`lineBreak` and `delimiter` when mapping `ReportDefinition` in
`listReports()`.

**Bug 5 (duplicate id column, found while testing the "Users" report
specifically)**: the "Users" report's own `object_field_report_columns`
entries already include `users.id` as their own first entry (matching
the original 88-row discovery dump), unlike Access-style reports
(`access_logs`), where `id` is never one of the report's own columns —
only ever used internally as the row-identifying join key. The
originally-implemented unconditional prepend of a leading `id` column
therefore produced a genuine duplicate for the Users report (6 raw
values for a 5-column header, e.g. `"4;4;Trung Dung;;Standard;0"`).
**Fix**: `exportReportCsv()` now tracks whether the resolved columns
already include `{report.object, "id"}` and only prepends the
implicit id column when they don't.

**Verification of each fix**: after every one of the 5 fixes, the full
SDK test suite (ending at 252/252) and backend test suite (90/90) were
re-run clean before returning to live testing, matching this project's
own "confirm every fix against the full suite before re-testing live"
discipline. Two new dedicated regression tests were added specifically
to lock in the two most subtle fixes: `RP-8b` (the time-descriptor →
`>=`/`<=` conversion, asserting the exact 7-day span) and `RP-10b`
(the duplicate-id-column fix, asserting exactly 2 columns for a
report whose own columns already include `id`).

**Final outcome — zero bugs on re-run**: all 3 planned export
scenarios (Access Global default, Access Global with 2 simultaneous
filter overrides, Users with no overrides) succeeded with correctly-
shaped CSV output. This also independently confirmed spec.md's two
flagged Risks: the id-only query's response IS plain-text,
`line_break`-separated ids (not JSON) as inferred; and multiple
simultaneous filters on different objects DO combine as separate
top-level keys in the `where` object, exactly as implemented.

**Decided by:** Live gated read-only test, user-approved; every fix
was a straightforward, evidence-driven correction requiring no further
user input (matching this project's own "confirm/fix during Group 8"
established pattern, scaled to this plan's unusually large number of
genuinely novel, previously-unverified mechanisms).
**Status:** Done. Plan closed.

---
