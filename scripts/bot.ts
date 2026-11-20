// Bot tham lam chơi hết một Đêm bằng lõi game, ghi lại inputs rồi phát lại qua CLI headless.
// Mục đích: chứng minh game THẮNG ĐƯỢC từ đầu đến cuối và CLI cho đúng kết quả đó.
// Hỗ trợ Đêm 1 và Đêm 2 (đi qua cầu tre). Chưa có bot cho Đêm 3 (3 tầng/dốc/bục nhảy).
// Chạy: node scripts/bot.ts [night] [seed...]   (mặc định night 1 và 2, seed 1..6)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { T } from "../src/core/constants.ts";
import { createGame, idleInput, stepGame, timeLeft } from "../src/core/game.ts";
import type { Game } from "../src/core/game.ts";

const root = join(import.meta.dirname, "..");
const d2 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Đích tiếp theo, có điểm trung gian qua cầu ở Đêm 2. */
function waypoint(g: Game, target: number[]): number[] {
  if (g.night.night !== 2) return target;
  const p = g.player.pos;
  const side = (x: number) => (x < 35 ? 0 : 1);
  if (side(p[0]) === side(target[0])) return target;
  const onBridgeLane = Math.abs(p[2]) < 1.5 && p[0] > 24 && p[0] < 46;
  if (!onBridgeLane) return side(p[0]) === 0 ? [22, 0, 0] : [48, 0, 0];
  return side(target[0]) === 1 ? [46, 0, 0] : [24, 0, 0];
}

function decide(g: Game, tick: number) {
  const p = g.player;
  let target: number[] | undefined;
  let interact = false, pulse = false, dash = false;
  const unlit = g.lanterns.filter((l) => !l.lit);
  const nearestUnlit = [...unlit].sort((a, b) => d2(p.pos, a.pos) - d2(p.pos, b.pos))[0];
  const active = g.shades.filter((s) => s.state === "chase" || s.state === "wander");
  const close = active.filter((s) => d2(p.pos, s.pos) < 3.4).sort((a, b) => d2(p.pos, a.pos) - d2(p.pos, b.pos))[0];
  if (close && p.carried >= T.pulse_cost && p.pulseCd === 0) pulse = tick % 2 === 0;
  const full = p.carried >= T.carry_capacity;
  const needed = nearestUnlit ? T.lantern_cost - nearestUnlit.deposited : 0;
  if (nearestUnlit && (full || (p.carried >= needed && needed > 0) || g.motes.length === 0)) {
    target = nearestUnlit.pos;
    if (d2(p.pos, nearestUnlit.pos) <= T.interact_radius - 0.4 && p.carried > 0) interact = tick % 2 === 0;
  } else {
    target = [...g.motes].sort((a, b) => d2(p.pos, a.pos) - d2(p.pos, b.pos))[0]?.pos;
  }
  let mx = 0, mz = 0;
  if (target) {
    const w = waypoint(g, target);
    const d = d2(p.pos, w);
    if (d > 0.6) { mx = (w[0] - p.pos[0]) / d; mz = (w[2] - p.pos[2]) / d; }
  }
  // né Bóng Mực: đi lệch khỏi bóng ở gần (nhưng không cho lực đẩy lấn át đích)
  let rx = 0, rz = 0;
  for (const s of active) {
    const d = d2(p.pos, s.pos);
    if (d < 7 && d > 1e-6) { const w = (1 - d / 7) * 2.2; rx += ((p.pos[0] - s.pos[0]) / d) * w; rz += ((p.pos[2] - s.pos[2]) / d) * w; }
  }
  mx += rx; mz += rz;
  const len = Math.hypot(mx, mz);
  if (len > 1e-9) { mx /= len; mz /= len; } else { mx = 0; mz = 0; }
  // bị bóng đuổi sát mà không tỏa sáng được thì lướt ra xa
  if (close && !pulse && (p.dashCd === 0 || p.charm > 0) && p.invuln === 0) dash = tick % 2 === 0;
  return { move: [mx, mz] as [number, number], interact, pulse, dash };
}

const args = process.argv.slice(2).map(Number);
const nights = args.length && args[0] >= 1 && args[0] <= 3 ? [args[0]] : [1, 2];
const seeds = args.length > 1 ? args.slice(1) : args.length === 1 && args[0] > 3 ? args : [1, 2, 3, 4, 5, 6];
const lines: string[] = ["| Đêm | seed | kết quả | tick | điểm | còn lại (s) | phát lại CLI khớp |", "|---|---|---|---|---|---|---|"];
for (const night of nights) {
  for (const seed of seeds) {
    const g = createGame(seed, undefined, night);
    const frames: Record<string, unknown>[] = [];
    const prev = { move: "0,0", interact: false, pulse: false, dash: false };
    const budget = Math.round(g.timeLeftInit * 60);
    for (let k = 0; k < budget && g.state === "playing"; k++) {
      const a = decide(g, k);
      const f: Record<string, unknown> = { tick: k };
      const mk = a.move.map((x) => Math.round(x * 1e4) / 1e4);
      if (mk.join(",") !== prev.move) { f.move = mk; prev.move = mk.join(","); }
      if (a.interact !== prev.interact) { f.interact = a.interact; prev.interact = a.interact; }
      if (a.pulse !== prev.pulse) { f.pulse = a.pulse; prev.pulse = a.pulse; }
      if (a.dash !== prev.dash) { f.dash = a.dash; prev.dash = a.dash; }
      if (Object.keys(f).length > 1) frames.push(f);
      const inp = idleInput();
      inp.move = [mk[0], mk[1]]; inp.interact = a.interact; inp.pulse = a.pulse; inp.dash = a.dash;
      stepGame(g, inp);
    }
    const dir = join(root, "docs", "proof", "phase2", "bot", `night${night}-seed${seed}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "inputs.json"), JSON.stringify({ frames }));
    const r = spawnSync(process.execPath, ["src/headless/main.ts", "--seed", String(seed), "--night", String(night), "--ticks", String(budget), "--inputs", join(dir, "inputs.json"), "--snapshot-every", "1200", "--out", join(dir, "output.jsonl")], { cwd: root });
    const last = JSON.parse(readFileSync(join(dir, "output.jsonl"), "utf8").trim().split("\n").pop()!);
    const match = r.status === 0 && last.state === g.state && last.score === g.score && last.ticks === g.tick;
    lines.push(`| ${night} | ${seed} | ${g.state} | ${g.tick} | ${g.score} | ${Math.max(0, timeLeft(g)).toFixed(1)} | ${match ? "khớp" : "LỆCH"} |`);
  }
}
const out = lines.join("\n");
mkdirSync(join(root, "docs", "proof", "phase2", "bot"), { recursive: true });
writeFileSync(join(root, "docs", "proof", "phase2", "bot", "RESULTS.md"), `# Bot tham lam chơi Đêm 1 và 2\n\nSinh bởi \`node scripts/bot.ts\`. Bot chơi bằng lõi, ghi inputs, rồi phát lại qua CLI headless. Chưa có bot cho Đêm 3.\n\n${out}\n`);
console.log(out);
