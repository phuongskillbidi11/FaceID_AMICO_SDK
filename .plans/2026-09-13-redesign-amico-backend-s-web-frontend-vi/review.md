# Plan Review — Redesign the web frontend to match the real AMICO device's look and feel

**Reviewer:** Claude (Plan Reviewer role)
**Date:** 2026-09-13
**Verdict:** APPROVED (pass 1, after a self-caught correction incorporated before this review)

---

## Verification against actual source (not assumed)

- `frontend/index.html`, `frontend/style.css`, `frontend/users.js`
  read in full directly (not summarized from memory) before writing
  `tasks.md` — confirmed: current `<nav>` uses `data-tab`/`aria-
  controls` attributes `app.js` depends on (Task 2.1/Test F-3 targets
  these exact attributes correctly); `login.js` reads `login-view`/
  `login-form`/`login-device`/`login-username`/`login-password`/
  `login-remember`/`login-submit` ids (Task 2.2/Test F-3 targets these
  exactly); `users.js`'s current structure is a plain inline `addForm`
  plus a separate `openEditor(id)` `<dialog>` with Groups/Cards/Face
  image/Administrator-and-PIN fieldsets (Task 3.2's described unification
  plan is an accurate description of the actual code being changed, not
  a guess).
- **Real gap caught during the Planner's own pre-review self-check**
  (disclosed transparently, not hidden): Task 3.1 (and Task 1.1's font
  choice) originally assumed Font Awesome/Google Fonts were "already
  an existing convention" in this project. A direct `grep` across
  `frontend/*.html` and prior plan docs found **zero** existing CDN
  references — this project's frontend has always been dependency-free
  (Giai đoạn 4's own spec.md Decision 1: "no framework, no build
  step"). Both tasks and spec.md Decision 5 were corrected to use
  inline SVG icons and a `Roboto, system-ui, sans-serif` fallback
  stack instead of any external CDN, before this review was recorded
  — exactly the kind of factual correction this checklist exists to
  catch, caught here by the Planner itself rather than needing a
  reject/fix/re-review cycle.
- Live-capture evidence (`artifacts/live_capture/theme_default_css.
  network-response`, `login_css.network-response`, plus the
  `getComputedStyle` values captured directly this session: `#0057B7`,
  `#002D56`, gradient `52.62deg` `#003087`→`#0057B7`, `Roboto,
  sans-serif` `13px`) is genuine live evidence, not invented — Task
  1.1's color/font tokens trace directly to it.
- Confirmed the real device's Add/Edit modal tab set and lock behavior
  via a live, read-only screenshot this session (`General | Groups |
  Cards | Time Zones | PIN | Facial`, with the exact footnote "(*)
  Save the user to enable editing of all fields") — Task 3.2's plan to
  build 5 tabs (omitting Time Zones, which this project doesn't
  implement) and reuse that exact footnote text is evidence-backed,
  not guessed, and the omission is explicitly justified rather than
  silently different.

---

## Checklist coverage

- **Missing requirements:** none — spec.md's Goal (visual + structural
  match, no functional change, no trademark reuse) is fully covered by
  Groups 1-5's scope; Group 6 correctly separates the read-only visual
  check from the one gated write action.
- **Incorrect assumptions:** the Font-Awesome/Google-Fonts assumption
  was caught and corrected before this review (see above) — no other
  incorrect assumption found against the actual current source.
- **Architecture inconsistencies:** none — Decision 3's "no placeholder
  nav entries for unimplemented areas" is consistent with `docs/
  api-roadmap.md`'s own separation of implemented vs. planned vs.
  discovery-pending sidebar items; Task 3.2's tab-lock design is
  consistent with the real device's own confirmed behavior, not an
  invented "better" UX.
- **Missing edge cases:** Test F-3 explicitly protects every id/
  attribute `app.js`/`login.js` currently depend on, preventing a
  silent breakage of already-working session/tab logic during the
  visual restructure — a real risk for this kind of "restyle without
  breaking function" plan, correctly covered.
- **Missing tests:** every Group 1-5 change has a corresponding Group
  6/tests.md check; the one write action (Test L-2) is correctly
  isolated behind its own gate, distinct from the read-only Test L-1.
- **Dependency problems:** none — task ordering (tokens → shell →
  modal → minor adjustments → docs → verification) is sound.
- **Security/hardware impact:** this plan touches no backend route, no
  new request shape, and no new external network dependency (the
  Font-Awesome/Google-Fonts correction actively removed what would
  have been this frontend's first-ever external CDN call). The one
  live write action (Test L-2) is correctly gated behind a fresh
  write-tier approval, matching every prior live-write test's
  discipline this project has followed.

## Non-blocking notes

- Task 2.2's footer-copyright wording is left as a judgment call for
  the Executor rather than fully specified — reasonable, since
  inventing a fake company name would be its own small integrity
  problem; the task correctly flags this as needing operator/Planner
  judgment rather than silently picking something.
- The exact `--success` green hex wasn't independently re-verified
  live (Task 1.1 notes this honestly — "confirm exact hex... don't
  invent one if it isn't [available]") — acceptable, since the ADD
  button's green is a minor decorative detail, not a claim requiring
  the same rigor as the primary brand colors already confirmed.
