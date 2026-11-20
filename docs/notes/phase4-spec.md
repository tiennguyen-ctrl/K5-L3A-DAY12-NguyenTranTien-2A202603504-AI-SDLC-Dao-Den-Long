# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3): spec, giả định, tiêu chí nghiệm thu

Viết trước khi làm (kịch bản kiểm chứng ở `tests/phase4.test.ts`). Ticket-04 là Non-functional + Release: **không đổi luật game hay đầu ra headless** (cờ `Game.bench` mặc định `false`).

## 1. Phase 4 thêm gì

| Chủ đề | Nội dung | Nơi cài đặt |
|---|---|---|
| Benchmark | `node scripts/bench.ts --seed 42 --duration 30 --out bench.json`: mở Chrome/Edge, cảnh chuẩn (Đêm 1, 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, camera bay vòng 30 m / Y 15 m / 15 s), 3 s khởi động rồi đo | `src/web/bench.ts` (thuần), `src/web/main.ts` (vẽ), `scripts/bench.ts` (launcher) |
| Soak | `node scripts/soak.ts --seed 7 --nights 10 --out soak.json`: 10 Đêm liên tiếp trong cùng tiến trình, seed 7 + i | `scripts/soak.ts` |
| Bảng xếp hạng | nhập tên sau màn Bình Minh hoặc sau khi thua; top 10 lưu ra đĩa; màn hình từ menu; `npm run dev -- --export-leaderboard out.json` | `src/web/leaderboard.ts` (thuần), `scripts/server-lib.ts` + `scripts/run.ts` (lưu đĩa/xuất), `src/web/main.ts` (giao diện) |
| Đổi phím | 9 hành động, phát hiện trùng, "Khôi phục mặc định", lưu | `src/web/keybinds.ts`, `src/web/settings.ts`, `src/web/main.ts` |
| Trợ năng | phụ đề/chỉ báo (Bóng Mực xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn fuel < 30), giảm chuyển động, chữ ≥ 18 px + chữ lớn ×1,25 | `src/web/main.ts`, `src/web/index.html` |
| Đóng gói | README đủ mục, CHANGELOG 4 phase, CREDITS, LICENSE, Release v1.0.0 (thư mục web tĩnh + máy chủ nhỏ) | README, `scripts/serve.ts` |
| Contract v1.3 | `contract_version "1.3"`, thêm `bench_cmd`, `soak_cmd` | `game.contract.json` |
| Retro | 1–2 trang tổng hợp 4 phase | [retro.md](retro.md) |

## 2. Giả định (ticket không nói rõ)

