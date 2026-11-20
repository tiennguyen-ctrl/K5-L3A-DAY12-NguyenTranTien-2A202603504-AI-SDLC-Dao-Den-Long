# Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1): truy vết yêu cầu → bằng chứng

Bằng chứng sinh bằng lệnh thật ở commit gắn tag `phase-2`. Chạy lại: `npm test` (89 test), `npm run proof` (kịch bản qua CLI), `node scripts/bot.ts`. Spec và giả định: [../notes/phase2-spec.md](../notes/phase2-spec.md). Kết quả từng kịch bản: [phase2/RESULTS.md](phase2/RESULTS.md) (mỗi thư mục `phase2/<kịch bản>/` có `scenario.json`, `inputs.json`, `output.jsonl`). Bằng chứng Phase 1 giữ nguyên ở `phase1/` (khớp tag `phase-1`).

Kết quả chạy lúc viết: 89/89 test đạt; 67/67 kịch bản qua CLI đạt; typecheck sạch.

## Phần 1: số liệu chuẩn
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Tốc độ 6 m/s, hướng theo yaw, chuẩn hóa vector | `move_yaw`, `move_normalized` | ĐẠT |
| Nhảy 7 m/s, trọng lực -20, chỉ nhảy khi chạm đất, cạnh nút | `jump`, `jump_edge` | ĐẠT |
| Lướt 14 m/s, 0,2 s, hồi 1,5 s từ lúc bắt đầu, hướng đi/hướng mặt, giữ độ cao trên không, không bất tử | `dash_basic`, `dash_facing`, `dash_air_keeps_height` | ĐẠT |
| Sức chứa 10; nhặt ≤ 1,0 m XZ và chênh cao ≤ 1,5 m | `carry_capacity`, `pickup_mote`, `pickup_height` | ĐẠT |
| Đom đóm: 20 ban đầu ở 20 điểm khác nhau, +1 mỗi 240 tick, hết điểm trống bỏ lượt, đom đóm rơi hết hạn 480 tick | `mote_schedule`, `mote_ttl` | ĐẠT |
| Đèn: 10 đom đóm, nạp nhiều lần, nhớ tiến độ, tầm 2,0 m, chỉ đèn chưa sáng, gần nhất rồi id | `deposit_partial`, `deposit_resume`, `deposit_lit`, `deposit_nearest_then_id`, `deposit_tie_lowest_id`, `deposit_skips_lit`, `deposit_out_of_range` | ĐẠT |
| Vùng an toàn 6 m chỉ đèn đã sáng; bóng trong vùng bị đẩy ra ≤ 30 tick và không sát thương | `safe_zone_lit`, `safe_zone_unlit_none`, `safe_zone_push_out` | ĐẠT |
| Tỏa Sáng: tốn 3, 5 m 3D từ chân+0,8, hồi 3 s, choáng 120 tick, đẩy 4 m/15 tick, làm mới, không đủ thì không chạy | `pulse_stun`, `pulse_needs_light`, `pulse_cooldown_edge` | ĐẠT |
| Bóng Mực: 4,0 m/s (Đêm 3 4,5), phát hiện 12/bỏ đuổi 18, 5 trạng thái, lịch sinh (2 con tại tick 300, rồi mỗi khoảng), id S1.., cách Mây ≥ 15 m | `shade_states_detect`, `shade_speed_night1`, `shade_speed_night3`, `shade_schedule_night1` | ĐẠT |
| Bị đánh: -1 Ngọn Lửa, rơi floor(mang/2) ra vành 1,5-2,5 m, bất tử 90 tick, recoil 2 m/60 tick, chạm lúc bất tử không làm gì | `shade_hit_drop_recoil`, `lose_no_flames` | ĐẠT |
| Rơi khỏi đảo: đúng 1 lần, bỏ qua bất tử, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử, hết Ngọn Lửa thì thua | `fall_event`, `fall_ignores_invuln`, `fall_last_flame` | ĐẠT |
| Thắng/thua: hết Ngọn Lửa luôn thua; đủ đèn kể cả đúng tick hết giờ thì thắng; dawn | `no_flames_beats_win`, `win_at_dawn_tick`, `win_all_lit`, `lose_dawn` | ĐẠT |
| Điểm: +10 mỗi đom đóm nạp, +100 đèn, +5 mỗi bóng trúng, thắng +2/giây còn +50/Ngọn Lửa | `deposit_*`, `win_all_lit`, `pulse_stun` | ĐẠT |
| Thời gian Đêm 300/330/360 s; Ngọn Lửa 3 | `win_night2_last_lantern`, `win_night3_tier2_lantern`, test bản đồ chuẩn | ĐẠT |
| Thứ tự 12 bước trong một tick | cài đặt đúng thứ tự trong `stepGame`; các kịch bản trên kiểm hệ quả (ví dụ đèn vừa sáng thì bóng bị đẩy ngay tick đó) | ĐẠT (gián tiếp) |

