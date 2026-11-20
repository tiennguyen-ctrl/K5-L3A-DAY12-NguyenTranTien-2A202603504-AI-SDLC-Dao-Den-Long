import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { T } from "../src/core/constants.ts";
import { runHeadless } from "../src/core/runner.ts";
import { parseInputs, parseScenario } from "../src/core/validate.ts";
import contract from "../game.contract.json" with { type: "json" };
import { CASES, parse } from "./cases.ts";

const CLI = join(import.meta.dirname, "..", "src", "headless", "main.ts");
const dir = mkdtempSync(join(tmpdir(), "ddl-"));

function cli(args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: r.status, stderr: r.stderr };
}

// 1) Mỗi kịch bản trong tests/cases.ts chạy qua đúng đường headless và kiểm hành vi
for (const c of CASES) {
  test(`[phase ${c.phase}] ${c.name}`, () => {
    const lines = runHeadless({
      seed: c.seed,
      night: c.night ?? 1,
      ticks: c.ticks,
      snapshotEvery: c.snapshotEvery,
      scenario: c.scenario && parseScenario(JSON.stringify(c.scenario)),
      inputs: c.inputs && parseInputs(JSON.stringify(c.inputs)),
    });
    c.check(parse(lines));
  });
}

// 2) Tính tất định trên cả 3 Đêm
for (const night of [1, 2, 3]) {
  test(`tất định: Đêm ${night} cùng seed/scenario/inputs cho output giống hệt, seed khác thì khác`, () => {
    const inputs = parseInputs(JSON.stringify({
      frames: [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0.2], cam_yaw_deg: 40, dash: true }, { tick: 401, dash: false }, { tick: 900, pulse: true }],
    }));
    const a = runHeadless({ seed: 42, night, ticks: 4000, inputs });
    const b = runHeadless({ seed: 42, night, ticks: 4000, inputs });
    const c = runHeadless({ seed: 43, night, ticks: 4000, inputs });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.ok(a.some((l) => l.includes('"shade_spawned"')), "phải có Bóng Mực tự sinh để so sánh id tự sinh");
  });
}

