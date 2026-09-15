# Spec — Visits (Enroll → Visits): list/create/update/remove/finish

---

## Goal

The real AMICO device's sidebar has a dedicated **Visits** page
(`Enroll → Visits`, `visits.html`) — a schedule of visitor visits,
each linking a visitor (a `users` row, `user_type_id = 1`, already
implemented as our own `/visitors`) to a host (a regular `users` row)
with a start/end time window, separate from the `Visitors` page's own
enrollment record. This project implements it: a new `/visits` area in
our own frontend and backend with create/read/update/remove plus a
"Finish visit" action, matching the real device's own confirmed
behavior (see Background).

**Done looks like:** A new "Visits" sidebar tab (nested under Enroll,
alongside Users/Visitors), listing/adding/editing/removing/finishing
visit records with the same columns and General/Cards tab structure
the real device's own Visits page shows.

---

## Background — live evidence (this session)

Every claim below was confirmed live against `http://192.168.2.156`
this session (2026-09-14), not guessed.

- **The `visits` object is not defined where two earlier discovery
  passes looked** (`visits.js`, `visits.html`, `main.js` — all read in
  full, zero hits). It is registered dynamically by
  `en_US/js/class.js` via `CID.createClass({'object':'visits', ...})`
  — `class.js` is loaded unconditionally on every page by `main.js`'s
  second `addScript([...])` call (a different mechanism from the
  per-object `class/*.js` files like `class/user.js`, which `main.js`
  loads separately in its first `addScript([...])` call). This is why
  `users`/`access_logs`/`time_zones` etc. all work as bare globals in
  `index.js` despite never appearing as literal text in `main.js`.
- **Device object `visits` fields** (from `class.js`'s registration,
  cross-checked against `object_metadata.fcgi` and `report_class.js`'s
  independent, narrower field list — all three agree):

  | Field | Type | Notes |
  |---|---|---|
  | `id` | BigInt | PK |
  | `visitor_id` | BigInt | FK → `users` |
  | `host_id` | BigInt | FK → `users` |
  | `begin_time` | date (epoch seconds) | |
  | `end_time` | date (epoch seconds) | `0` = unset/open-ended |
  | `finished` | boolean (0/1) | |

- **Live-captured `create_objects.fcgi` payload** (via a client-side
  XHR interceptor that recorded the exact request body and then failed
  it before it ever reached the network — no real Visit was created;
  confirmed by re-checking the list still showed "No record found"
  afterward):
  ```json
  {"join":"LEFT","object":"visits",
   "fields":["id","visitor_id","host_id","begin_time","end_time","finished"],
   "where":[],"order":["id"],
   "values":[{"visitor_id":56,"host_id":50,"begin_time":1789405080,"end_time":1789466400,"finished":0}]}
  ```
  `visitor_id`/`host_id` are plain ids (not nested objects);
  `begin_time`/`end_time` are epoch seconds the client computed by
  combining separate date+time picker fields before sending — same
  representation `UserUpdate::beginTime`/`endTime` already uses.
- **The live Visits list page's own column headers** (read via
  accessibility snapshot of `visits.html`, `en_US/html/visits.html`,
  after logging in): Visitor, Host, Start Date, Start Time, End Date,
  End Time, Nº of Cards, Concluded, Edit, Remove — confirming the
  General-tab field set above plus a `cards` relationship, and that
  "Concluded" (⇔ `finished`) is a real list-visible column.
- **"Finish visit" business rule** (from `class.js`'s `save()`
  handler, read statically): when a visit is saved with
  `obj.finished === true`, the client:
  1. `destroy_objects.fcgi` on `cards` where
     `cards.user_id == visitor_id` (i.e., revokes every card currently
     issued to that visitor — not scoped to this specific visit).
  2. `destroy_objects.fcgi` on `qrcodes` where
     `qrcodes.user_id == visitor_id` (same revocation, for QR codes —
     **out of scope for this plan**, see Scope: the `qrcodes` object's
     own schema/feature-flag state has not been discovered at all on
     this device, and `class.js` itself guards this behind
     `Main.isQRCodeModeAlpha()`).
  3. Sets `end_time = now` and re-saves the visit with `finished = 1`.
  This is a real device write side-effect (cards actually get
  revoked), not a cosmetic flag flip.
