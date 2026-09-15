# Tasks — Visits (Enroll → Visits): list/create/update/remove/finish

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) has a read-only part and one
>   gated write part (creating/editing/finishing/deleting one
>   disposable test visit), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval before any
>   actual write reaches the device.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `Visit`, `NewVisit`, `VisitUpdate`, `VisitQuery`
**Action:** Add, near the existing `Group`/`TimeZone` structs, doc
comments citing this plan's `spec.md` Background for every
LIVE_CONFIRMED claim:
```cpp
/// Public view of the `visits` object (Visits plan, 2026-09-14).
/// `visitorName`/`hostName`/`cardCount` are enrichment fields this SDK
/// resolves via the already-existing UsersApi::getNamesByIds() and
/// detail::buildCardCountBody() -- not raw device columns themselves
/// (spec.md Decision 2).
struct Visit {
    int64_t id = 0;
    int64_t visitorId = 0;
    int64_t hostId = 0;
    std::string visitorName;
    std::string hostName;
    int64_t beginTime = 0;
    int64_t endTime = 0;
    bool finished = false;
    int cardCount = 0;
};

/// Creation parameters for the `visits` object. LIVE_CONFIRMED
/// 2026-09-14 via XHR-interceptor capture of the real device's own Add
/// Visit form (spec.md Background) -- `endTime` defaults to 0 (open-
/// ended), matching the captured payload's own convention. There is no
/// `finished` member -- a new visit is never created pre-finished
/// (spec.md Decision 4).
struct NewVisit {
    int64_t visitorId = 0;
    int64_t hostId = 0;
    int64_t beginTime = 0;
    int64_t endTime = 0;
};

/// Update parameters for the `visits` object. Callers set only the
/// fields they want to change. Deliberately has no `finished` member --
/// use VisitsApi::finish() instead, a dedicated method with its own
/// real device-side side effect (revoking the visitor's cards) that a
/// plain field edit must never trigger silently (spec.md Decision 4).
/// NOTE: the exact modify_objects.fcgi wire shape this builds is
/// inferred by symmetry with the confirmed create shape and this
/// codebase's existing buildUserUpdateBody convention -- not itself
/// live-captured this session (spec.md Risks). Confirm before/at
/// Group 8's live check.
struct VisitUpdate {
    int64_t id = 0;
    std::optional<int64_t> visitorId;
    std::optional<int64_t> hostId;
    std::optional<int64_t> beginTime;
    std::optional<int64_t> endTime;
};

/// List query for VisitsApi::list(). Matches the real device's own
/// default list filter (finished != 1, i.e. active/upcoming visits
/// only) -- no "include finished" toggle (spec.md Scope: out of
/// scope for this plan). No search/filter fields either (spec.md
/// Scope).
struct VisitQuery {
    int limit = 0;   // 0 -> AmicoConfig::defaultPageSize
    int offset = 0;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0),
> no compile errors. Added `Visit`/`NewVisit`/`VisitUpdate`/`VisitQuery`
> to `include/amico/Types.hpp` immediately after the existing `Group`
> struct, doc comments as specified.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `visits` list/get/create/update/delete builders
**Action:** Add to `src/ObjectQuery.hpp` (matching this file's existing
terse doc-comment convention) and implement in `.cpp`:
```cpp
/// GET-listing body for `visits`, matching the real device's own
/// default filter (`finished != 1`) -- LIVE_CONFIRMED shape via
/// class.js's own `defaultWhere` (spec.md Background).
nlohmann::json buildVisitsListBody(int limit, int offset);

/// Single-visit lookup by id -- no `finished` filter (a specific known
/// id, regardless of state), same pattern as buildUserGetBody.
nlohmann::json buildVisitGetBody(int64_t id);

/// Single-visit creation body for `create_objects.fcgi`.
/// LIVE_CONFIRMED wire shape 2026-09-14 via XHR-interceptor capture
/// (spec.md Background): `join:"LEFT"`, `fields` lists all 6 columns,
/// `where:[]`, `order:["id"]`, one-element `values` array with
/// visitor_id/host_id/begin_time/end_time/finished:0.
nlohmann::json buildVisitCreateBody(int64_t visitorId, int64_t hostId,
                                     int64_t beginTime, int64_t endTime);

