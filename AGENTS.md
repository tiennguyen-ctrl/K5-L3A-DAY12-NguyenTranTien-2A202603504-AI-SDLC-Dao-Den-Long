# AGENTS.md: Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D (Three.js), 3 Đêm, lõi logic tách riêng và chạy được headless. Yêu cầu: PRD-0 (Phase 1), Ticket-02 (Phase 2), Ticket-03 (Phase 3, Contract v1.2) trên lab board. Đọc `docs/notes/phase3-spec.md` (giả định + tiêu chí) và `docs/adr/ADR-001-*` trước khi đổi luật. Luật Phase 3 THAY THẾ một số luật Phase 2 (xem `CHANGELOG.md`).

## Lệnh
- Cài: `npm install` · Chơi: `npm run dev` (nhấn F3 để xem FPS) · Build web: `npm run build`
- Test: `npm test` · Typecheck: `npm run typecheck`
- Bằng chứng: `npm run proof` (kịch bản headless -> `docs/proof/phase3/`), `node scripts/bot.ts` (bot chơi Đêm 1-2)
- Headless: `node src/headless/main.ts --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every 10]`
- Kiểm chứng cả phase một lượt: skill `.claude/skills/verify-phase/SKILL.md`

## Kiến trúc (giữ ranh giới này)
- `src/core/`: logic thuần, KHÔNG import DOM/three/fs. Mọi luật game ở đây. 60 tick/s cố định.
  - `game.ts` thứ tự 12 bước của một tick theo ticket (bước 2 trừ dầu + tắt đèn hết dầu, bước 11 thắng ở bình minh; dầu là số nguyên đơn vị 1/60); `maps.ts` 3 bản đồ chuẩn (`heightAt` là hàm chiều cao mặt đất, `-Infinity` = rơi); `validate.ts` kiểm file scenario/inputs.
- `src/headless/`: CLI theo Test Contract. `src/web/`: chỉ hiển thị + input + luồng màn hình, gọi `stepGame`.
  - `world.ts` dựng bản đồ/thực thể, `forest.ts` rừng trang trí, `flow.ts` chuỗi 3 Đêm (thuần, có test), `settings.ts` (thuần, có test), `audio.ts` (Web Audio), `palette.ts` (bảng màu chuẩn).
- `game.contract.json` là NGUỒN DUY NHẤT của `tuning` (khớp số chuẩn của ticket); `src/core/constants.ts` đọc từ đó. Hằng số ngoài contract nằm ở `WORLD`.
- Node >= 22.18 chạy thẳng `.ts`: chỉ dùng cú pháp "erasable" (không enum, không parameter property `constructor(private x)`), import có đuôi `.ts`, dùng `import type`.

## Quy tắc
- Không phá Test Contract: tên sự kiện, định dạng JSONL, mã thoát (lỗi file = 2), tính tất định theo seed.
- Mọi thứ thêm vào (sáng tạo, rừng, nhân vật) phải chỉ ở `src/web/` hoặc tắt khi headless; `npm test` + `npm run proof` phải giữ nguyên đầu ra headless.
- Đổi luật => thêm/sửa kịch bản trong `tests/cases.ts` TRƯỚC, rồi `npm test` và `npm run proof`. Test cũ bị luật mới làm sai thì sửa kèm lý do ghi ở `docs/notes/phaseN-spec.md`, không tắt âm thầm.
- **Trong test, số kỳ vọng phải là số ghi cứng lấy từ ticket (hoặc từ `T` đã được test contract khoá), KHÔNG lấy từ `WORLD.*`.** Lý do: lần kiểm thử "đột biến" ở Phase 2 cho thấy test dùng chính hằng số bị phá ở cả hai vế sẽ không bao giờ đỏ.
- Bằng chứng phải sinh bằng lệnh thật, không sửa tay output. `docs/proof/phase1/` và `docs/proof/phase2/` đã đóng băng theo tag, không ghi đè (script proof/bot chỉ ghi `phase3/`).
- Không tự commit/push/pull khi chưa được chủ repo ra lệnh; commit chỉ ghi chủ repo là author, không co-author.
- Không commit `.env`, khóa API.
