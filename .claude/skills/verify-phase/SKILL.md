---
name: verify-phase
description: Kiểm chứng toàn bộ một phase của Đảo Đèn Lồng (typecheck, test, kịch bản headless, tất định, hiệu năng) và báo kết quả thật. Dùng trước khi báo "xong" hoặc trước khi gắn tag phase-N.
---

# verify-phase

Dùng khi sắp kết thúc một phase hoặc sau một thay đổi lớn ở `src/core/`. Chạy lần lượt, dừng và báo ngay nếu một bước đỏ. KHÔNG sửa test cho khớp code; nếu test sai thì nói rõ lý do.

1. `npm run typecheck` phải sạch.
2. `npm test` phải đạt hết. Ghi số test đạt/tổng.
3. `npm run proof` phải đạt hết; kết quả nằm ở `docs/proof/phase3/RESULTS.md`.
4. Tính tất định: chạy hai lần cùng `--seed 42 --night N --ticks 21600 --scenario docs/proof/phase3/perf/scenario-full-night.json` rồi `cmp` hai file output; phải giống hệt. Ghi thời gian chạy (yêu cầu <= 30 s mỗi Đêm).
5. `npm run build` phải thành công.
5b. (Phase 4) `node scripts/soak.ts --seed 7 --nights 10 --out docs/proof/phase4/soak.json` (crashes = 0, mem_end ≤ 1,2 × mem_start) và `node scripts/bench.ts --seed 42 --duration 30 --out docs/proof/phase4/bench.json` (mở Chrome thật, đừng chạm chuột/bàn phím lúc đo; ngưỡng avg ≥ 60, p1_low ≥ 30, load ≤ 10000 ms là trên MÁY CHẤM, số đo trên máy mình chỉ để tham khảo).
6. Nếu đổi luật: đọc lại `docs/notes/phaseN-spec.md` mục "Test Phase 1 bị đổi" và bổ sung dòng cho test bị sửa.
7. Báo cáo theo mẫu: yêu cầu / kiểm chứng / kết quả. Chỗ chưa kiểm chứng được (âm thanh, FPS trên GPU thật, hình ảnh chưa nhìn) ghi là "CHƯA KIỂM CHỨNG", không ghi "đạt".

Không commit, push hoặc gắn tag trừ khi chủ repo ra lệnh.
