# Spec — Visitors (Enroll → Visitors): list/create/update/remove + CPF custom field

---

## Goal

The real AMICO device's sidebar has a dedicated **Visitors** page
(`Enroll → Visitors`, `customusers.html?type=1`) alongside Users. This
project implements it: a new `/visitors` area in our own frontend and
backend, with the same CRUD capabilities Users already has (list,
add, edit, remove — including groups/cards/PIN/face), plus one
visitor-specific field the real device's own Add/Edit form shows:
**CPF** (a text field, currently disabled until save, same as
Last Access).

**Done looks like:** A new "Visitors" sidebar tab, listing/adding/
editing/removing visitor records exactly like Users does today, with
an additional CPF field on the General tab.

---

## Background — live evidence (this session)

Every claim below was confirmed live against `http://192.168.2.156`
this session, not guessed:

- **List query (captured live, reqid 4534):**
  ```json
  {"join":"LEFT","object":"users",
   "fields":["id","name","registration","password","salt","begin_time","end_time","user_type_id","last_access"],
   "where":[{"object":"user_types","field":"id","value":1,"connector":") AND ("}],
   "order":["name"],"offset":0,"limit":10,"finish":true}
  ```
  **Visitors are the exact same `users` object as regular Users** —
  the only difference is the `where` clause: `user_types.id = 1`
  (regular Users' own existing query instead filters
  `user_type_id = 0 OR user_type_id IS NULL` — see
  `src/ObjectQuery.cpp`'s existing `buildUsersListBody`). The
  device's own query requests raw `password`/`salt` fields — **we do
  not replicate that**; our existing `kUserFields` already
  deliberately excludes them (per `feedback_never_expose_password_hash.md`)
  and Visitors reuses that same safe field list unchanged.
- **`user_types`/`custom_tables` are genuinely data-driven, not a
  fixed firmware concept** (`en_US/js/main.js`'s `drawUserTypesMenu()`,
  read live this session): the sidebar link label ("Visitors") comes
  from `user_types LEFT JOIN custom_tables` — `user_types.id = 1`
  happens to be named "Visitors" **on this specific device's own
  configuration**. This plan hardcodes `user_type_id = 1` because
  that is what this device is actually configured with (confirmed
  live) — it does not attempt to build a fully generic multi-type
  system (out of scope, see below).
- **Create/update sets `user_type_id` via a `defaultValue`, not a
  hardcoded save() path** (read live via direct `window.usertype1`
  class introspection in the browser console — not guessed):
  `usertype1.fields.user_type_id` = `{"type":"int","object":"user_types",
  "value":null,"defaultValue":1,"isField":true,"PK":false,...}`. The
  base `User` class's own `save()` (`class/user.js`, already on file
  from an earlier discovery pass) never touches `user_type_id` — this
  is new evidence supplementing, not contradicting, that earlier
  finding (`docs/sdk-usage.md` line 62): the generic "usertype"
  wrapper sets it via each type's own `defaultValue` before calling
  the same shared save(). For our implementation, this means: create
  a Visitor exactly like creating a User today, plus `user_type_id: 1`
  in the `create_objects.fcgi` `values`.
