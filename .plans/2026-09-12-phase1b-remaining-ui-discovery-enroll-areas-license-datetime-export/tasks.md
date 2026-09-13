# Tasks — Giai đoạn 1b: Hoàn thiện discovery còn thiếu

> **Executor instructions:** Complete groups in order unless noted parallel.
> After each task, run the verification command. Mark status before moving on.
>
> **Status markers:**
> - `[ ]` — not started
> - `[~]` — in progress (currently being worked on)
> - `[x]` — complete (verification command passed)
> - `[!]` — failed (stop here, report error to Planner)
>
> **Group order is load-bearing.** Group 1 (zero device contact) runs
> first, always. **Group 2 requires a fresh, distinct live-device-contact
> approval message from the user before it starts** — per spec.md
> Decision 1. Do not open a browser session or send any request to
> `192.168.2.156` before that approval is received, even to fetch an
> unauthenticated static asset — any request to the device counts as
> live-device contact. Group 3 (documentation) depends on Group 2's
> captured artifacts and cannot run meaningfully without them.

---

## Group 1 — Groundwork from already-local material (zero device contact)

### Task 1.1 — Re-scan existing local artifacts for anything already hinting at the 5 gaps
**File:** N/A (read-only search)
**Action:** Grep/read the already-cached
`artifacts/live_capture/configurations_js.network-response`,
`artifacts/live_capture/object_metadata_response.network-response`,
`docs/ui-action-protocol-map.md`, `docs/amico-protocol-map.md`, and
`HID_Amico_VL35LF_User_Guide/hid_manual/HID_Amico_VL35LF_User_Guide.md`
(the vendor manual — `DOCUMENTED` evidence category per
`docs/amico-protocol-map.md`'s legend, not protocol-level, but useful
background) for anything already describing: enrollment (face/card),
areas/portals management, license mode, date/time configuration, or
report export — without making any new network request. Note any
existing-but-overlooked evidence (e.g. an `object:"areas"` field list
already captured, or a vendor-manual description of the Enroll workflow)
to inform Group 2's navigation plan.
**Verification:** Manual review; findings written into this task's own
Status note.
**Pass:** A concrete list of what's already known vs. genuinely unknown
for each of the 5 gaps exists.
**Fail:** N/A (analysis task).

**Status:** `[x]` — 2026-09-12, done by Claude directly (read-only, zero
device contact). Findings per gap:

