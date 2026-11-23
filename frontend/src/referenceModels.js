// Crop geometry adapted from the user-provided 3D数字农田.html.
// Only procedural geometry is reused; no game simulation or external network resources.
import * as THREE from 'three';
const geoCache = new Map();
function geoOnce(key, build) { if (!geoCache.has(key)) geoCache.set(key, build()); return geoCache.get(key); }
// Stable layout keeps plant shapes unchanged when a scene is remounted.
let seed = 173;
const rand = (a,b) => { seed = (seed * 1664525 + 1013904223) >>> 0; return a + (b-a)*(seed/4294967296); };
function makeLeafGeo(w, l, bend, seg) {
  const g = new THREE.PlaneGeometry(1, 1, 1, seg || 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i);
    const u = py + 0.5;
    const taper = Math.sin(Math.PI * Math.min(0.97, u)) * 0.85 + 0.15;
    p.setX(i, px * w * taper);
    p.setY(i, l * u);
    p.setZ(i, bend * u * u);
  }
  g.computeVertexNormals();
  return g;
}

const leafMatBase = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide });
const stemMatBase = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

function buildWheat() {
  const group = new THREE.Group();
  const leafMat = leafMatBase(0x7f9c49);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x93a955, roughness: 0.7 });
  const stalkGeo = geoOnce('w-stalk', () => new THREE.CylinderGeometry(0.02, 0.03, 1, 5));
  const earGeo = geoOnce('w-ear', () => {
    const g = new THREE.SphereGeometry(0.042, 7, 6);
    g.scale(1, 2.9, 1);
    return g;
  });
  const N = 24;
  const stalks = new THREE.InstancedMesh(stalkGeo, leafMat, N);
  const ears = new THREE.InstancedMesh(earGeo, earMat, N);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const px = (col - 1.5) * 0.38 + rand(-0.05, 0.05);
    const pz = (row - 2.5) * 0.34 + rand(-0.05, 0.05);
    const h = 0.6 + rand(0,1) * 0.16;
    dummy.position.set(px, h / 2, pz);
    dummy.rotation.set(0, rand(0,1) * 3.1, rand(-0.08, 0.08));
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stalks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, h + 0.11, pz);
    dummy.rotation.set(rand(-0.1, 0.1), rand(0,1) * 3.1, rand(-0.15, 0.15));
    dummy.scale.setScalar(rand(0.9, 1.15));
    dummy.updateMatrix();
    ears.setMatrixAt(i, dummy.matrix);
  }
  stalks.castShadow = true;
  ears.castShadow = true;
  group.add(stalks, ears);

  // 叶片：麦子低头之前先长叶子，让早期也有体积
  const bladeGeo = geoOnce('w-blade', () => makeLeafGeo(0.055, 0.42, 0.08, 3));
  const blades = new THREE.InstancedMesh(bladeGeo, leafMat, 16);
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e1 = new THREE.Euler();
  for (let i = 0; i < 16; i++) {
    dummy.position.set(rand(-0.45, 0.45), rand(0.24, 0.5), rand(-0.42, 0.42));
    e1.set(0, rand(0, 6.28), 0);
    q1.setFromEuler(e1);
    e1.set(rand(0.9, 1.35), 0, 0);
    q2.setFromEuler(e1);
    dummy.quaternion.copy(q1).multiply(q2);
    dummy.scale.setScalar(rand(0.85, 1.25));
    dummy.updateMatrix();
    blades.setMatrixAt(i, dummy.matrix);
  }
  blades.castShadow = true;
  group.add(blades);

  return {
    group, leafMats: [leafMat], fruits: [], earMat, ears,
    leafBase: new THREE.Color(0x7f9c49), leafRipe: new THREE.Color(0xc8b166),
    unripe: new THREE.Color(0x99ad5d), ripe: new THREE.Color(0xd9b061),
    height: 0.95
  };
}

function buildCorn() {
  const group = new THREE.Group();
  const leafMat = leafMatBase(0x6f9640);
  const stalkMat = stemMatBase(0x91a35a);
  const cobMat = new THREE.MeshStandardMaterial({ color: 0xa8b06a, roughness: 0.62 });
  const stalkGeo = geoOnce('c-stalk', () => new THREE.CylinderGeometry(0.05, 0.07, 1.12, 7));
  const stalk = new THREE.Mesh(stalkGeo, stalkMat);
  stalk.position.y = 0.56;
  stalk.castShadow = true;
  group.add(stalk);

  const leafGeo = geoOnce('c-leaf', () => makeLeafGeo(0.15, 0.92, 0.34, 8));
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.rotation.order = 'YXZ';
    l.position.y = 0.26 + i * 0.15;
    l.rotation.set(1.32 - (i % 2) * 0.18, i * 2.1, 0);
    l.castShadow = true;
    group.add(l);
  }
  const cobGeo = geoOnce('c-cob', () => new THREE.CapsuleGeometry(0.075, 0.26, 4, 9));
  const cobs = [];
  [[0.66, 0.15, 0.35], [0.88, -0.14, -0.5]].forEach(([y, ox, rot]) => {
    const m = new THREE.Mesh(cobGeo, cobMat);
    m.position.set(ox, y, 0.03);
    m.rotation.set(0.3, rot, 0.14);
    m.castShadow = true;
    group.add(m);
    cobs.push({ mesh: m, at: 0.55 });
  });
  const tassel = new THREE.Mesh(
    geoOnce('c-tassel', () => new THREE.ConeGeometry(0.055, 0.22, 6)),
    new THREE.MeshStandardMaterial({ color: 0xc9bd7a, roughness: 0.75 })
  );
  tassel.position.y = 1.24;
  tassel.castShadow = true;
  group.add(tassel);
  return {
    group, leafMats: [leafMat], fruits: cobs, fruitMat: cobMat,
    leafBase: new THREE.Color(0x6f9640), leafRipe: new THREE.Color(0x8a9a45),
    unripe: new THREE.Color(0x9aa963), ripe: new THREE.Color(0xe3b64a),
    height: 1.3
  };
}

