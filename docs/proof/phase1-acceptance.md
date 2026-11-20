# Phase 1: truy vết yêu cầu → bằng chứng

Bằng chứng sinh bằng lệnh thật ở commit được gắn tag `phase-1`. Chạy lại: `npm test`, `npm run proof`, `node scripts/bot.ts`. Kết quả từng kịch bản: [phase1/RESULTS.md](phase1/RESULTS.md). Mỗi thư mục `phase1/<kịch bản>/` có `scenario.json`, `inputs.json`, `output.jsonl`.

| # | Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1 | Đi lại, camera yaw, chuẩn hóa vector | kịch bản `move_yaw`, `move_normalized` | phase1/move_yaw, move_normalized | ĐẠT |
| 2 | Nhảy, Y=0 là mặt đất, kích hoạt ở cạnh nút | `jump`, `jump_edge` | phase1/jump, jump_edge | ĐẠT |
| 3 | Nhặt đom đóm, sức chứa, +điểm | `pickup_mote`, `carry_capacity` | phase1/pickup_mote, carry_capacity | ĐẠT |
| 4 | Nạp ánh sáng vào đèn để thắp | `deposit_partial`, `deposit_lit`, `deposit_out_of_range` | phase1/deposit_* | ĐẠT |
| 5 | Thắng khi thắp hết đèn, điểm thắng | `win_all_lit` (đèn đặt sẵn lit không cộng điểm) | phase1/win_all_lit | ĐẠT |
| 6 | Bóng Mực chạm thì mất máu, rơi đom đóm, bất tử ngắn | `shade_hit_drop_invuln` | phase1/shade_hit_drop_invuln | ĐẠT |
| 7 | Mất hết máu thì thua | `lose_no_flames` | phase1/lose_no_flames | ĐẠT |
| 8 | Hết đêm thì thua (dawn) | `lose_dawn` | phase1/lose_dawn | ĐẠT |
| 9 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | `pulse_stun`, `pulse_needs_light`, `pulse_cooldown_edge` | phase1/pulse_* | ĐẠT |
| 10 | Bóng Mực sợ đèn (safe_radius) | `safe_radius` kiểm mọi snapshot | phase1/safe_radius | ĐẠT |
| 11 | Dựng scenario không phát sự kiện/điểm; random_* = false | `scenario_silent` | phase1/scenario_silent | ĐẠT |
| 12 | Tất định theo seed | `tests/headless.test.ts` (hai lần chạy giống hệt, seed khác thì khác); `full-night-a.jsonl` chạy hai lần `cmp` giống hệt, sha256 `b539ea7dd19195b1abd1…` | tests/, phase1/full-night-a.jsonl | ĐẠT |
| 13 | Mã thoát 0; lỗi file = 2; lỗi khác ≠ 0; stderr | test CLI (6 file hỏng + file không tồn tại + thiếu tham số) | tests/headless.test.ts | ĐẠT |
| 14 | `game.contract.json` đủ khóa; số khai = số game dùng | test contract; core đọc trực tiếp từ file | tests/headless.test.ts | ĐẠT |
| 15 | Chơi được từ đầu đến thắng | bot tham lam thắng 8/8 seed, phát lại qua CLI khớp | phase1/bot/RESULTS.md | ĐẠT (bot) |
| 16a | Giao diện 3D + HUD (ngọn lửa, đom đóm mang, đèn sáng, giờ, điểm, tỏa sáng) | người chơi chơi thật trên trình duyệt, chụp màn hình | phase1/screenshots/lantern-lit.png (đèn đã sáng), gameplay.png | ĐẠT |
| 16b | Màn thua | ảnh chụp ván chơi thật (hết ngọn lửa, 50 điểm) | phase1/screenshots/lose-screen.png | ĐẠT |
| 16c | Màn thắng | ảnh dàn dựng bằng scenario (cả 5 đèn `lit`, mở `#win`); điểm 449 = 299 + 150 khớp công thức | phase1/screenshots/win-screen-staged.png | ĐẠT (dàn dựng, không phải ván chơi thật; ván thắng thật chỉ được chứng minh bằng bot, mục 15) |
| 16d | Chơi lại bằng Enter / nút | chưa có bằng chứng ghi lại | | CHƯA XÁC NHẬN |
| 17 | Mây đội nón lá treo đèn lồng nhỏ | ảnh gameplay | phase1/screenshots/gameplay.png | ĐẠT (xem ảnh) |

## Phần chưa kiểm chứng đầy đủ (trung thực)
- Chủ repo đã chơi thử bản web bằng tay (ảnh `lantern-lit.png`, `lose-screen.png` là ảnh chụp ván thật). Chưa có ghi chép cụ thể cho: hướng camera khi xoay, chơi lại bằng Enter (mục 16d).
- **Chưa có ván thắng thật bằng tay.** Màn thắng chỉ có ảnh dàn dựng bằng scenario; ván thắng đầy đủ mới được chứng minh bằng bot (mục 15).
- Hai ảnh `gameplay.png`, `win-screen-staged.png` và `menu.png` chụp bằng Chrome headless (render phần mềm), không phải ván chơi tay.
- Camera có thể bị cây che: đã xử lý bằng cách tự ẩn cây gần camera/chắn giữa camera và Mây (`src/web/forest.ts`), nhưng bụi lớn sát camera vẫn che một phần màn hình.
- Bot dùng lõi trực tiếp và chỉ chứng minh luật thắng được, không chứng minh độ khó hợp lý cho người: bot thắng với ~250 s còn lại trên 300 s, nên ván có thể dễ với người chơi giỏi. Số `night1_duration_s` và tốc độ Bóng Mực là chỗ chỉnh nếu cần.
- Tính tất định kiểm trên cùng máy/Node (24.16). Chưa chạy trên macOS/Linux.
