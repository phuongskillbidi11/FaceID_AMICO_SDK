# Spec — Phase 1.5: Complete AMICO VL70LF Web UI Protocol Discovery, Then Finalize the Phase 2 SDK Spec

> **Status: pre-implementation discovery and planning phase.** This file
> defines what still needs to be discovered and re-specified before any
> C++ implementation resumes. It does **not** authorize implementation.
> `tasks.md` must not be created for this plan, or for a corrected Phase 2
> plan, until the user has explicitly approved this spec in conversation.

---

## Goal

Close the gap between what Phase 1 actually captured (login, dashboard
widgets, logout — a narrow slice) and what a production SDK needs evidence
for, by running one more read-only discovery pass over the rest of the safe
Web UI, then rewrite the Phase 2 SDK spec against that fuller evidence base
before any Executor work resumes.

**Done looks like:** every safe, read-only Web UI page/control is mapped
`UI page → UI control → DOM selector → JS handler → HTTP method → FastCGI
endpoint → request schema → response schema` with a graded evidence level;
every state-changing control is identified and its handler/payload
statically read (never triggered); all of it is written to the artifacts
listed under P3; the discovery gate (P4) passes; and a corrected Phase 2
`spec.md` exists and is explicitly approved by the user before any
`tasks.md` is written or Executor role is activated.

---

## Background

The previous Phase 2 plan
(`.plans/2026-09-11-implement-phase-2-production-oriented-re`, now
`BLOCKED` — see its `DECISION_LOG.md`) specified typed wrappers for users
and access logs based only on the fields the *dashboard* happened to query
during a five-minute login→browse→logout session. It never visited the
dedicated Users page, never exercised search/filter/sort/pagination, never
looked at Groups/Areas/Schedules/Reports/License/EAM pages, and never
statically read the JS handlers behind Add/Edit/Delete/Save/Import/Restore/
Firmware/Network/Date-time/Enrollment/Relay/License/EAM-update controls.
Specifying a "production" SDK against that narrow slice risks baking in
wrong assumptions (e.g. an incomplete `AmicoUser` field set, an unconfirmed
pagination/sort contract) that would be expensive to unwind once C++ code
and tests exist around them. This phase fixes the evidence gap first.

---

## Priority table (P0–P6)

| Priority | Name | What it produces | Executed when |
|---|---|---|---|
| **P0** | Repository and security cleanup plan | A plan (not yet executed) for: identifying all WIP implementation files, preserving pre-existing user changes, removing any real credential/session-token/hash/salt from tracked files, keeping raw HAR/PCAP outside Git, defining sanitized-fixture conventions, and reviewing `.gitignore`. | After this spec is approved, as the first executed task — cheapest, lowest-risk, and unblocks safe iteration on everything else. |
| **P1** | Complete read-only Browser MCP discovery | A plan for a Chrome DevTools MCP pass over every safe page/action listed below, each mapped `UI page → UI control → DOM selector → JS handler → HTTP method → FastCGI endpoint → request schema → response schema`. | After P0, before any further SDK spec work. Requires the device and explicit re-authorization to use Browser MCP again (not yet granted in this message — see "Required user inputs"). |
| **P2** | Static analysis of state-changing controls | A plan for statically reading (never invoking) the JS handlers and payload builders behind every write control. | Alongside/after P1, using the same captured JS sources — no additional device contact beyond what P1 already does read-only. |
| **P3** | Evidence and schema completion | A plan for writing/updating the artifact set listed below with the fuller evidence, including a new `UI_HANDLER_CONFIRMED` evidence grade for P2's static-only findings. | After P1 and P2 produce raw findings. |
| **P4** | Discovery verification | The gate (13 checks, below) that must all pass before Phase 2 spec work resumes. | After P3's artifacts are written. |
| **P5** | SDK specification (corrected) | A plan for rewriting the Phase 2 `spec.md` — same shape as before (typed API, transport, session, query whitelist, pagination, errors, redaction, offline tests, gated live tests) but scoped to what P4 actually confirmed. | After P4 passes. Ends with the corrected `spec.md` presented for the user's explicit approval — `tasks.md` is not written until that approval is given. |
| **P6** | Deferred write-operation plan | A separate, later phase plan for create/update/delete-user and enrollment live tests, using only a clearly-marked disposable test identity. | Not in this sprint's scope at all; recorded here only so it isn't silently forgotten. |

