# Spec — Giai đoạn 4: Frontend (plain HTML/CSS/JS, no framework/build step)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.

---

## Goal

Build a single-page, plain HTML/CSS/JS frontend (no framework, no
build step, no npm) covering everything `amico_backend` (Giai đoạn 3)
already exposes: **Users** (list/create/edit/remove, groups, cards,
profile image, Administrator flag, PIN), **Access Logs** (list), and
**System Information** (single view). Served as static files directly
by `amico_backend` itself — one process, one port, same-origin (no
CORS, no second server to run).

**Done looks like:** opening `http://<backend-host>:<port>/` in a
browser shows a Users table matching the original request's column set
(Image, Id, Name, Employee ID, Password, Start/End Date/Time, Nº of
Groups, Nº of Cards, Face, Last Access Date/Time, Administrator, Edit,
Remove), with working Add/Edit/Remove, group/card management, image
upload (any common format, converted to JPEG client-side), and PIN set
— plus tabs for Access Logs and System Information. Every write action
the backend gates behind `X-Confirm-Sensitive-Action` (Administrator,
password) requires an explicit confirmation dialog in the UI before
the request is sent — the frontend does not silently pre-supply that
header.

---

## Background

Giai đoạn 3 built `amico_backend`: a thin, stateless HTTP/JSON proxy
exposing 16 routes (see `docs/backend-api.md`), with two accepted,
tested technical guardrails (network-exposure opt-in, sensitive-action
confirmation header) but explicitly no authentication layer of its
own. User's explicit choices for this plan (2026-09-13):
- **Stack:** plain HTML/CSS/JS, no framework, no build step.
- **Scope:** Users (full) + Access Logs + System Information — every
  capability the backend already has, no more.

---

## Design decisions

### Decision 1 — Hosting: served as static files by `amico_backend` itself
- **Chosen:** Extend `backend/main.cpp` with
  `svr.set_mount_point("/", frontendDir)` (a `cpp-httplib` built-in
  feature — no new dependency), where `frontendDir` defaults to
  `./frontend` relative to the working directory, overridable via a
  new `BACKEND_FRONTEND_DIR` env var. Opening the backend's own root
  URL in a browser serves `frontend/index.html` directly; all API
  calls from the page's JS are same-origin (`fetch("/users")`, etc. —
  no CORS configuration needed at all).
- **Why:** "No build step" only works cleanly if there's also no
  second server to run/configure — reusing the backend's own listener
  keeps the whole stack to one process, one port, zero new
  infrastructure. Matches the user's explicit simplicity choice.
