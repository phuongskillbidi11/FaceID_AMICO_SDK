# Tests — Visitors (Enroll → Visitors): list/create/update/remove + CPF

> **Executor instructions:** Run every test after all tasks complete.
> Group 8's write portion (Test V-2) is conditional on a separate,
> fresh `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval. Fill in
> each **Result:** line as each test actually runs; do not pre-fill.

---

## Syntax / build gate

```bash
cmake --build build --target amico_sdk
cmake --build build --target amico_backend
node --check frontend/users.js
node --check frontend/visitors.js
```
**Pass:** All exit 0.
**Fail:** Report to Planner before proceeding.
**Result:**
> _Fill in when run._

---

## Unit tests — SDK (`test/test_visitors.cpp`)

### Test Q-1 — `userTypeId` unset produces the exact pre-existing `where` shape (regression guard)
**Setup:** Call `buildUsersListBody(10, 0)` (2-arg, or 3-arg with the
new param left at its default).
**Pass:** `where` is byte-for-byte identical to today's:
`[{"field":"user_type_id","operator":"=","value":0,"connector":"OR"},
{"field":"user_type_id","operator":"IS NULL","connector":") AND ("}]`.
**Fail:** Any difference at all — this is the direct regression test
for spec.md Decision 1's "zero risk to existing Users" claim.
**Result:**
> _Fill in when run._

---

### Test Q-2 — `userTypeId = 1` produces the Visitors filter
**Setup:** Call `buildUsersListBody(10, 0, 1)`.
**Pass:** `where` is a single clause:
`[{"field":"id","object":"user_types","value":1}]`, no `connector` key.
**Fail:** Wrong shape, or a stray `connector` key copied from the real
device's own artifact-laden capture (tasks.md Task 2.1 explicitly
says not to copy that).
**Result:**
> _Fill in when run._

---

### Test Q-3 — `buildUserCreateBody` with/without `userTypeId`
**Setup:** Call with `userTypeId` unset, then with `userTypeId = 1`.
**Pass:** Unset case: `values` is exactly
`[{"name":..., "registration":...}]` (today's exact shape, no
`user_type_id` key at all). Set case: `values` additionally has
`"user_type_id": 1` in the same object.
**Fail:** `user_type_id` present when unset, or missing/wrong when set.
**Result:**
> _Fill in when run._

---

### Test Q-4 — `c_users` query builders
**Setup:** Call each of `buildCUsersGetBody(36)`,
`buildCUsersCreateBody(36, "12345678900")`,
`buildCUsersUpdateBody(7, "98765432100")`, `buildCUsersDeleteBody(36)`.
**Pass:**
- Get: `object=="c_users"`, `fields==["id","cpf"]`,
  `where==[{"field":"user_id","value":36}]`, no connector.
- Create: `object=="c_users"`,
  `values==[{"user_id":36,"cpf":"12345678900"}]`.
- Update: `object=="c_users"`, `values=={"cpf":"98765432100"}`,
  `where=={"c_users":{"id":7}}`.
- Delete: `object=="c_users"`, `where=={"c_users":{"user_id":36}}`.
**Fail:** Any shape mismatch.
**Result:**
> _Fill in when run._

---

### Test Q-5 — `mapUser` populates `cpf` correctly (present / absent)
**Setup:** Fake transport: for user id 36, `c_users` query returns one
row `{"id":7,"user_id":36,"cpf":"12345678900"}`; for user id 5, it
returns an empty array.
**Pass:** `mapUser`'s result for id 36 has `cpf.has_value() == true`
and `*cpf == "12345678900"`; for id 5, `cpf.has_value() == false`
(never an empty-string sentinel).
**Fail:** Either case wrong, or an empty string used instead of
`std::nullopt`.
**Result:**
> _Fill in when run._

---

### Test Q-6 — `createUser`/`updateUser` trigger the second `c_users` call when `cpf` is set
**Setup:** Fake transport request log. Call `createUser` with
`NewUser{name, registration, userTypeId=1, cpf="12345678900"}`.
**Pass:** The request log shows, in order: (1) `create_objects.fcgi`
on `users` with `user_type_id:1` in `values`; (2) `create_objects.fcgi`
on `c_users` with the new user's id + the cpf value. Calling
`createUser` with `cpf` unset shows only call (1), no `c_users` call
at all.
**Fail:** Missing call, wrong order, or a spurious `c_users` call when
`cpf` is unset.
**Result:**
> _Fill in when run._

---

### Test Q-7 — `removeUser` issues the defensive `c_users` cleanup
**Setup:** Fake transport request log. Call `removeUser(36)`.
**Pass:** Request log shows a `destroy_objects.fcgi` call on
`c_users` (`where: {"c_users":{"user_id":36}}`) **before** the
existing `destroy_objects.fcgi` call on `users`.
**Fail:** Missing call, or wrong order.
**Result:**
> _Fill in when run._

---

## Unit tests — Query whitelist (`test/test_query_whitelist.cpp`)

### Test Q-8 — No new builder accepts a caller-supplied object/field/connector string
**Pass:** Same compile-time-fact style check already used for every
other builder in this file (Task 2.1/2.2's new functions all take
only `int64_t`/`std::string` **value** parameters, never a field/
object/connector name) — no runtime assertion needed beyond
confirming the signatures, matching this file's existing convention
for this category of test.
**Fail:** N/A (compile-time fact).
**Result:**
> _Fill in when run._

---

## Backend route tests (`test/backend/test_routes.cpp`)

### Test R-1 — `GET /visitors` filters by `userTypeId = 1`
**Setup:** Fake transport asserting the request body's `where` matches
Test Q-2's shape.
**Pass:** Request assertion passes; response is the list of users
the fake transport returns.
**Fail:** Wrong `where` sent.
**Result:**
> _Fill in when run._

---

### Test R-2 — `POST /visitors` creates a user with `user_type_id=1` and, when given, a `c_users` row
**Setup:** POST body `{"name":"Test Visitor","registration":"V-001","cpf":"12345678900"}`.
**Pass:** Fake transport receives the `create_objects.fcgi` call on
`users` with `user_type_id:1`, then a second `create_objects.fcgi` on
`c_users` with the cpf value and the new user's id.
**Fail:** Missing `user_type_id`, missing `c_users` call, or wrong cpf
value.
**Result:**
> _Fill in when run._

---

### Test R-3 — `DELETE /visitors/:id` triggers the defensive `c_users` cleanup
**Setup:** `DELETE /visitors/36`.
**Pass:** Fake transport shows the `c_users` destroy call before the
`users` destroy call (same as Test Q-7, exercised through the HTTP
layer this time).
**Fail:** Missing or misordered call.
**Result:**
> _Fill in when run._

---

### Test R-4 — Regression: `GET /users` unaffected by this plan
**Setup:** `GET /users` (no Visitors involvement at all).
**Pass:** Request body's `where` is byte-for-byte identical to this
plan's own baseline (Test Q-1's shape) — direct proof the Task 5.1
refactor and Task 2.1 signature change introduced zero behavior change
to the existing, already-shipped Users route.
**Fail:** Any difference.
**Result:**
> _Fill in when run._

---

## Regression tests

### Test G-1 — Existing SDK/backend suites unaffected outside Visitors/Users-plumbing scope
```bash
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** Every pre-existing test (Access Logs, Groups/Cards/PIN/Image,
etc.) still passes unchanged; only Users/Visitors-related counts
should differ (new tests added, zero existing tests broken).
**Fail:** Any unrelated test regresses.
**Result:**
> _Fill in when run._

