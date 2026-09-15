# `amico_backend` — HTTP API reference

`amico_backend` is a JSON/HTTP proxy over `amico_sdk` with one in-memory
session. A browser selects its device by submitting device credentials to
`POST /login`. Device data is neither cached nor stored in a database.

> This file documents only the routes that exist today. For the full
> roadmap against the real device's complete sidebar menu (Visitors,
> Groups management, Time Zones, Reports, Settings, Alarms, etc. --
> implemented, evidence-backed-but-not-yet-built, or still needing
> discovery), see `docs/api-roadmap.md`.

---

## FAQ

**Does `amico_backend.exe` need to be running to call this API?**
Yes. Every route below is served *by this process* (a plain HTTP
server, `cpp-httplib`) — there is nothing to call if it isn't running.
It in turn proxies to the real AMICO device over HTTP; the device does
not need to be reachable for the process to start and answer routes
like `GET /session`, but any route that talks to the device (almost
all of them, once logged in) will fail if the device is unreachable.

**Is there a WebSocket/SSE/realtime push channel for live events
(e.g. access events as they happen)?**
No — checked directly in this codebase (`backend/`, `src/`): there is
no WebSocket, Server-Sent Events, or any other push mechanism today.
Every route here is plain request/response. The real device's own web
UI doesn't push either — its dashboard polls
`POST /load_objects.fcgi`/`POST /alarm_status.fcgi` roughly once a
second (see `docs/amico-auth-flow.md`); if you need near-real-time
access events in your own client, the equivalent today is polling
`GET /access-logs?limit=1&offset=0` (or a small `limit`) on your own
interval and diffing against the last-seen `id`/`time` — there is no
push-based alternative to build against yet.

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

### Recommended deployment: nginx in front, backend stays localhost-only

Instead of setting `BACKEND_BIND_ADDRESS=0.0.0.0`/`BACKEND_ALLOW_NETWORK_EXPOSURE=1`
(which exposes the backend to the *entire* local network on this
machine), put nginx in front as the only externally-reachable process
and leave the backend on its default `127.0.0.1:8080` binding. This
project's own deployment (2026-09-15) uses this pattern to expose the
backend to teammates over a NetBird mesh VPN, without exposing it to
the wider LAN at all:

```
NetBird peer ──► nginx (<netbird-ip>:80) ──► amico_backend (127.0.0.1:8080, localhost-only)
```

1. Run `amico_backend.exe` with **no** `BACKEND_BIND_ADDRESS`/
   `BACKEND_ALLOW_NETWORK_EXPOSURE` set — it defaults to
   `127.0.0.1:8080`.
2. Install nginx for Windows (`https://nginx.org/en/download.html`,
   the "stable" build — a plain zip, no installer), extract to e.g.
   `C:\nginx`.
3. In `C:\nginx\conf\nginx.conf`, add a `server` block inside `http {}`:
   ```nginx
   server {
       listen <your-netbird-ip>:80;   # NOT 0.0.0.0 -- binding to the
                                       # NetBird interface's own IP means
                                       # only traffic arriving over the
                                       # NetBird mesh can ever reach this
                                       # port; anyone off that mesh (the
                                       # wider LAN, the internet) sees
                                       # nothing listening there at all.
       server_name _;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_http_version 1.1;
           proxy_set_header Connection "";
       }
   }
   ```
   Find your own NetBird IP via `ipconfig` (look for the
   `netbird.cloud`-suffixed adapter).
4. Start it: `C:\nginx\nginx.exe` (test config first with
   `nginx.exe -t`; reload after edits with `nginx.exe -s reload`).
5. Other NetBird peers reach the app at `http://<your-netbird-ip>/`
   (port 80, no `:8080` needed) — the backend itself is never directly
   reachable off this machine.
6. Optional: run nginx as a Windows service (e.g. via NSSM,
   `https://nssm.cc/`) so it survives logout/reboot without a console
   window open.

