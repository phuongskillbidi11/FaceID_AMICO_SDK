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

## 5. Groups (Enroll → Groups) — ✅ Implemented (read + write + time zone linking, 2026-09-16)

**Gap found during Scheduled Unlock discovery (2026-09-15), closed
2026-09-16** (`.plans/2026-09-16-groups-timezones-write-side/`): the
real device's own Group Edit page has **3 tabs — General, Users, Time
Zones —** but this project's original Groups write-side plan
(`fe1e4d9`) only implemented General (the `name` field). Confirmed
live via `group.html`:
- **"Users" tab — not a gap.** Same underlying `user_groups`
  relationship already fully covered by
  `UsersApi::addToGroup()`/`removeFromGroup()` (shipped, Users
  section). This tab is only an alternate UI surface (manage
  membership from the Group's own page instead of the User's) — a
  possible frontend nicety, not a missing SDK/backend capability. Not
  implemented, not planned.
- **"Time Zones" tab — now implemented.** Groups link to time zones
  through the exact same `access_rules`/`access_rule_time_zones`
  mechanism already shipped for Scheduled Unlock (section 10b), just
  `group_access_rules` in place of `scheduled_unlock_access_rules` as
  the other half of the join — confirmed byte-for-byte identical for
  the shared steps via a second live discovery pass
  (`.plans/2026-09-16-groups-timezones-write-side/spec.md`
  Background). `GroupsApi` gained `addTimeZone()`/`removeTimeZone()`;
  `GET /groups` now returns `timeZoneIds` per row; the real device's
  own "Nº of Time Zones" list column is now mirrored in this project's
  own Groups tab too.

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
| ✅ | `POST /groups/:id/timezones/:timeZoneId` | `create_objects.fcgi` against `access_rules`/`group_access_rules`/`access_rule_time_zones` as needed — `LIVE_CONFIRMED` 2026-09-16, same mechanism as Scheduled Unlock's own equivalent route |
| ✅ | `DELETE /groups/:id/timezones/:timeZoneId` | `destroy_objects.fcgi` against `access_rule_time_zones` — `LIVE_CONFIRMED` 2026-09-16 |

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
| ✅ | `PATCH /scheduled-unlocks/:id` | `modify_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 7 |
| ✅ | `DELETE /scheduled-unlocks/:id` | `destroy_objects.fcgi` — `LIVE_CONFIRMED` 2026-09-15, Group 7; does not cascade-clean `access_rules`/etc. (spec.md Decision 3, confirmed real: an orphaned `access_rules` row was directly observed after this exact delete during Group 7 and cleaned up manually) |
| ✅ | `POST /scheduled-unlocks/:id/timezones/:timeZoneId` | `create_objects.fcgi` against `access_rules`/`scheduled_unlock_access_rules`/`access_rule_time_zones` as needed — `LIVE_CONFIRMED` sequence; the "does an access_rule already exist" lookup itself is inferred, not captured (spec.md Decision 2, Risks) |
| ✅ | `DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` | `destroy_objects.fcgi` against `access_rule_time_zones` — `LIVE_CONFIRMED` shape; same lookup caveat |

---

## 10c. User Types (Enroll → User Types) — ✅ implemented (2026-09-16, `.plans/2026-09-16-user-types-write-side/`)

**More complex, and more dangerous, than the roadmap originally
guessed** ("likely a small lookup table"). `LIVE_CONFIRMED` via a full
gated write/read/delete cycle against the real device
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-user-types-gap` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-gap`, both
user-approved verbatim, after an explicit re-confirmation once the
risk below was found). One disposable test type ("ZZ_TestUserType")
was created, inspected, then fully deleted — no lasting device change
(confirmed by re-querying `custom_tables` afterward, see below).

**The object itself:** `user_types` has only 3 real fields: `id`,
`custom_table_id` (FK), `require_visitor` (boolean, sent as 0/1 same
as every other boolean-ish field this session). The device's own
`usertypes.html` list/form ("User type" name, "Requires Visit"
checkbox) is a thin UI over a much bigger mechanism:

**Creating a User Type creates a brand-new physical database table on
the device**, via a previously-undiscovered endpoint,
`POST /object_add.fcgi`:
```json
{"object":"_ZZ_TestUserType72250","name":"ZZ_TestUserType",
 "fields":[
   {"column_name":"id","name":"id","type":"INTEGER","constraint":"PRIMARY_KEY"},
   {"column_name":"user_id","name":"user_id","type":"INTEGER","constraint":"FOREIGN_KEY","foreign_key":{"object":"users","field":"id"}}
 ]}