/// Single-visit partial-update body for `modify_objects.fcgi`. Unset
/// values are omitted. NOT live-captured this session (spec.md Risks)
/// -- built by symmetry with buildUserUpdateBody's confirmed
/// bare-object `values` + scalar `where.id` shape. Never includes
/// `finished` (see VisitUpdate's own doc comment).
nlohmann::json buildVisitUpdateBody(int64_t id,
                                     std::optional<int64_t> visitorId = std::nullopt,
                                     std::optional<int64_t> hostId = std::nullopt,
                                     std::optional<int64_t> beginTime = std::nullopt,
                                     std::optional<int64_t> endTime = std::nullopt);

/// Single-visit deletion body for `destroy_objects.fcgi`. Does NOT
/// touch the visitor's cards (spec.md Risks -- only finish() does
/// that, matching confirmed device behavior).
nlohmann::json buildVisitDeleteBody(int64_t id);

/// Sets a visit's `finished`/`end_time` fields directly (internal use
/// only, by VisitsApi::finish() -- never exposed via VisitUpdate).
/// LIVE_CONFIRMED shape via class.js's own finished-branch save()
/// (spec.md Background): `values: {"finished": 1, "end_time": <now>}`.
nlohmann::json buildVisitFinishBody(int64_t id, int64_t endTime);

/// Revokes every card currently issued to a given user id. LIVE_
/// CONFIRMED literal shape via class.js's own finish-branch
/// destroy_objects call (spec.md Background):
/// `{object:"cards", where:{cards:{user_id:{"==":userId}}}}`. Used by
/// VisitsApi::finish() to revoke the visitor's cards; deliberately a
/// distinct builder from the existing single-card
/// buildCardRemoveBody(cardId) (removes ALL of one user's cards, not
/// one card by its own id).
nlohmann::json buildUserCardsDeleteBody(int64_t userId);
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `kVisitFields` constant and all 7 builders
> (`buildVisitsListBody`/`GetBody`/`CreateBody`/`UpdateBody`/
> `DeleteBody`/`FinishBody`, `buildUserCardsDeleteBody`) to
> `src/ObjectQuery.hpp`/`.cpp`. `buildVisitCreateBody` matches the
> live-captured shape verbatim (join/fields/where/order + values array
> with `finished:0`).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `VisitsApi` class declaration
**Action:** In `include/amico/Client.hpp`, add a new nested class
following the exact structural pattern of `GroupsApi`/`TimeZonesApi`
(private ctor, `friend class AmicoClient`, `owner_` pointer):
```cpp
/// Typed read/write wrapper for the `visits` object (Visits plan,
/// 2026-09-14). A visit's Cards are the visitor's own `cards` rows --
/// use UsersApi::addCard()/removeCard() with the visit's visitorId,
/// not a method on this class (spec.md Decision 3).
class VisitsApi {
public:
    std::vector<Visit> list(const VisitQuery& query = {});
    std::optional<Visit> get(int64_t id);

    /// POST /create_objects.fcgi. Returns the device-assigned visit id.
    int64_t create(const NewVisit& visit);

    /// POST /modify_objects.fcgi. Throws ProtocolError if no visit changed.
    void update(const VisitUpdate& visit);

    /// POST /destroy_objects.fcgi. Throws ProtocolError if no visit
    /// removed. Does NOT revoke the visitor's cards (spec.md Risks).
    void remove(int64_t id);

    /// Marks a visit concluded: revokes every card currently issued to
    /// its visitor, then sets finished=1/end_time=now on the visit
    /// itself (spec.md Decision 4 -- mirrors the real device's own
    /// two-step save() side effect). Throws NotFoundError if the visit
    /// doesn't exist.
    void finish(int64_t id);

private:
    friend class AmicoClient;
    explicit VisitsApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Add `VisitsApi& visits() { return visitsApi_; }`, the `friend class
