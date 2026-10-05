import * as THREE from 'three';
import { smoothstep, createNoise2D, mulberry32 } from '../core/noise.js';
import { makeGroundDetail } from '../core/textures.js';
import { riverDistance, forestDensity } from './terrain.js';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  pebbles: C('#8b8576'),
  sand: C('#a39a7d'),
  meadow: C('#6b9a3a'),
  meadowDry: C('#9aa84c'),
  meadowLush: C('#4f8a32'),
  forestFloor: C('#3c5527'),
  alpine: C('#8c9a56'),
  rock: C('#77716a'),
  rockDark: C('#5c5853'),
  snow: C('#f1f4f8'),
};

const tint = createNoise2D(mulberry32(202));

export function groundColor(terrain, x, z, h, slope, out = new THREE.Color()) {
  const n = tint(x * 0.02, z * 0.02);
  const n2 = tint(x * 0.09 + 40, z * 0.09);
  const d = riverDistance(x, z);

  out.copy(PAL.meadow).lerp(PAL.meadowDry, smoothstep(-0.2, 0.7, n) * 0.6);
  out.lerp(PAL.meadowLush, smoothstep(30, 8, d) * 0.6);

  const forest = smoothstep(0.05, 0.3, forestDensity(x, z)) * smoothstep(5, 14, h) * (1 - smoothstep(95, 110, h));
  out.lerp(PAL.forestFloor, forest * 0.85);

  out.lerp(PAL.alpine, smoothstep(85, 105, h + n * 8));

  const rocky = Math.max(smoothstep(0.75, 1.1, slope + n2 * 0.12), smoothstep(118, 132, h + n * 10) * 0.85);
  out.lerp(n2 > 0 ? PAL.rock : PAL.rockDark, rocky);

  // Wet shoreline and riverbed.
  out.lerp(PAL.sand, smoothstep(1.4, 0.4, h) * 0.8);
  out.lerp(PAL.pebbles, smoothstep(0.3, -0.6, h));

  const snow = smoothstep(126, 140, h + n * 9) * (1 - smoothstep(1.1, 1.5, slope));
  out.lerp(PAL.snow, snow);
  return out;
}

export function buildTerrainMesh(terrain) {
  const { n, segments } = terrain;
  const count = n * n;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions[k * 3] = terrain.xAt(i);
      positions[k * 3 + 1] = terrain.heights[k];
      positions[k * 3 + 2] = terrain.zAt(j);
      uvs[k * 2] = terrain.xAt(i) / 8;
      uvs[k * 2 + 1] = terrain.zAt(j) / 8;
    }
  }
  const index = new Uint32Array(segments * segments * 6);
  let p = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i;
      const b = (j + 1) * n + i;
      const c = j * n + i + 1;
      const d = (j + 1) * n + i + 1;
      index[p++] = a;
      index[p++] = b;
      index[p++] = c;
      index[p++] = c;
      index[p++] = b;
      index[p++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();

  const normals = geo.attributes.normal.array;
  const col = new THREE.Color();
  for (let k = 0; k < count; k++) {
    const ny = normals[k * 3 + 1];
    const slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 0.05);
    groundColor(terrain, positions[k * 3], positions[k * 3 + 2], positions[k * 3 + 1], slope, col);
    colors[k * 3] = col.r;
    colors[k * 3 + 1] = col.g;
    colors[k * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeGroundDetail() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// Distant jagged snow peaks ringing the valley (scenery only).
export function buildBackdropPeaks() {
  const noise = createNoise2D(mulberry32(808));
  const radial = 22;
  const angular = 320;
  const r0 = 470;
  const r1 = 1700;
  const positions = [];
  const colors = [];
  const index = [];
  const col = new THREE.Color();
  const rock = C('#6d6c70');
  const snow = C('#f4f6fa');
  for (let a = 0; a <= angular; a++) {
    const th = (a / angular) * Math.PI * 2;
    for (let r = 0; r <= radial; r++) {
      const t = r / radial;
      const rad = r0 + (r1 - r0) * Math.pow(t, 1.3);
      const x = Math.cos(th) * rad;
      const z = Math.sin(th) * rad;
      const mass = 0.5 + 0.5 * noise(Math.cos(th) * 2.2 + 7, Math.sin(th) * 2.2 + t * 1.6);
      const ridge = 1 - Math.abs(noise(Math.cos(th) * 5 + 1, Math.sin(th) * 5 + t * 3));
      const env = smoothstep(0, 0.45, t) * (1 - smoothstep(0.8, 1, t) * 0.6);
      // The far end of the valley (north) gets the giant peaks, like Khan Tengri.
      const north = 0.75 + 0.45 * Math.max(0, -Math.sin(th));
      const y = 70 + env * (mass * 330 + ridge * ridge * 170 + 50) * north - (1 - env) * 10;
      positions.push(x, y, z);
    }
  }
  const rowLen = radial + 1;
  for (let a = 0; a < angular; a++) {
    for (let r = 0; r < radial; r++) {
      const i0 = a * rowLen + r;
      const i1 = (a + 1) * rowLen + r;
      index.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Snow settles above the snow line, except on the steepest rock faces.
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const snowLine = 230 + noise(pos.getX(i) * 0.004, pos.getZ(i) * 0.004) * 50;
    const flat = smoothstep(0.35, 0.7, nrm.getY(i));
    col.copy(rock).lerp(snow, smoothstep(snowLine - 25, snowLine + 25, y) * (0.25 + 0.75 * flat));
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'backdrop';
  return mesh;
}
