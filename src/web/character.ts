import * as THREE from "three";
import { PALETTE } from "./palette.ts";

/**
 * Mây: người giữ đèn nhỏ tuổi (tên nhân vật, không phải đám mây). Đội nón lá, treo một chiếc đèn lồng nhỏ
 * ở vành nón. Dựng từ hình khối cơ bản (không asset ngoài). Chỉ là hiển thị: không ảnh hưởng logic lõi
 * hay headless. Chân nhân vật nằm ở y = 0 của group.
 * Màu theo bảng màu chuẩn: áo #E8E2D0, khăn #C8102E.
 */
export interface MayRig {
  group: THREE.Group;
  lantern: THREE.Mesh;
  light: THREE.PointLight;
  charmAura: THREE.Mesh;
}

export function buildMay(): MayRig {
  const g = new THREE.Group();
  const mat = (color: number, emissive = 0x000000, e = 0) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: e, roughness: 0.75 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.8, 16), mat(PALETTE.mayRobe, 0x9a9278, 0.55));
  body.position.y = 0.5;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 8, 20), mat(0xe8742c, 0x5a2808, 0.4));
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 0.62;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 20), mat(PALETTE.mayScarf, PALETTE.mayScarf, 0.25));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.92;
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.04), mat(PALETTE.mayScarf, PALETTE.mayScarf, 0.25));
  scarfTail.position.set(0.12, 0.72, -0.26);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat(0x6a4a2a));
    leg.position.set(sx, 0.15, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), mat(PALETTE.mayRobe, 0x9a9278, 0.45));
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

  // nón lá nhỏ, hơi ngửa ra sau để thấy đầu
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 28), mat(0xe6c06a, 0x4a3410, 0.3));
  hat.position.set(0, 1.42, -0.02);
  hat.rotation.x = -0.12;
  const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), mat(PALETTE.mayScarf));
  hatBand.rotation.x = Math.PI / 2;
  hatBand.position.set(0, 1.3, 0);

  // đèn lồng nhỏ treo ở vành nón, bên phải
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mat(0x5a3a1c));
  string.position.set(0.52, 1.18, 0.1);
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.lanternLit, emissive: PALETTE.lanternLit, emissiveIntensity: 2.2, roughness: 0.5 }),
  );
  lantern.scale.y = 1.2;
  lantern.position.set(0.52, 0.95, 0.1);
  const light = new THREE.PointLight(PALETTE.lanternLit, 30, 18, 1.6);
  light.position.copy(lantern.position);

  // vòng sáng dưới chân để luôn nhìn thấy Mây
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  // quầng đỏ khi có Bùa Gió
  const charmAura = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 0.95, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.charm, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  charmAura.rotation.x = -Math.PI / 2;
  charmAura.position.y = 0.06;
  charmAura.visible = false;

  g.add(body, sash, scarf, scarfTail, head, hat, hatBand, string, lantern, light, halo, charmAura);
  g.scale.setScalar(1.7);
  return { group: g, lantern, light, charmAura };
}

/** Hình học và vật liệu dùng chung giữa mọi Bóng Mực (hàng trăm con ở cảnh benchmark): chỉ thân có vật liệu riêng vì đổi màu theo trạng thái. */
let shared: { blobGeo: THREE.SphereGeometry; rimGeo: THREE.SphereGeometry; eyeGeo: THREE.SphereGeometry; rimMat: THREE.MeshBasicMaterial; eyeMat: THREE.MeshBasicMaterial } | null = null;
function sharedShade() {
  return (shared ??= {
    blobGeo: new THREE.SphereGeometry(0.75, 20, 16),
    rimGeo: new THREE.SphereGeometry(0.82, 20, 16),
    eyeGeo: new THREE.SphereGeometry(0.1, 8, 8),
    rimMat: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.55 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim }),
  });
}
/** Gọi khi World bị dọn: lần dựng sau tạo lại tài nguyên dùng chung. */
export function resetShadeResources(): void { shared = null; }
/** Màu viền/mắt dùng chung (đổi theo bảng màu dễ phân biệt). */
export function setShadeRimColor(hex: number): void {
  const r = sharedShade();
  r.rimMat.color.setHex(hex);
  r.eyeMat.color.setHex(hex);
}

/** Bóng Mực: thân #120A1A, viền #7A3CFF (bị choáng #3A3450), hai mắt cùng màu viền (đổi sang #00B3FF ở bảng màu dễ phân biệt). */
export function buildShade(): THREE.Group {
  const r = sharedShade();
  const g = new THREE.Group();
  const blob = new THREE.Mesh(r.blobGeo, new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, emissive: PALETTE.shadeRim, emissiveIntensity: 0.55, roughness: 0.4 }));
  blob.name = "blob";
  blob.scale.set(1, 0.85, 1);
  const rim = new THREE.Mesh(r.rimGeo, r.rimMat);
  rim.name = "rim";
  rim.scale.set(1, 0.85, 1);
  for (const sx of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(r.eyeGeo, r.eyeMat);
    eye.name = "eye";
    eye.position.set(sx, 0.15, 0.62);
    g.add(eye);
  }
  g.add(blob, rim);
  return g;
}
