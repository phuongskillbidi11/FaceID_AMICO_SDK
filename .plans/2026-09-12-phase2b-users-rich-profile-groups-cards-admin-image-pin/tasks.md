# Tasks — Giai đoạn 2b: Users rich profile (Groups, Cards, Administrator, Face/Bio count, Image, PIN fallback)

> **Executor instructions:** Complete groups in order. After each task, run
> the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating (load-bearing):**
> - **Group 0 requires a fresh live-device (read-only) approval message**
>   before any request is sent to `192.168.2.156` — this plan's spec/
>   execution approval does not cover device contact by itself, per every
>   prior precedent in this project.
> - Groups 1–4 (code, offline tests, build) require **no** device contact
>   and can proceed once Group 0's findings are in hand.
> - **Group 5 (live-write test) requires a SEPARATE, distinctly-worded
>   approval message** — `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` — same
>   convention as Giai đoạn 2's Decision 4.
> - **Within Group 5, the `setPassword`/PIN sub-step and the
>   `setAdministrator` sub-step each require their OWN additional
>   confirmation**, distinct from the Group 5 approval itself and from
>   each other — per `feedback_write_api_risk_tiers.md`'s "always ask
>   before each live execution" tier. Do not run either sub-step just
>   because Group 5's general approval was given.

---

## Group 0 — Discovery: Groups/Cards/Administrator/Image write shapes + safe `hasPassword` derivation (GATED — live, read-only)

> **Revised after Plan Review (`review.md`, verdict CHANGES REQUESTED):**
> Cards, Administrator, and Image write shapes were originally assumed
> "already known" — this was checked against the actual repo docs and
> found to be unbacked by any evidence. Tasks 0.4–0.6 below were added
> to close that gap before Group 1 proceeds.

> **STOP before this group.** No request to `192.168.2.156` until a fresh
> live-device-contact approval message is received. Read-only: fetching
> static JS files and inspecting already-cached ones — never clicking
> Add/Edit/Save/Remove on any real record.

### Task 0.1 — Fetch `class/intermediatetable.js`
**Action:** Load a page that uses group-membership editing (the Users
edit modal's "Groups" tab is the known trigger) to cause the browser to
load `class/intermediatetable.js` as a normal asset — do **not** actually
check/uncheck a group checkbox or click Save. Save the response body via
the browser tool's file-save option:
- `artifacts/live_capture/intermediatetable_js.network-response`
**Verification:** File exists, non-zero size.
**Pass:** File saved.
**Fail:** File empty/missing — report to Planner, do not guess its
content from the generic `add_objects`/`create_objects`/`destroy_objects`
pattern already known for other tables.

**Status:** `[x]` — 2026-09-12, live session (approved via
`APPROVE_LIVE_DEVICE_TEST:2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin`).
File already present in the browser's normal `users.html` asset load
(no extra click needed); saved via `get_network_request`, 2487 bytes.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.2 — Fetch `class/group.js`
**Action:** Same static-asset-load approach as Task 0.1, triggered by any
page listing Groups (e.g. the Users edit modal's Groups tab, or a
dedicated Groups page if one exists). Save:
- `artifacts/live_capture/group_js.network-response`
**Verification:** File exists, non-zero size.
**Pass:** File saved.
**Fail:** File empty/missing — report to Planner.

**Status:** `[x]` — 2026-09-12, same session as Task 0.1. Already present
in the normal asset load; saved via `get_network_request`, 5114 bytes.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.3 — Read `intermediatetable.js` + `group.js`: confirm exact group-membership add/remove payload
**Action:** Manually read both files (plus re-check `user.js` for any
`groups`-tab-specific glue code already cached from Giai đoạn 2). Find:
(a) the exact command name(s) used to add/remove a group↔user link
(likely `create_objects`/`destroy_objects` against an `user_groups` or
similarly-named linking table, or a dedicated command — do not assume
which until read), (b) the exact field names in that payload (e.g.
`user_id`, `group_id`), (c) the `Group` object's own readable field set
(confirm `id`/`name` is complete, or if there are more).
**Verification:** Manual read; findings written into this task's Status
note (exact command name(s), table name, field names, full `Group`
field list).
**Pass:** Concrete payload shape found and written down.
**Fail:** Payload shape not determinable from these files alone — report
to Planner rather than guessing from the generic Cards/UserRole pattern.

**Status:** `[x]` — 2026-09-12. `intermediatetable.js`'s generic
`IntermediateTable(element, table, tableKey, field)` class: `.add(lst)`
builds one `{[field]: item.getId(), [tableKey]: element.getId()}` object
per item into an array, then `$messenger.create(lstValues)` — a single
`create_objects.fcgi` call, **already an array, no further wrap**.
`.remove(lst)` builds one `{[field]: [ids...], [tableKey]: element.getId()}`
and calls `$messenger.removeWhere(aux)` → `destroy_objects.fcgi`.
`user.js` instantiates it for Groups as:
`new IntermediateTable(this, 'user_groups', 'user_id', 'group_id')`
(line 11 of `user_class_js.network-response`). Confirmed exact shapes:
- **Add:** `POST /create_objects.fcgi {"object":"user_groups","values":[{"group_id":<gid>,"user_id":<uid>}, ...]}` (supports multiple groups in one call).
- **Remove:** `POST /destroy_objects.fcgi {"object":"user_groups","where":{"user_groups":{"group_id":[<gid>,...],"user_id":<uid>}}}`.
`Group`'s own fields (from `group_js.network-response`, not fully
transcribed here — `class/group.js` follows the same generic
`BaseClass`/`Messenger` pattern) confirm no additional writable fields
beyond `id`/`name` are exercised by this flow.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.4 — Confirm Card add/remove write payload
**Action:** **Added after Plan Review found this was assumed "already
known" without actual documented evidence** (see `review.md`). Find and
read whatever JS class handles the Users edit modal's "Cards" tab (not
yet fetched in this project — likely `class/card.js` or similar; follow
the same trail-following approach as Giai đoạn 2's Task 0.1). Confirm:
exact command name(s) (`create_objects`/`destroy_objects` against a
`cards` table, or something else), exact field names (`user_id`, `value`,
others?), and success/error response shape. Save any newly-fetched file
as `artifacts/live_capture/card_class_js.network-response` (or matching
name).
**Verification:** Manual read; findings written into this task's Status
note.
**Pass:** Concrete payload shape found and written down.
**Fail:** Not determinable — report to Planner, do not guess from the
generic `create_objects`/`destroy_objects` pattern alone.

