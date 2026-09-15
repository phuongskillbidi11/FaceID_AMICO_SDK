# Calling the real AMICO device directly — no `amico_backend.exe` needed

Everything below talks straight to the device's own HTTP API
(`http://<device-ip>`) — **no service of ours has to be running.**
This is the same protocol `amico_backend`/`amico_sdk` themselves speak
underneath; every shape here is taken directly from this repo's own
SDK source (`src/ObjectQuery.cpp`, `src/Client.cpp`) and/or
live-confirmed discovery notes (`docs/amico-auth-flow.md`,
`docs/ui-action-protocol-map.md`), not guessed.

## ⚠️ Read this first

- **You lose every safety curation `amico_backend` normally gives
  you.** Calling the device directly means:
  - The raw `users` object's `password`/`salt` fields come back in
    plain query responses to anyone who can query it — our backend
    deliberately strips these; the device itself does not.
  - No `X-Confirm-Sensitive-Action` guard on Administrator/password
    writes — nothing stops an accidental call here.
  - No input validation/allowlisting — a malformed body just gets
    whatever error the device's own query engine returns.
- **Session cookies are never set by the server.** Unlike a normal web
  app, the device's login response never sends `Set-Cookie` — *you*
  build the `Cookie` header yourself from the JSON body's `session`
  field on every subsequent request (see below). This is confirmed
  device behavior, not an oversight in this doc.
