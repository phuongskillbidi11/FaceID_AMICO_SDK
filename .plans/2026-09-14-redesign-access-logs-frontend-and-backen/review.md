# Plan Review — Redesign Access Logs to match the real device's "Access (Global)" report

**Reviewer:** Claude (plan-reviewer role, same session — normal assurance mode permits this)

## Pass 1 — REJECT (3 blocking issues)

See DECISION_LOG.md and this plan's git history for the original Pass 1 findings (write_scope
missing `include/amico/Client.hpp`/`src/ObjectQuery.hpp`; `buildAccessLogsListBody`'s new `from`
parameter being a same-type positional-argument-order hazard with 4 unenumerated call sites,
plus a latent pre-existing hardcoded-offset-`0` bug at `src/Client.cpp`'s `listAccessLogs` call
site; and Task 1.4's `"Unknown"` default needing one pinning sentence to stop an executor from
"helpfully" porting `report.js`'s unrelated outer default). Full text preserved below.

<details>
<summary>Original Pass 1 review.md content</summary>

Verdict: CHANGES REQUESTED (REJECT), 3 blocking issues:
1. `write_scope` missing `include/amico/Client.hpp` and `src/ObjectQuery.hpp` (Task 1.3/1.2
   both modify these files); `src/AccessLogLabels.hpp` mentioned only in passing prose, not
   given an explicit deliverable status or write_scope entry.
