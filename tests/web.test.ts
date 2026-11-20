import assert from "node:assert/strict";
import { test } from "node:test";
import { beginNight, finishNight, initialFlow, newGame, nextAfterResult, retryNight, NIGHT_INFO } from "../src/web/flow.ts";
import type { Flow } from "../src/web/flow.ts";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, sanitize, saveSettings } from "../src/web/settings.ts";
import type { KV } from "../src/web/settings.ts";
import { PALETTE } from "../src/web/palette.ts";

// ---------- Cài đặt: lưu giữa các lần mở game ----------
const memory = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test("cài đặt: mặc định khi chưa lưu; lưu rồi mở lại (storage mới trỏ cùng dữ liệu) vẫn giữ", () => {
  const st = memory();
  assert.deepEqual(loadSettings(st), DEFAULT_SETTINGS);
  assert.equal(saveSettings({ volume: 0.25, sensitivity: 2.2 }, st), true);
  assert.ok(st.data.has(SETTINGS_KEY));
  assert.deepEqual(loadSettings(st), { volume: 0.25, sensitivity: 2.2 });
});

test("cài đặt: giá trị hỏng/ngoài khoảng được làm sạch, không làm vỡ game", () => {
  assert.deepEqual(sanitize({ volume: 9, sensitivity: -4 }), { volume: 1, sensitivity: 0.2 });
  assert.deepEqual(sanitize({ volume: "abc" }), DEFAULT_SETTINGS);
  assert.deepEqual(sanitize(null), DEFAULT_SETTINGS);
  const st = memory();
  st.setItem(SETTINGS_KEY, "{ không phải json");
  assert.deepEqual(loadSettings(st), DEFAULT_SETTINGS);
});

test("cài đặt: storage bị chặn (ném lỗi) hoặc không có thì vẫn chạy", () => {
  const broken: KV = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadSettings(broken), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, broken), false);
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, null), false);
});

// ---------- Chuỗi 3 Đêm ----------
const play = (f: Flow, won: boolean, score: number) => finishNight(beginNight(f), won, score);

test("chuỗi 3 Đêm: menu -> giới thiệu -> chơi -> kết quả -> Đêm kế tiếp -> ... -> Bình Minh với tổng điểm", () => {
  let f = initialFlow();
  assert.equal(f.screen, "menu");
  f = newGame();
  assert.deepEqual([f.screen, f.night, f.total], ["intro", 1, 0]);
  f = play(f, true, 500);
  assert.deepEqual([f.screen, f.night, f.total], ["result", 1, 500]);
  f = nextAfterResult(f);
  assert.deepEqual([f.screen, f.night], ["intro", 2]);
  f = play(f, true, 700);
  f = nextAfterResult(f);
  assert.deepEqual([f.screen, f.night, f.total], ["intro", 3, 1200]);
  f = play(f, true, 900);
  assert.equal(f.screen, "dawn");
  assert.equal(f.total, 2100, "tổng điểm = tổng các Đêm đã thắng");
});

test("chuỗi 3 Đêm: thua thì chơi lại đúng Đêm đó và không cộng điểm", () => {
  let f = play(newGame(), true, 400);
  f = nextAfterResult(f);
  f = play(f, false, 150);
  assert.deepEqual([f.screen, f.night, f.total, f.lastWon], ["result", 2, 400, false]);
  f = nextAfterResult(f);
  assert.deepEqual([f.screen, f.night, f.total], ["intro", 2, 400]);
  f = play(f, true, 600);
  assert.equal(f.total, 1000);
});

test("chuỗi 3 Đêm: thua rồi thắng ở Đêm 3 vẫn ra Bình Minh; chơi lại Đêm từ menu tạm dừng giữ tổng điểm", () => {
  let f: Flow = { ...newGame(), night: 3, total: 800 };
  f = play(f, false, 10);
  f = nextAfterResult(f);
  f = play(f, true, 300);
  assert.deepEqual([f.screen, f.total], ["dawn", 1100]);
  const r = retryNight({ ...newGame(), night: 2, total: 300, screen: "playing" });
  assert.deepEqual([r.screen, r.night, r.total], ["intro", 2, 300]);
});

test("chuỗi 3 Đêm: bước sai thứ tự bị bỏ qua", () => {
  const f = newGame();
  assert.equal(finishNight(f, true, 99), f, "chưa chơi thì không kết thúc được");
  assert.equal(nextAfterResult(f), f);
});

test("mỗi Đêm có tên đảo và lời Ông Đăng", () => {
  assert.deepEqual([1, 2, 3].map((n) => NIGHT_INFO[n as 1 | 2 | 3].name), ["Đảo Bến", "Đảo Cau", "Đảo Chuông"]);
  for (const n of [1, 2, 3] as const) assert.ok(NIGHT_INFO[n].lines.length >= 2);
});

// ---------- Bảng màu chuẩn ----------
test("bảng màu chuẩn của Ticket-02 dùng đúng mã hex", () => {
  const hex = (n: number) => "#" + n.toString(16).padStart(6, "0").toUpperCase();
  const expected: Record<string, string> = {
    sky: "#0E1430", mist: "#1B2350", grass: "#2F5D50", sand: "#C9B48A", wood: "#6B4A2F", cloudSea: "#12384A",
    lanternLit: "#FFB347", lanternCore: "#FFE9B0", lanternOff: "#5B5F6E", moteCore: "#FFF6C2", moteHalo: "#FFE58A",
    shadeBody: "#120A1A", shadeRim: "#7A3CFF", shadeStunned: "#3A3450", mayRobe: "#E8E2D0", mayScarf: "#C8102E",
    charm: "#C8102E", gold: "#F2C14E", drifter: "#8FA3B8", danger: "#FF5A5F", text: "#F5F1E6",
  };
  for (const [k, v] of Object.entries(expected)) assert.equal(hex((PALETTE as Record<string, number>)[k]), v, k);
});