## Phần 2: bản đồ chuẩn
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Đêm 1/2/3: số đèn, vị trí, xuất phát, 20 đom đóm ban đầu, thời lượng, bùa | test "bản đồ chuẩn" (`tests/headless.test.ts`) | ĐẠT |
| Cầu tre không lan can; rơi nếu bước ra ngoài | `bridge_walk`, `bridge_fall` | ĐẠT |
| Bục nhảy Đêm 2 (Y 14, 24 m/s ngang về đảo kia, không bị phím ghi đè, đáp trong đảo đích) | `pad_night2` | ĐẠT |
| Đêm 3: leo dốc, vách đứng, bước ra mép thì rơi xuống tầng dưới, bục nhảy lên tầng 2, tháp chuông chặn | `ramp_climb`, `cliff_blocks`, `step_off_tier`, `pad_night3_tier2`, `tower_blocks` | ĐẠT |
| Gió mạnh Đêm 3: báo trước 2 s, 5 s mỗi 30 s, 2 m/s theo dir_deg; chỉ Đêm 3 | `wind_night3`, `wind_off_night1` | ĐẠT |
| Lịch sinh Gió Lạc 1200, 2400, tối đa 2; không có ở Đêm 1 | `drifter_schedule_night2`, `no_drifters_night1` | ĐẠT |

## Phần 3: tính năng mới (tiêu chí GL/BG... ở spec)
| Tính năng | Kiểm chứng | Kết quả |
|---|---|---|
| Gió Lạc GL1-GL5 (kích hoạt, cướp min(3,mang), flee, Tỏa Sáng làm bỏ chạy/thả đồ, bỏ qua vùng an toàn/bất tử) | `drifter_steal`, `drifter_steal_clamped`, `drifter_no_trigger`, `drifter_pulse_chase`, `drifter_drop`, `drifter_ignores_safe_zone_and_invuln` | ĐẠT |
| Bùa Gió BG1-BG4 (nhặt, 7,2 m/s, lướt không hồi nhưng phải nhấn lại, hết hạn, làm mới, xuất hiện lại) | `charm_pickup`, `charm_expires`, `charm_respawn`, `charm_refresh`, `charm_dash_no_cooldown` | ĐẠT |
| Chuỗi 3 Đêm: menu → giới thiệu → chơi → kết quả → Đêm kế; thắng Đêm 3 ra Bình Minh với tổng điểm; thua chơi lại đúng Đêm | `tests/web.test.ts` (logic `src/web/flow.ts`); ảnh `phase2/screenshots/intro-night2.png`, `dawn-staged.png` | ĐẠT logic; ảnh Bình Minh là cảnh dàn dựng |
| Tạm dừng: logic dừng hoàn toàn, snapshot `paused`, sự kiện paused/resumed | `pause_resume`, `pause_freezes_cooldowns`; ảnh `pause-menu.png` (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) | ĐẠT |
| Cài đặt (âm lượng, độ nhạy chuột) lưu giữa các lần mở | `tests/web.test.ts` (lưu/đọc lại, giá trị hỏng, storage bị chặn) | ĐẠT logic; chưa thử lưu thật trong trình duyệt |
| Âm thanh: nhạc nền + hiệu ứng nhặt/thắp/tỏa sáng/bị đánh/nhảy/lướt/thắng/thua/bóng xuất hiện/đếm ngược 10 s | cài đặt trong `src/web/audio.ts` (Web Audio, không dùng file âm thanh) | **CHƯA KIỂM CHỨNG** (xem dưới) |
| HUD đầy đủ (Ngọn Lửa, đồng hồ đỏ nhấp nháy ≤ 30 s, đèn k/n, điểm, thanh 10 ô, hồi chiêu Lướt/Tỏa Sáng, nhắc nạp đèn, mũi tên chỉ đèn) | ảnh `night2-hud.png`, `night3-hud.png` | ĐẠT một phần: ảnh có đủ trừ nhắc nạp đèn, đồng hồ đỏ nhấp nháy, Bùa Gió, gió |
| Bảng màu chuẩn; ánh sáng môi trường = 0,15 + 0,55 × (đèn sáng/tổng) | test mã hex (`tests/web.test.ts`); công thức cài đặt trong `World.update` | ĐẠT mã hex; công thức chưa có test |

## Phần 4: Test Contract v1.1
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| `contract_version: "1.1"`, tuning khớp số chuẩn, thêm dash_speed, dash_duration_s, dash_cooldown_s, night2/3_duration_s | test contract (so từng số chuẩn) | ĐẠT |
| `--night` 1, 2, 3 (4 bị từ chối) | test CLI | ĐẠT |
| Snapshot thêm night, wind, player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}; mảng motes/drifters/charms | test "snapshot v1.1 có đủ trường bắt buộc" | ĐẠT |
| Scenario thêm các trường mới; trạng thái sai tên bị từ chối (mã 2); input thêm dash, pause | test CLI (12 file hỏng) + các kịch bản dùng trường mới | ĐẠT |
| Sự kiện mới: dash, charm_picked, drifter_steal, drifter_drop, night_start, paused, resumed, player_hit.lost | các kịch bản tương ứng | ĐẠT |
| Tên trạng thái bóng: spawning, wander, chase, recoil, stunned | `shade_states_detect`, `shade_schedule_night1`, `shade_hit_drop_recoil` | ĐẠT |
| Một Đêm đầy đủ (21.600 tick) ≤ 30 s | [phase2/perf/RESULTS.md](phase2/perf/RESULTS.md): 0,45 / 0,46 / 0,60 s cho Đêm 1/2/3; chạy lại giống hệt | ĐẠT |
| Tính tất định trên cả 3 Đêm | test tất định + mã băm sha256 trong `perf/RESULTS.md` | ĐẠT |

