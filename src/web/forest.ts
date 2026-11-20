import * as THREE from "three";
import { makeRng } from "../core/rng.ts";

/**
 * Rừng nguyên sinh: CHỈ để trang trí (hiển thị), không va chạm và không ảnh hưởng logic lõi / headless.
 * Dùng InstancedMesh để vài trăm cây vẫn nhẹ. RNG riêng cố định seed => rừng giống nhau mỗi lần mở game.
 * Chừa trống quanh gốc tọa độ và quanh các Đèn Lồng.
 */
export interface Forest { update(cam: { x: number; z: number }, player: { x: number; z: number }): void }

export function buildForest(scene: THREE.Scene, lanterns: { pos: number[] }[]): Forest {
  const rnd = makeRng(20261120);
  const clear = (x: number, z: number, pad: number) =>
    Math.hypot(x, z) < 10 * pad || lanterns.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < 7.5 * pad);

  const spots: { x: number; z: number; h: number; kind: number }[] = [];
  // vành rừng dày ở rìa đảo
  for (let i = 0; i < 520 && spots.length < 150; i++) {
    const a = rnd() * Math.PI * 2, r = 29 + rnd() * 10;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!clear(x, z, 1)) spots.push({ x, z, h: 4.5 + rnd() * 5, kind: rnd() < 0.55 ? 0 : 1 });
  }
  // các lùm cây rải bên trong
  for (let i = 0; i < 900 && spots.length < 230; i++) {
    const a = rnd() * Math.PI * 2, r = 13 + rnd() * 17;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!clear(x, z, 1.3)) spots.push({ x, z, h: 3.2 + rnd() * 3.5, kind: rnd() < 0.5 ? 0 : 1 });
  }

  const n = spots.length;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.28, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0x5a3c26, roughness: 1 }),
    n,
  );
  const coneA = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.7, 3.0, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    n,
  );
  const coneB = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.2, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    n,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
    n,
  );
  // bụi rậm dưới tán
  const bushCount = 190;
  const bush = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.8, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    bushCount,
  );

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
    const g = 0.3 + rnd() * 0.25;
    c.setRGB(0.08 + rnd() * 0.06, g, 0.16 + rnd() * 0.08); // các sắc xanh rừng tối
    if (t.kind === 0) {
      // cây thông tầng
      place(coneA, i, t.x, t.h * 0.62, t.z, k, 1, rot);
      place(coneB, i, t.x, t.h * 0.62 + 1.9 * k, t.z, k, 1, rot);
      place(crown, i, t.x, -50, t.z, 0.001, 0.001, 0); // ẩn tán tròn
    } else {
      // cây tán tròn rộng
      place(crown, i, t.x, t.h + 0.4, t.z, k * 1.3, 1.1, rot);
      place(coneA, i, t.x, -50, t.z, 0.001, 0.001, 0);
      place(coneB, i, t.x, -50, t.z, 0.001, 0.001, 0);
    }
    coneA.setColorAt(i, c);
    coneB.setColorAt(i, c);
    crown.setColorAt(i, c.clone().offsetHSL(0.02, 0, 0.04));
  });

  let placed = 0;
  for (let i = 0; i < 1200 && placed < bushCount; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * 32;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (clear(x, z, 0.9)) continue;
    const sc = 0.7 + rnd() * 1.0;
    place(bush, placed, x, 0.35 * sc, z, sc, sc * 0.8, rnd() * 6);
    bush.setColorAt(placed, c.setRGB(0.1 + rnd() * 0.08, 0.28 + rnd() * 0.2, 0.14 + rnd() * 0.1));
    placed++;
  }
  bush.count = placed;

  for (const mesh of [trunk, coneA, coneB, crown, bush]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
  // Ẩn cây nằm sát camera hoặc chắn giữa camera và Mây (tránh camera chui vào tán / che mất nhân vật)
  const meshes = [trunk, coneA, coneB, crown];
  const orig = meshes.map((mesh) => spots.map((_, i) => { const mm = new THREE.Matrix4(); mesh.getMatrixAt(i, mm); return mm; }));
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hidden: boolean[] = spots.map(() => false);
  return {
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
