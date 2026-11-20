# Hiệu năng và tính tất định, Phase 3 (CLI headless thật, đủ 21.600 tick mỗi Đêm)

Scenario `scenario-full-night.json` cho Mây rất nhiều Ngọn Lửa và thời gian dài để game không kết thúc sớm: chạy đủ 21.600 tick với Bóng Mực (kể cả hút dầu), Gió Lạc, gió, rơi... đang hoạt động. Sinh bằng một script tạm chạy CLI `node src/headless/main.ts` hai lần mỗi Đêm rồi so sha256 của output.

Máy: 12th Gen Intel(R) Core(TM) i5-12450H, 12 luồng, 16 GB RAM, Node v24.16.0, win32

| Đêm | tick chạy | thời gian (s) | yêu cầu | chạy lại giống hệt | sha256 (16 ký tự đầu) |
|---|---|---|---|---|---|
| 1 | 21600 | 0.39 (mã thoát 0) | <= 30 | có | 44c2961126da103d |
| 2 | 21600 | 0.46 (mã thoát 0) | <= 30 | có | ace64e3e31096897 |
| 3 | 21600 | 0.56 (mã thoát 0) | <= 30 | có | 5d6159f87e60dbae |
