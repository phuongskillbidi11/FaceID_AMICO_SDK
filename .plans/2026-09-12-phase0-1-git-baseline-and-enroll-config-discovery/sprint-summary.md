# Sprint Summary — Giai đoạn 0+1: Git baseline + Enroll/config discovery

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.
>
> Paste this summary into the next planning prompt under "Previous sprint context"
> so Claude Code starts with accurate state instead of assumptions.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Giai đoạn 0+1 — Git baseline + Enroll/config discovery |
| Plan folder | `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/` |
| Start date | 2026-09-12 |
| End date | 2026-09-13 |
| Tests | Groups 1–4: F-1–F-5 all Pass, R-1/R-2 all Pass. Group 5 (F-6): Pass, 2026-09-13, live read-only. |

---

## Outcome

**Status:** [x] Complete (Groups 1–5, full scope) / [ ] Partial / [ ] Abandoned

**Note:** Group 5 (Enroll page live discovery) was completed 2026-09-13
after the user issued a fresh, distinct `APPROVE_LIVE_DEVICE_TEST`
approval. Finding: "Enroll" is a sidebar menu-section header, not a
navigable page — confirmed independently live (this session) and
cross-referenced against a more thorough prior discovery already done
under the separate `phase1b-remaining-ui-discovery-enroll-areas-
license-datetime-export` plan, whose "Giai đoạn 1b pass" had already
fetched and statically documented the real per-user enrollment handler
(`newusers.js`, 7 commands). See `DECISION_LOG.md` for full detail.

### What was built (matches tasks.md `[x]` items)
- **Git baseline established.** `.gitignore` fixed first (added
  `build-exec/`, `build-verify/`, `build-verifier/`, `.vs/` — none of
  these were previously ignored, and together they represented >1.3GB of
  binary/cache directories that a naive `git add -A` would have
  permanently baked into git history). Secret scan clean. Committed in
  two commits: `27c035b` (the 325-file, 31373-insertion baseline for
  `include/`, `src/`, `test/`, `examples/`, `docs/`, `CMakeLists.txt`,
  `vcpkg.json`, `webui/`, `.plans/`, `scripts/`,
  `HID_Amico_VL35LF_User_Guide/`, `.agent/project.yaml`, `.clang-tidy`)
  and `744617b` (the Group 3+4 doc-only follow-up). `git diff`/`git log`
  are now real, usable tools for this repo for the first time.
- **`docs/src-map.md` gap fixed.** Added the missing `src/NetworkSafety.{hpp,cpp}`
  row; amended `Errors.hpp`/`Client.hpp`/`Types.hpp` rows to mention
  `TlsVerificationError`/`checkReachable()`/`selfSignedCertificate` — all
  of which existed in code but were undocumented since the prior
  remediation plan's Task 3.1 only touched the live-test row.
- **48 previously-undocumented `MessengerUtil` commands documented**
  (`docs/ui-action-protocol-map.md`'s new section) — static-only read of
  the already-cached `configurations_js.network-response`, zero device
  contact. Each command: purpose, request/response shape, and every
  literal call-site line number, self-verified by Codex's own script
  against the raw file and bound to its SHA-256. `user_get_image_list`/
  `user_list_images` resolved as existing-user-photo export (backup ZIP),
  **not** the Enroll page's own capture flow.

- **Group 5 — Enroll page live discovery (2026-09-13).** Logged in
  read-only against `192.168.2.156`; found "Enroll" is a static
  `<span class="title">Enroll</span>` menu-section header (confirmed
  via `evaluate_script`), not a distinct page — clicking it only
  expands/collapses the already-documented Users/Visitors/Visits/
  Groups/Time Zones/Holidays/Scheduled Unlock/User Types/Custom Fields
  links. Confirmed via `list_network_requests` (only `main.js`/
  `index.js` loaded) and a fresh fetch of `main.js` (`grep -i enroll`:
  zero matches, saved to `artifacts/live_capture/
  main_js.network-response`). Screenshot: `captures/screenshots/
  p1_12_enroll_menu_expanded.png`. This independently reconfirms (a
  second time, a different session) the exact same finding already
  documented in far more depth under the separate
  `phase1b-remaining-ui-discovery-enroll-areas-license-datetime-export`
  plan's `docs/ui-action-protocol-map.md` "Enroll (Face/Card/PIN/
  Fingerprint)" section — no new artifact duplication was needed;
  cross-referenced instead. Logged out at the end, read-only discipline
  maintained throughout (no enroll/capture/save/submit control ever
  clicked).

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| `artifacts/ui-action-map.json` sync for the 48 new commands | Schema mismatch (per-live-action vs. per-static-command prose) — recorded as an explicit no-op, not silently skipped | Only if a future need for machine-readable form arises |

