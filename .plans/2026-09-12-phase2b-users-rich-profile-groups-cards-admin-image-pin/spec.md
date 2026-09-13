# Spec — Giai đoạn 2b: Users rich profile (Groups, Cards, Administrator, Face/Bio count, Image, PIN fallback)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.
> This file answers WHAT and WHY. tasks.md answers HOW.

---

## Goal

Mở rộng `AmicoClient::UsersApi` để phản ánh **toàn bộ** các trường thật sự
có trong tab Users của web UI (`Image`, `Nº of Groups`, `Nº of Cards`,
`Face`, `Administrator`, cộng thêm `hasPassword`), và thêm các thao tác
ghi tương ứng (gán/gỡ group, thêm/xoá thẻ, đặt cờ admin, upload/xoá ảnh
đại diện, và **set** — không bao giờ đọc lại — password/PIN dùng làm
phương án nhận diện dự phòng khi khẩu trang chặn nhận diện khuôn mặt).

**Done looks like:** `AmicoUser` (hoặc 1 kiểu mở rộng) có đủ:
`groupIds`/`groupCount`, `cardCount`/`cards`, `isAdministrator`,
`faceCount`, `bioCount`, `hasPassword`, `imageUrl`. `UsersApi` có thêm:
`addToGroup`/`removeFromGroup`, `addCard`/`removeCard`,
`setAdministrator`, `setImage`/`removeImage`, `setPassword` (PIN/password
dự phòng). Mỗi hàm có unit test offline; live-write test (gated, giống
GD2) xác nhận hoạt động thật trên 1 user thử nghiệm.

---

## Background

Cuộc trò chuyện dẫn tới plan này (2026-09-12) đã thống nhất qua nhiều
vòng làm rõ:
- Mục tiêu là "public hoàn toàn" theo nghĩa **đầy đủ tính năng** của tab
  Users (không phải expose API ra Internet không cần auth).
- Lý do cụ thể cần password/PIN: **phòng sạch bắt buộc đeo khẩu trang**
  khiến nhận diện khuôn mặt không hoạt động được — cần password/PIN làm
  phương án nhận diện dự phòng để mở cửa.
- Ranh giới bảo mật duy nhất giữ nguyên: **không bao giờ đọc lại giá trị
  password/salt/panic_password/panic_salt thật** qua bất kỳ API nào của
  SDK này — kể cả khi chủ thiết bị yêu cầu trực tiếp nhiều lần (xem
  memory `feedback_never_expose_password_hash.md`). Việc **set** thì
  hoàn toàn hợp lệ và đã được đồng ý.
- Upload ảnh (2 file mẫu: `Ưng Hoàng Phúc.PNG`, `Trần Đăng Khoa.PNG` từ
  `C:\Users\Admin\Downloads`) chỉ set được **ảnh đại diện hiển thị**
  (cột "Image") — **không** đăng ký được khuôn mặt để nhận diện thật
  (`face_templates`, chỉ qua `remote_enroll` với camera thiết bị thật,
  có người đứng trước máy). Face enrollment thật để riêng 1 plan sau,
  không nằm trong plan này.

Đọc `class/user.js` (đã cache từ Giai đoạn 2) đã xác nhận đủ shape cho
Groups/Cards/Administrator/Face-count/Bio-count/Image. Còn thiếu:
`class/intermediatetable.js` (cơ chế add/remove chung cho các bảng liên
kết như `user_groups`) và `class/group.js` (đã biết field cơ bản từ P1
nhưng chưa xác nhận payload write) — cần Group 0 đọc thêm 2 file này
trước khi implement Groups' write path.

---

## Design decisions

### Decision 1 — Group 0: đọc thêm `intermediatetable.js` + `group.js` trước khi viết code ghi Groups
- **Chosen:** Fetch tĩnh (đã cache sẵn qua browser, không cần login mới
  nếu session còn — nhưng vẫn tính là live-device-read, cần approval
  riêng như mọi lần) 2 file JS còn thiếu để xác nhận chính xác payload
  `add`/`remove` group membership.
- **Why:** `Card`/`UserRole`/Users' create-update đã có bằng chứng đủ từ
  GD2; riêng cơ chế `IntermediateTable.add/remove` (dùng chung cho
  Groups VÀ Access Rules) chưa từng được đọc.
- **Rejected alternatives:** Đoán payload dựa theo pattern
  `create_objects`/`destroy_objects` đã biết — rejected, đúng nguyên tắc
  "không suy luận khi chưa có bằng chứng" đã áp dụng xuyên suốt project.

