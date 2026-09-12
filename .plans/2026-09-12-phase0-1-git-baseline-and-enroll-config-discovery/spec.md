# Spec — Giai đoạn 0+1: Git baseline cho SDK hiện có + discovery bổ sung (Enroll, config/relay còn thiếu)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.
> This file answers WHAT and WHY. tasks.md answers HOW.

---

## Goal

Đưa toàn bộ cây mã nguồn SDK hiện có (`include/`, `src/`, `test/`,
`examples/`, `docs/`, `CMakeLists.txt`, `vcpkg.json`, `webui/`, `.plans/`,
`scripts/`, `HID_Amico_VL35LF_User_Guide/`, `.agent/project.yaml`,
`.clang-tidy`) vào một commit git baseline sạch, đã secret-scan, đã
`.gitignore` đúng — hiện tại repo chỉ có `README.md` được track, mọi plan
trước đây phải dùng content-hash thay vì `git diff` vì lý do này. Đồng
thời sửa một khoảng trống tài liệu nhỏ còn sót lại từ plan trước
(`docs/src-map.md` chưa có dòng cho module `src/NetworkSafety.{hpp,cpp}`
mới, dù nó đã tồn tại trên đĩa), và chạy thêm một vòng discovery đọc-only
(giống đúng kỷ luật bằng chứng của P1) cho hai khoảng trống P1 đã nêu rõ
nhưng chưa làm: trang **Enroll** (face/card enrollment) và các lệnh
config/relay còn chưa được ghi chi tiết trong `docs/ui-action-protocol-map.md`'s
danh sách 78 lệnh `MessengerUtil.send`.

**Done looks like:** (a) `git log` cho thấy một commit baseline mới chứa
toàn bộ cây trên (trừ build artifacts/binary lớn), sạch secret-scan; (b)
`docs/src-map.md` mô tả đúng module `NetworkSafety` và các field/method mới
(`TlsVerificationError`, `AmicoClient::checkReachable()`,
`NetworkInfo::selfSignedCertificate`) mà Task 3.1 của plan remediation
trước không cover; (c) `docs/ui-action-protocol-map.md` có mục riêng cho
trang Enroll (đánh giá bằng chứng theo đúng legend `LIVE_CONFIRMED` /
`JS_CONFIRMED` / `UI_HANDLER_CONFIRMED` đã dùng xuyên suốt project) và cho
các lệnh config/relay còn thiếu; không có thao tác ghi/relay nào được kích
hoạt thật trên thiết bị trong plan này.

---

## Background

Từ audit toàn bộ `.plans/` (2026-09-12): SDK hiện tại (kết quả của plan
`p5-rewrite-the-phase-2-read-only-c-17-am`, được remediate governance bởi
`phase-2-remediation-and-live-device-verification`, COMPLETED, live-device
test PASS) đang là code thật, đã verify độc lập, đã chạy live PASS — nhưng
**chưa từng được commit vào git**. Việc này khiến mọi bước governance từ
trước tới nay phải dùng content-hash diff thay vì git diff, và khiến rủi ro
mất lịch sử/khó review tăng dần theo thời gian nếu để càng lâu càng nhiều
thay đổi chồng lên nhau không có baseline.

Ngoài ra, user đã xác nhận mục tiêu kế tiếp là mở rộng SDK + xây dựng app
tương tự web UI thiết bị (bao gồm cả một số API ghi: user CRUD, enrollment).
Trước khi viết bất kỳ spec nào cho user CRUD (Giai đoạn 2) hay enrollment
(Giai đoạn 3), cần đóng 2 khoảng trống evidence mà chính `p1-read-only-browser-mcp-discovery-pass-`'s
sprint-summary.md đã liệt kê là "gaps carried forward": trang Enroll chưa
từng được xem, và một số lệnh config/relay trong danh sách 78 lệnh vẫn ở
mức "tên lệnh biết được, chưa đọc chi tiết payload/handler".

---

