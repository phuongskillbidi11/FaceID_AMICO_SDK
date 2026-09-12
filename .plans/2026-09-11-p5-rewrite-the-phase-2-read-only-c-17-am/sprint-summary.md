# Sprint Summary — Phase 2 (corrected): Read-only C++17 SDK

**Plan:** `.plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am`
**Date:** 2026-09-11

## What was built

A buildable, fully-tested C++17 static library (`amico_sdk`) implementing
exactly the corrected spec's scope:

- `AmicoClient`: `login()`, `isSessionValid()`, `getSystemInformation()`,
  `logout()`, `debugGetObjectMetadataJson()` (dev-only).
- `AmicoClient::UsersApi`: `list(UserQuery)`, `get(int64_t id)` →
  `std::optional<AmicoUser>`.
- `AmicoClient::AccessLogsApi`: `list(AccessLogQuery)` with the
  server-side-upper-bound + client-side-lower-bound range filter.
- Internal `detail::` query builders (`src/ObjectQuery.cpp`) that
  structurally cannot omit `fields` or accept a caller-supplied
  object/field/connector string.
- `CurlTransport` (TLS-verify-always, no redirects, size caps, optional
  cancellation) behind an `IHttpTransport` interface, with
  `test/FakeTransport.hpp` as the offline test double.
- 10-type exception hierarchy, recursive redaction utility, base-URL
  validator — all carried forward unchanged from the blocked plan's
  design, now actually implemented and tested.

## Build and test results (real, not simulated)

```
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

- CMake configure: exit 0.
- Build: exit 0, **zero warnings** (one nodiscard warning found and fixed
  during this sprint — see below).
- `ctest`: exit 0.
- `amico_tests.exe` directly: **38 test cases, 171 assertions, 0 failed.**
- All 7 example binaries + `amico_live_smoke_test` built successfully.
- `amico_live_smoke_test` run without `AMICO_ENABLE_LIVE_TESTS` set:
  prints skip message, exits 0, makes no network call (confirmed).
- `clang-tidy`: not installed in this environment — recorded as N/A, not
  silently skipped (see `tests.md`).
- Secret scan: clean (one benign textual mention of `"hash":` in
  `.plans/2026-09-11-phase-1-5-.../sprint-summary.md` describing the
  earlier vcpkg-compiler-cache false positive — not a real secret).
- Regression checks: no prior-phase doc/artifact or prior-plan file was
  touched during this sprint (verified via `find -newer`, since git status
  alone can't distinguish "always untracked" from "touched now" in this
  repo).

## Deviations from the plan during execution

- `test/test_fixtures_load.cpp` originally discarded
  `nlohmann::json::parse()`'s `[[nodiscard]]` return value inside
  `CHECK_NOTHROW`/`CHECK_THROWS`, producing MSVC warning C4834. Fixed by
  assigning to a local variable. Trivial test-authoring fix, not a design
  change — no `DECISION_LOG.md` entry needed for this one.
- The access-log range-filter test's expected row count was initially
  miscalculated by hand (off-by-one against the fixture's actual
  timestamps); caught while writing the test itself, fixed before the
  first build. Not a product bug — the implementation was never wrong,
  only the test's first-draft expectation.
- Needed a test-injection seam (`amico::setTransportForTesting`) that
  wasn't explicitly itemized in `tasks.md` — added as a small, clearly-
  documented friend-function hook in `Client.hpp`/`Client.cpp` so offline
  tests can swap in `FakeTransport` without changing `AmicoClient`'s
  public constructor signature (which must stay exactly
  `AmicoClient(AmicoConfig)` per the brief's example usage). Documented
  inline in both files; not called out in `spec.md` in advance because it
  is purely a test-infrastructure detail, not a behavior or scope change.

## Files created/modified

See `docs/src-map.md` for the full, current source-tree map (updated as
part of this sprint, Group 9). Summary: `include/amico/{Types,Client}.hpp`
(new), `src/{Session,JsonRedact,UrlValidation,ObjectQuery,Client}.{hpp,cpp}`
(new), `src/http/{HttpTransport.hpp,CurlTransport.{hpp,cpp}}` (new), 12
files under `test/fixtures/` (new), 9 files under `test/` (new), 7 files
under `examples/` (new), `docs/sdk-usage.md` + `docs/src-map.md` (new),
`CMakeLists.txt` (modified — added the `get_user` example target).
`include/amico/{Config,Errors,Cancellation}.hpp` reviewed, unchanged (see
`DECISION_LOG.md`).

## Decisions

Two `DECISION_LOG.md` entries this sprint: the Task 1.1 WIP-review outcome
(no change needed) and the Task F-2 structural-review outcome (with
concrete `src/ObjectQuery.cpp` line references).

## What's next

The corrected Phase 2 SDK is complete and verified offline. Remaining
optional next steps, none blocking this sprint's completion:

- Run the gated live smoke test against the real device
  (`192.168.2.156`) when the operator wants to — command is in
  `docs/sdk-usage.md`, not run automatically.
- The parent discovery plan's deferred items (P6: write-operation testing
  with a disposable test identity; enrollment-page discovery) remain
  future work, not started.
- `clang-tidy` static analysis remains unrun in this environment; running
  it (once available) against `build/compile_commands.json` is a cheap
  follow-up.
