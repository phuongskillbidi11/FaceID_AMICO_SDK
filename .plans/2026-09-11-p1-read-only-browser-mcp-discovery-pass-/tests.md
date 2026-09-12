# Tests — P1: Read-Only Web UI Discovery Pass

---

## Build gate

Not applicable — no source code changes in this plan.

---

## Verification tests

### Test V-1 — Session lifecycle still holds after a longer multi-page session
```
Manual: confirm session_is_valid.fcgi true after login, false after logout,
across a session that visited more pages than Phase 1's original pass.
```
**Result:** [x] Pass / [ ] Fail

### Test V-2 — No write action was ever sent
```bash
grep -oE '"(method|url|path)"\s*:\s*"[^"]*"' artifacts/live_capture/sanitized-network-events.json | sort -u
```
**Pass:** Manually cross-check the resulting list against the prohibited
control list — no Add/Edit/Delete/Save/Import/Restore/Firmware/Network/
Date-time-update/Enrollment/Relay/License/EAM-update endpoint appears with
a write-shaped method (POST/PUT/DELETE) tied to an actual mutation (as
opposed to a read query that happens to use POST, like `load_objects.fcgi`
— already established in Phase 1 as read-only despite being a POST).
**Result:** [x] Pass / [ ] Fail

### Test V-3 — New artifacts parse and contain no real secrets
```bash
python -c "import json; json.load(open('artifacts/ui-action-map.json', encoding='utf-8')); print('ok')"
python -c "import json; json.load(open('artifacts/live_capture/sanitized-network-events.json', encoding='utf-8')); print('ok')"
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build/'
```
**Pass:** Both `json.load` calls print `ok`; both grep commands print nothing.
**Result:** [x] Pass / [ ] Fail

### Test V-4 — Existing evidence not weakened
```bash
grep -c "LIVE_CONFIRMED" docs/amico-endpoints.md
```
**Pass:** Count is >= the count before this pass (Phase 1 baseline —
merging new findings must only add rows, not remove/downgrade existing
ones).
**Result:** [x] Pass / [ ] Fail

---

## Regression tests

### Test R-1 — Blocked/completed prior plans untouched
```bash
git status --porcelain .plans/2026-09-11-implement-phase-2-production-oriented-re/
```
**Pass:** No output (that plan directory is not touched by this one).
**Result:** [x] Pass / [ ] Fail

---

## Sign-off

- [x] All verification tests: ✅
- [x] All regression tests: ✅
- [x] Sprint summary written

**Sign-off date:** 2026-09-11