- **A visit's `cards` are the visitor's own `cards` rows**, scoped by
  `defaultWhere: cards.user_id == visitor_id` (`class.js`, same
  registration block) — **not** a new relationship keyed by the
  visit's own id. This means our already-implemented
  `POST /visitors/:id/cards` / `DELETE /cards/:cardId` (id = the
  visitor's user id) can be reused as-is for a Visit's Cards tab; no
  new card-issuance route is needed.
- **Visitor/Host picker widgets** (`users_visitor`/`users_host` fields
  in `class.js`) reference object names `visit_users`/`host_users`
  which are **not** separately `CID.createClass`-registered anywhere in
  the captured `class.js` — they appear to be picker-widget-local
  scoping labels rather than real device objects. This plan's own
  Visitor/Host pickers are UI-level only: Visitor is drawn from our
  existing `GET /visitors` list, Host from our existing `GET /users`
  list. Nothing at the API layer enforces that a "Visitor" must
  actually be a `user_type_id = 1` row — flagged in Risks.
- **Not live-captured**: the `modify_objects.fcgi` payload for editing
  an existing visit (only `create_objects.fcgi` was captured this
  session — see Risks). Inferred by symmetry with the confirmed create
  shape and this codebase's existing `buildUserUpdateBody` convention
  (bare-object `values` + scalar `where.id`).

---

## Design decisions

### Decision 1 — New `VisitsApi` SDK class, not folded into `UsersApi`
- **Chosen:** `AmicoClient::VisitsApi` with `list()`, `get()`,
  `create()`, `update()`, `remove()`, `finish()`. New types `Visit`,
  `NewVisit`, `VisitUpdate`, `VisitQuery` in `include/amico/Types.hpp`.
- **Why:** `visits` is a genuinely distinct device object (its own PK,
  its own fields) — unlike Visitors (which really is the same `users`
  object with a filter, per that plan's own Decision 1), there is no
  shared-object argument for folding this into `UsersApi`. Card
  issuance for a visit's visitor is reused via the *existing*
  `UsersApi::addCard()`/`removeCard()` (Decision 3) rather than
  duplicated.
- **Rejected alternatives:** A generic object-agnostic CRUD class
  usable for any device object — rejected as out of scope; this
  codebase's established pattern (`docs/ui-action-protocol-map.md`'s
  security rationale) is one hardcoded, evidence-backed query builder
  per confirmed shape, never a caller-supplied object/field name.

### Decision 2 — `Visit`'s `visitorName`/`hostName`/`cardCount` are enrichment fields, reusing existing SDK methods
- **Chosen:** `VisitsApi::list()`/`get()` populate `visitorName`/
  `hostName` via the **existing** `UsersApi::getNamesByIds()` (already
  built for the Access Logs report's user-name join — zero new query
  builder needed for this), and `cardCount` via the **existing**
  `detail::buildCardCountBody(visitorId)` (already used by
  `AmicoUser::cardCount`).
- **Why:** The live column headers (Visitor, Host, Nº of Cards) show
  names/counts, not raw ids — resolving them is a real product
  requirement, not scope creep, and both lookups are already-proven,
  already-tested code paths. Reusing them avoids a second, divergent
  "resolve a user id to a name" implementation.
- **Rejected alternatives:** Returning raw ids only and pushing
  name/count resolution to the frontend (extra round-trips per row,
  and a second, divergent name-lookup implementation in JS) —
  rejected; the backend already has a batched, tested mechanism for
  exactly this.

### Decision 3 — Visit's Cards tab reuses `/visitors/:id/cards`, no new route
- **Chosen:** The frontend's Visit modal's Cards tab issues/revokes
  cards via the already-existing `POST /visitors/:visitorId/cards` /
  `DELETE /cards/:cardId`, using the visit's own `visitorId` — not a
  new `/visits/:id/cards` route.
- **Why:** Per Background, the real device itself scopes a visit's
  "Cards" tab by `cards.user_id == visitor_id` — cards belong to the
  visitor (a `users` row), not to the visit row. Building a parallel
  `/visits/:id/cards` route would either duplicate the existing one or
  require an extra indirection lookup for no behavioral difference.
- **Rejected alternatives:** A new `/visits/:id/cards` route — rejected
  as pure duplication of `/visitors/:id/cards` with identical
  semantics.

### Decision 4 — `finish()` is a dedicated SDK method and route, not part of generic `update()`
- **Chosen:** `VisitUpdate` has no `finished` field at all.
  `VisitsApi::finish(id)` is a separate method: (1) `get(id)` to read
  `visitorId`, (2) a new `buildVisitorCardsDeleteBody(visitorId)`
  query (`destroy_objects.fcgi` on `cards` where `user_id == visitorId`
  — the literal shape captured in `class.js`'s `save()`, see
  Background), (3) `modify_objects.fcgi` setting `finished = 1` and
  `end_time = <now>` via a new, update()-independent query builder.
  `POST /visits/:id/finish` is the one HTTP route for this.
- **Why:** `finished = true` is not a plain field edit — it has a real,
  destructive device-side side effect (revoking the visitor's cards).
  Exposing it as just another optional field on `VisitUpdate` would let
  a caller flip it silently as part of an unrelated date edit, with no
  signal that cards are about to be revoked — the same reasoning this
  codebase already applies to `setAdministrator()`/`setPassword()`
  being separate, deliberate methods rather than fields on a generic
  update.
- **QR codes are explicitly out of scope** (see Scope) — `finish()`
  only clears `cards`, matching the confirmed evidence for what this
  plan can respons­ibly implement; documented as a known gap if this
  device's QR-code mode is ever enabled.
- **Rejected alternatives:** A `finished` field on `VisitUpdate` — the
  device's own client code doesn't treat it as a plain field either
  (its `save()` special-cases it with real side effects), so mirroring
  that as a plain optional field would misrepresent the operation's
  actual weight.

### Decision 5 — Dedicated `frontend/visits.js`, not the Users/Visitors shared factory
- **Chosen:** A new, standalone `frontend/visits.js` — not a third
  call site of `initUserListPage()`. It reuses smaller existing
  helpers (`element()`, `runAction()`, `booleanIcon()`) and the
  existing card-issuance sub-form logic (extracted into a small shared
  helper, see Task 5.1), but has its own table columns and its own
  modal layout (Visitor/Host pickers, Start/End Date+Time, no
  Face/PIN/Administrator).
- **Why:** `initUserListPage()`'s factory (Visitors plan, Decision 4)
  was built specifically for the ~95%-identical Users/Visitors shape
  (same object, same tabs). Visits has a materially different modal
  (two user-picker fields instead of Name/Employee ID, no photo panel,
  no PIN/Administrator, a `finished`/"Finish visit" action with no
  Users/Visitors equivalent) — forcing it through that factory would
  need so many one-off escape hatches that the factory itself would
  stop being the simple, single shared shape it currently is.
- **Rejected alternatives:** Extending `initUserListPage()` with more
  config flags to also cover Visits — rejected; the two page shapes
  have diverged enough that a shared factory would trade one kind of
  duplication (a second file) for another (a factory riddled with
  Visits-only conditionals that Users/Visitors never use).

---

## Scope

### In scope
- SDK: `Visit`/`NewVisit`/`VisitUpdate`/`VisitQuery` types; new
  `VisitsApi` (`list`, `get`, `create`, `update`, `remove`, `finish`);
  new query builders for `visits` create/get/list/update/delete and
  for the visitor-cards-cleanup step of `finish()`.
- Backend: `/visits` route family — `GET /visits`, `GET /visits/:id`,
  `POST /visits`, `PATCH /visits/:id`, `DELETE /visits/:id`,
  `POST /visits/:id/finish`.
- Frontend: new `frontend/visits.js` (list + Add/Edit modal with
  General/Cards tabs, Finish action), new "Visits" entry in the
  Enroll sidebar group (after Visitors).
- Tests: `test/test_visits.cpp` (SDK-level, fake-transport-backed),
  `test/backend/test_routes.cpp` additions for `/visits/*`.
- Docs: `docs/backend-api.md` (new `/visits` section),
  `docs/api-roadmap.md` (mark Visits ✅ Implemented, replacing
  section 6b's current 📋 Planned state).
- Live verification of the one gap this session's discovery didn't
  cover: the `modify_objects.fcgi` payload for a plain (non-finish)
  edit of an existing visit (capture via the same safe XHR-interceptor
  technique before relying on it, or confirm during Group 8's gated
  write test).

### Out of scope
- **QR codes** (`qrcodes` tab/object) — this device's QR-code mode
  (`Main.isQRCodeModeAlpha()`) and the `qrcodes` object's own schema
  have not been discovered at all; `finish()` only revokes `cards`
  (Decision 4). If QR mode is ever enabled on this device, revoking
  QR codes on finish is a separate, not-yet-scoped follow-up.
- **`c_visits` custom fields** — a generic custom-fields mechanism
  (same shape as Visitors' `c_users`/CPF), but with no confirmed custom
  columns configured on this device today; tracked separately under
  `docs/api-roadmap.md`'s existing, not-yet-discovered "Custom Fields"
  item, not duplicated here.
- **Search/filter controls on the Visits list** — the real device's
  own filters (visitor's name, visitor's id, visitor's card via
  Wiegand facility/card decode) are documented (see Background) but
  not wired into this plan's list endpoint; `GET /visits` supports only
  `limit`/`offset`, matching the minimal-viable-CRUD scope of this
  plan.
- **History of finished visits** — the real device's own list defaults
  to `finished != 1` (active/upcoming only); this plan's `GET /visits`
  matches that default exactly and adds no "show all" toggle.
- **Enforcing that "Visitor"/"Host" pickers only accept the intended
  user type at the API layer** — the frontend only *offers* `/visitors`
  rows for Visitor and `/users` rows for Host; nothing in
  `POST /visits`/`PATCH /visits/:id` rejects an arbitrary user id for
  either field (see Risks).

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | New `Visit`/`NewVisit`/`VisitUpdate`/`VisitQuery` types |
| `include/amico/Client.hpp` | Modify | New `VisitsApi` class + `visits()` accessor |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | New `visits`/visitor-cards-cleanup query builders |
| `src/Client.cpp` | Modify | Implement `VisitsApi` methods, including `finish()`'s 2-step sequence |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | Serialize `Visit`, parse `NewVisit`/`VisitUpdate` request bodies |
| `backend/Routes.cpp` | Modify | New `/visits/*` route family |
| `frontend/visits.js` | New | Visits page: list, Add/Edit modal (General/Cards), Finish action |
| `frontend/index.html` | Modify | New "Visits" sidebar entry under the Enroll group; new `<div id="tab-visits">`; new `<script>` tag |
| `frontend/style.css` | Modify | Only if Visitor/Host picker or the Finish button need anything beyond existing shared styling (expected: minimal) |
| `CMakeLists.txt` | Modify | Add `test/test_visits.cpp` to `amico_tests`'s source list |
| `test/test_visits.cpp` | New | SDK-level tests for the new query builders/types/`VisitsApi` |
| `test/test_query_whitelist.cpp` | Modify | Cover the new query builders' whitelisted fields |
| `test/backend/test_routes.cpp` | Modify | Cover the new `/visits/*` routes |
| `docs/backend-api.md` | Modify | Document `/visits/*` |
| `docs/api-roadmap.md` | Modify | Mark Visits (section 6b) ✅ Implemented |

---

## Risks and unknowns

- **`modify_objects.fcgi`'s exact payload for a plain visit edit was
  not live-captured this session** (only `create_objects.fcgi` was).
  `buildVisitUpdateBody` is written by symmetry with the confirmed
  create shape and this codebase's existing `buildUserUpdateBody`
  convention — to be confirmed via the same safe XHR-interceptor
  technique (or the gated live write test) before final sign-off.
- **No device-side enforcement that "Visitor" must be a
  `user_type_id = 1` row, or that "Host" must not be one** — this
  plan's pickers only *offer* the intended lists; a caller hitting the
  raw API directly could set either to any user id. Documented, not
  fixed — matches this project's existing "don't invent server-side
  validation the real device itself doesn't have" discipline.
- **`finish()` only revokes `cards`, not `qrcodes`** — see Scope.
  Acceptable now (QR mode unconfirmed on this device); would need a
  follow-up plan if QR mode is ever enabled here.
- **Deleting a Visit outright (`DELETE /visits/:id`) does not cascade-
  revoke the visitor's cards** — only `finish()` does that, matching
  the confirmed device behavior (its own `save()` only touches cards
  in the `finished` branch, never in a plain delete path). A canceled
  visit whose visitor already received a card keeps that card active
  unless `finish()` (or a manual card removal) is used. Documented in
  the frontend's Remove-visit confirmation copy, not silently assumed
  away.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; every claim backed by live evidence (network capture, static class-registration read, or live DOM snapshot) | 9/10 | One gap (update payload) explicitly flagged rather than guessed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 5 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 15 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Update-payload confirmation deferred to a live task rather than assumed final |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked for
this plan to be handed to the executor ("đưa plan cho codex dev nhé")
after reviewing this session's Visits discovery findings.
**Confirmed on:** 2026-09-14
