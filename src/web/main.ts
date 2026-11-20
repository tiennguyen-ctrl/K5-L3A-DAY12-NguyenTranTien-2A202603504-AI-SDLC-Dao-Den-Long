import * as THREE from "three";
import { DT, T, WORLD } from "../core/constants.ts";
import { createGame, idleInput, stepGame, timeLeft } from "../core/game.ts";
import type { Game } from "../core/game.ts";
import type { GameEvent, Scenario } from "../core/types.ts";
import { buildMay, buildShade } from "./character.ts";
import { buildForest } from "./forest.ts";

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const SKY_DARK = new THREE.Color(0x0b0a24), SKY_WARM = new THREE.Color(0x2b1840);
scene.background = SKY_DARK.clone();
scene.fog = new THREE.Fog(0x0b0a24, 30, 120);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const ambient = new THREE.AmbientLight(0x7a6aaa, 1.3);
const hemi = new THREE.HemisphereLight(0x9a8ad0, 0x3a2a18, 1.0);
scene.add(ambient, hemi);

// đảo tròn + vách + biển mây
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 4, 6, 64),
  new THREE.MeshStandardMaterial({ color: 0x4a6a55, roughness: 1 }),
);
ground.position.y = -3;
scene.add(ground);
const rim = new THREE.Mesh(
  new THREE.TorusGeometry(WORLD.island_radius, 0.25, 8, 96),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2b }),
);
rim.rotation.x = Math.PI / 2;
scene.add(rim);
for (let i = 0; i < 28; i++) {
  const a = (i / 28) * Math.PI * 2, r = WORLD.island_radius + 8 + (i % 5) * 7;
  const cloud = new THREE.Mesh(
    new THREE.SphereGeometry(7 + (i % 4) * 2, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x6f6a9a, transparent: true, opacity: 0.55, roughness: 1 }),
  );
  cloud.position.set(Math.sin(a) * r, -8 - (i % 3) * 2, Math.cos(a) * r);
  cloud.scale.y = 0.45;
  scene.add(cloud);
}
const starGeo = new THREE.BufferGeometry();
const sp: number[] = [];
for (let i = 0; i < 400; i++) {
  const a = Math.random() * Math.PI * 2, e = 0.1 + Math.random() * 1.2, R = 160;
  sp.push(Math.sin(a) * Math.cos(e) * R, Math.sin(e) * R, Math.cos(a) * Math.cos(e) * R);
}
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.9, fog: false })));

// nhân vật
const may = buildMay();
scene.add(may.group);

// ---------- thực thể theo trạng thái game ----------
interface LanternView { pole: THREE.Mesh; body: THREE.Mesh; light: THREE.PointLight; ring: THREE.Mesh; beam: THREE.Mesh }
let lanternViews: LanternView[] = [];
const moteViews = new Map<string, THREE.Group>();
const shadeViews = new Map<string, THREE.Group>();
const rings: { mesh: THREE.Mesh; age: number }[] = [];

const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
const haloGeo = new THREE.SphereGeometry(0.42, 10, 8);
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.25, depthWrite: false });

function rebuildLanterns(g: Game): void {
  for (const v of lanternViews) scene.remove(v.pole, v.body, v.light, v.ring, v.beam);
  lanternViews = g.lanterns.map((l) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 10), new THREE.MeshStandardMaterial({ color: 0x4a3322 }));
    pole.position.set(l.pos[0], 1.5, l.pos[2]);
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x7a2c1c, emissive: 0xff7a1c, emissiveIntensity: 0, roughness: 0.6 }),
    );
    body.scale.y = 1.25;
    body.position.set(l.pos[0], 3.5, l.pos[2]);
    const light = new THREE.PointLight(0xffa640, 0, 40, 2);
    light.position.copy(body.position);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(l.pos[0], 0.03, l.pos[2]);
    // cột sáng để thấy đèn từ xa, trên tán rừng
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.7, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    beam.position.set(l.pos[0], 11, l.pos[2]);
    scene.add(pole, body, light, ring, beam);
    return { pole, body, light, ring, beam };
  });
}

// ---------- trạng thái ----------
type Phase = "menu" | "playing" | "ended";
let phase: Phase = "menu";
let game: Game = createGame(1);
let camYaw = 0;
let acc = 0, last = performance.now(), clock = 0;
let prevPos = { x: 0, z: 0 };
const keys = new Set<string>();
rebuildLanterns(game);
const forest = buildForest(scene, game.lanterns); // rừng chỉ để trang trí, vị trí đèn mặc định không đổi giữa các ván

