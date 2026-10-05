// Low-poly wildlife and livestock with simple behaviours.
import * as THREE from 'three';
import { makeLeopardFur } from '../core/textures.js';
import { buildBurrow } from './props.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Generic four-legged animal facing +z with its origin on the ground.
function quadruped(o) {
  const g = new THREE.Group();
  const mat = o.material ?? lambert(o.color);
  const legMat = o.legMaterial ?? (o.legColor ? lambert(o.legColor) : mat);
  const hip = o.legLen + o.bodyR * 0.25;
  const body = mesh(new THREE.CapsuleGeometry(o.bodyR, o.bodyLen, 4, 8).rotateX(Math.PI / 2), mat, 0, hip + o.bodyR * 0.45, 0);
  body.scale.x = o.bodyWidth ?? 0.85;
  g.add(body);

  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * o.bodyR * 0.55, hip + 0.05, sz * o.bodyLen * 0.45);
    const leg = mesh(new THREE.CylinderGeometry(o.legR, o.legR * 0.75, o.legLen + 0.05, 5), legMat, 0, -(o.legLen + 0.05) / 2, 0);
    pivot.add(leg);
    if (o.hoof) pivot.add(mesh(new THREE.CylinderGeometry(o.legR * 0.8, o.legR * 0.9, 0.08, 5), lambert(o.hoof), 0, -o.legLen, 0));
    g.add(pivot);
    legs.push(pivot);
  }

  const neck = new THREE.Group();
  neck.position.set(0, hip + o.bodyR * 0.9, o.bodyLen / 2 + o.bodyR * 0.35);
  const a = o.neckAngle ?? 0.6;
  const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
  const neckMesh = mesh(new THREE.CylinderGeometry(o.neckR * 0.8, o.neckR, o.neckLen, 6), mat);
  neckMesh.rotation.x = a;
  neckMesh.position.copy(dir).multiplyScalar(o.neckLen / 2);
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.copy(dir).multiplyScalar(o.neckLen);
  const skull = mesh(new THREE.BoxGeometry(o.headW, o.headH, o.headLen), o.headMaterial ?? mat, 0, 0, o.headLen * 0.35);
  skull.rotation.x = 0.35;
  head.add(skull);
  for (const sx of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(o.headW * 0.09, 4, 3), lambert('#111111'), sx * o.headW * 0.48, o.headH * 0.18, o.headLen * 0.35));
  }
  if (o.ears) {
    for (const sx of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(o.ears, o.ears * 2.6, 4), mat, sx * o.headW * 0.42, o.headH * 0.6, -o.headLen * 0.05);
      ear.rotation.z = -sx * 0.6;
      head.add(ear);
    }
  }
  neck.add(head);
  g.add(neck);

  const tail = new THREE.Group();
  tail.position.set(0, hip + o.bodyR * 0.8, -o.bodyLen / 2 - o.bodyR * 0.7);
  g.add(tail);

  return { group: g, legs, neck, head, tail, body, mat };
}

function animateLegs(a, phase, amount) {
  const s = Math.sin(phase) * amount;
  a.legs[0].rotation.x = s;
  a.legs[3].rotation.x = s;
  a.legs[1].rotation.x = -s;
  a.legs[2].rotation.x = -s;
}

function faceTowards(obj, dx, dz, dt, rate = 4) {
  const target = Math.atan2(dx, dz);
  let diff = target - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += diff * Math.min(1, dt * rate);
}

// --------------------------------------------------------------------------