```
The generated table name is `_<TypeName><5-digit-random-suffix>`. This
also implicitly creates a row in a `custom_tables` catalog object
(`id`, `name`, `table_name`) — confirmed via
`GET /load_objects.fcgi` on `object:"custom_tables"`, which lists every
custom table on this device (`{"id":1,"name":"Users","table_name":"c_users"}`,
`{"id":2,"name":"Visits","table_name":"c_visits"}`,
`{"id":3,"name":"Visitors","table_name":"_visitors"}` — i.e. the CPF
custom field from the Visitors plan and the Visitors user type itself
are both implemented via this exact same mechanism). The full create
sequence: `object_add.fcgi` (creates the table + `custom_tables` row)
→ `create_objects.fcgi` on `user_types` (`{"custom_table_id":<id>,"require_visitor":0}`)
→ `modify_objects.fcgi` on `custom_tables` to set the display `name`
(a separate call after `object_add`, which doesn't appear to persist
the display name from its own `name` parameter alone).

**The critical risk that was flagged before writing anything:** no
`object_remove`/`drop_table`/`DROP` string appears anywhere in the
client-side `class.js`, so it looked like deleting a User Type might
only remove the `user_types` row while leaving the dynamically-created
physical table permanently orphaned on the device — a materially
different, harder-to-reverse risk than every other "orphaned row"
finding this session (Scheduled Unlock's/Groups' own `access_rules`
rows are just extra rows in an existing table; this would have been an
entire un-droppable table). The user was told this explicitly and
chose to proceed with a live create/delete test anyway.

**Finding: the risk did not materialize.** Deleting the test user type
fired `POST /object_remove.fcgi` with `{"ids":[4]}` (the
`custom_tables` row's own id, looked up via a
`{"object":"user_types","fields":["custom_table_id"],"where":[...]}`
query first) — a previously-undiscovered endpoint, exactly symmetric
in name and purpose to `object_add.fcgi`. Re-querying `custom_tables`
afterward showed exactly the original 3 rows (Users/Visits/Visitors) —
the test row (id 4) was fully gone from the catalog. This is strong
evidence (though not directly SQL-schema-inspectable through this
device's own object-query API) that `object_remove.fcgi` also drops
the underlying physical table, not just the catalog row — the device's
own real UI Remove flow is not leaving orphaned tables behind in
normal use.

**Not yet independently confirmed:** whether `object_remove.fcgi`
strictly requires the `custom_tables` row to have zero linked `users`
rows first (i.e. can a User Type with existing enrolled users of that
type be deleted, and what happens to those users' custom-table data?)
— not tested, since testing it would require creating real users of
the test type first, which was out of scope for this narrow discovery
pass.

**Shipped:** `.plans/2026-09-16-user-types-write-side/` resolved the
design question in favor of the narrow, purpose-built approach — a
`UserTypesApi` (`list`/`create`/`update`/`remove`) that internally
orchestrates the 3-call create sequence and the lookup-then-
`object_remove` delete sequence, never exposing a caller-supplied
table/column definition (mirroring how `ScheduledUnlocksApi`/
`GroupsApi` hide `access_rules` as pure plumbing). `list()` resolves
`name` via one extra `custom_tables` read (not per-row N+1, since the
catalog is shared, not per-row-specific data). New routes:
`GET/POST/PATCH/DELETE /user-types` (`docs/backend-api.md`).

The `object_add.fcgi` response shape was confirmed via a supplementary
live capture before implementation: `{"ids":[<custom_table_id>]}` —
the same convention as `create_objects.fcgi`.

**Live verification (Group 8) result — zero bugs found:**
- **Decision 3 confirmed correct as implemented:** `object_remove.fcgi`
  alone (no separate `destroy_objects.fcgi` call against `user_types`)
  fully removes the `user_types` row too, not just the `custom_tables`
  catalog row/physical table. Directly confirmed via `GET /user-types`
  showing the row completely gone after delete, not merely filtered.
- **Edit/rename flow confirmed correct on the first attempt:**
  renaming a user type and toggling `requireVisitor` both worked
  end-to-end with no fix needed, the first time this flow was ever
  live-exercised (the original discovery pass only tested create then
  delete).
- Full create → edit → delete cycle run on a disposable "ZZ_"-prefixed
  test type via this project's own frontend; the real "Visitors" row
  was never touched. See `.plans/2026-09-16-user-types-write-side/DECISION_LOG.md`
  for the full record.

---

## 10d. Custom Fields (Enroll → Custom Fields) — ✅ implemented (2026-09-16, `.plans/2026-09-16-custom-fields-write-side/`)

**Related to, but structurally distinct from, User Types (section 10c)**:
both rely on the `custom_tables`/`custom_columns` family of catalog
objects, but Custom Fields **adds a column to an existing table**
(`Users`, `Visitors`, or `Visits`) rather than creating a whole new
table. `LIVE_CONFIRMED` via a gated discovery pass
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-custom-fields-discovery` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-custom-fields-discovery`,
both user-approved verbatim).

**The object itself:** the list page shows Table/Type/Name (`custom_columns`
rows joined with `custom_tables` for the display table name), matching
the already-known pre-existing "CPF" field on `Users`
(`custom_columns.id=1`, `custom_table_id=1`, `column_name="cpf"`).
`Table` accepts exactly 3 options: `Users`, `Visitors`, `Visits`.
`Type` accepts exactly 2 options: `Text`, `Number`. A `Mandatory`
checkbox (`not_null`) is also present, not yet independently confirmed
in a live write (see below).

**⚠️ Process incident during this discovery pass:** a request-shape
capture attempt (intended to be zero-risk, using a blocklist of known
write endpoint names copied from every prior discovery this session)
unintentionally reached the real device, because this object's create
endpoint has a **previously-undiscovered, differently-named
endpoint the blocklist didn't anticipate**: `POST /object_add_field.fcgi`
(singular "field") — not `object_add.fcgi` as with User Types. This
created a real (test) column on the live `Visits` table before a
proper write-approval token had been obtained. The mistake was
reported to the user immediately and transparently; a
`APPROVE_LIVE_DEVICE_WRITE_TEST` token was then obtained to clean it
up via the device's own native Remove flow (see below). **Lesson for
all future discovery passes on novel objects: never assume a blocklist
of previously-seen endpoint names is complete — each new object may
introduce its own novel endpoint name.** A denylist-based safe-capture
approach is fundamentally unsound for first-time discovery of a novel
object; prefer either (a) obtaining the write-approval token *before*
any capture attempt on a never-before-seen object, or (b) a strict
allowlist (only known-safe read endpoints permitted to pass through,
everything else blocked) rather than a blocklist.

**Confirmed create sequence** (`object_add_field.fcgi`), captured live
(request only; response not independently captured for this specific
call, though the create/remove pair's response convention is strongly
inferred to match `object_add.fcgi`'s own confirmed `{"ids":[...]}`
shape, given the row that appeared afterward had `custom_columns.id`
matching the generated suffix):
```json
{"object":"c_visits","column_name":"_ZZ_TestField64189",
 "name":"ZZ_TestField","type":"TEXT","constraint":"NONE","default_value":""}
