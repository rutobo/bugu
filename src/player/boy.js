// The boy: a low-poly kid in a white Kyrgyz kalpak and an embroidered vest.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Boy {
  constructor() {
    const skin = mat('#d9a679');
    const shirt = mat('#f2efe6');
    const vest = mat('#1d4e89');
    const trim = mat('#d4a017');
    const pants = mat('#3b3a36');
    const boots = mat('#4a2f1e');
    const felt = mat('#f5f1e6');
    const black = mat('#1a1a1a');

    const root = new THREE.Group();
    this.root = root;
    const body = new THREE.Group(); // bobs while walking
    root.add(body);
    this.body = body;

    // Legs (pivot at the hip).
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.1, 0.68, 0);
      const thigh = part(new THREE.BoxGeometry(0.15, 0.36, 0.16), pants, 0, -0.18, 0);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.set(0, -0.36, 0);
      knee.add(part(new THREE.BoxGeometry(0.14, 0.26, 0.15), pants, 0, -0.13, 0));
      knee.add(part(new THREE.BoxGeometry(0.15, 0.1, 0.24), boots, 0, -0.27, 0.04));
      hip.add(knee);
      body.add(hip);
      this.legs.push({ hip, knee });
    }

    // Torso: shirt with a blue vest and golden trim.
    const torso = new THREE.Group();
    torso.position.y = 0.68;
    body.add(torso);
    this.torso = torso;
    torso.add(part(new THREE.BoxGeometry(0.36, 0.44, 0.22), shirt, 0, 0.24, 0));
    torso.add(part(new THREE.BoxGeometry(0.38, 0.4, 0.235), vest, 0, 0.24, -0.005));
    torso.add(part(new THREE.BoxGeometry(0.12, 0.4, 0.02), shirt, 0, 0.24, 0.115)); // open front
    torso.add(part(new THREE.BoxGeometry(0.02, 0.4, 0.025), trim, -0.065, 0.24, 0.12));
    torso.add(part(new THREE.BoxGeometry(0.02, 0.4, 0.025), trim, 0.065, 0.24, 0.12));
    torso.add(part(new THREE.BoxGeometry(0.39, 0.05, 0.24), mat('#8b1e1e'), 0, 0.03, 0)); // sash belt

    // Arms (pivot at the shoulder).
    this.arms = [];
    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.24, 0.42, 0);
      shoulder.add(part(new THREE.BoxGeometry(0.11, 0.24, 0.12), shirt, 0, -0.12, 0));
      const elbow = new THREE.Group();
      elbow.position.y = -0.24;
      elbow.add(part(new THREE.BoxGeometry(0.1, 0.2, 0.11), shirt, 0, -0.1, 0));
      elbow.add(part(new THREE.BoxGeometry(0.09, 0.09, 0.09), skin, 0, -0.24, 0));
      shoulder.add(elbow);
      torso.add(shoulder);
      this.arms.push({ shoulder, elbow });
    }

    // Head.
    const head = new THREE.Group();
    head.position.y = 0.52;
    torso.add(head);
    this.head = head;
    head.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.08), skin, 0, 0.02, 0)); // neck
    head.add(part(new THREE.BoxGeometry(0.26, 0.27, 0.25), skin, 0, 0.18, 0));
    head.add(part(new THREE.BoxGeometry(0.27, 0.08, 0.26), mat('#2b1d14'), 0, 0.27, -0.01)); // hair
    for (const sx of [-1, 1]) {
      head.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.02), black, sx * 0.06, 0.2, 0.126));
      head.add(part(new THREE.BoxGeometry(0.03, 0.06, 0.05), skin, sx * 0.14, 0.18, 0)); // ears
    }
    head.add(part(new THREE.BoxGeometry(0.08, 0.02, 0.02), mat('#9c4a3a'), 0, 0.11, 0.126));
    head.add(part(new THREE.BoxGeometry(0.05, 0.03, 0.03), mat('#e0a983'), 0, 0.15, 0.13)); // rosy nose

    // Kalpak: tall white felt hat with a black upturned brim and a tassel.
    const kalpak = new THREE.Group();
    kalpak.position.y = 0.3;
    const crown = part(new THREE.CylinderGeometry(0.07, 0.15, 0.3, 4), felt, 0, 0.15, 0);
    crown.rotation.y = Math.PI / 4;
    kalpak.add(crown);
    const brim = part(new THREE.CylinderGeometry(0.155, 0.16, 0.07, 4, 1, true), black, 0, 0.035, 0);
    brim.rotation.y = Math.PI / 4;
    brim.material = black.clone();
    brim.material.side = THREE.DoubleSide;
    kalpak.add(brim);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const stitch = part(new THREE.BoxGeometry(0.008, 0.22, 0.008), black, Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08);
      stitch.rotation.z = Math.cos(a) * 0.25;
      stitch.rotation.x = -Math.sin(a) * 0.25;
      kalpak.add(stitch);
    }
    kalpak.add(part(new THREE.SphereGeometry(0.025, 4, 3), mat('#c1272d'), 0, 0.31, 0));
    head.add(kalpak);

    this.phase = 0;
    this.blend = 0; // 0 idle → 1 full stride
  }

  // speed: horizontal m/s; grounded: on the ground; wading: in water.
  animate(dt, time, speed, grounded, wading) {
    const stride = Math.min(1, speed / 4.5);
    this.blend += (stride - this.blend) * Math.min(1, dt * 8);
    const running = speed > 5.5;
    this.phase += dt * (running ? 11 : 8) * Math.max(stride, 0.2);
    const s = Math.sin(this.phase);
    const amp = this.blend * (running ? 0.9 : 0.6) * (wading ? 0.6 : 1);

    if (grounded) {
      this.legs[0].hip.rotation.x = s * amp;
      this.legs[1].hip.rotation.x = -s * amp;
      this.legs[0].knee.rotation.x = Math.max(0, -Math.cos(this.phase)) * amp * 1.2;
      this.legs[1].knee.rotation.x = Math.max(0, Math.cos(this.phase)) * amp * 1.2;
      this.arms[0].shoulder.rotation.x = -s * amp * 0.9;
      this.arms[1].shoulder.rotation.x = s * amp * 0.9;
      this.arms[0].elbow.rotation.x = -0.3 - this.blend * 0.4;
      this.arms[1].elbow.rotation.x = -0.3 - this.blend * 0.4;
      this.arms[0].shoulder.rotation.z = -0.08;
      this.arms[1].shoulder.rotation.z = 0.08;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * this.blend;
      this.torso.rotation.x = this.blend * (running ? 0.18 : 0.06);
      // Idle breathing.
      this.torso.scale.y = 1 + Math.sin(time * 2) * 0.01 * (1 - this.blend);
    } else {
      // Mid-jump pose.
      this.legs[0].hip.rotation.x = -0.6;
      this.legs[0].knee.rotation.x = 0.9;
      this.legs[1].hip.rotation.x = 0.3;
      this.legs[1].knee.rotation.x = 0.4;
      this.arms[0].shoulder.rotation.x = -2.2;
      this.arms[1].shoulder.rotation.x = -2.2;
      this.arms[0].shoulder.rotation.z = -0.4;
      this.arms[1].shoulder.rotation.z = 0.4;
      this.body.position.y = 0;
    }
    this.head.rotation.y = Math.sin(time * 0.4) * 0.25 * (1 - this.blend);
    return { stepPhase: this.phase };
  }
}
