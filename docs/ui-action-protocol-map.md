# AMICO VL70LF — Full UI action → protocol map (P1/P2 discovery pass)

Second live discovery session (2026-09-11, same day as Phase 1, same
`Admin` credential), executed under
`.plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-`. Covers every
page/control in that plan's P1 scope, plus a full static (never-invoked)
read of every write-control handler via P2. See
`docs/amico-protocol-map.md` for the evidence-category legend (now
including `UI_HANDLER_CONFIRMED`).

Screenshots: `captures/screenshots/p1_04_*.png` through `p1_11_*.png`.
Raw JS source used for P2's static reading:
`artifacts/live_capture/configurations_js.network-response` (477KB,
`configurations.html`'s page script — the single largest source of
write-control evidence in this pass).

## Platform-level finding: one client-side dispatcher for ~80 device commands

`configurations.js` defines `MessengerUtil.send(command, data)`, which
builds `POST /<command>.fcgi` for whichever `command` string is passed.
Every capability the Settings page exposes — read and write — is a call
through this one dispatcher. Grepping the file for every literal
`MessengerUtil.send('...')` call yields the fullest single inventory of
device commands found in this project to date (78 distinct commands). This
supersedes the earlier assumption (Phase 1 blocked-SDK spec) that the
device's surface was just the dozen or so `.fcgi` scripts the dashboard
happened to call — the real surface is far larger. Full list:
`artifacts/ui-action-map.json`'s `"messenger_commands"` array.

Of that list, the following map directly to prohibited write operations
from the task brief and are recorded here as `UI_HANDLER_CONFIRMED` —
**their handler code was read; none were invoked**:

| Command | Maps to prohibited operation |
|---|---|
| `create_objects`, `object_add`, `modify_objects`, `object_remove`, `destroy_objects`, `destroy_all` | Create/Update/Delete (generic — the write counterpart to `load_objects.fcgi`) |
| `import_objects.fcgi` (separate endpoint, not via the dispatcher) | Import |
| `reset_to_factory_default` (separate function, calls a dedicated flow) | Factory reset |
| `update_secbox_firmware`, `update_secbox_firmware_new_version`, `hid_update_fw_start` | Firmware update |
| `set_network_interlock`, `set_vpn_information`, `set_ntp_server`, `configure_802_1X` | Network update |
| `set_system_time` | Date/time update |
| `license_change`, `upgrade_ten_thousand_templates`, `upgrade_fifty_thousand_face_templates`, `upgrade_hundred_thousand_face_templates` | License update |
| `change_login`, `master_password`, `change_crypto_key_default`, `change_crypto_key_random` | Credential/security-key changes (adjacent to "Change Web/Master Password" UI tiles) |
| `remote_turnstile_control`, `remote_led_control`, `remote_active_BQC` | Relay/turnstile activation |
| `delete_admins` | Admin removal ("Remove Admins" tile) |
| A separate `reboot`-triggering flow (`askReboot()` / reboot confirmation modal, calls back into the save flow for whichever setting needed a restart) | Reboot |

No enrollment-specific command (`Face enrollment`, `Card enrollment`)
appeared in `configurations.js` — those live in the "Enroll" page's own
script, not visited this pass (not required for the P4 gate's 13 checks;
noted as a remaining gap below).

## Users — detail, search, filter, sort, pagination (all `LIVE_CONFIRMED`)

Dedicated page: `GET /en_US/html/users.html` (distinct from the dashboard
widget). All still go through `POST /load_objects.fcgi`.

**Default listing** (`object:"users"`):
```json
{"join":"LEFT","object":"users",
 "fields":["id","name","registration","password","salt","begin_time","end_time","user_type_id","last_access"],
 "where":[{"field":"user_type_id","operator":"=","value":0,"connector":"OR"},
          {"field":"user_type_id","operator":"IS NULL","connector":") AND ("}],
 "order":["name"],"offset":0,"limit":10,"finish":true}
```

**Search** (typing "Phat" into the search box) adds one more `where` clause
ahead of the existing ones:
```json
{"field":"name","value":"%Phat%","connector":") AND ("}
```
— confirming search is a raw SQL `LIKE`-style wildcard pattern
(`%...%`) inserted directly into the `where` array, joined to the existing
filter via the same string-concatenation-shaped `connector` mechanism
flagged in Phase 1's security notes.

