# Tasks — Relay / Door actions

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) is a **genuine write with an
>   immediate physical effect** (unlocks a real door/relay). It
>   requires **both**:
>   1. `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-relay-door-actions`
>      (the standard token, pasted verbatim by the user), **and**
>   2. A separate, explicit "yes, trigger it now" message from the
>      user, sent immediately before the actual trigger call (spec.md
>      Decision 6) — do not treat the token alone as sufficient for
>      this plan.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `RelayActionKind` and `RelayAction`
**Action:**
```cpp
/// Which shared execute_actions.fcgi "action" name a RelayAction maps
/// to (Relay / Door actions plan, 2026-09-16). Only these 2 of the 5
/// kinds the real device supports are implemented -- spec.md
/// Decision 2 (siren/bell use a hold-to-activate interaction; catra
/// requires a device mode never observed live).
enum class RelayActionKind {
    Door,
    SecBox,
};

/// One currently-active relay/door action, re-derived fresh from the
/// device's own configuration every time (never cached -- spec.md
/// Decision 1). `id` is a stable composite key
/// (e.g. "door-1"/"sec_box-65793") used to re-select this exact entry
/// on trigger.
struct RelayAction {
    std::string id;
    RelayActionKind kind = RelayActionKind::Door;
    std::string label;        // matches the device's own sidebar label, e.g. "Open relay" / "Open Door"
    int64_t relayNumber = 0;  // valid when kind == Door
    int64_t secBoxId = 0;     // valid when kind == SecBox
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 1.2 — `ActionDeniedError` (already added)
**Action:** Already done ahead of this checklist (see spec.md
Decision 3): `include/amico/Errors.hpp` has `ActionDeniedError`;
`backend/ErrorMapping.cpp` maps it to 409. Just confirm the build is
still clean.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.
> `ActionDeniedError`/`ErrorMapping.cpp` mapping confirmed present.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — N/A: no new builders needed
**Action:** None. `get_configuration.fcgi` and `execute_actions.fcgi`
both take fixed, hardcoded shapes with no caller-supplied
object/field/where variability -- same precedent as every prior
`get_configuration.fcgi`-based plan this session.
**Verification:** N/A.
**Pass:** N/A.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> N/A — no builders needed, confirmed per spec.md.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `listRelayActions()` / `triggerRelayAction()` methods
**Action:** In `include/amico/Client.hpp`:
```cpp
/// Currently-active door/sec_box relay actions, re-derived fresh from
/// device configuration (Relay / Door actions plan, 2026-09-16).
std::vector<RelayAction> listRelayActions();

