# Spec — License Mode (Settings, read-only)

---

## Goal

Add a read-only `GET /license` endpoint, closing the read-only half of
`docs/api-roadmap.md` section 8. Small, low-risk plan: two
already-evidenced device reads combined into one struct, no new
query-builder surface, no write path — the same shape as the Date and
Time settings plan this project just shipped
(`.plans/2026-09-16-date-time-settings-read/`).

**Done looks like:** `AmicoClient::getLicenseInfo()` returns one
struct combining the device's license entitlement fields (max users,
license type, a device code) and the `sec_box.catra_role` setting; a
new `GET /license` backend route exposes it as JSON; a read-only
"License" panel on the existing System Information tab.

---

## Background — existing evidence (2026-09-16)

Two independently `LIVE_CONFIRMED` facts, both already captured this
session (no new live-device discovery pass needed for this plan):

**1. `sec_box.catra_role`** (`docs/api-roadmap.md` section 8, captured
during the Custom Fields discovery pass):
```
POST /get_configuration.fcgi {"sec_box":["catra_role"]}
  -> {"sec_box":{"catra_role":"0"}}
```
A JSON *string* `"0"`/`"1"` — the same third boolean-ish convention
already handled by `requireStringBoolField()` (added this session for
the Date and Time settings plan). This is the field behind the
device's own Settings → "License Mode" tile (confirmed by opening that
tile live: toggle "Online"/"Offline" identical in shape to the
Operation Mode tile investigated during this session's ad-hoc Face ID
troubleshooting — see below).

**2. `system_information.fcgi`'s own `license` object** — already
present in `test/fixtures/system_information.json` (captured earlier
this session while investigating a "why is the Enroll menu missing"
question):
```json
"license": {"users": 200000, "device": 0, "type": 0}
```
Not yet mapped into this SDK's `SystemInformation` struct
(`include/amico/Types.hpp` only exposes `serial`/`firmwareVersion`/
`secboxVersion`/`deviceName`/`deviceId`/`online`/`network`).
`license.type` is the field behind the device's own front-end
`Main.isServer()` check (`en_US/js/main.js`:
`return get_system_information().license.type == 1;`), which controls
whether the native dashboard's Enroll menu item is shown. Confirmed
directly this session: this device had `license.type == 0`, and the
Enroll menu was hidden as a result — until the ad-hoc Operation Mode
fix (unrelated setting, see below) restored it.

**Important — these two facts are NOT confirmed to be the same
setting.** `sec_box.catra_role` is read via `get_configuration.fcgi`
and is the device's own Settings → "License Mode" tile;
`license.type` is read via `system_information.fcgi` and drives a
completely different piece of front-end logic (`isServer()`, Enroll
menu visibility). Both currently read `0`/`"0"` on this device, which
is not evidence they are linked — this plan exposes both, verbatim,
without asserting a relationship neither read confirms.

**Not related to this plan**: during ad-hoc troubleshooting this
session (see conversation, not a plan), a *different* Settings tile —
**Operation Mode** (`Settings → Operation mode`, online/offline +
server IP/port config) — was found to be the actual cause of a
"Function not available in online mode" Enroll error on the physical
device, and was fixed live (Online → Offline) at the user's direction.
That tile is a distinct concept from both facts above and is not part
of this plan's scope (no endpoint for it exists or is proposed here).

