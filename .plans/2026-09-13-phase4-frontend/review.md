# Plan Review — Giai đoạn 4: Frontend

**Reviewer role activated:** `eng adapter prompt plan-reviewer` (2026-09-13)

---

## Checklist

### Missing requirements
spec.md's Goal (Users full CRUD/groups/cards/image/administrator/PIN,
Access Logs, System Information, plain HTML/CSS/JS, no build step)
matches the user's explicit scope choices exactly. No gap.

### Incorrect assumptions — **BLOCKING**
Read the actual installed `httplib.h`
(`build-exec/vcpkg_installed/x86-windows/include/httplib.h`) rather
than trusting Task 1.2's stated assumption. Task 1.2 says: *"cpp-httplib
checks registered route handlers before falling back to the mount
point for unmatched paths."* This is **backwards**. The actual
dispatch order (`Server::routing`, lines 13746–13756):
```cpp
inline bool Server::routing(Request &req, Response &res, Stream &strm) {
  if (pre_routing_handler_ && ...) { return true; }

  // File handler
  if ((req.method == "GET" || req.method == "HEAD") &&
      handle_file_request(req, res)) {
    return true;
  }

  const auto *custom = find_custom_entry(req.method);
  ...
```
**`handle_file_request` (the static-file mount) runs BEFORE any
registered `GET`/`HEAD` route handler** — the opposite of what Task 1.2
states. A static file at the mount point takes priority over a
same-path API route, not the reverse.

**Practical impact on this specific plan: none currently** — none of
the 6 `GET` routes (`/health`, `/system-information`, `/users`,
`/users/:id`, `/access-logs`, plus `/` itself serving `index.html`)
collide with any planned `frontend/` filename, and `POST`/`PUT`/
`PATCH`/`DELETE` routes are entirely unaffected (`handle_file_request`
only runs for `GET`/`HEAD`). So this does not cause an actual bug in
the routes as scoped. It does, however, mean the plan's own stated
rationale is factually wrong, which matters for anyone extending this
later (e.g. a future static asset accidentally named `users` with no
extension would silently shadow the `/users` API route, and a
maintainer trusting Task 1.2's wording would be looking in the wrong
direction to debug it).

Path-traversal safety (the actual thing Decision 1 leans on for
"safe by default") IS confirmed correct: `is_valid_path` rejects `..`
in the URL, plus a defense-in-depth `canonicalize_path` +
`is_path_within_base` check against symlink/junction escapes
(lines 13438–13452). Content-Type inference uses a standard
extension→MIME map. Decision 1 itself stands; only Task 1.2's ordering
claim needs correcting.

**Required fix (Planner):** Correct Task 1.2's text to state the real
order (static files checked first, API routes second) and note the
practical non-collision explicitly, rather than leaving a
factually-backwards claim in the plan.

### Architecture inconsistencies
None beyond the above — Decision 1–6 are internally consistent with
each other and with Giai đoạn 3's existing backend design (same
`amico_backend` process, same trust boundary, same guardrail
philosophy carried into the UI via Decision 4).

### Missing edge cases (tests.md)
Non-blocking, worth naming: Test F-7 (image upload) checks the
conversion doesn't throw and sets the right Content-Type, but doesn't
explicitly test what happens when the selected file is *not* an image
at all (e.g. a `.txt` file) — `Image.onload` would never fire, and
without an `onerror` handler the UI could hang silently waiting for a
load event that never comes. Recommend Task 2.5 add an explicit
`image.onerror` handler that shows a clear error via the banner
(Decision 6) rather than leaving this unhandled.

### Missing tests
Covered by the note above; no other gaps found.

### Dependency problems
None — Group 0's discovery task correctly gates Group 1, which gates
Group 2 (frontend code assumes the hosting mechanism from Group 1 is
in place, correctly).

### Security or hardware impact
Well handled: Decision 4's confirmation-dialog requirement for
Administrator/PIN correctly extends Giai đoạn 3's guardrail philosophy
into the UI layer rather than silently defeating it; Decision 5
correctly declines to add false security theater; Decision 6 excludes
password values from error/log paths, consistent with the project's
hard boundary.

---

## Verdict (pass 1): **CHANGES REQUESTED**

**Blocking:** Correct Task 1.2's backwards claim about `cpp-httplib`'s
static-file-vs-route dispatch order (static files are checked first,
not last) — no practical route collision exists in this plan's actual
scope, but the stated rationale must be factually accurate.

**Non-blocking suggestion:** add an `image.onerror` handler to Task 2.5
for non-image file selections.

**Reviewed at:** 2026-09-13

---

## Re-review (pass 2) — 2026-09-13

Planner corrected Task 1.2's text with the real dispatch order (static
files checked before `GET`/`HEAD` routes) and an explicit note on why
no actual collision exists in this plan's route set. Task 0.1 marked
complete, citing this same review's own header-reading as the
discovery evidence (no need for the Executor to redo it). Task 2.5
updated with the `image.onerror` handling per the non-blocking note.

Confirmed by direct read: the correction is accurate and matches what
`Server::routing()` actually does; no new issues found.

## Verdict (pass 2): **APPROVED**

**Reviewed at:** 2026-09-13
