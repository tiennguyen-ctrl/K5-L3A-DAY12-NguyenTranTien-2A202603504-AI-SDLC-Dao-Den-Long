import { DT, T, TICKS_PER_SECOND, WORLD, ticksOf } from "./constants.ts";
import { getNight } from "./maps.ts";
import type { NightDef } from "./maps.ts";
import { makeRng } from "./rng.ts";
import type { DrifterState, GameEvent, InputState, Scenario, ShadeState, Vec3 } from "./types.ts";
import { FormatError } from "./validate.ts";

export interface Mote { id: string; pos: Vec3; kind: "random" | "dropped"; ttl: number | null }
/** fuelU: nhiên liệu theo đơn vị nguyên 1/60 (6000 = 100). Hao 1 đơn vị mỗi tick = 1/giây. */
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number; fuelU: number; everLit: boolean; relit: number }
export interface Charm { id: string; pos: Vec3; available: boolean; respawn: number }
export interface Shade {
  id: string; pos: Vec3; yOff: number; state: ShadeState; ticksLeft: number;
  pushTicks: number; pushStep: number; pushDx: number; pushDz: number;
  heading: number; wanderTicks: number; grace: boolean;
  target: string | null; drainTicks: number;
}
export interface Drifter {
  id: string; pos: Vec3; state: DrifterState; stolen: number; ticksLeft: number;
  dx: number; dz: number; heading: number; stole: boolean;
}
export interface Player {
  pos: Vec3; vel: Vec3; grounded: boolean; flames: number; carried: number;
  invuln: number; dashCd: number; pulseCd: number; charm: number;
  dashTicks: number; dashDx: number; dashDz: number;
  launch: { vx: number; vz: number } | null;
  fx: number; fz: number; fallWait: number;
  successfulLights: number;
}
export type GameState = "playing" | "won" | "lost";

export interface Game {
  seed: number;
  night: NightDef;
  rng: () => number;
  tick: number;
  sim: number;
  paused: boolean;
  state: GameState;
  score: number;
  timeLeftInit: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  windDir: number;
  nextMote: number;
  nextShade: number;
  nextDrifter: number;
  prev: { jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean };
}

export const idleInput = (): InputState => ({
  move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
});

const dist2d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const DASH_TICKS = ticksOf(T.dash_duration_s);
const DASH_CD = ticksOf(T.dash_cooldown_s);
const STUN_TICKS = ticksOf(T.pulse_stun_s);
const PULSE_CD = ticksOf(T.pulse_cooldown_s);
const INVULN = ticksOf(T.invuln_s);
const STATE_TICKS: Record<ShadeState, number> = {
  spawning: WORLD.shade_spawning_ticks, wander: 0, chase: 0, recoil: WORLD.shade_recoil_ticks, stunned: STUN_TICKS, drain: 0,
};
const FUEL_MAX_U = T.fuel_max * TICKS_PER_SECOND;
const LOW_U = T.low_fuel_threshold * TICKS_PER_SECOND;
const PER_MOTE_U = T.fuel_per_mote * TICKS_PER_SECOND;
const DECAY_U = T.fuel_decay_per_s; // 1/s = 1 đơn vị 1/60 mỗi tick
const DRAIN_U = T.drain_per_s;

/** Đèn đang sáng và còn >= 30 dầu thì có vùng an toàn (đúng 30 vẫn còn). */
const hasZone = (l: Lantern) => l.lit && l.fuelU >= LOW_U;
const isWeak = (l: Lantern) => l.lit && l.fuelU < LOW_U;
const costOf = (l: Lantern) => (l.everLit ? T.relight_cost : T.lantern_cost);
export const capacityOf = (p: { successfulLights: number }) => Math.min(T.capacity_max, T.carry_capacity + WORLD.capacity_per_light * p.successfulLights);
export const winNeed = (total: number) => Math.ceil(T.win_ratio * total - 1e-9);
const fuelOut = (l: Lantern) => (l.lit ? Math.round(l.fuelU / 6) / 10 : 0);

/** Bóng wander chọn đèn yếu (sáng, fuel < 30) gần nhất, bằng nhau thì id nhỏ; không có thì đèn tắt gần nhất. */
function pickTarget(g: Game, s: Shade): Lantern | null {
  const near = (list: Lantern[]) => {
    let best: Lantern | null = null, bd = Infinity;
    for (const l of [...list].sort(byId)) {
      const d = dist2d(s.pos, l.pos);
      if (d < bd - 1e-9) { best = l; bd = d; }
    }
    return best;
  };
  const weak = near(g.lanterns.filter(isWeak));
  if (weak) return weak;
  const keep = g.lanterns.find((l) => l.id === s.target && !l.lit);
  return keep ?? near(g.lanterns.filter((l) => !l.lit));
}