export class Horse {
  constructor(scene, terrain, x, z, rotY) {
    this.a = quadruped({
      color: '#6b4226', legColor: '#4a2d18', hoof: '#222', bodyR: 0.48, bodyLen: 1.3, legLen: 0.95,
      legR: 0.08, neckR: 0.22, neckLen: 0.9, neckAngle: 0.55, headW: 0.26, headH: 0.32, headLen: 0.62, ears: 0.06,
    });
    const mane = mesh(new THREE.BoxGeometry(0.06, 0.9, 0.18), lambert('#1e140c'), 0, 0.45, -0.18);
    mane.rotation.x = 0.55;
    this.a.neck.add(mane);
    const tail = mesh(new THREE.CylinderGeometry(0.08, 0.03, 0.9, 5), lambert('#1e140c'), 0, -0.4, -0.05);
    this.a.tail.add(tail);
    this.a.tail.rotation.x = 0.35;
    // Saddle with a felt blanket.
    this.a.group.add(mesh(new THREE.BoxGeometry(0.75, 0.12, 0.7), lambert('#9b2226'), 0, 1.5, 0.05));
    this.a.group.add(mesh(new THREE.BoxGeometry(0.5, 0.16, 0.45), lambert('#3d2817'), 0, 1.6, 0.05));
    this.a.group.position.set(x, terrain.getHeight(x, z), z);
    this.a.group.rotation.y = rotY;
    scene.add(this.a.group);
  }

  update(dt, time) {
    this.a.tail.rotation.z = Math.sin(time * 1.3) * 0.3;
    const graze = Math.max(0, Math.sin(time * 0.25)) ;
    this.a.neck.rotation.x = graze * 1.1;
  }
}

export class Sheep {
  constructor(scene, terrain, home, rnd) {
    this.terrain = terrain;
    this.home = home;
    this.rnd = rnd;
    const wool = lambert('#ece6da');
    this.a = quadruped({
      material: wool, legColor: '#2b2420', bodyR: 0.36, bodyLen: 0.45, legLen: 0.38, legR: 0.045,
      neckR: 0.12, neckLen: 0.25, neckAngle: 1.1, headW: 0.2, headH: 0.22, headLen: 0.32,
      headMaterial: lambert('#2b2420'), ears: 0.05, bodyWidth: 1,
    });
    // Fluffy fleece bumps.
    for (let i = 0; i < 5; i++) {
      this.a.body.add(mesh(new THREE.DodecahedronGeometry(0.22, 0), wool, (i % 2 - 0.5) * 0.3, 0.15, (i - 2) * 0.16));
    }
    this.target = new THREE.Vector3();
    this.pickTarget();
    this.a.group.position.set(this.target.x, 0, this.target.z);
    this.pause = rnd() * 4;
    this.phase = rnd() * 10;
    scene.add(this.a.group);
  }

  pickTarget() {
    const a = this.rnd() * Math.PI * 2;
    const r = 6 + this.rnd() * 22;
    this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
  }

  update(dt, time) {
    const g = this.a.group;
    const dx = this.target.x - g.position.x;
    const dz = this.target.z - g.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (this.pause > 0) {
      this.pause -= dt;
      this.a.neck.rotation.x = 0.9 + Math.sin(time * 3 + this.phase) * 0.1; // grazing
    } else if (d < 0.5) {
      this.pause = 3 + this.rnd() * 8;
      this.pickTarget();
    } else {
      moving = true;
      const sp = 0.7;
      g.position.x += (dx / d) * sp * dt;
      g.position.z += (dz / d) * sp * dt;
      faceTowards(g, dx, dz, dt, 2);
      this.a.neck.rotation.x *= 1 - Math.min(1, dt * 3);
    }
    this.phase += dt * (moving ? 7 : 0);
    animateLegs(this.a, this.phase, moving ? 0.45 : 0);
    g.position.y = this.terrain.getHeight(g.position.x, g.position.z);
  }
}

