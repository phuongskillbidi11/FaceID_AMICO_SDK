# Decision Log — Giai đoạn 4: Frontend

---

## Decisions

### 2026-09-13 — Expected drift on `docs/src-map.md`: `KNOWN_HARNESS_BUG`, same category as every prior plan this session
**Context:** `eng plan drift` flags `docs/src-map.md` as changed since
this plan's `planned_at.git_sha`. Cause: Giai đoạn 3 edited it and, per
the standing "no commit" instruction, left it uncommitted. It's also
in THIS plan's own `write_scope` (will be extended further with
`frontend/` rows).
**Decision:** Treat as expected, benign, already-understood drift —
proceeding directly to Group 0 execution, matching every prior plan's
precedent this session.
**Reasoning:** Additive, not conflicting, with this plan's own planned
edits to the same file.
**Alternatives rejected:** Committing Giai đoạn 3's changes to clear
the drift — rejected, contradicts the still-standing "no commit"
instruction.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-13 — Plan Review pass 1 REJECT: `cpp-httplib`'s static-file-vs-route dispatch order was backwards in Task 1.2
**Context:** Plan Review read the actual installed `httplib.h` and
found `Server::routing()` checks the static-file mount BEFORE any
registered `GET`/`HEAD` route — the opposite of Task 1.2's original
claim. No practical route collision exists in this plan's actual scope
(no planned `frontend/` filename matches any `GET` route path), but
the stated rationale was factually wrong.
**Decision:** Corrected Task 1.2's text with the real order and an
explicit note on why no collision currently exists; marked Task 0.1
complete citing the Reviewer's own header-reading as the discovery
evidence (no need to redo it in Group 0); added an `image.onerror`
handler requirement to Task 2.5 per the Reviewer's non-blocking note.
Re-reviewed, PASS on pass 2.
**Reasoning:** Same discipline as every prior Plan Review this
session — a Reviewer's job is to catch exactly this kind of factual
error before Group 1 builds on a wrong assumption, even when the
practical impact turns out to be zero for the current scope.
**Alternatives rejected:** Leaving the backwards claim in place since
it "doesn't cause an actual bug right now" — rejected; a plan document
stating something factually wrong about a library's behavior is worth
correcting regardless of current practical impact, since it would
mislead future maintainers.
**Decided by:** Claude (Plan Reviewer role) → Claude (Planner role),
same session
**Status:** Active

---

### 2026-09-13 — Group 2 delegated to Codex (usage restored); found a genuine backend-API gap, not a frontend defect
**Context:** After the user asked twice why Codex wasn't being used
(Codex had hit a usage limit during Giai đoạn 2b and was never
re-checked before Giai đoạn 3), Codex was used for Group 2 (all 6
frontend files) once confirmed available again. While implementing the
Cards section of the Edit-user modal, Codex found that Giai đoạn 3's
backend has no route to list a user's existing cards — `AmicoUser`
only exposes `cardCount` (a number), not the card ids/values
themselves; only `POST .../cards` (add, returns a new `cardId`) and
`DELETE /cards/:cardId` (remove, by an already-known id) exist.
**Decision:** Accepted as a real, correctly-identified limitation
rather than inventing a workaround (e.g. guessing at a non-existent
list endpoint). The frontend can only track/display cards added during
the current page session (in-memory), with a clear note in the UI
explaining this. Recorded here as tech debt for a future backend
enhancement (a `GET /users/:id/cards` route), not fixed in this plan.
**Reasoning:** `amico_sdk`'s own `UsersApi` (Giai đoạn 2b) never
exposed a "list cards for a user" read method either — this traces
back to that phase's own scope, not something Giai đoạn 3's backend
uniquely lacks. Adding a new SDK+backend route now would be scope
creep for a frontend plan; better to surface the real limitation
honestly than hide it.
**Alternatives rejected:** Silently omitting the Cards section entirely
(rejected — Add/Remove by known id is still useful and fully
functional) — inventing a client-side cache that pretends to be
complete (rejected — would mislead the user into thinking all of a
user's cards are shown when only session-added ones are).
**Decided by:** Claude (orchestrator), based on Codex's own finding
during implementation
**Status:** Active — tech debt, not blocking this plan's completion.

---

### 2026-09-13 — Group 4's live verification deferred until after Giai đoạn 5 (real login + dynamic device targeting)
**Context:** Before Group 4's live-device approval was given, the user
requested a real login page + dynamic (per-login) device targeting —
scoped as a new plan, `phase5-real-login-dynamic-device`. This changes
how the frontend is used from the very first screen (a login form
replaces immediate access to the Users tab), and changes the backend's
connection model (no more fixed `AMICO_BASE_URL` env var at startup).
**Decision:** Defer Giai đoạn 4's Group 4 manual live-verification pass
until Giai đoạn 5 is implemented — verifying the current
(env-var-configured, no-login) flow now would test an interim state
about to be replaced, wasting a live-device verification pass on
something that won't reflect the final UX. Groups 0–3 (all code,
offline-verifiable work) remain complete and stand as-is.
**Reasoning:** Avoids redundant live-device testing of a UI flow that
will no longer exist once Giai đoạn 5 lands; the eventual verification
pass will cover both plans' behavior together, more efficiently.
**Alternatives rejected:** Running Group 4 now anyway — rejected, would
verify a login-less flow the user is actively asking to replace.
**Decided by:** Claude (orchestrator), based on the user's own
redirect toward Giai đoạn 5
**Status:** Active — Group 4 remains `[ ]` pending Giai đoạn 5's own
live verification, which will supersede it.
