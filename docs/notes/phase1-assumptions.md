# Phase 1: giả định và tiêu chí nghiệm thu

PRD-0 cố ý mơ hồ. Chỗ nào mơ hồ, tôi tự chọn, ghi ở đây và kiểm chứng theo đúng lựa chọn đó. Mọi con số khai trong `game.contract.json` (nguồn duy nhất, core đọc trực tiếp).

## Con số đã chọn (tuning)
| Khóa | Giá trị | Ghi chú |
|---|---|---|
| player_speed | 6 m/s | 0,1 m/tick, dễ kiểm |
| carry_capacity | 5 | |
| lantern_cost | 5 | bằng 1 lần mang đầy |
| lantern_count_night1 | 5 | theo PRD |
| pickup_radius / interact_radius | 1,5 / 3 m | |
| pulse_cost / pulse_radius | 1 đom đóm / 8 m | |
| night1_duration_s | 300 | |
| flames | 3 | "máu" = ngọn lửa |
| invuln_s | 1,5 | bất tử sau khi bị chạm |
| hit_drop_ratio | 0,5 | rơi `floor(carried × 0,5)` |
| pulse_stun_s / pulse_push_m / pulse_cooldown_s | 3 / 4 / 2 | |
| safe_radius | 4 m | quanh MỌI đèn |
| shade_speed / shade_hit_radius | 3,5 m/s / 1 m | chậm hơn người chơi (6) |
| fall_enabled | false | xem dưới |
| score | 10 / 100 / 20 / 1 / 50 | mote / lantern / stun / giây còn / flame còn |

## Giả định cho chỗ mơ hồ
1. **"Tốn ánh sáng" khi tỏa sáng** = trừ `pulse_cost` đom đóm đang mang (`carried`). Không đủ thì không tỏa sáng, không có sự kiện.
2. **Đảo**: tròn bán kính 40 m, tâm (0,0,0). Đèn L1..L5 nằm trên vòng bán kính 25 m, cách đều 72°, L1 = (0,0,25).
3. **Không rơi khỏi đảo** (`fall_enabled=false`): người chơi bị chặn ở mép đảo, không có sự kiện `player_hit by fall`.
4. **Thua "dawn"** khi hết `time_left_s` mà chưa thắp hết đèn. Thắng "all_lit" ưu tiên hơn thua nếu xảy ra cùng tick; `no_flames` ưu tiên hơn `dawn`.
5. **Điểm**: `per_mote` khi nhặt; `per_lantern` khi đèn sáng; `per_stun` cho mỗi Bóng Mực nằm trong `stunned_ids`; thưởng `per_second_left × floor(giây còn)` và `per_flame_left × flames` cộng một lần khi thắng. Dựng scenario không cộng điểm.
6. **Nạp đèn**: bấm `interact` (cạnh false→true) gần đèn CHƯA sáng gần nhất trong `interact_radius`; nạp `min(carried, lantern_cost − deposited)`. Đèn đủ `lantern_cost` thì sáng.
7. **safe_radius** áp dụng cho mọi đèn (sáng hay chưa). Bóng Mực bị đẩy ra `safe_radius + 0,01 m` vì "trong bán kính r" nghĩa là ≤ r nên cần khoảng cách > r.
8. **Bị chạm**: Bóng Mực ở trạng thái `chase` trong `shade_hit_radius` (XZ), ngoài thời gian bất tử. Mất 1 flame, đom đóm rơi xuống đất cách người chơi `pickup_radius + 1` m (không bị nhặt lại ngay). Bóng Mực choáng thì không gây sát thương.
9. **Pulse** làm choáng mọi Bóng Mực trong `pulse_radius` (kể cả con đang choáng, làm mới thời gian), đẩy ra xa `pulse_push_m` theo hướng từ người chơi. Hồi chiêu tính theo tick: bấm lại được sau đúng `pulse_cooldown_s`.
10. **Đom đóm ngẫu nhiên**: ban đầu 24 con, cứ 3 s thêm 1 con nếu dưới 24. **Bóng Mực ngẫu nhiên**: con đầu tiên ở giây 8, sau đó cứ 15 s thêm 1 con, tối đa 5, sinh ở rìa đảo. Id tự sinh `M<n>`, `S<n>` tăng dần, tất định theo seed.
11. **Scenario**: `random_motes`/`random_shades` mặc định `true`. `motes`/`shades` thay thế danh sách ban đầu. `lanterns` cập nhật theo id; id lạ là lỗi định dạng (mã 2). `lit:true` mà không có `deposited` thì `deposited = lantern_cost`.
12. **Mã thoát**: file inputs/scenario không đọc được hoặc sai định dạng = 2; thiếu/sai tham số dòng lệnh = 1. Chấp nhận `--seed`, `-seed`, `--seed=1`. Snapshot không ghi thêm ở tick cuối nếu không trùng bội của `--snapshot-every`.
13. **Nhảy**: có nhảy (cạnh false→true, chỉ khi đứng đất), không có `dash`. Nhảy chỉ là chuyển động Y, khoảng cách tính trên XZ nên không né được va chạm.

## Tiêu chí nghiệm thu (mỗi dòng là một kiểm tra, xem `docs/proof/phase1-acceptance.md`)
Di chuyển/camera yaw/chuẩn hóa/nhảy · nhặt đom đóm + sức chứa · nạp đèn từng phần/đủ · ngoài tầm tương tác · thắng all_lit + điểm · bị chạm (flames, rơi, bất tử) · thua no_flames · thua dawn · pulse (tốn ánh sáng, choáng, đẩy, điểm, hồi chiêu, cạnh nút) · safe_radius · scenario im lặng · tất định · mã thoát 0/2 · định dạng JSONL.
