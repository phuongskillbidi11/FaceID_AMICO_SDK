# Sprint Summary — Visits (Enroll → Visits): list/create/update/remove/finish

**Plan:** `2026-09-14-implement-visits-enroll-visits-crud`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): new `Visit`/`NewVisit`/
  `VisitUpdate`/`VisitQuery` types and a new `AmicoClient::VisitsApi`
  (`list`/`get`/`create`/`update`/`remove`/`finish`) — a genuinely
  distinct device object from Users/Visitors, not a filter variant.
  `list()`/`get()` resolve `visitorName`/`hostName` by reusing the
  existing `UsersApi::getNamesByIds()`, and `cardCount` via the
  existing `buildCardCountBody()` — no new name-resolution code. A
  visit's Cards reuse the already-existing `UsersApi::addCard()`/
  `removeCard()` (via `/visitors/:visitorId/cards`), not a new
  card-issuance path. `finish()` is a dedicated method (not a plain
  `VisitUpdate` field) that revokes every card issued to the visitor
  before marking the visit concluded — mirrors the real device's own
  two-step side effect, confirmed live.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`): 6 new
  `/visits/*` routes (`GET` list/get, `POST` create, `PATCH` update,
  `DELETE`, `POST .../finish`); a caller-supplied `"finished"` key on
  `PATCH` is silently ignored (no generic-update path for it, by
  design).
- **Frontend**: new `frontend/visits.js` (not built on the Users/
  Visitors shared factory — different enough modal shape to not be
  worth forcing through it). `frontend/users.js` gained a small,
  reusable `renderCardsSubform()` extracted from its own Cards tab
  (Users/Visitors behavior confirmed byte-for-byte unchanged), reused
  by Visits for its own Cards tab. New "Visits" sidebar entry (calendar
  icon) under the Enroll group.
- **Tests**: `test/test_visits.cpp` (new, 14 cases: all 7 query
  builders including a byte-for-byte match of the live-captured create
  payload, list/get enrichment, create/update/remove, and finish's
  call-order + not-found case) plus 3 new `test_query_whitelist.cpp`
  cases and 5 new `test/backend/test_routes.cpp` route cases. Final
  counts: SDK 138/138, backend 56/56 — both clean, zero regressions to
  Users/Visitors/Access Logs/Groups/TimeZones.
- **Docs**: `docs/backend-api.md` gained a full Visits section (routes,
  the `finish` side effect warning, the Cards-reuse cross-reference);
  `docs/api-roadmap.md` moved Visits from 📋 Planned to ✅ Implemented
  and dropped it from the "next discovery pass" list.

## Live verification (Group 8)

- **8.1 (read-only):** Visits tab loads under Enroll; Users/Visitors
  pages confirmed unaffected by the `renderCardsSubform` extraction;
  Add Visit modal's Visitor/Host pickers populated correctly from the
  real `/visitors`/`/users` lists; Cards tab confirmed locked
  (`disabled: true`) until first save.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visits-enroll-visits-crud`):**
  created a visit (VIP → Bơ báo) via our own frontend; cross-checked on
  the real device's own native Visits page (same record, "Showing from
  1 to 1 of 1 records"). Edited its End Date/Time via `PATCH` —
  succeeded, **resolving spec.md's one flagged Risk**: the real device
  accepted `buildVisitUpdateBody`'s assumed shape exactly as built, no
  fix needed. Added a card via the Cards tab (confirmed the
  `/visitors/:id/cards` reuse works end-to-end). Called Finish
  (confirmed the browser's own confirm dialog warned about card
  revocation) — verified via direct API checks that the card was
  genuinely revoked device-side (`cardCount: 0` on both the visit and
  the visitor) and the visit correctly dropped out of the default
  active-only list. Deleted the visit — confirmed gone via a fresh
  `GET` (404) and, as the definitive cross-check, the real device's own
  native page ("No record found.").

## Side discovery this session (not part of this plan's own scope)

While investigating an unrelated user report ("can't delete a user on
the real device's native Users page"), found: (1) the real device's
per-row trash icon only *marks* a row for removal — the actual delete
requires the separate toolbar "Remove" button plus a confirm modal, a
genuine two-step UX easy to mistake for "the button doesn't work"; (2)
a specific pre-existing user record ("Nguyễn Tự Do", employee ID a
literal UUID) appears to be continuously recreated by something
external to this app every time it's deleted — same UUID, new id each
time. Reported to the user; not something this plan's own code touches
or is responsible for.

## Infra (also this session, unrelated to the Visits feature itself)

Set up nginx as a reverse proxy in front of `amico_backend`, bound only
to the machine's NetBird interface IP (not `0.0.0.0`) — exposes the
app to NetBird-mesh peers without widening exposure to the local LAN.
Both `amico_backend` and `nginx` now run as Windows services via NSSM
(auto-start on boot, auto-restart on crash, `nginx` ordered to start
after `amico_backend`). Documented in `docs/backend-api.md`'s Security
section as the recommended deployment pattern.

## Not committed

Per this project's established "để commit sau" (commit later)
convention (see the Visitors plan's own sprint-summary), none of this
plan's changes have been committed. All files remain in the working
tree, ready for review before the user decides to commit.
