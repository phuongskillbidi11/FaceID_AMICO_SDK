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


## Task 4.2 - P6 static discovery: 48 additional command contracts (2026-09-12)

Evidence: `UI_HANDLER_CONFIRMED` for all 48 commands below. Literal-name searches and surrounding JavaScript were read only from [configurations_js.network-response](../artifacts/live_capture/configurations_js.network-response). No device commands were invoked. The source SHA-256 is `E81E1088E525905EE67F8A66F899D9A6BFF4DC7CB61EE0571B928CE8176C7C65`.

Line numbers refer to that raw file, starting at 1. The call-site column lists every literal `MessengerUtil.send` / `sendAsync` occurrence for each requested command; context ranges in the final column include payload construction and response use. Response shapes describe fields consumed by the client, not captured server replies or exhaustive schemas. "Ignored" means this caller establishes no response contract. Omitted, explicit `null`, and `{}` request arguments are kept distinct; their wire serialization is not established here.

Scope clarification for the earlier platform-level paragraph: this file contains dispatcher **calls**, but no `MessengerUtil` definition was found in this input. This pass does not independently establish the HTTP method, URL construction, authentication, serialization, or meaning of the fourth argument `false`. It also contains product-specific branches; handler presence does not confirm support on the captured Amico device.

| Command | UI purpose / behavior | Request argument | Response consumed / context | All literal call-site lines |
|---|---|---|---|---|
| `change_idcloud_code` | Write: regenerate iDCloud pairing code. | `null; trailing arguments null, false.` | Return ignored; UI separately reads system_information.iDCloud_code to refresh the displayed code (4052-4066). | 4053 |
| `count_registers` | Read: count AFD records for export progress. | `{} or {initial_date:{day,month,year}} with integer date parts.` | {log_number}; for initial_nsr filtering, the UI subtracts initial_nsr - 1 locally (5250-5269, 5311-5318). | 5314, 5316, 5318 |
| `eap_tls_802_1X_private_key_persist` | Write: persist a newly generated EAP-TLS private key when saving 802.1X configuration. | `null; trailing null, false. No key bytes in this call.` | Checks presence of error; success shape unconsumed. Only the generated_new branch uses this command; imported keys use a separate sendFile command (7671-7685). | 7673 |
| `enable_screenlog` | Write: first debug screenlog-button click enables capture. | `Omitted.` | Ignored; later clicks use get_screenlog (7104-7122). | 7111 |
| `engineering_token` | Mixed: initial token status/generation, password activation, and blocking in engineering/debug UI. | `{} for initial load and Generate Token; {password: <input string>} to validate; {block:true} to block.` | Reads token, validated, remaining_minutes, error. Block reply is assigned but unused. Empty request is also used to generate a token, so cannot be classified as a pure read (6971-7088). | 7012, 7021, 7043, 7076 |
| `export_afd` | Export: download AFD text in batches. | `{mode:595 or 671, offset:0 then +500, limit:500}, optionally initial_date:{day,month,year} OR initial_nsr:<integer>.` | Text chunks concatenated into .txt download. Still makes one request when total <= 0; no response-field/error handling here (5250-5345). | 5327, 5333 |
| `export_audit_logs` | Export: selected audit categories to text. | `{config,api,usb,network,time,online,menu,boot,push}; every value is numeric 1 or 0 from a switch.` | Text saved as Audit_Logs_V<firmware>_<serial>_<date>.txt; error checked before saving (13542-13581). | 13560 |
| `export_custom_tables_metadata` | Export: custom table definitions prepended to a data export. | `Omitted.` | Text concatenated before cid_data marker; error property checked (4996-5007). | 5000 |
| `export_object` | Export: one table in user/backup/sync export. | `{object:<table name>,columns:[]}. This caller resets columns to [] even for custom table descriptors.` | Text appended after table name; error checked. face_templates uses a separate export routine (5008-5025). | 5018 |
| `export_objects` | Export: access logs and related/custom tables. | `{objects:[{object:"access_logs"},{object:"access_log_access_rules"},{object:"access_log_portal_rules"}, ...custom descriptors]}; custom entries are {object:<name>,columns:[<field names>]}.` | Returned data saved directly as logs.csv (4931-4940, 5183-5206). | 5204 |
| `forward_serial_enable` | Write: toggle HID serial forwarding. | `{enable:<boolean>}, inverse of current status.` | {success}; truthy success changes local state and reopens HID modal; otherwise generic error (12501-12530). | 12505 |
| `get_802_1X_status` | Read: poll 802.1X connection state. | `null; trailing null, false.` | {status:<index>} or error. UI indexes 0-10: Initializing, Disconnected, Connecting, Authenticating, Authenticated, Aborting, Held, Forcing authorization, Forcing unauthorization, Rebooting, Unknown status. Polls every 2s, 5s after error (8104-8134). | 8109 |
| `get_configuration` | Read: populate settings, compare old values, and gate device-specific UI. | `{<module>:[<setting names>],...}; e.g. {general:["beep_enabled"],identifier:["log_type","multi_factor_authentication"]}.` | Nested {<module>:{<setting>:<value>}}. Values commonly compared with string "0"/"1"; other settings are strings/numeric text. See configuration notes below; no universal type guarantee inferred. | 20, 130, 241, 309, 411, 796, 1465, 1730, 1901, 2022, 2462, 2777, 2833, 3291, 3420, 3688, 3774, 3845, 3895, 3984, 4026, 4174, 4226, 4476, 4591, 4593, 4648, 4722, 4781, 6450, 7165, 7299, 7357, 7498, 7863, 8496, 8900, 8941, 9079, 9107, 9146, 9151, 9156, 9170, 9891, 10276, 10310, 11048, 11792, 11949, 12204, 12273, 12432, 12473, 12608, 12882, 12938, 13173, 13251 |
| `get_energy_data` | Read: populate Power settings and calculate weighted usage. | `Omitted.` | {itens:[<item names>],mode,brightness,volume,led_white,<item>:{max,weigth,default,source_2a,poe_locker,custom}}. Spellings itens and weigth are literal. UI uses display/sound/ir/led and modes "0"-"3"; parses numeric fields (13695-13785). | 13696 |
| `get_hid_ble_status` | Read: BLE state for HID panel and restart polling. | `null; trailing null, false.` | {status}; UI branches on numeric 2 (Active), 1 (Rebooting), otherwise Disabled. bluetoothStatus has additional label-refresh branching; these are UI interpretations, not a complete backend enum (12298-12326). | 12304, 12320, 12462 |
| `get_hid_last_card` | Read: show most recently read HID card, polled every 1s. | `null; trailing null, false.` | {csn,pac,type,bits}; directly displayed, types not validated. Poll only installed when serial forwarding is disabled (12454-12471). | 12466 |
| `get_hid_module_data` | Read: HID module identity and firmware labels. | `null; trailing null, false.` | {model,serial_number,fw_version,file_fw_version}; first three label module, last labels available firmware update (12308-12314, 12454-12460). | 12310, 12455 |
| `get_oem_code` | Read: populate OEM settings. | `null; trailing null, false.` | {oem_code,license} or error; missing values rendered as empty strings (2998-3014). | 3004 |
| `get_openvpn_log` | Export/read: OpenVPN log download. | `null; trailing null, false.` | Text saved as OPENVPN_log_V<firmware>_<serial>_<date>.txt; error means no log available (7546-7557). | 7546 |
| `get_osdp_installation_mode` | Read: populate OSDP installation switch. | `{}.` | {installation_mode}; passed to bootstrapSwitch setState (12029-12034). | 12030 |
| `get_screenlog` | Export/read: download screen log after enabling capture. | `Omitted.` | Data passed directly to text-file writer; no fields read. Filename includes firmware, serial, date (7114-7121). | 7114 |
| `get_vpn_information` | Read: populate VPN configuration. | `null; trailing null, false.` | {enabled,login_enabled,login,password}; password is only tested for truthiness to display a mask, so its actual content/type is not established (7861-7884). | 7861 |
| `get_vpn_ip` | Read: display VPN address when status is connected. | `null; trailing null, false.` | {ip}; inserted in connected label (8241-8245). | 8243 |
| `get_vpn_status` | Read: poll VPN connection. | `null; trailing null, false.` | {status} or error. Numeric statuses: 0 connected, 1 authentication failed, 2 missing CA, 3 CA failed, 4 missing certificate/private key, 5 certificate failed, 6 private key failed, 7 TLS authentication failed, 8 disabled, 9 trying to connect, 10 disconnected; default unknown. 2s polling, 5s after error (8227-8295). | 8232 |
| `get_wpa_log` | Export/read: WPA log download. | `null; trailing null, false.` | Text saved as WPA_log_V<firmware>_<serial>_<date>.txt; error means no log available (7574-7585). | 7574 |
| `has_audio_access_messages` | Read: determine which custom access audio downloads to show. | `Omitted.` | {not_identified,authorized,not_authorized} truthiness flags; error checked (1536-1557). | 1536 |
| `has_pjsip_audio_message` | Read: detect custom SIP audio file. | `Omitted.` | {file_exists}; returned by hasCustomPjsipAudio (734-737). | 735 |
| `has_vpn_file` | Read: detect uploaded VPN parameterization files. | `null; trailing null, false.` | {has_file} truthiness flag or error (8202-8209). | 8202 |
| `hid_ble_restart` | Write: restart module Bluetooth. | `Omitted.` | Ignored; locally calls bluetoothStatus(...,1) to start reboot-state UI handling. Also called after firmware progress reaches 100 (12329-12333, 12371-12379). | 12331 |
| `hid_update_fw_status` | Read: poll HID firmware-update progress. | `Omitted.` | {progress,step}; progress drives percentage bar, 100 completes; step == "error" fails. Poll every 1s; separate hid_update_fw_start initiates update (12359-12382). | 12360 |
| `led_rgb_refresh` | Write: apply RGB LED configuration after saving led_rgb fields. | `null; trailing null, false.` | Ignored; only sent after set_configuration has no error (7445-7465). | 7464 |
| `logo_destroy` | Delete: remove selected logo on tab change or save when fotoRemoved. | `{} with third argument "id=" + previousTabId or activeTabIndex (logo slots 1-8).` | Ignored; id is a separate dispatcher argument, not a body field (3628-3668). | 3633, 3668 |
| `object_metadata` | Read: discover custom tables before export selection. | `{filter:"custom"}.` | Object keyed by table names; each table has fields object. Helper skips special_columns and takes Object.keys(table.fields) as columns (4830-4842, 4931-4940). | 4833 |
| `osdp_scbk` | Mixed: read/write OSDP secure-channel base key. | `{} reads; {scbk:<input string>} writes only when installation mode is off. UI requires length 32 after trim and hex-only original input.` | Read consumes {scbk}; write reply ignored. Two read calls in the same modal initialization (11819-11834, 12001-12042). | 11833, 12001, 12029 |
| `postoffice` | Dispatch: submit arbitrary JSON from engineering/debug textarea. | `JSON.parse(textarea value), forwarded unchanged. Placeholder example: {"message":"example","reply":true,"params":{}}; this is not an enforced schema.` | Arbitrary reply JSON.stringify-rendered in UI. No command-specific fields or effects established (6952-6953, 7125-7138). | 7135 |
| `remove_phone_icon` | Delete: remove custom intercom phone icon in save flow. | `Omitted.` | Ignored; invoked when btFotoSip is null or single-element sentinel [1], otherwise separate image upload (1150-1153). | 1151 |
| `remove_streaming_logo` | Delete: remove custom streaming watermark/logo in save flow. | `Omitted.` | Ignored; invoked when btFotoStreaming is null or single-element sentinel [1], otherwise separate upload (2329-2332). | 2330 |
| `reset_crypto_key` | Write: reset key in default-communication-key flow when SecBox is inactive. | `Omitted.` | Ignored; surrounding flow changes security_mode and presents a reboot countdown. The same-named local function at 9765 instead uses change_crypto_key_random; do not count that function name as this command (9731-9789). | 9749 |
| `secbox_is_active` | Read: test SecBox availability for firmware/security controls. | `Omitted.` | {isActive}; compared with true to gate firmware modes and key-change paths. The local computed variable at 7179 is not a dispatcher call. | 9226, 9625, 9645, 9745, 10167 |
| `secbox_serial_number` | Read: show SecBox serial. | `Omitted.` | {serial}; assigned to serial field (9621-9622). | 9621 |
| `set_configuration` | Write: save/toggle module settings throughout Settings UI. | `{<module>:{<setting>:<value>},...}; e.g. {general:{beep_enabled:"1"}}. Some bodies assembled dynamically.` | Many callers check error or pass full result to returnMessage; some ignore it. Success schema is not established. Setting-specific UI may separately reboot or invoke apply commands; see notes below. | 58, 65, 74, 80, 102, 107, 159, 275, 328, 493, 547, 1108, 1666, 1853, 1948, 2302, 2629, 2659, 2678, 2764, 2908, 3378, 3476, 3658, 3798, 3858, 3908, 4088, 4158, 4212, 4457, 4521, 4815, 7149, 7280, 7369, 7445, 8856, 8912, 8921, 8927, 8986, 9120, 9126, 9130, 9136, 9689, 9731, 9775, 9970, 10377, 11040, 11879, 12181, 12254, 12420, 12561, 12814, 12843, 13151, 13329, 13787, 13843 |
| `set_oem_code` | Write: save OEM code and license. | `{oem_code:<trimmed string>,license:<trimmed string>}; both required nonempty.` | Checks error; otherwise local success (3018-3041). | 3030 |
| `set_osdp_installation_mode` | Write: set OSDP installation mode during Save. | `{enable:<boolean>} from installation switch.` | Ignored; key write follows only when false (11783, 11831-11834). | 11831 |
| `turnstile_event_state` | Mixed: clear event state and poll turn result after allow-turn action. | `{event_action:"reset_state"} via send; {event_action:"turn_state"} via sendAsync with null, null, callback.` | Reset reply ignored; callback reads event_state: 0 keeps waiting, 1 Blocked right, 2 Blocked left, 3 Counter clockwise, 4 Clockwise, 5 Give up. Nonzero ends polling (10121-10147). | 10123, 10125 |
| `update_secbox_firmware_status` | Read: poll EAM V2 / iDBlock Next firmware update progress. | `Omitted.` | {bitsWritten}; used directly as percentage, 100 completes. Both call sites poll every 1s; initiation is a separate command (9861-9869, 10245-10257). | 9862, 10246 |
| `update_secbox_firmware_version` | Read: current SecBox/turnstile firmware version and feature gating. | `Omitted.` | {fw_version}; UI calls toString(16), formats as 2.x.y for SecBox or 4.x.y for turnstile; zero produces not-found text in helpers. Despite prefix, these callers only consume a version (7229-7251). | 7230, 7241, 9053, 9617, 9927, 10156 |
| `user_get_image_list` | Read/export: fetch user JPEGs in batches for export ZIP. | `{user_ids:[<IDs>]}, slices of up to 100 from user_list_images.` | {user_images:[{id,image},...]}; image passed with base64:true to ZIP entry <id>.jpg (4879-4903). | 4891 |
| `user_list_images` | Read/export: enumerate users whose images will be exported. | `Omitted.` | {user_ids:[<IDs>]}; array length/slices drive image batching (4879-4891). | 4881 |

