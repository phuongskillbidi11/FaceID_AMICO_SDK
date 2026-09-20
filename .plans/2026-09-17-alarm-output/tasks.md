# Tasks — Alarm Output / Relay and GPIOs

## Group 1 — Discovery (against the OLD device, 192.168.2.156 — now unreachable)

- [x] 1.1 Static JS field/command inventory
- [x] 1.2 Live read-only capture of modal payload and current values
- [x] 1.3 Draft API/UI scope and safety boundary
- [x] 1.4 User review/approval of the read-only scope (user replied “oke”)

## Group 2 — Implementation against the OLD device's 17-field shape (SUPERSEDED, 2026-09-20)

- [x] 2.1 SDK type and read mapping — **now wrong**, targets a device that no longer exists
- [x] 2.2 Backend read route and JSON mapping — **now wrong**, same reason
- [x] 2.3 Frontend read-only presentation and Settings hub — the hub UI shell itself is fine and reusable; only the Alarm Output panel's own field list is wrong
- [ ] 2.4 Separate write design with explicit safety gate — never started
- [ ] 2.5 Unit/backend tests and documentation — never started

## Group 3 — Re-discovery against the actual reachable device (192.168.3.66, firmware 1.8.7)

- [x] 3.1 Live Chrome DevTools capture of `alarmconfig.html`'s real request/response
- [x] 3.2 Static read of `en_US/js/pages/alarm_config.js` (confirms write shape + UI label mapping)
- [x] 3.3 Cross-check Internal Alarms and Relay/Door Actions against this same device (found 1 new field on Internal Alarms: `reset_on_violation_enabled`, not yet handled — separate small follow-up, not blocking)
- [x] 3.4 Record findings in `spec.md`/`DECISION_LOG.md`
- [x] 3.5 User decision: replace Group 2's `AlarmOutputSettings`/routes/frontend entirely with the 3-field shape (`spec.md`'s own "Current device evidence" section), matching Internal Alarms' full read+write pattern — user approved ("ok làm đi")
- [x] 3.6 SDK type + read/write implementation — done via `codex exec`
      (28,890 tokens), independently rebuilt (`cmake --build build
      --target amico_sdk`, exit 0). Only `include/amico/Types.hpp`,
      `include/amico/Client.hpp`, `src/Client.cpp` touched, as
      instructed.
- [x] 3.7 Backend `GET`/`PUT /alarm-output` — done via `codex exec`
      (21,848 tokens). Orchestrating session independently rebuilt
      (standard UAC-elevation stop/rebuild/restart dance), health
      check 200.
- [x] 3.8 Frontend: `frontend/alarm-output.js` replaced with an
      editable form (buzzerEnabled/maxActivationTimeEnabled/
      maxActivationTimeSeconds), `frontend/index.html` intro text
      updated — done via `codex exec` (first attempt hung ~2h53m with
      no output and was killed via TaskStop before any file write;
      confirmed `alarm-output.js` was untouched by the hung run before
      relaunching; second attempt completed cleanly, 21,248 tokens).
      Independently verified: `node --check frontend/alarm-output.js`
      exit 0; diffed against `internal-alarms.js` line-by-line —
      matches its IIFE/element()/input()/runAction()/jsonOptions()
      conventions exactly; `grep` confirms no leftover reference to
      the removed `alarm-output-content` div; `git status` confirms
      only the two declared files changed.
- [x] 3.9 Tests (SDK + backend route) — Codex hung twice on this task
      (attempt 1: ~1h04m, attempt 2: ~40m, both with zero file writes
      and zero output, killed via TaskStop each time); written directly
      by the orchestrating session instead. Added `test/test_alarm_output.cpp`
      (5 cases mirroring `test_internal_alarms.cpp`'s own set, including
      one asserting `playing_timeout` is sent as literal "0" when
      `maxActivationTimeEnabled` is false even with a nonzero
      `maxActivationTimeSeconds`), registered it in `CMakeLists.txt`,
      and added 3 route tests + 2 cookie-gate matrix entries to
      `test/backend/test_routes.cpp`. Verified: `amico_tests.exe` full
      suite 275/275 passed (1846 assertions); `amico_backend_tests.exe`
      full suite 102/102 passed (1021 assertions).
- [x] 3.10a Live READ verification against 192.168.3.66 (2026-09-20):
      logged into backend via `POST /login` (deviceUrl 192.168.3.66),
      `GET /alarm-output` returned `{"buzzerEnabled":true,
      "maxActivationTimeEnabled":false,"maxActivationTimeSeconds":0}`.
      Cross-checked directly against the live `alarmconfig.html` DOM
      (`buzzer_enabled` checkbox checked=true, `playing_timeout_enabled`
      checkbox checked=false, `playing_timeout` text value="0") — exact
      match. Read-only, no device state changed.
- [x] 3.10b Live WRITE verification + restore (2026-09-20, user-approved
      via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-17-alarm-output`):
      `PUT /alarm-output` with `X-Confirm-Sensitive-Action: yes`, changed
      `maxActivationTimeEnabled` false→true and `maxActivationTimeSeconds`
      0→15 (buzzerEnabled left unchanged at true). `{"success":true}`,
      confirmed via backend `GET /alarm-output` and independently via the
      live `alarmconfig.html` DOM (`playing_timeout_enabled` checked=true,
      `playing_timeout` value="15") — both matched. Restored to the
      original values (`maxActivationTimeEnabled:false,
      maxActivationTimeSeconds:0`) in a second PUT; `{"success":true}`,
      confirmed restored via both backend GET and live DOM re-check.
      Alarm Output redesign (Group 3) is now fully complete and
      live-verified end to end.
- [x] 3.11 Nav structure fix (2026-09-20, user-spotted): the real
      device's own sidebar puts "Alarms" (Internal Alarms + Alarm
      Output) as its own top-level flyout, a sibling of "Settings" —
      not nested inside Settings like this app's own hub had it. Fixed
      `frontend/index.html`: added a new `alarms-toggle`/`alarms-submenu`
      nav-group (positioned between Enroll and Reports, matching the
      real device's own left-to-right order) containing `data-tab`
      buttons for `internal-alarms` and `alarm-output`; removed both
      from the Settings hub's `settings-cards` (Settings now shows only
      System Information). No JS change needed — `activateTab()` and
      the `tab-activated` event are identical for `[data-tab]` and
      `[data-settings-tab]` buttons. Verified live in the browser at
      127.0.0.1:8080: both tabs render and load their real data
      correctly under the new nav placement.