---

## Discoveries (not in the spec)

- `eng tools invoke executor codex.execute` **actually works now** —
  contradicts the prior plan's `DECISION_LOG.md` note that this
  capability didn't exist in Harness 0.10.1-beta. Used it for all three
  Codex-delegated tasks this cycle instead of shelling out to `codex exec`
  directly.
- `build-exec/`, `build-verify/`, `build-verifier/` (~200MB each) and
  `.vs/` (713MB) were **not** in `.gitignore` before this plan — a
  significant near-miss caught by spec.md Decision 2 before the first
  real commit, not after.
- Codex's Task 4.2 output was considerably more rigorous than requested:
  it wrote and ran its own Python verification script to bind every
  call-site line citation to the actual raw file content and confirm the
  raw evidence file's SHA-256 was unchanged before/after — a good pattern
  worth reusing for future large static-discovery tasks.
- One cosmetic mojibake artifact (`?Ignored?` instead of `"Ignored"`,
  likely a PowerShell heredoc quoting artifact) was found and fixed
  directly; no data-integrity issue.

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| None identified this cycle — all changes are additive documentation/git housekeeping, no code. | — | — |

---

## Lessons learned

- Always check `.gitignore` coverage against `du -sh <dir>` for every
  top-level directory *before* the first real commit of a long-uncommitted
  tree — don't assume existing entries are complete just because some
  build dirs are already listed.
- When a Codex-delegated task's output deviates cosmetically from the
  literal instruction (e.g. a section heading string) but fully satisfies
  the underlying intent, correct the plan's own verification commands to
  match reality rather than re-running Codex for a pure rename — cheaper
  and just as auditable.

---

## What the next sprint must NOT assume

- The Enroll page investigation is fully closed as of 2026-09-13 — there
  is **no** standalone Enroll page/URL/JS to ever look for again; it is
  conclusively a menu-section header only, confirmed twice
  independently (this plan and `phase1b-remaining-ui-discovery`).
- The git baseline now exists (`27c035b`, `744617b` on top of `2ff9b0e`)
  — future plans should use normal `git diff`/`git status` against these
  commits, not content-hash workarounds.
- `artifacts/ui-action-map.json` was deliberately left unchanged — its
  17 `actions` entries are still only the original P1-era `LIVE_CONFIRMED`
  set, not the 48 new static-only commands (those live in
  `docs/ui-action-protocol-map.md` prose only).
- **`KNOWN_HARNESS_BUG`** (see `DECISION_LOG.md`'s 2026-09-12 entry):
  tracked `.plans/**` can trigger a self-induced `PLAN_DRIFT_DETECTED`
  loop, because `eng plan drift` and `eng verify` apply `write_scope`
  with opposite semantics while the Harness mutates its own runtime
  files. This is a Harness bug, not an AMICO implementation defect —
  `eng verify` already returned genuine `Verdict: PASS` for this plan's
  Groups 1–4 before the loop was discovered. This plan's mechanical
  `state:` is stuck at `NEEDS_REPLAN` as a result; do **not** hand-edit
  it to `COMPLETED`, do **not** untrack `.plans/`, and do **not** attempt
  a Harness fix from within an AMICO plan — it is deferred to a separate
  session against the Harness's own repo. The next sprint should **not**
  assume this plan reached `COMPLETED` in `plan.yaml`, only that its
  actual technical scope (Groups 1–4) is done and verified.