export class Marmot {
  constructor(scene, terrain, x, z, rnd, audio) {
    this.terrain = terrain;
    this.audio = audio;
    this.rnd = rnd;
    const g = new THREE.Group();
    const fur = lambert('#b07d45');
    this.body = new THREE.Group();
    this.body.add(mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 8), fur, 0, 0.32, 0));
    this.body.add(mesh(new THREE.CapsuleGeometry(0.15, 0.12, 4, 8), lambert('#d8b07a'), 0, 0.3, 0.07));
    const head = mesh(new THREE.SphereGeometry(0.13, 8, 6), fur, 0, 0.66, 0.03);
    this.body.add(head);
    this.body.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), lambert('#3b2a1a'), 0, 0.63, 0.15));
    for (const sx of [-1, 1]) {
      this.body.add(mesh(new THREE.SphereGeometry(0.02, 4, 3), lambert('#111'), sx * 0.06, 0.7, 0.12));
      this.body.add(mesh(new THREE.SphereGeometry(0.035, 4, 3), fur, sx * 0.1, 0.76, 0));
      const paw = mesh(new THREE.CapsuleGeometry(0.03, 0.08, 2, 4), lambert('#5a3d22'), sx * 0.07, 0.45, 0.16);
      paw.rotation.x = 0.8;
      this.body.add(paw);
    }
    this.body.add(mesh(new THREE.CapsuleGeometry(0.05, 0.15, 2, 4), lambert('#5a3d22'), 0, 0.12, -0.2));
    g.add(this.body);
    const burrow = buildBurrow();
    g.add(burrow);
    g.position.set(x, terrain.getHeight(x, z), z);
    g.rotation.y = rnd() * Math.PI * 2;
    scene.add(g);
    this.group = g;
    this.state = 'out';
    this.timer = 0;
    this.offset = 0;
  }

  update(dt, time, player) {
    const g = this.group;
    const d = Math.hypot(player.x - g.position.x, player.z - g.position.z);
    this.timer -= dt;
    if (this.state === 'out') {
      // Look around; turn to face the boy when he's close.
      if (d < 22) faceTowards(g, player.x - g.position.x, player.z - g.position.z, dt, 3);
      else g.rotation.y += Math.sin(time * 0.7 + g.position.x) * dt * 0.5;
      this.body.rotation.x = Math.sin(time * 2 + g.position.z) * 0.05;
      if (d < 11) {
        this.state = 'hiding';
        if (d < 30) this.audio?.marmotWhistle();
      }
    } else if (this.state === 'hiding') {
      this.offset = Math.max(-0.9, this.offset - dt * 4);
      if (this.offset <= -0.9) {
        this.state = 'hidden';
        this.timer = 5 + this.rnd() * 6;
      }
    } else if (this.state === 'hidden') {
      if (this.timer <= 0 && d > 16) this.state = 'emerging';
    } else if (this.state === 'emerging') {
      this.offset = Math.min(0, this.offset + dt * 1.2);
      if (this.offset >= 0) this.state = 'out';
    }
    this.body.position.y = this.offset;
    this.body.visible = this.offset > -0.85;
  }
}