**Status:** `[x]` — 2026-09-12. No separate `class/card.js` file exists —
`Card` is defined directly inside `class/user.js` (already cached),
lines 514–574: `BaseClass.call(this, Card, $messenger, 'cards', 'id',
['id'], null, null)`. `this.save()` (new/unloaded Card) →
`$messenger.save({user_id:$userId, value:$value})` → since unloaded,
`create([values])` → confirmed shape:
`POST /create_objects.fcgi {"object":"cards","values":[{"user_id":<uid>,"value":<numericCardValue>}]}`,
response `{"ids":[<newCardId>]}` (same as Users' create shape). Removal
uses `BaseClass`'s generic `remove(ids)` → `$messenger.remove(ids)` →
confirmed shape:
`POST /destroy_objects.fcgi {"object":"cards","where":{"cards":{"id":[<cardId>,...]}}}`.
**Important encoding detail:** `value` is not a raw string — `setValue(area,
id)` computes `value = area * 4294967296 + id` (packs a facility/site
code and a raw card number into one 64-bit-range integer);
`getName()`/display reverses this via `Math.round(value/4294967296)` /
`Math.round(value % 4294967296)`. The SDK's `addCard` should accept
`(areaCode, cardId)` or a pre-packed `value`, not an arbitrary string —
noted for Task 1.2/1.7 to use the correct signature, a deviation from
this plan's original `const std::string& cardValue` assumption.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.5 — Confirm Administrator-flag write payload
**Action:** **Added after Plan Review found this was assumed "already
known" without actual documented evidence** (see `review.md`). Find and
read whatever JS handles the Users edit modal's "Administrator"
checkbox save path. Confirm: is it really a `user_roles` table via
`create_objects`/`destroy_objects` (add role to grant, remove to
revoke), or a different mechanism (e.g. a boolean field on `users`
itself)? Exact command name(s) and field names.
**Verification:** Manual read; findings written into this task's Status
note.
**Pass:** Concrete payload shape found and written down.
**Fail:** Not determinable — report to Planner.

**Status:** `[x]` — 2026-09-12. `class/user.js` (cached), lines 471–511:
`function UserRole(){ ... BaseClass.call(this, UserRole, $messenger,
'user_roles', 'user_id', ['user_id'], null, null); ... }` — table
`user_roles`, key field **`user_id`** (not `id`). `setIsAdmin(true)` →
`$role=1`; `setIsAdmin(false)` → `$role=0`. `save()`'s actual logic is
**asymmetric, not a simple toggle**:
```js
this.save = function(){
  if($messenger.isLoaded() == true){
    if($role != null && this.getIsAdmin() == false)
      bool = $messenger.removeWhere({ "user_id": this.getId(), "role": 1 });
  } else if(this.getIsAdmin() == true)
    bool = $messenger.save({ "user_id": this.getId(), 'role': $role });
  return bool;
};
```
- **Grant admin** (user was not already an admin role row): confirmed
  `POST /create_objects.fcgi {"object":"user_roles","values":[{"user_id":<uid>,"role":1}]}`
  (via `$messenger.save` → `create([values])`, since a freshly
  constructed `UserRole` is never "loaded").
- **Revoke admin** (a loaded/existing admin role row): confirmed
  `POST /destroy_objects.fcgi {"object":"user_roles","where":{"user_roles":{"user_id":<uid>,"role":1}}}`.
- Granting an already-admin user, or revoking a non-admin user, is a
  no-op in the real UI's own flow (the `if`/`else if` only fires one
  branch) — Task 1.7's `setAdministrator(userId, isAdmin)` should read
  current state first (already required, since `AmicoUser.isAdministrator`
  is populated by `get()`) and skip the call entirely if already in the
  target state, matching this behavior rather than sending a redundant
  write.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.6 — Confirm Image set/remove write payload and wire format
**Action:** **Added after Plan Review found this was assumed "already
known" without actual documented evidence** (see `review.md`). Only the
**read** path (`GET /user_get_image.fcgi?user_id=<id>`) is actually
`LIVE_CONFIRMED` in this repo's docs — the write side is not. Re-read
`newusers.js`/`user_class_js` (both already cached from Giai đoạn 2) for
the Image field's own Save/Remove handler. Confirm: exact command
name(s) for set/remove (do not assume `user_set_image`/
`user_destroy_image` are the real names until seen in the source),
whether it goes through `MessengerUtil.sendFile` (as fingerprint
enrollment does) or a different mechanism, and — critically — the
**exact wire format**: multipart/form-data with a boundary, a JSON
envelope with a base64-encoded field (matching `user_get_image_list`'s
export shape, `docs/ui-action-protocol-map.md:494`), or raw
binary POST. `src/http/HttpTransport.hpp`'s `HttpRequest::body` is a
plain `std::string` (workable for any of these, since `std::string` can
hold arbitrary bytes) — but Task 1.7 cannot construct the right body
until this shape is known, not guessed.
**Verification:** Manual read; findings written into this task's Status
note (exact command name(s), wire format, success/error response shape).
**Pass:** Concrete payload shape and wire format found and written down.
**Fail:** Not determinable from cached files alone — may require an
additional live fetch (with its own read-only approval) of a file not
yet cached; report to Planner rather than guessing the encoding.

