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
import { PALETTE } from "./palette.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { World } from "./world.ts";

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.mist, 40, 170);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
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
let lastDrainToast = -999;
const applyColorblind = () => document.body.classList.toggle("cb", settings.colorblind);
applyColorblind();
let testScenario: Scenario = {};

function startNight(): void {
  world?.dispose();
  const sc: Scenario = calm ? { random_shades: false, random_drifters: false, ...testScenario } : { ...testScenario };
  game = createGame((Math.random() * 2 ** 31) >>> 0, sc, flow.night);
  world = new World(scene, game.night, game);
  world.setColorblind(settings.colorblind);
  lastReason = "";
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
const CONTROLS = `<p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng<br><kbd>←</kbd><kbd>→</kbd> hoặc kéo chuột xoay camera · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>`;

function showMenu(): void {
  flow = initialFlow();
  card(`<h1>Đảo Đèn Lồng</h1>
    <p>Sương đen đã nuốt hết ánh sáng của các hòn đảo. Mây phải nhặt đom đóm, thắp lại Đèn Lồng Lớn qua <b>3 Đêm</b> và né Bóng Mực.</p>
    ${CONTROLS}
    <button id="b-start">Bắt đầu (Enter)</button><button id="b-set" class="alt">Cài đặt</button>
    <p><small>Chọn Đêm để chơi thẳng:</small><br>
    <button id="b-n1" class="alt">Đêm 1 · Đảo Bến</button><button id="b-n2" class="alt">Đêm 2 · Đảo Cau</button><button id="b-n3" class="alt">Đêm 3 · Đảo Chuông</button></p>`);
  $("b-start").onclick = onStart;
  for (const n of [1, 2, 3] as const) $(`b-n${n}`).onclick = () => { audio.unlock(); flow = startAt(n); showIntro(); };
  $("b-set").onclick = () => showSettings(showMenu);
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
    <button id="b-next">${won ? `Đêm kế tiếp (Enter)` : `Chơi lại Đêm ${flow.night} (Enter)`}</button>
    <button id="b-menu" class="alt">Về menu</button>`);
  $("b-next").onclick = onNext;
  $("b-menu").onclick = onMenu;
}
function showDawn(): void {
  card(`<h1>Bình Minh</h1>
    <p>Ba hòn đảo đã sáng rực. Ông Đăng mỉm cười: "Cháu làm được rồi, Mây."</p>
    <p>Tổng điểm: <b style="font-size:28px;color:var(--gold)">${flow.total}</b></p>
    <button id="b-menu">Về menu (Enter)</button>`);
  $("b-menu").onclick = onMenu;
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
function showSettings(back: () => void): void {
  card(`<h2>Cài đặt</h2>
    <label>Âm lượng: <b id="v-vol">${Math.round(settings.volume * 100)}%</b>
      <input id="s-vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" /></label>
    <label>Độ nhạy chuột: <b id="v-sen">${settings.sensitivity.toFixed(1)}×</b>
      <input id="s-sen" type="range" min="2" max="30" value="${Math.round(settings.sensitivity * 10)}" /></label>
    <label style="display:flex;gap:8px;align-items:center"><input id="s-cb" type="checkbox" ${settings.colorblind ? "checked" : ""} />
      Bảng màu dễ phân biệt (viền/mắt Bóng Mực xanh #00B3FF, cảnh báo màu trắng kèm ⚠)</label>
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
    applyColorblind();
    world?.setColorblind(settings.colorblind);
    saveSettings(settings);
  };
  $("s-back").onclick = back;
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
  if (e.code === "Enter") {
    if (flow.screen === "menu") onStart();
    else if (flow.screen === "intro") onBegin();
    else if (flow.screen === "result") onNext();
    else if (flow.screen === "dawn") onMenu();
    return;
  }
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) { togglePause(); return; }
  if (e.code === "F3") { e.preventDefault(); const f = $("fps"); f.style.display = f.style.display === "block" ? "none" : "block"; return; }
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
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
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

function readInput() {
  const inp = idleInput();
  const x = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0); // camera nhìn về +Z nên phải màn hình = -X
  const z = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  inp.move = [x, z];
  inp.yaw = camYaw;
  inp.jump = keys.has("Space");
  inp.interact = keys.has("KeyE");
  inp.pulse = keys.has("KeyF");
  inp.dash = keys.has("ShiftLeft") || keys.has("ShiftRight");
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
    case "lantern_out": toast(`⚠ Đèn ${e.data.lantern_id} đã tắt! Mang đom đóm tới thắp lại (cần ${T.relight_cost})`); break;
    case "fuel_drain":
      if (clock - lastDrainToast > 4) { lastDrainToast = clock; toast(`⚠ Bóng Mực đang hút dầu đèn ${e.data.lantern_id}! Tỏa sáng đuổi nó`); }
      break;
    case "game_over": lastReason = String(e.data.reason); break;
    case "shade_spawned": toast("Bóng Mực xuất hiện trong sương…"); break;
    case "charm_picked": toast("Bùa Gió! Chạy nhanh và lướt liên tục 10 giây"); break;
    case "drifter_steal": toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`); break;
    case "drifter_drop": toast(`Gió Lạc thả lại ${e.data.amount} đom đóm`); break;
    case "player_hit": {
      toast(e.data.by === "fall" ? "Rơi khỏi đảo! Mất hết đom đóm" : `Bị Bóng Mực chạm! Còn ${e.data.flames} Ngọn Lửa`);
      $("flash").style.opacity = "1";
      setTimeout(() => ($("flash").style.opacity = "0"), 150);
      break;
    }
    case "pulse": world?.pulseRing(game.player.pos[0], game.player.pos[1], game.player.pos[2]); break;
  }
}

// ---------- HUD ----------
function updateHud(): void {
  const p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const left = Math.max(0, timeLeft(game));
  $("flames").innerHTML = Array.from({ length: T.flames }, (_, i) => (i < p.flames ? "🔥" : `<span style="opacity:.25">🔥</span>`)).join("");
  const clockEl = $("clock");
  clockEl.textContent = fmtTime(left);
  clockEl.classList.toggle("low", left <= 30);
  const need = winNeed(game.lanterns.length);
  $("topright").innerHTML = `<div class="chip">Đèn <b>${lit}/${game.lanterns.length}</b> <small>(cần ${need})</small></div><div class="chip">Điểm <b>${game.score}</b></div>`;
  const cap = capacityOf(p);
  $("motebar").innerHTML = Array.from({ length: cap }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("") + `<b style="margin-left:8px">${p.carried}/${cap}</b>`;
  const weakOnes = game.lanterns.filter((l) => l.lit && l.fuelU < T.low_fuel_threshold * 60);
  const lowEl = $("lowfuel");
  lowEl.style.display = weakOnes.length ? "block" : "none";
  if (weakOnes.length) lowEl.textContent = `⚠ Đèn sắp hết dầu: ${weakOnes.map((l) => l.id).join(", ")}`;
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
    if (p.grounded) may.group.position.y += Math.abs(Math.sin(clock * 12)) * 0.08;
  }
  prevPos = { x: p.pos[0], z: p.pos[2] };
  may.light.intensity = 30 + Math.sin(clock * 5) * 3;
  may.charmAura.visible = p.charm > 0;
  const th = (camYaw * Math.PI) / 180;
  const cy = Math.max(p.pos[1], -3);
  const target = new THREE.Vector3(p.pos[0] - Math.sin(th) * 8, cy + 5.2, p.pos[2] - Math.cos(th) * 8);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(p.pos[0], cy + 1.6, p.pos[2]);
  world?.update(game, dt, clock, camera.position);
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
      if (sec <= 10 && sec > 0 && sec !== lastCountdown && game.state === "playing") { lastCountdown = sec; audio.play("tick"); }
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
// #lit Đêm 1 có sẵn 2 đèn sáng, #fuel Đêm 1 với đèn đủ/vừa/sắp hết dầu/tắt (Phase 3), #win màn thắng, #dawn màn Bình Minh, #pause menu tạm dừng, #intro2/#intro3 màn giới thiệu.
const h = location.hash.replace("#", "");
const goNight = (n: NightNo, sc: Scenario = {}, isCalm = true) => {
  calm = isCalm; testScenario = sc;
  flow = beginNight({ ...newGame(), night: n });
  startNight();
};
if (/^n[123]$/.test(h)) goNight(Number(h[1]) as NightNo);
else if (h === "play") goNight(1, {}, false);
else if (h === "lit") goNight(1, { player: { pos: [0, 0, 12] }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] });
else if (h === "fuel") goNight(1, { player: { pos: [8, 0, 12], carried: 6 }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true, fuel: 100 }, { id: "L3", lit: true, fuel: 29 }, { id: "L4", ever_lit: true }], shades: [{ id: "S1", pos: [14, 0, -16], state: "wander" }] });
else if (h === "win") goNight(1, { lanterns: ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true })) });
else if (h === "dawn") { flow = { ...initialFlow(), screen: "dawn", night: 3, total: 2864, lastWon: true }; showDawn(); }
else if (h === "pause") { goNight(1); togglePause(); }
else if (h === "intro2" || h === "intro3") { flow = { ...newGame(), night: Number(h[5]) as NightNo }; showIntro(); }
else showMenu();
