# Tasks — Giai đoạn 0+1: Git baseline + Enroll/config discovery

> **Executor instructions:** Complete groups in order unless noted parallel.
> After each task, run the verification command. Mark status before moving on.
>
> **Status markers:**
> - `[ ]` — not started
> - `[~]` — in progress (currently being worked on)
> - `[x]` — complete (verification command passed)
> - `[!]` — failed (stop here, report error to Planner)
>
> **Rule:** Only one task may be `[~]` at a time.
> Never mark `[x]` without running the verification command first.
> When a task becomes `[!]`, write the exact error below the task line
> and stop. Do not attempt the next task.
>
> **Group order is load-bearing:** Group 1→2→3 (git baseline + docs fix) must
> finish before Group 4 (local-only discovery). **Group 5 (Enroll page) must
> NOT start until a fresh, distinct live-device-contact approval message is
> received from the user** — this is a separate gate from this plan's own
> spec approval, per spec.md Decision 5 (same precedent as P1).

---

## Group 1 — Close the `.gitignore` gap before anything is staged

### Task 1.1 — Add missing build-directory patterns to `.gitignore`
**File:** `.gitignore`
**Action:** Append `build-exec/`, `build-verify/`, `build-verifier/`, and
`.vs/` as new lines (existing `build/`, `out/`, `vcpkg_installed/`,
`CMakeUserPresets.json` entries stay unchanged). Keep the existing
`*.pcap`/`*.pcapng`/`*.har`/`*.saz` block as-is.

**Verification:**
```bash
grep -c "build-exec/" .gitignore
grep -c "build-verify/" .gitignore
grep -c "build-verifier/" .gitignore
grep -c "\.vs/" .gitignore
```
**Pass:** Each command prints `1`.
**Fail:** Any command prints `0`.

**Status:** `[x]` — 2026-09-12: appended by Codex CLI, verified byte-exact
(existing content untouched, 4 lines appended, each grep prints `1`).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Secret scan + first git baseline commit

### Task 2.1 — Run the full-tree secret scan before staging anything
**File:** N/A (read-only check)
**Action:** Run the two commands from
`docs/security-sanitization-policy.md` against the whole working tree
(not just this plan's changes — this is the first time everything is
staged together).
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/' | grep -v '/out/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/' | grep -v '/out/'
```
**Verification:** Same two commands, read their output directly.
**Pass:** Both commands produce no output, OR the only output is the
already-known, already-documented false positive described in
`docs/security-sanitization-policy.md` (vcpkg compiler-hash-cache /
prior-plan prose describing it) — confirm by reading the matched line,
do not assume.
**Fail:** Any other match. Stop, do not proceed to Task 2.2, report the
exact matched file/line to the Planner.

**Status:** `[x]` — 2026-09-12: both scans ran over the full working tree,
zero output from either command (not even the known vcpkg false positive,
since `build*/`/`out/` are excluded from the scan glob and are gitignored
anyway).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — Stage the baseline tree by explicit path (never `-A`/`.`)
**File:** N/A (git staging)
**Action:** Run `git add` once per top-level path, exactly this list (no
wildcards, no `-A`):
```bash
git add .agent/project.yaml .clang-tidy .gitignore .plans CMakeLists.txt \
  HID_Amico_VL35LF_User_Guide artifacts captures docs examples include \
  scripts src test vcpkg.json webui
