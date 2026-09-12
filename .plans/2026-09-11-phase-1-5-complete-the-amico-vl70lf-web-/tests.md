# Tests — P0: Repository and Security Cleanup

---

## Build gate

Not applicable — P0 touches no source that builds. Skipped by design (no
`cmake`/build command runs in this plan, per the user's explicit
instruction carried over from the interrupt).

---

## Verification tests

### Test V-1 — WIP inventory matches `git status`
```bash
git status --porcelain
```
**Pass:** Output matches `spec.md`'s WIP inventory table plus this plan's
own `.plans/` directory; nothing else.
**Result:** [x] Pass / [ ] Fail

---

### Test V-2 — No real secret values anywhere in the repo
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/'
```
**Pass:** Both commands produce no output.
**Result:** [x] Pass / [ ] Fail

---

### Test V-3 — Previously-redacted password lines still redacted
```bash
grep -c "password=<redacted>" docs/amico-auth-flow.md
```
**Pass:** Returns `2`.
**Result:** [x] Pass / [ ] Fail

---

### Test V-4 — No raw capture files tracked or present
```bash
find . -iname "*.har" -o -iname "*.pcap*" -o -iname "*.saz" | grep -v '/\.git/'
```
**Pass:** No output.
**Result:** [x] Pass / [ ] Fail

---

### Test V-5 — `.gitignore` contains the four raw-capture patterns
```bash
grep -E "\*\.(pcap|pcapng|har|saz)" .gitignore
```
**Pass:** All four extensions present (pcap and pcapng may be one combined
pattern).
**Result:** [x] Pass / [ ] Fail

---

### Test V-6 — Sanitization policy doc exists and is non-empty
```bash
test -s docs/security-sanitization-policy.md && echo OK
```
**Pass:** Prints `OK`.
**Result:** [x] Pass / [ ] Fail

---

## Regression tests

### Test R-1 — Phase 1 docs/artifacts unaffected beyond the sanctioned P0 edits
```bash
git status --porcelain docs/ artifacts/ captures/ scripts/
```
**Pass:** Only `.gitignore`, `docs/security-sanitization-policy.md` (new),
and previously-applied redaction edits show up — no Phase-1 evidence
content is altered.
**Result:** [x] Pass / [ ] Fail

---

## Sign-off

- [x] All verification tests: ✅
- [x] All regression tests: ✅
- [x] `DECISION_LOG.md` updated if any new decision was made during execution (none needed — execution matched plan)
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-11
