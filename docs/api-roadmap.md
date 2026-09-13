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

## 3. Access Logs — ✅ Implemented (partial — see Reports below for the richer version)

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /access-logs?from=&to=&limit=` | Flat list, global |

## 4. System Information — ✅ Implemented (read-only)

| Method | Path | Notes |
|---|---|---|
| ✅ | `GET /system-information` | serial, firmware, network, license summary |
| ✅ | `GET /health` | Reachability of the active session's device |

---

## 5. Groups (Enroll → Groups) — 📋 Planned (evidence-backed)

Device protocol `LIVE_CONFIRMED` (`docs/ui-action-protocol-map.md`
"Groups" section): `object:"groups"`, `fields:["id","name"]`, same
list/count/pagination pattern as Users.

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /groups?limit=&offset=` | `load_objects.fcgi` `object:"groups"` |
| 📋 | `GET /groups/:id` | same, filtered by id |
| 📋 | `POST /groups` | `create_objects.fcgi` against `groups` (write side not yet `JS_CONFIRMED` — confirm the exact field name before implementing) |
| 📋 | `PATCH /groups/:id` | `modify_objects.fcgi` (write side not yet `JS_CONFIRMED`) |
| 📋 | `DELETE /groups/:id` | `destroy_objects.fcgi` (write side not yet `JS_CONFIRMED`) |

**Before implementing:** the *write* side of Groups (create/rename/
delete a group itself, as opposed to adding a user to an existing
group id, which is already implemented) has not been statically
confirmed via `group.js` yet — only the read/list shape is
`LIVE_CONFIRMED`. Do one short discovery pass on `group.js` first.

## 6. Time Zones (Enroll → Time Zones) — 📋 Planned (evidence-backed)

`LIVE_CONFIRMED`: two device objects —
`object:"time_zones"` (`fields:["id","name"]`) and
`object:"time_spans"` (`fields:["id","time_zone_id","start","end",
"sun".."sat","hol1".."hol3"]`, filtered by `time_zone_id`).

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /time-zones` | `load_objects.fcgi` `object:"time_zones"` |
| 📋 | `GET /time-zones/:id/spans` | `load_objects.fcgi` `object:"time_spans"`, filtered |
| 📋 | `POST /time-zones` | write side not yet confirmed |
| 📋 | `POST /time-zones/:id/spans` | write side not yet confirmed |
| 📋 | `DELETE /time-zones/:id` | write side not yet confirmed |

Same caveat as Groups: read shape confirmed, write shape needs one
short `timespan.js` discovery pass before implementation.

## 7. Reports (richer Access Logs) — 📋 Planned (evidence-backed)

`LIVE_CONFIRMED`: `object:"reports"`, `object:"report_filters"`
(both use an unusual nested-object `where` shape, e.g.
`{"reports":{"id":1}}` — different from every other query in this
codebase, handle explicitly, don't reuse the existing whitelist
builder blindly), report row data reuses `object:"access_logs"` joined
client-side with user/portal/time-zone names.

| Method | Path | Device call |
|---|---|---|
| 📋 | `GET /reports` | `load_objects.fcgi` `object:"reports"` — list of report definitions (Access Global/by Group/by Time/by User/Alarms Global/Users) |
| 📋 | `GET /reports/:id/filters` | `object:"report_filters"`, nested-where shape |
| 📋 | `GET /reports/:id/rows?...filters` | `object:"access_logs"` (or the report's declared object) with joins |
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
| Visitors (`customusers.html?type=1`) | Low — likely a filtered view of the same `users`-family object, similar to Users | Good candidate for the next discovery pass; probably reuses most of the existing Users backend code |
| Visits (`visits.html`) | Medium | Unknown object shape |
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

A single read-only live session (or static JS reads where possible)
covering, in order of expected reuse value: **Visitors → Holidays →
User Types → Groups write-side → Time Zones write-side**, would clear
the most roadmap items per session, since several of these are
expected to closely mirror already-implemented Users/Groups/Time-Zones
read patterns.
