# Kết quả kịch bản headless Phase 3

Sinh bởi `npm run proof` (chạy qua CLI headless thật). Mỗi thư mục con có `scenario.json`, `inputs.json`, `output.jsonl`.

| Kịch bản | Loại | Bản đồ | Chứng minh | Kết quả |
|---|---|---|---|---|
| move_yaw | hồi quy P1 | Đêm 1 | Hướng di chuyển theo cam_yaw_deg: yaw 90 + move [1,0] đi về -Z với player_speed | ĐẠT |
| move_normalized | hồi quy P1 | Đêm 1 | Vector move dài hơn 1 được chuẩn hóa (đi chéo không nhanh hơn) | ĐẠT |
| jump | hồi quy P1 | Đêm 1 | Nhảy 7 m/s, trọng lực -20: Y > 0 khi ở trên không, đỉnh ~1,2 m, rồi về Y = 0 | ĐẠT |
| jump_edge | hồi quy P1 | Đêm 1 | Nhảy kích hoạt ở cạnh false->true, chỉ khi chạm đất: giữ nút không nhảy liên tục | ĐẠT |
| pickup_mote | hồi quy P1 | Đêm 1 | Nhặt đom đóm khi vào pickup_radius (1,0 m); nhặt KHÔNG cộng điểm (điểm tính lúc nạp) | ĐẠT |
| pickup_height | hồi quy P2 | Đêm 1 | Nhặt cần chênh cao chân Mây - mặt đất đom đóm <= 1,5 m: đom đóm cao 3 m không nhặt được, cao 1,4 m thì được | ĐẠT |
| carry_capacity | hồi quy P1 | Đêm 1 | Không mang quá carry_capacity (10); đom đóm thừa ở lại | ĐẠT |
| deposit_partial | hồi quy P1 | Đêm 1 | Nạp một phần, đèn nhớ tiến độ: deposit đúng amount/deposited, +10 điểm mỗi đom đóm nạp, chưa lantern_lit | ĐẠT |
| deposit_resume | hồi quy P2 | Đêm 1 | [P3 đổi: đèn sáng nhận dầu] Nạp nhiều lần: lần 2 chỉ nạp phần còn thiếu rồi đèn sáng; lần 3 là châm dầu (refuel), không còn deposit | ĐẠT |
| deposit_lit | hồi quy P1 | Đêm 1 | [P3 đổi: +5/đom đóm, lantern_lit có relight] Đủ 10 thì đèn chưa từng sáng thắp lần đầu: điểm = 10×5 + 100 = 150 | ĐẠT |
| deposit_nearest_then_id | hồi quy P2 | Đêm 1 | Chỉ xét đèn chưa sáng; chọn đèn gần nhất trong 2,0 m, bằng nhau thì id nhỏ hơn | ĐẠT |
| deposit_tie_lowest_id | hồi quy P2 | Đêm 1 | Hai đèn cách đều thì chọn id nhỏ hơn | ĐẠT |
| deposit_skips_lit | hồi quy P2 | Đêm 1 | [P3 đổi] Đèn đã sáng nay là đèn nhận được (chưa đầy dầu) và gần hơn nên được chọn: châm dầu L1, không nạp vào L2 | ĐẠT |
| deposit_out_of_range | hồi quy P1 | Đêm 1 | Ngoài interact_radius (2,0 m) thì interact không nạp được | ĐẠT |
| win_all_lit | hồi quy P1 | Đêm 1 | [P3 THAY THẾ] Thắp hết đèn KHÔNG còn kết thúc Đêm: sau khi thắp đèn cuối game vẫn playing, không có game_over, không có all_lit | ĐẠT |
| win_at_dawn_tick | hồi quy P2 | Đêm 1 | [P3 đổi] Đủ đèn ở đúng tick bình minh thì THẮNG dawn_survived; điểm = 10×5 + 100 + 4×(50+99) + (50+100) + 3×50 = 1046 | ĐẠT |
| no_flames_beats_win | hồi quy P2 | Đêm 1 | Hết Ngọn Lửa thì luôn thua (no_flames), kể cả khi tất cả đèn đã sáng | ĐẠT |
| shade_hit_drop_recoil | hồi quy P1 | Đêm 1 | Bị chạm: -1 Ngọn Lửa, rơi floor(mang/2) đom đóm ra vành 1,5-2,5 m (tồn tại 480 tick), bất tử 90 tick, bóng recoil lùi 2 m; chạm lúc bất tử không làm gì | ĐẠT |
| hit_order_by_id | hồi quy P2 | Đêm 1 | Nhiều bóng cùng chạm một tick: chỉ 1 lần mất Ngọn Lửa và xét theo id tăng dần (S1 trước S2) dù scenario liệt kê S2 trước | ĐẠT |
| lose_no_flames | hồi quy P1 | Đêm 1 | Hết Ngọn Lửa thì thua (no_flames); end.state = lost; dừng sớm | ĐẠT |
| lose_dawn | hồi quy P1 | Đêm 1 | Hết giờ thì thua (dawn); time_left_s giảm đúng 1/60 mỗi tick | ĐẠT |
| pulse_stun | hồi quy P1 | Đêm 1 | Tỏa Sáng: tốn 3, bán kính 5 m 3D từ chân+0,8 m, choáng 120 tick, đẩy lùi 4 m trong 15 tick, +5/bóng; hết choáng thì đuổi lại | ĐẠT |
| pulse_needs_light | hồi quy P1 | Đêm 1 | Không đủ 3 đom đóm thì không kích hoạt Tỏa Sáng | ĐẠT |
| pulse_cooldown_edge | hồi quy P1 | Đêm 1 | Pulse kích hoạt ở cạnh false->true (giữ nút không lặp) và hồi chiêu 3 s (180 tick) | ĐẠT |
| safe_zone_lit | hồi quy P1 | Đêm 1 | Đèn đã sáng tạo vùng 6 m: bóng ở ngoài không bao giờ vào trong, người đứng cạnh đèn không bị chạm | ĐẠT |
| safe_zone_unlit_none | hồi quy P2 | Đêm 1 | Đèn CHƯA sáng không có vùng an toàn: bóng vẫn chạm được người đứng cạnh đèn | ĐẠT |
| safe_zone_push_out | hồi quy P2 | Đêm 1 | Bóng đang ở trong vùng lúc đèn vừa sáng bị đẩy ra mép (<= 30 tick) và không gây sát thương trong lúc đó | ĐẠT |
| scenario_silent | hồi quy P1 | Đêm 1 | Dựng scenario không phát sự kiện (ngoài night_start tick 0), không cộng điểm; random_* = false thì không sinh gì | ĐẠT |
| dash_basic | hồi quy P2 | Đêm 1 | Lướt 14 m/s trong 12 tick theo hướng đang đi (2,8 m), hồi chiêu 90 tick từ lúc bắt đầu, nhấn khi đang hồi bị bỏ qua, không bất tử | ĐẠT |
| dash_facing | hồi quy P2 | Đêm 1 | Đứng yên thì lướt theo hướng đang quay mặt (ban đầu +Z) | ĐẠT |
| dash_air_keeps_height | hồi quy P2 | Đêm 1 | Lướt trên không giữ nguyên độ cao suốt 12 tick, rồi rơi tiếp | ĐẠT |
| fall_event | hồi quy P2 | Đêm 1 | Ra ngoài đảo (Y < -10): đúng 1 lần player_hit {by:fall, lost}, -1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát với bất tử | ĐẠT |
| fall_last_flame | hồi quy P2 | Đêm 1 | Rơi khi còn 1 Ngọn Lửa thì thua ngay (no_flames), không hồi sinh | ĐẠT |
| fall_ignores_invuln | hồi quy P2 | Đêm 1 | Rơi khỏi đảo bỏ qua bất tử: vẫn -1 Ngọn Lửa khi đang bất tử | ĐẠT |
| bridge_walk | hồi quy P2 | Đêm 2 | Đêm 2: đi dọc cầu tre (x 26..44, z -2..2) không rơi | ĐẠT |
| bridge_fall | hồi quy P2 | Đêm 2 | Đêm 2: cầu không lan can, bước ra ngoài z > 2 thì rơi | ĐẠT |
| pad_night2 | hồi quy P2 | Đêm 2 | Đêm 2: bục nhảy (20,0,18) bắn Y 14 m/s và 24 m/s ngang về tâm đảo kia; phím di chuyển không ghi đè; đáp trong đảo đích | ĐẠT |
| ramp_climb | hồi quy P2 | Đêm 3 | Đêm 3: leo dốc 30° từ chân dốc (r=30, Y=0) lên tầng 1 (r=24, Y=3), Y tăng đều | ĐẠT |
| cliff_blocks | hồi quy P2 | Đêm 3 | Đêm 3: vách đứng tầng 1 và tầng 2 không đi lên được (đi thẳng vào vách thì bị chặn, Y giữ 0) | ĐẠT |
| step_off_tier | hồi quy P2 | Đêm 3 | Đêm 3: bước ra mép tầng 1 thì rơi xuống tầng dưới (Y=0), không bị tính là rơi khỏi đảo | ĐẠT |
| pad_night3_tier2 | hồi quy P2 | Đêm 3 | Đêm 3: bục nhảy (0,3,13) bắn Y 12 m/s và 8 m/s về -Z, đáp lên tầng 2 (Y=6) | ĐẠT |
| tower_blocks | hồi quy P2 | Đêm 3 | Đêm 3: tháp chuông (trụ r=2 ở tâm tầng 2) không leo được, không đi xuyên | ĐẠT |
| win_night2_last_lantern | hồi quy P2 | Đêm 2 | [P3 đổi] Đêm 2: thắp đèn cuối (L6 ở đảo B) vẫn thắp được nhưng KHÔNG kết thúc Đêm; thời lượng 270 s | ĐẠT |
| win_night3_tier2_lantern | hồi quy P2 | Đêm 3 | [P3 đổi] Đêm 3: đèn L1 ở tầng 2 (0,6,6) nạp được từ tầng 2; thắp đủ 7 đèn không kết thúc Đêm; thời lượng 300 s | ĐẠT |
| charm_pickup | hồi quy P2 | Đêm 2 | Nhặt Bùa Gió: charm_picked {C1, 600}, chạy 7,2 m/s, bùa biến mất, hiện lại sau 2700 tick | ĐẠT |
| charm_expires | hồi quy P2 | Đêm 1 | Hết hiệu lực bùa thì tốc độ về 6 m/s | ĐẠT |
| charm_respawn | hồi quy P2 | Đêm 2 | Bùa xuất hiện lại sau khi hết bộ đếm hồi (respawn_s trong snapshot) | ĐẠT |
| charm_refresh | hồi quy P2 | Đêm 2 | Nhặt bùa khi còn hiệu lực thì làm mới về 600 tick | ĐẠT |
| charm_dash_no_cooldown | hồi quy P2 | Đêm 1 | Có bùa: lướt không hồi chiêu nhưng vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua; lướt vẫn 14 m/s trong 12 tick | ĐẠT |
| drifter_steal | hồi quy P2 | Đêm 2 | Gió Lạc: idle->chase khi mang >=5 và cách <=15 m; chạm (<=1,2 m) cướp min(3, mang), chuyển flee, mỗi con 1 lần, không mất Ngọn Lửa; hết flee thì biến mất | ĐẠT |
| drifter_steal_clamped | hồi quy P2 | Đêm 2 | Cướp tối đa 3, và chỉ cướp nếu đang mang: mang 5 mất 3 còn 2 | ĐẠT |
| drifter_no_trigger | hồi quy P2 | Đêm 2 | Mang < 5, hoặc cách > 15 m thì Gió Lạc ở idle và không cướp | ĐẠT |
| drifter_pulse_chase | hồi quy P2 | Đêm 2 | Tỏa Sáng trúng Gió Lạc đang chase: chuyển flee, không cướp, không mất đồ ngoài chi phí Tỏa Sáng | ĐẠT |
| drifter_drop | hồi quy P2 | Đêm 2 | Tỏa Sáng trúng Gió Lạc đang flee có mang đồ: drifter_drop, đom đóm thành đom đóm rơi tại chỗ, Gió Lạc biến mất sau 120 tick | ĐẠT |
| drifter_ignores_safe_zone_and_invuln | hồi quy P2 | Đêm 2 | Vùng an toàn không chặn Gió Lạc và bất tử của Mây không ngăn cướp | ĐẠT |
| drifter_schedule_night2 | hồi quy P2 | Đêm 2 | Gió Lạc sinh tại tick 1200, 2400 (id D1, D2), tối đa 2; Đêm 1 không có | ĐẠT |
| no_drifters_night1 | hồi quy P2 | Đêm 1 | Đêm 1 không có Gió Lạc và Bùa Gió | ĐẠT |
| shade_states_detect | hồi quy P2 | Đêm 1 | Bóng Mực wander->chase khi Mây trong 12 m; chase->wander khi Mây ngoài 18 m; tên trạng thái đúng | ĐẠT |
| shade_speed_night1 | hồi quy P2 | Đêm 1 | Bóng Mực đuổi 4,0 m/s ở Đêm 1 | ĐẠT |
| shade_speed_night3 | hồi quy P2 | Đêm 3 | Bóng Mực đuổi 4,5 m/s ở Đêm 3 | ĐẠT |
| shade_schedule_night1 | hồi quy P2 | Đêm 1 | Bóng Mực: 2 con tại tick 300 (spawning 30 tick), sau đó mỗi 8 s (480 tick), id S1.., cách Mây >= 15 m, tối đa 6 | ĐẠT |
| mote_schedule | hồi quy P2 | Đêm 1 | Đom đóm: 20 lúc bắt đầu ở 20 điểm khác nhau; sinh thêm 1 mỗi 240 tick; hết điểm trống (24 điểm Đêm 1) thì bỏ lượt | ĐẠT |
| mote_ttl | hồi quy P2 | Đêm 1 | Đom đóm rơi hết hạn sau ttl (480 tick); ttl_s giảm theo thời gian | ĐẠT |
| wind_night3 | hồi quy P2 | Đêm 3 | Gió mạnh (Đêm 3): báo trước, thổi 5 s mỗi 30 s, đẩy Mây 2 m/s theo dir_deg; wind_enabled=false thì không có | ĐẠT |
| wind_off_night1 | hồi quy P2 | Đêm 1 | Chỉ Đêm 3 mới có gió | ĐẠT |
| pause_resume | hồi quy P2 | Đêm 1 | Tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, vị trí đứng yên, snapshot state=paused; sự kiện paused/resumed | ĐẠT |
| pause_freezes_cooldowns | hồi quy P2 | Đêm 1 | Khi tạm dừng hồi chiêu và bất tử không giảm | ĐẠT |
| fuel_decay | mới P3 | Đêm 1 | Đèn đang sáng hao 1.0 đơn vị/giây (1/60 mỗi tick): fuel 100 -> 99.0 sau 60 tick, 90.0 sau 600 tick; không sai số tích lũy | ĐẠT |
| fuel_default_100 | mới P3 | Đêm 1 | Đèn đặt lit:true không nêu fuel thì fuel mặc định 100; đặt fuel thì dùng fuel đó; snapshot có fuel, ever_lit, relit_count cho mọi đèn | ĐẠT |
| lantern_out | mới P3 | Đêm 1 | Hết dầu (fuel <= 0): đèn tắt ngay ở tick đó, deposited = 0, phát lantern_out {lantern_id}, nhớ ever_lit = true, fuel 0 | ĐẠT |
| refuel_basic | mới P3 | Đêm 1 | Châm dầu: used = min(đang mang, ceil((100-fuel)/10)), +10 fuel mỗi đom đóm, +5 điểm mỗi đom đóm, phát refuel {lantern_id, amount, fuel} | ĐẠT |
| refuel_caps_at_100 | mới P3 | Đêm 1 | Châm dầu không vượt 100: fuel 60 (59.98 sau hao) cần ceil(40.02/10)=5 đom đóm dù đang mang 10; fuel kết thúc đúng 100 | ĐẠT |
| refuel_used_rounds_up | mới P3 | Đêm 1 | fuel 96 (95.98 sau hao) cần ceil(4.02/10)=1 đom đóm: dùng đúng 1, đủ để đầy | ĐẠT |
| interact_picks_nearest_receivable | mới P3 | Đêm 1 | Chọn đèn khi tương tác: đèn nhận được (chưa sáng hoặc sáng chưa đầy) gần nhất; L3 (sáng, chưa đầy) cách 1 m gần hơn L1 (sáng) 1,5 m và L2 (chưa sáng) 2 m | ĐẠT |
| interact_tie_lowest_id_lit_vs_unlit | mới P3 | Đêm 1 | Đèn sáng-chưa-đầy và đèn chưa sáng cách đều 1 m: chọn id nhỏ hơn (L1 chưa sáng -> deposit; không refuel L2) | ĐẠT |
| relight_cost_5 | mới P3 | Đêm 1 | Thắp lại đèn đã từng sáng chỉ cần 5 đom đóm: lantern_lit {relight:true}, +5×5 + 40 = 65 điểm, relit_count = 1, fuel 100, ever_lit true | ĐẠT |
| first_light_still_10 | mới P3 | Đêm 1 | Đèn chưa từng sáng vẫn cần 10: nạp 5 chưa sáng, deposited = 5, ever_lit vẫn false | ĐẠT |
| out_then_relight_chain | mới P3 | Đêm 1 | Chuỗi đầy đủ: đèn sáng -> hết dầu (lantern_out, ever_lit giữ) -> Mây thắp lại bằng 5 đom đóm (relight true) | ĐẠT |
| capacity_grows | mới P3 | Đêm 1 | Sức chứa = 10 + 2×successful_lights; thắp thành công tăng 1; đèn đặt sẵn bằng scenario không tính (capacity 10 lúc đầu, 12 sau 1 lần thắp) | ĐẠT |
| capacity_cap_20 | mới P3 | Đêm 1 | successful_lights từ scenario: 9 -> vẫn 20 (tối đa 20) | ĐẠT |
| capacity_limits_pickup | mới P3 | Đêm 1 | Nhặt đom đóm bị giới hạn bởi sức chứa mới: successful_lights 3 -> chứa 16 | ĐẠT |
| safe_zone_exactly_30 | mới P3 | Đêm 1 | Đèn fuel đúng 30 (sau hao) vẫn còn vùng an toàn: Bóng chase đi vào bị giữ ngoài 6 m | ĐẠT |
| safe_zone_below_30 | mới P3 | Đêm 1 | Đèn fuel < 30 mất vùng an toàn: cùng cảnh nhưng fuel 29.98 thì Bóng chase đi thẳng vào trong 6 m | ĐẠT |
| drain_enters_and_drains | mới P3 | Đêm 1 | Bóng wander cách đèn yếu <= 2 m chuyển sang drain, đứng yên, hút 5/s (+1/s hao = 6/s); fuel_drain {lantern_id, shade_id, fuel} mỗi 60 tick | ĐẠT |
| drain_stacks | mới P3 | Đêm 1 | Nhiều con cộng dồn: 1 con hút 5+1 = 6/s (29 -> 23.0 sau 60 tick); 2 con hút 5+5+1 = 11/s (29 -> 18.0) | ĐẠT |
| drain_to_wander_when_out | mới P3 | Đêm 1 | Từ drain: đèn tắt thì sang wander (ngay tick đèn tắt) | ĐẠT |
| drain_to_chase_player_near | mới P3 | Đêm 1 | Từ drain: sang chase nếu Mây vào trong 6 m; Mây ở xa 8 m thì vẫn drain | ĐẠT |
| refuel_pushes_shades_out | mới P3 | Đêm 1 | Châm dầu lên >= 30 khi Bóng đang hút trong vùng 6 m: Bóng bị đẩy ra, không gây sát thương trong 30 tick (kể cả khi đứng sát Mây) | ĐẠT |
| drain_pulse_score_15 | mới P3 | Đêm 1 | Tỏa Sáng trúng Bóng đang drain: tổng +15 (thường +5); bóng sang stunned | ĐẠT |
| pulse_score_5_non_drain | mới P3 | Đêm 1 | Tỏa Sáng trúng Bóng không drain: +5 mỗi con | ĐẠT |
| stunned_then_wander | mới P3 | Đêm 1 | [P3 THAY THẾ] Hết choáng thì về wander (Phase 2: chase nếu Mây trong 18 m): Mây cách 15 m (12-18) -> wander | ĐẠT |
| wander_targets_weak_then_unlit | mới P3 | Đêm 1 | Bóng wander chọn đèn sáng có fuel < 30 gần nhất (bằng nhau thì id nhỏ); đèn yếu được ưu tiên dù đèn tắt L4 gần hơn | ĐẠT |
| wander_targets_unlit_when_no_weak | mới P3 | Đêm 1 | Không có đèn yếu thì wander đi về đèn tắt gần nhất | ĐẠT |
| wander_weak_boundary_30 | mới P3 | Đêm 1 | Đèn fuel đúng 30 không phải đèn yếu (yếu là < 30): bóng wander bỏ qua L1 (đúng 30) mà đi về đèn tắt L2 | ĐẠT |
| drain_range_is_2m | mới P3 | Đêm 1 | Vào drain khi cách đèn <= 2 m (XZ): bóng cách đúng 2,0 m vào drain ngay; bóng cách 2,5 m còn đang wander đi tới (chưa drain sau 5 tick) | ĐẠT |
| chase_ignores_weak_lantern | mới P3 | Đêm 1 | Bóng đang chase không đổi mục tiêu: đi ngang đèn yếu (< 2 m) vẫn không chuyển sang drain | ĐẠT |
| no_early_win_all_lit | mới P3 | Đêm 1 | Thắp đủ 5/5 đèn từ đầu: không thắng sớm, game chạy tiếp tới bình minh | ĐẠT |
| no_flames_beats_dawn_win | mới P3 | Đêm 1 | Hết Ngọn Lửa ở đúng tick bình minh vẫn thua no_flames dù đủ đèn sáng | ĐẠT |
| dawn_score_formula | mới P3 | Đêm 1 | Bình minh thắng 3/5 đèn (fuel 100 -> 99.5 sau 30 tick): điểm = 3×(50 + 99) + 3 Ngọn Lửa×50 = 597, không thưởng thời gian | ĐẠT |
| dawn_threshold_n1_2of5 | mới P3 | Đêm 1 | Đêm 1: bình minh với 2/5 đèn sáng dưới ngưỡng -> THUA dawn | ĐẠT |
| dawn_threshold_n1_3of5 | mới P3 | Đêm 1 | Đêm 1: bình minh với 3/5 đèn sáng đủ ngưỡng 60% -> THẮNG dawn_survived | ĐẠT |
| dawn_threshold_n2_3of6 | mới P3 | Đêm 2 | Đêm 2: bình minh với 3/6 đèn sáng dưới ngưỡng -> THUA dawn | ĐẠT |
| dawn_threshold_n2_4of6 | mới P3 | Đêm 2 | Đêm 2: bình minh với 4/6 đèn sáng đủ ngưỡng 60% -> THẮNG dawn_survived | ĐẠT |
| dawn_threshold_n3_4of7 | mới P3 | Đêm 3 | Đêm 3: bình minh với 4/7 đèn sáng dưới ngưỡng -> THUA dawn | ĐẠT |
| dawn_threshold_n3_5of7 | mới P3 | Đêm 3 | Đêm 3: bình minh với 5/7 đèn sáng đủ ngưỡng 60% -> THẮNG dawn_survived | ĐẠT |
| pause_freezes_fuel | mới P3 | Đêm 1 | Tạm dừng: dầu không hao (hao theo sim_tick, không theo tick) | ĐẠT |
