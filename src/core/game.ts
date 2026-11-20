import { DT, T, TICKS_PER_SECOND, WORLD } from "./constants.ts";
import { makeRng } from "./rng.ts";
import type { GameEvent, InputState, Scenario, Vec3 } from "./types.ts";
import { FormatError } from "./validate.ts";

export interface Mote { id: string; pos: Vec3 }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }
export interface Shade { id: string; pos: Vec3; state: "chase" | "stunned"; stunTicks: number }
export interface Player {
  pos: Vec3; vy: number; flames: number; carried: number;
  invuln: number; pulseCd: number; facing: number;
}
export type GameState = "playing" | "won" | "lost";

export interface Game {
  seed: number;
  rng: () => number;
  steps: number;
  state: GameState;
  score: number;
  timeLeftInit: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  randomMotes: boolean;
  randomShades: boolean;
  nextMote: number;
  nextShade: number;
  prev: { jump: boolean; interact: boolean; pulse: boolean };
}

export const idleInput = (): InputState => ({ move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false });

const dist2d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ticksOf = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

function defaultLanterns(): Lantern[] {
  const n = T.lantern_count_night1;
  const out: Lantern[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    out.push({
      id: `L${i + 1}`,
      pos: [WORLD.lantern_ring_radius * Math.sin(a), 0, WORLD.lantern_ring_radius * Math.cos(a)],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

function freshId(prefix: string, counter: number, used: Set<string>): [string, number] {
  let c = counter;
  while (used.has(`${prefix}${c}`)) c++;
  return [`${prefix}${c}`, c + 1];
}

function spawnMote(g: Game): Mote {
  const lo = WORLD.mote_min_r ** 2, hi = WORLD.mote_max_r ** 2;
  const r = Math.sqrt(lo + g.rng() * (hi - lo));
  const a = g.rng() * 2 * Math.PI;
  const [id, next] = freshId("M", g.nextMote, new Set(g.motes.map((m) => m.id)));
  g.nextMote = next;
  return { id, pos: [r * Math.sin(a), 0, r * Math.cos(a)] };
}

export function createGame(seed: number, sc: Scenario = {}): Game {
  const lanterns = defaultLanterns();
  for (const u of sc.lanterns ?? []) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) throw new FormatError(`scenario.lanterns: id không tồn tại: ${u.id}`);
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit !== undefined) {
      l.lit = u.lit;
      if (u.lit && u.deposited === undefined) l.deposited = T.lantern_cost;
    } else {
      l.lit = l.deposited >= T.lantern_cost;
    }
  }
  const g: Game = {
    seed,
    rng: makeRng(seed),
    steps: 0,
    state: "playing",
    score: 0,
    timeLeftInit: sc.time_left_s ?? T.night1_duration_s,
    player: {
      pos: sc.player?.pos ? [...sc.player.pos] : [0, 0, 0],
      vy: 0,
      flames: sc.player?.flames ?? T.flames,
      carried: sc.player?.carried ?? 0,
      invuln: 0,
      pulseCd: 0,
      facing: 0,
    },
    lanterns,
    motes: [],
    shades: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    nextMote: 1,
    nextShade: 1,
    prev: { jump: false, interact: false, pulse: false },
  };
  if (sc.motes) {
    g.motes = sc.motes.map((p, i) => ({ id: `M${i + 1}`, pos: [...p] as Vec3 }));
    g.nextMote = g.motes.length + 1;
  } else if (g.randomMotes) {
    for (let i = 0; i < WORLD.mote_target; i++) g.motes.push(spawnMote(g));
  }
  if (sc.shades) {
    const used = new Set<string>();
    for (const s of sc.shades) if (s.id) used.add(s.id);
    g.shades = sc.shades.map((s) => {
      let id = s.id;
      if (!id) {
        [id, g.nextShade] = freshId("S", g.nextShade, used);
        used.add(id);
      }
      return { id, pos: [...s.pos] as Vec3, state: "chase" as const, stunTicks: 0 };
    });
  }
  return g;
}

export function timeLeft(g: Game): number {
  return g.timeLeftInit - g.steps / TICKS_PER_SECOND;
}

/** Đẩy Bóng Mực ra ngoài safe_radius (+ biên nhỏ) của mọi Đèn Lồng. */
function pushOutOfSafe(g: Game, pos: Vec3): void {
  const r = T.safe_radius + WORLD.safe_margin;
  for (const l of g.lanterns) {
    let dx = pos[0] - l.pos[0], dz = pos[2] - l.pos[2];
    let d = Math.hypot(dx, dz);
    if (d > T.safe_radius) continue;
    if (d < 1e-9) { dx = 1; dz = 0; d = 1; }
    pos[0] = l.pos[0] + (dx / d) * r;
    pos[2] = l.pos[2] + (dz / d) * r;
  }
}

function clampToRadius(pos: Vec3, radius: number): void {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > radius) { pos[0] *= radius / d; pos[2] *= radius / d; }
}

