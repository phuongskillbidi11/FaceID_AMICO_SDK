# Spec — Groups write side (Enroll → Groups): create/rename/delete

---

## Goal

`GroupsApi::list()` (name+id only) has been implemented since the
Access (Global) report plan. This project now implements the write
side: create a group, rename one, and delete one — matching the real
device's own `group.html` (Add/Edit/Remove).

**Done looks like:** A "Groups" tab under Enroll (frontend), with
Add/Edit/Remove for groups, backed by new `/groups` write routes and
`GroupsApi` write methods.

---

## Background — live evidence (this session, 2026-09-15)

- **Device object `groups`** — fields: `id` (PK), `name` (the only
  writable field). Confirmed via `class.js`'s `CID.createClass`
  registration (`groupsData`, `en_US/js/class.js`) and the already-
  implemented `GET /groups` read path.
- **Generic CRUD mechanism** (`en_US/js/messenger.js`, read statically
  — the SAME generic `Messenger.save()`/`remove()` functions Users and
  Visits already go through, both already `LIVE_CONFIRMED` against
  this exact code path):
  - `save(values)`: if the object is already loaded, calls
    `modify(values)` → `POST /modify_objects.fcgi`
    `{"object":"groups","values":{"name":"<new>"},"where":{"groups":{"id":<id>}}}`
    (bare-object `values`, scalar `where.id` — byte-for-byte the same
    shape as `buildUserUpdateBody`/`buildVisitUpdateBody`). Otherwise
    calls `create([values])` → `POST /create_objects.fcgi`.
  - `remove(ids)` → `POST /destroy_objects.fcgi`
    `{"object":"groups","where":{"groups":{"id":[<id>]}}}` (array-of-
    ids where — same shape as `buildUserDeleteBody`/`buildVisitDeleteBody`).
- **Live-captured CREATE payload** (XHR-interceptor capture on the
  real device's own `group.html` "Add" form — failed before reaching
  the network, no group actually created; confirmed by reloading the
  page afterward and the list still showing only the original 2
  groups):
  ```json
  {"join":"LEFT","object":"groups","fields":["id","name"],
   "where":[],"order":["name"],
   "values":[{"name":"ZZ_TestGroup"}]}
  ```
  Same extended shape (`join`/`fields`/`where`/`order` alongside
  `values`) already confirmed for Visits' own create — **not** the
  leaner `{"object":..., "values":[...]}` shape Users' create uses.
  This project's `buildGroupCreateBody` must match this shape
  verbatim, not assume symmetry with Users.
- **`modify_objects.fcgi`/`destroy_objects.fcgi` for `groups`
  specifically have NOT been independently live-captured** — only
  inferred from the shared generic `messenger.js` mechanism (JS_CONFIRMED,
  not LIVE_CONFIRMED for this exact object). To be confirmed live during
  this plan's own Group 8 (a disposable test group created for real,
  renamed, then deleted) before final sign-off — same discipline the
  Visits plan used for its own initially-uncaptured `PATCH` shape.
- **Protected group id 1 ("Standard" on this device)**: `class.js`'s
  `groupsData.noSave = [1]` disables **both** the Edit and Remove
  controls in the real device's own UI for whichever group currently
  has id 1 — confirmed live: opening its Edit form shows the Name
  field genuinely `disabled="disabled"` (`Everywhere`, id 2, is NOT
  disabled). **This is a client-side (JS) restriction only — it has
  NOT been confirmed whether the device's own `modify_objects.fcgi`/
  `destroy_objects.fcgi` actually reject a write against id 1, or
  whether only the real device's own web UI merely chooses not to
  offer the controls.** Do not assume server-side enforcement without
  a live test (see Risks) — and never test-write against the real
  id-1 group on this device to find out, since it's evidently a
  protected system default, not a disposable test record.

---

## Design decisions

### Decision 1 — `GroupsApi` gains `create`/`update`/`remove`, reusing the existing `Group` type where possible
- **Chosen:** Add `NewGroup{name}` and `GroupUpdate{id, name}` types
  (mirroring `NewVisit`/`VisitUpdate`'s minimal-struct convention),
  `GroupsApi::create(const NewGroup&) -> int64_t`,
  `GroupsApi::update(const GroupUpdate&)`, `GroupsApi::remove(int64_t)`.
  `Group` itself (the read type) is unchanged.
- **Why:** Matches every other write-capable object in this SDK
  (separate `New*`/`*Update` structs from the read type) rather than
  overloading `Group` for both read and write roles.
- **Rejected alternatives:** Reusing `Group` directly as the write
  input (it already has `id`+`name`) — rejected for consistency with
  the rest of this SDK's established pattern, and because a create
  call has no `id` to give (the device assigns it).

### Decision 2 — No client-side enforcement of the protected-id-1 restriction
- **Chosen:** This SDK's `update()`/`remove()` do not special-case any
  group id. If the device's own API rejects a write against a
  protected group, that surfaces as a normal `ProtocolError` (zero
  `changes`) like any other rejected write; if the device's API does
  NOT enforce it server-side, this SDK simply allows what the device
  allows — it does not invent a restriction the device itself may not
  have.
- **Why:** Per Background, this is confirmed to be (at least) a
  client-side-only restriction in the real UI; whether the device's
  own API independently enforces it is unconfirmed. Matches this
  project's standing discipline of never fabricating server-side
  validation that isn't evidenced (see the Visitors plan's Decision 3
  precedent on `/users` vs `/visitors` type restrictions).
