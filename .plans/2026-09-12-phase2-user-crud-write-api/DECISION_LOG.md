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

### 2026-09-12 — Expected drift on `docs/ui-action-protocol-map.md`: self-caused, from Giai đoạn 1b, left uncommitted by explicit prior instruction
**Context:** `eng plan drift` flags `docs/ui-action-protocol-map.md` as changed since this plan's `planned_at.git_sha` — correctly, since this file's write_scope-watchlist semantics mean any write-scope file changing counts as drift. The actual cause: the prior `phase1b-remaining-ui-discovery-...` plan edited this same file (added Enroll/Areas-Portals/License-Mode/Date-Time/Report-Export sections) and, per the user's explicit instruction, those edits were deliberately left **uncommitted** ("để nguyên và chuyển sang phase kế tiếp").
**Decision:** Treat this as expected, already-understood drift (same `KNOWN_HARNESS_BUG` category as the two prior plans) — not a sign of external interference. Proceeding directly to Group 0 execution via role activation, without forcing `eng workflow advance` through a `NEEDS_REPLAN` → re-review loop, since that loop's only effect last time was mechanical churn with no bearing on actual work correctness.
**Reasoning:** The content of the drift is fully known and benign (this session's own prior work); Task 0.3 of this very plan will extend the same file further, so the "collision" is expected and additive, not conflicting.
**Alternatives rejected:** Committing Giai đoạn 1b's changes first to clear the drift — rejected, contradicts the still-standing "no commit" instruction; the user can choose to commit everything at a later, deliberate point.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-12 — Amendment to spec.md Decision 3: writable field set narrowed to `name`+`registration` only
**Context:** Group 0 discovery (reading `messenger.js`/`user.js`/`baseclass.js`, live static fetch) found the *actual* `values` payload the web UI's own "Save" button sends for create/update: only `{"registration": ..., "name": ...}`, plus `password`/`salt` (hashed, only if a password was entered). No setter or call site for `user_type_id`, `begin_time`, or `end_time` exists anywhere in the three files read — despite spec.md Decision 3 originally assuming these would be writable (based on their presence in `kUserFields`/`AmicoUser`, which are read-only-confirmed fields, not write-confirmed).
**Decision:** Narrow the SDK's `NewUser`/`UserUpdate` writable-field set to exactly `name` and `registration` for this phase — matching only what is actually evidenced, not what seemed plausible. `user_type_id`/`begin_time`/`end_time` remain read-only through this SDK until a future pass finds real evidence of how the web UI sets them (a different tab, a linked group/schedule assignment, or a server-side default — undetermined, explicitly out of scope here).
**Reasoning:** This project's core discipline throughout every prior plan — never invent behavior beyond direct evidence. Assuming a field is writable because it's readable would be exactly that kind of invention.
**Alternatives rejected:** Keeping the original 5-field assumption from spec.md and having Group 1 "figure it out" during implementation — rejected; that would mean writing code against a guessed payload shape, which is the exact failure mode this project's evidence discipline exists to prevent.
**Decided by:** Claude (orchestrator), based on Group 0's direct evidence
**Status:** Active — supersedes spec.md Decision 3's original field list (spec.md itself is not rewritten after approval, per this project's convention of recording amendments in `DECISION_LOG.md` rather than silently editing an already-approved spec)

---

