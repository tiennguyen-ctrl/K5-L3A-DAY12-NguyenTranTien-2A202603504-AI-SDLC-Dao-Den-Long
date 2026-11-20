// Chạy bản web đã build (thư mục dist/) bằng một máy chủ nhỏ, kèm bảng xếp hạng lưu ra đĩa.
// Dùng cho bản phát hành: `node scripts/serve.ts` rồi mở http://localhost:8080  (cổng đổi bằng --port hoặc PORT)
// (Không mở file index.html trực tiếp bằng file:// vì trình duyệt chặn module JavaScript.)
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createStaticServer, leaderboardPath } from "./server-lib.ts";

const root = join(import.meta.dirname, "..");
const dir = existsSync(join(root, "dist", "index.html")) ? join(root, "dist") : join(root, "..", "dist");
if (!existsSync(join(dir, "index.html"))) { console.error("Không thấy dist/index.html. Chạy `npm run build` trước."); process.exit(1); }
const argPort = process.argv.indexOf("--port");
const port = Number(argPort >= 0 ? process.argv[argPort + 1] : process.env.PORT ?? 8080);
createStaticServer({ dir, leaderboardFile: leaderboardPath(root) }).listen(port, () => {
  console.log(`Đảo Đèn Lồng: http://localhost:${port}  (Ctrl+C để dừng)`);
  console.log(`Bảng xếp hạng lưu ở ${leaderboardPath(root)}`);
});
