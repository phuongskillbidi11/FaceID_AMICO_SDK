# Spec — Fix: face-image preview belongs in a persistent side panel, not a separate tab

---

## Goal

In the real AMICO device's Add/Edit User modal, the face-image preview
(a photo box, or a gray placeholder silhouette when none is set) plus
its File/Remove controls sit in a **persistent panel on the right side
of the modal**, visible no matter which tab (General/Groups/Cards/
Time Zones/PIN/Facial) is currently selected — confirmed by this
session's own live screenshot of the real device's modal (`captures/
screenshots/` from the discovery pass, and directly re-observed live
again this session). Our just-shipped redesign instead put the face
image controls inside their own separate "Facial" **tab**, so the
photo is hidden unless that specific tab is selected — a real
deviation from the actual reference evidence, reported directly by the
user after testing on their own real browser.

**Done looks like:** Opening Add/Edit User shows an image preview
(the real photo if the user has one, or a placeholder if not) plus
File/Remove controls in a panel that stays visible across every tab —
matching the real device's own layout — while General/Groups/Cards/PIN
remain a 4-tab set exactly as already shipped (no "Facial" tab
anymore, since its one piece of content moves to the persistent
panel).

---

## Background

This is a direct follow-up correction to
`.plans/2026-09-13-redesign-amico-backend-s-web-frontend-vi` (just
completed and verified). That plan's Task 3.2 built a 5-tab modal
(General/Groups/Cards/PIN/Facial), placing the face-image section
inside the "Facial" tab. Re-checking the actual live-capture evidence
from that same plan's own discovery pass shows the real device's photo
box is **not** tab-gated — it is a persistent panel next to the
tabbed form, visible on every tab including General. This was a real
implementation gap in that plan's Task 3.2, not something to guess at
now — fixed here directly from the same evidence already on file.

---

## Design decisions

### Decision 1 — Face-image panel moves out of a tab, into a persistent side panel
- **Chosen:** Restructure the modal's layout into two regions: a left
  region (tab bar + the currently-selected tab's panel — now 4 tabs:
  General/Groups/Cards/PIN) and a right region (a persistent `<div>`
  containing the photo preview + File/Remove controls), shown
  side-by-side on wide viewports and stacked on narrow ones (matching
  this project's existing responsive breakpoint convention already in
  `style.css`). The photo panel is visible regardless of which tab is
  selected, exactly like the real device.
- **Why:** Matches the real device's own confirmed layout; also
  removes the confusing extra click-through (having to find/select a
  separate "Facial" tab) the user just reported.
- **Rejected alternatives:** Keeping "Facial" as a tab but adding a
  *second*, duplicate preview elsewhere — rejected, would show the
  photo twice and contradict the real device's actual single-panel
  layout.

### Decision 2 — Show an actual image preview, not just an upload control
- **Chosen:** The persistent panel shows an `<img>` of the user's
  current photo (via the existing `GET /users/:id/image` route,
  already proxying real bytes — no backend change needed) when one
  exists, or a placeholder box when it doesn't — matching the real
  device's own gray placeholder-silhouette behavior. This is a genuine
  small feature gap beyond just the tab-vs-panel issue: today's
  Edit modal has no preview of the *current* photo at all, only an
  upload control — the real device shows the existing photo.
- **Why:** Directly observed in the real device's own modal (a visible
  photo/placeholder box, not just a bare upload button) — this is
  what "matching the real interface" concretely requires here, not an
  invented enhancement.
- **Rejected alternatives:** Leaving the panel as upload-only text with
  no preview — rejected, doesn't match the confirmed reference and
  leaves the operator unable to see what photo (if any) is already on
  file without leaving the modal.
- **For a brand-new, unsaved user** (`id === null`): the photo panel
  shows the placeholder only, with its File/Remove controls disabled
  — consistent with Groups/Cards/PIN's existing pre-save lock, since
  there is no `id` yet to attach an image to.

### Decision 3 — No backend or protocol change
- **Chosen:** Purely a frontend layout fix. `GET /users/:id/image`,
  `PUT /users/:id/image`, `DELETE /users/:id/image` are already
  implemented and already live-verified (Giai đoạn 5 / the
  photo-display-fix plan) — reused as-is.
- **Why:** The gap here is presentation-only; no new device protocol
  or backend route is needed.

---

## Scope

### In scope
- `frontend/users.js`: move the face-image section out of the
  "Facial" tab into a persistent panel; add an `<img>` preview of the
  current photo (reusing `user.imageUrl`, already returned by `GET
  /users/:id`); reduce the tab set to General/Groups/Cards/PIN.
- `frontend/style.css`: two-column modal layout (tab area + persistent
  photo panel), responsive stacking on narrow viewports, placeholder
  box styling reusing the existing `.placeholder`/`.thumbnail` pattern
  already used in the Users table.

### Out of scope
- Any backend/SDK change — the image routes are already correct and
  already verified; this plan only touches how the existing routes are
  presented.
- Camera-capture (the real device's own "Camera" button, which uses
  the operator's PC webcam) — not implemented in this project, not
  part of this fix; only File-upload and Remove are in scope, matching
  what already exists today.
- Any other tab's content or behavior (Groups/Cards/PIN keep their
  exact current logic) — only the layout housing them changes (from a
  5-tab bar to a 4-tab bar plus the persistent panel alongside it).

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `frontend/users.js` | Modify | Move face-image UI into a persistent panel; add current-photo preview; reduce tabs to 4 |
| `frontend/style.css` | Modify | Two-column modal layout + placeholder/preview styling |

---

## Risks and unknowns

- None blocking — this is a narrow, evidence-backed layout correction
  with no protocol/backend uncertainty.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Directly answers the user's own reported gap |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 8/10 | 3 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 2 files only |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
