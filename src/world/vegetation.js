// Spruce forests, wild apple groves, birches, juniper, grass, flowers, rocks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep, createNoise2D } from '../core/noise.js';
import { addWind } from '../core/wind.js';
import { riverX, riverDistance, forestDensity, LAKE, WORLD } from './terrain.js';

const CHUNK = 200;

// Instances bucketed into spatial chunks so the camera and shadow passes can
// frustum-cull them.
class ChunkedInstances {
  constructor(geometry, material, { castShadow = true, receiveShadow = true } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.chunks = new Map();
  }

  add(matrix, color) {
    const x = matrix.elements[12];
    const z = matrix.elements[14];
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let c = this.chunks.get(key);
    if (!c) this.chunks.set(key, (c = { matrices: [], colors: [] }));
    c.matrices.push(matrix.clone());
    c.colors.push(color ? color.clone() : null);
  }

  build(parent) {
    const meshes = [];
    for (const c of this.chunks.values()) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, c.matrices.length);
      c.matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        if (c.colors[i]) mesh.setColorAt(i, c.colors[i]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = this.receiveShadow;
      parent.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
}

function paint(geo, color) {
  // Polyhedra are non-indexed, so make everything non-indexed before merging.
  if (geo.index) geo = geo.toNonIndexed();
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function strip(geo) {
  geo.deleteAttribute('uv');
  return geo;
}

// Schrenk's spruce: tall, narrow, layered.
function spruceGeometry() {
  const parts = [];
  parts.push(paint(strip(new THREE.CylinderGeometry(0.16, 0.34, 3.4, 6).translate(0, 1.4, 0)), '#4a3426'));
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const radius = 2.4 * (1 - t) + 0.35;
    const height = 3.8 - t * 1.6;
    const y = 1.7 + i * 1.95;
    const shade = i % 2 ? '#1f4632' : '#24513a';
    parts.push(paint(strip(new THREE.ConeGeometry(radius, height, 8).translate(0, y + height / 2, 0)), shade));
  }
  parts.push(paint(strip(new THREE.ConeGeometry(0.4, 1.8, 6).translate(0, 1.7 + tiers * 1.95 + 0.6, 0)), '#2b5b40'));
  return mergeGeometries(parts);
}

function appleTreeGeometry() {
  const rnd = mulberry32(3);
  const parts = [];
  parts.push(paint(strip(new THREE.CylinderGeometry(0.14, 0.24, 2.4, 6).translate(0, 1.2, 0)), '#5a3f2c'));
  parts.push(paint(strip(new THREE.CylinderGeometry(0.06, 0.1, 1.4, 5).rotateZ(0.7).translate(0.5, 2.3, 0)), '#5a3f2c'));
  const blobs = [
    [0, 3.2, 0, 1.5],
    [0.9, 2.8, 0.4, 1.1],
    [-0.8, 2.9, -0.3, 1.15],
    [0.1, 2.7, -0.9, 1.0],
    [-0.2, 3.8, 0.5, 0.9],
  ];
  for (const [x, y, z, r] of blobs) {
    parts.push(paint(strip(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z)), '#4d7d2f'));
  }
  for (let i = 0; i < 14; i++) {
    const [bx, by, bz, br] = blobs[i % blobs.length];
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize().multiplyScalar(br * 0.92);
    parts.push(paint(strip(new THREE.IcosahedronGeometry(0.11, 0).translate(bx + v.x, by + v.y, bz + v.z)), '#c0392b'));
  }
  return mergeGeometries(parts);
}

function birchGeometry() {
  const parts = [];
  parts.push(paint(strip(new THREE.CylinderGeometry(0.08, 0.14, 6, 5).translate(0, 3, 0)), '#e9e4d8'));
  for (let i = 0; i < 4; i++) {
    parts.push(paint(strip(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 5).translate(0, 0.8 + i * 1.3, 0)), '#3a3530'));
  }
  const blobs = [
    [0, 5.6, 0, 1.3],
    [0.6, 4.6, 0.3, 1.0],
    [-0.5, 4.8, -0.4, 1.0],
    [0.1, 6.6, 0.1, 0.8],
  ];
  for (const [x, y, z, r] of blobs) {
    parts.push(paint(strip(new THREE.IcosahedronGeometry(r, 0).scale(1, 1.2, 1).translate(x, y, z)), '#7aa83f'));
  }
  return mergeGeometries(parts);
}

