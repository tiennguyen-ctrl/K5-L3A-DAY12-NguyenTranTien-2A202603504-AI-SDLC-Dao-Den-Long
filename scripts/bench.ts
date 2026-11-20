// Chế độ benchmark (bench_cmd, Ticket-04): node scripts/bench.ts --seed 42 --duration 30 --out bench.json
// Dựng bản build web (nếu chưa có hoặc cũ), mở trình duyệt Chrome/Edge/Chromium với cảnh benchmark chuẩn
// (Đêm 1, 200 Bóng Mực wander, 100 đom đóm, 3 đèn sáng, camera bay vòng 15 s/vòng, canvas 1280×720), 3 s khởi động
// rồi đo --duration giây, ghi bench.json và thoát mã 0. Thêm --headless để chạy không cửa sổ (dùng giả lập GPU, chậm).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { arch, cpus, release, tmpdir, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { BENCH_WARMUP_S } from "../src/web/bench.ts";
import { createStaticServer, leaderboardPath } from "./server-lib.ts";

const t0 = Date.now(); // "tiến trình bắt đầu" để tính load_ms
const root = join(import.meta.dirname, "..");

function parseArgs(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const body = argv[i].replace(/^--?/, "");
    const eq = body.indexOf("=");
    if (eq >= 0) m.set(body.slice(0, eq), body.slice(eq + 1));
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) m.set(body, argv[++i]);
    else m.set(body, "true");
  }
  return m;
}
const args = parseArgs(process.argv.slice(2));
const seed = Number(args.get("seed") ?? 42);
const duration = Number(args.get("duration") ?? 30);
const out = args.get("out") ?? "bench.json";
const headless = args.has("headless");
if (!Number.isFinite(seed) || !Number.isFinite(duration) || duration <= 0) {
  console.error("usage: node scripts/bench.ts --seed 42 --duration 30 --out bench.json [--headless] [--rebuild]");
  process.exit(2);
}

// ---- bản build web ----
const dist = join(root, "dist");
const newest = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((m, d) => Math.max(m, d.isDirectory() ? newest(join(dir, d.name)) : statSync(join(dir, d.name)).mtimeMs), 0);
const stale = !existsSync(join(dist, "index.html")) || newest(join(root, "src")) > statSync(join(dist, "index.html")).mtimeMs;
if (stale || args.has("rebuild")) {
  console.log("Đang build bản web (vite build)…");
  const r = spawnSync(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "src/web", "--outDir", "../../dist", "--emptyOutDir"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error("Build thất bại"); process.exit(1); }
}

// ---- tìm trình duyệt ----
function findBrowser(): string | null {
  const env = process.env.CHROME_PATH;
  const c = [
    env,
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  ];
  return c.find((p) => p && existsSync(p)) ?? null;
}
const browser = findBrowser();
if (!browser) { console.error("Không tìm thấy Chrome/Edge/Chromium. Đặt biến môi trường CHROME_PATH tới file chạy của trình duyệt."); process.exit(3); }

// ---- máy chủ + mở trình duyệt ----
let resolveResult: (d: Record<string, unknown>) => void = () => {};
const resultPromise = new Promise<Record<string, unknown>>((res) => (resolveResult = res));
const server: Server = createStaticServer({ dir: dist, leaderboardFile: leaderboardPath(root), onBenchResult: (d) => resolveResult(d) });
await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
const port = (server.address() as { port: number }).port;
const profile = mkdtempSync(join(tmpdir(), "ddl-bench-"));
const url = `http://127.0.0.1:${port}/index.html?bench=1&seed=${seed}&duration=${duration}&t0=${t0}&vsync=off${process.env.DDL_BENCH_QUERY ?? ""}`; // DDL_BENCH_QUERY chỉ để chẩn đoán
const flags = [
  `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-popup-blocking",
  "--window-size=1280,820", "--window-position=0,0",
  // tắt vsync của GPU để đo sức mạnh dựng hình thật
  ...(process.env.DDL_BENCH_FLAGS ? process.env.DDL_BENCH_FLAGS.split(" ").filter(Boolean) : ["--disable-gpu-vsync"]), // DDL_BENCH_FLAGS chỉ để chẩn đoán. Không dùng --disable-frame-rate-limit: trên máy thử nó làm nhịp khung hình giật (p1_low ~10 fps)
  "--ignore-gpu-blocklist", "--enable-gpu-rasterization",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
  ...(headless ? ["--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []),
  `--app=${url}`,
];
console.log(`Mở ${browser}\n  cảnh bench: seed ${seed}, khởi động ${BENCH_WARMUP_S} s, đo ${duration} s (không chạm chuột/bàn phím trong lúc đo)`);
const child = spawn(browser, flags, { stdio: "ignore" });
child.on("error", (e) => { console.error(`Không mở được trình duyệt: ${e.message}`); process.exit(3); });

function rssMb(tag: string): number | null {
  try {
    if (process.platform === "win32") {
      const ps = `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${tag}*' } | Measure-Object WorkingSetSize -Sum).Sum`;
      const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
      const n = Number(r.stdout.trim());
      return Number.isFinite(n) && n > 0 ? Math.round(n / 1048576) : null;
    }
    const r = spawnSync("ps", ["-eo", "rss,args"], { encoding: "utf8" });
    const kb = r.stdout.split("\n").filter((l) => l.includes(tag)).reduce((s, l) => s + (Number(l.trim().split(/\s+/)[0]) || 0), 0);
    return kb > 0 ? Math.round(kb / 1024) : null;
  } catch { return null; }
}
function kill(): void {
  try {
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch { /* đã thoát */ }
}

const timeout = setTimeout(() => { console.error("Quá thời gian chờ kết quả benchmark."); kill(); process.exit(1); }, (duration + BENCH_WARMUP_S + 90) * 1000);
const data = await resultPromise;
clearTimeout(timeout);
const memAfter = rssMb(profile.split(/[\\/]/).pop()!); // RSS toàn bộ tiến trình trình duyệt ngay sau khoảng đo
kill();
server.close();
const c = cpus();
const result = {
  ...data,
  os: `${process.platform} ${release()} (${arch()}), ${c[0]?.model.trim()} ×${c.length} luồng, ${Math.round(totalmem() / 2 ** 30)} GB RAM, Node ${process.version}`,
  // Bản web: không đo được RSS đỉnh trong lúc đo (không chèn việc đo vào khoảng đo để khỏi làm sai FPS); ghi null và đo một lần ngay sau đó.
  peak_mem_mb: null as number | null,
  peak_mem_note: "Bản web: RSS của trình duyệt không đọc được từ trang trong lúc đo nên peak_mem_mb = null; mem_after_run_mb là RSS tổng các tiến trình trình duyệt ngay sau khoảng đo.",
  mem_after_run_mb: memAfter,
  headless,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
try { rmSync(profile, { recursive: true, force: true }); } catch { /* tiến trình còn giữ file: bỏ qua */ }
process.exit(0);
