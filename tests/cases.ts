import assert from "node:assert/strict";
import { T } from "../src/core/constants.ts";
import type { Scenario } from "../src/core/types.ts";

type Line = Record<string, any>;
export interface Case {
  name: string;
  proves: string;
  seed: number;
  ticks: number;
  scenario?: Scenario;
  inputs?: { frames: Record<string, unknown>[] };
  check: (lines: Line[]) => void;
}

export const parse = (jsonl: string[] | string): Line[] =>
  (Array.isArray(jsonl) ? jsonl : jsonl.split("\n").filter(Boolean)).map((l) => JSON.parse(l));
const events = (L: Line[], name: string) => L.filter((l) => l.type === "event" && l.name === name);
const snap = (L: Line[], tick: number) => {
  const s = L.find((l) => l.type === "snapshot" && l.tick === tick);
  assert.ok(s, `thiếu snapshot tick ${tick}`);
  return s;
};
const endLine = (L: Line[]) => L[L.length - 1];
const near = (a: number, b: number, eps = 0.002) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const V = T.player_speed / 60; // mét mỗi tick

/** Nền: không sinh ngẫu nhiên, không đom đóm / Bóng Mực trừ khi nêu. */
const base = (o: Scenario = {}): Scenario => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...o });
const litExcept = (id: string) =>
  ["L1", "L2", "L3", "L4", "L5"].filter((x) => x !== id).map((x) => ({ id: x, lit: true }));

