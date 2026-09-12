# Sanitization and redaction policy for this repository

This document is the storage/authoring-side counterpart to
`docs/amico-protocol-map.md`'s evidence-grading scheme. That doc grades
*how confident* a protocol claim is; this doc governs *what is allowed to
be written to a tracked file* while making those claims.

## The one rule

**A tracked file may document that a field exists (its name, type, and
purpose). A tracked file may never contain a real value of a sensitive
field.**

Field *names* are protocol facts and are expected to appear throughout
`docs/`/`artifacts/` — e.g. "the `users` object has a `password` field
holding a salted hash" is exactly the kind of finding this project exists
to record. Field *values* captured from the real device (an actual hash,
an actual salt, an actual session token, an actual password) must never
reach a tracked file, in any form — not even truncated, not even as a
"realistic-looking example."

## Sensitive field names (case-insensitive substring match)

Any JSON key whose name contains one of these is a value that must never
be written to a tracked file, regardless of context:

- `password`
- `password_hash`
- `hash`
- `salt`
- `session`
- `token`
- `cookie` (the header's own name is fine to mention; a captured *value* is not)
- `authorization`
- `api_key`

This is the same list `scripts/analyze_amico_capture.py`'s
`SENSITIVE_KEY_RE` enforces automatically for anything that tool touches,
and the same list Phase 2's `redactJson()` utility (see
`.plans/2026-09-11-implement-phase-2-production-oriented-re` — currently
`BLOCKED`, but its header files already implement this list) enforces for
SDK diagnostics. This document is the policy statement; those are two of
its enforcement points.

## What "obviously fake" looks like

When a fixture or example genuinely needs *something* in a sensitive
field's position (e.g. to test that redaction actually removes it), use a
placeholder that cannot be mistaken for real device data:

```json
{ "session": "REDACTED_FOR_FIXTURE" }
```

Never use a real captured value "for realism," never use a plausible-
looking but invented value (a fabricated hash is still a hash-shaped string
that could be mistaken for real later), and never truncate a real value
(e.g. the first 8 characters of a real session token) — truncation is not
redaction.

## What is not covered by this policy

- Non-sensitive device data already documented (firmware versions, object
  schema field lists, endpoint paths, HTTP status codes) — freely
  documentable, that's the point of Phases 1 and beyond.
- The device's default/documented-by-vendor credentials (e.g. the manual's
  own `admin`/`admin` example) — already public in HID's own
  documentation, not something this project's activity exposes. Even so,
  prefer generic placeholders in new writing rather than repeating them.
- Real usernames encountered during live testing that are not secrets by
  the definition above (e.g. `Admin`, the case-sensitive value confirmed
  in Phase 1) — a username is not on the sensitive-field list; only the
  password/session/hash/salt paired with it are restricted.

## Verification

Before any commit that touches `docs/`, `artifacts/`, `test/fixtures/`, or
`examples/`, run the two scans below (also encoded as
`.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/tests.md`'s
Test V-2) and confirm both produce no output:

```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/'
```

A hit inside `build/` or `vcpkg_installed/` (e.g. a compiler binary's own
hash cache) is expected noise from third-party build tooling, not a device
secret — those directories are gitignored and never reach a commit either
way. A hit anywhere else is a real finding: stop and remove/redact it
before committing.

## Raw captures stay local

`captures/*.pcapng`, `captures/*.har`, and `captures/*.saz` (and any other
`.pcap`/`.pcapng`/`.har`/`.saz` file anywhere in the tree) are gitignored
repo-wide (see `.gitignore`). Only sanitized, redacted summaries derived
from them — via `scripts/analyze_amico_capture.py` or manual review against
this policy — are ever tracked.
