// Small procedural canvas textures, so the game ships without image assets.
import * as THREE from 'three';
import { createNoise2D, mulberry32 } from './noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Subtle grey grain multiplied over the terrain vertex colours.
export function makeGroundDetail() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = createNoise2D(mulberry32(77));
  const rnd = mulberry32(78);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable by sampling noise on a torus-ish mix.
      const u = x / size;
      const v = y / size;
      const a = Math.PI * 2;
      const n =
        noise(Math.cos(u * a) * 1.6 + 5, Math.sin(u * a) * 1.6 + Math.cos(v * a) * 1.6) * 0.5 +
        noise(Math.sin(v * a) * 3.2 + 9, Math.cos(u * a) * 3.2 + Math.sin(v * a) * 3.2) * 0.3;
      const g = 0.9 + n * 0.05 + (rnd() - 0.5) * 0.1;
      const k = (y * size + x) * 4;
      const val = Math.max(0, Math.min(255, g * 255));
      img.data[k] = val;
      img.data[k + 1] = val;
      img.data[k + 2] = val;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Tileable ripple normal map for water.
export function makeWaterNormals() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const waves = [];
  const rnd = mulberry32(5);
  for (let i = 0; i < 14; i++) {
    const kx = Math.round((rnd() - 0.5) * 12);
    const ky = Math.round((rnd() - 0.5) * 12);
    waves.push({ kx, ky, p: rnd() * Math.PI * 2, a: 1 / (1 + Math.hypot(kx, ky)) });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.p) * w.a;
      heights[y * size + x] = h;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = heights[y * size + ((x - 1 + size) % size)];
      const hr = heights[y * size + ((x + 1) % size)];
      const hd = heights[((y - 1 + size) % size) * size + x];
      const hu = heights[((y + 1) % size) * size + x];
      let nx = (hl - hr) * 2.5;
      let ny = (hd - hu) * 2.5;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const k = (y * size + x) * 4;
      img.data[k] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[k + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[k + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Soft round sprite for smoke, steam, fireflies and stars.
export function makeSoftSprite() {
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// White felt with a red ornamental band, wrapped around the yurt wall.
export function makeYurtFelt() {
  const w = 512;
  const h = 128;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece5d6';
  ctx.fillRect(0, 0, w, h);
  const rnd = mulberry32(12);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = `rgba(120,100,80,${rnd() * 0.06})`;
    ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2);
  }
  // Band with ram's-horn (kochkor muuz) motifs.
  const top = 18;
  const bandH = 34;
  ctx.fillStyle = '#9b2226';
  ctx.fillRect(0, top, w, bandH);
  ctx.strokeStyle = '#f3d8a2';
  ctx.lineWidth = 3;
  for (let x = 0; x < w; x += 32) {
    const cx = x + 16;
    const cy = top + bandH / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 9);
    ctx.lineTo(cx, cy - 2);
    ctx.arc(cx - 6, cy - 2, 6, 0, Math.PI, true);
    ctx.moveTo(cx, cy - 2);
    ctx.arc(cx + 6, cy - 2, 6, Math.PI, 0, false);
    ctx.stroke();
  }
  ctx.fillStyle = '#1d3557';
  ctx.fillRect(0, top - 4, w, 4);
  ctx.fillRect(0, top + bandH, w, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pale fur with dark rosettes for the snow leopard.
export function makeLeopardFur() {
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d4c7';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(31);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 3 + rnd() * 4;
    ctx.strokeStyle = 'rgba(60,58,55,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, rnd() * 2, rnd() * 2 + 4.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
