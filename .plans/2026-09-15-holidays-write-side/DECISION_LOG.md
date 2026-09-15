# Decision Log — Holidays write side

---

## 2026-09-15 — Plan created

**Context:** User asked to continue with Holidays right after the Time
Zones write-side plan shipped and was committed (`85b59f7`). Per
`docs/api-roadmap.md`'s own "Suggested next discovery pass" table
(updated at the end of the Time Zones plan), Holidays was the
recommended next item, with its schema already pre-recorded from an
incidental `class.js` read during Time Zones discovery.

**Decision:** Write a full new plan (`2026-09-15-holidays-write-side`)
following the same discovery → spec → tasks structure as Groups and
Time Zones.

**Decided by:** User request ("commit lại rồi làm tiếp Holidays").
**Status:** Done.

---

## 2026-09-15 — No `noSave` protection on `holidays`

**Context:** Groups and Time Zones both have a `noSave:[1]`-protected
default record (id 1) that the real device's own UI locks down (Name
field disabled, no Remove). Before assuming symmetry, re-checked
`holidays`' own `CID.createClass` registration in `class.js`.

**Decision:** No protected-id handling needed for `holidays` — every
record (once any exist) gets full Edit/Remove in both the real
device's UI and this SDK.

**Reasoning:** `class.js` shows no `noSave` key on the `holidays`
registration, and the live list is currently empty (`{"holidays":[]}`)
— nothing pre-seeded to protect in the first place.

**Alternatives rejected:** Defensively adding a protected-id mechanism
anyway "just in case" — rejected as speculative; this project's
established practice is to implement only what's evidenced (Simplicity
First principle), and there is no evidence any `holidays` record is
protected.

**Decided by:** Live `class.js` read + live list read.
**Status:** Confirmed, applied in spec.md Scope.

---

## 2026-09-15 — Proactive boolean-as-integer fix for `holidays` (no need to rediscover the bug)

**Context:** During Time Zones' own Group 8, the device was found to
reject JSON `true`/`false` for `time_spans`' `sun`..`hol3` fields,
requiring plain `0`/`1` integers instead
(`{"error":"Invalid member 'sun' (int expected, got boolean)","code":1}`).
When live-capturing `holidays`' own create payload during this plan's
discovery pass, the same pattern showed up directly:
`"hol1":1,"hol2":1,"hol3":1,"repeats":1` — integers, not booleans.

**Decision:** Apply the existing `boolToDeviceInt()` helper (added in
`src/ObjectQuery.cpp` during the Time Zones plan) to `holidays`' own
create/update builders from the start, rather than shipping with real
JSON booleans and waiting to hit the identical `400` live during this
plan's own Group 8.

**Reasoning:** This is independently confirmed evidence for `holidays`
itself, not an inference borrowed from `time_spans`. Both objects now
agree the device's generic object-write layer expects boolean-ish
fields as 0/1 integers uniformly. Fixing it proactively avoids
repeating a already-understood failure mode and burning a Group 8
retry-budget slot on a known issue.

**Alternatives rejected:** Waiting for Group 8 to hit the error again
before fixing — rejected as pointless given direct evidence already in
hand.

**Decided by:** Live XHR-interceptor capture of the `holidays` create
payload (spec.md Background).
**Status:** Applied in spec.md Decision 2; to be implemented in Group
2 (query builders) and verified end-to-end in Group 7 (manual live
verification).

---

## 2026-09-15 — `end` is computed internally, never a caller-settable field

**Context:** The live-captured create payload includes
`"end":1789516799`, which is exactly `start (1789430400) + 86399`. The
real device's own Add/Edit Holiday form has no End control at all —
`end` is derived, presentation-only data computed by `class.js`'s own
`afterGet`/`beforeSave` hooks.

**Decision:** `NewHoliday`/`HolidayUpdate` have no `end` member. The
SDK's own query builders always compute `end = start + 86399`
internally before building the create/update body, matching the
device's own behavior exactly. `Holiday` (the read-side view type)
does include `end`, since the device does report it on read and it's
useful to display.

**Reasoning:** Exposing `end` as a settable field would let a caller
construct a request the real device's own UI could never produce
(inconsistent start/end), with no evidence the device even validates
such a mismatch. Computing it internally keeps the SDK's surface
matching observed reality exactly (Surgical Changes principle).

**Alternatives rejected:** Exposing `end` as an optional override on
`NewHoliday`/`HolidayUpdate` — rejected as unevidenced speculation.

**Decided by:** Live-captured create payload + real device form
inspection (spec.md Background/Decision 1).
**Status:** Applied in spec.md Decision 1; to be implemented in Group
1 (types) and Group 2 (query builders).

---

## 2026-09-15 — Group 7 live verification: both unconfirmed shapes hold, zero bugs found

**Context:** `buildHolidayUpdateBody`/`buildHolidayDeleteBody` were
built by symmetry with `buildGroupUpdateBody`/`buildGroupDeleteBody`
(spec.md Risks) but never independently live-captured for `holidays`
itself, unlike the create shape.

**Decision:** Ran the full gated live test (approved via
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-holidays-write-side`):
created, updated, then deleted one disposable "ZZ_HolidayTest" record
through our own frontend, cross-checking the real device's own native
Holidays page after every step.

**Outcome:** All three operations succeeded on the first attempt, with
zero bugs found (unlike the Time Zones plan's own Group 8, which found
two real bugs). `PATCH /holidays/:id` and `DELETE /holidays/:id` are
now `LIVE_CONFIRMED`, not just inferred by symmetry. The proactive
boolean-as-integer fix (Decision 2 above) worked correctly on the
first live write -- no `400 "int expected, got boolean"` error, unlike
Time Zones where the same class of fix had to be discovered reactively.

**Decided by:** Live gated write test, user-approved.
**Status:** Done. Plan closed.
