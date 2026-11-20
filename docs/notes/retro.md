# Retro: Đảo Đèn Lồng, 4 phase làm với AI (Claude Code)

Tổng hợp cuối dự án. Số liệu và bằng chứng chi tiết từng phase ở [ai-log.md](ai-log.md) và `docs/proof/phase*-acceptance.md`.

## 1. Evaluation của 4 phase (tóm tắt)
| Phase | Kết quả | Chưa kiểm chứng lúc nộp |
|---|---|---|
| 1 · PRD-0 (1 Đêm, headless v1.0) | lõi + CLI + web; 26 test; mọi phép đột biến có ý nghĩa bị bắt sau khi bổ sung 2 kịch bản | chơi tay, ảnh màn thắng thật, macOS/Linux |
| 2 · Ticket-02 (3 Đêm, v1.1) | 3 bản đồ, Gió Lạc, Bùa Gió, lướt, rơi, tạm dừng; 89 test, 67 kịch bản; 18/18 đột biến bắt được | lúc nộp: âm thanh, hình tầng/dốc/tháp, chơi tay Đêm 2–3 (sau đó chủ repo tự kiểm và báo ổn) |
| 3 · Ticket-03 (đèn cạn dầu, v1.2) | nhiên liệu, drain, thắng ở bình minh, mù màu; 132 test, 106 kịch bản; 22 đột biến bắt được | bằng chứng ván thắng Đêm 2–3 (chủ repo báo đã thắng; bot trong repo thì chưa); giao diện mới: chủ repo đã xem và báo ổn |
| 4 · Ticket-04 (phát hành v1.0.0, v1.3) | benchmark, soak, bảng xếp hạng, đổi phím, trợ năng, đóng gói; 150 test | số đo trên máy chấm của giảng viên; clone sạch trên máy khác (các tính năng mới: chủ repo đã chơi thử và báo đạt) |

Điểm yếu còn lại (nói thẳng): bot tham lam trong repo chỉ thắng Đêm 1 (1/6 ván), chưa thắng Đêm 2–3; chủ repo báo đã tự thắng Đêm 2–3 nhưng không có bản ghi, nên độ cân bằng dựa vào lời khai; giả định có thể lệch test ẩn (ghi ở các file spec: Đêm 3 xuất phát, `night_start` ở tick 0, `deposited` của đèn sáng, `refuel.amount`, camera bench quay chiều nào, seed soak bắt đầu từ i = 1); kiểm tra tất định mới chạy trên một máy Windows.

## 2. Điều gì hiệu quả khi làm với AI
- **Đọc đề, ghi giả định và kịch bản kiểm chứng TRƯỚC khi viết luật.** Mỗi phase bắt đầu bằng bảng "đổi gì" + giả định + tiêu chí nghiệm thu. Phase 3 (đổi luật cốt lõi) hưởng lợi nhiều nhất: chạy test cũ trước, 10 test đỏ và đúng là các test của luật bị thay, không có hồi quy bất ngờ.
- **Một nguồn kịch bản cho test, proof và bot** (`tests/cases.ts`): sửa một chỗ, ba nơi dùng. Bằng chứng sinh bằng lệnh thật nên không phải bịa số.
- **Kiểm thử đột biến** (cố ý phá logic để xem test có đỏ không) là việc đáng giá nhất: lần nào cũng phát hiện vài test "xanh giả". Test dùng chính hằng số bị phá ở cả hai vế là lỗi AI hay mắc.
- **Tách lõi thuần khỏi hiển thị:** đổi giao diện, thêm benchmark/đổi phím/bảng xếp hạng không chạm tới đầu ra headless.
- **Ghi trung thực cái chưa kiểm chứng** (âm thanh, hình ảnh, FPS trên GPU thật, ván chơi tay): tránh viết "đạt" cho thứ chưa ai nhìn.

## 3. Điều gì không hiệu quả
- **Tin test xanh ngay lần đầu** (Phase 1: 25/25 xanh nhưng đột biến lọt 2/5).
- **Lệnh shell dài có nhiều heredoc**: nhiều lần không ghi được file mà không báo lỗi rõ; phải dùng công cụ Write cho file lớn. Script sửa nhiều chỗ bằng thay chuỗi từng dừng giữa chừng.
- **Chụp ảnh bằng Chrome headless** (giả lập GPU phần mềm) làm crash cảnh nặng và cho số FPS vô nghĩa; FPS thật phải do chủ repo đo bằng F3 trên GPU thật.
- **Phiên rất dài** bị nén ngữ cảnh nhiều lần; AI phải đọc lại thư mục để tiếp tục. Tốn token và dễ quên chi tiết (đã gặp: suýt ghi đè bằng chứng Phase 2 bằng script bot cũ).

