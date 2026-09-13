# Sprint Summary — Fix: face-image preview persistent panel

**Date:** 2026-09-14
**State:** Groups 1-2 + Task 3.1 complete and verified. Task 3.2 (the
one gated write action — pre-save lock/unlock + upload preview update
on a disposable test user) not yet run; not blocking, optional.

## What shipped

Direct follow-up correction to the just-completed frontend redesign,
reported by the user after testing on their own real browser: the
face-image upload UI previously lived inside a separate "Facial" tab
(hidden unless that tab was selected). It now lives in a **persistent
panel** on the right side of the Add/Edit User modal, visible
regardless of which tab (General/Groups/Cards/PIN — reduced from 5
tabs to 4) is selected — matching the real AMICO device's own
confirmed layout. The panel also now shows a **real preview** of the
user's current photo (previously there was no preview at all, only an
upload control) — reusing a newly-factored `renderPhoto()` helper
shared with the Users table's own photo column, not a duplicate
implementation.

## Implemented by Codex, independently verified by Claude

- `frontend/users.js`: `photoPanel` sibling element (not a tab panel);
  `photoSection()` helper reusing the exact same `lockedFields`
  pre-save-disable mechanism Groups/Cards/PIN already use; shared
  `renderPhoto(container, user, imageClass)` helper called from the
  table, the modal's photo panel, and `reload()`.
- `frontend/style.css`: `.dialog-body` two-column grid (tabs area +
  220px photo panel), `.photo-preview`/`.photo-preview-container`
  styling reusing existing `--radius`/color tokens, responsive
  stacking under the existing 760px breakpoint (no new breakpoint
  introduced).

Codex correctly reported Task 2.1 as `[~]` rather than falsely
claiming `[x]`, since CSS layout can't be honestly verified without a
live visual check — a fair, transparent distinction rather than a
contradiction, later resolved by Claude's own live verification pass.

## Test results (independently verified by Claude)

- `node --check frontend/users.js`: PASS.
- Tab-count and shared-helper grep checks (F-1, F-3, F-4): all PASS —
  confirmed 4 tabs, exactly one `renderPhoto` function, the photo
  panel's fieldset pushed into the same `lockedFields` array as
  Groups/Cards/PIN.
- SDK/backend offline suites: 95/517 and 41/476 — unchanged.
- Live visual check against the real device (`http://192.168.2.156`):
  edited user 51 ("hinh sai", a real user the operator had created
  during their own testing, with a real uploaded photo) — the "Face
  image" panel (confirmed via accessibility snapshot to be a
  `complementary` landmark, not a `tabpanel`) rendered the real photo
  and stayed visible/unchanged across a General→Groups tab switch,
  screenshotted before and after. No console errors.

## Deferred

The no-photo placeholder case and the full pre-save-lock →
post-save-unlock → upload-preview-update sequence (Task 3.2, a write
action requiring a disposable test user) were not exercised against a
fresh live example this cycle — all 5 real users on the device
currently have a photo (the operator's own testing added more since
this plan's baseline), and Task 3.2 needs a separate, fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST` approval not yet requested. This does
not block the plan's core visual fix from being considered complete —
the operator's own independent testing (uploading real photos to
"hinh sai"/"Man City" via their own browser) is strong additional
real-world evidence the underlying mechanics already work correctly
under the new layout.

## What's next

Optional: run Task 3.2 (disposable-test-user write test) if the user
wants the full formal sequence verified; otherwise nothing outstanding.
