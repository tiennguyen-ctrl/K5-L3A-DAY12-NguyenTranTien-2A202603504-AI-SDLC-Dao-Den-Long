# Nhật ký dùng AI và đánh giá

## Phase 1
**Công cụ:** Claude Code (VS Code).

**Token Phase 1** (cộng từ file lịch sử phiên của Claude Code, 72 lượt trả lời của AI, tính đến lúc hoàn tất Phase 1):
| Loại | Số token |
|---|---|
| Output (AI viết ra) | ~135.000 |
| Input mới | ~180 |
| Ghi bộ nhớ đệm (cache write) | ~211.000 |
| Đọc lại bộ nhớ đệm (cache read) | ~12,7 triệu |

Ghi chú: "cache read" là lượng ngữ cảnh được đọc lại ở mỗi lượt (cùng một đoạn hội thoại bị tính lại nhiều lần) nên con số lớn, không phải 12,7 triệu token nội dung khác nhau. Chi phí tiền không tính được vì không có bảng giá/gói áp dụng ở đây. Đây là số của một phiên duy nhất (Phase 1); Phase 2, 3, 4 sẽ thêm mục riêng.

**Cách tiết kiệm đã dùng:** đọc đề một lần rồi viết kịch bản kiểm chứng (`tests/cases.ts`) trước khi code; `AGENTS.md` ngắn; chạy test thay vì để AI "tin là đúng"; chỉ chụp ảnh khi cần; dùng chung một nguồn kịch bản cho test, proof và bot.

**Quy trình đã làm**
1. AI đọc toàn bộ PDF PRD-0 + 6 file hướng dẫn của lab, tóm tắt việc phải làm.
2. Chọn stack TypeScript + Node (lõi) + Three.js (web); hello headless/typecheck/build chạy trước khi viết game.
3. Ghi giả định (docs/notes/phase1-assumptions.md) và nghĩ cách kiểm chứng (tests/cases.ts) trước khi viết luật.
4. Viết lõi → headless CLI → test → bản web. Không commit/push trong quá trình làm (quy tắc của chủ repo).

**Chỗ AI sai / suýt sai, và cách phát hiện**
- Ghi đè `package.json` làm mất `devDependencies` → phát hiện khi đọc lại file, cài lại bằng `npm i -D`.
- Lệnh shell nhiều heredoc bị lỗi cú pháp nên 3 file không được ghi (headless vẫn là bản hello) → phát hiện bằng `ls`, ghi lại từng file bằng công cụ Write. Bài học: file lớn dùng Write, không dùng heredoc trong một lệnh dài.
- **Test lần đầu đạt cả 25/25, nghi test yếu** → thử "đột biến" (cố ý phá logic): 2/5 phép phá không bị bắt (kịch bản nhảy không giữ nút; một phép phá nhắm nhầm đoạn code). Đã thêm `jump_edge`, nhắm lại phép phá safe_radius; cả hai giờ làm test đỏ. Kết quả cuối: 26 test đạt, các phép phá có ý nghĩa đều bị bắt.
- Cảnh 3D lần đầu gần như tối đen (ánh sáng Three.js dùng đơn vị vật lý, cường độ đặt quá thấp) → chỉ phát hiện nhờ chụp ảnh thật, không phải nhờ build/typecheck. Đã tăng ánh sáng.
- `python3` treo trong một lệnh → dừng tác vụ, dùng Edit thay thế.

**Harness:** `AGENTS.md` (lệnh, ranh giới core/web, quy tắc không phá contract). Chưa có skill/hook; ứng viên cho Phase 2: hook chạy `npm test` trước khi kết thúc phiên.

**Đánh giá Phase 1:** lõi + headless + contract đạt theo bằng chứng. Còn thiếu: chơi thử bản web bằng tay, ảnh màn thắng, chạy trên macOS/Linux, số token thật. Xem [phase1-acceptance.md](../proof/phase1-acceptance.md).
