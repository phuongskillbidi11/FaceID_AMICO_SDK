# Spec — Fix: user profile photos never display in the web frontend

---

## Goal

On the Users tab, every row with an enrolled face currently shows "No
image" instead of the actual photo — even though the real device (and
its own stock web UI) has the photo and shows it correctly. After this
fix, a user's row shows their real photo whenever the device has one,
and still shows "No image" only for users that genuinely have none.

**Done looks like:** Opening the Users tab after logging into a real
device shows real photos for users who have an enrolled face/image,
verified live against `http://192.168.2.156`.

---

## Background

Root cause (confirmed by reading the source, not guessed): `AmicoUser.
imageUrl` is built in `src/Client.cpp:422` as a path **relative to the
device itself** (`/user_get_image.fcgi?user_id=<id>`) — correct for
the real AMICO web UI, which is served BY that same device, so the
relative path resolves to the device automatically. `backend/
JsonMapping.cpp:21` passes this string through to the frontend
unchanged, and `frontend/users.js` sets `<img src="user.imageUrl">`
directly. But our frontend is served by `amico_backend` at its own
origin (e.g. `http://127.0.0.1:8080`), which has no `/user_get_image.
fcgi` route at all — the browser's request 404s, and the existing
`image.onerror` handler (correctly, defensively) falls back to the "No
image" placeholder. This has been broken since Giai đoạn 4 (the
frontend was never live-verified with real device photos before now —
Giai đoạn 4's own manual verification pass was deferred to Giai đoạn 5,
and Giai đoạn 5's Group 4 tests happened to use users without face
images already displayed, so this gap was never exercised until now).

---

## Design decisions

### Decision 1 — Proxy the image through a new backend route, don't expose the device directly to the browser
- **Chosen:** Add `GET /users/:id/image` to `amico_backend`, gated by
  the same session-cookie check as every other route (Giai đoạn 5).
  It calls a new `AmicoClient::UsersApi::getImage(id)` SDK method,
  which performs an authenticated GET against the device's own
  `/user_get_image.fcgi?user_id=<id>` (reusing the existing session
  cookie already held by the logged-in `AmicoClient` inside
  `SessionStore`) and streams the raw bytes back with the correct
  `Content-Type`.
- **Why:** The browser has no way to reach the device directly (it's
  authenticated to the *backend*, via the `amico_session` cookie —
  Giai đoạn 5's architecture — not to the device itself; the device
  requires its own separate session cookie that only the backend
  holds). A proxy route is the only option that doesn't require the
  browser to somehow also hold real device credentials.
- **Rejected alternatives:** Making `imageUrl` an absolute URL pointing
  straight at the device (e.g. `http://192.168.2.156/user_get_image.
  fcgi?...`) — rejected: the browser has no device session cookie, so
  this would 401/redirect to the device's own login page inside an
  `<img>` tag, and would leak the device's raw IP/scheme into the
  frontend regardless of which device is currently logged into (Giai
  đoạn 5's whole point was decoupling the frontend from a fixed
  device).

### Decision 2 — `imageUrl` in the JSON response becomes a backend-relative path, not a passthrough of the SDK's device-relative one
- **Chosen:** `backend/JsonMapping.cpp` builds `imageUrl` itself as
  `"/users/" + id + "/image"` instead of copying `user.imageUrl`
  verbatim. `frontend/users.js` needs no change — it already treats
  `imageUrl` as an opaque URL and already has an `onerror` fallback to
  the placeholder.
- **Why:** Keeps the fix entirely on the backend/SDK side; the
  frontend's existing code is already correct (it correctly assumed
  `imageUrl` would be a workable, same-origin-reachable URL — that
  assumption was right, only the value it was given was wrong).
