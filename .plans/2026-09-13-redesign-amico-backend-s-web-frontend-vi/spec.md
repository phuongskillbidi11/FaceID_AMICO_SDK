# Spec — Redesign the web frontend to match the real AMICO device's look and feel

---

## Goal

Right now `frontend/` is functional but plain (generic buttons, a flat tab bar, no visual identity). This sprint makes it visually match the real device's own web UI (`http://192.168.2.156/`) — same color palette, typography, sidebar navigation shell, table styling, and a tabbed Add/Edit User modal — **without functional changes** to what already works, and **without reusing HID's actual trademarked logo/branding**.

**Done looks like:** Opening our web side-by-side with the real device's web, a user immediately recognizes the same visual language (colors, layout, modal structure) — while our own name/wordmark (not "HID"/the real Amico logo) is used for branding.

---

## Background

The user asked directly: browse the real device's web, read its actual format, and rebuild our frontend to look the same. A live, read-only session captured the real CSS values, layout structure, and the Add/Edit User modal's tabbed design (see Design Decisions below for the exact evidence). This same redesign also resolves a real UX confusion already reported this session: our current two-step "Add User (name only) → separate Edit modal for everything else" flow felt broken to the user, who expected an image/group/card control right in the Add form — because the real device shows **all** fields in one tabbed modal from the start, with the extra tabs simply disabled until the initial Save. Matching that exact pattern fixes both the visual gap and this UX confusion at once.

---

## Design decisions

### Decision 1 — Adopt the real device's exact color/typography tokens, evidence-based
- **Chosen:** Extracted directly from the live device (not guessed): base font `Roboto, sans-serif` at `13px`; primary blue gradient `linear-gradient(52.62deg, #003087 20.39%, #0057B7 82.87%)` (login left panel); solid brand blue `#0057B7` (top header bar, footer bar); dark navy accent `#002D56` (primary buttons: Log In, Save, PRINT); `4px` border-radius on buttons/inputs; light gray sidebar background (`#ffffff`/near-white) with a blue left-border accent on the active nav item; red/pink (`#e74c3c`-family) for destructive actions and validation errors; green for confirm/add actions.
- **Why:** These are the actual values the real device uses (captured via `getComputedStyle` and CSS network capture, saved to `artifacts/live_capture/theme_default_css.network-response` and `login_css.network-response`), not an approximation — matches the user's explicit ask to read the real format.
- **Rejected alternatives:** Freehand "inspired by" color picking — rejected, the user asked for the actual format, and exact values were available to capture directly.

### Decision 2 — No HID/real Amico logo or brand assets; text-only wordmark
- **Chosen:** Replace the real device's `HID` logo image + "Amico" wordmark with a plain text wordmark for this project (e.g. the existing "AMICO Management" heading, restyled to match the real header's typography/spacing) — no image asset copied from the device, no "HID" mark anywhere.
- **Why:** The real logo and "HID Global"/"Amico" branding are trademarked; copying them would misrepresent this project as the official HID product. Matching layout/color/typography is a legitimate design-language match; reusing the actual mark is not.
- **Rejected alternatives:** Downloading and reusing `images/logoW.png` etc. — rejected outright, trademark/impersonation risk.

### Decision 3 — Persistent left sidebar shell, replacing the current flat top tab bar
- **Chosen:** Restructure `frontend/index.html`'s navigation from three flat buttons (Users / Access Logs / System Information) into a real left sidebar matching the device's shell (white background, active item highlighted with a left accent bar + blue text, a top blue header bar with the wordmark). The sidebar only lists tabs this project actually implements today — it does **not** add placeholder entries for Visitors/Groups/Alarms/etc. (those remain tracked in `docs/api-roadmap.md`, out of scope here).
- **Why:** This is the real device's actual layout pattern (confirmed live) and is what "look like the real interface" concretely means structurally, not just color.
- **Rejected alternatives:** Keeping the flat tab bar but only recoloring it — rejected, doesn't match the structural layout the user asked to replicate.

### Decision 4 — Tabbed Add/Edit User modal, matching the real device's exact tab-lock behavior
- **Chosen:** Replace the current two-step flow (plain "Add User" form → separate "Edit" modal) with a single modal used for both create and edit, with tabs **General | Groups | Cards | PIN | Facial** (matching the real device's own tab set, minus "Time Zones" which this project doesn't implement yet — tracked in the roadmap doc, not invented here). On create (`Id: 0`), only the General tab is enabled; the other tabs are visibly present but disabled, with the real device's own footnote text pattern ("Save the user to enable editing of all fields"). Once the initial `POST /users` succeeds, the modal stays open with the new id, unlocking the other tabs — this is the exact behavior confirmed live on the real device (screenshot evidence: the modal shows all six tabs immediately, `(*) Save the user to enable editing of all fields` in red).
- **Why:** Directly resolves the user's own reported confusion (expecting to set an image while creating a user) by matching the real device's actual, evidence-confirmed UX pattern — not a guess at "better" UX.
- **Rejected alternatives:** Keeping today's two-screen split — rejected, doesn't match the real interface and is the source of the reported confusion. Allowing all tabs to submit before the user is created — rejected, technically impossible (every extra write needs a real `user_id`).