## 4. Những lần AI sai và cách tôi phát hiện
| Sai | Phát hiện bằng |
|---|---|
| Ghi đè `package.json` làm mất devDependencies (P1) | đọc lại file, cài lại |
| Cảnh 3D gần như tối đen vì đơn vị ánh sáng (P1) | chụp ảnh thật, không phải build/typecheck |
| Test dùng cùng hằng số bị phá ở cả hai vế, 2/16 đột biến lọt (P2) | chạy đột biến |
| Lực đẩy lùi chỉ 59 bước thay vì 60 (P2) | viết kỳ vọng "lùi 2 m trong 60 tick" bằng tay |
| Bot thua mọi ván vì đi thẳng vào bóng (P2) | điều tra ván bot, thêm né/lướt |
| Một cặp thay thế sai khiến script dừng giữa chừng; 10 kịch bản mới đỏ ngay lần đầu do dựng cảnh/đọc snapshot sai (P3) | chạy từng bước, đọc lỗi |
| Script bot Phase 2 ghi thẳng vào bằng chứng đã đóng băng (P3) | đọc mã trước khi chạy |
| Cờ `--disable-frame-rate-limit` làm p1_low chỉ ~10 fps dù FPS trung bình cao (P4) | đo thử từng cờ, so p1_low; bỏ cờ |
| `mem_end` vượt 1,2 × `mem_start` chỉ vì bộ nhớ JIT khởi động, không phải rò rỉ (P4) | chạy 3/10/30/100/300 Đêm thấy RSS phẳng; đo `mem_start` sau khởi động và ghi rõ |

## 5. Harness nào giúp nhiều nhất
- **`AGENTS.md`** (ngắn): luật kiến trúc "core thuần / web chỉ hiển thị", cú pháp Node erasable, và quy tắc "số kỳ vọng trong test phải ghi cứng từ ticket, không lấy từ `WORLD.*`" (rút ra từ lỗi P2). Giúp nhất vì mỗi phiên/mỗi lần nén ngữ cảnh đều đọc lại.
- **Skill `verify-phase`**: danh sách bước kiểm chứng (typecheck, test, proof, tất định, hiệu năng, build) và quy tắc báo "CHƯA KIỂM CHỨNG" thay vì "đạt".
- Chưa dùng hook (ý định ban đầu: hook chạy `npm test` trước khi kết thúc phiên; chưa làm, nên đây là việc nếu làm lại).

## 6. Token / chi phí AI (ước tính từ file lịch sử phiên của Claude Code)
| Phase | Output | Cache write | Cache read |
|---|---|---|---|
| 1 | ~135 nghìn | ~211 nghìn | ~12,7 triệu |
| 2 | ~228 nghìn | ~273 nghìn | ~29,0 triệu |
| 3 | ~186 nghìn | ~355 nghìn | ~40,9 triệu |
| 4 (đến ngay trước khi commit Phase 4) | ~149 nghìn | ~682 nghìn | ~37,4 triệu |
| **Tổng** | **~697 nghìn** | **~1,52 triệu** | **~120 triệu** |

Input mới tổng khoảng 810 token (cộng cả bốn phase). "Cache read" lớn vì ngữ cảnh bị đọc lại mỗi lượt, không phải nội dung khác nhau. **Chi phí tiền không tính được** vì không có bảng giá/gói áp dụng ở đây; tôi không bịa con số đô la.

**Cách tiết kiệm:** đọc đề một lần rồi viết kịch bản trước khi code; `AGENTS.md` ngắn; chạy test thay vì để AI "tin là đúng"; chỉ chụp ảnh khi cần (ảnh tốn token và Chrome headless hay hỏng); một nguồn kịch bản dùng chung; đọc từng đoạn file thay vì cả file lớn; bỏ qua yêu cầu có bản quyền (Luffy) ngay từ đầu thay vì làm rồi sửa. Việc chưa tiết kiệm được: phiên quá dài và bị nén ngữ cảnh nhiều lần.

## 7. Nếu làm lại tôi sẽ đổi
1. **Chia phiên theo phase** (mỗi phase một phiên mới, mang theo AGENTS.md + spec) thay vì một phiên xuyên suốt, để giảm cache read và rủi ro quên.
2. **Làm bot/mô phỏng người chơi tốt hơn sớm** (có Bùa Gió, tránh Gió Lạc, biết châm dầu) để có số liệu cân bằng thật thay vì chỉ "bot thắng 1/6".
3. **Thêm hook chạy test và kiểm thử đột biến tự động** (script đột biến là mã tạm, không nằm trong repo) để lỗi test-xanh-giả bị bắt ngay trong phiên.
4. **Hỏi/ghi giả định về hướng quay và chỉ số "i"** của ticket ngay khi đọc đề và nhắn người ra đề, thay vì đoán rồi ghi chú.
5. **Đo FPS trên GPU thật sớm hơn** (mỗi phase) và không dựa vào Chrome headless; bench có cờ để chọn cách tắt vsync từ đầu.
6. **Quay video demo và tạo Release ngay khi gần xong Phase 3**, không để dồn tới cuối.
