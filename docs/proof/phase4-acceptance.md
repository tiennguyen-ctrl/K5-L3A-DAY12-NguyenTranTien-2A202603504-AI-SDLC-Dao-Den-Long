# Nghiệm thu Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Bảng truy vết: yêu cầu → bằng chứng → kết quả. Bằng chứng sinh bằng lệnh thật (không sửa tay). Giả định: [../notes/phase4-spec.md](../notes/phase4-spec.md). Retro: [../notes/retro.md](../notes/retro.md).

Kết quả chạy lúc nộp: `npm test` 150/150 đạt · `npm run typecheck` sạch · `npm run build` thành công · `npm run proof` 106/106 kịch bản qua CLI đạt (không đổi so với Phase 3: Phase 4 không đổi luật).

## Mục 1: Benchmark
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Lệnh `<bench_cmd> --seed 42 --duration 30 --out bench.json`, thoát mã 0 | chạy thật: `node scripts/bench.ts --seed 42 --duration 30 --out docs/proof/phase4/bench.json` | ĐẠT (chạy được, mã 0) |
| Cảnh chuẩn: Đêm 1, đúng 200 Bóng Mực wander rải đều + đúng 100 đom đóm, L1–L3 sáng fuel 100 | `tests/phase4.test.ts` ("cảnh bench"); `bench.json` ghi `shades: 200`, `motes: 100` | ĐẠT |
| Tắt sinh thực thể, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng Mực vẫn wander | `tests/phase4.test.ts` ("game.bench"); cờ mặc định tắt không đổi headless ("cờ bench mặc định tắt") | ĐẠT |
| Mây đứng yên (0,0,0); camera bay vòng R 30 m, Y 15 m, lookAt (0,0,0), xuất phát (30,15,0), 15 s/vòng, ngược chiều kim đồng hồ nhìn từ trên | `tests/phase4.test.ts` ("camera bench") | ĐẠT theo giả định B5 (hướng quay) |
| 3 s khởi động không đo; đo đúng `--duration` giây | `src/web/main.ts` (`benchFrame`); `bench.json`: 3319 khung trong 30 s | ĐẠT |
| Công thức `avg_fps`, `p1_low_fps` (k = max(1, ceil(0,01N))), `frame_ms_p95`, `frames` | `tests/phase4.test.ts` ("benchStats") với số tính tay | ĐẠT |
| `bench.json` đúng khóa: contract_version "1.3", avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os | [phase4/bench.json](phase4/bench.json) | ĐẠT (có thêm khóa chẩn đoán) |
| Cửa sổ 1280×720, tắt vsync (ghi rõ trong README nếu không được) | canvas cố định 1280×720; cờ `--disable-gpu-vsync`; README mục Benchmark | ĐẠT một phần: canvas đúng 1280×720 nhưng cửa sổ OS lớn hơn (thanh tiêu đề); vsync tắt bằng cờ Chrome, trình duyệt vẫn theo nhịp rAF |
| `peak_mem_mb`: RSS đỉnh, null nếu bản web không đo được và giải thích | `peak_mem_mb: null` + `peak_mem_note` + `mem_after_run_mb` (674 MB tổng tiến trình trình duyệt ngay sau khoảng đo) | ĐẠT (theo phương án ticket cho phép) |
| Ngưỡng: avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000 **trên máy chấm của giảng viên** | máy của tôi (i5-12450H, Intel UHD Graphics do Chrome chọn, Windows 11, Chrome 157, có tắt vsync): avg 110,6 · p1_low 62,3 · p95 12 ms · load 2302 ms (gồm lần dựng bản build) | số trên máy tôi đạt ngưỡng; **CHƯA KIỂM CHỨNG trên máy chấm** |

Ghi chú chẩn đoán trung thực: lần đo đầu cho p1_low chỉ ~11 fps do cờ `--disable-frame-rate-limit` làm nhịp khung hình giật (không phải do 200 Bóng Mực: thử 0 Bóng Mực vẫn giật). Bỏ cờ đó thì p1_low ~60. Chi tiết trong [ai-log.md](../notes/ai-log.md) mục Phase 4. Kết quả có thể khác trên máy chấm (GPU/bộ nhớ đồ họa khác).

