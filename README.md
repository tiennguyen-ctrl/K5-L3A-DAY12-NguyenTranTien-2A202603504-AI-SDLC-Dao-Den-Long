# Đảo Đèn Lồng

> Video demo: _(sẽ bổ sung ở Phase 4, kèm Release `v1.0.0`)_

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi (đội nón lá, treo một chiếc đèn lồng nhỏ), nhặt đom đóm để thắp lại **5 Đèn Lồng Lớn** trên đảo trong một đêm, và né **Bóng Mực** trong sương đen.

Bài lab Day 12 · AI SDLC (cá nhân). Đề bài và hướng dẫn của lab: [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md).

## Cài đặt và chạy (tối đa 3 lệnh)
Cần **Node.js >= 22.18** (macOS/Linux/Windows).
```bash
npm install
npm run dev        # mở đường link Vite in ra (thường http://localhost:5173)
```
Bản build tĩnh: `npm run build` (ra thư mục `dist/`).

## Điều khiển
| Phím | Việc |
|---|---|
| `W` `A` `S` `D` | đi (theo hướng camera) |
| `Space` | nhảy |
| `E` | nạp ánh sáng vào Đèn Lồng gần nhất (đang mang đom đóm) |
| `F` hoặc `Shift` | tỏa sáng: xua Bóng Mực (tốn 1 đom đóm, hồi chiêu 2 s) |
| `←` `→` hoặc kéo chuột | xoay camera |
| `Enter` | bắt đầu / chơi lại |

## Luật chơi
- Nhặt đom đóm (mang tối đa 5), mang tới đèn, bấm `E`. Đủ 5 đom đóm thì đèn sáng.
- **Thắng** khi cả 5 đèn sáng. **Thua** khi hết 3 ngọn lửa (máu) hoặc hết 5 phút (trời sáng).
- Bóng Mực đuổi theo Mây; chạm vào thì mất 1 ngọn lửa, rơi một nửa số đom đóm đang mang và được bất tử 1,5 s.
- Bóng Mực sợ đèn: không vào được trong 4 m quanh đèn. Đứng gần đèn là an toàn.
- Đảo sáng dần lên khi thắp thêm đèn.

## Cách tính điểm
| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp sáng 1 Đèn Lồng | +100 |
| Mỗi Bóng Mực bị tỏa sáng làm choáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Headless và Test Contract v1.0
Khai báo ở [game.contract.json](game.contract.json) (`tuning` là nguồn duy nhất, lõi game đọc trực tiếp từ file này).
```bash
node src/headless/main.ts --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```
60 tick/giây cố định, không cần cửa sổ hay GPU. Thoát 0 khi chạy xong hoặc game kết thúc; file inputs/scenario lỗi định dạng thì thoát 2. Đầu ra là JSONL (`snapshot`, `event`, dòng `end`), tất định theo seed/scenario/inputs.

**Khái niệm không có trong game:** `fall_enabled=false`. Mây bị chặn ở mép đảo, không rơi và không có sự kiện `player_hit` kiểu `fall`. Không có `dash`.

## Kiểm thử và bằng chứng
```bash
npm test                 # 26 test: kịch bản headless, tất định, mã thoát, contract
npm run typecheck
npm run proof            # chạy từng kịch bản qua CLI thật, ghi docs/proof/phase1/
node scripts/bot.ts      # bot chơi hết Đêm 1 (thắng), phát lại qua CLI
```
- Giả định và con số đã chọn: [docs/notes/phase1-assumptions.md](docs/notes/phase1-assumptions.md)
- Bảng truy vết yêu cầu → bằng chứng: [docs/proof/phase1-acceptance.md](docs/proof/phase1-acceptance.md)
- Nhật ký dùng AI, đánh giá: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness cho agent: [AGENTS.md](AGENTS.md)

## Cấu trúc
```
src/core/      luật game thuần (không DOM/three), dùng chung cho headless và web
src/headless/  CLI theo Test Contract
src/web/       Three.js: cảnh, nhân vật Mây (character.ts), HUD
tests/         test + kịch bản (cases.ts là nguồn chung của test và proof)
scripts/       proof.ts, bot.ts
docs/          notes/ (giả định, nhật ký AI), proof/ (bằng chứng)
```

## Sáng tạo của tôi
- **Rừng nguyên sinh** quanh đảo (`src/web/forest.ts`): vài trăm cây thông, cây tán tròn và bụi rậm, dựng bằng InstancedMesh. Chỉ để trang trí, không va chạm, chừa trống quanh chỗ xuất phát và quanh các Đèn Lồng.
- **Cột sáng** trên mỗi Đèn Lồng để nhìn thấy mục tiêu từ xa giữa rừng; đảo sáng dần lên khi thắp đèn.
- **Bằng chứng phần cũ vẫn đúng:** các thành phần trên chỉ nằm trong `src/web/` và không import ngược vào `src/core/`; `npm test` (26 test) và `npm run proof` vẫn đạt, output headless không đổi (ảnh: `docs/proof/phase1/screenshots/gameplay.png`).
