# Spec — Relay / Door actions ("Open relay" / "Open Door")

---

## Goal

Add a read side (what actions are currently available) and a write
side (trigger one) for the device's "Open relay"/"Open Door" sidebar
buttons, closing `docs/api-roadmap.md` section 12. This is this
project's **first plan whose write action has an immediate real-world
physical effect** (unlocks a real door/relay), not just a database
mutation — treated with matching extra care in Group 8.

**Done looks like:** `AmicoClient::listRelayActions()` returns the
currently-active door/sec_box actions (mirroring the device's own
sidebar); `AmicoClient::triggerRelayAction(id)` fires one via
`execute_actions.fcgi`; `GET /relay-actions` and
`POST /relay-actions/:id/trigger` expose both over the backend; a
"Relay / Door Actions" panel with buttons on the frontend.

---

## Background — evidence (2026-09-16)

**Static read** of the device's own `en_US/js/main.js`
(`updateRelaysData()`/`drawRelaysMenu()`, an unauthenticated GET of a
static asset — no live-device call, no approval needed for this part):

The sidebar's "Open relay"/"Open Door" are two instances of one
dynamic mechanism. The device builds a list of actionable outputs
(`relays`) from its current configuration, and each entry fires via:
```
POST /execute_actions.fcgi {"actions":[{"action":"<name>","parameters":"<comma-string>"}]}
```
`parameters` is a **literal comma-separated key=value string**, not
nested JSON — a genuinely new wire convention (exact captured
template: `"door=" + relay.relay + ", reason=3"` — no space before the
comma, one space after; `"id=" + relay.id + ", reason=3"` for
sec_box).

**Gated live read** (`APPROVE_LIVE_DEVICE_TEST:2026-09-16-relay-door-discovery`,
user-approved verbatim) confirmed which entries this specific device
currently has active:
```
get_configuration.fcgi {"general":["relay_count","relay_out_mode"]}
  -> {"general":{"relay_count":"1","relay_out_mode":"0"}}
```
(both JSON *strings* of small integers -- `relay_count` needs
`std::stoll`, not the "0"/"1" boolean convention). Combined with the
already-known `sec_box.catra_role` (License Mode plan):
`catra_role == "0"` on this device.

Reading the JS's own gating logic:
- `relay_count`/`relay_out_mode` -> when `relay_out_mode` is `"0"`
  (`NORMAL_ACCESS`) or `"1"` (`ONLY_REJECTED`), one `"door"`-type entry
  exists per relay number `1..relay_count`
  (`action:"door"`, `parameters:"door=<n>, reason=3"`).
- `sec_box.catra_role == "0"` -> **SecBox mode**: one additional entry,
  always `id: 65793`, `target: "Open Door"`
  (`action:"sec_box"`, `parameters:"id=<id>, reason=3"`).
- `catra_role != "0"` -> **iDBlockNext/Catra (turnstile) mode**
  instead: rotate actions (`action:"catra"`,
  `parameters:"allow=clockwise|anticlockwise|both, reason=3"`) --
  **mutually exclusive with SecBox mode on the same field**. This
  **refines** what `catra_role` represents (License Mode plan's own
  Decision 5 deliberately did not assert a meaning beyond "a raw
  field") -- it is an **operating-role selector between SecBox and
  turnstile/Catra integration**, not a generic license flag; the
  device's own Settings UI tile is just labeled "License Mode".
- Siren (`action:"siren_play"`/`"siren_stop"`) and bell
  (`action:"bell_ding_dong"`/`"bell_dong"`) entries also exist, but use
  a mousedown/mouseup (hold-to-activate) interaction, a materially
  different model from a single click.

**This device's resolved state**: `relay_count=1`, `relay_out_mode="0"`,
`catra_role="0"` -> exactly 2 active entries: `"Open relay"` (door,
relay 1) and `"Open Door"` (sec_box, id 65793) — matching the original
2 sidebar buttons.

**Response shape genuinely not yet captured**: the JS only checks for
a literal `actions[].status === "denied"` (a remote-interlocking
conflict, shown as a "Close open door to continue" modal); the
success-path response body was never observed during read-only
discovery. **Group 8's own live trigger is this plan's only chance to
capture it** — the implementation below is written defensively (parse
only what's evidenced: an `actions` array with a `status` field per
entry) rather than assuming additional fields exist.

---

## Design decisions

### Decision 1 — A read (`listRelayActions`) + a write (`triggerRelayAction`), not one combined call
- **Chosen:** `listRelayActions()` re-derives the current list from 3
  `get_configuration.fcgi` reads every time (fresh, never cached);
  `triggerRelayAction(id)` re-derives the same list internally, finds
  the matching entry by `id`, and only then fires
  `execute_actions.fcgi`.
- **Why:** Device state (which relays/modes are active) can change
  between a page load and a click; re-deriving fresh before every
  trigger avoids firing a stale/wrong action. This mirrors the
  Reports plan's own precedent (`exportCsv()` always re-resolves
  `ReportDefinition`/columns fresh rather than trusting a
  client-cached shape).
