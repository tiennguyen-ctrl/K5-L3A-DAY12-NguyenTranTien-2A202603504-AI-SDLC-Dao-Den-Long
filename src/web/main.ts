import * as THREE from "three";
import { DT, T, WORLD } from "../core/constants.ts";
import { capacityOf, createGame, idleInput, stepGame, timeLeft, winNeed } from "../core/game.ts";
import type { Game } from "../core/game.ts";
import type { GameEvent, Scenario } from "../core/types.ts";
import { AudioBank } from "./audio.ts";
import type { Sfx } from "./audio.ts";
import { buildMay } from "./character.ts";
import { NIGHT_INFO, backToMenu, beginNight, finishNight, initialFlow, newGame, nextAfterResult, retryNight, startAt } from "./flow.ts";
import type { Flow, NightNo } from "./flow.ts";
import { BENCH_WARMUP_S, benchScenario, benchStats, cameraAt } from "./bench.ts";
import { ACTIONS, ACTION_LABEL, DEFAULT_KEYS, assignKey, isDown, keyLabel } from "./keybinds.ts";
import { LEADERBOARD_KEY, addEntry, makeEntry, sanitizeEntries } from "./leaderboard.ts";
import type { LeaderEntry } from "./leaderboard.ts";
import { PALETTE } from "./palette.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { World } from "./world.ts";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const query = new URLSearchParams(location.search);
const BENCH = query.has("bench");

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Cảnh benchmark: canvas cố định 1280×720, pixel ratio 1 để mọi bài đo trên cùng độ phân giải.
renderer.setPixelRatio(BENCH ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(BENCH ? 1280 : innerWidth, BENCH ? 720 : innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.mist, 40, 170);
const camera = new THREE.PerspectiveCamera(60, BENCH ? 1280 / 720 : innerWidth / innerHeight, 0.1, 400);
const may = buildMay();
scene.add(may.group);
const starGeo = new THREE.BufferGeometry();
const sp: number[] = [];
for (let i = 0; i < 400; i++) {
  const a = Math.random() * Math.PI * 2, e = 0.1 + Math.random() * 1.2, R = 300;
  sp.push(Math.sin(a) * Math.cos(e) * R, Math.sin(e) * R, Math.cos(a) * Math.cos(e) * R);
}
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: PALETTE.text, size: 1.2, fog: false })));

// ---------- trạng thái ----------
let flow: Flow = initialFlow();
let game: Game = createGame(1, {}, 1);
let world: World | null = null;
let paused = false;
let ending = false;
let camYaw = 0;
let acc = 0, last = performance.now(), clock = 0;
let prevPos = { x: 0, z: 0 };
let prevJump = false;
let lastCountdown = -1;
const settings = loadSettings();
const audio = new AudioBank();
audio.setVolume(settings.volume);
const keys = new Set<string>();
let calm = false;
let lastReason = "";
let shake = 0; // giây còn lại của rung camera (tắt khi bật "Giảm chuyển động")
let capUntil = 0;
const cues = new Map<string, { until: number; pos: [number, number, number] }>();
const savedRun = { done: false };
let lastDrainToast = -999;
const applyColorblind = () => document.body.classList.toggle("cb", settings.colorblind);
const applyAccess = () => {
  applyColorblind();
  document.body.classList.toggle("rm", settings.reduceMotion);
  document.body.classList.toggle("lt", settings.largeText);
};
applyAccess();
function caption(text: string, seconds = 3): void {
  const c = $("caption");
  c.textContent = text;
  c.style.display = "block";
  capUntil = clock + seconds;
}
let testScenario: Scenario = {};

function startNight(): void {
  world?.dispose();
  const sc: Scenario = calm ? { random_shades: false, random_drifters: false, ...testScenario } : { ...testScenario };
  game = createGame((Math.random() * 2 ** 31) >>> 0, sc, flow.night);
  world = new World(scene, game.night, game);
  world.setColorblind(settings.colorblind);
  lastReason = "";
  savedRun.done = false;
  cues.clear();
  shake = 0;
  camYaw = 0;
  acc = 0;
  paused = false;
  ending = false;
  lastCountdown = -1;
  prevPos = { x: game.player.pos[0], z: game.player.pos[2] };
  camera.position.set(game.player.pos[0], 5.2, game.player.pos[2] - 8);
  $("overlay").style.display = "none";
  $("toast").innerHTML = "";
  audio.startMusic();
}

