# AMICO Backend — Full API Roadmap

> **Purpose:** One reference listing every API endpoint this project
> either already exposes, or would need to expose to cover the real
> AMICO device's full sidebar menu (`http://192.168.2.156/`) — the way
> a product like CredoID publishes a complete API reference.
>
> **Evidence discipline:** Every "Planned" endpoint below is only
> proposed where the underlying device protocol has already been
> `LIVE_CONFIRMED`/`JS_CONFIRMED` in `docs/ui-action-protocol-map.md`.
> Sidebar areas with **no** discovery evidence yet are listed by name
> only, marked `discovery pending` — no endpoint shape is guessed for
> them. See that doc for full evidence detail; this file only
> summarizes it into a REST-shaped plan.

---

## Legend

| Status | Meaning |
|---|---|
| ✅ Implemented | Route exists today in `backend/Routes.cpp`, documented in `docs/backend-api.md` |
| 📋 Planned (evidence-backed) | Not implemented yet, but the device protocol is already `LIVE_CONFIRMED`/`JS_CONFIRMED` — safe to spec into a real plan without further discovery |
| 🔍 Discovery pending | Sidebar area exists on the real device; no protocol evidence gathered yet — must be read (static JS or live browse) before any endpoint can be honestly specified |

---

## 1. Session / Auth — ✅ Implemented

| Method | Path | Notes |
|---|---|---|
| ✅ | `POST /login` | `{deviceUrl, username, password}` → session cookie |
| ✅ | `POST /logout` | Ends session |
| ✅ | `GET /session` | `{loggedIn, deviceUrl?}`, no cookie required |

