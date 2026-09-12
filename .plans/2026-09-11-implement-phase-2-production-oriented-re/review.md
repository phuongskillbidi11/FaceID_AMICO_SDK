# Plan Review — Phase 2: Read-only C++17 SDK for AMICO VL70LF

> Written by the Plan Reviewer, independently of the Planner. Read-only with respect to
> `spec.md`/`tasks.md`/`tests.md` — this file is the only output of this role.

## Verdict

[x] APPROVED
[ ] CHANGES REQUESTED

## Checklist

| Check | Finding |
|---|---|
| Missing requirements | None blocking. `spec.md`'s Goal covers all six operations, the error taxonomy, offline tests, gated live test, examples, and doc updates from the task brief. `object_metadata.fcgi` correctly scoped as dev-only per the brief; `user_get_image.fcgi` correctly excluded. |
| Incorrect assumptions | None. `docs/src-map.md` doesn't exist yet — the plan creates it rather than assuming prior content, consistent with `tasks.md`'s own completion checklist. |
| Architecture inconsistencies | None. No prior `DECISION_LOG.md` entries exist to conflict with (Phase 1 had no C++ code). Decision 1 (both cookies) is traceable to `LIVE_CONFIRMED` evidence, not invented. |
| Missing edge cases | Minor, non-blocking: the 20 required scenarios (per the brief) don't include a dedicated test for `AmicoConfig.autoRelogin` defaulting to `false` and not firing without it — this is a security-relevant default. Recommend the Executor add one assertion for it inside `test_errors.cpp` (covering the existing 401-mapping scenario #15) rather than opening a new spec cycle for one assertion. |
| Missing tests | None beyond the note above. Every task group maps to a `ctest` filter or the Group 10 full-suite gate. |
| Dependency problems | None structural. Group ordering (scaffold → types → transport → session/redaction → query engine/client → tests → live test → examples → docs → full verify) has no forward references. Risk already flagged in `spec.md` (first vcpkg configure may be slow building `curl` from source) is a timing risk, not a dependency-correctness problem. |
| Security / hardware impact | Central to this plan (auth, session, redaction, query whitelist) and well covered: RAII session wipe, no persistence, recursive redaction, fixed object/field whitelist with no caller-supplied `connector`, TLS-verify-always with no disable knob, redirects fully disabled, response/header size caps. No physical hardware actions are in scope (read-only HTTP only). |

## Notes

Approved as written. One non-blocking addendum for the Executor: when
implementing Task 6.2, fold in the `autoRelogin`-default-off check noted
above as an extra assertion in `test_errors.cpp` rather than a new task —
it exercises the same fixture/fake-transport machinery already required for
scenario 15 (HTTP 401 mapping) and needs no new fixture.

No changes requested to `spec.md`, `tasks.md`, or `tests.md`.
