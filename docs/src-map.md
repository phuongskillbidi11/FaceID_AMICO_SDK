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
| `include/amico/Types.hpp` | Public data types: `SystemInformation`, `NetworkInfo` (including `NetworkInfo::selfSignedCertificate`), `AmicoUser`, `UserQuery`, `AccessLogEntry`, `AccessLogQuery`. |
| `include/amico/Client.hpp` | `AmicoClient` — the public entry point (`login`, `isSessionValid`, `getSystemInformation`, `logout`, `users()`, `accessLogs()`, `debugGetObjectMetadataJson()`), plus credential-free reachability probing via `AmicoClient::checkReachable()` and the `UsersApi`/`AccessLogsApi` nested classes. |
| `src/NetworkSafety.hpp` / `src/NetworkSafety.cpp` | Shared decision logic behind `test/live/live_smoke_test.cpp`'s preflight and TLS-probe steps: `reachableThenLogin()` gates login on a successful credential-free reachability probe; `probeHttpsIfEnabled()` runs a conditional secondary HTTPS/TLS probe only when `NetworkInfo::sslEnabled` is true, distinguishing verified TLS, verification failure, and network failure (otherwise not applicable). |
| `src/Session.hpp` / `.cpp` | In-memory-only holder of the `login`/`session` cookie pair; RAII zero-wipe on clear/destroy. Never persisted, never logged. |
| `src/JsonRedact.hpp` / `.cpp` | `redactJson()` — recursive, case-insensitive sensitive-key redaction for diagnostics/logging. Secondary defense; the primary defense is `ObjectQuery` never requesting sensitive fields in the first place. |
| `src/UrlValidation.hpp` / `.cpp` | `validateBaseUrl()` — rejects embedded credentials, non-http(s) schemes, query strings, fragments. |
| `src/http/HttpTransport.hpp` | `IHttpTransport` interface + `HttpRequest`/`HttpResponse`/`HttpHeader` plain structs. The DI seam offline tests use (`test/FakeTransport.hpp` implements this interface instead of `CurlTransport`). |
| `src/http/CurlTransport.hpp` / `.cpp` | The only production `IHttpTransport`: libcurl-based, TLS verify always on, redirects disabled, response/header size caps, optional cancellation. |
| `src/ObjectQuery.hpp` / `.cpp` | **Internal, not installed.** The entire `load_objects.fcgi` query surface this SDK uses: `buildUsersListBody()`, `buildUserGetBody()`, `buildAccessLogsListBody()`. No function here accepts a caller-supplied object/field/connector string, and none can omit the `fields` key. |
| `src/Client.cpp` | `AmicoClient`'s implementation (the `Impl` pImpl struct: owns `AmicoConfig`, the transport, and the `Session`); the two-cookie auth flow, the `autoRelogin` retry-once policy, and the JSON-to-typed-struct mapping for every operation. |

## Tests (`amico_tests`, offline only)

| Path | What lives there |
|---|---|
| `test/FakeTransport.hpp` | Offline `IHttpTransport` test double + `readFixture()` helper. |
| `test/fixtures/*.json` | Sanitized fixtures matching the confirmed wire shapes (see `docs/amico-endpoints.md`). No real session token/password hash/salt value anywhere — see `docs/security-sanitization-policy.md`. |
| `test/test_auth.cpp` | Login success/failure, username-case-forwarding behavior. |
| `test/test_session.cpp` | Cookie header construction, session-valid true/false, logout clearing state. |
| `test/test_system_information.cpp` | System-information parsing, missing-required-field error. |
| `test/test_users.cpp` | User-list parsing, pagination, unknown-field tolerance, sensitive-field absence, `get(id)` found/not-found. |
| `test/test_access_logs.cpp` | Access-log parsing, the `to`-server-side/`from`-client-side range-filter split. |
| `test/test_redaction.cpp` | Recursive redaction, including `panic_password`/`panic_salt` via the existing substring rule. |
| `test/test_query_whitelist.cpp` | Proves every `ObjectQuery` builder targets a fixed object, always emits `fields`, and never emits a caller-supplied `connector`. |
| `test/test_errors.cpp` | Timeout/401/oversized-response mapping, `autoRelogin` on/off behavior, `ConfigurationError` on a bad base URL, and the full offline login→...→logout sequence. |
| `test/test_fixtures_load.cpp` | Sanity check that every fixture parses (except the deliberately-malformed one). |
| `test/main.cpp` | doctest runner (`DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN`). |
| `test/live/live_smoke_test.cpp` | Gated (`AMICO_ENABLE_LIVE_TESTS=1`) 9-step live sequence: preflight+login → session-valid (required true) → system information → conditional HTTPS/TLS observation → list users → get(id) (present/matching required; empty list means PARTIAL) → list access logs → logout → session-valid (required false). |

## Examples (`amico_example_*`, require a real device)

`examples/login_example.cpp`, `session_check_example.cpp`,
`system_information_example.cpp`, `list_users_example.cpp`,
`get_user_example.cpp`, `list_access_logs_example.cpp`,
`logout_example.cpp` — one file per implemented read-only operation.

## Build files

| Path | What it configures |
|---|---|
| `vcpkg.json` | Dependency manifest: `curl`, `nlohmann-json`, `doctest`, pinned via `builtin-baseline`. |
| `CMakeLists.txt` | `amico_sdk` static library, `amico_tests`, `amico_live_smoke_test`, and the seven `amico_example_*` binaries, gated by `AMICO_BUILD_TESTS`/`AMICO_BUILD_EXAMPLES`. |
| `.clang-tidy` | Static analysis check selection for `src/` and `include/`. |
