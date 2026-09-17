# Plan Review — Internal Alarms (Settings, read + write)

> Written by the Plan Reviewer, independently of the Planner (same
> session, `normal` assurance mode, per `core/runtime/METHOD.md`'s
> Phase 11 note that this is allowed).

## Verdict

[x] APPROVED
[ ] CHANGES REQUESTED

## Checklist

| Check | Finding |
|---|---|
| Missing requirements | None. `spec.md`'s Goal covers both read and write, matching what the device's own `alarmint.html` actually exposes (no separate read-only surface exists, per Background — Decision 1 correctly does not split this into a read-first plan like Date and Time/License Mode). |
| Incorrect assumptions | None found. Verified against actual source: `requireStringBoolField()` exists in `src/Client.cpp` (added for the Date and Time plan); `postAuthenticatedJson()` exists and throws `HttpError` on non-2xx (Task 3.2 relies on this correctly); the frontend `input()`/`jsonOptions()` helpers and the checkbox pattern from `frontend/user-types.js` exist as described; the `X-Confirm-Sensitive-Action` 2-stage try/catch route convention (parse body, catch → 400; then call SDK, catch → mapped error) matches the existing `PUT /users/:id/administrator` route exactly. |
| Architecture inconsistencies | None. Decision 1's deviation from the Date and Time/License Mode read-first precedent is explicitly justified (no independent read-only surface exists on the device for this data) rather than silently diverging. |
| Missing edge cases | Covered: both boolean-string values ("0"/"1"), the numeric-type live-discovery gate (Task 1.1) before any type is committed to code, and a device-error-response case deferred explicitly to Group 8 rather than guessed. One item *worth watching*, not a blocker: Task 8.2 only exercises one changed field before restoring it — the other 8 fields' write path only gets exercised by the unit tests' synthetic fixtures, never a live round-trip. Acceptable for this plan's own risk tier (a single security-relevant live write, minimizing exposure, is the right call over writing all 9 fields live), but note it so a future plan doesn't assume every field was live-verified. |
| Missing tests | None missing. Group 6 covers: full-flow read mapping, both boolean-string values, exact outgoing write-body assertion (all 9 fields, string-typed), and a backend confirmation-header gate test, plus the cookie-gate list update — matches this project's own established test-coverage bar for a plan this size (comparable to the Relay/Door actions plan's own Group 6). |
| Dependency problems | None. Task ordering is correct: 1.1 (live discovery) strictly precedes 1.2 (struct definition) strictly precedes 3.1/3.2 (implementation that depends on 1.2's field types) — no task assumes an output that doesn't exist yet at that point in the sequence. |
| Security / hardware impact | This is the plan's central risk and it is well-handled: Decision 3 requires the confirmation header (correctly distinguished from the Relay/Door actions plan's own no-confirmation-needed momentary-action exemption, since this is a persistent security-posture change, not a pulse); Task 8.2 requires **both** the write token and a separate explicit human confirmation immediately before the live write (matching the Relay/Door actions plan's own Decision 6 precedent); Task 8.2 explicitly requires reading the original value first and restoring it exactly afterward, with a hard escalate-to-human instruction if restore fails. No gaps found here. |

## Notes

- This plan is written for hand-off to the Codex CLI executor backend rather than direct Planner implementation (spec.md's own "Execution model" section) — an explicit, disclosed deviation from every prior plan this session, with the genuine uncertainty about Codex's own MCP/browser access called out rather than assumed away. This is the correct way to handle that uncertainty: a documented stop-and-report fallback in Group 8, not a silent skip.
- Task 3.2's numeric-field parsing branches on Task 1.1's live finding (JSON number vs number-string) rather than being fully committed to one literal code path. This is a resolved-by-evidence conditional, not an unbounded design judgment call left to the Executor — Task 1.1 will have produced an unambiguous answer before Task 1.2/3.2 run, so by the time Codex executes those tasks there is exactly one correct code path, not a live choice. Flagging only so a human skimming `tasks.md` understands why it reads as conditional.
- No blocking issues. Cleared to proceed to Executor activation.