## Design decisions

### Decision 1 — Git baseline là hành động thuần túy bổ sung, không đổi code
- **Chosen:** Chỉ thêm `.gitignore` entries còn thiếu rồi `git add` +
  `git commit` toàn bộ cây hiện có (trừ build artifacts). Không sửa bất kỳ
  file `.cpp`/`.hpp` nào của SDK trong Giai đoạn 0.
- **Why:** Đây là housekeeping, không phải thay đổi hành vi — trộn code
  change vào cùng 1 commit baseline sẽ làm mất giá trị "baseline sạch" của
  chính commit đó.
- **Rejected alternatives:** Gộp luôn việc sửa `docs/src-map.md` gap vào
  cùng lúc git add rồi commit 1 lần — chấp nhận được vì đó là thay đổi tài
  liệu (không phải code), xem Decision 2.

### Decision 2 — `.gitignore` phải được sửa TRƯỚC khi `git add`, không phải sau
- **Chosen:** Thêm `build-exec/`, `build-verify/`, `build-verifier/`,
  `.vs/` vào `.gitignore` (bên cạnh `build/`, `out/`, `vcpkg_installed/`
  đã có sẵn) trước bất kỳ lệnh `git add` nào.
- **Why:** Kiểm tra thực tế cho thấy `build-exec/`, `build-verify/`,
  `build-verifier/` (mỗi cái ~200MB, chứa `vcpkg_installed/` + binary đã
  build) và `.vs/` (713MB, cache riêng của Visual Studio) đều **chưa** nằm
  trong `.gitignore` hiện tại — nếu `git add -A` trước khi sửa, sẽ vô tình
  đưa hơn 1.3GB binary/cache vào lịch sử git, gần như không thể dọn sạch
  lại sau này (`git filter-repo` cần thiết, rất tốn công).
- **Rejected alternatives:** `git add -A` rồi `git rm --cached` sau —
  rejected vì các blob lớn vẫn nằm vĩnh viễn trong lịch sử git ngay cả sau
  khi `rm --cached`, chỉ filter-repo mới xoá được; phòng trước rẻ hơn nhiều
  so với sửa sau.

