# Kết quả kịch bản headless Phase 2

Sinh bởi `npm run proof` (chạy qua CLI headless thật). Mỗi thư mục con có `scenario.json`, `inputs.json`, `output.jsonl`.

| Kịch bản | Loại | Bản đồ | Chứng minh | Kết quả |
|---|---|---|---|---|
| move_yaw | hồi quy P1 | Đêm 1 | Hướng di chuyển theo cam_yaw_deg: yaw 90 + move [1,0] đi về -Z với player_speed | ĐẠT |
| move_normalized | hồi quy P1 | Đêm 1 | Vector move dài hơn 1 được chuẩn hóa (đi chéo không nhanh hơn) | ĐẠT |
| jump | hồi quy P1 | Đêm 1 | Nhảy 7 m/s, trọng lực -20: Y > 0 khi ở trên không, đỉnh ~1,2 m, rồi về Y = 0 | ĐẠT |
| jump_edge | hồi quy P1 | Đêm 1 | Nhảy kích hoạt ở cạnh false->true, chỉ khi chạm đất: giữ nút không nhảy liên tục | ĐẠT |
| pickup_mote | hồi quy P1 | Đêm 1 | Nhặt đom đóm khi vào pickup_radius (1,0 m); nhặt KHÔNG cộng điểm (điểm tính lúc nạp) | ĐẠT |
| pickup_height | mới P2 | Đêm 1 | Nhặt cần chênh cao chân Mây - mặt đất đom đóm <= 1,5 m: đom đóm cao 3 m không nhặt được, cao 1,4 m thì được | ĐẠT |
| carry_capacity | hồi quy P1 | Đêm 1 | Không mang quá carry_capacity (10); đom đóm thừa ở lại | ĐẠT |
| deposit_partial | hồi quy P1 | Đêm 1 | Nạp một phần, đèn nhớ tiến độ: deposit đúng amount/deposited, +10 điểm mỗi đom đóm nạp, chưa lantern_lit | ĐẠT |
| deposit_resume | mới P2 | Đêm 1 | Nạp nhiều lần vào cùng một đèn: lần 2 chỉ nạp phần còn thiếu min(đang mang, còn thiếu) rồi đèn sáng | ĐẠT |
| deposit_lit | hồi quy P1 | Đêm 1 | Đủ lantern_cost (10) thì đèn sáng: điểm = 10×10 + 100; chưa thắng khi còn đèn khác | ĐẠT |
| deposit_nearest_then_id | mới P2 | Đêm 1 | Chỉ xét đèn chưa sáng; chọn đèn gần nhất trong 2,0 m, bằng nhau thì id nhỏ hơn | ĐẠT |
| deposit_tie_lowest_id | mới P2 | Đêm 1 | Hai đèn cách đều thì chọn id nhỏ hơn | ĐẠT |
| deposit_skips_lit | mới P2 | Đêm 1 | Đèn đã sáng bị bỏ qua dù gần hơn: nạp vào đèn chưa sáng | ĐẠT |
| deposit_out_of_range | hồi quy P1 | Đêm 1 | Ngoài interact_radius (2,0 m) thì interact không nạp được | ĐẠT |
| win_all_lit | hồi quy P1 | Đêm 1 | Thắp hết đèn thì thắng (all_lit); điểm = 10×10 + 100 + floor(giây còn)×2 + 50×Ngọn Lửa; dựng scenario không cộng điểm | ĐẠT |
| win_at_dawn_tick | mới P2 | Đêm 1 | Còn sống và đủ đèn ở đúng tick hết giờ thì vẫn THẮNG (không phải dawn) | ĐẠT |
| no_flames_beats_win | mới P2 | Đêm 1 | Hết Ngọn Lửa thì luôn thua (no_flames), kể cả khi tất cả đèn đã sáng | ĐẠT |
| shade_hit_drop_recoil | hồi quy P1 | Đêm 1 | Bị chạm: -1 Ngọn Lửa, rơi floor(mang/2) đom đóm ra vành 1,5-2,5 m (tồn tại 480 tick), bất tử 90 tick, bóng recoil lùi 2 m; chạm lúc bất tử không làm gì | ĐẠT |
| hit_order_by_id | mới P2 | Đêm 1 | Nhiều bóng cùng chạm một tick: chỉ 1 lần mất Ngọn Lửa và xét theo id tăng dần (S1 trước S2) dù scenario liệt kê S2 trước | ĐẠT |
| lose_no_flames | hồi quy P1 | Đêm 1 | Hết Ngọn Lửa thì thua (no_flames); end.state = lost; dừng sớm | ĐẠT |
| lose_dawn | hồi quy P1 | Đêm 1 | Hết giờ thì thua (dawn); time_left_s giảm đúng 1/60 mỗi tick | ĐẠT |
| pulse_stun | hồi quy P1 | Đêm 1 | Tỏa Sáng: tốn 3, bán kính 5 m 3D từ chân+0,8 m, choáng 120 tick, đẩy lùi 4 m trong 15 tick, +5/bóng; hết choáng thì đuổi lại | ĐẠT |
| pulse_needs_light | hồi quy P1 | Đêm 1 | Không đủ 3 đom đóm thì không kích hoạt Tỏa Sáng | ĐẠT |
| pulse_cooldown_edge | hồi quy P1 | Đêm 1 | Pulse kích hoạt ở cạnh false->true (giữ nút không lặp) và hồi chiêu 3 s (180 tick) | ĐẠT |
| safe_zone_lit | hồi quy P1 | Đêm 1 | Đèn đã sáng tạo vùng 6 m: bóng ở ngoài không bao giờ vào trong, người đứng cạnh đèn không bị chạm | ĐẠT |
| safe_zone_unlit_none | mới P2 | Đêm 1 | Đèn CHƯA sáng không có vùng an toàn: bóng vẫn chạm được người đứng cạnh đèn | ĐẠT |
| safe_zone_push_out | mới P2 | Đêm 1 | Bóng đang ở trong vùng lúc đèn vừa sáng bị đẩy ra mép (<= 30 tick) và không gây sát thương trong lúc đó | ĐẠT |
| scenario_silent | hồi quy P1 | Đêm 1 | Dựng scenario không phát sự kiện (ngoài night_start tick 0), không cộng điểm; random_* = false thì không sinh gì | ĐẠT |
| dash_basic | mới P2 | Đêm 1 | Lướt 14 m/s trong 12 tick theo hướng đang đi (2,8 m), hồi chiêu 90 tick từ lúc bắt đầu, nhấn khi đang hồi bị bỏ qua, không bất tử | ĐẠT |
| dash_facing | mới P2 | Đêm 1 | Đứng yên thì lướt theo hướng đang quay mặt (ban đầu +Z) | ĐẠT |
| dash_air_keeps_height | mới P2 | Đêm 1 | Lướt trên không giữ nguyên độ cao suốt 12 tick, rồi rơi tiếp | ĐẠT |
| fall_event | mới P2 | Đêm 1 | Ra ngoài đảo (Y < -10): đúng 1 lần player_hit {by:fall, lost}, -1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát với bất tử | ĐẠT |
| fall_last_flame | mới P2 | Đêm 1 | Rơi khi còn 1 Ngọn Lửa thì thua ngay (no_flames), không hồi sinh | ĐẠT |
| fall_ignores_invuln | mới P2 | Đêm 1 | Rơi khỏi đảo bỏ qua bất tử: vẫn -1 Ngọn Lửa khi đang bất tử | ĐẠT |
| bridge_walk | mới P2 | Đêm 2 | Đêm 2: đi dọc cầu tre (x 26..44, z -2..2) không rơi | ĐẠT |
| bridge_fall | mới P2 | Đêm 2 | Đêm 2: cầu không lan can, bước ra ngoài z > 2 thì rơi | ĐẠT |
| pad_night2 | mới P2 | Đêm 2 | Đêm 2: bục nhảy (20,0,18) bắn Y 14 m/s và 24 m/s ngang về tâm đảo kia; phím di chuyển không ghi đè; đáp trong đảo đích | ĐẠT |
| ramp_climb | mới P2 | Đêm 3 | Đêm 3: leo dốc 30° từ chân dốc (r=30, Y=0) lên tầng 1 (r=24, Y=3), Y tăng đều | ĐẠT |
| cliff_blocks | mới P2 | Đêm 3 | Đêm 3: vách đứng tầng 1 và tầng 2 không đi lên được (đi thẳng vào vách thì bị chặn, Y giữ 0) | ĐẠT |
| step_off_tier | mới P2 | Đêm 3 | Đêm 3: bước ra mép tầng 1 thì rơi xuống tầng dưới (Y=0), không bị tính là rơi khỏi đảo | ĐẠT |
| pad_night3_tier2 | mới P2 | Đêm 3 | Đêm 3: bục nhảy (0,3,13) bắn Y 12 m/s và 8 m/s về -Z, đáp lên tầng 2 (Y=6) | ĐẠT |
| tower_blocks | mới P2 | Đêm 3 | Đêm 3: tháp chuông (trụ r=2 ở tâm tầng 2) không leo được, không đi xuyên | ĐẠT |
| win_night2_last_lantern | mới P2 | Đêm 2 | Đêm 2: thắp đèn cuối (L6 ở đảo B) thì thắng; thưởng giờ dùng thời lượng Đêm 2 (330 s) | ĐẠT |
| win_night3_tier2_lantern | mới P2 | Đêm 3 | Đêm 3: đèn L1 ở tầng 2 (0,6,6) nạp được từ tầng 2; thắp đủ 7 đèn thì thắng; thời lượng 360 s | ĐẠT |
| charm_pickup | mới P2 | Đêm 2 | Nhặt Bùa Gió: charm_picked {C1, 600}, chạy 7,2 m/s, bùa biến mất, hiện lại sau 2700 tick | ĐẠT |
| charm_expires | mới P2 | Đêm 1 | Hết hiệu lực bùa thì tốc độ về 6 m/s | ĐẠT |
| charm_respawn | mới P2 | Đêm 2 | Bùa xuất hiện lại sau khi hết bộ đếm hồi (respawn_s trong snapshot) | ĐẠT |
| charm_refresh | mới P2 | Đêm 2 | Nhặt bùa khi còn hiệu lực thì làm mới về 600 tick | ĐẠT |
| charm_dash_no_cooldown | mới P2 | Đêm 1 | Có bùa: lướt không hồi chiêu nhưng vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua; lướt vẫn 14 m/s trong 12 tick | ĐẠT |
| drifter_steal | mới P2 | Đêm 2 | Gió Lạc: idle->chase khi mang >=5 và cách <=15 m; chạm (<=1,2 m) cướp min(3, mang), chuyển flee, mỗi con 1 lần, không mất Ngọn Lửa; hết flee thì biến mất | ĐẠT |
| drifter_steal_clamped | mới P2 | Đêm 2 | Cướp tối đa 3, và chỉ cướp nếu đang mang: mang 5 mất 3 còn 2 | ĐẠT |
| drifter_no_trigger | mới P2 | Đêm 2 | Mang < 5, hoặc cách > 15 m thì Gió Lạc ở idle và không cướp | ĐẠT |
| drifter_pulse_chase | mới P2 | Đêm 2 | Tỏa Sáng trúng Gió Lạc đang chase: chuyển flee, không cướp, không mất đồ ngoài chi phí Tỏa Sáng | ĐẠT |
| drifter_drop | mới P2 | Đêm 2 | Tỏa Sáng trúng Gió Lạc đang flee có mang đồ: drifter_drop, đom đóm thành đom đóm rơi tại chỗ, Gió Lạc biến mất sau 120 tick | ĐẠT |
| drifter_ignores_safe_zone_and_invuln | mới P2 | Đêm 2 | Vùng an toàn không chặn Gió Lạc và bất tử của Mây không ngăn cướp | ĐẠT |
| drifter_schedule_night2 | mới P2 | Đêm 2 | Gió Lạc sinh tại tick 1200, 2400 (id D1, D2), tối đa 2; Đêm 1 không có | ĐẠT |
| no_drifters_night1 | mới P2 | Đêm 1 | Đêm 1 không có Gió Lạc và Bùa Gió | ĐẠT |
| shade_states_detect | mới P2 | Đêm 1 | Bóng Mực wander->chase khi Mây trong 12 m; chase->wander khi Mây ngoài 18 m; tên trạng thái đúng | ĐẠT |
| shade_speed_night1 | mới P2 | Đêm 1 | Bóng Mực đuổi 4,0 m/s ở Đêm 1 | ĐẠT |
| shade_speed_night3 | mới P2 | Đêm 3 | Bóng Mực đuổi 4,5 m/s ở Đêm 3 | ĐẠT |
| shade_schedule_night1 | mới P2 | Đêm 1 | Bóng Mực: 2 con tại tick 300 (spawning 30 tick), sau đó mỗi 8 s (480 tick), id S1.., cách Mây >= 15 m, tối đa 6 | ĐẠT |
| mote_schedule | mới P2 | Đêm 1 | Đom đóm: 20 lúc bắt đầu ở 20 điểm khác nhau; sinh thêm 1 mỗi 240 tick; hết điểm trống (24 điểm Đêm 1) thì bỏ lượt | ĐẠT |
| mote_ttl | mới P2 | Đêm 1 | Đom đóm rơi hết hạn sau ttl (480 tick); ttl_s giảm theo thời gian | ĐẠT |
| wind_night3 | mới P2 | Đêm 3 | Gió mạnh (Đêm 3): báo trước, thổi 5 s mỗi 30 s, đẩy Mây 2 m/s theo dir_deg; wind_enabled=false thì không có | ĐẠT |
| wind_off_night1 | mới P2 | Đêm 1 | Chỉ Đêm 3 mới có gió | ĐẠT |
| pause_resume | mới P2 | Đêm 1 | Tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, vị trí đứng yên, snapshot state=paused; sự kiện paused/resumed | ĐẠT |
| pause_freezes_cooldowns | mới P2 | Đêm 1 | Khi tạm dừng hồi chiêu và bất tử không giảm | ĐẠT |
