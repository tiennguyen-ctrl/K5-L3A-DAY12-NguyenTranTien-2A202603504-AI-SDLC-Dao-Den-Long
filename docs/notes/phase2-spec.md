# Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1): spec, giả định, tiêu chí nghiệm thu

Nguồn: Ticket-02 trên lab board (không sao chép PDF của giảng viên vào repo). Tài liệu này là bản spec của tôi, viết **trước khi code**.

## 1. Phase 2 đổi gì so với Phase 1 (số chuẩn thay mọi số tôi tự chọn ở Phase 1)

| Mục | Phase 1 (tôi chọn) | Phase 2 (chuẩn) | Ghi chú |
|---|---|---|---|
| Sức chứa đom đóm | 5 | 10 | |
| Chi phí thắp đèn | 5 | 10 | |
| Bán kính nhặt / tương tác | 1,5 / 3 | 1,0 / 2,0 | nhặt thêm điều kiện chênh cao ≤ 1,5 |
| Tỏa sáng | tốn 1, 8 m, hồi 2 s, choáng 3 s | tốn 3, 5 m, hồi 3 s, choáng 120 tick | tâm = chân + 0,8 m, khoảng cách 3D |
| Bóng Mực | 3,5 m/s, đuổi từ xa | 4,0 m/s (Đêm 3: 4,5), phát hiện 12 m, bỏ đuổi 18 m | 5 trạng thái |
| Vùng an toàn | 4 m quanh **mọi** đèn | 6 m quanh đèn **đã sáng** | |
| Rơi khỏi đảo | chặn ở mép | rơi (Y < -10), mất 1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh | `fall_enabled = true` |
| Điểm | 10 nhặt / 100 / 20 / 1 / 50 | 10 mỗi đom đóm **nạp** / 100 / 5 / 2 / 50 | điểm đom đóm tính lúc nạp, không phải lúc nhặt |
| Thắng/thua | thắng ưu tiên | hết Ngọn Lửa luôn thua trước; còn sống và đủ đèn thì thắng kể cả đúng tick hết giờ | |
| Nhảy | 7,5 m/s | 7,0 m/s, trọng lực -20 | |
| Bị đánh | rơi floor(mang × 0,5), không hết hạn | rơi floor(mang / 2) ra vành 1,5–2,5 m, tồn tại 480 tick | |
| Di chuyển | tức thời | tăng/dừng trong ≤ 0,1 s | chọn tức thời (0 s), thỏa "≤ 0,1 s" |

Test Phase 1 bị luật chuẩn làm sai đã được **sửa kèm lý do** (xem mục 5), không tắt âm thầm.

