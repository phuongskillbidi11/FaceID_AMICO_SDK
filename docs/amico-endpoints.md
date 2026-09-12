# AMICO VL70LF Web UI — endpoint table

Confirmed live against `192.168.2.156` across two authorized browser
sessions: (1) login → dashboard browse → logout, and (2) a follow-up P1/P2
discovery pass over Users/Groups/Time-Zones/Reports pages plus a static
read of the Settings page's full ~78-command dispatcher — see
`docs/ui-action-protocol-map.md` for that pass's detail. See
`docs/amico-protocol-map.md` for platform notes and
`docs/amico-auth-flow.md` for the full auth sequence.
Evidence legend: `LIVE_CONFIRMED` / `PCAP_CONFIRMED` / `HAR_CONFIRMED` /
`JS_CONFIRMED` / `UI_HANDLER_CONFIRMED` / `DOCUMENTED` / `INFERRED` — see
`docs/amico-protocol-map.md`.

There is no `/api/...` base path — every endpoint is a standalone
`*.fcgi` script at the web root (FastCGI behind `lighttpd/1.4.51`).

| Evidence | Method | Path | Authentication | Request type | Response type | Status codes | Read/Write | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|
| LIVE_CONFIRMED | GET | `/` | none | — | text/html | 200 | Read | High | Serves the login page directly at root (no redirect observed). |
| LIVE_CONFIRMED | GET | `/get_language.fcgi` | none | — | JSON | 200 | Read | High | `{"language":"en_US"}`. |
| LIVE_CONFIRMED | GET | `/init_device_set.fcgi?_=<ts>` | none | — | JSON | 200 | Read | High | `{"init_device_set":true\|false}`. `_` is a cache-busting timestamp param, not a real parameter. |
| LIVE_CONFIRMED | POST | `/get_countries.fcgi` | none | JSON `{"language":"en"}` | JSON | 200 | Read | High | Returns full country list; UI-onboarding only. |
| LIVE_CONFIRMED | GET | `/session_is_valid.fcgi` | cookie (optional — works unauthenticated too, returns false) | — | JSON | 200 | Read | High | **This is the "session check" endpoint.** `{"session_is_valid": bool}`. |
| LIVE_CONFIRMED | POST | `/hidlogin.fcgi` | none (submits credentials) | `application/x-www-form-urlencoded`: `login`, `password` | JSON | 200 (success), 401 (bad credentials) | Write* | High | **Login.** Field name is `login`, not `username`. Response JSON includes a `session` field that the client JS manually turns into a `session` cookie — server does not send `Set-Cookie`. *Classified Write because it mutates server-side session state. |
| LIVE_CONFIRMED | GET | `/logout.fcgi` | cookie (`login`, `session`) | — | JSON | 200 | Write* | High | **Logout.** Returns `{}`. *Classified Write because it mutates session state. |
| JS_CONFIRMED | POST | `/logout.fcgi` | cookie | — | JSON | unknown | Write* | Medium | Alternate logout call used only in the "Invalid access level" client-side error path; not exercised live in this session (the live logout was the `GET` form above). |
| LIVE_CONFIRMED | POST | `/system_information.fcgi` | cookie | empty body | JSON | 200 | Read | High | **Device information.** Confirmed fields: `uptime`, `time`, `daylight_savings_time_active`, `memory.{disk,ram}`, `license.{users,device,type}`, `biometrics.{max_num_records,max_possible_num_records}`, `network.{mac,ip,netmask,gateway,primary_dns,secondary_dns,device_hostname,web_server_port,ssl_enabled,self_signed_certificate,dhcp_enabled}`, `auth802_1x.{...}`, `serial`, `version` (firmware terminal, e.g. `2.4.5`), `device_id`, `secbox_version` (EAM firmware, e.g. `2.2.3`), `online`, `device_name`, `device_two_names`. |
| LIVE_CONFIRMED | POST | `/is_first_web_login.fcgi` | cookie | empty body | JSON | 200 | Read | High | `{"is_first_web_login": bool}` — gates first-run onboarding UI, distinct from `init_device_set`. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` | cookie | JSON query-builder body: `object`, optional `join`/`fields`/`where`/`order`/`limit`/`offset` | JSON `{"<object>": [...]}` | 200 | Read | High | **Generic query engine — this is how "List users" and "Access logs" (and everything else list-shaped) actually work.** Confirmed live with `object` values: `wiegand_modes`, `custom_tables`, `custom_columns`, `user_types`, `access_logs`, `users`, `areas`. Full catalog of 90 valid `object` values discovered via `object_metadata.fcgi` (see `artifacts/live_capture/object_catalog.json`). `where[].connector` is concatenated into raw SQL-looking fragments (`") AND ("`) by the client — see security notes in `docs/amico-protocol-map.md`. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"users"`) | cookie | see above | JSON | 200 | Read | High | **List users**, specifically. Confirmed fields returned: `id`, `name`, `registration`, `password` (hash), `salt`, `begin_time`, `end_time`, `user_type_id`, `last_access`. **Security note: exposes the password hash + salt to any authenticated caller as part of an ordinary UI query — the SDK must never log/cache/forward these two fields.** |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"access_logs"`) | cookie | see above | JSON | 200 | Read | High | **Access logs**, specifically. Confirmed fields: `id`, `time`, `user_id`, `portal_id`, `log_type_id`, `event`. Dashboard queries this with `limit`, `order:["time","descending"]` for a recent-activity feed. Dedicated Reports page uses the same object with a date-range `where` clause and pagination; 213 rows observed over the default ~29-day window on this device. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"groups"`) | cookie | see above | JSON | 200 | Read | High | **Groups.** Fields: `id`, `name`. Dedicated page `GET /en_US/html/group.html`. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"time_zones"`, `"time_spans"`) | cookie | see above | JSON | 200 | Read | High | **Schedules** (this UI's term is "Time Zones"). `time_zones`: `id`,`name`. `time_spans`: `id`,`time_zone_id`,`start`,`end`,`sun`..`sat`,`hol1`..`hol3`. Dedicated page `GET /en_US/html/timespan.html`. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"reports"`, `"report_filters"`) | cookie | `where` as a **nested object** (`{"reports":{"id":1}}`), not the array-of-clauses shape every other object uses | JSON | 200 | Read | High | Report metadata/filter-widget definitions behind `GET /en_US/html/reportcustomview.html?report=<id>`. See `docs/ui-action-protocol-map.md` for the full shape. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"c_users"`, `"opening_times"`) | cookie | see above | JSON | 200 | Read | High | Per-user custom fields (`c_users`: `user_id`,`id`,`cpf`) and per-user access-time overrides (`opening_times`: `id`,`user_id`,`door_id`,`time`), fetched per row on the Users page. Both empty for the two non-default users on this device. |
| LIVE_CONFIRMED | POST | `/load_objects.fcgi` (`object:"face_templates"`) | cookie | see above | JSON — `template` field is a **base64-encoded biometric face template** | 200 | Read | High | **Security note: returns raw enrolled biometric data to an ordinary Users-page row render.** No value from this field is stored anywhere in this repository. |
| LIVE_CONFIRMED | POST | `/object_metadata.fcgi` | cookie | empty JSON `{}` | JSON (~73KB) | 200 | Read | High | Returns the full object/field/foreign-key/join schema for all 90 objects — effectively a live API reference for `load_objects.fcgi`. Worth caching client-side; it does not appear to change per-request. |
| LIVE_CONFIRMED | POST | `/get_configuration.fcgi` | cookie | JSON `{"<section>": ["<key>", ...]}` | JSON `{"<section>": {"<key>": <value>}}` | 200 | Read | High | Generic settings reader. Confirmed example: `{"face_id":["qrcode_legacy_mode_enabled"]}` → `{"face_id":{"qrcode_legacy_mode_enabled":"1"}}`. Called dozens of times per dashboard load, one per widget's needed setting. |
| JS_CONFIRMED | POST | `/set_configuration.fcgi` | cookie | JSON `{"<section>": {"<key>": <value>}}` | JSON | unknown | Write | Medium | Write counterpart of `get_configuration.fcgi`, seen only in `login.js` (used there to persist the chosen UI language). Not exercised — excluded from this read-only phase. |
| LIVE_CONFIRMED | POST | `/face_template_count_distinct.fcgi` | cookie | empty body | JSON | 200 | Read | High | `{"count": <int>}` — distinct enrolled face template count. |
| LIVE_CONFIRMED | POST | `/alarm_status.fcgi` | cookie | empty body | JSON | 200 | Read | High | `{"active": bool, "cause": <int>}`. Polled by the dashboard roughly every second while open. |
| LIVE_CONFIRMED | GET | `/user_get_image.fcgi?user_id=<int>` | cookie | — | `image/jpeg` (binary) | 200 | Read | High | Raw JPEG of the user's enrolled face photo. No ownership check was tested in this session — flagged as a possible IDOR to verify in a dedicated authorized security review, not attempted here. |
| JS_CONFIRMED | GET | `/finish_init_language.fcgi` | cookie | — | JSON | unknown | Write | Low | First-run-only, part of the language/EULA wizard; not exercised (device already past first-run). |
| JS_CONFIRMED | POST | `/accept_legal_terms.fcgi` | cookie | JSON `{"country_code": <str>}` | JSON | unknown | Write | Low | First-run-only EULA acceptance; not exercised. |
| DOCUMENTED | (unknown) | web password change | cookie | unknown | unknown | unknown | Write | Low | User guide section 6.8 confirms the feature exists; not probed (write action, out of scope). |
| DOCUMENTED | (unknown) | "Reboot URL" | **none, when the feature toggle is enabled** | unknown | unknown | unknown | Write | Low | User guide: an optional unauthenticated reboot endpoint. Not probed — explicitly excluded. |
| INFERRED | (unknown) | separate "API" layer (door open via API, etc.) | unknown — likely its own `api_logins` credential, not the web session | unknown | unknown | unknown | Write | Low | `object_metadata.fcgi` reveals `api_logins`, `api_access_levels`, `api_commands`, `api_object_commands`, `api_object_field_commands` tables, matching the user guide's "opening door via the API" mention. This looks like a genuinely separate API surface from the `.fcgi` scripts documented above; not explored (no separate API credentials available), and no endpoint path for it was observed. |
| UI_HANDLER_CONFIRMED | POST | `/<command>.fcgi` for ~78 distinct `<command>` values | cookie | varies per command; payload shapes not read | varies; not observed | unknown | mixed (read for `get_*`/`export_*`, write for the rest) | Medium (existence + dispatch mechanism); Low (per-command payload) | Every Settings-page capability dispatches through one client function, `MessengerUtil.send(command, data) -> POST /<command>.fcgi`. Full 78-command list: `artifacts/live_capture/messenger_commands.json`. Includes the write-shaped commands behind every prohibited operation (`create_objects`/`modify_objects`/`object_remove`/`destroy_objects`/`destroy_all`, `update_secbox_firmware*`, `set_network_interlock`, `set_system_time`, `license_change`, `change_login`/`master_password`, `remote_turnstile_control`, `delete_admins`) — see `docs/ui-action-protocol-map.md`'s mapping table. None invoked. |
| UI_HANDLER_CONFIRMED | POST | `/import_objects.fcgi` | cookie | query-string params `resolution`/`ignore_columns`/`ignore_tables` (JSON-stringified) | unknown | Write | Low | The explicitly-prohibited **Import** operation's handler, read statically from `configurations.js`. Not invoked. |

## Read-only curl examples

All examples read credentials from environment variables and never hardcode
them. Confirmed field names (`login`, not `username`) and the two-cookie
session model are reflected below; the exact cookie **values** are never
printed anywhere in this repository.

```bash
export AMICO_BASE_URL="http://192.168.2.156"
export AMICO_USERNAME="Admin"     # confirmed case-sensitive; device's actual value may differ
export AMICO_PASSWORD="********"  # set this in your shell, never in a script file
```

### 1. Login

```bash
curl -sS -c cookies.txt \
  -H "X-Requested-With: XMLHttpRequest" \
  --data-urlencode "login=${AMICO_USERNAME}" \
  --data-urlencode "password=${AMICO_PASSWORD}" \
  "${AMICO_BASE_URL}/hidlogin.fcgi"