/** Thứ tự id tăng dần: S2 trước S10 (độ dài trước, rồi từ điển). */
const byId = (a: { id: string }, b: { id: string }) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function freshId(prefix: string, counter: number, used: Set<string>): [string, number] {
  let c = counter;
  while (used.has(`${prefix}${c}`)) c++;
  return [`${prefix}${c}`, c + 1];
}

function nearestLantern(list: Lantern[], pos: Vec3): Lantern | undefined {
  let best: Lantern | undefined, bd = Infinity;
  for (const l of list) {
    const d = dist2d(pos, l.pos);
    if (d < bd - 1e-9) { best = l; bd = d; }
  }
  return best;
}

function groundFor(night: NightDef, x: number, z: number, fallback: number): number {
  const h = night.heightAt(x, z);
  return h === -Infinity ? fallback : h;
}

export function createGame(seed: number, sc: Scenario = {}, nightNo = 1): Game {
  const night = getNight(nightNo);
  const lanterns: Lantern[] = night.lanterns.map((l) => ({ id: l.id, pos: [...l.pos] as Vec3, lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 }));
  for (const u of sc.lanterns ?? []) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) throw new FormatError(`scenario.lanterns: id không tồn tại: ${u.id}`);
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.ever_lit !== undefined) l.everLit = u.ever_lit;
    l.lit = u.lit ?? (u.fuel !== undefined ? u.fuel > 0 : l.deposited >= costOf(l));
    if (l.lit) {
      l.everLit = true;
      l.fuelU = Math.round((u.fuel ?? T.fuel_max) * TICKS_PER_SECOND);
      if (u.deposited === undefined) l.deposited = T.lantern_cost;
    }
  }
  const sp = sc.player ?? {};
  const g: Game = {
    seed,
    night,
    rng: makeRng(seed),
    tick: 0,
    sim: 0,
    paused: false,
    state: "playing",
    score: 0,
    timeLeftInit: sc.time_left_s ?? night.durationS,
    player: {
      pos: sp.pos ? [...sp.pos] : [...night.start],
      vel: [0, 0, 0],
      grounded: true,
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      dashTicks: 0, dashDx: 0, dashDz: 0,
      launch: null,
      fx: 0, fz: 1,
      fallWait: 0,
      successfulLights: sp.successful_lights ?? 0,
    },
    lanterns,
    motes: [],
    shades: [],
    drifters: [],
    charms: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? true,
    windEnabled: night.wind && (sc.wind_enabled ?? true),
    windDir: 0,
    nextMote: 1,
    nextShade: 1,
    nextDrifter: 1,
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  // người chơi đứng trên mặt đất nếu không ở trên không
  const ph = night.heightAt(g.player.pos[0], g.player.pos[2]);
  g.player.grounded = ph !== -Infinity && Math.abs(g.player.pos[1] - ph) < 1e-6;

  // đom đóm
  if (sc.motes) {
    g.motes = sc.motes.map((m, i) => ({
      id: `M${i + 1}`,
      pos: [...m.pos] as Vec3,
      kind: m.kind ?? "random",
      ttl: m.ttl_ticks ?? (m.kind === "dropped" ? WORLD.mote_drop_ttl : null),
    }));
    g.nextMote = g.motes.length + 1;
  } else if (g.randomMotes) {
    const idx = night.moteSpots.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(g.rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.slice(0, WORLD.mote_initial).sort((a, b) => a - b).forEach((si) => {
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...night.moteSpots[si]] as Vec3, kind: "random", ttl: null });
    });
  }
  // Bóng Mực từ scenario: hoạt động ngay (mặc định chase)
  if (sc.shades) {
    const used = new Set<string>();
    for (const s of sc.shades) if (s.id) used.add(s.id);
    g.shades = sc.shades.map((s) => {
      let id = s.id;
      if (!id) {
        [id, g.nextShade] = freshId("S", g.nextShade, used);
        used.add(id);
      }
      const state = s.state ?? "chase";
      const h = groundFor(night, s.pos[0], s.pos[2], s.pos[1]);
      return {
        id, pos: [...s.pos] as Vec3, yOff: s.pos[1] - h, state,
        ticksLeft: s.state_ticks_left ?? STATE_TICKS[state],
        pushTicks: 0, pushStep: 0, pushDx: 1, pushDz: 0, heading: 0, wanderTicks: 0, grace: false,
        target: s.target_lantern_id ?? (state === "drain" ? nearestLantern(lanterns, s.pos)?.id ?? null : null), drainTicks: 0,
      };
    });
  }
  // Gió Lạc từ scenario thay thế danh sách mặc định (mặc định không có)
  if (sc.drifters) {
    const used = new Set<string>();
    for (const d of sc.drifters) if (d.id) used.add(d.id);
    g.drifters = sc.drifters.map((d) => {
      let id = d.id;
      if (!id) {
        [id, g.nextDrifter] = freshId("D", g.nextDrifter, used);
        used.add(id);
      }
      const state = d.state ?? "idle";
      return {
        id, pos: [...d.pos] as Vec3, state, stolen: d.stolen ?? 0,
        ticksLeft: d.state_ticks_left ?? (state === "flee" ? WORLD.drifter_flee_ticks : 0),
        dx: 1, dz: 0, heading: 0, stole: state === "flee",
      };
    });
  }
  // Bùa Gió
  if (sc.charms) {
    g.charms = sc.charms.map((c, i) => {
      const id = c.id ?? `C${i + 1}`;
      const pos = c.pos ?? night.charms.find((x) => x.id === id)?.pos;
      if (!pos) throw new FormatError(`scenario.charms[${i}]: thiếu pos cho id ${id}`);
      const available = c.available ?? (c.respawn_ticks ?? 0) <= 0;
      return { id, pos: [...pos] as Vec3, available, respawn: available ? 0 : c.respawn_ticks ?? WORLD.charm_respawn_ticks };
    });
  } else {
    g.charms = night.charms.map((c) => ({ id: c.id, pos: [...c.pos] as Vec3, available: true, respawn: 0 }));
  }
  return g;
}