- **Frontend still respects it defensively**: the Groups tab disables
  the Name field and hides the Remove action for whichever group has
  `id === 1` on this device, matching the real UI's own behavior — a
  presentation-layer choice, not a claim about what the API enforces.

---

## Scope

### In scope
- SDK: `NewGroup`/`GroupUpdate` types; `GroupsApi::create/update/remove`;
  `buildGroupCreateBody`/`buildGroupUpdateBody`/`buildGroupDeleteBody`
  query builders.
- Backend: `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`.
- Frontend: a new "Groups" tab under Enroll — list (Name, Nº of Users,
  Edit, Remove — matching the real device's own columns, minus Nº of
  Time Zones which is out of scope, see below), Add/Edit modal (Name
  field only), Remove action. Id-1 group's Name field disabled and
  Remove action hidden, matching the real device's own UI.
- Tests: SDK query-builder + `GroupsApi` tests, backend route tests.
- Docs: `docs/backend-api.md` (new `/groups` write routes),
  `docs/api-roadmap.md` (mark Groups write-side ✅ Implemented).
- Live verification (Group 8): create a disposable test group, rename
  it, delete it — the first independent live confirmation of the
  `modify_objects.fcgi`/`destroy_objects.fcgi` shapes for this object.

### Out of scope
- **Group membership management (adding/removing users from a group)**
  — already fully implemented (`POST`/`DELETE /users/:id/groups/:groupId`,
  used by the Users/Visitors dual-list picker); this plan only adds
  create/rename/delete of the group record itself.
- **Time Zones tab on the Group edit form** (`group.js`'s commented-out
  `time_zones` field, and the `is_server`-gated `dev_groups`/
  `area_groups` fields) — this device is not in `is_server` mode
  (confirmed by every prior discovery pass in this project finding no
  server-mode-only UI), and the `time_zones` field is explicitly
  commented out in the live-captured `class.js` source itself — not a
  real, currently-active feature on this device to implement against.
  Tracked separately under `docs/api-roadmap.md`'s Time Zones write-side
  item.
- **Testing a write against the protected id-1 group** — never done,
  by design (see Background) — this plan's Group 8 test uses a
  disposable, newly-created group id instead.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `NewGroup`/`GroupUpdate` types |
| `include/amico/Client.hpp` | Modify | `GroupsApi::create/update/remove` |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | `buildGroupCreateBody`/`UpdateBody`/`DeleteBody` |
| `src/Client.cpp` | Modify | Implement the new `GroupsApi` methods |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | `fromJsonNewGroup`/`fromJsonGroupUpdate` |
| `backend/Routes.cpp` | Modify | `POST`/`PATCH`/`DELETE /groups*` |
| `frontend/groups.js` | New | Groups tab: list, Add/Edit modal, Remove |
| `frontend/index.html` | Modify | New "Groups" sidebar entry under Enroll; new `<div id="tab-groups">`; new `<script>` tag |
| `CMakeLists.txt` | Modify | Add `test/test_groups.cpp` |
| `test/test_groups.cpp` | New | SDK-level tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New `/groups` write route tests |
| `docs/backend-api.md` | Modify | Document the new routes |
| `docs/api-roadmap.md` | Modify | Mark Groups write-side ✅ Implemented |

---

## Risks and unknowns

- **`modify_objects.fcgi`/`destroy_objects.fcgi` for `groups` are not
  yet independently live-captured** — inferred from the shared generic
  mechanism (`messenger.js`) already proven for other objects. To be
  confirmed in this plan's own Group 8 live test before final sign-off.
- **Whether the device's own API enforces the id-1 protection, or only
  the UI does** — deliberately left unconfirmed (see Decision 2); this
  plan's own live test never probes it (would risk the real protected
  group). If a future need arises to confirm this specifically, it
  would need its own careful, separately-approved test.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed (live capture or static JS read of an already-proven shared mechanism) | 9/10 | modify/destroy shapes flagged as pending live confirmation, not assumed final |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 13 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | modify/destroy confirmation deferred to a live task, not assumed |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly chose "Groups
(write side)" as the next feature via a direct question after Visits
shipped.
**Confirmed on:** 2026-09-15