2. `buildAccessLogsListBody`'s new `from` parameter is the same C++ type
   (`std::optional<int64_t>`) as the existing `to` parameter — a swapped argument order at any
   call site compiles cleanly and silently inverts the filter. 4 call sites needed enumerating
   (test_query_whitelist.cpp lines 16/35/111, plus src/Client.cpp's listAccessLogs), and a
   latent, independent pre-existing bug was found in the same line of Client.cpp: the offset
   argument is hardcoded `0` today, not `query.offset` — pagination would silently no-op at the
   SDK layer if this isn't also fixed.
3. Task 1.4's `"Unknown"` default for `identificationLabel` needed one explicit sentence
   pinning it as final, since `report.js` has an unrelated outer `default: return value;` case
   (for different column types) that an executor could mistakenly port in by pattern-matching
   the source too literally.

</details>

## Pass 2 — Re-review after Planner's fixes

Re-read `plan.yaml`, `tasks.md`, `tests.md` in full after the Planner's revision. Verified each
finding directly against the new text (not taking the Planner's own summary on faith):

1. **write_scope** (`plan.yaml`, read fresh): now includes
   `include/amico/Types.hpp`, `include/amico/Client.hpp`, `src/Client.cpp`, `src/ObjectQuery.cpp`,
   `src/ObjectQuery.hpp`, `src/AccessLogLabels.hpp`, plus the previously-listed backend/frontend/
   test/doc files. **Confirmed fixed.**

2. **Argument-order hazard** (`tasks.md` Task 1.2, re-read in full): the signature is now pinned
   verbatim — `buildAccessLogsListBody(std::optional<int64_t> from, std::optional<int64_t> to, int limit, int offset)`
   — with an explicit rationale for why the order matters (same-type swap risk). All 4 call
   sites are individually enumerated with their exact before/after argument lists:
   `test_query_whitelist.cpp` lines 16, 35, 111 (each with the specific new call text), and
   `src/Client.cpp`'s `listAccessLogs` (delegated to Task 1.4, confirmed present there). Task 1.4
   now explicitly states the pre-existing hardcoded-`0`-offset bug and requires it be replaced
   with `query.offset` in the same edit, calling it out as "two things in the same line, both
   required, neither optional." tests.md's Test Q-2 was also strengthened to check clause
   *values* (not just array length) with distinct `from`/`to` values chosen specifically to
   detect a swap, plus Test Q-3 updated to use the pinned signature. **Confirmed fixed,
   including the test-side regression guard.**

3. **`"Unknown"` default** (`tasks.md` Task 1.4, re-read): now has an explicit paragraph
   immediately after the code sample stating the default is final and explaining exactly why
   `report.js`'s unrelated outer `default: return value;` must not be ported in. **Confirmed
   fixed.**

No new issues introduced by the fixes themselves (re-checked: the new call-site text for
`test_query_whitelist.cpp` lines 35/111 correctly preserves each test's original intent — a
`to`-only call — rather than accidentally changing what those tests exercise; the new
`src/AccessLogLabels.hpp` entry is explicitly scoped as header-only with no `CMakeLists.txt`
impact, verified against this session's own read of `CMakeLists.txt` showing explicit, non-glob
source lists).

## Verdict: PASS

All 3 blocking issues resolved with specific, verifiable fixes. No remaining findings against
the review checklist (missing requirements / incorrect assumptions / architecture
inconsistencies / missing edge cases / missing tests / dependency problems / security or
hardware impact) — see Pass 1's "What's already solid" section, still accurate.

**Blocking issues:** 0

## Pass 4 — Mid-execution amendment review (Decision 2b, Task 1.5)

**Context:** Task 2.2 (already in progress) surfaced that `Name (Time
Zone)` needs a 2-hop join (`access_logs → access_log_access_rules →
access_rule_time_zones → time_zones`), not a direct field as
originally assumed. See DECISION_LOG.md for the full account,
including an honest note that this should have been caught in Pass
1/2 (the evidence — this plan's own captured `object_metadata.fcgi`
schema — was already on file, just not cross-checked field-by-field
against Task 2.2's join assumption).

**Reviewed:** The new Task 1.5, the revised Task 2.2, and the new/
revised tests (Q-7, L-4, L-5, R-2, V-1) against the review checklist:

- **Missing requirements:** None — this closes a gap, doesn't open one.
- **Incorrect assumptions:** This *is* the fix for the incorrect
  assumption; re-checked the new join against
  `artifacts/live_capture/access_logs_object_metadata.json` directly
  (not from memory) — `access_log_access_rules` has exactly
  `access_log_id`/`access_rule_id`; `access_rule_time_zones` has
  exactly `access_rule_id`/`time_zone_id`; both confirmed field names
  match what Task 1.5 specifies.
- **Architecture inconsistencies:** None — reuses the exact
  array-of-ids `where` shape already established (`buildUsersByIdsBody`,
  `buildUserDeleteBody`), same `AccessLogsApi` class pattern as every
  other method on it.
- **Missing edge cases:** The "many-to-many junction table but this
  device is 1:1 in practice" case is explicitly handled with a defined,
  deterministic tie-break rule (first row wins) rather than left
  undefined — and Test L-5 specifically exercises the tie-break case
  with a synthetic 2-row fixture (the real device has no such case
  today, so this can only be tested with a fake transport, not live).
  The "id not found at any hop" case (a row with no time zone) is
  handled (absent from the map, not a spurious empty-string entry at
  the SDK layer — the backend layer converts absence to `""`,
  consistent with how missing user/portal joins already work).
- **Missing tests:** Task 1.5 has both offline tests (Q-7 for the
  query shape, L-4/L-5 for composition/tie-break) and is exercised
  live in V-1 (Group 5) — no untested layer.
- **Dependency problems:** Task 1.5 is correctly sequenced after Tasks
  1.1-1.4 (all `[x]`) and before the (now-revised) Task 2.2, which
  depends on it. No new file added, so no new `write_scope`/
  `CMakeLists.txt` entries needed — `timeZoneNamesForAccessLogIds` is
  declared in the already-in-scope `include/amico/Client.hpp` and
  defined in the already-in-scope `src/Client.cpp`/`src/ObjectQuery.cpp`.
- **Security or hardware impact:** None — read-only, no new write path.

**One accepted gap:** The new query shapes (Q-7) were not live-tested
against the real device before this amendment was finalized — the
session's live login had expired and no fresh credentials were on
hand. This is explicitly flagged (not silently accepted) in both
DECISION_LOG.md and tests.md's Test V-1, which now carries the first
live exercise of this join. Given the query shapes are structurally
identical to already-proven patterns (`buildUserGroupIdsBody`,
`buildCardCountBody`, etc.) and the field names are drawn directly
from a live-captured schema dump (not guessed), this residual risk is
judged acceptable to proceed past, rather than blocking on
re-establishing a device session solely to re-confirm a pattern this
codebase already relies on elsewhere.

**Verdict: PASS.** 0 new blocking issues. Resume execution at Task 1.5.

---

## Pass 3 — Re-confirmation after PLAN_DRIFT_DETECTED / git_sha rebaseline

Between Pass 2's PASS and execution, `eng workflow advance` hit
`PLAN_DRIFT_DETECTED` (stale `git_sha` baseline vs. two now-committed
prior plans' files — see DECISION_LOG.md for the full account). No
change was made to spec.md, tasks.md, or tests.md as part of resolving
this — only `plan.yaml`'s `planned_at.git_sha` was corrected, and two
commits were made (with the user's explicit go-ahead) to the two
already-completed, already-verified prior plans' pending files. This
is not a re-plan of this plan's own content, so this pass re-confirms
Pass 2's verdict rather than re-doing the full checklist: **PASS,
0 blocking issues**, unchanged.