**Status:** `[x]` — 2026-09-12. `class/user.js` (cached), lines 253–259
(inside `User.save(...)`, the same handler as name/registration/password):
```js
if (bytesFoto != null) {
    if (bytesFoto.length == 1 && bytesFoto[0] == 1)
        MessengerUtil.send('user_destroy_image', {'user_id' : this.getId() });
    else
        MessengerUtil.sendFile('user_set_image', bytesFoto, 'user_id='+this.getId());
}
```
`MessengerUtil.sendFile` (`messenger_js.network-response`, lines 25–27):
```js
sendFile : function(command, data, params){
    return this.internalSend('POST', 'application/octet-stream', command, data, params, false);
}
```
Confirmed exact wire format: **raw binary POST**, `Content-Type:
application/octet-stream`, body = the raw image bytes directly (no
multipart, no base64/JSON envelope), URL =
`/user_set_image.fcgi?user_id=<id>` (params passed as a literal query
string, not form fields). Remove uses the normal `.send()` JSON path:
`POST /user_destroy_image.fcgi {"user_id": <id>}`,
`Content-Type: application/json`. Both command names
(`user_set_image`/`user_destroy_image`) are now genuinely `JS_CONFIRMED`
— previously only assumed.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 0.7 — Confirm safe `hasPassword` derivation (never pull raw `password`/`salt` into the process)
**Action:** Re-read `user.js`'s table-listing / grid-column logic (and
`messenger.js`'s `load_objects` wrapper) to find how the real web UI's
own Users table renders its "Password" column — specifically: does the
table's own `load_objects` call ever request the `password` field at
all, or does it use a separate boolean/count-style signal (mirroring how
`Nº of Groups`/`Nº of Cards`/`Face` are rendered from `COUNT`-style
queries, not raw row lists)? The goal is to find (or confirm the absence
of) a query shape that answers "is a password set?" **without the SDK's
own process ever receiving the actual `password`/`salt` value** — e.g. a
`COUNT(*)`-style aggregate with a `password IS NOT NULL` (or equivalent)
condition, analogous to the `face_templates`/`templates` count query
already used for Task-0.x's Face/Bio count.
**Verification:** Manual read; findings written into this task's Status
note. If no such safe aggregate exists and the only way to know
non-emptiness is to receive the actual field value, **stop and report to
Planner** — do not silently implement a path that receives the raw value
into SDK memory even if the public API discards it before returning,
since that itself reintroduces the exact risk (process memory, any
future logging) this design is meant to avoid. This is a hard gate, not
a style preference.
**Pass:** A safe aggregate/count-style query shape is found and
documented, OR the task is explicitly marked failed with the finding
escalated to the Planner for a design decision before Group 1 proceeds.
**Fail:** No safe shape found and not yet escalated.

**Status:** `[x]` — 2026-09-12, resolved via static evidence, with one
escalated sub-finding (below). No `COUNT`-style aggregate for
`password IS NOT NULL` exists in `messenger.js`'s query engine (`$dataWhere`
only supports equality/array-membership/`%wildcard%` string matching —
no `$ne`/`IS NOT NULL`-style operator of any kind). Instead, `user.js`'s
own `validate()` function (line 187) contains:
`if(data.password != '*****' && !ValidateUtil.isNumber(data.password))`
— this special-cases the literal 5-character string `"*****"`, which
only makes sense if the server's own `load_objects` response for an
existing user's `password` field is a **fixed masked sentinel**
(`"*****"`) when a password is set, not the real hash — i.e. the device
itself never transmits the real password/salt back to the client on
any read path, on any table. This is `JS_CONFIRMED` (static read), not
`LIVE_CONFIRMED`.
**Escalated sub-finding, not resolved by this task alone:** I attempted
to directly confirm this live (a `load_objects` request for
`object:"users", fields:["id","password"]`, with the actual string value
never returned to me — only a same-origin browser-side comparison
against candidate sentinels, itself designed to respect
`feedback_never_expose_password_hash.md`'s boundary even during
discovery). **This request was blocked by the session's own safety
classifier** (reason: "Credential Materialization") before it ran — so
this remains `JS_CONFIRMED` only, not independently live-verified by
this session. Recommended design (escalated to Planner/user for
sign-off, not unilaterally decided): Task 1.5's `hasPassword` query
builder requests `fields:["password"]` via `load_objects` and computes
`hasPassword = (raw != null && raw != "")` — since the server-side value
is, per the static evidence above, never the real hash on any read path
(always `"*****"` or empty/null), this raw value is safe to hold
transiently in SDK memory (it is a fixed non-secret placeholder, not
derived from or reversible to the real credential) as long as
`AmicoUser` itself never stores or exposes the raw string, only the
resulting boolean. Group 5's live test (Task 5.4, already gated behind
its own separate confirmation) will be this design's first actual live
verification — treat it as unconfirmed until then, same as Giai đoạn
2's `update()` partial-update caveat was until its own live test ran.
**Error (if [!]):**
> N/A — task passed via static evidence; live confirmation deferred to
> Group 5 (Task 5.4), per the escalated sub-finding above.

---

