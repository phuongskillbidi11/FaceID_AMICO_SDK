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