---

## Dependency order

```
P0 (cleanup plan)
  -> P1 (discovery pass plan) ---\
                                    -> P3 (artifact-writing plan) -> P4 (gate) -> P5 (corrected spec) -> [user approval] -> tasks.md -> Executor
  -> P2 (static write-control analysis plan) ---/

P6 is independent and deferred; it does not block P0–P5.
```

P1 and P2 can be planned in parallel (both read from the same captured
JS/DOM sources), but P2 must not be *executed* by actually triggering any
write control — it is static source reading only, described in "Correct
current C++ files" below as a constraint the future Executor must respect,
not something exercised now.

---

## P1 — Read-only discovery scope (planned, not yet executed)

Safe pages/actions to map next time Browser MCP is authorized again:

- Login (already `LIVE_CONFIRMED` from Phase 1 — re-verify only if the spec
  needs a field Phase 1 didn't capture)
- Dashboard (already `LIVE_CONFIRMED`)
- System information (already `LIVE_CONFIRMED`)
- Users list — **not yet visited as its own page**, only the dashboard's
  narrow `load_objects.fcgi` query
- User detail (single-user view/edit form, read-only inspection of its
  fields)
- Search
- Filtering
- Sorting
- Pagination (confirm the real `limit`/`offset`/`order` contract beyond the
  one dashboard example)
- Groups
- Areas
- Schedules
- Access logs (already partially `LIVE_CONFIRMED` from the dashboard feed;
  the dedicated Reports/access-log page may expose more fields/filters)
- Reports
- License
- EAM information
- Date/time display
- Logout (already `LIVE_CONFIRMED`)
- Session invalidation after logout (already `LIVE_CONFIRMED`)

For each: `UI page → UI control → DOM selector → JS handler → HTTP method →
FastCGI endpoint → request schema → response schema`.

## P2 — State-changing controls (static analysis only, never invoked)

Add, Edit, Delete, Save, Import, Restore, Firmware update, Network update,
Date/time update, Face enrollment, Card enrollment, Relay activation,
License update, EAM update.

For each: identify the JS handler and the payload it builds, by reading
already-fetched JS source (the same mechanism Phase 1 used for
`login.js`/`app.js`) — **without ever clicking the control or submitting
the form**.

---

## P3 — Artifacts to write once P1/P2 produce findings

```
docs/ui-action-protocol-map.md        (new)
docs/amico-protocol-map.md            (update — merge new evidence)
docs/amico-auth-flow.md               (update if session/logout findings change)
docs/amico-endpoints.md               (update — merge new evidence)
artifacts/ui-action-map.json          (new)
artifacts/amico-endpoints.json        (update)
artifacts/live_capture/sanitized-network-events.json   (new — sanitized, no raw HAR/PCAP committed)
```

Evidence levels (extends Phase 1's set with one new grade):

| Grade | Meaning |
|---|---|
| `LIVE_CONFIRMED` | Observed directly in a live browser session (Phase 1 definition, unchanged). |
| `PCAP_CONFIRMED` / `HAR_CONFIRMED` | Observed in a saved capture file (unchanged; still unused — no capture files exist in this repo). |
| `JS_CONFIRMED` | Found in Web UI JS source, not yet observed on the wire (unchanged). |
| `UI_HANDLER_CONFIRMED` | **New.** A write-control's handler and payload-builder were read statically in JS source, but the action was never invoked and no request/response was observed. Weaker than `JS_CONFIRMED` in that even the *shape* is unconfirmed by any successful call — it is source-code evidence of intent, not of behavior. |
| `DOCUMENTED` / `INFERRED` | Unchanged from Phase 1. |

---

## P4 — Discovery verification gate (all 13 must pass before P5 executes)

**Status as of 2026-09-11, after the P1/P2 execution plan
(`.plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-`, `COMPLETED`):**

1. Authentication flow confirmed. ✅ *(Phase 1)*
2. Session-cookie behavior confirmed. ✅ *(Phase 1; re-confirmed across a
   longer multi-page P1 session — both `login` and `session` cookies still
   required on every authenticated request)*
3. Logout invalidation confirmed. ✅ *(Phase 1; re-confirmed after P1's
   longer session — `session_is_valid.fcgi` still returns `false`
   immediately after logout)*
4. System information confirmed. ✅ *(Phase 1)*
5. Users query confirmed. ✅ **Done in P1** — dedicated `users.html` page's
   full query (fields, default filter, search, pagination) captured; see
   `docs/ui-action-protocol-map.md`.
6. User-detail behavior confirmed. ✅ **Done in P1** — per-row detail data
   (`c_users`, `face_templates`, `opening_times`) captured. No separate
   single-user "detail page" URL was found; detail is rendered inline in
   the list via these per-row queries.
7. Access-log query confirmed. ✅ **Done in P1** — dedicated Reports page
   (`reportcustomview.html?report=1`) captured: date-range filtering,
   pagination, `reports`/`report_filters` metadata objects.
8. Search/filter/sort/pagination confirmed. ✅ **Done in P1** for
   search+pagination (Users page). ⚠️ **Partial**: no user-triggered
   column-sort control was found on the pages visited — `order` appears
   fixed server-side-default in this firmware/theme, not a gap in the
   discovery pass itself.
9. Sensitive fields identified. ✅ **Strengthened in P1** — found two
   additional fields Phase 1 missed: `panic_password`, `panic_salt`, plus
   confirmed that omitting `fields` from a `load_objects.fcgi` query
   returns the full row including all of them. Also found:
   `object:"face_templates"` returns raw biometric data.
10. All safe Web UI pages inspected. ⚠️ **Partial** — Users, Groups, Time
    Zones (Schedules), Reports, and Settings/About were inspected.
    **Not** inspected this pass: the dedicated "Enroll" page, a
    dedicated Areas/Portals management page (if one exists separately
    from Groups/Time-Zones), and the License Mode/Date-and-Time tiles'
    own panels (attempted, but a stuck modal overlay prevented capturing
    them cleanly — see `docs/ui-action-protocol-map.md`'s gaps section).
    None of these gaps block P5 (see below).
11. State-changing handlers mapped statically. ✅ **Done in P2** — the
    Settings page's full 78-command dispatcher was extracted from
    `configurations.js` and mapped to every prohibited operation category.
    Enrollment-specific handlers (Face/Card) were not found this pass
    (they live in the unvisited "Enroll" page's own script) — remains a
    gap, not required to block P5 since enrollment isn't in this SDK
    phase's scope either.
12. Sanitized artifacts contain no real secrets or biometric data. ✅ —
    re-verified via `.plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-/tests.md`
    Test V-3; the new artifacts (`docs/ui-action-protocol-map.md`,
    `artifacts/ui-action-map.json`, `artifacts/live_capture/sanitized-network-events.json`,
    `artifacts/live_capture/messenger_commands.json`) scanned clean. The
    raw `configurations_js.network-response` file (JS source, not user
    data) was also scanned clean.
13. Harness discovery verification passes. ✅ — `eng verify` on the P1 plan
    reported `PASS`; see that plan's `verify-report.md`.

**Gate verdict: PASS with two explicitly-accepted partial items (8, 10) and
one accepted gap (11, enrollment handlers) — none of which block scoping
Phase 2's SDK to login/session/system-info/users/access-logs/logout, since
that scope was never going to include sort-by-column, Areas/Enroll pages,
or write operations anyway.** P5 (corrected Phase 2 spec) may proceed once
separately approved.

---

## Design decisions

### Decision 1 — Block, don't cancel, the previous Phase 2 plan
- **Chosen:** `.plans/2026-09-11-implement-phase-2-production-oriented-re`
  is `BLOCKED` with a recorded reason, not deleted or cancelled.
- **Why:** Preserves its spec/review/approval/decision-log trail for
  reference (Decision 1–7 there are still largely reusable — e.g. "both
  cookies," "internal-only query engine," "redirects disabled" — once
  re-validated against fuller evidence) while making it impossible for
  `eng workflow advance` to silently resume Executor work on it.
- **Rejected alternatives:** Cancel — rejected, destroys audit trail for no
  benefit. Leave it in `APPROVED`/`EXECUTING` — rejected, that's exactly
  the state the user asked to halt.

### Decision 2 — Existing WIP C++ header files: preserved, not reviewed as correct
- **Chosen:** `vcpkg.json`, `CMakeLists.txt`, `.clang-tidy`, `.gitignore`
  (modified), `include/amico/Errors.hpp`, `include/amico/Cancellation.hpp`,
  `include/amico/Config.hpp` are left exactly as they were written, and
  explicitly labeled unapproved WIP below.
- **Why:** Explicit user instruction: "Do not delete or revert the existing
  WIP scaffold" and "Do not assume these files are correct."
- **Rejected alternatives:** Deleting them to "start clean" — rejected,
  directly prohibited. Silently treating them as final — rejected, equally
  prohibited; P5's corrected spec must explicitly re-review each one (e.g.
  `AmicoConfig`'s field list may need to grow once P1 confirms a real
  pagination/sort contract).

### Decision 3 — No Browser MCP / device contact in this message
- **Chosen:** This spec plans the P1 discovery pass; it does not execute
  it. No `chrome-devtools` MCP tool call and no request to
  `192.168.2.156` happens as part of producing this document.
- **Why:** Explicit instruction ("Do not open Browser MCP yet. Do not
  contact the HID AMICO device yet.") and the harness gate itself — this
  plan's risk level is `feature` (not `high-risk`), but the spec-first
  planning mode still requires the user's explicit spec approval before
  any executed task, including P1's device contact.

---

## Scope

### In scope (this document only)
- The corrected spec you are reading.
- The priority table, dependency order, and discovery-gate checklist above.
- A full inventory of existing WIP files (below) and what must be
  re-checked, not assumed correct, once P5 resumes.

### Out of scope (explicitly excluded from this document)
- Any actual Browser MCP session or device contact (P1's execution) —
  **reason:** explicitly deferred pending user re-authorization.
- Any C++ source file beyond what already exists — **reason:** Executor is
  not active for this plan; `tasks.md` does not exist and will not be
  created until this spec is approved.
- Any build/test/network command — **reason:** explicit instruction.
- Deferred write-operation work (P6) — **reason:** separate future phase,
  not this discovery gate.
- Re-litigating Phase 1's already-`LIVE_CONFIRMED` findings (auth, session,
  logout, system info) — **reason:** already solid evidence; P1 only needs
  to *add* coverage, not redo what's already confirmed.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| *(none in this plan)* | — | This plan produces only its own `spec.md`. P0–P5's file changes happen in later, separately-approved execution steps. |

---

## Existing WIP-file inventory (unapproved, preserved as-is)

| File | Status | What P5 must re-check before treating it as final |
|---|---|---|
| `vcpkg.json` | WIP, untouched | Dependency list (curl, nlohmann-json, doctest) — likely fine, but confirm no additional library is needed once P1's findings are known (e.g. if pagination needs URL query-string building beyond what's already planned). |
| `CMakeLists.txt` | WIP, untouched | Target/file list will need every new source file P5's corrected task breakdown adds — currently references files that don't exist yet in some cases (e.g. `src/Client.cpp`, `test/*.cpp` — none written). Must be reconciled with the corrected file list, not assumed complete. |
| `.clang-tidy` | WIP, untouched | Check selection likely still reasonable; re-review once real source exists to run it against. |
| `.gitignore` | Modified (added `build/`, `out/`, `vcpkg_installed/`, `CMakeUserPresets.json`) | This change is small and low-risk (ignoring build artifacts); no reason found to revert it, but P0's cleanup plan should still explicitly confirm it. |
| `include/amico/Errors.hpp` | WIP, untouched | Exception hierarchy — likely stable regardless of discovery findings (it's protocol-agnostic), but confirm no new error category is needed (e.g. a distinct error for "search/filter/sort parameter rejected by device" if P1 finds that shape). |
| `include/amico/Cancellation.hpp` | WIP, untouched | Protocol-agnostic; low risk of needing rework. |
| `include/amico/Config.hpp` | WIP, untouched | `AmicoConfig`'s field list (`maxPageSize`, `defaultPageSize`, `autoRelogin`, etc.) was written against the old, narrower spec's assumptions about pagination — **must be re-checked against P1's actual confirmed pagination/sort/filter contract**, not assumed correct. |
| `build/`, `build_configure.log` | Build-tool output on disk (from before this instruction arrived) | Not source; safe to leave, will be regenerated or removed by a later, explicitly-approved build step. Not touched by this plan. |

No `.hpp`/`.cpp` files beyond the three listed above exist yet. `tasks.md`
for the old plan was written but never executed against source beyond
those three headers (`git status` shows only the files listed above as
untracked/modified).

---

## Required user inputs before P1 can execute

- Explicit re-authorization to use the Browser MCP / chrome-devtools tools
  against `192.168.2.156` again (the standing authorization from the start
  of this conversation covered Phase 1; re-confirming it here is cheap
  insurance given how explicitly this message asked to *not* do so yet).
- Confirmation that `Admin`/the already-known device password may be reused
  for the P1 session (no new credential is expected to be needed).
- Approval of this spec itself (see below) — the actual, immediate blocker.

---

## Explicit list of prohibited actions until this spec is approved

- No `tasks.md` for this plan or for a corrected Phase 2 plan.
- No Executor role activation (`eng adapter prompt executor ...`).
- No `cmake`, `vcpkg`, build, or `ctest` command.
- No Browser MCP / chrome-devtools tool call.
- No request to `192.168.2.156` or any other device.
- No deletion or reversion of the WIP files listed above.
- No further C++ source files beyond the three already written.

---

## Risks and unknowns

- P1's fuller discovery may surface a materially different `users`/
  `access_logs` field set or pagination contract than the old spec assumed
  — expected, and exactly why this gate exists before more C++ is written.
- The device's Users/Reports pages may themselves trigger dashboard-style
  polling (Phase 1 saw `alarm_status.fcgi`/`load_objects.fcgi` polled ~1/s)
  — P1's session should be kept short and the polling behavior noted, not
  treated as new distinct endpoints each time.
- Static-only JS reading (P2) may not fully reveal a write control's
  request shape if it's built dynamically/conditionally — that's fine;
  `UI_HANDLER_CONFIRMED` is deliberately weaker evidence than
  `JS_CONFIRMED`/`LIVE_CONFIRMED`, and P6 (deferred) is where those get
  properly confirmed, with a disposable test identity, later.

---

## Open questions

- [ ] Does the user want P0 (cleanup) executed before or interleaved with
      P1 (discovery)? Recommendation below assumes P0 first (cheap, no
      device contact, immediately reduces risk).
- [ ] Should P1's session reuse the same `Admin` credential from Phase 1,
      or does the user want a lower-privilege account exercised too (to
      characterize the "Invalid access level" path `login.js` already
      hints at)? Not required for the discovery gate's 13 checks, but would
      strengthen the `Authentication` row.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 10/10 | Goal is explicitly the discovery gate + corrected-spec-approved outcome, not code. |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 5 out-of-scope items, each tied to an explicit instruction or a clear reason. |
| **Surgical Changes** | Every file listed with change type and exact reason | 10/10 | This plan changes no files itself; the WIP inventory table substitutes for the usual affected-files table and is exhaustive against `git status`. |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 10/10 | P0–P6 each trace to one of the 13 discovery-gate checks or an explicit user instruction. |

**Total: 40/40 → 10/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Not yet — awaiting explicit review of this corrected spec, per the user's own instruction to stop here.
**Confirmed on:** —
