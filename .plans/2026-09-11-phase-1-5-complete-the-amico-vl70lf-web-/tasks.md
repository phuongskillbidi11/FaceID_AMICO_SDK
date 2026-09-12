# Tasks — P0: Repository and Security Cleanup

> Scope note: this plan's `spec.md` covers P0 through P6, but the user
> explicitly approved only **P0** to execute now. P1–P6 remain planned, not
> executed, until separately approved. This `tasks.md` therefore contains
> P0 tasks only.
>
> Status markers: `[ ]` not started, `[~]` in progress, `[x]` complete
> (verification command run), `[!]` failed.

---

## Group 1 — Confirm WIP inventory and remove build byproducts

### Task 1.1 — Confirm the WIP file inventory against actual repo state
**File:** N/A (verification only)
**Action:** Re-run `git status` and diff against the WIP inventory table in
`spec.md`. Confirm no file outside that table was modified since the last
report to the user.

**Verification:**
```bash
git status --porcelain
```
**Pass:** Only the files already listed in `spec.md`'s WIP inventory (plus
this plan's own `.plans/` directory) appear.
**Fail:** Any unexpected modified/untracked file outside that list.

**Status:** `[x]`

---

### Task 1.2 — Remove the disposable CMake configure log
**File:** `build_configure.log` (delete)
**Action:** This is a build byproduct (raw `cmake`/`vcpkg` stdout+stderr
captured while diagnosing the blocked plan's configure step) — not source,
not documentation, and not meant to be tracked. Delete it; the `build/`
directory it references is already gitignored.

**Verification:**
```bash
git status --porcelain build_configure.log   # expect no output after deletion
```
**Pass:** File no longer present.
**Fail:** File still present or deletion fails.

**Status:** `[x]`

---

## Group 2 — Secret scan

### Task 2.1 — Full-repo scan for real session tokens, password hashes, and salts
**File:** N/A (verification only)
**Action:** Scan all tracked and untracked files (excluding `.git/`,
`build/`) for shapes that would indicate a leaked real secret: a `session=`
cookie value, a long hex string in a `password`/`hash` context, or a `salt`
field with a non-placeholder value. Use generic pattern matching — this
task's own verification command must never embed a literal known secret
value, since that would itself commit a secret into a tracked file.

**Verification:**
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/'
```
**Pass:** No matches (both commands print nothing).
**Fail:** Any match — identify the file, remove/redact the value, re-run.

**Status:** `[x]`

---

### Task 2.2 — Confirm the two previously-redacted literal-password lines stay redacted
**File:** `docs/amico-auth-flow.md`
**Action:** Re-check that the two login-attempt table rows fixed in the
prior session still read `password=<redacted>` rather than a real value.

**Verification:**
```bash
grep -n "password=<redacted>" docs/amico-auth-flow.md
```
**Pass:** Two matches, exactly as expected.
**Fail:** Zero matches (regression) or a matching line containing a real value instead.

**Status:** `[x]`

---

### Task 2.3 — Scan the new WIP C++ headers for embedded secrets
**File:** `include/amico/Errors.hpp`, `include/amico/Cancellation.hpp`, `include/amico/Config.hpp`
**Action:** These are generic, protocol-agnostic code (exception types, a
cancellation token, a config struct with no hardcoded default credential)
— confirm none of them accidentally hardcodes the device's real username,
password, or session token as a literal or a comment example.

**Verification:**
```bash
grep -niE "admin|K0lB|session=[A-Za-z0-9]{10,}" include/amico/Errors.hpp include/amico/Cancellation.hpp include/amico/Config.hpp
```
**Pass:** No matches.
**Fail:** Any match — remove/generalize before proceeding.

**Status:** `[x]`

---

## Group 3 — Keep raw HAR/PCAP out of Git

### Task 3.1 — Harden `.gitignore` against raw capture formats
**File:** `.gitignore`
**Action:** Add explicit ignore patterns for raw traffic-capture formats
(`*.pcap`, `*.pcapng`, `*.har`, `*.saz`) repo-wide, as defence-in-depth on
top of `captures/README.md`'s existing guidance that these are expected
inputs but must stay local. None currently exist in the repo (confirmed by
Task 1.1's `git status` and an explicit `find`), so this task is purely
preventative.

**Verification:**
```bash
find . -iname "*.har" -o -iname "*.pcap*" -o -iname "*.saz" | grep -v '/\.git/'   # confirm still none exist
git check-ignore -v test-fixture.pcapng 2>/dev/null; echo "---"; touch /tmp/x.har  # sanity-check the pattern would match (see task note)
```
**Pass:** `.gitignore` contains the four patterns; no raw capture file is
present in the repo.
**Fail:** Pattern missing, or a raw capture file is found tracked.

**Status:** `[x]`

---

## Group 4 — Define the sanitized-fixture convention (policy only, no fixtures written yet)

### Task 4.1 — Write the sanitized-fixture and redaction policy doc
**File:** `docs/security-sanitization-policy.md` (new)
**Action:** Document, for this repo specifically, the rule that governs
every future fixture/test file and every doc: no tracked file may contain
a real session token, password, password hash, or salt; fixtures must use
obviously-fake placeholders (e.g. `"REDACTED_FOR_FIXTURE"`); field *names*
(e.g. documenting that `users` has a `password` field) are not secrets and
may be freely documented — only *values* are restricted. Cross-reference
`scripts/analyze_amico_capture.py`'s existing redaction key-list
(`docs/amico-protocol-map.md`'s evidence categories already document the
grading side of this; this new doc documents the storage/authoring side).

**Verification:** File exists, renders as valid Markdown, and is
referenced from `docs/src-map.md` once that file exists (Phase 2 concern —
`docs/src-map.md` itself is not part of P0's scope, so just confirm this
file stands on its own for now).
**Pass:** File created, non-empty, Markdown-valid.
**Fail:** Missing or empty.

**Status:** `[x]`

---

## Group 5 — Final report

### Task 5.1 — Full-repo secret scan, final pass, and summary
**File:** N/A (verification only)
**Action:** Re-run Group 2's scans once more after Groups 1, 3, and 4's
changes, to confirm nothing introduced by this cleanup itself leaked
anything, then write `sprint-summary.md`.

**Verification:**
```bash
git status --porcelain
```
(plus re-running Task 2.1's two grep commands)
**Pass:** Clean scan, `sprint-summary.md` written.
**Fail:** Any regression found.

**Status:** `[x]`

---

## Completion checklist

- [x] All tasks marked `[x]`
- [x] No tasks marked `[!]`
- [x] Secret scan (Task 2.1) clean
- [x] `.gitignore` hardened (Task 3.1)
- [x] `docs/security-sanitization-policy.md` written (Task 4.1)
- [x] Sprint summary written to `.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git diff --name-only
git checkout -- [file-path]
```

Task 1.2 deletes `build_configure.log`; if that turns out to be wanted for
diagnostics later, it can be regenerated by re-running the same `cmake`
configure command once P5/Executor work resumes — nothing here is
destructive to source.