export function timeLeft(g: Game): number {
  return g.timeLeftInit - g.sim / TICKS_PER_SECOND;
}

export function lightFraction(g: Game): number {
  return g.lanterns.filter((l) => l.lit).length / Math.max(1, g.lanterns.length);
}

/** Cho phép đi tới (nx,nz) từ độ cao y? Khối đặc: chỉ vào ô có mặt đất <= y + step. */
function slide(g: Game, x: number, z: number, nx: number, nz: number, y: number, allowVoid: boolean): [number, number] {
  const ok = (px: number, pz: number) => {
    const h = g.night.heightAt(px, pz);
    return h === -Infinity ? allowVoid : y >= h - WORLD.step_height;
  };
  if (ok(nx, nz)) return [nx, nz];
  if (ok(nx, z)) return [nx, z];
  if (ok(x, nz)) return [x, nz];
  return [x, z];
}

function unit2(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  return d < 1e-9 ? [1, 0] : [x / d, z / d];
}

function moveWorld(inp: InputState): [number, number] {
  let mx = Math.max(-1, Math.min(1, inp.move[0]));
  let mz = Math.max(-1, Math.min(1, inp.move[1]));
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (inp.yaw * Math.PI) / 180;
  return [mx * Math.cos(th) + mz * Math.sin(th), -mx * Math.sin(th) + mz * Math.cos(th)];
}

function windActive(g: Game): boolean {
  if (!g.windEnabled) return false;
  const k = Math.floor(g.sim / WORLD.wind_period);
  return k >= 1 && g.sim % WORLD.wind_period < WORLD.wind_duration;
}

function touches(p: Player, pos: Vec3): boolean {
  return Math.hypot(p.pos[0] - pos[0], p.pos[2] - pos[2]) <= T.pickup_radius && Math.abs(p.pos[1] - pos[1]) <= WORLD.touch_height;
}

function dropMotes(g: Game, n: number, cx: number, cz: number, py: number, rMin: number, rMax: number): void {
  if (n <= 0) return;
  const base = g.rng() * 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = base + (i * 2 * Math.PI) / n;
    const r = rMin + g.rng() * (rMax - rMin);
    let x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    let h = g.night.heightAt(x, z);
    if (h === -Infinity || h > py + WORLD.touch_height) { x = cx; z = cz; h = groundFor(g.night, cx, cz, py); }
    const [id, next] = freshId("M", g.nextMote, new Set(g.motes.map((m) => m.id)));
    g.nextMote = next;
    g.motes.push({ id, pos: [x, h, z], kind: "dropped", ttl: WORLD.mote_drop_ttl });
  }
}

function respawnPlayer(g: Game): void {
  const p = g.player;
  p.pos = [...g.night.start];
  p.pos[1] = groundFor(g.night, p.pos[0], p.pos[2], 0);
  p.vel = [0, 0, 0];
  p.grounded = true;
  p.launch = null;
  p.dashTicks = 0;
  p.fx = 0; p.fz = 1;
  p.invuln = WORLD.respawn_invuln_ticks;
  p.fallWait = 0;
}