// 3) Bản đồ chuẩn
test("bản đồ chuẩn: số đèn, vị trí, xuất phát, đom đóm ban đầu của 3 Đêm", () => {
  const first = (n: number) => parse(runHeadless({ seed: 1, night: n, ticks: 0 })).find((l) => l.type === "snapshot")!;
  const s1 = first(1), s2 = first(2), s3 = first(3);
  assert.equal(s1.lanterns.length, 5);
  assert.deepEqual(s1.lanterns.map((l: any) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(s2.lanterns.length, 6);
  assert.deepEqual(s2.lanterns.map((l: any) => l.pos), [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
  assert.equal(s3.lanterns.length, 7);
  assert.deepEqual(s3.lanterns.map((l: any) => l.pos), [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
  assert.deepEqual(s1.player.pos, [0, 0, 0]);
  assert.deepEqual(s2.player.pos, [0, 0, 0]);
  for (const s of [s1, s2, s3]) {
    assert.equal(s.motes_active, 20);
    assert.equal(new Set(s.motes.map((m: any) => m.pos.join(","))).size, 20, "20 điểm khác nhau");
    assert.equal(s.player.flames, T.flames);
    assert.equal(s.player.grounded, true);
    assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
  }
  assert.deepEqual([s1.night, s2.night, s3.night], [1, 2, 3]);
  assert.equal(s1.time_left_s, 240);
  assert.equal(s2.time_left_s, 270);
  assert.equal(s3.time_left_s, 300);
  assert.deepEqual(s1.charms.map((c: any) => c.id), []);
  assert.deepEqual(s2.charms.map((c: any) => [c.id, c.pos]), [["C1", [35, 0, 0]]]);
  assert.deepEqual(s3.charms.map((c: any) => [c.id, c.pos]), [["C1", [30, 0, 25]], ["C2", [-30, 0, 25]]]);
  // điểm sinh đom đóm Đêm 3: tầng 0/1/2 đúng độ cao
  const ys = new Set(first(3).motes.map((m: any) => m.pos[1]));
  for (const y of ys) assert.ok([0, 3, 6].includes(y as number));
});

test("snapshot v1.2 có đủ trường bắt buộc", () => {
  const s = parse(runHeadless({ seed: 1, night: 2, ticks: 0 })).find((l) => l.type === "snapshot")!;
  for (const k of ["type", "tick", "sim_tick", "state", "night", "time_left_s", "score", "wind", "player", "lanterns", "shades", "drifters", "charms", "motes", "motes_active"]) {
    assert.ok(k in s, `thiếu ${k}`);
  }
  for (const k of ["pos", "vel", "grounded", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s", "flames", "carried", "capacity"]) assert.ok(k in s.player, `thiếu player.${k}`);
  assert.ok("kind" in s.motes[0] && "ttl_s" in s.motes[0] && "id" in s.motes[0] && "pos" in s.motes[0]);
  for (const k of ["id", "pos", "lit", "deposited", "fuel", "ever_lit", "relit_count"]) assert.ok(k in s.lanterns[0], `thiếu lanterns.${k}`);
  assert.ok("available" in s.charms[0] && "respawn_s" in s.charms[0]);
  assert.ok("active" in s.wind && "dir_deg" in s.wind);
});

test("night_start ở tick 0; mô hình tick: snapshot đều mỗi --snapshot-every; end là dòng cuối", () => {
  const L = parse(runHeadless({ seed: 5, night: 3, ticks: 95, snapshotEvery: 30 }));
  assert.deepEqual(L.find((l) => l.type === "event"), { type: "event", tick: 0, name: "night_start", data: { night: 3 } });
  assert.deepEqual(L.filter((l) => l.type === "snapshot").map((l) => l.tick), [0, 30, 60, 90]);
  assert.equal(L[L.length - 1].type, "end");
  assert.equal(L[L.length - 1].ticks, 95);
});

// 4) Hiệu năng: một Đêm đầy đủ (tối đa 21.600 tick) <= 30 giây
test("hiệu năng: chạy 21.600 tick mỗi Đêm xong rất nhanh (yêu cầu <= 30 s)", () => {
  for (const night of [1, 2, 3]) {
    const t0 = performance.now();
    const L = runHeadless({ seed: 7, night, ticks: 21600 });
    const ms = performance.now() - t0;
    assert.ok(ms < 30000, `Đêm ${night}: ${ms} ms`);
    assert.equal(parse(L).at(-1)!.type, "end");
  }
});

// 5) Hợp đồng
test("game.contract.json v1.2: số chuẩn và đủ khóa", () => {
  assert.equal(contract.contract_version, "1.2");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd"] as const) assert.ok(contract[k]);
  const std: Record<string, unknown> = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, flames: 3,
    fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20,
    invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
    shade_speed: 4, shade_hit_radius: 1, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true,
  };
  for (const [k, v] of Object.entries(std)) assert.equal((contract.tuning as any)[k], v, `tuning.${k}`);
  // điểm Ticket-03: +5/đom đóm, 100 thắp đầu, 40 thắp lại, +5 (+15 nếu drain) tỏa sáng, 50 mỗi đèn sáng lúc bình minh (+floor(fuel)), 50 mỗi Ngọn Lửa; bỏ thưởng thời gian
  assert.deepEqual(contract.tuning.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_lantern_dawn: 50, per_flame_left: 50 });
  assert.ok(!("per_second_left" in contract.tuning.score), "thưởng thời gian đã bỏ");
});

// 6) CLI: mã thoát và định dạng
test("CLI: chạy đúng -> mã 0, JSONL kết thúc bằng dòng end; --night 1/2/3; chấp nhận cả -seed và --seed", () => {
  for (const n of ["1", "2", "3"]) {
    const out = join(dir, `ok${n}.jsonl`);
    assert.equal(cli(["--seed", "7", "--night", n, "--ticks", "100", "--out", out]).code, 0);
    const L = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(L[L.length - 1].type, "end");
    assert.equal(L.find((l) => l.type === "snapshot").night, Number(n));
  }
  const o1 = join(dir, "dash1.jsonl"), o2 = join(dir, "dash2.jsonl");
  assert.equal(cli(["-seed", "7", "-night", "1", "-ticks", "100", "-out", o1]).code, 0);
  assert.equal(cli(["--seed=7", "--night=1", "--ticks=100", `--out=${o2}`]).code, 0);
  assert.equal(readFileSync(o1, "utf8"), readFileSync(o2, "utf8"));
});

test("CLI: --night ngoài 1..3 -> mã khác 0", () => {
  assert.notEqual(cli(["--seed", "1", "--night", "4", "--ticks", "10", "--out", join(dir, "n4.jsonl")]).code, 0);
});

test("CLI: inputs/scenario sai định dạng -> mã 2 và thông báo ở stderr", () => {
  const out = join(dir, "bad.jsonl");
  const bad = [
    ["inputs", "{ không phải json"],
    ["inputs", JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, move: [1] }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, pulse: "yes" }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, dash: 1 }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, pause: "x" }] })],
    ["scenario", JSON.stringify({ motes: [[1, 2]] })],
    ["scenario", JSON.stringify({ lanterns: [{ id: "L9" }] })],
    ["scenario", JSON.stringify({ shades: [{ pos: [0, 0, 0], state: "dancing" }] })],
    ["scenario", JSON.stringify({ drifters: [{ pos: [0, 0, 0], state: "sleeping" }] })],
    ["scenario", JSON.stringify({ wind_enabled: "yes" })],
    ["scenario", JSON.stringify({ charms: [{ id: "C9" }] })],
    ["scenario", JSON.stringify({ lanterns: [{ id: "L1", fuel: 101 }] })],
    ["scenario", JSON.stringify({ lanterns: [{ id: "L1", fuel: "nhieu" }] })],
    ["scenario", JSON.stringify({ lanterns: [{ id: "L1", ever_lit: "co" }] })],
    ["scenario", JSON.stringify({ shades: [{ pos: [0, 0, 0], target_lantern_id: 5 }] })],
    ["scenario", JSON.stringify({ player: { successful_lights: -1 } })],
  ] as const;
  for (const [kind, content] of bad) {
    const f = join(dir, `${kind}.json`);
    writeFileSync(f, content);
    const r = cli(["--seed", "1", "--night", "2", "--ticks", "10", "--out", out, `--${kind}`, f]);
    assert.equal(r.code, 2, `${kind}: ${content}`);
    assert.ok(r.stderr.length > 0);
  }
  assert.equal(cli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", out, "--inputs", join(dir, "khong-co.json")]).code, 2);
});

test("CLI: thiếu tham số -> mã khác 0", () => {
  assert.notEqual(cli(["--seed", "1"]).code, 0);
});

test("CLI: dừng khi game kết thúc (thua dawn) và vẫn mã 0", () => {
  const sc = join(dir, "dawn.json");
  writeFileSync(sc, JSON.stringify({ random_motes: false, random_shades: false, time_left_s: 2 }));
  const out = join(dir, "dawn.jsonl");
  assert.equal(cli(["--seed", "1", "--night", "1", "--ticks", "5000", "--scenario", sc, "--out", out]).code, 0);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[lines.length - 1].ticks, 120);
  assert.equal(lines[lines.length - 1].state, "lost");
});