export class Ibex {
  constructor(scene, terrain, x, z, rnd) {
    this.terrain = terrain;
    this.rnd = rnd;
    this.home = new THREE.Vector2(x, z);
    this.a = quadruped({
      color: '#8c7558', legColor: '#6e5a42', hoof: '#2a2a2a', bodyR: 0.34, bodyLen: 0.75, legLen: 0.62,
      legR: 0.05, neckR: 0.14, neckLen: 0.42, neckAngle: 0.7, headW: 0.18, headH: 0.22, headLen: 0.38, ears: 0.04,
    });
    // Big backswept horns.
    const hornMat = lambert('#5b5042');
    for (const sx of [-1, 1]) {
      const horn = mesh(new THREE.TorusGeometry(0.42, 0.045, 4, 10, Math.PI * 1.05), hornMat);
      horn.rotation.y = Math.PI / 2;
      horn.position.set(sx * 0.07, 0.1, -0.35);
      horn.rotation.z = 0;
      this.a.head.add(horn);
    }
    this.a.head.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 4).rotateX(Math.PI), lambert('#3f342a'), 0, -0.2, 0.42));
    const tail = mesh(new THREE.ConeGeometry(0.05, 0.15, 4), lambert('#3f342a'), 0, 0, 0);
    this.a.tail.add(tail);
    this.a.group.position.set(x, terrain.getHeight(x, z), z);
    this.a.group.rotation.y = rnd() * Math.PI * 2;
    scene.add(this.a.group);
    this.vel = new THREE.Vector2();
    this.fleeing = 0;
    this.phase = rnd() * 10;
  }

  update(dt, time, player) {
    const g = this.a.group;
    const dx = g.position.x - player.x;
    const dz = g.position.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < 16 && this.fleeing <= 0) {
      this.fleeing = 2.5 + this.rnd();
      // Flee away from the player, drifting back toward the herd's crag.
      const hx = this.home.x - g.position.x;
      const hz = this.home.y - g.position.z;
      this.vel.set(dx / d + hx * 0.02, dz / d + hz * 0.02).normalize().multiplyScalar(5.5);
    }
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      const nx = g.position.x + this.vel.x * dt;
      const nz = g.position.z + this.vel.y * dt;
      if (Math.hypot(nx - this.home.x, nz - this.home.y) < 45) {
        g.position.x = nx;
        g.position.z = nz;
      } else {
        this.vel.multiplyScalar(-1);
      }
      faceTowards(g, this.vel.x, this.vel.y, dt, 8);
      this.phase += dt * 14;
      animateLegs(this.a, this.phase, 0.7);
      this.a.neck.rotation.x = -0.2;
    } else {
      animateLegs(this.a, 0, 0);
      const graze = Math.sin(time * 0.4 + this.home.x) > 0.2;
      this.a.neck.rotation.x += ((graze ? 1.0 : -0.1) - this.a.neck.rotation.x) * Math.min(1, dt * 2);
    }
    g.position.y = this.terrain.getHeight(g.position.x, g.position.z);
  }
}

export class SnowLeopard {
  constructor(scene, terrain, x, z) {
    this.terrain = terrain;
    this.home = new THREE.Vector3(x, terrain.getHeight(x, z), z);
    const fur = makeLeopardFur();
    fur.repeat.set(2, 2);
    const mat = new THREE.MeshLambertMaterial({ map: fur, transparent: true });
    this.mat = mat;
    this.a = quadruped({
      material: mat, bodyR: 0.27, bodyLen: 0.8, legLen: 0.42, legR: 0.07, neckR: 0.15, neckLen: 0.28,
      neckAngle: 1.0, headW: 0.26, headH: 0.22, headLen: 0.26, ears: 0.05, bodyWidth: 0.9,
    });
    // The famously long, thick tail.
    let parent = this.a.tail;
    this.tailSegs = [];
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      seg.add(mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.24, 6).translate(0, -0.12, 0), mat));
      seg.position.y = i === 0 ? 0 : -0.24;
      seg.rotation.x = i === 0 ? -2.0 : 0.18;
      parent.add(seg);
      parent = seg;
      this.tailSegs.push(seg);
    }
    // A big rock to sit on.
    this.rock = mesh(new THREE.DodecahedronGeometry(1.6, 0), lambert('#77736d'));
    this.rock.scale.set(1.2, 0.6, 1);
    this.rock.position.copy(this.home).add(new THREE.Vector3(0, 0.1, 0));
    scene.add(this.rock);
    this.a.group.position.copy(this.home).add(new THREE.Vector3(0, 0.95, 0));
    scene.add(this.a.group);
    this.state = 'resting';
    this.timer = 0;
    this.phase = 0;
    this.dir = new THREE.Vector2();
  }

  update(dt, time, player) {
    const g = this.a.group;
    const dx = g.position.x - player.x;
    const dz = g.position.z - player.z;
    const d = Math.hypot(dx, dz);
    for (let i = 1; i < this.tailSegs.length; i++) {
      this.tailSegs[i].rotation.z = Math.sin(time * 1.5 - i * 0.6) * 0.12;
    }
    if (this.state === 'resting') {
      // Crouched, watching.
      animateLegs(this.a, 0, 0);
      this.a.legs.forEach((l) => (l.rotation.x = 0));
      g.scale.y = 0.85;
      if (d < 40) faceTowards(g, -dx, -dz, dt, 1.5);
      if (d < 26) {
        this.state = 'alert';
        this.timer = 1.6;
      }
    } else if (this.state === 'alert') {
      g.scale.y = 1;
      this.a.neck.rotation.x = -0.25;
      faceTowards(g, -dx, -dz, dt, 5);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'fleeing';
        this.timer = 5;
        this.dir.set(dx, dz).normalize();
      }
    } else if (this.state === 'fleeing') {
      this.timer -= dt;
      g.position.x += this.dir.x * 9 * dt;
      g.position.z += this.dir.y * 9 * dt;
      g.position.y = this.terrain.getHeight(g.position.x, g.position.z) + Math.abs(Math.sin(this.phase)) * 0.4;
      faceTowards(g, this.dir.x, this.dir.y, dt, 8);
      this.phase += dt * 12;
      animateLegs(this.a, this.phase, 0.9);
      this.mat.opacity = Math.min(1, this.timer / 2);
      if (this.timer <= 0) {
        this.state = 'gone';
        g.visible = false;
        this.timer = 90;
      }
    } else if (this.state === 'gone') {
      this.timer -= dt;
      if (this.timer <= 0 && d > 80) {
        g.visible = true;
        this.mat.opacity = 1;
        g.position.copy(this.home).add(new THREE.Vector3(0, 0.95, 0));
        this.state = 'resting';
      }
    }
  }
}

