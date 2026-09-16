# Sprint summary — Relay / Door actions

## What shipped

Read + write support for the device's "Open relay"/"Open Door"
sidebar buttons, surfaced as a new "Relay / Door Actions" sidebar
section:

- `AmicoClient::listRelayActions()` (SDK): re-derives, fresh every
  call, the currently-active door/sec_box actions from 2
  `get_configuration.fcgi` reads.
- `AmicoClient::triggerRelayAction(id)` (SDK): re-resolves the list,
  fires the matching action via `POST execute_actions.fcgi` using a
  literal comma-separated `parameters` string (a new wire convention
  for this project), throws `ActionDeniedError` (new exception type,
  maps to HTTP 409) on a business-level device refusal, `ProtocolError`
  on an unknown id.
- `GET /relay-actions` / `POST /relay-actions/:id/trigger` (backend):
  the trigger route requires `X-Confirm-Sensitive-Action`, matching
  the `setPassword`/`setAdministrator` risk bar.
- `frontend/relay-actions.js` + new sidebar entry: lists active
  actions with an immediate-fire Trigger button each (no per-click
  confirmation dialog, per `feedback_write_api_risk_tiers.md`'s own
  relay/turnstile exemption).

## Key finding: `catra_role`'s meaning refined

The same `sec_box.catra_role` field already shipped in the License
Mode plan turned out to be an **operating-role selector between SecBox
and turnstile/Catra integration modes** — `catra_role == "0"` means
SecBox mode (adds an "Open Door" action); any other value means
iDBlockNext/Catra (turnstile) mode instead (rotate actions, out of
scope this pass). This refines, but does not contradict, the already-
shipped `LicenseInfo.catraRoleEnabled`'s own deliberately-verbatim
exposure.

## This project's first write with an immediate physical effect

Unlike every prior write this project has shipped (all database
mutations), triggering a relay/door action has a real, immediate
physical effect. This plan added an extra safety step beyond the
standard live-write-test token: a separate, explicit "yes, trigger it
now" confirmation from the user, sent right before the actual call
(spec.md Decision 6) — documented as a standing pattern in
`docs/api-roadmap.md` section 12 for any future plan touching a
physical-actuation endpoint.

## Groups completed

1. SDK types — `RelayActionKind`, `RelayAction`; new `ActionDeniedError`.
2. SDK query builders — N/A (fixed-key request bodies).
3. SDK implementation — `listRelayActions()`/`triggerRelayAction()` +
   `buildActionParameters()` helper.
4. Backend — `toJson(RelayAction)`, `GET /relay-actions`,
   `POST /relay-actions/:id/trigger`, `ActionDeniedError` -> 409 mapping.
5. Frontend — new `relay-actions.js` + sidebar entry.
6. Tests — 8 new SDK cases (`test_relay_actions.cpp`, new file), 4 new
   backend route tests + 2 cookie-gate entries.
7. Docs — `docs/backend-api.md`, `docs/api-roadmap.md` section 12.
8. Manual live verification — **both** a read check (list matches
   device state exactly) and a real physical write (triggered "Open
   relay", confirmed by the user that the relay actually activated).

## Test results

- `amico_tests.exe`: 266 test cases, 1767 assertions, all passed.
- `amico_backend_tests.exe`: 96 test cases, 949 assertions, all
  passed.
- No regressions in either suite.

## Scope deliberately deferred

Siren, bell (hold-to-activate interaction), and catra/turnstile kinds
(mutually exclusive with this device's current SecBox mode, never
observed live) — spec.md Decision 2. If a future device/installation
needs these, they need their own confirm pass first, same standing
rule as every other unexercised write path this project has.

## What's next

Per the roadmap review, the remaining items (in increasing difficulty)
are: Internal Alarms / Alarm Output / Data Tools Export (medium
discovery), then Data Tools Import (higher risk, bulk write), and the
~68 remaining unopened Settings tiles.
