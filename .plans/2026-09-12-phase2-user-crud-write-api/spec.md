# Spec — Giai đoạn 2: User CRUD (API ghi đầu tiên của SDK)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.
> This file answers WHAT and WHY. tasks.md answers HOW.

---

## Goal

Mở rộng `amico_sdk` (hiện tại 100% read-only) để hỗ trợ **tạo, sửa, xoá
user** — API ghi đầu tiên trong toàn bộ lịch sử project này. Đây là bước
nền tảng để sau này xây app quản lý user tương tự web UI thiết bị.

**Done looks like:** `AmicoClient::UsersApi` có thêm `create()`,
`update()`, `remove()`; mỗi hàm có unit test offline (fixture-based,
không chạm device) và — chỉ nếu được duyệt riêng — 1 lần live-test tạo
rồi xoá đúng 1 user thử nghiệm (không chạm bất kỳ user thật nào đang có
trên thiết bị: `Phat`, `Phuong Hoang`, `Trung Dung`).

---

## Background

SDK hiện tại (`p5-rewrite`/`phase-2-remediation` plans) chỉ đọc:
`login`, `session`, `system info`, `users().list/get`, `access
logs().list`. Protocol cho thao tác ghi user (`create_objects`/
`object_add`, `modify_objects`, `object_remove`/`destroy_objects`) mới
chỉ được xếp loại ở mức rất chung ("Create/Update/Delete — chưa từng
gọi") trong `docs/ui-action-protocol-map.md` từ P1 — **chưa có payload
shape cụ thể cho `object:"users"`** ngoại trừ 1 trường hợp: khi đọc
`newusers.js` cho Giai đoạn 1b, tình cờ thấy được shape thật của lệnh xoá
(`destroy_objects`, `Json:{object:'users', where:{users:{id:[...]}}`}`,
từ nút "Remove" của trang Users) — nhưng shape của tạo mới/sửa
(`create_objects`/`object_add`/`modify_objects`) vẫn hoàn toàn chưa biết.

---

## Design decisions

### Decision 1 — Cần 1 vòng discovery bổ sung trước khi viết code (Group 0)
- **Chosen:** Trước khi implement bất kỳ hàm `create()`/`update()`
  nào, đọc tĩnh `en_US/js/class/user.js` và `en_US/js/class/baseclass.js`
  (đã thấy tên file này khi Settings/Users page load, nhưng nội dung
  chưa từng được fetch/đọc) — đây gần như chắc chắn là nơi định nghĩa
  generic "Save"/"Add" handler cho Table framework mà `newusers.js` kế
  thừa. Nếu 2 file này không đủ, đọc thêm phần "Save" handler còn lại của
  chính `newusers.js` (đã có sẵn cục bộ, không cần fetch lại).
- **Why:** Không thể viết `ObjectQuery.cpp`'s builder pattern (hard-code
  field list, không nhận field/object tuỳ ý — xem Decision 2) một cách
  đúng đắn nếu chưa biết payload thật; đoán mò sẽ vi phạm chính nguyên
  tắc "không suy luận khi chưa có bằng chứng" xuyên suốt project này.
- **Rejected alternatives:** Suy luận payload từ shape của `destroy_objects`
  đã biết — rejected, `create`/`modify` gần như chắc chắn có shape khác
  (cần field list đầy đủ của user, không chỉ `id`).

### Decision 2 — Giữ nguyên pattern "purpose-built body builder", không đổi
- **Chosen:** `src/ObjectQuery.cpp` có thêm `buildUserCreateBody(...)`,
  `buildUserUpdateBody(id, ...)`, `buildUserDeleteBody(id)` — mỗi hàm
  hard-code field list được phép, không nhận object/field string tuỳ ý
  từ caller, giống hệt 3 hàm đọc đã có.
- **Why:** Đây là nguyên tắc bảo mật cốt lõi đã thiết lập từ P5 (Decision
  4 gốc) — không đổi cho lần mở rộng API ghi đầu tiên, khi rủi ro sai sót
  cao hơn hẳn so với API đọc.
- **Rejected alternatives:** Một `ObjectQuery` generic nhận
  object/fields/where tuỳ ý cho gọn — rejected, đây chính xác là điều
  P5's Decision 4 đã cố tình tránh.

### Decision 3 — Phạm vi field được phép ghi: KHÔNG bao gồm password/credential trong phase này
- **Chosen:** `create()`/`update()` chỉ nhận: `name`, `registration`
  (Employee ID), `beginTime`/`endTime`, `userTypeId`. **Không** nhận
  `password`, `salt`, `panicPassword`, `panicSalt`, hay bất kỳ trường
  liên quan xác thực/credential nào qua SDK trong phase này.
- **Why:** Theo đúng phân loại rủi ro đã thống nhất trước đó — các API
  liên quan credential/mật khẩu cần được cân nhắc và duyệt riêng, kỹ hơn
  (nhóm "luôn phải hỏi trước mỗi lần test"), không nên gộp chung vào lần
  mở rộng CRUD đầu tiên này.
- **Rejected alternatives:** Cho phép set password ngay từ đầu vì
  "users.html cũng cho set" — rejected, mở rộng phạm vi ghi credential
  cần 1 quyết định riêng, có cân nhắc kỹ hơn (ví dụ: SDK có nên cho set
  plaintext password qua network không, hay chỉ nên hỗ trợ qua
  `remote_enroll`/PIN device-side).

### Decision 4 — Live-write test dùng đúng 1 user thử nghiệm, tự tạo tự xoá, gate riêng biệt
- **Chosen:** Live test (nếu được duyệt) phải: (1) `create()` 1 user mới
  với tên rõ ràng đánh dấu thử nghiệm (ví dụ `SDK_TEST_DELETE_ME`), (2)
  `get(id)` xác nhận đúng field vừa tạo, (3) `update()` đổi 1 field, xác
  nhận lại, (4) `remove(id)` xoá — **chỉ xoá đúng ID vừa tạo trong cùng
  lần chạy**, không bao giờ match theo tên hay giả định ID. Yêu cầu 1
  approval message **riêng biệt, khác với** approval đọc-only đã dùng
  trước đây (ví dụ `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>`) — đây là
  lần ghi/xoá dữ liệu thật ĐẦU TIÊN của toàn bộ project.
- **Why:** Đây là ranh giới rủi ro hoàn toàn khác so với mọi live-test
  trước đó (vốn luôn 100% đọc). Cần 1 gate mới, tường minh, không được
  suy luận từ approval cũ.
- **Rejected alternatives:** Tái sử dụng `APPROVE_LIVE_DEVICE_TEST` cũ —
  rejected, tên gate đó vốn được định nghĩa (P1, Giai đoạn 0+1/1b) là
  cho read-only; dùng lại cho ghi/xoá sẽ làm mất ý nghĩa phân biệt.

### Decision 5 — Risk level: `high-risk`
- **Chosen:** Xếp plan này `high-risk` (yêu cầu Plan Review + execution
  approval + role_verification), thay vì `feature` như các plan discovery
  trước.
- **Why:** Đây là plan đầu tiên thêm code ghi thật vào SDK lõi và (nếu
  duyệt) thao tác ghi/xoá thật trên thiết bị — khớp với cách plan P5 gốc
  (chỉ đọc) từng được xếp `high-risk` vì là core SDK implementation; mở
  rộng sang ghi rõ ràng rủi ro cao hơn, không nên hạ xuống `feature`.
- **Rejected alternatives:** `feature` — rejected, thiếu Plan Review bắt
  buộc và execution-approval-token cho 1 thay đổi có write path.

---

## Scope

### In scope
- Group 0: discovery bổ sung (đọc tĩnh `class/user.js`/`class/baseclass.js`,
  cần 1 live fetch — không cần login mới nếu session cache còn, nhưng
  vẫn tính là device contact).
- `src/ObjectQuery.{hpp,cpp}`: thêm 3 hàm build body (create/update/delete)
  cho `users`, hard-coded field list.
- `include/amico/Client.hpp` + `src/Client.cpp`: `UsersApi::create()`,
  `update()`, `remove()`.
- `include/amico/Types.hpp`: kiểu tham số cho create/update (ví dụ
  `NewUser`/`UserUpdate` struct) — chỉ chứa field ở Decision 3.
- Offline unit test mới (fixture-based) cho cả 3 hàm + builder tests
  (giống `test_query_whitelist.cpp`'s pattern — xác nhận builder không
  bao giờ nhận field/object tuỳ ý).
- `docs/sdk-usage.md`, `docs/src-map.md` cập nhật.
- Live-write test (`test/live/`) — chỉ **chạy** nếu approval riêng được
  cấp; code có thể viết ngay, nhưng execution cần gate riêng (Decision 4).

### Out of scope (explicitly excluded)
- Set/đổi password, salt, panic_password, panic_salt qua SDK — để dành
  cho 1 quyết định riêng sau này (nhóm rủi ro credential).
- Group membership, custom fields, PIN/fingerprint/face enrollment qua
  SDK (`remote_enroll` v.v.) — đây là API riêng biệt, không phải "User
  CRUD" cơ bản, để dành phase sau.
- Bất kỳ API ghi nào ngoài `users` (không đụng `groups`, `time_zones`,
  `portals`, `configuration`...).
- P6 (test ghi với nhiều edge case/destructive) — chỉ làm happy-path
  create/update/delete 1 user thử nghiệm trong phase này.
- Sửa lại API đọc đã có (`list`/`get`) — giữ nguyên hoàn toàn.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `artifacts/live_capture/user_class_js.network-response` (mới) | Create | Fetch tĩnh `class/user.js` (Group 0 discovery) |
| `artifacts/live_capture/baseclass_js.network-response` (mới) | Create | Fetch tĩnh `class/baseclass.js` (Group 0 discovery) |
| `docs/ui-action-protocol-map.md` | Modify | Ghi payload shape thật của create/modify/destroy users sau Group 0 |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | Thêm 3 hàm build body ghi, hard-coded field list |
| `include/amico/Client.hpp` / `src/Client.cpp` | Modify | Thêm `UsersApi::create/update/remove` |
| `include/amico/Types.hpp` | Modify | Thêm struct tham số cho create/update |
| `test/test_users.cpp` hoặc file mới `test/test_users_write.cpp` | Create/Modify | Unit test offline cho create/update/remove |
| `test/test_query_whitelist.cpp` | Modify | Thêm assertion cho 3 builder mới (không nhận field tuỳ ý) |
| `test/fixtures/*.json` (mới) | Create | Fixture cho response create/update/delete |
| `test/live/live_smoke_test.cpp` hoặc file mới `test/live/live_write_test.cpp` | Create | Live-write test (Decision 4), chỉ chạy khi được duyệt |
| `docs/sdk-usage.md` | Modify | Ví dụ dùng `create/update/remove` |
| `docs/src-map.md` | Modify | Cập nhật mô tả các file trên |
| `examples/create_user_example.cpp` (mới, cân nhắc) | Create | Ví dụ minh hoạ, theo đúng convention `examples/` hiện có |

---

## Risks and unknowns

- **Chưa biết payload thật của `create_objects`/`modify_objects` cho
  `users`** — Group 0 phải giải quyết trước khi viết `ObjectQuery.cpp`.
  Nếu Group 0 không tìm đủ thông tin, dừng lại báo cáo, không đoán mò.
- **Rủi ro cao nhất: vô tình sửa/xoá user thật** (`Phat`/`Phuong Hoang`/
  `Trung Dung`) nếu live-test code có lỗi logic (ví dụ match sai ID). Xử
  lý bằng Decision 4's "chỉ xoá đúng ID vừa tạo trong cùng lần chạy",
  cộng thêm test offline kỹ trước khi đụng live.
- Thiết bị có thể giới hạn số lượng user tối đa (đã thấy license face
  limit 10000/50000 ở Giai đoạn 1b) — user thử nghiệm 1 cái không đáng
  lo, nhưng cần xoá sạch sau test, không để lại rác trên thiết bị thật.
- `panic_password`/`panic_salt` là các field cực nhạy cảm đã biết tồn
  tại trên `users` object — phải đảm bảo builder mới (create/update)
  không bao giờ có đường dẫn set các field này (khớp Decision 3).

---

## Open questions

- [ ] `create_objects` và `object_add` có phải 2 cách khác nhau để tạo
      user, hay 1 cái dùng cho `users` và cái kia cho object khác? Cần
      Group 0 xác nhận.
- [ ] Response thành công của `create_objects` có trả về `id` mới tạo
      luôn không, hay cần gọi `list`/`get` riêng để lấy? Cần Group 0 xác
      nhận trước khi thiết kế chữ ký hàm `create()` (trả `int64_t id`
      hay `AmicoUser` đầy đủ).

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal rõ, có Group 0 discovery trước khi cam kết thiết kế code |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 5 out-of-scope items, mỗi cái có lý do |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Một vài file (create struct, live test filename) còn phụ thuộc kết quả Group 0 |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Done-looks-like map trực tiếp sang create/update/remove + test |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes
**Confirmed on:** 2026-09-12 (user: "oke")
