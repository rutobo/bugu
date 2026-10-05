// Builds the whole valley and keeps its living parts ticking.
import * as THREE from 'three';
import { Terrain, riverDistance, LAKE } from './terrain.js';
import { planWorld } from './placement.js';
import { buildTerrainMesh, buildBackdropPeaks } from './terrainMesh.js';
import { buildVegetation } from './vegetation.js';
import { Water } from './water.js';
import { Emitter, Fireflies } from './particles.js';
import { buildYurt, buildBridge, bridgeDeckHeight, buildBalbal, buildHotSpring, buildCairn } from './props.js';
import { Horse, Sheep, Marmot, Ibex, SnowLeopard, Eagle, Deer } from './animals.js';
import { Colliders } from '../core/colliders.js';
import { mulberry32 } from '../core/noise.js';

export class World {
  constructor(scene, audio) {
    this.scene = scene;
    this.terrain = new Terrain();
    this.plan = planWorld(this.terrain);
    this.colliders = new Colliders();
    const { sites } = this.plan;
    this.sites = sites;

    scene.add(buildTerrainMesh(this.terrain));
    scene.add(buildBackdropPeaks());
    this.water = new Water(scene);

    // Props first, so vegetation can avoid their colliders.
    scene.add(buildYurt(sites.yurt));
    this.colliders.add(sites.yurt.x, sites.yurt.z, 4.25, 'yurt');
    this.smoke = new Emitter(scene, {
      origin: new THREE.Vector3(sites.yurt.x, sites.yurt.y + 4.3, sites.yurt.z),
      count: 60,
      rate: 6,
      life: 8,
      size: [0.6, 4],
      alpha: 0.32,
      rise: 1.1,
      spread: 0.4,
      color: '#d8d8d8',
    });
    scene.add(buildBridge(sites.bridge));
    scene.add(buildBalbal(sites.balbal));
    this.colliders.add(sites.balbal.x, sites.balbal.z, 0.65, 'balbal');
    const spring = buildHotSpring(scene, sites.arashan);
    scene.add(spring.group);
    this.steam = spring.steam;
    this.cairn = buildCairn(sites.peak);
    scene.add(this.cairn.group);
    this.colliders.add(sites.peak.x, sites.peak.z, 0.9, 'cairn');

    buildVegetation(scene, this.terrain, this.plan, this.colliders);

    // Animals.
    const rnd = mulberry32(31337);
    this.animals = [];
    const y = sites.yurt;
    this.horse = new Horse(scene, this.terrain, y.x - 4.5, y.z + 8.5, Math.PI * 0.1);
    this.colliders.add(y.x - 4.5, y.z + 8.5, 0.9, 'horse');
    this.animals.push(this.horse);
    for (let i = 0; i < 8; i++) {
      this.animals.push(new Sheep(scene, this.terrain, { x: y.x + 12, z: y.z - 18 }, rnd));
    }
    this.marmots = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd();
      const r = 5 + rnd() * 12;
      const m = new Marmot(scene, this.terrain, sites.marmots.x + Math.cos(a) * r, sites.marmots.z + Math.sin(a) * r, rnd, audio);
      this.marmots.push(m);
      this.animals.push(m);
    }
    this.ibex = [];
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 2 + rnd() * 8;
      const ib = new Ibex(scene, this.terrain, sites.ibex.x + Math.cos(a) * r, sites.ibex.z + Math.sin(a) * r, rnd);
      this.ibex.push(ib);
      this.animals.push(ib);
    }
    this.leopard = new SnowLeopard(scene, this.terrain, sites.irbis.x, sites.irbis.z);
    this.colliders.add(sites.irbis.x, sites.irbis.z, 1.7, 'rock');
    this.animals.push(this.leopard);
    this.eagle = new Eagle(scene, new THREE.Vector3(sites.peak.x, 0, sites.peak.z), sites.peak.y + 32);
    this.animals.push(this.eagle);
    this.deer = new Deer(scene, this.terrain, sites.bugu.x, sites.bugu.z, { mother: true });
    this.fawn = new Deer(scene, this.terrain, sites.bugu.x + 3, sites.bugu.z + 2, { mother: false });
    this.animals.push(this.deer, this.fawn);

    this.fireflies = new Fireflies(scene, this.terrain);
  }

  // Walkable surface: terrain, or the bridge deck where it is higher.
  groundHeight(x, z) {
    const h = this.terrain.getHeight(x, z);
    const b = this.sites.bridge;
    const dx = x - b.x;
    const dz = z - b.z;
    const c = Math.cos(b.angle);
    const s = Math.sin(b.angle);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) <= b.length / 2 && Math.abs(lz) <= b.width / 2 + 0.1) {
      return Math.max(h, bridgeDeckHeight(b, lx));
    }
    return h;
  }

  // Rough distance to running/standing water, for ambience.
  waterDistance(x, z) {
    const river = Math.max(0, riverDistance(x, z) - 4);
    const lake = Math.max(0, Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r * 0.7);
    return Math.min(river, lake);
  }

  update(dt, time, player, night) {
    this.water.update(dt, night);
    this.smoke.update(dt);
    this.steam.update(dt);
    this.cairn.update(time);
    for (const a of this.animals) {
      // Only animate animals that are reasonably close.
      const g = a.a?.group ?? a.group;
      if (g && a !== this.eagle && g.position.distanceToSquared(player) > 250 * 250) continue;
      a.update(dt, time, player);
    }
    this.fireflies.update(time, player, night);
  }
}
