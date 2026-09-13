# `amico_backend` — HTTP API reference

`amico_backend` is a JSON/HTTP proxy over `amico_sdk` with one in-memory
session. A browser selects its device by submitting device credentials to
`POST /login`. Device data is neither cached nor stored in a database.

---

## ⚠️ Security — read this before deploying anywhere but your own machine

**Device login and a backend session cookie now protect all device routes.**
This remains a trusted local deployment, without per-user authorization or TLS.
The following existing deployment and sensitive-action guardrails remain:

1. **Bind-address opt-in gate.** The server defaults to binding
   `127.0.0.1` only. If you set `BACKEND_BIND_ADDRESS` to anything
   else (e.g. `0.0.0.0` or a LAN IP), the server refuses to start
   unless you ALSO set `BACKEND_ALLOW_NETWORK_EXPOSURE=1`. **Do not
   set this unless you have already put a real authentication/
   authorization layer (a reverse proxy, an API gateway, a VPN — this
   backend provides none of these) in front of this server.**
2. **Sensitive-action confirmation header.** `PUT
   /users/:id/administrator` and `PUT /users/:id/password` both
   require the request header `X-Confirm-Sensitive-Action: yes`.
   Without it, the request is rejected with `428 Precondition
   Required` after a valid session-cookie check, before the device is contacted. This only prevents
   *accidental* invocation (a buggy client, a mistyped `curl`) — a
   deliberate caller can simply set the header.

---

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_BIND_ADDRESS` | `127.0.0.1` | See the security section above |
| `BACKEND_PORT` | `8080` | TCP port to listen on |
| `BACKEND_ALLOW_NETWORK_EXPOSURE` | unset | Must be `1` to allow a non-loopback `BACKEND_BIND_ADDRESS` |
| `BACKEND_FRONTEND_DIR` | `./frontend` | Directory served as static files at `/` (Giai đoạn 4) |

The backend starts logged out, with no `AMICO_*` variables required or read.
The four `BACKEND_*` settings above are unchanged.

## Session model

`POST /login` authenticates with the selected device and issues a random,
128-bit, hex-encoded `amico_session` cookie with `HttpOnly; SameSite=Lax; Path=/`.
Only `POST /login` and `GET /session` are cookie-exempt API routes. Static UI
assets remain public so the login page can load. All other registered routes,
including `/health` and `/logout`, reject missing, wrong, or stale cookies with
`401 {"error":"not logged in","type":"InvalidSessionError"}` before parsing
route input or calling the SDK. One mutex covers cookie validation and the
whole SDK operation.

There is one active device session across all browsers. A successful new login
attempts to log out the previous device and replaces its client and token; the
old browser cookie immediately stops working. Failed login attempts preserve
the old client, URL and cookie. Failure to contact the old device during cleanup
does not discard a successful new login. Logout always revokes local access;
if remote logout fails, its error is mapped normally and the clearing cookie
is still returned. Remote cleanup cannot be guaranteed for an unreachable device.

`GET /session` reports global backend session state, even to a caller without
a matching cookie. It does not validate the caller's cookie or probe the device.
A stale browser may initially see the main UI, then return to login when its
first gated request returns 401. Responses are not cached.

Login passwords live only in memory (including the active SDK configuration
for `autoRelogin=true`); they are never written to files, logs, browser storage,
or cookies. Remember saves only `deviceUrl` and `username` in `localStorage`.
The password field starts blank and clears on submission and logout.
Successful login reloads the page to discard all previous-device tab state,
then GET /session selects the view for the new session.

`SameSite=Lax` reduces cross-site CSRF for state-changing requests, but allows
cookies on top-level safe-method navigation and does not stop same-site attacks.
There is no separate CSRF token in this MVP. `HttpOnly` prevents JavaScript from
reading the cookie; it does not prevent requests from a compromised page. The
cookie is not `Secure` because this backend still uses plain HTTP. The existing
loopback default and explicit network-exposure opt-in remain required.

**Static frontend (Giai đoạn 4):** `amico_backend` also serves
`BACKEND_FRONTEND_DIR` as static files mounted at `/` — open
`http://<bind-address>:<port>/` in a browser to use the UI. Per
`cpp-httplib`'s actual dispatch order, **static files are checked
before any registered API route** for `GET`/`HEAD` requests — a file
in `BACKEND_FRONTEND_DIR` matching an API route's path would take
priority over that route. None of this API's `GET` routes collide with
a shipped frontend filename; avoid naming a new static asset the same
as an existing route path (e.g. `health`, `users` with no extension).