---

## Live tests (Group 8)

### Test V-1 — Users page unaffected; Visitors page loads (read-only)
**Setup:** Standard login against `http://192.168.2.156` via our own
frontend.
**Pass:** Users page (table columns, Add/Edit modal tabs/behavior)
renders identically to before this plan. New "Visitors" sidebar tab
appears; its list loads (0 rows expected, since none exist on this
device yet) with no console error; its Add modal shows the same tabs
as Users plus a CPF field; Users' own Add modal does **not** show a
CPF field.
**Fail:** Any Users regression, Visitors page error, or CPF leaking
into the Users modal.
**Result:**
> _Fill in when run._

---

### Test V-2 — Gated write test: create + verify + delete one disposable test visitor with CPF (write action)
**Setup:** `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` received as a
fresh, distinct message.
**Pass:** Created visitor `ZZ_VisitorTest` with CPF `12345678900`
appears in **both** our own frontend's Visitors list and the real
device's own `customusers.html?type=1` page (the definitive cross-
device-truth check) — confirming `user_type_id`/`c_users` actually
round-trip correctly, not just render correctly in our own UI.
`GET /visitors/:id` returns the correct `cpf` value. Deleted
afterward; confirmed absent via a fresh `GET /visitors` check.
**Fail:** Visitor missing from either side, wrong CPF value, or
incomplete cleanup.
**Result:**
> _Fill in when run._

---

## Sprint sign-off

- [ ] Syntax/build gate
- [ ] Unit tests Q-1 through Q-8
- [ ] Backend tests R-1 through R-4
- [ ] Regression test G-1
- [ ] Live test V-1 (read-only)
- [ ] Live test V-2 (write) — or explicitly deferred by user decision
- [ ] `DECISION_LOG.md` updated with any new decisions
- [ ] `sprint-summary.md` written

**Sign-off date:** _fill in when complete_