**Pagination**: changing the "per page" dropdown from `10` to `20` changes
only the request's `"limit"` value (confirmed `20` on the wire); `"offset"`
advances on page navigation (not exercised beyond page 1 — only 3 users
exist on this device, too few to reach a second page without the fixture
data changing). `"finish":true` appears on the main data-fetching call but
not on the paired `COUNT(*)` call (see next).

**Row count** (drives the "Showing X to Y of Z records" label and the
pager) is a **separate** request reusing the identical `where`, with
`"fields":["COUNT(*)"]` — a raw SQL aggregate function passed as a field
name:
```json
{"join":"LEFT","object":"users","fields":["COUNT(*)"],
 "where":[...same as above...],"order":["name"],"offset":0,"limit":10}
```

**Sort**: the visible column headers are plain text, not clickable
controls in this firmware/theme — no user-triggered sort request was
observed. `"order":["name"]` is a fixed default, not exposed as a UI
control on this page.

**Per-row detail data**, fetched once per visible row after the main list:
- `object:"c_users"` — the custom-fields table, `fields:["user_id","id","cpf"]`, `where` on `users.id` — empty for both users in this dataset (no custom CPF field filled in).
- `object:"face_templates"` — `fields:["id","user_id","template"]` — **returns the enrolled face template as a base64 string directly in the JSON response.** Not printed here or anywhere in this repo (biometric data). See security note below.
- `object:"opening_times"` — `fields:["id","user_id","door_id","time"]` — per-user custom access windows; empty for both users in this dataset. Confirms a single-condition `where` clause (`{"field":"user_id","value":4}`) needs **no `connector` key at all** when there is only one clause — useful confirmation for the eventual SDK's query builder.

### Security note: two MORE sensitive fields than Phase 1 found

A report-page dropdown query (see Reports section below) requested
`{"object":"users","order":["ascending","name"]}` with **no `fields`
restriction at all**, and the device returned every column, including two
fields Phase 1 never saw: **`panic_password`** and **`panic_salt`** — a
duress/panic-credential mechanism. This is a stronger version of Phase 1's
already-flagged finding: omitting `fields` from a `load_objects.fcgi`
query returns the complete row, panic credentials included, from a UI
context (a report filter's user-name dropdown) that only needed `id` and
`name`. As before: observation only, no exploitation attempted; the SDK
must never request, log, or forward `password`, `salt`, `panic_password`,
or `panic_salt`.

## Groups (`LIVE_CONFIRMED`)

`GET /en_US/html/group.html`. `object:"groups"`, `fields:["id","name"]`,
`where:[]`. Same list/count/pagination pattern as Users. Two rows on this
device: `Everywhere` (id 2), `Standard` (id 1).

## Time Zones / Schedules (`LIVE_CONFIRMED`)

`GET /en_US/html/timespan.html`. Two objects:
- `object:"time_zones"` — `fields:["id","name"]`. One row: `Always Allowed`.
- `object:"time_spans"` — `fields:["id","time_zone_id","start","end","sun","mon","tue","wed","thu","fri","sat","hol1","hol2","hol3"]`, filtered by `time_zones.id`. One row: 24/7 (`start:0, end:86399`, all weekday+holiday flags `1`).

This is the object pair behind the UI's "Time Zones" concept, which is
this device's name for what the task brief called "Schedules."

## Areas (`LIVE_CONFIRMED` — already captured in Phase 1, re-confirmed here by cross-reference, no new page visited)

`object:"areas"`, `fields:["id","name"]` — seen in Phase 1 resolving a
portal's area name (`"Entrance"`). No dedicated "Areas" management page
was found in this session's navigation (Users/Groups/Time
Zones/Holidays/Scheduled Unlock/User Types/Custom Fields submenu, and the
Reports submenu, do not list one) — areas may only be manageable via
"Portals" configuration, not visited this pass. Gap noted below.

## Reports (`LIVE_CONFIRMED`)

`GET /en_US/html/reportcustomview.html?report=<id>`. Submenu: `Access
(Global)` (1), `Access by Group` (4), `Access by Time` (3), `Access by
User` (2), `Alarms (Global)` (6), `Users` (5), plus a `Report designer`
link (`reportcustomconfig.html` — not visited; this is where new reports
would be created, a write-shaped feature out of scope).

