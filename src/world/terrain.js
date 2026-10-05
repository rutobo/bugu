// Heightfield for a Tien Shan valley: a river winding north–south through a
// meadow floor, spruce-covered walls rising into rocky ridges, and an alpine
// lake in the north. Pure data (no three.js) so it can be analysed in Node.

import { createNoise2D, mulberry32, smoothstep, lerp } from '../core/noise.js';

export const WORLD = {
  size: 1000,
  segments: 320,
  walkRadius: 450,
  waterLevel: 0,
  wadeDepth: -1.5, // ground lower than this is too deep to wade through
  maxSlope: 1.0, // rise over run the boy can still climb
};

const noiseA = createNoise2D(mulberry32(1337));
const noiseB = createNoise2D(mulberry32(4242));
const noiseC = createNoise2D(mulberry32(9001));

export function fbm(noise, x, z, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(noise, x, z, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * freq, z * freq));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

export function riverX(z) {
  return 32 * Math.sin(z * 0.0062 + 0.4) + 16 * Math.sin(z * 0.0153 + 1.3);
}

export function riverDistance(x, z) {
  return Math.abs(x - riverX(z));
}

export const LAKE = { x: riverX(-250), z: -250, r: 50 };

// 0..1 – how much a spot "wants" spruce forest.
export function forestDensity(x, z) {
  return fbm(noiseC, x * 0.006 + 3.1, z * 0.006 - 1.7, 3);
}

export function rawHeight(x, z) {
  const d = riverDistance(x, z);

  let h = 3.2;
  // Valley walls.
  const wall = smoothstep(26, 300, d);
  h += Math.pow(wall, 1.5) * 130;
  // Rolling hills and spurs on the slopes.
  h += fbm(noiseA, x * 0.008, z * 0.008, 4) * 24 * smoothstep(18, 95, d);
  // Sharp ridges up high.
  h += (ridged(noiseB, x * 0.0042 + 10, z * 0.0042 - 7, 4) - 0.45) * 80 * smoothstep(110, 340, d);
  // The valley closes off with mountains to the north and south.
  const az = Math.abs(z);
  h += smoothstep(330, 520, az) * (90 + 40 * noiseA(x * 0.01, z * 0.01));
  // Gentle bumps on the valley floor.
  h += fbm(noiseB, x * 0.03, z * 0.03, 2) * 0.7;

  // River channel.
  const channel = 1 - smoothstep(2.2, 7.5, d);
  h -= channel * 3.9;

  // Alpine lake basin.
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  const lk = 1 - smoothstep(LAKE.r * 0.45, LAKE.r * 1.2, ld);
  h = lerp(h, -7, lk);

  return h;
}

export class Terrain {
  constructor() {
    const { size, segments } = WORLD;
    this.size = size;
    this.half = size / 2;
    this.segments = segments;
    this.step = size / segments;
    this.n = segments + 1;
    this.heights = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        this.heights[j * this.n + i] = rawHeight(this.xAt(i), this.zAt(j));
      }
    }
  }

  xAt(i) {
    return -this.half + i * this.step;
  }

  zAt(j) {
    return -this.half + j * this.step;
  }

  h(i, j) {
    i = Math.max(0, Math.min(this.segments, i));
    j = Math.max(0, Math.min(this.segments, j));
    return this.heights[j * this.n + i];
  }

  // Exact height of the rendered triangle mesh at (x, z).
  getHeight(x, z) {
    const gx = (x + this.half) / this.step;
    const gz = (z + this.half) / this.step;
    let i = Math.floor(gx);
    let j = Math.floor(gz);
    i = Math.max(0, Math.min(this.segments - 1, i));
    j = Math.max(0, Math.min(this.segments - 1, j));
    const fx = Math.max(0, Math.min(1, gx - i));
    const fz = Math.max(0, Math.min(1, gz - j));
    const hA = this.h(i, j);
    const hB = this.h(i, j + 1);
    const hC = this.h(i + 1, j);
    const hD = this.h(i + 1, j + 1);
    if (fx + fz <= 1) return hA + (hC - hA) * fx + (hB - hA) * fz;
    return hD + (hB - hD) * (1 - fx) + (hC - hD) * (1 - fz);
  }

  // Steepest slope (rise over run) around a point.
  getSlope(x, z) {
    const e = this.step;
    const dx = (this.getHeight(x + e, z) - this.getHeight(x - e, z)) / (2 * e);
    const dz = (this.getHeight(x, z + e) - this.getHeight(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  // Blend the ground towards a flat pad (for the yurt, landmarks, ...).
  flatten(x, z, radius, height = this.getHeight(x, z), falloff = radius * 0.8) {
    const r = radius + falloff;
    const i0 = Math.floor((x - r + this.half) / this.step);
    const i1 = Math.ceil((x + r + this.half) / this.step);
    const j0 = Math.floor((z - r + this.half) / this.step);
    const j1 = Math.ceil((z + r + this.half) / this.step);
    for (let j = Math.max(0, j0); j <= Math.min(this.segments, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(this.segments, i1); i++) {
        const d = Math.hypot(this.xAt(i) - x, this.zAt(j) - z);
        const w = 1 - smoothstep(radius, r, d);
        if (w <= 0) continue;
        const k = j * this.n + i;
        this.heights[k] = lerp(this.heights[k], height, w);
      }
    }
    return height;
  }

  // Grid vertices reachable on foot from a start point (flood fill limited by
  // slope, deep water and the world edge).
  computeReachable(startX, startZ, slopeLimit = WORLD.maxSlope * 0.82) {
    const n = this.n;
    const reach = new Uint8Array(n * n);
    const si = Math.round((startX + this.half) / this.step);
    const sj = Math.round((startZ + this.half) / this.step);
    const queue = new Int32Array(n * n);
    let head = 0;
    let tail = 0;
    reach[sj * n + si] = 1;
    queue[tail++] = sj * n + si;
    const maxRise = slopeLimit * this.step;
    const r2 = (WORLD.walkRadius - 6) ** 2;
    while (head < tail) {
      const k = queue[head++];
      const i = k % n;
      const j = (k - i) / n;
      const hk = this.heights[k];
      for (let dir = 0; dir < 4; dir++) {
        const ni = i + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const nj = j + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni > this.segments || nj > this.segments) continue;
        const nk = nj * n + ni;
        if (reach[nk]) continue;
        const x = this.xAt(ni);
        const z = this.zAt(nj);
        if (x * x + z * z > r2) continue;
        const hn = this.heights[nk];
        if (hn < WORLD.wadeDepth + 0.15) continue;
        if (Math.abs(hn - hk) > maxRise) continue;
        reach[nk] = 1;
        queue[tail++] = nk;
      }
    }
    this.reachable = reach;
    return reach;
  }

  isReachable(x, z) {
    if (!this.reachable) return true;
    const i = Math.round((x + this.half) / this.step);
    const j = Math.round((z + this.half) / this.step);
    if (i < 0 || j < 0 || i > this.segments || j > this.segments) return false;
    return this.reachable[j * this.n + i] === 1;
  }
}
