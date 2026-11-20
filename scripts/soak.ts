// Soak test (Ticket-04): chạy headless N Đêm liên tiếp trong CÙNG MỘT tiến trình (Đêm 1 → 2 → 3 xoay vòng).
// Lệnh: node scripts/soak.ts --seed 7 --nights 10 --out soak.json   (cũng nhận -seed, --seed=7)
// Đêm thứ i (i = 1..N) dùng seed = seed + i. Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng đi;
// mỗi tick xác suất 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác. Mỗi Đêm chạy tới khi game kết thúc
// hoặc hết thời lượng chuẩn của Đêm đó (số tick = thời lượng × 60).
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import v8 from "node:v8";
import vm from "node:vm";
import { TICKS_PER_SECOND } from "../src/core/constants.ts";
import { createGame, idleInput, stepGame } from "../src/core/game.ts";
import { makeRng } from "../src/core/rng.ts";

function parseArgs(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const body = argv[i].replace(/^--?/, "");
    const eq = body.indexOf("=");
    if (eq >= 0) m.set(body.slice(0, eq), body.slice(eq + 1));
    else m.set(body, argv[++i] ?? "");
  }
  return m;
}

const args = parseArgs(process.argv.slice(2));
const seed = Number(args.get("seed"));
const nights = Number(args.get("nights"));
const out = args.get("out");
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !out) {
  console.error("usage: node scripts/soak.ts --seed <int> --nights <int >= 1> --out soak.json");
  process.exit(2);
}

// Ép GC trước mỗi lần đo RSS để số đo phản ánh rò rỉ thật, không phải rác chưa dọn.
v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc") as () => void;
const rssMb = () => {
  gc();
  return Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
};

function playNight(night: 1 | 2 | 3, nightSeed: number, maxTicks = Infinity): "won" | "lost" {
  const g = createGame(nightSeed, undefined, night);
  const rng = makeRng(nightSeed ^ 0x9e3779b9); // luồng ngẫu nhiên riêng cho input, tất định theo seed
  const inp = idleInput();
  const limit = Math.min(maxTicks, Math.round(g.night.durationS * TICKS_PER_SECOND));
  for (let k = 0; k < limit && g.state === "playing"; k++) {
    if (k % 30 === 0) {
      const a = rng() * 2 * Math.PI;
      inp.move = [Math.cos(a), Math.sin(a)];
      inp.yaw = rng() * 360;
    }
    inp.jump = rng() < 0.05;
    inp.dash = rng() < 0.03;
    inp.pulse = rng() < 0.02;
    inp.interact = rng() < 0.1;
    stepGame(g, inp);
  }
  return g.state === "won" ? "won" : "lost";
}

// mem_start: sau khi Đêm đầu tiên đã tải xong VÀ chạy ổn định (1200 tick khởi động, không tính vào kết quả).
// Lý do: ngay sau khi nạp mã, RSS chưa gồm mã đã biên dịch JIT và vùng nhớ V8 mở rộng lúc đầu (chi phí một lần,
// không phải rò rỉ). mem_baseline_mb là RSS thô trước khởi động, ghi thêm để minh bạch.
const memBaseline = rssMb();
playNight(1, seed, 1200);
const memStart = rssMb();
const t0 = performance.now();
const results: string[] = [];
let crashes = 0;
for (let i = 1; i <= nights; i++) {
  const night = (((i - 1) % 3) + 1) as 1 | 2 | 3;
  try {
    results.push(playNight(night, seed + i));
  } catch (e) {
    crashes++;
    results.push("crash");
    console.error(`Đêm ${i} (night ${night}) lỗi: ${(e as Error).message}`);
  }
}
const memEnd = rssMb(); // sau khi Đêm cuối đã kết thúc và mọi tham chiếu đã được dọn
const result = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_baseline_mb: memBaseline,
  mem_end_mb: memEnd,
  duration_s: Math.round(((performance.now() - t0) / 1000) * 10) / 10,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result) + "\n");
console.log(JSON.stringify(result));
const pass = crashes === 0 && memEnd <= 1.2 * memStart;
if (!pass) console.error(`SOAK KHÔNG ĐẠT: crashes=${crashes}, mem_end ${memEnd} MB > 1.2 × mem_start ${memStart} MB`);
process.exit(0); // kết quả đạt/không do người chấm đọc soak.json; thoát 0 khi chạy xong