### Decision 2 — Password/PIN: chỉ SET, không bao giờ GET giá trị thật
- **Chosen:** Thêm `UsersApi::setPassword(id, plaintextPassword)` —
  SDK tự gọi `user_hash_password` để băm phía client (đúng như web UI
  thật làm), rồi gửi `password`/`salt` (đã băm) vào `modify_objects`.
  Thêm field đọc `AmicoUser::hasPassword` (bool) — suy ra từ việc
  `password` có null/rỗng hay không trong response `load_objects`
  (**vẫn phải luôn có `fields` tường minh, không bao giờ omit để "tiện
  lấy hết" — xem Decision 4 gốc của SDK**), nhưng **không** bao giờ giải
  mã/trả về giá trị `password`/`salt` thật ra ngoài kiểu `AmicoUser`.
- **Why:** Đã thống nhất rõ với user — nhu cầu thật (mở cửa bằng
  password khi đeo khẩu trang) chỉ cần SET hoạt động đúng, không cần
  đọc lại. Đọc lại hash tạo bề mặt tấn công thật (offline brute-force),
  không phục vụ mục đích vận hành nào. Xem memory
  `feedback_never_expose_password_hash.md` cho toàn bộ lý do và quá
  trình thống nhất.
- **Rejected alternatives:** Thêm field `password`/`salt` vào `AmicoUser`
  — **từ chối dứt khoát**, kể cả khi được yêu cầu lại nhiều lần trong
  hội thoại dẫn tới plan này.

### Decision 3 — Face/Bio: chỉ COUNT, không bao giờ lấy raw template
- **Chosen:** `AmicoUser::faceCount`/`bioCount` (int) — từ
  `load_objects {object:"face_templates"/"templates", fields:["COUNT(*)"], where:{users:{id}}}`.
  Không thêm bất kỳ API nào trả về raw base64 template.
- **Why:** Template sinh trắc học là dữ liệu cực nhạy cảm (đã ghi nhận
  từ P1) — count đủ để tab hiển thị "Face: có/không", không cần dữ liệu
  thật.
- **Rejected alternatives:** Trả raw template "vì tab dùng nó" — tab
  thật ra chỉ hiển thị trạng thái có/không, không hiển thị ảnh
  template; không có nhu cầu thật để trả raw data.

### Decision 4 — Image: đọc qua URL trực tiếp, ghi qua upload/remove
- **Chosen:** `AmicoUser::imageUrl` (string, `/user_get_image.fcgi?user_id=<id>` —
  URL, không tự động tải bytes). `UsersApi::setImage(id, bytes)` (qua
  `user_set_image`, `MessengerUtil.sendFile`), `removeImage(id)` (qua
  `user_destroy_image`). Test được ngay với 2 ảnh mẫu người dùng cung
  cấp.
- **Why:** Khớp đúng cơ chế thật (`user.js`'s `getImage()`), không cần
  SDK tự tải/giải mã ảnh — để caller tự quyết định khi nào cần.
- **Rejected alternatives:** SDK tự fetch và trả về bytes ảnh luôn —
  rejected, không cần thiết, tăng chi phí mặc định cho mọi lần `list()`.

### Decision 5 — Groups/Cards/Administrator: read + write, theo đúng payload đã/sẽ xác nhận
- **Chosen:** Đọc: `groupIds` (danh sách id), `cardCount`, `isAdministrator`.
  Ghi: `addToGroup(userId, groupId)`/`removeFromGroup(...)`,
  `addCard(userId, cardValue)`/`removeCard(cardId)`,
  `setAdministrator(userId, bool)` — theo đúng shape xác nhận ở Group 0
  + `UserRole`/`Card` classes đã đọc.
- **Why:** Đây là các trường dữ liệu bình thường của hệ thống kiểm soát
  ra vào (không phải credential nhạy cảm như password/biometric) — an
  toàn để đọc/ghi đầy đủ như user yêu cầu.
- **Rejected alternatives:** Không có — đây chính là phần "lấy hết
  luôn" hợp lệ, không có lý do để giới hạn thêm.

### Decision 6 — Live-write test mở rộng, vẫn theo đúng gate cũ
- **Chosen:** Test live (gated, cần approval riêng như GD2) dùng lại
  đúng 1 user thử nghiệm tự tạo tự xoá (không phải user thật) để test
  addToGroup/addCard/setAdministrator/setImage/setPassword. Riêng
  `setPassword` cần thêm 1 xác nhận live-execution riêng mỗi lần (theo
  memory `feedback_write_api_risk_tiers.md`), tách biệt khỏi approval
  chung của cả live-write test.
- **Why:** Nhất quán với toàn bộ tiền lệ project, và với nguyên tắc
  "credential-adjacent write luôn hỏi trước mỗi lần" đã thống nhất.

---

## Scope

### In scope
- Group 0: đọc tĩnh `class/intermediatetable.js`, `class/group.js`
  (cần 1 lần live-device-read, approval riêng).
- Đọc: `groupIds`, `cardCount` (+ `cards` list nếu cần), `isAdministrator`,
  `faceCount`, `bioCount`, `hasPassword`, `imageUrl`.
- Ghi: `addToGroup`/`removeFromGroup`, `addCard`/`removeCard`,
  `setAdministrator`, `setImage`/`removeImage`, `setPassword`
  (không đọc lại).
- Unit test offline cho tất cả các hàm trên.
- Live-write test mở rộng (gated), test bằng 1 user thử nghiệm tự
  tạo/tự xoá, kèm test upload thật 2 ảnh mẫu người dùng cung cấp.
- Cập nhật `docs/ui-action-protocol-map.md`, `docs/src-map.md`,
  `docs/sdk-usage.md`.

### Out of scope (explicitly excluded)
- Đọc/trả về giá trị `password`/`salt`/`panic_password`/`panic_salt`
  thật — từ chối dứt khoát (xem Decision 2).
- Đọc/trả về raw face/fingerprint template — chỉ count (Decision 3).
- Face/fingerprint enrollment thật (`remote_enroll`,
  `template_extract`/`match`) — cần người đứng trước thiết bị thật hoặc
  đầu đọc vân tay USB (không có sẵn) — để dành plan riêng sau.
- Access Rules (`user_access_rules`) — phát hiện thêm ngoài yêu cầu ban
  đầu, không nằm trong scope tab Users hiện tại (chỉ Groups/Cards có
  trong bảng UI).
- Opening Times, Custom Fields, Web/API Login (`api_logins`) — đã biết
  1 phần từ trước nhưng không nằm trong yêu cầu hiện tại; để dành nếu
  cần sau.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `artifacts/live_capture/intermediatetable_js.network-response`, `group_js.network-response` (mới) | Create | Group 0 discovery |
| `docs/ui-action-protocol-map.md` | Modify | Ghi payload Groups/Cards write đã xác nhận |
| `docs/src-map.md`, `docs/sdk-usage.md` | Modify | Cập nhật mô tả |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | Thêm builder cho group-membership add/remove, card add/remove, administrator set, password set |
| `include/amico/Client.hpp` / `src/Client.cpp` | Modify | Thêm các method ở Decision 2/4/5 |
| `include/amico/Types.hpp` | Modify | Mở rộng `AmicoUser` (hoặc thêm `UserProfile` riêng) với các field mới |
| `test/test_query_whitelist.cpp`, `test/test_users.cpp` | Modify | Test offline cho toàn bộ hàm mới |
| `test/fixtures/*.json` (mới) | Create | Fixture tương ứng |
| `test/live/live_write_test.cpp` | Modify | Mở rộng test live cho các thao tác mới |

---

## Risks and unknowns

- Chưa biết chính xác payload `add`/`remove` của `IntermediateTable` —
  Group 0 phải giải quyết trước Group ghi Groups.
- `Administrator` (`user_roles`) có thể có ràng buộc đặc biệt (ví dụ:
  không cho gỡ quyền admin của chính user đang đăng nhập) — cần thận
  trọng khi test live, không test trên chính tài khoản `Admin`/`Phuong Hoang`.
- Upload ảnh 2 file mẫu (~vài trăm KB mỗi file) qua `sendFile` — cần xác
  nhận giới hạn kích thước/định dạng thiết bị chấp nhận trước khi test
  live.
- `setPassword` dù chỉ ghi, vẫn là thao tác credential-adjacent — mỗi
  lần chạy live cần hỏi lại theo đúng nguyên tắc đã thống nhất, không
  gộp chung vào approval của cả live-write test.

---

## Open questions

- [ ] `IntermediateTable.add()/remove()` gửi lệnh gì, payload thế nào?
      — Group 0 phải trả lời trước khi viết Task Groups-write.
- [ ] `class/group.js`'s Group object — có field nào khác `id`/`name`
      không (ví dụ mô tả, số lượng thành viên)?

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal rõ, có Group 0 discovery trước khi cam kết thiết kế write cho Groups |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 5 out-of-scope items, mỗi cái có lý do |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Nhất quán với pattern GD2 |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Mỗi field/method map trực tiếp sang "Done looks like" |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]
