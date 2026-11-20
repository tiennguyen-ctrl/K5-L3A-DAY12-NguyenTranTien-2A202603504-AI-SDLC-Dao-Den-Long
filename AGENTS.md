# AGENTS.md: Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D (Three.js) với lõi logic tách riêng, chạy được headless. Yêu cầu gốc: PRD-0 + Test Contract v1.0 trên lab board. Đọc `docs/notes/phase1-assumptions.md` trước khi đổi luật.

## Lệnh
- Cài: `npm install` · Chơi: `npm run dev` · Build web: `npm run build`
- Test: `npm test` · Typecheck: `npm run typecheck`
- Bằng chứng: `npm run proof` (kịch bản headless), `node scripts/bot.ts` (bot thắng Đêm 1)
- Headless: `node src/headless/main.ts --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Kiến trúc (giữ ranh giới này)
- `src/core/`: logic thuần, KHÔNG import DOM/three/fs. Mọi luật game ở đây. 60 tick/s cố định.
- `src/headless/`: CLI theo Test Contract. `src/web/`: chỉ hiển thị + input, gọi `stepGame`.
- `game.contract.json` là NGUỒN DUY NHẤT của `tuning`; `src/core/constants.ts` đọc từ đó. Đổi số = sửa file này.
- Node >= 22.18 chạy thẳng `.ts`: chỉ dùng cú pháp "erasable" (không enum, không parameter property), import có đuôi `.ts`, dùng `import type`.

## Quy tắc
- Không phá Test Contract: tên sự kiện, định dạng JSONL, mã thoát (lỗi file = 2), tất định theo seed.
- Mọi thứ thêm vào (sáng tạo) phải tắt/không ảnh hưởng khi headless.
- Đổi luật => thêm/sửa kịch bản trong `tests/cases.ts` TRƯỚC, chạy `npm test` và `npm run proof`. Không sửa test cho khớp code mà không ghi lý do.
- Bằng chứng phải sinh bằng lệnh thật, không sửa tay output.
- Không tự commit/push/pull khi chưa được chủ repo ra lệnh; commit chỉ ghi chủ repo là author.
- Không commit `.env`, khóa API.
