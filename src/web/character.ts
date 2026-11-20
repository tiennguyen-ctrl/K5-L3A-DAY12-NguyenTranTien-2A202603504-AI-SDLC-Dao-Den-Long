import * as THREE from "three";

/**
 * Mây: người giữ đèn nhỏ tuổi (tên nhân vật, không phải đám mây). Đội nón lá, treo một chiếc đèn lồng nhỏ
 * ở vành nón. Dựng từ hình khối cơ bản (không asset ngoài). Chỉ là hiển thị: không ảnh hưởng logic lõi
 * hay headless. Chân nhân vật nằm ở y = 0 của group.
 */
export interface MayRig {
  group: THREE.Group;
  lantern: THREE.Mesh;
  light: THREE.PointLight;
}

export function buildMay(): MayRig {
  const g = new THREE.Group();
  const mat = (color: number, emissive = 0x000000, e = 0) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: e, roughness: 0.75 });

  // áo dài màu kem ấm, thắt lưng cam: nổi bật trên nền rừng tối
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.8, 16), mat(0xf3d9a4, 0x3a2410, 0.25));
  body.position.y = 0.5;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 8, 20), mat(0xe8742c, 0x5a2808, 0.4));
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 0.62;
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat(0x6a4a2a));
    leg.position.set(sx, 0.15, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), mat(0xf3d9a4));
    arm.position.set(sx * 2.3, 0.62, 0);
    arm.rotation.z = sx > 0 ? -0.35 : 0.35;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), mat(0xf5cfa6, 0x3a2010, 0.2));
  head.position.y = 1.12;
  for (const sx of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat(0x1a0d05));
    eye.position.set(sx, 1.14, 0.24);
    g.add(eye);
  }

  // nón lá nhỏ hơn, hơi ngửa ra sau để thấy đầu
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 28), mat(0xe6c06a, 0x4a3410, 0.3));
  hat.position.set(0, 1.42, -0.02);
  hat.rotation.x = -0.12;
  const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), mat(0xc2402a));
  hatBand.rotation.x = Math.PI / 2;
  hatBand.position.set(0, 1.3, 0);

  // đèn lồng nhỏ treo ở vành nón, bên phải
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mat(0x5a3a1c));
  string.position.set(0.52, 1.18, 0.1);
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xffb04a, emissiveIntensity: 2.2, roughness: 0.5 }),
  );
  lantern.scale.y = 1.2;
  lantern.position.set(0.52, 0.95, 0.1);
  const light = new THREE.PointLight(0xffb347, 30, 18, 1.6);
  light.position.copy(lantern.position);

  // vòng sáng dưới chân để luôn nhìn thấy Mây
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;

  g.add(body, sash, head, hat, hatBand, string, lantern, light, halo);
  g.scale.setScalar(1.7);
  return { group: g, lantern, light };
}

/** Bóng Mực: khối mực đen tím, hai mắt vàng nhạt. */
export function buildShade(): THREE.Group {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x140a24, emissive: 0x4b2a7a, emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  blob.name = "blob";
  blob.scale.set(1, 0.85, 1);
  for (const sx of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    eye.position.set(sx, 0.15, 0.62);
    g.add(eye);
  }
  g.add(blob);
  return g;
}
