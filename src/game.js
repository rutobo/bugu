// Goals: places to discover, wild apples and edelweiss to gather.
import * as THREE from 'three';
import { LAKE } from './world/terrain.js';
import { buildAppleCollectible, buildEdelweiss } from './world/props.js';
import { makeSoftSprite } from './core/textures.js';

const SAVE_KEY = 'bugu-save-v1';

const DISCOVERIES = [
  {
    id: 'yurt',
    name: "Grandmother's Yurt",
    icon: '🏠',
    text: 'Your grandmother’s boz üy stands on the summer pasture by the river. Smoke curls from the tunduk, the wooden crown pictured on the flag of Kyrgyzstan.',
    hint: 'Home. Grandmother is frying boorsok inside.',
  },
  {
    id: 'bridge',
    name: "Shepherd's Bridge",
    icon: '🌉',
    text: 'Shepherds built this plank bridge to drive their flocks across the river to the far meadows.',
    hint: 'Follow the river downstream, to the {dir}.',
  },
  {
    id: 'balbal',
    name: 'The Balbal Stone',
    icon: '🗿',
    text: 'An ancient Turkic stone warrior, carved more than a thousand years ago. He holds a cup and gazes east, toward the rising sun.',
    hint: 'A stone man keeps watch over a meadow across the river, to the {dir}.',
  },
  {
    id: 'lake',
    name: 'Spruce Lake',
    icon: '🏞️',
    text: 'A mirror-still lake ringed by Tien Shan spruce, like the Kolsay lakes. The water is icy and very deep. Don’t swim!',
    hint: 'The river is born from a lake at the {dir} end of the valley.',
  },
  {
    id: 'arashan',
    name: 'Arashan Hot Spring',
    icon: '♨️',
    text: 'Hot water bubbles up from deep inside the mountain. Travellers have soaked their tired feet in arashan springs for centuries.',
    hint: 'Steam rises from somewhere on the slopes to the {dir}.',
  },
  {
    id: 'marmots',
    name: 'Marmot Meadow',
    icon: '🐿️',
    text: 'Grey marmots whistle a warning and dive into their burrows. They sleep through the whole long mountain winter.',
    hint: 'Listen for whistling on a high, flat pasture to the {dir}.',
  },
  {
    id: 'ibex',
    name: 'Ibex Crags',
    icon: '🐐',
    text: 'Siberian ibex leap across the cliffs as if it were nothing, their horns swept back like sabres.',
    hint: 'Ibex graze on steep crags to the {dir}.',
  },
  {
    id: 'irbis',
    name: 'The Snow Leopard',
    icon: '🐆',
    text: 'An irbis! The ghost of the mountains. Few people ever see one. It watched you for a moment, then melted away into the rocks.',
    hint: 'Grandfather once saw an irbis high up on the rocks to the {dir}. Move quietly…',
  },
  {
    id: 'peak',
    name: "Eagle's Lookout",
    icon: '🦅',
    text: 'From the highest point in the valley you can see everything: the forest, the river and the white peaks beyond. A golden eagle circles overhead, the kind the berkutchi hunters train.',
    hint: 'Climb the highest place you can reach, to the {dir}. An eagle circles there.',
  },
  {
    id: 'bugu',
    name: 'Bugu, the Mother Deer',
    icon: '🦌',
    text: 'In a hidden glade stands a maral with great antlers. The legend says the Horned Mother Deer, Bugu-Ene, led the ancestors of the Kyrgyz to Issyk-Kul. She looks at you kindly and returns to her fawn.',
    hint: 'The Mother Deer lives deep in the spruce forest to the {dir}.',
  },
];

const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function compass(dx, dz) {
  const a = Math.atan2(dx, -dz); // 0 = north (−z), π/2 = east (+x)
  const i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return DIRS[i];
}

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || null;
  } catch {
    return null;
  }
}