/**
 * Một bước = 1 tick (1/60 s). Thứ tự trong bước:
 * hẹn giờ -> di chuyển/nhảy -> nạp đèn -> tỏa sáng -> nhặt đom đóm
 * -> Bóng Mực di chuyển -> va chạm -> thắng/thua -> sinh đom đóm/Bóng Mực.
 * Mọi sự kiện ghi tick = steps + 1.
 */
export function stepGame(g: Game, inp: InputState): GameEvent[] {
  if (g.state !== "playing") return [];
  const ev: GameEvent[] = [];
  const tick = g.steps + 1;
  const emit = (name: string, data: Record<string, unknown>) => ev.push({ type: "event", tick, name, data });
  const p = g.player;

  const jumpEdge = inp.jump && !g.prev.jump;
  const interactEdge = inp.interact && !g.prev.interact;
  const pulseEdge = inp.pulse && !g.prev.pulse;
  g.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse };

  // hẹn giờ
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invuln > 0) p.invuln--;
  for (const s of g.shades) {
    if (s.state === "stunned" && --s.stunTicks <= 0) { s.state = "chase"; s.stunTicks = 0; }
  }

  // di chuyển
  let mx = Math.max(-1, Math.min(1, inp.move[0]));
  let mz = Math.max(-1, Math.min(1, inp.move[1]));
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (inp.yaw * Math.PI) / 180;
  const dx = mx * Math.cos(th) + mz * Math.sin(th);
  const dz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += dx * T.player_speed * DT;
  p.pos[2] += dz * T.player_speed * DT;
  if (dx !== 0 || dz !== 0) p.facing = Math.atan2(dx, dz);
  // fall_enabled=false: không rơi khỏi đảo, chỉ bị chặn ở mép đảo
  clampToRadius(p.pos, WORLD.island_radius);

  // nhảy
  if (jumpEdge && p.pos[1] <= 0 && p.vy === 0) p.vy = WORLD.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= WORLD.gravity * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // nạp đèn (đèn chưa sáng gần nhất trong interact_radius)
  if (interactEdge && p.carried > 0) {
    let best: Lantern | undefined, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = dist2d(p.pos, l.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - best.deposited));
      p.carried -= amount;
      best.deposited += amount;
      emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit("lantern_lit", { lantern_id: best.id });
      }
    }
  }

  // tỏa sáng: tốn pulse_cost đom đóm đang mang, có hồi chiêu
  if (pulseEdge && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = ticksOf(T.pulse_cooldown_s);
    const stunned: string[] = [];
    for (const s of g.shades) {
      if (dist2d(p.pos, s.pos) > T.pulse_radius) continue;
      let ex = s.pos[0] - p.pos[0], ez = s.pos[2] - p.pos[2];
      const d = Math.hypot(ex, ez);
      if (d < 1e-9) { ex = 1; ez = 0; } else { ex /= d; ez /= d; }
      s.pos[0] += ex * T.pulse_push_m;
      s.pos[2] += ez * T.pulse_push_m;
      clampToRadius(s.pos, WORLD.island_radius + 4);
      pushOutOfSafe(g, s.pos);
      s.state = "stunned";
      s.stunTicks = ticksOf(T.pulse_stun_s);
      stunned.push(s.id);
    }
    g.score += T.score.per_stun * stunned.length;
    emit("pulse", { stunned_ids: stunned });
  }

  // nhặt đom đóm
  for (const m of [...g.motes]) {
    if (p.carried >= T.carry_capacity) break;
    if (dist2d(p.pos, m.pos) <= T.pickup_radius) {
      g.motes.splice(g.motes.indexOf(m), 1);
      p.carried++;
      g.score += T.score.per_mote;
      emit("mote_picked", { carried: p.carried });
    }
  }

  // Bóng Mực đuổi theo
  for (const s of g.shades) {
    if (s.state !== "chase") continue;
    const ex = p.pos[0] - s.pos[0], ez = p.pos[2] - s.pos[2];
    const d = Math.hypot(ex, ez);
    if (d > 1e-9) {
      const step = Math.min(T.shade_speed * DT, d);
      s.pos[0] += (ex / d) * step;
      s.pos[2] += (ez / d) * step;
    }
    pushOutOfSafe(g, s.pos);
  }

  // va chạm
  if (p.invuln === 0) {
    for (const s of g.shades) {
      if (s.state === "chase" && dist2d(p.pos, s.pos) <= T.shade_hit_radius) {
        p.flames--;
        p.invuln = ticksOf(T.invuln_s);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = (i * 2 * Math.PI) / dropped;
          const r = T.pickup_radius + 1;
          const pos: Vec3 = [p.pos[0] + r * Math.sin(a), 0, p.pos[2] + r * Math.cos(a)];
          clampToRadius(pos, WORLD.island_radius);
          const [id, next] = freshId("M", g.nextMote, new Set(g.motes.map((m) => m.id)));
          g.nextMote = next;
          g.motes.push({ id, pos });
        }
        emit("player_hit", { by: "shade", flames: p.flames, dropped });
        break;
      }
    }
  }

  g.steps = tick;

  // thắng / thua
  const left = timeLeft(g);
  let result: "won" | "lost" | null = null;
  let reason = "";
  if (g.lanterns.every((l) => l.lit)) {
    result = "won"; reason = "all_lit";
    g.score += T.score.per_second_left * Math.floor(Math.max(0, left) + 1e-9)
      + T.score.per_flame_left * p.flames;
  } else if (p.flames <= 0) {
    result = "lost"; reason = "no_flames";
  } else if (left <= 1e-9) {
    result = "lost"; reason = "dawn";
  }
  if (result) {
    g.state = result;
    emit("game_over", { result, reason });
    return ev;
  }

  // sinh ngẫu nhiên (tắt khi scenario đặt random_* = false)
  if (g.randomMotes && tick % WORLD.mote_respawn_ticks === 0 && g.motes.length < WORLD.mote_target) {
    g.motes.push(spawnMote(g));
  }
  if (
    g.randomShades &&
    tick >= WORLD.shade_first_tick &&
    (tick - WORLD.shade_first_tick) % WORLD.shade_interval_ticks === 0 &&
    g.shades.length < WORLD.shade_max
  ) {
    const a = g.rng() * 2 * Math.PI;
    const [id, next] = freshId("S", g.nextShade, new Set(g.shades.map((s) => s.id)));
    g.nextShade = next;
    g.shades.push({
      id,
      pos: [WORLD.shade_spawn_radius * Math.sin(a), WORLD.shade_height, WORLD.shade_spawn_radius * Math.cos(a)],
      state: "chase",
      stunTicks: 0,
    });
    emit("shade_spawned", { id });
  }
  return ev;
}

const r3 = (x: number) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v;
};
const v3 = (v: Vec3) => [r3(v[0]), r3(v[1]), r3(v[2])];

export function snapshot(g: Game): Record<string, unknown> {
  return {
    type: "snapshot",
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: v3(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
    motes_active: g.motes.length,
  };
}
