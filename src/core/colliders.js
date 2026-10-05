// Circle colliders on the ground plane, bucketed in a coarse grid.
const CELL = 8;

export class Colliders {
  constructor() {
    this.grid = new Map();
  }

  key(i, j) {
    return i * 73856093 ^ j * 19349663;
  }

  add(x, z, r, tag = null) {
    const c = { x, z, r, tag };
    // Pad by a metre so a mover's own radius can't straddle a cell edge unseen.
    const i0 = Math.floor((x - r - 1) / CELL);
    const i1 = Math.floor((x + r + 1) / CELL);
    const j0 = Math.floor((z - r - 1) / CELL);
    const j1 = Math.floor((z + r + 1) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        let bucket = this.grid.get(k);
        if (!bucket) this.grid.set(k, (bucket = []));
        bucket.push(c);
      }
    }
    return c;
  }

  near(x, z) {
    return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  }

  // Is there a collider within `r` of (x, z)? Used to keep placements apart.
  blocked(x, z, r) {
    for (const c of this.near(x, z)) {
      if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2) return true;
    }
    return false;
  }

  // Push a circle of radius r out of every collider it overlaps.
  resolve(pos, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.near(pos.x, pos.z)) {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = c.r + r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.0001;
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
      }
    }
  }
}