- **Rejected alternatives:** Caching the list and trusting a
  client-supplied `kind`/`relayNumber`/`secBoxId` directly on trigger
  — rejected; a stale client-side list could fire the wrong physical
  action after a device reconfiguration.

### Decision 2 — Only "door" and "sec_box" kinds in this pass; siren/bell/catra deferred
- **Chosen:** `listRelayActions()` only ever returns `Door`/`SecBox`
  kind entries. Siren, bell, and catra/turnstile entries are silently
  excluded from the list (not an error — mirrors the real device's own
  `drawRelaysMenu()`, which simply doesn't render an entry it doesn't
  understand for other reasons like `active: false`).
- **Why:** Siren/bell use a fundamentally different
  hold-to-activate (mousedown/mouseup) interaction — a different
  feature, not a variant of "click to trigger." Catra/turnstile mode
  is mutually exclusive with SecBox mode on this device (Background)
  and was never exercised live (no device in that mode was available
  this session) — implementing it now would mean guessing at an
  untested code path for a physical-actuation feature, which this
  project never does.
- **Rejected alternatives:** Implementing all 5 kinds now "for
  completeness" — rejected; 3 of the 5 have zero live evidence on this
  device and a materially different interaction model, and Simplicity
  First favors shipping the evidenced 2 first.

### Decision 3 — A new `ActionDeniedError`, not reusing an existing exception type
- **Chosen:** A new `amico::ActionDeniedError` (maps to HTTP 409 via
  `ErrorMapping.cpp`), thrown when `execute_actions.fcgi` returns a 2xx
  response but any `actions[].status == "denied"`.
- **Why:** None of the existing exception types fit: it is not an
  HTTP-level failure (`HttpError`), not a malformed/unexpected response
  shape (`ProtocolError` — the shape matched evidence exactly), and not
  an unimplemented operation (`UnsupportedOperationError`). It is a
  genuine new category: a well-formed, business-level refusal.
- **Rejected alternatives:** Reusing `ProtocolError` — rejected, would
  conflate "the device's response didn't match what we expected" with
  "the device understood us and said no," which callers need to
  distinguish (a denial is retryable after closing another door; a
  protocol mismatch is a bug).

### Decision 4 — `triggerRelayAction(id)` throws `ProtocolError` for an unknown id
- **Chosen:** If the caller-supplied `id` does not match any
  currently-active entry from a fresh `listRelayActions()` call,
  throw `ProtocolError`.
- **Why:** Matches the exact precedent already shipped in the Reports
  plan (`exportCsv()` throws `ProtocolError` if the given `reportId`
  is not found among the known reports) — this project already
  established this exact error-type choice for "caller-supplied id
  doesn't match a currently-known set," and consistency with that
  precedent is more valuable here than debating the label in
  isolation.
- **Rejected alternatives:** A new `NotFoundError` type — rejected in
  favor of consistency with the Reports precedent.

### Decision 5 — A literal comma-string `parameters` builder, not `nlohmann::json`
- **Chosen:** A small helper
  (`buildActionParameters(const std::vector<std::pair<std::string,std::string>>&)`)
  that joins pairs as `"key=value, key2=value2"` (no space before
  comma, one space after — exact captured format), used only for this
  endpoint.
- **Why:** `execute_actions.fcgi`'s `parameters` field is confirmed to
  be a raw string, not a nested JSON object — every other endpoint
  this project has implemented uses real JSON structure for its
  parameters, so this needs its own small, exact-format builder rather
  than repurposing `nlohmann::json::dump()`.
- **Rejected alternatives:** Hand-building the string inline at each
  call site — rejected; there are 2 call sites (door, sec_box) today
  and a shared helper keeps the exact spacing convention in one place.