function buildCarrot() {
  const group = new THREE.Group();
  const leafMat = leafMatBase(0x7ca24a);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0xd07a35, roughness: 0.72 });
  const rootGeo = geoOnce('k-root', () => new THREE.ConeGeometry(0.105, 0.46, 9));
  const root = new THREE.Mesh(rootGeo, rootMat);
  root.rotation.x = Math.PI;
  root.position.y = 0.06;
  root.castShadow = true;
  group.add(root);

  const leafGeo = geoOnce('k-leaf', () => makeLeafGeo(0.12, 0.56, 0.1, 5));
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.rotation.order = 'YXZ';
    l.position.y = 0.26;
    l.rotation.set(0.38 + (i % 2) * 0.22, i * 0.92, 0);
    l.castShadow = true;
    group.add(l);
  }
  return {
    group, leafMats: [leafMat], fruits: [{ mesh: root, at: 0.55 }], fruitMat: rootMat,
    leafBase: new THREE.Color(0x7ca24a), leafRipe: new THREE.Color(0x86a04a),
    unripe: new THREE.Color(0xb98c52), ripe: new THREE.Color(0xd6772f),
    height: 0.55
  };
}

function buildTomato() {
  const group = new THREE.Group();
  const leafMat = leafMatBase(0x5f8a3d);
  const stemMat = stemMatBase(0x6d8c48);
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0x8fa04b, roughness: 0.55 });
  const stem = new THREE.Mesh(geoOnce('t-stem', () => new THREE.CylinderGeometry(0.022, 0.032, 0.72, 6)), stemMat);
  stem.position.y = 0.36;
  stem.castShadow = true;
  group.add(stem);

  const leafGeo = geoOnce('t-leaf', () => makeLeafGeo(0.16, 0.42, 0.1, 5));
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.rotation.order = 'YXZ';
    l.position.y = 0.24 + i * 0.11;
    l.rotation.set(1.05, i * 1.5, 0);
    l.castShadow = true;
    group.add(l);
  }
  const berryGeo = geoOnce('t-berry', () => new THREE.SphereGeometry(0.092, 12, 10));
  const calyxGeo = geoOnce('t-calyx', () => new THREE.ConeGeometry(0.042, 0.05, 5));
  const fruits = [];
  [[0.19, 0.5, 0.15], [-0.18, 0.44, -0.1], [0.06, 0.6, -0.19], [-0.1, 0.63, 0.2], [0.21, 0.35, -0.18]].forEach(([x, y, z], i) => {
    const bg = new THREE.Group();
    bg.position.set(x, y, z);
    const b = new THREE.Mesh(berryGeo, fruitMat);
    b.castShadow = true;
    bg.add(b);
    const calyx = new THREE.Mesh(calyxGeo, leafMat);
    calyx.position.y = 0.074;
    calyx.rotation.x = Math.PI;
    bg.add(calyx);
    group.add(bg);
    fruits.push({ mesh: bg, at: 0.44 + i * 0.035 });
  });
  return {
    group, leafMats: [leafMat], fruits, fruitMat,
    leafBase: new THREE.Color(0x5f8a3d), leafRipe: new THREE.Color(0x63884a),
    unripe: new THREE.Color(0x8aa14e), ripe: new THREE.Color(0xcb4a34),
    height: 0.8
  };
}

function buildPumpkin() {
  const group = new THREE.Group();
  const leafMat = leafMatBase(0x628a3c);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa8b45e, roughness: 0.68 });
  const bodyGeo = geoOnce('p-body', () => {
    const g = new THREE.SphereGeometry(1, 30, 20);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vz = p.getZ(i);
      const ang = Math.atan2(vz, vx);
      const rib = 1 + 0.055 * Math.cos(ang * 9);
      p.setX(i, vx * rib);
      p.setZ(i, vz * rib);
    }
    g.computeVertexNormals();
    return g;
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(0.36, 0.27, 0.36);
  body.position.y = 0.27;
  body.castShadow = true;
  group.add(body);

  const stemMat = stemMatBase(0x5d6b34);
  const stem = new THREE.Mesh(geoOnce('p-stem', () => new THREE.CylinderGeometry(0.032, 0.045, 0.14, 6)), stemMat);
  stem.position.y = 0.56;
  stem.rotation.z = 0.18;
  group.add(stem);

  const leafGeo = geoOnce('p-leaf', () => makeLeafGeo(0.22, 0.3, 0.06, 4));
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.rotation.order = 'YXZ';
    l.position.set(Math.cos(i * 1.6) * 0.16, 0.1, Math.sin(i * 1.6) * 0.16);
    l.rotation.set(1.1, i * 1.6, 0);
    l.castShadow = true;
    group.add(l);
  }
  return {
    group, leafMats: [leafMat], fruits: [{ mesh: body, at: 0.5 }, { mesh: stem, at: 0.4 }], fruitMat: bodyMat,
    leafBase: new THREE.Color(0x628a3c), leafRipe: new THREE.Color(0x5f8237),
    unripe: new THREE.Color(0x93a85c), ripe: new THREE.Color(0xdd8a2f),
    height: 0.6
  };
}


export {buildWheat,buildCorn,buildCarrot,buildTomato,buildPumpkin};