This keeps guardrail 1 above meaningfully intact — the backend process
itself never opts into network exposure — while still letting a real
front door (here, nginx bound to a VPN-only interface) do the actual
gatekeeping, exactly as guardrail 1's own warning recommends.

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
  "hasPassword": false, "imageUrl": "/users/36/image", "cpf": null
}
```
`hasPassword` is always a boolean — there is no field anywhere in this
API for a raw password/salt value; that boundary is structural, not a
convention (see `include/amico/Types.hpp`). `cpf` is `null` unless a
`c_users` companion row exists for this user (Visitors plan,
2026-09-14, see below) — never an empty string.

### `POST /users`
Body: `{"name": "...", "registration": "..."}`. `201 {"id": <newId>}`.

### `PATCH /users/:id`
Partial update — body: `{"name"?: "...", "registration"?: "...",
"beginTime"?: <unix seconds>, "endTime"?: <unix seconds>}` (any subset,
omitted fields are left unchanged). `200 {"success": true}`. An empty
body `{}` is sent through unchanged and the device reports it as a
no-op change (`ProtocolError`, mapped to `502`) — this is expected, not
a bug. `beginTime`/`endTime` (LIVE-CONFIRMED 2026-09-14 via the real
device's own per-user-type "Default Users" edit form — a different,
narrower code path than the base `user.js`'s own `save()`, which does
not send them) map straight to the device's `begin_time`/`end_time`
fields; there is no confirmed way to *clear* one back to unset through
this route — send `0` explicitly if you need that (unconfirmed
semantics, works in practice: the device accepts it and reports back
`0`/no restriction).

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

## Visitors (Enroll → Visitors)

Same underlying `users` object as `/users/*` above, filtered to
`user_type_id = 1` (LIVE-CONFIRMED shape — see
`.plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md`
for the full evidence trail, including how `user_type_id` gets set on
create and how the CPF field's `c_users` companion table works). Every
route below has the identical request/response shape as its `/users/*`
counterpart — only the path prefix and the `user_type_id` filter/value
differ:

`GET /visitors?limit=&offset=`, `GET /visitors/:id`,
`POST /visitors` (body may include `"cpf"`, same shape as `/users`
otherwise — `user_type_id` is never accepted from the request body,
the route sets it to `1` itself),
`PATCH /visitors/:id` (partial update, may include `"cpf"`),
`DELETE /visitors/:id`,
`POST /visitors/:id/groups/:groupId`,
`DELETE /visitors/:id/groups/:groupId`,
`POST /visitors/:id/cards`,
`GET /visitors/:id/image`, `PUT /visitors/:id/image`,
`DELETE /visitors/:id/image`,
`PUT /visitors/:id/password` — 🔒 requires
`X-Confirm-Sensitive-Action: yes`, same as `/users/:id/password`.

**Not implemented for Visitors** (matches the real device's own
confirmed form, which has no such control): `PUT /visitors/:id/administrator`
— no route exists. Card removal is shared and type-agnostic:
`DELETE /cards/:cardId` works for both Users' and Visitors' cards, no
separate `/visitors` variant.

**CPF** (`cpf` field on the User object shape above, `c_users` table):
a Brazil-region custom field, hardcoded for this device's specific
`user_type_id = 1` configuration — not a generic "Custom Fields"
implementation (that remains a separate, undiscovered roadmap item;
see `docs/api-roadmap.md`). Setting it on create/update issues a
second device call after the main user record saves (mirroring the
real device's own two-call `afterSave` mechanism); removing a
user/visitor also issues a defensive `c_users` cleanup call first
(whether the device cascades this on its own is unconfirmed).

## Visits (Enroll → Visits)

A genuinely distinct device object from `/users`/`/visitors` (its own
PK/fields), not a filter variant of Users — see
`.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md` for
the full evidence trail (including the live-captured `create_objects.fcgi`
payload). A visit links a visitor (a `/visitors` row) to a host (a
regular `/users` row) with a scheduled start/end time window.

### `GET /visits?limit=&offset=`
Session required. Lists **active/upcoming visits only** — matches the
real device's own default filter (`finished != 1`); there is no
"include finished" toggle. `200` response, one entry per row:
```json
{"id": 7, "visitorId": 56, "hostId": 50, "visitorName": "VIP",
 "hostName": "Man City", "beginTime": 1789405080, "endTime": 1789466400,
 "finished": false, "cardCount": 0}
```
`visitorName`/`hostName` are resolved server-side (reusing the same
batched user-name lookup the Access Logs report uses); `cardCount` is
the visitor's own card count (cards belong to the visitor, not the
visit — see the Cards note below).

### `GET /visits/:id`
Session required. Same shape as above, `404 {"error": "visit not
found", "type": "NotFound"}` if absent. No `finished` filter — a
specific known id is returned regardless of state.

### `POST /visits`
Body: `{"visitorId": <id>, "hostId": <id>, "beginTime": <epoch seconds>,
"endTime": <epoch seconds, optional, default 0 = open-ended>}`. `201
{"id": <new visit id>}`.

### `PATCH /visits/:id`
Body: any subset of `visitorId`/`hostId`/`beginTime`/`endTime`. **A
`"finished"` key in the body is silently ignored** — there is no
generic-update path for it; use `POST /visits/:id/finish` instead (see
below — this is a deliberate design choice, not an oversight: marking
a visit finished has a real device-side side effect that a plain field
edit must never trigger silently). `200 {"success": true}`.

### `DELETE /visits/:id`
`200 {"success": true}`. **Does NOT revoke any cards already issued to
the visitor** — only `POST /visits/:id/finish` does that (see below).
Removing a visit is just removing the schedule record.

### `POST /visits/:id/finish`
No request body. **Real device-side write with a side effect**: revokes
every card currently issued to this visit's visitor (`destroy_objects.fcgi`
on `cards` filtered by the visitor's user id — the same behavior the
real device's own client code performs when a visit is marked
concluded), then sets `finished = true` and `endTime = <now>` on the
visit. `200 {"success": true}`. No `X-Confirm-Sensitive-Action` header
required — this project's existing convention only requires that
header for credential/firmware/license-tier writes (password/PIN,
Administrator); card-revocation-tier writes (this, and the existing
`DELETE /cards/:cardId`) don't need it.

**Cards on a visit**: a visit's Cards tab reuses the already-existing
`POST /visitors/:visitorId/cards` / `DELETE /cards/:cardId` — keyed by
the visit's own `visitorId`, not a separate `/visits/:id/cards` route.
Cards belong to the visitor (a `/visitors` row), not to the visit
record itself.

**Not yet implemented**: search/filter on `GET /visits` (the real
device's own filters — visitor's name/id/card — are documented but not
wired into this endpoint), and a "show finished visits" history view.

### `GET /groups`
Session required. Read-only list of group IDs and names; no pagination or
write operations on this route. `200` response:
```json
{"groups": [{"id": 1, "name": "Staff"}]}
```
An empty list returns `{"groups": []}`. The SDK requests only `id` and
`name` from the device's `groups` object, with no `where` constraint.

### `GET /timezones`
Session required. Read-only list of time-zone IDs and names, using the
existing SDK `timeZones().list()` method. `200` response:
```json
{"timezones": [{"id": 1, "name": "Always Allowed"}]}
```
An empty list returns `{"timezones": []}`. The SDK requests only `id` and
`name` from `time_zones`. Both lookup routes return `401` without a valid
session and use the standard backend error mapping for device failures.

### `GET /access-logs?from=&to=&limit=&offset=&userIds=&groupIds=&timeZoneIds=`
Session required. Optional `userIds`, `groupIds`, and `timeZoneIds` accept
signed 64-bit integer IDs, comma-separated and/or repeated. For example:
`/access-logs?userIds=36,50&userIds=70&groupIds=1&timeZoneIds=2&from=100&to=200&limit=10&offset=0`.
Empty values (including empty comma-separated items) are ignored;
absent or entirely empty filters mean “(All)”. Malformed or overflowing
IDs return `400` before any SDK request. Each list selects IDs in that
category, and populated categories combine with the inclusive Unix-second
`from`/`to` bounds. The page and total count receive identical filters.

With any non-empty ID filter, the device request uses a nested `where`:
```json
{"access_logs":{"time":{">=":100,"<=":200}},"users":{"id":[36,50,70]},"groups":{"id":[1]},"time_zones":{"id":[2]}}
```
Unselected category keys are omitted. With all three ID filters unset or
empty, the pre-existing flat date-condition array is preserved byte for
byte (an empty array without dates). User/Time Zone filtering and omitted
category-key behavior still await the separately approved Task 8 live
device verification; offline tests verify request construction.

`200` with `{"entries": [...], "total": N}` — matches the real
device's own "Access (Global)" report page column-for-column
(discovered and evidence-backed in `.plans/2026-09-14-redesign-access-logs-frontend-and-backen/spec.md`):
```json
{
  "entries": [
    {
      "id": 220, "time": 1789193977, "userId": 36, "portalId": 1,
      "logTypeId": -1, "event": 7, "identifierId": 1717658368,
      "userName": "Phuong Hoang", "employeeId": "", "portalName": "Portal",
      "timeZoneName": "Always Allowed",
      "authorizationLabel": "Granted", "identificationLabel": "Facial"
    }
  ],
  "total": 158
}
```
`userId`/`portalId` are `null` when the underlying entry has no value.
`userName`/`employeeId`/`portalName`/`timeZoneName` are `""` (never
`null`, never omitted) when no matching user/portal/time-zone could be
resolved — e.g. a `userId` of `0` (no user), or an access log with no
matching access rule at any hop of the time-zone join (see spec.md
Decision 2b: `access_logs` has no direct `time_zone_id` field; the
name is resolved through `access_log_access_rules` →
`access_rule_time_zones` → `time_zones`).
`authorizationLabel`/`identificationLabel` are computed server-side by
porting the real device's own `report.js` rendering logic
(`src/AccessLogLabels.hpp`) — `authorizationLabel` is one of `"Granted"`
/ `"Not authorized"` / `"Not recognized"`; `identificationLabel` is one
of `"Facial"` / `"Card"` / `"PIN"` / `"Password"` / `"QR Code"` /
`"Biometry"` / `"REX button"` / `"Web Interface"` / `"Intercom"` /
`"Unknown"` (the last only for a tag this device has never been
observed to send).
`offset` (new) paginates the same way `GET /users` already does;
`total` is the count of matching rows across the date window and selected
User/Group/Time Zone filters, not just the current page. Both the page and
the count use identical `where` constraints.

The frontend Export button downloads CSV of the currently displayed page
only, with the displayed column labels and formatting; it makes no API
request and does not export all pages. PRINT uses `window.print()` with a
stylesheet showing only the report heading and table.
