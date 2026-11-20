import * as THREE from "three";
import { makeRng } from "../core/rng.ts";
import type { NightDef } from "../core/maps.ts";

/**
 * Rừng: CHỈ để trang trí (hiển thị), không va chạm và không ảnh hưởng logic lõi / headless.
 * InstancedMesh để vài trăm cây vẫn nhẹ. RNG riêng cố định seed => rừng giống nhau mỗi lần mở.
 * Cây chỉ mọc ở mặt đất bằng phẳng (tránh mép đảo, cầu, dốc, vách tầng), chừa trống quanh
 * điểm xuất phát, đèn, bục nhảy và bùa.
 */
export interface Forest {
  group: THREE.Group;
  update(cam: { x: number; z: number }, player: { x: number; z: number }): void;
}

export function buildForest(night: NightDef, count: number): Forest {
  const rnd = makeRng(20261120 + night.night);
  const group = new THREE.Group();
  const keepAway: { x: number; z: number; r: number }[] = [
    { x: night.start[0], z: night.start[2], r: 9 },
    ...night.lanterns.map((l) => ({ x: l.pos[0], z: l.pos[2], r: 7.5 })),
    ...night.pads.map((p) => ({ x: p.pos[0], z: p.pos[2], r: 5 })),
    ...night.charms.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 4 })),
    ...night.moteSpots.map((m) => ({ x: m[0], z: m[2], r: 1.3 })),
  ];
  const flat = (x: number, z: number) => {
    if (night.heightAt(x, z) !== 0) return false;
    for (let a = 0; a < 8; a++) {
      if (night.heightAt(x + 2.6 * Math.cos((a * Math.PI) / 4), z + 2.6 * Math.sin((a * Math.PI) / 4)) !== 0) return false;
    }
    return true;
  };
  const spots: { x: number; z: number; h: number; kind: number }[] = [];
  const R = 120;
  for (let i = 0; i < 40000 && spots.length < count; i++) {
    const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
    if (!flat(x, z) || keepAway.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
    spots.push({ x, z, h: 3.4 + rnd() * 5.5, kind: rnd() < 0.55 ? 0 : 1 });
  }

  const n = spots.length;
  const mk = (geo: THREE.BufferGeometry, color = 0xffffff, flatShading = false) =>
    new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading }), Math.max(1, n));
  const trunk = mk(new THREE.CylinderGeometry(0.16, 0.28, 1, 7), 0x6b4a2f);
  const coneA = mk(new THREE.ConeGeometry(1.7, 3.0, 8));
  const coneB = mk(new THREE.ConeGeometry(1.2, 2.4, 8));
  const crown = mk(new THREE.IcosahedronGeometry(1.5, 1), 0xffffff, true);
  const bushCount = Math.round(count * 0.8);
  const bush = mk(new THREE.IcosahedronGeometry(0.8, 1), 0xffffff, true);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, rot: number) => {
    q.setFromAxisAngle(up, rot);
    m.compose(p.set(x, y, z), q, s.set(sx, sy, sx));
    mesh.setMatrixAt(i, m);
  };
  spots.forEach((t, i) => {
    const rot = rnd() * Math.PI * 2;
    const k = 0.85 + rnd() * 0.5;
    place(trunk, i, t.x, t.h * 0.5, t.z, k, t.h, rot);
    c.setRGB(0.07 + rnd() * 0.05, 0.28 + rnd() * 0.22, 0.14 + rnd() * 0.08);
    if (t.kind === 0) {
      place(coneA, i, t.x, t.h * 0.62, t.z, k, 1, rot);
      place(coneB, i, t.x, t.h * 0.62 + 1.9 * k, t.z, k, 1, rot);
      place(crown, i, t.x, -50, t.z, 0.001, 0.001, 0);
    } else {
      place(crown, i, t.x, t.h + 0.4, t.z, k * 1.3, 1.1, rot);
      place(coneA, i, t.x, -50, t.z, 0.001, 0.001, 0);
      place(coneB, i, t.x, -50, t.z, 0.001, 0.001, 0);
    }
    coneA.setColorAt(i, c);
    coneB.setColorAt(i, c);
    crown.setColorAt(i, c.clone().offsetHSL(0.02, 0, 0.04));
  });
  let placed = 0;
  for (let i = 0; i < 40000 && placed < bushCount; i++) {
    const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
    if (!flat(x, z) || keepAway.some((k) => Math.hypot(x - k.x, z - k.z) < k.r * 0.85)) continue;
    const sc = 0.7 + rnd() * 1.0;
    place(bush, placed, x, 0.35 * sc, z, sc, sc * 0.8, rnd() * 6);
    bush.setColorAt(placed, c.setRGB(0.1 + rnd() * 0.08, 0.28 + rnd() * 0.2, 0.14 + rnd() * 0.1));
    placed++;
  }
  bush.count = placed;

  const meshes = [trunk, coneA, coneB, crown];
  for (const mesh of [...meshes, bush]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  // Ẩn cây sát camera hoặc chắn giữa camera và Mây
  const orig = meshes.map((mesh) => spots.map((_, i) => { const mm = new THREE.Matrix4(); mesh.getMatrixAt(i, mm); return mm; }));
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hidden: boolean[] = spots.map(() => false);
  return {
    group,
    update(cam, pl) {
      const dx = pl.x - cam.x, dz = pl.z - cam.z, len2 = dx * dx + dz * dz;
      let changed = false;
      spots.forEach((t, i) => {
        let u = len2 > 0 ? ((t.x - cam.x) * dx + (t.z - cam.z) * dz) / len2 : 0;
        u = Math.max(0, Math.min(1, u));
        const hide = Math.hypot(t.x - (cam.x + u * dx), t.z - (cam.z + u * dz)) < 2.8;
        if (hide === hidden[i]) return;
        hidden[i] = hide;
        changed = true;
        meshes.forEach((mesh, k) => mesh.setMatrixAt(i, hide ? zero : orig[k][i]));
      });
      if (changed) for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
