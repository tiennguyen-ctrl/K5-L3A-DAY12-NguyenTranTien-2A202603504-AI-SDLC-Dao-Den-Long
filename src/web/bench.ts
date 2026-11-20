/**
 * Cảnh benchmark chuẩn (Ticket-04), phần thuần: dựng scenario, đường bay camera, tính số đo.
 * Phần vẽ nằm ở main.ts; launcher (scripts/bench.ts) mở trình duyệt, nhận kết quả và ghi bench.json.
 */
import type { Scenario } from "../core/types.ts";
import { makeRng } from "../core/rng.ts";

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
export const BENCH_WARMUP_S = 3;
export const CAM_RADIUS = 30;
export const CAM_HEIGHT = 15;
export const CAM_PERIOD_S = 15;

/** n điểm rải đều trên đĩa bán kính R (hoa hướng dương/góc vàng), xoay theo seed; kể cả điểm tâm. */
export function spreadOnDisk(n: number, radius: number, seed: number): [number, number][] {
  const rng = makeRng(seed);
  const offset = rng() * 2 * Math.PI;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const r = radius * Math.sqrt((i + 0.5) / n);
    const a = offset + i * golden;
    return [Math.round(r * Math.cos(a) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000];
  });
}

/**
 * Scenario của cảnh bench: đúng 200 Bóng Mực wander + đúng 100 đom đóm rải đều trên đảo Đêm 1 (bán kính 40),
 * 3 đèn L1–L3 sáng fuel 100, Mây đứng ở (0,0,0), mọi sinh ngẫu nhiên và gió tắt.
 */
export function benchScenario(seed: number): Scenario {
  const shades = spreadOnDisk(BENCH_SHADES, 37, seed).map(([x, z], i) => ({ id: `S${i + 1}`, pos: [x, 1, z] as [number, number, number], state: "wander" as const }));
  const motes = spreadOnDisk(BENCH_MOTES, 35, seed + 1).map(([x, z]) => ({ pos: [x, 0, z] as [number, number, number] }));
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    motes, shades, drifters: [], charms: [],
    lanterns: [{ id: "L1", lit: true, fuel: 100 }, { id: "L2", lit: true, fuel: 100 }, { id: "L3", lit: true, fuel: 100 }],
  };
}

/**
 * Camera bay vòng tròn tâm (0,0,0), bán kính 30 m, Y = 15 m, 15 s một vòng, xuất phát ở (30,15,0),
 * ngược chiều kim đồng hồ khi nhìn từ trên xuống (+Y nhìn xuống, +X sang phải, +Z xuống dưới màn hình:
 * từ +X đi lên màn hình tức là về phía -Z). Giả định ghi ở docs/notes/phase4-spec.md.
 */
export function cameraAt(tSec: number): [number, number, number] {
  const th = (2 * Math.PI * tSec) / CAM_PERIOD_S;
  return [CAM_RADIUS * Math.cos(th), CAM_HEIGHT, 0 - CAM_RADIUS * Math.sin(th)]; // "0 -" để t = 0 cho đúng +0 chứ không phải -0
}

export interface BenchStats { frames: number; avg_fps: number; p1_low_fps: number; frame_ms_p95: number }

/** dt: thời gian từng khung (ms) trong khoảng đo. Công thức theo ticket. */
export function benchStats(dt: number[]): BenchStats {
  const n = dt.length;
  if (n === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dt.reduce((a, b) => a + b, 0);
  const desc = [...dt].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = desc.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const asc = [...dt].sort((a, b) => a - b);
  const p95 = asc[Math.min(n - 1, Math.ceil(0.95 * n) - 1)]; // phân vị theo hạng gần nhất
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return { frames: n, avg_fps: r1((1000 * n) / sum), p1_low_fps: r1(1000 / worst), frame_ms_p95: r1(p95) };
}
