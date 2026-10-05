// Moves the boy over the terrain and drives the third-person camera.
import * as THREE from 'three';
import { WORLD } from '../world/terrain.js';
import { clamp } from '../core/noise.js';

const WALK = 4.2;
const RUN = 7.6;
const GRAVITY = 18;
const JUMP = 6.2;
const RADIUS = 0.32;

export class PlayerController {
  constructor(boy, camera, world, input) {
    this.boy = boy;
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = true;
    this.speed = 0;
    this.wading = false;
    this.yaw = Math.PI / 2;
    this.pitch = 0.32;
    this.distance = 6.5;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.stepCount = 0;
    this.lastStep = 0;
    this.onStep = null;
    this.onSplash = null;
    this.blockedMsg = 0;
  }

  spawn(x, z, facing) {
    this.pos.set(x, this.world.groundHeight(x, z), z);
    this.facing = facing;
    this.yaw = facing + Math.PI;
    this.boy.root.position.copy(this.pos);
    this.boy.root.rotation.y = facing;
    this.updateCamera(1, true);
  }

  // Can the boy step from (x0,z0) to (x1,z1)?
  canStep(x0, z0, x1, z1) {
    const r = Math.hypot(x1, z1);
    if (r > WORLD.walkRadius) return false;
    const g0 = this.world.groundHeight(x0, z0);
    const g1 = this.world.groundHeight(x1, z1);
    if (g1 < WORLD.wadeDepth) return 'deep';
    const run = Math.hypot(x1 - x0, z1 - z0) || 1e-6;
    if ((g1 - g0) / run > WORLD.maxSlope && g1 > this.pos.y - 0.05) return 'steep';
    return true;
  }

  update(dt, time) {
    const input = this.input;

    // Camera orbit.
    this.yaw -= input.look.dx * 0.0024;
    this.pitch = clamp(this.pitch + input.look.dy * 0.0022, -0.35, 1.25);
    this.distance = clamp(this.distance + input.zoom * 0.8, 2.5, 16);
    if (input.keys.has('KeyQ')) this.yaw += dt * 1.8;
    if (input.keys.has('KeyE')) this.yaw -= dt * 1.8;

    // Desired horizontal velocity, relative to the camera.
    const mv = input.moveVector();
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    const ground = this.world.groundHeight(this.pos.x, this.pos.z);
    this.wading = ground < WORLD.waterLevel - 0.25 && this.pos.y < WORLD.waterLevel + 0.1;
    let maxSpeed = input.running ? RUN : WALK;
    if (this.wading) maxSpeed *= 0.5;
    const slope = this.world.terrain.getSlope(this.pos.x, this.pos.z);
    if (wish.lengthSq() > 0.0001) {
      // Uphill is slower.
      const ahead = this.world.groundHeight(this.pos.x + wish.x * 0.5, this.pos.z + wish.z * 0.5);
      if (ahead > ground) maxSpeed *= 1 - clamp((ahead - ground) / 0.5, 0, 1) * 0.35 * Math.min(1, slope);
    }
    const target = wish.multiplyScalar(maxSpeed);
    const accel = this.grounded ? 12 : 3;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, dt * accel);

    // Horizontal move, axis by axis so we can slide along obstacles.
    const ox = this.pos.x;
    const oz = this.pos.z;
    let nx = ox + this.vel.x * dt;
    let nz = oz + this.vel.z * dt;
    let res = this.canStep(ox, oz, nx, nz);
    if (res !== true) {
      const rx = this.canStep(ox, oz, nx, oz);
      const rz = this.canStep(ox, oz, ox, nz);
      if (rx === true) nz = oz;
      else if (rz === true) nx = ox;
      else {
        nx = ox;
        nz = oz;
      }
      if (rx !== true && rz !== true) {
        this.vel.x *= 0.2;
        this.vel.z *= 0.2;
        if (time - this.blockedMsg > 6 && this.onBlocked) {
          this.blockedMsg = time;
          this.onBlocked(res);
        }
      }
    }
    const p = new THREE.Vector3(nx, 0, nz);
    this.world.colliders.resolve(p, RADIUS);
    if (this.canStep(ox, oz, p.x, p.z) === true) {
      this.pos.x = p.x;
      this.pos.z = p.z;
    }

    // Vertical.
    const g = this.world.groundHeight(this.pos.x, this.pos.z);
    if (this.grounded && input.consumeJump() && !this.wading) {
      this.vel.y = JUMP;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= g) {
        this.pos.y = g;
        this.vel.y = 0;
        this.grounded = true;
        this.onLand?.();
      }
    } else if (this.pos.y - g > 0.7) {
      // Walked off a ledge.
      this.grounded = false;
      this.vel.y = 0;
    } else {
      this.pos.y = g;
    }

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.4) {
      const targetFacing = Math.atan2(this.vel.x, this.vel.z);
      let diff = targetFacing - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
    }

    this.boy.root.position.copy(this.pos);
    // Sink a bit while wading.
    this.boy.root.rotation.y = this.facing;
    const { stepPhase } = this.boy.animate(dt, time, this.speed, this.grounded, this.wading);
    const step = Math.floor(stepPhase / Math.PI);
    if (step !== this.lastStep && this.grounded && this.speed > 0.8) {
      this.lastStep = step;
      if (this.wading) this.onSplash?.(this.pos);
      else this.onStep?.(this.speed);
    }

    this.updateCamera(dt);
  }

  updateCamera(dt, snap = false) {
    const target = this.camTarget.set(this.pos.x, this.pos.y + 1.35, this.pos.z);
    const cp = Math.cos(this.pitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * cp * this.distance,
      target.y + Math.sin(this.pitch) * this.distance,
      target.z + Math.cos(this.yaw) * cp * this.distance
    );
    // Pull the camera in if a slope hides the boy, then keep it above ground.
    const terrain = this.world.terrain;
    let reach = 1;
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const x = target.x + (desired.x - target.x) * t;
      const y = target.y + (desired.y - target.y) * t;
      const z = target.z + (desired.z - target.z) * t;
      if (terrain.getHeight(x, z) + 0.35 > y) {
        reach = Math.max(0.25, (i - 1) / 10);
        break;
      }
    }
    desired.lerpVectors(target, desired, reach);
    const floor = Math.max(terrain.getHeight(desired.x, desired.z), WORLD.waterLevel) + 0.5;
    if (desired.y < floor) desired.y = floor;
    if (snap) this.camPos.copy(desired);
    else this.camPos.lerp(desired, 1 - Math.exp(-dt * 12));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);
  }
}
