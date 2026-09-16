# Decision Log — Date and Time settings (read-only)

---

## 2026-09-16 — Plan created

**Context:** `docs/api-roadmap.md` section 9 already had the 3
relevant device calls' *request* shapes evidence-backed
(`get_configuration.fcgi` x2, `get_ntp_server.fcgi`) from an earlier
pass, but their *response* shapes were never captured, and the
write side (`set_system_time`/`set_ntp_server`) was explicitly noted
as needing its own confirm pass before ever being planned.

**Decision:** Run a small supplementary gated read-only discovery
pass to capture the 3 calls' response shapes, then write a
read-only-only plan (`2026-09-16-date-time-settings-read`),
explicitly deferring the write side to a future plan.

**Decided by:** User request (chose "Date and Time (Settings,
read-only)" via AskUserQuestion, right after the Reports plan was
pushed).
**Status:** Done.

---

## 2026-09-16 — Supplementary discovery: response shapes captured, a third boolean convention found

**Context:** `APPROVE_LIVE_DEVICE_TEST:2026-09-16-date-time-discovery`
(user-approved verbatim) was used to directly call all 3 endpoints and
capture their response bodies for the first time.

**Findings:**
- `get_configuration.fcgi {"ntp":["enabled","timezone"]}` ->
  `{"ntp":{"enabled":"0","timezone":"UTC+7"}}`.
- `get_configuration.fcgi {"general":["clock_12h_format","month_day_year_format"]}` ->
  `{"general":{"clock_12h_format":"0","month_day_year_format":"0"}}`.
- `get_ntp_server.fcgi {}` -> `{"server1":"vn.pool.ntp.org","server2":"pool.ntp.org"}`.
- **`enabled`/`clock_12h_format`/`month_day_year_format` are JSON
  *strings* `"0"`/`"1"`**, not a JSON boolean or a 0/1 integer — a
  third boolean-ish wire convention this project has now seen. This
  directly informs spec.md Decision 3 (a new `requireStringBoolField()`
  helper, not reusing the existing `requireBoolLikeField()`).
- `system_information.fcgi`'s own `time`/`daylight_savings_time_active`
  fields were re-confirmed still present and correctly typed (real
  epoch integer, real JSON boolean) in a live re-check.

**Decided by:** Live-captured evidence, directly informs spec.md
Background/Decision 2/Decision 3.
**Status:** Done.

---