function startGame(sc: Scenario = {}): void {
  game = createGame((Math.random() * 2 ** 31) >>> 0, sc);
  rebuildLanterns(game);
  for (const m of moteViews.values()) scene.remove(m);
  for (const s of shadeViews.values()) scene.remove(s);
  moteViews.clear();
  shadeViews.clear();
  acc = 0;
  prevPos = { x: 0, z: 0 };
  phase = "playing";
  $("overlay").style.display = "none";
  $("toast").innerHTML = "";
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function showCard(html: string): void {
  $("card").innerHTML = html;
  $("overlay").style.display = "flex";
}
const CONTROLS = `<p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng · <kbd>←</kbd><kbd>→</kbd> xoay camera (hoặc kéo chuột)</p>`;
function showMenu(): void {
  showCard(`<h1>Đảo Đèn Lồng</h1>
    <p>Sương đen đã nuốt hết ánh sáng của đảo. Mây phải nhặt đom đóm, mang về thắp lại <b>${T.lantern_count_night1} Đèn Lồng Lớn</b> trước khi trời sáng.</p>
    <p>Bóng Mực sợ ánh đèn: đứng gần đèn là an toàn. Tỏa sáng đuổi chúng đi (tốn ${T.pulse_cost} đom đóm).</p>
    ${CONTROLS}<button id="go">Bắt đầu (Enter)</button>`);
  $("go").onclick = () => startGame();
}
function showEnd(): void {
  const won = game.state === "won";
  showCard(`<h1 class="${won ? "" : "bad"}">${won ? "Đảo đã sáng!" : "Sương đen đã nuốt đảo…"}</h1>
    <p>${won ? "Mây đã thắp lại tất cả Đèn Lồng Lớn." : game.player.flames <= 0 ? "Mây hết ánh sáng (hết máu)." : "Trời đã sáng, đêm đã hết."}</p>
    <p>Điểm: <b>${game.score}</b></p><button id="go">Chơi lại (Enter)</button>`);
  $("go").onclick = () => startGame();
}
showMenu();

// ---------- input ----------
addEventListener("keydown", (e) => {
  if (e.code === "Enter" && phase !== "playing") { startGame(); return; }
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
let drag = false;
addEventListener("mousedown", () => (drag = true));
addEventListener("mouseup", () => (drag = false));
addEventListener("mousemove", (e) => { if (drag && phase === "playing") camYaw -= e.movementX * 0.3; });
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
  inp.pulse = keys.has("KeyF") || keys.has("ShiftLeft");
  return inp;
}

// ---------- phản hồi hiển thị ----------
function toast(msg: string): void {
  const d = document.createElement("div");
  d.textContent = msg;
  $("toast").appendChild(d);
  setTimeout(() => d.remove(), 2400);
}

function onEvent(e: GameEvent): void {
  switch (e.name) {
    case "deposit": toast(`Nạp ${e.data.amount} ánh sáng vào ${e.data.lantern_id}`); break;
    case "lantern_lit": toast(`Đèn Lồng ${e.data.lantern_id} đã sáng!`); break;
    case "shade_spawned": toast("Bóng Mực xuất hiện trong sương…"); break;
    case "player_hit": {
      toast(`Bị Bóng Mực chạm! Còn ${e.data.flames} ngọn lửa`);
      $("flash").style.opacity = "1";
      setTimeout(() => ($("flash").style.opacity = "0"), 150);
      break;
    }
    case "pulse": {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 48),
        new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(game.player.pos[0], 0.1, game.player.pos[2]);
      scene.add(ring);
      rings.push({ mesh: ring, age: 0 });
      break;
    }
  }
}

function updateHud(): void {
  const p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const hearts = "🏮".repeat(Math.max(0, p.flames)) + `<span class="bad">${"●".repeat(Math.max(0, T.flames - p.flames))}</span>`;
  $("hud").innerHTML = [
    `<div class="chip">Ngọn lửa ${hearts}</div>`,
    `<div class="chip">Đang mang <b>${p.carried}</b>/${T.carry_capacity} đom đóm</div>`,
    `<div class="chip">Đèn sáng <b>${lit}</b>/${game.lanterns.length}</div>`,
    `<div class="chip">Còn <b>${fmtTime(Math.max(0, timeLeft(game)))}</b></div>`,
    `<div class="chip">Điểm <b>${game.score}</b></div>`,
    `<div class="chip">Tỏa sáng ${p.pulseCd > 0 ? `<span class="bad">${(p.pulseCd / 60).toFixed(1)}s</span>` : p.carried >= T.pulse_cost ? "<b>sẵn sàng [F]</b>" : `<span class="bad">cần ${T.pulse_cost} đom đóm</span>`}</div>`,
  ].join("");
  const near = game.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius);
  const hint = $("hint");
  if (near && p.carried > 0) { hint.style.display = "block"; hint.innerHTML = `<kbd>E</kbd> nạp ánh sáng vào ${near.id} (${near.deposited}/${T.lantern_cost})`; }
  else hint.style.display = "none";
}

