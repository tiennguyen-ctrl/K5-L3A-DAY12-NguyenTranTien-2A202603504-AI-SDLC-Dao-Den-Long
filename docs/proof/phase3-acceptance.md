# Nghiệm thu Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Bảng truy vết: yêu cầu của ticket → bằng chứng → kết quả. Tất cả bằng chứng "headless" sinh bằng lệnh thật (`npm test`, `npm run proof`, `node scripts/bot.ts`), không sửa tay. Giả định và test cũ đã sửa: [../notes/phase3-spec.md](../notes/phase3-spec.md). Quyết định thiết kế: [../adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md](../adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md). Thay đổi phá vỡ tương thích: [../../CHANGELOG.md](../../CHANGELOG.md).

Kết quả chạy lúc nộp: `npm test` 132/132 đạt · `npm run proof` 106/106 kịch bản qua CLI đạt (18 hồi quy P1 + 49 hồi quy P2 + 39 mới P3; chi tiết [phase3/RESULTS.md](phase3/RESULTS.md)) · `npm run typecheck` sạch · `npm run build` thành công.

## Mục 1: Nhiên liệu đèn
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Nhiên liệu tối đa 100; vừa thắp (lần đầu hoặc thắp lại) fuel = 100 | `relight_cost_5`, `fuel_default_100` | ĐẠT |
| Hao 1/s (1/60 mỗi tick), không sai số tích lũy | `fuel_decay`: 99.0 sau 60 tick, 90.0 sau 600, 40.0 sau 3600 | ĐẠT |
| Châm dầu `used = min(mang, ceil((100−fuel)/10))`, `fuel = min(100, fuel+10×used)` | `refuel_basic`, `refuel_caps_at_100`, `refuel_used_rounds_up` | ĐẠT |
| Chọn đèn nhận được, gần nhất, bằng nhau id nhỏ | `interact_picks_nearest_receivable`, `interact_tie_lowest_id_lit_vs_unlit`, `deposit_nearest_then_id`, `deposit_tie_lowest_id` | ĐẠT |
| Đèn đầy dầu (`used = 0`) không được chọn, không sự kiện, không điểm | cài đặt trong `stepGame` (bước 5); **chưa có kịch bản riêng** vì sau bước hao của tick, đèn sáng luôn < 100 | cài đặt, chưa test riêng (xem hạn chế) |
| Hết dầu → tắt, `deposited = 0`, `lantern_out`, `ever_lit` giữ | `lantern_out` | ĐẠT |
| Thắp lại 5 đom đóm; đèn chưa từng sáng 10 | `relight_cost_5`, `first_light_still_10`, `out_then_relight_chain` | ĐẠT |
| Thanh dầu, nhấp nháy 1 Hz khi fuel < 30 | `src/web/world.ts`; ảnh [phase3/screenshots/fuel-night1.png](phase3/screenshots/fuel-night1.png) | ĐẠT: chủ repo đã bật các tính năng và xem bằng mắt, báo ổn (lời khai, không có ảnh/video đính kèm). Ảnh headless trong repo chưa nhìn rõ thanh dầu (rừng che) |

## Mục 2: Bóng Mực hút dầu
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| fuel < 30 mất vùng an toàn; đúng 30 còn | `safe_zone_exactly_30`, `safe_zone_below_30` | ĐẠT |
| Chỉ bóng `wander` chọn đèn yếu gần nhất (id nhỏ nếu bằng nhau), không có thì đèn tắt; chase không đổi mục tiêu | `wander_targets_weak_then_unlit`, `wander_targets_unlit_when_no_weak`, `wander_weak_boundary_30`, `chase_ignores_weak_lantern` | ĐẠT |
| ≤ 2 m (XZ) vào `drain`, đứng yên, hút 5/s, cộng dồn, đèn vẫn tự hao | `drain_range_is_2m`, `drain_enters_and_drains`, `drain_stacks` | ĐẠT |
| `drain` → chase (Mây ≤ 6 m), stunned (Tỏa Sáng), wander (đèn tắt / fuel ≥ 30 / > 2 m); hết choáng về wander | `drain_to_chase_player_near`, `drain_pulse_score_15`, `drain_to_wander_when_out`, `refuel_pushes_shades_out`, `stunned_then_wander` | ĐẠT (nhánh "cách đèn > 2 m" chưa có kịch bản riêng) |
| Châm ≥ 30 lúc bóng trong 6 m: đẩy ra mép ≤ 30 tick, không sát thương | `refuel_pushes_shades_out` | ĐẠT |

