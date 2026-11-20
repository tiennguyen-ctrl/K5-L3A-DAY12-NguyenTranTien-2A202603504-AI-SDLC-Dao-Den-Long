import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS, DEFAULT_KEYS, assignKey, findConflicts, isDown, keyLabel, sanitizeKeys } from "../src/web/keybinds.ts";
import { MAX_ENTRIES, addEntry, exportJson, isoWithOffset, makeEntry, qualifies, sanitizeEntries, sortEntries, validateName } from "../src/web/leaderboard.ts";
import type { LeaderEntry } from "../src/web/leaderboard.ts";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings, sanitize } from "../src/web/settings.ts";
import type { KV } from "../src/web/settings.ts";
import { beginNight, finishNight, newGame, nextAfterResult, startAt } from "../src/web/flow.ts";

const e = (name: string, score: number, at: string, nights = 1, seed = 1): LeaderEntry => ({ name, score, nights_won: nights, achieved_at: at, seed });

// ---------- Bảng xếp hạng ----------
test("tên: 3–12 ký tự [A-Za-z0-9_]; chữ có dấu được nhận (điểm cộng); ký tự lạ/độ dài sai bị từ chối", () => {
  for (const ok of ["abc", "Tien_2026", "A1B2C3D4E5F6", "Nguyễn_Tiến"]) assert.equal(validateName(ok).ok, true, ok);
  for (const bad of ["ab", "a", "", "A1B2C3D4E5F6G", "có dấu cách", "a-b-c", "tên!", "<b>hi</b>", "😀😀😀"]) assert.equal(validateName(bad).ok, false, bad);
  assert.equal(validateName(42).ok, false);
  const c = validateName("  Mây_01  ");
  assert.deepEqual(c, { ok: true, name: "Mây_01" }, "cắt khoảng trắng hai đầu");
});

test("xếp hạng: điểm giảm dần; bằng điểm thì ai đạt trước đứng trên; giữ top 10", () => {
  let list: LeaderEntry[] = [];
  list = addEntry(list, e("bbb", 500, "2026-11-20T10:00:10+07:00"));
  list = addEntry(list, e("aaa", 900, "2026-11-20T10:05:00+07:00"));
  list = addEntry(list, e("ccc", 500, "2026-11-20T10:00:05+07:00"));
  assert.deepEqual(list.map((x) => x.name), ["aaa", "ccc", "bbb"], "ccc đạt 500 sớm hơn bbb nên đứng trên");
  for (let i = 0; i < 20; i++) list = addEntry(list, e(`p${String(i).padStart(2, "0")}`, i * 10, `2026-11-20T11:00:${String(i).padStart(2, "0")}+07:00`));
  assert.equal(list.length, MAX_ENTRIES);
  assert.equal(list[0].name, "aaa");
  assert.ok(list.every((x, i) => i === 0 || list[i - 1].score >= x.score));
  assert.ok(!list.some((x) => x.score < 100 && x.name.startsWith("p")), "điểm thấp bị đẩy khỏi top 10");
});

test("xếp hạng: bằng điểm và bằng cả thời điểm thì ai vào trước giữ thứ hạng; múi giờ khác nhau vẫn so đúng thời điểm", () => {
  const same = sortEntries([e("first", 100, "2026-11-20T10:00:00+07:00"), e("second", 100, "2026-11-20T10:00:00+07:00")]);
  assert.deepEqual(same.map((x) => x.name), ["first", "second"]);
  // 03:00Z = 10:00+07:00; 02:30Z sớm hơn
  const tz = sortEntries([e("late", 100, "2026-11-20T10:00:00+07:00"), e("early", 100, "2026-11-20T02:30:00Z")]);
  assert.deepEqual(tz.map((x) => x.name), ["early", "late"]);
});

