# Sprint Summary — P1: Read-Only Web UI Discovery Pass

**Plan:** `.plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-`
**Date:** 2026-09-11
**Write actions sent to the device:** 0

## What was done

A second live browser session (re-login with the Phase 1 `Admin`
credential) visited the dedicated Users, Groups, Time Zones (Schedules),
and Reports pages — none of which the Phase 1 dashboard-only pass had
reached — plus the Settings page, where a single 477KB JS file
(`configurations.js`) was fetched and statically read (never executed
beyond normal page load) for every write-control handler.

## Key findings

1. **Real Users-page contract confirmed**: default filter
   (`user_type_id = 0 OR user_type_id IS NULL`), search (`LIKE '%...%'`),
   pagination (`limit`/`offset`, separate `COUNT(*)` query), all through
   `load_objects.fcgi`.
2. **Two new sensitive fields found**: `panic_password`, `panic_salt` —
   surfaced because omitting `fields` from a query returns the entire row.
3. **Biometric data exposure confirmed**: `object:"face_templates"`
   returns a base64 face template in a plain list-page query.
4. **The real command surface is ~78 operations**, not a dozen — every
   Settings capability dispatches through one function,
   `MessengerUtil.send(command) -> POST /<command>.fcgi`. Full list
   extracted and saved.
5. **`where` shape is inconsistent across objects** — `reports`/
   `report_filters` use a nested-object shape, everything else uses an
   array of clause objects.
6. Groups, Time Zones/Time Spans (Schedules), Reports/Report Filters
   objects all confirmed with exact field lists.
7. Cookie `HttpOnly` question resolved structurally: the session cookie is
   JS-created (`document.cookie = ...`), which by browser design cannot
   carry `HttpOnly`.

## Files created/modified

- `docs/ui-action-protocol-map.md` (new)
- `artifacts/ui-action-map.json` (new)
- `artifacts/live_capture/sanitized-network-events.json` (new)
- `artifacts/live_capture/messenger_commands.json` (new)
- `artifacts/live_capture/configurations_js.network-response` (new, raw evidence)
- `docs/amico-endpoints.md` (modified — 8 new rows, updated legend)
- `docs/amico-protocol-map.md` (modified — 5 new security-note items, `UI_HANDLER_CONFIRMED` added to legend)
- `artifacts/amico-endpoints.json` (modified — 8 new endpoint entries, updated summary counts)
- `.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/spec.md` (modified — P4 gate re-evaluated, verdict: PASS with 2 accepted partials + 1 accepted gap)
- `captures/screenshots/p1_04_*.png` through `p1_11_*.png` (8 new screenshots)

## Test results

All of `tests.md`'s V-1 through V-4 and R-1 pass. No write control was
ever clicked or submitted (verified against the sanitized event log's
method/path list). Secret scan clean on every new artifact.

## Gaps carried forward (documented, not blocking)

- Enroll page (Face/Card enrollment handlers) not visited.
- No dedicated Areas/Portals management page located.
- License Mode / Date-and-Time settings tiles' own panels not cleanly
  captured (a stuck modal overlay interfered; not retried to keep the
  session short — the underlying data is already covered via
  `system_information.fcgi`).
- Report "Export" button handler not statically read.

None of these block scoping a corrected Phase 2 SDK spec to
login/session/system-info/users/access-logs/logout, which was never going
to include sort-by-column, Areas/Enroll pages, or write operations.

## Decisions

No new decisions beyond what's in `spec.md` — execution matched the plan.

## What's next

P4 gate verdict: PASS. Per the parent spec's dependency order, **P5**
(rewrite the Phase 2 SDK spec against this fuller evidence base) is next,
but per the same harness discipline followed throughout this session, it
requires its own explicit user approval before a new spec is written and
before any Executor/tasks.md work resumes on the C++ SDK itself.