## Định nghĩa hoàn thành (DoD)
| Mục | Kết quả |
|---|---|
| Bằng chứng game chạy đúng yêu cầu | các bảng trên; **chưa có ván chơi tay Phase 2 được ghi lại** |
| Hồi quy Phase 1 với số chuẩn | 18 kịch bản `phase: 1` trong `tests/cases.ts` chạy lại; chỗ luật đổi đã sửa kèm lý do (mục 5 của spec) |
| Spec có acceptance criteria cho từng mục Phần 3 | [../notes/phase2-spec.md](../notes/phase2-spec.md) mục 3 |
| AGENTS.md và skill được cập nhật cho phạm vi mới | `AGENTS.md` (cập nhật Phase 2), skill `.claude/skills/verify-phase/SKILL.md`; lịch sử git sẽ thể hiện sau commit |
| Ít nhất 1 scenario headless cho mỗi tính năng mới | có (Gió Lạc, Bùa Gió, lướt, rơi, cầu, bục nhảy, dốc, vách, tháp, gió, tạm dừng, vùng an toàn mới, bóng 5 trạng thái) |
| Bản thường ≥ 30 FPS trung bình ở 1280×720 | **ĐẠT (cả 3 Đêm)**: chủ repo đo bằng F3 thấy ~99–100 FPS ở Đêm 1, 97–103 ở Đêm 2 và 82 ở Đêm 3 (ảnh `phase2/screenshots/fps-night1.png`, `fps-night2.png`, `fps-night3.png`). Cửa sổ đo lớn hơn 1280×720 (xem dưới) |

## Chưa kiểm chứng / hạn chế (trung thực)
- **FPS đã đo ở cả 3 Đêm: Đêm 1 ~99–100, Đêm 2 97–103, Đêm 3 82.** Chủ repo đọc bằng F3 (đồng hồ trong game); số 99–100 có thể là trần của tần số quét màn hình (~100 Hz). Máy: Intel Core i5-12450H, NVIDIA GeForce RTX 3050 Laptop GPU và Intel UHD Graphics (không rõ trình duyệt dùng GPU nào), Windows 11, Chrome. Cửa sổ đo ~1917×857 ở Đêm 1 và ~1580×870 ở Đêm 3 (lớn hơn 1280×720 nên điều kiện khắt khe hơn). Ảnh Đêm 3 chụp ngay lúc xuất phát, chưa phải lúc nhiều bóng, Gió Lạc và gió cùng hoạt động ở khu vực nhiều tầng; số đo đó là lúc nhẹ nhất của Đêm 3, chưa phải trường hợp xấu nhất. Chrome headless trên máy tôi dùng giả lập GPU bằng phần mềm nên không dùng để đo.
- **Âm thanh chưa nghe thử**: không có cách kiểm trong môi trường headless. Cần chơi thử để xác nhận nghe được và không chói tai.
- **Hình ảnh Đêm 3 chưa thấy đủ**: ảnh Đêm 3 chỉ chụp lúc xuất phát; tầng, dốc, tháp chuông, bục nhảy chỉ được kiểm bằng logic headless, chưa được nhìn thấy bằng mắt.
- **Chưa có ván chơi tay** Đêm 2 và Đêm 3 (cầu, Gió Lạc, bùa, gió, bục nhảy). Mũi tên chỉ đèn, nhắc nạp đèn, đồng hồ đỏ nhấp nháy, Bùa Gió, lá bay báo gió: đã cài đặt nhưng chưa xác nhận bằng ảnh.
- **Bot không chứng minh được Đêm 2 và 3 thắng được.** Bot tham lam biết né: Đêm 1 thắng 2/6 ván (seed 2, 4), Đêm 2 thắng 0/6, chưa có bot Đêm 3 (xem [phase2/bot/RESULTS.md](phase2/bot/RESULTS.md); mọi ván phát lại qua CLI khớp). Bot không dùng Bùa Gió, không tránh Gió Lạc nên thua Đêm 2 không có nghĩa là Đêm 2 không thắng được. Thắng Đêm 2/3 chỉ được chứng minh ở bước cuối (kịch bản `win_night2_last_lantern`, `win_night3_tier2_lantern`).
- **Một số giả định có thể lệch với test ẩn** (xem spec mục 2): điểm xuất phát Đêm 3, `night_start` ở tick 0, `invuln` là số tick, thời gian `spawning` 30 tick, `wander` chuyển động 2 m/s.
- Kiểm tra tất định mới chạy trên một máy (Windows, Node 24); chưa thử macOS/Linux.