function juniperGeometry() {
  const parts = [];
  parts.push(paint(strip(new THREE.DodecahedronGeometry(1, 0).scale(1.3, 0.55, 1.1).translate(0, 0.45, 0)), '#2e4c3c'));
  parts.push(paint(strip(new THREE.DodecahedronGeometry(0.8, 0).scale(1.2, 0.6, 1).translate(0.8, 0.5, 0.4)), '#355a45'));
  parts.push(paint(strip(new THREE.DodecahedronGeometry(0.7, 0).scale(1, 0.7, 1).translate(-0.7, 0.55, -0.3)), '#2a4636'));
  return mergeGeometries(parts);
}

function grassGeometry() {
  const rnd = mulberry32(8);
  const pos = [];
  const colors = [];
  const base = new THREE.Color('#3f6b25');
  const tip = new THREE.Color('#9cc35a');
  for (let b = 0; b < 6; b++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.18;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.35 + rnd() * 0.4;
    const w = 0.05 + rnd() * 0.03;
    const ra = rnd() * Math.PI;
    const dx = Math.cos(ra) * w;
    const dz = Math.sin(ra) * w;
    const lean = (rnd() - 0.5) * 0.3;
    // Both windings, so each blade is visible from either side while its
    // normals stay pointing up.
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lean, h, z + lean * 0.5);
    pos.push(x + dx, 0, z + dz, x - dx, 0, z - dz, x + lean, h, z + lean * 0.5);
    for (let k = 0; k < 2; k++) colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Point normals upward so blades are lit like the ground beneath them.
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geo;
}

function rockGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const noise = createNoise2D(mulberry32(seed));
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + noise(v.x * 1.7 + v.y, v.z * 1.7 - v.y) * 0.28;
    v.multiplyScalar(k);
    v.y *= 0.65;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return strip(geo);
}

