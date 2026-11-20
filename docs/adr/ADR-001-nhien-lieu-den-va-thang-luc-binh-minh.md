# ADR-001: Mô hình nhiên liệu đèn và luật "giữ đảo sáng tới bình minh"

- Trạng thái: chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- Ngày: 2026-11-20
- Người quyết định: chủ repo (Nguyen Tran Tien), có AI hỗ trợ viết và kiểm chứng

## Bối cảnh
Ở Phase 1–2, đèn chỉ có hai trạng thái: chưa sáng (có tiến độ `deposited`) rồi sáng mãi; thắp đủ đèn là thắng ngay (`all_lit`). Playtest của ticket cho thấy người giỏi thắp hết trong 2 phút rồi game hết, thiếu căng thẳng cuối Đêm. Ticket-03 yêu cầu đèn thắp rồi vẫn có thể tắt và mục tiêu chuyển sang giữ đảo sáng tới bình minh.

## Quyết định
1. **Mô hình trạng thái đèn** đổi từ `{lit, deposited}` sang `{lit, deposited, fuel, ever_lit, relit_count}`:
   - `unlit(deposited 0..cost)` → thắp (đủ `cost`: 10 lần đầu, 5 nếu `ever_lit`) → `lit(fuel=100)`;
   - `lit` hao 1 fuel/s, bị Bóng Mực `drain` hút thêm 5/s mỗi con; nhận châm dầu +10/đom đóm khi tương tác;
   - `fuel <= 0` → `unlit`, `deposited = 0`, `ever_lit` giữ, phát `lantern_out`. Vòng đời có thể lặp lại nhiều lần trong một Đêm.
2. **Dầu lưu dạng số nguyên theo đơn vị 1/60** (6000 = 100): hao đúng 1 đơn vị mỗi tick, không có sai số số thực tích lũy; chỉ làm tròn 1 chữ số thập phân khi ghi snapshot/sự kiện.
3. **Vùng an toàn gắn với dầu**: chỉ đèn `fuel >= 30` có vùng (đúng 30 còn). Đèn yếu (`< 30`) là mồi của Bóng Mực `wander`, vì vậy thêm trạng thái `drain` thay vì cho bóng gây sát thương trực tiếp lên đèn.
4. **Luật thắng đổi sang điều kiện tại tick bình minh**: thắng = còn Ngọn Lửa và số đèn sáng ≥ `ceil(0,6 × tổng)`; thắp đủ đèn không kết thúc Đêm. Xét thắng/thua ở cuối tick, hết Ngọn Lửa luôn thắng thế (`no_flames` trước `dawn_survived`). Thời lượng Đêm rút còn 240/270/300 s để nhịp "giữ đèn" không kéo quá dài.
5. **Điểm thưởng theo trạng thái cuối Đêm** (mỗi đèn sáng 50 + floor(fuel), mỗi Ngọn Lửa 50) thay thế thưởng thời gian, vì thời gian không còn là thước đo; điểm theo từng đom đóm giảm còn 5 để châm dầu nhiều lần không áp đảo.
6. **Sức chứa tăng dần** (10 + 2 × lần thắp thành công, tối đa 20) để thưởng cho người chủ động thắp/thắp lại và để có đủ đom đóm châm nhiều đèn.
7. **Chế độ mù màu** chỉ ảnh hưởng lớp hiển thị (`src/web`): không thay đổi đầu ra headless.

## Lựa chọn đã cân nhắc
- *Giữ `deposited` làm nguồn sự thật cho đèn sáng* (đèn sáng = `deposited >= cost`) và chỉ thêm `fuel`: bị loại vì khi đèn tắt phải đặt lại `deposited` và logic thắp lại 5/10 bị rối; dùng cờ `lit` rõ ràng hơn.
- *Dầu dạng số thực (giây)*: bị loại vì ticket cảnh báo sai số; số nguyên 1/60 chính xác và dễ kiểm bằng test cứng (100 → 90.0 sau 600 tick).
- *Cho Bóng Mực phá đèn thẳng tay khi tới gần*: bị loại vì ticket mô tả hút dầu liên tục và có cách chống (Tỏa Sáng, châm dầu, Mây lại gần).
- *Xóa `all_lit` khỏi code*: bỏ hoàn toàn nhánh thắng sớm, không để cờ ẩn, vì ticket nói `all_lit` không còn dùng.

## Hệ quả
- Phá vỡ tương thích với Contract v1.1 (xem [CHANGELOG.md](../../CHANGELOG.md)): các test Phase 1–2 nói về "đèn sáng không nhận thêm" và "thắng khi sáng đủ" phải sửa kèm lý do ([phase3-spec.md](../notes/phase3-spec.md) mục 4).
- Gần như mọi đèn sáng đều "nhận được" lúc tương tác (vì đã hao ít nhất 1 tick); nhánh "đèn đầy dầu không được chọn" vẫn được cài đặt theo ticket nhưng thực tế hiếm xảy ra.
- `wander` giờ có mục tiêu (đèn yếu / đèn tắt) nên hành vi bóng khi chưa phát hiện Mây khác Phase 2 (lượn ngẫu nhiên). Đây là giả định A5, có thể lệch với test ẩn.
- Kiểm chứng: 39 kịch bản mới + 8 kịch bản cũ được sửa; kiểm thử đột biến 22 phép phá luật Phase 3 đều làm test đỏ (sau khi bổ sung 2 kịch bản biên).