## Mục 3: Luật thắng mới
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Thời gian 240/270/300 s | test bản đồ chuẩn; `win_night2_last_lantern` (270), `win_night3_tier2_lantern` (300) | ĐẠT |
| Thắng khi còn sống lúc hết giờ và đèn sáng ≥ ceil(0,6×tổng): 3/5, 4/6, 5/7 | `dawn_threshold_n1_*`, `n2_*`, `n3_*` (cả biên dưới và đủ ngưỡng) | ĐẠT |
| Thắp đủ đèn không kết thúc Đêm | `win_all_lit`, `no_early_win_all_lit`, `win_night2_last_lantern`, `win_night3_tier2_lantern` | ĐẠT |
| Thua: hết Ngọn Lửa (kể cả tick cuối) hoặc dưới ngưỡng; lý do `dawn_survived` / `dawn` / `no_flames` | `no_flames_beats_dawn_win`, `dawn_threshold_*`, `win_at_dawn_tick` | ĐẠT |
| Thứ tự tick: trừ dầu ở bước 2, tắt ngay sau bước 2, xét thắng/thua cuối tick | `lantern_out` (đúng tick 60), `no_flames_beats_dawn_win` | ĐẠT |

## Mục 4–5: Sức chứa và điểm
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Sức chứa 10 + 2×thắp thành công, tối đa 20; đèn đặt sẵn không tính; giới hạn việc nhặt | `capacity_grows`, `capacity_cap_20`, `capacity_limits_pickup` | ĐẠT |
| Reset 0 mỗi Đêm | mỗi `createGame` bắt đầu `successful_lights = 0` (mọi kịch bản); chưa có kịch bản nhiều Đêm liên tiếp | ĐẠT theo thiết kế |
| HUD "đang mang / sức chứa" | `src/web/main.ts` (ảnh `fuel-night1.png` hiện 6/10) | ĐẠT |
| Điểm: +5/đom đóm, 100 thắp đầu, 40 thắp lại, 5/15 bóng trúng Tỏa Sáng | `deposit_lit` (150), `relight_cost_5` (65), `refuel_basic` (20), `pulse_score_5_non_drain`, `drain_pulse_score_15` | ĐẠT |
| Bình minh thắng: +50+floor(fuel)/đèn, +50/Ngọn Lửa; bỏ thưởng thời gian | `dawn_score_formula` (597), `win_at_dawn_tick` (1046) | ĐẠT |
| Tổng điểm game không đổi so với Ticket-02 | `tests/web.test.ts` (chuỗi 3 Đêm cộng điểm các Đêm thắng, thua không cộng) | ĐẠT |

## Mục 6: Mù màu
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Cài đặt "Bảng màu dễ phân biệt", được lưu | `tests/web.test.ts` (lưu/đọc, mặc định tắt, chỉ nhận boolean) | ĐẠT: logic + chủ repo đã bật các tính năng và xem bằng mắt, báo ổn (lời khai, không có ảnh/video đính kèm) |
| Viền và mắt Bóng #7A3CFF → #00B3FF; cảnh báo #FF5A5F → #FFFFFF kèm ⚠ | `tests/web.test.ts` (mã hex); CSS `body.cb`; mắt Bóng dùng cùng màu viền | ĐẠT: mã hex + chủ repo đã bật các tính năng và xem bằng mắt, báo ổn (lời khai, không có ảnh/video đính kèm) |
| Đèn tắt xẹp 20% và giấy rách; đèn sắp hết dầu nhấp nháy | `src/web/world.ts` (`scale.y` 1,25 → 1,0, vạch rách, 1 Hz) | ĐẠT: chủ repo đã bật các tính năng và xem bằng mắt, báo ổn (lời khai, không có ảnh/video đính kèm) |

