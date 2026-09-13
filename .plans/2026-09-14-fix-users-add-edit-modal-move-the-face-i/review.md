# Plan Review — Fix: face-image preview belongs in a persistent side panel

**Reviewer:** Claude (Plan Reviewer role)
**Date:** 2026-09-14
**Verdict:** APPROVED (pass 1)

---

## Verification against actual source (not assumed)

- `frontend/users.js` re-read in full immediately before writing
  `tasks.md` (not from memory of the prior redesign plan) — confirmed:
  tab array is exactly `["General", "Groups", "Cards", "PIN",
  "Facial"]` (line 123); the face-image section is built via
  `section("Face image", "Facial")` (line 242), which routes it into
  `panels.get("Facial")` — i.e. genuinely tab-gated today, matching
  spec.md's stated root cause exactly, not assumed.
- `lockedFields`/`section()`'s disable-until-save mechanism (lines
  158-163, unlock loop at 210-211) confirmed to be the exact,
  reusable mechanism Task 1.1 asks to extend to the new photo panel —
  no new lock mechanism needs to be invented.
- The Users table's own photo-cell rendering (`loadUsers()`, lines
  60-68: `placeholder()` closure, `image.addEventListener("error",
  placeholder, {once:true})`, `image.src = user.imageUrl`) confirmed
  as the exact pattern Task 1.1 asks to factor into a shared
  `renderPhoto()` helper — reading this code directly (not assuming
  its shape) confirms the refactor is straightforward: same three
  lines, parameterized by a container and a user object.
- `frontend/style.css`'s `.thumbnail`/`.placeholder` classes (lines
  78-80) confirmed to exist with the exact sizing/token pattern Task
  2.1 says to reuse (not invent new tokens) — `var(--radius)`,
  `var(--hover)`, `var(--muted)` are all real custom properties
  already defined in this file's `:root` block.
- The existing `@media (max-width: 760px)` breakpoint (confirmed
  present in `style.css`) is the one Task 2.1 correctly says to reuse
  rather than introduce a second breakpoint.

No incorrect assumption found — this plan's technical claims all trace
directly to source just re-read, consistent with the discipline
established across every prior plan this session.

---

## Checklist coverage

- **Missing requirements:** none — spec.md's Goal (persistent photo
  panel visible across all tabs, matching the real device) is fully
  covered; Decision 2's "show a real preview, not just an upload
  control" is a genuine, correctly-scoped feature addition, not scope
  creep, since it's directly observed in the same live-capture
  evidence already on file.
- **Incorrect assumptions:** none found (see verification above).
- **Architecture inconsistencies:** none — reuses the exact
  `lockedFields` pre-save-lock pattern and the exact photo-placeholder
  pattern already proven elsewhere in this same file, rather than
  introducing parallel mechanisms. Correctly scoped as frontend-only
  (Decision 3), consistent with the already-implemented and verified
  `GET/PUT/DELETE /users/:id/image` routes needing no change.
- **Missing edge cases:** Task 3.1/Test L-1 explicitly covers both the
  has-photo and no-photo cases; Task 3.2/Test L-2 explicitly covers
  the pre-save-locked → post-save-unlocked → upload-updates-preview
  sequence, matching the exact sequence Task 6.2 of the prior redesign
  plan already validated for Groups/Cards/PIN — applying the same
  rigor to the photo panel is appropriate, not redundant.
- **Missing tests:** Test F-3/F-4 specifically guard against the two
  most likely implementation mistakes (duplicating the photo-render
  logic instead of sharing it; inventing a second lock mechanism
  instead of reusing `lockedFields`) — good, targeted coverage.
- **Dependency problems:** none — Group 1 (JS restructure) before
  Group 2 (CSS) before Group 3 (live verification) is sound ordering.
- **Security/hardware impact:** none new — this plan adds no new
  backend route, no new write action; Task 3.2's write action
  re-exercises already-approved-pattern calls (create/delete/image-
  upload) under a relayout, not a new capability, and is still
  correctly gated behind a fresh write-tier approval per this
  project's standing discipline.

No blocking issues. Ready for execution.