// ---------- màn hình (overlay) ----------
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function card(html: string): void {
  $("card").innerHTML = html;
  $("overlay").style.display = "flex";
}
const k = (a: (typeof ACTIONS)[number]) => `<kbd>${keyLabel(settings.keys[a])}</kbd>`;
const controls = () => `<p>${k("up")}${k("left")}${k("down")}${k("right")} đi · ${k("jump")} nhảy · ${k("dash")} lướt · ${k("interact")} nạp/châm dầu · ${k("pulse")} tỏa sáng<br><kbd>←</kbd><kbd>→</kbd> hoặc kéo chuột xoay camera · ${k("pause")} tạm dừng (đổi phím ở Cài đặt)</p>`;

function showMenu(): void {
  flow = initialFlow();
  card(`<h1>Đảo Đèn Lồng</h1>
    <p>Sương đen đã nuốt hết ánh sáng của các hòn đảo. Mây phải nhặt đom đóm, thắp lại Đèn Lồng Lớn qua <b>3 Đêm</b> và né Bóng Mực.</p>
    ${controls()}
    <button id="b-start">Bắt đầu (Enter)</button><button id="b-lb" class="alt">Bảng xếp hạng</button><button id="b-set" class="alt">Cài đặt</button>
    <p><small>Chọn Đêm để chơi thẳng:</small><br>
    <button id="b-n1" class="alt">Đêm 1 · Đảo Bến</button><button id="b-n2" class="alt">Đêm 2 · Đảo Cau</button><button id="b-n3" class="alt">Đêm 3 · Đảo Chuông</button></p>`);
  $("b-start").onclick = onStart;
  for (const n of [1, 2, 3] as const) $(`b-n${n}`).onclick = () => { audio.unlock(); flow = startAt(n); showIntro(); };
  $("b-set").onclick = () => showSettings(showMenu);
  $("b-lb").onclick = () => void showBoard(showMenu);
}
function showIntro(): void {
  const info = NIGHT_INFO[flow.night];
  card(`<h2>Đêm ${flow.night}: ${info.name}</h2>
    ${info.lines.map((l) => `<p class="say"><span class="who">Ông Đăng:</span> ${l}</p>`).join("")}
    <p><small>Tổng điểm hiện tại: ${flow.total}</small></p>
    <button id="b-go">Bắt đầu Đêm ${flow.night} (Enter)</button>`);
  $("b-go").onclick = onBegin;
}
function resultText(won: boolean): string {
  const lit = game.lanterns.filter((l) => l.lit).length, total = game.lanterns.length, need = winNeed(total);
  if (won) return `Mây đã giữ cho ${lit}/${total} Đèn Lồng sáng tới bình minh (cần ${need}).`;
  if (lastReason === "no_flames" || game.player.flames <= 0) return "Mây hết Ngọn Lửa.";
  return `Trời sáng nhưng chỉ còn ${lit}/${total} đèn sáng, cần ít nhất ${need}.`;
}
function showResult(): void {
  const won = flow.lastWon;
  card(`<h1 class="${won ? "" : "bad"}">${won ? `Đêm ${flow.night} đã sáng!` : "Sương đen đã nuốt đảo…"}</h1>
    <p>${resultText(won)}</p>
    <p>Điểm Đêm này: <b>${flow.lastScore}</b> · Tổng điểm: <b>${flow.total}</b></p>
    ${won ? "" : scoreForm()}
    <button id="b-next">${won ? `Đêm kế tiếp (Enter)` : `Chơi lại Đêm ${flow.night} (Enter)`}</button>
    <button id="b-menu" class="alt">Về menu</button>`);
  $("b-next").onclick = onNext;
  $("b-menu").onclick = onMenu;
  if (!won) wireScoreForm();
}
function showDawn(): void {
  card(`<h1>Bình Minh</h1>
    <p>Ba hòn đảo đã sáng rực. Ông Đăng mỉm cười: "Cháu làm được rồi, Mây."</p>
    <p>Tổng điểm: <b style="font-size:1.5em;color:var(--gold)">${flow.total}</b></p>
    ${scoreForm()}
    <button id="b-menu">Về menu (Enter)</button>`);
  $("b-menu").onclick = onMenu;
  wireScoreForm();
}