- This device has no realtime push channel either (see
  `docs/backend-api.md`'s FAQ) — the same applies whether you go
  through our backend or straight to the device.

---

## 1. Login

```
POST http://<device-ip>/hidlogin.fcgi
Content-Type: application/x-www-form-urlencoded
Cookie: login=<username>

login=<username>&password=<password>
```

Response (200): `{"session": "<opaque token>"}` (24-character
alphanumeric, not a JWT). On bad credentials: `401`.

**Every request after this** must carry:

```
Cookie: login=<username>; session=<token from the login response>
```

There is no logout token invalidation check needed on your side — the
device tracks the session server-side; `POST /logout.fcgi` (empty
body, same cookie) ends it early if you want to. Live-verified this
session with `curl` — note the device's own web server (lighttpd)
returns `411 Length Required` for a POST with no body at all, so an
empty-body POST (`logout.fcgi`, `system_information.fcgi`) needs an
explicit empty body sent (`curl ... -d ""`; Postman's raw-JSON body
mode already sends a real, if empty, body so this only bites raw
`curl`/`fetch` callers).

## 2. The query language (`load_objects.fcgi` / `create_objects.fcgi` / `modify_objects.fcgi` / `destroy_objects.fcgi`)

Every object (users, groups, cards, access_logs, ...) is read/written
through these four generic endpoints, POSTing a small JSON body. Two
different `where` dialects both work (both used in this codebase):

- **Flat array** (list of clauses): `[{"field":"x","operator":"=","value":1}]`
  — omit `"operator"` for `"="`. Chain clauses with `"connector"`.
- **Nested object keyed by table** (used by the device's own generic
  Report engine, and by this SDK's Access Logs filters):
  `{"users": {"id": [1,2]}}`.

### List (`load_objects.fcgi`)
```json
{"join":"LEFT","object":"users",
 "fields":["id","name","registration","user_type_id","begin_time","end_time","last_access"],
 "where":[{"field":"user_type_id","operator":"=","value":0,"connector":"OR"},
          {"field":"user_type_id","operator":"IS NULL","connector":") AND ("}],
 "order":["name"],"limit":50,"offset":0,"finish":true}
```
Response: `{"users": [{...}, ...]}` — **includes raw `password`/`salt`
if you ask for those fields** (the device happily returns them; this
SDK's own field list above never asks for them).

Visitors are the *same* `users` object, filtered instead by
`user_types.id`:
```json
{"where":[{"field":"id","object":"user_types","value":1}], ...}
```

### Create (`create_objects.fcgi`)
```json
{"object":"users","values":[{"name":"ZZ_Test","registration":""}]}
```
Response: `{"ids":[<new id>]}`. Note `values` is a **one-element
array** here (not a bare object) — `create_objects` always wants an
array; `modify_objects` (below) always wants a bare object.

### Update (`modify_objects.fcgi`)
```json
{"object":"users",
 "values":{"name":"New Name","begin_time":1789347600,"end_time":1789513200},
 "where":{"users":{"id":50}}}
```
Response: `{"changes": <n>}` — `0` means nothing matched/changed
(treat as an error if you expected a real update).

### Delete (`destroy_objects.fcgi`)
```json
{"object":"users","where":{"users":{"id":[50]}}}
```
Response: `{"changes": <n>}`.

## 3. Other objects, same four verbs

| Object | Notes |
|---|---|
| `users` | see above. Writable fields this SDK uses: `name`, `registration`, `begin_time`, `end_time`, `password`+`salt` (see password flow below), `user_type_id` (create only, sets Visitors' type). |
| `user_groups` | membership rows. Add: `create_objects` with `values:[{"group_id":G,"user_id":U}]`. Remove: `destroy_objects` with `where:{"user_groups":{"group_id":[G],"user_id":U}}`. |
| `cards` | Add: `create_objects` with `values:[{"user_id":U,"value":<areaCode*4294967296+cardNumber>}]`. Remove: `destroy_objects` with `where:{"cards":{"id":[cardId]}}`. |
| `user_roles` | Administrator flag. Grant: `create_objects` with `values:[{"user_id":U,"role":1}]`. Revoke: `destroy_objects` with `where:{"user_roles":{"user_id":U,"role":1}}`. |
| `groups` | read-only lookup: `fields:["id","name"]`, no `where`. |
| `time_zones` | read-only lookup: `fields:["id","name"]`, no `where`. |
| `c_users` | CPF companion table (this device's config only). `fields:["id","cpf"]`, `where:{"c_users":{"user_id":U}}` to read; same create/modify/destroy pattern as `users`, keyed by `user_id`. |
| `access_logs` | `fields:["id","time","user_id","portal_id","log_type_id","event","identifier_id"]`. Filter by `time` (`>=`/`<=`, unix seconds) plus, with the nested dialect, `users`/`groups`/`time_zones` id lists. Count: same `where`, `fields:["COUNT(*)"]`. |
| `access_log_access_rules` → `access_rule_time_zones` → `time_zones` | 2-hop join this SDK does to resolve an access log's time-zone *name* — there is no direct `time_zone_id` on `access_logs` itself. |
| `portals` | read-only lookup: `fields:["id","name"]`. |

## 4. Face image (not a plain photo store)

```
GET  /user_get_image.fcgi?user_id=<id>          -> raw JPEG, or 404 if none
PUT  /user_set_image.fcgi?user_id=<id>&match=1&timestamp=<unix_seconds>
     Content-Type: image/jpeg
     <raw JPEG bytes as the body>
```
This **enrolls/updates the face-recognition template**, not just a
cosmetic photo — the device validates face detection/pose/sharpness
and rejects unclear images with a descriptive error. `match=1` and
`timestamp=` are both required — omitting either produced `400` in
this project's own discovery pass.

```
POST /user_destroy_image.fcgi   body {"user_id": <id>}
```
Removes the image. The real UI's own flow also separately destroys
the user's `face_templates` rows via `destroy_objects.fcgi` right
after — do the same if you want exact parity (see
`src/Client.cpp`'s `removeUserImage`).

## 5. Password / PIN (never readable back — by design)

```
POST /user_hash_password.fcgi   body {"password": "<plaintext>"}
-> {"password": "<hash>", "salt": "<salt>"}
```
Then write `password`/`salt` via `modify_objects.fcgi` (see the
`users` update shape above). **There is no endpoint that returns a
password/PIN in plaintext or lets you verify one out-of-band** — this
is a device-level boundary, not something either backend adds.

## 6. System information

```
POST /system_information.fcgi   (empty body)
```
Returns serial, firmware/secbox versions, device name/id, online
status, and network info (MAC/IP/netmask/gateway/SSL/DHCP).

## 7. Health / reachability

There is no dedicated device-side "health" endpoint. `amico_backend`'s
own `GET /health` just sends a plain `GET /` and checks it doesn't
error — you can do the same directly: `GET http://<device-ip>/` with
no cookie; any successful HTTP response means the device is up.

---

See `docs/postman/amico_device_direct.postman_collection.json` for a
ready-to-import collection covering all of the above.