export function hasSave() {
  const s = loadSave();
  return !!(s && (s.found?.length > 1 || s.apples?.length || s.edelweiss?.length));
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class Game {
  constructor(scene, world, hud, audio) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;
    this.audio = audio;
    this.elapsed = 0;
    this.ended = false;
    const { sites, apples, edelweiss } = world.plan;
    const home = sites.yurt;

    this.discoveries = DISCOVERIES.map((d) => {
      const s = d.id === 'lake' ? { x: LAKE.x, z: LAKE.z } : sites[d.id];
      return { ...d, x: s.x, z: s.z, found: false, dir: compass(s.x - home.x, s.z - home.z) };
    });

    const glow = makeSoftSprite();
    const makeItems = (list, build, color, kind) =>
      list.map((p, i) => {
        const g = build();
        const y = world.groundHeight(p.x, p.z);
        g.position.set(p.x, y + 0.45, p.z);
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        sprite.scale.setScalar(1.1);
        g.add(sprite);
        scene.add(g);
        return { kind, index: i, group: g, baseY: y + 0.45, taken: false, sprite };
      });
    this.apples = makeItems(apples, buildAppleCollectible, 0xffc070, 'apple');
    this.edelweiss = makeItems(edelweiss, buildEdelweiss, 0xffffff, 'edelweiss');

    this.restore();
    this.updateCounts();
  }

  hintFor = (d) => d.hint.replace('{dir}', d.dir);

  restore() {
    const s = loadSave();
    if (!s) return;
    for (const d of this.discoveries) if (s.found?.includes(d.id)) d.found = true;
    for (const i of s.apples ?? []) this.take(this.apples[i], true);
    for (const i of s.edelweiss ?? []) this.take(this.edelweiss[i], true);
    this.elapsed = s.elapsed ?? 0;
    this.ended = !!s.ended;
  }

  save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          found: this.discoveries.filter((d) => d.found).map((d) => d.id),
          apples: this.apples.filter((a) => a.taken).map((a) => a.index),
          edelweiss: this.edelweiss.filter((a) => a.taken).map((a) => a.index),
          elapsed: Math.round(this.elapsed),
          ended: this.ended,
        })
      );
    } catch {
      /* storage unavailable */
    }
  }

  take(item, silent = false) {
    if (!item || item.taken) return;
    item.taken = true;
    if (silent) item.group.visible = false;
    else item.pickupT = 0;
  }

  stats() {
    return {
      apples: this.apples.filter((a) => a.taken).length,
      applesTotal: this.apples.length,
      edelweiss: this.edelweiss.filter((a) => a.taken).length,
      edelweissTotal: this.edelweiss.length,
      found: this.discoveries.filter((d) => d.found).length,
      foundTotal: this.discoveries.length,
      seconds: this.elapsed,
    };
  }

  updateCounts() {
    this.hud.setCounts(this.stats());
  }

  discover(id) {
    const d = this.discoveries.find((x) => x.id === id);
    if (!d || d.found) return;
    d.found = true;
    this.audio.discover();
    this.hud.toast(d.name, d.text, { icon: d.icon, big: true, duration: 10 });
    this.updateCounts();
    this.save();
    const s = this.stats();
    if (s.found === s.foundTotal && !this.ended) {
      this.ended = true;
      this.save();
      setTimeout(() => {
        this.audio.fanfare();
        this.hud.showEnding(this.stats());
      }, 4000);
    }
  }

  isFound(id) {
    return this.discoveries.find((x) => x.id === id).found;
  }

  update(dt, time, player) {
    this.elapsed += dt;
    const w = this.world;
    const near = (p, r) => Math.hypot(player.x - p.x, player.z - p.z) < r;

    if (!this.isFound('yurt') && near(w.sites.yurt, 14)) this.discover('yurt');
    if (!this.isFound('bridge') && near(w.sites.bridge, 10)) this.discover('bridge');
    if (!this.isFound('balbal') && near(w.sites.balbal, 9)) this.discover('balbal');
    if (!this.isFound('lake') && near(LAKE, LAKE.r + 16)) this.discover('lake');
    if (!this.isFound('arashan') && near(w.sites.arashan, 10)) this.discover('arashan');
    if (!this.isFound('marmots') && near(w.sites.marmots, 24)) this.discover('marmots');
    if (!this.isFound('ibex') && w.ibex.some((ib) => near(ib.a.group.position, 24))) this.discover('ibex');
    if (!this.isFound('irbis') && w.leopard.a.group.visible && w.leopard.state !== 'resting' && near(w.leopard.a.group.position, 34)) {
      this.discover('irbis');
    }
    if (!this.isFound('peak') && near(w.sites.peak, 7)) this.discover('peak');
    if (!this.isFound('bugu') && near(w.deer.a.group.position, 18)) this.discover('bugu');

    const items = [...this.apples, ...this.edelweiss];
    for (const it of items) {
      if (!it.group.visible) continue;
      const g = it.group;
      if (it.taken) {
        // Fly up and shrink after pickup.
        it.pickupT += dt;
        g.position.y += dt * 3;
        g.scale.setScalar(Math.max(0.01, 1 - it.pickupT * 1.5));
        if (it.pickupT > 0.7) g.visible = false;
        continue;
      }
      const dx = player.x - g.position.x;
      const dz = player.z - g.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 90 * 90) continue;
      g.rotation.y += dt * 1.2;
      g.position.y = it.baseY + Math.sin(time * 2 + it.index) * 0.08;
      it.sprite.material.opacity = 0.35 + Math.sin(time * 3 + it.index) * 0.2;
      if (d2 < 1.5 * 1.5 && Math.abs(player.y + 0.6 - g.position.y) < 1.8) this.collect(it);
    }
  }

  collect(it) {
    this.take(it);
    this.audio.collect();
    const s = this.stats();
    if (it.kind === 'apple') {
      if (s.apples === 1) {
        this.hud.toast('A wild apple!', 'The wild apple forests of the Tien Shan are where every apple in the world came from. Grandmother will bake with these.', { icon: '🍎', duration: 9 });
      } else if (s.apples === s.applesTotal) {
        this.hud.toast('Every apple found!', 'Enough for a whole pot of apple jam.', { icon: '🍎', duration: 7 });
      } else {
        this.hud.toast(`Wild apple ${s.apples}/${s.applesTotal}`, '', { icon: '🍎', duration: 2.5 });
      }
    } else if (s.edelweiss === 1) {
      this.hud.toast('Edelweiss!', 'This woolly white star only grows high in the mountains. Look for more on the high slopes.', { icon: '🌼', duration: 9 });
    } else if (s.edelweiss === s.edelweissTotal) {
      this.hud.toast('A full bouquet!', 'All the edelweiss for Grandmother.', { icon: '🌼', duration: 7 });
    } else {
      this.hud.toast(`Edelweiss ${s.edelweiss}/${s.edelweissTotal}`, '', { icon: '🌼', duration: 2.5 });
    }
    this.updateCounts();
    this.save();
  }
}
