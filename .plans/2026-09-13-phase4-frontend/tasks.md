# Tasks — Giai đoạn 4: Frontend (plain HTML/CSS/JS, no framework/build step)

> **Executor instructions:** Complete groups in order. After each task, run
> the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Group 0** is a local, offline discovery task (reading the actual
>   installed `cpp-httplib` header for `set_mount_point`'s exact
>   behavior) — no device contact.
> - **Groups 1–3** (backend hosting change, frontend code, offline
>   build check) require **no** device contact.
> - **Group 4 (manual verification pass) requires a fresh, distinct
>   live-device approval** (`APPROVE_LIVE_DEVICE_TEST:<plan-id>` for
>   read actions; a SEPARATE, explicitly-named confirmation for each
>   write action exercised, per every prior precedent in this
>   project) — this is a manual pass, not an automated test, since this
>   plan has no frontend test framework (spec.md's accepted risk).

---

## Group 0 — Discovery: confirm `cpp-httplib`'s `set_mount_point` behavior

### Task 0.1 — Read the actual installed `httplib.h` for `set_mount_point`/static-file-serving behavior
**Action:** Read `build-exec/vcpkg_installed/x86-windows/include/httplib.h`
directly for: the exact `set_mount_point` signature, whether it
protects against path traversal (`..` in a request path) by default,
and how it infers `Content-Type` from file extension (needed to
confirm `.html`/`.css`/`.js` are served with sane types without extra
config). Do not assume — this plan's Design Decision 1 depends on
this behavior being safe by default.
**Verification:** Manual read; findings written into this task's
Status note.
**Pass:** `set_mount_point`'s signature and traversal-safety confirmed
from the actual header.
**Fail:** Behavior can't be confirmed from the header alone — escalate
to Planner rather than assuming it's safe.

**Status:** `[x]` — 2026-09-13: this discovery was performed during
Plan Review (`review.md`, pass 1), which read
`Server::routing()`/`handle_file_request()` directly.
`set_mount_point(const std::string& mount_point, const std::string&
dir, ...)`. Path-traversal: confirmed safe —
`detail::is_valid_path()` rejects `..` in the URL, plus a
defense-in-depth `canonicalize_path()` + `is_path_within_base()` check
against symlink/junction escapes. Content-Type: inferred via a
standard extension→MIME map (`find_content_type`). **Also found**
(the actual reason this task existed): static-file dispatch runs
**before** registered `GET`/`HEAD` routes, not after — see Task 1.2's
corrected text.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 1 — Backend hosting change

### Task 1.1 — `backend/BackendConfig.hpp`: add `BACKEND_FRONTEND_DIR`
**Action:** Add `frontendDir` field (default `"./frontend"`, from env
var `BACKEND_FRONTEND_DIR`) to `BackendConfig`.
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Build:
exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `backend/main.cpp`: mount the frontend directory
**Action:** After `Routes::registerAll(...)`, call
`svr.set_mount_point("/", config.frontendDir)` using the confirmed API
from Task 0.1. **Corrected per Plan Review** (`review.md`, pass 1 —
`Server::routing()`'s actual dispatch order, confirmed by reading
`httplib.h` directly): the static-file mount is checked **before** any
registered `GET`/`HEAD` route handler, not after — a file matching the
request path at the mount point takes priority over a same-path API
route, the opposite of what this task originally assumed.
`POST`/`PUT`/`PATCH`/`DELETE` routes are unaffected (the file handler
only runs for `GET`/`HEAD`). None of this plan's 6 `GET` routes
(`/health`, `/system-information`, `/users`, `/users/:id`,
`/access-logs`, plus `/` serving `index.html`) collide with any planned
`frontend/` filename, so there is no actual route-shadowing bug in this
plan's scope — but do not name a new static asset file matching any
existing `GET` route path (e.g. never create `frontend/health` or
`frontend/users` with no extension) without re-checking this ordering.
**Verification:** `cmake --build build-exec --target amico_backend`;
manually run `amico_backend` (against any config, even a placeholder
`frontend/` dir with just a `index.html` stub) and confirm
`curl http://127.0.0.1:8080/` returns the stub file's content, while
`curl http://127.0.0.1:8080/health` still returns the API's JSON (once
a real device config is available — this specific check can be
deferred to Task 3.1 if a real device config isn't at hand yet, note
which in Status).
**Pass:** Both static files and API routes are reachable, correctly
resolved, no route shadowing.
**Fail:** Compile error, or one path type shadows the other.