export function buildVegetation(scene, terrain, plan, colliders) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);
  const rnd = mulberry32(555);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const walkR2 = (WORLD.walkRadius + 5) ** 2;

  const clearings = Object.entries(plan.sites).map(([name, site]) => ({
    x: site.x,
    z: site.z,
    r: { yurt: 22, bridge: 14, balbal: 12, lake: 0, start: 8, peak: 8, marmots: 24, arashan: 14, bugu: 18, irbis: 8, ibex: 10 }[name] ?? 10,
  }));
  const items = [...plan.apples, ...plan.edelweiss];
  const inClearing = (x, z, pad = 0) => clearings.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2);
  const nearLake = (x, z, extra) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 0.95 + extra;

  const leafMat = (wind) => {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    return wind ? addWind(mat, wind, 1.1) : mat;
  };

  // Spruce forest ----------------------------------------------------------
  const spruces = new ChunkedInstances(spruceGeometry(), leafMat(0.012));
  const spacing = 6.2;
  const half = terrain.half - 4;
  for (let z = -half; z < half; z += spacing) {
    for (let x = -half; x < half; x += spacing) {
      const tx = x + (rnd() - 0.5) * spacing * 0.9;
      const tz = z + (rnd() - 0.5) * spacing * 0.9;
      const h = terrain.getHeight(tx, tz);
      if (h < 3.5 || h > 118) continue;
      const slope = terrain.getSlope(tx, tz);
      if (slope > 1.25) continue;
      const d = riverDistance(tx, tz);
      if (d < 12 || nearLake(tx, tz, 4)) continue;
      const fd = forestDensity(tx, tz);
      let prob = smoothstep(-0.12, 0.22, fd);
      prob *= smoothstep(3.5, 12, h) * (1 - smoothstep(98, 118, h));
      prob *= 0.25 + 0.75 * smoothstep(22, 70, d);
      // Kolsay-style dense spruce around the lake.
      if (nearLake(tx, tz, 70)) prob = Math.max(prob, 0.75 * smoothstep(2.5, 6, h));
      if (rnd() > prob) continue;
      if (inClearing(tx, tz)) continue;
      const scale = 0.65 + rnd() * 0.6 + smoothstep(0.1, 0.4, fd) * 0.25;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      s.set(scale * (0.9 + rnd() * 0.2), scale, scale * (0.9 + rnd() * 0.2));
      p.set(tx, h - 0.3, tz);
      m.compose(p, q, s);
      col.setRGB(0.8 + rnd() * 0.3, 0.85 + rnd() * 0.3, 0.8 + rnd() * 0.25);
      spruces.add(m, col);
      if (tx * tx + tz * tz < walkR2) colliders.add(tx, tz, 0.42 * scale, 'tree');
    }
  }
  spruces.build(group);

  // Wild apple trees ------------------------------------------------------
  const appleTrees = new ChunkedInstances(appleTreeGeometry(), leafMat(0.02));
  for (const t of plan.appleTrees) {
    const h = terrain.getHeight(t.x, t.z);
    q.setFromAxisAngle(up, t.rot);
    s.setScalar(t.s);
    p.set(t.x, h - 0.15, t.z);
    m.compose(p, q, s);
    appleTrees.add(m);
    colliders.add(t.x, t.z, 0.3 * t.s, 'tree');
  }
  appleTrees.build(group);

  // Birches along the river -----------------------------------------------
  const birches = new ChunkedInstances(birchGeometry(), leafMat(0.03));
  for (let i = 0; i < 2400; i++) {
    // Sample along the river corridor.
    const z = (rnd() - 0.5) * 2 * half;
    const x = riverX(z) + (rnd() - 0.5) * 2 * 50;
    const d = riverDistance(x, z);
    if (d < 9 || d > 50 || nearLake(x, z, 3)) continue;
    if (rnd() > 0.7 * (1 - smoothstep(14, 50, d))) continue;
    const h = terrain.getHeight(x, z);
    if (h < 1.2 || h > 20) continue;
    if (inClearing(x, z) || colliders.blocked(x, z, 1.5)) continue;
    const scale = 0.7 + rnd() * 0.5;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    s.setScalar(scale);
    p.set(x, h - 0.1, z);
    m.compose(p, q, s);
    birches.add(m);
    if (x * x + z * z < walkR2) colliders.add(x, z, 0.2 * scale, 'tree');
  }
  birches.build(group);

  // Juniper (archa) on the high slopes -------------------------------------
  const junipers = new ChunkedInstances(juniperGeometry(), leafMat(0));
  for (let i = 0; i < 9000; i++) {
    const x = (rnd() - 0.5) * 2 * half;
    const z = (rnd() - 0.5) * 2 * half;
    const h = terrain.getHeight(x, z);
    if (h < 55 || h > 128) continue;
    if (terrain.getSlope(x, z) > 1.0) continue;
    if (rnd() > 0.55 || inClearing(x, z, -4)) continue;
    const scale = 0.6 + rnd() * 0.8;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    s.set(scale, scale * (0.8 + rnd() * 0.5), scale);
    p.set(x, h - 0.15, z);
    m.compose(p, q, s);
    junipers.add(m);
  }
  junipers.build(group);

  // Rocks and boulders -----------------------------------------------------
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  for (let variant = 0; variant < 3; variant++) {
    const rocks = new ChunkedInstances(rockGeometry(100 + variant), rockMat);
    for (let i = 0; i < 1700; i++) {
      const x = (rnd() - 0.5) * 2 * half;
      const z = (rnd() - 0.5) * 2 * half;
      const h = terrain.getHeight(x, z);
      const slope = terrain.getSlope(x, z);
      const d = riverDistance(x, z);
      const rocky = smoothstep(0.6, 1.1, slope) + smoothstep(90, 130, h);
      const riverside = d > 5 && d < 12 ? 0.5 : 0;
      if (rnd() > 0.05 + rocky * 0.5 + riverside) continue;
      if (inClearing(x, z, -4)) continue;
      const big = rnd() < 0.25 + rocky * 0.2;
      const scale = big ? 1.2 + rnd() * 2.2 : 0.3 + rnd() * 0.6;
      if (big && colliders.blocked(x, z, scale)) continue;
      // Never bury an apple or an edelweiss under a boulder.
      if (big && items.some((it) => (it.x - x) ** 2 + (it.z - z) ** 2 < (scale + 1.6) ** 2)) continue;
      q.setFromEuler(new THREE.Euler(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.4));
      s.set(scale * (0.8 + rnd() * 0.5), scale, scale * (0.8 + rnd() * 0.5));
      p.set(x, h - scale * 0.2, z);
      m.compose(p, q, s);
      const g = 0.24 + rnd() * 0.12;
      col.setRGB(g, g * 0.96, g * 0.9);
      rocks.add(m, col);
      if (big && x * x + z * z < walkR2) colliders.add(x, z, scale * 0.85, 'rock');
    }
    rocks.build(group);
  }

  // Grass and flowers (meadows only, inside the walkable area) --------------
  const grassMat = addWind(
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    0.28,
    2.2
  );
  const grass = new ChunkedInstances(grassGeometry(), grassMat, { castShadow: false });
  const stemMat = addWind(new THREE.MeshLambertMaterial({ color: 0x4c7a2c }), 0.3, 2.2);
  const headMat = addWind(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 0.3, 2.2);
  const stemGeo = strip(new THREE.CylinderGeometry(0.012, 0.015, 0.36, 3).translate(0, 0.18, 0));
  const headGeo = strip(new THREE.CylinderGeometry(0.11, 0.035, 0.14, 6).translate(0, 0.4, 0));
  const stems = new ChunkedInstances(stemGeo, stemMat, { castShadow: false });
  const heads = new ChunkedInstances(headGeo, headMat, { castShadow: false });
  const flowerColors = ['#d62828', '#e85d04', '#f4d35e', '#7b2cbf', '#f7f7ff', '#e05780', '#3a86ff'].map(
    (c) => new THREE.Color(c)
  );
  const meadowNoise = createNoise2D(mulberry32(91));
  const gr = WORLD.walkRadius;
  const grassAttempts = matchMedia('(pointer: coarse)').matches ? 70000 : 140000;
  for (let i = 0; i < grassAttempts; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * gr;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = terrain.getHeight(x, z);
    if (h < 0.9 || h > 120) continue;
    const slope = terrain.getSlope(x, z);
    if (slope > 0.85) continue;
    const fd = forestDensity(x, z);
    const meadow = (1 - smoothstep(0.0, 0.3, fd) * smoothstep(8, 16, h) * 0.8) * (1 - smoothstep(0.5, 0.85, slope));
    const patch = smoothstep(-0.35, 0.3, meadowNoise(x * 0.04, z * 0.04));
    if (rnd() > meadow * patch) continue;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    const sc = 0.7 + rnd() * 0.7;
    s.setScalar(sc);
    p.set(x, h - 0.03, z);
    m.compose(p, q, s);
    grass.add(m);
    // Tulips, irises and poppies on the lower meadows, fewer up high.
    if (rnd() < 0.22 * (1 - smoothstep(60, 110, h))) {
      const fx = x + (rnd() - 0.5) * 0.8;
      const fz = z + (rnd() - 0.5) * 0.8;
      p.set(fx, terrain.getHeight(fx, fz) - 0.02, fz);
      s.setScalar(0.8 + rnd() * 0.6);
      m.compose(p, q, s);
      stems.add(m);
      const fc = flowerColors[Math.floor(meadowNoise(x * 0.015 + 9, z * 0.015) * 3.5 + 3.5 + rnd() * 1.5) % flowerColors.length];
      heads.add(m, fc);
    }
  }
  grass.build(group);
  stems.build(group);
  heads.build(group);

  return group;
}