## 2. Giả định cho chỗ Ticket-02 còn mơ hồ
1. **Góc**: `(x, z) = (cx + r·cos θ, cz + r·sin θ)` (góc đo từ +X về phía +Z). Kiểm tra bằng bản đồ: tầng 1 Đêm 3 nằm ở nửa `z > 0` và dốc ở 30°/150° nối vào tầng này, nên z phải dương.
2. **Điểm xuất phát**: Đêm 1 và 2 là (0,0,0). Đêm 3 là **(0,0,-30)** (ticket không nêu; (0,0,0) nằm trong tháp chuông). Hồi sinh sau khi rơi ở đúng điểm này. Hướng ban đầu +Z.
3. **Chiều cao mặt đất** là một hàm `h(x,z)` (vô cực âm = biển mây/rơi). Mỗi tầng/dốc/tháp là một khối đặc đến mặt của nó; một thực thể chỉ vào được ô có `h ≤ y + 0,35`, nên vách đứng chặn đi lên, và bước ra khỏi tầng cao thì rơi.
4. **Dash**: hướng = hướng di chuyển (sau xoay camera) nếu đang bấm, nếu không thì hướng đang quay mặt. 12 tick, vy = 0 (giữ độ cao, không trọng lực). Hồi chiêu 90 tick tính từ lúc bắt đầu. Bùa Gió: hồi chiêu 0, nhưng bấm khi đang lướt bị bỏ qua. Không nhảy khi đang lướt.
5. **Nhặt/va chạm thứ tự độ cao**: chênh cao so sánh **chân Mây** với **mặt đất** nơi đặt đom đóm / bóng (bóng dùng chiều cao mặt đất dưới nó, nên tâm bóng cao 1,0 m không làm sai lệch).
6. **Tâm bóng**: sinh ra ở `h + 1,0` m. Bóng từ scenario giữ nguyên Y đã cho (độ lệch so với mặt đất được nhớ lại).
7. **Bóng Mực**: `wander` lượn 2 m/s đổi hướng mỗi 90 tick; `spawning` kéo dài 30 tick (đứng yên, vô hại); sau `recoil`/`stunned` hết hạn thì về `chase` nếu Mây trong 18 m, ngược lại `wander`. Bóng ở `spawning`, `recoil`, `stunned` không gây sát thương. Bóng từ scenario mặc định `chase` ngay.
8. **Vùng an toàn**: chỉ đèn đã sáng. Bóng bên ngoài bị chặn ở mép `6 + 0,01` m; bóng đang ở bên trong khi đèn vừa sáng bị đẩy ra 0,2 m/tick (tối đa 30 tick) và không gây sát thương trong lúc ở trong vùng.
9. **Điểm xuất hiện thực thể**: bóng sinh ở điểm cách Mây ≥ 15 m và chưa có bóng chiếm (cách < 1 m). Hết điểm hợp lệ thì bỏ lượt. Gió Lạc sinh ở một trong các điểm sương (chính là điểm sinh Bóng Mực của Đêm đó).
10. **Gió Lạc**: bay ở độ cao mặt đất + 1,0; `flee` bay thẳng ra xa theo hướng lúc bắt đầu; hết hạn thì biến mất khỏi danh sách (trạng thái `removed` chỉ tồn tại trong tick đó).
11. **Gió mạnh** (Đêm 3, mặc định bật; `wind_enabled` tắt được): chu kỳ 1800 sim_tick; báo trước từ tick 1680 của chu kỳ trước; gió thổi 300 tick, hướng chọn lúc báo trước. Chỉ đẩy Mây (2 m/s, cộng vào vận tốc).
12. **`night_start`** ghi ở tick 0 (trước snapshot 0) cho chạy mặc định. `paused`/`resumed` ghi ở tick bấm; tick bấm tạm dừng không chạy mô phỏng, tick bấm tiếp tục thì chạy bình thường.
13. **`invuln`** trong snapshot là số tick còn lại (số nguyên); `dash_cd_s`, `pulse_cd_s`, `charm_s` là giây.
14. **Nhặt thành công mới tính** `mote_picked`; điểm đom đóm cộng ở sự kiện `deposit`.
15. **Scenario** v1.1: `drifters` và `charms` thay thế danh sách mặc định; phần tử cần `pos`; `state` của bóng/Gió Lạc kiểm tra theo tên hợp lệ (sai thì thoát mã 2).
16. **Tổng điểm game** = tổng điểm các Đêm đã thắng: do bản web cộng dồn; headless chạy một Đêm nên `score` của một Đêm.

## 3. Tiêu chí nghiệm thu cho từng mục Phần 3 (mỗi dòng kiểm chứng được)
**Gió Lạc (Đêm 2, 3)**
- GL1 Sinh tại tick 1200, 2400, …; tối đa 2; id D1, D2, …; Đêm 1 không có.
- GL2 `idle → chase` khi mang ≥ 5 và cách ≤ 15 m; mất điều kiện thì về `idle`.
- GL3 Chạm (XZ ≤ 1,2): cướp `min(3, mang)`, sự kiện `drifter_steal {drifter_id, amount, carried}`, chuyển `flee`; mỗi con chỉ cướp một lần; không mất Ngọn Lửa.
- GL4 Tỏa Sáng trúng Gió Lạc đang `chase`: thành `flee`, không cướp. Trúng khi `flee` có mang đồ: sự kiện `drifter_drop {drifter_id, amount}`, thả đom đóm tại chỗ, biến mất sau 120 tick.
- GL5 Vùng an toàn không chặn; bất tử của Mây không ngăn cướp.

