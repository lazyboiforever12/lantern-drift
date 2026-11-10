// Game rules: steering the boat, oil, buoys, the lighthouse and the shadow creatures.
import { parseLevel, CURRENTS } from './levels.js';
import { clamp, dist } from './math.js';

const BOAT_RADIUS = 0.75;
const OIL_MAX = 100;
const OIL_PICKUP = 35;
const HIT_COST = 18;
const FLARE_COST = 12;
export const FLARE_TIME = 1.2;
const FLARE_RANGE = 11;
const BUOY_SAFE = 5.5;
const LIGHTHOUSE_SAFE = 11;
const CURRENT_SPEED = 2.6;  // how fast flowing water carries the boat (top rowing speed is 7.5)
const LIGHTNING_WARN = 1.4;   // seconds of warning before a strike lands
const LIGHTNING_STUN = 6;     // shadows this close to a strike are stunned
const LIGHTNING_HURT = 2.6;   // the boat this close to a strike loses oil
const LIGHTNING_COST = 12;
const LUNGE_TIME = 0.9;      // seconds a lunge lasts
const LUNGE_SPEED = 9;       // faster than the boat, so you can't just outrun it
const LUNGE_RANGE = 6;       // how far outside the fear radius a shadow will start a lunge

export class Game {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.level = parseLevel(def);
    const L = this.level;
    this.boat = { x: L.start.x, z: L.start.z, angle: this.openHeading(L.start), vx: 0, vz: 0 };
    this.oil = OIL_MAX;
    this.oils = L.oils.map((p) => ({ ...p, taken: false }));
    this.buoys = L.buoys.map((p) => ({ ...p, lit: false }));
    this.creatures = L.creatures.map((p, i) => ({
      x: p.x, z: p.z, vx: 0, vz: 0, stun: 0, lunge: 0, cool: 3 + i * 1.3, seed: i,
    }));
    this.lighthouse = L.lighthouse;
    this.lighthouseActive = false;
    this.flareTime = 0;
    this.flareCooldown = 0;
    this.hitFlash = 0;
    this.time = 0;
    this.result = null; // 'won' or 'lost'
    // Storm levels: wind that pushes the boat, and lightning strikes with a warning.
    this.storm = def.storm || null;
    this.seed = 12345 + index * 777;      // seeded random, so a level plays the same way in tests
    this.wind = { x: 0, z: 0 };
    this.strike = null;                   // { x, z, warn } while a strike is coming
    this.strikeTimer = this.storm ? 4 : 0;
    this.lightningFlash = 0;
    this.events = [];
  }

  // Where the awake lighthouse's sweeping beam touches the water.
  get beamSpot() {
    const a = this.time * 0.9;
    return { x: this.lighthouse.x + Math.cos(a) * 9, z: this.lighthouse.z + Math.sin(a) * 9 };
  }

  // 1 for a steady lit buoy. On fading-buoy levels it dims, then flickers, as its timer runs out.
  buoyStrength(u) {
    if (!u.lit) return 0;
    if (!this.def.buoyTime || this.lighthouseActive) return 1;
    const k = Math.min(1, 0.35 + u.timer / 10);
    return u.timer < 4 ? k * (0.6 + 0.4 * Math.sin(this.time * 18)) : k;
  }

  get buoysLit() {
    return this.buoys.filter((b) => b.lit).length;
  }

  // How far the lantern reaches. It shrinks as the oil runs low.
  get lanternRadius() {
    return 4 + 8 * (this.oil / OIL_MAX);
  }

  // Creatures won't come closer than this unless they lunge.
  get fearRadius() {
    return Math.max(1.6, this.lanternRadius * 0.45 - 0.5);
  }

  // Point the boat down whichever of the four directions has the longest run of open water.
  openHeading(p) {
    const { cell } = this.level;
    const col = Math.floor(p.x / cell), row = Math.floor(p.z / cell);
    let best = Math.PI, bestRun = -1;
    // angle 0 faces +Z (down the map), PI faces -Z, PI/2 faces +X.
    for (const [angle, dc, dr] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0]]) {
      let run = 0;
      while (!this.isSolid(col + dc * (run + 1), row + dr * (run + 1)) && run < 20) run++;
      if (run > bestRun) { bestRun = run; best = angle; }
    }
    return best;
  }

  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  // Wind slowly turns and gusts. Lightning picks a spot near the boat, warns, then strikes.
  updateStorm(dt) {
    const s = this.storm;
    const t = this.time;
    const angle = t * 0.13 + Math.sin(t * 0.37) * 1.2;
    const gust = Math.max(0, Math.sin(t * 0.55)) ** 3;   // a strong push every ~11 s
    const strength = s.wind * (0.45 + 0.9 * gust);
    this.wind.x = Math.sin(angle) * strength;
    this.wind.z = Math.cos(angle) * strength;
    this.lightningFlash = Math.max(0, this.lightningFlash - dt);

    if (this.strike) {
      this.strike.warn -= dt;
      if (this.strike.warn <= 0) this.landStrike();
      return;
    }
    this.strikeTimer -= dt;
    if (this.strikeTimer <= 0) {
      const b = this.boat;
      const a = this.random() * Math.PI * 2;
      const r = 1 + this.random() * 7;
      this.strike = { x: b.x + Math.cos(a) * r, z: b.z + Math.sin(a) * r, warn: LIGHTNING_WARN };
      this.strikeTimer = s.lightningEvery * (0.7 + this.random() * 0.6);
      this.events.push({ type: 'lightningWarn', x: this.strike.x, z: this.strike.z });
    }
  }

  landStrike() {
    const { x, z } = this.strike;
    this.strike = null;
    this.lightningFlash = 0.35;
    let stunned = 0;
    for (const c of this.creatures) {
      if (dist(c.x, c.z, x, z) < LIGHTNING_STUN) {
        c.stun = 4;
        c.lunge = 0;
        stunned++;
      }
    }
    const b = this.boat;
    const hurt = dist(b.x, b.z, x, z) < LIGHTNING_HURT;
    if (hurt) {
      this.oil -= LIGHTNING_COST;
      this.hitFlash = 0.4;
    }
    this.lastStrike = { x, z };
    this.events.push({ type: 'lightning', x, z, stunned, hurt });
  }

  currentAt(x, z) {
    const { grid, cell } = this.level;
    const row = grid[Math.floor(z / cell)];
    return row ? CURRENTS[row[Math.floor(x / cell)]] : undefined;
  }

  isSolid(col, row) {
    const g = this.level.grid;
    if (row < 0 || row >= g.length || col < 0 || col >= g[row].length) return true;
    const ch = g[row][col];
    return ch === '#' || ch === 'L';
  }

  flare() {
    if (this.result || this.flareCooldown > 0) return;
    if (this.oil < FLARE_COST + 1) {
      this.events.push({ type: 'noFlare' });
      return;
    }
    this.oil -= FLARE_COST;
    this.flareTime = FLARE_TIME;
    this.flareCooldown = 1.5;
    const b = this.boat;
    for (const c of this.creatures) {
      const d = dist(c.x, c.z, b.x, b.z);
      if (d < FLARE_RANGE) {
        const ux = (c.x - b.x) / (d || 1), uz = (c.z - b.z) / (d || 1);
        c.vx = ux * 10;
        c.vz = uz * 10;
        c.stun = 2.5;
        c.lunge = 0;
      }
    }
    this.events.push({ type: 'flare' });
  }

  update(dt, input) {
    if (this.result) return;
    this.time += dt;
    if (this.storm) this.updateStorm(dt);
    this.flareTime = Math.max(0, this.flareTime - dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.updateBoat(dt, input);
    this.updatePickups();
    this.updateCreatures(dt);

    // Fading buoys: until the lighthouse wakes, a lit buoy goes dark when its timer runs out.
    if (this.def.buoyTime && !this.lighthouseActive) {
      for (const u of this.buoys) {
        if (!u.lit) continue;
        u.timer -= dt;
        if (u.timer <= 0) {
          u.lit = false;
          this.events.push({ type: 'buoyOut', x: u.x, z: u.z });
        }
      }
    }

    this.oil -= this.def.drain * dt;
    if (this.oil <= 0) {
      this.oil = 0;
      this.result = 'lost';
      this.events.push({ type: 'lose' });
    }

    const b = this.boat;
    if (this.lighthouseActive && dist(b.x, b.z, this.lighthouse.x, this.lighthouse.z) < 3.4) {
      this.result = 'won';
      this.events.push({ type: 'win' });
    }
  }

  updateBoat(dt, input) {
    const b = this.boat;
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const thrust = (input.forward ? 1 : 0) - (input.back ? 0.5 : 0);
    const speed = Math.hypot(b.vx, b.vz);
    b.angle += turn * (1.7 + Math.min(speed, 6) * 0.2) * dt;

    const fx = Math.sin(b.angle), fz = Math.cos(b.angle);
    b.vx += fx * thrust * 10 * dt;
    b.vz += fz * thrust * 10 * dt;

    // Water drag: little along the hull, a lot sideways (like a keel).
    let along = b.vx * fx + b.vz * fz;
    let side = b.vx * fz - b.vz * fx;
    along = clamp(along * Math.exp(-1.2 * dt), -3, 7.5);
    side *= Math.exp(-5 * dt);
    b.vx = fx * along + fz * side;
    b.vz = fz * along - fx * side;

    b.x += b.vx * dt;
    b.z += b.vz * dt;

    // Flowing water carries the boat along with it.
    // Wind (storm levels) pushes the boat the same way a current does.
    b.x += this.wind.x * dt;
    b.z += this.wind.z * dt;
    const cur = this.currentAt(b.x, b.z);
    if (cur) {
      b.x += cur.x * CURRENT_SPEED * dt;
      b.z += cur.z * CURRENT_SPEED * dt;
    }
    this.collideBoat();
  }

  // Circle (boat) against the square cells of buildings.
  collideBoat() {
    const b = this.boat;
    const { cell } = this.level;
    const r = BOAT_RADIUS;
    const c0 = Math.floor((b.x - r) / cell), c1 = Math.floor((b.x + r) / cell);
    const r0 = Math.floor((b.z - r) / cell), r1 = Math.floor((b.z + r) / cell);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!this.isSolid(col, row)) continue;
        const minX = col * cell, maxX = minX + cell, minZ = row * cell, maxZ = minZ + cell;
        const px = clamp(b.x, minX, maxX), pz = clamp(b.z, minZ, maxZ);
        let dx = b.x - px, dz = b.z - pz;
        let d = Math.hypot(dx, dz);
        if (d >= r) continue;
        let nx, nz;
        if (d < 1e-5) {
          // Centre is inside the box: push out the shortest way.
          const left = b.x - minX, right = maxX - b.x, top = b.z - minZ, bottom = maxZ - b.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { nx = -1; nz = 0; } else if (m === right) { nx = 1; nz = 0; }
          else if (m === top) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
          d = -m;
        } else {
          nx = dx / d;
          nz = dz / d;
        }
        b.x += nx * (r - d);
        b.z += nz * (r - d);
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
          b.vx -= vn * nx * 1.3;
          b.vz -= vn * nz * 1.3;
          if (vn < -3) this.events.push({ type: 'bump' });
        }
      }
    }
  }

  updatePickups() {
    const b = this.boat;
    for (const o of this.oils) {
      if (!o.taken && dist(b.x, b.z, o.x, o.z) < 1.5) {
        o.taken = true;
        this.oil = Math.min(OIL_MAX, this.oil + OIL_PICKUP);
        this.events.push({ type: 'oil', x: o.x, z: o.z });
      }
    }
    for (const u of this.buoys) {
      if (!u.lit && dist(b.x, b.z, u.x, u.z) < 2.4) {
        u.lit = true;
        u.timer = this.def.buoyTime || 0; // on some levels lit buoys burn out
        this.events.push({ type: 'buoy', x: u.x, z: u.z });
        if (this.buoysLit === this.buoys.length) {
          this.lighthouseActive = true;
          this.events.push({ type: 'allBuoys' });
        }
      }
    }
  }

  updateCreatures(dt) {
    const b = this.boat;
    const fear = this.fearRadius;
    const { width, height, cell } = this.level;
    for (const c of this.creatures) {
      c.stun = Math.max(0, c.stun - dt);
      c.cool -= dt;
      if (c.lunge > 0) c.lunge -= dt;

      const dx = b.x - c.x, dz = b.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const ux = dx / d, uz = dz / d;
      let ax = 0, az = 0;

      if (c.stun > 0) {
        // Drift away, dazed.
      } else if (c.lunge > 0) {
        ax += ux * 24; az += uz * 24;
      } else if (d < fear) {
        ax -= ux * 8; az -= uz * 8;
      } else {
        ax += ux * this.def.creatureSpeed * 2;
        az += uz * this.def.creatureSpeed * 2;
        if (c.cool <= 0 && d < fear + LUNGE_RANGE) {
          c.lunge = LUNGE_TIME;
          c.cool = this.def.lungeCooldown + ((c.seed * 7.3 + this.time) % 2);
          this.events.push({ type: 'lunge' });
        }
      }

      // Wobble so they don't move in straight lines.
      ax += Math.sin(this.time * 1.7 + c.seed * 3) * 2;
      az += Math.cos(this.time * 1.3 + c.seed * 5) * 2;

      // Lit buoys and an awake lighthouse are safe zones.
      const repel = (x, z, radius) => {
        const ex = c.x - x, ez = c.z - z;
        const e = Math.hypot(ex, ez) || 0.001;
        if (e < radius) {
          ax += (ex / e) * 16;
          az += (ez / e) * 16;
          c.lunge = 0;
        }
      };
      for (const u of this.buoys) if (u.lit) repel(u.x, u.z, BUOY_SAFE);
      if (this.lighthouseActive) repel(this.lighthouse.x, this.lighthouse.z, LIGHTHOUSE_SAFE);

      c.vx += ax * dt;
      c.vz += az * dt;
      const damp = Math.exp(-2.2 * dt);
      c.vx *= damp;
      c.vz *= damp;
      const maxSpeed = c.lunge > 0 ? LUNGE_SPEED : c.stun > 0 ? 10 : this.def.creatureSpeed;
      const s = Math.hypot(c.vx, c.vz);
      if (s > maxSpeed) {
        c.vx *= maxSpeed / s;
        c.vz *= maxSpeed / s;
      }
      c.x = clamp(c.x + c.vx * dt, cell, (width - 1) * cell);
      c.z = clamp(c.z + c.vz * dt, cell, (height - 1) * cell);

      if (d < 1.1 && c.stun <= 0) {
        this.oil -= HIT_COST;
        c.stun = 2.5;
        c.lunge = 0;
        c.vx = -ux * 9;
        c.vz = -uz * 9;
        this.hitFlash = 0.4;
        this.events.push({ type: 'hit' });
      }
    }
  }

  // Point lights for the renderer, most important first.
  lights() {
    const b = this.boat;
    const t = this.time;
    const flicker = 1 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37);
    const lantern = 0.6 + 0.4 * (this.oil / OIL_MAX);
    const list = [{
      pos: [b.x + Math.sin(b.angle) * 0.3, 1.85, b.z + Math.cos(b.angle) * 0.3],
      color: [2.6 * flicker * lantern, 1.8 * flicker * lantern, 0.9 * flicker * lantern],
      radius: this.lanternRadius,
    }];
    if (this.flareTime > 0) {
      const k = this.flareTime / FLARE_TIME;
      list.push({ pos: [b.x, 4, b.z], color: [2.2 * k, 1.9 * k, 1.5 * k], radius: 24 - 6 * k, flare: true });
    }
    const lh = this.lighthouse;
    if (this.lighthouseActive) {
      list.push({ pos: [lh.x, 6.5, lh.z], color: [1.7, 1.5, 1.1], radius: 17 });
      const s = this.beamSpot;
      list.push({ pos: [s.x, 1.2, s.z], color: [2.0, 1.8, 1.2], radius: 6 });
    } else {
      const pulse = 0.7 + 0.3 * Math.sin(t * 2);
      list.push({ pos: [lh.x, 6.5, lh.z], color: [1.4 * pulse, 0.25 * pulse, 0.15 * pulse], radius: 6 });
    }
    for (const u of this.buoys) {
      if (u.lit) {
        const k = this.buoyStrength(u);
        list.push({ pos: [u.x, 1.6, u.z], color: [0.6 * k, 1.7 * k, 1.4 * k], radius: 3 + 4 * k });
      }
    }
    if (this.lightningFlash > 0 && this.lastStrike) {
      const k = this.lightningFlash / 0.35;
      list.push({ pos: [this.lastStrike.x, 9, this.lastStrike.z], color: [3 * k, 3.2 * k, 4 * k], radius: 30, flare: true });
    }
    const oils = this.oils
      .filter((o) => !o.taken)
      .sort((p, q) => dist(p.x, p.z, b.x, b.z) - dist(q.x, q.z, b.x, b.z));
    for (const o of oils) list.push({ pos: [o.x, 0.8, o.z], color: [1.0, 0.55, 0.2], radius: 2.6 });
    return list;
  }
}
