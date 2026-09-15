# Tests — Redesign Access Logs to match the real device's "Access (Global)" report

> **Executor instructions:** Run every test after all tasks complete.
> Group 5 (live) is entirely read-only — no gated write approval
> applies to this plan. Fill in each **Result:** line as each test
> actually runs; do not pre-fill.

---

## Syntax / build gate

```bash
cmake --build build --target amico_sdk
cmake --build build --target amico_backend
node --check frontend/access-logs.js
```
**Pass:** All exit 0.
**Fail:** Report to Planner before proceeding.
**Result:**
> PASS: all three exit 0 (re-run repeatedly throughout implementation,
> most recently after Group 4).

---

## Unit tests — SDK query builders (`test/test_query_whitelist.cpp`)

### Test Q-1 — `kAccessLogFields` includes `identifier_id`
```bash
grep -n '"identifier_id"' src/ObjectQuery.cpp
```
**Pass:** Present in `kAccessLogFields`.
**Fail:** Missing.
**Result:**
> PASS: present in `kAccessLogFields` (`src/ObjectQuery.cpp`); also
> asserted as its own doctest case ("Q-1: kAccessLogFields includes
> identifier_id" in `test_query_whitelist.cpp`).

---

### Test Q-2 — Chained `from`+`to` where-clause shape (values, not just length)
**Setup:** Call `buildAccessLogsListBody(1700000000, 1700005000, 10, 0)`
(distinct `from`/`to` values, deliberately chosen so a swapped
argument order would produce a detectably wrong result).
**Pass:** The resulting `where` is a 2-element array, and — critically
— checks the **content** of each clause, not just its length (this is
the direct regression test for Plan Review Finding 2's same-type
positional-argument hazard):
```cpp
REQUIRE(logsBody["where"].size() == 2);
CHECK(logsBody["where"][0]["field"] == "time");
CHECK(logsBody["where"][0]["operator"] == ">=");
CHECK(logsBody["where"][0]["value"] == 1700000000);
CHECK(logsBody["where"][1]["field"] == "time");
CHECK(logsBody["where"][1]["operator"] == "<=");
CHECK(logsBody["where"][1]["value"] == 1700005000);
CHECK(logsBody["where"][0].contains("connector") == false);
CHECK(logsBody["where"][1].contains("connector") == false);
```
**Fail:** Either clause has the wrong operator/value (this is exactly
what a `from`/`to` argument swap would produce — the two values would
be present but attached to the wrong operator), or an unnecessary
`connector` field is added.
**Result:**
> PASS: implemented verbatim as "Q-2: chained from+to where-clause
> shape checks values, not just length" in `test_query_whitelist.cpp`;
> all assertions pass.

---

### Test Q-3 — `from`-only and `to`-only cases still work
**Setup:** `buildAccessLogsListBody(1700000000, std::nullopt, 10, 0)`
(from-only), then `buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0)`
(to-only — this is exactly `test_query_whitelist.cpp`'s existing
"scenario 19" call after Task 1.2's call-site update).
**Pass:** From-only produces a single-element array with
`{"field":"time","operator":">=","value":1700000000}`; to-only
produces a single-element array with
`{"field":"time","operator":"<=","value":1700000000}`; neither has a
`connector` key.
**Fail:** Either case produces a malformed or 2-element array, or the
wrong operator for its position.
**Result:**
> PASS: implemented as "Q-3: from-only and to-only cases still
> produce a single correctly-shaped clause"; both cases pass. The
> pre-existing "scenario 19" test itself also still passes unchanged
> (to-only call, `where.size() == 1`, no `connector` key).

---

### Test Q-4 — `buildAccessLogsCountBody` mirrors the list query's `where`
**Setup:** Call with the same `from`/`to` as a Test Q-2/Q-3 case.
**Pass:** `fields == ["COUNT(*)"]`, `where` identical in shape/values
to the corresponding list-body test, no `order`/`limit`/`offset`/
`finish` keys present.
**Fail:** Any mismatch.
**Result:**
> PASS: `countBody["where"] == listBody["where"]` asserted directly
> (byte-for-byte JSON equality), plus the absent-keys checks — all
> pass.

---

### Test Q-5 — `buildPortalsListBody` / `buildTimeZonesListBody`
**Pass:** Each returns `{"object": "portals"|"time_zones", "fields": ["id","name"]}`
with no `where`/pagination keys.
**Fail:** Any extra/missing key.
**Result:**
> PASS: both builders match exactly, no extra keys present.

---

### Test Q-6 — `buildUsersByIdsBody`
**Setup:** Call with `[36, 5]`.
**Pass:** `object == "users"`, `fields` includes `id`/`name`/
`registration`, `where` uses the confirmed `{"users":{"id":[36,5]}}`
array-of-ids shape (matching `buildUserDeleteBody`'s existing
pattern), not an invented `operator:"IN"` shape unless that was
separately confirmed against `docs/` first.
**Fail:** Wrong `where` shape.
**Result:**
> PASS: exact array-of-ids shape confirmed, matching the existing
> `buildUserDeleteBody` convention.

---

### Test Q-7 — `buildAccessLogAccessRulesBody` / `buildAccessRuleTimeZonesBody` (added for spec.md Decision 2b)
**Setup:** Call `buildAccessLogAccessRulesBody({220, 219})` and
`buildAccessRuleTimeZonesBody({1})`.
**Pass:** First: `object == "access_log_access_rules"`, `fields ==
["access_log_id", "access_rule_id"]`, `where == {"access_log_access_rules":{"access_log_id":[220,219]}}`.
Second: `object == "access_rule_time_zones"`, `fields ==
["access_rule_id", "time_zone_id"]`, `where ==
{"access_rule_time_zones":{"access_rule_id":[1]}}`. Both use the same
confirmed array-of-ids `where` shape as Test Q-6, no invented operator.
**Fail:** Wrong object/fields/where shape.
**Result:**
> PASS: both builders match exactly.

---

## Unit tests — Label logic (`test/test_access_logs.cpp`)

### Test L-1 — `authorizationLabel` covers every literal case
```cpp
CHECK(authorizationLabel(7) == "Granted");
CHECK(authorizationLabel(10) == "Granted");
CHECK(authorizationLabel(11) == "Granted");
CHECK(authorizationLabel(12) == "Granted");
CHECK(authorizationLabel(15) == "Granted");
CHECK(authorizationLabel(6) == "Not authorized");
CHECK(authorizationLabel(3) == "Not recognized");
CHECK(authorizationLabel(999) == "Not recognized");  // default case
```
**Pass:** All assertions pass — exactly matches `report.js`'s
`case 'accessevent'` switch (verified live this session, saved to
`artifacts/live_capture/report_class.js` lines ~992-1012).
**Fail:** Any mismatch.
**Result:**
> PASS: all 8 assertions pass. Additionally live-confirmed this
> session against the real device (Test V-1): "Granted" and "Not
> authorized" and "Not recognized" all observed on real rows.

---

### Test L-2 — `identificationLabel` covers every tag family + the numerically-verified real value
```cpp
CHECK(identificationLabel(1717658368) == "Facial");  // LIVE-CAPTURED real value this session
CHECK(identificationLabel(packIdentifierTag("fac", 0)) == "Facial");
CHECK(identificationLabel(packIdentifierTag("win", 0)) == "Card");
CHECK(identificationLabel(packIdentifierTag("mag", 0)) == "Card");
CHECK(identificationLabel(packIdentifierTag("rfi", 0)) == "Card");
CHECK(identificationLabel(packIdentifierTag("mif", 0)) == "Card");
CHECK(identificationLabel(packIdentifierTag("gui", 1)) == "PIN");
CHECK(identificationLabel(packIdentifierTag("gui", 0)) == "Password");
CHECK(identificationLabel(packIdentifierTag("qrc", 0)) == "QR Code");
CHECK(identificationLabel(packIdentifierTag("bio", 0)) == "Biometry");
CHECK(identificationLabel(packIdentifierTag("rex", 0)) == "REX button");
CHECK(identificationLabel(packIdentifierTag("web", 0)) == "Web Interface");
CHECK(identificationLabel(packIdentifierTag("int", 0)) == "Intercom");
```
**Pass:** All assertions pass. The first assertion
(`1717658368 == "Facial"`) is the direct numerical proof this
session's discovery is correct — `1717658368` was captured live from
the real device's own `report_generate.fcgi` response (reqid 4019),
and independently equals `getIdentifierId("face", 0)` computed by
hand during this session's discovery pass.
**Fail:** Any mismatch.
**Result:**
> PASS: all 13 assertions pass. **Additionally, and unexpectedly,
> confirmed live** (Test V-1): the real device produced a genuine
> "Web Interface" row this session (a real event, not seeded/synthetic)
> — the very first live case beyond "Facial" this codebase has ever
> observed — and `identificationLabel` classified it correctly,
> validating the ported logic generalizes beyond the one hand-verified
> tag.

---

### Test L-3 — `identificationLabel` default case (no tag matches)
```cpp
CHECK(identificationLabel(0) == "Unknown");
```
**Pass:** Returns `"Unknown"` (or whatever literal Task 1.4 settles
on) rather than crashing or returning an empty string.
**Fail:** Crash, empty string, or an incorrect label.
**Result:**
> PASS: returns `"Unknown"` exactly.
**Note (T-5, referenced from tasks.md):** `report.js`'s own switch has
no final `else`/default branch inside `case 'identification'` — an
unmatched value falls through to `break;` and the caller's generic
`default: return value;` (i.e., the real device shows the **raw
number** for a truly unrecognized tag, not a friendly string). Our
ported C++ deliberately returns `"Unknown"` instead of the raw number
because: (a) no such value has ever been observed live on this
device (every row is `"face"`-tagged), so this is an unreachable
path today, not a confirmed behavior to replicate exactly; (b)
leaking a raw packed integer into a frontend table cell would be a
worse regression than a clearly-labeled "Unknown" placeholder. This
is a deliberate, documented deviation from pixel-perfect device
parity for an unreachable edge case — not a guess about a reachable
one.

---

### Test L-4 — `timeZoneNamesForAccessLogIds`'s 2-hop join composition (added for spec.md Decision 2b)
**Setup:** Fake transport (`setTransportForTesting`) seeded so that:
access_log id 220 → access_rule 1 (via `access_log_access_rules`) →
time_zone 1, name "Always Allowed" (via `access_rule_time_zones` +
`time_zones`); access_log id 999 has **no** row in
`access_log_access_rules` at all (simulates a row with no matching
access rule).
**Pass:** `timeZoneNamesForAccessLogIds({220, 999})` returns a map
containing `{220: "Always Allowed"}` — id `999` is **absent** from the
returned map (not present with an empty string; the backend layer is
responsible for turning "absent" into `""` when building the JSON
response, per Task 2.2).
**Fail:** id `999` present with a wrong value, or id `220` missing/
wrong.
**Result:**
> PASS: `result.size() == 1`, `result.at(220) == "Always Allowed"`,
> `result.find(999) == result.end()` — all confirmed.

---

### Test L-5 — `timeZoneNamesForAccessLogIds`'s tie-break rule (first row wins)
**Setup:** Fake transport seeded so access_log id 220 has **two** rows
in `access_log_access_rules` (access_rule 1 and access_rule 2, in that
order), and access_rule 1 maps to time_zone 1 ("Always Allowed").
**Pass:** The result for id 220 is `"Always Allowed"` — the **first**
returned `access_log_access_rules` row is used, exactly matching
spec.md Decision 2b's documented, deterministic tie-break rule (not an
arbitrary/unspecified pick).
**Fail:** Any other value, a crash, or non-deterministic behavior
across repeated calls.
**Result:**
> PASS: result is `"Always Allowed"`, confirming `std::map::emplace`'s
> keep-first-insert behavior correctly implements the documented
> tie-break rule.

---

## Backend route tests (`test/backend/test_routes.cpp`)

### Test R-1 — `GET /access-logs` accepts `offset`, returns `{entries, total}`
**Setup:** Fake transport seeded with N access-log rows spanning a
known time range.
**Pass:** `GET /access-logs?limit=2&offset=2` returns
`{"entries": [...2 rows, skipping the first 2...], "total": N}`.
**Fail:** Wrong rows, wrong `total`, or old bare-array shape.
**Result:**
> PASS: `body["total"] == 5`, `body["entries"].size() == 2`, response
> is a JSON object (not the old bare array).

---

### Test R-2 — Enrichment fields present and correct
**Setup:** Fake transport seeded with a row referencing a known
user/portal id, with a full `access_log_access_rules`/
`access_rule_time_zones` chain resolving to a known time zone name
(per Test L-4's setup), plus a row with `user_id = 0` and no
`access_log_access_rules` entry (unresolved time zone).
**Pass:** The known-id row's JSON includes `userName`, `employeeId`,
`portalName`, `timeZoneName` matching the seeded fixture names
(`timeZoneName` resolved via the 2-hop join, not a direct field), plus
`authorizationLabel`/`identificationLabel` matching Test L-1/L-2's
logic for that row's `event`/`identifierId`. The `user_id = 0` row has
`userName`/`employeeId`/`timeZoneName` all as empty strings, not
`null` or omitted keys (matches spec.md Decision 1's stated behavior,
extended to the time-zone join's own missing-hop case).
**Fail:** Any field missing, wrong, or the null-vs-empty-string
convention violated.
**Result:**
> PASS: resolved row has `userName == "Test User B"`,
> `employeeId == "EMP-036"`, `portalName == "Portal"`,
> `timeZoneName == "Always Allowed"`, `authorizationLabel == "Granted"`,
> `identificationLabel == "Facial"`. Unresolved row (id 209) has all
> four name fields `== ""` and `authorizationLabel == "Not recognized"`.

---

### Test R-3 — `from`+`to` narrows both `entries` and `total` consistently
**Setup:** Fake transport seeded with rows spanning a wide time range;
request with a narrow `from`/`to` window covering only a subset.
**Pass:** `entries.length <= total`, and `total` equals exactly the
count of seeded rows inside `[from, to]` — not the count of all
seeded rows (this is the direct regression test for spec.md Decision
5's fix; a naive implementation that forgot to also send `from` to the
count query would fail this test by returning the full unfiltered
total).
**Fail:** `total` includes rows outside `[from, to]`.
**Result:**
> PASS: `body["total"] == 1`, `body["entries"].size() == 1` for the
> narrowed window (out of 2 seeded rows) — confirmed the list query
> itself also received both `from`/`to` where-clauses (asserted inline
> in the test responder).

---

## Regression tests

### Test G-1 — Existing SDK/backend suites unaffected outside access-logs scope
```bash
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** Same pass/fail counts as the last known-good baseline for
every suite/test **not** touched by this plan (Users/Groups/Cards/PIN/
Image tests all still pass unchanged); only access-logs-related test
counts should differ (new tests added).
**Fail:** Any unrelated test regresses.
**Result:**
> PASS (run via `./build/amico_tests.exe` / `./build/amico_backend_tests.exe`,
> equivalent to `build-exec/`): SDK suite 108/108 passed (95 baseline
> + 13 new: Q-1 through Q-7 = 7, L-1 through L-5 = 5, plus 1
> `identifierId` mapping test = 13). Backend suite 43/43 passed (41
> baseline − 1 old access-logs test replaced + 3 new R-1/R-2/R-3 = 43).
> All Users/Groups/Cards/PIN/Image tests unaffected. Along the way,
> found and fixed 4 pre-existing failures the SDK changes had silently
> introduced (missing `identifier_id` in a fixture; one test asserting
> now-removed client-side `from`-filtering behavior) — recorded in
> DECISION_LOG.md and tasks.md Task 4.1.

---

## Live tests (Group 5 — READ-ONLY, no gated write approval needed)

### Test V-1 — Real device data renders correctly end-to-end
**Setup:** Standard login against `http://192.168.2.156` via our own
frontend.
**Pass:** The known real row (user 36 "Phuong Hoang", event 7) renders
exactly: Authorization = "Granted", Identification = "Facial", Name
(User) = "Phuong Hoang", Name (Portal) = "Portal", Name (Time Zone) =
"Always Allowed" — directly comparable, row-for-row, against the real
device's own report page (`reportcustomview.html?report=1`) for the
same underlying data. A `user_id = 0` row shows "Not recognized" with
blank Name/Employee ID cells, not an error or `null` text.
**Fail:** Any label wrong, any join unresolved (raw ID shown instead
of a name), or a console error.
**Note:** This is the first live exercise of the 2-hop time-zone join
(spec.md Decision 2b) — the offline query-shape/tie-break tests (Q-7,
L-4, L-5) were not separately live-verified against the real device
before tasks.md was written (the session's live login had expired at
the time this task was added), so this test carries extra weight for
that specific column.
**Result:**
> PASS. Restarted `amico_backend.exe` from the freshly-built `build/`
> binary first (the running process was a stale pre-Task-2.2 build —
> would have failed with "entries.forEach is not a function" against
> the new frontend otherwise, which is exactly what was observed
> before the restart). After restart: user 36 "Phuong Hoang" rows
> render exactly as expected (Granted/Facial/Portal/Always Allowed). A
> `user_id=0` "Not recognized" row rendered with blank Name/Employee
> ID/Time Zone but a resolved Portal — exactly matching Decision 2b's
> predicted behavior for a row with no `access_log_access_rules` entry.
> A second real user, id 5 "Phat" (Employee ID "1234", non-empty
> `registration`), also rendered correctly with "Not authorized". A
> genuine "Web Interface" identification row was encountered live
> (unplanned — see Test L-2's note) and rendered correctly. No console
> errors (checked via `list_console_messages`). Screenshots:
> `artifacts/live_capture/access-logs-page1.png`,
> `access-logs-filtered.png`.

---

### Test V-2 — Pagination math matches the real total
**Setup:** Set per-page to 10 (default); note the "of Z records" total
shown by our frontend.
**Pass:** The total matches the real device's own reported total for
an equivalent unfiltered query (the real device showed "158 records"
in this session's discovery capture — our device data may have
changed since then, so compare against a **fresh** load of the real
device's own report page at test time, not the stale "158" number).
Next/Prev move between pages without duplicate or skipped `id` values
across the boundary.
**Fail:** Total mismatch, or duplicate/skipped rows across a page
boundary.
**Result:**
> PASS: total shown was "221 records" (device data has grown since the
> discovery-pass baseline of 158/221 seen at different points this
> session — expected, not a bug). Changed per-page 10→20: correctly
> reset to page 1 and rendered exactly 20 rows, "Showing 1 to 20 of
> 221". Clicked Next (10-per-page): page 2 started at "9/12/2026,
> 1:59:38 AM", immediately following page 1's last row ("9/12/2026,
> 4:38:35 AM") with no gap or overlap. Clicked Previous: returned to
> the exact original page 1 rows, byte-for-byte.

---

### Test V-3 — `from`/`to` filtering narrows both rows and total
**Setup:** Set a narrow `from`/`to` window known to contain only a few
rows (e.g. the same 1789150000–1789200000 window captured live during
discovery, which returned exactly 15 rows/count this session).
**Pass:** Both the rendered rows and the "of Z records" total reflect
only the filtered window — directly exercising the Decision 5 fix.
**Fail:** Total includes rows outside the window (the exact bug this
plan's Decision 5 exists to prevent).
**Result:**
> PASS: set `from`=1789150000, `to`=1789200000 (via `evaluate_script`
> setting the datetime-local inputs directly, then clicking Filter).
> Status line read exactly "Showing 1 to 15 of 15 records" — matching
> the exact 15-row/15-count result captured live during this plan's
> original protocol-discovery pass for the identical window. Both
> `entries` and `total` correctly narrowed together; Prev/Next both
> correctly disabled since all 15 rows fit on one page (per-page was
> 20 at the time).

---

## Sprint sign-off

- [x] Syntax/build gate
- [x] Unit tests Q-1 through Q-7
- [x] Unit tests L-1 through L-5
- [x] Backend tests R-1 through R-3
- [x] Regression test G-1
- [x] Live tests V-1 through V-3 (read-only)
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-14