VisitsApi;` line, and the `VisitsApi visitsApi_{this};`-style member
(match however `groupsApi_`/`timeZonesApi_` are declared/initialized
in the existing private section and `Client.cpp`'s constructor).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `VisitsApi` nested class to `include/amico/Client.hpp` mirroring
> `GroupsApi`/`TimeZonesApi` exactly, `visits()` accessor,
> `friend class VisitsApi;`, `VisitsApi visitsApi_{this};` member (no
> constructor-init-list change needed — same in-class default-
> initializer pattern `groupsApi_`/`timeZonesApi_` already use).
> **Correction found during implementation:** the doc comment said
> "Throws NotFoundError" for `finish()`, but this codebase has no such
> exception type (checked `include/amico/Errors.hpp` directly — only
> `AmicoError`/`ConfigurationError`/`NetworkError`/`TimeoutError`/
> `TlsVerificationError`/`AuthenticationError`/`InvalidSessionError`/
> `HttpError`/`ProtocolError`/`JsonParseError`/`ResponseTooLargeError`/
> `UnsupportedOperationError` exist). Fixed the doc comment to say
> `ProtocolError`, matching every other not-found-via-empty-response
> case in this SDK.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — Implement `VisitsApi`'s methods in `src/Client.cpp`
**Action:**
- `list(query)`: call `buildVisitsListBody(limit, offset)` (apply
  `AmicoConfig::defaultPageSize` the same way `listUsers` does when
  `query.limit == 0`); for each row, build a `Visit`, then batch-
  resolve `visitorName`/`hostName` via one call to the existing
  `UsersApi::getNamesByIds()` with the combined set of visitor+host
  ids (not one call per row — same batching discipline
  `AccessLogsApi::list()` already uses for portal/user names), and
  `cardCount` via `detail::buildCardCountBody(visitorId)` per row
  (matches `AmicoUser::cardCount`'s existing per-row convention).
- `get(id)`: `buildVisitGetBody(id)`; same name/cardCount enrichment
  as above for the single row.
- `create(visit)`: `buildVisitCreateBody(...)`, return the new id
  (same response-shape handling as `UsersApi::create`).
- `update(visit)`: `buildVisitUpdateBody(...)`, throw `ProtocolError`
  if the device reports zero rows changed (same pattern as
  `updateUser`).
- `remove(id)`: `buildVisitDeleteBody(id)`, throw `ProtocolError` if
  zero rows removed (same pattern as `removeUser`, but no `c_users`-
  style extra cleanup call — spec.md Decision/Risks: deletion doesn't
  cascade to cards).
- `finish(id)`: (1) `get(id)`; throw `NotFoundError` if absent; (2)
  `buildUserCardsDeleteBody(visit->visitorId)` via `destroy_objects.fcgi`
  (no throw-on-zero-changes — a visitor may legitimately have zero
  cards to revoke); (3) `buildVisitFinishBody(id, <current epoch
  seconds>)` via `modify_objects.fcgi`, throw `ProtocolError` if zero
  rows changed.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0).
> Also ran the full existing suite as a regression check (not required
> by this task's own verification command, but `Client.cpp` changed
> substantially): `./build/amico_tests.exe` — 121/121 passed, 0
> failures, confirming zero regression to existing Users/Visitors/
> Access Logs/Groups/TimeZones behavior.
> Implemented exactly as specified: `mapVisit()` helper (handles
> `finished` as either a JSON bool or 0/1 int, since only the create
> path's exact wire shape was captured, not a load_objects response);
> `listVisits`/`getVisit` batch-resolve visitor+host names via one
> `getUserNamesByIds()` call each (not per-row); `cardCount` via
> `runCountQuery(buildCardCountBody(visitorId), "cards")`, same helper
> `mapUser` already uses. `finishVisit()` calls `getVisit(id)` first,
> throws `ProtocolError` if absent, then issues the cards-delete call
> (no throw-on-zero-changes) before the finish-update call.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize `Visit`/`NewVisit`/`VisitUpdate`
**Action:** In `backend/JsonMapping.cpp`, following the exact
null-vs-value convention already used for `AmicoUser`/`AccessLogEntry`:
- `toJson(const amico::Visit&)`: `id`, `visitorId`, `hostId`,
  `visitorName`, `hostName`, `beginTime`, `endTime`, `finished`,
  `cardCount`.
- `fromJsonNewVisit(body)`: required `visitorId`/`hostId`/`beginTime`;
  optional `endTime` (default 0 if absent, matching
  `NewVisit::endTime`'s own default).
- `fromJsonUserUpdate`-style `fromJsonVisitUpdate(id, body)`: optional
  `visitorId`/`hostId`/`beginTime`/`endTime`, same
  `body.contains(key) && !body[key].is_null()` pattern as
  `fromJsonUserUpdate`. **Never** parses a `"finished"` key — that
  field has no generic-update path (spec.md Decision 4); if a caller
  sends one, ignore it silently (matches `VisitUpdate` having no such
  member to populate at all).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_backend` passed
