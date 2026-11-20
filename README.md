# Đảo Đèn Lồng

> Video demo: _(sẽ bổ sung ở Phase 4, kèm Release `v1.0.0`)_

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi (đội nón lá, treo một chiếc đèn lồng nhỏ), nhặt đom đóm để thắp lại các **Đèn Lồng Lớn** qua **3 Đêm** trên 3 hòn đảo, **giữ cho đủ đèn sáng tới bình minh** (đèn cạn dầu thì tắt, phải châm thêm), và né **Bóng Mực** (loài hút dầu của đèn yếu) và **Gió Lạc** trong sương đen.

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
| `E` | nạp ánh sáng / châm dầu cho Đèn Lồng gần nhất chưa sáng hoặc chưa đầy dầu (đang mang đom đóm) |
| `F` | tỏa sáng: xua Bóng Mực và Gió Lạc (tốn 3 đom đóm, hồi 3 s) |
| `←` `→` hoặc kéo chuột | xoay camera |
| `Esc`, `P` hoặc nút **⏸ Tạm dừng** (góc trên trái) | tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu). Game cũng tự tạm dừng khi bạn chuyển sang cửa sổ/tab khác |
| `F3` | hiện/ẩn FPS |
| `Enter` | tiếp tục ở các màn hình (bắt đầu, vào Đêm, Đêm kế, về menu) |

## Luật chơi (số chuẩn của Ticket-03, thay thế một số luật Ticket-02)
- **3 Đêm:** Đảo Bến (240 s, 5 đèn), Đảo Cau (270 s, 6 đèn, hai đảo nối cầu tre không lan can, bục nhảy), Đảo Chuông (300 s, 7 đèn, 3 tầng, dốc, bục nhảy, tháp chuông, gió mạnh). Thắng Đêm 3 ra màn Bình Minh với tổng điểm; thua thì chơi lại đúng Đêm đó.
- **Nhiên liệu đèn:** đèn mới thắp có 100 dầu, hao 1/giây. Mỗi đom đóm châm vào đèn đang sáng cộng 10 dầu (tối đa 100). Hết dầu thì đèn **tắt**; thắp lại chỉ cần **5** đom đóm (đèn chưa từng sáng vẫn cần 10).
- Sức chứa đom đóm = 10 + 2 × số lần thắp thành công trong Đêm, tối đa 20.
- **Thắng** khi còn sống lúc hết giờ (bình minh) và số đèn đang sáng ≥ 60% tổng (3/5, 4/6, 5/7). Thắp đủ đèn **không** kết thúc Đêm. **Thua** khi hết 3 Ngọn Lửa (luôn thua trước) hoặc hết giờ mà đèn sáng dưới ngưỡng.
- **Bóng Mực** đuổi khi Mây trong 12 m, bỏ đuổi khi quá 18 m. Chạm thì mất 1 Ngọn Lửa, rơi nửa số đom đóm đang mang, bất tử 1,5 s. Đèn còn từ 30 dầu trở lên tạo vùng an toàn 6 m; đèn yếu (< 30 dầu) mất vùng này và bị Bóng Mực lượn tới, đứng lại hút 5 dầu/giây cho đến khi bị Tỏa Sáng đẩy lui hoặc Mây châm dầu.
- **Gió Lạc** (Đêm 2, 3) cướp 3 đom đóm của Mây khi Mây mang từ 5 đom đóm trở lên; tỏa sáng đuổi được và lấy lại đồ.
- **Bùa Gió**: chạy 7,2 m/s và lướt liên tục trong 10 s.
- **Rơi khỏi đảo** thì mất 1 Ngọn Lửa và hết đom đóm, chờ 1 s rồi hồi sinh.

## Cách tính điểm
| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu) | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần) | +5 (+15 nếu nó đang hút dầu) |
| Bình minh, khi thắng: mỗi đèn đang sáng | +50 + dầu còn lại (làm tròn xuống) |
| Bình minh, khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Không còn thưởng thời gian.

Tổng điểm game = tổng điểm các Đêm đã thắng.

## Headless và Test Contract v1.2
Khai báo ở [game.contract.json](game.contract.json) (`tuning` là nguồn duy nhất, lõi game đọc trực tiếp từ file này).
```bash
node src/headless/main.ts --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```
`--night` nhận 1, 2, 3. 60 tick/giây cố định, không cần cửa sổ hay GPU; 21.600 tick chạy mất chưa tới 1 giây. Thoát 0 khi chạy xong hoặc game kết thúc; file inputs/scenario lỗi định dạng thì thoát 2. Đầu ra JSONL (`event`, `snapshot`, dòng `end`), tất định theo seed/scenario/inputs.

## Kiểm thử và bằng chứng
```bash
npm test                 # 132 test: kịch bản headless 3 Đêm, tất định, hiệu năng, mã thoát, contract, luồng 3 Đêm, cài đặt
npm run typecheck
npm run proof            # chạy từng kịch bản qua CLI thật, ghi docs/proof/phase3/
node scripts/bot.ts      # bot chơi Đêm 1-2 và phát lại qua CLI (ghi docs/proof/phase3/bot/)
```
- Spec, giả định, tiêu chí nghiệm thu Phase 3: [docs/notes/phase3-spec.md](docs/notes/phase3-spec.md) (Phase 2: [phase2-spec.md](docs/notes/phase2-spec.md), Phase 1: [phase1-assumptions.md](docs/notes/phase1-assumptions.md))
- Quyết định thiết kế: [ADR-001](docs/adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md) · Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md)
- Bảng truy vết yêu cầu → bằng chứng: [Phase 3](docs/proof/phase3-acceptance.md), [Phase 2](docs/proof/phase2-acceptance.md), [Phase 1](docs/proof/phase1-acceptance.md)
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
- **Chọn Đêm ở menu**: ba nút Đêm 1/2/3 để chơi thẳng một Đêm (tổng điểm tính từ 0).
- **Chế độ "Bảng màu dễ phân biệt"** (Cài đặt, được lưu): Bóng Mực viền/mắt xanh #00B3FF, cảnh báo màu trắng kèm ⚠; đèn tắt xẹp và rách giấy, đèn sắp hết dầu nhấp nháy, thanh dầu trên mỗi đèn, sợi hút dầu của Bóng Mực.
- **Cột sáng** trên mỗi Đèn Lồng để nhìn thấy mục tiêu từ xa giữa rừng; đảo sáng dần lên khi thắp đèn.
- **Âm thanh tổng hợp** bằng Web Audio (không dùng file âm thanh nào): nhạc nền ngũ âm và hiệu ứng.
- **Lời Ông Đăng** giới thiệu từng Đêm, và các thông báo ngắn trong lúc chơi.
- **Bằng chứng phần cũ vẫn đúng:** các thành phần trên chỉ nằm trong `src/web/` và không import ngược vào `src/core/`; `npm test` (132 test) và `npm run proof` (106 kịch bản) vẫn đạt, output headless không bị ảnh hưởng.