// ---------- bảng xếp hạng ----------
async function loadBoard(): Promise<LeaderEntry[]> {
  try {
    const r = await fetch("/api/leaderboard");
    if (r.ok) { const list = sanitizeEntries(await r.json()); mirrorBoard(list); return list; }
  } catch { /* không có máy chủ (bản web tĩnh): dùng localStorage */ }
  try { return sanitizeEntries(JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? "[]")); } catch { return []; }
}
function mirrorBoard(list: LeaderEntry[]): void { try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list)); } catch { /* bị chặn */ } }
async function saveBoard(entry: LeaderEntry): Promise<LeaderEntry[]> {
  try {
    const r = await fetch("/api/leaderboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
    if (r.ok) { const list = sanitizeEntries(await r.json()); mirrorBoard(list); return list; }
  } catch { /* tĩnh: lưu cục bộ trong trình duyệt */ }
  const list = addEntry(await loadBoard(), entry);
  mirrorBoard(list);
  return list;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
function scoreForm(): string {
  if (savedRun.done) return `<p class="msg">Đã lưu điểm vào bảng xếp hạng.</p>`;
  return `<p>Lưu ${flow.total} điểm (${flow.nightsWon} Đêm thắng) vào bảng xếp hạng:<br>
    <input id="lb-name" type="text" maxlength="12" placeholder="Tên 3–12 ký tự" autocomplete="off" aria-label="Tên" />
    <button id="lb-save">Lưu điểm</button></p><p class="msg" id="lb-msg"></p>`;
}
function wireScoreForm(): void {
  const input = document.getElementById("lb-name") as HTMLInputElement | null;
  if (!input) return;
  const save = async () => {
    const r = makeEntry(input.value, flow.total, flow.nightsWon, game.seed);
    if (!r.ok) { $("lb-msg").textContent = r.reason; return; }
    await saveBoard(r.entry);
    savedRun.done = true;
    void showBoard(flow.screen === "dawn" ? showDawn : showResult, r.entry);
  };
  $("lb-save").onclick = () => void save();
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } };
}
async function showBoard(back: () => void, mine?: LeaderEntry): Promise<void> {
  const list = await loadBoard();
  const rows = list.map((e, i) => `<tr${mine && e.name === mine.name && e.achieved_at === mine.achieved_at ? ' style="color:var(--lit);font-weight:700"' : ""}><td>${i + 1}</td><td>${esc(e.name)}</td><td class="n">${e.score}</td><td class="n">${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace("T", " "))}</td></tr>`).join("");
  card(`<h2>Bảng xếp hạng</h2>
    ${list.length ? `<table class="lb"><thead><tr><th>#</th><th>Tên</th><th class="n">Điểm</th><th class="n">Đêm</th><th>Lúc</th></tr></thead><tbody>${rows}</tbody></table>` : "<p>Chưa có ai. Hãy chơi và lưu điểm của bạn.</p>"}
    <button id="lb-back">Quay lại</button>`);
  $("lb-back").onclick = back;
}
function showPause(): void {
  card(`<h2>Tạm dừng</h2>
    <button id="p-resume">Tiếp tục (Esc)</button>
    <button id="p-retry" class="alt">Chơi lại Đêm</button>
    <button id="p-set" class="alt">Cài đặt</button>
    <button id="p-menu" class="alt">Về menu</button>`);
  $("p-resume").onclick = togglePause;
  $("p-retry").onclick = () => { paused = false; flow = retryNight(flow); showIntro(); };
  $("p-set").onclick = () => showSettings(showPause);
  $("p-menu").onclick = onMenu;
}
let capturing: ((code: string) => void) | null = null;
function showSettings(back: () => void): void {
  const keyRows = () => ACTIONS.map((a) => `<div class="keyrow"><span>${ACTION_LABEL[a]}</span><button class="alt" data-act="${a}">${keyLabel(settings.keys[a])}</button></div>`).join("");
  card(`<h2>Cài đặt</h2>
    <label>Âm lượng: <b id="v-vol">${Math.round(settings.volume * 100)}%</b>
      <input id="s-vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" /></label>
    <label>Độ nhạy chuột: <b id="v-sen">${settings.sensitivity.toFixed(1)}×</b>
      <input id="s-sen" type="range" min="2" max="30" value="${Math.round(settings.sensitivity * 10)}" /></label>
    <label style="display:flex;gap:8px;align-items:center"><input id="s-cb" type="checkbox" ${settings.colorblind ? "checked" : ""} />
      Bảng màu dễ phân biệt (Bóng Mực xanh #00B3FF, cảnh báo trắng kèm ⚠)</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="s-rm" type="checkbox" ${settings.reduceMotion ? "checked" : ""} />
      Giảm chuyển động (tắt rung camera và chớp màn hình)</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="s-lt" type="checkbox" ${settings.largeText ? "checked" : ""} />
      Chữ lớn (×1,25)</label>
    <h2 style="margin-top:14px">Phím điều khiển</h2>
    <p><small>Bấm vào một phím rồi nhấn phím mới. Phím trùng sẽ bị từ chối.</small></p>
    <div id="keys">${keyRows()}</div>
    <p class="msg" id="k-msg" role="status" aria-live="polite"></p>
    <button id="k-reset" class="alt">Khôi phục mặc định</button>
    <p><small>Cài đặt được lưu và giữ nguyên lần sau mở game.</small></p>
    <button id="s-back">Quay lại</button>`);
  ($("s-vol") as HTMLInputElement).oninput = (e) => {
    settings.volume = Number((e.target as HTMLInputElement).value) / 100;
    $("v-vol").textContent = `${Math.round(settings.volume * 100)}%`;
    audio.setVolume(settings.volume);
    saveSettings(settings);
  };
  ($("s-sen") as HTMLInputElement).oninput = (e) => {
    settings.sensitivity = Number((e.target as HTMLInputElement).value) / 10;
    $("v-sen").textContent = `${settings.sensitivity.toFixed(1)}×`;
    saveSettings(settings);
  };
  ($("s-cb") as HTMLInputElement).onchange = (e) => {
    settings.colorblind = (e.target as HTMLInputElement).checked;
    applyAccess();
    world?.setColorblind(settings.colorblind);
    saveSettings(settings);
  };
  ($("s-rm") as HTMLInputElement).onchange = (e) => { settings.reduceMotion = (e.target as HTMLInputElement).checked; applyAccess(); saveSettings(settings); };
  ($("s-lt") as HTMLInputElement).onchange = (e) => { settings.largeText = (e.target as HTMLInputElement).checked; applyAccess(); saveSettings(settings); };
  const bindKeyButtons = () => {
    for (const btn of $("keys").querySelectorAll<HTMLButtonElement>("button[data-act]")) {
      btn.onclick = () => {
        const act = btn.dataset.act as (typeof ACTIONS)[number];
        btn.textContent = "nhấn phím…";
        $("k-msg").textContent = `Đang đổi phím "${ACTION_LABEL[act]}". Nhấn phím mới (Esc để hủy).`;
        capturing = (code) => {
          capturing = null;
          if (code !== "Escape") {
            const r = assignKey(settings.keys, act, code);
            if (r.ok) { settings.keys = r.map; saveSettings(settings); $("k-msg").textContent = `Đã gán ${keyLabel(code)} cho "${ACTION_LABEL[act]}".`; }
            else $("k-msg").textContent = r.reason === "duplicate"
              ? `⚠ Phím ${keyLabel(code)} đã dùng cho "${ACTION_LABEL[r.with!]}". Hãy chọn phím khác.`
              : `⚠ Phím ${keyLabel(code)} dành riêng cho game, hãy chọn phím khác.`;
          } else $("k-msg").textContent = "Đã hủy.";
          $("keys").innerHTML = keyRows();
          bindKeyButtons();
        };
      };
    }
  };
  bindKeyButtons();
  $("k-reset").onclick = () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(settings); $("keys").innerHTML = keyRows(); bindKeyButtons(); $("k-msg").textContent = "Đã khôi phục phím mặc định."; };
  $("s-back").onclick = () => { capturing = null; back(); };
}

// ---------- điều hướng ----------
function onStart(): void { audio.unlock(); flow = newGame(); showIntro(); }
function onBegin(): void { flow = beginNight(flow); startNight(); }
function onNext(): void { flow = nextAfterResult(flow); showIntro(); }
function onMenu(): void { world?.dispose(); world = null; paused = false; flow = backToMenu(); showMenu(); }
function togglePause(): void {
  if (flow.screen !== "playing" || ending) return;
  paused = !paused;
  if (paused) showPause();
  else $("overlay").style.display = "none";
}

addEventListener("keydown", (e) => {
  audio.unlock();
  if (capturing) { e.preventDefault(); capturing(e.code); return; } // đang đổi phím
  if ((e.target as HTMLElement | null)?.tagName === "INPUT" && (e.target as HTMLInputElement).type === "text") return; // đang gõ tên
  if (e.code === "Enter") {
    if (flow.screen === "menu") onStart();
    else if (flow.screen === "intro") onBegin();
    else if (flow.screen === "result") onNext();
    else if (flow.screen === "dawn") onMenu();
    return;
  }
  const legacyP = e.code === "KeyP" && !Object.values(settings.keys).includes("KeyP");
  if ((e.code === settings.keys.pause || legacyP) && !e.repeat) { togglePause(); return; }
  if (e.code === "F3") { e.preventDefault(); const f = $("fps"); f.style.display = f.style.display === "block" ? "none" : "block"; return; }
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow") || Object.values(settings.keys).includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); if (flow.screen === "playing" && !paused && !ending) togglePause(); }); // chuyển cửa sổ/tab thì tự tạm dừng
document.addEventListener("visibilitychange", () => { if (document.hidden && flow.screen === "playing" && !paused && !ending) togglePause(); });
$("pausebtn").onmousedown = (e) => e.preventDefault(); // không giữ focus để Space (nhảy) không bấm nhầm nút
$("pausebtn").onclick = () => { togglePause(); ($("pausebtn") as HTMLButtonElement).blur(); };
let drag = false;
addEventListener("mousedown", () => { audio.unlock(); drag = true; });
addEventListener("mouseup", () => (drag = false));
addEventListener("mousemove", (e) => { if (drag && flow.screen === "playing" && !paused) camYaw -= e.movementX * 0.3 * settings.sensitivity; });
addEventListener("resize", () => {
  if (BENCH) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

function readInput() {
  const inp = idleInput();
  const dn = (a: (typeof ACTIONS)[number]) => isDown(settings.keys, a, keys);
  const x = (dn("left") ? 1 : 0) - (dn("right") ? 1 : 0); // camera nhìn về +Z nên phải màn hình = -X
  const z = (dn("up") ? 1 : 0) - (dn("down") ? 1 : 0);
  inp.move = [x, z];
  inp.yaw = camYaw;
  inp.jump = dn("jump");
  inp.interact = dn("interact");
  inp.pulse = dn("pulse");
  inp.dash = dn("dash");
  return inp;
}

// ---------- phản hồi ----------
function toast(msg: string): void {
  const d = document.createElement("div");
  d.textContent = msg;
  $("toast").appendChild(d);
  setTimeout(() => d.remove(), 2400);
}
const SFX: Record<string, Sfx> = {
  mote_picked: "pickup", deposit: "deposit", lantern_lit: "light", pulse: "pulse", player_hit: "hit",
  shade_spawned: "spawn", dash: "dash", charm_picked: "charm", drifter_steal: "steal",
  refuel: "deposit", lantern_out: "lose",
};
function onEvent(e: GameEvent): void {
  const s = SFX[e.name];
  if (s) audio.play(s);
  switch (e.name) {
    case "deposit": toast(`Nạp ${e.data.amount} ánh sáng vào ${e.data.lantern_id}`); break;
    case "lantern_lit": toast(e.data.relight ? `Thắp lại Đèn Lồng ${e.data.lantern_id}!` : `Đèn Lồng ${e.data.lantern_id} đã sáng!`); break;
    case "refuel": toast(`Châm dầu ${e.data.lantern_id}: ${e.data.fuel}/${T.fuel_max}`); break;
    case "lantern_out": caption(`Đèn ${e.data.lantern_id} đã tắt!`, 3); toast(`⚠ Đèn ${e.data.lantern_id} đã tắt! Mang đom đóm tới thắp lại (cần ${T.relight_cost})`); break;
    case "fuel_drain":
      if (clock - lastDrainToast > 4) { lastDrainToast = clock; toast(`⚠ Bóng Mực đang hút dầu đèn ${e.data.lantern_id}! Tỏa sáng đuổi nó`); }
      break;
    case "game_over": lastReason = String(e.data.reason); break;
    case "shade_spawned": {
      toast("Bóng Mực xuất hiện trong sương…");
      caption("Bóng Mực xuất hiện! Mũi tên chỉ hướng của nó.", 4);
      const sh = game.shades.find((x) => x.id === e.data.id);
      if (sh) cues.set(String(e.data.id), { until: clock + 5, pos: [sh.pos[0], sh.pos[1], sh.pos[2]] });
      break;
    }
    case "charm_picked": toast("Bùa Gió! Chạy nhanh và lướt liên tục 10 giây"); break;
    case "drifter_steal": toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`); break;
    case "drifter_drop": toast(`Gió Lạc thả lại ${e.data.amount} đom đóm`); break;
    case "player_hit": {
      toast(e.data.by === "fall" ? "Rơi khỏi đảo! Mất hết đom đóm" : `Bị Bóng Mực chạm! Còn ${e.data.flames} Ngọn Lửa`);
      if (!settings.reduceMotion) {
        $("flash").style.opacity = "1";
        setTimeout(() => ($("flash").style.opacity = "0"), 150);
        shake = 0.25;
      }
      break;
    }
    case "pulse": world?.pulseRing(game.player.pos[0], game.player.pos[1], game.player.pos[2]); break;
  }
}

