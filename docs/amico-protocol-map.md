# AMICO VL70LF Web UI — HTTP protocol map

Target device: `192.168.2.156`, Web UI root `http://192.168.2.156/`, firmware
terminal `2.4.5`, EAM/secbox firmware `2.2.3` (both confirmed live via
`system_information.fcgi`, see below). Scope: read-only protocol discovery —
login was performed (device owner supplied credentials directly), but no
create/update/delete action was ever issued.

## Evidence source for this revision

A live browser session (Chrome via chrome-devtools-mcp) was driven directly
against `192.168.2.156`: login → browse dashboard → logout. Every endpoint,
method, header set and JSON shape in this revision comes from that session's
Network panel, cross-checked against the Web UI's own JavaScript
(`/en_US/js/login.js`, `/assets/scripts/app.js`). No `.pcapng`/`.har`/`.saz`
file was supplied or produced as a file artifact for this revision — see
"Evidence categories" below for why this still counts as first-class
evidence and captures/README.md for how to add a saved-capture file later.

Screenshots: `captures/screenshots/01_login_page.png`,
`02_dashboard_after_login.png`, `03_after_logout.png`.
Raw saved payload: `artifacts/live_capture/object_metadata_response.network-response`
(full DB/object schema, see below) and `artifacts/live_capture/object_catalog.json`
(extracted summary).

## Platform fingerprint

- Web server: `lighttpd/1.4.51` (from `Server` response header).
- Application layer: **FastCGI** — every API call is a `*.fcgi` script, not a
  REST framework with a shared base path. There is no `/api/...` prefix
  anywhere; each capability is its own script at the web root.
- Every response (including sensitive ones) carries
  `Access-Control-Allow-Origin: *` and
  `Access-Control-Allow-Headers: origin, x-csrftoken, content-type, accept`.
  See "Security observations" below.
- No HTTPS: the device serves plain HTTP on port 80 by default
  (`system_information.fcgi` confirms `"ssl_enabled":false`,
  `"self_signed_certificate":true` — SSL is present but off by default).

## Confirmed authentication + session model

See `docs/amico-auth-flow.md` for the full sequence. Summary:

- Login: `POST /hidlogin.fcgi`, body `application/x-www-form-urlencoded`
  with fields `login` and `password` (**not** `username`/`user`, and **not**
  JSON).
- On success, the JSON response carries a `session` field; the Web UI's own
  JS then does `document.cookie = "session=" + data.session + "; path=/"` —
  i.e. the **server does not set the session via `Set-Cookie`**, the client
  JS manufactures the cookie itself from a JSON field. A companion
  `login=<username>` cookie is also set by the client (non-secret, just the
  username) before the login call is even made.
- Every subsequent authenticated request carries both cookies:
  `Cookie: login=<username>; session=<opaque token>`.
