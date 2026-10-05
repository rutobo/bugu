// Hand-built landmarks: the yurt, the plank bridge, a balbal statue, the
// Arashan hot spring, the lookout cairn, marmot burrows and collectibles.
import * as THREE from 'three';
import { makeYurtFelt } from '../core/textures.js';
import { mulberry32 } from '../core/noise.js';
import { Emitter } from './particles.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function mesh(geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function buildYurt(site) {
  const g = new THREE.Group();
  const felt = makeYurtFelt();
  felt.repeat.set(3, 1);
  const wall = mesh(
    new THREE.CylinderGeometry(4, 4, 2.1, 28, 1, true),
    new THREE.MeshLambertMaterial({ map: felt, side: THREE.DoubleSide }),
    0,
    1.05,
    0
  );
  g.add(wall);
  const roofPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    roofPts.push(new THREE.Vector2(4.15 - t * 3.2, 2.05 + Math.sin(t * Math.PI * 0.5) * 2.0));
  }
  const roof = mesh(new THREE.LatheGeometry(roofPts, 28), lambert('#ddd3c1', { side: THREE.DoubleSide }));
  g.add(roof);
  // Decorative band where roof meets wall.
  g.add(mesh(new THREE.TorusGeometry(4.12, 0.09, 4, 32).rotateX(Math.PI / 2), lambert('#1d3557'), 0, 2.08, 0));
  // Tunduk (the crown) with its crossed bars.
  const wood = lambert('#7a4b2a');
  g.add(mesh(new THREE.TorusGeometry(0.95, 0.1, 5, 20).rotateX(Math.PI / 2), wood, 0, 4.05, 0));
  for (let k = 0; k < 3; k++) {
    const bar = mesh(new THREE.BoxGeometry(1.9, 0.08, 0.08), wood, 0, 4.12, (k - 1) * 0.42);
    g.add(bar);
    const bar2 = mesh(new THREE.BoxGeometry(0.08, 0.08, 1.9), wood, (k - 1) * 0.42, 4.15, 0);
    g.add(bar2);
  }
  // Ropes binding the felt.
  for (const y of [0.55, 1.6]) {
    g.add(mesh(new THREE.TorusGeometry(4.03, 0.035, 3, 40).rotateX(Math.PI / 2), lambert('#8a6a43'), 0, y, 0));
  }
  // Carved door on +z (the whole yurt is rotated to face the river).
  const door = new THREE.Group();
  door.add(mesh(new THREE.BoxGeometry(1.25, 1.75, 0.12), lambert('#b5432b'), 0, 0.88, 0));
  door.add(mesh(new THREE.BoxGeometry(1.45, 0.12, 0.16), wood, 0, 1.8, 0));
  door.add(mesh(new THREE.BoxGeometry(0.12, 1.85, 0.16), wood, -0.68, 0.92, 0));
  door.add(mesh(new THREE.BoxGeometry(0.12, 1.85, 0.16), wood, 0.68, 0.92, 0));
  door.add(mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 12), lambert('#f3d8a2'), 0, 1.1, 0.07));
  door.position.set(0, 0, 3.98);
  g.add(door);
  // Woodpile and a hitching post outside.
  const logs = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 6).rotateX(Math.PI / 2), lambert('#8b5e3c'));
    log.position.set((i % 3) * 0.28 - 0.28, 0.13 + Math.floor(i / 3) * 0.24, 0);
    logs.add(log);
  }
  logs.position.set(3.6, 0, 3.2);
  logs.rotation.y = 0.6;
  g.add(logs);
  const post = mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), wood, -4.5, 0.8, 6.5);
  g.add(post);
  g.add(mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), wood, -4.5, 1.4, 6.5));
  // A shyrdak felt rug before the door.
  const rug = mesh(new THREE.CircleGeometry(1.2, 6).rotateX(-Math.PI / 2), lambert('#c1272d'), 0, 0.03, 5.6, { cast: false });
  g.add(rug);
  g.add(mesh(new THREE.CircleGeometry(0.7, 6).rotateX(-Math.PI / 2), lambert('#1d3557'), 0, 0.04, 5.6, { cast: false }));

  g.position.set(site.x, site.y, site.z);
  g.rotation.y = -Math.PI / 2; // door faces west, toward the river
  return g;
}

