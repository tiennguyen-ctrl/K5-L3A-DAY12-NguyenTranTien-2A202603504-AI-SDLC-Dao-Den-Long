# Đảo Đèn Lồng

> Video demo: _(sẽ bổ sung ở Phase 4, kèm Release `v1.0.0`)_

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi (đội nón lá, treo một chiếc đèn lồng nhỏ), nhặt đom đóm để thắp lại các **Đèn Lồng Lớn** qua **3 Đêm** trên 3 hòn đảo, và né **Bóng Mực** và **Gió Lạc** trong sương đen.

Bài lab Day 12 · AI SDLC (cá nhân). Đề bài và hướng dẫn của lab: [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md).

## Cài đặt và chạy (tối đa 3 lệnh)
Cần **Node.js >= 22.18** (macOS/Linux/Windows).
```bash
npm install
npm run dev        # mở đường link Vite in ra (thường http://localhost:5173)
```
Bản build tĩnh: `npm run build` (ra thư mục `dist/`). Trong game nhấn **F3** để hiện FPS (góc dưới trái).

## Điều khiển
| Phím | Việc |
|---|---|
| `W` `A` `S` `D` | đi (theo hướng camera) |
| `Space` | nhảy (chỉ khi chạm đất) |
| `Shift` | lướt 14 m/s trong 0,2 s (hồi 1,5 s) |
| `E` | nạp ánh sáng vào Đèn Lồng chưa sáng gần nhất (đang mang đom đóm) |
| `F` | tỏa sáng: xua Bóng Mực và Gió Lạc (tốn 3 đom đóm, hồi 3 s) |
| `←` `→` hoặc kéo chuột | xoay camera |
| `Esc`, `P` hoặc nút **⏸ Tạm dừng** (góc trên trái) | tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu). Game cũng tự tạm dừng khi bạn chuyển sang cửa sổ/tab khác |
| `F3` | hiện/ẩn FPS |
| `Enter` | tiếp tục ở các màn hình (bắt đầu, vào Đêm, Đêm kế, về menu) |

## Luật chơi (số chuẩn của Ticket-02)
- **3 Đêm:** Đảo Bến (300 s, 5 đèn), Đảo Cau (330 s, 6 đèn, hai đảo nối cầu tre không lan can, bục nhảy), Đảo Chuông (360 s, 7 đèn, 3 tầng, dốc, bục nhảy, tháp chuông, gió mạnh). Thắng Đêm 3 ra màn Bình Minh với tổng điểm; thua thì chơi lại đúng Đêm đó.
- Mang tối đa **10** đom đóm. Thắp một đèn cần **10** (nạp nhiều lần được, đèn nhớ tiến độ).
- **Thắng** khi mọi đèn sáng (kể cả đúng tick hết giờ). **Thua** khi hết 3 Ngọn Lửa (luôn thua trước) hoặc hết giờ.
- **Bóng Mực** đuổi khi Mây trong 12 m, bỏ đuổi khi quá 18 m. Chạm thì mất 1 Ngọn Lửa, rơi nửa số đom đóm đang mang, bất tử 1,5 s. Đèn đã sáng tạo vùng an toàn 6 m mà bóng không vào được.
- **Gió Lạc** (Đêm 2, 3) cướp 3 đom đóm của Mây khi Mây mang từ 5 đom đóm trở lên; tỏa sáng đuổi được và lấy lại đồ.
- **Bùa Gió**: chạy 7,2 m/s và lướt liên tục trong 10 s.
- **Rơi khỏi đảo** thì mất 1 Ngọn Lửa và hết đom đóm, chờ 1 s rồi hồi sinh.

## Cách tính điểm
| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp sáng 1 Đèn Lồng | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game = tổng điểm các Đêm đã thắng.

## Headless và Test Contract v1.1
Khai báo ở [game.contract.json](game.contract.json) (`tuning` là nguồn duy nhất, lõi game đọc trực tiếp từ file này).
```bash
node src/headless/main.ts --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```
`--night` nhận 1, 2, 3. 60 tick/giây cố định, không cần cửa sổ hay GPU; 21.600 tick chạy mất chưa tới 1 giây. Thoát 0 khi chạy xong hoặc game kết thúc; file inputs/scenario lỗi định dạng thì thoát 2. Đầu ra JSONL (`event`, `snapshot`, dòng `end`), tất định theo seed/scenario/inputs.

## Kiểm thử và bằng chứng
```bash
npm test                 # 89 test: kịch bản headless 3 Đêm, tất định, hiệu năng, mã thoát, contract, luồng 3 Đêm, cài đặt
npm run typecheck
npm run proof            # chạy từng kịch bản qua CLI thật, ghi docs/proof/phase2/
node scripts/bot.ts      # bot chơi Đêm 1-2 và phát lại qua CLI
```
- Spec, giả định, tiêu chí nghiệm thu Phase 2: [docs/notes/phase2-spec.md](docs/notes/phase2-spec.md) (Phase 1: [phase1-assumptions.md](docs/notes/phase1-assumptions.md))
- Bảng truy vết yêu cầu → bằng chứng: [Phase 2](docs/proof/phase2-acceptance.md), [Phase 1](docs/proof/phase1-acceptance.md)
- Nhật ký dùng AI, đánh giá, token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness cho agent: [AGENTS.md](AGENTS.md), skill [.claude/skills/verify-phase/](.claude/skills/verify-phase/SKILL.md)

## Cấu trúc
```
src/core/      luật game thuần (không DOM/three), dùng chung cho headless và web; maps.ts là 3 bản đồ chuẩn
src/headless/  CLI theo Test Contract
src/web/       Three.js: cảnh, bản đồ (world.ts), Mây (character.ts), rừng, HUD, luồng 3 Đêm, cài đặt, âm thanh
tests/         test + kịch bản (cases.ts là nguồn chung của test và proof)
scripts/       proof.ts, bot.ts
docs/          notes/ (spec, giả định, nhật ký AI), proof/ (bằng chứng theo phase)
```

## Sáng tạo của tôi
- **Rừng** quanh các đảo (`src/web/forest.ts`): vài trăm cây thông, cây tán tròn và bụi rậm bằng InstancedMesh; chừa trống quanh điểm xuất phát, đèn, bục nhảy, bùa; tự ẩn cây che giữa camera và Mây. Chỉ để trang trí, không va chạm.
- **Cột sáng** trên mỗi Đèn Lồng để nhìn thấy mục tiêu từ xa giữa rừng; đảo sáng dần lên khi thắp đèn.
- **Âm thanh tổng hợp** bằng Web Audio (không dùng file âm thanh nào): nhạc nền ngũ âm và hiệu ứng.
- **Lời Ông Đăng** giới thiệu từng Đêm, và các thông báo ngắn trong lúc chơi.
- **Bằng chứng phần cũ vẫn đúng:** các thành phần trên chỉ nằm trong `src/web/` và không import ngược vào `src/core/`; `npm test` (89 test) và `npm run proof` (67 kịch bản) vẫn đạt, output headless không bị ảnh hưởng.