## Mục 2: Soak
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| `<soak_cmd> --seed 7 --nights 10 --out soak.json` trong một tiến trình, Đêm i seed 7+i, input ngẫu nhiên theo seed | `tests/phase4.test.ts` ("soak": 3 Đêm, dạng JSON, tất định, thiếu tham số → mã 2); chạy thật → [phase4/soak.json](phase4/soak.json) | ĐẠT |
| Output `{nights, crashes, results[], mem_start_mb, mem_end_mb, duration_s}` | `soak.json` (thêm `mem_baseline_mb`) | ĐẠT |
| Ngưỡng `crashes = 0` và `mem_end_mb ≤ 1,2 × mem_start_mb` | lần chạy thật: crashes 0; mem_start 75,6, mem_end 77,9 (tỷ lệ 1,03) | ĐẠT trên máy tôi |

Lưu ý: với input ngẫu nhiên cả 10 Đêm đều "lost" rất nhanh (rơi khỏi đảo, hết Ngọn Lửa; cả 10 Đêm chạy trong 0,3 s), nên soak này chủ yếu kiểm khởi tạo/dọn Đêm nhiều lần, không kiểm các Đêm đầy 4–5 phút. `mem_start_mb` đo sau khi nạp Đêm đầu và chạy 1200 tick khởi động (giả định S2); RSS thô trước đó là 66,1 MB. Chạy 3/10/30/100/300 Đêm cho RSS gần phẳng (73–80 MB, 98 MB ở 300 Đêm), không thấy rò rỉ tuyến tính rõ.

## Mục 3: Bảng xếp hạng cục bộ
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Nhập tên sau Bình Minh hoặc sau khi thua ở bất kỳ Đêm nào | `src/web/main.ts` (`scoreForm` ở `showDawn` và `showResult` khi thua); ảnh [lose.png](phase4/screenshots/lose.png) | ĐẠT: ảnh + chủ repo tự chơi thử và báo "đạt" (lời khai, không có video/ảnh ván chơi đính kèm) |
| Tên 3–12 ký tự `[A-Za-z0-9_]` (+ tiếng Việt có dấu) | `tests/phase4.test.ts` ("tên") | ĐẠT |
| Mỗi mục: name, score, nights_won (0–3), achieved_at ISO 8601 có múi giờ, seed | "makeEntry", "sanitizeEntries", "flow: nightsWon" | ĐẠT |
| Top 10; điểm giảm dần; bằng điểm ai đạt trước đứng trên | "xếp hạng: ... top 10", "bằng điểm và bằng cả thời điểm", "qualifies" | ĐẠT |
| Lưu trên đĩa, còn sau khi tắt mở lại | "bảng xếp hạng trên đĩa" (đóng/mở lại máy chủ, giữ 10 mục; file đĩa hỏng → danh sách rỗng); `npm run serve` bản Release chạy thử ghi `data/leaderboard.json` | ĐẠT cho `npm run dev`/`serve` (test + chủ repo báo đạt khi chơi thử); bản web tĩnh không máy chủ dùng `localStorage` (chưa thử riêng qua tắt mở trình duyệt) |
| Màn hình Bảng xếp hạng từ menu | nút ở menu; ảnh [board.png](phase4/screenshots/board.png) (dữ liệu đọc từ đĩa qua API) | ĐẠT |
| `<run_cmd> --export-leaderboard out.json` → `{"entries":[...]}` đúng thứ tự | "bảng xếp hạng trên đĩa" gọi `scripts/run.ts` thật (`--export-leaderboard`, `-export-leaderboard`) | ĐẠT |

## Mục 4: Dễ tiếp cận
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Đổi phím cho di chuyển 4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng; lưu | `tests/phase4.test.ts` ("đổi phím", "cài đặt: phím và trợ năng được lưu"); ảnh [settings.png](phase4/screenshots/settings.png) | ĐẠT: test + ảnh + chủ repo tự chơi thử và báo "đạt" (lời khai, không có video/ảnh ván chơi đính kèm) |
| Phát hiện trùng phím và báo; nút "Khôi phục mặc định" | "đổi phím: ... trùng ... từ chối"; nút có trong ảnh cài đặt | ĐẠT logic |
| Phụ đề / chỉ báo: Bóng Mực xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn fuel < 30 | `src/web/main.ts` (`caption`, `placeCues`); ảnh [hud.png](phase4/screenshots/hud.png) chỉ thấy phụ đề đèn yếu | ĐẠT: chủ repo tự chơi thử và báo "đạt" (lời khai, không có video/ảnh ván chơi đính kèm); ảnh `hud.png` chỉ có phụ đề đèn yếu |
| Giảm chuyển động: tắt rung camera và chớp màn hình | công tắc trong Cài đặt; CSS `body.rm`; `shake` bị bỏ qua khi bật | ĐẠT: chủ repo tự chơi thử và báo "đạt" (lời khai, không có video/ảnh ván chơi đính kèm) |
| Cỡ chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1,25 | CSS `body{font-size:18px}`, `body.lt{--ui:1.25}`; ảnh `hud.png`, `settings.png` (chụp 1280×720) | ĐẠT: ảnh (chữ thường) + chủ repo tự chơi thử và báo "đạt" (lời khai, không có video/ảnh ván chơi đính kèm) cho chế độ chữ lớn |