**Write side genuinely out of scope for this plan**: upgrading the
license tier is password-gated on the device's own UI and was
deliberately not exercised live during discovery (Cancel only, per
`docs/api-roadmap.md` section 8's own note) — a strong candidate for
the "credential/firmware-adjacent write" risk tier
(`feedback_write_api_risk_tiers.md`), same bar as `setPassword`/
`setAdministrator`. Not attempted here.

---

## Design decisions

### Decision 1 — Read-only; no write path in this plan
- **Chosen:** Only `GET /license` is implemented. Any future license
  upgrade / `catra_role` write is explicitly deferred.
- **Why:** The upgrade flow is password-gated and was never exercised
  live (Background) — this project only implements a write path once
  its exact payload shape is captured, never by inference, especially
  for a credential-adjacent operation.
- **Rejected alternatives:** Guessing the write shape from the read
  shape's field names — rejected, same reasoning as the Date and Time
  plan's own Decision 1.

### Decision 2 — A dedicated `LicenseInfo` struct, not extending `SystemInformation`
- **Chosen:** New `LicenseInfo` struct with its own combined read
  (re-fetching `system_information.fcgi` for the `license` object,
  plus `get_configuration.fcgi` for `sec_box.catra_role`), rather than
  adding license fields to the existing `SystemInformation` struct.
- **Why:** `SystemInformation` today is exactly one call
  (`system_information.fcgi`) with no extra round trip. Folding in
  `catra_role` would force every existing `getSystemInformation()`
  caller to pay for a second call it doesn't need. License information
  is also a distinct *concern* (entitlement/licensing) from device
  *identity* (serial, firmware, network) — the same separation
  reasoning the Date and Time plan already established for its own
  `DateTimeSettings` struct.
- **Rejected alternatives:** Extending `SystemInformation` — rejected
  as scope creep and an unwanted perf change for existing callers.

### Decision 3 — Reuse `requireStringBoolField()`, no new helper
- **Chosen:** `sec_box.catra_role` is parsed with the existing
  `requireStringBoolField()` helper (added in `src/Client.cpp` for the
  Date and Time settings plan).
- **Why:** Same `"0"`/`"1"` JSON-string convention, already
  `LIVE_CONFIRMED` and already has a tested helper — no reason to
  duplicate it.
- **Rejected alternatives:** N/A — this is a straightforward reuse.

### Decision 4 — No new `ObjectQuery.cpp` builders
- **Chosen:** Both request bodies are constructed directly in
  `src/Client.cpp`, matching `system_information.fcgi` and this
  session's own Date and Time plan precedent.
- **Why:** Fixed, hardcoded keys, zero caller-supplied variability —
  no whitelisting concern `ObjectQuery.cpp`'s builders exist to
  address.
- **Rejected alternatives:** Adding builders anyway — rejected, same
  reasoning as Date and Time Decision 4.

### Decision 5 — Expose fields verbatim; do not assert a `catra_role`/`license.type` relationship
- **Chosen:** `LicenseInfo` exposes `catraRoleEnabled` and `type`
  (plus `maxUsers`, `device`) as independent fields, each documented
  with exactly what is confirmed about it and nothing more.
- **Why:** Background explains these are two separately-confirmed
  facts with no confirmed relationship. Merging them into one
  "license mode" concept (e.g. a single derived enum) would assert a
  link this project has not verified.
- **Rejected alternatives:** A single derived `mode` enum/bool —
  rejected as an unevidenced interpretation.

---

## Scope

### In scope
- SDK: `LicenseInfo` type; `AmicoClient::getLicenseInfo()` (a direct
  method, matching the `getSystemInformation()`/`getDateTimeSettings()`
  precedent).
- Backend: `GET /license`.
- Frontend: a read-only "License" panel added to the existing System
  Information tab (third panel alongside System Information and Date
  and Time — Simplicity First, no new sidebar entry for one small
  read).
- Tests: `AmicoClient::getLicenseInfo()` behavior (both calls' responses
  mapped correctly, including the string-boolean parsing), backend
  route test.
- Docs: `docs/backend-api.md` new `/license` section;
  `docs/api-roadmap.md` section 8 updated to reflect the read side
  shipped.

### Out of scope
- **License upgrade (write)** — spec.md Decision 1.
- **Operation Mode** (`Settings → Operation mode`) — a distinct,
  already-handled-ad-hoc setting, not part of this plan (Background).
- **Asserting a `catra_role`/`license.type` relationship** — spec.md
  Decision 5.
- **Extending `SystemInformation`** — spec.md Decision 2.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `LicenseInfo` struct |
| `include/amico/Client.hpp` | Modify | `getLicenseInfo()` method + `...Impl` declaration |
| `src/Client.cpp` | Modify | Implementation, reusing `requireStringBoolField()` |
| `backend/JsonMapping.cpp` / `.hpp` | Modify | `toJson(LicenseInfo)` |
| `backend/Routes.cpp` | Modify | `GET /license` |
| `frontend/system-info.js` | Modify | Add a "License" panel (reuses the existing generic renderer, same pattern as the Date and Time panel) |
| `test/test_system_information.cpp` | Modify | `getLicenseInfo()` tests |
| `test/backend/test_routes.cpp` | Modify | New route test |
| `docs/backend-api.md` | Modify | New `/license` section |
| `docs/api-roadmap.md` | Modify | Section 8 updated to reflect the read side shipped |

---

## Risks and unknowns

- **Low overall risk** — 2 already-evidenced reads, no writes, no new
  query-builder surface.
- **`license.device`'s exact meaning is unconfirmed** — the fixture
  shows `0`; this plan exposes it verbatim as a raw field without
  claiming to know what it represents (documented in the struct
  comment, not interpreted).

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 10/10 | Both response shapes already captured this session; nothing inferred; the "not confirmed to be related" caveat is explicit |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 4 items listed, each with a clear reason |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 10 files/changes, each tied to a decision; reuses an existing helper instead of adding one |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 10/10 | Smallest possible read-only slice; write and the unrelated Operation Mode tile explicitly deferred |

**Total: 39/40 → 9.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user chose "License Mode"
first via the roadmap review, confirmed with "oke".
**Confirmed on:** 2026-09-16
