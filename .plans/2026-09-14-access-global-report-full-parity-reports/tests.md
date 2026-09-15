# Tests — Access (Global) report: full visual/functional parity

> **Executor instructions:** Run every test after all tasks complete.
> Group 8 (live verification) requires a fresh
> `APPROVE_LIVE_DEVICE_TEST:<plan-id>` — read-only only, no write
> tier needed for this plan. Fill in each **Result:** line as each
> test actually runs; do not pre-fill.

---

## Syntax / build gate

```bash
cmake --build build --target amico_sdk
cmake --build build --target amico_backend
node --check frontend/access-logs.js
node --check frontend/app.js
```
**Pass:** All exit 0.
**Fail:** Report to Planner before proceeding.
**Result:**
> _Fill in when run._

---

## Unit tests — SDK

### Test G-1 — `buildGroupsListBody()` exact shape
**Pass:** `{"object":"groups","fields":["id","name"]}`, no `where` key.
**Result:**
> _Fill in when run._

### Test A-1 — `buildAccessLogsListBody`/`CountBody`, all filters unset — byte-for-byte regression guard
**Setup:** Call with only `from`/`to` set (or unset), matching a
pre-change call site.
**Pass:** `where` identical to today's existing shape — no `users`/
`groups`/`time_zones` keys present at all.
**Result:**
> _Fill in when run._

### Test A-2 — `userIds` set alone
**Pass:** `where` includes `"users":{"id":[<ids>]}`; no `groups`/
`time_zones` keys.
**Result:**
> _Fill in when run._

### Test A-3 — `groupIds` set alone
**Pass:** `where` includes `"groups":{"id":[<ids>]}` only.
**Result:**
> _Fill in when run._

### Test A-4 — `timeZoneIds` set alone
**Pass:** `where` includes `"time_zones":{"id":[<ids>]}` only.
**Result:**
> _Fill in when run._

### Test A-5 — All three + `from`/`to` combined
**Pass:** `where` has all four keys (`access_logs`, `users`, `groups`,
`time_zones`) each populated correctly, matching spec.md Decision 2's
shape exactly.
**Result:**
> _Fill in when run._

---

## Backend route tests

### Test R-1 — `GET /groups` and `GET /timezones`
**Pass:** Each returns its correct `{"groups": [...]}` /
`{"timezones": [...]}` shape with correct `id`/`name` fields.
**Result:**
> _Fill in when run._

### Test R-2 — `GET /access-logs` regression (no new params)
**Pass:** Fake transport receives the exact pre-existing `where`
shape — no new keys.
**Result:**
> _Fill in when run._

### Test R-3 — `GET /access-logs?userIds=...&groupIds=...&timeZoneIds=...`
**Pass:** Fake transport receives the correct nested `where` shape for
each param, individually and combined.
**Result:**
> _Fill in when run._

---

## Live verification (Group 8 — read-only, `APPROVE_LIVE_DEVICE_TEST:<plan-id>`)

### Test L-1 — Sidebar/breadcrumb/Filters panel chrome match
**Result:**
> _Fill in when run._

### Test L-2 — User filter alone narrows results correctly
**Result:**
> _Fill in when run._

### Test L-3 — Time Zone filter alone narrows results correctly
**Result:**
> _Fill in when run._

### Test L-4 — Group filter alone narrows results correctly (re-confirm, not just trust the planning-time capture)
**Result:**
> _Fill in when run._

### Test L-5 — Combined date/time + User/Group/Time Zone filter narrows correctly
**Result:**
> _Fill in when run._

### Test L-6 — All three left at "(All)" reproduces today's existing unfiltered-by-these-three result set (omitted-key assumption)
**Result:**
> _Fill in when run._

### Test L-7 — Export produces a correct CSV of the current page
**Result:**
> _Fill in when run._

### Test L-8 — Print preview hides chrome correctly
**Result:**
> _Fill in when run._