### Decision 3 — Chỉ `git add` theo danh sách path tường minh, không dùng `-A`/`.`
- **Chosen:** Liệt kê tường minh từng top-level path cần add (xem "Affected
  files"), không dùng `git add -A` hay `git add .`.
- **Why:** An toàn hơn — nếu `.gitignore` sót một pattern nào đó, add tường
  minh theo path đã biết trước vẫn không kéo theo các build dir vào (vì
  chúng không nằm trong danh sách path được liệt kê), là lớp phòng thủ thứ
  hai bên cạnh Decision 2.
- **Rejected alternatives:** `-A` sau khi đã sửa `.gitignore` — vẫn chấp
  nhận được về mặt kỹ thuật, nhưng path tường minh cho phép Executor tự
  xác nhận từng path trước khi add, khớp nguyên tắc Surgical Changes.

### Decision 4 — Secret scan chạy lại trên toàn bộ cây trước commit đầu tiên
- **Chosen:** Chạy lại đúng 2 lệnh secret-scan đã dùng xuyên suốt các plan
  trước (`docs/security-sanitization-policy.md`'s 2 pattern) trên toàn bộ
  cây sắp add, không chỉ trên phần thay đổi trong plan này.
- **Why:** Đây là lần đầu tiên toàn bộ cây được đưa vào git cùng lúc —
  không có commit trước đó để so sánh incremental diff, nên phải quét lại
  từ đầu để chắc chắn.
- **Rejected alternatives:** Tin tưởng các secret scan trước đó của từng
  plan riêng lẻ là đủ — rejected vì file mới/sửa từ nhiều plan cộng dồn có
  thể tạo ra tổ hợp chưa từng được quét cùng nhau.

### Decision 5 — Discovery Enroll + config/relay còn thiếu giữ đúng kỷ luật bằng chứng của P1, cần approval riêng cho việc chạm live device
- **Chosen:** Đọc tĩnh JS trước (an toàn, không cần thiết bị) cho những gì
  có thể; chỉ khi cần xác nhận qua browser thật thì mới tiến hành 1 phiên
  live browser (Chrome DevTools MCP) read-only — đăng nhập, xem trang
  Enroll và các tab config còn thiếu, KHÔNG bấm bất kỳ nút ghi/enroll/relay
  nào. Việc này cần một message approval riêng, tách biệt khỏi approval
  cho spec này — đúng tiền lệ P1 (P1 cũng yêu cầu approval riêng cho việc
  chạm Browser MCP dù đã có spec approval).
- **Why:** Nhất quán với toàn bộ lịch sử governance của project này (mọi
  lần chạm thiết bị thật, dù chỉ đọc, đều có gate riêng); và vì trang
  Enroll gần như chắc chắn có luồng chụp ảnh/khuôn mặt — cần cẩn trọng dù
  chỉ xem, không enroll thật.
- **Rejected alternatives:** Coi approval của spec này là đủ để tự động
  chạm live device — rejected, phá vỡ tiền lệ đã thiết lập, và mâu thuẫn
  với chỉ đạo "không tự contact device" đã được nhắc lại nhiều lần trong
  session.

### Decision 6 — Không đụng vào 2 plan `BLOCKED` cũ
- **Chosen:** Không sửa, không tham chiếu ngược, không "đóng" 2 plan
  `implement-phase-2-production-oriented-re` và
  `p5-rewrite-the-phase-2-read-only-c-17-am` trong lượt này.
- **Why:** Theo đúng kết luận của audit trước (2026-09-12): cả hai đã dừng
  hẳn (`Next: no automatic transition`), không ràng buộc gì lên công việc
  mới, và user đã chỉ đạo rõ "giữ nguyên lịch sử" — không sửa chỉ để "trông
  giống workflow mới".
- **Rejected alternatives:** Thêm 1 task nhỏ để `eng plan cancel`/ghi chú
  tham chiếu — rejected vì không cần thiết và nằm ngoài mục tiêu chính của
  plan này.

---

## Scope

### In scope
- Sửa `.gitignore` (thêm `build-exec/`, `build-verify/`, `build-verifier/`,
  `.vs/`).
- Secret scan lại toàn bộ cây sắp commit.
- `git add` theo danh sách path tường minh + 1 commit baseline.
- Sửa khoảng trống `docs/src-map.md` (thêm dòng cho
  `src/NetworkSafety.{hpp,cpp}`, ghi chú `TlsVerificationError`,
  `checkReachable()`, `NetworkInfo::selfSignedCertificate` vào các dòng
  tương ứng của `Errors.hpp`/`Client.hpp`/`Types.hpp`).
- Discovery đọc-only cho trang Enroll (face/card) — tĩnh trước, live
  browser sau nếu cần, dưới approval riêng.
- Discovery đọc-only (tĩnh JS) cho các lệnh config/relay trong danh sách
  78 lệnh của `docs/ui-action-protocol-map.md` mà chưa có payload/handler
  chi tiết.
- Cập nhật `docs/ui-action-protocol-map.md` (và `artifacts/ui-action-map.json`
  nếu có lệnh mới phát hiện) với kết quả discovery, đúng evidence-category
  legend hiện có.

### Out of scope (explicitly excluded)
- Bất kỳ thay đổi code C++ nào của SDK (không thêm class/API mới trong
  plan này — đó là Giai đoạn 2 trở đi).
- Bất kỳ thao tác ghi/relay/enrollment thật nào trên thiết bị (chỉ đọc).
- Implement user CRUD hay enrollment thật — chỉ discovery, chưa code.
- Sửa/đóng 2 plan `BLOCKED` cũ (xem Decision 6).
- Chạy `clang-tidy` (môi trường chưa cài, không liên quan mục tiêu plan
  này) — vẫn ghi nhận là gap đã biết, không silently bỏ qua.
- Xử lý gap "Areas/Portals management page" và "Report Export handler" từ
  P1 — để lại cho một discovery pass khác sau này nếu cần, không phải
  trong scope Enroll/config lần này (tránh phình phạm vi).

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `.gitignore` | Modify | Thêm `build-exec/`, `build-verify/`, `build-verifier/`, `.vs/` trước khi add bất kỳ thứ gì. |
| *(toàn bộ cây hiện có — xem danh sách path dưới)* | Create (trong git, lần đầu track) | Git baseline commit đầu tiên cho SDK. |
| `docs/src-map.md` | Modify | Thêm dòng `src/NetworkSafety.hpp`/`.cpp`; ghi chú các field/method mới trong Errors/Client/Types. |
| `docs/ui-action-protocol-map.md` | Modify | Thêm mục Enroll page + các lệnh config/relay còn thiếu, kèm evidence category. |
| `artifacts/ui-action-map.json` | Modify (nếu phát hiện lệnh mới) | Đồng bộ với `ui-action-protocol-map.md`. |
| `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/DECISION_LOG.md` | Modify | Ghi các quyết định trên. |
| `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/sprint-summary.md` | Modify | Tổng kết cuối plan. |

**Danh sách top-level path sẽ `git add` cho baseline commit** (tường minh,
không dùng `-A`): `.agent/project.yaml`, `.clang-tidy`, `.gitignore`,
`.plans/`, `CMakeLists.txt`, `HID_Amico_VL35LF_User_Guide/`, `artifacts/`,
`captures/`, `docs/`, `examples/`, `include/`, `scripts/`, `src/`, `test/`,
`vcpkg.json`, `webui/`. (`.vs/`, `build/`, `build-exec/`, `build-verify/`,
`build-verifier/`, `out/` bị loại trừ qua `.gitignore`, không nằm trong
danh sách này.)

---

## Risks and unknowns

- **Rủi ro lớn nhất: commit nhầm build artifact/binary lớn.** Giảm thiểu
  bằng Decision 2 + 3 (gitignore trước, add tường minh theo path, kiểm tra
  `git status`/kích thước sau khi add, trước khi commit).
- `.plans/` chứa nhiều file governance (DECISION_LOG, tasks.md...) của các
  plan cũ — đã secret-scan sạch qua từng plan riêng lẻ trước đó, nhưng
  Decision 4 quét lại lần nữa cho chắc.
- Trang Enroll có thể có luồng upload ảnh/binary phức tạp hơn các trang đã
  khảo sát trước — có thể cần nhiều thời gian đọc JS hơn dự kiến; không
  chặn việc hoàn thành phần git baseline (2 phần độc lập nhau).
- Đọc tĩnh JS cho relay/config có thể không đủ để hiểu đầy đủ ngữ nghĩa
  runtime (vì không được kích hoạt thật) — chấp nhận được, vì mục tiêu
  Giai đoạn 1 chỉ là map protocol, không phải implement.
- `HID_Amico_VL35LF_User_Guide/` (8.7MB, ảnh PNG trích từ manual) sẽ làm
  tăng đáng kể kích thước commit đầu tiên — chấp nhận được vì đây là tài
  liệu tham khảo hợp lệ, không phải build artifact.

---

## Open questions

- [ ] Việc xem trang Enroll có cần approval live-device riêng theo đúng
      tiền lệ P1 hay không — **đã quyết định: có** (Decision 5), chờ user
      xác nhận bằng 1 message riêng trước khi tasks.md chạm tới phần đó.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal là baseline/evidence, không phải feature mới — nêu rõ observable end state |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items, mỗi cái có lý do |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Danh sách path git add tường minh thay vì mô tả mơ hồ |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Mỗi in-scope item map trực tiếp sang "Done looks like" |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes
**Confirmed on:** 2026-09-12 (user: "oke")
