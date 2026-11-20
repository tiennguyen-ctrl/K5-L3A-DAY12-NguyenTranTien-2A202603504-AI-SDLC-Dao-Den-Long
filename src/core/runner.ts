import { createGame, idleInput, snapshot, stepGame } from "./game.ts";
import type { InputFrame, Scenario } from "./types.ts";

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: Scenario;
  inputs?: InputFrame[];
}

/** Chạy headless, trả về các dòng JSONL (snapshot / event / end). Thuần, không I/O. */
export function runHeadless(o: RunOptions): string[] {
  const every = o.snapshotEvery ?? 10;
  const frames = o.inputs ?? [];
  const g = createGame(o.seed, o.scenario);
  const inp = idleInput();
  const lines: string[] = [JSON.stringify(snapshot(g))];
  let fi = 0;
  for (let k = 0; k < o.ticks && g.state === "playing"; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) inp.move = f.move;
      if (f.cam_yaw_deg !== undefined) inp.yaw = f.cam_yaw_deg;
      if (f.jump !== undefined) inp.jump = f.jump;
      if (f.interact !== undefined) inp.interact = f.interact;
      if (f.pulse !== undefined) inp.pulse = f.pulse;
    }
    for (const e of stepGame(g, inp)) lines.push(JSON.stringify(e));
    if (g.steps % every === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: "end", ticks: g.steps, state: g.state, score: g.score }));
  return lines;
}
