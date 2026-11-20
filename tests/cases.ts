import assert from "node:assert/strict";
import { T } from "../src/core/constants.ts";

type Line = Record<string, any>;
type Json = Record<string, unknown>;
export interface Case {
  name: string;
  /** phase của yêu cầu mà kịch bản này kiểm (1/2 = hồi quy các phase trước, 3 = tính năng mới của Ticket-03) */
  phase: 1 | 2 | 3;
  night?: number;
  proves: string;
  seed: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: Json;
  inputs?: { frames: Json[] };
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
const snaps = (L: Line[]) => L.filter((l) => l.type === "snapshot");
const endLine = (L: Line[]) => L[L.length - 1];
const near = (a: number, b: number, eps = 0.002) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const V = T.player_speed / 60; // mét mỗi tick khi chạy

/** Nền: không sinh ngẫu nhiên, không gió, không đom đóm / bóng / Gió Lạc / bùa trừ khi nêu. */
const base = (o: Json = {}): Json => ({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [], ...o,
});
const litExcept = (ids: string[], except: string) => ids.filter((x) => x !== except).map((x) => ({ id: x, lit: true }));
const N1 = ["L1", "L2", "L3", "L4", "L5"];
const shadeOf = (L: Line, id: string) => L.shades.find((s: Line) => s.id === id);

export const CASES: Case[] = [
  // ================= Hồi quy Phase 1 (số chuẩn) =================
  {
    name: "move_yaw", phase: 1,
    proves: "Hướng di chuyển theo cam_yaw_deg: yaw 90 + move [1,0] đi về -Z với player_speed",
    seed: 1, ticks: 60, scenario: base(),
    inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }] },
    check: (L) => { const p = snap(L, 60).player.pos; near(p[0], 0); near(p[2], -T.player_speed); },
  },
  {
    name: "move_normalized", phase: 1,
    proves: "Vector move dài hơn 1 được chuẩn hóa (đi chéo không nhanh hơn)",
    seed: 1, ticks: 60, scenario: base(),
    inputs: { frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 0 }] },
    check: (L) => { const p = snap(L, 60).player.pos; near(Math.hypot(p[0], p[2]), T.player_speed); near(p[0], p[2]); },
  },
  {
    name: "jump", phase: 1,
    proves: "Nhảy 7 m/s, trọng lực -20: Y > 0 khi ở trên không, đỉnh ~1,2 m, rồi về Y = 0",
    seed: 1, ticks: 60, snapshotEvery: 1, scenario: base(),
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }] },
    check: (L) => {
      const ys = snaps(L).map((s) => s.player.pos[1]);
      const apex = Math.max(...ys);
      near(apex, (7 ** 2) / (2 * 20), 0.08); // ticket: nhảy 7 m/s, trọng lực -20 m/s²
      assert.equal(snap(L, 60).player.pos[1], 0);
      assert.equal(snap(L, 60).player.grounded, true);
      assert.equal(snap(L, 10).player.grounded, false);
    },
  },
  {
    name: "jump_edge", phase: 1,
    proves: "Nhảy kích hoạt ở cạnh false->true, chỉ khi chạm đất: giữ nút không nhảy liên tục",
    seed: 1, ticks: 120, scenario: base(),
    inputs: { frames: [{ tick: 0, jump: true }] },
    check: (L) => { assert.ok(snap(L, 10).player.pos[1] > 0.5); assert.equal(snap(L, 60).player.pos[1], 0); assert.equal(snap(L, 110).player.pos[1], 0); },
  },
  {
    name: "pickup_mote", phase: 1,
    proves: "Nhặt đom đóm khi vào pickup_radius (1,0 m); nhặt KHÔNG cộng điểm (điểm tính lúc nạp)",
    seed: 1, ticks: 60, scenario: base({ motes: [[0, 0, 5]] }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const ev = events(L, "mote_picked");
      assert.equal(ev.length, 1);
      assert.deepEqual(ev[0].data, { carried: 1 });
      const need = Math.ceil((5 - T.pickup_radius) / V);
      assert.ok(Math.abs(ev[0].tick - need) <= 1, `tick ${ev[0].tick}, mong ${need}`);
      assert.equal(snap(L, 60).score, 0);
      assert.equal(snap(L, 60).motes_active, 0);
    },
  },
  {
    name: "pickup_height", phase: 2,
    proves: "Nhặt cần chênh cao chân Mây - mặt đất đom đóm <= 1,5 m: đom đóm cao 3 m không nhặt được, cao 1,4 m thì được",
    seed: 1, ticks: 10, scenario: base({ motes: [[0, 3, 0.5], [0, 1.4, 0.5]] }),
    check: (L) => {
      assert.equal(events(L, "mote_picked").length, 1);
      assert.deepEqual(snap(L, 10).motes.map((m: Line) => m.id), ["M1"]);
    },
  },
  {
    name: "carry_capacity", phase: 1,
    proves: "Không mang quá carry_capacity (10); đom đóm thừa ở lại",
    seed: 1, ticks: 10,
    scenario: base({ motes: Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 0.5]) }),
    check: (L) => {
      assert.equal(events(L, "mote_picked").length, T.carry_capacity);
      assert.equal(snap(L, 10).player.carried, T.carry_capacity);
      assert.equal(snap(L, 10).motes_active, 2);
    },
  },
  {
    name: "deposit_partial", phase: 1,
    proves: "Nạp một phần, đèn nhớ tiến độ: deposit đúng amount/deposited, +10 điểm mỗi đom đóm nạp, chưa lantern_lit",
    seed: 1, ticks: 5, scenario: base({ player: { pos: [0, 0, 23.5], carried: 6 } }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: 6, deposited: 6 });
      assert.equal(events(L, "lantern_lit").length, 0);
      assert.equal(endLine(L).score, 6 * T.score.per_mote);
    },
  },
  {
    name: "deposit_resume", phase: 2,
    proves: "[P3 đổi: đèn sáng nhận dầu] Nạp nhiều lần: lần 2 chỉ nạp phần còn thiếu rồi đèn sáng; lần 3 là châm dầu (refuel), không còn deposit",
    seed: 1, ticks: 20, scenario: base({ player: { pos: [0, 0, 23.5], carried: 8 }, lanterns: [{ id: "L1", deposited: 6 }] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 5, interact: true }] },
    check: (L) => {
      const d = events(L, "deposit");
      assert.deepEqual(d[0].data, { lantern_id: "L1", amount: 4, deposited: 10 });
      assert.equal(d.length, 1, "đèn đã sáng không còn nhận deposit");
      assert.equal(events(L, "lantern_lit").length, 1);
      assert.deepEqual(events(L, "refuel")[0].data, { lantern_id: "L1", amount: 1, fuel: 100 });
      assert.equal(snap(L, 20).player.carried, 3);
    },
  },
  {
    name: "deposit_lit", phase: 1,
    proves: "[P3 đổi: +5/đom đóm, lantern_lit có relight] Đủ 10 thì đèn chưa từng sáng thắp lần đầu: điểm = 10×5 + 100 = 150",
    seed: 1, ticks: 5, scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: 10, deposited: 10 });
      assert.deepEqual(events(L, "lantern_lit")[0].data, { lantern_id: "L1", relight: false });
      assert.equal(endLine(L).score, 150);
      assert.equal(endLine(L).state, "playing");
    },
  },
  {
    name: "deposit_nearest_then_id", phase: 2,
    proves: "Chỉ xét đèn chưa sáng; chọn đèn gần nhất trong 2,0 m, bằng nhau thì id nhỏ hơn",
    seed: 1, ticks: 5,
    scenario: base({
      player: { pos: [0, 0, 0], carried: 4 },
      lanterns: [{ id: "L1", pos: [1, 0, 0] }, { id: "L2", pos: [-1, 0, 0] }, { id: "L3", pos: [0, 0, 0.5] }, { id: "L4", pos: [30, 0, 30] }, { id: "L5", pos: [31, 0, 30] }],
    }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => assert.equal(events(L, "deposit")[0].data.lantern_id, "L3", "L3 gần nhất"),
  },
  {
    name: "deposit_tie_lowest_id", phase: 2,
    proves: "Hai đèn cách đều thì chọn id nhỏ hơn",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [1, 0, 0] }, { id: "L2", pos: [-1, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => assert.equal(events(L, "deposit")[0].data.lantern_id, "L1"),
  },
  {
    name: "deposit_skips_lit", phase: 2,
    proves: "[P3 đổi] Đèn đã sáng nay là đèn nhận được (chưa đầy dầu) và gần hơn nên được chọn: châm dầu L1, không nạp vào L2",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [0.5, 0, 0], lit: true }, { id: "L2", pos: [1.5, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(events(L, "deposit").length, 0);
      assert.equal(events(L, "refuel")[0].data.lantern_id, "L1");
    },
  },
  {
    name: "deposit_out_of_range", phase: 1,
    proves: "Ngoài interact_radius (2,0 m) thì interact không nạp được",
    seed: 1, ticks: 5, scenario: base({ player: { pos: [0, 0, 25 - T.interact_radius - 0.5], carried: 3 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => assert.equal(events(L, "deposit").length, 0),
  },
  {
    name: "win_all_lit", phase: 1,
    proves: "[P3 THAY THẾ] Thắp hết đèn KHÔNG còn kết thúc Đêm: sau khi thắp đèn cuối game vẫn playing, không có game_over, không có all_lit",
    seed: 1, ticks: 600,
    scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: litExcept(N1, "L1"), time_left_s: 240 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(snap(L, 0).score, 0, "đèn đặt sẵn lit không được cộng điểm");
      assert.equal(events(L, "lantern_lit").length, 1);
      assert.equal(events(L, "game_over").length, 0);
      const e = endLine(L);
      assert.equal(e.state, "playing");
      assert.equal(e.ticks, 600);
      assert.equal(e.score, 150, "10×5 + 100, không thưởng thời gian");
    },
  },
  {
    name: "win_at_dawn_tick", phase: 2,
    proves: "[P3 đổi] Đủ đèn ở đúng tick bình minh thì THẮNG dawn_survived; điểm = 10×5 + 100 + 4×(50+99) + (50+100) + 3×50 = 1046",
    seed: 1, ticks: 600,
    scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: litExcept(N1, "L1"), time_left_s: 1 / 60 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "won", reason: "dawn_survived" });
      assert.equal(endLine(L).ticks, 1);
      assert.equal(endLine(L).score, 1046);
    },
  },
  {
    name: "no_flames_beats_win", phase: 2,
    proves: "Hết Ngọn Lửa thì luôn thua (no_flames), kể cả khi tất cả đèn đã sáng",
    seed: 1, ticks: 10,
    scenario: base({ player: { flames: 0 }, lanterns: N1.map((id) => ({ id, lit: true })) }),
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "no_flames" });
      assert.equal(endLine(L).state, "lost");
    },
  },
  {
    name: "shade_hit_drop_recoil", phase: 1,
    proves: "Bị chạm: -1 Ngọn Lửa, rơi floor(mang/2) đom đóm ra vành 1,5-2,5 m (tồn tại 480 tick), bất tử 90 tick, bóng recoil lùi 2 m; chạm lúc bất tử không làm gì",
    seed: 1, ticks: 200,
    scenario: base({ player: { carried: 5 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }),
    check: (L) => {
      const hits = events(L, "player_hit");
      assert.deepEqual(hits[0].data, { by: "shade", flames: T.flames - 1, dropped: 2 });
      assert.equal(hits[0].tick, 1);
      const s10 = snap(L, 10);
      assert.equal(s10.player.carried, 3);
      assert.equal(s10.player.invuln, 81);
      assert.equal(shadeOf(s10, "S1").state, "recoil");
      assert.equal(s10.motes.length, 2);
      for (const m of s10.motes) {
        assert.equal(m.kind, "dropped");
        const d = dist(m.pos, s10.player.pos);
        assert.ok(d >= 1.5 - 0.01 && d <= 2.5 + 0.01, `vành rơi ${d}`);
        assert.ok(m.ttl_s > 7 && m.ttl_s <= 8);
      }
      assert.equal(hits[1].tick - hits[0].tick, Math.round(T.invuln_s * 60), "chạm lần 2 đúng khi hết bất tử");
      // recoil: lùi tổng 2 m sau 60 tick
      const s61 = snap(L, 60);
      near(dist(shadeOf(s61, "S1").pos, s61.player.pos), 0.43 + 2, 0.15); // ticket: lùi 2 m trong 60 tick
    },
  },
  {
    name: "hit_order_by_id", phase: 2,
    proves: "Nhiều bóng cùng chạm một tick: chỉ 1 lần mất Ngọn Lửa và xét theo id tăng dần (S1 trước S2) dù scenario liệt kê S2 trước",
    seed: 1, ticks: 5, snapshotEvery: 1,
    scenario: base({ shades: [{ id: "S2", pos: [0.5, 0, 0] }, { id: "S1", pos: [0, 0, 0.5] }] }),
    check: (L) => {
      assert.equal(events(L, "player_hit").length, 1, "tối đa 1 lần mất Ngọn Lửa mỗi tick");
      const s = snap(L, 0);
      assert.deepEqual(s.shades.map((x: Line) => x.id), ["S2", "S1"], "snapshot giữ thứ tự scenario");
      const e = snap(L, 5);
      assert.equal(shadeOf(e, "S1").state, "recoil");
      assert.notEqual(shadeOf(e, "S2").state, "recoil");
    },
  },
  {
    name: "lose_no_flames", phase: 1,
    proves: "Hết Ngọn Lửa thì thua (no_flames); end.state = lost; dừng sớm",
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
    name: "lose_dawn", phase: 1,
    proves: "Hết giờ thì thua (dawn); time_left_s giảm đúng 1/60 mỗi tick",
    seed: 1, ticks: 600, scenario: base({ time_left_s: 1 }),
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "dawn" });
      assert.equal(endLine(L).ticks, 60);
      assert.equal(snap(L, 30).time_left_s, 0.5);
    },
  },
  {
    name: "pulse_stun", phase: 1,
    proves: "Tỏa Sáng: tốn 3, bán kính 5 m 3D từ chân+0,8 m, choáng 120 tick, đẩy lùi 4 m trong 15 tick, +5/bóng; hết choáng thì đuổi lại",
    seed: 1, ticks: 200,
    scenario: base({
      player: { carried: 5 },
      shades: [{ id: "S1", pos: [4, 0, 0] }, { id: "S2", pos: [30, 0, 0] }, { id: "S3", pos: [0, 0, 5.2] }, { id: "S4", pos: [0, 0, 4.9] }, { id: "S5", pos: [0, 0, 4.99] }],
    }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "pulse")[0].data, { stunned_ids: ["S1", "S4"] });
      const s10 = snap(L, 10);
      assert.equal(s10.player.carried, 5 - T.pulse_cost);
      assert.equal(s10.score, 2 * T.score.per_stun);
      assert.notEqual(shadeOf(s10, "S5").state, "stunned", "4,99 m ngang + lệch 0,8 m dọc > 5 m (khoảng cách 3D)");
      assert.equal(shadeOf(s10, "S1").state, "stunned");
      assert.equal(shadeOf(s10, "S1").state_ticks_left, 120 - 9);
      near(shadeOf(snap(L, 20), "S1").pos[0], 4 + T.pulse_push_m, 0.01);
      assert.notEqual(shadeOf(s10, "S3").state, "stunned");
      assert.equal(shadeOf(snap(L, 110), "S1").state, "stunned");
      assert.equal(shadeOf(snap(L, 130), "S1").state, "chase");
    },
  },
  {
    name: "pulse_needs_light", phase: 1,
    proves: "Không đủ 3 đom đóm thì không kích hoạt Tỏa Sáng",
    seed: 1, ticks: 10,
    scenario: base({ player: { carried: T.pulse_cost - 1 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => { assert.equal(events(L, "pulse").length, 0); assert.equal(snap(L, 10).player.carried, T.pulse_cost - 1); },
  },
  {
    name: "pulse_cooldown_edge", phase: 1,
    proves: "Pulse kích hoạt ở cạnh false->true (giữ nút không lặp) và hồi chiêu 3 s (180 tick)",
    seed: 1, ticks: 260,
    scenario: base({ player: { carried: 9 }, shades: [{ id: "S1", pos: [50, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 30, pulse: false }, { tick: 60, pulse: true }, { tick: 70, pulse: false }, { tick: 190, pulse: true }] },
    check: (L) => assert.deepEqual(events(L, "pulse").map((e) => e.tick), [1, 191]),
  },
  {
    name: "safe_zone_lit", phase: 1,
    proves: "Đèn đã sáng tạo vùng 6 m: bóng ở ngoài không bao giờ vào trong, người đứng cạnh đèn không bị chạm",
    seed: 1, ticks: 600,
    scenario: base({ player: { pos: [0, 0, 25] }, lanterns: [{ id: "L1", lit: true }], shades: [{ id: "S1", pos: [20, 0, 25] }, { id: "S2", pos: [-20, 0, 25] }] }),
    check: (L) => {
      for (const s of snaps(L)) for (const sh of s.shades) assert.ok(dist(sh.pos, [0, 0, 25]) >= T.safe_radius - 0.002, `tick ${s.tick}: ${sh.id}`);
      assert.equal(events(L, "player_hit").length, 0);
    },
  },
  {
    name: "safe_zone_unlit_none", phase: 2,
    proves: "Đèn CHƯA sáng không có vùng an toàn: bóng vẫn chạm được người đứng cạnh đèn",
    seed: 1, ticks: 120,
    scenario: base({ player: { pos: [0, 0, 25] }, shades: [{ id: "S1", pos: [3, 0, 25] }] }),
    check: (L) => assert.ok(events(L, "player_hit").length >= 1),
  },
  {
    name: "safe_zone_push_out", phase: 2,
    proves: "Bóng đang ở trong vùng lúc đèn vừa sáng bị đẩy ra mép (<= 30 tick) và không gây sát thương trong lúc đó",
    seed: 1, ticks: 60,
    scenario: base({
      player: { pos: [0, 0, 24], carried: 10 },
      shades: [{ id: "S1", pos: [0.5, 0, 24.7] }, { id: "S2", pos: [3, 0, 25], state: "stunned", state_ticks_left: 300 }],
    }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.equal(events(L, "lantern_lit").length, 1);
      assert.equal(events(L, "player_hit").length, 0, "không sát thương trong lúc bị đẩy");
      const d = (t: number, id: string) => dist(shadeOf(snap(L, t), id).pos, [0, 0, 25]);
      assert.ok(d(10, "S2") > 3.5 && d(10, "S2") < T.safe_radius, "đang bị đẩy");
      assert.ok(d(30, "S2") >= T.safe_radius - 0.002, "ra tới mép trong <= 30 tick");
    },
  },
  {
    name: "scenario_silent", phase: 1,
    proves: "Dựng scenario không phát sự kiện (ngoài night_start tick 0), không cộng điểm; random_* = false thì không sinh gì",
    seed: 1, ticks: 1200,
    scenario: base({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", lit: true }] }),
    check: (L) => {
      assert.deepEqual(L.filter((l) => l.type === "event").map((e) => e.name), ["night_start"]);
      assert.equal(snap(L, 0).score, 0);
      assert.equal(snap(L, 1200).motes_active, 0);
      assert.equal(snap(L, 1200).shades.length, 0);
    },
  },

  // ================= Phase 2: di chuyển, lướt, rơi =================
  {
    name: "dash_basic", phase: 2,
    proves: "Lướt 14 m/s trong 12 tick theo hướng đang đi (2,8 m), hồi chiêu 90 tick từ lúc bắt đầu, nhấn khi đang hồi bị bỏ qua, không bất tử",
    seed: 1, ticks: 120, scenario: base(),
    inputs: { frames: [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 95, dash: true }, { tick: 96, dash: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "dash").map((e) => [e.tick, e.data]), [[1, {}], [96, {}]]);
      near(snap(L, 10).player.pos[2], 10 * (T.dash_speed / 60), 0.002);
      near(snap(L, 20).player.pos[2], 12 * (T.dash_speed / 60) + 8 * V, 0.002);
      near(snap(L, 10).player.dash_cd_s, (T.dash_cooldown_s * 60 - 9) / 60, 0.002);
      assert.equal(snap(L, 10).player.invuln, 0, "lướt không bất tử");
    },
  },
  {
    name: "dash_facing", phase: 2,
    proves: "Đứng yên thì lướt theo hướng đang quay mặt (ban đầu +Z)",
    seed: 1, ticks: 30, scenario: base(),
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }] },
    check: (L) => { const p = snap(L, 20).player.pos; near(p[0], 0); near(p[2], T.dash_speed * T.dash_duration_s); },
  },
  {
    name: "dash_air_keeps_height", phase: 2,
    proves: "Lướt trên không giữ nguyên độ cao suốt 12 tick, rồi rơi tiếp",
    seed: 1, ticks: 40, snapshotEvery: 1, scenario: base(),
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, dash: true }, { tick: 11, dash: false }] },
    check: (L) => {
      const y10 = snap(L, 10).player.pos[1];
      assert.ok(y10 > 0.5);
      for (let t = 11; t <= 22; t++) near(snap(L, t).player.pos[1], y10, 0.0005);
      assert.ok(snap(L, 26).player.pos[1] < y10);
    },
  },
  {
    name: "fall_event", phase: 2,
    proves: "Ra ngoài đảo (Y < -10): đúng 1 lần player_hit {by:fall, lost}, -1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát với bất tử",
    seed: 1, ticks: 260, scenario: base({ player: { pos: [39, 0, 0], carried: 4 } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => {
      const f = events(L, "player_hit");
      assert.equal(f.length, 1);
      assert.deepEqual(f[0].data, { by: "fall", flames: T.flames - 1, dropped: 0, lost: 4 });
      assert.ok(f[0].tick >= 60 && f[0].tick <= 90, `fall tick ${f[0].tick}`);
      const s = snap(L, 200);
      assert.equal(s.player.flames, T.flames - 1);
      assert.equal(s.player.carried, 0);
      assert.equal(s.player.pos[1], 0);
      assert.equal(s.player.grounded, true);
      assert.ok(s.player.pos[0] > 4 && s.player.pos[0] < 10, `hồi sinh gần điểm xuất phát: x=${s.player.pos[0]}`);
      assert.ok(s.player.invuln > 0, "bất tử sau hồi sinh");
      const fallTick = f[0].tick;
      const mid = snap(L, Math.floor((fallTick + 30) / 10) * 10);
      assert.ok(mid.player.pos[1] < -10 || mid.player.pos[0] > 39, "đang chờ hồi sinh ở dưới biển mây");
    },
  },
  {
    name: "fall_last_flame", phase: 2,
    proves: "Rơi khi còn 1 Ngọn Lửa thì thua ngay (no_flames), không hồi sinh",
    seed: 1, ticks: 400, scenario: base({ player: { pos: [39, 0, 0], flames: 1 } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "no_flames" });
      assert.equal(endLine(L).state, "lost");
      assert.ok(endLine(L).ticks < 100);
    },
  },
  {
    name: "fall_ignores_invuln", phase: 2,
    proves: "Rơi khỏi đảo bỏ qua bất tử: vẫn -1 Ngọn Lửa khi đang bất tử",
    seed: 1, ticks: 120, scenario: base({ player: { pos: [39, 0, 0], invuln_ticks: 500 } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => assert.equal(events(L, "player_hit")[0].data.flames, T.flames - 1),
  },
  {
    name: "bridge_walk", phase: 2, night: 2,
    proves: "Đêm 2: đi dọc cầu tre (x 26..44, z -2..2) không rơi",
    seed: 1, ticks: 60, scenario: base({ player: { pos: [30, 0, 0] } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => { near(snap(L, 60).player.pos[0], 36, 0.01); assert.equal(events(L, "player_hit").length, 0); },
  },
  {
    name: "bridge_fall", phase: 2, night: 2,
    proves: "Đêm 2: cầu không lan can, bước ra ngoài z > 2 thì rơi",
    seed: 1, ticks: 200, scenario: base({ player: { pos: [35, 0, 1.9] } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const f = events(L, "player_hit");
      assert.equal(f[0].data.by, "fall");
      assert.ok(f[0].tick >= 55 && f[0].tick <= 95);
    },
  },
  {
    name: "pad_night2", phase: 2, night: 2,
    proves: "Đêm 2: bục nhảy (20,0,18) bắn Y 14 m/s và 24 m/s ngang về tâm đảo kia; phím di chuyển không ghi đè; đáp trong đảo đích",
    seed: 1, ticks: 130, snapshotEvery: 1, scenario: base({ player: { pos: [20, 0, 18] } }),
    inputs: { frames: [{ tick: 0, move: [0, -1] }, { tick: 60, move: [0, 0] }] },
    check: (L) => {
      const apex = Math.max(...snaps(L).map((s) => s.player.pos[1]));
      near(apex, 14 ** 2 / 40, 0.2);
      const s = snap(L, 110).player;
      assert.equal(s.grounded, true);
      assert.ok(s.pos[0] > 49 && s.pos[0] < 54 && s.pos[2] > 5 && s.pos[2] < 8.5, `đáp tại ${s.pos}`);
      assert.ok(dist(s.pos, [70, 0, 0]) < 28);
      assert.equal(events(L, "player_hit").length, 0);
      const air = snaps(L).filter((x) => x.tick >= 5 && x.tick <= 70).map((x) => x.player.pos);
      assert.ok(air.every((p, i) => i === 0 || p[0] > air[i - 1][0]), "bay thẳng về đảo B dù bấm -Z");
    },
  },
  {
    name: "ramp_climb", phase: 2, night: 3,
    proves: "Đêm 3: leo dốc 30° từ chân dốc (r=30, Y=0) lên tầng 1 (r=24, Y=3), Y tăng đều",
    seed: 1, ticks: 100, scenario: base({ player: { pos: [26.846, 0, 15.5] } }),
    inputs: { frames: [{ tick: 0, move: [-0.866, -0.5] }] },
    check: (L) => {
      near(snap(L, 40).player.pos[1], 1.5, 0.2);
      const s = snap(L, 100).player;
      near(s.pos[1], 3, 0.001);
      assert.equal(s.grounded, true);
    },
  },
  {
    name: "cliff_blocks", phase: 2, night: 3,
    proves: "Đêm 3: vách đứng tầng 1 và tầng 2 không đi lên được (đi thẳng vào vách thì bị chặn, Y giữ 0)",
    seed: 1, ticks: 100, scenario: base({ player: { pos: [0, 0, 10] } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 50, move: [0, -1] }] },
    check: (L) => {
      const a = snap(L, 50).player;
      assert.ok(a.pos[2] > 11.7 && a.pos[2] <= 12, `chặn ở vách tầng 1: z=${a.pos[2]}`);
      assert.equal(a.pos[1], 0);
      const b = snap(L, 100).player;
      assert.ok(b.pos[2] >= 8 && b.pos[2] < 8.4, `chặn ở vách tầng 2: z=${b.pos[2]}`);
      assert.equal(b.pos[1], 0);
    },
  },
  {
    name: "step_off_tier", phase: 2, night: 3,
    proves: "Đêm 3: bước ra mép tầng 1 thì rơi xuống tầng dưới (Y=0), không bị tính là rơi khỏi đảo",
    seed: 1, ticks: 110, scenario: base({ player: { pos: [0, 3, 18] } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      assert.equal(snap(L, 0).player.grounded, true);
      const s = snap(L, 110).player;
      assert.equal(s.pos[1], 0);
      assert.equal(s.grounded, true);
      assert.equal(events(L, "player_hit").length, 0);
    },
  },
  {
    name: "pad_night3_tier2", phase: 2, night: 3,
    proves: "Đêm 3: bục nhảy (0,3,13) bắn Y 12 m/s và 8 m/s về -Z, đáp lên tầng 2 (Y=6)",
    seed: 1, ticks: 150, scenario: base({ player: { pos: [0, 3, 13] } }),
    check: (L) => {
      const s = snap(L, 120).player;
      near(s.pos[1], 6, 0.001);
      assert.equal(s.grounded, true);
      assert.ok(s.pos[2] > 3 && s.pos[2] < 8.1, `đáp tại z=${s.pos[2]}`);
      assert.equal(events(L, "player_hit").length, 0);
    },
  },
  {
    name: "tower_blocks", phase: 2, night: 3,
    proves: "Đêm 3: tháp chuông (trụ r=2 ở tâm tầng 2) không leo được, không đi xuyên",
    seed: 1, ticks: 100, scenario: base({ player: { pos: [0, 6, 6] } }),
    inputs: { frames: [{ tick: 0, move: [0, -1] }] },
    check: (L) => { const s = snap(L, 100).player; assert.ok(s.pos[2] >= 2 && s.pos[2] < 2.2, `z=${s.pos[2]}`); near(s.pos[1], 6, 0.001); },
  },

  {
    name: "win_night2_last_lantern", phase: 2, night: 2,
    proves: "[P3 đổi] Đêm 2: thắp đèn cuối (L6 ở đảo B) vẫn thắp được nhưng KHÔNG kết thúc Đêm; thời lượng 270 s",
    seed: 1, ticks: 100,
    scenario: base({ player: { pos: [53, 0, -8.5], carried: 10 }, lanterns: litExcept(["L1", "L2", "L3", "L4", "L5", "L6"], "L6") }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(events(L, "lantern_lit")[0].data.lantern_id, "L6");
      assert.equal(events(L, "game_over").length, 0);
      assert.equal(snap(L, 0).time_left_s, 270);
      assert.equal(endLine(L).score, 150);
    },
  },
  {
    name: "win_night3_tier2_lantern", phase: 2, night: 3,
    proves: "[P3 đổi] Đêm 3: đèn L1 ở tầng 2 (0,6,6) nạp được từ tầng 2; thắp đủ 7 đèn không kết thúc Đêm; thời lượng 300 s",
    seed: 1, ticks: 100,
    scenario: base({ player: { pos: [0, 6, 4.5], carried: 10 }, lanterns: litExcept(["L1", "L2", "L3", "L4", "L5", "L6", "L7"], "L1") }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(snap(L, 0).player.grounded, true);
      assert.equal(events(L, "lantern_lit")[0].data.lantern_id, "L1");
      assert.equal(events(L, "game_over").length, 0);
      assert.equal(snap(L, 0).time_left_s, 300);
      assert.equal(endLine(L).score, 150);
    },
  },

  // ================= Phase 2: Bùa Gió =================
  {
    name: "charm_pickup", phase: 2, night: 2,
    proves: "Nhặt Bùa Gió: charm_picked {C1, 600}, chạy 7,2 m/s, bùa biến mất, hiện lại sau 2700 tick",
    seed: 1, ticks: 60,
    scenario: base({ player: { pos: [35, 0, 0] }, charms: [{ id: "C1" }] }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      assert.deepEqual(events(L, "charm_picked")[0].data, { charm_id: "C1", charm_ticks: 600 });
      assert.equal(events(L, "charm_picked")[0].tick, 1);
      near(snap(L, 10).player.charm_s, (600 - 9) / 60, 0.002);
      assert.equal(snap(L, 10).charms[0].available, false);
      near(snap(L, 10).charms[0].respawn_s, (2700 - 9) / 60, 0.002);
      near(snap(L, 60).player.pos[2], V + 59 * (7.2 / 60), 0.01); // ticket: bùa 7,2 m/s
    },
  },
  {
    name: "charm_expires", phase: 2,
    proves: "Hết hiệu lực bùa thì tốc độ về 6 m/s",
    seed: 1, ticks: 120, scenario: base({ player: { charm_ticks: 60 } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => near(snap(L, 120).player.pos[2], 59 * (7.2 / 60) + 61 * V, 0.02),
  },
  {
    name: "charm_respawn", phase: 2, night: 2,
    proves: "Bùa xuất hiện lại sau khi hết bộ đếm hồi (respawn_s trong snapshot)",
    seed: 1, ticks: 140,
    scenario: base({ player: { pos: [0, 0, 0] }, charms: [{ id: "C1", available: false, respawn_ticks: 120 }] }),
    check: (L) => {
      assert.equal(snap(L, 110).charms[0].available, false);
      assert.equal(snap(L, 130).charms[0].available, true);
      assert.equal(snap(L, 130).charms[0].respawn_s, 0);
    },
  },
  {
    name: "charm_refresh", phase: 2, night: 2,
    proves: "Nhặt bùa khi còn hiệu lực thì làm mới về 600 tick",
    seed: 1, ticks: 20,
    scenario: base({ player: { pos: [35, 0, 0], charm_ticks: 100 }, charms: [{ id: "C1" }] }),
    check: (L) => assert.deepEqual(events(L, "charm_picked")[0].data, { charm_id: "C1", charm_ticks: 600 }),
  },
  {
    name: "charm_dash_no_cooldown", phase: 2,
    proves: "Có bùa: lướt không hồi chiêu nhưng vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua; lướt vẫn 14 m/s trong 12 tick",
    seed: 1, ticks: 60, scenario: base({ player: { charm_ticks: 600 } }),
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }, { tick: 21, dash: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "dash").map((e) => e.tick), [1, 21]);
      near(snap(L, 10).player.dash_cd_s, 0, 0.001);
      near(snap(L, 10).player.pos[2], 10 * (T.dash_speed / 60), 0.002);
    },
  },

  // ================= Phase 2: Gió Lạc =================
  {
    name: "drifter_steal", phase: 2, night: 2,
    proves: "Gió Lạc: idle->chase khi mang >=5 và cách <=15 m; chạm (<=1,2 m) cướp min(3, mang), chuyển flee, mỗi con 1 lần, không mất Ngọn Lửa; hết flee thì biến mất",
    seed: 1, ticks: 300,
    scenario: base({ player: { carried: 6 }, drifters: [{ id: "D1", pos: [5, 0, 0] }] }),
    check: (L) => {
      const st = events(L, "drifter_steal");
      assert.equal(st.length, 1);
      assert.deepEqual(st[0].data, { drifter_id: "D1", amount: 3, carried: 3 });
      assert.ok(st[0].tick >= 31 && st[0].tick <= 36, `steal tick ${st[0].tick}`);
      const d = snap(L, 40).drifters[0];
      assert.equal(d.state, "flee");
      assert.equal(d.stolen, 3);
      assert.equal(snap(L, 40).player.flames, T.flames);
      assert.equal(snap(L, 20).drifters[0].state, "chase");
      assert.equal(snap(L, 280).drifters.length, 0, "biến mất sau 240 tick flee");
      assert.equal(events(L, "player_hit").length, 0);
    },
  },
  {
    name: "drifter_steal_clamped", phase: 2, night: 2,
    proves: "Cướp tối đa 3, và chỉ cướp nếu đang mang: mang 5 mất 3 còn 2",
    seed: 1, ticks: 60, scenario: base({ player: { carried: 5 }, drifters: [{ id: "D1", pos: [3, 0, 0] }] }),
    check: (L) => assert.deepEqual(events(L, "drifter_steal")[0].data, { drifter_id: "D1", amount: 3, carried: 2 }),
  },
  {
    name: "drifter_no_trigger", phase: 2, night: 2,
    proves: "Mang < 5, hoặc cách > 15 m thì Gió Lạc ở idle và không cướp",
    seed: 1, ticks: 100,
    scenario: base({
      player: { carried: 4 },
      drifters: [{ id: "D1", pos: [5, 0, 0] }, { id: "D2", pos: [40, 0, 0] }],
    }),
    check: (L) => {
      assert.equal(events(L, "drifter_steal").length, 0);
      assert.equal(snap(L, 100).drifters[0].state, "idle");
      assert.equal(snap(L, 100).drifters[1].state, "idle");
    },
  },
  {
    name: "drifter_pulse_chase", phase: 2, night: 2,
    proves: "Tỏa Sáng trúng Gió Lạc đang chase: chuyển flee, không cướp, không mất đồ ngoài chi phí Tỏa Sáng",
    seed: 1, ticks: 60,
    scenario: base({ player: { carried: 9 }, drifters: [{ id: "D1", pos: [4, 0, 0] }] }),
    inputs: { frames: [{ tick: 4, pulse: true }, { tick: 5, pulse: false }] },
    check: (L) => {
      assert.equal(events(L, "drifter_steal").length, 0);
      assert.equal(events(L, "pulse").length, 1);
      const d = snap(L, 20).drifters[0];
      assert.equal(d.state, "flee");
      assert.equal(d.stolen, 0);
      assert.equal(snap(L, 20).player.carried, 9 - T.pulse_cost);
    },
  },
  {
    name: "drifter_drop", phase: 2, night: 2,
    proves: "Tỏa Sáng trúng Gió Lạc đang flee có mang đồ: drifter_drop, đom đóm thành đom đóm rơi tại chỗ, Gió Lạc biến mất sau 120 tick",
    seed: 1, ticks: 160,
    scenario: base({ player: { carried: 3 }, drifters: [{ id: "D1", pos: [3, 0, 0], state: "flee", stolen: 3, state_ticks_left: 200 }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "drifter_drop")[0].data, { drifter_id: "D1", amount: 3 });
      const s = snap(L, 10);
      assert.equal(s.motes.length, 3);
      assert.ok(s.motes.every((m: Line) => m.kind === "dropped"));
      assert.equal(s.drifters[0].stolen, 0);
      assert.equal(snap(L, 110).drifters.length, 1);
      assert.equal(snap(L, 130).drifters.length, 0);
    },
  },
  {
    name: "drifter_ignores_safe_zone_and_invuln", phase: 2, night: 2,
    proves: "Vùng an toàn không chặn Gió Lạc và bất tử của Mây không ngăn cướp",
    seed: 1, ticks: 60,
    scenario: base({
      player: { pos: [0, 0, 20], carried: 6, invuln_ticks: 500 },
      lanterns: [{ id: "L1", lit: true }],
      drifters: [{ id: "D1", pos: [4, 0, 20] }],
    }),
    check: (L) => assert.equal(events(L, "drifter_steal").length, 1),
  },
  {
    name: "drifter_schedule_night2", phase: 2, night: 2,
    proves: "Gió Lạc sinh tại tick 1200, 2400 (id D1, D2), tối đa 2; Đêm 1 không có",
    seed: 1, ticks: 3700,
    scenario: { random_motes: false, random_shades: false, wind_enabled: false, motes: [] },
    check: (L) => {
      assert.equal(snap(L, 1190).drifters.length, 0);
      const a = snap(L, 1200).drifters;
      assert.deepEqual(a.map((d: Line) => d.id), ["D1"]);
      assert.deepEqual(snap(L, 2400).drifters.map((d: Line) => d.id), ["D1", "D2"]);
      assert.equal(snap(L, 3600).drifters.length, 2, "tối đa 2");
    },
  },
  {
    name: "no_drifters_night1", phase: 2, night: 1,
    proves: "Đêm 1 không có Gió Lạc và Bùa Gió",
    seed: 1, ticks: 1300, scenario: { random_motes: false, random_shades: false, motes: [] },
    check: (L) => { assert.equal(snap(L, 1300).drifters.length, 0); assert.equal(snap(L, 0).charms.length, 0); },
  },

  // ================= Phase 2: Bóng Mực, đom đóm, gió, tạm dừng =================
  {
    name: "shade_states_detect", phase: 2,
    proves: "Bóng Mực wander->chase khi Mây trong 12 m; chase->wander khi Mây ngoài 18 m; tên trạng thái đúng",
    seed: 1, ticks: 20,
    scenario: base({ shades: [{ id: "S1", pos: [20, 0, 0], state: "wander" }, { id: "S2", pos: [10, 0, 0], state: "wander" }, { id: "S3", pos: [25, 0, 0], state: "chase" }] }),
    check: (L) => {
      const s = snap(L, 10);
      assert.equal(shadeOf(s, "S1").state, "wander");
      assert.equal(shadeOf(s, "S2").state, "chase");
      assert.equal(shadeOf(s, "S3").state, "wander");
    },
  },
  {
    name: "shade_speed_night1", phase: 2, night: 1,
    proves: "Bóng Mực đuổi 4,0 m/s ở Đêm 1",
    seed: 1, ticks: 30, scenario: base({ shades: [{ id: "S1", pos: [10, 0, 0] }] }),
    check: (L) => near(shadeOf(snap(L, 30), "S1").pos[0], 10 - 30 * (T.shade_speed / 60), 0.01),
  },
  {
    name: "shade_speed_night3", phase: 2, night: 3,
    proves: "Bóng Mực đuổi 4,5 m/s ở Đêm 3",
    seed: 1, ticks: 30, scenario: base({ shades: [{ id: "S1", pos: [10, 0, -30] }] }),
    check: (L) => near(shadeOf(snap(L, 30), "S1").pos[0], 10 - 30 * (T.shade_speed_night3 / 60), 0.01),
  },
  {
    name: "shade_schedule_night1", phase: 2, night: 1,
    proves: "Bóng Mực: 2 con tại tick 300 (spawning 30 tick), sau đó mỗi 8 s (480 tick), id S1.., cách Mây >= 15 m, tối đa 6",
    seed: 3, ticks: 2000,
    scenario: { random_motes: false, motes: [], random_drifters: false },
    check: (L) => {
      const sp = events(L, "shade_spawned");
      assert.deepEqual(sp.map((e) => e.tick), [300, 300, 780, 1260, 1740]);
      assert.deepEqual(sp.map((e) => e.data.id), ["S1", "S2", "S3", "S4", "S5"]);
      assert.equal(shadeOf(snap(L, 310), "S1").state, "spawning");
      assert.notEqual(shadeOf(snap(L, 340), "S1").state, "spawning");
      for (const s of snap(L, 310).shades) assert.ok(dist(s.pos, [0, 0, 0]) >= 15);
    },
  },
  {
    name: "mote_schedule", phase: 2, night: 1,
    proves: "Đom đóm: 20 lúc bắt đầu ở 20 điểm khác nhau; sinh thêm 1 mỗi 240 tick; hết điểm trống (24 điểm Đêm 1) thì bỏ lượt",
    seed: 2, ticks: 2500,
    scenario: { random_shades: false, random_drifters: false },
    check: (L) => {
      const s0 = snap(L, 0);
      assert.equal(s0.motes_active, 20);
      assert.equal(new Set(s0.motes.map((m: Line) => m.pos.join(","))).size, 20);
      assert.ok(s0.motes.every((m: Line) => m.kind === "random" && m.ttl_s === null));
      assert.equal(snap(L, 230).motes_active, 20);
      assert.equal(snap(L, 240).motes_active, 21);
      assert.equal(snap(L, 960).motes_active, 24);
      assert.equal(snap(L, 2400).motes_active, 24);
    },
  },
  {
    name: "mote_ttl", phase: 2,
    proves: "Đom đóm rơi hết hạn sau ttl (480 tick); ttl_s giảm theo thời gian",
    seed: 1, ticks: 60,
    scenario: base({ motes: [{ pos: [10, 0, 0], kind: "dropped", ttl_ticks: 30 }] }),
    check: (L) => {
      assert.ok(snap(L, 20).motes[0].ttl_s > 0);
      assert.equal(snap(L, 40).motes.length, 0);
    },
  },
  {
    name: "wind_night3", phase: 2, night: 3,
    proves: "Gió mạnh (Đêm 3): báo trước, thổi 5 s mỗi 30 s, đẩy Mây 2 m/s theo dir_deg; wind_enabled=false thì không có",
    seed: 4, ticks: 2200, scenario: base({ wind_enabled: true }),
    check: (L) => {
      assert.equal(snap(L, 1790).wind.active, false);
      assert.equal(snap(L, 1810).wind.active, true);
      assert.equal(snap(L, 2110).wind.active, false);
      const w = snap(L, 1850).wind.dir_deg;
      const a = snap(L, 1850).player.pos, b = snap(L, 1900).player.pos;
      const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
      near(d, 2 * (50 / 60), 0.03);
      near(Math.atan2(b[2] - a[2], b[0] - a[0]), ((w * Math.PI) / 180 + Math.PI * 3) % (2 * Math.PI) - Math.PI, 0.02);
      near(snap(L, 1790).player.pos[0], snap(L, 1000).player.pos[0], 0.001);
    },
  },
  {
    name: "wind_off_night1", phase: 2, night: 1,
    proves: "Chỉ Đêm 3 mới có gió",
    seed: 4, ticks: 2200, scenario: base(),
    check: (L) => { for (const s of snaps(L)) assert.equal(s.wind.active, false); },
  },
  {
    name: "pause_resume", phase: 2,
    proves: "Tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, vị trí đứng yên, snapshot state=paused; sự kiện paused/resumed",
    seed: 1, ticks: 60, scenario: base(),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }, { tick: 41, pause: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "paused").map((e) => e.tick), [11]);
      assert.deepEqual(events(L, "resumed").map((e) => e.tick), [41]);
      for (const t of [20, 30, 40]) {
        const s = snap(L, t);
        assert.equal(s.state, "paused");
        assert.equal(s.sim_tick, 10);
        near(s.time_left_s, 240 - 10 / 60, 0.001);
        near(s.player.pos[2], 1.0, 0.001);
      }
      const r = snap(L, 50);
      assert.equal(r.state, "playing");
      assert.equal(r.sim_tick, 20);
      near(r.player.pos[2], 2.0, 0.001);
    },
  },
  {
    name: "pause_freezes_cooldowns", phase: 2,
    proves: "Khi tạm dừng hồi chiêu và bất tử không giảm",
    seed: 1, ticks: 80, scenario: base({ player: { invuln_ticks: 50, pulse_cd_ticks: 120 } }),
    inputs: { frames: [{ tick: 4, pause: true }, { tick: 5, pause: false }, { tick: 60, pause: true }, { tick: 61, pause: false }] },
    check: (L) => {
      assert.equal(snap(L, 30).player.invuln, 50 - 4);
      near(snap(L, 30).player.pulse_cd_s, (120 - 4) / 60, 0.001);
      assert.equal(snap(L, 70).player.invuln, 50 - 4 - 10, "tick bấm tiếp tục vẫn chạy mô phỏng");
    },
  },
  // ================= Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2) =================
  // Số kỳ vọng là số ghi cứng từ ticket (fuel 100, hao 1/s, +10/đom đóm, hút 5/s, ngưỡng 30, +5/+100/+40...).
  {
    name: "fuel_decay", phase: 3,
    proves: "Đèn đang sáng hao 1.0 đơn vị/giây (1/60 mỗi tick): fuel 100 -> 99.0 sau 60 tick, 90.0 sau 600 tick; không sai số tích lũy",
    seed: 1, ticks: 3600, snapshotEvery: 60, scenario: base({ lanterns: [{ id: "L1", lit: true }] }),
    check: (L) => {
      assert.equal(snap(L, 0).lanterns[0].fuel, 100);
      assert.equal(snap(L, 60).lanterns[0].fuel, 99);
      assert.equal(snap(L, 600).lanterns[0].fuel, 90);
      assert.equal(snap(L, 3600).lanterns[0].fuel, 40);
      assert.equal(snap(L, 3600).lanterns[1].fuel, 0, "đèn tắt có fuel 0");
    },
  },
  {
    name: "fuel_default_100", phase: 3,
    proves: "Đèn đặt lit:true không nêu fuel thì fuel mặc định 100; đặt fuel thì dùng fuel đó; snapshot có fuel, ever_lit, relit_count cho mọi đèn",
    seed: 1, ticks: 0, scenario: base({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true, fuel: 42.5 }, { id: "L3", ever_lit: true }] }),
    check: (L) => {
      const ls = snap(L, 0).lanterns;
      assert.deepEqual(ls.map((l: Line) => [l.lit, l.fuel, l.ever_lit, l.relit_count]), [
        [true, 100, true, 0], [true, 42.5, true, 0], [false, 0, true, 0], [false, 0, false, 0], [false, 0, false, 0],
      ]);
    },
  },
  {
    name: "lantern_out", phase: 3,
    proves: "Hết dầu (fuel <= 0): đèn tắt ngay ở tick đó, deposited = 0, phát lantern_out {lantern_id}, nhớ ever_lit = true, fuel 0",
    seed: 1, ticks: 100, snapshotEvery: 1, scenario: base({ lanterns: [{ id: "L1", lit: true, fuel: 1 }] }),
    check: (L) => {
      const ev = events(L, "lantern_out");
      assert.equal(ev.length, 1);
      assert.deepEqual(ev[0].data, { lantern_id: "L1" });
      assert.equal(ev[0].tick, 60);
      assert.equal(snap(L, 59).lanterns[0].lit, true);
      const l = snap(L, 60).lanterns[0];
      assert.deepEqual([l.lit, l.deposited, l.fuel, l.ever_lit], [false, 0, 0, true]);
    },
  },
  {
    name: "refuel_basic", phase: 3,
    proves: "Châm dầu: used = min(đang mang, ceil((100-fuel)/10)), +10 fuel mỗi đom đóm, +5 điểm mỗi đom đóm, phát refuel {lantern_id, amount, fuel}",
    seed: 1, ticks: 5, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 4 }, lanterns: [{ id: "L1", lit: true, fuel: 50 }] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "refuel")[0].data, { lantern_id: "L1", amount: 4, fuel: 90 });
      assert.equal(snap(L, 5).player.carried, 0);
      assert.equal(endLine(L).score, 20);
      assert.equal(events(L, "deposit").length, 0);
      assert.equal(events(L, "lantern_lit").length, 0);
    },
  },
  {
    name: "refuel_caps_at_100", phase: 3,
    proves: "Châm dầu không vượt 100: fuel 60 (59.98 sau hao) cần ceil(40.02/10)=5 đom đóm dù đang mang 10; fuel kết thúc đúng 100",
    seed: 1, ticks: 5, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: "L1", lit: true, fuel: 60 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "refuel")[0].data, { lantern_id: "L1", amount: 5, fuel: 100 });
      assert.equal(snap(L, 5).player.carried, 5);
      assert.equal(endLine(L).score, 25);
    },
  },
  {
    name: "refuel_used_rounds_up", phase: 3,
    proves: "fuel 96 (95.98 sau hao) cần ceil(4.02/10)=1 đom đóm: dùng đúng 1, đủ để đầy",
    seed: 1, ticks: 5, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: "L1", lit: true, fuel: 96 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "refuel")[0].data, { lantern_id: "L1", amount: 1, fuel: 100 });
      assert.equal(snap(L, 5).player.carried, 9);
    },
  },
  {
    name: "interact_picks_nearest_receivable", phase: 3,
    proves: "Chọn đèn khi tương tác: đèn nhận được (chưa sáng hoặc sáng chưa đầy) gần nhất; L3 (sáng, chưa đầy) cách 1 m gần hơn L1 (sáng) 1,5 m và L2 (chưa sáng) 2 m",
    seed: 1, ticks: 5,
    scenario: base({
      player: { pos: [0, 0, 0], carried: 4 },
      lanterns: [{ id: "L1", pos: [1.5, 0, 0], lit: true, fuel: 50 }, { id: "L2", pos: [-1.9, 0, 0] }, { id: "L3", pos: [0, 0, 1], lit: true, fuel: 50 }, { id: "L4", pos: [30, 0, 30] }, { id: "L5", pos: [31, 0, 30] }],
    }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(events(L, "refuel")[0].data.lantern_id, "L3");
      assert.equal(events(L, "deposit").length, 0);
    },
  },
  {
    name: "interact_tie_lowest_id_lit_vs_unlit", phase: 3,
    proves: "Đèn sáng-chưa-đầy và đèn chưa sáng cách đều 1 m: chọn id nhỏ hơn (L1 chưa sáng -> deposit; không refuel L2)",
    seed: 1, ticks: 5,
    scenario: base({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [1, 0, 0] }, { id: "L2", pos: [-1, 0, 0], lit: true, fuel: 50 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.equal(events(L, "deposit")[0].data.lantern_id, "L1");
      assert.equal(events(L, "refuel").length, 0);
    },
  },
  {
    name: "relight_cost_5", phase: 3,
    proves: "Thắp lại đèn đã từng sáng chỉ cần 5 đom đóm: lantern_lit {relight:true}, +5×5 + 40 = 65 điểm, relit_count = 1, fuel 100, ever_lit true",
    seed: 1, ticks: 5, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
      assert.deepEqual(events(L, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
      assert.equal(endLine(L).score, 65);
      const l = snap(L, 1).lanterns[0];
      assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [true, 100, true, 1]);
    },
  },
  {
    name: "first_light_still_10", phase: 3,
    proves: "Đèn chưa từng sáng vẫn cần 10: nạp 5 chưa sáng, deposited = 5, ever_lit vẫn false",
    seed: 1, ticks: 5, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 5 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      assert.deepEqual(events(L, "deposit")[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
      assert.equal(events(L, "lantern_lit").length, 0);
      assert.equal(snap(L, 5).lanterns[0].ever_lit, false);
    },
  },
  {
    name: "out_then_relight_chain", phase: 3,
    proves: "Chuỗi đầy đủ: đèn sáng -> hết dầu (lantern_out, ever_lit giữ) -> Mây thắp lại bằng 5 đom đóm (relight true)",
    seed: 1, ticks: 130, snapshotEvery: 10,
    scenario: base({ player: { pos: [0, 0, 23.5], carried: 5 }, lanterns: [{ id: "L1", lit: true, fuel: 1 }] }),
    inputs: { frames: [{ tick: 100, interact: true }, { tick: 101, interact: false }] },
    check: (L) => {
      assert.equal(events(L, "lantern_out")[0].tick, 60);
      assert.equal(snap(L, 90).lanterns[0].ever_lit, true);
      assert.deepEqual(events(L, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
      assert.equal(events(L, "lantern_lit")[0].tick, 101, "frame tick 100 áp ở tick mô phỏng 101");
      assert.equal(snap(L, 130).lanterns[0].relit_count, 1);
    },
  },
  {
    name: "capacity_grows", phase: 3,
    proves: "Sức chứa = 10 + 2×successful_lights; thắp thành công tăng 1; đèn đặt sẵn bằng scenario không tính (capacity 10 lúc đầu, 12 sau 1 lần thắp)",
    seed: 1, ticks: 20, snapshotEvery: 1, scenario: base({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: "L2", lit: true }, { id: "L3", lit: true }, { id: "L4", ever_lit: true }] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.equal(snap(L, 0).player.capacity, 10, "đèn đặt sẵn không tính");
      assert.equal(snap(L, 5).player.capacity, 12);
    },
  },
  {
    name: "capacity_cap_20", phase: 3,
    proves: "successful_lights từ scenario: 9 -> vẫn 20 (tối đa 20)",
    seed: 1, ticks: 0, scenario: base({ player: { successful_lights: 9 } }),
    check: (L) => assert.equal(snap(L, 0).player.capacity, 20),
  },
  {
    name: "capacity_limits_pickup", phase: 3,
    proves: "Nhặt đom đóm bị giới hạn bởi sức chứa mới: successful_lights 3 -> chứa 16",
    seed: 1, ticks: 10,
    scenario: base({ player: { successful_lights: 3 }, motes: Array.from({ length: 18 }, () => [0, 0, 0.5]) }),
    check: (L) => {
      assert.equal(snap(L, 0).player.capacity, 16);
      assert.equal(snap(L, 10).player.carried, 16);
      assert.equal(snap(L, 10).motes_active, 2);
    },
  },
  {
    name: "safe_zone_exactly_30", phase: 3,
    proves: "Đèn fuel đúng 30 (sau hao) vẫn còn vùng an toàn: Bóng chase đi vào bị giữ ngoài 6 m",
    seed: 1, ticks: 1, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 30] }, lanterns: [{ id: "L1", lit: true, fuel: 1801 / 60 }], shades: [{ id: "S1", pos: [0, 0, 18.98], state: "chase" }] }),
    check: (L) => {
      assert.equal(snap(L, 1).lanterns[0].fuel, 30);
      const s = shadeOf(snap(L, 1), "S1");
      assert.ok(25 - s.pos[2] >= 6, `bóng ở ${s.pos[2]}, vẫn phải ngoài 6 m của đèn`);
    },
  },
  {
    name: "safe_zone_below_30", phase: 3,
    proves: "Đèn fuel < 30 mất vùng an toàn: cùng cảnh nhưng fuel 29.98 thì Bóng chase đi thẳng vào trong 6 m",
    seed: 1, ticks: 1, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 30] }, lanterns: [{ id: "L1", lit: true, fuel: 30 }], shades: [{ id: "S1", pos: [0, 0, 18.98], state: "chase" }] }),
    check: (L) => {
      const s = shadeOf(snap(L, 1), "S1");
      assert.ok(25 - s.pos[2] < 6, `bóng ở ${s.pos[2]}, phải vào trong 6 m`);
    },
  },
  {
    name: "drain_enters_and_drains", phase: 3,
    proves: "Bóng wander cách đèn yếu <= 2 m chuyển sang drain, đứng yên, hút 5/s (+1/s hao = 6/s); fuel_drain {lantern_id, shade_id, fuel} mỗi 60 tick",
    seed: 1, ticks: 200, snapshotEvery: 10,
    scenario: base({ player: { pos: [0, 0, -35] }, lanterns: [{ id: "L1", lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 22.5], state: "wander" }] }),
    check: (L) => {
      assert.equal(shadeOf(snap(L, 20), "S1").state, "drain");
      const z = shadeOf(snap(L, 20), "S1").pos[2];
      near(shadeOf(snap(L, 100), "S1").pos[2], z, 0.001);
      near(snap(L, 20).lanterns[0].fuel - snap(L, 80).lanterns[0].fuel, 6, 0.15);
      const ev = events(L, "fuel_drain");
      assert.ok(ev.length >= 2);
      assert.equal(ev[1].tick - ev[0].tick, 60);
      assert.deepEqual([ev[0].data.lantern_id, ev[0].data.shade_id], ["L1", "S1"]);
      near(ev[0].data.fuel, 20 - ev[0].tick / 60 - 5, 0.2);
    },
  },
  {
    name: "drain_stacks", phase: 3,
    proves: "Nhiều con cộng dồn: 1 con hút 5+1 = 6/s (29 -> 23.0 sau 60 tick); 2 con hút 5+5+1 = 11/s (29 -> 18.0)",
    seed: 1, ticks: 60, snapshotEvery: 60,
    scenario: base({
      player: { pos: [0, 0, -35] },
      lanterns: [{ id: "L1", lit: true, fuel: 29 }, { id: "L2", lit: true, fuel: 29 }],
      shades: [
        { id: "S1", pos: [0, 0, 24], state: "drain", target_lantern_id: "L1" },
        { id: "S2", pos: [1, 0, 24], state: "drain", target_lantern_id: "L1" },
        { id: "S3", pos: [23.8, 0, 7], state: "drain", target_lantern_id: "L2" },
      ],
    }),
    check: (L) => {
      near(snap(L, 60).lanterns[0].fuel, 29 - 11, 0.1);
      near(snap(L, 60).lanterns[1].fuel, 29 - 6, 0.1);
    },
  },
  {
    name: "drain_to_wander_when_out", phase: 3,
    proves: "Từ drain: đèn tắt thì sang wander (ngay tick đèn tắt)",
    seed: 1, ticks: 8, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, -35] }, lanterns: [{ id: "L1", lit: true, fuel: 0.5 }], shades: [{ id: "S1", pos: [0, 0, 24], state: "drain", target_lantern_id: "L1" }] }),
    check: (L) => {
      assert.equal(events(L, "lantern_out")[0].tick, 5);
      assert.equal(shadeOf(snap(L, 4), "S1").state, "drain");
      assert.equal(shadeOf(snap(L, 5), "S1").state, "wander");
    },
  },
  {
    name: "drain_to_chase_player_near", phase: 3,
    proves: "Từ drain: sang chase nếu Mây vào trong 6 m; Mây ở xa 8 m thì vẫn drain",
    seed: 1, ticks: 5, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 18] }, lanterns: [{ id: "L1", lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 23.5], state: "drain", target_lantern_id: "L1" }, { id: "S2", pos: [1.5, 0, 26], state: "drain", target_lantern_id: "L1" }] }),
    check: (L) => {
      assert.equal(shadeOf(snap(L, 1), "S1").state, "chase");
      assert.equal(shadeOf(snap(L, 1), "S2").state, "drain");
    },
  },
  {
    name: "refuel_pushes_shades_out", phase: 3,
    proves: "Châm dầu lên >= 30 khi Bóng đang hút trong vùng 6 m: Bóng bị đẩy ra, không gây sát thương trong 30 tick (kể cả khi đứng sát Mây)",
    seed: 1, ticks: 30, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 23.5], carried: 3 }, lanterns: [{ id: "L1", lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 24.2], state: "drain", target_lantern_id: "L1" }] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    check: (L) => {
      assert.equal(events(L, "refuel").length, 1);
      assert.ok(snap(L, 1).lanterns[0].fuel >= 30);
      assert.equal(events(L, "player_hit").length, 0, "không sát thương trong thời gian đẩy ra");
      assert.equal(snap(L, 30).player.flames, 3);
      assert.ok(Math.abs(shadeOf(snap(L, 30), "S1").pos[2] - 25) > 4, "đã bị đẩy xa tâm đèn");
    },
  },
  {
    name: "drain_pulse_score_15", phase: 3,
    proves: "Tỏa Sáng trúng Bóng đang drain: tổng +15 (thường +5); bóng sang stunned",
    seed: 1, ticks: 3, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 20], carried: 3 }, lanterns: [{ id: "L1", lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 24], state: "drain", target_lantern_id: "L1" }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (L) => {
      assert.deepEqual(events(L, "pulse")[0].data, { stunned_ids: ["S1"] });
      assert.equal(endLine(L).score, 15);
      assert.equal(shadeOf(snap(L, 1), "S1").state, "stunned");
    },
  },
  {
    name: "pulse_score_5_non_drain", phase: 3,
    proves: "Tỏa Sáng trúng Bóng không drain: +5 mỗi con",
    seed: 1, ticks: 3,
    scenario: base({ player: { pos: [0, 0, 20], carried: 3 }, shades: [{ id: "S1", pos: [0, 0, 23], state: "chase" }, { id: "S2", pos: [0, 0, 18], state: "chase" }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (L) => assert.equal(endLine(L).score, 10),
  },
  {
    name: "stunned_then_wander", phase: 3,
    proves: "[P3 THAY THẾ] Hết choáng thì về wander (Phase 2: chase nếu Mây trong 18 m): Mây cách 15 m (12-18) -> wander",
    seed: 1, ticks: 3, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 0] }, shades: [{ id: "S1", pos: [0, 0, 15], state: "stunned", state_ticks_left: 1 }] }),
    check: (L) => assert.equal(shadeOf(snap(L, 1), "S1").state, "wander"),
  },
  {
    name: "wander_targets_weak_then_unlit", phase: 3,
    proves: "Bóng wander chọn đèn sáng có fuel < 30 gần nhất (bằng nhau thì id nhỏ); đèn yếu được ưu tiên dù đèn tắt L4 gần hơn",
    seed: 1, ticks: 2, snapshotEvery: 1,
    scenario: base({
      player: { pos: [0, 0, -35] },
      lanterns: [
        { id: "L1", pos: [10, 0, 0], lit: true, fuel: 20 }, { id: "L2", pos: [-10, 0, 0], lit: true, fuel: 20 },
        { id: "L3", pos: [1, 0, 0], lit: true, fuel: 90 }, { id: "L4", pos: [0, 0, 3] }, { id: "L5", pos: [30, 0, 30], lit: true, fuel: 90 },
      ],
      shades: [{ id: "S1", pos: [0, 0, 0], state: "wander" }],
    }),
    check: (L) => assert.equal(shadeOf(snap(L, 1), "S1").target_lantern_id, "L1"),
  },
  {
    name: "wander_targets_unlit_when_no_weak", phase: 3,
    proves: "Không có đèn yếu thì wander đi về đèn tắt gần nhất",
    seed: 1, ticks: 2, snapshotEvery: 1,
    scenario: base({
      player: { pos: [0, 0, -35] },
      lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 90 }, { id: "L2", pos: [-10, 0, 0] }, { id: "L3", pos: [0, 0, 3] }, { id: "L4", pos: [30, 0, 30] }, { id: "L5", pos: [31, 0, 30] }],
      shades: [{ id: "S1", pos: [0, 0, 0], state: "wander" }],
    }),
    check: (L) => assert.equal(shadeOf(snap(L, 1), "S1").target_lantern_id, "L3"),
  },
  {
    name: "wander_weak_boundary_30", phase: 3,
    proves: "Đèn fuel đúng 30 không phải đèn yếu (yếu là < 30): bóng wander bỏ qua L1 (đúng 30) mà đi về đèn tắt L2",
    seed: 1, ticks: 2, snapshotEvery: 1,
    scenario: base({
      player: { pos: [0, 0, -35] },
      lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 1801 / 60 }, { id: "L2", pos: [-10, 0, 0] }, { id: "L3", pos: [30, 0, 30] }, { id: "L4", pos: [31, 0, 30] }, { id: "L5", pos: [32, 0, 30] }],
      shades: [{ id: "S1", pos: [0, 0, 0], state: "wander" }],
    }),
    check: (L) => {
      assert.equal(snap(L, 1).lanterns[0].fuel, 30);
      assert.equal(shadeOf(snap(L, 1), "S1").target_lantern_id, "L2");
    },
  },
  {
    name: "drain_range_is_2m", phase: 3,
    proves: "Vào drain khi cách đèn <= 2 m (XZ): bóng cách đúng 2,0 m vào drain ngay; bóng cách 2,5 m còn đang wander đi tới (chưa drain sau 5 tick)",
    seed: 1, ticks: 5, snapshotEvery: 1,
    scenario: base({
      player: { pos: [0, 0, -35] },
      lanterns: [{ id: "L1", lit: true, fuel: 20 }],
      shades: [{ id: "S1", pos: [0, 0, 23], state: "wander" }, { id: "S2", pos: [0, 0, 22.5], state: "wander" }],
    }),
    check: (L) => {
      assert.equal(shadeOf(snap(L, 1), "S1").state, "drain");
      assert.equal(shadeOf(snap(L, 5), "S2").state, "wander");
    },
  },
  {
    name: "chase_ignores_weak_lantern", phase: 3,
    proves: "Bóng đang chase không đổi mục tiêu: đi ngang đèn yếu (< 2 m) vẫn không chuyển sang drain",
    seed: 1, ticks: 20, snapshotEvery: 1,
    scenario: base({ player: { pos: [0, 0, 8] }, lanterns: [{ id: "L1", lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 24], state: "chase" }] }),
    check: (L) => { for (let t = 1; t <= 20; t++) assert.equal(shadeOf(snap(L, t), "S1").state, "chase"); },
  },
  {
    name: "no_early_win_all_lit", phase: 3,
    proves: "Thắp đủ 5/5 đèn từ đầu: không thắng sớm, game chạy tiếp tới bình minh",
    seed: 1, ticks: 600, scenario: base({ lanterns: N1.map((id) => ({ id, lit: true })) }),
    check: (L) => { assert.equal(events(L, "game_over").length, 0); assert.equal(endLine(L).state, "playing"); },
  },
  {
    name: "no_flames_beats_dawn_win", phase: 3,
    proves: "Hết Ngọn Lửa ở đúng tick bình minh vẫn thua no_flames dù đủ đèn sáng",
    seed: 1, ticks: 10, scenario: base({ player: { flames: 0 }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true }], time_left_s: 1 / 60 }),
    check: (L) => assert.deepEqual(events(L, "game_over")[0].data, { result: "lost", reason: "no_flames" }),
  },
  {
    name: "dawn_score_formula", phase: 3,
    proves: "Bình minh thắng 3/5 đèn (fuel 100 -> 99.5 sau 30 tick): điểm = 3×(50 + 99) + 3 Ngọn Lửa×50 = 597, không thưởng thời gian",
    seed: 1, ticks: 100, scenario: base({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true }], time_left_s: 0.5 }),
    check: (L) => {
      assert.deepEqual(events(L, "game_over")[0].data, { result: "won", reason: "dawn_survived" });
      assert.equal(endLine(L).ticks, 30);
      assert.equal(endLine(L).score, 597);
    },
  },
  ...([[1, 5, 2, false], [1, 5, 3, true], [2, 6, 3, false], [2, 6, 4, true], [3, 7, 4, false], [3, 7, 5, true]] as const).map(([night, total, lit, win]): Case => ({
    name: `dawn_threshold_n${night}_${lit}of${total}`, phase: 3, night,
    proves: `Đêm ${night}: bình minh với ${lit}/${total} đèn sáng ${win ? "đủ ngưỡng 60% -> THẮNG dawn_survived" : "dưới ngưỡng -> THUA dawn"}`,
    seed: 1, ticks: 100,
    scenario: base({ lanterns: Array.from({ length: lit }, (_, i) => ({ id: `L${i + 1}`, lit: true })), time_left_s: 0.5 }),
    check: (L) => assert.deepEqual(events(L, "game_over")[0].data, { result: win ? "won" : "lost", reason: win ? "dawn_survived" : "dawn" }),
  })),
  {
    name: "pause_freezes_fuel", phase: 3,
    proves: "Tạm dừng: dầu không hao (hao theo sim_tick, không theo tick)",
    seed: 1, ticks: 60, snapshotEvery: 10,
    scenario: base({ lanterns: [{ id: "L1", lit: true, fuel: 50 }] }),
    inputs: { frames: [{ tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }, { tick: 41, pause: false }] },
    check: (L) => {
      assert.equal(snap(L, 20).lanterns[0].fuel, snap(L, 30).lanterns[0].fuel);
      assert.equal(snap(L, 30).lanterns[0].fuel, snap(L, 40).lanterns[0].fuel);
    },
  },
];
