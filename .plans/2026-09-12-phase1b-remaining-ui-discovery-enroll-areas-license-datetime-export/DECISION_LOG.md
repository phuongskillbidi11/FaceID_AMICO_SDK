# Decision Log — Giai đoạn 1b: Hoàn thiện discovery còn thiếu

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

### 2026-09-12 — chrome-devtools-mcp MCP connection required a session restart
**Context:** The `chrome-devtools-mcp` MCP server failed to connect (`CONNECT_TIMEOUT` after 30s) when first needed for Group 2. Direct `npx chrome-devtools-mcp@latest --help` outside the MCP layer succeeded (it just needed to download the npm package fresh), but the MCP connection itself kept timing out even after the npx cache was warm, and there was no in-session way to force a reconnect.
**Decision:** User restarted Claude Code; on the fresh session the MCP server connected successfully and Group 2 proceeded normally.
**Reasoning:** MCP server connections are established once at client startup in this environment; there is no exposed retry mechanism mid-session.
**Alternatives rejected:** Falling back to manual (user-driven) browsing for this pass — not needed once the restart resolved the connection.
**Decided by:** User / Claude (orchestrator)
**Status:** Active

---

### 2026-09-12 — Credential entry: user explicitly instructed the agent to type them
**Context:** Unlike the C++ SDK's live smoke test (where Decision 7 of a prior plan required the human operator to type credentials directly, never the agent), this session's live *browser* discovery needed a login. The agent initially asked the user to type the credentials themselves into the visible (non-headless) Chrome window. The user responded "gõ luôn đi Admin/admin" (just type it in) — an explicit, in-conversation instruction to proceed this way for this specific session.
**Decision:** Filled the login form directly (username field was already pre-populated as "Admin"; password field filled with "admin"), per the user's explicit instruction. The password value was never echoed back in any agent text response, doc, or committed artifact.
**Reasoning:** This is a live, one-off browser session (not a shell command whose transcript persists as literally as an env-var export), and the user gave an explicit, current, in-context instruction — distinct from silently assuming it would be acceptable.
**Alternatives rejected:** Insisting the user type it themselves despite the explicit instruction otherwise — rejected as unresponsive to a clear, current user directive.
**Decided by:** User (explicit instruction) / Claude (orchestrator)
**Status:** Active

---

### 2026-09-12 — Task 3.1 delegated to Claude directly instead of Codex (command-line length limit)
**Context:** Attempted `eng tools invoke executor codex.execute` for Task 3.1 with the full gathered evidence (5 gaps' worth of findings) as the prompt argument. Windows rejected the command with "The command line is too long."
**Decision:** Wrote the `docs/ui-action-protocol-map.md` sections directly using Claude's own Edit tool instead of splitting the prompt or routing around the limit.
**Reasoning:** The task is prose synthesis of already-gathered, already-verified facts (not new code/logic), so Claude authoring it directly carries no more risk than Codex would, and avoids the overhead of prompt-splitting workarounds for a one-time doc-writing task.
**Alternatives rejected:** Splitting the prompt into multiple smaller Codex invocations (one per gap) — rejected as unnecessary process overhead for straightforward prose.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-12 — `eng verify` FAILed on this plan too, same `KNOWN_HARNESS_BUG` category (cross-plan working-tree noise, not this plan's own defect)
**Context:** `eng verify` reported `Verdict: FAIL` for this plan. The report shows this plan's own single tracked-file change (`docs/ui-action-protocol-map.md`) matched `write_scope` correctly — every "UNEXPECTED CHANGES outside write_scope" entry is instead a leftover **uncommitted** governance file from the sibling `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/` plan (its `DECISION_LOG.md`, `plan.yaml`, `role-state.yaml`, etc.), which is still sitting uncommitted per the user's explicit "no commit" instruction from that earlier plan's `KNOWN_HARNESS_BUG` discussion. None of this plan's own new files (screenshots, `newusers_js.network-response`, or this plan's own `.plans/` folder) appear in the report at all — they are untracked and `git diff --name-only <sha>` only shows already-tracked files, so they were never even evaluated against `write_scope` either way.
**Decision:** Record this as the same `KNOWN_HARNESS_BUG` category (see `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/DECISION_LOG.md`'s 2026-09-12 entry): `eng verify`'s git-diff-since-`git_sha` approach cannot distinguish "this plan's own changes" from "unrelated uncommitted state left in the same working tree by other work." Per the user's explicit instruction not to spend further time patching the Harness or chasing this loop, this FAIL is **not** further investigated or worked around here. This plan's actual technical completeness is evidenced directly by `tasks.md`/`tests.md` (all `[x]`/Pass, independently verified by Claude), not by this mechanical FAIL label.
**Impact:** Purely mechanical/state-bookkeeping, exactly like the prior instance — does not indicate any real defect in this plan's Enroll/Areas-Portals/License-Mode/Date-Time/Report-Export findings.
**Alternatives rejected:** Committing the sibling plan's leftover changes to clear the noise — rejected, out of scope for this plan and contradicts the explicit "no commit" instruction still in force.
**Decided by:** Claude (orchestrator), per user's standing instruction on `KNOWN_HARNESS_BUG` handling
**Status:** Active

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_
