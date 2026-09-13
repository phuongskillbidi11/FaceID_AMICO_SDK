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

## Gaps not resolved this pass (P1-era — resolved or reclassified in the
## Giai đoạn 1b pass, 2026-09-12; see the sections below)

- ~~**License Mode tile** and **Date and Time tile**~~ — **resolved**,
  see "License Mode" and "Date and Time" sections below. Root cause of
  P1's stuck modal confirmed to be operator sequencing (opening "About"
  first), not a device/UI defect — a clean Settings page load with
  License Mode or Date and Time as the first tile clicked works without
  issue.
- ~~**Areas / Portals dedicated management page**~~ — **resolved as a
  confirmed-absent finding** (not an open gap): see "Areas/Portals" below.
  No such page exists in this web UI; `object:"areas"`/`portal_rules`-family
  objects are backend-only, used by export, not exposed as a management
  page.
- ~~**Face/Card enrollment handlers**~~ — **resolved**, see "Enroll" below.
  The "Enroll" top-level label is a menu-section header, not a page; the
  actual enrollment commands were found by statically reading
  `users.html`'s own script (`newusers.js`).
- **Sort-by-column**: still not a real gap — no clickable sort control
  exists on the Users page in this theme/firmware version (P1's original
  finding, unchanged, not re-investigated this pass).
- ~~**Report "Export" button handler**~~ — **resolved**, see "Report
  Export" below.

**New gaps opened this pass** (observed while navigating, out of scope
for Giai đoạn 1b, not investigated — carried forward):
- **Visitors** (`customusers.html?type=1`) and **Visits** (`visits.html`)
  — distinct dashboard menu entries, never visited.
- **Data Tools > Import/Export** (`import.html` / `export.html`) — a
  full data export/backup page, distinct from the per-report "Export"
  button already covered below.
- **Internal Alarms** / **Alarm Output** pages — never visited.
- Dashboard-level **"Open relay"** / **"Open Door"** controls — never
  clicked (live physical-door/relay actions; explicitly out of scope for
  any read-only discovery pass).


## Enroll (Face/Card/PIN/Fingerprint) — `LIVE_CONFIRMED` (page structure) + `JS_CONFIRMED` (commands, static read, never invoked)

Giai đoạn 1b pass (2026-09-12), live session against `192.168.2.156`,
read-only. No standalone "Enroll" page/URL exists — the dashboard's
"Enroll" label is a menu-section **header**, not a link, covering
Users/Visitors/Visits/Groups/Time Zones/Holidays/Scheduled
Unlock/User Types/Custom Fields (all already `LIVE_CONFIRMED` pages).
Actual per-user enrollment lives inside `users.html`'s own edit modal,
whose script is `en_US/js/pages/newusers.js` — fetched via a plain `GET`
the browser already made on page load (saved to
`artifacts/live_capture/newusers_js.network-response`, 34463 bytes). The
"ADD" button itself was **never clicked**; every command below was found
by reading this already-fetched static file. Screenshot:
`captures/screenshots/p1b_01_users_enroll_entry.png`.

Commands found here, not present in the 78-command `configurations.js`
inventory (evidence: `JS_CONFIRMED`, static read only):

