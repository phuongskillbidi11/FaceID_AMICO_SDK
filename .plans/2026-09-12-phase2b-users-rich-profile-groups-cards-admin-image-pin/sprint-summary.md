# Sprint Summary — Giai đoạn 2b: Users rich profile (Groups, Cards, Administrator, Image, PIN fallback)

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Giai đoạn 2b — Users rich profile (Groups 0–5, complete) |
| Plan folder | `.plans/2026-09-12-phase2b-users-rich-profile-groups-cards-admin-image-pin/` |
| Start date | 2026-09-12 |
| End date | 2026-09-13 |
| Tests | 89 cases / 490 assertions offline (up from 58/309), 0 failed. Group 5: Task 5.2 (card/group/image) attempt #4 PASS after 3 root-caused fixes; Task 5.3 (`setAdministrator`) PASS; Task 5.4 (`setPassword`) PASS. |

---

## Outcome

**Status:** [x] Complete (all Groups 0–5 done and verified, including full live round-trips for every new write method) / [ ] Partial / [ ] Abandoned

### What was built (matches tasks.md `[x]` items)
- **Group 0 (live, read-only discovery, 8 tasks):** confirmed exact
  write payloads for Groups (`user_groups`), Cards (`cards`, packed
  `value` encoding), Administrator (`user_roles`, asymmetric grant/
  revoke), Image (`user_set_image`/`user_destroy_image`, wire format).
  `hasPassword` derivation resolved via static evidence after a live
  verification attempt was blocked by the session's own safety
  classifier ("Credential Materialization") — escalated to and approved
  by the user.
- **Plan Review caught a real gap before Group 1 started:** the
  original spec/tasks claimed Cards/Administrator/Image write shapes
  were "already known" — Review found no actual doc evidence backing
  that, added 3 discovery tasks, re-verified before approving.
- **Group 1 (SDK code):** `src/ObjectQuery.{hpp,cpp}` — 13 new
  builders (group/card/administrator/password write, plus 6 read
  builders for groupIds/cardCount/isAdmin/faceCount/bioCount/
  hasPassword, plus a face_templates-delete builder added mid-sprint).
  `include/amico/Types.hpp` — `AmicoUser` extended with 8 new fields.
  `include/amico/Client.hpp`/`src/Client.cpp` — 8 new `UsersApi`
  methods (`addToGroup`/`removeFromGroup`, `addCard`/`removeCard`,
  `setAdministrator`, `setImage`/`removeImage`, `setPassword`), a new
  `postAuthenticatedBinary` transport helper, and `get()`/`list()`
  extended to populate the 8 new fields (N+1 query cost, documented).
- **Group 2 (offline tests):** `test/test_query_whitelist.cpp` (8 new
  cases), `test/test_users_profile.cpp` (new file, 26 cases), 24 new
  fixtures, `test/UserProfileResponder.hpp` (new shared FakeTransport
  helper, written by Codex to fix a regression Task 1.7 caused in 3
  pre-existing test files).
- **Group 3 (docs):** `docs/sdk-usage.md`, `docs/src-map.md`,
  `docs/ui-action-protocol-map.md` all updated, the latter with a major
  2026-09-13 amendment (see Discoveries below).
- **Group 4:** full offline build+test gate — exit 0, zero warnings,
  89 cases / 490 assertions, 0 failed.
- **Group 5 (live, gated, 3 separately-confirmed sub-tasks):**
  - Task 5.2 (card/group/image): **4 attempts.** #1 SKIPPED the image
    step (Windows ANSI-codepage path bug, fixed). #2 FAIL — device
    requires JPEG not PNG (fixed, re-encoded sample locally). #3 FAIL —
    still HTTP 400; investigated via live browser capture and found the
    real call site in `en_US/js/CID.js` (undiscovered file): requires
    `match`/`timestamp` query params and returns a face-detection/
    quality-scoring result, not a generic ack (fixed). #4 **PASS**, full
    9/9 sequence.
  - Task 5.3 (`setAdministrator`): separately confirmed, **PASS**.
  - Task 5.4 (`setPassword`): separately confirmed, **PASS**, no raw PIN
    ever printed/logged.

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| Face-count/bio-count batch optimization (currently N+1 queries per `list()` call) | Explicitly out of scope for this MVP pass; documented cost tradeoff | Only if a real caller needs `list()` at scale |
| Multi-angle hardware face enrollment (`remote_enroll`) | Always out of scope for this plan; the image-upload finding below narrows but does not eliminate this future work | Separate future plan, needs camera/USB fingerprint hardware |

---

## Discoveries (not in the spec)