- **CPF is a separate, generic "Custom Fields" mechanism (`c_users`
  table), not visitor-specific** (read live via
  `window['c_users']` class introspection): a companion object with
  exactly 3 fields — `id` (PK), `user_id`, `cpf` (all confirmed
  against `object_metadata.fcgi`'s already-captured schema too). Its
  parent field definition on `usertype1` (`fields.c_users`) is
  `{"type":"fields","fieldType":"single","label":"Custom Fields",...,
  "beforeSave": (obj,value) => { value.user_id = obj.id; return value; }}`
  — confirmed via the outer `save()` function's generic handling
  (also read live): for any field with `fieldType === 'single'`, an
  `afterSave` hook runs `obj.getValue(field).save()` — i.e., after the
  main user record saves, the nested `c_users` instance saves itself
  **as a second, separate device call**, with `user_id` injected via
  `beforeSave`. This is a generic pattern (the same mechanism also
  handles `_visitors`, a different, simpler companion object with
  just `{id, user_id}` and no custom columns of its own — confirmed
  via schema, not used further in this plan).
- **`c_users`'s own `save()`** (read live) is the identical generic
  base-class save function every other object in this app's class
  hierarchy uses — meaning it issues the same
  `create_objects.fcgi {object:"c_users", values:[{user_id, cpf}]}` /
  `modify_objects.fcgi {object:"c_users", values:{cpf}, where:{c_users:{id}}}`
  shape already confirmed for other objects in this codebase (e.g.
  `buildCardAddBody`'s one-element `values` array on create).
- **Not separately live-verified**: the exact wire capture of a real
  `create_objects.fcgi` call against `c_users` (no visitor with a CPF
  value exists on this device to observe) — the shape above is
  inferred from the identical, already-proven generic save()
  mechanism, not a guess about a different mechanism. Flagged as a
  live-verification item for this plan's own Group 5 (matching how
  the Access Logs plan's Decision 2b handled an analogous gap).

---

## Design decisions

### Decision 1 — Extend existing Users types/queries with an optional `userTypeId` filter, not a parallel API
- **Chosen:** `UserQuery`, `NewUser` each gain
  `std::optional<int64_t> userTypeId` (unset = today's exact existing
  behavior, zero risk to Users; set to `1` = the new Visitors case).
  `buildUsersListBody` gains the same optional parameter, switching
  its `where` clause between the existing OR/NULL 2-clause shape
  (unset) and a single `user_types.id = N` clause (set) — both
  patterns already exist verbatim elsewhere in this file (the
  OR/NULL shape is the current `buildUsersListBody`; the single-clause
  shape matches `buildUserGetBody`'s existing style). `buildUserCreateBody`
  gains the same optional parameter, adding `user_type_id` to `values`
  only when set (regular User creation is byte-for-byte unchanged).
  `buildUserGetBody`/`buildUserUpdateBody`/`buildUserDeleteBody` need
  **no change** — they already operate by a specific known `id`
  regardless of type (confirmed: `buildUserGetBody`'s `where` is
  `[{"field":"id","value":id}]`, no type filter at all).
- **Why:** Visitors and Users are *provably* the same underlying
  object (live-confirmed); duplicating `UsersApi` into a parallel
  `VisitorsApi` at the SDK level would just be the same code twice.
  The HTTP layer (Decision 2) is what gives them separate product
  identities.
- **Rejected alternatives:** A separate `VisitorsApi` SDK class with
  its own query builders — rejected, would duplicate ~90% of
  `UsersApi`'s logic for no benefit, and risks the two definitions
  drifting apart over time.

### Decision 2 — Separate `/visitors` HTTP routes, reusing the SDK's parameterized Users methods
- **Chosen:** `backend/Routes.cpp` gains `GET /visitors`,
  `GET /visitors/:id`, `POST /visitors`, `PATCH /visitors/:id`,
  `DELETE /visitors/:id`, `POST /visitors/:id/groups/:groupId`,
  `DELETE /visitors/:id/groups/:groupId`, `POST /visitors/:id/cards`,
  `PUT /visitors/:id/image`, `DELETE /visitors/:id/image`,
  `GET /visitors/:id/image`, `PUT /visitors/:id/password` — each a
  thin wrapper calling the *same* `UsersApi`/`AccessLogsApi`-style SDK
  methods already used by `/users/*`, just passing `userTypeId = 1`
  on list/create. (Card removal already lives at the type-agnostic
  `DELETE /cards/:cardId` — reused as-is, no `/visitors` variant
  needed.)
- **Why:** The real device treats Visitors as a genuinely separate
  navigation area/page with its own list, even though the underlying
  object is identical — matching that product shape (separate routes,
  separate frontend tab) is what "implement Visitors" means here, not
  merely exposing a `?type=` query param on `/users`.
- **Rejected alternatives:** `GET /users?userType=1` instead of a
  separate route — rejected: blurs two conceptually distinct product
  areas into one endpoint's query-string behavior, and the real
  device itself treats them as separate pages/menu items, not filter
  variants of one page.

### Decision 3 — CPF: new `c_users` query builders, `AmicoUser`/`NewUser`/`UserUpdate` gain an optional `cpf` field
- **Chosen:** `AmicoUser` gains `std::optional<std::string> cpf`,
  populated via a new `c_users`-lookup-by-`user_id` query — same N+1-
  per-user enrichment pattern `AmicoUser` already uses for
  `groupIds`/`cardCount`/`faceCount`/`hasPassword` (a per-object
  convention already established and accepted in this codebase,
  distinct from `AccessLogEntry`'s batched-per-page convention).
  `NewUser`/`UserUpdate` gain `std::optional<std::string> cpf`; when
  set, the SDK creates/updates the companion `c_users` row as a
  second device call after the main user save succeeds (mirroring the
  real device's own two-call `afterSave` pattern, confirmed live).
  `DELETE /visitors/:id` also issues a defensive `destroy_objects` on
  `c_users` filtered by `user_id` before removing the user itself
  (mirroring the existing `removeUserImage`'s explicit
  `face_templates` cleanup — this project's established convention of
  not assuming device-side cascade delete without evidence).
- **Why:** CPF is a real field the live Add/Edit Visitor form shows;
  the live class-introspection evidence for its save mechanism is as
  strong as static discovery gets without an actual write test (see
  Background) — Group 5 will live-verify the actual wire shape before
  final sign-off, matching this project's established "confirm before
  final sign-off, don't guess" discipline.
- **Scope boundary:** `cpf` is added to the SDK's generic `AmicoUser`/
  `NewUser`/`UserUpdate` types (so nothing prevents a future `/users`
  route from also using it), but **this plan's own HTTP routes only
  wire it into `/visitors/*`** — `/users/*` routes are not touched at
  all, so existing Users behavior has zero risk of regression.
- **Rejected alternatives:** Building the fully generic "Custom
  Fields" system (reading `custom_tables`/`custom_columns` to support
  arbitrary per-type fields) — rejected as far beyond what was asked;
  CPF is hardcoded as the one confirmed field for this device's
  configuration, matching `docs/api-roadmap.md`'s own separate,
  not-yet-discovered "Custom Fields" roadmap item.

### Decision 4 — Frontend: refactor `users.js`'s table/modal logic into a shared, parameterized factory
- **Chosen:** Extract `frontend/users.js`'s table-building and modal-
  building logic (tabs, `lockedFields`, the persistent photo panel,
  Groups/Cards/PIN sub-forms, `renderPhoto`) into a shared factory
  function callable with a small config object (tab id, API path
  prefix, page heading, and an optional "extra General-tab fields"
  hook for CPF). `frontend/users.js` calls it once (existing behavior,
  byte-for-byte unchanged output); a new `frontend/visitors.js` calls
  it once more with the Visitors-specific config (API path `/visitors`,
  heading "Visitors", one extra CPF field).
- **Why:** The two pages are ~95% identical, intricate logic (tab
  wiring, pre-save field locking, photo panel, nested Groups/Cards
  sub-modals) — duplicating it into a second ~250-line file would
  immediately create a maintenance-drift risk (a future fix to Users'
  modal would need to be manually mirrored into Visitors', and vice
  versa). This matches the project's own established anti-duplication
  practice (e.g., this session's earlier `booleanIcon()` hoist).
- **Rejected alternatives:** Duplicate `users.js` into `visitors.js`
  wholesale — rejected as the exact kind of drift-prone duplication
  this project has consistently avoided elsewhere; the risk of a
  refactor regressing the already-shipped Users page is mitigated by
  keeping Users' own call to the factory produce byte-for-byte
  identical DOM/behavior (verified in Group 5) before adding the new
  Visitors call site.

---

## Scope

### In scope
- SDK: `userTypeId` on `UserQuery`/`NewUser`; `cpf` on `AmicoUser`/
  `NewUser`/`UserUpdate`; new `c_users` query builders; `UsersApi`
  methods threaded to accept the new optional fields.
- Backend: `/visitors` route family (list/get/create/update/delete/
  groups/cards/image/password — all reusing existing SDK methods with
  `userTypeId = 1`), CPF create/update/delete wiring.
- Frontend: shared table/modal factory extracted from `users.js`;
  new `frontend/visitors.js`; new sidebar nav entry; CPF field on the
  General tab (Visitors only).
- Tests: SDK query-builder tests, backend route tests (new
  `test/test_visitors.cpp` for the SDK-level pieces, extend existing
  `test/backend/test_routes.cpp` for the HTTP-level pieces), a
  regression check that `users.js`'s refactored output is unchanged.
- Docs: `docs/backend-api.md` (new `/visitors` section),
  `docs/api-roadmap.md` (mark Visitors ✅ Implemented).

### Out of scope
- The fully generic "Custom Fields"/"User Types" management system
  (`customfields.html`, `usertypes.html`) — CPF is hardcoded as the
  one confirmed field for `user_type_id = 1` on this device; browsing/
  editing *other* custom fields or *other* user types is a separate,
  already-tracked roadmap item.
- `Visits` (`visits.html`) — a genuinely different object
  (`visitor_id`/`host_id`/`begin_time`/`end_time`/`finished`), not
  covered by this plan at all.
- Adding CPF (or any custom field) to the existing `/users/*` routes —
  the SDK types support it, but this plan's own routes don't wire it
  in for Users, keeping existing Users behavior completely unchanged.
- Face/PIN/card enrollment behavior itself — already implemented,
  reused as-is via the shared factory; no protocol changes here.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `userTypeId` on `UserQuery`/`NewUser`; `cpf` on `AmicoUser`/`NewUser`/`UserUpdate` |
| `include/amico/Client.hpp` | Modify | Thread new optional params through `UsersApi` methods |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | `userTypeId`-aware list/create bodies; new `c_users` query builders |
| `src/Client.cpp` | Modify | Implement the new filter/CPF logic, including the defensive `c_users` cleanup on delete |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | Serialize `cpf` |
| `backend/Routes.cpp` | Modify | New `/visitors/*` route family |
| `frontend/users.js` | Modify | Extract shared factory (Decision 4); call site for Users unchanged in behavior |
| `frontend/visitors.js` | New | Visitors page, calling the shared factory with its own config + CPF field |
| `frontend/index.html` | Modify | New sidebar nav entry + tab container; new `<script>` tag |
| `frontend/style.css` | Modify | Only if the CPF field needs anything beyond existing `label`/`input` styling (expected: none new) |
| `CMakeLists.txt` | Modify | Add `test/test_visitors.cpp` to the test target's source list |
| `test/test_visitors.cpp` | New | SDK-level tests for the new query builders/types |
| `test/test_query_whitelist.cpp` | Modify | Cover the new/changed query builders' whitelisted fields |
| `test/backend/test_routes.cpp` | Modify | Cover the new `/visitors/*` routes |
| `docs/backend-api.md` | Modify | Document `/visitors/*` |
| `docs/api-roadmap.md` | Modify | Mark Visitors ✅ Implemented |

---

## Risks and unknowns

- **CPF's exact `create_objects.fcgi`/`modify_objects.fcgi` wire shape
  against `c_users`** has not been separately live-captured (no
  visitor with a CPF value exists on this device) — inferred from the
  identical generic save() mechanism already proven for other objects
  in this codebase. To be confirmed during this plan's own Group 5
  live check (creating one disposable test visitor with a CPF value,
  under the standard `APPROVE_LIVE_DEVICE_WRITE_TEST` gate) before
  final sign-off.
- **Whether deleting a user cascades-delete its `c_users` row on the
  device side** is unconfirmed — this plan defensively issues an
  explicit `destroy_objects` on `c_users` regardless (harmless no-op
  if the device already cascades), matching the existing
  `removeUserImage`/`face_templates` precedent rather than assuming
  either way.
- **The `users.js` → shared-factory refactor** touches an already-
  shipped, tested page — mitigated by verifying Users' own behavior is
  byte-for-byte unchanged (Group 5) before considering Visitors done.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; every claim backed by live evidence (network capture or direct class introspection) | 9/10 | Extensive live discovery this session, including direct browser-console class introspection for the save() mechanics |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 4 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 16 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | CPF's exact wire shape flagged as pending live confirmation rather than assumed final |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — scope confirmed via 2 direct
questions this session (full CRUD reuse, and explicitly include CPF).
**Confirmed on:** 2026-09-14
