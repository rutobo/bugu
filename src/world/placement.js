// Decides where everything goes: the yurt, landmarks, wildlife and the
// collectibles. Hand-placed sites sit in the valley; the rest are found by
// searching the terrain so every one of them is reachable on foot.
// Pure data, no three.js.

import { mulberry32 } from '../core/noise.js';
import { riverX, riverDistance, forestDensity, LAKE, WORLD } from './terrain.js';

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function chooseSite(terrain, rnd, taken, { minSpacing = 90, filter, score, stride = 2 }) {
  let best = null;
  let bestScore = -Infinity;
  for (let j = 0; j <= terrain.segments; j += stride) {
    for (let i = 0; i <= terrain.segments; i += stride) {
      if (!terrain.reachable[j * terrain.n + i]) continue;
      const x = terrain.xAt(i);
      const z = terrain.zAt(j);
      const h = terrain.heights[j * terrain.n + i];
      const p = { x, z, h, slope: terrain.getSlope(x, z), d: riverDistance(x, z), r: Math.hypot(x, z) };
      if (p.r > WORLD.walkRadius - 25) continue;
      if (taken.some((t) => dist(t, p) < minSpacing)) continue;
      if (!filter(p)) continue;
      const s = score(p) + rnd() * 0.5;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
  }
  if (!best) throw new Error('No site found');
  return { x: best.x, z: best.z };
}

export function planWorld(terrain) {
  const rnd = mulberry32(2024);
  const sites = {};

  // Grandmother's yurt on the meadow east of the river; the door faces west.
  {
    const z = 40;
    const x = riverX(z) + 30;
    const y = terrain.flatten(x, z, 10, terrain.getHeight(x, z) + 0.2, 8);
    sites.yurt = { x, z, y };
  }
  // A plank bridge where the river bends.
  {
    const z = 108;
    const x = riverX(z);
    const slopeDx = riverX(z + 1) - riverX(z - 1);
    const angle = Math.atan2(slopeDx, 2); // rotation so the deck spans across the river
    sites.bridge = { x, z, angle, length: 22, width: 2.6, deck: 3.9 };
  }
  // An ancient balbal statue on the western meadow.
  {
    const z = -105;
    const x = riverX(z) - 44;
    const y = terrain.flatten(x, z, 6, terrain.getHeight(x, z), 6);
    sites.balbal = { x, z, y };
  }
  sites.lake = { x: LAKE.x, z: LAKE.z };

  const start = { x: sites.yurt.x - 11, z: sites.yurt.z + 4 };
  sites.start = start;

  terrain.computeReachable(start.x, start.z);

  // The lookout cairn goes on a high summit you can walk to, one that stands
  // above its surroundings rather than sitting at the head of a gully.
  let maxH = 0;
  for (let k = 0; k < terrain.reachable.length; k++) {
    if (terrain.reachable[k]) maxH = Math.max(maxH, terrain.heights[k]);
  }
  let peak = null;
  let peakScore = -Infinity;
  for (let j = 0; j <= terrain.segments; j += 2) {
    for (let i = 0; i <= terrain.segments; i += 2) {
      const k = j * terrain.n + i;
      const h = terrain.heights[k];
      if (!terrain.reachable[k] || h < maxH * 0.6) continue;
      const x = terrain.xAt(i);
      const z = terrain.zAt(j);
      if (Math.hypot(x, z) > WORLD.walkRadius - 30) continue;
      let around = -Infinity;
      for (const r of [15, 30, 50]) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          around = Math.max(around, terrain.getHeight(x + Math.cos(ang) * r, z + Math.sin(ang) * r));
        }
      }
      const score = h - 2 * Math.max(0, around - h);
      if (score > peakScore) {
        peakScore = score;
        peak = { x, z, h };
      }
    }
  }
  const peakH = peak.h;
  sites.peak = { x: peak.x, z: peak.z };

  const taken = [sites.yurt, sites.bridge, sites.balbal, sites.lake, sites.peak];

  sites.irbis = chooseSite(terrain, rnd, taken, {
    minSpacing: 110,
    filter: (p) => p.h > peakH * 0.62 && p.slope > 0.35 && p.slope < 0.75 && dist(p, start) > 220,
    score: (p) => p.h / peakH + p.slope * 0.5,
  });
  taken.push(sites.irbis);

  sites.ibex = chooseSite(terrain, rnd, taken, {
    minSpacing: 110,
    filter: (p) => p.h > peakH * 0.5 && p.slope > 0.4 && p.slope < 0.8,
    score: (p) => p.slope + p.h / peakH * 0.3,
  });
  taken.push(sites.ibex);

  sites.marmots = chooseSite(terrain, rnd, taken, {
    minSpacing: 100,
    filter: (p) => p.h > 50 && p.h < peakH * 0.8 && p.slope < 0.22,
    score: (p) => -p.slope * 3 + p.h / 100,
  });
  taken.push(sites.marmots);

  sites.arashan = chooseSite(terrain, rnd, taken, {
    minSpacing: 120,
    filter: (p) => p.h > 18 && p.h < 50 && p.slope < 0.35 && dist(p, start) > 150 && p.z > 80, // south, to spread things out
    score: (p) => -p.slope * 2 + forestDensity(p.x, p.z),
  });
  taken.push(sites.arashan);

  sites.bugu = chooseSite(terrain, rnd, taken, {
    minSpacing: 120,
    filter: (p) =>
      p.h > 10 && p.h < 60 && p.slope < 0.3 && forestDensity(p.x, p.z) > 0.18 && dist(p, start) > 130 && p.z > 0,
    score: (p) => forestDensity(p.x, p.z) * 3 - p.slope,
  });
  taken.push(sites.bugu);

  // Gentle pads so props sit nicely.
  sites.peak.y = terrain.flatten(sites.peak.x, sites.peak.z, 2.5, peakH, 3);
  sites.marmots.y = terrain.flatten(sites.marmots.x, sites.marmots.z, 12, undefined, 10);
  sites.arashan.y = terrain.flatten(sites.arashan.x, sites.arashan.z, 6, undefined, 6);
  sites.bugu.y = terrain.flatten(sites.bugu.x, sites.bugu.z, 10, undefined, 10);
  sites.irbis.y = terrain.getHeight(sites.irbis.x, sites.irbis.z);
  sites.ibex.y = terrain.getHeight(sites.ibex.x, sites.ibex.z);
  terrain.computeReachable(start.x, start.z);

  // Edelweiss grows high up.
  const edelweiss = [];
  for (let tries = 0; tries < 20000 && edelweiss.length < 10; tries++) {
    const x = (rnd() - 0.5) * 2 * WORLD.walkRadius;
    const z = (rnd() - 0.5) * 2 * WORLD.walkRadius;
    if (Math.hypot(x, z) > WORLD.walkRadius - 20 || !terrain.isReachable(x, z)) continue;
    const h = terrain.getHeight(x, z);
    if (h < peakH * 0.5 || terrain.getSlope(x, z) > 0.75) continue;
    if (edelweiss.some((e) => dist(e, { x, z }) < 45)) continue;
    if (taken.some((t) => dist(t, { x, z }) < 12)) continue;
    edelweiss.push({ x, z });
  }

  // Wild apple trees (Malus sieversii) on the lower slopes.
  const appleTrees = [];
  for (let tries = 0; tries < 40000 && appleTrees.length < 55; tries++) {
    const x = (rnd() - 0.5) * 2 * (WORLD.walkRadius - 30);
    const z = (rnd() - 0.5) * 2 * (WORLD.walkRadius - 30);
    const d = riverDistance(x, z);
    if (d < 22 || d > 160 || !terrain.isReachable(x, z)) continue;
    const h = terrain.getHeight(x, z);
    if (h < 2 || h > 40 || terrain.getSlope(x, z) > 0.5) continue;
    if (appleTrees.some((a) => dist(a, { x, z }) < 7)) continue;
    if (taken.some((t) => dist(t, { x, z }) < 25)) continue;
    // Cluster into groves.
    const grove = Math.sin(x * 0.02 + 1.7) * Math.cos(z * 0.017 - 0.6);
    if (grove < 0.15 && appleTrees.length > 0 && rnd() > 0.15) continue;
    appleTrees.push({ x, z, s: 0.85 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
  }

  const apples = [];
  const shuffled = appleTrees.slice().sort(() => rnd() - 0.5);
  for (const t of shuffled) {
    if (apples.length >= 25) break;
    const a = rnd() * Math.PI * 2;
    const r = 1.6 + rnd() * 1.2;
    const x = t.x + Math.cos(a) * r;
    const z = t.z + Math.sin(a) * r;
    if (!terrain.isReachable(x, z)) continue;
    apples.push({ x, z });
  }

  return { sites, edelweiss, appleTrees, apples, peakH };
}
