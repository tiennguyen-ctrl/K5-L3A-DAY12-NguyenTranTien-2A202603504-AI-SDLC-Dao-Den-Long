// Lệnh chạy game (run_cmd): `npm run dev`
//   npm run dev                                     mở máy chủ phát triển Vite (bản web), bảng xếp hạng lưu ra data/leaderboard.json
//   npm run dev -- --export-leaderboard out.json    xuất bảng xếp hạng ra {"entries":[...]} rồi thoát (không mở game)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import { exportJson } from "../src/web/leaderboard.ts";
import { handleLeaderboard, leaderboardPath, readLeaderboard } from "./server-lib.ts";

const root = join(import.meta.dirname, "..");
const argv = process.argv.slice(2);
const file = leaderboardPath(root);

/** Chấp nhận --export-leaderboard out.json, -export-leaderboard out.json và --export-leaderboard=out.json */
const flag = argv.findIndex((a) => /^--?export-leaderboard(=|$)/.test(a));
if (flag >= 0) {
  const a = argv[flag];
  const out = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[flag + 1];
  if (!out) { console.error("usage: npm run dev -- --export-leaderboard <out.json>"); process.exit(2); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, exportJson(readLeaderboard(file)));
  console.log(`Đã xuất ${readLeaderboard(file).length} mục ra ${out}`);
  process.exit(0);
}

const server = await createServer({
  root: join(root, "src", "web"),
  plugins: [{
    name: "bang-xep-hang",
    configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        if (!(await handleLeaderboard(req, res, file))) next();
      });
    },
  }],
});
await server.listen();
server.printUrls();
console.log(`Bảng xếp hạng lưu ở ${file}`);
