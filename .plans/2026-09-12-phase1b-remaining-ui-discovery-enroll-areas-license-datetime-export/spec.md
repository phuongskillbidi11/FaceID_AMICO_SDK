# Spec — Giai đoạn 1b: Hoàn thiện discovery còn thiếu (Enroll, Areas/Portals, License Mode, Date/Time, Report Export)

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.
> This file answers WHAT and WHY. tasks.md answers HOW.

---

## Goal

Đóng 5 khoảng trống discovery mà chính `docs/ui-action-protocol-map.md`'s
"Gaps not resolved this pass" (từ plan `p1-read-only-browser-mcp-discovery-pass-`)
đã nêu rõ nhưng chưa từng làm: trang **Enroll** (face/card enrollment),
trang quản lý **Areas/Portals**, panel **License Mode**, panel **Date and
Time**, và handler nút **Report Export**. Đây là bước cuối cùng để bức
tranh protocol/API của AMICO Web UI hoàn chỉnh, trước khi bắt đầu implement
bất kỳ API ghi nào (user CRUD, enrollment...) ở giai đoạn sau.

**Done looks like:** `docs/ui-action-protocol-map.md` có mục riêng cho cả
5 khoảng trống trên, mỗi mục có evidence category rõ ràng
(`LIVE_CONFIRMED`/`JS_CONFIRMED`/`UI_HANDLER_CONFIRMED`), và mục "Gaps not
resolved this pass" được cập nhật để phản ánh đúng những gì còn lại thật
sự (nếu có) sau lượt này — không còn khoảng trống nào bị bỏ sót một cách
âm thầm.

---

## Background

