# Tests — Giai đoạn 1b: Hoàn thiện discovery còn thiếu

> **Executor instructions:** Run every test in this file after ALL tasks are complete.
> Group 2's tests are conditional on live-device approval being granted this
> cycle — see each test's own note. A conditional "Not run this cycle" does
> not block sign-off for Group 1/3.

---

## Build gate

**N/A this plan.** No SDK C++ source is created or modified (spec.md's
explicit out-of-scope) — this is a documentation/discovery plan only.

---

## Functional tests

### Test F-1 — Groundwork analysis produced a concrete known/unknown list
```bash
grep -n "Task 1.1" -A5 tasks.md
```
**Pass:** Task 1.1's Status note lists concrete known-vs-unknown findings
for each of the 5 gaps, not a placeholder.
**Fail:** Note is empty or generic.
**Result:** [x] Pass

---

### Test F-2 — Enroll page evidence captured (conditional on Group 2 approval)
```bash
ls captures/screenshots/p1b_01_users_enroll_entry.png
ls artifacts/live_capture/newusers_js.network-response
grep -c "Enroll" docs/ui-action-protocol-map.md
```
(Filenames corrected from the plan's original guess — there is no
standalone "Enroll" page/URL, so the artifact is `newusers.js`, the
script behind the Users page's own enrollment modal; see Task 2.1's
Status note.)
**Pass (if Group 2 ran):** All three exist/print ≥1.
**Not applicable (if Group 2 did not run):** Record "Not run this cycle —
no live-device approval issued".
**Fail:** Group 2 ran but any of the three is missing.
**Result:** [x] Pass

---

### Test F-3 — Areas/Portals finding recorded, either way
```bash
grep -c "Areas" docs/ui-action-protocol-map.md
grep -c "Portals" docs/ui-action-protocol-map.md
```
**Pass (if Group 2 ran):** Either a confirmed page+request shape, or an
explicit "no dedicated page found" note, is present.
**Not applicable:** "Not run this cycle" if Group 2 didn't run.
**Fail:** Group 2 ran but nothing was recorded either way.
**Result:** [x] Pass — confirmed-absent finding recorded (no such page
exists), with supporting evidence (`class/area.js`/`class/portal.js`,
rule-table object names).

---

### Test F-4 — License Mode panel finding recorded
```bash
grep -c "License Mode" docs/ui-action-protocol-map.md
ls captures/screenshots/p1b_03_license_mode.png
```
**Pass (if Group 2 ran):** Screenshot exists; doc section states either
a captured request or a confirmed "no new request" finding — not silence.
**Not applicable:** "Not run this cycle" if Group 2 didn't run.
**Fail:** Group 2 ran, same stuck-modal issue recurred, and it was
**not** explicitly flagged as a still-open gap in Task 3.2's update.
**Result:** [x] Pass — no stuck modal this cycle; new
`get_configuration.fcgi {"sec_box":["catra_role"]}` request captured.

---

### Test F-5 — Date and Time panel finding recorded
```bash
grep -c "Date and Time\|Date/Time" docs/ui-action-protocol-map.md
ls captures/screenshots/p1b_04_date_time.png
```
**Pass (if Group 2 ran):** Same bar as F-4.
**Not applicable:** "Not run this cycle" if Group 2 didn't run.
**Fail:** Same bar as F-4.
**Result:** [x] Pass — no stuck modal; `get_ntp_server.fcgi` + 2×
`get_configuration.fcgi` reads captured.

---

### Test F-6 — Report Export finding recorded, no raw sensitive file committed
```bash
grep -c "Report Export\|Export" docs/ui-action-protocol-map.md
find . -maxdepth 3 -newer .git/HEAD -iname "*.csv" -o -newer .git/HEAD -iname "*export*.txt" 2>/dev/null | grep -v '\.git/'
```
**Pass (if Group 2 ran):** Finding recorded in the doc; second command
prints nothing (no raw export file left in the repo).
**Not applicable:** "Not run this cycle" if Group 2 didn't run.
**Fail:** Second command finds a raw export file, or no finding recorded.
**Result:** [x] Pass — `report_generate.fcgi` request shape recorded (2
calls, id-only then full-row); no `.csv`/export text file found anywhere
in the repo (confirmed via `find . -iname "*.csv" -o -iname "*export*.txt"`).

---

### Test F-7 — Post-logout session invalid (conditional on Group 2)
**Pass (if Group 2 ran):** Task 2.6's observed result was
`session_is_valid: false`.
**Not applicable:** "Not run this cycle" if Group 2 didn't run.
**Fail:** Session still valid after logout.
**Result:** [x] Pass — `{"session_is_valid":false}` confirmed via
in-page `fetch()`.

---

### Test F-8 — Gaps section accurately updated
```bash
grep -n -A20 "Gaps not resolved this pass" docs/ui-action-protocol-map.md
```
**Pass:** Section content matches Group 2's actual outcomes (read
manually — no gap claimed closed without evidence, no still-open gap
silently dropped).
**Fail:** Mismatch between section content and Group 2's actual findings.
**Result:** [x] Pass — reviewed manually; matches Group 2's actual
findings exactly (4 items resolved with cross-references, Sort-by-column
left unchanged, new "New gaps opened this pass" subsection added).

---

## Regression tests (ensure nothing broke)

### Test R-1 — No SDK source or unrelated doc file was touched
```bash
git diff --stat -- '*.cpp' '*.hpp' 'CMakeLists.txt' 'vcpkg.json'
git diff --stat -- 'docs/amico-protocol-map.md' 'docs/amico-endpoints.md' 'docs/sdk-usage.md' 'docs/src-map.md'
```
**Pass:** Both commands produce empty output — this plan only touches
`docs/ui-action-protocol-map.md`, `artifacts/live_capture/*` (new files),
and `captures/screenshots/*` (new files).
**Fail:** Any diff shown.
**Result:** [x] Pass — both commands produced empty output.

---

### Test R-2 — Secret scan clean
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.network-response' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
```
**Pass:** No output, or only the already-documented benign false positive.
**Fail:** Any other match.
**Result:** [x] Pass — both scans produced empty output.

---

## Sprint sign-off

- [x] Build gate: N/A (documented above)
- [x] Functional tests F-1, F-8: ✅
- [x] Functional tests F-2–F-7: ✅ (all ran this cycle, none deferred)
- [x] All regression tests: ✅
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written, explicitly stating whether Group 2 ran

**Sign-off date:** 2026-09-12
