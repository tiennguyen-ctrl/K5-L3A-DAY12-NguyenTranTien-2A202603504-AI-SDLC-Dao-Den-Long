import * as THREE from "three";
import { T, WORLD } from "../core/constants.ts";
import type { Game } from "../core/game.ts";
import { lightFraction } from "../core/game.ts";
import type { NightDef } from "../core/maps.ts";
import { buildShade } from "./character.ts";
import { PALETTE } from "./palette.ts";
import { buildForest } from "./forest.ts";
import type { Forest } from "./forest.ts";


const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

interface LanternView { pole: THREE.Mesh; body: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh; beam: THREE.Mesh }

/** Dựng và đồng bộ toàn bộ thế giới 3D của một Đêm. Chỉ hiển thị: không thay đổi trạng thái game. */
export class World {
  readonly group = new THREE.Group();
  private ambient: THREE.AmbientLight;
  private forest: Forest;
  private lanterns: LanternView[] = [];
  private motes = new Map<string, THREE.Group>();
  private shades = new Map<string, THREE.Group>();
  private drifters = new Map<string, THREE.Group>();
  private charms = new Map<string, THREE.Group>();
  private leaves: THREE.InstancedMesh;
  private rings: { mesh: THREE.Mesh; age: number }[] = [];
  private moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
  private haloGeo = new THREE.SphereGeometry(0.42, 10, 8);
  private moteMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
  private haloMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.28, depthWrite: false });

  private scene: THREE.Scene;
  private night: NightDef;

  constructor(scene: THREE.Scene, night: NightDef, g: Game) {
    this.scene = scene;
    this.night = night;
    scene.add(this.group);
    this.group.add(this.terrain());
    this.ambient = new THREE.AmbientLight(0x9aa6e0, 0.15);
    const moon = new THREE.DirectionalLight(0xaec4ff, 0.9);
    moon.position.set(-30, 60, -20);
    this.group.add(this.ambient, moon);
    this.forest = buildForest(night, night.night === 2 ? 190 : night.night === 3 ? 230 : 240);
    this.group.add(this.forest.group);
    g.lanterns.forEach((l) => this.lanterns.push(this.makeLantern(l.pos)));
    const leafGeo = new THREE.PlaneGeometry(0.3, 0.18);
    this.leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ color: 0x9bbf6a, side: THREE.DoubleSide }), 60);
    this.leaves.visible = false;
    this.group.add(this.leaves);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }

  // ---------------- địa hình ----------------
  private terrain(): THREE.Group {
    const t = new THREE.Group();
    const sea = new THREE.Mesh(new THREE.CircleGeometry(500, 48), std(PALETTE.cloudSea));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -8;
    t.add(sea);
    for (let i = 0; i < 46; i++) {
      const a = i * 2.399, r = 55 + (i % 9) * 11;
      const cx = this.night.night === 2 ? 35 : 0;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + (i % 4) * 2, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2b5a72, transparent: true, opacity: 0.5, roughness: 1 }));
      puff.position.set(cx + Math.cos(a) * r, -6 - (i % 3) * 1.5, Math.sin(a) * r);
      puff.scale.y = 0.4;
      t.add(puff);
    }
    const disc = (cx: number, cz: number, r: number, h: number, y0: number, color: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 3, h, 56), std(color));
      m.position.set(cx, y0 - h / 2, cz);
      t.add(m);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 8, 80), std(PALETTE.sand));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(cx, y0, cz);
      t.add(rim);
      return m;
    };
    if (this.night.night === 1) disc(0, 0, 40, 6, 0, PALETTE.grass);
    if (this.night.night === 2) {
      disc(0, 0, 28, 6, 0, PALETTE.grass);
      disc(70, 0, 28, 6, 0, PALETTE.grass);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(PALETTE.wood));
      bridge.position.set(35, -0.15, 0);
      t.add(bridge);
      for (let x = 26.5; x < 44; x += 1.1) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 4.05), std(0x4a3320));
        plank.position.set(x, -0.15, 0);
        t.add(plank);
      }
    }
    if (this.night.night === 3) {
      disc(0, 0, 45, 6, 0, PALETTE.grass);
      // tầng 1: nửa vành khăn z > 0, bán kính 12..24, cao 3
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; pts.push([24 * Math.cos(a), -24 * Math.sin(a)]); }
      for (let i = 40; i >= 0; i--) { const a = (i / 40) * Math.PI; pts.push([12 * Math.cos(a), -12 * Math.sin(a)]); }
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }), std(PALETTE.sand));
      tier1.rotation.x = -Math.PI / 2;
      t.add(tier1);
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 40), std(PALETTE.sand));
      tier2.position.y = 3;
      t.add(tier2);
      // tháp chuông cao 8 m ở tâm tầng 2
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), std(PALETTE.wood));
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 24), std(PALETTE.wood));
      roof.position.y = 15;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), std(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.4 }));
      bell.position.y = 12;
      t.add(tower, roof, bell);
      // 2 dốc rộng 3 m ở 30° và 150°: Y=0 ở r=30, Y=3 ở r=24
      for (const deg of [30, 150]) {
        const tri = new THREE.Shape([new THREE.Vector2(24, 0), new THREE.Vector2(30, 0), new THREE.Vector2(24, 3)]);
        const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3, bevelEnabled: false }), std(PALETTE.sand));
        ramp.position.z = -1.5;
        const holder = new THREE.Group();
        holder.add(ramp);
        holder.rotation.y = -(deg * Math.PI) / 180;
        t.add(holder);
      }
    }
    // bục nhảy
    for (const p of this.night.pads) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 24), std(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.6 }));
      pad.position.set(p.pos[0], p.pos[1] + 0.06, p.pos[2]);
      t.add(pad);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 12), std(PALETTE.lanternCore, { emissive: PALETTE.lanternCore, emissiveIntensity: 0.8 }));
      arrow.position.set(p.pos[0], p.pos[1] + 1.4, p.pos[2]);
      t.add(arrow);
    }
    return t;
  }

  private makeLantern(pos: number[]): LanternView {
    const [x, y, z] = pos;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 10), std(PALETTE.wood));
    pole.position.set(x, y + 1.5, z);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), std(PALETTE.lanternOff, { emissive: PALETTE.lanternLit, emissiveIntensity: 0 }));
    body.scale.y = 1.25;
    body.position.set(x, y + 3.5, z);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0 }));
    core.position.copy(body.position);
    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 40, 2);
    light.position.copy(body.position);
    const zone = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 72), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(x, y + 0.04, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.7, 18, 12, 1, true), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    beam.position.set(x, y + 12, z);
    this.group.add(pole, body, core, light, zone, beam);
    return { pole, body, core, light, zone, beam };
  }

  private makeMote(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.moteGeo, this.moteMat), new THREE.Mesh(this.haloGeo, this.haloMat));
    this.group.add(g);
    return g;
  }

  private makeDrifter(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.drifter, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.55 - i * 0.04, 0.5), mat);
      seg.name = `seg${i}`;
      g.add(seg);
    }
    this.group.add(g);
    return g;
  }

  private makeCharm(): THREE.Group {
    const g = new THREE.Group();
    const border = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.06), std(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.5 }));
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.74, 0.1), std(PALETTE.charm, { emissive: PALETTE.charm, emissiveIntensity: 0.4 }));
    g.add(border, card);
    this.group.add(g);
    return g;
  }

  pulseRing(x: number, y: number, z: number): void {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.1, z);
    this.group.add(ring);
    this.rings.push({ mesh: ring, age: 0 });
  }

  /** Đồng bộ hình ảnh theo trạng thái game. `cam`/`pl` dùng để ẩn cây che tầm nhìn. */
  update(g: Game, dt: number, clock: number, camPos: THREE.Vector3): void {
    const p = g.player;
    const k = lightFraction(g);
    this.ambient.intensity = 0.15 + 0.55 * k; // theo ticket
    (this.scene.background as THREE.Color).setHex(PALETTE.sky);

    g.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      const frac = Math.min(1, l.deposited / T.lantern_cost);
      const mat = v.body.material as THREE.MeshStandardMaterial;
      mat.color.setHex(l.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
      mat.emissiveIntensity = l.lit ? 1.5 + Math.sin(clock * 3 + i) * 0.15 : frac * 0.6;
      (v.core.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.95 : frac * 0.5;
      v.light.intensity = l.lit ? 110 : frac * 18;
      (v.zone.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.4 : 0;
      (v.beam.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.4 : 0.1 + frac * 0.1;
    });

    const seen = new Set<string>();
    for (const m of g.motes) {
      seen.add(m.id);
      let v = this.motes.get(m.id);
      if (!v) { v = this.makeMote(); this.motes.set(m.id, v); }
      v.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(clock * 2 + m.pos[0]) * 0.2, m.pos[2]);
      const dropped = m.kind === "dropped";
      v.scale.setScalar(dropped ? (m.ttl !== null && m.ttl < 120 ? 0.6 + 0.4 * Math.abs(Math.sin(clock * 12)) : 0.8) : 1);
    }
    for (const [id, v] of this.motes) if (!seen.has(id)) { this.group.remove(v); this.motes.delete(id); }

    const seenS = new Set<string>();
    for (const s of g.shades) {
      seenS.add(s.id);
      let v = this.shades.get(s.id);
      if (!v) { v = buildShade(); this.group.add(v); this.shades.set(s.id, v); }
      v.position.set(s.pos[0], s.pos[1] + 0.35 + Math.sin(clock * 3 + s.pos[2]) * 0.12, s.pos[2]);
      v.lookAt(p.pos[0], v.position.y, p.pos[2]);
      const blob = v.getObjectByName("blob") as THREE.Mesh;
      const rim = v.getObjectByName("rim") as THREE.Mesh;
      const mat = blob.material as THREE.MeshStandardMaterial;
      const stunned = s.state === "stunned";
      mat.color.setHex(stunned ? PALETTE.shadeStunned : PALETTE.shadeBody);
      mat.emissive.setHex(stunned ? PALETTE.shadeStunned : PALETTE.shadeRim);
      mat.emissiveIntensity = stunned ? 0.3 : s.state === "recoil" ? 1.3 : 0.55;
      (rim.material as THREE.MeshBasicMaterial).color.setHex(PALETTE.shadeRim);
      const grow = s.state === "spawning" ? 1 - s.ticksLeft / WORLD.shade_spawning_ticks : 1;
      v.scale.setScalar(Math.max(0.05, grow) * (stunned ? 0.8 + Math.sin(clock * 18) * 0.04 : 1));
    }
    for (const [id, v] of this.shades) if (!seenS.has(id)) { this.group.remove(v); this.shades.delete(id); }

    const seenD = new Set<string>();
    for (const d of g.drifters) {
      seenD.add(d.id);
      let v = this.drifters.get(d.id);
      if (!v) { v = this.makeDrifter(); this.drifters.set(d.id, v); }
      v.position.set(d.pos[0], d.pos[1] + 0.5, d.pos[2]);
      const ang = d.state === "flee" ? Math.atan2(d.dx, d.dz) : Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
      v.rotation.y = ang + Math.PI;
      for (let i = 0; i < 8; i++) {
        const seg = v.getObjectByName(`seg${i}`)!;
        seg.position.set(Math.sin(clock * 6 - i * 0.7) * 0.25, Math.cos(clock * 4 - i) * 0.1, -i * 0.42);
        seg.rotation.y = Math.sin(clock * 6 - i * 0.7) * 0.5;
      }
    }
    for (const [id, v] of this.drifters) if (!seenD.has(id)) { this.group.remove(v); this.drifters.delete(id); }

    for (const c of g.charms) {
      let v = this.charms.get(c.id);
      if (!v) { v = this.makeCharm(); this.charms.set(c.id, v); }
      v.position.set(c.pos[0], c.pos[1] + 1.1 + Math.sin(clock * 2.5) * 0.15, c.pos[2]);
      v.rotation.y = clock * 1.5;
      v.visible = c.available;
    }

    // lá bay báo gió (2 s trước) và khi gió thổi
    const warn = g.windEnabled && g.sim % WORLD.wind_period >= WORLD.wind_period - WORLD.wind_warning;
    const active = g.windEnabled && g.sim >= WORLD.wind_period && g.sim % WORLD.wind_period < WORLD.wind_duration;
    this.leaves.visible = warn || active;
    if (this.leaves.visible) {
      const a = (g.windDir * Math.PI) / 180;
      const dx = Math.cos(a), dz = Math.sin(a);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < 60; i++) {
        const t = (clock * (active ? 9 : 4) + i * 0.7) % 30;
        const lat = ((i * 37) % 21) - 10;
        const x = p.pos[0] - dx * 15 + dx * t + -dz * lat;
        const z = p.pos[2] - dz * 15 + dz * t + dx * lat;
        const y = p.pos[1] + 1 + ((i * 13) % 7) + Math.sin(clock * 3 + i);
        q.setFromEuler(new THREE.Euler(clock + i, clock * 2, i));
        m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
        this.leaves.setMatrixAt(i, m);
      }
      this.leaves.instanceMatrix.needsUpdate = true;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const t = r.age / 0.6;
      r.mesh.scale.setScalar(1 + t * (T.pulse_radius - 1));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) { this.group.remove(r.mesh); this.rings.splice(i, 1); }
    }
    this.forest.update({ x: camPos.x, z: camPos.z }, { x: p.pos[0], z: p.pos[2] });
  }
}