test("qualifies: còn chỗ trống hoặc điểm vượt mục thứ 10", () => {
  const full = Array.from({ length: 10 }, (_, i) => e(`n${String(i).padStart(2, "0")}`, 1000 - i * 10, "2026-11-20T10:00:00+07:00"));
  assert.equal(qualifies(full, 911), true, "hơn mục thứ 10 (910) thì thế chỗ");
  assert.equal(qualifies(full, 910), false, "bằng điểm mục thứ 10: người đạt sau đứng dưới nên không vào top 10");
  assert.equal(qualifies(full, 909), false);
  assert.equal(qualifies(full.slice(0, 5), 1), true);
});

test("makeEntry: điểm làm tròn xuống, nights_won kẹp 0..3, achieved_at ISO 8601 có múi giờ, giữ seed", () => {
  const r = makeEntry("Tien_01", 1234.9, 7, 42, new Date("2026-11-20T10:30:00Z"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.entry.score, 1234);
    assert.equal(r.entry.nights_won, 3);
    assert.equal(r.entry.seed, 42);
    assert.match(r.entry.achieved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    assert.equal(Date.parse(r.entry.achieved_at), Date.parse("2026-11-20T10:30:00Z"), "đúng thời điểm");
  }
  assert.equal(makeEntry("x", 1, 1, 1).ok, false);
  assert.match(isoWithOffset(new Date(0)), /[+-]\d{2}:\d{2}$/);
});

test("sanitizeEntries: bỏ mục hỏng, sắp xếp lại, cắt top 10; export có đúng dạng {entries:[...]}", () => {
  const raw = [e("good_one", 50, "2026-11-20T10:00:00+07:00"), { name: "x", score: 1 }, null, e("bad nights", 5, "2026-11-20T10:00:00+07:00"), e("high_one", 80, "2026-11-20T10:00:00+07:00", 3), e("nan_date", 5, "hôm qua")];
  const clean = sanitizeEntries(raw);
  assert.deepEqual(clean.map((x) => x.name), ["high_one", "good_one"]);
  assert.deepEqual(sanitizeEntries({ entries: raw }).map((x) => x.name), ["high_one", "good_one"]);
  assert.deepEqual(sanitizeEntries("hỏng"), []);
  const out = JSON.parse(exportJson(clean));
  assert.deepEqual(Object.keys(out), ["entries"]);
  assert.deepEqual(out.entries.map((x: LeaderEntry) => x.name), ["high_one", "good_one"]);
  assert.deepEqual(Object.keys(out.entries[0]).sort(), ["achieved_at", "name", "nights_won", "score", "seed"]);
});

test("flow: nightsWon đếm số Đêm thắng trong lượt; thua không tăng; chọn Đêm bắt đầu từ 0", () => {
  let f = finishNight(beginNight(newGame()), true, 100);
  assert.equal(f.nightsWon, 1);
  f = finishNight(beginNight(nextAfterResult(f)), false, 5);
  assert.deepEqual([f.nightsWon, f.total], [1, 100]);
  assert.equal(startAt(3).nightsWon, 0);
  f = finishNight(beginNight(startAt(3)), true, 70);
  assert.deepEqual([f.screen, f.nightsWon, f.total], ["dawn", 1, 70]);
});

// ---------- Đổi phím ----------
test("đổi phím: mặc định đủ 9 hành động và không trùng", () => {
  assert.equal(ACTIONS.length, 9);
  assert.deepEqual(findConflicts(DEFAULT_KEYS), []);
  assert.equal(DEFAULT_KEYS.up, "KeyW");
  assert.equal(keyLabel("KeyW"), "W");
  assert.equal(keyLabel("Space"), "Space");
});

test("đổi phím: gán phím mới thì đổi; trùng phím hành động khác thì từ chối và báo trùng với hành động nào", () => {
  const ok = assignKey(DEFAULT_KEYS, "jump", "KeyJ");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.map.jump, "KeyJ");
  const dup = assignKey(DEFAULT_KEYS, "jump", "KeyE");
  assert.deepEqual(dup, { ok: false, reason: "duplicate", with: "interact" });
  const same = assignKey(DEFAULT_KEYS, "interact", "KeyE");
  assert.equal(same.ok, true, "gán lại đúng phím hiện tại của chính nó thì không phải trùng");
  assert.deepEqual(assignKey(DEFAULT_KEYS, "jump", "Enter"), { ok: false, reason: "reserved" });
  assert.deepEqual(assignKey(DEFAULT_KEYS, "jump", "ArrowLeft"), { ok: false, reason: "reserved" });
});

