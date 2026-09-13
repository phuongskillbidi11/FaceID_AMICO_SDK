# Amico C++ SDK — build, test, and usage

Read-only C++17 client for the HID AMICO VL70LF Web UI HTTP protocol. See
`docs/amico-protocol-map.md` / `docs/amico-endpoints.md` /
`docs/ui-action-protocol-map.md` for the captured evidence this SDK
implements against, and
`.plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am/spec.md` for
the design decisions behind the API shape.

## Build

Requires `VCPKG_ROOT` set (this repo's `vcpkg.json` pins curl,
nlohmann-json, and doctest via a `builtin-baseline`).

```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
```

The first configure builds `curl` from source via vcpkg and can take
several minutes; subsequent configures are fast.

## Run the offline test suite

```bash
ctest --test-dir build --output-on-failure
```

All of these tests run against `test/FakeTransport.hpp` (an in-memory
`IHttpTransport` test double) — no network call is ever made by the
default test target.

## Run the examples (against a real device)

Each example reads:

```bash
export AMICO_BASE_URL="http://192.168.2.156"
export AMICO_USERNAME="<device username>"
export AMICO_PASSWORD="<device password>"
```

and performs exactly one operation:

| Binary | Operation |
|---|---|
| `amico_example_login` | login, then logout |
| `amico_example_session_check` | session check before/after login |
| `amico_example_system_information` | device info |
| `amico_example_list_users` | list users (id/name only printed) |
| `amico_example_get_user` | look up one user by id (`AMICO_USER_ID`, optional) |
| `amico_example_list_access_logs` | list recent access logs |
| `amico_example_logout` | login then logout |

None of these are run automatically — they require a real device.

## Users API: create / update / remove (write, Giai đoạn 2)

Only `name` and `registration` are writable — no password/credential
field is accepted anywhere in this API (see `include/amico/Types.hpp`'s
`NewUser`/`UserUpdate` doc comments for why: static protocol discovery
found no evidence the real Web UI itself can set `user_type_id`/
`begin_time`/`end_time`, so this SDK does not invent that capability).

```cpp
amico::AmicoClient client(config);
client.login();

amico::NewUser newUser;
newUser.name = "Test User";
newUser.registration = "TEST-001";
int64_t id = client.users().create(newUser);   // returns the device-assigned id

amico::UserUpdate change;
change.id = id;
change.name = "Test User (renamed)";           // registration left unset -- not sent
client.users().update(change);

client.users().remove(id);

client.logout();
```

`create()` throws `ProtocolError` if the response has no `ids` array.
`update()`/`remove()` throw `ProtocolError` if the response's `changes`
count is not a positive integer (covers both an explicit device-side
error and a silent no-op, e.g. an unknown id).

## Users API: rich profile — groups, cards, administrator, image, PIN (write, Giai đoạn 2b)