# Response JSON contains a "session" field. The Web UI itself does not rely
# on Set-Cookie; for curl, capture the "session" value from the JSON body
# and add it to a Cookie header on subsequent requests yourself, e.g.:
#   -b "login=${AMICO_USERNAME}; session=<value from the JSON response>"
```

### 2. Session check

```bash
curl -sS -b "login=${AMICO_USERNAME}; session=${AMICO_SESSION}" \
  "${AMICO_BASE_URL}/session_is_valid.fcgi"
```

### 3. Device information

```bash
curl -sS -b "login=${AMICO_USERNAME}; session=${AMICO_SESSION}" \
  -H "Content-Type: application/json" \
  -X POST "${AMICO_BASE_URL}/system_information.fcgi"
```

### 4. List users

```bash
curl -sS -b "login=${AMICO_USERNAME}; session=${AMICO_SESSION}" \
  -H "Content-Type: application/json" \
  -X POST "${AMICO_BASE_URL}/load_objects.fcgi" \
  -d '{"object":"users","fields":["id","name","user_type_id","last_access"],"order":["name"],"limit":50,"offset":0}'
# Deliberately omits "password" and "salt" from "fields" even though the
# server allows requesting them — see the security note in this table.
```

### 5. Access logs

```bash
curl -sS -b "login=${AMICO_USERNAME}; session=${AMICO_SESSION}" \
  -H "Content-Type: application/json" \
  -X POST "${AMICO_BASE_URL}/load_objects.fcgi" \
  -d '{"object":"access_logs","fields":["id","time","user_id","portal_id","log_type_id","event"],"order":["time","descending"],"limit":20,"offset":0}'
```

### 6. Logout

```bash
curl -sS -b "login=${AMICO_USERNAME}; session=${AMICO_SESSION}" \
  "${AMICO_BASE_URL}/logout.fcgi"
```

## Explicitly excluded from any curl example or replay (per task scope)

- DELETE user
- Network configuration update (`set_configuration.fcgi` on network sections)
- Restore/import configuration
- Factory reset
- Firmware update
- "Reboot URL" trigger (documented above as existing, never invoked)
- Any write to `/load_objects.fcgi`'s counterpart create/update/delete
  operations (not identified in this read-only session — likely separate
  `.fcgi` scripts per object, not yet discovered)

## Machine-readable version

See `artifacts/amico-endpoints.json` for the same rows as structured data,
`artifacts/live_capture/object_catalog.json` for the full 90-object schema
catalog, `artifacts/ui-action-map.json` for the P1/P2 per-action evidence
map, and `artifacts/live_capture/messenger_commands.json` for the full
78-command dispatcher inventory.