| Command | Purpose | Payload / notes |
|---|---|---|
| `remote_enroll` | Starts **device-side** biometric/PIN capture — the physical reader's own camera/keypad, not a browser webcam. | `{type, save, user_id, [auto, countdown — for face], [panic_finger — for duress fingerprint]}` |
| `cancel_remote_enroll` | Cancels an in-progress remote enrollment. | No payload observed. |
| `enroller_state` | Polled every 2s while enrolling. | Returns `{enroller_state: "NORMAL_STATE"\|"ENROLL_FACE_STATE"\|"ENROLL_PIN_STATE", last_enroll, last_enroll_error: "UNKNOWN"\|"FACE_EXISTS", biometry_state}`. |
| `enroller_biometry_state` | Biometry-specific enrollment state, used by a related fingerprint modal. | Body not further read this pass. |
| `template_extract` (via `MessengerUtil.sendFile`, not `.send`) | **PC-side** fingerprint enrollment step 1 — extracts a template from a raw scanned image (a USB fingerprint scanner attached to the administrator's PC, a distinct hardware path from `remote_enroll`). | Raw image bytes + `width`/`height` query params. |
| `template_match` (via `sendFile`) | PC-side fingerprint step 2 — confirms 3 captures are consistent. | Concatenated template bytes; errors: `"Template exists"` (already enrolled), `"Different fingerprints"` (capture mismatch). |
| `user_fingerprint` (via `sendFile`) | Associates a captured fingerprint with a user. | Raw bytes + `user_id` param. |

No password, session token, or real biometric data was transmitted or
saved by this pass — purely a static read of already-cached JS text.

---

## Areas/Portals — confirmed absent (not a gap, a definitive negative finding)

Giai đoạn 1b pass (2026-09-12). Checked the full dashboard menu (Home /
Enroll-section / Alarms / Reports / Data Tools / Settings / Log Out) and
the full Settings tile list (73 tiles — see "License Mode"/"Date and
Time" below for how that list was captured) — **no "Areas" or "Portals"
management entry exists anywhere** in this web UI. The only related
evidence: `class/area.js` and `class/portal.js` are generic frontend
model classes loaded on every page (not a dedicated management UI), and
the rule-table object names already documented in the Giai đoạn 0+1
plan's 48-command pass (`portal_rules`, `area_access_rules`,
`portal_access_rules`, `portal_portal_rules`, `portal_rule_actions`,
`portal_rule_groups`, `portal_rule_time_zones`) are used only by the
`export_objects` backup/export flow, never by a page-level CRUD UI. This
more thoroughly confirms P1's original suspicion — treat as closed, not
open.

---

## License Mode — `LIVE_CONFIRMED`

Giai đoạn 1b pass (2026-09-12). Opened cleanly as the first tile clicked
on a freshly-loaded Settings page (no stuck modal, unlike P1 — root cause
of P1's issue was operator sequencing: opening "About" first). Screenshot:
`captures/screenshots/p1b_02_license_mode.png`.

New request confirmed (not previously documented anywhere):
```
POST get_configuration.fcgi
{"sec_box":["catra_role"]}
→ {"sec_box":{"catra_role":"0"}}
```
plus a re-fetch of the already-known `system_information.fcgi`.

The modal has two tabs ("Upgrade License Mode" / "Set License Mode"),
shows current/max face limits (`10000` / `50000`), the equipment serial,
and a password-gated radio selection for upgrading to a higher
face-count tier (options observed: "Pro 50k (already done)", "Pro
100k"). The password field was left empty; only "Cancel" was clicked to
close — `Save` was never invoked.

---

## Date and Time — `LIVE_CONFIRMED`

Giai đoạn 1b pass (2026-09-12). Opened cleanly (no stuck modal).
Screenshot: `captures/screenshots/p1b_03_date_time.png`.

New **read**-side requests confirmed:
```
POST get_configuration.fcgi  {"ntp":["enabled","timezone"]}
  → {"ntp":{"enabled":"0","timezone":"UTC+7"}}
POST get_configuration.fcgi  {"general":["clock_12h_format","month_day_year_format"]}
  → {"general":{"clock_12h_format":"0","month_day_year_format":"0"}}
POST get_ntp_server.fcgi     {}
  → {"server1":"vn.pool.ntp.org","server2":"pool.ntp.org"}
```
plus a re-fetch of `system_information.fcgi`. The panel displays NTP
server fields (disabled — NTP currently off), a date-format radio, a
time-zone dropdown, current date/time fields, and daylight-saving
start/end fields. Closed via "Cancel"; nothing saved or submitted.
(Write-side commands `set_system_time`/`set_ntp_server`/
`get_ntp_server_status` were already `UI_HANDLER_CONFIRMED` via the Giai
đoạn 0+1 48-command pass — not re-documented here.)

---

## Report Export — `LIVE_CONFIRMED` (request shape only — never the actual row data)

Giai đoạn 1b pass (2026-09-12). Confirmed this is a **real server-side
request**, not a client-side-only render. Clicking "Export" on the
"Access (Global)" report fires two `POST report_generate.fcgi` calls:

1. An id-only query — shape:
   `{"offset":0,"limit":10,"where":{"access_logs":{"time":{...}}},"order":["descending","time"],"object":"access_logs","delimiter":";","line_break":"\r\n","header":"","file_name":"","join":"LEFT","columns":[{"field":"id","object":"access_logs","type":"object_field"}]}`
   — fetches matching row IDs only.
2. A full-row query — the same shape but with `where.access_logs.id` set
   to that ID list, and a full `columns` array covering
   `access_logs.id/time/event/identifier_id`, `users.id/name/registration`,
   `portals.name`, `time_zones.name` — returns the actual
   semicolon-delimited, `\r\n`-terminated row data as plain text
   (`content-type: text/plain`), which the browser then offers as a
   downloadable file.

Per `docs/security-sanitization-policy.md`, only this request/response
**shape** is recorded — the actual response (real user names and access
timestamps) was viewed inline during the session and **never saved to
any file in this repo**.

---

## User CRUD write commands — `JS_CONFIRMED` (Giai đoạn 2 Group 0, 2026-09-12)

Static read (never invoked) of `en_US/js/messenger.js` (the generic
`Messenger`/`MessengerUtil` framework every object-editing page —
Users, Groups, Portals, etc. — shares), `en_US/js/class/user.js`, and
`en_US/js/class/baseclass.js`, fetched live but read only as already-cached
static text. Saved to `artifacts/live_capture/{messenger_js,user_class_js,baseclass_js}.network-response`.

### The generic dispatcher (applies to `users` and every other Table-backed object)

`Messenger.save(values)` picks `create`/`modify` based on whether the
object is already loaded; both ultimately call
`MessengerUtil.send(command, $data)` → `POST /<command>.fcgi`, same
one-dispatcher pattern as every other command in this document.

| Operation | Command | Request body (`$data`) | Response |
|---|---|---|---|
| Create | `create_objects` | `{"object":"users","values":[{"registration":<string>,"name":<string>}]}` — **`values` is a one-element ARRAY**, not a bare object (plus `password`/`salt` inside that same element only if a password was set — see below) | `{"ids":[<new_id>, ...]}` on success (the SDK-facing code reads `data.ids[0]`); `{"error":...}` on failure. |
| Update | `modify_objects` | `{"object":"users","values":{<changed fields>},"where":{"users":{"id":<id>}}}` | `{"changes":<count>}` on success (checked as `data.changes > 0`); `{"error":...}` on failure. |
| Delete | `destroy_objects` | `{"object":"users","where":{"users":{"id":[<id>, ...]}}}` (already confirmed in the Giai đoạn 1b pass, from the Users page's "Remove" button) | `{"changes":<count>}`, truthy-checked. |

**Correction (2026-09-12, live-verified during Group 5/Task 5.2 attempt #1):**
the initial static read of this section missed one line: `messenger.js`'s
`this.save = function(values){ if($loaded) return this.modify(values);
else return this.create([values]); }` — note `this.create([values])`
wraps the single `values` object in an array specifically for the
create path (update/`this.modify(values)` passes the bare object
through unchanged). The SDK's first implementation of
`buildUserCreateBody` sent a bare object (matching the *first*, faulty
static reading) and was rejected by the real device with **HTTP 400**
on the first live-write attempt — no user was created, no cleanup was
needed. Fixed in `src/ObjectQuery.cpp` to wrap `values` in a one-element
array; re-verified offline (58 cases/309 assertions) before the retry.
This is the exact scenario Group 5's live-write gate exists to catch —
a static-JS-only reading missed one line of real control flow, and the
live test caught it before it could ship as a real, unverified bug.

### Answering this plan's Open Questions

- **`create_objects` vs. `object_add` for `users`:** these are **not**
  the same command and are **not** interchangeable. `create_objects` is
  the row-creation command for any Table-backed object, including
  `users`. `object_add` is a completely different, schema-level command
  used only by the Settings page's custom-table-import feature — its
  payload is `{object:<table_name>, name:<table_label>, id:<table_id>,
  fields:<column_metadata>}` (`configurations_js.network-response`,
  ~line 6689) — it defines a new **table schema**, not a `users` row.
  `object_add` is irrelevant to user CRUD.
- **Does the create response echo the new row's id?** Yes —
  `{"ids":[<new_id>]}`, confirmed directly in `user.js`'s
  `this.save(...)`: `$objectInstance.setId(data.ids[0])`.

### Important scope narrowing: only `name` and `registration` are ever sent by the actual web UI

Reading `user.js`'s own `save()` function (the real "Save" button
handler for a user), the `values` object it builds is **only**
`{"registration": ..., "name": ...}`, plus `password`/`salt` (only if a
password was entered — see below). **`user_type_id`, `begin_time`, and
`end_time` — despite being read fields (`kUserFields`) — are never part
of any create/update `values` payload found in this pass.** No setter or
call site for them was found in `user.js`, `newusers.js`, or
`messenger.js`. This is a real, evidence-backed finding, not an
assumption: the SDK's write API for this phase should only support
`name`/`registration` as writable fields — treating `user_type_id`/
`begin_time`/`end_time` as writable would be unsupported invention.
(How those three fields actually get set — a different tab, a linked
schedule/group assignment, or a server-side default — is undetermined
and out of scope for this pass.)

### Password handling (context only — SDK does not implement this)

Passwords are **never sent in plaintext**. `user.js`'s `save()` first
calls `MessengerUtil.send('user_hash_password', {password: <plaintext>})`,
which returns `{password: <hash>, salt: <salt>}`; only those hashed
values are placed into the `create_objects`/`modify_objects` `values`
object. This SDK deliberately does not implement `user_hash_password` or
any password-setting path in this phase (spec.md Decision 3) — noted
here only so a future phase doesn't have to re-discover it.

---

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

---

## Users rich-profile write commands — `JS_CONFIRMED` (Giai đoạn 2b Group 0, 2026-09-12)

> Added after Plan Review (`review.md` for
> `2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin`)
> found the original assumption that these shapes were "already known"
> was unbacked by any prior entry in this file. Every shape below traces
> to a specific tasks.md Group 0 task, not to memory/summary carryover.

### Group membership (`user_groups`) — Task 0.3
Static read of `class/intermediatetable.js` (cached,
`artifacts/live_capture/intermediatetable_js.network-response`) and its
instantiation in `class/user.js`:
`new IntermediateTable(this, 'user_groups', 'user_id', 'group_id')`.

- **Add** (supports multiple groups per call):
  `POST /create_objects.fcgi {"object":"user_groups","values":[{"group_id":<gid>,"user_id":<uid>}, ...]}`
- **Remove:**
  `POST /destroy_objects.fcgi {"object":"user_groups","where":{"user_groups":{"group_id":[<gid>,...],"user_id":<uid>}}}`

### Cards (`cards`) — Task 0.4
`Card` is defined inline inside `class/user.js` (no separate
`class/card.js` file exists), `BaseClass.call(this, Card, $messenger,
'cards', 'id', ['id'], null, null)`.

- **Add:**
  `POST /create_objects.fcgi {"object":"cards","values":[{"user_id":<uid>,"value":<numericCardValue>}]}`
  → response `{"ids":[<newCardId>]}`.
- **Remove:**
  `POST /destroy_objects.fcgi {"object":"cards","where":{"cards":{"id":[<cardId>,...]}}}`
- **`value` encoding:** packed integer, `value = areaCode * 4294967296 +
  cardNumber` (a facility/site code and a raw card number combined into
  one number, per `Card.setValue(area, id)`/`getName()`'s inverse). The
  SDK should expose `addCard(userId, areaCode, cardNumber)` (or an
  equivalent explicit pair), not a free-form string.

### Administrator flag (`user_roles`) — Task 0.5
`class/user.js`, `function UserRole()`, `BaseClass.call(this, UserRole,
$messenger, 'user_roles', 'user_id', ['user_id'], null, null)`. The
real UI's own `save()` is **asymmetric** — it only issues a write when
transitioning state, and only one direction at a time:

- **Grant** (not currently an admin role row):
  `POST /create_objects.fcgi {"object":"user_roles","values":[{"user_id":<uid>,"role":1}]}`
- **Revoke** (currently loaded as an admin role row):
  `POST /destroy_objects.fcgi {"object":"user_roles","where":{"user_roles":{"user_id":<uid>,"role":1}}}`
- Granting an already-admin user or revoking a non-admin user is a
  no-op in the real UI (neither branch fires) — the SDK's
  `setAdministrator` should check current state first and skip a
  redundant call, matching this behavior.

### Image (`user_set_image` / `user_destroy_image`) — Task 0.6
`class/user.js`'s `User.save(...)`, lines 253–259, and
`MessengerUtil.sendFile` (`en_US/js/messenger.js`, lines 25–27).

- **Set:** `sendFile('user_set_image', bytesFoto, 'user_id='+id)` →
  `POST /user_set_image.fcgi?user_id=<id>`, `Content-Type:
  application/octet-stream`, body = **raw image bytes directly** — no
  multipart, no base64/JSON envelope.
- **Remove:** `MessengerUtil.send('user_destroy_image', {'user_id':
  id})` → `POST /user_destroy_image.fcgi {"user_id": <id>}`,
  `Content-Type: application/json` (the normal `.send()` path).
- Read (already `LIVE_CONFIRMED` elsewhere, unchanged by this plan):
  `GET /user_get_image.fcgi?user_id=<id>` → raw JPEG.

**Image encoding requirement — `LIVE_CONFIRMED` (2026-09-12, Group 5
attempt #2, this plan's own live test):** the device requires the
`user_set_image` body to be a **JPEG-encoded** image — `bytesFoto`
itself is not "whatever bytes the caller has"; `newusers.js`'s
`UploadFoto()` (lines 1021–1037) always re-encodes an uploaded image
via `canvas.toDataURL("image/jpeg", 0.92)` before calling
`GeraBytesFotos()`/`sendFile`, regardless of the original upload's
format. This was missed in the original Task 0.6 static read (which
only traced `User.save()`'s call to `sendFile`, not `newusers.js`'s own
upload-handling code that builds `bytesFoto` in the first place) and
caught live: sending a **PNG** file's raw bytes directly (this plan's
own test's original sample image, unconverted) produced
`unexpected HTTP status 400 from /user_set_image.fcgi` — the device
rejected non-JPEG image data. Confirmed by re-encoding the same sample
image to JPEG (via a one-off local conversion, not shipped SDK code)
and retrying: the device accepted it. This is consistent with
`user_get_image.fcgi`'s own confirmed `image/jpeg` response
content-type (`docs/amico-endpoints.md`) — the device stores and serves
this field as JPEG specifically, not an arbitrary image format.
**SDK implication:** `AmicoClient::UsersApi::setImage()` requires
JPEG-encoded bytes from the caller; this SDK does not perform any
image-format conversion itself (no image-processing dependency was
introduced for this MVP pass) — see `include/amico/Client.hpp`'s
updated doc comment.

**MAJOR correction — `LIVE_CONFIRMED` (2026-09-13, Group 5 attempt #3):
`user_set_image` is not a purely cosmetic photo store; it enrolls/
updates a face-recognition template, and requires 2 more query params.**
The JPEG fix above (attempt #2) was necessary but not sufficient — a
correctly-JPEG-encoded upload still got HTTP 400 on attempt #3. Rather
than guess further, this was investigated via direct browser evidence:
the real Add-User modal's own photo upload (using a real sample photo,
through a disposable test user, cleaned up immediately after) was
captured live. Two things `class/user.js`'s (vestigial, still-present
but not the actually-exercised) `User.save()` did not show:

1. **The real call site is in `en_US/js/CID.js`** (a generic,
   config-driven form-field save framework used by the Users page — not
   previously discovered), not `class/user.js`. Its actual call:
   ```js
   var timestamp = parseInt(new Date().getTime()/1000);
   var res = MessengerUtil.sendFile('user_set_image', btFoto,
       'user_id=' + obj.id + '&match=1' + '&timestamp=' + timestamp);
   ```
   Confirmed exact URL from a live capture:
   `POST /user_set_image.fcgi?user_id=<id>&match=1&timestamp=<unix_epoch_seconds>`.
   Omitting `match`/`timestamp` (this plan's original implementation)
   was the actual cause of the persistent HTTP 400 — not the image
   content itself.
2. **The response is a face-detection/quality-scoring result, not a
   generic ack:** on success,
   `{"scores":{"bounds_width":...,"horizontal_center_offset":...,"vertical_center_offset":...,"center_pose_quality":...,"sharpness_quality":...},"success":true}`
   (captured live from a real face photo). On failure, either a
   top-level `error` string, or
   `{"success":false,"errors":[{"code":<n>,"message":"...", "info"?:{...}},...]}`
   — `CID.js`'s own `facialErrorToStr()` enumerates the codes: `0`
   UNKNOWN, `1` FAIL, `2` FACE_NOT_DETECTED, `3` FACE_EXISTS, `4`
   FACE_NOT_CENTERED, `5` FACE_TOO_DISTANT, `6` FACE_TOO_CLOSE, `7`
   FACE_POSE_NOT_CENTERED, `8` FACE_LOW_SHARPNESS, `9`
   FACE_TOO_CLOSE_TO_BORDERS, `10` FACE_MASK_NOT_ALLOWED, `11`
   FACE_IMAGE_GRAYSCALE, `12` (multiple faces in image — reuses code 11
   in the source, likely a copy-paste artifact in the real UI, not this
   SDK's concern).
3. **Removing an image also removes the face_templates rows for that
   user**, in the same real-UI code path:
   ```js
   MessengerUtil.send('user_destroy_image', {'user_id': obj.id});
   MessengerUtil.send('destroy_objects', { object: 'face_templates', where: { face_templates: { user_id: obj.id } } });
   ```

**What this means for this plan's scope:** spec.md's Decision 4 modeled
`user_set_image` as a cosmetic profile photo, explicitly distinct from
real face-recognition enrollment (`remote_enroll`) — that assumption is
now known to be **wrong**: the same endpoint performs both. This SDK's
`setImage()`/`removeImage()` are updated to match the confirmed
behavior exactly (match/timestamp params; face-validation-aware error
handling; paired `face_templates` deletion on remove) — see
`include/amico/Client.hpp`'s updated doc comments and `DECISION_LOG.md`'s
2026-09-13 entries. Whether this single confirmed enrollment path is
sufficient for reliable face recognition in practice (recognition
accuracy, number of angles/samples needed, etc.) is **not established**
by this finding — that remains matched to the already-deferred,
hardware-dependent face-enrollment scope (multi-angle `remote_enroll`
capture) for a future plan.

### `hasPassword` derivation — Task 0.7 (`JS_CONFIRMED`, not `LIVE_CONFIRMED` — see note)
No `COUNT`-style aggregate for "password is set" exists in
`messenger.js`'s generic query engine (`$dataWhere` supports only
equality / array-membership / a `%wildcard%` string match — no
`$ne`/`IS NOT NULL` operator of any kind). Instead, `class/user.js`'s
own `validate()` (line 187) special-cases the literal string `"*****"`
for the `password` field
(`if(data.password != '*****' && !ValidateUtil.isNumber(data.password))`),
which only makes sense if the server's `load_objects` response for an
existing user's `password` field is a **fixed masked sentinel**
(`"*****"`) when a password is set, never the real hash — i.e. the
device never transmits the real password/salt back to the client on
any read path, on any table.

**This session attempted to verify this live** — a same-origin
browser-side check that compared the raw `password` field against
candidate sentinel strings and returned only a category (never the raw
value itself back to the agent), specifically designed to respect the
hard boundary against ever handling a real password/salt value even
during discovery. **The request was blocked before it ran by the
session's own safety classifier** (reason: "Credential Materialization").
This finding therefore remains `JS_CONFIRMED` (static code read) —
genuinely `LIVE_CONFIRMED` only once Group 5's Task 5.4 (`setPassword`
live test, itself separately gated) exercises it.

**Design (recommended, pending explicit user/Planner sign-off before
Group 1's Task 1.5 is implemented):** the `hasPassword` query requests
`fields:["password"]` via `load_objects` and computes
`hasPassword = (raw != null && raw != "")`. Since the static evidence
above indicates the server never returns the real hash on this or any
path, this raw value is a safe, non-secret placeholder to hold
transiently in SDK memory — but `AmicoUser` must never store or expose
the raw string itself, only the resulting boolean.

Static limitations: no endpoint was exercised, no downloaded content was produced, and no server-side side effects or access checks were verified. Export replies are treated as text by these handlers; content types and full file grammars remain unconfirmed. Error fields are documented only where consumed. Names beginning with `get`/`has` or containing `status` are classified by caller behavior, not used as proof of server-side read-only guarantees.