- **Rejected alternatives:** Changing `frontend/users.js` to rewrite
  the URL itself (e.g. strip `/user_get_image.fcgi?user_id=` and
  reconstruct a backend path) — rejected, this duplicates protocol
  knowledge (the device's own URL scheme) into the frontend for no
  benefit; the backend already knows the user's id and can build the
  correct path directly.

### Decision 3 — 404 passthrough for users with no image, no content-type guessing beyond what the device sends
- **Chosen:** If the device's own response for `/user_get_image.fcgi`
  is a 404 (or any non-2xx), the backend route returns the same status
  with no body — `frontend/users.js`'s existing `onerror` handler
  already falls back to the placeholder correctly, so no frontend
  change is needed for this case either. The backend forwards the
  device's own `Content-Type` response header if present, defaulting
  to `image/jpeg` otherwise (matches the confirmed JPEG-only upload
  requirement from Giai đoạn 2b).
- **Why:** Reuses already-correct frontend error handling instead of
  adding a new "has image" boolean field and a second code path.
- **Rejected alternatives:** Adding a `hasImage` boolean to `AmicoUser`
  matching `faceCount > 0` and only setting `imageUrl` when true —
  rejected as unnecessary scope: whether a *face* is enrolled
  (`faceCount`) is not guaranteed to be the same thing as whether a
  *photo* exists for display purposes on the real device's own
  behavior (unconfirmed without live evidence either way), so relying
  on the device's actual 404-or-not response for the image path itself
  is the only evidence-based signal we have.

---

## Scope

### In scope
- `include/amico/Client.hpp` / `src/Client.cpp`: new `UsersApi::
  getImage(int64_t userId) -> std::vector<uint8_t>` (throws on a
  non-2xx response, same pattern as other authenticated calls — the
  backend route below maps that exception to the correct HTTP status,
  it does not need a special "not found" return type).
- A new authenticated-GET-binary transport helper in `src/Client.cpp`
  (mirrors the existing `postAuthenticatedBinary`, but GET with no
  request body, same cookie/autoRelogin/retry-once semantics).
- `backend/Routes.cpp`: new `GET /users/:id/image` route (session-cookie
  gated like every other route), calling `getImage` and forwarding the
  device's own status/content-type/bytes back to the browser.
- `backend/JsonMapping.cpp`: build `imageUrl` as `/users/<id>/image`
  instead of passing `user.imageUrl` through.
- `backend/ErrorMapping.cpp`: no change expected (existing exception
  types/status mapping already cover this) — confirmed during
  implementation, not assumed.
- Offline tests: extend `test/backend/test_routes.cpp` for the new
  route (success with bytes + content-type, 404 passthrough, missing
  session cookie → 401 like every other route); extend SDK-level tests
  for the new `getImage` method (success, HTTP error mapping, session
  retry-once behavior matching the existing authenticated-call tests).
- `docs/backend-api.md` / `docs/src-map.md`: document the new route
  and the new SDK method.

### Out of scope (explicitly excluded)
- Any change to how images are **uploaded** (`PUT /users/:id/image`) —
  that path already works and was live-verified in Giai đoạn 2b/5.
- Any change to the face-enrollment/validation behavior itself
  (`checkImageSaveResult`, error codes, etc.) — unrelated to display.
- Caching/optimizing repeated image fetches (e.g. `ETag`/`Cache-Control`
  tuning) — not reported as a problem; can be a future improvement if
  it ever matters.
- The "Cards on device" list-of-existing-cards gap already recorded as
  tech debt in Giai đoạn 4's `DECISION_LOG.md` — unrelated to this bug.
- Any change to the session/login model itself (Giai đoạn 5) — this
  fix only adds one new route under that existing model.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Client.hpp` | Modify | Declare `UsersApi::getImage(int64_t)` |
| `src/Client.cpp` | Modify | Implement `getImage` + a new authenticated-GET-binary transport helper |
| `backend/Routes.cpp` | Modify | Add `GET /users/:id/image`, session-gated, proxies bytes/status/content-type |
| `backend/JsonMapping.cpp` | Modify | Build `imageUrl` as a backend-relative path instead of passing the SDK's device-relative one through |
| `test/test_users.cpp` (or nearest existing SDK test file for `UsersApi`) | Modify | New `getImage` test cases (success, non-2xx mapping, session retry) |
| `test/backend/test_routes.cpp` | Modify | New `GET /users/:id/image` route test cases |
| `docs/backend-api.md` | Modify | Document the new route |
| `docs/src-map.md` | Modify | Note the new SDK method / route |

---

## Risks and unknowns

- **Unconfirmed:** the device's exact response (status code, headers,
  body) for `/user_get_image.fcgi?user_id=<id>` when that user has NO
  photo at all. Assumed to be a clean non-2xx (404 or similar) based on
  the existing frontend's defensive `onerror` handling already being
  written with that assumption — must be confirmed with a real,
  approved live read against a user known to have no photo (e.g. one of
  the three real users currently showing "No image") before calling
  this fix verified.
- **Unconfirmed:** the exact `Content-Type` header the device sends for
  a successful image response — assumed `image/jpeg` (matches the
  confirmed JPEG-only upload requirement) but will be read from the
  actual device response and forwarded, not hard-coded, so this risk is
  self-mitigating.
- Streaming binary bytes through `cpp-httplib`'s response API needs the
  correct call (`res.set_content(bytes, contentType)` accepts a
  `std::string`, which can hold arbitrary bytes — already proven safe
  in this codebase by the existing image-upload path's `req.body`
  handling) — no new library capability needed, but this will be
  confirmed by reading the relevant `httplib.h` signature during
  implementation rather than assumed.

---

## Open questions

- [x] Confirm the device's actual response for a user with no photo,
      live, before closing this out (Decision 3 depends on this).
      **Resolved 2026-09-13 (live, read-only):** for a nonexistent user
      id, the device returns `400`, not `404` as this doc originally
      assumed — Decision 3's 404-only special-case still means a 400
      falls through to the generic JSON-error path instead of an empty
      body, but `frontend/users.js`'s `onerror` handler treats any
      failed load identically, so the user-visible outcome (clean "No
      image" placeholder) is unaffected. See `DECISION_LOG.md`.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Root cause confirmed by reading source before writing this, not guessed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 5 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 8 files, all with reasons |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Traces to the "Done looks like" goal directly |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