export const CASES: Case[] = [
  {
    name: "move_yaw",
    proves: "Hướng di chuyển theo cam_yaw_deg: yaw 90 + move [1,0] đi về -Z, tốc độ player_speed",
    seed: 1, ticks: 60,
    scenario: base(),
    inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }] },
    check: (L) => {
      const p = snap(L, 60).player.pos;
      near(p[0], 0); near(p[2], -T.player_speed);
    },
  },
  {
    name: "move_normalized",
    proves: "Vector move dài hơn 1 được chuẩn hóa (đi chéo không nhanh hơn)",
    seed: 1, ticks: 60,
    scenario: base(),
    inputs: { frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 0 }] },
    check: (L) => {
      const p = snap(L, 60).player.pos;
      near(Math.hypot(p[0], p[2]), T.player_speed);
      near(p[0], p[2]);
    },
  },
  {
    name: "jump",
    proves: "Nhảy: Y > 0 khi ở trên không, rồi về lại Y = 0 (mặt đất)",
    seed: 1, ticks: 60,
    scenario: base(),
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }] },
    check: (L) => {
      assert.ok(snap(L, 10).player.pos[1] > 0.5);
      assert.equal(snap(L, 60).player.pos[1], 0);
    },
  },
  {
    name: "jump_edge",
    proves: "Nhảy chỉ kích hoạt ở cạnh false->true: giữ nút nhảy không nhảy liên tục",
    seed: 1, ticks: 120,
    scenario: base(),
    inputs: { frames: [{ tick: 0, jump: true }] },
    check: (L) => {
      assert.ok(snap(L, 10).player.pos[1] > 0.5);
      assert.equal(snap(L, 60).player.pos[1], 0);
      assert.equal(snap(L, 110).player.pos[1], 0);
    },
  },
  {
    name: "pickup_mote",
    proves: "Nhặt đom đóm khi vào pickup_radius; +per_mote điểm; motes_active giảm",
    seed: 1, ticks: 60,
    scenario: base({ motes: [[0, 0, 5]] }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const ev = events(L, "mote_picked");
      assert.equal(ev.length, 1);
      assert.deepEqual(ev[0].data, { carried: 1 });
      const need = Math.ceil((5 - T.pickup_radius) / V);
      assert.ok(Math.abs(ev[0].tick - need) <= 1, `tick ${ev[0].tick}, mong ${need}`);
      assert.equal(snap(L, 60).score, T.score.per_mote);
      assert.equal(snap(L, 60).motes_active, 0);
    },
  },
  {
    name: "carry_capacity",
    proves: "Không mang quá carry_capacity; đom đóm thừa ở lại trên đất",
    seed: 1, ticks: 10,
    scenario: base({ motes: Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 1] as [number, number, number]) }),
    check: (L) => {
      assert.equal(events(L, "mote_picked").length, T.carry_capacity);
      assert.equal(snap(L, 10).player.carried, T.carry_capacity);
      assert.equal(snap(L, 10).motes_active, 2);
    },
  },
  {
    name: "deposit_partial",
    proves: "Nạp một phần: deposit đúng amount/deposited, chưa sáng nên chưa có lantern_lit",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 23], carried: 3 } }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: 3, deposited: 3 });
      assert.equal(events(L, "lantern_lit").length, 0);
      assert.equal(snap(L, 0).player.carried, 3);
    },
  },
  {
    name: "deposit_lit",
    proves: "Đủ lantern_cost thì đèn sáng, +per_lantern, chưa thắng khi còn đèn khác",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 23], carried: T.lantern_cost } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: T.lantern_cost, deposited: T.lantern_cost });
      assert.deepEqual(events(L, "lantern_lit")[0].data, { lantern_id: "L1" });
      assert.equal(endLine(L).score, T.score.per_lantern);
      assert.equal(endLine(L).state, "playing");
    },
  },
  {
    name: "deposit_out_of_range",
    proves: "Ngoài interact_radius thì interact không nạp được",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 25 - T.interact_radius - 1], carried: 3 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => assert.equal(events(L, "deposit").length, 0),
  },
  {
    name: "win_all_lit",
    proves: "Thắp hết đèn thì thắng (all_lit); điểm = per_lantern + thưởng giờ + thưởng flames; dựng scenario không cộng điểm",
    seed: 1, ticks: 600,
    scenario: base({ player: { pos: [0, 0, 23], carried: T.lantern_cost }, lanterns: litExcept("L1"), time_left_s: 300 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(snap(L, 0).score, 0, "đèn đặt sẵn lit không được cộng điểm");
      assert.equal(events(L, "lantern_lit").length, 1);
      assert.deepEqual(events(L, "game_over")[0].data, { result: "won", reason: "all_lit" });
      const e = endLine(L);
      assert.equal(e.state, "won");
      assert.equal(e.ticks, 1);
      assert.equal(e.score, T.score.per_lantern + T.score.per_second_left * 299 + T.score.per_flame_left * T.flames);
    },
  },
  {
    name: "shade_hit_drop_invuln",
    proves: "Bị chạm: flames -1, đánh rơi floor(carried*hit_drop_ratio) đom đóm, rồi bất tử invuln_s",
    seed: 1, ticks: 200,
    scenario: base({ player: { pos: [0, 0, 0], carried: 4 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }),
    check: (L) => {
      const hits = events(L, "player_hit");
      assert.deepEqual(hits[0].data, { by: "shade", flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
      assert.equal(hits[0].tick, 1);
      assert.equal(snap(L, 10).player.carried, 4 - Math.floor(4 * T.hit_drop_ratio));
      assert.equal(snap(L, 10).motes_active, Math.floor(4 * T.hit_drop_ratio));
      assert.ok(hits.length >= 2 && hits[1].tick - hits[0].tick >= Math.round(T.invuln_s * 60), "chạm lần 2 quá sớm");
    },
  },
  {
    name: "lose_no_flames",
    proves: "Hết flames thì thua (no_flames); end.state = lost; dừng sớm",
    seed: 1, ticks: 600,
    scenario: base({ player: { flames: 1 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }),
    check: (L) => {
      assert.deepEqual(events(L, "player_hit")[0].data, { by: "shade", flames: 0, dropped: 0 });
      assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "no_flames" });
      assert.equal(endLine(L).state, "lost");
      assert.equal(endLine(L).ticks, 1);
    },
  },
  {
    name: "lose_dawn",
    proves: "Hết giờ thì thua (dawn); time_left_s giảm đúng 1/60 mỗi tick",
    seed: 1, ticks: 600,
    scenario: base({ time_left_s: 1 }),
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "dawn" });
      assert.equal(endLine(L).ticks, 60);
      assert.equal(snap(L, 30).time_left_s, 0.5);
    },
  },
  {
    name: "pulse_stun",
    proves: "Tỏa sáng: tốn pulse_cost, làm choáng Bóng Mực trong pulse_radius, đẩy pulse_push_m, +per_stun; hết stun thì đuổi lại",
    seed: 1, ticks: 200,
    scenario: base({ player: { carried: 2 }, shades: [{ id: "S1", pos: [5, 0, 0] }, { id: "S2", pos: [30, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "pulse")[0].data, { stunned_ids: ["S1"] });
      assert.equal(snap(L, 10).player.carried, 2 - T.pulse_cost);
      assert.equal(snap(L, 10).score, T.score.per_stun);
      const s1 = snap(L, 10).shades.find((s: Line) => s.id === "S1");
      assert.equal(s1.state, "stunned");
      near(s1.pos[0], 5 + T.pulse_push_m);
      assert.equal(snap(L, 10).shades.find((s: Line) => s.id === "S2").state, "chase");
      assert.equal(snap(L, 170).shades.find((s: Line) => s.id === "S1").state, "stunned");
      assert.equal(snap(L, 190).shades.find((s: Line) => s.id === "S1").state, "chase");
    },
  },
  {
    name: "pulse_needs_light",
    proves: "Không đủ ánh sáng (carried < pulse_cost) thì không tỏa sáng được",
    seed: 1, ticks: 10,
    scenario: base({ player: { carried: 0 }, shades: [{ id: "S1", pos: [5, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => assert.equal(events(L, "pulse").length, 0),
  },
  {
    name: "pulse_cooldown_edge",
    proves: "Pulse kích hoạt ở cạnh false->true (giữ nút không lặp) và có hồi chiêu pulse_cooldown_s",
    seed: 1, ticks: 200,
    scenario: base({ player: { carried: 5 }, shades: [{ id: "S1", pos: [50, 0, 0] }] }),
    inputs: {
      frames: [
        { tick: 0, pulse: true }, { tick: 30, pulse: false }, { tick: 60, pulse: true },
        { tick: 70, pulse: false }, { tick: 130, pulse: true },
      ],
    },
    check: (L) => {
      const ticks = events(L, "pulse").map((e) => e.tick);
      assert.deepEqual(ticks, [1, 131]);
    },
  },
  {
    name: "safe_radius",
    proves: "Bóng Mực không bao giờ vào trong safe_radius quanh đèn (người chơi đứng cạnh đèn không bị chạm)",
    seed: 1, ticks: 600,
    scenario: base({ player: { pos: [0, 0, 25] }, shades: [{ id: "S1", pos: [12, 0, 25] }, { id: "S2", pos: [-12, 0, 25] }] }),
    check: (L) => {
      const lan = snap(L, 0).lanterns;
      for (const s of L.filter((l) => l.type === "snapshot")) {
        for (const sh of s.shades) for (const l of lan) {
          assert.ok(dist(sh.pos, l.pos) > T.safe_radius - 0.002, `tick ${s.tick}: ${sh.id} cách ${l.id} ${dist(sh.pos, l.pos)}`);
        }
      }
      assert.equal(events(L, "player_hit").length, 0);
    },
  },
  {
    name: "scenario_silent",
    proves: "Dựng scenario không phát sự kiện, không cộng điểm; random_* = false thì không sinh gì",
    seed: 1, ticks: 1200,
    scenario: base({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", lit: true }] }),
    check: (L) => {
      assert.equal(L.filter((l) => l.type === "event").length, 0);
      assert.equal(snap(L, 0).score, 0);
      assert.equal(snap(L, 1200).motes_active, 0);
      assert.equal(snap(L, 1200).shades.length, 0);
    },
  },
];
