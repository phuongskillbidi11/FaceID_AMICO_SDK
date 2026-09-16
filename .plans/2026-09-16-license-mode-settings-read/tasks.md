# Tasks — License Mode (read-only)

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) is **entirely read-only**
>   (spec.md Decision 1 — no write path in this plan at all),
>   requiring a fresh
>   `APPROVE_LIVE_DEVICE_TEST:2026-09-16-license-mode-settings-read`
>   approval. **There is no write-approval step in this plan.**

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `LicenseInfo`
**Action:**
```cpp
/// Combined read of the device's license entitlement fields (License
/// Mode settings plan, 2026-09-16) -- `maxUsers`/`device`/`type` come
/// from `system_information.fcgi`'s own `license` object;
/// `catraRoleEnabled` from a separate `get_configuration.fcgi` call.
/// LIVE_CONFIRMED both are real, but NOT confirmed to represent the
/// same underlying setting (spec.md Decision 5) -- exposed as
/// independent fields, never merged into one derived concept.
/// `device`'s exact meaning is unconfirmed (fixture shows `0`);
/// exposed verbatim. `type` is the field behind the device's own
/// front-end `Main.isServer()` check (`type == 1`), which controls
/// Enroll menu visibility on the native dashboard -- LIVE_CONFIRMED
/// this session, unrelated to this plan's own scope. Read-only; there
/// is no `LicenseInfoUpdate` counterpart (spec.md Decision 1 -- the
/// license upgrade flow is password-gated and was never captured).
struct LicenseInfo {
    int64_t maxUsers = 0;
    int64_t device = 0;
    int64_t type = 0;
    bool catraRoleEnabled = false;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — N/A: no new builders needed
**Action:** None. Per spec.md Decision 4, both request bodies this
plan uses (`system_information.fcgi`, `get_configuration.fcgi`) take a
fixed, hardcoded set of keys with zero caller-supplied variability --
the same precedent already established for the Date and Time settings
plan.
**Verification:** N/A.
**Pass:** N/A.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> N/A — no builders needed, confirmed per spec.md Decision 4.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `getLicenseInfo()` method
**Action:** In `include/amico/Client.hpp`, add a direct method on
`AmicoClient` (matching the existing `getSystemInformation()`/
`getDateTimeSettings()` precedent):
```cpp
/// Combined read: system_information.fcgi's own `license` object plus
/// sec_box.catra_role. Read-only (spec.md Decision 1).
LicenseInfo getLicenseInfo();
```
and the matching private `...Impl` declaration
(`LicenseInfo getLicenseInfoImpl();`).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
`LicenseInfo AmicoClient::Impl::getLicenseInfo()`:
- `postAuthenticatedJson("/system_information.fcgi", nullptr)` ->
  unwrap the `"license"` section, `info.maxUsers`
  (`requireField<int64_t>` on `"users"`), `info.device`
  (`requireField<int64_t>` on `"device"`), `info.type`
  (`requireField<int64_t>` on `"type"`).
- `postAuthenticatedJson("/get_configuration.fcgi", {"sec_box": ["catra_role"]})`
  -> unwrap the `"sec_box"` section, `info.catraRoleEnabled`
  (`requireStringBoolField()`, reused from the Date and Time plan --
  spec.md Decision 3).
- Return the populated `LicenseInfo`.

Wire `AmicoClient::getLicenseInfoImpl()` -> `impl_->getLicenseInfo()`,
and the public `AmicoClient::getLicenseInfo()` -> the `...Impl` call.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `toJson(LicenseInfo)`
**Action:** In `backend/JsonMapping.cpp`/`.hpp`, add
`toJson(const amico::LicenseInfo&)` -> `{"maxUsers", "device", "type",
"catraRoleEnabled"}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build.

---

