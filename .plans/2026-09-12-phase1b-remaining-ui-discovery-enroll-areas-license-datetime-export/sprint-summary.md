# Sprint Summary — Giai đoạn 1b: Hoàn thiện discovery còn thiếu

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.
>
> Paste this summary into the next planning prompt under "Previous sprint context"
> so Claude Code starts with accurate state instead of assumptions.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Giai đoạn 1b — Hoàn thiện discovery còn thiếu |
| Plan folder | `.plans/2026-09-12-phase1b-remaining-ui-discovery-enroll-areas-license-datetime-export/` |
| Start date | 2026-09-12 |
| End date | 2026-09-12 |
| Tests | F-1–F-8: all Pass. R-1/R-2: all Pass. Group 2 fully ran (not deferred). |

---

## Outcome

**Status:** [x] Complete / [ ] Partial / [ ] Abandoned

### What was built (matches tasks.md `[x]` items)
All 5 gaps from `docs/ui-action-protocol-map.md`'s "Gaps not resolved
this pass" section closed or reclassified:

- **Enroll** — resolved. No standalone page exists; enrollment lives in
  `users.html`'s own modal (`newusers.js`, fetched statically, never
  clicked). Found 7 new commands: `remote_enroll`, `cancel_remote_enroll`,
  `enroller_state`, `enroller_biometry_state`, `template_extract`,
  `template_match` (both via the previously-undocumented `sendFile`
  dispatcher), `user_fingerprint`.
- **Areas/Portals** — resolved as a **confirmed-absent** finding (not an
  open gap). No dedicated management page exists anywhere in the web UI.
- **License Mode** — resolved, `LIVE_CONFIRMED`. New request:
  `get_configuration.fcgi {"sec_box":["catra_role"]}`.
- **Date and Time** — resolved, `LIVE_CONFIRMED`. New requests:
  `get_configuration.fcgi` (ntp enabled/timezone; clock/date-format), and
  `get_ntp_server.fcgi`.
- **Report Export** — resolved, `LIVE_CONFIRMED`. Confirmed it's a real
  server-side `report_generate.fcgi` call (two-phase: id-only, then
  full-row CSV-shaped text), not a client-side-only render.

Root cause of P1's stuck-modal problem (License Mode/Date-Time) also
confirmed: it was operator sequencing (opening "About" first), not a
device or UI defect — opening either tile first, from a fresh page load,
works cleanly.

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| None from this plan's own 5-gap scope — all ran. | — | — |
| Visitors, Visits, Data Tools Import/Export, Internal Alarms, Alarm Output, Open relay/Open Door | Discovered incidentally while navigating; explicitly out of this plan's approved scope | A future discovery plan |

---

## Discoveries (not in the spec)

- **chrome-devtools-mcp initially failed to connect** (`CONNECT_TIMEOUT`)
  — resolved by restarting Claude Code (see `DECISION_LOG.md`). Worth
  remembering: if this MCP server fails to connect, a session restart is
  the fix, not endless in-session retries.
- **Enroll is not a page** — a genuine, non-obvious correction to the
  plan's own assumption (spec.md/tasks.md both assumed an "Enroll page"
  existed). The real enrollment logic lives in `users.html`'s edit modal
  script (`newusers.js`), discovered by inspecting what JS the page
  already loaded rather than by clicking the "ADD" button.
- **Two distinct enrollment hardware paths** exist: `remote_enroll`
  (device-side — the physical reader's own camera/keypad) vs.
  `template_extract`/`template_match`/`user_fingerprint` (PC-side — a USB
  fingerprint scanner attached to the administrator's browser machine).
  Not previously suspected.
- **Report Export is a real, distinct two-phase server call**
  (`report_generate.fcgi`), not a client-side CSV render as P1 had left
  ambiguous.
- The user explicitly instructed the agent to type login credentials
  directly into the browser this session (a deliberate, in-context
  decision — see `DECISION_LOG.md`), a deviation from the stricter
  operator-only-entry pattern used for the C++ SDK's shell-based live
  test.

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| None — this cycle only added documentation/evidence, no code. | — | — |

---

## Lessons learned

- Don't assume a spec's page-name assumption ("the Enroll page") is
  correct just because it sounds plausible — check the actual dashboard
  menu structure first; a menu **section header** is not necessarily a
  **page**.
- When a modal got stuck for a prior discovery pass (P1's License
  Mode/Date-Time), the fix isn't necessarily "try harder" — it can be as
  simple as changing click order (open the target tile first, not after
  an unrelated one).
- For a single large one-time doc-writing task with well-organized
  factual input already in hand, don't fight a tool's command-line-length
  limit — just write it directly.

---

## What the next sprint must NOT assume

- `docs/ui-action-protocol-map.md`'s "Gaps not resolved this pass" is
  **not empty** — it now lists newly-discovered-but-not-investigated
  pages (Visitors, Visits, Data Tools Import/Export, Internal
  Alarms/Alarm Output, Open relay/Open Door) as open items for a future
  pass, distinct from the 5 gaps this plan closed.
- No write/enroll/relay/config-change action was ever invoked against
  the device this cycle — every finding came from either static JS
  reading or observing (never triggering) read-side requests, plus one
  observed-but-not-saved read-only export request.
- The plan's `2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery`
  predecessor plan remains mechanically stuck at `NEEDS_REPLAN` due to
  the separately-documented `KNOWN_HARNESS_BUG` — this plan (1b) does not
  fix or attempt to fix that; it is a distinct, later plan.
