# Spec — P1: Complete Read-Only Web UI Discovery (Users, Search/Filter/Sort/Pagination, Groups/Areas/Schedules/Reports/License/EAM, Static Write-Control Analysis)

> This plan executes **P1 and P2** of the already-approved parent spec at
> `.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/spec.md`
> (approved 2026-09-11; P0 from that spec is `COMPLETED`). This document
> does not re-litigate that approval — it is the focused execution plan for
> the next increment the user just approved ("Yes, proceed with P1").

---

## Goal

Visit every safe, read-only page/control the parent spec's P1 section
lists, and statically read (never invoke) every write control's JS handler
per P2, so that Phase 2's SDK spec can be corrected against real coverage
instead of the narrow login/dashboard/logout slice Phase 1 originally
captured.

**Done looks like:** `docs/ui-action-protocol-map.md` and
`artifacts/ui-action-map.json` exist, mapping each safe UI action
`page → control → DOM selector → JS handler → HTTP method → FastCGI
endpoint → request schema → response schema`; `docs/amico-endpoints.md` /
`docs/amico-protocol-map.md` / `artifacts/amico-endpoints.json` are updated
with the new findings; every state-changing control has a
`UI_HANDLER_CONFIRMED` (or explicitly "handler not statically resolvable")
entry; the P4 discovery gate's 13 checks are re-evaluated and their status
recorded; and no write action was ever sent to the device.

---

## Background

See the parent plan's Background section — unchanged. This plan is purely
the execution of that plan's P1/P2 items, now that the user has approved
proceeding.

---

## Design decisions

### Decision 1 — Session and credentials
- **Chosen:** Reuse the same `Admin` account and password already used in
  Phase 1 (the user's own device, same LAN, same session established via
  `POST /hidlogin.fcgi`). No new credential is required.
- **Why:** Parent spec's "Required user inputs" section anticipated this;
  nothing in the user's approval message suggests a different account.
- **Rejected alternatives:** Testing a lower-privilege account too (parent
  spec's open question) — deferred; not required for the 13-point gate,
  and the user's approval message didn't ask for it. Can be revisited in a
  later increment if desired.

### Decision 2 — One continuous browser session for P1, minimal navigation for P2
- **Chosen:** Log in once, visit each P1 page in turn (Users, Groups,
  Areas, Schedules, Reports, License, EAM/About, date/time settings),
  capturing network + a snapshot/screenshot per page; log out at the end.
  For P2, read already-fetched JS source files (the same mechanism Phase 1
  used for `login.js`/`app.js`) for write-control handlers — this does not
  require additional page visits beyond what P1 already loads, since the
  same JS bundle serves the whole SPA.
- **Why:** Matches Phase 1's proven approach; minimizes device load (Phase
  1 already observed ~1/s dashboard polling — an extended multi-page
  session should still be kept reasonably short).
- **Rejected alternatives:** A separate low-privilege-account pass in the
  same session — rejected per Decision 1.

### Decision 3 — Never click/submit a write control
- **Chosen:** For every Add/Edit/Delete/Save/Import/Restore/Firmware/
  Network/Date-time/Enrollment/Relay/License/EAM-update control
  encountered while navigating for P1, only observe its presence and (for
  P2) read its JS handler source — never click "Save," "Delete," "Restart,"
  etc.
- **Why:** Explicit, repeated instruction across both the original Phase 2
  brief and the interrupt that created this discovery gate.
- **Rejected alternatives:** None considered — this is a hard constraint,
  not a tradeoff.

---

## Scope

### In scope
- Browser MCP session: login → Users list → a user's detail view →
  exercise search/filter/sort/pagination controls on at least one listing
  page → Groups → Areas → Schedules → Reports (viewing existing
  reports/access logs, not generating new ones if that would be a write
  action) → License page → EAM/About info → date/time display → logout.
- For each page: capture network requests (method, path, request/response
  shape, status), and a snapshot/screenshot.
- Static JS reading for every write control's handler, from JS files
  already fetched during the P1 navigation (no separate requests needed).
- Writing/updating the P3 artifact set from the parent spec.
- Re-evaluating the P4 discovery gate (13 checks) and recording pass/fail/
  pending for each.

### Out of scope (explicitly excluded)
- Clicking, submitting, or otherwise invoking any write control —
  **reason:** hard constraint (Decision 3).
- Generating a new report if the UI's "Reports" page has a "Generate"
  action that would count as a write/compute-triggering action — if
  encountered, only the *existing* report list/view is inspected, and the
  generate control is treated as a P2 (static-only) item instead.
  **Reason:** consistent with Decision 3.
- Any P5 (corrected Phase 2 SDK spec) work — **reason:** that only starts
  once this plan's P4 gate re-evaluation is complete and reported back to
  the user, per the parent spec's dependency order.
- P6 (deferred write-operation testing with a disposable test identity) —
  **reason:** explicitly a separate future phase in the parent spec.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `docs/ui-action-protocol-map.md` | Create | New per-action evidence map (parent spec P3). |
| `artifacts/ui-action-map.json` | Create | Machine-readable version of the same. |
| `artifacts/live_capture/sanitized-network-events.json` | Create | Sanitized summary of this session's captured requests (no raw HAR/PCAP committed, per `docs/security-sanitization-policy.md`). |
| `docs/amico-endpoints.md` | Modify | Merge newly confirmed endpoints found on the Users/Groups/Areas/Schedules/Reports/License/EAM pages. |
| `docs/amico-protocol-map.md` | Modify | Add the `UI_HANDLER_CONFIRMED` evidence grade (already documented in the parent spec) to the legend; merge new platform notes if any. |
| `artifacts/amico-endpoints.json` | Modify | Same merge, machine-readable form. |
| `captures/screenshots/*.png` | Create | New screenshots for each visited page (following Phase 1's naming convention). |
| `.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/spec.md` | Modify | Update the P4 gate checklist's per-item status after this pass (the parent plan is `COMPLETED` but its spec.md is a living evidence-status record, not code — updating it is documentation, not a workflow-state change). |

---

## Risks and unknowns

- The device's "Reports" page may have a report-generation action that
  looks read-only but actually triggers server-side computation/logging —
  will be treated conservatively as a potential write action and not
  invoked without first reading its JS handler statically.
- Some pages may reveal additional sensitive fields beyond the already-
  known `users.password`/`users.salt` — if found, they will be redacted
  the same way, per `docs/security-sanitization-policy.md`, before
  anything is written to a tracked file.
- Session/polling load: keeping the session reasonably short and logging
  out promptly avoids leaving the ~1/s dashboard-style polling running
  longer than needed.

---

## Open questions

- [x] Credentials/account to use → Decision 1 (reuse `Admin`).
- [ ] Whether to also test a lower-privilege account — deferred, not
      blocking this pass.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 10/10 | Goal names the exact artifacts and the "no write action" invariant. |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 4 out-of-scope items. |
| **Surgical Changes** | Every file listed with change type and exact reason | 10/10 | Full table above. |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 10/10 | Traces to the parent spec's P1–P4 items directly. |

**Total: 40/40 → 10/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — "Yes, proceed with P1" (chat message)
**Confirmed on:** 2026-09-11
