# Hiệu năng và tính tất định (CLI headless thật, đủ 21.600 tick mỗi Đêm)

Scenario `scenario-full-night.json` cho Mây rất nhiều Ngọn Lửa và thời gian dài để game không kết thúc sớm: chạy đủ 21.600 tick với Bóng Mực, Gió Lạc, gió, rơi... đang hoạt động.

Máy: 12th Gen Intel(R) Core(TM) i5-12450H, 12 luồng, 16 GB RAM, Node v24.16.0, win32

Lưu ý: thời gian đo khi máy đang chạy việc khác nên có thể chậm hơn thực tế một chút.

| Đêm | tick chạy | thời gian (s) | yêu cầu | chạy lại giống hệt | sha256 (16 ký tự đầu) |
|---|---|---|---|---|---|
| 1 | 21600 | 0.51 (mã thoát 0) | <= 30 | có | 47e8a746e13653cb |
| 2 | 21600 | 0.57 (mã thoát 0) | <= 30 | có | 9ecbbbc2a19e32b0 |
| 3 | 21600 | 0.66 (mã thoát 0) | <= 30 | có | 0c7f1e534bd35a3d |