---

## Error response shape

API errors use `{"error": "<message>", "type":
"<ExceptionClassName>"}`, except the empty no-image 404 from
`GET /users/:id/image` described below.

Two categories of errors:

**1. Request-body/param errors (`type: "InvalidRequest"`, always `400`)**
— malformed JSON, a non-numeric path parameter or body field. These
never reach the device — the SDK is not called at all.

**2. Device/backend errors (mapped from the SDK's exception hierarchy,
`include/amico/Errors.hpp`)** — occur only after the request was
successfully parsed:

| Exception | HTTP status |
|---|---|
| `AuthenticationError` | 401 |
| `InvalidSessionError` | 401 |
| `ConfigurationError` | 500 |
| `NetworkError` (not `TimeoutError`/`TlsVerificationError`) | 502 |
| `TimeoutError` | 504 |
| `TlsVerificationError` | 502 |
| `HttpError` | the device's own status code, or 502 if invalid |
| `ProtocolError` | 502 |
| `JsonParseError` | 502 |
| `ResponseTooLargeError` | 502 |
| `UnsupportedOperationError` | 400 |
| any other error | 500 |

Plus: `404 Not Found` for `GET /users/:id` on a missing user, and `428
Precondition Required` for the two sensitive routes without the
confirmation header (see the security section).

---

## Routes

### `POST /login`
No cookie required. Body fields `deviceUrl`, `username`, and `password` must
all be strings. Missing fields, wrong types, or malformed JSON return 400
`InvalidRequest` before constructing a client. `deviceUrl` passes unchanged to
the SDK validator: include `http://` or `https://`; bare IPs, embedded credentials,
unsupported schemes, query strings and fragments are rejected with 500
`ConfigurationError`. Bad device credentials map to 401 `AuthenticationError`.
Error status/type use the existing mapping; the login error message is generic
to avoid echoing submitted credentials or device response text.

Success: `200 {"success":true}` and
`Set-Cookie: amico_session=<token>; HttpOnly; SameSite=Lax; Path=/`.
Failure sets no cookie and preserves any prior valid session.

### `POST /logout`
Requires the active cookie. Success: `200 {"success":true}` and
`Set-Cookie: amico_session=; Max-Age=0; Path=/`. The underlying device logout is
attempted and the local session is cleared even if that device is unreachable.

### `GET /session`
No cookie required. Returns `200 {"loggedIn":false}` or
`200 {"loggedIn":true,"deviceUrl":"http://192.0.2.1"}`. Never returns credentials
or a session token.

### `GET /health`
Requires the active session cookie. Checks reachability of the **currently
active device session** using `AmicoClient::checkReachable()`, returning
`200 {"status":"ok"}` for a reachable device. The SDK probe itself is a
non-authenticating GET; this does not revalidate device credentials.
This route no longer means backend-process liveness. Before login, it returns
401; a successful TCP connection or `GET /session` is the closest available
backend-liveness signal.

### `GET /system-information`
`200` with `AmicoClient::getSystemInformation()`'s fields:
```json
{
  "serial": "...", "firmwareVersion": "...", "secboxVersion": "...",
  "deviceName": "...", "deviceId": "...", "online": true,
  "network": {"mac": "...", "ip": "...", "netmask": "...", "gateway": "...",
              "sslEnabled": false, "selfSignedCertificate": false, "dhcpEnabled": true}
}
```

### `GET /users?limit=&offset=`
`200` with a JSON array of user objects (see the User object shape
below). `limit`/`offset` are optional integers.

