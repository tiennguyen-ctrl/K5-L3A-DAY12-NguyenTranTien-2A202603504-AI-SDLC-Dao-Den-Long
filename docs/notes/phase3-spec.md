# Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2): spec, giả định, tiêu chí nghiệm thu

Viết TRƯỚC khi sửa code (kịch bản kiểm chứng trong `tests/cases.ts` viết cùng lúc). Quyết định thiết kế: [ADR-001](../adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

## 1. Phase 3 đổi gì so với Phase 2

| Chủ đề | Phase 2 | Phase 3 (Ticket-03) | Loại |
|---|---|---|---|
| Đèn đã sáng | không nhận thêm đom đóm, sáng mãi | có `fuel` 0..100, hao 1/s, châm dầu +10/đom đóm, hết dầu thì **tắt** (`lantern_out`) | THAY THẾ |
| Thắp lại | — | đèn từng sáng (`ever_lit`) chỉ cần 5 đom đóm; đèn chưa từng sáng vẫn cần 10 | mới |
| Vùng an toàn | mọi đèn sáng, Bóng không bao giờ vào | chỉ đèn sáng có `fuel >= 30` (đúng 30 vẫn còn) | THAY THẾ |
| Bóng Mực | 5 trạng thái, `wander` lượn ngẫu nhiên | thêm `drain`: bóng `wander` đi tới đèn yếu (`fuel < 30`) gần nhất, cách ≤ 2 m thì đứng hút 5 fuel/s; hết choáng về `wander` | THAY THẾ + mới |
| Thắng | thắp đủ đèn là thắng ngay (`all_lit`) | còn sống đến hết giờ và số đèn sáng ≥ ceil(0,6 × tổng) (3/5, 4/6, 5/7): `dawn_survived`; thắp đủ không kết thúc Đêm | THAY THẾ |
| Thua | hết Ngọn Lửa hoặc hết giờ | hết Ngọn Lửa (luôn trước) hoặc hết giờ mà đèn sáng dưới ngưỡng (`dawn`) | đổi |
| Thời gian Đêm | 300 / 330 / 360 s | **240 / 270 / 300 s** | đổi |
| Sức chứa | 10 cố định | 10 + 2 × `successful_lights`, tối đa 20; đặt lại 0 mỗi Đêm; HUD "mang / sức chứa" | mới |
| Điểm | 10/đom đóm nạp, 100/đèn, 5/bóng, 2/giây còn, 50/Ngọn Lửa | 5/đom đóm nạp (thắp mới, thắp lại, châm dầu), 100 thắp đầu, 40 thắp lại, 5 (15 nếu bóng đang drain) mỗi bóng trúng Tỏa Sáng, bình minh thắng: mỗi đèn sáng 50 + floor(fuel), mỗi Ngọn Lửa 50; **bỏ thưởng thời gian** | THAY THẾ |
| Mù màu | — | cài đặt "Bảng màu dễ phân biệt" (lưu): viền + mắt Bóng #7A3CFF → #00B3FF, màu cảnh báo #FF5A5F → #FFFFFF kèm ⚠; đèn tắt xẹp 20% + giấy rách; đèn sắp hết dầu nhấp nháy | mới |
| Contract | v1.1 | v1.2: tuning thêm `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`; snapshot thêm lantern.`fuel/ever_lit/relit_count`, player.`capacity`, trạng thái `drain`; scenario thêm lantern.`fuel/ever_lit`, player.`successful_lights`, shade.`target_lantern_id`; sự kiện `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`, `game_over.reason = dawn_survived` | đổi |

**Thứ tự trong tick** (Ticket-02 + bổ sung): bước 2 trừ dầu (hao 1/60 + hút 5/60 mỗi bóng đang drain, cộng dồn), ngay sau bước 2 đèn có `fuel <= 0` tắt; bước 5 tương tác; bước 8 bóng di chuyển (trạng thái drain được xét ở đây); bước 11 xét thắng/thua sau mọi cập nhật, kể cả tick bình minh: hết Ngọn Lửa luôn thua `no_flames` trước.

## 2. Giả định của tôi (ticket không nói rõ) — có thể lệch với test ẩn

| # | Giả định | Lý do / rủi ro |
|---|---|---|
| A1 | Dầu lưu bằng số nguyên theo đơn vị 1/60 (6000 = 100). Hao 1 đơn vị/tick, hút 5 đơn vị/tick/bóng. Snapshot làm tròn 1 chữ số thập phân (`Math.round(fuelU/6)/10`) | ticket khuyên dùng đơn vị nguyên 1/60 |
| A2 | Đèn đang sáng có `deposited` = số cần để thắp (10 lần đầu, 5 khi thắp lại); scenario `lit:true` không nêu `deposited` thì 10; đèn tắt `deposited = 0` | ticket chỉ nói "hết dầu → deposited = 0" |
| A3 | `refuel.amount` = số **đom đóm** dùng (`used`), không phải lượng fuel cộng; `refuel` không kèm `deposit`. Thắp từ đèn tắt vẫn phát `deposit` rồi `lantern_lit {relight}` | khớp `deposit.amount` |
| A4 | Tương tác cần `carried > 0` (như Phase 2). Đèn sáng vừa hao 1 tick (fuel < 100) là "nhận được": hầu như mọi đèn sáng đều nhận được, đèn đầy dầu chỉ còn xảy ra ngay sau lần châm trong cùng tick | hao ở bước 2 chạy trước tương tác ở bước 5 |
| A5 | `wander` đi tới đèn mục tiêu với tốc độ 2 m/s (tốc độ wander cũ). Chọn: đèn yếu gần nhất (id nhỏ nếu bằng nhau) → nếu không có, giữ `target_lantern_id` của scenario nếu đó là đèn tắt → nếu không, đèn tắt gần nhất → nếu không còn đèn tắt, lượn ngẫu nhiên như Phase 2. Chọn lại mỗi tick (đèn yếu xuất hiện thì bóng đổi ngay) | "như trước" trong ticket; Phase 2 của tôi lượn ngẫu nhiên nên đây là một thay đổi hành vi `wander` |
| A6 | Bóng vào `drain` đứng yên, KHÔNG gây sát thương; nếu Mây vào trong 6 m (`safe_radius`) thì chuyển `chase` (xét trước khi di chuyển trong bước 8). Lệnh hút của tick N tính ở bước 2 tick N+1 theo trạng thái cuối tick N. Scenario đặt `state: drain` thì hút ngay từ tick 1 | ticket |
| A7 | `fuel_drain` ghi khi bộ đếm hút của từng bóng chạm bội số của 60 (tính từ lúc vào drain), `fuel` = dầu của đèn sau khi trừ ở tick đó | "mỗi 60 tick khi đang hút" |
| A8 | Hết choáng **luôn** về `wander` (Phase 2 là `chase` nếu Mây trong 18 m). Sau đó bước 8 cùng tick vẫn có thể chuyển `chase` nếu Mây ≤ 12 m. `recoil` giữ nguyên như Phase 2 | ticket: "Hết choáng thì về wander" |
| A9 | Đèn tắt khi `fuel <= 0` ngay sau bước 2. Đèn `ever_lit` giữ vĩnh viễn trong Đêm | ticket |
| A10 | Scenario: `lit:true` không `fuel` → 100; có `fuel` mà không `lit` → `lit = fuel > 0`; `lit:true` → `ever_lit = true`; `fuel` ngoài 0..100 là lỗi định dạng (exit 2); `ever_lit` phải là boolean | ticket + validate |
| A11 | Khi đèn châm lên ≥ 30 lúc bóng ở trong 6 m, tái dùng đúng cơ chế "vừa thắp" của Phase 2 (đẩy ra mép vùng tối đa 30 tick, `grace` không sát thương) | ticket: "giống khi đèn vừa thắp" |
| A12 | `tuning.score` ở contract đổi khóa: `per_mote 5, per_lantern 100, per_relight 40, per_stun 5, per_stun_drain 15, per_lit_lantern_dawn 50, per_flame_left 50`; bỏ `per_second_left` | ticket không nêu tên khóa |
| A13 | Sức chứa chỉ giới hạn việc nhặt; mang nhiều hơn sức chứa (đặt qua scenario) không bị giảm. `successful_lights` tăng ở mọi lần thắp thành công qua tương tác (lần đầu hoặc thắp lại), không tăng khi châm dầu | ticket |
| A14 | Ngưỡng thắng = `ceil(0,6 × tổng − 1e-9)` (tránh sai số thực) | 5→3, 6→4, 7→5 |
| A15 | Snapshot bóng có thêm `target_lantern_id` (null nếu không có); trường thêm không phá contract | hỗ trợ test/UI |
| A16 | Kết thúc Đêm chỉ xét khi hết giờ hoặc hết Ngọn Lửa; thắp đủ đèn không phát `game_over`, không còn `all_lit` | ticket |

## 3. Tiêu chí nghiệm thu (mỗi mục → kịch bản trong `tests/cases.ts`, `phase: 3`)

| Mục ticket | Tiêu chí | Kịch bản |
|---|---|---|
| 1 Hao dầu | 100 → 99.0 sau 60 tick, 90.0 sau 600, 40.0 sau 3600; đèn tắt fuel 0 | `fuel_decay`, `fuel_default_100` |
| 1 Hết dầu | tắt đúng tick, `lantern_out`, `deposited 0`, `ever_lit` giữ | `lantern_out` |
| 1 Châm dầu | `used = min(mang, ceil((100−fuel)/10))`, +5 điểm/đom đóm, sự kiện `refuel`, không vượt 100 | `refuel_basic`, `refuel_caps_at_100`, `refuel_used_rounds_up` |
| 1 Chọn đèn | gần nhất trong 2 m, bằng nhau id nhỏ; đèn sáng chưa đầy cũng được chọn | `interact_picks_nearest_receivable`, `interact_tie_lowest_id_lit_vs_unlit`, `deposit_*` |
| 1 Thắp lại | 5 đom đóm, `relight:true`, +40, `relit_count`; đèn mới vẫn 10 | `relight_cost_5`, `first_light_still_10`, `out_then_relight_chain` |
| 2 Vùng an toàn | đúng 30 còn vùng, dưới 30 mất | `safe_zone_exactly_30`, `safe_zone_below_30` |
| 2 Chọn mục tiêu | đèn yếu (< 30) gần nhất trước, rồi đèn tắt; chase không đổi mục tiêu; đúng 30 không phải đèn yếu | `wander_targets_*`, `wander_weak_boundary_30`, `chase_ignores_weak_lantern` |
| 2 Drain | ≤ 2 m vào drain, hút 5/s cộng dồn, `fuel_drain` mỗi 60 tick | `drain_range_is_2m`, `drain_enters_and_drains`, `drain_stacks` |
| 2 Rời drain | đèn tắt → wander; Mây ≤ 6 m → chase; stunned; châm ≥ 30 → đẩy ra, không sát thương | `drain_to_wander_when_out`, `drain_to_chase_player_near`, `refuel_pushes_shades_out`, `drain_pulse_score_15`, `stunned_then_wander` |
| 3 Thắng/thua | 240/270/300 s; ngưỡng 3/5, 4/6, 5/7; không thắng sớm; `no_flames` trước `dawn_survived` | `dawn_threshold_n*`, `no_early_win_all_lit`, `no_flames_beats_dawn_win`, `win_*`, test bản đồ chuẩn |
| 4 Sức chứa | 10 + 2×lần thắp, tối đa 20, đèn đặt sẵn không tính, giới hạn nhặt | `capacity_grows`, `capacity_cap_20`, `capacity_limits_pickup` |
| 5 Điểm | +5/đom đóm, 100, 40, 5/15, bình minh 50+floor(fuel) và 50/Ngọn Lửa, bỏ thưởng giờ | `dawn_score_formula`, `drain_pulse_score_15`, `pulse_score_5_non_drain`, `win_at_dawn_tick`, `relight_cost_5` |
| 6 Mù màu | màu #00B3FF / #FFFFFF, cài đặt lưu | `tests/web.test.ts` (mã hex, lưu/đọc) + xem ảnh |
| 7 Contract v1.2 | số chuẩn, trường snapshot, scenario, sự kiện, file lỗi → exit 2 | `tests/headless.test.ts` (contract, snapshot v1.2, 17 file hỏng) |
| Tạm dừng | dầu không hao khi tạm dừng | `pause_freezes_fuel` |

## 4. Test cũ bị luật mới làm sai: sửa kèm lý do (không tắt âm thầm, không `skip`)

| Test | Vì sao sai | Sửa |
|---|---|---|
| `deposit_lit` (P1) | điểm/đom đóm 10 → 5; `lantern_lit` thêm `relight` | kỳ vọng 150 điểm, `relight:false` |
| `deposit_resume` (P2) | "đèn sáng không nhận thêm" bị thay thế: lần 3 thành `refuel` | kiểm `refuel {amount 1, fuel 100}`, còn 3 đom đóm |
| `deposit_skips_lit` (P2) | đèn sáng nay là đèn nhận được | chọn đèn sáng gần nhất → `refuel L1` |
| `win_all_lit` (P1) | thắng sớm khi thắp đủ bị bỏ | thắp đủ vẫn `playing`, không `game_over`, điểm 150 |
| `win_at_dawn_tick` (P2) | `all_lit` + thưởng giờ bị thay | thắng `dawn_survived`, điểm 1046 theo công thức mới |
| `win_night2_last_lantern`, `win_night3_tier2_lantern` (P2) | như trên; thời lượng 270/300 | giữ ý (thắp được đèn cuối, từ tầng 2) nhưng không còn `game_over` |
| `pause_resume` (P2) | thời lượng Đêm 1 = 240 s | `240 − 10/60` |
| test "bản đồ chuẩn" | thời lượng 240/270/300 | cập nhật 3 số |
| test contract | v1.2 + khóa mới + điểm mới | cập nhật; thêm kiểm `per_second_left` đã bỏ |
| test settings (web) | `Settings` có thêm `colorblind` | cập nhật `deepEqual` |

Không xóa test nào. Hồi quy các luật không bị thay (di chuyển, nhặt, nhảy, lướt, rơi, gió, bùa, tạm dừng, an toàn của đèn mới thắp...) vẫn chạy nguyên văn: 18 kịch bản P1 + 49 kịch bản P2, trong đó 8 kịch bản nêu ở bảng trên đã được sửa.
