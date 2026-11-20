---
name: verify-phase
description: Kiểm chứng toàn bộ một phase của Đảo Đèn Lồng (typecheck, test, kịch bản headless, tất định, hiệu năng) và báo kết quả thật. Dùng trước khi báo "xong" hoặc trước khi gắn tag phase-N.
---

# verify-phase

Dùng khi sắp kết thúc một phase hoặc sau một thay đổi lớn ở `src/core/`. Chạy lần lượt, dừng và báo ngay nếu một bước đỏ. KHÔNG sửa test cho khớp code; nếu test sai thì nói rõ lý do.

1. `npm run typecheck` phải sạch.
2. `npm test` phải đạt hết. Ghi số test đạt/tổng.
3. `npm run proof` phải đạt hết; kết quả nằm ở `docs/proof/phase2/RESULTS.md`.
4. Tính tất định: chạy hai lần cùng `--seed 42 --night N --ticks 21600 --scenario docs/proof/phase2/perf/scenario-full-night.json` rồi `cmp` hai file output; phải giống hệt. Ghi thời gian chạy (yêu cầu <= 30 s mỗi Đêm).
5. `npm run build` phải thành công.
6. Nếu đổi luật: đọc lại `docs/notes/phaseN-spec.md` mục "Test Phase 1 bị đổi" và bổ sung dòng cho test bị sửa.
7. Báo cáo theo mẫu: yêu cầu / kiểm chứng / kết quả. Chỗ chưa kiểm chứng được (âm thanh, FPS trên GPU thật, hình ảnh chưa nhìn) ghi là "CHƯA KIỂM CHỨNG", không ghi "đạt".

Không commit, push hoặc gắn tag trừ khi chủ repo ra lệnh.