Audit toàn bộ `.plans/` (2026-09-12) xác nhận: SDK hiện tại đã được git
baseline + verify độc lập + live-test PASS
(`phase-2-remediation-and-live-device-verification`, COMPLETED); Giai đoạn
0+1 (`phase0-1-git-baseline-and-enroll-config-discovery`) vừa hoàn thành
Groups 1–4 (git baseline, sửa gap `docs/src-map.md`, và tài liệu hoá 48
lệnh `MessengerUtil` còn thiếu bằng cách đọc tĩnh `configurations.js`)
nhưng **Group 5 (Enroll page) không chạy** vì không có live-device
approval trong lượt đó. Người dùng đã xác nhận mục tiêu tiếp theo là mở
rộng SDK + xây app tương tự web UI thiết bị (bao gồm cả API ghi cho user
CRUD và enrollment) — nhưng trước khi viết bất kỳ spec nào cho enrollment
hay Areas/Portals, cần dữ liệu protocol thật cho các trang đó, hiện chưa
có (`docs/ui-action-protocol-map.md` ghi rõ enrollment "Remains `INFERRED`
only").

---

## Design decisions

### Decision 1 — Giữ đúng kỷ luật bằng chứng: tĩnh trước, live sau, có gate riêng
- **Chosen:** Với mỗi khoảng trống, ưu tiên đọc JS tĩnh (không cần chạm
  thiết bị) nếu file JS liên quan có thể lấy được từ artifact đã cache
  hoặc từ 1 lần fetch tĩnh không cần login. Chỉ khi cần xác nhận qua
  browser thật (đăng nhập, mở trang, xem network panel) mới tiến hành live
  session — và việc đó cần **1 message approval riêng**, tách biệt khỏi
  approval cho spec này, đúng tiền lệ đã lập bởi plan P1 và Giai đoạn 0+1's
  Decision 5.
- **Why:** Nhất quán với toàn bộ lịch sử governance của project, và với
  chỉ đạo hiện tại của user: "Không contact `192.168.2.156` nếu chưa có
  approval live-device riêng."
- **Rejected alternatives:** Coi approval của spec này là đủ để tự động
  mở browser/chạm thiết bị — rejected, phá vỡ tiền lệ.

### Decision 2 — Report "Export" là read-only, nằm trong scope
- **Chosen:** Bấm nút Export của trang Reports (đã visited ở P1, `object:"reports"`)
  được coi là hành động **đọc** (xuất dữ liệu đã có ra file), không phải
  create/update/delete — nằm trong scope "read-only" của toàn bộ chuỗi
  discovery này.
- **Why:** Export chỉ lấy dữ liệu access-logs đã tồn tại và định dạng lại
  thành file tải về; không tạo/sửa/xoá bản ghi nào trên thiết bị. Task
  brief gốc của cả chuỗi discovery này luôn định nghĩa "read-only" theo
  nghĩa "không ghi dữ liệu", không phải "không bao giờ tải file".
- **Rejected alternatives:** Loại Export khỏi scope vì nó "trông giống"
  hành động ghi — rejected, quá thận trọng không cần thiết, và đây chính
  là gap P1 đã cố tình để lại "cho một lượt đọc tĩnh sau" (xem
  `docs/ui-action-protocol-map.md`'s dòng về `reportcustomview.js`).

### Decision 3 — Không tái tạo lại evidence đã có
- **Chosen:** Không fetch lại `configurations.js` (đã đọc tĩnh đủ 78/78
  lệnh qua 2 lượt: P1 gốc + Giai đoạn 0+1's 48-command pass). Chỉ fetch
  JS mới cho những trang chưa từng được đọc: Enroll page, Areas/Portals
  page (nếu là trang riêng), License Mode panel (nếu panel này gọi 1 file
  JS khác `configurations.js`).
- **Why:** Simplicity First — tránh lặp lại công việc đã xong.
- **Rejected alternatives:** Đọc lại toàn bộ `configurations.js` "cho
  chắc" — rejected, lãng phí, không có giá trị mới.

### Decision 4 — License Mode / Date-Time: thử lại thao tác live (không phải rủi ro mới)
- **Chosen:** P1's session bị 1 modal "About" bị kẹt, che mất panel
  License Mode/Date-Time thật. Lượt này thử mở lại 2 tile này từ trạng
  thái sạch (đóng modal About trước, hoặc reload trang trước khi bấm), để
  capture đúng network request/panel — đây là retry kỹ thuật, không phải
  scope mới hay rủi ro mới.
- **Why:** Cả 2 tile này chỉ là đọc thêm thông tin hiển thị (License đã
  `LIVE_CONFIRMED` qua `system_information.fcgi`; write-side của Date/Time
  đã `UI_HANDLER_CONFIRMED` qua Giai đoạn 0+1's 48-command pass) — phần
  còn thiếu chỉ là xác nhận UI/panel đọc, không phải dữ liệu mới có rủi
  ro.
- **Rejected alternatives:** Bỏ qua 2 tile này vì "đã coi như đủ" —
  rejected, vì user đã liệt kê rõ đây là 1 trong các phần còn thiếu cần
  ưu tiên.

---

## Scope

### In scope
- Đọc tĩnh (nếu lấy được JS không cần login) hoặc qua live browser
  read-only (nếu cần) cho: trang Enroll, trang Areas/Portals (nếu tồn
  tại), panel License Mode, panel Date and Time, nút Report Export.
- Cập nhật `docs/ui-action-protocol-map.md` với các mục mới, đúng evidence
  category.
- Cập nhật `artifacts/ui-action-map.json`/lưu artifact mới nếu có network
  capture (screenshot, `.network-response`) theo đúng convention hiện có
  (`captures/screenshots/`, `artifacts/live_capture/`).
- Cập nhật lại "Gaps not resolved this pass" trong `docs/ui-action-protocol-map.md`
  để phản ánh đúng còn lại gì (nếu có) sau lượt này.

### Out of scope (explicitly excluded)
- Implement bất kỳ API ghi nào (enrollment thật, user CRUD, config
  write...) — chỉ discovery/tài liệu, không code SDK.
- Bất kỳ thao tác ghi/enroll/tạo/sửa/xoá thật trên thiết bị (kể cả enroll
  thử 1 khuôn mặt) — chỉ xem, không enroll.
- P6 (test API ghi với 1 test-identity dùng để xoá) — để dành, chỉ làm khi
  thật sự cần và có gate riêng, theo đúng chỉ đạo hiện tại của user.
- Sort-by-column trên trang Users — đã xác nhận ở P1 là không có control
  (không phải gap thật, không cần điều tra lại).
- Sửa/patch Global Engineering Harness — đã ghi nhận là known bug riêng
  (xem `.plans/2026-09-12-phase0-1-git-baseline-and-enroll-config-discovery/DECISION_LOG.md`),
  không xử lý trong plan này.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `docs/ui-action-protocol-map.md` | Modify | Thêm mục cho cả 5 khoảng trống + cập nhật "Gaps not resolved this pass". |
| `artifacts/ui-action-map.json` | Modify (nếu có structured data mới) | Đồng bộ nếu phù hợp schema hiện có (theo đúng Task 4.3 precedent của Giai đoạn 0+1: no-op nếu không hợp schema, ghi rõ lý do). |
| `artifacts/live_capture/*.network-response` (mới) | Create | Lưu JS/network capture mới cho từng trang, nếu có live session. |
| `captures/screenshots/p1b_*.png` (mới) | Create | Screenshot cho từng trang mới xem, nối tiếp convention `p1_NN_*.png`. |

---

## Risks and unknowns

- Không biết trước Enroll page dùng file JS tên gì, hay có cần 1 luồng
  upload ảnh phức tạp hơn các trang đã khảo sát — có thể tốn nhiều thời
  gian đọc hơn dự kiến.
- Areas/Portals có thể không tồn tại như 1 trang quản lý riêng (P1 đã
  không tìm thấy) — nếu vậy, ghi nhận rõ "không có trang riêng, chỉ có
  `object:"areas"` qua các trang khác" thay vì cố tạo ra phát hiện không
  có thật.
- License Mode/Date-Time panel có thể vẫn bị che bởi modal như lần trước
  — nếu retry vẫn thất bại, ghi nhận là gap còn lại thật sự, không phải
  lỗi thực thi.
- Report Export có thể trigger download 1 file thật (`.csv`/`.txt`) chứa
  dữ liệu access-logs thật — cần xử lý đúng theo `docs/security-sanitization-policy.md`
  (không commit file thô chứa dữ liệu thật, chỉ tóm tắt/redact nếu cần
  lưu evidence).

---

## Open questions

- [ ] Enroll page có gọi qua `MessengerUtil.send` dispatcher như
      `configurations.js`, hay có cơ chế riêng (ví dụ multipart upload)? —
      cần xác nhận khi đọc JS thật.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal là hoàn thiện evidence, nêu rõ observable end state |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 5 out-of-scope items, mỗi cái có lý do |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Danh sách file rõ ràng, phần lớn là docs/artifacts |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Mỗi khoảng trống map trực tiếp sang "Done looks like" |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes
**Confirmed on:** 2026-09-12 (user: "Tiếp tục Phase 1b theo NORMAL workflow... Tiếp tục từ spec hiện có")
