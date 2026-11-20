import { DRIFTER_STATES, SHADE_STATES } from "./types.ts";
import type { DrifterState, InputFrame, Scenario, ShadeState, Vec3 } from "./types.ts";

/** File inputs/scenario sai định dạng -> headless thoát mã 2. */
export class FormatError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNonNeg = (v: unknown): v is number => isNum(v) && v >= 0;

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what}: JSON không hợp lệ (${(e as Error).message})`);
  }
}

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) {
    throw new FormatError(`${where}: phải là mảng 3 số [x, y, z]`);
  }
  return [v[0], v[1], v[2]];
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new FormatError(`${where}: phải là mảng`);
  return v;
}

function obj(v: unknown, where: string): Obj {
  if (!isObj(v)) throw new FormatError(`${where}: phải là object`);
  return v;
}

function optId(o: Obj, where: string): string | undefined {
  if (o.id === undefined) return undefined;
  if (typeof o.id !== "string") throw new FormatError(`${where}.id: phải là chuỗi`);
  return o.id;
}

function optNonNeg(o: Obj, key: string, where: string): number | undefined {
  if (o[key] === undefined) return undefined;
  if (!isNonNeg(o[key])) throw new FormatError(`${where}.${key}: phải là số >= 0`);
  return o[key] as number;
}

export function parseInputs(text: string): InputFrame[] {
  const root = parseJson(text, "inputs");
  if (!isObj(root)) throw new FormatError("inputs: phải là object");
  if (root.frames === undefined) return [];
  const out: InputFrame[] = [];
  let last = -1;
  arr(root.frames, "inputs.frames").forEach((raw, i) => {
    const w = `inputs.frames[${i}]`;
    const f = obj(raw, w);
    if (!Number.isInteger(f.tick) || (f.tick as number) < 0) throw new FormatError(`${w}.tick: phải là số nguyên >= 0`);
    const tick = f.tick as number;
    if (tick <= last) throw new FormatError(`${w}.tick: phải tăng nghiêm ngặt (${tick} <= ${last})`);
    last = tick;
    const fr: InputFrame = { tick };
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) {
        throw new FormatError(`${w}.move: phải là mảng 2 số [x, z]`);
      }
      fr.move = [f.move[0], f.move[1]];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) throw new FormatError(`${w}.cam_yaw_deg: phải là số`);
      fr.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ["jump", "interact", "pulse", "dash", "pause"] as const) {
      if (f[k] !== undefined) {
        if (typeof f[k] !== "boolean") throw new FormatError(`${w}.${k}: phải là boolean`);
        fr[k] = f[k];
      }
    }
    out.push(fr);
  });
  return out;
}

export function parseScenario(text: string): Scenario {
  const root = parseJson(text, "scenario");
  if (!isObj(root)) throw new FormatError("scenario: phải là object");
  const sc: Scenario = {};
  if (root.player !== undefined) {
    const p = obj(root.player, "scenario.player");
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, "scenario.player.pos");
    for (const k of ["carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks", "successful_lights"] as const) {
      const v = optNonNeg(p, k, "scenario.player");
      if (v !== undefined) sc.player[k] = v;
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"] as const) {
    if (root[k] !== undefined) {
      if (typeof root[k] !== "boolean") throw new FormatError(`scenario.${k}: phải là boolean`);
      sc[k] = root[k];
    }
  }
  if (root.motes !== undefined) {
    sc.motes = arr(root.motes, "scenario.motes").map((m, i) => {
      const w = `scenario.motes[${i}]`;
      if (Array.isArray(m)) return { pos: vec3(m, w) };
      const o = obj(m, w);
      const mote: NonNullable<Scenario["motes"]>[number] = { pos: vec3(o.pos, `${w}.pos`) };
      if (o.kind !== undefined) {
        if (o.kind !== "random" && o.kind !== "dropped") throw new FormatError(`${w}.kind: phải là random hoặc dropped`);
        mote.kind = o.kind;
      }
      const ttl = optNonNeg(o, "ttl_ticks", w);
      if (ttl !== undefined) mote.ttl_ticks = ttl;
      return mote;
    });
  }
  if (root.shades !== undefined) {
    sc.shades = arr(root.shades, "scenario.shades").map((s, i) => {
      const w = `scenario.shades[${i}]`;
      const o = obj(s, w);
      const sh: NonNullable<Scenario["shades"]>[number] = { pos: vec3(o.pos, `${w}.pos`) };
      const id = optId(o, w);
      if (id !== undefined) sh.id = id;
      if (o.state !== undefined) {
        if (!SHADE_STATES.includes(o.state as ShadeState)) {
          throw new FormatError(`${w}.state: phải là một trong ${SHADE_STATES.join(", ")}`);
        }
        sh.state = o.state as ShadeState;
      }
      const t = optNonNeg(o, "state_ticks_left", w);
      if (t !== undefined) sh.state_ticks_left = t;
      if (o.target_lantern_id !== undefined) {
        if (typeof o.target_lantern_id !== "string") throw new FormatError(`${w}.target_lantern_id: phải là chuỗi`);
        sh.target_lantern_id = o.target_lantern_id;
      }
      return sh;
    });
  }
  if (root.drifters !== undefined) {
    sc.drifters = arr(root.drifters, "scenario.drifters").map((d, i) => {
      const w = `scenario.drifters[${i}]`;
      const o = obj(d, w);
      const dr: NonNullable<Scenario["drifters"]>[number] = { pos: vec3(o.pos, `${w}.pos`) };
      const id = optId(o, w);
      if (id !== undefined) dr.id = id;
      if (o.state !== undefined) {
        if (!DRIFTER_STATES.includes(o.state as DrifterState)) {
          throw new FormatError(`${w}.state: phải là một trong ${DRIFTER_STATES.join(", ")}`);
        }
        dr.state = o.state as DrifterState;
      }
      const stolen = optNonNeg(o, "stolen", w);
      if (stolen !== undefined) dr.stolen = stolen;
      const t = optNonNeg(o, "state_ticks_left", w);
      if (t !== undefined) dr.state_ticks_left = t;
      return dr;
    });
  }
  if (root.charms !== undefined) {
    sc.charms = arr(root.charms, "scenario.charms").map((c, i) => {
      const w = `scenario.charms[${i}]`;
      const o = obj(c, w);
      const ch: NonNullable<Scenario["charms"]>[number] = {};
      const id = optId(o, w);
      if (id !== undefined) ch.id = id;
      if (o.pos !== undefined) ch.pos = vec3(o.pos, `${w}.pos`);
      if (o.available !== undefined) {
        if (typeof o.available !== "boolean") throw new FormatError(`${w}.available: phải là boolean`);
        ch.available = o.available;
      }
      const rt = optNonNeg(o, "respawn_ticks", w);
      if (rt !== undefined) ch.respawn_ticks = rt;
      return ch;
    });
  }
  if (root.lanterns !== undefined) {
    sc.lanterns = arr(root.lanterns, "scenario.lanterns").map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      const o = obj(l, w);
      if (typeof o.id !== "string") throw new FormatError(`${w}.id: phải là chuỗi`);
      const out: NonNullable<Scenario["lanterns"]>[number] = { id: o.id };
      if (o.pos !== undefined) out.pos = vec3(o.pos, `${w}.pos`);
      const dep = optNonNeg(o, "deposited", w);
      if (dep !== undefined) out.deposited = dep;
      if (o.lit !== undefined) {
        if (typeof o.lit !== "boolean") throw new FormatError(`${w}.lit: phải là boolean`);
        out.lit = o.lit;
      }
      if (o.ever_lit !== undefined) {
        if (typeof o.ever_lit !== "boolean") throw new FormatError(`${w}.ever_lit: phải là boolean`);
        out.ever_lit = o.ever_lit;
      }
      if (o.fuel !== undefined) {
        if (!isNum(o.fuel) || o.fuel < 0 || o.fuel > 100) throw new FormatError(`${w}.fuel: phải là số từ 0 đến 100`);
        out.fuel = o.fuel;
      }
      return out;
    });
  }
  if (root.time_left_s !== undefined) {
    if (!isNonNeg(root.time_left_s)) throw new FormatError("scenario.time_left_s: phải là số >= 0");
    sc.time_left_s = root.time_left_s;
  }
  return sc;
}