- **Enroll:** `configurations.js` already contains an `enroller` config
  module — `{enroller: {face_enroll_mode: "0"|"1"}}` via
  `get_configuration`/`set_configuration` (lines ~414, 439-440, 510,
  565-566 of `configurations_js.network-response`) — a Settings-level
  toggle for whether face-enroll mode is on, **not** the enrollment
  capture flow itself. Vendor manual (`HID_Amico_VL35LF_User_Guide.md`,
  section "2.3 Enrollment" / "2.4.4 Enroll facial biometrics" / "2.4.5
  Enroll a card", lines ~532-786) describes enrollment as `Tap Menu >
  Enroll > Users/Departments/Schedules/Holidays` — this is the **physical
  touchscreen reader's own menu**, a separate UI from the web UI we're
  reverse-engineering; `DOCUMENTED` evidence only, not directly
  protocol-level for the web UI. Genuinely unknown: whether the **web
  UI** exposes an equivalent Enroll page/flow at all, and if so, its
  request shape for the actual biometric/card capture step — this is
  what Group 2 must determine.
- **Areas/Portals:** No dedicated "Areas" or "Portals" management page
  found in `configurations.js`, but it references many portal-related
  **rule tables** as `load_objects.fcgi` object names: `portal_rules`,
  `area_access_rules`, `portal_access_rules`, `portal_portal_rules`,
  `portal_rule_actions`, `portal_rule_groups`, `portal_rule_time_zones`
  (lines ~5138-5155) — these appear to be used by the `export_objects`
  backup/export flow (already documented in Giai đoạn 0+1's 48-command
  pass), not evidence of a standalone management page. Genuinely
  unknown: whether any menu item surfaces CRUD on these objects directly
  — Group 2 must check every top-level menu.
- **License Mode:** No mention anywhere in the vendor manual — appears to
  be a web-UI-only concept, consistent with Phase 1's `system_information.fcgi`
  `license.users`/`license.device`/`license.type` fields and the
  `license_change`/`upgrade_*_templates` commands (48-command pass).
  Genuinely unknown: whether opening the tile fires any *additional*
  request beyond re-displaying already-cached `system_information.fcgi`
  data.
- **Date and Time:** Vendor manual's "6.2 Date and time" (lines
  ~2940-3013) confirms this configures NTP sync — matches
  `get_ntp_server`/`set_ntp_server`/`get_ntp_server_status` already
  `UI_HANDLER_CONFIRMED`. Genuinely unknown: the **read**/display request
  this specific web-UI tile fires when opened (if any).
- **Report Export:** No new local evidence found beyond what P1 already
  noted (`reportcustomview.js` never statically read). Genuinely unknown:
  request shape or "pure client-side render" — Group 2 must observe.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — Draft the Group 2 navigation plan (avoid the P1 stuck-modal repeat)
**File:** N/A (planning)
**Action:** Write a short, ordered navigation plan for Group 2's live
session: which pages/tiles to visit, in what order, and — specifically
for License Mode and Date/Time — start from a clean page load (not from
inside the already-open "About" modal that blocked P1's capture) before
opening each tile. Include the exact URL/page for Enroll and where to
look for an Areas/Portals management entry (Settings submenu already
enumerated by P1: Users/Groups/Time Zones/Holidays/Scheduled
Unlock/User Types/Custom Fields/Reports — Areas/Portals was not among
them, so check any submenu P1 didn't fully enumerate, e.g. a top-level
"Portals" or "Doors" menu item).
**Verification:** Plan reviewed against `docs/ui-action-protocol-map.md`'s
existing page inventory to avoid re-visiting already-`LIVE_CONFIRMED`
pages unnecessarily.
**Pass:** Ordered navigation plan exists, written into this task's Status
note.
**Fail:** N/A.

**Status:** `[x]` — 2026-09-12, done by Claude directly (planning only,
zero device contact). Navigation plan for Group 2, in order:

1. Log in fresh (new session, not reused from any prior tab/modal state).
2. **Enroll page** first, while the session is completely clean: find its
   top-level menu entry (likely alongside Users/Groups/Settings), open
   it, screenshot, inspect `<script src>` tags, fetch its JS.
3. **Areas/Portals check**, still same clean session: walk every
   top-level menu item once (Users, Groups, Time Zones, Reports,
   Settings, Enroll, + any not yet named) looking specifically for a
   "Portals"/"Doors"/"Areas" entry distinct from the Users/Groups/Time
   Zones/Reports pages already `LIVE_CONFIRMED`. Record absence
   explicitly if none found — do not force a false positive.
4. **Settings > License Mode tile**, opened as the **first** tile clicked
   on a **freshly loaded** Settings page (never after opening "About"
   first, since that's what left the modal stuck in P1) — screenshot,
   observe network panel for any new request.
5. **Settings > Date and Time tile**, opened next (still same fresh
   Settings page load, second tile — if this also gets stuck, reload
   Settings page again before opening it, don't chain through a
   possibly-stuck first modal) — screenshot, observe network panel.
6. **Reports > Export button**, on the already-`LIVE_CONFIRMED` Reports
   page — click once, observe network panel for a new request vs.
   client-side-only render; do not save any raw downloaded file
   containing real data.
7. **Logout**, confirm `session_is_valid: false`.

This order front-loads the two never-visited pages (Enroll, Areas/Portals
check) before any Settings-tile modal risk, and isolates License
Mode/Date-Time each to their own fresh page load per Decision 4's retry
approach.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Live, read-only browser session (GATED — requires fresh live-device approval)

> **STOP before this group.** Do not proceed past this line — no browser
> session, no request of any kind to `192.168.2.156` — until a fresh,
> distinct approval message for live-device contact has been received
> from the user in the conversation. This plan's spec approval does
> **not** cover this group.

### Task 2.1 — Enroll page: live visit + JS fetch
**Action:** Log in (device-owner-supplied credentials, never
printed/logged by the agent). Navigate to the Enroll page. Screenshot
(`captures/screenshots/p1b_01_enroll.png`). Identify and fetch its own JS
file(s) (inspect `<script src>` tags — do not assume the filename), save
as `artifacts/live_capture/enroll_js.network-response`. **Do not click**
any enroll/capture/save button — read-only navigation and static asset
fetch only.
**Verification:** Both files exist, non-zero size.
**Pass:** Screenshot + JS artifact saved; no write-shaped request observed
in the network panel (only page-asset GETs).
**Fail:** Any write-shaped request sent, or either file missing/empty.

**Status:** `[x]` — 2026-09-12, live session (approved). **Correction to
plan assumption:** there is no standalone "Enroll" page/URL — the
dashboard's "Enroll" label is a menu-section header covering
Users/Visitors/Visits/Groups/Time Zones/Holidays/Scheduled
Unlock/User Types/Custom Fields (all pre-existing pages). The actual
per-user enrollment UI lives inside `users.html`'s own edit modal, whose
script is `en_US/js/pages/newusers.js` (fetched via
`GET`, saved to `artifacts/live_capture/newusers_js.network-response`,
34463 bytes — **no click on "ADD" or any modal**, purely a static asset
GET the browser already made on page load). Screenshot saved as
`captures/screenshots/p1b_01_users_enroll_entry.png` (Users page,
showing the ADD button, not clicked).

Statically read `newusers.js` for enrollment commands not in the
78-command `configurations.js` inventory:
- `remote_enroll` — starts **device-side** biometric/PIN capture (the
  physical reader's own camera/keypad, not a browser webcam):
  `{type, save, user_id, [auto, countdown for face], [panic_finger for
  duress fingerprint]}`.
- `cancel_remote_enroll` — cancels an in-progress remote enrollment.
- `enroller_state` — polled every 2s while enrolling; returns
  `{enroller_state: "NORMAL_STATE"|"ENROLL_FACE_STATE"|"ENROLL_PIN_STATE",
  last_enroll, last_enroll_error: "UNKNOWN"|"FACE_EXISTS", biometry_state}`.
- `enroller_biometry_state` — biometry-specific enrollment state (used
  by a related fingerprint modal, body not further read this pass).
- `template_extract` / `template_match` (via `MessengerUtil.sendFile`,
  not `.send`) — **PC-side** fingerprint enrollment: raw scanned image
  bytes are sent to `template_extract` to get a template, 3 captures are
  concatenated and sent to `template_match` to confirm consistency
  (errors: `"Template exists"` → already enrolled, `"Different
  fingerprints"` → capture mismatch). Distinct flow from `remote_enroll`
  — this one requires a USB fingerprint scanner attached to the
  administrator's PC, not the device's own hardware.
- `user_fingerprint` (via `sendFile`) — associates a captured fingerprint
  with `user_id`.
No password/session-token/real biometric data was ever transmitted or
saved — this is purely static JS text.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — Areas/Portals: locate and visit if a dedicated page exists
**Action:** Per Task 1.2's plan, check every top-level menu item for an
Areas/Portals management entry. If found: visit, screenshot
(`p1b_02_areas_portals.png`), observe the `load_objects.fcgi`
request shape for `object:"areas"`/`object:"portals"` (read-only, do not
add/edit/delete). If **not found** (P1 already suspected this): record
that fact explicitly rather than fabricating a page that doesn't exist.
**Verification:** Either a screenshot + confirmed request shape, or an
explicit "no dedicated page found, checked menus: [list]" note.
**Pass:** One of the two outcomes above is recorded with evidence.
**Fail:** Neither outcome recorded (i.e., simply skipped).

**Status:** `[x]` — 2026-09-12, live session. **Confirmed absent**: the
full dashboard menu (Home/Enroll-section/Alarms/Reports/Data
Tools/Settings/Log Out) and the full Settings tile list (73 tiles, see
Task 2.3/2.4) contain no "Areas" or "Portals" management entry. The only
portal/area-related evidence is (a) `class/area.js` and `class/portal.js`
— generic frontend model classes loaded on every page (not a dedicated
management UI), and (b) rule-table object names already known from the
Giai đoạn 0+1 48-command pass (`portal_rules`, `area_access_rules`,
`portal_access_rules`, etc., used by the `export_objects`
backup/export flow). No new page or endpoint found. This matches — and
now more thoroughly confirms — P1's original suspicion.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — License Mode panel: reopen from a clean state
**Action:** Reload the Settings page fresh (do not reuse a session with
the "About" modal already open). Open the "License Mode" tile. Screenshot
(`p1b_03_license_mode.png`). Capture whatever request/response this
specific tile fires (if any — it may just re-render already-cached
`system_information.fcgi` data, per P1's hypothesis).
**Verification:** Screenshot exists; request/response (or explicit "no
new request — reuses cached system_information.fcgi" finding) recorded.
**Pass:** Either a new request shape is captured, or it's confirmed (not
just assumed) that no new request fires.
**Fail:** Same stuck-modal failure as P1 recurs without being explicitly
noted as a still-unresolved gap.

**Status:** `[x]` — 2026-09-12, live session. **No stuck modal this
time** (clicked as the first tile on a fresh Settings page load, per
Task 1.2's plan). Screenshot: `captures/screenshots/p1b_02_license_mode.png`.
New request confirmed: `POST get_configuration.fcgi` body
`{"sec_box":["catra_role"]}` → `{"sec_box":{"catra_role":"0"}}` (not
previously documented), plus a re-fetch of `system_information.fcgi`.
Modal shows two tabs ("Upgrade License Mode" / "Set License Mode"),
current/max face limits (10000/50000), equipment serial, and a
password-gated radio selection for upgrading to a higher face-count
tier — **the password field was left empty, never filled or submitted**
(Save was not clicked; Cancel was used to close).
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.4 — Date and Time panel: reopen from a clean state
**Action:** Same clean-state approach as Task 2.3, for the "Date and
Time" tile. Screenshot (`p1b_04_date_time.png`). Capture the panel's read
request (its write side — `set_system_time`/`set_ntp_server`/
`get_ntp_server`/`get_ntp_server_status` — is already
`UI_HANDLER_CONFIRMED` from Giai đoạn 0+1's 48-command pass; this task
only needs the **read**/display side).
**Verification:** Screenshot exists; read request/response (or explicit
still-blocked note) recorded.
**Pass:** Same bar as Task 2.3.
**Fail:** Same bar as Task 2.3.

**Status:** `[x]` — 2026-09-12, live session. **No stuck modal.**
Screenshot: `captures/screenshots/p1b_03_date_time.png`. New read
requests confirmed: `POST get_configuration.fcgi` bodies
`{"ntp":["enabled","timezone"]}` → `{"ntp":{"enabled":"0","timezone":"UTC+7"}}`
and `{"general":["clock_12h_format","month_day_year_format"]}` →
`{"general":{"clock_12h_format":"0","month_day_year_format":"0"}}`; plus
`POST get_ntp_server.fcgi` body `{}` → `{"server1":"vn.pool.ntp.org","server2":"pool.ntp.org"}`;
plus a re-fetch of `system_information.fcgi`. Panel displays NTP
server fields (disabled — NTP off), date format radio, time zone
dropdown, current date/time, and daylight-saving start/end fields.
Closed via Cancel, nothing saved/submitted.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.5 — Report Export: click and observe (read-only per spec.md Decision 2)
**Action:** On the Reports page (already `LIVE_CONFIRMED` from P1), click
the "Export" button for one report. Observe the network panel: does it
trigger a new server request, or purely re-render already-fetched rows
client-side into a downloadable file? If a file downloads, do **not**
save the raw file if it contains real access-log/user data — per
`docs/security-sanitization-policy.md`, only note the request shape,
content-type, and filename pattern, not the raw content.
**Verification:** Network panel evidence recorded (request shape or "no
new request — client-side render" finding).
**Pass:** Evidence recorded either way, no raw sensitive file saved to
the repo.
**Fail:** A raw export file containing real device data gets saved into
the repo.

**Status:** `[x]` — 2026-09-12, live session. **Confirmed: real
server-side request, not client-side-only render.** Clicking "Export" on
the "Access (Global)" report fires **two** `POST report_generate.fcgi`
calls: (1) `{"offset":0,"limit":10,"where":{"access_logs":{"time":{...}}},
"order":["descending","time"],"object":"access_logs","delimiter":";",
"line_break":"\r\n","header":"","file_name":"","join":"LEFT",
"columns":[{"field":"id","object":"access_logs","type":"object_field"}]}`
— fetches matching row IDs only; (2) same shape but `where.access_logs.id`
set to the ID list from call 1, and a full `columns` array (`access_logs.id/time/event/identifier_id`,
`users.id/name/registration`, `portals.name`, `time_zones.name`) —
returns the actual semicolon-delimited, `\r\n`-terminated row data as
plain text (content-type `text/plain`), which the browser then offers as
a downloadable file. **The real response (containing real user names and
access timestamps) was viewed inline in this session only, never written
to any file in the repo** — per this task's own instruction and
`docs/security-sanitization-policy.md`, only the request/response
**shape** is documented, not the actual row content.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.6 — Logout and session-integrity check
**Action:** Log out. Confirm `GET /session_is_valid.fcgi` reports false
post-logout (same discipline as every prior live-discovery pass).
**Verification:** Observed response.
**Pass:** `session_is_valid: false` confirmed.
**Fail:** Session still valid after logout (would be a real product
finding, not an SDK/discovery-process failure — report to Planner either
way).

**Status:** `[x]` — 2026-09-12. Logged out via the "Log Out" link
(redirected to `login.html`), then ran `fetch('/session_is_valid.fcgi')`
in-page: `{"session_is_valid":false}` confirmed.

**Discoveries beyond this plan's 5 approved gaps (noted, not
investigated further — out of scope for this plan, carried forward):**
the dashboard also exposes **Visitors** (`customusers.html?type=1`),
**Visits** (`visits.html`), **Data Tools > Import/Export**
(`import.html`/`export.html` — a full data-export/backup page, distinct
from the per-report Export button investigated in Task 2.5), **Internal
Alarms**/**Alarm Output** pages, and dashboard-level **"Open relay"/"Open
Door"** controls (never clicked — these are live physical-door/relay
actions, explicitly not part of this read-only pass).
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Document findings (local, from Group 2's captured artifacts)

### Task 3.1 — Write up all 5 gaps in `docs/ui-action-protocol-map.md`
**File:** `docs/ui-action-protocol-map.md`
**Action:** Add one section per gap (Enroll, Areas/Portals, License Mode,
Date/Time, Report Export), each with the correct evidence category
(`LIVE_CONFIRMED` for anything actually observed on the wire this
session, `JS_CONFIRMED`/`UI_HANDLER_CONFIRMED` for static-JS-only finds,
or an explicit "confirmed absent" note for Areas/Portals if no dedicated
page exists). Cross-reference `user_get_image_list`/`user_list_images`
from Giai đoạn 0+1's 48-command pass if Enroll's JS turns out related.
**Verification:**
```bash
grep -c "Enroll" docs/ui-action-protocol-map.md
grep -c "License Mode" docs/ui-action-protocol-map.md
grep -c "Date and Time\|Date/Time" docs/ui-action-protocol-map.md
grep -c "Report Export\|Export" docs/ui-action-protocol-map.md
```
**Pass:** All four print `1` or more, each backed by Group 2 evidence (or
an explicit absence note for Areas/Portals).
**Fail:** Any section missing or unsupported by actual evidence gathered.

**Status:** `[x]` — 2026-09-12: written directly by Claude (Codex
invocation hit a Windows command-line-length limit passing the full
evidence as a single argument — documented as a deviation, not a process
violation, since the content is prose synthesis of already-gathered
facts, not new code). Five new sections added (Enroll, Areas/Portals,
License Mode, Date and Time, Report Export), each tagged with the
correct evidence category. All four greps print ≥1 (`7`, `7`, `5`, `17`).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — Update "Gaps not resolved this pass" to reflect true remaining state
**File:** `docs/ui-action-protocol-map.md`
**Action:** Rewrite the existing "Gaps not resolved this pass" section:
remove any item this plan actually closed; keep (with updated detail) any
item that genuinely remains open (e.g. if License Mode is still blocked
after a clean-state retry, say so explicitly rather than silently
dropping it).
**Verification:** Manual diff review against Group 2's actual findings.
**Pass:** Section accurately reflects post-plan reality — no gap silently
erased without evidence it was closed, no still-open gap silently
dropped.
**Fail:** Section claims a gap is closed without Group 2 evidence
supporting it.

**Status:** `[x]` — 2026-09-12: rewritten with strikethrough on the 4
resolved items (each pointing to its new section above), Sort-by-column
left as-is (still not a real gap, unchanged), and a new "New gaps opened
this pass" subsection added for Visitors/Visits/Data Tools Import-Export/
Internal Alarms/Alarm Output/Open relay/Open Door — observed but
explicitly out of scope, not investigated.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.3 — Secret scan on all new artifacts before considering this plan done
**File:** N/A (verification)
**Action:** Run the standard two secret-scan commands from
`docs/security-sanitization-policy.md` against every new file this plan
created (`captures/screenshots/p1b_*.png` — visual only, no scan needed;
`artifacts/live_capture/*` new files; `docs/ui-action-protocol-map.md`'s
new sections).
**Verification:**
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.network-response' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
```
**Pass:** No output, or only the already-documented benign false positive.
**Fail:** Any other match — stop, redact before proceeding.

**Status:** `[x]` — 2026-09-12: both scans clean (zero output). Also
spot-checked `artifacts/live_capture/newusers_js.network-response`
directly for a leaked `session=` cookie value — zero matches (the file
only contains the response body, saved via `responseFilePath`, never the
request headers that carried the cookie).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1 tasks marked `[x]`
- [x] All Group 2 tasks marked `[x]` — approved and run this cycle (all 6
      tasks), not deferred
- [x] No tasks marked `[!]`
- [x] `docs/ui-action-protocol-map.md` updated for all 5 gaps (Task 3.1)
- [x] "Gaps not resolved this pass" accurately updated (Task 3.2)
- [x] Secret scan clean (Task 3.3)
- [x] Sprint summary written to
      `.plans/2026-09-12-phase1b-remaining-ui-discovery-enroll-areas-license-datetime-export/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
This plan only creates new files (screenshots, artifacts, doc sections)
— no existing tracked file's prior content is destructively overwritten
except `docs/ui-action-protocol-map.md`'s "Gaps not resolved this pass"
section (Task 3.2), which `git diff docs/ui-action-protocol-map.md` can
revert with `git checkout -- docs/ui-action-protocol-map.md` if needed.

### Per-task rollback — Group 2 (live session)
No rollback needed on the device — every task in Group 2 is read-only by
design (Decision 2 covers Report Export explicitly). If a task
accidentally triggers a write-shaped request, stop immediately, do not
attempt to "undo" it via more device interaction, and report the exact
request to the Planner/user first.
