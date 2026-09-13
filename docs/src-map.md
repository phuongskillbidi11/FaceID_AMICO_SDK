# Source tree map

> **How to use this file:** when a sprint adds a new module or changes
> what an existing entry describes, update its row here as that sprint's
> last task — this file should always describe what actually exists, not
> what once existed or is planned.

## C++ SDK (`amico_sdk`)

| Path | What lives there |
|---|---|
| `include/amico/Config.hpp` | `AmicoConfig` — all client configuration (base URL, credentials, timeouts, size caps, page size caps, `autoRelogin`, `logSink`). |
| `include/amico/Errors.hpp` | The exception hierarchy (`AmicoError` base + `ConfigurationError`, `NetworkError`, `TimeoutError`, `TlsVerificationError`, `AuthenticationError`, `InvalidSessionError`, `HttpError`, `ProtocolError`, `JsonParseError`, `ResponseTooLargeError`, `UnsupportedOperationError`); the new `TlsVerificationError` derives from `NetworkError` for peer-certificate TLS verification failures. |
| `include/amico/Cancellation.hpp` | `CancellationToken` — optional cooperative cancellation for in-flight requests. |
| `include/amico/Types.hpp` | Public data types: `SystemInformation`, `NetworkInfo` (including `NetworkInfo::selfSignedCertificate`), `AmicoUser`, `UserQuery`, `AccessLogEntry`, `AccessLogQuery`, and (Giai đoạn 2) `NewUser`/`UserUpdate` — write parameters for `UsersApi::create/update`, deliberately limited to `name`/`registration` only. (Giai đoạn 2b) `AmicoUser` extended with `groupIds`/`groupCount`/`cardCount`/`isAdministrator`/`faceCount`/`bioCount`/`hasPassword`/`imageUrl` — `hasPassword` is boolean-only, no member anywhere can carry a raw password/salt value. `UserImage` carries image bytes and content type. |
| `include/amico/Client.hpp` | `AmicoClient` — the public entry point (`login`, `isSessionValid`, `getSystemInformation`, `logout`, `users()`, `accessLogs()`, `debugGetObjectMetadataJson()`), plus credential-free reachability probing via `AmicoClient::checkReachable()` and the `UsersApi`/`AccessLogsApi` nested classes. `UsersApi` now also has `create(const NewUser&)`, `update(const UserUpdate&)`, `remove(int64_t id)` (Giai đoạn 2 — the SDK's first write API). (Giai đoạn 2b) `addToGroup`/`removeFromGroup`, `addCard`/`removeCard`, `setAdministrator`, `setImage`/`removeImage`, `setPassword` (write-only, hashes via `user_hash_password` first). `UsersApi::getImage(int64_t)` returns `UserImage` through an authenticated GET. |
| `src/NetworkSafety.hpp` / `src/NetworkSafety.cpp` | Shared decision logic behind `test/live/live_smoke_test.cpp`'s preflight and TLS-probe steps: `reachableThenLogin()` gates login on a successful credential-free reachability probe; `probeHttpsIfEnabled()` runs a conditional secondary HTTPS/TLS probe only when `NetworkInfo::sslEnabled` is true, distinguishing verified TLS, verification failure, and network failure (otherwise not applicable). |
| `src/Session.hpp` / `.cpp` | In-memory-only holder of the `login`/`session` cookie pair; RAII zero-wipe on clear/destroy. Never persisted, never logged. |
| `src/JsonRedact.hpp` / `.cpp` | `redactJson()` — recursive, case-insensitive sensitive-key redaction for diagnostics/logging. Secondary defense; the primary defense is `ObjectQuery` never requesting sensitive fields in the first place. |
| `src/UrlValidation.hpp` / `.cpp` | `validateBaseUrl()` — rejects embedded credentials, non-http(s) schemes, query strings, fragments. |
| `src/http/HttpTransport.hpp` | `IHttpTransport` interface + `HttpRequest`/`HttpResponse`/`HttpHeader` plain structs. The DI seam offline tests use (`test/FakeTransport.hpp` implements this interface instead of `CurlTransport`). |
| `src/http/CurlTransport.hpp` / `.cpp` | The only production `IHttpTransport`: libcurl-based, TLS verify always on, redirects disabled, response/header size caps, optional cancellation. |
| `src/ObjectQuery.hpp` / `.cpp` | **Internal, not installed.** The entire read (`load_objects.fcgi`) and write (`create_objects`/`modify_objects`/`destroy_objects`.fcgi) body-builder surface this SDK uses: `buildUsersListBody()`, `buildUserGetBody()`, `buildAccessLogsListBody()`, and (Giai đoạn 2) `buildUserCreateBody()`, `buildUserUpdateBody()`, `buildUserDeleteBody()`. No function here accepts a caller-supplied object/field/connector string; write builders are limited to `kUserWritableFields` (`name`, `registration` only — never password/salt/panic_password/panic_salt). (Giai đoạn 2b) `buildGroupAddBody`/`buildGroupRemoveBody`, `buildCardAddBody`/`buildCardRemoveBody` (packs `value = areaCode * 4294967296 + cardNumber`), `buildAdministratorSetBody` (create shape when granting, destroy shape when revoking), `buildPasswordSetBody` (already-hashed values only, deliberately not merged into `kUserWritableFields`), `buildUserHasPasswordBody`/`buildUserGroupIdsBody`/`buildUserIsAdminBody`/`buildCardCountBody`/`buildFaceCountBody`/`buildBioCountBody`/`buildUserDestroyImageBody` — plus `kUserGroupWritableFields`/`kCardWritableFields`/`kUserRoleWritableFields`. |
| `src/Client.cpp` | `AmicoClient`'s implementation (the `Impl` pImpl struct: owns `AmicoConfig`, the transport, and the `Session`); the two-cookie auth flow, the `autoRelogin` retry-once policy, and the JSON-to-typed-struct mapping for every operation. Authenticated binary GET supports `getImage`, one re-login on 401, status-preserving errors, and response Content-Type extraction with a JPEG fallback. |

## Tests (`amico_tests`, offline only)

| Path | What lives there |
|---|---|
| `test/FakeTransport.hpp` | Offline `IHttpTransport` test double + `readFixture()` helper. |
| `test/fixtures/*.json` | Sanitized fixtures matching the confirmed wire shapes (see `docs/amico-endpoints.md`). No real session token/password hash/salt value anywhere — see `docs/security-sanitization-policy.md`. |
| `test/test_auth.cpp` | Login success/failure, username-case-forwarding behavior. |
| `test/test_session.cpp` | Cookie header construction, session-valid true/false, logout clearing state. |
| `test/test_system_information.cpp` | System-information parsing, missing-required-field error. |
| `test/test_users.cpp` | User-list parsing, pagination, unknown-field tolerance, sensitive-field absence, `get(id)` found/not-found; (Giai đoạn 2) `create()`/`update()`/`remove()` payload shape, partial-update field omission, error/timeout propagation. |
| `test/test_users_profile.cpp` | (Giai đoạn 2b) `addToGroup`/`removeFromGroup`, `addCard`/`removeCard`, `setAdministrator` (grant/revoke/no-op), `setImage`/`removeImage`, `setPassword` (hash-then-write, plaintext never sent), `hasPassword`-populated `get()` true/false. |
| `test/UserProfileResponder.hpp` | (Giai đoạn 2b) `emptyUserProfileResponse()` — shared `FakeTransport` responder helper returning canned empty/zero responses for the 6 extra rich-profile sub-queries `get()`/`list()` now issue per user, so tests that don't care about these fields don't need their own logic for them. |
| `test/test_access_logs.cpp` | Access-log parsing, the `to`-server-side/`from`-client-side range-filter split. |
| `test/test_redaction.cpp` | Recursive redaction, including `panic_password`/`panic_salt` via the existing substring rule. |
| `test/test_query_whitelist.cpp` | Proves every `ObjectQuery` builder targets a fixed object, always emits `fields`, and never emits a caller-supplied `connector`; (Giai đoạn 2) also proves the 3 write builders never accept a caller-supplied object name and `kUserWritableFields` never contains a credential field. (Giai đoạn 2b) same discipline for the Group/Card/Administrator/Password builders, plus proves none of the 6 new read builders ever requests `"salt"`. |
| `test/test_errors.cpp` | Timeout/401/oversized-response mapping, `autoRelogin` on/off behavior, `ConfigurationError` on a bad base URL, and the full offline login→...→logout sequence. |
| `test/test_fixtures_load.cpp` | Sanity check that every fixture parses (except the deliberately-malformed one). |
| `test/main.cpp` | doctest runner (`DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN`). |
| `test/live/live_smoke_test.cpp` | Gated (`AMICO_ENABLE_LIVE_TESTS=1`) 9-step live sequence: preflight+login → session-valid (required true) → system information → conditional HTTPS/TLS observation → list users → get(id) (present/matching required; empty list means PARTIAL) → list access logs → logout → session-valid (required false). |

## Backend (`amico_backend`, Giai đoạn 3 — thin HTTP/JSON proxy over `amico_sdk`)

| Path | Purpose |
|---|---|
| `backend/main.cpp` | Loads listener config, checks network exposure, constructs an empty SessionStore, registers routes, mounts the frontend and listens without device credentials. |
| `backend/BackendConfig.hpp` | Backend-only environment settings: bind address, port, exposure opt-in and frontend directory; no startup device credentials. |
| `backend/SessionStore.hpp` / `.cpp` | One mutex-guarded optional client, device URL, random session token, manual raw Cookie parser and injectable client factory for offline tests. Callers hold acquire() across a complete transaction. |
| `backend/Routes.hpp` / `.cpp` | Login/logout/session routes and existing device operations; one session mutex covers the cookie gate, request parsing and SDK use. Sensitive routes retain their confirmation header. `GET /users/:id/image` forwards image bytes/content type and returns an empty 404 for no image. |
| `backend/JsonMapping.hpp` / `.cpp` | `AmicoUser`/`AccessLogEntry`/`SystemInformation` ↔ `nlohmann::json`; `hasPassword` is always boolean, no field anywhere carries a raw password/salt value. User `imageUrl` maps to the backend-relative `/users/<id>/image` route. |
| `backend/ErrorMapping.hpp` / `.cpp` | `AmicoError` subclass → HTTP status + JSON body, via a most-derived-first `dynamic_cast` chain (only ever reached after a request already parsed successfully — see `Routes.cpp`). |
| `test/backend/test_routes.cpp` | Offline HTTP integration tests (41 cases / 476 assertions) using a FakeTransport-backed SessionStore factory: existing route contracts plus login, session replacement, logout and all cookie gates. |
| `test/backend/live_backend_smoke_test.cpp` | Gated (`AMICO_ENABLE_LIVE_TESTS=1`), read-only: `/health`, `/system-information`, `GET /users` through the real backend against the real device. No live-write test exists for the backend — the underlying SDK writes are already live-verified (Giai đoạn 2/2b). |

## Frontend (`frontend/`, Giai đoạn 4 — plain HTML/CSS/JS, no framework/build step)

| Path | Purpose |
|---|---|
| `frontend/index.html` | Split login layout and white sidebar shell with blue header and text-only wordmark; preserves initially hidden device tabs, connection label, Logout, banner and script contracts. |
| `frontend/style.css` | Real-device-matched blue/navy theme, 13px Roboto/system font fallback, responsive sidebar/split login, tables, accessible SVG boolean states, tabbed dialog and error banner; no external dependencies. |
| `frontend/login.js` | Initial session check, real login, logout, expiry handling and optional deviceUrl/username storage; never persists passwords. |
| `frontend/app.js` | Shared fetch/error/DOM helpers and tabs; gated-route 401 dispatches session-expired to return to login. |
| `frontend/users.js` | Users tab: table (all `AmicoUser` fields), unified Add/Edit dialog (General, Groups, Cards, PIN, Facial; four extra tabs disabled until successful create, then unlocked in place), accessible inline SVG Password/Administrator states, Remove, group add/remove, card add/remove (session-tracked only — see the Known limitation below), image upload (client-side PNG/etc.→JPEG conversion via `<canvas>`, mirroring the real AMICO device's own technique) / remove, Administrator toggle and PIN-set (both require a real `window.confirm()` before sending — see Decision 4). |
| `frontend/access-logs.js` | Access Logs tab in the shared table/filter layout: `from`/`to`/`limit` filters → `GET /access-logs`. |
| `frontend/system-info.js` | System Information tab with shared action toolbar and styled definition list: recursive key/value rendering of `/system-information`'s response, including nested `network` fields. |

**Known limitation (tech debt, not a defect):** the backend has no
route to list a user's existing cards (`AmicoUser` only exposes
`cardCount`) — the Cards section can only track/remove cards added
during the current page session. See
`.plans/2026-09-13-phase4-frontend/DECISION_LOG.md`.

## Examples (`amico_example_*`, require a real device)

`examples/login_example.cpp`, `session_check_example.cpp`,
`system_information_example.cpp`, `list_users_example.cpp`,
`get_user_example.cpp`, `list_access_logs_example.cpp`,
`logout_example.cpp` — one file per implemented read-only operation.

## Build files

| Path | What it configures |
|---|---|
| `vcpkg.json` | Dependency manifest: `curl`, `nlohmann-json`, `doctest`, `cpp-httplib` (Giai đoạn 3), pinned via `builtin-baseline`. |
| `CMakeLists.txt` | `amico_sdk` static library, `amico_tests`, `amico_live_smoke_test`, the seven `amico_example_*` binaries (gated by `AMICO_BUILD_TESTS`/`AMICO_BUILD_EXAMPLES`), and (Giai đoạn 3, gated by `AMICO_BUILD_BACKEND`) `amico_backend_lib`, `amico_backend`, `amico_backend_tests`, `amico_backend_live_smoke_test`. |
| `.clang-tidy` | Static analysis check selection for `src/` and `include/`. |
