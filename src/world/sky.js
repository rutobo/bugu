// Gradient sky dome, sun/moon lighting, stars and a day–night cycle.
import * as THREE from 'three';
import { smoothstep, mulberry32 } from '../core/noise.js';
import { makeSoftSprite } from '../core/textures.js';

const DAY_LENGTH = 9 * 60; // seconds for a full day

const KEYS = {
  night: { top: '#070d22', horizon: '#18233f', fogDensity: 0.0013 },
  dawn: { top: '#3e5d92', horizon: '#f0a070', fogDensity: 0.0016 },
  day: { top: '#3f7fd0', horizon: '#bcd7ea', fogDensity: 0.00085 },
};
const col = (h) => new THREE.Color(h);

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.29; // fraction of the day; 0.25 = sunrise, 0.5 = noon
    this.speed = 1;
    this.sunDir = new THREE.Vector3();
    this.night = 0;

    this.topColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.fog = new THREE.FogExp2(0xbcd7ea, 0.001);
    scene.fog = this.fog;
    scene.background = this.horizonColor;

    const uniforms = {
      topColor: { value: this.topColor },
      horizonColor: { value: this.horizonColor },
      sunDir: { value: this.sunDir },
      sunColor: { value: new THREE.Color('#fff2d0') },
      night: { value: 0 },
    };
    this.uniforms = uniforms;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 32, 16),
      new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
            gl_Position.z = gl_Position.w; // keep on the far plane
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 topColor, horizonColor, sunDir, sunColor;
          uniform float night;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 c = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55));
            c = mix(c, horizonColor * 0.8, smoothstep(0.0, -0.25, h));
            float s = max(dot(d, sunDir), 0.0);
            float vis = smoothstep(-0.12, 0.05, sunDir.y);
            c += sunColor * (pow(s, 8.0) * 0.25 + pow(s, 64.0) * 0.4) * vis;
            c += sunColor * smoothstep(0.9993, 0.9997, s) * 2.0 * vis;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      })
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.dome = dome;
    scene.add(dome);

    // Stars.
    const rnd = mulberry32(99);
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      starPos.set([Math.cos(th) * r * 2400, y * 2400, Math.sin(th) * r * 2400], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 7,
      map: makeSoftSprite(),
      transparent: true,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true,
      color: 0xdfe8ff,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Moon.
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(55, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f1e6, fog: false, transparent: true })
    );
    scene.add(this.moon);

    // Lights.
    this.hemi = new THREE.HemisphereLight(0xbcd7ea, 0x3b4a2a, 0.8);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 10;
    sc.far = 600;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.update(0, new THREE.Vector3());
  }

  get hours() {
    return (this.time * 24) % 24;
  }

  update(dt, focus) {
    this.time = (this.time + (dt * this.speed) / DAY_LENGTH) % 1;
    const th = (this.time - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(th), Math.sin(th) * 0.92, 0.38).normalize();
    const e = this.sunDir.y;

    const dayK = smoothstep(0.02, 0.35, e);
    const nightK = smoothstep(0.0, -0.2, e);
    const dawnK = 1 - dayK - nightK;
    this.night = nightK;

    const mixKey = (prop, out) => {
      out.setRGB(0, 0, 0);
      const a = col(KEYS.night[prop]).multiplyScalar(nightK);
      const b = col(KEYS.dawn[prop]).multiplyScalar(dawnK);
      const c = col(KEYS.day[prop]).multiplyScalar(dayK);
      return out.add(a).add(b).add(c);
    };
    mixKey('top', this.topColor);
    mixKey('horizon', this.horizonColor);
    // Warm the horizon only on the side of the sun at dawn/dusk.
    this.fog.color.copy(this.horizonColor).lerp(col('#9fb1c4'), dawnK * 0.45);
    this.fog.density =
      KEYS.night.fogDensity * nightK + KEYS.dawn.fogDensity * dawnK + KEYS.day.fogDensity * dayK;
    this.uniforms.night.value = nightK;

    // The directional light is the sun by day and the moon by night.
    const moonDir = this.sunDir.clone().negate();
    const lightDir = e > -0.05 ? this.sunDir : moonDir;
    const sunWarm = col('#ffd2a1').lerp(col('#fff6e8'), dayK);
    if (e > -0.05) {
      this.sun.color.copy(sunWarm);
      this.sun.intensity = 2.6 * smoothstep(-0.05, 0.15, e);
    } else {
      this.sun.color.set('#9fb4e8');
      this.sun.intensity = 0.55 * smoothstep(-0.05, -0.25, e);
    }
    this.sun.position.copy(focus).addScaledVector(lightDir, 300);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();

    this.hemi.color.copy(this.horizonColor).lerp(this.topColor, 0.3);
    this.hemi.groundColor.set('#3b4a2a').multiplyScalar(0.3 + 0.7 * (1 - nightK));
    this.hemi.intensity = 0.45 + 1.0 * dayK + 0.6 * dawnK;

    this.starMat.opacity = nightK * 0.95;
    this.stars.visible = nightK > 0.01;
    this.stars.position.copy(focus);
    this.stars.rotation.y = this.time * Math.PI * 2 * 0.2;

    this.moon.position.copy(focus).addScaledVector(moonDir, 2200);
    this.moon.lookAt(focus);
    this.moon.material.opacity = smoothstep(0.1, -0.1, e);
    this.moon.visible = moonDir.y > -0.1;

    this.dome.position.copy(focus);
  }
}
