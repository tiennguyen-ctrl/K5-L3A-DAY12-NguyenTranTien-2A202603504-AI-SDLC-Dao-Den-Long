// Bot tham lam chơi hết Đêm 1 bằng lõi game, ghi lại inputs rồi phát lại qua CLI headless.
// Mục đích: chứng minh game THẮNG ĐƯỢC từ đầu đến cuối và CLI cho đúng kết quả đó.
// Chạy: node scripts/bot.ts [seed...]   (mặc định seed 1 2 3 4 5)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { T } from "../src/core/constants.ts";
import { createGame, idleInput, stepGame } from "../src/core/game.ts";
import type { Game } from "../src/core/game.ts";

const root = join(import.meta.dirname, "..");
const d2 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function decide(g: Game, tick: number) {
  const p = g.player;
  let target: number[] | undefined;
  let interact = false, pulse = false;
  const unlit = g.lanterns.filter((l) => !l.lit);
  const nearestUnlit = [...unlit].sort((a, b) => d2(p.pos, a.pos) - d2(p.pos, b.pos))[0];
  const nearShade = g.shades.find((s) => s.state === "chase" && d2(p.pos, s.pos) < 3.5);
  if (nearShade && p.carried > T.pulse_cost && tick % 2 === 0) pulse = true;
  const full = p.carried >= T.carry_capacity;
  const needed = nearestUnlit ? T.lantern_cost - nearestUnlit.deposited : 0;
  if (nearestUnlit && (full || (p.carried >= needed && needed > 0) || g.motes.length === 0)) {
    target = nearestUnlit.pos;
    if (d2(p.pos, nearestUnlit.pos) <= T.interact_radius - 0.5 && p.carried > 0) interact = tick % 2 === 0;
  } else {
    target = [...g.motes].sort((a, b) => d2(p.pos, a.pos) - d2(p.pos, b.pos))[0]?.pos;
  }
  let move: [number, number] = [0, 0];
  if (target && d2(p.pos, target) > 1) {
    const d = d2(p.pos, target);
    move = [(target[0] - p.pos[0]) / d, (target[2] - p.pos[2]) / d];
  }
  return { move, interact, pulse };
}

const seeds = process.argv.slice(2).map(Number);
if (!seeds.length) seeds.push(1, 2, 3, 4, 5);
const lines: string[] = ["| seed | kết quả | ticks | điểm | còn lại (s) | phát lại CLI khớp |", "|---|---|---|---|---|---|"];
for (const seed of seeds) {
  const g = createGame(seed);
  const frames: Record<string, unknown>[] = [];
  const prev = { move: "0,0", interact: false, pulse: false };
  const budget = Math.round(T.night1_duration_s * 60);
  for (let k = 0; k < budget && g.state === "playing"; k++) {
    const a = decide(g, k);
    const f: Record<string, unknown> = { tick: k };
    const mk = a.move.map((x) => Math.round(x * 1e4) / 1e4);
    if (mk.join(",") !== prev.move) { f.move = mk; prev.move = mk.join(","); }
    if (a.interact !== prev.interact) { f.interact = a.interact; prev.interact = a.interact; }
    if (a.pulse !== prev.pulse) { f.pulse = a.pulse; prev.pulse = a.pulse; }
    if (Object.keys(f).length > 1) frames.push(f);
    const inp = idleInput();
    inp.move = [mk[0], mk[1]]; inp.interact = a.interact; inp.pulse = a.pulse;
    stepGame(g, inp);
  }
  const dir = join(root, "docs", "proof", "phase1", "bot", `seed-${seed}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "inputs.json"), JSON.stringify({ frames }));
  const r = spawnSync(process.execPath, ["src/headless/main.ts", "--seed", String(seed), "--night", "1", "--ticks", String(budget), "--inputs", join(dir, "inputs.json"), "--out", join(dir, "output.jsonl")], { cwd: root });
  const last = JSON.parse(readFileSync(join(dir, "output.jsonl"), "utf8").trim().split("\n").pop()!);
  const match = r.status === 0 && last.state === g.state && last.score === g.score && last.ticks === g.steps;
  lines.push(`| ${seed} | ${g.state} | ${g.steps} | ${g.score} | ${(T.night1_duration_s - g.steps / 60).toFixed(1)} | ${match ? "khớp" : "LỆCH"} |`);
}
const out = lines.join("\n");
writeFileSync(join(root, "docs", "proof", "phase1", "bot", "RESULTS.md"), `# Bot tham lam chơi Đêm 1\n\nSinh bởi \`node scripts/bot.ts\`. Bot chơi bằng lõi, ghi inputs, rồi phát lại qua CLI headless.\n\n${out}\n`);
console.log(out);