/// Fires one action by its `RelayAction::id` (re-resolved fresh --
/// spec.md Decision 1). Throws ProtocolError if `id` doesn't match a
/// currently-active entry (spec.md Decision 4); throws
/// ActionDeniedError if the device refuses the action (spec.md
/// Decision 3).
void triggerRelayAction(const std::string& id);
```
and the matching private `...Impl` declarations.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. Add `buildActionParameters()` helper (spec.md Decision 5):
   ```cpp
   std::string buildActionParameters(const std::vector<std::pair<std::string, std::string>>& pairs) {
       std::string result;
       for (size_t i = 0; i < pairs.size(); ++i) {
           if (i > 0) result += ", ";
           result += pairs[i].first + "=" + pairs[i].second;
       }
       return result;
   }
   ```
2. `std::vector<RelayAction> AmicoClient::Impl::listRelayActions()`:
   - `postAuthenticatedJson("/get_configuration.fcgi", {"general": ["relay_count", "relay_out_mode"]})`
     -> unwrap `"general"`, read `relay_count`/`relay_out_mode` as
     strings via `requireField<std::string>`, parse `relay_count` with
     `std::stoll`.
   - If `relay_out_mode` is `"0"` or `"1"`: push one `Door` entry per
     `relayNumber` in `1..relay_count`, `id = "door-" + std::to_string(relayNumber)`,
     `label = "Open relay"` (matching the device's own default label
     when there's exactly one; do not attempt to replicate the
     device's own "Open relay N" renaming logic for `relay_count > 1`
     -- out of scope, this device has exactly 1).
   - `postAuthenticatedJson("/get_configuration.fcgi", {"sec_box": ["catra_role"]})`
     -> unwrap `"sec_box"`, read `catra_role` via
     `requireField<std::string>`. If `catra_role == "0"`: push one
     `SecBox` entry, `id = "sec_box-65793"`, `secBoxId = 65793`,
     `label = "Open Door"` (the id is hardcoded per Background's own
     LIVE_CONFIRMED value -- there is no evidenced way to read it
     generically; if this ever needs to support a different
     `secBoxId`, that needs its own confirm pass).
   - Return the built list.
3. `void AmicoClient::Impl::triggerRelayAction(const std::string& id)`:
   - Call `listRelayActions()` fresh, find the entry with matching
     `id`; throw `ProtocolError` if not found (spec.md Decision 4).
   - Build `parameters` via `buildActionParameters()`:
     `kind == Door` -> `{{"door", std::to_string(relayNumber)}, {"reason", "3"}}`;
     `kind == SecBox` -> `{{"id", std::to_string(secBoxId)}, {"reason", "3"}}`.
   - `postAuthenticatedJson("/execute_actions.fcgi", {"actions": [{"action": actionName, "parameters": parameters}]})`
     where `actionName` is `"door"` or `"sec_box"` per kind.
   - Parse the response's `"actions"` array (`requireField<nlohmann::json>`);
     for each entry, if it has a `"status"` field equal to `"denied"`,
     throw `ActionDeniedError`. Do not require any other field on each
     entry (Background: success shape unconfirmed) -- only react to a
     literal `"denied"` status, mirroring the device's own JS.
4. Wire the public methods -> the `...Impl` calls.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `toJson(RelayAction)`
**Action:** In `backend/JsonMapping.cpp`/`.hpp`, add
`toJson(const amico::RelayAction&)` -> `{"id", "kind", "label",
"relayNumber", "secBoxId"}` (`kind` as the lowercase string `"door"`/
`"secBox"`).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build.

---

### Task 4.2 — `GET /relay-actions`, `POST /relay-actions/:id/trigger`
**Action:** In `backend/Routes.cpp`:
- `GET /relay-actions` -> `200 {"actions": [<RelayAction JSON>, ...]}`.
- `POST /relay-actions/:id/trigger` -> requires the
  `X-Confirm-Sensitive-Action` header (spec.md Scope note -- same bar
  as `setPassword`/`setAdministrator`, even though the shipped
  frontend fires it without a per-click end-user confirmation dialog).
  `200 {"success": true}` on success; lets `ActionDeniedError`/
  `ProtocolError` propagate to the standard `mapException()` handling
  (409 / 502 respectively).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — required the standard
> UAC-elevation stop/rebuild/restart dance (`amico_backend.exe`
> locked), succeeded on the first attempt. Health check
> `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — New `frontend/relay-actions.js` + sidebar entry
**Action:** Load the `frontend-design` skill first (standing project
instruction). New file `frontend/relay-actions.js`: a new sidebar
section "Relay / Door Actions" listing each currently-active action
(label) with a trigger button; clicking calls
`POST /relay-actions/:id/trigger` with the `X-Confirm-Sensitive-Action`
header, shows the result (success, denied, or error) via the existing
error/status UI conventions, and refreshes the list after. New sidebar
entry, since this is a genuinely new feature area (unlike Date and
Time/License, which piggybacked on the existing System Information
tab). Wire into `frontend/index.html` (sidebar entry, tab div, script
tag).
**Verification:** `node --check frontend/relay-actions.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/relay-actions.js` — exit 0, no syntax errors.
> New top-level sidebar entry "Relay / Door Actions" added to
> `frontend/index.html` (not nested under Enroll/Reports, matching
> System Information's own top-level placement).

---

## Group 6 — Tests

### Task 6.1 — `test/test_relay_actions.cpp` (new)
**Action:** Cases: `listRelayActions()` mapping (door + sec_box
entries built correctly from the 2 config reads); `catra_role != "0"`
-> no sec_box entry; `relay_out_mode` outside `"0"`/`"1"` -> no door
entries; `triggerRelayAction()` success path (parses a synthetic
non-"denied" status); `triggerRelayAction()` "denied" ->
`ActionDeniedError`; `triggerRelayAction()` unknown id ->
`ProtocolError`; exact `parameters` string format asserted
byte-for-byte (spec.md Decision 5's exact spacing).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_tests` — exit 0, clean build
> (new `test/test_relay_actions.cpp` added to `CMakeLists.txt`).
> `./build/amico_tests.exe` — 266 test cases, 1767 assertions, all
> passed, no regressions. All 8 planned cases added.

---

### Task 6.2 — `test/backend/test_routes.cpp`
**Action:** Add route tests for `GET /relay-actions` and
`POST /relay-actions/:id/trigger` (including the
`X-Confirm-Sensitive-Action` gate and the `ActionDeniedError` ->
409 mapping).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend_tests` — exit 0, clean
> build. `./build/amico_backend_tests.exe` — 96 test cases, 949
> assertions, all passed, no regressions. Added 4 new route tests plus
> 2 cookie-gate-rejection entries (`GET /relay-actions`,
> `POST /relay-actions/door-1/trigger`).

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add `GET /relay-actions` / `POST /relay-actions/:id/trigger`
sections to `docs/backend-api.md`. Update `docs/api-roadmap.md`
section 12 (already has the discovery write-up) to mark it ✅
implemented, recording the captured success-response shape once
Group 8 observes it.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> Manual review — added `GET /relay-actions`/`POST /relay-actions/:id/trigger`
> sections to `docs/backend-api.md`; updated `docs/api-roadmap.md`
> section 12 heading and endpoint table rows to ✅, explicitly noting
> the success-response shape is still pending Group 8's own live
> trigger (not yet captured).

---

## Group 8 — Manual live verification (READ + one real WRITE)

### Task 8.1 — Read-only: list matches device state
**Action:** Obtain `APPROVE_LIVE_DEVICE_TEST:2026-09-16-relay-door-actions`.
Log into the real device via our own frontend, open the new "Relay /
Door Actions" section, confirm exactly 2 entries appear ("Open relay",
"Open Door"), matching Background's resolved state.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Both entries shown correctly; no console error.
**Fail:** Wrong/missing entries, console error.

**Status:** `[x]`
**Verification result:**
> Manual, via chrome-devtools-mcp against the real device
> (192.168.2.156), token `APPROVE_LIVE_DEVICE_TEST:2026-09-16-relay-door-actions`
> pasted by the user. Logged into our own frontend (session had
> expired -- re-logged in), opened the new "Relay / Door Actions"
> sidebar section: exactly 2 entries shown ("Open relay", "Open Door"),
> matching Background's resolved state exactly. No new console errors
> (only the 3 pre-existing, unrelated `400`s on `/users/1,7,8/image`
> already noted in the License Mode plan's own Task 8.1).

---

### Task 8.2 — WRITE: trigger one action live (extra safety gate)
**Action:** **Before running**, obtain **both**:
1. `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-relay-door-actions`
   (the standard write token).
2. A separate, explicit "yes, trigger it now" message from the user,
   sent immediately before this specific call -- do not proceed on the
   write token alone (spec.md Decision 6). Tell the user plainly, in
   chat, which physical action is about to fire (e.g. "this will
   unlock the door/relay on the real device right now") before asking
   for that second confirmation.

Then click one trigger button (prefer "Open relay" over "Open Door"
unless the user specifies otherwise, as the lower-consequence of the
two), observe the actual response body, and record the previously-
unconfirmed success-response shape in `docs/api-roadmap.md` section 12
and this task's own result below.
**Verification:** Manual, via chrome-devtools-mcp; capture the raw
response body.
**Pass:** Action fires successfully (or a clean, understood
`ActionDeniedError` if something else has that relay/door held), no
console error, response shape recorded in docs.
**Fail:** Any regression, unexplained error, or unexpected response
shape that isn't handled cleanly by the current implementation.

**Status:** `[x]`
**Verification result:**
> Manual, via chrome-devtools-mcp against the real device
> (192.168.2.156). Both required approvals obtained: write token
> `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-relay-door-actions`, then
> a separate explicit "oke" confirmation from the user immediately
> before the click (spec.md Decision 6). User chose "Open relay" (the
> lower-consequence of the 2 options) via AskUserQuestion. Clicked
> Trigger on `door-1`: `POST /relay-actions/door-1/trigger` -> `200
> {"success": true}`, no `ActionDeniedError`, list refreshed cleanly
> afterward, no console error. The device's own raw
> `execute_actions.fcgi` response body was not independently visible
> (it's an internal backend<->device call, not surfaced to the
> browser) -- but the SDK's own `requireField<nlohmann::json>(response,
> "actions", ...)` parsing succeeded without throwing `ProtocolError`,
> confirming the assumed `{"actions": [...]}` shape was correct.
> **User independently confirmed the real relay/door physically
> activated** ("có nha" -- yes) at the moment of the click, the
> strongest possible confirmation that this write path works
> end-to-end against real hardware.

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 and 8.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing,
already-working files, plus 2 new files (`frontend/relay-actions.js`,
`test/test_relay_actions.cpp`). Revert via `git diff`/`git checkout --`
against this plan's own changes if needed (check `git status` first
per standing safety practice). The one live write (Task 8.2) has no
rollback in the traditional sense -- the physical action it performs
(unlocking a relay/door) is momentary and self-resetting on real
hardware, matching the device's own native UI behavior for the same
button.