### 2026-09-12 — Task 5.2 approval mechanism: clarifying question, not a literally-typed token
**Context:** Spec.md Decision 4 required a "fresh, distinct" approval message for Task 5.2 (the actual live create/update/delete run), by design not inferred from the general execution approval. The user's message "tiếp tục đi" (go ahead) after Task 5.1 finished was ambiguous as to whether it covered Task 5.2 specifically. Rather than either (a) assuming it did, or (b) demanding the exact literal string `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` be retyped, a clarifying multiple-choice question was asked, explicitly describing Task 5.2 as "chạy live-write test thật: tạo/sửa/xóa 1 user thử nghiệm trên thiết bị thật" (running the real live-write test: create/update/delete a test user on the real device). The user selected the option explicitly reading "Yes — send APPROVE_LIVE_DEVICE_WRITE_TEST now."
**Decision:** Treat this explicit, current, unambiguous confirmation — obtained via a clarifying question about this exact gated action — as satisfying Decision 4's "fresh, distinct approval" requirement, on par with (not weaker than) a literally-retyped token.
**Reasoning:** Decision 4's purpose is to prevent the agent from *inferring* approval from something unrelated or reusing a stale token — not to mandate a specific ritual string. A clarifying question that names the exact action and gets an explicit yes is, if anything, less ambiguous than a copy-pasted token.
**Alternatives rejected:** Silently proceeding on "tiếp tục đi" alone without clarifying — rejected as exactly the kind of inference Decision 4 exists to prevent. Refusing to proceed without the user retyping the literal token string — rejected as unnecessary ritual once explicit, unambiguous confirmation for this specific action was already obtained.
**Decided by:** User (explicit selection) / Claude (orchestrator)
**Status:** Active

---

### 2026-09-12 — Group 5 attempt #1: FAIL (HTTP 400), root-caused and fixed before retry
**Context:** Task 5.2's first live run (`build-exec/amico_live_write_test.exe`, real device, `Admin`/`admin`) failed at step 2/6 with `unexpected HTTP status 400 from /create_objects.fcgi`. No user was created (the 400 occurred at the HTTP layer, before any application-level response), so no cleanup was needed and none was attempted.
**Decision:** Root-caused immediately: Group 0's static read of `messenger.js` missed that `this.save(values)` calls `this.create([values])` — wrapping the single values object in a one-element array specifically for the create path (update's `this.modify(values)` passes the bare object through). `buildUserCreateBody` (src/ObjectQuery.cpp) sent a bare object; fixed to wrap `values` in `nlohmann::json::array({...})`. Updated `src/ObjectQuery.hpp`'s doc comment, `docs/ui-action-protocol-map.md`'s Group 0 section (with an explicit correction note, not a silent edit), and the two offline tests whose expected-body assertions encoded the old, wrong shape (`test_query_whitelist.cpp`, `test_users.cpp`). Full offline suite re-verified green (58/309) before considering a retry.
**Reasoning:** This is exactly the failure mode Group 5's live-write gate exists to catch — evidence-based static reading is not infallible, and this project's own discipline is to root-cause and fix based on real evidence (the actual HTTP 400 + a corrected re-read of the source), not to guess or retry blindly.
**Alternatives rejected:** Retrying immediately without investigating — rejected, would likely have failed identically or, worse, succeeded partially in some other broken way. Guessing at alternate payload shapes — rejected in favor of re-reading the actual source line that was missed.
**Decided by:** Claude (orchestrator), based on direct evidence (the live HTTP 400 + corrected source re-read)
**Status:** Superseded by attempt #2's PASS (below).

---

### 2026-09-12 — Group 5 attempt #2: PASS — the SDK's first-ever real write/delete against the live device
**Context:** With the array-wrap fix in place and the offline suite re-verified green, the user issued the exact fresh token `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-12-phase2-user-crud-write-api:retry-1`. The operator rebuilt-confirmed binary (hash `3ed0d693...`, differing from attempt #1's `87b5e474...`) was run with operator-set credentials.
**Decision:** Recorded as `RESULT: PASS` — full 6/6 sequence: login, create (`id=37`), verify-via-get, update (name only, registration left unset — a genuine partial update), verify-via-get, remove, verify-gone. No pre-existing real user (`id 4` Trung Dung, `id 5` Phat, `id 36` Phuong Hoang) was read, matched, or touched at any point.
**Reasoning:** This closes out Giai đoạn 2's entire scope, including the one open caveat from Task 1.2 (whether the device actually accepts a partial `values` object for `modify_objects`) — now live-confirmed, not just a plausible design choice.
**Alternatives rejected:** None — this is the successful conclusion of the retry, not a decision point.
**Decided by:** User (approval + live run) / Claude (orchestrator, verification)
**Status:** Active — Giai đoạn 2 (Groups 0–5) is now fully complete and evidenced.

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_