### `GET /users/:id`
`200` with a single user object, or `404` if not found.

**User object shape** (every field `AmicoUser` has):
```json
{
  "id": 36, "name": "...", "registration": "...", "userTypeId": 0,
  "beginTime": 0, "endTime": 0, "lastAccess": 1789162715,
  "groupIds": [1, 2], "groupCount": 2, "cardCount": 1,
  "isAdministrator": false, "faceCount": 0, "bioCount": 0,
  "hasPassword": false, "imageUrl": "/users/36/image"
}
```
`hasPassword` is always a boolean — there is no field anywhere in this
API for a raw password/salt value; that boundary is structural, not a
convention (see `include/amico/Types.hpp`).

### `POST /users`
Body: `{"name": "...", "registration": "..."}`. `201 {"id": <newId>}`.

### `PATCH /users/:id`
Partial update — body: `{"name"?: "...", "registration"?: "..."}`
(either/both, omitted fields are left unchanged). `200 {"success":
true}`. An empty body `{}` is sent through unchanged and the device
reports it as a no-op change (`ProtocolError`, mapped to `502`) — this
is expected, not a bug.

### `DELETE /users/:id`
`200 {"success": true}`.

### `POST /users/:id/groups/:groupId`
Adds the user to the group. `200 {"success": true}`.

### `DELETE /users/:id/groups/:groupId`
Removes the user from the group. `200 {"success": true}`.

### `POST /users/:id/cards`
Body: `{"areaCode": <int>, "cardNumber": <int>}` — packed into the
device's own encoding (`areaCode * 4294967296 + cardNumber`) by the
SDK. `201 {"cardId": <newCardId>}`.

### `DELETE /cards/:cardId`
`200 {"success": true}`.

### `PUT /users/:id/administrator` — 🔒 requires `X-Confirm-Sensitive-Action: yes`
Body: `{"isAdmin": true|false}`. `200 {"success": true}`. Without the
header: `428`. A no-op if the user is already in the requested state
(matches the real device UI's own behavior).

### `GET /users/:id/image`
Requires the active `amico_session` cookie, like every other device route.
No request body. Returns `200` with raw image bytes and the device's
`Content-Type` (defaults to `image/jpeg` only when that header is absent).
The backend fetches `/user_get_image.fcgi?user_id=<id>` using its authenticated
SDK session. User objects expose this backend-relative route as `imageUrl`.

A device 404 means no image and returns `404` with an empty body, allowing
the frontend to show its existing placeholder. Other errors use the usual
JSON error mapping. Non-numeric or out-of-range IDs return `400 InvalidRequest`
before calling the SDK; missing or wrong cookies return `401 InvalidSessionError`
before ID validation. The device's actual no-image behavior remains pending
separately gated live verification.

### `PUT /users/:id/image`
Raw JPEG bytes as the request body (`Content-Type: image/jpeg`
recommended, not enforced). **This enrolls/updates the device's
face-recognition template for this user — it is not a cosmetic photo
store.** The device validates face detection/pose/sharpness; a
rejected image returns a mapped error (via `ProtocolError`, `502`)
whose message includes the device's own validation detail. `200
{"success": true}` on success.

### `DELETE /users/:id/image`
Removes the image AND the user's face-recognition template rows
(paired behavior, matching the device's own UI). `200 {"success":
true}`.

### `PUT /users/:id/password` — 🔒 requires `X-Confirm-Sensitive-Action: yes`
Body: `{"password": "<PIN or password string>"}`. The backend hashes
this via the device's own hashing command before sending — the
plaintext is never logged, never stored, and never returned by any
route. `200 {"success": true}`. Without the header: `428`. **There is
no route to read a password/PIN value back — this is a hard,
structural boundary, not a missing feature** (see
`feedback_never_expose_password_hash.md`).

### `GET /access-logs?from=&to=&limit=`
`200` with a JSON array:
```json
[{"id": 1, "time": 1789162715, "userId": 36, "portalId": 1, "logTypeId": 1, "event": 1}]
```
`userId`/`portalId` are `null` when the underlying entry has no value.