## Mục 7: Test Contract v1.2
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| `contract_version "1.2"`, tuning thêm 8 khóa, 3 thời lượng mới | test contract (so từng số chuẩn) | ĐẠT |
| Snapshot: lantern `fuel` (1 chữ số), `ever_lit`, `relit_count`; player `capacity`; bóng có `drain` | test "snapshot v1.2"; `fuel_default_100`; `drain_*` | ĐẠT |
| Scenario: lantern `lit/fuel/ever_lit`, player `successful_lights`, shade `target_lantern_id`; `lit:true` không fuel → 100; trường sai → exit 2 | `fuel_default_100`, test CLI (17 file hỏng, 5 mới) | ĐẠT |
| Sự kiện `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick), `lantern_lit.relight`, `dawn_survived` | `refuel_*`, `lantern_out`, `drain_enters_and_drains`, `relight_cost_5`, `dawn_*` | ĐẠT |

## Định nghĩa hoàn thành (DoD)
| Mục | Kết quả |
|---|---|
| Bằng chứng game chạy đúng yêu cầu | bảng trên; [phase3/RESULTS.md](phase3/RESULTS.md) (106 kịch bản qua CLI); [phase3/perf/RESULTS.md](phase3/perf/RESULTS.md) (21.600 tick/Đêm: 0,39 / 0,46 / 0,56 s, chạy lại giống hệt); [phase3/bot/RESULTS.md](phase3/bot/RESULTS.md) |
| ADR mô tả đổi mô hình đèn và luật thắng | [ADR-001](../adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md) |
| Test cũ bị luật mới làm sai được cập nhật có lý do, không skip | [phase3-spec.md](../notes/phase3-spec.md) mục 4 (không xóa, không `skip`) |
| Changelog thay đổi phá vỡ tương thích | [CHANGELOG.md](../../CHANGELOG.md) |
| Test ẩn Phase 1–2 không bị thay thế vẫn đạt | 18 kịch bản P1 + 49 kịch bản P2 chạy lại (8 cái đã sửa theo luật mới); **chưa có cách kiểm bằng test ẩn thật** |

## Kiểm thử đột biến (cố ý phá luật Phase 3 để xem test có đỏ không)
Script tạm sửa `src/core` rồi chạy test (đã hoàn nguyên sau mỗi phép; không lưu trong repo). 22 phép phá có ý nghĩa: hao dầu ×2, `ceil→floor` ở châm dầu, thắp lại tốn 10, ngưỡng vùng an toàn `>=→>`, đèn yếu `<→<=`, `drain_range` 2→3, bỏ hút dầu, ngưỡng thắng `ceil→floor`, sức chứa +1, hết choáng về chase, tắt khi `<0`, bỏ tăng `successful_lights`, thắp lại +100, bỏ +15 drain, bỏ `floor(fuel)` ở bình minh, thắng sớm khi đủ đèn, `no_flames` xét sau dawn, bỏ điều kiện "chưa đầy", bỏ ưu tiên đèn yếu, drain không cần fuel < 30, drain không sang chase, `fuel_drain` mỗi 30 tick. Lần chạy đầu 2/23 sống sót (đèn yếu `<=`, `drain_range` 3) → thêm 2 kịch bản biên (`wander_weak_boundary_30`, `drain_range_is_2m`) → cả hai bị bắt. (Phép thứ 23 "pause vẫn hao" trong script là phép rỗng do tôi viết sai, bị bỏ khỏi số liệu; việc đóng băng dầu khi tạm dừng được kiểm bởi `pause_freezes_fuel` do cấu trúc code trả về trước bước 2.)

## Chưa kiểm chứng / hạn chế (trung thực)
- **Chơi tay bản web Phase 3:** chủ repo đã bật các tính năng mới (thanh dầu, nhấp nháy, sợi hút dầu, HUD mang/sức chứa, cài đặt mù màu, cảnh báo) và xem bằng mắt, báo ổn. Đây là lời khai, không có ảnh/video ván chơi; không ghi lại chi tiết từng thứ đã xem. Chưa ghi nhận âm báo `lantern_out` có nghe thử hay không.
- **Bot chưa chứng minh Đêm 2–3 thắng được** theo luật mới: bot tham lam (chỉ biết nạp/châm đèn, né, tỏa sáng) thắng Đêm 1 1/6 ván (seed 2) và Đêm 2 0/6, chưa có bot Đêm 3; mọi ván phát lại qua CLI khớp ([phase3/bot/RESULTS.md](phase3/bot/RESULTS.md)). Bot không dùng Bùa Gió và không tránh Gió Lạc, nên không nên đọc kết quả này là "game quá khó". Độ cân bằng (thời gian hao dầu, 5 fuel/s...) chưa được chơi thử.
- **Cân bằng độ khó:** chủ repo báo đã tự thử và thắng được Đêm 2 và Đêm 3 theo luật mới (lời khai của chủ repo, không có log/ảnh/video đính kèm). Bằng chứng bot trong repo KHÔNG đổi: [phase3/bot/RESULTS.md](phase3/bot/RESULTS.md) vẫn là Đêm 1 thắng 1/6, Đêm 2 thắng 0/6, không có bot Đêm 3; nên "thắng được Đêm 2–3" ở đây dựa vào ván chơi của chủ repo, chưa có bot hay bản ghi chứng minh.
- **Có kịch bản riêng cho "đèn đầy dầu không được chọn" hay không**: không, vì với thứ tự bước hiện tại đèn sáng luôn < 100 tại bước tương tác (đã hao ở bước 2). Nhánh `used = 0` vẫn được cài đặt (`l.fuelU >= FUEL_MAX_U → bỏ qua`).
- **Nhánh "drain → wander nếu cách đèn > 2 m"** chưa có kịch bản riêng (chỉ bằng đọc mã).
- **Giả định có thể lệch với test ẩn** (xem [phase3-spec.md](../notes/phase3-spec.md) mục 2): đặc biệt A2 (`deposited` của đèn sáng), A3 (`refuel.amount` là số đom đóm), A5 (`wander` đi tới đèn mục tiêu 2 m/s), A7 (thời điểm `fuel_drain`), A12 (tên khóa `tuning.score`), A8 (hết choáng về `wander`).
- Kiểm tra tất định trong repo chạy trên một máy (Windows, Node 24). Chủ repo báo đã thử trên máy khác và macOS/Linux, ổn (lời khai của chủ repo, không có log/ảnh/video đính kèm).