test("đổi phím: sanitizeKeys đưa dữ liệu thiếu/trùng/hỏng về mặc định; Shift phải tính khi gán Shift trái", () => {
  assert.deepEqual(sanitizeKeys(null), DEFAULT_KEYS);
  assert.deepEqual(sanitizeKeys({ ...DEFAULT_KEYS, jump: "KeyE" }), DEFAULT_KEYS, "trùng với interact");
  assert.deepEqual(sanitizeKeys({ ...DEFAULT_KEYS, jump: 5 }), DEFAULT_KEYS);
  assert.equal(sanitizeKeys({ ...DEFAULT_KEYS, jump: "KeyJ" }).jump, "KeyJ");
  assert.equal(isDown(DEFAULT_KEYS, "dash", new Set(["ShiftRight"])), true);
  assert.equal(isDown({ ...DEFAULT_KEYS, dash: "KeyQ" }, "dash", new Set(["ShiftRight"])), false);
  assert.equal(isDown(DEFAULT_KEYS, "up", new Set(["KeyW"])), true);
});

test("cài đặt: phím và trợ năng được lưu, mở lại vẫn giữ; mặc định tắt giảm chuyển động và chữ lớn", () => {
  const data = new Map<string, string>();
  const st: KV = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  assert.equal(DEFAULT_SETTINGS.reduceMotion, false);
  assert.equal(DEFAULT_SETTINGS.largeText, false);
  const mine = { ...DEFAULT_SETTINGS, reduceMotion: true, largeText: true, keys: { ...DEFAULT_KEYS, pulse: "KeyR" } };
  assert.equal(saveSettings(mine, st), true);
  assert.ok(data.has(SETTINGS_KEY));
  assert.deepEqual(loadSettings(st), mine);
  assert.equal(sanitize({ reduceMotion: "yes", largeText: 1 }).reduceMotion, false);
});

// ---------- Benchmark: cảnh chuẩn và công thức số đo ----------
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH_MOTES, BENCH_SHADES, benchScenario, benchStats, cameraAt, spreadOnDisk } from "../src/web/bench.ts";
import { createGame, idleInput, stepGame } from "../src/core/game.ts";
import { createStaticServer, readLeaderboard } from "../scripts/server-lib.ts";

const ROOT = join(import.meta.dirname, "..");

test("benchStats: avg_fps = 1000×N/Σdt; p1_low = 1000/trung bình k=max(1,ceil(0,01N)) khung chậm nhất; p95 theo hạng gần nhất", () => {
  const s10 = benchStats([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert.deepEqual(s10, { frames: 10, avg_fps: 100, p1_low_fps: 100, frame_ms_p95: 10 });
  // 200 khung: 198 khung 10 ms + 2 khung 100 ms. k = ceil(2) = 2 -> trung bình 100 ms -> 10 fps
  const dt = [...Array(198).fill(10), 100, 100];
  const s = benchStats(dt);
  assert.equal(s.frames, 200);
  assert.equal(s.avg_fps, Math.round(((1000 * 200) / (198 * 10 + 200)) * 10) / 10);
  assert.equal(s.p1_low_fps, 10);
  assert.equal(s.frame_ms_p95, 10, "hạng 190/200 vẫn là 10 ms");
  // 1 khung: k = max(1, ceil(0,01)) = 1
  assert.deepEqual(benchStats([20]), { frames: 1, avg_fps: 50, p1_low_fps: 50, frame_ms_p95: 20 });
  // 1000 khung: k = 10 khung chậm nhất
  const d2 = [...Array(990).fill(10), ...Array(10).fill(50)];
  assert.equal(benchStats(d2).p1_low_fps, 20);
  assert.equal(benchStats([]).frames, 0);
});

test("camera bench: xuất phát (30,15,0); bán kính 30, cao 15; 15 s một vòng; ngược chiều kim đồng hồ nhìn từ trên xuống (về phía -Z)", () => {
  assert.deepEqual(cameraAt(0).map((v) => Math.round(v * 1e6) / 1e6), [30, 15, 0]);
  const q = cameraAt(15 / 4);
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2] + 30) < 1e-9, "1/4 vòng: (0,15,-30)");
  const h = cameraAt(7.5);
  assert.ok(Math.abs(h[0] + 30) < 1e-9 && Math.abs(h[2]) < 1e-9, "nửa vòng: (-30,15,0)");
  const f = cameraAt(15);
  assert.ok(Math.abs(f[0] - 30) < 1e-9 && Math.abs(f[2]) < 1e-9, "đủ một vòng về điểm xuất phát");
  for (const t of [0, 1.3, 4.9, 11]) {
    const c = cameraAt(t);
    assert.ok(Math.abs(Math.hypot(c[0], c[2]) - 30) < 1e-9);
    assert.equal(c[1], 15);
  }
});