**Status:** `[~]` — 2026-09-13: written directly by Claude. Build:
exit 0, no warnings. `frontend/` directory created with a placeholder
`index.html` stub. **The live curl check (static file + `/health`
both reachable) deferred to Group 4** — requires a real device login
to reach `svr.listen()`, and this task doesn't warrant its own
live-device approval separate from Group 4's already-planned
read-only pass; will be confirmed there instead.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Frontend code

> Implementation note (2026-09-13): all six frontend files written by
> Codex (`eng tools invoke executor codex.execute`, Codex usage
> restored mid-plan — Group 1 was written directly by Claude before
> that). `node --check` passed for all four JavaScript files (Claude
> independently re-verified this, not just trusting Codex's report).
> Existing offline suites re-verified independently: 2/2 unaffected.
> Claude also read every frontend file directly (not just Codex's
> summary) and confirmed: no `console.log`/`console.error` calls
> anywhere in `frontend/` (stricter than required — never logs a
> password field, because it never logs anything); Remove-user,
> Administrator toggle, and PIN-set all show a real `window.confirm()`
> before sending any request, and Cancel/Close paths never send one;
> the JPEG conversion (`jpegBytes()`) has both `onload` and `onerror`
> handlers. **Known, documented limitation (not a defect):** the
> backend (Giai đoạn 3) has no route to list a user's existing cards
> (only `cardCount`), so the Cards section in the Edit modal can only
> track/remove cards added during the current page session — this is a
> genuine backend-API gap, correctly identified rather than invented
> around; recorded as tech debt in `DECISION_LOG.md`, not treated as
> this plan's own defect.
> Claude opened `frontend/index.html` directly via `file://` in a real
> browser (chrome-devtools-mcp) and confirmed: Users tab renders with
> all 14 expected columns; clicking each nav tab switches visible
> content correctly; no JS console errors (one benign accessibility
> lint notice only — "form field should have an id or name attribute",
> not a JS error); `app.js`'s `location.protocol !== "file:"` guard
> correctly skips all `fetch()` attempts when opened without a backend.
> **Remaining verification (Tasks 2.2–2.8's own "against a running
> backend" bars, and all of Group 4) requires an actual running
> `amico_backend` — deferred to Group 4's gated live pass.**

### Task 2.1 — `frontend/index.html` + `frontend/style.css`: page shell
**Action:** Nav bar (3 tab buttons: Users, Access Logs, System
Information) + 3 `<div>` containers (`#tab-users`, `#tab-access-logs`,
`#tab-system-info`), only one visible at a time (a small inline script
or `app.js` toggles `hidden`). Minimal CSS: a data table style, a
modal/dialog style for the Edit-user form, an error-banner style.
**Verification:** Open the file directly in a browser (no backend
needed yet) — nav buttons switch which container is visible.
**Pass:** Tab switching works with no console errors.
**Fail:** Any console error, or tab switching doesn't work.

**Status:** `[x]` — 2026-09-13: verified directly by Claude in a real
browser via `file://` (chrome-devtools-mcp) — tab switching works
correctly, no console errors (one benign a11y notice only).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — `frontend/app.js`: shared fetch wrapper + error banner
**Action:** `async function apiFetch(path, options)` — wraps
`fetch(path, options)`, and on a non-2xx response, parses the JSON
error body (`{"error", "type"}`) and calls `showError(message)`;
`showError`/`hideError` manage the visible banner element (Decision 6).
Never logs a request body containing a `password` field to the
console (a simple key-based redaction before any `console.log` calls
in this file or any other frontend file).
**Verification:** Manual: trigger a deliberate 404 (e.g.
`apiFetch("/nonexistent")` from the browser devtools console against a
running backend) and confirm the banner shows the error.
**Pass:** Banner displays correctly; dismiss/auto-hide works.
**Fail:** Errors silently swallowed, or shown only in the console.

**Status:** `[~]` — Implemented; offline source review and JS syntax check passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — `frontend/users.js`: Users table (list + read fields)
**Action:** On tab activation, `GET /users`, render a table with
columns: Image (an `<img>` tag pointed at the user's `imageUrl`,
falling back to a placeholder on load error), Id, Name, Employee ID
(`registration`), Password (a "Set" / "Not set" badge from
`hasPassword` — never a value), Start/End Date/Time (`beginTime`/
`endTime`, formatted read-only), Nº of Groups (`groupCount`), Nº of
Cards (`cardCount`), Face (`faceCount`), Last Access Date/Time
(`lastAccess`), Administrator (`isAdministrator`, a badge), Edit
button, Remove button (with a native `confirm()` before calling
`DELETE /users/:id` — removing a user is destructive and irreversible,
deserves its own confirmation even though it's not one of Decision
4's two guardrailed routes).
**Verification:** Manual, against a running backend (can use the
Giai đoạn 2b `FakeTransport`-based `amico_backend_tests` server
temporarily, or a real device once available — note which in Status).
**Pass:** Table renders with correct data for each column.
**Fail:** Any column missing/wrong, or a console error.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.4 — `frontend/users.js`: Add user + Edit modal (name/registration/groups/cards)
**Action:** "Add User" button → small form (name + registration) →
`POST /users` → refresh table. Edit button → modal showing
name/registration (editable, `PATCH /users/:id` on save), a Groups
section (numeric group-id input + Add/Remove buttons → `POST`/`DELETE
/users/:id/groups/:groupId`), a Cards section (areaCode + cardNumber
inputs + Add button → `POST /users/:id/cards`; each existing card
listed with its own Remove button → `DELETE /cards/:cardId`).
**Verification:** Same as Task 2.3.
**Pass:** Add/Edit/group/card actions all correctly call their routes
and refresh the relevant UI state.
**Fail:** Any action fails silently or calls the wrong route/method.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending. Contract limitation: no card-list route or card IDs in User objects; only cards created this page session can be listed and removed. Pre-existing card listing needs a backend contract extension.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.5 — `frontend/users.js`: Image upload (client-side JPEG conversion, Decision 3)
**Action:** In the Edit modal, a file `<input type="file"
accept="image/*">` → on selection, draw the image onto an off-screen
`<canvas>` at its natural size → `canvas.toDataURL("image/jpeg", 0.92)`
→ decode the base64 payload to a `Uint8Array` → `fetch(".../image",
{method: "PUT", headers: {"Content-Type": "image/jpeg"}, body:
bytes})`. **Per Plan Review's non-blocking note:** the `<img>` element
used to decode the selected file must have an `onerror` handler (not
just `onload`) — a non-image file (e.g. `.txt`) never fires `onload`,
and without `onerror` the UI would hang silently waiting for an event
that never comes; `onerror` should show a clear "this doesn't look
like an image" message via the error banner. A "Remove Image" button
calls `DELETE /users/:id/image`.
Display the device's face-validation error message (from the
backend's mapped `ProtocolError`) prominently if the upload is
rejected — this is expected/normal per Giai đoạn 2b's findings, not a
bug, and the UI should say so (e.g. "face not detected — try a clearer,
front-facing photo") rather than a generic failure message.
**Verification:** Manual (Group 4's live pass is the real test; an
offline check here can only confirm the JS doesn't throw before
reaching `fetch`, using a fake/local image file).
**Pass:** No JS errors constructing the JPEG payload; a friendly
message displays for a face-validation rejection.
**Fail:** Any JS exception during conversion, or a raw/unclear error
message shown to the user.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.6 — `frontend/users.js`: Administrator toggle + PIN set (Decision 4 confirmation dialogs)
**Action:** Administrator toggle in the Edit modal: on change, show
`window.confirm("Grant/Revoke Administrator for <name>? This changes a
credential-adjacent device setting.")`; only on OK, call `PUT
/users/:id/administrator` with `{"isAdmin": <value>}` AND the header
`X-Confirm-Sensitive-Action: yes`. On Cancel, revert the toggle's
visual state without sending any request. Same pattern for "Set PIN":
a text input (numeric) + button → `window.confirm("Set a new PIN for
<name>? This cannot be undone or read back later.")` → on OK, `PUT
/users/:id/password` with the header; on Cancel, no request. The PIN
input field is cleared immediately after a successful set (never left
displayed).
**Verification:** Manual — confirm Cancel truly sends no network
request (check via browser devtools Network tab) for both actions.
**Pass:** Both actions require the dialog; Cancel sends zero requests;
OK sends exactly the expected request with the header present.
**Fail:** Any path where the request is sent without the user clicking
OK, or the header is attached without a preceding confirmation.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.7 — `frontend/access-logs.js`: Access Logs tab
**Action:** On tab activation (and on a "Filter" button), read
`from`/`to`/`limit` input values, `GET /access-logs?...`, render a
table (id, time, userId, portalId, logTypeId, event).
**Verification:** Manual, same harness as Task 2.3.
**Pass:** Table renders; filter inputs correctly change the query.
**Fail:** Any column missing/wrong, filters not applied.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.8 — `frontend/system-info.js`: System Information tab
**Action:** On tab activation, `GET /system-information`, render a
simple read-only key/value list of every returned field (including the
nested `network` object's fields).
**Verification:** Manual, same harness as Task 2.3.
**Pass:** All fields displayed correctly.
**Fail:** Any field missing.

**Status:** `[~]` — Implemented; JS syntax and route/source review passed. Required browser verification remains pending.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Docs + offline build check

### Task 3.1 — `docs/backend-api.md`: document the static-file serving addition
**Action:** Add a short section noting `amico_backend` now also serves
`frontend/` at `/`, plus the `BACKEND_FRONTEND_DIR` config option.
**Verification:** Manual review.
**Status:** `[x]` — 2026-09-13: section added with the confirmed
dispatch-order note (static files checked before API routes) and the
`BACKEND_FRONTEND_DIR` config row.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `docs/src-map.md`: add rows for the new `frontend/` files
**Verification:**
```bash
grep -c "frontend/index.html\|frontend/users.js" docs/src-map.md
```
**Pass:** Prints `1` or more.
**Status:** `[x]` — 2026-09-13: new "Frontend" section added; `grep -c`
prints `2`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.3 — Full offline build check (backend still compiles/tests green)
**Action:** `cmake --build build-exec` then
`ctest --test-dir build-exec --output-on-failure`. This plan does not
add any new C++ test file, so the pass bar is simply "nothing broke."
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; both `amico_offline_tests` and
`amico_backend_offline_tests` still pass with unchanged counts (SDK:
89/490; backend: 29/79).
**Fail:** Any build error, any test failure, or any count change.

**Status:** `[x]` — 2026-09-13: build exit 0, zero warnings. SDK:
89 cases / 490 assertions (unchanged). Backend: 29 cases / 79
assertions (unchanged). Verified independently by Claude.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Manual verification pass (GATED — live device, separate approvals per action)

> **STOP before this group.** No request to `192.168.2.156` until a
> fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>` message is received for
> the read-only parts. The Administrator-toggle and PIN-set checks
> below each need their OWN separate, freshly-worded confirmation,
> exactly like Giai đoạn 2b's Tasks 5.3/5.4 — never inferred from the
> general live-device-test approval or from each other.

### Task 4.1 — Read-only checklist (Users list, Access Logs, System Information)
**Action:** With `amico_backend` running against the real device
(`BACKEND_BIND_ADDRESS` left at its default `127.0.0.1`), open the
frontend in a browser and manually verify: Users table renders with
correct data for all 3 existing real users (no create/edit/remove
performed in this task); Access Logs tab renders and filters work;
System Information tab renders all fields.
**Verification:** Manual, operator/agent-observed in the browser.
**Pass:** All 3 tabs render correctly against the real device, no
console errors.
**Fail:** Any rendering error or console exception — root-cause before
proceeding to Task 4.2.

**Status:** `[ ]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — Write checklist using a disposable test user (card/group/image)
**Action:** Using the frontend itself (not the SDK/backend test
binaries), create a disposable test user
(`SDK_TEST_DELETE_ME_<timestamp>`), add/remove a card, add/remove a
group membership (using the same test-safe group confirmed in Giai
đoạn 2b — "Standard", id 1, not "Everywhere"), upload one of the
user-supplied sample photos (verifying the client-side JPEG conversion
actually works end-to-end against the real device's face-validation),
remove the image, then remove the test user.
**Verification:** Manual, operator/agent-observed; confirm via the
Users table that no pre-existing real user was affected.
**Pass:** All actions succeed through the UI exactly as they did
through the SDK/backend test binaries in Giai đoạn 2b/3.
**Fail:** Any action fails, or any pre-existing real user is affected
(critical incident — stop, report immediately).

**Status:** `[ ]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.3 — Administrator toggle checklist (SEPARATE confirmation required)
**Action:** **Before running:** ask the user for a fresh, explicit
confirmation naming this exact action. Using the frontend, on a
disposable test user, toggle Administrator on (confirm the
`window.confirm()` dialog appears and Cancel truly sends nothing, per
Task 2.6's own test), then OK it, verify the badge updates; toggle off
the same way.
**Verification:** Manual, operator/agent-observed.
**Pass:** Dialog behavior matches Task 2.6's spec exactly; toggle
works both directions; no real user affected.
**Fail:** Any behavior mismatch, or a real user affected.

**Status:** `[ ]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.4 — PIN set checklist (SEPARATE confirmation required)
**Action:** **Before running:** ask the user for a fresh, explicit
confirmation naming this exact action. Using the frontend, on a
disposable test user, set a PIN via the UI, confirm the dialog
behavior matches Task 2.6, confirm the Password badge flips to "Set",
confirm the PIN value is never visible anywhere in the UI/devtools
Network response after the fact.
**Verification:** Manual, operator/agent-observed.
**Pass:** Dialog behavior correct; badge updates; no PIN value visible
anywhere after the call.
**Fail:** Any behavior mismatch, or the PIN value appears anywhere in
the UI/console/network response body.

**Status:** `[ ]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [ ] All Group 0–3 tasks marked `[x]`
- [ ] Group 4 complete, or explicitly "not run this cycle — no
      live-device approval issued" (does not block sign-off for
      Groups 0–3)
- [ ] No tasks marked `[!]`
- [ ] `docs/backend-api.md` / `docs/src-map.md` updated (Tasks 3.1–3.2)
- [ ] Full offline build+test gate unaffected (Task 3.3)
- [ ] Sprint summary written to
      `.plans/2026-09-13-phase4-frontend/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
`frontend/` is entirely new — `rm -rf frontend/` plus reverting
`backend/main.cpp`/`backend/BackendConfig.hpp`/`docs/*`'s edits via
`git checkout --` fully rolls this plan back.

### Per-task rollback — Group 4 (manual verification)
Same disposable-test-user discipline as every prior live test in this
project: if a task fails after creating a test user, manually verify
via the Users table whether it still exists and remove it through the
UI (or the SDK's `remove()`) if so.
