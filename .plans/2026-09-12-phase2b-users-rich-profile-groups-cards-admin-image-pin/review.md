# Plan Review — Giai đoạn 2b: Users rich profile

**Reviewer role activated:** `eng adapter prompt plan-reviewer` (2026-09-12)

---

## Checklist

### Missing requirements
spec.md's Goal covers everything the user asked for (Groups/Cards/
Administrator/Face-Bio-count/Image/`hasPassword`, read+write, with the
password-exposure exclusion and enrollment deferral). No gap here.

### Incorrect assumptions — **BLOCKING**
spec.md's Background and tasks.md's Group 1 (Tasks 1.2, 1.3, and part of
1.7) state that the write payload shapes for **Cards**
(`cards` table `{id, user_id, value}`), **Administrator**
(`user_roles` table `{user_id, role}`), and **Image**
(`user_set_image`/`user_destroy_image`) are "already fully known" /
"already known from prior discovery" and therefore need no fresh
discovery — only Groups-membership (Task 0.3) and `hasPassword`
(Task 0.4) are gated behind Group 0.

I checked this claim against the actual evidence in the repo
(`docs/ui-action-protocol-map.md`, `docs/amico-protocol-map.md`,
`docs/amico-endpoints.md`, `docs/amico-auth-flow.md`) via direct grep,
not the plan's own summary of itself:

- **Cards write:** no `cards` table write payload is documented
  anywhere. `docs/amico-protocol-map.md:99` only lists `cards` as one
  name in the generic query-engine's known table list — that is not a
  confirmed write shape.
- **Administrator write:** no `user_roles` write payload is documented
  anywhere. No file mentions `user_roles` at all.
- **Image write:** only the **read** path is confirmed
  (`GET /user_get_image.fcgi?user_id=<id>`, `LIVE_CONFIRMED` in
  `docs/amico-endpoints.md:42` and `docs/amico-auth-flow.md:98`). The
  **write** commands `user_set_image`/`user_destroy_image` do not appear
  in any doc file — not command name, not wire format (multipart vs.
  base64-in-JSON vs. raw-binary POST), not success/error shape. This
  also has a load-bearing technical consequence Group 1 doesn't
  currently account for: `IHttpTransport`/`HttpRequest` (`src/http/HttpTransport.hpp`)
  only has a plain `std::string body` + header list — workable for a
  binary upload, but only once the actual wire format (e.g. a multipart
  boundary, or a JSON envelope with base64) is known. Task 1.7 as
  written would have an Executor invent this shape rather than read it.

This is exactly the failure mode this project's own discipline exists
to prevent — the same class of gap that caused Giai đoạn 2's Group 5
attempt #1 (HTTP 400 from an unverified array-wrap assumption). The
difference here is these three assumptions are currently **not gated
behind any discovery task at all**, so if uncaught they would surface
as a live-test failure (or worse, a guessed implementation that never
gets live-tested against Card/Administrator/Image at all, since Group
5 as scoped does live-test these paths).

**Required fix (Planner):** Add discovery tasks to Group 0 (or a new
Group 0b) for:
1. Card add/remove — find and read whatever JS class handles the Users
   edit modal's "Cards" tab (not yet fetched in this project), confirm
   the actual command name(s) and payload.
2. Administrator flag write — find and read whatever JS handles the
   "Administrator" checkbox's save path, confirm command name(s) and
   payload (is it really `user_roles`, or something else?).
3. Image write — find and read `newusers.js`/`user.js`'s image-upload
   handler (the "Image" field's own Save/Remove logic), confirm
   `sendFile`'s actual wire format for this specific command (multipart
   boundary construction? base64-encoded JSON field? raw octet-stream?)
   and the exact command name(s) for set/remove.

Until these three are evidenced the same way Task 0.3 (Groups) and
Task 0.4 (`hasPassword`) already are, Tasks 1.2/1.3/1.7(image) and
their corresponding Group 5 live sub-tasks (5.1/5.2 for Cards/Image,
5.3 for Administrator) rest on unverified assumptions.