export function buildBridge(site) {
  const g = new THREE.Group();
  const plankMat = lambert('#8a6440');
  const darkWood = lambert('#5b3d27');
  const L = site.length;
  for (let x = -L / 2; x <= L / 2; x += 0.55) {
    const y = bridgeDeckHeight(site, x);
    const plank = mesh(new THREE.BoxGeometry(0.48, 0.12, site.width), plankMat, x, y - 0.06, 0);
    plank.rotation.z = (Math.random() - 0.5) * 0.04;
    g.add(plank);
  }
  for (const side of [-1, 1]) {
    // Beams under the deck.
    const beam = mesh(new THREE.CylinderGeometry(0.16, 0.16, L, 6).rotateZ(Math.PI / 2), darkWood, 0, site.deck - 0.3, side * site.width * 0.35);
    g.add(beam);
    // Posts and rope rails.
    for (const px of [-L / 2 + 1, -L / 4, 0, L / 4, L / 2 - 1]) {
      const py = bridgeDeckHeight(site, px);
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 5), darkWood, px, py + 0.5, side * (site.width / 2 + 0.05)));
    }
    const rail = mesh(new THREE.CylinderGeometry(0.03, 0.03, L - 2, 4).rotateZ(Math.PI / 2), lambert('#c2a878'), 0, site.deck + 0.95, side * (site.width / 2 + 0.05));
    g.add(rail);
  }
  // Stone piers in the water.
  for (const px of [-4, 4]) {
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 7), lambert('#777068'), px, site.deck - 2.9, 0));
  }
  g.position.set(site.x, 0, site.z);
  g.rotation.y = site.angle;
  return g;
}

// Deck height along the bridge (local x), arched slightly, ramping down at the ends.
export function bridgeDeckHeight(site, lx) {
  const L = site.length;
  const arch = Math.cos((lx / L) * Math.PI) * 0.35;
  const ramp = Math.max(0, Math.abs(lx) - (L / 2 - 4)) * 0.28;
  return site.deck + arch - ramp;
}

export function buildBalbal(site) {
  const g = new THREE.Group();
  const stone = lambert('#8d8a82');
  const darkStone = lambert('#5d5a55');
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.7, 7), stone, 0, 0.85, 0));
  const head = mesh(new THREE.DodecahedronGeometry(0.42, 0), stone, 0, 1.95, 0);
  head.scale.set(1, 1.2, 0.95);
  g.add(head);
  // Carved face: brows, eyes, moustache; hands holding a cup.
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.05, 0.06), darkStone, 0, 2.08, 0.36));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), darkStone, -0.12, 2.0, 0.38));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), darkStone, 0.12, 2.0, 0.38));
  const moustache = mesh(new THREE.TorusGeometry(0.14, 0.025, 3, 10, Math.PI), darkStone, 0, 1.78, 0.37);
  moustache.rotation.z = Math.PI;
  g.add(moustache);
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), darkStone, 0, 1.25, 0.45));
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.18, 6), darkStone, 0.05, 1.37, 0.5));
  // A ring of stones around the kurgan.
  const rnd = mulberry32(17);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = mesh(new THREE.DodecahedronGeometry(0.3 + rnd() * 0.2, 0), stone, Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2);
    r.scale.y = 0.6;
    g.add(r);
  }
  g.position.set(site.x, site.y, site.z);
  g.rotation.y = Math.PI / 2; // gazing east across the valley at the rising sun
  return g;
}