- **Rejected alternatives:** A separate static file server (e.g.
  Python's `http.server`) — rejected, adds a second process and a CORS
  configuration burden for no benefit — opening `index.html` directly
  via `file://` — rejected, `fetch()` calls to the backend would still
  need CORS handling, and relative paths behave inconsistently under
  `file://`.

### Decision 2 — Structure: one HTML shell, tab-switching via JS, no routing library
- **Chosen:** `frontend/index.html` (nav + 3 tab containers: Users,
  Access Logs, System Information — hidden/shown via a small JS
  function, not separate page loads), `frontend/style.css`,
  `frontend/app.js` (shared fetch/error-display helpers),
  `frontend/users.js`, `frontend/access-logs.js`,
  `frontend/system-info.js` (one tab's logic each).
- **Why:** A true single-page app without a framework still needs
  *some* structure — plain tab-visibility toggling avoids needing a
  router while keeping each tab's code in its own file (not one giant
  script).
- **Rejected alternatives:** True multi-page (separate `.html` files
  per tab, real page loads) — rejected, would need to duplicate the
  nav markup on every page and re-fetch shared state; a bundler
  (webpack/esbuild/vite) — rejected, directly contradicts "no build
  step."

### Decision 3 — Image upload: client-side JPEG conversion (mirrors the real AMICO UI's own technique)
- **Chosen:** The Edit-user modal's image picker reads the selected
  file via `<input type="file">` → `Image`/`canvas` → 
  `canvas.toDataURL("image/jpeg", 0.92)` → decode the base64 payload to
  raw bytes → `fetch(".../image", {method: "PUT", body: bytes,
  headers: {"Content-Type": "image/jpeg"}})`. This is the exact
  technique already reverse-engineered from the real AMICO device's
  own web UI (`docs/ui-action-protocol-map.md`'s Image section,
  `en_US/js/CID.js`'s `UploadFoto`/`GeraBytesFotos`) — not invented
  here, ported directly since the backend's `PUT .../image` route
  requires JPEG bytes regardless of the uploaded file's original
  format (`amico_backend`'s own confirmed requirement).
- **Why:** Without this conversion, uploading a PNG (as the user's own
  earlier sample photos were) would be rejected by the device with a
  400 — already proven live in Giai đoạn 2b. Reusing the exact
  browser-native technique the real device's own UI uses is the
  simplest correct option, needing no image-processing library.
- **Rejected alternatives:** Requiring the operator to pre-convert
  images to JPEG themselves outside the browser (rejected — poor UX for
  a feature the browser can do natively) — server-side conversion in
  `amico_backend` (rejected — SDK/backend intentionally does no image
  processing, per Giai đoạn 3's own scope boundary).

### Decision 4 — Sensitive actions: a real confirmation dialog, not a silently-included header
- **Chosen:** The Administrator toggle and the "Set PIN" action both
  show a native `window.confirm("...")` dialog naming the exact action
  before sending the request; only if the user clicks OK does the
  frontend's `fetch()` call include `X-Confirm-Sensitive-Action: yes`.
  Declining sends no request at all.
- **Why:** Giai đoạn 3's backend guardrail exists specifically to
  prevent *accidental* invocation of these two actions — a frontend
  that always attaches the header regardless of user intent would
  silently defeat that guardrail's entire purpose. The confirmation
  dialog is what makes the header meaningful.
- **Rejected alternatives:** Always sending the header (defeats the
  guardrail's purpose, rejected outright) — a custom modal instead of
  `window.confirm()` (rejected for this MVP — plain `confirm()` is
  built into every browser, needs no extra markup/CSS, and is
  sufficient for "did you mean to do this").

### Decision 5 — No frontend-side authentication
- **Chosen:** The frontend adds no login screen and no session
  handling of its own — it inherits `amico_backend`'s own trust
  boundary exactly (see `docs/backend-api.md`'s security section):
  whoever can reach the backend's bound address can use the frontend
  and call every route, with no additional login step.
- **Why:** Consistent with Giai đoạn 3's own explicit, already-accepted
  security posture — adding a frontend-only login would be security
  theater (it wouldn't protect the underlying API, which has no auth
  of its own either) and was not requested.
- **Rejected alternatives:** A frontend login screen — rejected, would
  imply a false sense of protection the backend doesn't actually
  provide.

### Decision 6 — Error display: a visible, dismissible banner, not just `console.log`
- **Chosen:** Every failed `fetch()` call displays the backend's
  `{"error": "...", "type": "..."}` body in a small banner element at
  the top of the page (dismissible, auto-hides on the next successful
  action). Password/PIN fields and their error paths never echo the
  submitted value back into this banner or anywhere else in the DOM.
- **Why:** A user-facing tool needs visible errors, not developer-console-only
  ones; the password exclusion matches the SDK/backend's own
  never-log/never-echo boundary.

---

## Scope

### In scope
- `frontend/index.html`, `frontend/style.css`, `frontend/app.js`,
  `frontend/users.js`, `frontend/access-logs.js`,
  `frontend/system-info.js`.
- `backend/main.cpp` extended with `set_mount_point` (Decision 1) and
  the new `BACKEND_FRONTEND_DIR` config option in `BackendConfig.hpp`.
- **Users tab:** table with the confirmed column set (Image thumbnail
  via `imageUrl`, Id, Name, Employee ID/`registration`, Password →
  `hasPassword` shown as a yes/no indicator — never the value, Start/
  End Date/Time — read-only display, Nº of Groups/`groupCount`, Nº of
  Cards/`cardCount`, Face/`faceCount`, Last Access Date/Time, 
  Administrator/`isAdministrator`, Edit, Remove). Add-user form (name +
  registration). Edit modal: name/registration fields, group add/
  remove (by id — a simple numeric input, no group-name lookup UI in
  this MVP), card add/remove (areaCode + cardNumber inputs), image
  upload/remove (Decision 3), Administrator toggle (Decision 4), PIN
  set (Decision 4) — no PIN read-back anywhere, ever.
- **Access Logs tab:** table (id, time, userId, portalId, logTypeId,
  event), with `from`/`to`/`limit` filter inputs mapping to the
  backend's query params.
- **System Information tab:** a read-only key/value display of every
  field the backend's `/system-information` route returns.
- A shared error-banner component (Decision 6) and a shared `fetch`
  wrapper (`app.js`) that parses the backend's error shape uniformly.
- Manual test checklist (this frontend has no automated test framework
  in scope — see Risks) run against the real backend + real device,
  once, under the existing live-test gating convention.

### Out of scope (explicitly excluded)
- **Any build tooling** (npm, bundler, TypeScript, transpilation) —
  the user's own explicit choice.
- **A frontend-side login/auth system** — Decision 5; would be
  security theater given the backend's own posture.
- **Real-time updates** (WebSocket/SSE for Access Logs) — the backend
  has no such route; polling/manual-refresh only.
- **Automated frontend tests** (no test framework, no headless browser
  harness) — this plan relies on a manual test pass instead (see
  Risks); a dedicated frontend-testing plan could be proposed later if
  this becomes a maintenance burden.
- **Group-name / card-list lookup UI** (e.g. a dropdown of existing
  groups by name rather than typing a numeric id) — the backend has no
  "list groups" route to back this (only `AccessLogsApi`/`UsersApi` are
  exposed); out of scope without a new backend route, which is its own
  decision if ever needed.
- **Mobile-specific responsive design polish** — basic usability at
  common desktop widths only for this MVP.
- **Widening `amico_backend`'s bind address for remote frontend
  access** — this plan does not change Giai đoạn 3's security posture;
  the frontend is served from and reaches the same `127.0.0.1`-bound
  backend by default, same as always.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `frontend/index.html` | Create | Page shell, nav, 3 tab containers |
| `frontend/style.css` | Create | Minimal styling |
| `frontend/app.js` | Create | Shared fetch wrapper + error banner |
| `frontend/users.js` | Create | Users tab: table, add/edit/remove, groups/cards/image/administrator/password |
| `frontend/access-logs.js` | Create | Access Logs tab: table + filters |
| `frontend/system-info.js` | Create | System Information tab: read-only display |
| `backend/main.cpp` | Modify | Add `svr.set_mount_point("/", frontendDir)` |
| `backend/BackendConfig.hpp` | Modify | Add `BACKEND_FRONTEND_DIR` config (default `"./frontend"`) |
| `docs/backend-api.md` | Modify | Note the static-file serving addition |
| `docs/src-map.md` | Modify | Add rows for `frontend/` files |

---

## Risks and unknowns

- **No automated test coverage for the frontend itself** — this is a
  real, accepted gap for this MVP (no framework/build step means no
  natural place to run a headless-browser test suite without adding
  exactly the tooling the user asked to avoid). Mitigated by a
  thorough manual test checklist run once against the real backend +
  device before sign-off — but regressions in future edits to
  `frontend/*.js` will not be caught automatically.
- **Image conversion correctness depends on the browser's own
  `canvas`/`toDataURL` implementation** — already proven correct via
  Giai đoạn 2b's live JPEG upload test, but this plan re-implements the
  same technique independently in `frontend/users.js`, so it needs its
  own live verification, not just an assumption it'll match.
- **`set_mount_point`'s exact behavior (e.g. path traversal protection,
  MIME-type inference) is assumed from `cpp-httplib`'s general design,
  not yet read line-by-line** — Task 0.1 verifies this against the
  actual installed header before relying on it.

---

## Open questions

- [ ] None blocking — Task 0.1 (`set_mount_point` API confirmation) is
      a discovery task, not a design ambiguity.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal is a working page in a browser, testable end-to-end |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items, each reasoned |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | New `frontend/` directory kept separate; only 2 small backend edits |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Every tab/action traces directly to an existing backend route |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
