# Handoff — Internal Alarms (Settings, read + write)

> Status snapshot for whoever (human or agent) picks this up next.
> No secrets, tokens, or full logs/source below — see the referenced
> files for detail.

---

## Project goal

AMICO FaceID SDK/backend/frontend project (`amico_sdk` C++ SDK +
`amico_backend` HTTP proxy + a vanilla-JS frontend) against a real HID
AMICO VL70LF device at `192.168.2.156`. Goal of the current plan: add
read + write support for the device's Settings → "Internal Alarms"
page (door sensor, forced access, device violation, panic finger/card
toggles + related delay/debounce/timeout numeric settings), closing
`docs/api-roadmap.md`'s "Discovery pending" row for it.

This plan is also this project's first deliberate experiment in
handing implementation off to the **Codex CLI executor backend**
(`eng tools invoke executor codex.execute`) instead of the orchestrating
Claude Code session editing files directly — see "Limitations / risks"
below for what that experiment concluded.

## What's done

- **Groups 1–7 of `tasks.md` are complete** (SDK types, SDK
  implementation, backend routes, frontend UI, SDK tests, backend
  route tests, docs). Each task was executed via
  `eng tools invoke executor codex.execute` and then **independently
  re-verified** by the orchestrating session (rebuilt, re-ran tests)
  before being marked `[x]` — never trusted Codex's own self-report
  alone.
- **Task 1.1's own live discovery already happened** (done directly by
  the orchestrating session, not Codex — see below): the device's
  `get_configuration.fcgi` response for the `alarm` object returns
  **all 9 fields as JSON strings**, including the 4 numeric ones
  (`door_sensor_delay`, `door_sensor_alarm_timeout_after_closure`,
  `forced_access_debounce`, `panic_finger_delay`). This is the same
  string-encoded-integer convention already seen in the Relay/Door
  actions plan's `relay_count`, not the real-JSON-number convention
  seen in License Mode's `license.users`/etc. Full raw response is in
  `DECISION_LOG.md`.
- Current test suite status (see "Tests run and results" below): all
  green, no regressions.

## What's left, in priority order

1. **Task 8.1 — read-only live verification.** Log into the real
   device via this project's own frontend, open the new "Internal
   Alarms" sidebar tab, confirm all 9 displayed values match a direct
   `get_configuration.fcgi` query. Requires a fresh
   `APPROVE_LIVE_DEVICE_TEST:2026-09-16-internal-alarms-settings`
   token pasted literally by a human in chat (a menu/question
   selection does not satisfy this gate).
2. **Task 8.2 — one real write, then restore.** Change the
   **lowest-consequence** field (prefer a numeric delay/debounce/
   timeout value over disabling a security boolean), observe the
   actual `set_configuration.fcgi` response body (never captured
   before — this project's first call to that endpoint), then
   **immediately restore the original value** read in Task 8.1. Requires
   **both** `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-internal-alarms-settings`
   **and** a separate, explicit "yes, save it now" message sent right
   before the actual save — matching the extra safety step already
   used for the Relay/Door actions plan's own physical-trigger test.
   If the restore fails, escalate to a human immediately — do not
   leave the device in a changed security-settings state.
3. **Close the plan**: write `sprint-summary.md`, flip `plan.yaml`'s
   `state` to `COMPLETED` and `verification.verdict` to `PASS`, update
   `docs/api-roadmap.md` section 13's status marker from 📋 to ✅ (it
   was deliberately left at 📋 in Task 7.1 specifically because Group 8
   hadn't run yet — see that section's own note).
4. **Commit** everything (this plan's own files plus the source
   changes) — nothing from this plan has been committed yet. Do not
   commit `Data_Hard/` or `issue/` (untracked, unrelated real
   employee-photo/screenshot data from earlier in this session — never
   belongs in git, per this project's own
   `docs/security-sanitization-policy.md`).
5. Beyond this plan, the broader project roadmap still has: the
   Date and Time / License Mode **write** sides (both deliberately
   deferred, evidence not yet captured), and full discovery passes still
   pending for Alarm Output, Data Tools Export/Import, and ~68 unopened
   Settings tiles — see `docs/api-roadmap.md`'s "Discovery pending"
   table and sections 8/9 for the up-to-date list.

## Current state of plan/tasks

- `plan.yaml`: `state: COMPLETED`, `review.verdict: PASS`,
  `verification.verdict: PASS` (Group 8 complete).
- `tasks.md`: Groups 1–7 all `[x]`. Group 8 (Task 8.1, Task 8.2) both
  still `[ ]`.
- Nothing is `[!]` (failed) — no blocked/broken state to recover from,
  just unstarted live-verification work.

## Related files