// ---------- HUD ----------
let prevWeak = new Set<string>();
let prevWarn = false;
const cueEls = new Map<string, HTMLElement>();
/** Mũi tên ở mép màn hình chỉ hướng một Bóng Mực vừa xuất hiện (phụ đề/chỉ báo hình ảnh, Ticket-04). */
function placeCues(_from: number[]): void {
  for (const [id, c] of cues) {
    let el = cueEls.get(id);
    if (!el) { el = document.createElement("div"); el.className = "cue"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); cueEls.set(id, el); }
    const sh = game.shades.find((s) => s.id === id);
    if (sh) c.pos = [sh.pos[0], sh.pos[1], sh.pos[2]];
    if (clock > c.until) { el.style.display = "none"; continue; }
    const v = new THREE.Vector3(c.pos[0], c.pos[1] + 1, c.pos[2]).project(camera);
    const behind = v.z > 1;
    const onScreen = !behind && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.88;
    if (onScreen) { el.style.display = "none"; continue; }
    let dx = behind ? -v.x : v.x, dy = behind ? -v.y : v.y;
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = -1;
    const k = 0.9 / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
    const sx = (dx * k * 0.5 + 0.5) * innerWidth, sy = (-dy * k * 0.5 + 0.5) * innerHeight;
    el.style.display = "block";
    el.style.transform = `translate(${sx - 12}px, ${sy - 14}px) rotate(${Math.atan2(dx * innerWidth, dy * innerHeight)}rad)`;
  }
  for (const [id, el] of cueEls) if (!cues.has(id)) { el.remove(); cueEls.delete(id); }
}

