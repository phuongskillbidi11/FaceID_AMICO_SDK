# Decision Log — [Feature Name]

> **Purpose:** Record every significant decision made during planning OR execution.
> Both the Planner (Claude) and Executor (Copilot) should add entries here.
> This file is read by Claude Code at the start of every future sprint to
> avoid revisiting closed decisions.
>
> **When to add an entry:**
> - A design alternative was rejected
> - An implementation approach changed mid-sprint
> - A dependency or library was chosen over an alternative
> - A scope item was added or removed during execution
> - A bug was found that changed the implementation strategy

---

## Decisions

### [YYYY-MM-DD] — [Short title]
**Context:** [What situation triggered this decision?]
**Decision:** [What was decided?]
**Reasoning:** [Why? What would have happened with the alternative?]
**Alternatives rejected:**
- [Alternative A] — rejected because [reason]
- [Alternative B] — rejected because [reason]
**Decided by:** Planner / Executor / User
**Status:** Active / Superseded by [later decision]

---

### [YYYY-MM-DD] — [Short title]
**Context:**
**Decision:**
**Reasoning:**
**Alternatives rejected:**
**Decided by:**
**Status:**

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_

---

### 2026-09-14 — Codex's execution + Claude's independent verification, Groups 1-2 + Task 3.1
**Context:** Codex implemented Tasks 1.1/2.1 (moved the face-image
section out of the "Facial" tab into a persistent `photoPanel`
sibling; factored the table's photo-rendering logic into a shared
`renderPhoto()` helper reused by both the table and the modal; reused
the existing `lockedFields` pre-save-lock mechanism unchanged; reduced
the tab set to General/Groups/Cards/PIN). Codex correctly left Task
2.1 as `[~]` rather than `[x]`, noting CSS layout can't be honestly
called "verified" without a live visual check even though it required
no device *contact* — a fair, transparent distinction, not a
contradiction.
**Decision:** Independently verified (not just trusting Codex's
report): re-ran `node --check` (PASS), re-ran all F-1/F-3/F-4 grep
checks myself (PASS), and performed a live visual session against the
real device confirming the photo panel renders the real photo,
persists across tab switches (screenshotted before/after), and only 4
tabs remain. Marked Task 2.1 and Task 3.1 `[x]` based on this.
**Reasoning:** Matches this project's established practice of
independently verifying Codex's work rather than reporting done on the
executor's word alone.
**Alternatives rejected:** Accepting Codex's `[~]` status as final
without live-checking it myself — rejected, inconsistent with
established practice.
**Decided by:** Claude (Planner/orchestrator)
**Status:** Active — Groups 1-2 and Task 3.1 complete and verified.
Task 3.2 (the one gated write action — pre-save lock + upload-after-
save on a disposable test user) not yet run this cycle; the operator's
own separate manual testing (creating real users "hinh sai"/"Man
City" and successfully uploading photos to them via their own browser)
is independent, additional real-world evidence the underlying
upload/lock mechanics already work correctly under the new layout,
even though it wasn't run as this plan's own formal Task 3.2.

---

### 2026-09-14 — User decided Task 3.2 is unnecessary; `eng verify` FAIL is `KNOWN_HARNESS_BUG`
**Context:** User explicitly said "vậy là đủ, không cần test thêm"
(that's enough, no more tests needed) when asked about running Task
3.2. Separately, `eng verify` flags 5 files as unexpected — all
uncommitted changes from the immediately-prior redesign plan
(2026-09-13), unrelated to this plan's own scope.
**Decision:** Task 3.2 marked `[ ]`/not-run by explicit user decision,
not an oversight. `eng verify`'s FAIL treated as the same benign,
already-understood `KNOWN_HARNESS_BUG` category as every prior plan
this session.
**Decided by:** User (Task 3.2) / Claude (orchestrator, verify FAIL)
**Status:** Active — plan complete as scoped.
