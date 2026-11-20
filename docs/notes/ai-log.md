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

## Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1)
**Công cụ:** Claude Code (VS Code).

**Token Phase 2** (cộng từ file lịch sử phiên, trừ phần Phase 1 đã ghi ở trên; 72 lượt trả lời của AI):
| Loại | Số token |
|---|---|
| Output (AI viết ra) | ~227.600 |
| Input mới | ~170 |
| Ghi bộ nhớ đệm (cache write) | ~273.300 |
| Đọc lại bộ nhớ đệm (cache read) | ~29,0 triệu |

Như Phase 1: "cache read" là ngữ cảnh bị đọc lại mỗi lượt, không phải nội dung mới. Phase 2 tốn gần gấp đôi output của Phase 1 vì phạm vi lớn (3 bản đồ, 5 trạng thái bóng, Gió Lạc, Bùa Gió, tạm dừng, cài đặt, âm thanh, HUD).

**Quy trình đã làm**
1. Đọc PDF ticket, so với giả định Phase 1, lập bảng "Phase 2 đổi gì" và giả định mới (`docs/notes/phase2-spec.md`) TRƯỚC khi code.
2. Viết tiêu chí nghiệm thu cho từng mục Phần 3 trong spec; viết kịch bản trong `tests/cases.ts` cho từng tính năng; viết lõi theo thứ tự 12 bước của ticket.
3. Kiểm thử đột biến (cố ý phá logic để xem test có đỏ không), rồi mới làm bản web.
4. Bản web làm sau lõi, chụp ảnh bằng Chrome headless để kiểm.

**Chỗ AI sai / suýt sai, và cách phát hiện**
- **Test dùng chính hằng số bị phá ở cả hai vế** (kỳ vọng tính từ `WORLD.shade_recoil_m`, `WORLD.charm_speed`...): thử đột biến cho thấy 2/16 phép phá không làm test đỏ. Đã đổi sang số ghi cứng từ ticket; 18/18 phép phá giờ bị bắt. Bài học đã đưa vào `AGENTS.md`: số kỳ vọng trong test không lấy từ `WORLD.*`.
- Lực đẩy lùi của bóng mất 1 bước (59 thay vì 60) do thứ tự "giảm bộ đếm trước khi di chuyển" → phát hiện khi viết kỳ vọng "lùi 2 m trong 60 tick" bằng tay; tách lực đẩy khỏi bộ đếm trạng thái.
- Hai test của chính tôi sai (đọc snapshot tick không tồn tại; đếm thiếu một tick khi tiếp tục sau tạm dừng) → phân tích lại từng kỳ vọng, sửa test chứ không sửa code, vì code đúng theo giả định đã ghi.
- Bot tham lam của Phase 1 thua mọi ván với số chuẩn → điều tra thấy lỗi ở bot (đi thẳng vào bóng); thêm né/lướt thì Đêm 1 thắng 2/6. Không ghi "game thắng được" cho Đêm 2 vì bot vẫn thua 6/6.
- Dùng `python3` trong lệnh shell làm treo; script đột biến tạm sửa file lõi nên không được chỉnh `src/core` song song (suýt ghi đè) → chỉ sửa file web trong lúc script chạy.
- Chrome headless bằng giả lập GPU phần mềm làm crash cảnh nặng (Đêm 3) → chụp được ít ảnh hơn dự định; ghi rõ trong bằng chứng thay vì suy diễn.

**Harness:** `AGENTS.md` cập nhật cho phạm vi mới (kiến trúc maps/world/flow, quy tắc test không dùng `WORLD.*`); thêm skill `.claude/skills/verify-phase/SKILL.md` (typecheck, test, proof, tất định, hiệu năng, báo "CHƯA KIỂM CHỨNG" thay vì "đạt").

**Đánh giá Phase 2:** lõi headless v1.1 đạt theo bằng chứng (89/89 test, 67/67 kịch bản CLI, 21.600 tick chạy 0,45–0,6 s, tất định). Chưa kiểm chứng: âm thanh, FPS ≥ 30 trên GPU thật, hình ảnh tầng/dốc/tháp Đêm 3, ván chơi tay Đêm 2–3; bot chưa thắng Đêm 2. Chi tiết: [phase2-acceptance.md](../proof/phase2-acceptance.md).