## 2. Users (Enroll → Users) — ✅ Implemented

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /users?limit=&offset=` | List, paginated |
| ✅ | `GET /users/:id` | Detail |
| ✅ | `POST /users` | Create |
| ✅ | `PATCH /users/:id` | Update name/registration |
| ✅ | `DELETE /users/:id` | Remove |
| ✅ | `POST /users/:id/groups/:groupId` | Add to group |
| ✅ | `DELETE /users/:id/groups/:groupId` | Remove from group |
| ✅ | `POST /users/:id/cards` | Add card |
| ✅ | `DELETE /cards/:cardId` | Remove card |
| ✅ | `PUT /users/:id/administrator` 🔒 | Grant/revoke admin |
| ✅ | `GET /users/:id/image` | Read photo (proxied) |
| ✅ | `PUT /users/:id/image` | Upload/enroll face |
| ✅ | `DELETE /users/:id/image` | Remove photo + face template |
| ✅ | `PUT /users/:id/password` 🔒 | Set door PIN (write-only) |

**Not yet covered even for existing Users:** a `GET /users/:id/cards`
list route — tech debt already recorded in Giai đoạn 4's
`DECISION_LOG.md` (frontend can only track cards added this page
session; the device has no bulk card-list-per-user query either, per
that same finding).

## 2b. Visitors (Enroll → Visitors) — ✅ Implemented

Same underlying `users` object as Users above, filtered to
`user_type_id = 1` (LIVE-CONFIRMED) — every route is the identical
shape as its `/users/*` counterpart. See `docs/backend-api.md`'s
"Visitors" section and
`.plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md`
for the full evidence trail, including how `user_type_id` gets set on
create (a device-side `defaultValue` mechanism, discovered via direct
browser class introspection) and the CPF custom field (`c_users`
table, hardcoded for this device's specific configuration — not a
generic Custom Fields implementation).

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /visitors?limit=&offset=` | List, paginated, filtered to `user_type_id=1` |
| ✅ | `GET /visitors/:id` | Detail (includes `cpf`, `null` if unset) |
| ✅ | `POST /visitors` | Create (`user_type_id` set by the route, not client-supplied; optional `cpf`) |
| ✅ | `PATCH /visitors/:id` | Update name/registration/cpf |
| ✅ | `DELETE /visitors/:id` | Remove (includes defensive `c_users` cleanup) |
| ✅ | `POST /visitors/:id/groups/:groupId` / `DELETE .../:groupId` | Group membership |
| ✅ | `POST /visitors/:id/cards` | Add card (`DELETE /cards/:cardId` shared with Users, type-agnostic) |
| ✅ | `GET/PUT/DELETE /visitors/:id/image` | Photo/face enrollment |
| ✅ | `PUT /visitors/:id/password` 🔒 | Set door PIN |

**Deliberately not implemented** (matches the real device's own
confirmed Visitor form, which has no such control): an Administrator
toggle for Visitors.

## 3. Access Logs — ✅ Implemented (matches the real device's "Access (Global)" report)

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /access-logs?from=&to=&limit=&offset=&userIds=&groupIds=&timeZoneIds=` | All 8 columns of the real "Access (Global)" report — resolved `userName`/`employeeId`/`portalName`/`timeZoneName`, computed `authorizationLabel`/`identificationLabel`, `{entries, total}` pagination, plus User/Group/Time Zone ID filters (2026-09-14). See `docs/backend-api.md` for the full shape and `.plans/2026-09-14-redesign-access-logs-frontend-and-backen/` + `.plans/2026-09-14-access-global-report-full-parity-reports/` for the evidence trail. |

**Also done (2026-09-14, full-parity plan):** the sidebar "Reports"
grouping, breadcrumb, Filters panel chrome, working User/Group/Time
Zone filter dropdowns (native multi-selects, backed by `GET /groups`/
`GET /timezones`, section 5/6 below), a frontend-only CSV Export of
the current page, and a print stylesheet.

**Still deferred:** the other 4 report variants (Access by Group/Time/
User, Alarms Global, Users report — see section 7 below) — this
project only implements Access (Global). Export is scoped to the
*currently displayed page*, not every matching row across all pages
(spec.md Decision 3 of the full-parity plan) — a deliberate, documented
scope cut, not an oversight.

## 4. System Information — ✅ Implemented (read-only)

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /system-information` | serial, firmware, network, license summary |
| ✅ | `GET /health` | Reachability of the active session's device |

---

## 5. Groups (Enroll → Groups) — ✅ Implemented (read + write, 2026-09-15) — ⚠️ known gap found 2026-09-15

**Known gap found during Scheduled Unlock discovery (2026-09-15):**
the real device's own Group Edit page has **3 tabs — General, Users,
Time Zones —** but this project's shipped Groups write-side plan
(`fe1e4d9`) only implemented General (the `name` field). Confirmed
live via `group.html`:
- **"Users" tab — not a gap.** Same underlying `user_groups`
  relationship already fully covered by
  `UsersApi::addToGroup()`/`removeFromGroup()` (shipped, Users
  section). This tab is only an alternate UI surface (manage
  membership from the Group's own page instead of the User's) — a
  possible frontend nicety, not a missing SDK/backend capability.
- **"Time Zones" tab — a real gap.** Groups link to time zones through
  the exact same `access_rules`/`access_rule_time_zones` mechanism
  documented in section 10b for Scheduled Unlock (`class.js`'s
  `groupsData.fields.time_zones`, client-side-only registration,
  `intermediateTable: access_rule_time_zones`,
  `intermediateTableBy: [portal_access_rules, group_access_rules]`).
  The real device's own Groups list even has a "Nº of Time Zones"
  column ("Everywhere": 1, "Standard": 0) that this project's `GET
  /groups` response has no equivalent field for. **Not implemented at
  all** in this project — no SDK type, no route, no frontend tab.
  Given section 10b's Scheduled Unlock discovery already confirmed the
  exact `create_objects.fcgi`/`destroy_objects.fcgi` shapes for the
  underlying `access_rule_time_zones` link (just via
  `group_access_rules` instead of `scheduled_unlock_access_rules` as
  the other half of the join), this should be a fast follow-up once
  Scheduled Unlock's own write side is planned/implemented, reusing
  the same access_rules-linking pattern.

Device protocol `LIVE_CONFIRMED` (`docs/ui-action-protocol-map.md`
"Groups" section): `object:"groups"`, `fields:["id","name"]`, same
list/count/pagination pattern as Users.

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /groups` | `load_objects.fcgi` `object:"groups"` — implemented 2026-09-14 for the Access (Global) report's Group filter (`docs/backend-api.md`). Name-only, no pagination (this device has few enough groups that the full list is always returned). |
| 📋 | `GET /groups/:id` | same, filtered by id — not yet needed by any UI, not implemented |
| ✅ | `POST /groups` | `create_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15 via XHR-interceptor capture: `{"join":"LEFT","object":"groups","fields":["id","name"],"where":[],"order":["name"],"values":[{"name":"<name>"}]}` — same extended shape as Visits' own create, not Users' leaner shape. See `.plans/2026-09-15-groups-write-side/`. |
| ✅ | `PATCH /groups/:id` | `modify_objects.fcgi` — built by symmetry with the shared `messenger.js` mechanism (same code path already `LIVE_CONFIRMED` for Users/Visits); independently live-confirmed for `groups` specifically in this plan's own Group 8 |
| ✅ | `DELETE /groups/:id` | `destroy_objects.fcgi` — same confirmation status as `PATCH` above |

**Protected group id 1** ("Standard" on this device): the real UI's
own `class.js` (`groupsData.noSave = [1]`) disables editing/removing
whichever group has id 1 — confirmed live (its Name field renders
`disabled="disabled"`; "Everywhere", id 2, does not). This is a
client-side-only restriction as far as confirmed; the implementation
does not replicate it server-side (see spec.md Decision 2) — only the
frontend mirrors it defensively.

## 6. Time Zones (Enroll → Time Zones) — ✅ Implemented (read + write, 2026-09-15)

`LIVE_CONFIRMED`: two device objects —
`object:"time_zones"` (`fields:["id","name"]`) and
`object:"time_spans"` (`fields:["id","time_zone_id","start","end",
"sun".."sat","hol1".."hol3"]`, filtered by `time_zone_id`).

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /timezones` | `load_objects.fcgi` `object:"time_zones"` — implemented 2026-09-14 for the Access (Global) report's Time Zone filter (`docs/backend-api.md`). |
| ✅ | `GET /timezones/:id/spans` | `load_objects.fcgi` `object:"time_spans"`, filtered by `time_zone_id` — implemented 2026-09-15. |
| ✅ | `POST /timezones` | `create_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15 via XHR-interceptor capture: same extended shape as Groups'/Visits' own create. See `.plans/2026-09-15-timezones-write-side/`. |
| ✅ | `PATCH /timezones/:id` | `modify_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 8 |
| ✅ | `DELETE /timezones/:id` | `destroy_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 8 |
| ✅ | `POST /timezones/:id/spans` | `create_objects.fcgi` against `time_spans` — `LIVE_CONFIRMED` 2026-09-15, Group 8. **Real bug caught and fixed here**: the device requires `sun`/`mon`/…/`hol3` as plain 0/1 integers, not JSON booleans (`{"error":"Invalid member 'sun' (int expected, got boolean)","code":1}` on the first real attempt) — matches the field's already-known 0/1-integer read-side shape, but this write-side requirement wasn't confirmed until this live test. |
| ✅ | `PATCH /timespans/:id` | `modify_objects.fcgi` against `time_spans` — `LIVE_CONFIRMED` 2026-09-15, Group 8 (same int-not-boolean fix applies) |
| ✅ | `DELETE /timespans/:id` | `destroy_objects.fcgi` against `time_spans` — `LIVE_CONFIRMED` 2026-09-15, Group 8 |

**Protected time zone id 1** ("Always Allowed" on this device): same
`noSave:[1]` pattern already found for Groups — confirmed live (its
Name field renders `disabled="disabled"`; its time-span sub-table
shows no Add/Remove controls at all). Not replicated server-side (see
spec.md Decision 3) — only the frontend mirrors it defensively.

## 6b. Visits (Enroll → Visits) — ✅ Implemented (2026-09-14)

`JS_CONFIRMED` via `en_US/js/class.js` (`CID.createClass({'object':'visits', ...})`,
lines ~199-505 of the live-captured copy) — this is the config object
`visits.js` (`new Table($('#tbl_visits'), visits)`) actually binds to;
it is **not** defined in `visits.js`, `visits.html`, or `main.js` at
all, which is why two earlier passes in this same discovery thread
came up empty. `main.js` loads `class.js` unconditionally for every
page (`addScript([...])` around line 696), and `class.js` registers
every domain object (`visits`, `custom_tables`, `c_visits`, etc.) as a
side effect of being loaded — a pattern distinct from the `class/*.js`
per-object files (`user.js`, `group.js`, `timezone.js`, ...) that
`main.js` also loads separately.

Device object `visits` — fields:

| Field | Type | Notes |
|---|---|---|
| `id` | BigInt | PK |
| `visitor_id` | BigInt | FK → `users` (the visitor being hosted) |
| `host_id` | BigInt | FK → `users` (the employee hosting the visit) |
| `begin_time` | date (epoch seconds) | scheduled visit start |
| `end_time` | date (epoch seconds) | scheduled visit end; `0` = not set/open-ended |
| `finished` | boolean | marks the visit concluded |

UI-only composite fields (not real device columns — assembled/split by
`class.js`'s own `save()`/`get()` handlers, `isField:false`):
`users_visitor` / `users_host` (the visitor/host picker widgets, backed
by `users`), `_begin_date`+`_begin_time` and `_end_date`+`_end_time`
(date/time pickers that combine into `begin_time`/`end_time` on save),
`cards` / `qrcodes` (per-visit card/QR-code issuance, `listEdit` widgets
scoped to `visitor_id`; `qrcodes` only shown when
`Main.isQRCodeModeAlpha()`), `c_visits` (custom fields, joined by
`visit_id` — same pattern as `c_users` for Users/Visitors).

Confirmed business rules (from `class.js`'s `validateBeforeSave`/`save`):
- End time must be after start time, unless end is unset (`0`).
- The list view's default filter excludes `finished=1` visits — i.e.
  Visits only shows **active/upcoming** visits by default, not history.
- Marking a visit `finished` immediately (client-side, via
  `destroy_objects.fcgi`) revokes the visitor's `cards` and `qrcodes`
  rows and stamps `end_time = now`. This is a real device write
  side-effect, not just a flag flip — important if we ever implement a
  "conclude visit" endpoint.
- Built-in filters (search): visitor's name, visitor's id, visitor's
  card (Wiegand facility+card code, same decode as elsewhere in this
  project).

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /visits?limit=&offset=` | `load_objects.fcgi` `object:"visits"`, default `where finished != 1` — implemented 2026-09-14, see `.plans/2026-09-14-implement-visits-enroll-visits-crud/` |
| ✅ | `GET /visits/:id` | same, filtered by id, no `finished` filter |
| ✅ | `POST /visits` | `create_objects.fcgi` — `LIVE_CONFIRMED` payload (byte-for-byte matched in `test/test_visits.cpp`'s V-3 case): `{"join":"LEFT","object":"visits","fields":["id","visitor_id","host_id","begin_time","end_time","finished"],"where":[],"order":["id"],"values":[{"visitor_id":56,"host_id":50,"begin_time":1789405080,"end_time":1789466400,"finished":0}]}` |
| ✅ | `PATCH /visits/:id` | `modify_objects.fcgi` — built by symmetry with `buildUserUpdateBody`'s confirmed shape; the exact real-device `modify_objects.fcgi` wire capture for a plain visit edit is still **not independently live-verified** (only `create_objects.fcgi` was) — flagged for confirmation during Group 8's live check (`.plans/2026-09-14-implement-visits-enroll-visits-crud/tasks.md` Task 8.2) |
| ✅ | `DELETE /visits/:id` | `destroy_objects.fcgi` — does **not** cascade-revoke the visitor's cards (only `finish` does, matching confirmed device behavior) |
| ✅ | `POST /visits/:id/finish` | conclude a visit — implemented backend-side as an explicit 2-step operation (revoke the visitor's `cards` via `destroy_objects.fcgi`, then `modify_objects.fcgi` setting `finished`/`end_time`), mirroring `class.js`'s own client-side `save()` side effect. Only `cards` are revoked — `qrcodes` are deliberately out of scope (unconfirmed feature-flag state on this device) |

Cards on a visit reuse the already-implemented `POST /visitors/:visitorId/cards` /
`DELETE /cards/:cardId` (see section 2b) — no separate `/visits/:id/cards`
route exists; cards belong to the visitor, not the visit record. Not yet
implemented: search/filter on `GET /visits` (the real device's own
visitor name/id/card filters are documented above but not wired in),
and a "show finished visits" history view — see
`.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md`'s Scope
section for the full list of deliberate exclusions.

## 6c. Holidays (Enroll → Holidays) — ✅ Implemented (2026-09-15)

`LIVE_CONFIRMED` via XHR-interceptor capture of the real device's own
Add Holiday form (`.plans/2026-09-15-holidays-write-side/spec.md`
Background) — device object `holidays`, fields: `id`/`name`/`start`/
`hol1`/`hol2`/`hol3`/`repeats`/`end`. `end` is a **derived, not
independently settable** field (`start + 86399`, computed by the real
device's own `class.js` `beforeSave` hook and by this SDK internally
— its own Add/Edit form has no End control at all). Unlike Groups/Time
Zones, `holidays` has **no `noSave` protected-id record** — every
holiday supports full edit/remove.

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /holidays` | `load_objects.fcgi` `object:"holidays"` |
| ✅ | `POST /holidays` | `create_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15 via XHR-interceptor capture: same extended shape as Groups'/Time Zones' own create; `hol1`/`hol2`/`hol3`/`repeats` sent as 0/1 integers (independently confirmed for this object, not just inferred from `time_spans`) |
| ✅ | `PATCH /holidays/:id` | `modify_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 7 |
| ✅ | `DELETE /holidays/:id` | `destroy_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 7 |

No protected holiday id — every record supports full edit/remove, in
both the real device's own UI and this backend/SDK.

## 7. Reports (the other report variants + export) — 📋 Planned (evidence-backed)

The "Access (Global)" report's own row data (joins + labels +
pagination) is now implemented directly on `GET /access-logs` (see
section 3) — it does **not** use `report_generate.fcgi` at all
(spec.md Decision 1: that endpoint returns semicolon-delimited export
text, not a stable JSON list API; the join is done server-side in C++
instead, mirroring how `AmicoUser` is already enriched).

Still planned: browsing/switching between the device's other report
*definitions* (Access by Group/by Time/by User, Alarms Global, Users),
and CSV export/print — both of which genuinely do need
`report_generate.fcgi`/`object:"reports"`/`object:"report_filters"`
(the latter two use an unusual nested-object `where` shape, e.g.
`{"reports":{"id":1}}` — different from every other query in this
codebase, handle explicitly, don't reuse the existing whitelist
builder blindly).

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /reports` | `load_objects.fcgi` `object:"reports"` — list of report definitions (Access Global/by Group/by Time/by User/Alarms Global/Users) |
| 📋 | `GET /reports/:id/filters` | `object:"report_filters"`, nested-where shape |
| 📋 | `GET /reports/:id/export` | Two-step `report_generate.fcgi` (id-query then full-row query), returns `text/plain` semicolon-delimited rows — **never persist real row data to any repo file**, per `docs/security-sanitization-policy.md` |

**Report designer** (`reportcustomconfig.html`) is a write-shaped
report-authoring UI — 🔍 discovery pending, not covered by the above.

## 8. License Mode (Settings) — 📋 Planned (evidence-backed, read-only for now)

`LIVE_CONFIRMED`: `POST get_configuration.fcgi {"sec_box":
["catra_role"]}` → `{"sec_box":{"catra_role":"0"}}`.

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /license` | `get_configuration.fcgi` `{"sec_box":["catra_role"]}` + existing `system_information.fcgi` license fields |

The write side (upgrading the license tier, password-gated) was
**deliberately not exercised live** (Cancel only, per the discovery
pass's own discipline) — 🔍 discovery pending if ever needed; this is
also a strong candidate for the "credential/firmware-adjacent write"
risk tier (per `feedback_write_api_risk_tiers.md`) requiring
per-attempt confirmation, same bar as `setPassword`/`setAdministrator`.

## 9. Date and Time (Settings) — 📋 Planned (evidence-backed, read-only for now)

`LIVE_CONFIRMED`:
```
get_configuration.fcgi {"ntp":["enabled","timezone"]}
get_configuration.fcgi {"general":["clock_12h_format","month_day_year_format"]}
get_ntp_server.fcgi {}
```
Write side (`set_system_time`, `set_ntp_server`, `get_ntp_server_status`)
already `UI_HANDLER_CONFIRMED` (command names known, exact payload
shape not yet read).

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /settings/date-time` | The three `get_*` calls above, combined |
| 📋 | `PUT /settings/date-time` | `set_system_time`/`set_ntp_server` — payload shape needs one short confirm pass before implementing; likely belongs in the same risk tier as License Mode (changes device-wide behavior) |

---

## 10. Areas / Portals — confirmed absent, nothing to plan

`LIVE_CONFIRMED` as **not existing** as a management page anywhere in
this UI (checked the full menu twice, across two separate discovery
passes). No endpoint should ever be planned for this — it would be
inventing a feature the real device doesn't expose as a page.

---

## 10b. Scheduled Unlock (Enroll → Scheduled Unlock) — ✅ Implemented (read + write, 2026-09-15)

**More complex than Groups/Time Zones/Holidays — not a simple lookup
object.** `LIVE_CONFIRMED` via `class.js`'s `CID.createClass` static
read plus a live-captured create (XHR-interceptor, safely blocked, no
real write) and a full real gated write/read/delete cycle
(`APPROVE_LIVE_DEVICE_TEST:2026-09-15-scheduled-unlock` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock`, both
user-approved verbatim).

Device object `scheduled_unlocks` has only 3 real fields: `id`,
`name`, `message`. The "Time Zones" shown on its own list/edit UI is
**not a real column** — it's a composite (`isField:false`) resolved
through a 2-hop join chain declared in `class.js`:
- `scheduled_unlocks` ↔ `access_rules` (via `scheduled_unlock_access_rules`)
- `access_rules` ↔ `portals` (via `portal_access_rules`)
- `access_rules` ↔ `time_zones` (via `access_rule_time_zones`, the
  same join table already used for the Access Logs time-zone-name
  resolution — see section 3's Decision 2b)

**Confirmed create payload** (same extended shape as every other
object this session):
```json
{"join":"LEFT","object":"scheduled_unlocks","fields":["id","name","message"],
 "where":[],"order":["name"],
 "values":[{"name":"ZZ_ScheduledUnlockTest","message":"Test message"}]}
```

**New finding — the device's query engine supports cross-object
`where` for this composite relationship, resolved server-side in one
call.** Reading the "Linked" time-zone list for a scheduled unlock
sends `object:"time_zones"` with a `where` clause referencing a
*different* object:
```json
{"join":"LEFT","object":"time_zones","fields":["id","name"],
 "where":[{"object":"scheduled_unlocks","field":"id","value":1,"connector":") AND ("}],
 "order":["name"],"limit":1000,"offset":0}
```
This is the first time this session that `where.object` differs from
the query's own top-level `object` and the device resolves the
multi-hop join itself server-side — worth flagging for whoever plans
the SDK-side builder, since it doesn't match this project's existing
`buildAccessLogAccessRulesBody`/`buildAccessRuleTimeZonesBody` 2-call
pattern (which resolves the same underlying join client-side, in 2
separate requests).

**New finding — a new Scheduled Unlock is auto-linked to time zone id
1 by default on creation**, with no separate write call ever observed
at first (only visible via the resulting "Nº of Time Zones: 1" and the
"Linked" list already containing "Always Allowed"). This matches
`class.js`'s own `'time_zones': {'value': [1], ...}` default.

**Full link mechanism now `LIVE_CONFIRMED`** (2026-09-15, second gated
write pass: temporarily created a second time zone, "ZZ_TempTZ2", via
the already-implemented Time Zones write side purely to have something
to link/unlink; both the time zone and the scheduled unlock were fully
deleted afterward — no lasting device change). Saving a **new**
Scheduled Unlock for the first time fires this exact sequence, all via
`create_objects.fcgi`:
1. `{"object":"scheduled_unlocks","fields":["id","name","message"],...,"values":[{"name":"...","message":"..."}]}` → creates the base row (e.g. id 2).
2. `{"object":"access_rules","fields":["id","name","type","priority"],...,"values":[{"name":"(access_rules automatically created for scheduled_unlocks 2)","type":1,"priority":0}]}` → **one `access_rules` row is auto-created per scheduled_unlock** (1:1, not one per portal/time-zone combination as the `intermediateTableBy` chain in `class.js` might suggest) — the name is literally auto-generated referencing the scheduled_unlock's own id.
3. `{"object":"scheduled_unlock_access_rules","values":[{"scheduled_unlock_id":2,"access_rule_id":4}]}` → links the new access_rule to the scheduled_unlock.
4. `{"object":"access_rule_time_zones","values":[{"access_rule_id":4,"time_zone_id":1}]}` → links the default time zone (id 1) to that access_rule.
5. One more `access_rule_time_zones` create per additional time zone selected in the "Linked" list at save time (e.g. `{"access_rule_id":4,"time_zone_id":3}` for the manually-added "ZZ_TempTZ2").

**Removing one linked time zone** from an existing Scheduled Unlock
(moving it from "Linked" back to "Available", then Save) sends a
single `destroy_objects.fcgi`:
```json
{"object":"access_rule_time_zones",
 "where":[{"object":"access_rule_time_zones","field":"access_rule_id","value":4},
          {"object":"access_rule_time_zones","field":"time_zone_id","value":[1]}]}
```
i.e. deletes by `(access_rule_id, time_zone_id)` pair — the
`access_rules`/`scheduled_unlock_access_rules` rows themselves are
left untouched; only the specific `access_rule_time_zones` link row is
removed. **Not observed:** what happens to `access_rules`/
`scheduled_unlock_access_rules` when a Scheduled Unlock itself is
deleted (whether they cascade or become orphaned) — the delete flow
for `scheduled_unlocks` itself was not captured this pass (out of
scope for this discovery cycle; capture during the eventual write-side
plan's own Group 8).
**Not observed:** any `portal_access_rules` write — this device has
only one portal, so it may be auto-included without a distinct write,
or portal selection may live on a different tab not explored here
(the UI only exposed a "Time Zones" tab, no visible "Portals" tab).

**Disposable test record cleanup:** "ZZ_ScheduledUnlockTest" was
created, inspected, then fully deleted via the real device's own
two-step Remove flow (toggle row -> toolbar Remove -> confirm modal) —
confirmed by reload showing "No record found." again. No lasting
change to the device.

**Disposable test records cleanup (second pass):** "ZZ_TempTZ2" (a
temporary second time zone, created solely to have something to
link/unlink) and "ZZ_SUTest2" (a second disposable scheduled unlock)
were both created, fully exercised (link added, link removed), and
fully deleted afterward via each object's own real device UI flow —
confirmed by both lists reverting to their pre-test state (1 time
zone: "Always Allowed"; 0 scheduled unlocks). No lasting change to the
device.

**Implemented** (`.plans/2026-09-15-scheduled-unlock-write-side/`):
full CRUD for the base `name`/`message` fields plus explicit
`addTimeZone`/`removeTimeZone` linking, hiding the `access_rules`/
`scheduled_unlock_access_rules` plumbing behind those two methods
(spec.md Decision 2). `create()` deliberately does **not** auto-link
time zone id 1 the way the real UI's own form default does (spec.md
Decision 1 — a documented, deliberate divergence). The remaining
unknowns (delete-cascade behavior for `access_rules`/
`scheduled_unlock_access_rules`, and whether `portal_access_rules`
needs its own write on a multi-portal device) are deferred to this
plan's own Group 7 manual live verification, matching this project's
established practice of not over-speccing unconfirmed cascade behavior
up front (same precedent as `DELETE /timezones/:id` not asserting
`time_spans` cascade).

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /scheduled-unlocks` | `load_objects.fcgi` `object:"scheduled_unlocks"`, plus one `time_zones` cross-object-where read per row to populate `timeZoneIds` |
| ✅ | `POST /scheduled-unlocks` | `create_objects.fcgi` — `LIVE_CONFIRMED`; never auto-links a time zone (spec.md Decision 1) |
| ✅ | `PATCH /scheduled-unlocks/:id` | `modify_objects.fcgi` — built by symmetry with the shared `messenger.js` mechanism; **not yet independently live-confirmed for `scheduled_unlocks` specifically** — pending this plan's own Group 7 |
| ✅ | `DELETE /scheduled-unlocks/:id` | `destroy_objects.fcgi` — same not-yet-confirmed caveat; does not cascade-clean `access_rules`/etc. (spec.md Decision 3) |
| ✅ | `POST /scheduled-unlocks/:id/timezones/:timeZoneId` | `create_objects.fcgi` against `access_rules`/`scheduled_unlock_access_rules`/`access_rule_time_zones` as needed — `LIVE_CONFIRMED` sequence; the "does an access_rule already exist" lookup itself is inferred, not captured (spec.md Decision 2, Risks) |
| ✅ | `DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` | `destroy_objects.fcgi` against `access_rule_time_zones` — `LIVE_CONFIRMED` shape; same lookup caveat |

---

## 11. 🔍 Discovery pending — no protocol evidence yet

These sidebar areas exist on the real device but have **not** been
statically or live read yet. Do not write endpoint specs for them
until at least a static JS read (same method as every prior discovery
pass) confirms the real object names/fields/commands.

| Sidebar area | Likely difficulty | Notes |
|---|---|---|
| User Types (`usertypes.html`) | Low — likely a small lookup table (`user_type_id` already seen on every `AmicoUser`) | |
| Custom Fields (`customfields.html`) | Low-Medium | |
| Internal Alarms (`alarmint.html`) | Medium | |
| Alarm Output (`alarmconfig.html`) | Medium | |
| Data Tools → Import (`import.html`) | High — likely bulk write, needs care | |
| Data Tools → Export (`export.html`) | Medium — likely reuses the `export_objects`/backup flow already seen referencing `portal_rules` etc. in the 48-command pass | |
| Open relay (sidebar direct-action button) | Low — a single immediate device action, no confirmation needed per `feedback_write_api_risk_tiers.md` | |
| Open Door (sidebar direct-action button) | Low — same as above | |
| Settings — other tiles (Network, and ~70 more per the "73 tiles" count noted in the Areas/Portals finding) | Varies | Only License Mode and Date and Time have been opened so far |

---

## Suggested next discovery pass

Within **Enroll** specifically (the sidebar area this project has
focused on so far — Users ✅, Visitors ✅, Groups ✅ (⚠️ known Time
Zones tab gap, section 5), Time Zones ✅ (read+write, 2026-09-15),
Visits ✅ implemented 2026-09-14, Holidays ✅ implemented 2026-09-15,
Scheduled Unlock ✅ implemented 2026-09-15 — see sections 5/6/6b/6c/10b),
the remaining items in the real device's own Enroll submenu, in
sidebar order:

| Order | Sidebar area | Status |
|---|---|---|
| 1 | Groups' own Time Zones tab | ⚠️ known gap (section 5) — reuses the same `access_rules`/`access_rule_time_zones` mechanism just confirmed/implemented for Scheduled Unlock; fast follow-up |
| 2 | User Types (`usertypes.html`) | 🔍 discovery pending — likely a small lookup table (`user_type_id` already seen on every `AmicoUser`) |
| 3 | Custom Fields (`customfields.html`) | 🔍 discovery pending |

**Recommended next single step:** Close the Groups Time Zones gap
(row 1) — the exact `access_rules`/`access_rule_time_zones` link/
unlink mechanism is already fully confirmed and implemented for
Scheduled Unlock (section 10b); a Groups follow-up plan can reuse the
same query builders/pattern, only swapping `scheduled_unlock_access_rules`
for `group_access_rules` as the other half of the join. Otherwise,
User Types per row 2 above is the next item needing a discovery pass.

Outside Enroll, section 7's other report variants (Access by Group/
Time/User, Alarms Global, Users report) and section 8/9's Settings
tiles remain the next areas after that.