function updateHud(): void {
  const p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const left = Math.max(0, timeLeft(game));
  $("flames").innerHTML = Array.from({ length: T.flames }, (_, i) => (i < p.flames ? "🔥" : `<span style="opacity:.25">🔥</span>`)).join("");
  const clockEl = $("clock");
  clockEl.textContent = fmtTime(left);
  clockEl.classList.toggle("low", left <= 30);
  if (capUntil && clock > capUntil) { $("caption").style.display = "none"; capUntil = 0; }
  const need = winNeed(game.lanterns.length);
  $("topright").innerHTML = `<div class="chip">Đèn <b>${lit}/${game.lanterns.length}</b> <small>(cần ${need})</small></div><div class="chip">Điểm <b>${game.score}</b></div>`;
  const cap = capacityOf(p);
  $("motebar").innerHTML = Array.from({ length: cap }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("") + `<b style="margin-left:8px">${p.carried}/${cap}</b>`;
  const weakOnes = game.lanterns.filter((l) => l.lit && l.fuelU < T.low_fuel_threshold * 60);
  const lowEl = $("lowfuel");
  lowEl.style.display = weakOnes.length ? "block" : "none";
  if (weakOnes.length) lowEl.textContent = `⚠ Đèn sắp hết dầu: ${weakOnes.map((l) => l.id).join(", ")}`;
  for (const l of weakOnes) if (!prevWeak.has(l.id)) caption(`Đèn ${l.id} sắp hết dầu (dưới ${T.low_fuel_threshold})!`, 3);
  prevWeak = new Set(weakOnes.map((l) => l.id));
  const dashLeft = p.dashCd / 60, pulseLeft = p.pulseCd / 60;
  const dashReady = p.dashCd === 0 || p.charm > 0;
  const pulseReady = p.pulseCd === 0 && p.carried >= T.pulse_cost;
  $("cooldowns").innerHTML =
    `<div class="chip cd ${dashReady ? "ready" : "wait"}"><b>Lướt</b> [Shift]<small>${dashReady ? "sẵn sàng" : dashLeft.toFixed(1) + "s"}</small></div>` +
    `<div class="chip cd ${pulseReady ? "ready" : "wait"}"><b>Tỏa Sáng</b> [F]<small>${p.pulseCd > 0 ? pulseLeft.toFixed(1) + "s" : p.carried >= T.pulse_cost ? "sẵn sàng" : `cần ${T.pulse_cost} đom đóm`}</small></div>`;
  const charmEl = $("charm");
  charmEl.style.display = p.charm > 0 ? "block" : "none";
  if (p.charm > 0) charmEl.innerHTML = `<b>Bùa Gió</b> ${(p.charm / 60).toFixed(1)}s`;
  const windEl = $("wind");
  const warn = game.windEnabled && game.sim % WORLD.wind_period >= WORLD.wind_period - WORLD.wind_warning;
  const active = game.windEnabled && game.sim >= WORLD.wind_period && game.sim % WORLD.wind_period < WORLD.wind_duration;
  windEl.style.display = warn || active ? "block" : "none";
  windEl.textContent = active ? "Gió đang thổi!" : "Gió sắp nổi, vịn cho chắc!";
  if (warn && !prevWarn) caption("Gió sắp thổi!", 3);
  prevWarn = warn;
  placeCues(p.pos);
  const near = game.lanterns.filter((l) => (!l.lit || l.fuelU < T.fuel_max * 60) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  const hint = $("hint");
  if (near && p.carried > 0) {
    hint.style.display = "block";
    hint.innerHTML = near.lit ? `<kbd>E</kbd> Châm dầu (${(near.fuelU / 60).toFixed(0)}/${T.fuel_max})` : `<kbd>E</kbd> Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;
  } else hint.style.display = "none";
  // mũi tên chỉ tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  const arrow = $("arrow");
  const target = game.lanterns.filter((l) => !l.lit || l.fuelU < T.low_fuel_threshold * 60).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  if (!target) { arrow.style.display = "none"; return; }
  const v = new THREE.Vector3(target.pos[0], target.pos[1] + 3.5, target.pos[2]).project(camera);
  const behind = v.z > 1;
  const onScreen = !behind && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.88;
  if (onScreen) { arrow.style.display = "none"; return; }
  let dx = behind ? -v.x : v.x, dy = behind ? -v.y : v.y;
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = -1;
  const k = 0.82 / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
  const sx = (dx * k * 0.5 + 0.5) * innerWidth, sy = (-dy * k * 0.5 + 0.5) * innerHeight;
  arrow.style.display = "block";
  arrow.style.transform = `translate(${sx - 14}px, ${sy - 17}px) rotate(${Math.atan2(dx * innerWidth, dy * innerHeight)}rad)`;
}

function syncView(dt: number): void {
  clock += dt;
  const p = game.player;
  may.group.visible = p.pos[1] > -4;
  may.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const moving = Math.hypot(p.pos[0] - prevPos.x, p.pos[2] - prevPos.z) > 1e-4;
  if (moving) {
    may.group.rotation.y = Math.atan2(p.fx, p.fz);
    if (p.grounded && !settings.reduceMotion) may.group.position.y += Math.abs(Math.sin(clock * 12)) * 0.08;
  }
  prevPos = { x: p.pos[0], z: p.pos[2] };
  may.light.intensity = 30 + Math.sin(clock * 5) * 3;
  may.charmAura.visible = p.charm > 0;
  const th = (camYaw * Math.PI) / 180;
  const cy = Math.max(p.pos[1], -3);
  const target = new THREE.Vector3(p.pos[0] - Math.sin(th) * 8, cy + 5.2, p.pos[2] - Math.cos(th) * 8);
  camera.position.lerp(target, Math.min(1, dt * 6));
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    if (!settings.reduceMotion) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5).multiplyScalar(shake / 0.25));
  }
  camera.lookAt(p.pos[0], cy + 1.6, p.pos[2]);
  world?.update(game, dt, clock, camera.position);
}

// ---------- benchmark (Ticket-04): ?bench=1&seed=42&duration=30 do scripts/bench.ts mở ----------
interface BenchRun { spikes: number[][]; seed: number; duration: number; t0: number | null; prev: number; acc: number; m0: number | null; dts: number[]; loadMs: number; launcherT0: number }
let benchRun: BenchRun | null = null;
function startBench(): void {
  const seed = Number(query.get("seed") ?? 42);
  const duration = Number(query.get("duration") ?? 30);
  $("overlay").style.display = "none";
  $("hud").style.display = "none";
  const bsc = benchScenario(seed);
  if (query.has("shades")) bsc.shades = bsc.shades!.slice(0, Number(query.get("shades"))); // chỉ để chẩn đoán, bench chuẩn luôn 200
  game = createGame(seed, bsc, 1);
  game.bench = true; // tắt sinh thực thể, sát thương, nhặt, hao dầu và kết thúc Đêm; Bóng Mực vẫn wander
  world = new World(scene, game.night, game);
  may.group.position.set(0, 0, 0);
  benchRun = { spikes: [], seed, duration, t0: null, prev: 0, acc: 0, m0: null, dts: [], loadMs: 0, launcherT0: Number(query.get("t0") ?? Date.now()) };
}
function rendererInfo(): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "không rõ GPU";
  const chrome = /(?:Chrome|Edg)\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? navigator.userAgent;
  return `three.js r${THREE.REVISION} (WebGL2) trên ${chrome}; GPU: ${gpu}`;
}
function benchFrame(now: number): void {
  const r = benchRun!;
  if (r.t0 === null) { r.t0 = now; r.prev = now; r.loadMs = Date.now() - r.launcherT0; }
  const dt = now - r.prev;
  r.prev = now;
  const t = (now - r.t0) / 1000;
  const c0 = performance.now();
  r.acc += Math.min(0.1, dt / 1000);
  while (r.acc >= DT) { stepGame(game, idleInput()); r.acc -= DT; }
  const c1 = performance.now();
  const [cx, cy, cz] = cameraAt(t);
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 0, 0);
  may.light.intensity = 30 + Math.sin(t * 5) * 3;
  world?.update(game, dt / 1000, t, camera.position);
  const c2 = performance.now();
  renderer.render(scene, camera);
  const c3 = performance.now();
  if (t < BENCH_WARMUP_S) return; // 3 s khởi động, không đo
  if (r.m0 === null) r.m0 = now;
  if (now - r.m0 >= r.duration * 1000) {
    renderer.setAnimationLoop(null);
    const s = benchStats(r.dts);
    const result = {
      contract_version: "1.3", ...s, load_ms: r.loadMs, peak_mem_mb: null as number | null,
      vsync_off: query.get("vsync") === "off", renderer: rendererInfo(), os: "",
      frame_ms_max: Math.round(Math.max(0, ...r.dts) * 10) / 10, slow_frames_over_30ms: r.dts.filter((x) => x > 30).length, spikes_t_ms: r.spikes,
      seed: r.seed, duration_s: r.duration, canvas: "1280x720", shades: game.shades.length, motes: game.motes.length,
    };
    document.title = "bench xong";
    fetch("/__bench_result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) }).catch(() => { document.title = "bench lỗi: không gửi được kết quả"; });
    return;
  }
  r.dts.push(dt);
  if (dt > 30 && r.spikes.length < 40) r.spikes.push([Math.round(t * 100) / 100, Math.round(dt * 10) / 10, Math.round((c1 - c0) * 10) / 10, Math.round((c2 - c1) * 10) / 10, Math.round((c3 - c2) * 10) / 10]); // chẩn đoán: [t, dt, ms mô phỏng, ms cập nhật cảnh, ms render CPU]
}

// ---------- vòng lặp ----------
const frameTimes: number[] = [];
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frameTimes.push(dt);
  if (frameTimes.length > 120) frameTimes.shift();
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  (window as unknown as { __fps: number }).__fps = 1 / avg;
  if ($("fps").style.display === "block") $("fps").textContent = `${(1 / avg).toFixed(0)} FPS`;
  if (benchRun) { benchFrame(now); return; }

  if (flow.screen === "playing" && !paused) {
    if (keys.has("ArrowLeft")) camYaw += 100 * settings.sensitivity * dt;
    if (keys.has("ArrowRight")) camYaw -= 100 * settings.sensitivity * dt;
    if (!ending) {
      acc += dt;
      while (acc >= DT && game.state === "playing") {
        const inp = readInput();
        if (inp.jump && !prevJump && game.player.grounded) audio.play("jump");
        prevJump = inp.jump;
        for (const e of stepGame(game, inp)) onEvent(e);
        acc -= DT;
      }
      const sec = Math.ceil(timeLeft(game));
      if (sec <= 10 && sec > 0 && sec !== lastCountdown && game.state === "playing") {
        if (lastCountdown === -1 || lastCountdown > 10) caption("10 giây cuối! Bình minh sắp tới.", 4);
        lastCountdown = sec;
        audio.play("tick");
      }
      if (game.state !== "playing") {
        ending = true;
        audio.play(game.state === "won" ? "win" : "lose");
        setTimeout(() => {
          flow = finishNight(flow, game.state === "won", game.score);
          if (flow.screen === "dawn") showDawn();
          else showResult();
        }, 900);
      }
    }
    updateHud();
  }
  $("hud").style.display = flow.screen === "playing" ? "block" : "none";
  syncView(dt);
  renderer.render(scene, camera);
});

// ---------- khởi động ----------
// Các hash dưới chỉ để chụp ảnh/kiểm thử: #n1 #n2 #n3 vào thẳng Đêm (không có Bóng Mực/Gió Lạc), #play Đêm 1 bình thường,
// #lit Đêm 1 có sẵn 2 đèn sáng, #settings #board #lose (màn thua + nhập tên), #fuel Đêm 1 với đèn đủ/vừa/sắp hết dầu/tắt (Phase 3), #win màn thắng, #dawn màn Bình Minh, #pause menu tạm dừng, #intro2/#intro3 màn giới thiệu.
const h = location.hash.replace("#", "");
const goNight = (n: NightNo, sc: Scenario = {}, isCalm = true) => {
  calm = isCalm; testScenario = sc;
  flow = beginNight({ ...newGame(), night: n });
  startNight();
};
if (BENCH) startBench();
else if (/^n[123]$/.test(h)) goNight(Number(h[1]) as NightNo);
else if (h === "play") goNight(1, {}, false);
else if (h === "lit") goNight(1, { player: { pos: [0, 0, 12] }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] });
else if (h === "fuel") goNight(1, { player: { pos: [8, 0, 12], carried: 6 }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true, fuel: 100 }, { id: "L3", lit: true, fuel: 29 }, { id: "L4", ever_lit: true }], shades: [{ id: "S1", pos: [14, 0, -16], state: "wander" }] });
else if (h === "win") goNight(1, { lanterns: ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true })) });
else if (h === "dawn") { flow = { ...initialFlow(), screen: "dawn", night: 3, total: 2864, lastWon: true }; showDawn(); }
else if (h === "settings") showSettings(showMenu);
else if (h === "board") void showBoard(showMenu);
else if (h === "lose") { goNight(1, { player: { flames: 1 }, shades: [{ pos: [0, 1, 1.2], state: "chase" }] }, true); }
else if (h === "pause") { goNight(1); togglePause(); }
else if (h === "intro2" || h === "intro3") { flow = { ...newGame(), night: Number(h[5]) as NightNo }; showIntro(); }
else showMenu();