export function buildHotSpring(scene, site) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x5fc6c0, roughness: 0.1, emissive: 0x0e3b3a, transparent: true, opacity: 0.88 })
  );
  water.position.y = 0.12;
  water.receiveShadow = true;
  g.add(water);
  g.add(mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2), lambert('#c9b98a'), 0, 0.05, 0, { cast: false }));
  const rnd = mulberry32(4);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = mesh(new THREE.DodecahedronGeometry(0.45 + rnd() * 0.3, 0), lambert('#8b857b'), Math.cos(a) * 3.4, 0.15, Math.sin(a) * 3.4);
    r.scale.y = 0.55;
    g.add(r);
  }
  // A little wooden bench for soaking feet.
  g.add(mesh(new THREE.BoxGeometry(2, 0.1, 0.5), lambert('#7a4b2a'), 0, 0.55, 4.6));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.4), lambert('#5b3d27'), -0.8, 0.25, 4.6));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.4), lambert('#5b3d27'), 0.8, 0.25, 4.6));
  g.position.set(site.x, site.y, site.z);
  const steam = new Emitter(scene, {
    origin: new THREE.Vector3(site.x, site.y + 0.3, site.z),
    count: 70,
    rate: 10,
    life: 5,
    size: [1.5, 5],
    alpha: 0.28,
    rise: 0.8,
    spread: 4.5,
    color: '#ffffff',
  });
  return { group: g, steam };
}

export function buildCairn(site) {
  const g = new THREE.Group();
  const stone = lambert('#8a8578');
  let y = 0;
  const sizes = [0.9, 0.75, 0.6, 0.48, 0.36, 0.25];
  sizes.forEach((s, i) => {
    const r = mesh(new THREE.DodecahedronGeometry(s, 0), stone, (i % 2 ? 0.08 : -0.06), y + s * 0.55, 0);
    r.scale.y = 0.62;
    r.rotation.y = i;
    g.add(r);
    y += s * 0.75;
  });
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 5), lambert('#6b4a2e'), 0, y + 1.3, 0);
  g.add(pole);
  // Ribbons tied to the pole, like at a mazar.
  const ribbons = [];
  const colors = ['#e63946', '#f1faee', '#457b9d', '#ffb703', '#2a9d8f', '#e76f51'];
  colors.forEach((c, i) => {
    const geo = new THREE.PlaneGeometry(0.9, 0.12, 6, 1).translate(0.45, 0, 0);
    const rib = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    rib.position.set(0, y + 1.6 + i * 0.22, 0);
    rib.rotation.y = i * 1.1;
    rib.userData.base = geo.attributes.position.array.slice();
    rib.userData.phase = i * 0.9;
    rib.castShadow = true;
    g.add(rib);
    ribbons.push(rib);
  });
  g.position.set(site.x, site.y - 0.1, site.z);
  return {
    group: g,
    update(time) {
      for (const r of ribbons) {
        const pos = r.geometry.attributes.position;
        const base = r.userData.base;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3];
          pos.setY(i, base[i * 3 + 1] + Math.sin(time * 6 + x * 5 + r.userData.phase) * 0.06 * x - x * 0.15);
          pos.setZ(i, Math.sin(time * 4 + x * 3 + r.userData.phase) * 0.1 * x);
        }
        pos.needsUpdate = true;
      }
    },
  };
}

export function buildBurrow() {
  const g = new THREE.Group();
  const mound = mesh(new THREE.SphereGeometry(0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lambert('#8a7352'), 0, -0.25, 0);
  mound.scale.y = 0.5;
  g.add(mound);
  g.add(mesh(new THREE.CircleGeometry(0.3, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a120c }), 0, 0.17, 0, { cast: false }));
  return g;
}

// ---- Collectibles ----------------------------------------------------------

export function buildAppleCollectible() {
  const g = new THREE.Group();
  const apple = mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.35, emissive: 0x3a0505 }));
  apple.scale.y = 0.9;
  g.add(apple);
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.1, 4), lambert('#4a3020'), 0, 0.18, 0));
  const leaf = mesh(new THREE.SphereGeometry(0.06, 5, 3), lambert('#4f8a32'), 0.06, 0.21, 0);
  leaf.scale.set(1.4, 0.3, 0.7);
  g.add(leaf);
  return g;
}

export function buildEdelweiss() {
  const g = new THREE.Group();
  const petal = new THREE.MeshStandardMaterial({ color: 0xf6f6ee, roughness: 0.9, emissive: 0x333330, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const p = mesh(new THREE.ConeGeometry(0.05, 0.22, 4).rotateZ(-Math.PI / 2).translate(0.11, 0, 0), petal);
    p.rotation.y = a;
    p.rotation.z = 0.15;
    g.add(p);
  }
  g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), lambert('#e8d36a'), 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.3, 4), lambert('#7f9a6a'), 0, -0.15, 0));
  return g;
}
