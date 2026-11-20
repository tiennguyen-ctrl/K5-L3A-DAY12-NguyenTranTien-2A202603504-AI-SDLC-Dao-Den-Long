import type { InputFrame, Scenario, Vec3 } from "./types.ts";

/** File inputs/scenario sai định dạng -> headless thoát mã 2. */
export class FormatError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

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

export function parseInputs(text: string): InputFrame[] {
  const root = parseJson(text, "inputs");
  if (!isObj(root)) throw new FormatError("inputs: phải là object");
  if (root.frames === undefined) return [];
  if (!Array.isArray(root.frames)) throw new FormatError("inputs.frames: phải là mảng");
  const out: InputFrame[] = [];
  let last = -1;
  root.frames.forEach((f: unknown, i: number) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) throw new FormatError(`${w}: phải là object`);
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
    for (const k of ["jump", "interact", "pulse"] as const) {
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
    const p = root.player;
    if (!isObj(p)) throw new FormatError("scenario.player: phải là object");
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, "scenario.player.pos");
    if (p.carried !== undefined) {
      if (!isNum(p.carried) || p.carried < 0) throw new FormatError("scenario.player.carried: phải là số >= 0");
      sc.player.carried = p.carried;
    }
    if (p.flames !== undefined) {
      if (!isNum(p.flames) || p.flames < 0) throw new FormatError("scenario.player.flames: phải là số >= 0");
      sc.player.flames = p.flames;
    }
  }
  for (const k of ["random_motes", "random_shades"] as const) {
    if (root[k] !== undefined) {
      if (typeof root[k] !== "boolean") throw new FormatError(`scenario.${k}: phải là boolean`);
      sc[k] = root[k];
    }
  }
  if (root.motes !== undefined) {
    if (!Array.isArray(root.motes)) throw new FormatError("scenario.motes: phải là mảng");
    sc.motes = root.motes.map((m: unknown, i: number) => vec3(m, `scenario.motes[${i}]`));
  }
  if (root.shades !== undefined) {
    if (!Array.isArray(root.shades)) throw new FormatError("scenario.shades: phải là mảng");
    sc.shades = root.shades.map((s: unknown, i: number) => {
      if (!isObj(s)) throw new FormatError(`scenario.shades[${i}]: phải là object`);
      const sh: { id?: string; pos: Vec3 } = { pos: vec3(s.pos, `scenario.shades[${i}].pos`) };
      if (s.id !== undefined) {
        if (typeof s.id !== "string") throw new FormatError(`scenario.shades[${i}].id: phải là chuỗi`);
        sh.id = s.id;
      }
      return sh;
    });
  }
  if (root.lanterns !== undefined) {
    if (!Array.isArray(root.lanterns)) throw new FormatError("scenario.lanterns: phải là mảng");
    sc.lanterns = root.lanterns.map((l: unknown, i: number) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l)) throw new FormatError(`${w}: phải là object`);
      if (typeof l.id !== "string") throw new FormatError(`${w}.id: phải là chuỗi`);
      const o: NonNullable<Scenario["lanterns"]>[number] = { id: l.id };
      if (l.pos !== undefined) o.pos = vec3(l.pos, `${w}.pos`);
      if (l.deposited !== undefined) {
        if (!isNum(l.deposited) || l.deposited < 0) throw new FormatError(`${w}.deposited: phải là số >= 0`);
        o.deposited = l.deposited;
      }
      if (l.lit !== undefined) {
        if (typeof l.lit !== "boolean") throw new FormatError(`${w}.lit: phải là boolean`);
        o.lit = l.lit;
      }
      return o;
    });
  }
  if (root.time_left_s !== undefined) {
    if (!isNum(root.time_left_s) || root.time_left_s < 0) throw new FormatError("scenario.time_left_s: phải là số >= 0");
    sc.time_left_s = root.time_left_s;
  }
  return sc;
}
