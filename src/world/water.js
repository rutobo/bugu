// One water sheet at y = 0; the terrain carves the river and lake below it.
import * as THREE from 'three';
import { makeWaterNormals } from '../core/textures.js';
import { WORLD } from './terrain.js';

export class Water {
  constructor(scene) {
    const normalMap = makeWaterNormals();
    normalMap.repeat.set(60, 60);
    this.normalMap = normalMap;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x2d6f7e,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
      normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      depthWrite: false,
    });
    const geo = new THREE.CircleGeometry(520, 96);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WORLD.waterLevel;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  update(dt, night) {
    this.normalMap.offset.x += dt * 0.004;
    this.normalMap.offset.y -= dt * 0.011;
    this.material.color.setHSL(0.53, 0.45, 0.3 - night * 0.18);
  }
}
