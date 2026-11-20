import { createGame, idleInput, snapshot, stepGame } from "./game.ts";
import type { InputFrame, Scenario } from "./types.ts";

export interface RunOptions {
  seed: number;
  night?: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: Scenario;
  inputs?: InputFrame[];
}

/** Chạy headless, trả về các dòng JSONL (event / snapshot / end). Thuần, không I/O. */
export function runHeadless(o: RunOptions): string[] {
  const every = o.snapshotEvery ?? 10;
  const frames = o.inputs ?? [];
  const night = o.night ?? 1;
  const g = createGame(o.seed, o.scenario, night);
  const inp = idleInput();
  // night_start ghi ở tick 0 (trước snapshot 0); dựng scenario không phát sự kiện nào khác
  const lines: string[] = [
    JSON.stringify({ type: "event", tick: 0, name: "night_start", data: { night } }),
    JSON.stringify(snapshot(g)),
  ];
  let fi = 0;
  for (let k = 0; k < o.ticks && g.state === "playing"; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) inp.move = f.move;
      if (f.cam_yaw_deg !== undefined) inp.yaw = f.cam_yaw_deg;
      if (f.jump !== undefined) inp.jump = f.jump;
      if (f.interact !== undefined) inp.interact = f.interact;
      if (f.pulse !== undefined) inp.pulse = f.pulse;
      if (f.dash !== undefined) inp.dash = f.dash;
      if (f.pause !== undefined) inp.pause = f.pause;
    }
    for (const e of stepGame(g, inp)) lines.push(JSON.stringify(e));
    if (g.tick % every === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: "end", ticks: g.tick, state: g.state, score: g.score }));
  return lines;
}