### Decision 5 — Table styling: icon-based booleans, matching the real device, with zero new external dependencies
- **Chosen:** Style the Users table to match the real device's look (light row separators, thumbnail photos) using small inline SVG glyphs authored directly in `users.js` for boolean columns (Password set/not set, Administrator) instead of today's plain text badges. **Correction made during Plan Review's own self-check** (not assumed): this project's `frontend/` currently has zero external CDN dependencies, and Giai đoạn 4's spec.md Decision 1 deliberately chose "no framework, no build step" — pulling in an external icon font (e.g. Font Awesome) would be a new, undiscussed departure from that established self-contained philosophy, not a continuation of an existing convention. Inline SVG achieves the same visual result with no new dependency.
- **Why:** Visual parity with the real table, without introducing the first external runtime dependency this frontend has ever had.
- **Rejected alternatives:** An external icon font via CDN — rejected per the correction above. Copying the real device's actual icon images from `images/` — rejected, unnecessary asset copying when small inline SVG achieves the same look.

### Decision 6 — Use the `frontend-design` skill for implementation, no Figma file
- **Chosen:** Per the user's own standing preference (saved to memory this session), the actual CSS/HTML implementation work is guided by the `frontend-design` skill rather than a Figma design-to-code workflow.
- **Why:** Matches the user's explicit, already-recorded choice.

---

## Scope

### In scope
- `frontend/style.css`: full rewrite using the real device's captured color/typography/spacing tokens (Decision 1).
- `frontend/index.html`: sidebar shell restructure (Decision 3), login page split-screen layout matching the real login page's visual structure (blue gradient panel + white card — Decision 1/2), text-only wordmark (Decision 2).
- `frontend/users.js`: Add/Edit modal unification into a tabbed dialog with the real device's tab-lock behavior (Decision 4); table row styling (Decision 5).
- `frontend/login.js`: visual-only adjustments to match the new markup structure from Decision 3 (no logic change to the actual login/session flow already built and live-verified).
- `frontend/access-logs.js`, `frontend/system-info.js`: minor markup/class adjustments only, to fit the new sidebar shell and table styling — no functional change.
- Manual, no-approval-needed visual verification via `file://`/local backend (no live device write actions — this plan touches no backend route and sends no new request shape).

### Out of scope (explicitly excluded)
- Any new functional tab/page (Visitors, Groups management, Time Zones, etc.) — tracked separately in `docs/api-roadmap.md`, not this plan.
- Any backend (`backend/`) change — this plan is frontend-only; no new route, no changed request/response shape.
- Any real HID/Amico logo, icon image, or other trademarked asset — Decision 2 is a hard constraint, not a preference.
- Pixel-perfect literal cloning of every real-device page (Alarms, Reports, Settings, etc.) — only the pages/flows this project already implements (Login, Users incl. Add/Edit modal, Access Logs, System Information) are restyled; there is nothing to restyle for pages we haven't built yet.
- Changing the session/login *logic* (cookie handling, `/login`/`/session` calls) — Giai đoạn 5's already-verified behavior is preserved untouched; only its visual presentation changes.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `frontend/style.css` | Modify (large rewrite) | New color/typography tokens, sidebar shell, tabbed modal, table styling |
| `frontend/index.html` | Modify | Sidebar shell markup, login split-screen markup, text-only wordmark |
| `frontend/users.js` | Modify | Unify Add/Edit into one tabbed modal with tab-lock behavior; table row icon styling |
| `frontend/login.js` | Modify | Adjust DOM references/classes for the new sidebar shell markup (no logic change) |
| `frontend/access-logs.js` | Modify | Minor class/markup adjustments for new table styling |
| `frontend/system-info.js` | Modify | Minor class/markup adjustments for new shell |
| `docs/src-map.md` | Modify | Note the frontend's visual redesign, if the existing row needs updating |

---

## Risks and unknowns

- The real device's tab-lock behavior for `Facial` specifically (does the Facial tab's upload control become enabled the moment the user is created, or does it have its own additional gating?) was confirmed structurally (tabs disabled pre-save) but the exact enable/disable transition moment for each tab individually was not separately tested per-tab — will be verified by matching Decision 4's logic (unlock all extra tabs together right after the first successful create), which is the most conservative reading of the evidence and safe to implement without further live testing.
- No live device write actions are needed to build or verify this plan (pure CSS/markup/client-side-JS restructuring using the existing, already-working API calls) — but a final manual visual check against a real login is recommended before calling this done, same discipline as Giai đoạn 4's own deferred-then-completed live check.
- No external CDN (font or icon library) is introduced by this plan — confirmed by checking the current `frontend/` tree has none today, and matching Giai đoạn 4's own "no framework, no build step" decision (Decision 5's correction).

---

## Open questions

- [ ] None blocking — all major design decisions are evidence-backed from the live capture already done this session.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal directly answers the user's own request, evidence captured before writing |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 5 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 7 files, all frontend-only |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Each Decision maps directly to a Scope In item |

**Total: 36/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