- **`user_set_image` is not a cosmetic photo store — it enrolls/updates
  a face-recognition template.** spec.md's Decision 4 explicitly
  modeled Image as distinct from face enrollment; this is now known to
  be wrong. The real call site (found in `en_US/js/CID.js`, a
  previously-undiscovered generic field-save framework) requires
  `match=1&timestamp=<epoch>` query params beyond `user_id`, and
  returns a face-detection/quality-scoring result
  (`{"scores":{...},"success":true}` or `{"success":false,"errors":[...]}`
  with specific face-validation error codes). Removing an image also
  destroys the user's `face_templates` rows. This was found only via
  live browser capture after 2 rounds of static-JS-based fixes proved
  insufficient — a strong validation of this project's live-test gate
  existing at all.
- **Card's `value` field is a packed integer** (`areaCode * 4294967296
  + cardNumber`), not a free-form string — found from `Card.setValue()`
  in `class/user.js`.
- **Administrator grant/revoke is asymmetric**, not a simple toggle —
  the real UI only ever issues a write when transitioning state.
- **No `COUNT`-style aggregate exists** for "is password set" on this
  device's query engine — `hasPassword` is derived by requesting the
  `password` field directly and checking for the confirmed masked
  sentinel (`"*****"`) vs. empty/null, per static evidence the real
  hash is never returned on any read path.
- **Live discovery of a safety guardrail:** attempting to verify the
  `hasPassword` masking live (even via a safe, value-never-returned
  browser-side check) was blocked by the session's own safety
  classifier ("Credential Materialization") — a meaningful signal that
  this boundary is taken seriously at the tooling level, not just by
  convention.
- Windows narrow-string `std::ifstream` silently fails to open
  non-ASCII paths because the CRT interprets `std::string` via the
  ANSI codepage, not UTF-8 — fixed via explicit
  `MultiByteToWideChar(CP_UTF8, ...)` + MSVC's non-standard wide-string
  `ifstream` constructor + `/utf-8` compile flag (live-test-only fix,
  not shipped SDK code).

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| `get()`/`list()`'s N+1 query cost (1 + 6 per user) for the rich-profile fields | Low for small user counts (this device has 4 users); would matter at scale | Only if a real deployment needs `list()` on hundreds+ of users |
| `setImage()`'s face-validation error codes (`facialErrorToStr`'s 0–12) are surfaced as a raw JSON dump in the exception message, not a typed enum | Low — callers still get a clear, actionable error string | Only if a caller needs to branch on specific failure codes |
| Whether a single `user_set_image` call reliably enables real face-recognition matching (accuracy, angle coverage) is unconfirmed — only that the call succeeds and updates `faceCount` | Unknown until tested against actual face-recognition unlock behavior | The deferred hardware face-enrollment plan should verify this explicitly |

---

## Lessons learned

- **Plan Review caught a real "assumed already known" gap before any
  code was written** — re-verify this discipline is worth the extra
  review pass every time an earlier session's summary claims something
  is "already confirmed."
- **Live-test failures are not always the same class of bug.** This
  sprint's image write path needed 3 successive root-causes (path
  encoding → image format → missing params/response shape) before
  passing — each one was a genuinely different issue, not the same
  mistake repeated. Treat each live FAIL as its own investigation, not
  a retry of the same fix.
- **A file loaded on every page but never deeply read (`CID.js`) held
  the actual authoritative implementation** for one specific feature,
  while the "obvious" file (`class/user.js`) held vestigial/superseded
  code for that same feature. When static reading of the "obvious" file
  produces a live failure that doesn't make sense, check whether
  another loaded-but-unread file might be the real source before
  assuming the fix is subtly wrong.
- **A blocked action (the safety classifier's refusal) is itself
  evidence** — it didn't stall discovery, it confirmed a boundary was
  being taken seriously, and static evidence was sufficient to proceed
  once escalated and approved.
- **Delegating mechanical, well-specified test-fixing to Codex worked
  well**, but Codex hitting a usage limit mid-session meant falling
  back to direct authorship for the remaining Group 1/2 work — kept
  the same quality bar (build + full offline suite re-verified after
  every change), just slower.

---

## What the next sprint must NOT assume

- `setImage()`/`removeImage()` **have** been live-verified (Task 5.2
  attempt #4) — but only the happy path with one real, well-lit,
  correctly-posed face photo. Do not assume every face-validation edge
  case (masks, poor lighting, multiple faces, extreme angles) has been
  tested.
- Whether the face template enrolled via `setImage()` actually enables
  the device's real-time face-recognition unlock (as opposed to just
  being stored) is **not verified** by this plan — that would require
  testing actual recognition against a live camera, out of scope here.
- `getUserIsAdmin()`/`setAdministrator()`'s no-op-when-already-correct
  behavior is live-confirmed only for the grant→verify→revoke→verify
  sequence in Task 5.3's test, not for every possible prior state.
- The two prior plans' `KNOWN_HARNESS_BUG` (self-induced
  `PLAN_DRIFT_DETECTED`) has not been re-investigated or fixed — expect
  the same mechanical `eng verify`/`eng plan drift` noise if this
  plan's state is pushed through `eng workflow advance` while other
  plans' files remain uncommitted.