```
`object` here is the **physical table name** (`c_visits`, resolved via
a `custom_tables` lookup by the target table's `custom_tables.id`
first — a `load_objects.fcgi` call on `custom_tables` filtered by
`id`), not the display name. `column_name` follows the same
`_<sanitized-name><random-suffix>` convention as `object_add.fcgi`'s
own table-naming. `type` was `"TEXT"` for a Text field (Number was not
independently captured this pass). `constraint`/`default_value` were
`"NONE"`/`""` for this non-mandatory field — the `Mandatory` checkbox's
effect on these fields is not yet independently confirmed.

**Confirmed delete sequence** (mirrors User Types' own lookup +
symmetric-remove-endpoint pattern, but with its own distinctly-named
endpoint):
```
POST /object_remove_fields.fcgi   {"ids":[8]}   ->   {"ids":[8]}
```
(`8` is the `custom_columns.id` of the test field, matching the
`row_id` attribute shown in the device's own native list table.) This
is the first live-confirmed response body for this whole
add/remove-field family — `{"ids":[...]}`, matching the established
convention.

**Finding: no risk materialized**, same outcome as User Types. After
delete, directly querying `custom_columns` showed exactly the original
1 row (the real "CPF" field) — the test field's catalog row was fully
removed, and cross-checking `GET /visits` on this project's own
backend afterward confirmed no regression (200, list still loads).

**Not yet independently confirmed:**
- The `Number` field type's exact `type`/`constraint` values.
- The `Mandatory` (`not_null`) checkbox's effect on the request shape.
- Whether `object_remove_fields.fcgi` also drops the underlying
  physical column (same un-provable-via-this-API caveat as User
  Types' own physical-table-drop finding) or only the catalog row.
- Editing an existing custom field (this pass only tested create then
  delete, same limitation as User Types' own first pass).

**Shipped:** `.plans/2026-09-16-custom-fields-write-side/` implemented
a narrow, purpose-built `CustomFieldsApi` (`list`/`create`/`update`/
`remove`) that internally orchestrates `object_add_field.fcgi`/
`object_remove_fields.fcgi`, never exposing a caller-supplied physical
table/column name — the caller only ever picks one of the 3 known
table names, one of the 2 known types, a display name, and Mandatory.
New routes: `GET/POST/PATCH/DELETE /custom-fields`
(`docs/backend-api.md`).

A supplementary live read (still under the original discovery pass'
own `APPROVE_LIVE_DEVICE_TEST` approval, no write involved) confirmed
`custom_columns` has **exactly 4 real columns** — `id`,
`custom_table_id`, `name`, `column_name` — and no `type`/`mandatory`/
`not_null`/`constraint` column at all (device returns an explicit
`400` for any of those field names). This means `CustomField`'s read
view cannot expose `type`/`mandatory` (write-only, present only on
`NewCustomField`), and `table`/`type`/`mandatory` are **provably
immutable after creation** — not merely assumed.

**Live verification (Group 8) result — 2 real bugs found and fixed,
then zero bugs on re-run:**
- The reused `buildCustomTablesListBody()` (from User Types) never
  requested `table_name`, which `createCustomField()` needs — fixed
  by adding `"table_name"` to `kCustomTableFields`.
- The inferred `"Number"` device type string was wrong: it is
  **`"INTEGER"`**, not `"NUMBER"` — confirmed via the real device's
  own native Add form. `default_value` is also type-dependent (`""`
  for Text, `0` for Number). `"NOT_NULL"` for Mandatory was already
  correct.
- After both fixes, the full create → edit (rename) → delete cycle
  succeeded end-to-end on the first attempt, including the inferred
  rename shape. See `.plans/2026-09-16-custom-fields-write-side/DECISION_LOG.md`
  for the full record.

---

## 11. 🔍 Discovery pending — no protocol evidence yet

These sidebar areas exist on the real device but have **not** been
statically or live read yet. Do not write endpoint specs for them
until at least a static JS read (same method as every prior discovery
pass) confirms the real object names/fields/commands.

| Sidebar area | Likely difficulty | Notes |
|---|---|---|
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
focused on so far — Users ✅, Visitors ✅, Groups ✅ (read+write+time
zone linking, 2026-09-16), Time Zones ✅ (read+write, 2026-09-15),
Visits ✅ implemented 2026-09-14, Holidays ✅ implemented 2026-09-15,
Scheduled Unlock ✅ implemented 2026-09-15, User Types ✅ implemented
2026-09-16, Custom Fields ✅ discovery complete 2026-09-16 — see
sections 5/6/6b/6c/10b/10c/10d), **every item in Enroll now has at
least a discovery pass** — the entire sidebar area has been covered.

**Recommended next single step:** Write the spec/plan for Custom
Fields (section 10d) — full CRUD reusing the confirmed
`object_add_field.fcgi`/`object_remove_fields.fcgi` sequence, following
User Types' own established narrow-API precedent. Outside Enroll,
Internal Alarms, Alarm Output, and the Settings/Data Tools items in
this section's own table are the next areas needing a first discovery
pass.

Outside Enroll, section 7's other report variants (Access by Group/
Time/User, Alarms Global, Users report) and section 8/9's Settings
tiles remain the next areas after that.