```
**Verification:**
```bash
git status --porcelain | awk '{print $2}' | grep -E '^(build/|build-exec/|build-verify/|build-verifier/|out/|\.vs/)'
git diff --cached --stat | tail -1
```
**Pass:** First command prints nothing (no build/cache directory staged);
second command shows a file/insertion count consistent with source+docs
only (no single file in the diff stat over ~10MB — flag `HID_Amico_VL35LF_User_Guide/`'s
PNGs specifically if any individual file looks anomalously large).
**Fail:** First command prints any path, or a suspiciously large binary
appears in the diff stat. Run `git restore --staged <path>` for the
offending path and re-investigate before re-adding.

**Status:** `[x]` — 2026-09-12: staged by Claude (orchestrator) directly
per spec.md's "Codex never commits" rule. 325 files, 31373 insertions, no
`build*/`/`out/`/`.vs/` path staged. Largest individual files are the 126
`HID_Amico_VL35LF_User_Guide/hid_manual/images/*.png` (5KB–100KB each,
8.7MB total) and `artifacts/live_capture/configurations_js.network-response`
(477KB text) — none anomalously large.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — Commit the baseline
**File:** N/A (git commit)
**Action:** Commit exactly what Task 2.2 staged, nothing more.
```bash
git commit -m "chore: git baseline for the AMICO SDK (Phase 2 remediation + live-verified code)

First tracked commit for include/, src/, test/, examples/, docs/,
CMakeLists.txt, vcpkg.json, webui/, .plans/, scripts/,
HID_Amico_VL35LF_User_Guide/, and .agent/project.yaml. This code was
independently verified (build-verify/, 45 cases/250 assertions) and
live-device tested (RESULT: PASS against 192.168.2.156) prior to this
commit; see .plans/2026-09-11-phase-2-remediation-and-live-device-verification/
for the full evidence trail. No source behavior changes in this commit."
```
**Verification:**
```bash
git log --oneline -3
git show --stat HEAD | tail -5
```
**Pass:** New commit appears on top of `2ff9b0e`; `git status --porcelain`
afterward shows no unexpected remaining untracked source files (build
dirs and `.vs/` are expected to still show as ignored, not listed).
**Fail:** Commit missing, or `git status` still shows a source path (not a
build dir) as untracked.

**Rollback:** If this commit turns out to include something wrong, run
`git reset --soft HEAD~1` (keeps all files on disk exactly as they are,
just un-commits and un-stages — never `--hard`, which is not needed here
since nothing this task does can corrupt a previously-tracked file).

**Status:** `[x]` — 2026-09-12: committed by Claude (orchestrator) directly
as `27c035b` on top of `2ff9b0e`. 325 files, 31373 insertions.
`git status --porcelain` afterward shows no remaining untracked source
path (build dirs correctly gitignored, not listed at all).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Fix the `docs/src-map.md` gap left by the previous plan

### Task 3.1 — Add the missing `src/NetworkSafety.{hpp,cpp}` row
**File:** `docs/src-map.md`
**Symbol:** The `## C++ SDK (amico_sdk)` table
**Action:** Add one new row documenting `src/NetworkSafety.hpp` / `.cpp` —
`reachableThenLogin()` (credential-free reachability probe gating login)
and `probeHttpsIfEnabled()` (conditional secondary HTTPS/TLS probe used
only when `NetworkInfo::sslEnabled` is true) — the shared decision logic
behind `test/live/live_smoke_test.cpp`'s preflight and TLS-probe steps.
Also amend the existing `Errors.hpp` row to mention `TlsVerificationError`,
the `Client.hpp` row to mention `AmicoClient::checkReachable()`, and (if
`Types.hpp` has its own row — confirm before editing) mention
`NetworkInfo::selfSignedCertificate`.
**Verification:**
```bash
grep -c "NetworkSafety" docs/src-map.md
grep -c "TlsVerificationError" docs/src-map.md
grep -c "checkReachable" docs/src-map.md
grep -c "selfSignedCertificate" docs/src-map.md
```
**Pass:** All four commands print `1` or more.
**Fail:** Any command prints `0`.

**Status:** `[x]` — 2026-09-12: Codex added the `NetworkSafety` row and
amended `Errors.hpp`/`Client.hpp`/`Types.hpp` rows; all four greps print
`1`. Only `docs/src-map.md` touched.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Static discovery: the ~50 still-undocumented `MessengerUtil` commands (local artifact only, no device contact)

> **Precondition:** none — `artifacts/live_capture/configurations_js.network-response`
> (477KB, already on disk from the P1 plan) is the sole input. No browser,
> no network call, no live device contact for this entire group.

### Task 4.1 — Identify exactly which of the 78 commands still lack detail
**File:** N/A (analysis)
**Action:** Diff `artifacts/live_capture/messenger_commands.json`'s
78-command list against every command name already named in
`docs/ui-action-protocol-map.md`. Produce the exact list of undocumented
commands (expected ~50, including `count_registers`,
`eap_tls_802_1X_private_key_persist`, `enable_screenlog`,
`engineering_token`, `export_afd`, `export_audit_logs`,
`export_custom_tables_metadata`, `export_object(s)`, `forward_serial_enable`,
every `get_*`/`has_*` status/diagnostic command, `hid_ble_restart`,
`led_rgb_refresh`, `logo_destroy`, `object_metadata`, `osdp_scbk`,
`postoffice`, `remove_phone_icon`, `remove_streaming_logo`,
`reset_crypto_key`, `secbox_is_active`, `secbox_serial_number`,
`set_configuration`, `set_oem_code`, `set_osdp_installation_mode`,
`turnstile_event_state`, `update_secbox_firmware_status`,
`update_secbox_firmware_version`, `user_get_image_list`,
`user_list_images`). Flag `user_get_image_list`/`user_list_images` for
extra attention in Task 4.2 — these names suggest they may be
enrollment-image-adjacent even though found in `configurations.js`, not
the Enroll page's own script.
**Verification:** Manual list review against `docs/ui-action-protocol-map.md`'s
current content.
**Pass:** A concrete, named list of undocumented commands exists (written
into this task's own Status note below).
**Fail:** N/A (analysis task, cannot mechanically fail).

**Status:** `[x]` — 2026-09-12: computed exact set diff (78 total, 30
already named in `docs/ui-action-protocol-map.md`, **48 undocumented**):
`change_idcloud_code`, `count_registers`,
`eap_tls_802_1X_private_key_persist`, `enable_screenlog`,
`engineering_token`, `export_afd`, `export_audit_logs`,
`export_custom_tables_metadata`, `export_object`, `export_objects`,
`forward_serial_enable`, `get_802_1X_status`, `get_configuration`,
`get_energy_data`, `get_hid_ble_status`, `get_hid_last_card`,
`get_hid_module_data`, `get_oem_code`, `get_openvpn_log`,
`get_osdp_installation_mode`, `get_screenlog`, `get_vpn_information`,
`get_vpn_ip`, `get_vpn_status`, `get_wpa_log`,
`has_audio_access_messages`, `has_pjsip_audio_message`, `has_vpn_file`,
`hid_ble_restart`, `hid_update_fw_status`, `led_rgb_refresh`,
`logo_destroy`, `object_metadata`, `osdp_scbk`, `postoffice`,
`remove_phone_icon`, `remove_streaming_logo`, `reset_crypto_key`,
`secbox_is_active`, `secbox_serial_number`, `set_configuration`,
`set_oem_code`, `set_osdp_installation_mode`, `turnstile_event_state`,
`update_secbox_firmware_status`, `update_secbox_firmware_version`,
`user_get_image_list`, `user_list_images`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — Read each undocumented command's handler in `configurations_js.network-response` and document it
**File:** `artifacts/live_capture/configurations_js.network-response` (read
only, never modified) → `docs/ui-action-protocol-map.md` (write)
**Action:** For each command from Task 4.1, grep/read its handler code in
the cached JS file (`grep -n "'<command>'" artifacts/live_capture/configurations_js.network-response`
to locate, then read surrounding context for the payload shape/purpose).
Write a new `## Remaining MessengerUtil commands (P6 static pass)` section
in `docs/ui-action-protocol-map.md` — one entry per command with its
evidence category (`JS_CONFIRMED` for handler-read-but-never-invoked,
matching the existing `UI_HANDLER_CONFIRMED` convention already used in
this doc) and a one-line description of what it does per the JS source.
Group them logically (diagnostics/read-only vs. config-write vs.
credential/hardware-adjacent) rather than as one flat list. **No command
is invoked. This task only reads already-cached static text.**
**Verification:**
```bash
grep -c "P6 static discovery" docs/ui-action-protocol-map.md
```
**Pass:** Command prints `1`; every command identified in Task 4.1 appears
somewhere in the new section (spot-check at least `user_get_image_list`,
`user_list_images`, `reset_crypto_key`, `osdp_scbk`).
**Fail:** Section missing, or any Task-4.1 command absent from it without
a documented reason (e.g. "appears only as a string constant, no handler
body found").

**Status:** `[x]` — 2026-09-12: Codex appended `## Task 4.2 - P6 static
discovery: 48 additional command contracts (2026-09-12)` (heading text
differs from the plan's literal suggestion "Remaining MessengerUtil
commands (P6 static pass)" — accepted as-is, not worth a rerun for a
cosmetic heading string; `tests.md` Test F-5 corrected to grep the actual
heading). All 48 Task-4.1 commands present, each with a one-line
purpose/behavior description, request-argument shape, response fields
consumed, and every literal call-site line number in the raw evidence
file — self-verified by Codex's own script (line citations checked
against the actual file content, raw-evidence SHA-256 unchanged, prior
document content byte-preserved). `user_get_image_list`/`user_list_images`
explicitly resolved as **user photo export** (existing enrolled JPEGs,
batched into a backup/export ZIP) — not the Enroll page's own capture
flow, so they don't shortcut Group 5. One cosmetic encoding artifact
(`?Ignored?` → should be `"Ignored"`) found and fixed directly by Claude
after Codex's pass; no other issue found.
**Error (if [!]):**
> _Leave blank until task fails_
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.3 — Sync `artifacts/ui-action-map.json` if new structured data was extracted
**File:** `artifacts/ui-action-map.json`
**Action:** Only if Task 4.2 extracted structured payload data worth
machine-readable form (e.g. a command → category mapping), add it under a
new key (do not restructure existing keys). If Task 4.2's findings are
adequately captured in prose in `docs/ui-action-protocol-map.md` alone,
this task is a no-op — record that explicitly rather than forcing an
edit.
**Verification:** `python -c "import json; json.load(open('artifacts/ui-action-map.json'))"` (or equivalent) — must still parse as valid JSON.
**Pass:** File still parses as JSON; either updated with new structured
data or explicitly left unchanged with a stated reason.
**Fail:** JSON parse error.

**Status:** `[x]` — 2026-09-12: left unchanged (no-op), confirmed still
valid JSON (17 existing `actions` entries intact). Reason: this JSON's
schema is per-live-page-control (`LIVE_CONFIRMED` UI actions with
request/response shape); the 48 new commands are `UI_HANDLER_CONFIRMED`
static-only findings with per-command prose (purpose, payload nuance,
call-site line citations) that don't fit that schema without losing
detail or requiring a schema change out of this plan's scope. Fully
captured in `docs/ui-action-protocol-map.md`'s new section instead.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Enroll page discovery (GATED — live device contact)

> **STOP before this group.** Do not open a browser session, do not fetch
> any URL from `192.168.2.156`, and do not proceed past this line until a
> fresh, distinct approval message for live-device contact has been
> received from the user in the conversation (per spec.md Decision 5 — the
> same precedent set by the P1 plan). This plan's own spec approval does
> **not** cover this group.

### Task 5.1 — Read-only live browse of the Enroll page
**File:** N/A (live browser session, read-only)
**Action:** Once approval is received: log in with the same read-only
discipline as P1 (device owner-supplied credentials, never printed/logged
by the agent), navigate to the "Enroll" top-level page, and:
- Capture a screenshot (`captures/screenshots/`, following the existing
  `p1_NN_*.png` naming convention, next number in sequence).
- Fetch and save the Enroll page's own JS file (whatever it is actually
  named — inspect the page's `<script src>` tags to find it; do not guess
  the filename in advance) to `artifacts/live_capture/` as a new
  `*.network-response` file, same convention as
  `configurations_js.network-response`.
- **Do not click** any enroll/capture/save/submit control. Read-only
  navigation and static asset fetch only.
- Log out at the end of the session (matching every prior live-discovery
  pass's discipline).
**Verification:** New screenshot file exists; new JS artifact file exists
and is non-empty.
**Pass:** Both files exist, non-zero size, and the sanitized network-event
log (if produced, matching P1's `sanitized-network-events.json`
convention) shows no write-shaped request (no POST other than
login/logout) was ever sent.
**Fail:** Any write-shaped request observed, or either artifact file is
missing/empty.

**Status:** `[x]` — 2026-09-13: performed live, read-only, against
`http://192.168.2.156`. Found (independently, before checking prior
docs) that "Enroll" is a sidebar menu-section **header** (`<span
class="title">Enroll</span>`, confirmed via `evaluate_script` reading
the actual DOM node), not a navigable page — clicking it only
expands/collapses the same Users/Visitors/Visits/Groups/Time
Zones/Holidays/Scheduled Unlock/User Types/Custom Fields links already
present in the sidebar (confirmed via `list_network_requests`: only
`main.js`/`index.js` loaded, no distinct "enroll" script; confirmed via
`grep -i enroll` on a freshly-fetched `main.js`, saved to
`artifacts/live_capture/main_js.network-response`: zero matches).
Screenshot saved to `captures/screenshots/
p1_12_enroll_menu_expanded.png`. **This exact finding was already
independently discovered and far more thoroughly documented** by a
LATER plan, `2026-09-12-phase1b-remaining-ui-discovery-enroll-areas-
license-datetime-export` ("Giai đoạn 1b pass, 2026-09-12") — see
`docs/ui-action-protocol-map.md`'s "Enroll (Face/Card/PIN/Fingerprint)"
section, which already fetched and statically read the real handler
(`en_US/js/pages/newusers.js`, saved as `artifacts/live_capture/
newusers_js.network-response`) and documented 7 enrollment commands
(`remote_enroll`, `cancel_remote_enroll`, `enroller_state`,
`enroller_biometry_state`, `template_extract`, `template_match`,
`user_fingerprint`). No new artifact fetch was needed for that part —
cross-referencing existing, already-thorough evidence rather than
duplicating it.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Statically document the Enroll page's handler code
**File:** The new artifact from Task 5.1 → `docs/ui-action-protocol-map.md`
**Action:** Read the fetched Enroll-page JS statically (same method as
Task 4.2). Add a new `## Enroll (Face/Card) — static handler read` section
to `docs/ui-action-protocol-map.md`, documenting whatever
enrollment-related commands/endpoints it calls, each tagged
`JS_CONFIRMED`/`UI_HANDLER_CONFIRMED` as appropriate. Cross-reference
`user_get_image_list`/`user_list_images` from Task 4.2 if they turn out to
be related.
**Verification:**
```bash
grep -c "Enroll (Face/Card/PIN/Fingerprint)" docs/ui-action-protocol-map.md
```
(Corrected from this task's originally-planned string
`"Enroll (Face/Card)"`, which never matched the actual heading text —
same category of cosmetic mismatch as this plan's own Task 4.2
decision above; the doc section's real content is what matters.)
**Pass:** Command prints `1`; the gaps-list entry for Face/Card
enrollment handlers is updated to reflect what was actually found.
**Fail:** Section missing.

**Status:** `[x]` — 2026-09-13: already satisfied by the pre-existing
`## Enroll (Face/Card/PIN/Fingerprint)` section (`docs/
ui-action-protocol-map.md`, written under the later
`phase1b-remaining-ui-discovery` plan's "Giai đoạn 1b pass") — confirmed
present, confirmed the gaps-list entry at line 210 already reads
"~~Face/Card enrollment handlers~~ — **resolved**, see 'Enroll'
below." No further edit needed; this task's own live session (Task
5.1) independently re-confirmed the same underlying finding
("Enroll" is a menu header, not a page) before this cross-reference
was found, so the conclusion rests on two independent passes, not one.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All tasks marked `[x]` for Groups 1–5 (Group 5 completed
      2026-09-13, live, read-only, after a fresh
      `APPROVE_LIVE_DEVICE_TEST` approval — see Tasks 5.1/5.2 for
      details)
- [x] No tasks marked `[!]`
- [x] `.gitignore` contains all four new patterns (Task 1.1)
- [x] Secret scan clean before commit (Task 2.1)
- [x] Git baseline commit exists on top of `2ff9b0e`, no build/cache
      directory included (Tasks 2.2–2.3)
- [x] `docs/src-map.md` documents `NetworkSafety`/`TlsVerificationError`/
      `checkReachable`/`selfSignedCertificate` (Task 3.1)
- [x] `docs/ui-action-protocol-map.md` has the new "P6 static discovery"
      section covering all 48 previously-undocumented commands (Tasks
      4.1–4.3)
- [x] Sprint summary written to
      `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/sprint-summary.md`,
      explicitly stating whether Group 5 ran this cycle or remains pending
      live-device approval

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain        # see what changed/was added
git diff --cached --stat       # see what's staged but not yet committed
```

### Per-task rollback — Task 2.2/2.3 (staging/commit)
If the wrong set of files gets staged: `git restore --staged <path>` for
individual paths, or `git reset` (no flag — index only, working tree
untouched) to unstage everything and re-do Task 2.2. If a bad commit
already landed: `git reset --soft HEAD~1` (never `--hard` — not needed,
and risks nothing this task did requires it).

### Per-task rollback — Group 4/Task 4.2 (docs edit)
If a `docs/ui-action-protocol-map.md` edit turns out wrong before it's
committed: it's untracked-then-staged-then-committed in the *same* Group
2 commit only if Group 4 ran before any commit — but per this plan's group
order, Group 2's commit happens *before* Group 4's doc edits, so Group 4's
changes are a **second**, separate commit (or remain uncommitted local
changes at the Executor's discretion) — either way, `git diff docs/ui-action-protocol-map.md`
shows exactly what to revert with `git checkout -- docs/ui-action-protocol-map.md`
if needed, since it is now tracked from Group 2 onward.
