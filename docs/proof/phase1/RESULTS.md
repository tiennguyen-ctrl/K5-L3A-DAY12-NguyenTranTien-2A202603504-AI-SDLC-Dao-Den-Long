# Kết quả kịch bản headless Phase 1

Sinh bởi `npm run proof` (chạy qua CLI headless thật).

| Kịch bản | Chứng minh | Bằng chứng | Kết quả |
|---|---|---|---|
| move_yaw | Hướng di chuyển theo cam_yaw_deg: yaw 90 + move [1,0] đi về -Z, tốc độ player_speed | docs/proof/phase1/move_yaw/ | ĐẠT |
| move_normalized | Vector move dài hơn 1 được chuẩn hóa (đi chéo không nhanh hơn) | docs/proof/phase1/move_normalized/ | ĐẠT |
| jump | Nhảy: Y > 0 khi ở trên không, rồi về lại Y = 0 (mặt đất) | docs/proof/phase1/jump/ | ĐẠT |
| jump_edge | Nhảy chỉ kích hoạt ở cạnh false->true: giữ nút nhảy không nhảy liên tục | docs/proof/phase1/jump_edge/ | ĐẠT |
| pickup_mote | Nhặt đom đóm khi vào pickup_radius; +per_mote điểm; motes_active giảm | docs/proof/phase1/pickup_mote/ | ĐẠT |
| carry_capacity | Không mang quá carry_capacity; đom đóm thừa ở lại trên đất | docs/proof/phase1/carry_capacity/ | ĐẠT |
| deposit_partial | Nạp một phần: deposit đúng amount/deposited, chưa sáng nên chưa có lantern_lit | docs/proof/phase1/deposit_partial/ | ĐẠT |
| deposit_lit | Đủ lantern_cost thì đèn sáng, +per_lantern, chưa thắng khi còn đèn khác | docs/proof/phase1/deposit_lit/ | ĐẠT |
| deposit_out_of_range | Ngoài interact_radius thì interact không nạp được | docs/proof/phase1/deposit_out_of_range/ | ĐẠT |
| win_all_lit | Thắp hết đèn thì thắng (all_lit); điểm = per_lantern + thưởng giờ + thưởng flames; dựng scenario không cộng điểm | docs/proof/phase1/win_all_lit/ | ĐẠT |
| shade_hit_drop_invuln | Bị chạm: flames -1, đánh rơi floor(carried*hit_drop_ratio) đom đóm, rồi bất tử invuln_s | docs/proof/phase1/shade_hit_drop_invuln/ | ĐẠT |
| lose_no_flames | Hết flames thì thua (no_flames); end.state = lost; dừng sớm | docs/proof/phase1/lose_no_flames/ | ĐẠT |
| lose_dawn | Hết giờ thì thua (dawn); time_left_s giảm đúng 1/60 mỗi tick | docs/proof/phase1/lose_dawn/ | ĐẠT |
| pulse_stun | Tỏa sáng: tốn pulse_cost, làm choáng Bóng Mực trong pulse_radius, đẩy pulse_push_m, +per_stun; hết stun thì đuổi lại | docs/proof/phase1/pulse_stun/ | ĐẠT |
| pulse_needs_light | Không đủ ánh sáng (carried < pulse_cost) thì không tỏa sáng được | docs/proof/phase1/pulse_needs_light/ | ĐẠT |
| pulse_cooldown_edge | Pulse kích hoạt ở cạnh false->true (giữ nút không lặp) và có hồi chiêu pulse_cooldown_s | docs/proof/phase1/pulse_cooldown_edge/ | ĐẠT |
| safe_radius | Bóng Mực không bao giờ vào trong safe_radius quanh đèn (người chơi đứng cạnh đèn không bị chạm) | docs/proof/phase1/safe_radius/ | ĐẠT |
| scenario_silent | Dựng scenario không phát sự kiện, không cộng điểm; random_* = false thì không sinh gì | docs/proof/phase1/scenario_silent/ | ĐẠT |