### Task 4.2 — `GET /license` route
**Action:** In `backend/Routes.cpp`, add (mirroring the existing
`GET /settings/date-time` route's own simple shape):
`GET /license` -> `200 <LicenseInfo JSON>`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — required the standard
> UAC-elevation stop/rebuild/restart dance (`amico_backend.exe` locked
> by the running service), succeeded on the first attempt this time.
> Health check `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — Extend `frontend/system-info.js` with a License panel
**Action:** Load the `frontend-design` skill first (standing project
instruction, already loaded earlier this session -- confirm still
applicable, no need to re-invoke setup actions). Extend the existing
"System Information" tab (`frontend/system-info.js`) with a third
section: fetch `GET /license` alongside the existing
`GET /system-information` and `GET /settings/date-time` calls,
rendering it via the same generic definition-list renderer already
used there, under a "License" heading. No new sidebar entry -- same
reasoning as the Date and Time panel (Simplicity First).
**Verification:** `node --check frontend/system-info.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/system-info.js` — exit 0, no syntax errors.

---

## Group 6 — Tests

### Task 6.1 — `test/test_system_information.cpp` additions
**Action:** Add cases for `AmicoClient::getLicenseInfo()`: both calls'
responses mapped correctly, including the string-boolean parsing via
the already-tested `requireStringBoolField()`.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_tests` — exit 0, clean build.
> `./build/amico_tests.exe` — 258 test cases, 1743 assertions, all
> passed, no regressions. Added 3 new cases: full-flow field mapping
> (reusing the `system_information.json` fixture's own `license`
> object), "0"/"1" string-boolean acceptance, and a ProtocolError case
> for an invalid `catra_role` value.

---

### Task 6.2 — `test/backend/test_routes.cpp`
**Action:** Add a route test for `GET /license`.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend_tests` — exit 0, clean
> build. `./build/amico_backend_tests.exe` — 92 test cases, 911
> assertions, all passed, no regressions. Added a mapping test plus a
> cookie-gate-rejection entry for `/license`.

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add a `GET /license` section to `docs/backend-api.md`.
Update `docs/api-roadmap.md` section 8 to reflect the read side
shipped, keeping the write side (license upgrade) explicitly marked as
its own future item.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> Manual review — added a `GET /license` section to
> `docs/backend-api.md` (matching the existing `/settings/date-time`
> section's own style) and updated `docs/api-roadmap.md` section 8
> from "📋 Planned" to "✅ read side implemented," documenting the
> "not confirmed to be the same setting" caveat for
> `catra_role`/`license.type`, and cross-referencing the ad-hoc
> Operation Mode fix in the "Settings — other tiles" summary row. The
> write side (license upgrade) is kept explicitly 📋 with its own
> credential-tier caveat.

---

## Group 8 — Manual live verification (read-only only)

### Task 8.1 — Read-only: License panel loads correctly
**Action:** **Before running:** obtain
`APPROVE_LIVE_DEVICE_TEST:2026-09-16-license-mode-settings-read` (no
write token needed anywhere in this plan). Log into the real device
via our own frontend, open System Information, confirm the new
License panel shows correct values matching a direct device query
(maxUsers, device, type, catraRoleEnabled). Confirm no regression on
the existing System Information / Date and Time panels.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** All fields display correctly and match the device's own
values; no regressions elsewhere.
**Fail:** Any regression, wrong data, or console error.

**Status:** `[x]`
**Verification result:**
> Manual, via chrome-devtools-mcp against the real device
> (192.168.2.156), token `APPROVE_LIVE_DEVICE_TEST:2026-09-16-license-mode-settings-read`
> pasted by the user. Logged into our own frontend (session had expired
> from the Group 4 backend restart -- re-logged in), opened System
> Information: existing System Information and Date and Time panels
> still showed correctly (no regression), and the new "License" panel
> rendered all 4 `LicenseInfo` fields with real device values
> (`maxUsers: 200000`, `device: 0`, `type: 0`, `catraRoleEnabled:
> false` -- exactly matching the already-`LIVE_CONFIRMED` values from
> spec.md Background). Console showed 3 pre-existing `400` errors on
> `/users/1,7,8/image` -- unrelated to this plan (those 3 users simply
> have no enrolled face photo: a leftover test user and the two ad-hoc
> import failures from earlier in this session's conversation), not a
> regression.

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing,
already-working files (no new files this plan). Revert via
`git diff`/`git checkout --` against this plan's own changes if needed
(check `git status` first per standing safety practice).