Configuration contract notes: `get_configuration` requests module-to-array selections, while `set_configuration` sends module-to-object assignments. The initial beep/log/identification controls (20-109) demonstrate both shapes and string flags. These commands also serve biometric/camera settings, SIP/audio/streaming, logo selection, push/cloud, date/time, screen/power, networking, SecBox/turnstile, Wiegand/OSDP, RFID/Mifare/HID, attendance, relays, alarms, and scheduled reboot settings. The complete literal call-site inventory above is retained because a single example is not a complete list of supported setting names.

Dynamic write examples include `{[plugin]:{log_verbosity:verbosity}}` from debug inputs (7142-7149), `configToSave` for Wiegand and OSDP (11040, 11879), and the power-settings `param` object (13755-13787): `general.energy_display_custom`, `energy_sound_custom`, `energy_ir_custom`, `energy_led_custom`, `energy_mode`; `face_module.led_ir_brightness`; and conditional `general.screen_brightness`, `pjsip.speaker_volume`, `led_white.brightness`. Numeric settings are often converted to strings; do not normalize all payload values to booleans or numbers. RGB writes (7445-7464) require a separate `led_rgb_refresh` call in this UI; OSDP changes can trigger a separate reboot (11879-11889). Neither behavior proves that every configuration write reboots or needs a refresh.

Static limitations: no endpoint was exercised, no downloaded content was produced, and no server-side side effects or access checks were verified. Export replies are treated as text by these handlers; content types and full file grammars remain unconfirmed. Error fields are documented only where consumed. Names beginning with `get`/`has` or containing `status` are classified by caller behavior, not used as proof of server-side read-only guarantees.