function pushShade(s: Shade, dx: number, dz: number, ticks: number, total: number): void {
  const [ux, uz] = unit2(dx, dz);
  s.pushDx = ux; s.pushDz = uz; s.pushTicks = ticks; s.pushStep = total / ticks;
}

/**
 * Một bước = 1 tick (1/60 s), theo thứ tự 12 bước của Ticket-02:
 * 1 input/pause · 2 bộ đếm · 3 di chuyển Mây + rơi · 4 nhặt · 5 đèn · 6 vùng an toàn · 7 tỏa sáng
 * · 8 di chuyển bóng/Gió Lạc · 9 chạm · 10 sinh · 11 thắng/thua (12 snapshot do runner ghi).
 */
export function stepGame(g: Game, inp: InputState): GameEvent[] {
  if (g.state !== "playing") return [];
  const ev: GameEvent[] = [];
  g.tick += 1;
  const tick = g.tick;
  const emit = (name: string, data: Record<string, unknown>) => ev.push({ type: "event", tick, name, data });
  const p = g.player;
  const R = T.safe_radius;

  const jumpEdge = inp.jump && !g.prev.jump;
  const interactEdge = inp.interact && !g.prev.interact;
  const pulseEdge = inp.pulse && !g.prev.pulse;
  const dashEdge = inp.dash && !g.prev.dash;
  const pauseEdge = inp.pause && !g.prev.pause;
  g.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: inp.dash, pause: inp.pause };

  // 1. pause trước
  if (pauseEdge) {
    if (!g.paused) { g.paused = true; emit("paused", {}); return ev; }
    g.paused = false;
    emit("resumed", {});
  }
  if (g.paused) return ev;

  g.sim += 1;
  const sim = g.sim;

  // 2. giảm các bộ đếm
  if (p.invuln > 0) p.invuln--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.charm > 0) p.charm--;
  if (p.dashTicks > 0) p.dashTicks--;
  if (p.fallWait > 0 && --p.fallWait === 0) respawnPlayer(g);
  for (const m of [...g.motes]) {
    if (m.ttl !== null && --m.ttl <= 0) g.motes.splice(g.motes.indexOf(m), 1);
  }
  for (const c of g.charms) {
    if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
  }
  for (const s of g.shades) {
    if (s.state === "spawning" || s.state === "recoil" || s.state === "stunned") {
      if (--s.ticksLeft <= 0) {
        s.ticksLeft = 0;
        s.state = s.state !== "stunned" && dist2d(s.pos, p.pos) <= WORLD.shade_abandon ? "chase" : "wander";
      }
    }
  }
  // nhiên liệu (bước 2): hao + bị hút, rồi đèn hết dầu tắt ngay
  for (const l of g.lanterns) if (l.lit) l.fuelU -= DECAY_U;
  const drains: { shade: string; lantern: Lantern }[] = [];
  for (const s of [...g.shades].sort(byId)) {
    if (s.state !== "drain") continue;
    const l = g.lanterns.find((x) => x.id === s.target);
    if (!l || !l.lit) continue;
    l.fuelU -= DRAIN_U;
    if (++s.drainTicks % WORLD.drain_event_every === 0) drains.push({ shade: s.id, lantern: l });
  }
  for (const d of drains) emit("fuel_drain", { lantern_id: d.lantern.id, shade_id: d.shade, fuel: Math.round(Math.max(0, d.lantern.fuelU) / 6) / 10 });
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) {
      l.lit = false; l.fuelU = 0; l.deposited = 0;
      emit("lantern_out", { lantern_id: l.id });
    }
  }
  for (const d of g.drifters) {
    if (d.state === "flee" && --d.ticksLeft <= 0) d.state = "removed";
  }
  // gió: chọn hướng lúc báo trước
  if (g.windEnabled && sim % WORLD.wind_period === WORLD.wind_period - WORLD.wind_warning) g.windDir = g.rng() * 360;

  // 3. di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi
  if (p.fallWait === 0) {
    const [wx, wz] = moveWorld(inp);
    const mag = Math.hypot(wx, wz);
    if (mag > 1e-9) { p.fx = wx / mag; p.fz = wz / mag; }
    if (dashEdge && p.dashTicks === 0 && (p.charm > 0 || p.dashCd === 0)) {
      const [ux, uz] = mag > 1e-9 ? [wx / mag, wz / mag] : [p.fx, p.fz];
      p.dashTicks = DASH_TICKS; p.dashDx = ux; p.dashDz = uz;
      p.dashCd = p.charm > 0 ? 0 : DASH_CD;
      emit("dash", {});
    }
    const dashing = p.dashTicks > 0;
    let jumped = false;
    if (jumpEdge && p.grounded && !dashing) { p.vel[1] = WORLD.jump_speed; p.grounded = false; jumped = true; }
    if (p.grounded && !dashing) {
      for (const pad of g.night.pads) {
        if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) <= 1) {
          p.vel[1] = pad.vy; p.launch = { vx: pad.dir[0] * pad.hv, vz: pad.dir[1] * pad.hv };
          p.grounded = false; jumped = true;
          break;
        }
      }
    }
    // vận tốc ngang
    let vx: number, vz: number;
    if (dashing) { vx = p.dashDx * T.dash_speed; vz = p.dashDz * T.dash_speed; }
    else if (p.launch) { vx = p.launch.vx; vz = p.launch.vz; }
    else {
      const sp = p.charm > 0 ? WORLD.charm_speed : T.player_speed;
      vx = wx * sp; vz = wz * sp;
    }
    if (windActive(g)) {
      const a = (g.windDir * Math.PI) / 180;
      vx += Math.cos(a) * WORLD.wind_speed; vz += Math.sin(a) * WORLD.wind_speed;
    }
    // vận tốc dọc
    const wasGrounded = p.grounded;
    if (dashing) p.vel[1] = 0;
    else if (!p.grounded || p.vel[1] > 0) { p.vel[1] -= WORLD.gravity * DT; p.pos[1] += p.vel[1] * DT; }
    // di chuyển ngang có va chạm
    const [nx, nz] = slide(g, p.pos[0], p.pos[2], p.pos[0] + vx * DT, p.pos[2] + vz * DT, p.pos[1], true);
    p.pos[0] = nx; p.pos[2] = nz;
    p.vel[0] = vx; p.vel[2] = vz;
    // đáp đất
    const h = g.night.heightAt(p.pos[0], p.pos[2]);
    if (dashing) {
      p.grounded = h !== -Infinity && Math.abs(p.pos[1] - h) < 1e-6;
    } else if (h !== -Infinity && p.vel[1] <= 0 && p.pos[1] <= h + 1e-9) {
      p.pos[1] = h; p.vel[1] = 0; p.grounded = true; p.launch = null;
    } else if (h !== -Infinity && wasGrounded && !jumped && p.vel[1] <= 0 && p.pos[1] - h <= WORLD.step_height) {
      p.pos[1] = h; p.vel[1] = 0; p.grounded = true;
    } else {
      p.grounded = false;
    }
    // rơi khỏi đảo (đúng 1 lần, bỏ qua bất tử)
    if (p.pos[1] < WORLD.fall_y) {
      const lost = p.carried;
      p.carried = 0;
      p.flames = Math.max(0, p.flames - 1);
      p.fallWait = WORLD.fall_wait_ticks;
      p.vel = [0, 0, 0];
      p.dashTicks = 0; p.launch = null; p.grounded = false;
      emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. nhặt đom đóm và bùa
  if (p.fallWait === 0) {
    for (const m of [...g.motes]) {
      if (p.carried >= capacityOf(p)) break;
      if (touches(p, m.pos)) {
        g.motes.splice(g.motes.indexOf(m), 1);
        p.carried++;
        emit("mote_picked", { carried: p.carried });
      }
    }
    for (const c of g.charms) {
      if (c.available && touches(p, c.pos)) {
        c.available = false; c.respawn = WORLD.charm_respawn_ticks;
        p.charm = WORLD.charm_ticks;
        emit("charm_picked", { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. tương tác: chỉ xét đèn nhận được (chưa sáng, hoặc sáng nhưng chưa đầy dầu); gần nhất, bằng nhau thì id nhỏ hơn
  if (interactEdge && p.fallWait === 0 && p.carried > 0) {
    let best: Lantern | undefined, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU >= FUEL_MAX_U) continue;
      const d = dist2d(p.pos, l.pos);
      if (d <= T.interact_radius && d < bd - 1e-9) { best = l; bd = d; }
    }
    if (best && best.lit) {
      // châm dầu: used = min(đang mang, ceil((100 - fuel) / 10))
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX_U - best.fuelU) / PER_MOTE_U));
      best.fuelU = Math.min(FUEL_MAX_U, best.fuelU + PER_MOTE_U * used);
      p.carried -= used;
      g.score += T.score.per_mote * used;
      emit("refuel", { lantern_id: best.id, amount: used, fuel: fuelOut(best) });
    } else if (best) {
      const cost = costOf(best);
      const amount = Math.min(p.carried, Math.max(0, cost - best.deposited));
      p.carried -= amount;
      best.deposited += amount;
      g.score += T.score.per_mote * amount;
      emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.everLit = true; best.fuelU = FUEL_MAX_U;
        if (relight) best.relit++;
        p.successfulLights++;
        g.score += relight ? T.score.per_relight : T.score.per_lantern;
        emit("lantern_lit", { lantern_id: best.id, relight });
      }
    }
  }

  // 6. vùng an toàn: chỉ đèn đã sáng (kết quả dùng ở bước 8)

  // 7. tỏa sáng
  if (pulseEdge && p.fallWait === 0 && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = PULSE_CD;
    const center: Vec3 = [p.pos[0], p.pos[1] + WORLD.pulse_center_up, p.pos[2]];
    const stunned: string[] = [];
    let stunScore = 0;
    for (const s of [...g.shades].sort(byId)) {
      if (dist3d(center, s.pos) > T.pulse_radius) continue;
      stunScore += s.state === "drain" ? T.score.per_stun_drain : T.score.per_stun;
      s.target = null; s.drainTicks = 0;
      s.state = "stunned";
      s.ticksLeft = STUN_TICKS;
      pushShade(s, s.pos[0] - center[0], s.pos[2] - center[2], WORLD.shade_push_ticks, T.pulse_push_m);
      stunned.push(s.id);
    }
    g.score += stunScore;
    emit("pulse", { stunned_ids: stunned });
    for (const d of g.drifters) {
      if (dist3d(center, d.pos) > T.pulse_radius) continue;
      if (d.state === "chase") {
        d.state = "flee"; d.ticksLeft = WORLD.drifter_flee_ticks; d.stole = true; d.stolen = 0;
        [d.dx, d.dz] = unit2(d.pos[0] - p.pos[0], d.pos[2] - p.pos[2]);
      } else if (d.state === "flee" && d.stolen > 0) {
        const amount = d.stolen;
        d.stolen = 0;
        d.ticksLeft = WORLD.drifter_drop_vanish_ticks;
        dropMotes(g, amount, d.pos[0], d.pos[2], p.pos[1], 0, 0);
        emit("drifter_drop", { drifter_id: d.id, amount });
      }
    }
  }

  // 8. di chuyển Bóng Mực và Gió Lạc
  for (const s of g.shades) {
    s.grace = false;
    const ox = s.pos[0], oz = s.pos[2];
    const foot = s.pos[1] - s.yOff;
    if (s.pushTicks > 0) {
      // lực đẩy (lùi do bị chạm / tỏa sáng) chạy độc lập với bộ đếm trạng thái, dừng nếu gặp vật cản
      const [nx, nz] = slide(g, ox, oz, ox + s.pushDx * s.pushStep, oz + s.pushDz * s.pushStep, foot, false);
      s.pos[0] = nx; s.pos[2] = nz;
      s.pushTicks--;
    } else {
      if (s.state === "drain") {
        const dl = g.lanterns.find((x) => x.id === s.target);
        if (!dl || !isWeak(dl) || dist2d(s.pos, dl.pos) > WORLD.drain_range) { s.state = "wander"; s.target = null; s.drainTicks = 0; }
        else if (dist2d(s.pos, p.pos) <= T.safe_radius) { s.state = "chase"; s.target = null; s.drainTicks = 0; }
      }
      if (s.state === "wander" || s.state === "chase") {
      const d = dist2d(s.pos, p.pos);
      if (s.state === "wander" && d <= WORLD.shade_detect) s.state = "chase";
      else if (s.state === "chase" && d > WORLD.shade_abandon) s.state = "wander";
      if (s.state === "chase") {
        const [ux, uz] = unit2(p.pos[0] - ox, p.pos[2] - oz);
        const step = Math.min(g.night.shadeSpeed * DT, d);
        const [nx, nz] = slide(g, ox, oz, ox + ux * step, oz + uz * step, foot, false);
        s.pos[0] = nx; s.pos[2] = nz;
      } else {
        const tl = pickTarget(g, s);
        s.target = tl ? tl.id : null;
        const step = WORLD.shade_wander_speed * DT;
        if (tl) {
          // đi về đèn mục tiêu; tới trong 2 m của đèn yếu thì đứng lại hút dầu
          const dt = dist2d(s.pos, tl.pos);
          if (isWeak(tl) && dt <= WORLD.drain_range) { s.state = "drain"; s.drainTicks = 0; }
          else {
            const [ux, uz] = unit2(tl.pos[0] - ox, tl.pos[2] - oz);
            const [nx, nz] = slide(g, ox, oz, ox + ux * Math.min(step, dt), oz + uz * Math.min(step, dt), foot, false);
            s.pos[0] = nx; s.pos[2] = nz;
          }
        } else {
          if (s.wanderTicks <= 0) { s.heading = g.rng() * 2 * Math.PI; s.wanderTicks = 90; }
          s.wanderTicks--;
          const [nx, nz] = slide(g, ox, oz, ox + Math.cos(s.heading) * step, oz + Math.sin(s.heading) * step, foot, false);
          if (nx === ox && nz === oz) s.wanderTicks = 0;
          s.pos[0] = nx; s.pos[2] = nz;
        }
      }
      }
    }
    // vùng an toàn của đèn đã sáng
    for (const l of g.lanterns) {
      if (!hasZone(l)) continue;
      const dAfter = Math.hypot(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
      if (dAfter >= R) continue;
      const dBefore = Math.hypot(ox - l.pos[0], oz - l.pos[2]);
      const edge = R + WORLD.zone_margin;
      if (dBefore >= R) {
        const [ux, uz] = unit2(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
        s.pos[0] = l.pos[0] + ux * edge; s.pos[2] = l.pos[2] + uz * edge;
      } else {
        const [ux, uz] = unit2(ox - l.pos[0], oz - l.pos[2]);
        const nd = Math.min(dBefore + WORLD.zone_push_per_tick, edge);
        s.pos[0] = l.pos[0] + ux * nd; s.pos[2] = l.pos[2] + uz * nd;
        s.grace = true;
      }
    }
    s.pos[1] = groundFor(g.night, s.pos[0], s.pos[2], foot) + s.yOff;
  }
  for (const d of g.drifters) {
    if (d.state === "removed") continue;
    if (d.state === "idle" || d.state === "chase") {
      const near = p.carried >= WORLD.drifter_trigger_carried && dist2d(d.pos, p.pos) <= WORLD.drifter_trigger_dist;
      d.state = near ? "chase" : "idle";
    }
    if (d.state === "chase") {
      const [ux, uz] = unit2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
      d.pos[0] += ux * WORLD.drifter_speed * DT; d.pos[2] += uz * WORLD.drifter_speed * DT;
    } else if (d.state === "flee") {
      d.pos[0] += d.dx * WORLD.drifter_speed * DT; d.pos[2] += d.dz * WORLD.drifter_speed * DT;
    } else {
      if (--d.ticksLeft <= 0) { d.heading = g.rng() * 2 * Math.PI; d.ticksLeft = 120; }
      let hx = Math.cos(d.heading), hz = Math.sin(d.heading);
      if (g.night.heightAt(d.pos[0] + hx, d.pos[2] + hz) === -Infinity) [hx, hz] = unit2(-d.pos[0], -d.pos[2]);
      d.pos[0] += hx * WORLD.drifter_idle_speed * DT; d.pos[2] += hz * WORLD.drifter_idle_speed * DT;
    }
  }
  g.drifters = g.drifters.filter((d) => d.state !== "removed");

  // 9. chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (id tăng dần)
  if (p.fallWait === 0) {
    for (const d of [...g.drifters].sort(byId)) {
      if (d.state !== "chase" || d.stole) continue;
      if (dist2d(d.pos, p.pos) <= WORLD.drifter_steal_radius && p.carried > 0) {
        const amount = Math.min(WORLD.drifter_steal_amount, p.carried);
        p.carried -= amount;
        d.stolen = amount; d.stole = true; d.state = "flee"; d.ticksLeft = WORLD.drifter_flee_ticks;
        [d.dx, d.dz] = unit2(d.pos[0] - p.pos[0], d.pos[2] - p.pos[2]);
        emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    for (const s of [...g.shades].sort(byId)) {
      if (s.state !== "chase" && s.state !== "wander") continue;
      if (s.grace) continue;
      const foot = s.pos[1] - s.yOff;
      if (dist2d(s.pos, p.pos) > T.shade_hit_radius || Math.abs(foot - p.pos[1]) > WORLD.touch_height) continue;
      if (p.invuln > 0) continue; // chạm lúc bất tử không làm gì
      p.flames--;
      p.invuln = INVULN;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      dropMotes(g, dropped, p.pos[0], p.pos[2], p.pos[1], WORLD.mote_drop_r_min, WORLD.mote_drop_r_max);
      s.state = "recoil";
      s.ticksLeft = WORLD.shade_recoil_ticks;
      pushShade(s, s.pos[0] - p.pos[0], s.pos[2] - p.pos[2], WORLD.shade_recoil_ticks, WORLD.shade_recoil_m);
      emit("player_hit", { by: "shade", flames: p.flames, dropped });
      break; // tối đa 1 lần mất Ngọn Lửa mỗi tick
    }
  }

  // 10. sinh theo lịch (thực thể mới chỉ tương tác được từ tick sau)
  if (g.randomMotes && sim % WORLD.mote_spawn_every === 0 && g.motes.length < WORLD.mote_cap) {
    const empty = g.night.moteSpots.filter((sp) => !g.motes.some((m) => Math.hypot(m.pos[0] - sp[0], m.pos[2] - sp[2]) < 0.05 && Math.abs(m.pos[1] - sp[1]) < 0.05));
    if (empty.length) {
      const sp = empty[Math.floor(g.rng() * empty.length)];
      const [id, next] = freshId("M", g.nextMote, new Set(g.motes.map((m) => m.id)));
      g.nextMote = next;
      g.motes.push({ id, pos: [...sp] as Vec3, kind: "random", ttl: null });
    }
  }
  if (g.randomShades) {
    const first = WORLD.shade_first_tick;
    let count = 0;
    if (sim === first) count = WORLD.shade_first_count;
    else if (sim > first && (sim - first) % g.night.shadeInterval === 0) count = 1;
    for (let i = 0; i < count && g.shades.length < g.night.shadeMax; i++) {
      const valid = g.night.shadeSpots.filter(
        (sp) => dist2d(sp, p.pos) >= WORLD.shade_min_player_dist && !g.shades.some((s) => Math.hypot(s.pos[0] - sp[0], s.pos[2] - sp[2]) < 1),
      );
      if (!valid.length) continue;
      const sp = valid[Math.floor(g.rng() * valid.length)];
      const [id, next] = freshId("S", g.nextShade, new Set(g.shades.map((s) => s.id)));
      g.nextShade = next;
      const h = groundFor(g.night, sp[0], sp[2], 0);
      g.shades.push({
        id, pos: [sp[0], h + WORLD.shade_center_height, sp[2]], yOff: WORLD.shade_center_height,
        state: "spawning", ticksLeft: WORLD.shade_spawning_ticks,
        pushTicks: 0, pushStep: 0, pushDx: 1, pushDz: 0, heading: 0, wanderTicks: 0, grace: false,
        target: null, drainTicks: 0,
      });
      emit("shade_spawned", { id });
    }
  }
  if (g.night.drifters && g.randomDrifters && sim % WORLD.drifter_spawn_every === 0 && g.drifters.length < WORLD.drifter_max) {
    const sp = g.night.shadeSpots[Math.floor(g.rng() * g.night.shadeSpots.length)];
    const [id, next] = freshId("D", g.nextDrifter, new Set(g.drifters.map((d) => d.id)));
    g.nextDrifter = next;
    g.drifters.push({
      id, pos: [sp[0], groundFor(g.night, sp[0], sp[2], 0) + 1, sp[2]], state: "idle", stolen: 0, ticksLeft: 0,
      dx: 1, dz: 0, heading: g.rng() * 2 * Math.PI, stole: false,
    });
  }

  // 11. thắng / thua (sau mọi cập nhật): hết Ngọn Lửa luôn thua trước; hết giờ (bình minh) thì đủ đèn sáng mới thắng
  const left = timeLeft(g);
  let result: "won" | "lost" | null = null;
  let reason = "";
  if (p.flames <= 0) { result = "lost"; reason = "no_flames"; }
  else if (left <= 1e-9) {
    const lit = g.lanterns.filter((l) => l.lit);
    if (lit.length >= winNeed(g.lanterns.length)) {
      result = "won"; reason = "dawn_survived";
      for (const l of lit) g.score += T.score.per_lit_lantern_dawn + Math.floor(l.fuelU / TICKS_PER_SECOND);
      g.score += T.score.per_flame_left * p.flames;
    } else { result = "lost"; reason = "dawn"; }
  }
  if (result) {
    g.state = result;
    emit("game_over", { result, reason });
  }
  return ev;
}

const r3 = (x: number) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v;
};
const v3 = (v: Vec3) => [r3(v[0]), r3(v[1]), r3(v[2])];

export function snapshot(g: Game): Record<string, unknown> {
  const p = g.player;
  return {
    type: "snapshot",
    tick: g.tick,
    sim_tick: g.sim,
    state: g.paused ? "paused" : g.state,
    night: g.night.night,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: windActive(g), dir_deg: r3(g.windDir) },
    player: {
      pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried,
      invuln: p.invuln, dash_cd_s: r3(p.dashCd / TICKS_PER_SECOND), pulse_cd_s: r3(p.pulseCd / TICKS_PER_SECOND),
      charm_s: r3(p.charm / TICKS_PER_SECOND), capacity: capacityOf(p),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited, fuel: fuelOut(l), ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state, state_ticks_left: s.ticksLeft, target_lantern_id: s.target })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: r3(c.respawn / TICKS_PER_SECOND) })),
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICKS_PER_SECOND) })),
    motes_active: g.motes.length,
  };
}
