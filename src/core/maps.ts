import { T } from "./constants.ts";
import type { Vec3 } from "./types.ts";

export interface Pad {
  pos: Vec3;
  r: number;
  vy: number;
  hv: number;
  /** hướng ngang đơn vị (đã tính sẵn) */
  dir: [number, number];
}

export interface NightDef {
  night: 1 | 2 | 3;
  name: string;
  durationS: number;
  shadeSpeed: number;
  start: Vec3;
  lanterns: { id: string; pos: Vec3 }[];
  moteSpots: Vec3[];
  shadeSpots: Vec3[];
  charms: { id: string; pos: Vec3 }[];
  pads: Pad[];
  shadeInterval: number;
  shadeMax: number;
  drifters: boolean;
  wind: boolean;
  /** Chiều cao mặt đất tại (x,z); -Infinity = biển mây (rơi). */
  heightAt(x: number, z: number): number;
}

const DEG = Math.PI / 180;
/** (x, z) = (cx + r cos θ, cz + r sin θ), θ đo từ +X về phía +Z. */
const pol = (cx: number, cz: number, r: number, deg: number, y = 0): Vec3 => [
  cx + r * Math.cos(deg * DEG),
  y,
  cz + r * Math.sin(deg * DEG),
];
const ring = (cx: number, cz: number, r: number, start: number, step: number, count: number, y = 0): Vec3[] =>
  Array.from({ length: count }, (_, i) => pol(cx, cz, r, start + i * step, y));
const lanternsOf = (list: Vec3[]) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));
const unit = (x: number, z: number): [number, number] => {
  const d = Math.hypot(x, z);
  return [x / d, z / d];
};

function night1(): NightDef {
  const h = (x: number, z: number) => (Math.hypot(x, z) <= 40 ? 0 : -Infinity);
  return {
    night: 1,
    name: "Đảo Bến",
    durationS: T.night1_duration_s,
    shadeSpeed: T.shade_speed,
    start: [0, 0, 0],
    lanterns: lanternsOf([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    moteSpots: [...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)],
    shadeSpots: ring(0, 0, 37, 15, 30, 12),
    charms: [],
    pads: [],
    shadeInterval: 480,
    shadeMax: 6,
    drifters: false,
    wind: false,
    heightAt: h,
  };
}

function night2(): NightDef {
  const A: [number, number] = [0, 0], B: [number, number] = [70, 0];
  const h = (x: number, z: number) => {
    if (Math.hypot(x - A[0], z - A[1]) <= 28 || Math.hypot(x - B[0], z - B[1]) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return -Infinity;
  };
  const isl = (c: [number, number]) => [
    ...ring(c[0], c[1], 10, 0, 90, 4),
    ...ring(c[0], c[1], 22, 0, 45, 8),
  ];
  return {
    night: 2,
    name: "Đảo Cau",
    durationS: T.night2_duration_s,
    shadeSpeed: T.shade_speed,
    start: [0, 0, 0],
    lanterns: lanternsOf([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    moteSpots: [...isl(A), ...isl(B)],
    shadeSpots: [...ring(A[0], A[1], 26, 22.5, 45, 8), ...ring(B[0], B[1], 26, 22.5, 45, 8)],
    charms: [{ id: "C1", pos: [35, 0, 0] }],
    pads: [
      { pos: [20, 0, 18], r: 1, vy: 14, hv: 24, dir: unit(B[0] - 20, B[1] - 18) },
      { pos: [50, 0, -18], r: 1, vy: 14, hv: 24, dir: unit(A[0] - 50, A[1] + 18) },
    ],
    shadeInterval: 420,
    shadeMax: 8,
    drifters: true,
    wind: false,
    heightAt: h,
  };
}

function night3(): NightDef {
  const ramps = [30, 150].map((deg) => ({ c: Math.cos(deg * DEG), s: Math.sin(deg * DEG) }));
  const h = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    let y = r <= 45 ? 0 : -Infinity;
    if (y === -Infinity) return y;
    if (z > 0 && r >= 12 && r <= 24) y = Math.max(y, 3); // tầng 1
    if (r <= 8) y = Math.max(y, 6); // tầng 2
    if (r <= 2) y = Math.max(y, 14); // tháp chuông (khối đặc cao 8 m trên tầng 2)
    for (const rp of ramps) {
      const along = x * rp.c + z * rp.s;
      const lat = Math.abs(-x * rp.s + z * rp.c);
      if (along >= 24 && along <= 30 && lat <= 1.5) y = Math.max(y, (30 - along) / 2); // dốc: Y=0 ở 30 m, Y=3 ở 24 m
    }
    return y;
  };
  return {
    night: 3,
    name: "Đảo Chuông",
    durationS: T.night3_duration_s,
    shadeSpeed: T.shade_speed_night3,
    start: [0, 0, -30],
    lanterns: lanternsOf([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    moteSpots: [
      ...ring(0, 0, 34, 0, 20, 18),
      ...ring(0, 0, 18, 20, 20, 8, 3),
      ...ring(0, 0, 5, 45, 90, 4, 6),
    ],
    shadeSpots: ring(0, 0, 43, 0, 22.5, 16),
    charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
    pads: [{ pos: [0, 3, 13], r: 1, vy: 12, hv: 8, dir: [0, -1] }],
    shadeInterval: 360,
    shadeMax: 10,
    drifters: true,
    wind: true,
    heightAt: h,
  };
}

export function getNight(n: number): NightDef {
  if (n === 1) return night1();
  if (n === 2) return night2();
  if (n === 3) return night3();
  throw new RangeError(`night phải là 1, 2 hoặc 3 (nhận ${n})`);
}