### Architecture inconsistencies
None found. The new `AmicoUser` fields (Task 1.6) correctly avoid
reopening Giai đoạn 2's `DECISION_LOG.md` amendment (user_type_id/
begin_time/end_time stay read-only, untouched by this plan). The
dedicated, non-mergeable `buildPasswordSetBody` (Task 1.4, deliberately
not added to `kUserWritableFields`) correctly preserves the structural
boundary from `feedback_never_expose_password_hash.md` — a caller
cannot reach password-setting through the ordinary `update()` path.

### Missing edge cases (tests.md)
Minor, non-blocking: Task 2.3 says "success + at least one failure path"
generically for every new method, but doesn't call out two specific
edge cases worth naming explicitly so the Executor doesn't skip them:
- Removing a card that does not belong to the target user (cross-user
  removal attempt) — should this be rejected client-side, or is it the
  device's job? Currently undefined.
- `list()`/`get()`'s new per-user round-trip queries (groupIds,
  cardCount, hasPassword, etc.) — no test currently asserts correct
  aggregation across multiple sub-queries, or behavior when one
  sub-query fails (does the whole `get()` throw, or degrade partially?).
  This is a real behavior decision Task 1.7 doesn't specify.

Recommend the Planner add these two as explicit sub-bullets under Task
2.3, but this alone would not block approval — only the Incorrect
Assumptions finding above does.

### Missing tests
Covered adequately once the edge cases above are named explicitly.

### Dependency problems
None beyond the Incorrect Assumptions finding above — once Group 0 is
expanded to cover Cards/Administrator/Image, Group 1's dependency
structure (depends entirely on Group 0's findings) is sound and
consistent with this project's established pattern.

### Security or hardware impact
Well handled: `setPassword`/`setAdministrator` correctly isolated into
their own Group 5 sub-tasks with independent confirmation gates, no
raw-credential read path anywhere, image upload live-test uses
user-supplied disposable sample images. No physical-access-control risk
identified beyond what's already flagged in spec.md's Risks section
(test-safe group id must be operator-confirmed before Task 5.1).

---

## Verdict (pass 1): **CHANGES REQUESTED**

**Blocking:** Expand Group 0 with discovery tasks for Card write,
Administrator write, and Image write payload shapes (currently assumed
"already known" without any actual documented evidence backing that
claim). Everything else in the plan is sound and may stand once this is
addressed.

**Non-blocking suggestion:** name the two edge cases above explicitly
under Task 2.3.

**Reviewed at:** 2026-09-12

---

## Re-review (pass 2) — 2026-09-12

Planner revised `tasks.md`: added Task 0.4 (Card write), Task 0.5
(Administrator write), Task 0.6 (Image write + wire format), renumbered
`hasPassword` to Task 0.7 and the documentation task to Task 0.8.
Confirmed by direct read:
- Task 1.2, 1.3, and 1.7 no longer assert specific command/table names
  — each now explicitly defers to the corresponding Task 0.4/0.5/0.6
  finding.
- `tests.md`'s Test F-1 updated to check all four write shapes plus
  `hasPassword`, not just Groups.
- `DECISION_LOG.md` records both the reject reason and an explicit
  amendment note that spec.md's Decision 4/5 command names are
  provisional pending Group 0 (spec.md itself correctly left unedited,
  per this project's established convention).
- Re-checked: no remaining text in `tasks.md` asserts Cards/
  Administrator/Image write shapes as already-confirmed fact.

The blocking issue from pass 1 is resolved. No new issues found on
re-review — architecture, security gating (setPassword/setAdministrator
still isolated with independent confirmation), and test coverage remain
sound as previously assessed.

## Verdict (pass 2): **APPROVED**

**Reviewed at:** 2026-09-12

---

## Re-review (pass 3) — 2026-09-13, mechanical re-entry after `KNOWN_HARNESS_BUG`

`eng workflow advance` cycled this plan back to `PLANNED` due to the
same self-induced `PLAN_DRIFT_DETECTED` pattern already documented in
this plan's own `DECISION_LOG.md` (write_scope watchlist flags this
plan's own already-completed edits as "drift" against the
`planned_at.git_sha` baseline) — not a real design change. All of
Groups 0–5 are complete and live-verified (see `sprint-summary.md`);
tasks.md/tests.md fully reflect the final, tested state. No new
findings on re-review; nothing in the actual implementation changed
since pass 2 that would reopen any prior finding.

## Verdict (pass 3): **APPROVED**

**Reviewed at:** 2026-09-13
