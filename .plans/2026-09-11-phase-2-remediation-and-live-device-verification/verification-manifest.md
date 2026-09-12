# Verification Manifest — Independent offline verification (Group 2)

> Authored directly by the independent Verifier (fresh Claude Code context,
> no shared conversation history with the Executor session), per spec.md
> Decision 3 and Decision 8, and tests.md's "Content-hash + toolchain/
> dependency version manifest" section. All commands below were run by
> this Verifier session against a **new** build directory (`build-verify/`)
> that did not exist before this pass started; `build-exec/` (the
> Executor's own directory) was never read, built, or reused.

**Date:** 2026-09-12
**Build directory:** `build-verify/` (freshly created this pass; confirmed
absent immediately before `cmake -S . -B build-verify ...` was run)

---

## 1. Toolchain / generator versions

```
$ cmake --version
cmake version 4.3.1-msvc1

$ ninja --version
1.13.2

$ cl
Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36252 for x86

$ vcpkg --version
vcpkg package management program version 2026-05-27-d5b6777d666efc1a7f491babfcdab37794c1ae3e
```

Configure/build invocation used:
```
cmake -S . -B build-verify -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build-verify
```
Result: configure exit 0 (18.3s configure time), build exit 0, **36/36
targets** built (matches Group 1's recorded target count).

---

## 2. Full source/config file content-hash list (sha256)

Command:
```
find src include test examples CMakeLists.txt vcpkg.json -type f -print0 | sort -z | xargs -0 sha256sum
```

54 files hashed:

```
3539ddbf6c9b2fdd875ce12431b678c5114ae7d4d9f6691180310f2e3919972d *CMakeLists.txt
4e9a70065b2f53cc77020307783e756b08e2e9499c9f61a829896767d15684f9 *examples/get_user_example.cpp
3eea34ee3d8ca3b0754d26db88b17b6007bccac61a69ab2323944504b5bf17e3 *examples/list_access_logs_example.cpp
92a42bb515d0d999289be69689f4344a2c84a2c31f69b65be3e3b49c26e29a0a *examples/list_users_example.cpp
98714497e7b39ae8882556ae3f966131c2f1d778fdccd4996c85c9f6a91c8e9a *examples/login_example.cpp
55fc9685974e3ad23128806333e08e2b80fee31ecc74a784ea4b1203aa0f94ae *examples/logout_example.cpp
e605c8248cc69f5026e7856fef5390ed6c83bb3c3719a864c299be032c0c477c *examples/session_check_example.cpp
4e54fc32a14598a5ec32cc148eb50a41333ebd4e89c1464cebe88a67a885da24 *examples/system_information_example.cpp
10b36ace4cbfec42cca9dbef825566970460348ed2ec2b4ead7ace9f82ef7501 *include/amico/Cancellation.hpp
ddbf19d1299de733ed4f7ad7037231abf542add21699d65cafb72f6be09f9c88 *include/amico/Client.hpp
280b42fb0c79ed9405cad8bb9d9607e01de26e22c5947fcada3bede76c7c3612 *include/amico/Config.hpp
8c467bd701b7420f8b2ac57358c06b0515d04f2b88c73fd6bc7d3a7db352d1ae *include/amico/Errors.hpp
fc7ebd7fea25bf33d9e72438db2d650db8f1e74f0834784ab5d1cbe21c93f3cd *include/amico/Types.hpp
f0c94f50b52c768eba8f8c26a398d293b67aec7a084705725e90de976adbaf94 *src/Client.cpp
e04931d148048b2c06071008952cd6a0017d83c00fdc0483651af75c4046956d *src/JsonRedact.cpp
64e0771cb3cbae3243c88b182f5ac61202fab13d6413e519fd4b6a0d8c3ced7e *src/JsonRedact.hpp
2e94b39323ba5e8e94a4dfa1c4beaee0bfbc16ff28e2cd5be9e2954e70f56dd4 *src/NetworkSafety.cpp
e2c1c5f83cf118bc86a0a8af84b306ad0060518c65ecf6aa9c7b360479b2bf3d *src/NetworkSafety.hpp
421b51764ee8dc89f420b96612afa2dd6c12c9413e60271638c72c6aa4a16f31 *src/ObjectQuery.cpp
ddf33f9282ebdb22677c79add1b527e9ed40ca5d1fa355e769b30abe334d033d *src/ObjectQuery.hpp
e2d94b12b184de2088b729eaa49b97b423a0f4fe9816d42aeb23f82e0839be17 *src/Session.cpp
3b90be7f6c2f8da8d1ea9d65fd0f8fa9eb813628a11aa15e93807ec91a1b0fb7 *src/Session.hpp
2c0ec4370390fa52499e123d9492c65ce88f2ca87f88d47779790ad6f98fc101 *src/UrlValidation.cpp
40bb83ac457f1f96e0abda9d976a90395288714ee24edb87d96906279d75f65c *src/UrlValidation.hpp
3eec21eebb7fa982524ae9bff818b81a2ee94a24708343343f203727b2143b95 *src/http/CurlTransport.cpp
7b746801e378471dd51c8a529351dbe885f08f40e5afc1afd65a588954286ef8 *src/http/CurlTransport.hpp
a05e1550aad2d86d03ae74d2e39cb2a3800bde832caa5a95247700d17e94b814 *src/http/HttpTransport.hpp
0de40c10ae606a39a5e24ef52f1d6e27f5cea22e0f9a1b074c8a8dca099c0586 *test/FakeTransport.hpp
cae5f4e275f781b20505d72c85f9c838c461e9068da1a762ecd315f33d2835eb *test/fixtures/access_logs_list.json
54bb47dc5a6c51e78bb87ab008b6252efe28894448512ad422407ca39ad318a3 *test/fixtures/login_failure.json
d69b44aa2779ccd77d86f94a5c5e90747c14cff9f80f67c006a609cb25c0dc79 *test/fixtures/login_success.json
d552ede6e521040e597742791a6aa7c969167da7a52ad5d288fb21fcd6433b44 *test/fixtures/malformed.json
87c96aac1306cc0a7cb91acc1118f4e4adf30767c3c18b70fe1ac38b9ae0369b *test/fixtures/missing_required_field.json
b7a2548a995dc8899acc4548ebe3c8136aa057b3b2b07dd9f16f7f9ef4c5c4fa *test/fixtures/sensitive_fields_present.json
03a4f48697812957b84cb115f863ed43f7d3802350e3966d50b964be8204a48e *test/fixtures/session_valid_false.json
390d43d42d35e1649805dd7910b9db8597f1378a40c69f34ca1178ccc2c0f10f *test/fixtures/session_valid_true.json
b9e8f300eb5746dd76e774692b3b0593d689148dc9381485209989449830c50c *test/fixtures/system_information.json
bc8a1fe3cdef0fc847d868ef46b0b408399bc91e588a240fdffea8990303604c *test/fixtures/unknown_extra_field.json
3913f19b0ef2e461976cae5a4cbb7de0f728c34cc17b9ab5679d0d8e30d020e7 *test/fixtures/user_get_found.json
f349f0758e576248585e5c5e266914657062a20d5f0e6b74928558cca554cbda *test/fixtures/user_get_not_found.json
5516c926ab50026c02198303b6acb2cd2febfd29a1e4076ef036e69aaf515a76 *test/fixtures/users_list_default_filter.json
9cc24d2a469c54758903cdafb1b49c23bd7ff844268393837d73b38f673cc237 *test/live/live_smoke_test.cpp
010cc5d71fa312cc2aef083c5a8ecbcfa076db95fd50a3761df2d3e5b29b12a5 *test/main.cpp
9d0ceed1d296687d973b5bbf3485a03da6effc49112291b312bdf1a5feaabefd *test/test_access_logs.cpp
b48a1966f53a3d6dd9fafbc7a326a4e1efdf2fb399391b2053b90def824f15f2 *test/test_auth.cpp
640826c7edea415fb033ece64c55dec80fb0507656e7f2cf68466ff109724126 *test/test_errors.cpp
c27ce7e8e8a2d5f1fe09b8bfdc056b0d867cdc6663cf99d0aa8b5f7640da3438 *test/test_fixtures_load.cpp
b85a42006311b011d658b60929a3f11b6ccab22c81e12b1d703e71bbd018e22c *test/test_network_safety.cpp
0f6c300cd23eccc1d48949b4a57ea277e59028297a8486bcf41b8e64aeefbf09 *test/test_query_whitelist.cpp
1daec2d42427bb0f7053ea5beec6136730ce4b60cc615ce3892d0cfd4abb9985 *test/test_redaction.cpp
ad9f0bdff1ccef1028f37f9731977f237f81037fa653eec84fb408cf06a262ec *test/test_session.cpp
d9f2104361237ace35b32e3f56258a8b7dcea055db805edfb053e97bf978d1cb *test/test_system_information.cpp
b1ed98b4b8b304ff4790a962d387c3f914c9a78c598580a5edf9383c8cb95e1b *test/test_users.cpp
dcdfc3c4b8e75e28e0dd1ff1f9b371afee3a1a943d41fb2d29c4ebb260305b10 *vcpkg.json
```

---

## 3. Built-executable hashes (sha256)

Command:
```
sha256sum build-verify/amico_live_smoke_test.exe build-verify/amico_tests.exe
```

```
e72effc9d08a0cbe4647e661e166c2f361fd23528ad16a4b952c0f5f0184fb9c *build-verify/amico_live_smoke_test.exe
600596467fb6fc47c79b48dd1f568dac93f16c6ab11a2e617646716e488cedca *build-verify/amico_tests.exe
```

Per tests.md Group 3's precondition, any future live run must first
confirm `build-verify/amico_live_smoke_test.exe`'s `sha256sum` still
matches the first line above before proceeding.

---

## 4. Resolved dependency package metadata (from `build-verify/vcpkg_installed`)

Command:
```
find build-verify/vcpkg_installed -iname "CONTROL" -o -iname "*.spdx.json"
```
(CONTROL files, concise `Package`/`Version`/`Port-Version`/`Architecture`/`Abi`
fields shown below; full `.spdx.json` documents also exist per package under
`share/<pkg>/vcpkg.spdx.json` and were inspected but are not reproduced in
full here as they are large auto-generated relationship graphs restating
the same version identity.)

| Package | Version | Port-Version | Architecture | ABI hash |
|---|---|---|---|---|
| curl | 8.22.0 | 1 | x86-windows | c58956b976e4d30ae35ae5919180540e5c3867803dd943968444937c17fd8d6a |
| doctest | 2.5.3 | (none) | x86-windows | e3eba3631e5c41b94fadaf00404c4f6192e8e8384397be547269803893d45d24 |
| nlohmann-json | 3.12.0 | 2 | x86-windows | 6db2e22fdd0011bbd20d055cda52c7606fd49de4d48cf7b1983b2719f2932af1 |
| vcpkg-cmake-config | 2026-07-21 | (none) | x64-windows | c2bf95df2c9414132c5e068f24b596ddcef64a318d215482857817cdfe47eb65 |
| vcpkg-cmake | 2025-08-07 | (none) | x64-windows | 1c1cfdb93dc42329b43f599aa3ab01594f978c4d203ae8cd897dd6f32ce56140 |
| zlib | 1.3.2 | 2 | x86-windows | 1eb5f7d9ef15b53a821ce20bcbb4f73b9f1980e73a2ebc0af12148c5fef5466d |

`curl`'s CONTROL file records `Default-Features: non-http, ssl` and an
enabled `sspi` feature (Windows native TLS/SSPI backend), consistent with
`CurlTransport.cpp`'s unconditional `CURLOPT_SSL_VERIFYPEER`/`VERIFYHOST`
behavior referenced in spec.md Decision 6/9.

vcpkg tool itself: `vcpkg package management program version
2026-05-27-d5b6777d666efc1a7f491babfcdab37794c1ae3e`.

---

## 5. Test/assertion counts reproduced independently

| Check | Group 1 (Executor, `build-exec/`) | Group 2 (this pass, `build-verify/`) | Match? |
|---|---|---|---|
| Build targets | 36/36, exit 0 | 36/36, exit 0 | Yes |
| `ctest` suite | 1/1 (`amico_offline_tests`), 100% passed | 1/1, 100% passed | Yes |
| doctest cases | 45 cases / 250 assertions | 45 cases / 250 assertions | Yes |
| `--test-case="full_sequence*"` | 1 case / ≥1 assertions passed | 1 case / 7 assertions passed, 0 failed | Yes |
| Secret scan 1 (session token pattern) | no matches | no matches | Yes |
| Secret scan 2 (password/hash/salt pattern) | 1 known false-positive match (unrelated prior-plan prose) | same single match, same file/line, confirmed unrelated to this plan | Yes |
| Live-smoke skip-gate | prints skip message, exit 0, no network call | prints skip message, exit 0, no network call, confirmed with all 4 live-test env vars unset | Yes |

---

## 6. Scope/independence confirmation

- `build-verify/` did not exist before this pass (`ls build-verify` failed
  with "No such file or directory" immediately before the `cmake -S . -B
  build-verify ...` command was run).
- `build-exec/` was never read, configured, built, or otherwise touched by
  this pass.
- All four live-test environment variables (`AMICO_ENABLE_LIVE_TESTS`,
  `AMICO_BASE_URL`, `AMICO_USERNAME`, `AMICO_PASSWORD`) were confirmed
  empty in this shell before and during the skip-gate check; no network
  request to `192.168.2.156` or any other host was made at any point in
  this pass.