**Bùa Gió**
- BG1 Có ở Đêm 2 (35,0,0) và Đêm 3 (30,0,25), (-30,0,25); id C1, C2; Đêm 1 không có.
- BG2 Nhặt theo luật như đom đóm: sự kiện `charm_picked {charm_id, charm_ticks: 600}`; nhặt lại làm mới.
- BG3 Hiệu lực 600 tick: chạy 7,2 m/s; lướt không hồi chiêu nhưng vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua.
- BG4 Xuất hiện lại sau 2700 tick (`respawn_s` trong snapshot).

**Chuỗi 3 Đêm (web)**: menu → giới thiệu Đêm → chơi → kết quả → Đêm kế; thắng Đêm 3 hiện màn Bình Minh với tổng điểm; thua thì chơi lại đúng Đêm đó. Kiểm: ảnh từng màn + logic trong `src/web/flow.ts` có test.
**Tạm dừng**: Esc/P dừng toàn bộ logic. Headless: `pause` ở tick k thì `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên, snapshot `state: "paused"`; sự kiện `paused`/`resumed`.
**Cài đặt**: âm lượng, độ nhạy chuột lưu qua `localStorage`; kiểm bằng test `settings.ts`.
**Âm thanh**: nhạc nền và hiệu ứng (nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, bóng xuất hiện, đếm ngược 10 s cuối), tổng hợp bằng Web Audio (không có file âm thanh).
**HUD**: đủ các thành phần ở mục 7 của ticket (Ngọn Lửa, đồng hồ đỏ nhấp nháy khi ≤ 30 s, đèn k/n, điểm, thanh 10 ô, hồi chiêu, gợi ý nạp, mũi tên chỉ đèn).
**Bảng màu**: các màu liệt kê trong ticket lấy đúng mã hex; ánh sáng môi trường = `0,15 + 0,55 × (đèn sáng / tổng đèn)`.

## 4. Kế hoạch kiểm chứng (viết trước khi code)
- Mỗi tính năng mới có **ít nhất một kịch bản headless** trong `tests/cases.ts` (trường `phase: 2`).
- Hồi quy Phase 1: các kịch bản cũ chạy lại với số chuẩn (số kỳ vọng tính từ `T`); chỗ nào luật đổi thì sửa kèm lý do (mục 5).
- Bản đồ Đêm 2/3: kịch bản cầu tre, rơi khỏi đảo, bục nhảy, leo dốc, vách đứng, tháp chuông, gió.
- Tất định: hai lần chạy giống hệt trên cả 3 Đêm.
- Hiệu năng: đo thời gian chạy 21.600 tick (mục tiêu ≤ 30 s) và ghi lại; FPS bản web đo bằng Chrome.

## 5. Test Phase 1 bị đổi (kèm lý do)
| Kịch bản | Thay đổi | Lý do |
|---|---|---|
| mọi kịch bản | số kỳ vọng lấy từ `T` mới | số chuẩn |
| pickup_mote, carry_capacity | điểm không cộng lúc nhặt; sức chứa 10 | điểm tính lúc nạp (ticket) |
| deposit_lit, win_all_lit | số đom đóm 10; điểm thắng ×2 giây, +5 mỗi bóng | số chuẩn |
| shade_hit_drop_invuln | bóng ở trạng thái recoil sau khi chạm | luật bóng v1.1 |
| lose_no_flames | không đổi ý nghĩa | |
| pulse_stun | bán kính 5, tâm +0,8 m, choáng 120 tick, +5 điểm, chi phí 3 | số chuẩn |
| safe_radius | chỉ đèn đã sáng, 6 m | luật chuẩn |
| scenario_silent | cho phép sự kiện `night_start` ở tick 0 | contract v1.1 |
