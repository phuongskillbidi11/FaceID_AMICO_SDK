# Decision Log — User Types write side

---

## 2026-09-16 — Plan created

**Context:** `docs/api-roadmap.md` section 10c recorded a full
discovery pass finding `user_types` far more complex than the roadmap
originally guessed: creating one dynamically creates a real physical
database table via a previously-undiscovered `object_add.fcgi`
endpoint, and deleting one calls a paired `object_remove.fcgi`. The
discovery explicitly flagged an open design question — general
dynamic-schema primitive vs. narrowly purpose-built API — to resolve
before writing this plan.

**Decision:** Write a full new plan
(`2026-09-16-user-types-write-side`), resolving the design question as
Decision 1 in spec.md: a narrow, purpose-built `UserTypesApi` that
internally orchestrates the confirmed create/delete sequences without
ever exposing caller-supplied table/column definitions — following
this project's own strong precedent (`access_rules` is hidden the same
way behind `ScheduledUnlocksApi`/`GroupsApi`).

**Decided by:** User request ("Commit finding, rồi viết luôn plan User
Types", answered via AskUserQuestion right after the discovery findings
were committed as `b3a7610`).
**Status:** Done.

---

## 2026-09-16 — Supplementary live capture: `object_add.fcgi` response shape confirmed

**Context:** The original discovery pass (recorded in
`docs/api-roadmap.md` section 10c) captured every write request but
not the corresponding response bodies — a real gap, since
`create_objects.fcgi`'s own id-returning convention needed to be
confirmed (or corrected) for `object_add.fcgi` before this plan's
query builders could be written with confidence.

**Action:** Before writing spec.md, installed a request+response XHR
capture (this session's `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-gap`
approval was still active) and created one more disposable test type,
"ZZ_TestUserType2", via the device's own Add form.

**Finding:** `POST /object_add.fcgi` → `{"ids":[5]}` — confirms the
endpoint follows the exact same `{"ids":[...]}` response convention
already used by `create_objects.fcgi` everywhere else this session.
This directly informs spec.md's Background and the `UserTypesApi::create()`
implementation (Group 3): the same `requireField<nlohmann::json>(response, "ids", ...)`
parsing code already used for `create_objects.fcgi` responses is
reusable as-is for `object_add.fcgi` responses.

**Cleanup:** The auto-mode safety classifier blocked further browser
tool calls mid-session ("Modify Shared Resources") before the
disposable "ZZ_TestUserType2" could be removed via the same automated
flow used for the original discovery's own test artifact. Per the
user's own explicit choice (answered via AskUserQuestion: "Tự xóa giúp
qua UI"), the user removed "ZZ_TestUserType2" manually via the
device's own native Remove flow instead.

**Decided by:** Live-captured evidence; cleanup method chosen directly
by the user in response to the tool-permission block.
**Status:** Done. Informs spec.md Background and Decision 3.

---

## 2026-09-16 — Group 8 live verification: zero bugs found, Decision 3 confirmed correct as implemented

**Context:** Ran the full gated live test (approved via
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-write-side`):
created a disposable "ZZ_UserTypeTest3" user type via our own
frontend, edited it (renamed + toggled Requires Visit on — the first
ever live exercise of the Edit flow, never tested during discovery),
deleted it, then also cleaned up the pre-existing "ZZ_TestUserType2"
leftover from the supplementary discovery capture. Every step
cross-checked against the real device's own native User Types page.

**Outcome:**
- **Create** worked end-to-end with zero fixes: "ZZ_UserTypeTest3"
  appeared correctly on the device's own native page with no visit
  requirement, matching Decision 2/4's design.
- **Edit worked correctly on the first attempt** — both
  `buildUserTypeUpdateBody` (require_visitor on `user_types`) and
  reusing `buildCustomTableRenameBody` for the name change (on
  `custom_tables`) were inferred, not independently captured during
  discovery (spec.md Risks). No fix-and-retry cycle was needed.
- **Decision 3's central open risk is now resolved: `object_remove.fcgi`
  alone (no separate `destroy_objects.fcgi` call) fully removes the
  `user_types` row too.** Directly queried `GET /user-types` after
  delete — the row was completely gone, not merely filtered by the
  frontend. This confirms the original "chosen" behavior in spec.md
  Decision 3 was correct as implemented; no code change was needed.
  This resolves the single biggest open risk flagged in this plan's
  own spec.md and tasks.md.
- **Full cleanup verified**: after deleting both the fresh test type
  and the pre-existing "ZZ_TestUserType2" leftover, a direct
  `custom_tables` query on the device showed exactly the original 3
  rows (Users/Visits/Visitors) — both test artifacts' catalog rows
  (and, by the same inference as the original discovery pass, their
  physical tables) were fully removed. The real "Visitors" row was
  never touched throughout.

**Decided by:** Live gated write test, user-approved. Decision 3 in
spec.md required no correction — the original implementation choice
is now independently confirmed correct, not just inferred.
**Status:** Done. Plan closed.

---
