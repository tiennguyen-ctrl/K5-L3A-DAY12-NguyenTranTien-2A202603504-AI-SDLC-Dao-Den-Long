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
  test(`kịch bản: ${c.name}`, () => {
    const lines = runHeadless({
      seed: c.seed,
      ticks: c.ticks,
      scenario: c.scenario && parseScenario(JSON.stringify(c.scenario)),
      inputs: c.inputs && parseInputs(JSON.stringify(c.inputs)),
    });
    c.check(parse(lines));
  });
}

// 2) Tính tất định
test("tất định: cùng seed/scenario/inputs cho output giống hệt, seed khác thì khác", () => {
  const inputs = parseInputs(JSON.stringify({
    frames: [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0.2], cam_yaw_deg: 40 }, { tick: 900, pulse: true }],
  }));
  const a = runHeadless({ seed: 42, ticks: 3000, inputs });
  const b = runHeadless({ seed: 42, ticks: 3000, inputs });
  const c = runHeadless({ seed: 43, ticks: 3000, inputs });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.some((l) => l.includes('"shade_spawned"')), "kịch bản dài phải có Bóng Mực tự sinh để so sánh id");
});

test("tick 0 là trạng thái trước input; snapshot đều mỗi --snapshot-every; end là dòng cuối", () => {
  const L = parse(runHeadless({ seed: 5, ticks: 95, snapshotEvery: 30 }));
  assert.deepEqual(L.filter((l) => l.type === "snapshot").map((l) => l.tick), [0, 30, 60, 90]);
  assert.equal(L[L.length - 1].type, "end");
  assert.equal(L[L.length - 1].ticks, 95);
  assert.equal(L[0].time_left_s, T.night1_duration_s);
});

test("mặc định: 1 màn, 5 đèn, người chơi (0,0,0), có đom đóm", () => {
  const s = parse(runHeadless({ seed: 1, ticks: 0 }))[0];
  assert.equal(s.lanterns.length, T.lantern_count_night1);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.player.flames, T.flames);
  assert.ok(s.motes_active > 0);
});

// 3) Hợp đồng
test("game.contract.json đủ khóa theo Test Contract v1.0", () => {
  assert.equal(contract.contract_version, "1.0");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd"] as const) assert.ok(contract[k]);
  for (const k of [
    "player_speed", "carry_capacity", "lantern_cost", "lantern_count_night1", "pickup_radius", "interact_radius",
    "pulse_cost", "pulse_radius", "night1_duration_s", "flames", "invuln_s", "hit_drop_ratio", "pulse_stun_s",
    "pulse_push_m", "pulse_cooldown_s", "safe_radius", "shade_speed", "shade_hit_radius", "fall_enabled", "score",
  ]) assert.ok(k in contract.tuning, `thiếu tuning.${k}`);
  for (const k of ["per_mote", "per_lantern", "per_stun", "per_second_left", "per_flame_left"]) {
    assert.ok(k in contract.tuning.score, `thiếu tuning.score.${k}`);
  }
  assert.equal(contract.tuning.lantern_count_night1, 5);
});

// 4) CLI: mã thoát và định dạng
test("CLI: chạy đúng -> mã 0, file JSONL kết thúc bằng dòng end; chấp nhận cả -seed và --seed", () => {
  const out = join(dir, "ok.jsonl");
  assert.equal(cli(["--seed", "7", "--night", "1", "--ticks", "100", "--out", out]).code, 0);
  const L = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(L[L.length - 1].type, "end");
  const out2 = join(dir, "ok2.jsonl");
  assert.equal(cli(["-seed", "7", "-night", "1", "-ticks", "100", "-out", out2]).code, 0);
  assert.equal(readFileSync(out, "utf8"), readFileSync(out2, "utf8"));
});

test("CLI: inputs/scenario sai định dạng -> mã 2 và thông báo ở stderr", () => {
  const out = join(dir, "bad.jsonl");
  const bad = [
    ["inputs", "{ không phải json"],
    ["inputs", JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, move: [1] }] })],
    ["inputs", JSON.stringify({ frames: [{ tick: 0, pulse: "yes" }] })],
    ["scenario", JSON.stringify({ motes: [[1, 2]] })],
    ["scenario", JSON.stringify({ lanterns: [{ id: "L9" }] })],
  ] as const;
  for (const [kind, content] of bad) {
    const f = join(dir, `${kind}.json`);
    writeFileSync(f, content);
    const r = cli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", out, `--${kind}`, f]);
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