### Decision 6 — Extra live-safety step before Group 8's actual trigger
- **Chosen:** Beyond the standard
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-relay-door-actions` token,
  the executor must also get an explicit, separate "yes, trigger it
  now" confirmation message from the user in chat, immediately before
  calling the live trigger endpoint (not bundled into the earlier
  token approval).
- **Why:** This is the first write this project has implemented whose
  effect is immediate and physical (a real door/relay unlocks) rather
  than a database row changing — `docs/api-roadmap.md` section 12's
  own "Safety note" already flags this. The extra explicit
  confirmation step, timed right before the action, matches
  `feedback_never_self_approve_workflow_gates.md`'s spirit (always get
  real approval for something consequential) even though the
  written-approval-token step alone would technically satisfy this
  project's normal live-write-test gate.
- **Rejected alternatives:** Treating the write-token approval alone as
  sufficient (the normal bar for every other write this project has
  shipped) — rejected specifically because of the physical-world
  consequence, which no prior plan this session has had.

---

## Scope

### In scope
- SDK: `RelayActionKind` enum, `RelayAction` struct;
  `AmicoClient::listRelayActions()`;
  `AmicoClient::triggerRelayAction(const std::string& id)`; new
  `ActionDeniedError` exception type.
- Backend: `GET /relay-actions`; `POST /relay-actions/:id/trigger`
  (with `X-Confirm-Sensitive-Action`, matching this project's existing
  device-wide-behavior-change convention — even though
  `feedback_write_api_risk_tiers.md` says relay/turnstile writes don't
  need *per-attempt* end-user confirmation in the shipped product's
  own UX, this project still requires the header as a defense against
  accidental non-interactive calls, same bar already used for
  `setPassword`/`setAdministrator`).
- Frontend: a new "Relay / Door Actions" section (new sidebar entry,
  since this is a genuinely new feature area, not an addition to an
  existing tab) listing currently-active actions with a trigger
  button each.
- Tests: `listRelayActions()`/`triggerRelayAction()` behavior
  (including the "denied" and "unknown id" error paths), backend route
  tests.
- Docs: `docs/backend-api.md` new `/relay-actions` section;
  `docs/api-roadmap.md` section 12 updated to reflect the shipped
  behavior.

### Out of scope
- **Siren, bell, catra/turnstile kinds** — spec.md Decision 2.
- **Caching/trusting a client-supplied action shape on trigger** —
  spec.md Decision 1.
- **Per-attempt end-user confirmation dialog in the shipped frontend
  UI** — `feedback_write_api_risk_tiers.md` explicitly says
  relay/turnstile writes don't need this; the button fires
  immediately, same as the real device's own sidebar behavior.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `RelayActionKind`, `RelayAction` |
| `include/amico/Errors.hpp` | Modify | `ActionDeniedError` (already added) |
| `backend/ErrorMapping.cpp` | Modify | Map `ActionDeniedError` -> 409 (already added) |
| `include/amico/Client.hpp` | Modify | `listRelayActions()`/`triggerRelayAction()` + `...Impl` declarations |
| `src/Client.cpp` | Modify | Implementation; `buildActionParameters()` helper |
| `backend/JsonMapping.cpp` / `.hpp` | Modify | `toJson(RelayAction)` |
| `backend/Routes.cpp` | Modify | `GET /relay-actions`, `POST /relay-actions/:id/trigger` |
| `frontend/relay-actions.js` | New | New sidebar section, list + trigger buttons |
| `frontend/index.html` | Modify | New sidebar entry + tab div + script tag |
| `test/test_relay_actions.cpp` | New | SDK-level tests |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | New `/relay-actions` section |
| `docs/api-roadmap.md` | Modify | Section 12 updated (already partially updated with discovery findings) |

---

## Risks and unknowns

- **Physical real-world effect** — the single biggest risk in this
  plan; addressed by Decision 6's extra confirmation step.
- **Success-response shape unconfirmed** — Group 8's live trigger is
  the only way to capture it; implementation only parses what's
  evidenced (`actions[].status`), so an unexpected-but-successful
  shape should not crash, only an actually-malformed one throws
  `ProtocolError` via the normal `requireField` mechanism.
- **`relay_count`/`relay_out_mode` are JSON strings of integers**, a
  parsing detail distinct from the "0"/"1" boolean convention already
  handled by `requireStringBoolField()` — needs its own
  `std::stoll`-based read, not a new helper (one-off, not reused
  elsewhere yet).

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | Everything captured except the success-response shape, explicitly flagged as unknown rather than guessed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 3 items, each with a clear reason; deliberately the smallest evidenced slice (2 of 5 possible kinds) |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 13 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Extra safety step (Decision 6) added specifically because this plan's risk profile differs from every prior plan this session |

**Total: 37/40 → 9.25/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user said "làm" (do it) to
proceed with Open relay / Open Door as the next roadmap item.
**Confirmed on:** 2026-09-16