## Mục 5: Đóng gói và tài liệu
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Clone sạch → README ≤ 3 lệnh → chơi được | README mục Cài đặt (`git clone`, `npm install`, `npm run dev`); chủ repo báo đã clone sạch trên máy khác và chạy được (lời khai của chủ repo, không có log/ảnh/video đính kèm) | ĐẠT theo lời khai |
| README: mô tả, ảnh chụp, yêu cầu hệ thống, cài đặt, điều khiển, test, headless, bench, soak | [README.md](../../README.md) | ĐẠT (ảnh chụp từ Chrome headless; **link video còn trống**, chờ quay) |
| CHANGELOG có mục cho cả 4 phase | [CHANGELOG.md](../../CHANGELOG.md) | ĐẠT |
| CREDITS (mọi asset, âm thanh, công cụ AI), LICENSE | [CREDITS.md](../../CREDITS.md), [LICENSE](../../LICENSE) | ĐẠT (không asset ngoài; Claude Code ghi rõ) |
| GitHub Release v1.0.0 có bản chạy được | gói thư mục web tĩnh `release/dao-den-long-v1.0.0-web.zip` (dist + `scripts/serve.ts`); đã giải nén sang thư mục khác và chạy `node scripts/serve.ts`: trang tải được, bảng xếp hạng ghi ra đĩa | gói đã sẵn sàng; **Release trên GitHub do chủ repo tạo** (máy không có `gh`) |

## Mục 6–7: Contract v1.3, retro, video
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| `contract_version "1.3"`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | test contract trong `tests/headless.test.ts`; 106 kịch bản P1–P3 vẫn chạy | ĐẠT |
| Retro 1–2 trang | [retro.md](../notes/retro.md) | ĐẠT |
| Video .mp4 dưới 5 phút | chưa có | **CHƯA LÀM** (chủ repo quay) |

## Định nghĩa hoàn thành (DoD)
| Mục | Kết quả |
|---|---|
| Bằng chứng game chạy đúng yêu cầu phase | các bảng trên; `docs/proof/phase4/` |
| Tag `phase-4` và Release `v1.0.0` | tag `phase-4` gắn ở commit Phase 4; Release `v1.0.0` do chủ repo tạo trên web GitHub (không có `gh` ở máy làm việc): https://github.com/tiennguyen-ctrl/K5-L3A-DAY12-NguyenTranTien-2A202603504-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0 (đính kèm zip bản web và demo.mp4) |
| `bench.json`, `soak.json` tự chạy và commit | có ở `docs/proof/phase4/` |
| Test ẩn Phase 1–3 còn hiệu lực vẫn đạt | 106 kịch bản P1–P3 + 150 test vẫn đạt; không đổi luật; **chưa có test ẩn thật để kiểm** |
| Repo public, đủ harness AI và tài liệu | AGENTS.md, skill verify-phase, tài liệu 4 phase; **chủ repo kiểm Public bằng cửa sổ ẩn danh** |

## Chưa kiểm chứng / hạn chế (trung thực)
- Số đo bench/soak lưu trong repo là của máy tôi (Windows, Chrome 157, GPU Intel do Chrome chọn). Chủ repo báo đã tự kiểm bench trên máy chấm và đạt (lời khai của chủ repo, không có log/ảnh/video đính kèm; chưa có số cụ thể trong repo, chỉ `bench.json` của máy tôi).
- `peak_mem_mb` = null (bản web).
- Các tính năng mới của Phase 4 (đổi phím, nhập tên và lưu, phụ đề, mũi tên Bóng Mực, chữ lớn, giảm chuyển động) đã được chủ repo chơi thử và báo "đạt". Đây là lời khai của chủ repo; không có video hay ảnh ván chơi đính kèm, ngoài ảnh tĩnh và test logic. Không ghi lại chi tiết từng thao tác.
- Chủ repo báo đã thử clone sạch trên máy khác và macOS/Linux, đều chạy được (lời khai của chủ repo, không có log/ảnh/video đính kèm); chưa ghi lại phiên bản hệ điều hành/Node cụ thể.
- Hướng quay camera bench và chỉ số "i" của soak là giả định (xem spec B5, S1).
- Video chưa có.