`get(id)`/`list()` now also populate `groupIds`/`groupCount`,
`cardCount`, `isAdministrator`, `faceCount`, `bioCount`, `hasPassword`,
and `imageUrl` on every returned `AmicoUser` — at the cost of 6 extra
requests per user (see `docs/ui-action-protocol-map.md`'s "Users
rich-profile write commands" section for the exact query shapes).

```cpp
amico::AmicoUser user = *client.users().get(id);
user.groupCount;       // == user.groupIds.size()
user.cardCount;
user.isAdministrator;
user.faceCount;        // count only -- never raw template bytes
user.bioCount;         // count only (e.g. fingerprint)
user.hasPassword;      // bool only -- the actual PIN/password is never
                       // retrievable through this SDK, by design
user.imageUrl;         // "/user_get_image.fcgi?user_id=<id>" -- a URL,
                       // not pre-fetched bytes

// Groups
client.users().addToGroup(id, groupId);
client.users().removeFromGroup(id, groupId);

// Cards -- `value` is packed from a facility/site code and a raw card
// number (areaCode * 4294967296 + cardNumber), matching the real
// device's own encoding.
int64_t cardId = client.users().addCard(id, /*areaCode=*/0, /*cardNumber=*/12345);
client.users().removeCard(cardId);

// Administrator -- a no-op if the user is already in the requested
// state, matching the real Web UI's own asymmetric grant/revoke logic.
client.users().setAdministrator(id, true);

// Profile image -- raw bytes, application/octet-stream wire format
// (confirmed live 2026-09-12; not multipart, not base64 JSON).
// MUST be JPEG-encoded -- the device rejects other formats (e.g. PNG)
// with HTTP 400 (confirmed live 2026-09-12). This SDK does not convert
// image formats; the caller provides JPEG bytes.
// IMPORTANT (confirmed live 2026-09-13): this is NOT a purely cosmetic
// photo -- the device runs face-detection/quality validation and
// enrolls/updates the user's face-recognition template. setImage()
// throws ProtocolError if the device rejects the image (face not
// detected, not centered, too distant/close, low sharpness, multiple
// faces, etc. -- the exception message includes the device's details).
// removeImage() also removes the user's face_templates rows, matching
// the real Web UI's own paired behavior.
std::vector<uint8_t> jpegBytes = /* ... */;
client.users().setImage(id, jpegBytes);
client.users().removeImage(id);

// Password/PIN -- SET-only. This SDK hashes via the device's own
// user_hash_password command before sending; there is no API to read
// a password/salt value back, ever (see
// docs/ui-action-protocol-map.md's "hasPassword derivation" section
// and the project's feedback_never_expose_password_hash.md memory for
// why). If an operator forgets their PIN, the fix is to set a NEW one
// -- there is no way to recover the old one, by design and in
// principle (the device only ever stores a one-way hash+salt).
client.users().setPassword(id, "12345");
```

**Always ask the user for a fresh, explicit confirmation before calling
`setPassword()` or `setAdministrator()` against the live device** —
these join the "always ask before each live execution" tier alongside
firmware/credential-change commands (see
`feedback_write_api_risk_tiers.md`). `addToGroup`/`removeFromGroup`/
`addCard`/`removeCard`/`setImage`/`removeImage` do not require this
extra per-attempt confirmation.

## Run the gated live smoke test

Running against a real device requires `AMICO_ENABLE_LIVE_TESTS=1`,
`AMICO_BASE_URL`, `AMICO_USERNAME`, and `AMICO_PASSWORD` in the environment.
The human operator enters them directly in their own interactive terminal,
never as literal credential values in a command issued by the AI agent or
Executor tool. Such tool commands retain values in session transcripts and
tool logs even when no tracked file contains them. The Executor only prints
the required variable names and the exact binary path, then waits for the
operator to confirm the run happened; it never types or passes credentials.

For the phase-2 remediation plan, a distinct, freshly issued
`APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`
approval is required before running. Use the independently verified binary
whose executable hash matches the verification manifest:

```text
build-verify/amico_live_smoke_test.exe
```

The primary `AMICO_BASE_URL` for this plan is `http://192.168.2.156`.
The harness constructs a separate, credential-free HTTPS client only after
system information reports SSL enabled. The nine numbered steps are:
preflight+login → session-valid (required true) → system information →
conditional HTTPS/TLS observation → list users (small limit) → get(id)
(required present and matching) → list recent access logs (small limit) →
logout → confirm session invalid. An empty user list produces `RESULT:
PARTIAL`; certificate verification rejection is reported separately from a
fatal network failure. Full user records and credentials are never printed.
Without `AMICO_ENABLE_LIVE_TESTS=1`, the binary prints a skip message and
exits 0 without network I/O.

On every exit, whether pass or fail, the operator clears credentials and
the live gate in that same shell. In Bash:

```bash
unset AMICO_PASSWORD AMICO_USERNAME AMICO_ENABLE_LIVE_TESTS
```

In PowerShell, use cleanup in a `finally` block so it also runs on failure:

```powershell
try {
    & .\build-verify\amico_live_smoke_test.exe
} finally {
    Remove-Item Env:AMICO_PASSWORD, Env:AMICO_USERNAME, Env:AMICO_ENABLE_LIVE_TESTS -ErrorAction SilentlyContinue
}
```

After a failure, stop and report the outcome. Any rerun after a fix and fresh
independent verification requires a new, distinctly worded approval, such
as `APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification:retry-1`.
Previously consumed approval text must not be reused; increment the retry
suffix for each attempt.

## Static analysis

```bash
clang-tidy -p build $(git ls-files 'src/*.cpp' 'include/**/*.hpp')
```

(`CMAKE_EXPORT_COMPILE_COMMANDS=ON` is set in `CMakeLists.txt`, so
`build/compile_commands.json` exists after configure.) If `clang-tidy`
isn't installed, this step is skipped — not a build failure.

## What this SDK does not do

- No create/update/delete/import/restore/firmware/network/date-time/
  enrollment/relay/license/EAM-update operation exists anywhere in this
  SDK — see `docs/ui-action-protocol-map.md` for the full inventory of
  what the device *can* do that this SDK deliberately never touches.
- No public method accepts an arbitrary `load_objects.fcgi` object name,
  field list, or `where` filter — the internal query engine
  (`src/ObjectQuery.hpp`) only knows how to build the two specific queries
  this SDK's public API needs.
- `password`, `salt`, `panic_password`, `panic_salt` are never requested
  from the device by this SDK (not "requested then redacted" — never
  requested at all; see `src/ObjectQuery.cpp`'s field lists).
- `object_metadata.fcgi` is reachable only via
  `AmicoClient::debugGetObjectMetadataJson()`, explicitly named and
  documented as a development/discovery tool, not part of the typical
  application workflow.

## Environment variables reference

| Variable | Used by |
|---|---|
| `AMICO_BASE_URL` | Examples, live smoke test — device base URL, e.g. `http://192.168.2.156` |
| `AMICO_USERNAME` | Examples, live smoke test — device account username (case-sensitive) |
| `AMICO_PASSWORD` | Examples, live smoke test — device account password |
| `AMICO_ENABLE_LIVE_TESTS` | Live smoke test only — must be exactly `1` to run against a real device |
| `AMICO_USER_ID` | `amico_example_get_user` only, optional — numeric user id to look up |