| # | Giả định | Rủi ro |
|---|---|---|
| B1 | Game là bản **web** (Three.js), nên "tiến trình" của bench là trình duyệt Chrome/Edge do launcher mở; `load_ms` tính từ lúc launcher (tiến trình Node) bắt đầu tới khung hình đầu tiên của cảnh bench (gồm dựng bản build nếu cần: đã build sẵn thì ~1,3 s) | người chấm cần có Chrome/Edge/Chromium |
| B2 | Cửa sổ "1280×720": **canvas WebGL cố định 1280×720**, pixel ratio 1; cửa sổ trình duyệt hơi lớn hơn (1280×820) để chứa thanh tiêu đề | không thể ép đúng kích thước vùng hiển thị của cửa sổ OS |
| B3 | Tắt vsync bằng cờ Chrome `--disable-gpu-vsync` (`vsync_off: true`). Không dùng `--disable-frame-rate-limit` vì trên máy thử nó làm nhịp khung hình giật (p1_low ~10 fps, đo lại có chứng cứ trong ai-log); Chrome vẫn có thể giới hạn theo `requestAnimationFrame` | avg_fps phụ thuộc cách trình duyệt/GPU của máy chấm |
| B4 | `peak_mem_mb = null` (trang web không đọc được RSS của trình duyệt; không chèn việc đo vào khoảng đo). Ghi thêm `mem_after_run_mb` (tổng RSS các tiến trình của trình duyệt ngay sau khoảng đo) | ticket cho phép null với bản web, kèm giải thích |
| B5 | Camera: θ = 2π·t/15, vị trí = (30cosθ, 15, −30sinθ). "Ngược chiều kim đồng hồ khi nhìn từ trên xuống" với +X sang phải thì +Z hướng xuống màn hình nên đi từ +X lên là về phía −Z | nếu người chấm hiểu ngược lại thì quay ngược chiều (không đổi số đo) |
| B6 | 200 Bóng Mực "rải đều" bằng mẫu hoa hướng dương (góc vàng) trên đĩa bán kính 37 m, xoay theo seed; 100 đom đóm bán kính 35 m. Bóng ở trạng thái `wander` nguyên trạng, bỏ chuyển `chase` khi Mây trong 12 m (nếu không cả 200 bóng sẽ đuổi Mây) | "luật wander bình thường" |
| B7 | Cảnh bench dùng cờ `Game.bench` (tắt sinh thực thể, sát thương, nhặt, hao dầu, kết thúc Đêm). Mây hiển thị đứng yên ở (0,0,0) | đúng ticket mục 1.4 |
| S1 | Soak: Đêm thứ i = 1..N dùng seed 7 + i (i bắt đầu từ 1); Đêm = ((i−1) mod 3) + 1. Mỗi Đêm chạy tới khi kết thúc hoặc hết thời lượng chuẩn. Input: RNG riêng seed ^ 0x9e3779b9; mỗi 30 tick đổi hướng (góc ngẫu nhiên), mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác | "i" có thể bắt đầu từ 0; kết quả `results` sẽ khác |
| S2 | `mem_start_mb` đo sau khi nạp Đêm đầu tiên và chạy ổn định 1200 tick khởi động (không tính vào kết quả); `mem_baseline_mb` là RSS thô trước khởi động. Ép GC (`--expose-gc` qua `v8.setFlagsFromString`) trước mỗi lần đo RSS. `mem_end_mb` sau khi Đêm cuối kết thúc và tham chiếu đã dọn | không có định nghĩa chính xác về "tải xong" |
| L1 | Tên 3–12 ký tự: chữ cái (kể cả tiếng Việt có dấu), chữ số, `_`; cắt khoảng trắng đầu/cuối, chuẩn hóa NFC | điểm cộng tiếng Việt |
| L2 | `achieved_at` theo giờ máy kèm độ lệch múi giờ (ví dụ `2026-11-20T17:30:05+07:00`). Bằng điểm thì ai đạt trước (so thời điểm tuyệt đối) đứng trên; bằng cả thời điểm thì ai vào trước | |
| L3 | `score` = tổng điểm các Đêm đã thắng trong lượt chơi; `nights_won` đếm số Đêm thắng trong lượt (chọn Đêm từ menu thì bắt đầu từ 0); `seed` = seed của Đêm vừa kết thúc | |
| L4 | Bản `npm run dev` lưu bảng xếp hạng ra `data/leaderboard.json` (thư mục dữ liệu bị .gitignore). Bản web tĩnh không có máy chủ thì lưu `localStorage` | |
| L5 | `npm run dev -- --export-leaderboard out.json` (cũng nhận `-export-leaderboard`, `--export-leaderboard=out.json`): ghi `{"entries":[...]}` rồi thoát mã 0, không mở game | `<run_cmd>` của contract là `npm run dev` |
| A1 | Phím lưu theo `KeyboardEvent.code`; phím dành riêng không gán được: Enter, F3, mũi tên (xoay camera). Esc trong lúc đang đổi phím là hủy. `P` vẫn tạm dừng nếu chưa gán cho hành động khác | |
| A2 | Cỡ chữ UI nền 18 px (mọi chữ HUD/menu ≥ 18 px ở 1280×720); "Chữ lớn" ×1,25 = 22,5 px | |
| A3 | "Rung camera" tôi chủ động thêm một cú rung 0,25 s khi bị Bóng Mực chạm/rơi để có cái mà tắt; "Giảm chuyển động" tắt rung camera, chớp màn hình, nảy bước chân của Mây và hoạt ảnh nhấp nháy/trượt | |

## 3. Tiêu chí nghiệm thu

| Mục ticket | Tiêu chí | Kiểm chứng |
|---|---|---|
| 1 Benchmark | số đo đúng công thức; cảnh đúng 200/100; camera đúng; `bench.json` đúng khóa; thoát mã 0 | `tests/phase4.test.ts` (benchStats, camera, cảnh, `game.bench`), chạy thật → `docs/proof/phase4/bench.json` |
| 1 Ngưỡng | avg ≥ 60, p1_low ≥ 30, load ≤ 10000 ms trên máy chấm | đo trên máy tôi chỉ để tham khảo |
| 2 Soak | 10 Đêm một tiến trình, `crashes = 0`, `mem_end ≤ 1,2 × mem_start` | `tests/phase4.test.ts` (3 Đêm, dạng JSON, tất định), chạy thật → `docs/proof/phase4/soak.json` |
| 3 Bảng xếp hạng | tên hợp lệ, top 10, sắp xếp, lưu đĩa, màn hình menu, lệnh xuất | `tests/phase4.test.ts` (tên, xếp hạng, API đĩa, xuất, nightsWon) + ảnh |
| 4 Đổi phím | 9 hành động, trùng phím bị từ chối kèm báo, khôi phục mặc định, lưu | `tests/phase4.test.ts` (keybinds, cài đặt) + ảnh |
| 4 Phụ đề, giảm chuyển động, cỡ chữ | có chỉ báo + mũi tên; công tắc; chữ ≥ 18 px | cài đặt trong `src/web`; **kiểm bằng ảnh và tay**, không có test tự động cho phần hình |
| 5 Đóng gói | README đủ mục, CHANGELOG 4 phase, CREDITS, LICENSE, Release | file trong repo; Release do chủ repo tạo (máy không có `gh`) |
| 6 Contract v1.3 | `contract_version "1.3"`, `bench_cmd`, `soak_cmd` | `tests/headless.test.ts` |
| 7 Retro, video | retro 1–2 trang; video < 5 phút | [retro.md](retro.md); video do chủ repo quay |