export class Eagle {
  constructor(scene, center, height) {
    this.center = center.clone();
    this.height = height;
    const g = new THREE.Group();
    const brown = lambert('#4a3424');
    g.add(mesh(new THREE.CapsuleGeometry(0.18, 0.7, 3, 6).rotateX(Math.PI / 2), brown));
    g.add(mesh(new THREE.SphereGeometry(0.15, 6, 4), lambert('#c9a46a'), 0, 0.05, 0.5));
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.14, 4).rotateX(Math.PI / 2), lambert('#e3b23c'), 0, 0.02, 0.66));
    g.add(mesh(new THREE.ConeGeometry(0.22, 0.5, 4).rotateX(-Math.PI / 2).scale(1, 0.25, 1), brown, 0, 0, -0.6));
    this.wings = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.12, 0.05, 0.05);
      const w = mesh(new THREE.BoxGeometry(1.4, 0.04, 0.5).translate(sx * 0.7, 0, 0), brown);
      const tip = mesh(new THREE.BoxGeometry(0.6, 0.03, 0.35).translate(sx * 0.3, 0, -0.05), lambert('#2e2017'));
      tip.position.x = sx * 1.4;
      pivot.add(w);
      pivot.add(tip);
      g.add(pivot);
      this.wings.push({ pivot, sx });
    }
    g.scale.setScalar(1.3);
    scene.add(g);
    this.group = g;
  }

  update(dt, time) {
    const t = time * 0.12;
    const r = 38 + Math.sin(time * 0.05) * 10;
    const g = this.group;
    g.position.set(this.center.x + Math.cos(t) * r, this.height + Math.sin(time * 0.3) * 4, this.center.z + Math.sin(t) * r);
    g.rotation.set(0, -t, 0);
    g.rotateZ(-0.35); // bank into the turn
    const flap = Math.sin(time * 0.35) > 0.85 ? Math.sin(time * 9) * 0.5 : 0.05;
    for (const w of this.wings) w.pivot.rotation.z = w.sx * flap;
  }
}

