# Changelog

## Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### Thay đổi phá vỡ tương thích (breaking changes)
Mỗi dòng ghi: cái cũ → cái mới, và cách phát hiện (test nào đổi). Chi tiết giả định: [docs/notes/phase3-spec.md](docs/notes/phase3-spec.md); quyết định thiết kế: [ADR-001](docs/adr/ADR-001-nhien-lieu-den-va-thang-luc-binh-minh.md).

1. **Đèn đã sáng nhận thêm đom đóm.** Cũ: đèn sáng không nhận thêm, tương tác bỏ qua nó. Mới: đèn sáng chưa đầy dầu là đèn "nhận được": tương tác châm dầu (`refuel`), không phát `deposit`.
2. **Đèn có thể tắt.** Cũ: sáng mãi. Mới: `fuel` hao 1/s, hết dầu phát `lantern_out`, `deposited = 0`, đèn tắt (nhớ `ever_lit`). Thắp lại chỉ cần 5 đom đóm; thắp lần đầu vẫn 10.
3. **Luật thắng.** Cũ: thắp đủ đèn là thắng ngay, `reason: "all_lit"`. Mới: thắng khi còn sống tới hết giờ và đủ `ceil(0,6 × tổng)` đèn sáng, `reason: "dawn_survived"`; thua `dawn` khi dưới ngưỡng, `no_flames` luôn trước. `all_lit` không còn dùng; thắp đủ đèn không kết thúc Đêm.
4. **Thời gian Đêm.** Cũ 300/330/360 s → mới **240/270/300 s** (`tuning.night{1,2,3}_duration_s`).
5. **Vùng an toàn.** Cũ: mọi đèn sáng, bóng không bao giờ vào. Mới: chỉ đèn sáng có `fuel >= 30`.
6. **Bóng Mực.** Thêm trạng thái `drain` (hút 5 fuel/s). `wander` giờ đi tới đèn yếu / đèn tắt thay vì lượn ngẫu nhiên. Hết choáng luôn về `wander` (cũ: `chase` nếu Mây trong 18 m).
7. **Điểm.** Cũ: 10/đom đóm, 100/đèn, 5/bóng, +2/giây còn lại, +50/Ngọn Lửa khi thắng. Mới: 5/đom đóm (thắp, thắp lại, châm), 100 thắp đầu, 40 thắp lại, 5 (15 nếu đang drain) mỗi bóng trúng Tỏa Sáng, bình minh thắng: +50 + floor(fuel) mỗi đèn sáng, +50 mỗi Ngọn Lửa. **Bỏ thưởng thời gian.** Khóa `tuning.score` đổi: bỏ `per_second_left`, thêm `per_relight`, `per_stun_drain`, `per_lit_lantern_dawn`.
8. **Sức chứa.** Cũ: cố định 10. Mới: 10 + 2 × `successful_lights`, tối đa 20, đặt lại 0 mỗi Đêm.
9. **Contract.** `contract_version: "1.2"`; `tuning` thêm `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`.
10. **Snapshot.** Mỗi đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`; bóng có thể ở trạng thái `drain` và có `target_lantern_id`.
11. **Scenario.** Đèn thêm `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`; `lit:true` không `fuel` → 100. `fuel` ngoài 0..100 → exit 2.
12. **Sự kiện.** Mới: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick khi hút); `lantern_lit` thêm `relight`; `game_over.reason` thêm `dawn_survived`.
13. **Cài đặt.** Thêm "Bảng màu dễ phân biệt" (lưu trong localStorage; `Settings.colorblind`).

### Thêm mới (không phá vỡ)
- Menu có nút chọn Đêm 1/2/3 (chỉ ở `src/web`, không đổi luật hay đầu ra headless).
- Giao diện: thanh dầu trên đèn, đèn tắt xẹp 20% + vết rách giấy, nhấp nháy 1 Hz khi `fuel < 30`, sợi hút dầu từ Bóng đang `drain`, HUD "mang/sức chứa" và "Đèn k/n (cần m)", cảnh báo đèn sắp hết dầu.
- `docs/adr/ADR-001-...`, `docs/notes/phase3-spec.md`, bằng chứng `docs/proof/phase3/`.

### Test đã sửa vì luật bị thay thế
`deposit_lit`, `deposit_resume`, `deposit_skips_lit`, `win_all_lit`, `win_at_dawn_tick`, `win_night2_last_lantern`, `win_night3_tier2_lantern`, `pause_resume`, test bản đồ chuẩn, test contract, test cài đặt web. Không test nào bị xóa hay `skip`. Lý do từng test: [phase3-spec.md](docs/notes/phase3-spec.md) mục 4.

## Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)
3 Đêm, Gió Lạc, Bùa Gió, lướt, rơi khỏi đảo, tạm dừng, cài đặt, âm thanh. Tag `phase-2`.

## Phase 1 — PRD-0 (Contract v1.0)
Một Đêm, lõi headless, web 3D. Tag `phase-1`.