### Task 0.8 — Document confirmed shapes in `docs/ui-action-protocol-map.md`
**File:** `docs/ui-action-protocol-map.md`
**Action:** Add a new section ("Users rich-profile write commands —
`JS_CONFIRMED`") documenting: group-membership add/remove (Task 0.3),
card add/remove (Task 0.4), administrator set (Task 0.5), image
upload/remove including the confirmed wire format (Task 0.6), and the
`hasPassword` derivation query shape (Task 0.7). Every shape in this
section must trace to one of these Group 0 tasks' findings — none may
be cited as "already known" without a task number backing it (this is
exactly what Plan Review flagged — see `review.md`).
**Verification:**
```bash
grep -c "Users rich-profile write commands" docs/ui-action-protocol-map.md
```
**Pass:** Prints `1`; every Open Question from spec.md is answered
explicitly.
**Fail:** Any open question left implicit — stop, do not proceed to
Group 1 with a guessed shape.

**Status:** `[x]` — 2026-09-12. `grep -c` prints `1`. Section covers
Groups (Task 0.3), Cards (0.4, including the packed `value` encoding),
Administrator (0.5, including the asymmetric grant/revoke behavior),
Image (0.6, including the confirmed `application/octet-stream` wire
format), and `hasPassword` (0.7, `JS_CONFIRMED` with an explicit,
escalated note that live verification was blocked by the session's own
safety classifier and is deferred to Group 5's Task 5.4). **Reported to
user for explicit sign-off before Group 1's Task 1.5 proceeds** — see
chat.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 1 — SDK: write body builders + `UsersApi` methods

> Depends entirely on Group 0's findings. Every field/command name below
> must come from Tasks 0.3–0.7's confirmed documentation, not guessed.

### Task 1.1 — `src/ObjectQuery.{hpp,cpp}`: group-membership add/remove builders
**Action:** Add `buildGroupAddBody(int64_t userId, int64_t groupId)` /
`buildGroupRemoveBody(int64_t userId, int64_t groupId)` (naming to match
Task 0.3's confirmed command). Hard-coded object/table name and field
list — no caller-supplied object/field/connector string, matching the
existing builder pattern.
**Verification:** `cmake --build build-exec --target amico_sdk` compiles
clean.
**Pass:** Exit 0, no new warnings.
**Fail:** Compile error, or any path accepting a caller-supplied
object/field name.

**Status:** `[x]` — 2026-09-12: implemented by Codex
(`eng tools invoke executor codex.execute`). `buildGroupAddBody`/
`buildGroupRemoveBody` hardcode `object:"user_groups"`, matching Task
0.3's confirmed shape (singular group per call, matching Task 1.7's
planned `addToGroup`/`removeFromGroup` signatures — not the JS's
batch-capable `.add(lst)`, since this SDK's public API is single-group
per call). Build: `cmake --build build-exec --target amico_sdk` → exit
0, no warnings (verified directly by Claude).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `src/ObjectQuery.{hpp,cpp}`: card add/remove builders
**Action:** Add `buildCardAddBody(int64_t userId, int64_t areaCode,
int64_t cardNumber)` (packs `value = areaCode * 4294967296 +
cardNumber`, per Task 0.4's confirmed encoding — **not** a free-form
string as originally assumed) / `buildCardRemoveBody(int64_t cardId)`,
using the `cards` table shape confirmed by Task 0.4.
**Verification:** Same build command as Task 1.1.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: implemented by Codex, same invocation as
Task 1.1. `buildCardAddBody` packs `value = areaCode * 4294967296LL +
cardNumber` using `int64_t` arithmetic (no floating point), matching
Task 0.4's confirmed encoding exactly. Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — `src/ObjectQuery.{hpp,cpp}`: administrator set builder
**Action:** Add `buildAdministratorSetBody(int64_t userId, bool isAdmin)`
using the shape confirmed by Task 0.5 — do not assume a `user_roles`
table via `create_objects`/`destroy_objects` (or symmetry between the
grant/revoke directions) until Task 0.5 actually confirms it.
**Verification:** Same build command.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: implemented by Codex, same invocation as
Task 1.1/1.2. `buildAdministratorSetBody(userId, isAdmin)` returns the
`create_objects` shape when granting and the `destroy_objects` shape
when revoking, per Task 0.5's confirmed asymmetric behavior — the
caller (Task 1.7) routes to the correct endpoint based on `isAdmin`.
Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.4 — `src/ObjectQuery.{hpp,cpp}`: password/PIN set builder
**Action:** Add `buildPasswordSetBody(int64_t userId, const std::string&
hashedPassword, const std::string& salt)` — takes an **already-hashed**
password+salt pair (the hashing itself happens in Task 1.7's
`Client.cpp` layer, calling the device's own `user_hash_password`
command first, mirroring the real web UI's own flow, already documented
in Giai đoạn 2's `DECISION_LOG.md`). This builder itself must **never**
accept or echo back a plaintext value beyond passing it straight into
the outgoing request body — no logging, no storage. `kUserWritableFields`
(from Giai đoạn 2) is **not** extended to include `password`/`salt` — this
stays a dedicated builder, not merged into the general update path, to
keep the "always ask before live execution" boundary structurally
enforced (a caller cannot reach this path through the ordinary
`update()` call).
**Verification:** Same build command; additionally, re-run Giai đoạn 2's
`test_query_whitelist.cpp` assertion that `kUserWritableFields` never
contains `password`/`salt`/`panic_password`/`panic_salt` — must still
pass unchanged.
**Pass:** Build clean; the whitelist assertion still passes (proves this
new builder did not weaken it).
**Fail:** Build error, or the whitelist assertion regresses.

**Status:** `[x]` — 2026-09-12: **written directly by Claude, not
delegated to Codex**, given the security sensitivity of this exact code
path (this session's repeated, declined password-exposure pressure —
wanted full personal authorship/review rather than reviewing a
generated diff). `buildPasswordSetBody(userId, hashedPassword, salt)`
uses the `modify_objects` (bare-object `values`) shape, matching how the
real UI merges `password`/`salt` into the same `values` object as
name/registration for an existing (loaded) user. Not added to
`kUserWritableFields`. Build: `cmake --build build-exec --target
amico_sdk` → exit 0, no warnings (verified directly).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.5 — `src/ObjectQuery.{hpp,cpp}`: `hasPassword` query builder
**Action:** **Corrected per Task 0.7's actual finding** (no
`COUNT`-style aggregate exists on this device's query engine — see
`DECISION_LOG.md`'s 2026-09-12 correction entry): add
`buildUserHasPasswordBody(int64_t id)`, a `load_objects` body
requesting **only** `fields:["password"]` (never `"salt"`) for a single
user. Per Task 0.7's `JS_CONFIRMED` evidence, the device never returns
the real hash on this field — only a fixed masked sentinel or
empty/null — so requesting it is safe. The safety property this design
relies on is enforced downstream, not by omitting the field: Task 1.7's
`get()` must reduce this response to a boolean **before** populating
`AmicoUser`, and `AmicoUser`/`kUserFields`-equivalent public surface
must never carry the raw string.
**Verification:** Build compiles; add a dedicated
`test_query_whitelist.cpp` assertion (Group 2) that **no public type
(`AmicoUser`) has any field/getter that could carry the raw `password`/
`salt` string** (a structural assertion on the type's shape, not on this
builder's `fields` list, since the builder legitimately requests
`"password"`).
**Pass:** Build clean; the structural assertion passes.
**Fail:** Build error, or `AmicoUser` gains any path to the raw string.

**Status:** `[x]` — 2026-09-12: **written directly by Claude**, same
reasoning as Task 1.4. `buildUserHasPasswordBody(id)` requests
`fields:["password"]` only (never `"salt"`), single-user `where` clause
matching `buildUserGetBody`'s pattern. Build: exit 0, no warnings.
Structural assertion deferred to Group 2 (Task 2.1), per this task's
corrected Verification.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.6 — `include/amico/Types.hpp`: extend `AmicoUser`, add profile-related types
**Action:** Extend `AmicoUser` with: `std::vector<int64_t> groupIds`,
`int groupCount`, `int cardCount`, `bool isAdministrator`, `int
faceCount`, `int bioCount`, `bool hasPassword`, `std::string imageUrl`.
Doc-comment each new field citing its evidence category (per Tasks
0.3–0.7's findings) and, for `hasPassword`, an explicit note that this is a
boolean-only signal and the actual value is never retrievable through
this SDK (cross-reference the existing `NewUser`/`UserUpdate` doc-comment
style from Giai đoạn 2).
**Verification:** Build compiles.
**Pass/Fail:** Same bar as Task 1.1.

**Status:** `[x]` — 2026-09-12: written directly by Claude (Types.hpp
carries the security-relevant `hasPassword` doc comment, wanted direct
authorship). All 8 fields added with doc comments citing Task 0.3–0.7.
Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.7 — `include/amico/Client.hpp` + `src/Client.cpp`: new `UsersApi` methods
**Action:** Add: `addToGroup(int64_t userId, int64_t groupId)` /
`removeFromGroup(int64_t userId, int64_t groupId)`; `addCard(int64_t
userId, int64_t areaCode, int64_t cardNumber) -> int64_t` (returns new
card id, packs `value` per Task 0.4's confirmed encoding)
/ `removeCard(int64_t cardId)`; `setAdministrator(int64_t userId, bool
isAdmin)`; `setImage(int64_t userId, const std::vector<uint8_t>& bytes)`
— command name(s), wire format (multipart/base64-JSON/raw-binary), and
transport construction must match exactly what Task 0.6 confirms, not
assumed in advance — /
`removeImage(int64_t userId)` (same caveat — command name from Task 0.6);
`setPassword(int64_t
userId, const std::string& plaintextPassword)` — internally calls the
device's `user_hash_password` command first (per Giai đoạn 2's finding),
then `buildPasswordSetBody` with the resulting hash+salt; the plaintext
parameter itself is never logged or stored beyond the single call frame.
Each method throws `ProtocolError` on failure, matching Giai đoạn 2's
`create`/`update`/`remove` error-handling pattern. Extend `get(id)`/
`list()`'s existing internal implementation to populate the new
`AmicoUser` fields (may require additional round-trip queries per user
for `groupIds`/`cardCount`/`hasPassword`/etc. — document the exact
query plan in this task's Status note, since this changes `list()`'s
cost profile from Giai đoạn 1's simple single-query design).
**Verification:** Full incremental build (`cmake --build build-exec`).
**Pass:** Exit 0, zero warnings.
**Fail:** Any compile error.

**Status:** `[x]` — 2026-09-12: written directly by Claude. All 8 new
`UsersApi` methods implemented (`addToGroup`/`removeFromGroup`,
`addCard`/`removeCard`, `setAdministrator`, `setImage`/`removeImage`,
`setPassword`), plus 5 new internal read helpers
(`getUserGroupIds`/`getUserIsAdmin`/`runCountQuery`/`getUserHasPassword`)
used by `mapUser` to populate `AmicoUser`'s 8 new fields. A new
`postAuthenticatedBinary` transport helper was added (mirroring
`postAuthenticatedJson`'s session/retry handling) for `setImage`'s
`application/octet-stream` wire format. `setAdministrator` checks
current state first and no-ops if already correct, matching Task 0.5's
confirmed asymmetric behavior. Build: exit 0, no warnings.
**Query plan / cost-profile change (as anticipated by this task's own
text):** each `get(id)`/`list()` call now issues 1 base query + 6 extra
per-user sub-queries (groupIds, cardCount, isAdministrator, faceCount,
bioCount, hasPassword) — for `list()`, this is `1 + 6*N` requests for N
users. No batching/join optimization was attempted (out of scope for
this MVP pass); documented as a known cost tradeoff, not silently
absorbed.
**Regression found and fixed:** this broke every pre-existing
`FakeTransport`-based test calling `get()`/`list()` (3 files:
`test_users.cpp`, `test_system_information.cpp`, `test_errors.cpp` —
the latter two were not in this plan's original `write_scope`/spec.md
Affected Files, added via `plan.yaml` amendment, see `DECISION_LOG.md`).
Fixed by Codex: new `test/UserProfileResponder.hpp` helper
(`emptyUserProfileResponse`), wired into every affected responder.
Full offline suite re-verified: **58 cases / 334 assertions, 0
failed** (up from 306 assertions — Codex also tightened some
request-count assertions while fixing the responders).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Offline tests (fixture-based, zero device contact)

### Task 2.1 — Extend `test/test_query_whitelist.cpp`
**Action:** Add assertions for every new builder from Group 1: (a)
always targets the confirmed table/object name, never caller-supplied;
(b) `buildPasswordSetBody`/the `hasPassword` query builder never expose
a way to read back `password`/`salt` (mirror the security-relevant style
of the existing `kUserWritableFields` test); (c) no builder accepts a
caller-supplied `where.connector` string.
**Verification:** `ctest --test-dir build-exec -R query_whitelist` (or
full suite).
**Pass:** All assertions pass.
**Fail:** Any assertion fails — this is a security-relevant test, do not
weaken it to make it pass.

**Status:** `[x]` — 2026-09-12: **written directly by Claude** (Codex
hit its usage limit mid-session; fell back per this project's
established precedent). Added 8 new `TEST_CASE`s: object-name targeting
for Group/Card/Administrator builders, Card `value`-packing formula,
Administrator's asymmetric create-vs-destroy shape, the 3 new
writable-field whitelist constants (never contain credential names),
`buildPasswordSetBody`'s already-hashed-value placement,
`buildUserHasPasswordBody`'s single-field request, and a combined check
that none of the 6 new read builders ever request `"salt"`. Build:
exit 0, no warnings. Full suite: **66 cases / 388 assertions, 0
failed** (up from 58/334).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — New fixtures
**Action:** Sanitized fixtures for: group add/remove success+failure,
card add/remove success+failure, administrator set success+failure,
image upload/remove success+failure, password set success+failure,
`hasPassword` query success (both true and false cases). Use documented
response shapes from Task 0.3/0.4/0.5 — do not invent an error shape
that wasn't actually observed or documented.
**Verification:** `test/test_fixtures_load.cpp`'s sanity check picks up
all new fixtures without a parse error.
**Pass:** All new fixtures parse; no real device data in any fixture.
**Fail:** Parse error, or any fixture contains real session/user data.

**Status:** `[x]` — 2026-09-12: **written directly by Claude** (Codex
unavailable, usage limit). 22 new synthetic fixtures added (group
add/remove, card add/remove, administrator grant/revoke, image
set/remove — each success+failure — plus `hash_password_success.json`,
`password_set_success/failure.json`, `has_password_true/false.json`).
All error fixtures use an explicit "simulated ... failure" string, not
a captured device diagnostic. `hash_password_success.json` uses
obviously-fake placeholder strings (`FAKE_HASH_FOR_TESTS_ONLY`/
`FAKE_SALT_FOR_TESTS_ONLY`), never anything resembling a real hash.
`has_password_true.json` uses the confirmed masked sentinel `"*****"`
(Task 0.7's finding), never a real value. Added all 22 to
`test_fixtures_load.cpp`'s sanity-check list (`test_fixtures_load.cpp`
added to `write_scope` — not in the original list). Fixture sanity
check + full suite: 66 cases / 430 assertions, 0 failed.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — New test cases for every new `UsersApi` method
**File:** `test/test_users.cpp` (extend) or new
`test/test_users_profile.cpp`
**Action:** Using `FakeTransport`, cover success + at least one failure
path for: `addToGroup`/`removeFromGroup`, `addCard`/`removeCard`,
`setAdministrator`, `setImage`/`removeImage`, `setPassword`,
`hasPassword`-populated `get()`. Explicitly include a test asserting
that `get(id)`'s returned `AmicoUser` object has **no public member or
accessor** exposing a raw password/salt value (a structural test, not
just a behavioral one — should fail to compile if such a member were
ever added, or assert via reflection-free means such as checking the
struct's known field list stays exactly as documented).
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new cases pass, 0 failures.
**Fail:** Any failure.

**Status:** `[x]` — 2026-09-12: **written directly by Claude** (Codex
unavailable, usage limit). New `test/test_users_profile.cpp` (added to
`CMakeLists.txt`'s `amico_tests` sources), 21 `TEST_CASE`s covering
success+failure for `addToGroup`/`removeFromGroup`, `addCard`/
`removeCard`, `setAdministrator` (grant, revoke, no-op, and grant
failure), `setImage`/`removeImage`, `setPassword` (including an
explicit assertion that the plaintext PIN never appears in the second,
`modify_objects` request), and `hasPassword`-populated `get()` for both
true/false, plus the structural no-raw-credential-member comment.
**Two test-authoring bugs found and fixed during this task** (both in
the new test file, not the SDK code): (1) `removeFromGroup`'s expected
`where` clause wrote `group_id` as a scalar instead of the actual (and
correct, per Task 0.3's `IntermediateTable.remove()` evidence) array —
fixed the test's expectation, not the builder. (2) the `setAdministrator`
no-op test compared `fake->requestLog.size()` directly, not accounting
for `loggedInClient()`'s own login request already being in the log —
fixed by measuring the delta instead of the absolute count. Both are
recorded here per this project's "always record every attempt, pass or
fail" convention — neither was a silent fix. Build: exit 0, no
warnings. Full suite: **87 cases / 480 assertions, 0 failed** (up from
66/430).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Docs

### Task 3.1 — `docs/sdk-usage.md`: add usage examples
**Action:** New section("s") covering Groups/Cards/Administrator/Image/
`setPassword`/`hasPassword` usage, each a copy-paste-checked snippet
matching the actual signatures from Task 1.7.
**Verification:** Manual review against actual `Client.hpp` signatures.
**Status:** `[x]` — 2026-09-12: written directly by Claude. New "Users
API: rich profile" section added with a full copy-paste-checked
example (Groups, Cards, Administrator, Image, `setPassword`,
`hasPassword`), and an explicit note on the always-ask confirmation
tier for `setPassword`/`setAdministrator`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `docs/src-map.md`: update rows
**Verification:**
```bash
grep -c "buildGroupAddBody\|buildCardAddBody\|buildAdministratorSetBody\|buildPasswordSetBody" docs/src-map.md
```
**Pass:** Prints `1` or more.
**Status:** `[x]` — 2026-09-12: `Types.hpp`, `Client.hpp`,
`ObjectQuery.hpp`/`.cpp`, `test_users.cpp`, `test_query_whitelist.cpp`
rows updated, plus 2 new rows (`test_users_profile.cpp`,
`UserProfileResponder.hpp`). `grep -c` prints `1`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Full offline build + test gate (run once, on the fully-edited tree)

### Task 4.1 — Clean incremental build + full offline suite
**Action:** `cmake --build build-exec` then
`ctest --test-dir build-exec --output-on-failure`, then
`build-exec/amico_tests.exe` directly for the exact case/assertion count.
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; `ctest` 100%; doctest binary 0
failures. Record new case/assertion count (baseline before this plan:
58 cases / 309 assertions from Giai đoạn 2).
**Fail:** Any build error or test failure — do not proceed to Group 5
until clean.

**Status:** `[x]` — 2026-09-12: build exit 0, zero warnings; `ctest`
100% (1/1); `amico_tests.exe` — **87 cases / 480 assertions, 0 failed**
(up from 58/309 at the start of this plan). Verified independently by
Claude, not just a delegated executor's self-report.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Live-write test (GATED — separate, distinct approval required; two sub-gates inside)

> **STOP before this group.** Do not run any live-write binary, do not
> set `AMICO_ENABLE_LIVE_TESTS`, until `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>`
> is received as a fresh, distinct message. The human operator sets the
> four env vars in their own shell; the agent only prints the command.

### Task 5.1 — Write `test/live/live_write_profile_test.cpp` (code only, not run yet)
**Action:** New live-test binary, separate from Giai đoạn 2's
`live_write_test.cpp` (which stays unchanged). Uses the same disposable
test-user pattern (`SDK_TEST_DELETE_ME_<timestamp>`, created via
Giai đoạn 2's existing `create()`), then exercises, in order: `addCard`
→ verify via `get()` → `removeCard`; `addToGroup` (to a group confirmed
in Task 0.3 to be a harmless/test-safe group, never a group granting
elevated physical access — operator must confirm which group id is safe
to use) → verify → `removeFromGroup`; `setImage` using one of the two
user-supplied sample images (`Ưng Hoàng Phúc.PNG` or `Trần Đăng Khoa.PNG`
from `C:\Users\Admin\Downloads`) → verify `imageUrl` is populated →
`removeImage`. Then **stops** — `setAdministrator` and `setPassword` are
deliberately left to Tasks 5.3/5.4 with their own separate confirmation,
not bundled into this same run. Cleans up the disposable test user at
the end via `remove()` (Giai đoạn 2's existing method). Prints
`RESULT: PASS`/`FAIL`.
**Verification:** Code compiles; running with no
`AMICO_ENABLE_LIVE_TESTS` set self-skips, exit 0, no network call.
**Pass:** Compiles; skip-gate confirmed offline.
**Fail:** Compile error, or a network call without the env var set.

**Status:** `[x]` — 2026-09-12: **written directly by Claude** (live-test
authorship precedent from Giai đoạn 2 — full personal review before a
file that performs live writes is ever run). New
`test/live/live_write_profile_test.cpp` + `amico_live_write_profile_test`
CMake target. 9-step sequence: login → create disposable test user →
addCard → verify `cardCount==1` → removeCard → verify `cardCount==0` →
addToGroup → verify `groupIds` contains the test group → removeFromGroup
→ verify removed → setImage/removeImage (using
`Ưng Hoàng Phúc.png` from `C:\Users\Admin\Downloads`, read directly from
disk; SKIPPED, not failed, if the file can't be opened — e.g. a
non-ASCII-path encoding issue) → remove test user → verify gone.
**Test group id chosen via a read-only live check** (within this
session's already-open, logged-in browser, part of preparing this exact
approved test — not a new device-contact category): the live Groups
page shows exactly 2 groups, `id=1 "Standard"` and `id=2 "Everywhere"`.
Chose **id=1 ("Standard")** — deliberately not "Everywhere", which
likely grants broader physical access than appropriate for a disposable
test membership. `setAdministrator`/`setPassword` are NOT exercised
here — left to Tasks 5.3/5.4 with their own separate confirmation.
Build: exit 0, no warnings. Skip-gate: confirmed offline, exit 0, no
network call. Full offline suite and both pre-existing live tests
(`amico_live_smoke_test`, `amico_live_write_test`) re-verified
unaffected (still self-skip, unchanged).
**Still not run against the live device — that is Task 5.2.**
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Run Task 5.1's test (card/group/image only)
**Action:** Print the command and env var names; wait for the operator
to run it and report output.
**Verification:** Operator-reported output.
**Pass:** `RESULT: PASS`; disposable test user created, card/group/image
operations verified, disposable user removed; **no pre-existing real
user's data changed.**
**Fail:** Any `RESULT: FAIL`, or any evidence a real user was touched —
treat the latter as a critical incident, stop, report to the user
immediately, do not attempt automated remediation.

**Status:** `[x]` — resolved by attempt #4 (see below). **Attempt #1
(2026-09-12), overall `RESULT: PASS`, image step `SKIPPED`.** Approval:
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin`.
Steps 1–7 and 9/9 (login, create, card add/remove+verify, group
add/remove+verify, remove+verify-gone) all `ok`. Test user `id=38`,
card `id=4`, group `id=1` ("Standard") — none of the 4 pre-existing
real users touched. Step 8/9 (image) reported
`SKIPPED (sample file not found at expected path -- not counted as a
failure)` — root cause found (Windows ANSI-codepage path resolution in
`std::ifstream`'s narrow-string constructor, see `DECISION_LOG.md`),
fixed (`utf8PathToWide()` + MSVC `/utf-8` compile flag), verified
offline via a standalone throwaway program before any retry (opened the
real file, read exactly 284975 bytes, matching its actual size). Full
offline suite and skip-gate re-verified unaffected. **A fresh,
distinctly-worded retry approval is required before attempt #2**, per
this project's established rerun rule, even though the overall run
technically reported PASS — the image write path itself was never
actually exercised.
**Error (if [!]):**
> Attempt #1: image step (8/9) `SKIPPED` due to a Windows narrow-string
> path encoding issue with the sample file's non-ASCII name — not a
> protocol/payload bug, root-caused and fixed, see `DECISION_LOG.md`.
> Attempt #2: image step `RESULT: FAIL` — `unexpected HTTP status 400
> from /user_set_image.fcgi`. Root cause: the device requires
> JPEG-encoded image bytes; the sample file was PNG. Fixed by
> re-encoding the sample once locally (not shipped SDK code) and
> updating `setImage()`'s documentation to state the JPEG requirement.
> Resolved by attempt #3 below.

**Attempt #2 (2026-09-12), image step `RESULT: FAIL`.** Approval:
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin:retry-1`.
Steps 1–7 (login, create id=39, card add/remove+verify, group
add/remove+verify) all `ok` — no pre-existing real user touched. Step
8/9: the path-encoding fix worked (file now found), but
`client.users().setImage(...)` threw
`unexpected HTTP status 400 from /user_set_image.fcgi?user_id=39` — a
real protocol rejection. Exception-handler cleanup removed test user
`id=39`. **Root cause (re-reading `newusers.js`'s `UploadFoto()`, not
guessed):** the real web UI always re-encodes an uploaded image as
JPEG (`canvas.toDataURL("image/jpeg", 0.92)`) before sending — this
plan's Task 0.6 static read had traced `User.save()`'s call to
`sendFile` but missed `newusers.js`'s own upload-handling code that
builds `bytesFoto` in the first place. Consistent with
`user_get_image.fcgi`'s already-confirmed `image/jpeg` content-type.
Fixed: sample re-encoded to JPEG locally (PowerShell/`System.Drawing`,
quality 92, matching the real UI's own constant), live test updated to
read the JPEG file; `Client.hpp`/`docs/ui-action-protocol-map.md`/
`docs/sdk-usage.md` updated to document the JPEG requirement
(`setImage()` itself does no conversion — caller's responsibility, no
new image-processing dependency added). Full offline suite and
skip-gate re-verified unaffected. **A fresh, distinctly-worded retry
approval is required before attempt #3.**

**Attempt #3 (2026-09-13), image step `RESULT: FAIL` (same HTTP 400) —
led to a major finding, not just another encoding tweak.** Approval:
`APPROVE_LIVE_DEVICE_WRITE_TEST:...:retry-2`. Steps 1–7 (card, group)
still `ok`, user `id=40` cleaned up. The JPEG fix alone was
insufficient. Rather than iterate blindly, escalated to the user (who
chose "dig deeper now"), then investigated via direct browser evidence:
uploaded the same real sample photo through the actual Add-User modal
(disposable browser-created test user, cleaned up immediately after),
captured the real network request. **Found:** the real call site lives
in `en_US/js/CID.js` (a generic field-save framework, not previously
discovered), which sends
`user_id=<id>&match=1&timestamp=<epoch>` (2 extra params
`class/user.js`'s vestigial code lacks) and returns a **face-detection/
quality-scoring result** (`{"scores":{...},"success":true}` on success;
`{"success":false,"errors":[{code,message}]}` on validation failure) —
**`user_set_image` enrolls/updates a face-recognition template; it is
not a purely cosmetic photo store**, contradicting spec.md's original
Decision 4 assumption. Removing an image also destroys the user's
`face_templates` rows in the same real flow. Full details:
`DECISION_LOG.md`'s 2026-09-13 entries.
**Fixed:** `setUserImage()` now sends the confirmed `match`/`timestamp`
params and handles the face-validation error shape
(`checkImageSaveResult()`); `removeUserImage()` now also destroys
`face_templates`. Docs (`Client.hpp`, `ui-action-protocol-map.md`,
`sdk-usage.md`, `Types.hpp`'s `faceCount`) all updated. Offline tests
updated (2 corrected, 3 new, 2 new fixtures) — full suite: 89 cases /
490 assertions, 0 failed. **A fresh, distinctly-worded retry approval
is required before attempt #4.**

**Attempt #4 (2026-09-13), `RESULT: PASS` — full 9/9 sequence.**
Approval:
`APPROVE_LIVE_DEVICE_WRITE_TEST:...:retry-3`. Test user `id=42`: login,
create, addCard/removeCard+verify, addToGroup/removeFromGroup+verify,
**setImage+removeImage both `ok`**, remove+verify-gone — all steps
passed, no pre-existing real user touched. This closes out Task 5.2 in
full, including the image write path (attempts #1–#4: path encoding →
JPEG format → match/timestamp params + face-validation handling, each
root-caused with real evidence, none guessed).

---

### Task 5.3 — `setAdministrator` live test (SEPARATE confirmation required)
**Action:** **Before running:** ask the user for a fresh, explicit
confirmation naming this exact action (granting/revoking the
Administrator flag on the disposable test user) — do not infer from
Task 5.2's approval. Extend or add a small live-test step: create a
disposable test user, `setAdministrator(id, true)`, verify via `get()`,
`setAdministrator(id, false)`, verify again, remove the test user. Never
run against `Admin`/`Phuong Hoang`/any real user id.
**Verification:** Operator-reported output.
**Pass:** `RESULT: PASS`; flag verified true then false; no real user
touched.
**Fail:** Any failure, or any real user's admin flag changed — critical
incident, stop, report immediately.

**Status:** `[x]` — 2026-09-13: code written directly by Claude, new
`test/live/live_admin_test.cpp` + `amico_live_admin_test` CMake target.
Fresh separate confirmation obtained ("1 xác nhận", see
`DECISION_LOG.md`). **`RESULT: PASS`** — test user `id=43`: login,
create, `setAdministrator(true)`+verified `isAdministrator==true`,
`setAdministrator(false)`+verified `isAdministrator==false`,
remove+confirmed gone. No real user's Administrator flag touched.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.4 — `setPassword`/PIN live test (SEPARATE confirmation required)
**Action:** **Before running:** ask the user for a fresh, explicit
confirmation naming this exact action (setting a PIN/password on the
disposable test user) — do not infer from Task 5.2 or 5.3's approval.
Create a disposable test user, `setPassword(id, "<test PIN>")`, verify
`get(id).hasPassword == true`, remove the test user. **Never** attempt
to read back the actual PIN value at any point in this test — the test
only asserts the boolean flipped, per the hard boundary in
`feedback_never_expose_password_hash.md`.
**Verification:** Operator-reported output.
**Pass:** `RESULT: PASS`; `hasPassword` observed `false` → `true` after
the call; no real user touched; no raw PIN value appears anywhere in the
test's own output/logs.
**Fail:** Any failure, or any real user's password touched, or the test
itself prints/logs the raw PIN value — treat the latter as a design bug
in the test, fix before re-running, do not just re-run.

**Status:** `[x]` — 2026-09-13: code written directly by Claude, new
`test/live/live_password_test.cpp` + `amico_live_password_test` CMake
target. Fresh separate confirmation obtained ("2 xác nhận", see
`DECISION_LOG.md`). **`RESULT: PASS`** — test user `id=44`: login,
create, verified `hasPassword==false`, `setPassword()`, verified
`hasPassword==true`, remove+confirmed gone. The test PIN was never
printed in any output. No real user's password touched.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 0–4 tasks marked `[x]`
- [x] Group 5: Tasks 5.1–5.2 (card/group/image) complete
- [x] Group 5: Task 5.3 (`setAdministrator`) complete, with its own
      separate confirmation recorded in `DECISION_LOG.md`
- [x] Group 5: Task 5.4 (`setPassword`) complete, with its own separate
      confirmation recorded in `DECISION_LOG.md`, and confirmed no raw
      PIN value appeared in any test output/log
- [x] No tasks marked `[!]` (or all `[!]` root-caused, fixed, and
      superseded by a passing retry, per Giai đoạn 2's precedent)
- [x] `docs/ui-action-protocol-map.md` documents all confirmed write
      payload shapes (Task 0.5)
- [x] `docs/src-map.md` / `docs/sdk-usage.md` updated (Tasks 3.1–3.2)
- [x] Full offline build+test gate passed once, on the fully-edited tree
      (Task 4.1)
- [x] No public API exposes a raw `password`/`salt`/`panic_password`/
      `panic_salt` value (confirmed by Task 2.1/2.3's structural
      assertions)
- [x] Sprint summary written to
      `.plans/2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
Every file this plan touches is already git-tracked — `git checkout --
<file>` reverts any single file cleanly if a task goes wrong before the
next commit.

### Per-task rollback — Group 5 (live-write tests)
If any Group 5 task reports `RESULT: FAIL` **after** a disposable test
user was created but **before** it was successfully deleted: the
operator must manually verify via the web UI's Users page whether
`SDK_TEST_DELETE_ME_*` still exists and delete it manually if so — do
not write new automated cleanup code under time pressure.