export class Deer {
  constructor(scene, terrain, x, z, { mother = true } = {}) {
    this.terrain = terrain;
    this.home = new THREE.Vector2(x, z);
    this.mother = mother;
    const coat = lambert(mother ? '#a8744a' : '#a2683c');
    this.a = quadruped({
      material: coat, legColor: '#6a4428', hoof: '#222', bodyR: mother ? 0.42 : 0.24, bodyLen: mother ? 1.1 : 0.55,
      legLen: mother ? 1.0 : 0.62, legR: mother ? 0.06 : 0.04, neckR: mother ? 0.17 : 0.1, neckLen: mother ? 0.85 : 0.45,
      neckAngle: 0.35, headW: mother ? 0.24 : 0.16, headH: mother ? 0.26 : 0.17, headLen: mother ? 0.55 : 0.32,
      ears: mother ? 0.08 : 0.06,
    });
    this.a.tail.add(mesh(new THREE.SphereGeometry(mother ? 0.28 : 0.15, 6, 4), lambert('#efe3cc'), 0, -0.05, 0.08));
    if (mother) {
      // Antlers of the Horned Mother Deer, Mugüzdüü Bugu-Ene.
      const antler = lambert('#e9dcc0');
      for (const sx of [-1, 1]) {
        const beam = new THREE.Group();
        beam.position.set(sx * 0.08, 0.15, 0.05);
        beam.rotation.set(-0.5, 0, sx * -0.45);
        beam.add(mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.1, 4).translate(0, 0.55, 0), antler));
        for (let t = 0; t < 4; t++) {
          const tine = mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.42, 4).translate(0, 0.21, 0), antler);
          tine.position.y = 0.25 + t * 0.24;
          tine.rotation.x = 0.9;
          tine.rotation.z = (t % 2 ? 1 : -1) * 0.2;
          beam.add(tine);
        }
        this.a.head.add(beam);
      }
    } else {
      // Fawn spots.
      for (let i = 0; i < 10; i++) {
        this.a.body.add(mesh(new THREE.SphereGeometry(0.03, 4, 3), lambert('#f3ead8'), ((i % 2) - 0.5) * 0.36, 0.14, (i / 10 - 0.5) * 0.6));
      }
    }
    this.a.group.position.set(x, terrain.getHeight(x, z), z);
    this.a.group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(this.a.group);
    this.phase = Math.random() * 10;
    this.target = new THREE.Vector2(x, z);
    this.pause = 2;
  }

  update(dt, time, player) {
    const g = this.a.group;
    const px = player.x - g.position.x;
    const pz = player.z - g.position.z;
    const d = Math.hypot(px, pz);
    let moving = false;
    if (d < 24 && this.mother) {
      // Calmly regard the boy.
      faceTowards(g, px, pz, dt, 1.2);
      this.a.neck.rotation.x += (-0.2 - this.a.neck.rotation.x) * Math.min(1, dt * 2);
    } else {
      const tx = this.target.x - g.position.x;
      const tz = this.target.y - g.position.z;
      const td = Math.hypot(tx, tz);
      if (this.pause > 0) {
        this.pause -= dt;
        const graze = Math.sin(time * 0.5 + this.home.x) > -0.3;
        this.a.neck.rotation.x += ((graze ? 1.25 : 0) - this.a.neck.rotation.x) * Math.min(1, dt * 2);
      } else if (td < 0.4) {
        this.pause = 4 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 8;
        this.target.set(this.home.x + Math.cos(a) * r, this.home.y + Math.sin(a) * r);
      } else {
        moving = true;
        g.position.x += (tx / td) * 0.9 * dt;
        g.position.z += (tz / td) * 0.9 * dt;
        faceTowards(g, tx, tz, dt, 2);
        this.a.neck.rotation.x *= 1 - Math.min(1, dt * 2);
      }
    }
    if (moving) this.phase += dt * 6;
    animateLegs(this.a, this.phase, moving ? 0.4 : 0);
    this.a.tail.rotation.x = Math.sin(time * 4) * 0.15;
    g.position.y = this.terrain.getHeight(g.position.x, g.position.z);
  }
}
