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
| End date | 2026-09-12 |
| Tests | Groups 1–4: F-1–F-5 all Pass, R-1/R-2 all Pass. Group 5 (F-6): Not run this cycle. |

---

## Outcome

**Status:** [x] Complete (Groups 1–4 scope) / [ ] Partial / [ ] Abandoned

**Note:** Group 5 (Enroll page live discovery) was never approved this
cycle — it remains gated behind a fresh, distinct live-device-contact
approval message per spec.md Decision 5, and this sprint's "Complete"
status refers only to the Groups 1–4 scope that was actually authorized
and executed.

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

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| Group 5 — Enroll page live discovery | No `APPROVE_LIVE_DEVICE_TEST`-style fresh approval message issued this cycle | Next: whenever the user issues that approval |
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

- The Enroll (Face/Card) page has **not** been visited or documented in
  this cycle — `docs/ui-action-protocol-map.md`'s "Gaps not resolved this
  pass" section entry for it is still accurate until Group 5 actually
  runs.
- The git baseline now exists (`27c035b`, `744617b` on top of `2ff9b0e`)
  — future plans should use normal `git diff`/`git status` against these
  commits, not content-hash workarounds.
- `artifacts/ui-action-map.json` was deliberately left unchanged — its
  17 `actions` entries are still only the original P1-era `LIVE_CONFIRMED`
  set, not the 48 new static-only commands (those live in
  `docs/ui-action-protocol-map.md` prose only).