| File | Role |
|---|---|
| `.plans/2026-09-16-internal-alarms-settings/spec.md` | Full spec: goal, evidence, 6 design decisions, scope |
| `.plans/2026-09-16-internal-alarms-settings/tasks.md` | Per-task checklist + verification results (source of truth for what's done) |
| `.plans/2026-09-16-internal-alarms-settings/DECISION_LOG.md` | Dated decision/finding log, including the Task 1.1 live-discovery raw response and the Codex-capability-boundary finding |
| `.plans/2026-09-16-internal-alarms-settings/plan.yaml` | Machine-readable lifecycle state (harness-tracked) |
| `.plans/2026-09-16-internal-alarms-settings/review.md` | Plan Reviewer's own independent review (verdict: APPROVED) |
| `include/amico/Types.hpp` | `InternalAlarmSettings` struct |
| `include/amico/Client.hpp`, `src/Client.cpp` | `getInternalAlarmSettings()`/`setInternalAlarmSettings()` |
| `backend/JsonMapping.cpp`/`.hpp`, `backend/Routes.cpp` | `GET`/`PUT /internal-alarms` |
| `frontend/internal-alarms.js`, `frontend/index.html` | New "Internal Alarms" sidebar tab |
| `test/test_internal_alarms.cpp`, `test/backend/test_routes.cpp` | Test coverage (see below) |
| `docs/backend-api.md`, `docs/api-roadmap.md` | Public-facing endpoint docs (roadmap section 13 currently 📋, pending Group 8) |

## Tests run and results

- `amico_tests.exe` (SDK-level): **270 test cases, 1820 assertions, 0
  failures** — includes 4 new Internal Alarms cases (full-flow
  mapping, boolean-string acceptance, exact write-body field-by-field
  string assertions, success-path no-throw).
- `amico_backend_tests.exe` (backend routes): **99 test cases, 988
  assertions, 0 failures** — includes 3 new route tests
  (`GET /internal-alarms` mapping, `PUT /internal-alarms` confirmation-
  header rejection/success) plus 2 new cookie-gate-rejection entries.
- Both suites were re-run and independently confirmed by the
  orchestrating session after every single Codex-executed task, not
  just once at the end.

## Suggested next step

Run Task 8.1 first (read-only, lower stakes): get the
`APPROVE_LIVE_DEVICE_TEST:...` token from the device owner, open the
frontend's "Internal Alarms" tab, compare displayed values against a
direct device query. Only after that passes, move to Task 8.2's real
write test, which needs the extra double-confirmation step described
above.

## Completion update

Task 8.1 and Task 8.2 completed on 2026-09-17. The first live write
changed only `door_sensor_delay` from 10 to 11, returned HTTP 200 with
`{"success":true}`, and was immediately restored to 10 with a second
successful write and fresh read confirmation. See `DECISION_LOG.md` and
`sprint-summary.md` for durable evidence. No commit was created.

## Limitations / risks to note

- **Codex CLI (via `eng tools invoke executor codex.execute`) has no
  live-device or browser access.** Empirically confirmed this plan
  (see `DECISION_LOG.md`'s "Codex hand-off attempted and empirically
  confirmed blocked" entry): it tried raw `curl`/PowerShell against the
  device directly, had no valid session cookie, and **correctly
  declined to try to extract credentials/session tokens from process
  or browser memory** rather than fake a result. Any future Group 8
  (or Task 1.1-style live-discovery task) for *any* plan must be done
  by a session that actually has an authenticated browser (this
  project's own established chrome-devtools-mcp-based flow), not
  handed to Codex.
- **Codex once exceeded its declared `write_scope`** (Task 6.2: it also
  self-marked its own task status in `tasks.md`, which
  `core/executor/METHOD.md` reserves exclusively to the orchestrating
  session). The content it wrote was accurate that time, but this is
  not guaranteed — always independently re-verify Codex's own claims
  and re-check it didn't touch files outside the `write_scope` you gave
  it.
- **This is the project's first `set_configuration.fcgi` write** — no
  prior plan's precedent exists for its success/error response shape.
  The current implementation only relies on HTTP status (throws on
  non-2xx, doesn't parse any in-body error field) — Task 8.2's own live
  write test is the only chance to observe and, if needed, refine this.
- **Security-relevant settings**: Internal Alarms controls real
  security behavior (door sensor alarm, forced-access detection, panic
  buttons). `PUT /internal-alarms` requires
  `X-Confirm-Sensitive-Action: yes` and is a full-replace write (all 9
  fields every time, no partial update) — there is no way to change
  just one field without resending the other 8 as they currently are.
- Never persist real device data (user names, photos, access logs) to
  any tracked file — see `docs/security-sanitization-policy.md`. This
  handoff file itself deliberately contains no device data, tokens, or
  credentials.