- Session validity check: `GET /session_is_valid.fcgi` → `{"session_is_valid": bool}`.
  Confirmed both pre-login (`false`) and post-logout (`false`, even though
  the client still had a stale `session` cookie — the server-side session
  was actually invalidated, not just the client's belief about it).
- Logout: `GET /logout.fcgi` → empty JSON object, then the SPA redirects to
  `/en_US/html/login.html`.
- No CSRF token was actually sent on any request in this session, despite
  `x-csrftoken` being explicitly allow-listed in every response's
  `Access-Control-Allow-Headers` — either CSRF protection exists but wasn't
  exercised by this particular UI flow, or the header is legacy/unused.
  Not confirmed either way.

## The core finding: a generic object-query engine, not a per-resource REST API

Almost every dashboard widget is powered by **one generic endpoint**,
`POST /load_objects.fcgi`, given a small query-builder JSON body:

```json
{
  "object": "access_logs",
  "join": "LEFT",
  "fields": ["id", "time", "user_id", "portal_id", "log_type_id", "event"],
  "where": [{"field": "time", "value": 1789162596, "operator": "<=", "connector": ") AND ("}],
  "order": ["time", "descending"],
  "limit": 7,
  "offset": 0
}
```

`object` names a table; `fields` can reference joined tables
(`{"object":"custom_tables","field":"name"}`); `where` builds an arbitrary
SQL-style filter (including a raw `connector` string that is literally
concatenated into the SQL `WHERE` clause — `") AND ("` etc. — which is a
strong signal the backend builds SQL by string concatenation rather than
parameterized queries, see security note below). The response is
`{"<object>": [ {...}, {...} ]}`.

The full set of valid `object` values — i.e. the entire device data model —
is discoverable read-only via `POST /object_metadata.fcgi` (body `{}`),
which returned a **90-object schema** (field names, types, primary/foreign
keys, join paths) in this session. Saved at
`artifacts/live_capture/object_metadata_response.network-response`;
summarized at `artifacts/live_capture/object_catalog.json`. Objects include
(non-exhaustive): `users`, `access_logs`, `access_events`, `access_rules`,
`devices`, `portals`, `areas`, `groups`, `time_zones`, `cards`, `pins`,
`qrcodes`, `face_templates`, `alarm_logs`, `alarm_zones`, `audit_logs`,
`api_logins`, `api_access_levels`, `api_commands`, `holidays`,
`identification_rules`, `visits`, `whitelist`, and more.

This single discovery means the C++ SDK's "list users" / "access logs" /
etc. read operations are **not separate hand-coded endpoints** — they are
all the same `load_objects.fcgi` call with a different `object` name. See
the revised interface proposal below.

The companion generic **settings** endpoints are `POST /get_configuration.fcgi`
(read) and `POST /set_configuration.fcgi` (write, `JS_CONFIRMED` only —
never called in this read-only session), both keyed by a
`{"<section>": ["<key>", ...]}` / `{"<section>": {"<key>": <value>}}` shape,
e.g. confirmed live: `{"face_id":["qrcode_legacy_mode_enabled"]}` →
`{"face_id":{"qrcode_legacy_mode_enabled":"1"}}`.

## Security observations (informational — no exploitation attempted)

These are direct observations from this authorized, read-only session, not
findings from any additional probing:

1. **`load_objects.fcgi` on `object:"users"` returns password hash + salt in
   the same response as every other user field**, to any session that can
   authenticate. The Web UI's own dashboard code triggers this query just to
   render a user's display name/photo card. This means the salted hash is
   present in ordinary browser memory/DOM-adjacent JS state during normal
   use, not just under a dedicated "export" action. The SDK must never log,
   cache to disk, or forward this field, and should treat it the same as any
   other credential material even though the wire protocol does not.
2. **`where.connector` looks like raw SQL fragment concatenation**
   (`") AND ("`, `"AND"` appear verbatim in request bodies the UI itself
   sends). This is a strong signal, not a confirmed vulnerability — no
   injection was attempted — but it means the SDK should never construct
   `load_objects.fcgi`/`get_configuration.fcgi` bodies from unsanitized
   caller input, and any future security review of this device should look
   at this endpoint first.
3. **Wildcard CORS (`Access-Control-Allow-Origin: *`) on cookie-authenticated,
   state-mutating endpoints** (e.g. `hidlogin.fcgi`, `load_objects.fcgi`)
   is unusual for a cookie-session design and worth a dedicated CSRF/CORS
   review — out of scope for this protocol-discovery pass.
4. **`GET /user_get_image.fcgi?user_id=<int>`** takes a small sequential
   integer with no visible ownership check exercised in this session
   (not tested against a foreign session) — worth checking for IDOR in a
   follow-up authorized test, not attempted here.
5. The `object_metadata.fcgi`/`load_objects.fcgi` combination reveals
   `api_logins`, `api_access_levels`, `api_commands`, `object_field_commands`
   tables — this strongly suggests the device has a **separate, more formal
   "API" layer** (distinct from these Web-UI-internal `.fcgi` scripts),
   matching the user guide's mention of "opening a door via the API". That
   layer was not explored in this session (no separate API credentials were
   provided) and remains `INFERRED`.

### Update — P1/P2 discovery pass (2026-09-11, second session)

A follow-up read-only session (see `docs/ui-action-protocol-map.md` for
full detail) visited the dedicated Users/Groups/Time-Zones/Reports pages
and statically read `configurations.js` (the Settings page's script,
477KB). This substantially raises the confidence of, and adds to, the
findings above:

6. **Two more sensitive `users` fields exist**: `panic_password` and
   `panic_salt` (a duress/panic-credential mechanism), neither seen in the
   first session. They surfaced because a report-page dropdown queried
   `object:"users"` **with no `fields` restriction at all** — confirming
   that omitting `fields` returns the complete row, not just a safe
   default subset. The SDK must treat `panic_password`/`panic_salt`
   identically to `password`/`salt`: never requested, logged, or forwarded.
7. **The device's real command surface is ~78 distinct operations**, not
   the dozen or so `.fcgi` scripts the dashboard happens to call. Every one
   of them is dispatched through one client-side function,
   `MessengerUtil.send(command, data)`, which builds `POST /<command>.fcgi`
   for whatever `command` string is passed — see
   `artifacts/live_capture/messenger_commands.json` for the full list and
   `docs/ui-action-protocol-map.md` for which ones map to the task's
   prohibited write operations (factory reset, firmware/network/date-time
   update, license change, credential changes, relay/turnstile control,
   generic object create/update/delete, import). None were invoked; their
   existence and dispatch mechanism were confirmed by reading source only.
8. **The Users-page search box confirms observation #2 more concretely**:
   typing a query adds a `where` clause whose `value` is a raw SQL `LIKE`
   wildcard pattern (`"%Phat%"`), built directly from the search text and
   joined to the other filters via the same string-concatenation-shaped
   `connector`. Still an observation, not a tested vulnerability — no
   injection payload was attempted — but it is now confirmed that ordinary
   user-supplied UI input (not just fixed filter values) flows into this
   mechanism.
9. **The `where` clause shape is not even consistent across the API**: most
   objects take `where` as an array of clause objects, but `object:"reports"`
   and `object:"report_filters"` instead take a nested object keyed by the
   object name (`{"reports":{"id":1}}`). Any future SDK query builder must
   not assume one universal `where` shape.
10. **Cookie attribute note** (requested check): the `session` cookie is
    created entirely client-side via `document.cookie = "session=" + ...`
    (confirmed in `login.js`, Phase 1). A cookie set this way structurally
    cannot carry the `HttpOnly` attribute — browsers do not expose any way
    for `document.cookie` writes to set it; `HttpOnly` can only arrive via
    a server's `Set-Cookie` response header, which this login flow never
    sends. This is a structural conclusion from reading the mechanism, not
    a guess: the session cookie is confirmed readable by any JavaScript
    running in the page (e.g. an XSS payload), which is a meaningfully
    different risk profile than a `HttpOnly` session cookie would have.

## Evidence categories (used throughout these docs)

| Category | Meaning |
|---|---|
| `LIVE_CONFIRMED` | Observed directly in this session's live browser Network panel (equivalent evidentiary weight to a HAR capture of the same traffic). |
| `PCAP_CONFIRMED` | Observed directly in a packet capture file. |
| `HAR_CONFIRMED` | Observed directly in a `.har` capture file. |
| `JS_CONFIRMED` | Found in the Web UI's own JavaScript source, not yet observed on the wire. |
| `UI_HANDLER_CONFIRMED` | A write control's JS handler/payload-builder was read statically; the action itself was never invoked and no request/response was observed. Weaker than `JS_CONFIRMED` in the same way — no wire confirmation at all. |
| `DOCUMENTED` | Stated in vendor documentation, not observed in traffic or JS. |
| `INFERRED` | A hypothesis with no direct evidence — must be verified before use. |

## Proposed C++ SDK interface (revised for the generic query engine)

```cpp
namespace amico {

class Session {
public:
    bool isValid() const;   // GET /session_is_valid.fcgi
private:
    struct Impl;             // holds the "login" + "session" cookie pair; never logged/serialized
    std::unique_ptr<Impl> impl_;
};

struct Credentials {
    std::string login;      // NOTE: field name is "login", confirmed wire-level, not "username"
    std::string password;   // never logged
};

struct DeviceInfo {         // POST /system_information.fcgi, confirmed schema
    std::string serial;
    std::string firmwareVersion;      // "version" e.g. "2.4.5"
    std::string secboxVersion;        // "secbox_version" e.g. "2.2.3"
    std::string deviceName;
    NetworkInfo network;              // mac, ip, netmask, gateway, dns, hostname, port, ssl_enabled...
    // uptime, memory, license, biometrics limits also present in the schema
};

// Generic query, mirroring POST /load_objects.fcgi. This is the mechanism
// behind ALL list-style reads (users, access_logs, access_events, devices,
// portals, ...) — see docs/amico-protocol-map.md's object catalog.
struct QueryFilter {
    std::string field;
    std::string op = "=";           // "=", "!=", "<=", ">=", ...
    Json value;
    std::string connector = "AND";  // NEVER build this from unsanitized input — see security notes
};

struct ObjectQuery {
    std::string object;                 // e.g. "users", "access_logs" — see artifacts/live_capture/object_catalog.json
    std::vector<std::string> fields;
    std::vector<QueryFilter> where;
    std::vector<std::string> order;
    int limit = 0;
    int offset = 0;
};

class AmicoClient {
public:
    explicit AmicoClient(std::string baseUrl);   // e.g. "http://192.168.2.156"

    Session login(const Credentials& creds);       // POST /hidlogin.fcgi
    bool checkSession(const Session& session);     // GET /session_is_valid.fcgi
    DeviceInfo getDeviceInfo(const Session& session); // POST /system_information.fcgi
    Json loadObjects(const Session& session, const ObjectQuery& query); // POST /load_objects.fcgi
    Json getObjectMetadata(const Session& session);   // POST /object_metadata.fcgi (cache this — 90 objects, ~73KB)
    Json getConfiguration(const Session& session, const Json& sectionsAndKeys); // POST /get_configuration.fcgi
    std::vector<uint8_t> getUserImage(const Session& session, int64_t userId);  // GET /user_get_image.fcgi?user_id=
    void logout(Session& session);                 // GET /logout.fcgi

    // Convenience wrappers over loadObjects(), NOT separate wire endpoints:
    Json listUsers(const Session& session, /* filter/paging */);     // object="users" — MUST redact/drop password+salt fields before returning to callers
    Json getAccessLogs(const Session& session, /* time range */);    // object="access_logs"

private:
    std::string baseUrl_;
    // Transport: cookie jar carrying "login" + "session"; both required on every authenticated call.
};

}  // namespace amico
```

Deliberately **not** proposed yet: `setConfiguration`/`set_configuration.fcgi`
(write, `JS_CONFIRMED` only), any user create/update/delete, `finish_init_language.fcgi`/
`accept_legal_terms.fcgi` (first-run-only flow, `JS_CONFIRMED` only, not
exercised), and anything on the separate `api_logins`/`api_commands` layer
(existence only `INFERRED` from the schema — needs its own credentials and
its own discovery pass before any interface is proposed for it).