Three new objects confirmed:
- `object:"reports"` — describes a report definition. Unusual `where`
  shape here: `{"reports":{"id":1}}` (a nested object keyed by object
  name), **not** the array-of-clause-objects shape every other query in
  this project uses. Response: `{"id":1,"name":"Access (Global)","file_name":"","object":"access_logs","header":"...","delimiter":";","line_break":"\r\n"}` — this is metadata for the CSV "Export" feature (button present, not clicked).
- `object:"report_filters"` — same nested-object `where` shape
  (`{"report_filters":{"report_id":1}}`). Describes the filter widgets a
  report exposes: for report 1, a `time` filter with a JSON-encoded
  default (`{"type":"day","interval":29,"finish":0}` — "last 29 days"),
  plus `users`/`portals`/`groups`/`time_zones` id filters.
- The report's actual row data reuses `object:"access_logs"` — same fields
  Phase 1 already confirmed (`id, time, user_id, portal_id, log_type_id,
  event`), just rendered with joined display names (user name, portal
  name, time zone name) client-side. 213 total rows exist on this device
  over the report's default ~29-day window; pagination (`limit`/`offset`)
  matches the Users-page contract.

The report's "Export" button was **not clicked** (ambiguous whether it is
a pure client-side CSV render of already-fetched rows or triggers a
server-side action) — left as `UI_HANDLER_CONFIRMED`-eligible for a future
static read of `reportcustomview.js`, not done this pass.

## License and EAM information (`LIVE_CONFIRMED`, via existing `system_information.fcgi` + the "About" panel)

The Settings page's "About" tile opens a panel showing `Device: Amico 7`,
`Serial: 1Z0100/000D3D`, `Firmware: 2.4.5`, `SecBox: 2.2.3`, `MAC:
FC:52:CE:94:E6:D8`, `Device ID: 14227560204340541` — all sourced from the
already-cached `system_information.fcgi` response (no new network request
fired; confirmed by absence of a new request in the network panel when the
panel opened). "SecBox" is this UI's label for the EAM firmware version.
License data (`license.users`, `license.device`, `license.type`) was
already `LIVE_CONFIRMED` from Phase 1's `system_information.fcgi` capture
and is not duplicated by a separate "License" page — the Settings page has
a "License Mode" tile but it did not yield a distinct new request in this
pass (see gap below).

## Date/time display (partially confirmed)

The Settings page lists a "Date and Time" tile. Its read side is already
covered by `system_information.fcgi`'s top-level `"time"` (unix timestamp)
and `"daylight_savings_time_active"` fields (Phase 1). The tile's own
panel (which would show/edit NTP settings, timezone, etc.) was not
successfully opened in this pass — see gap below. Its write side
(`set_system_time`, `set_ntp_server`, `get_ntp_server`,
`get_ntp_server_status`) is `UI_HANDLER_CONFIRMED` via the `configurations.js`
command list.

## Gaps not resolved this pass (carried to the P4 gate re-evaluation)

- **License Mode tile** and **Date and Time tile**: clicking them did not
  produce a distinct captured panel/request in this session (a stuck modal
  overlay from the "About" tile likely interfered — see
  `captures/screenshots/p1_09_license_mode.png`, which still shows the
  About panel). Not retried further this pass to stay within a reasonably
  short session. License data is already adequately covered via
  `system_information.fcgi`; Date/Time's write commands are covered via
  the static command list either way.
- **Areas / Portals dedicated management page**: not located in this
  session's navigation; `object:"areas"` itself is confirmed (Phase 1), but
  no page-level CRUD UI for it was inspected.
- **Face/Card enrollment handlers**: the "Enroll" top-level page was not
  visited this pass; its write commands are not yet in the
  `configurations.js`-derived command list. Remains `INFERRED` only
  (the manual's general description of enrollment, nothing protocol-level).
- **Sort-by-column**: no clickable sort control was found on the Users
  page in this theme/firmware version; `"order"` appears fixed
  server-side-default rather than user-controlled here.
- **Report "Export" button handler**: not statically read this pass.