function syncViews(dt: number): void {
  clock += dt;
  const p = game.player;
  // Mây
  may.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
  if (Math.hypot(p.pos[0] - prevPos.x, p.pos[2] - prevPos.z) > 1e-4) {
    may.group.rotation.y = p.facing;
    may.group.position.y += Math.abs(Math.sin(clock * 12)) * 0.08;
  }
  prevPos = { x: p.pos[0], z: p.pos[2] };
  may.light.intensity = 30 + Math.sin(clock * 5) * 3;
  // đèn lớn
  const lit = game.lanterns.filter((l) => l.lit).length;
  game.lanterns.forEach((l, i) => {
    const v = lanternViews[i];
    const mat = v.body.material as THREE.MeshStandardMaterial;
    const frac = Math.min(1, l.deposited / T.lantern_cost);
    mat.emissiveIntensity = l.lit ? 1.6 + Math.sin(clock * 3 + i) * 0.15 : frac * 0.5;
    v.light.intensity = l.lit ? 110 : frac * 20;
    (v.ring.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.35 : 0.1;
    (v.beam.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.4 : 0.14 + frac * 0.1;
  });
  // đảo sáng dần lên khi thắp đèn
  const k = lit / Math.max(1, game.lanterns.length);
  ambient.intensity = 1.3 + k * 0.9;
  hemi.intensity = 1.0 + k * 0.6;
  (scene.background as THREE.Color).copy(SKY_DARK).lerp(SKY_WARM, k);
  (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
  // đom đóm
  const seen = new Set<string>();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = new THREE.Group();
      v.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat));
      scene.add(v);
      moteViews.set(m.id, v);
    }
    v.position.set(m.pos[0], 0.9 + Math.sin(clock * 2 + m.pos[0]) * 0.2, m.pos[2]);
  }
  for (const [id, v] of moteViews) if (!seen.has(id)) { scene.remove(v); moteViews.delete(id); }
  // Bóng Mực
  const seenS = new Set<string>();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) { v = buildShade(); scene.add(v); shadeViews.set(s.id, v); }
    v.position.set(s.pos[0], 0.7 + Math.sin(clock * 3 + s.pos[2]) * 0.12, s.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    const blob = v.getObjectByName("blob") as THREE.Mesh;
    const mat = blob.material as THREE.MeshStandardMaterial;
    const stunned = s.state === "stunned";
    mat.emissive.setHex(stunned ? 0x3a4a9a : 0x4b2a7a);
    v.scale.setScalar(stunned ? 0.75 + Math.sin(clock * 20) * 0.04 : 1);
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) { scene.remove(v); shadeViews.delete(id); }
  // vòng tỏa sáng
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.age += dt;
    const t = r.age / 0.6;
    r.mesh.scale.setScalar(1 + t * (T.pulse_radius - 1));
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
    if (t >= 1) { scene.remove(r.mesh); rings.splice(i, 1); }
  }
  // camera ngó phía sau Mây (camera nhìn về hướng yaw, +Z khi yaw = 0)
  const th = (camYaw * Math.PI) / 180;
  const target = new THREE.Vector3(p.pos[0] - Math.sin(th) * 8, 5.2, p.pos[2] - Math.cos(th) * 8);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(p.pos[0], 1.6, p.pos[2]);
  forest.update({ x: camera.position.x, z: camera.position.z }, { x: p.pos[0], z: p.pos[2] });
}

// ---------- vòng lặp ----------
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (phase === "playing") {
    if (keys.has("ArrowLeft")) camYaw += 100 * dt;
    if (keys.has("ArrowRight")) camYaw -= 100 * dt;
    acc += dt;
    while (acc >= DT && game.state === "playing") {
      for (const e of stepGame(game, readInput())) onEvent(e);
      acc -= DT;
    }
    if (game.state !== "playing") { phase = "ended"; showEnd(); }
    updateHud();
  }
  syncViews(dt);
  renderer.render(scene, camera);
});

// #play: vào thẳng ván chơi; #calm: không có Bóng Mực; #lit: có sẵn 2 đèn sáng; #win: cả 5 đèn sáng để xem màn thắng (chỉ để chụp ảnh)
if (location.hash === "#play") startGame();
if (location.hash === "#calm") startGame({ random_shades: false });
if (location.hash === "#win") {
  startGame({ random_shades: false, lanterns: ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true })) });
}
if (location.hash === "#lit") {
  startGame({ random_shades: false, player: { pos: [0, 0, 12] }, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] });
}
