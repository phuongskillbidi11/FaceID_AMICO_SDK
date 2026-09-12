# AMICO VL70LF Web UI — authentication flow (confirmed live)

Status: **confirmed by a live browser session against `192.168.2.156`**
(login with device-owner-supplied credentials → dashboard browse → logout).
See `docs/amico-protocol-map.md` for platform context and evidence
categories. All requests below are `LIVE_CONFIRMED`.

## Full sequence observed

### 1. Pre-auth page load

```
GET /                       -> 200, text/html, login page
GET /get_language.fcgi      -> 200, {"language":"en_US"}
GET /init_device_set.fcgi?_=<cache-buster-timestamp>
                             -> 200, {"init_device_set":true}
POST /get_countries.fcgi    body {"language":"en"}
                             -> 200, {"countries":[...]}
GET /session_is_valid.fcgi  -> 200, {"session_is_valid":false}
```

No cookie is set by the server at this point. `init_device_set:true` means
the device has already completed first-run setup, so the EULA/language
wizard embedded in the login page HTML stays hidden and the plain
username/password form is shown directly.

### 2. Login submit

Client-side, before the HTTP call, the Web UI's own `login.js` does:

```js
$.cookie('login', $('#input_user').val(), {expires: 10000, path: '/'});
```

— i.e. a `login=<username>` cookie is set by JavaScript *before* the login
request is even sent.

The login request itself:

```
POST /hidlogin.fcgi
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: login=<username>

login=<username>&password=<password>
```

Two attempts were observed in this session:

| Attempt | Credentials | Result |
|---|---|---|
| 1 | `login=admin` (lowercase), `password=<redacted>` | **401**, response body not retained by the tool but the Web UI's error handler displays "Invalid user or password" |
| 2 | `login=Admin` (capital A), `password=<redacted>` (same value as attempt 1) | **200** — the device's actual username is case-sensitive and is `Admin`, not `admin` |

On success, the JSON response body includes a `session` field (confirmed via
the Web UI's own code, `document.cookie = "session=" + data.session + "; path=/"` —
the exact response body bytes were not retained by the tool for this run,
but the resulting `Cookie` header on every subsequent request,
`Cookie: login=Admin; session=<24-character alphanumeric token>`, directly
confirms the field name, that it is a bearer-style opaque token (not a JWT —
no `.` separators, no base64 padding pattern), and that the **server never
sends `Set-Cookie`** — the client manufactures the cookie itself from the
JSON body.

### 3. Immediately after login (still part of the same UI transaction)

```
GET  /init_device_set.fcgi
POST /system_information.fcgi   (empty body)
POST /is_first_web_login.fcgi   (empty body) -> {"is_first_web_login": bool}
GET  /en_US/html/index.html                   (SPA shell for the dashboard)
```

`is_first_web_login.fcgi` is a distinct check from `init_device_set.fcgi` —
the former appears to gate one-time onboarding UI (e.g. "please change the
default password") independent of the device-level init flag.

### 4. Authenticated browsing (dashboard)

Every authenticated request from this point on carries
`Cookie: login=Admin; session=<token>`. No `Authorization` header is used
anywhere — auth is entirely cookie-based. No CSRF token was sent despite
`x-csrftoken` being allow-listed in `Access-Control-Allow-Headers` on every
response (see security note in `docs/amico-protocol-map.md`).

The dashboard issues:
- `POST /get_configuration.fcgi` — repeated ~30+ times with different small
  section/key requests, one per UI widget that needs a setting.
- `POST /load_objects.fcgi` — repeated for every list-shaped widget (recent
  access log entries, enrolled user count/photos, wiegand modes, custom
  table definitions, areas, etc.) — see `docs/amico-protocol-map.md` for the
  generic query shape.
- `POST /object_metadata.fcgi` — fetched once (twice in this session — the
  UI does not appear to cache it client-side within a session), returns the
  full 90-object schema.
- `POST /face_template_count_distinct.fcgi`, `POST /alarm_status.fcgi` — small
  read-only stat/status polls.
- `GET /user_get_image.fcgi?user_id=<id>` — user photo, raw JPEG.
- **Polling:** after the initial load, the dashboard repeats
  `POST /load_objects.fcgi` + `POST /alarm_status.fcgi` back-to-back roughly
  once per second indefinitely (hundreds of calls observed over ~5 minutes
  of an otherwise idle dashboard) — this is a live-activity-feed poll, not a
  one-shot page load. Any SDK/client implementation that mirrors this
  behavior should let the caller control or disable that polling cadence
  rather than hardcoding a 1-second interval.

### 5. Session-timeout / expiry handling

Not exercised in this session (session stayed valid throughout; logout was
manual). `login.js`'s ajax error handler (`JS_CONFIRMED`, not observed live)
inspects `jqXHR.responseJSON.error`:
- `"Invalid access level"` → shows "User has no access" and immediately
  fires `POST /logout.fcgi`.
- `"Invalid user or password"` / `"Invalid login or password"` → shows
  "Invalid user or password".
- No `responseJSON` at all (network-level failure) → shows a
  "Could not connect to the device" message (localized).

What happens on a *mid-session* 401 (e.g. session expired while browsing,
as opposed to a failed login) was not observed and is not documented here —
flagged as a gap for a future session.

### 6. Logout

```
GET /logout.fcgi
Cookie: login=Admin; session=<token>
-> 200, {} (empty JSON object)
```

Followed by the SPA navigating to `/en_US/html/login.html`, which re-runs
the pre-auth sequence from step 1. `GET /session_is_valid.fcgi` immediately
after logout returned `{"session_is_valid":false}` even though the browser
still held the (now server-invalidated) `session` cookie — confirming the
invalidation happens server-side, not just client-side cookie clearing.

Note: `login.js` also contains a second, `JS_CONFIRMED`-only logout call
(`POST /logout.fcgi`, synchronous) used specifically in the "Invalid access
level" error path — the live logout observed in this session was a plain
`GET`. Both may be valid; only the `GET` form was exercised here.

## Summary table

| Step | Method | Path | Auth required | Confirmed |
|---|---|---|---|---|
| Pre-auth session probe | GET | `/session_is_valid.fcgi` | No | LIVE_CONFIRMED |
| Login | POST | `/hidlogin.fcgi` | No (submits credentials) | LIVE_CONFIRMED |
| Post-login session probe | GET | `/session_is_valid.fcgi` | Yes (implicitly, via cookie) | LIVE_CONFIRMED |
| Device info | POST | `/system_information.fcgi` | Yes | LIVE_CONFIRMED |
| First-login flag | POST | `/is_first_web_login.fcgi` | Yes | LIVE_CONFIRMED |
| Logout | GET | `/logout.fcgi` | Yes | LIVE_CONFIRMED |
| Logout (alt., error-path only) | POST | `/logout.fcgi` | Yes | JS_CONFIRMED only |