test("cảnh bench: đúng 200 Bóng Mực wander + 100 đom đóm rải đều trong đảo, 3 đèn L1–L3 sáng fuel 100, Mây ở (0,0,0), tất định theo seed", () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades!.length, BENCH_SHADES);
  assert.equal(BENCH_SHADES, 200);
  assert.equal(sc.motes!.length, BENCH_MOTES);
  assert.equal(BENCH_MOTES, 100);
  assert.ok(sc.shades!.every((s) => s.state === "wander"));
  assert.ok(sc.shades!.every((s) => Math.hypot(s.pos[0], s.pos[2]) <= 40), "trong đảo Đêm 1 (bán kính 40)");
  assert.equal(new Set(sc.shades!.map((s) => s.pos.join(","))).size, 200, "200 vị trí khác nhau");
  assert.deepEqual(sc.lanterns, [{ id: "L1", lit: true, fuel: 100 }, { id: "L2", lit: true, fuel: 100 }, { id: "L3", lit: true, fuel: 100 }]);
  assert.deepEqual(sc.player!.pos, [0, 0, 0]);
  assert.deepEqual(benchScenario(42), benchScenario(42));
  assert.notDeepEqual(benchScenario(42), benchScenario(43));
  // rải đều: nửa diện tích đĩa chứa khoảng một nửa số điểm
  const pts = spreadOnDisk(200, 37, 42);
  const inner = pts.filter(([x, z]) => Math.hypot(x, z) <= 37 / Math.SQRT2).length;
  assert.ok(Math.abs(inner - 100) <= 2, `nửa diện tích có ${inner} điểm`);
});

test("game.bench: Bóng Mực vẫn wander và di chuyển; không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc Đêm kể cả qua bình minh", () => {
  const g = createGame(42, benchScenario(42), 1);
  g.bench = true;
  g.timeLeftInit = 2; // bình minh sau 120 tick
  const before = g.shades.map((s) => [s.pos[0], s.pos[2]]);
  const events: unknown[] = [];
  for (let k = 0; k < 600; k++) events.push(...stepGame(g, idleInput()));
  assert.equal(g.state, "playing", "không kết thúc Đêm");
  assert.deepEqual(events, [], "không có sự kiện nào");
  assert.equal(g.shades.length, 200);
  assert.ok(g.shades.every((s) => s.state === "wander"), "luôn wander dù Mây ở gần");
  assert.ok(g.shades.some((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][1]) > 1), "bóng đang di chuyển");
  assert.equal(g.motes.length, 100);
  assert.deepEqual(g.lanterns.slice(0, 3).map((l) => [l.lit, l.fuelU]), [[true, 6000], [true, 6000], [true, 6000]]);
  assert.equal(g.player.flames, 3);
  assert.equal(g.player.carried, 0);
});