> (exit 0) after killing a stale running `amico_backend.exe` process
> (PID 42960, Windows file-lock `LNK1168` — same recurring gotcha
> noted in the Visitors plan). Added `toJson(const amico::Visit&)`,
> `fromJsonNewVisit`, `fromJsonVisitUpdate` to `backend/JsonMapping.*`
> exactly as specified, including the "never parses `finished`" note.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — `/visits` route family
**Action:** Add, mirroring the existing `/users/*`/`/visitors/*`
handler style (same session/error handling, same body-parsing style)
in `backend/Routes.cpp`:
- `GET /visits?limit=&offset=` — `VisitQuery`.
- `GET /visits/:id` — 404 if absent (same pattern as
  `GET /users/:id`/`GET /visitors/:id`).
- `POST /visits` — `fromJsonNewVisit(body)`, then
  `client.visits().create(newVisit)`.
- `PATCH /visits/:id` — `fromJsonVisitUpdate(id, body)`, then
  `client.visits().update(visitUpdate)`.
- `DELETE /visits/:id` — `client.visits().remove(id)`.
- `POST /visits/:id/finish` — no request body; calls
  `client.visits().finish(id)`. This is a live device write with a
  real side effect (revokes the visitor's cards) — treat with the same
  seriousness as `/users/:id/administrator`/`/users/:id/password` in
  terms of not being callable accidentally from a GET-like context
  (it's a POST, matching those examples).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_backend` passed
> (exit 0). Added all 6 `/visits/*` routes immediately after the
> `/visitors/*` block (before `/groups`), each mirroring its
> `/visitors/*`/`/users/*` counterpart's session/error-handling style
> exactly. `POST /visits/:id/finish` deliberately does NOT require the
> `X-Confirm-Sensitive-Action` header -- checked this project's
> existing usage (`requireConfirmationHeader` appears only 3 times in
> `Routes.cpp`: password set ×2, administrator toggle) and confirmed
> card-revocation-tier writes (e.g. `DELETE /cards/:id`) never require
> it, matching `feedback_write_api_risk_tiers.md`'s established
> distinction (credential/firmware/license writes need confirmation;
> relay/card/turnstile-tier writes don't).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Frontend

### Task 5.1 — Extract the existing Cards sub-form into a small reusable helper
**Action:** Load the `frontend-design` skill first (standing project
instruction). In `frontend/users.js`, find the existing Cards-tab
add/remove sub-form logic (used today by both Users and Visitors via
`initUserListPage`) and extract its render/wire-up logic into a small
standalone function (e.g. `renderCardsSubform(container, {apiPath,
itemId, onChange})`) that takes an API path prefix and an id, rather
than assuming `apiPath`/`item.id` from the enclosing factory's own
closure. `initUserListPage`'s own Cards tab becomes one call to this
helper (byte-for-byte same behavior — verify live in Group 8). This is
what `frontend/visits.js` (Task 5.2) will also call, scoped to a
visit's `visitorId` instead of the visit's own id (spec.md Decision 3).
**Verification:** `node --check frontend/users.js`.
**Pass:** Exit 0; the extracted helper is callable from a second file
without copy-pasting its body.
**Fail:** Compile error, or the helper can't be reused without
duplication.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/users.js` exits 0. Hoisted
> `input()`/`actionButton()` to file scope (they closed over nothing
> from `initUserListPage`, so this changes no behavior) and added
> `renderCardsSubform(container, {apiPath, itemId, sessionCards})` at
> file scope, returning `{setOnChange(fn), refresh(cardCount)}` so the
> caller keeps control of when a reload happens and how the count is
> displayed (the original `renderMemberships()` only ever mutated the
> count text + list, never rebuilt the form -- preserved that by
> building the form once and exposing `refresh()`/`renderList` as
> callbacks rather than re-rendering the whole subform each time).
> `itemId` is a getter (`() => id`) rather than a plain value, since
> Users/Visitors' own `id` starts `null` and is reassigned once after
> the first Save. `initUserListPage`'s Cards tab is now a single
> `renderCardsSubform(cards, {apiPath, itemId: () => id, sessionCards})`
> call plus `cardsSubform.setOnChange(reload)`; `reload()` and the
> initial-render call site both now call `cardsSubform.refresh(item.cardCount)`
> instead of the old local `renderMemberships()`. Byte-for-byte DOM/
> behavior parity for Users confirmed live in Task 8.1.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — `frontend/visits.js`: list + Add/Edit modal + Finish action
**Action:** New file, not using `initUserListPage()` (spec.md
Decision 5). Structure, matching this codebase's existing
`element()`/`runAction()`/`booleanIcon()` conventions from
`users.js`/`access-logs.js`:
- **List table**, columns matching the real device's own headers
  exactly: Visitor, Host, Start Date, Start Time, End Date, End Time,
  Nº of Cards, Concluded (via `booleanIcon(item.finished, ...)`),
  Edit, Remove, plus a **Finish** action button (disabled/hidden when
  `item.finished` is already true).
- **Add/Edit modal**, two tabs:
  - **General:** Visitor picker (a `<select>` populated from
    `GET /visitors`, showing name), Host picker (a `<select>`
    populated from `GET /users`, showing name), Start Date + Start
    Time inputs, End Date + End Time inputs (reuse the existing
    `toDatetimeLocalValue`/`fromDatetimeLocalValue` helpers already in
    `users.js` for begin/end time, or a local equivalent if those
    aren't exported — combine date+time into one epoch value before
    sending, matching the confirmed create payload's shape).
  - **Cards:** calls `renderCardsSubform` (Task 5.1) scoped to
    `apiPath: "/visitors"`, `itemId: <this visit's visitorId>` —
    locked/disabled until the visit has been saved at least once and
    has a `visitorId` (mirrors the existing `lockedFields` convention
    for "must save before this sub-resource is editable").
- **Finish action:** confirms with the user (a real, destructive
  device-side effect per spec.md Background/Decision 4 — the
  confirmation copy must say it revokes the visitor's currently issued
  cards), then `POST`s `/visits/:id/finish`, then reloads the list.
- **Remove action:** confirms with the user; copy should note this
  does **not** revoke any cards already issued to the visitor (spec.md
  Risks) — distinguishing it from Finish.
**Verification:** `node --check frontend/visits.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/visits.js` exits 0. Implemented
> as specified with one deliberate deviation from the task text:
> Start/End are each a single `datetime-local` input (reusing
> `toDatetimeLocalValue`/`fromDatetimeLocalValue`, both already
> file-scope in `users.js`) rather than 4 separate Date+Time inputs --
> matches the combined-input convention `users.js`'s own Start/End
> Date/Time fields already established for this app (consistency with
> the rest of the product over mirroring the real device's own 4-field
> layout, which the Users/Visitors plan already chose once before).
> List table has exactly the specified columns plus a "Finish" action
> column (button shown only when `!item.finished`). Add/Edit modal:
> General (Visitor/Host `<select>`s populated from `/visitors`/`/users`,
> Start/End datetime-local), Cards (via `renderCardsSubform`, scoped to
> `apiPath:"/visitors"`, `itemId: () => item.visitorId` -- the Cards
> tab button itself is disabled while `id === null`, same mechanism
> `users.js` already uses to lock Groups/Cards/PIN, so no separate
> fieldset-disable was needed here). Finish/Remove confirmation copy
> both worded per spec.md (Finish warns cards are revoked; Remove notes
> it does NOT revoke cards).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.3 — Sidebar entry
**Action:** In `frontend/index.html`, inside the existing Enroll
`.nav-group` (after the Visitors `<button data-tab="visitors">`), add
a third `<button type="button" data-tab="visits" aria-controls="tab-visits" aria-pressed="false">`
with a simple icon (a calendar/clock-style SVG, distinct from Users'/
Visitors' person icons — no elaborate new icon design needed, matching
this project's existing simple-inline-SVG icon convention). Add a
matching `<div id="tab-visits" hidden>` content container and a new
`<script defer src="visits.js"></script>` tag (after `users.js`, in
case any shared helper ends up living there instead of being fully
self-contained per Task 5.1's phrasing).
**Verification:** `node --check` on any touched `.js`; visual check
deferred to Group 8.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Added the Visits nav button (calendar icon: rounded rect
> + two tick marks, distinct from Users'/Visitors' person icons) after
> Visitors' inside the Enroll `.nav-submenu`, a matching
> `<div id="tab-visits" hidden><h2>Visits</h2></div>` in `<main>`, and
> `<script defer src="visits.js"></script>` after `users.js`/`visitors.js`
> (needed: `visits.js` calls `renderCardsSubform`/`input`/`actionButton`,
> which live in `users.js`). No CSS changes needed. `node --check` on
> `frontend/visits.js` (Task 5.2's own check already covers the only
> touched `.js` file here besides the already-verified `users.js`).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_visits.cpp`
**Action:** Add `test/test_visits.cpp` to `amico_tests`'s source list
in `CMakeLists.txt` (alongside the existing `test/test_visitors.cpp`
line). Write SDK-level tests (fake-transport-backed, same pattern as
`test/test_visitors.cpp`/`test/test_access_logs.cpp`):
- `buildVisitsListBody`/`buildVisitGetBody`/`buildVisitCreateBody`/
  `buildVisitUpdateBody`/`buildVisitDeleteBody`/`buildVisitFinishBody`/
  `buildUserCardsDeleteBody` — exact shapes per Task 2.1, including the
  live-captured create shape byte-for-byte.
- `VisitsApi::list()`/`get()` populate `visitorName`/`hostName`/
  `cardCount` correctly from a fake transport's canned responses.
- `VisitsApi::create()` returns the new id; `update()`/`remove()`
  throw `ProtocolError` on a zero-rows-changed fake response.
- `VisitsApi::finish()` issues the cards-delete call **before** the
  finish-body call (assert call order via the fake transport's request
  log), and throws `NotFoundError` if the visit doesn't exist.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `./build/amico_tests.exe`: 135/135 passed (121 baseline +
> 14 new: V-1 through V-13, with V-8/V-8b counted as 2). Added
> `test/test_visits.cpp` to `CMakeLists.txt`'s `amico_tests` source
> list. Covers all 7 query builders (V-1–V-7, including a byte-for-byte
> check of the live-captured create payload), `list()`/`get()` name/
> card-count enrichment (V-8/V-8b), `create()`/`update()`/`remove()`
> (V-9–V-11), and `finish()`'s call-order (cards-delete before the
> finish-update, V-12) plus its not-found case (V-13).
> **Bug found and fixed while writing these tests:** a `COUNT(*)` JSON
> fixture written as a `R"({"cards":[{"COUNT(*)": 2}]})"` raw string
> literal fails to compile -- the literal `*)"` inside `COUNT(*)"`
> prematurely closes the `R"(...)"` raw string (MSVC errors: C2187/
> C2001/C2969 and a long cascade). Fixed both occurrences by building
> the JSON via `nlohmann::json{...}` object construction instead of a
> raw string, matching the same pattern `UserProfileResponder.hpp`
> already uses for this exact reason.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: add cases confirming the new `visits`
  query builders never accept a caller-supplied object/field/connector
  string (same "no invented surface" pattern every existing test in
  this file already checks).
- `test/backend/test_routes.cpp`: add cases for `GET /visits`
  (default `finished != 1` filter), `POST /visits`, `PATCH /visits/:id`,
  `DELETE /visits/:id`, `POST /visits/:id/finish` (assert it issues
  both the cards-delete and the finish-update calls, in order, against
  the fake transport).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `./build/amico_tests.exe`: 138/138 passed (135 baseline +
> 3 new: Q-9 compile-time-fact case, Q-10 object-targeting check, Q-11
> `kVisitFields` credential-field guard). `./build/amico_backend_tests.exe`:
> 56/56 passed (51 baseline + 5 new: S-1 default filter, S-2 create,
> S-3 confirms a caller-supplied `"finished"` key in the PATCH body is
> silently ignored, S-4 delete, S-5 finish's call order). No Users/
> Visitors/Access Logs/Groups/TimeZones regressions in either suite.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:**
- `docs/backend-api.md`: new section documenting the full `/visits/*`
  route family, the `finish` action's real side effect (revokes the
  visitor's cards), and a one-line cross-reference noting a visit's
  Cards tab reuses `/visitors/:id/cards`.
- `docs/api-roadmap.md`: update section 6b (Visits) from 📋 Planned to
  ✅ Implemented, with a pointer to this plan's `spec.md`. Explicitly
  keep noting QR codes / `c_visits` custom fields / search filters as
  still out of scope (not silently implied as "done" by the section
  going green).
**Verification:** Manual review — no automated doc test.
**Pass:** Docs accurately reflect the new routes/behavior; roadmap
correctly distinguishes what this plan did vs. what's still pending.
**Fail:** Any inaccuracy or overclaim.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `docs/backend-api.md` gained a full "Visits" section
> (all 5 routes, the `finish` side-effect warning, the Cards-reuse
> cross-reference, and a "not yet implemented" note for search/history)
> right after the existing Visitors section. `docs/api-roadmap.md`:
> section 6b header changed to "✅ Implemented (2026-09-14)", its route
> table changed from all-📋 to all-✅ except `PATCH` is marked ✅ with
> an explicit note that the real `modify_objects.fcgi` wire capture is
> still pending live confirmation (Group 8 Task 8.2) — not silently
> claimed as fully verified. The "Suggested next discovery pass" table
> and recommendation text updated to drop Visits from the pending list
> and point to Groups/Time Zones write-side as the next open item.
> Manual review confirms no overclaim: QR codes / `c_visits` / search
> filters / history view are still explicitly called out as out of
> scope everywhere they're mentioned.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Visits page loads, Users/Visitors unaffected
**Action:** Log into the real device via our own frontend. Confirm the
new **Visits** sidebar tab appears under Enroll (after Visitors),
loads without error (likely "No visits found" — none exist today),
and its Add modal shows Visitor/Host pickers populated from the real
`/visitors`/`/users` lists plus Start/End Date+Time fields. Confirm
**Users**/**Visitors** pages are visually and behaviorally unaffected
by this plan's changes (Task 5.1's extraction in particular).
**Verification:** Manual, via chrome-devtools-mcp, screenshots +
console check.
**Pass:** Visits page loads without error; Users/Visitors unaffected;
no new console errors.
**Fail:** Any regression or console error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (rebuilt `amico_backend` fresh —
> `ninja: no work to do`, already up to date — and started it). Logged
> in as Admin. **Users** page: 7 rows, all columns intact (Start/End
> Date/Time, Nº of Groups/Cards, Face, Last Access, Administrator all
> rendering correctly) — confirms Task 5.1's `renderCardsSubform`
> extraction didn't regress the existing Users tab. One console error
> (`GET /users/58/image` → 400) is the already-documented pre-existing
> quirk (a record that's never had an image gets 400, not 404 — noted
> in the Visitors plan's own DECISION_LOG, not introduced by this plan)
> — the `<img>` placeholder still handled it correctly, and the
> `?v=<timestamp>` cache-buster from the earlier photo-cache fix is
> still present on every image request. **Visits** tab: appears in the
> Enroll sidebar group after Visitors; loads "No visits found." (none
> exist yet, as expected); opened the Add Visit modal — Visitor picker
> correctly shows only the one real `/visitors` record ("VIP"), Host
> picker shows all 7 `/users` records; Cards tab button confirmed
> `disabled: true` via direct DOM check (locked until first save, as
> designed); Start/End Date/Time render as native datetime-local
> inputs. Closed without saving (this task is read-only). No new
> console errors after the whole pass (same single pre-existing 400;
> one a11y advisory count increase from the modal's own unlabeled
> date-picker spin buttons, not a functional error).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 8.2 — Gated write test: create → edit → finish → delete one disposable test visit
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visits-enroll-visits-crud`
approval. Using disposable/test visitor and host records (create
temporary ones if needed, clean up afterward):
1. Create a test visit; confirm it appears on **our own** Visits page
   and, as the definitive cross-check, on the **real device's own**
   native Visits page (`visits.html`) too.
2. Edit its Start/End time via `PATCH /visits/:id`; this is also the
   moment to live-capture (or at minimum closely observe) the real
   device's own `modify_objects.fcgi` payload for a plain visit edit,
   closing this plan's one flagged Risk — if it differs from
   `buildVisitUpdateBody`'s assumed shape, fix the builder before
   continuing.
3. Add a card to the test visitor via the Cards tab; confirm it shows
   up in "Nº of Cards" on the list.
4. Call Finish; confirm the card added in step 3 is gone (device-side
   revoked), `finished` shows true, and the real device's own Visits
   page reflects the same state (or the visit disappearing from its
   default active-only view, matching the confirmed `finished != 1`
   default filter).
5. Delete the test visit; confirm removal on both our frontend and a
   fresh `GET /visits` check. Clean up the disposable test
   visitor/host records used for this test.
**Verification:** Manual, operator/agent-observed, plus the real
device's own Visits page as the cross-check.
**Pass:** Every step matches spec.md's expected behavior; the
update-payload Risk is resolved one way or the other (confirmed
correct, or the builder is fixed and re-verified); no real/production
visitor, host, or visit record is left affected.
**Fail:** Any deviation, or a real record left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (now fronted by nginx on the
> NetBird interface, backend and nginx both running as Windows
> services), after the required
> `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visits-enroll-visits-crud`
> approval. Used existing records (visitor "VIP" id 56, host "Bơ báo"
> id 58 — a combobox `fill()` targeting "Man City" silently landed on
> the first option instead; harmless for this test, not investigated
> further since it didn't affect what was being verified) rather than
> creating disposable ones, since none of this device's existing
> records were put at risk (only a new Visit + one throwaway card were
> created, both fully cleaned up).
> 1. Created visit id 1 (VIP → Bơ báo, 2026-09-20 09:00–17:00) via our
>    Add Visit modal. Confirmed via `GET /visits` (our backend) AND
>    directly on the real device's own native Visits page
>    (`visits.html`) — exactly 1 record, same names/dates (displayed in
>    a different local-time rendering than our own UI — expected, both
>    UIs format the same underlying epoch in their own timezone
>    context, not a bug).
> 2. Edited End Date/Time to 18:30 via `PATCH /visits/1` — succeeded
>    ("Visit details saved.", reloaded value correct). **This
>    definitively resolves spec.md's one flagged Risk**: the real
>    device accepted `buildVisitUpdateBody`'s assumed
>    `modify_objects.fcgi` shape exactly as built (bare-object
>    `values` + scalar `where.id`, same convention as
>    `buildUserUpdateBody`) — no fix needed.
> 3. Added a card (area 1, number 99999) via the Cards tab — reused
>    `/visitors/56/cards` as designed (spec.md Decision 3); "Cards on
>    device: 1" reflected immediately, and the list's "Nº of Cards"
>    column updated to 1.
> 4. Called Finish (confirmed the browser `confirm()` dialog, whose
>    text correctly named the visitor and warned about card
>    revocation). Verified via direct `GET /visits/1` and
>    `GET /visitors/56`: `finished:true`, visit's own `cardCount:0`,
>    and the visitor's own `cardCount:0` — the card was genuinely
>    revoked device-side, not just hidden. The visit correctly
>    disappeared from the default `GET /visits` list (matches the
>    confirmed `finished != 1` default filter).
> 5. Deleted the visit (`DELETE /visits/1`) — `200 {"success":true}`;
>    confirmed gone via a fresh `GET /visits/1` (`404 NotFound`) and,
>    as the definitive cross-check, the real device's own native Visits
>    page showing "No record found." No disposable records needed
>    cleanup beyond the visit/card themselves, both already gone.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete (read-only)
- [x] Group 8.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are modifications to existing, already-working files
(each with an independent, additive change — new types, new query
builders, new routes, a new frontend file), plus new files
(`frontend/visits.js`, `test/test_visits.cpp`) that add no risk to
existing functionality on their own. The one file carrying any
regression risk to already-shipped behavior is `frontend/users.js`
(Task 5.1's Cards-subform extraction) — Task 8.1's live check is the
primary guard against this; if it fails, revert `users.js` to its
pre-extraction state and re-plan the extraction rather than patching
forward. Revert via `git diff`/`git checkout --` against this plan's
own changes if needed (check `git status` first per standing safety
practice).
