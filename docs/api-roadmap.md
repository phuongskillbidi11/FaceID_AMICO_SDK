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

## 5. Groups (Enroll → Groups) — ✅ Implemented (read + write, 2026-09-15)

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

## 6. Time Zones (Enroll → Time Zones) — read ✅ Implemented, write 📋 Planned

`LIVE_CONFIRMED`: two device objects —
`object:"time_zones"` (`fields:["id","name"]`) and
`object:"time_spans"` (`fields:["id","time_zone_id","start","end",
"sun".."sat","hol1".."hol3"]`, filtered by `time_zone_id`).

| Method | Path | Device call |
|---|---|---|
| ✅ | `GET /timezones` | `load_objects.fcgi` `object:"time_zones"` — implemented 2026-09-14 for the Access (Global) report's Time Zone filter (`docs/backend-api.md`). Name-only, no `time_spans` detail yet. |
| 📋 | `GET /time-zones/:id/spans` | `load_objects.fcgi` `object:"time_spans"`, filtered — not yet needed by any UI, not implemented |
| 📋 | `POST /time-zones` | write side not yet confirmed |
| 📋 | `POST /time-zones/:id/spans` | write side not yet confirmed |
| 📋 | `DELETE /time-zones/:id` | write side not yet confirmed |

Same caveat as Groups: name-only read shape confirmed and now
implemented; `time_spans` detail and the write shape both still need a
short `timespan.js` discovery pass before implementation.

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

## 11. 🔍 Discovery pending — no protocol evidence yet

These sidebar areas exist on the real device but have **not** been
statically or live read yet. Do not write endpoint specs for them
until at least a static JS read (same method as every prior discovery
pass) confirms the real object names/fields/commands.

| Sidebar area | Likely difficulty | Notes |
|---|---|---|
| Holidays (`holiday.html`) | Low — likely small, similar shape to Time Zones' `time_spans` (holiday date list) | |
| Scheduled Unlock (`scheduledunlock.html`) | Medium — likely depends on Time Zones + Groups/Portals | |
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
focused on so far — Users ✅, Visitors ✅, Groups ✅ (read+write,
2026-09-15), Visits ✅ implemented 2026-09-14 — see sections 5/6b), the
remaining items in the real device's own Enroll submenu, in sidebar
order:

| Order | Sidebar area | Status |
|---|---|---|
| 1 | Time Zones (write side + `time_spans` detail) | 📋 evidence-backed but unconfirmed write shape — see section 6 |
| 2 | Holidays (`holiday.html`) | 🔍 discovery pending — likely small, similar shape to `time_spans` |
| 3 | Scheduled Unlock (`scheduledunlock.html`) | 🔍 discovery pending — likely depends on Time Zones + Groups |
| 4 | User Types (`usertypes.html`) | 🔍 discovery pending — likely a small lookup table (`user_type_id` already seen on every `AmicoUser`) |
| 5 | Custom Fields (`customfields.html`) | 🔍 discovery pending |

**Recommended next single step:** Groups' write side (create/rename/
delete) is now implemented (SDK/backend/frontend/tests — section 5);
only the gated Group 8 live test remains to independently confirm the
`modify_objects.fcgi`/`destroy_objects.fcgi` shapes (currently inferred
by symmetry with the already-proven shared mechanism) — see
`.plans/2026-09-15-groups-write-side/tasks.md`. Otherwise, Time Zones'
write side per row 1 above is the next ready-to-plan item — already an
evidence-backed read, just needs a short discovery pass on its write
shape (and the `time_spans` detail object) first.

Outside Enroll, section 7's other report variants (Access by Group/
Time/User, Alarms Global, Users report) and section 8/9's Settings
tiles remain the next areas after that.
