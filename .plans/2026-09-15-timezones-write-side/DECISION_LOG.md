# Decision Log — Time Zones write side (Enroll → Time Zones): create/rename/delete + time_spans CRUD

> **Purpose:** Record every significant decision made during planning OR execution.
> Both the Planner (Claude) and Executor should add entries here.
> This file is read by Claude Code at the start of every future sprint to
> avoid revisiting closed decisions.

---

## Decisions

### 2026-09-15 — Plan created after Groups shipped; user picked Time Zones next
**Context:** User asked to continue with Time Zones right after Groups
write-side was implemented, live-verified, and committed.
**Decision:** Did a short discovery pass (read `class.js`'s `time_zones`/
`time_spans` registrations, live-captured the `time_zones` create
payload via XHR interception, opened the one existing time zone's Edit
form to check for the same `noSave` pattern already found for Groups)
before writing this plan.
**Reasoning:** Same discipline as every prior plan this session —
confirm evidence before designing, don't assume symmetry with other
objects without checking.
**Decided by:** User + Planner
**Status:** Active

### 2026-09-15 — Found: time zone id 1 ("Always Allowed") is also UI-protected, and its time-span sub-table has no Add/Remove controls
**Context:** Opened Edit on the device's only existing time zone
("Always Allowed", id 1) to check for the same `noSave` pattern
already found for Groups.
**Decision:** Confirmed `class.js`'s `time_zones` registration also has
`noSave:[1]` — Name field renders `disabled="disabled"`, same as
Groups. Additionally observed the time-span sub-table inside this
locked zone's Edit form shows no Add/Remove affordances at all — the
whole record (including its spans) appears locked, not just the Name
field. This means `time_spans`' own create/update/delete payloads
could not be safely captured via interception against this device's
only existing zone (nothing to click) — deferred to Group 8's real
disposable-zone test (spec.md Background/Risks).
**Alternatives rejected:**
- Trying to force-enable the disabled controls via direct DOM
  manipulation to still capture a payload via interception — rejected;
  even though the write itself would still be safely intercepted, this
  crosses from "observe the real UI's own behavior" into "make the UI
  do something it doesn't normally allow," which isn't necessary here
  since Group 8's real-disposable-zone approach gets the same evidence
  cleanly and non-destructively.
**Decided by:** Planner
**Status:** Active

### 2026-09-15 — Incidental discovery: `holidays` object schema (out of scope for this plan)
**Context:** While reading `class.js` for the `time_zones`/`time_spans`
registrations, the adjacent `holidays` `CID.createClass` registration
was also visible.
**Decision:** Recorded the schema for future reference, not acted on:
`object:"holidays"`, fields `id` (PK), `name`, `start` (date, defaults
to today for a new record), `hol1`/`hol2`/`hol3` (booleans -- which
holiday categories this date belongs to), `repeats` (boolean -- yearly
recurrence), `end` (computed only, `start + 86399` -- always exactly
one day, never independently stored or settable).
**Reasoning:** Not this plan's scope (see spec.md Out of scope); saving
the evidence now avoids a second discovery pass when Holidays is
eventually planned.
**Decided by:** Planner
**Status:** Active

### 2026-09-15 — Group 8 live test found: the device requires `time_spans`' boolean fields as 0/1 integers, not JSON booleans, on write
**Context:** During Task 8.2's gated live write test, `POST
/timezones/:id/spans` returned a genuine `400` from the real device on
the very first real (non-intercepted) attempt.
**Decision:** Diagnosed by replaying the exact `create_objects.fcgi`
payload directly via `curl` (bypassing the backend) to see the
device's own raw error, since our backend's own error mapping doesn't
forward the device's error detail:
`{"error":"Invalid member 'sun' (int expected, got boolean)","code":1}`.
Fixed `buildTimeSpanCreateBody`/`buildTimeSpanUpdateBody`
(`src/ObjectQuery.cpp`) to encode every `sun`..`hol3` field as a plain
0/1 integer via a new `boolToDeviceInt()` helper, instead of a JSON
`true`/`false`. Updated `test/test_timezones.cpp`'s Z-5/Z-6
expectations to match. Re-verified live after the fix: create/update
both succeeded.
**Reasoning:** This is the exact class of gap Group 8's live test
exists to catch — `buildTimeSpanCreateBody`/`UpdateBody` were built
by symmetry with the confirmed shape pattern (join/fields/where/order)
but the *value encoding* for this object's specific boolean fields had
never been independently confirmed, and turned out to differ from a
plain C++ `bool`'s natural JSON serialization. Notably, this is
asymmetric with the *read* side, which already correctly returns (and
this SDK already correctly parses, via `requireBoolLikeField`) these
same fields as 0/1 integers — the write side simply hadn't been tested
against the real device before now to confirm it required the same
encoding back.
**Alternatives rejected:** None — this was a straightforward bug fix
once diagnosed, not a design decision with real alternatives.
**Decided by:** Planner (bug found and fixed during Group 8, not a
pre-planned design choice)
**Status:** Active

### 2026-09-15 — Group 8 also found and fixed a frontend duplicate-span-form bug
**Context:** After the first (fixed) Save of a new time zone in
`frontend/timezones.js`, the Time Spans section showed two identical
Add-span forms instead of one.
**Decision:** Root cause: the modal built `spanFormHandle` once
unconditionally at open time (for any non-protected zone, including a
brand-new one with `id === null`), then built it a second time inside
the post-save success handler once the zone actually existed. Fixed by
only building the initial `spanFormHandle` when `id !== null` — a
brand-new zone now builds its span form exactly once, at the
post-save point.
**Reasoning:** A plain code-review oversight, caught by directly
inspecting the DOM (`document.querySelectorAll('fieldset form').length`)
after clicking Save during the live test, before it could reach a
real user.
**Decided by:** Planner
**Status:** Active

---
