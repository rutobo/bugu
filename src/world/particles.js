// Lightweight point-sprite particles: chimney smoke, hot-spring steam, fireflies.
import * as THREE from 'three';
import { makeSoftSprite } from '../core/textures.js';

let sprite = null;
export const particleUniforms = { uScale: { value: 400 } };

function particleMaterial(color, additive) {
  sprite ??= makeSoftSprite();
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { map: { value: sprite }, color: { value: new THREE.Color(color) }, uScale: particleUniforms.uScale },
    ]),
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D(map, gl_PointCoord).a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(color, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class Emitter {
  constructor(scene, { origin, count = 60, rate = 8, life = 6, color = '#e8e8e8', size = [1, 4], alpha = 0.35, rise = 1.2, spread = 0.3, drift = new THREE.Vector3(0.4, 0, 0.2) }) {
    this.origin = origin.clone();
    this.opts = { rate, life, size, alpha, rise, spread, drift };
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(Infinity);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.cursor = 0;
    this.acc = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.points = new THREE.Points(geo, particleMaterial(color, false));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt, wind = 1) {
    const o = this.opts;
    this.acc += dt * o.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.age[i] = 0;
      this.pos[i * 3] = this.origin.x + (Math.random() - 0.5) * o.spread;
      this.pos[i * 3 + 1] = this.origin.y;
      this.pos[i * 3 + 2] = this.origin.z + (Math.random() - 0.5) * o.spread;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.3;
      this.vel[i * 3 + 1] = o.rise * (0.7 + Math.random() * 0.6);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    for (let i = 0; i < this.count; i++) {
      const a = (this.age[i] += dt);
      const t = a / o.life;
      if (t >= 1) {
        this.alphas[i] = 0;
        continue;
      }
      this.pos[i * 3] += (this.vel[i * 3] + o.drift.x * t * wind) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + o.drift.z * t * wind) * dt;
      this.sizes[i] = o.size[0] + (o.size[1] - o.size[0]) * t;
      this.alphas[i] = o.alpha * Math.min(1, t * 6) * (1 - t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}

// Fireflies drifting over the meadows around the player at night.
export class Fireflies {
  constructor(scene, terrain, count = 160) {
    this.terrain = terrain;
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count * 4);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.home = new Float32Array(count * 2);
    this.initialised = false;
    for (let i = 0; i < count; i++) {
      this.seed.set([Math.random() * 100, Math.random() * 100, 0.5 + Math.random(), Math.random()], i * 4);
      this.sizes[i] = 0.25 + Math.random() * 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.points = new THREE.Points(geo, particleMaterial('#e6ff7a', true));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time, focus, night) {
    this.points.visible = night > 0.05;
    if (!this.points.visible) return;
    const R = 45;
    for (let i = 0; i < this.count; i++) {
      let hx = this.home[i * 2];
      let hz = this.home[i * 2 + 1];
      // Re-home fireflies that fell too far behind the player.
      if (!this.initialised || Math.hypot(hx - focus.x, hz - focus.z) > R) {
        const a = Math.random() * Math.PI * 2;
        const r = (this.initialised ? 0.8 + Math.random() * 0.2 : Math.sqrt(Math.random())) * R;
        hx = focus.x + Math.cos(a) * r;
        hz = focus.z + Math.sin(a) * r;
        this.home[i * 2] = hx;
        this.home[i * 2 + 1] = hz;
      }
      const s0 = this.seed[i * 4];
      const s1 = this.seed[i * 4 + 1];
      const sp = this.seed[i * 4 + 2];
      const x = hx + Math.sin(time * 0.3 * sp + s0) * 3;
      const z = hz + Math.cos(time * 0.27 * sp + s1) * 3;
      const ground = this.terrain.getHeight(x, z);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = Math.max(ground, 0) + 0.6 + Math.sin(time * 0.8 * sp + s1) * 0.5 + 0.6;
      this.pos[i * 3 + 2] = z;
      const blink = Math.max(0, Math.sin(time * 2.2 * sp + s0 * 3));
      // Fewer fireflies on the cold high slopes.
      const altitude = ground > 70 ? 0.15 : 1;
      this.alphas[i] = night * blink * blink * altitude;
    }
    this.initialised = true;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}