test("cờ bench mặc định tắt: không đổi đầu ra headless (Mây ở gần bóng wander thì bị chase)", () => {
  const g = createGame(1, { random_motes: false, random_shades: false, shades: [{ pos: [0, 1, 5], state: "wander" }] }, 1);
  assert.equal(g.bench, false);
  stepGame(g, idleInput());
  assert.equal(g.shades[0].state, "chase");
});

// ---------- Soak ----------
test("soak: chạy 3 Đêm liên tiếp trong cùng tiến trình, ghi JSON đúng dạng, kết quả tất định theo seed", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-soak-"));
  const run = (f: string) => {
    const r = spawnSync(process.execPath, ["scripts/soak.ts", "--seed", "7", "--nights", "3", "--out", join(dir, f)], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(join(dir, f), "utf8"));
  };
  const a = run("a.json"), b = run("b.json");
  assert.equal(a.nights, 3);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 3);
  assert.ok(a.results.every((r: string) => r === "won" || r === "lost"));
  for (const k of ["nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"]) assert.ok(k in a, k);
  assert.deepEqual(a.results, b.results, "cùng seed cho cùng kết quả");
  const bad = spawnSync(process.execPath, ["scripts/soak.ts", "--seed", "7"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(bad.status, 2, "thiếu tham số -> mã 2");
});

// ---------- Bảng xếp hạng lưu ra đĩa + xuất ----------
test("bảng xếp hạng trên đĩa: API lưu top 10 đã sắp xếp, từ chối mục sai, còn nguyên sau khi mở lại máy chủ; lệnh xuất ra {entries:[...]} đúng thứ tự", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-lb-"));
  const file = join(dir, "lb.json");
  const mk = () => createStaticServer({ dir, leaderboardFile: file });
  let srv = mk();
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  let base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const post = (e: unknown) => fetch(`${base}/api/leaderboard`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e) });
  assert.deepEqual(await (await fetch(`${base}/api/leaderboard`)).json(), { entries: [] });
  for (let i = 0; i < 12; i++) {
    const res = await post({ name: `Player${String(i).padStart(2, "0")}`, score: i * 100, nights_won: i % 4, achieved_at: `2026-11-20T10:00:${String(i).padStart(2, "0")}+07:00`, seed: i });
    assert.equal(res.status, 200);
  }
  assert.equal((await post({ name: "x", score: 1, nights_won: 1, achieved_at: "2026-11-20T10:00:00+07:00", seed: 1 })).status, 400, "tên quá ngắn");
  assert.equal((await post({ name: "Hopelee", score: 1, nights_won: 9, achieved_at: "2026-11-20T10:00:00+07:00", seed: 1 })).status, 400, "nights_won > 3");
  assert.equal((await post("không phải object")).status, 400);
  const { entries } = (await (await fetch(`${base}/api/leaderboard`)).json()) as { entries: LeaderEntry[] };
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map((x) => x.score), [1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200]);
  await new Promise<void>((r) => srv.close(() => r()));
  // mở lại: dữ liệu còn trên đĩa
  assert.equal(readLeaderboard(file).length, 10);
  srv = mk();
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  assert.equal(((await (await fetch(`${base}/api/leaderboard`)).json()) as { entries: unknown[] }).entries.length, 10);
  await new Promise<void>((r) => srv.close(() => r()));
  // lệnh xuất (npm run dev -- --export-leaderboard out.json)
  const out = join(dir, "out.json");
  const env = { ...process.env, DDL_LEADERBOARD: file };
  const r = spawnSync(process.execPath, ["scripts/run.ts", "--export-leaderboard", out], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  const exported = JSON.parse(readFileSync(out, "utf8")) as { entries: LeaderEntry[] };
  assert.deepEqual(Object.keys(exported), ["entries"]);
  assert.deepEqual(exported.entries.map((x) => x.score), [1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200]);
  writeFileSync(file, "{ hỏng");
  const r2 = spawnSync(process.execPath, ["scripts/run.ts", "-export-leaderboard", out], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(r2.status, 0, "file đĩa hỏng vẫn xuất được danh sách rỗng");
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { entries: [] });
});
