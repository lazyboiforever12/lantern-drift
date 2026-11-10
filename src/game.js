// Game rules: steering the boat, oil, buoys, the lighthouse and the shadow creatures.
import { parseLevel, CURRENTS } from './levels.js';
import { clamp, dist } from './math.js';
import { BASE_STATS } from './boats.js';

const SHADOW_RADIUS = 0.55;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
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
// Kinds of shadow. speed and lunge scale the level's shadow speed; steal scales stolen oil;
// a brute needs two flares close together: the first only staggers it.
export const CREATURE_KINDS = {
  shadow: { speed: 1, lunge: 1, steal: 1, radius: SHADOW_RADIUS, scale: 1, tough: false },
  wisp: { speed: 1.45, lunge: 1.15, steal: 0.5, radius: 0.4, scale: 0.65, tough: false },
  brute: { speed: 0.7, lunge: 0.8, steal: 1.8, radius: 0.8, scale: 1.5, tough: true },
};
export const WHIRL_RADIUS = 3.4;  // how far a whirlpool's pull reaches
const WHIRL_CORE = 0.8;      // caught in the middle: spat out (the boat loses oil, a shadow is stunned)
const WHIRL_COST = 8;
const SHARD_EMBERS = 3;
export const DASH_TIME = 0.45;     // seconds of boost
const DASH_COOLDOWN = 2.2;
const DASH_COST = 4;
const DASH_SPEED = 1.7;            // top speed multiplier while dashing

export class Game {
  // stats: the boat's performance from the Boatyard (defaults to the starter skiff).
  constructor(def, index, stats = BASE_STATS) {
    this.stats = stats;
    this.def = def;
    this.index = index;
    this.level = parseLevel(def);
    const L = this.level;
    this.boat = { x: L.start.x, z: L.start.z, angle: this.openHeading(L.start), vx: 0, vz: 0 };
    this.tank = stats.tank;
    this.oil = this.tank;
    this.oils = L.oils.map((p) => ({ ...p, taken: false }));
    this.buoys = L.buoys.map((p) => ({ ...p, lit: false }));
    this.creatures = L.creatures.map((p, i) => ({
      x: p.x, z: p.z, vx: 0, vz: 0, stun: 0, lunge: 0, cool: 3 + i * 1.3, seed: i, kind: p.kind || 'shadow', stagger: 0,
    }));
    this.lighthouse = L.lighthouse;
    this.whirlpools = L.whirlpools.map((p) => ({ ...p, cool: 0 }));
    this.shards = L.shards.map((p) => ({ ...p, taken: false }));
    this.lighthouseActive = false;
    this.flareTime = 0;
    this.flareCooldown = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
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

  // Oil as a percentage of this boat's tank.
  get oilPct() {
    return (100 * this.oil) / this.tank;
  }

  get buoysLit() {
    return this.buoys.filter((b) => b.lit).length;
  }

  // How far the lantern reaches. It shrinks as the oil runs low.
  get lanternRadius() {
    return (4 + 8 * (this.oil / this.tank)) * this.stats.lantern;
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

  // A short burst of speed for a little oil: good for escaping a lunge or crossing a current.
  dash() {
    if (this.result || this.dashCooldown > 0 || this.oil < DASH_COST + 1) return;
    this.oil -= DASH_COST;
    this.dashTime = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN;
    this.events.push({ type: 'dash' });
  }

  flare() {
    if (this.result || this.flareCooldown > 0) return;
    const st = this.stats;
    const cost = FLARE_COST * st.flareCost;
    if (this.oil < cost + 1) {
      this.events.push({ type: 'noFlare' });
      return;
    }
    this.oil -= cost;
    this.flareTime = FLARE_TIME;
    this.flareCooldown = 1.5 * st.flareCooldown;
    const b = this.boat;
    let stunned = 0;
    for (const c of this.creatures) {
      const d = dist(c.x, c.z, b.x, b.z);
      if (d < FLARE_RANGE * st.flareRange) {
        const ux = (c.x - b.x) / (d || 1), uz = (c.z - b.z) / (d || 1);
        c.lunge = 0;
        if ((CREATURE_KINDS[c.kind] || CREATURE_KINDS.shadow).tough && !(c.stagger > 0)) {
          // A brute shrugs off the first flare: knocked back and briefly dazed, but ready for a second.
          c.stagger = 4;
          c.vx = ux * 6;
          c.vz = uz * 6;
          c.stun = Math.max(c.stun, 0.5);
          continue;
        }
        stunned++;
        if (c.kind === 'brute') this.events.push({ type: 'bruteStun', x: c.x, z: c.z });
        c.stagger = 0;
        c.vx = ux * 10;
        c.vz = uz * 10;
        c.stun = 2.5 * st.stunMult;
      }
    }
    this.events.push({ type: 'flare', stunned });
  }

  update(dt, input) {
    if (this.result) return;
    this.time += dt;
    if (this.storm) this.updateStorm(dt);
    this.flareTime = Math.max(0, this.flareTime - dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.updateBoat(dt, input);
    this.updatePickups();
    this.updateCreatures(dt);
    if (this.whirlpools.length) this.updateWhirlpools(dt);

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

    const idle = input.forward || input.back ? 1 : this.stats.idleDrain; // the couch saves oil at rest
    this.oil -= this.def.drain * this.stats.drain * idle * dt;
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
    const st = this.stats;
    b.angle += turn * (st.turn + Math.min(speed, 6) * 0.2) * dt;

    const fx = Math.sin(b.angle), fz = Math.cos(b.angle);
    b.vx += fx * thrust * st.thrust * dt;
    b.vz += fz * thrust * st.thrust * dt;

    // Water drag: little along the hull, a lot sideways (like a keel).
    let along = b.vx * fx + b.vz * fz;
    let side = b.vx * fz - b.vz * fx;
    if (this.dashTime > 0) along = Math.max(along, st.maxSpeed * DASH_SPEED * (this.dashTime / DASH_TIME) ** 0.5);
    along = clamp(along * Math.exp(-1.2 * dt), -3, st.maxSpeed * (this.dashTime > 0 ? DASH_SPEED : 1));
    side *= Math.exp(-st.grip * dt);
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

  collideBoat() {
    const vn = this.collideCircle(this.boat, this.stats.radius, 1.3);
    if (vn < -3) {
      this.events.push({ type: 'bump' });
      if (this.stats.bumpCost) this.oil -= this.stats.bumpCost; // the Titanic's iceberg allergy
    }
  }

  // A circle (boat or shadow) against the square cells of buildings. Pushes it out and
  // bounces its velocity. Returns the strongest speed it hit a wall with (negative).
  collideCircle(b, r, bounce) {
    const { cell } = this.level;
    let worst = 0;
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
          b.vx -= vn * nx * bounce;
          b.vz -= vn * nz * bounce;
          worst = Math.min(worst, vn);
        }
      }
    }
    return worst;
  }

  // True if nothing solid lies on the straight line between two points.
  clearLine(ax, az, bx, bz) {
    const { cell } = this.level;
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (cell * 0.25));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolid(Math.floor((ax + (bx - ax) * t) / cell), Math.floor((az + (bz - az) * t) / cell))) return false;
    }
    return true;
  }

  // Flow field: for every water cell, how many steps it is to the boat (refreshed a few
  // times a second). A shadow that can't see the boat walks downhill on it, around buildings.
  updateFlowField() {
    const { width, height, cell } = this.level;
    if (!this.flow) this.flow = new Int16Array(width * height);
    const f = this.flow.fill(-1);
    const sc = Math.floor(this.boat.x / cell), sr = Math.floor(this.boat.z / cell);
    const queue = [sr * width + sc];
    f[queue[0]] = 0;
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      const c = k % width, r = (k - c) / width;
      for (const [dc, dr] of NEIGHBOURS) {
        const nc = c + dc, nr = r + dr;
        if (this.isSolid(nc, nr)) continue;
        // No cutting corners diagonally past a building.
        if (dc && dr && (this.isSolid(c + dc, r) || this.isSolid(c, r + dr))) continue;
        const nk = nr * width + nc;
        if (f[nk] !== -1) continue;
        f[nk] = f[k] + 1;
        queue.push(nk);
      }
    }
  }

  // The direction a shadow at (x, z) should go to reach the boat around the buildings.
  flowDirection(x, z) {
    const { width, cell } = this.level;
    const c = Math.floor(x / cell), r = Math.floor(z / cell);
    const here = this.flow[r * width + c];
    let best = null, bestD = here >= 0 ? here : 1e9;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc, nr = r + dr;
      if (this.isSolid(nc, nr)) continue;
      if (dc && dr && (this.isSolid(c + dc, r) || this.isSolid(c, r + dr))) continue;
      const d = this.flow[nr * width + nc];
      if (d >= 0 && d < bestD) { bestD = d; best = [nc, nr]; }
    }
    if (!best) return null;
    const tx = best[0] * cell + cell / 2 - x, tz = best[1] * cell + cell / 2 - z;
    const l = Math.hypot(tx, tz) || 1;
    return { x: tx / l, z: tz / l };
  }

  // Whirlpools pull things towards their middle and swirl them around it. Skimming the edge
  // slingshots the boat; the middle spits it out and costs oil. Shadows dragged in get stunned.
  whirlPull(x, z, dt) {
    let fx = 0, fz = 0, core = null;
    for (const w of this.whirlpools) {
      const dx = w.x - x, dz = w.z - z;
      const d = Math.hypot(dx, dz);
      if (d >= WHIRL_RADIUS || d < 1e-4) continue;
      const k = 1 - d / WHIRL_RADIUS;
      const ux = dx / d, uz = dz / d;
      fx += (ux * 7 + uz * 6) * k * dt;   // inward, plus a sideways swirl
      fz += (uz * 7 - ux * 6) * k * dt;
      if (d < WHIRL_CORE && w.cool <= 0) core = w;
    }
    return { fx, fz, core };
  }

  updateWhirlpools(dt) {
    for (const w of this.whirlpools) w.cool = Math.max(0, w.cool - dt);
    const b = this.boat;
    const p = this.whirlPull(b.x, b.z, dt);
    b.vx += p.fx;
    b.vz += p.fz;
    if (p.core) {
      p.core.cool = 1.5;
      const a = this.random() * Math.PI * 2; // seeded, so tests repeat
      b.vx = Math.sin(a) * 9;
      b.vz = Math.cos(a) * 9;
      this.oil -= WHIRL_COST;
      this.events.push({ type: 'whirl', x: p.core.x, z: p.core.z, boat: true });
    }
    for (const c of this.creatures) {
      const q = this.whirlPull(c.x, c.z, dt);
      c.x += q.fx * 0.25;
      c.z += q.fz * 0.25;
      if (q.core) {
        q.core.cool = 1.5;
        c.stun = Math.max(c.stun, 4);
        c.lunge = 0;
        c.vx = (c.x - q.core.x) * 6;
        c.vz = (c.z - q.core.z) * 6;
        this.events.push({ type: 'whirl', x: q.core.x, z: q.core.z, boat: false });
      }
    }
  }

  get shardsTaken() {
    return this.shards.filter((s) => s.taken).length;
  }

  updatePickups() {
    const b = this.boat;
    for (const s of this.shards) {
      if (!s.taken && dist(b.x, b.z, s.x, s.z) < 1.4) {
        s.taken = true;
        this.events.push({ type: 'shard', x: s.x, z: s.z, embers: SHARD_EMBERS });
      }
    }
    for (const o of this.oils) {
      if (!o.taken && dist(b.x, b.z, o.x, o.z) < 1.5) {
        o.taken = true;
        this.oil = Math.min(this.tank, this.oil + OIL_PICKUP * this.stats.pickup);
        this.events.push({ type: 'oil', x: o.x, z: o.z });
      }
    }
    for (const u of this.buoys) {
      if (!u.lit && dist(b.x, b.z, u.x, u.z) < 2.4 * this.stats.buoyRange) {
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
    this.flowTimer = (this.flowTimer || 0) - dt;
    if (this.flowTimer <= 0 || !this.flow) {
      this.flowTimer = 0.25;
      this.updateFlowField();
    }
    for (const c of this.creatures) {
      const kind = CREATURE_KINDS[c.kind] || CREATURE_KINDS.shadow;
      c.stun = Math.max(0, c.stun - dt);
      c.stagger = Math.max(0, (c.stagger || 0) - dt);
      c.cool -= dt;
      if (c.lunge > 0) c.lunge -= dt;

      const dx = b.x - c.x, dz = b.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const ux = dx / d, uz = dz / d;
      let ax = 0, az = 0;
      // Can this shadow see the boat? If not, it follows the flow field around buildings.
      const sees = this.clearLine(c.x, c.z, b.x, b.z) && d < this.stats.stealth;
      const way = sees ? { x: ux, z: uz } : this.flowDirection(c.x, c.z) || { x: ux, z: uz };

      if (c.stun > 0) {
        // Drift away, dazed.
      } else if (c.lunge > 0) {
        ax += way.x * 24; az += way.z * 24;
      } else if (d < fear && sees) {
        ax -= ux * 8; az -= uz * 8;
      } else {
        // Beyond stealth range a shadow hasn't noticed you: it only drifts about.
        const hunt = d < this.stats.stealth ? 2 : 0.4;
        ax += way.x * this.def.creatureSpeed * kind.speed * hunt;
        az += way.z * this.def.creatureSpeed * kind.speed * hunt;
        if (c.cool <= 0 && sees && d < fear + LUNGE_RANGE) {
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
      const maxSpeed = c.lunge > 0 ? LUNGE_SPEED * kind.lunge : c.stun > 0 ? 10 : this.def.creatureSpeed * kind.speed;
      const s = Math.hypot(c.vx, c.vz);
      if (s > maxSpeed) {
        c.vx *= maxSpeed / s;
        c.vz *= maxSpeed / s;
      }
      c.x = clamp(c.x + c.vx * dt, cell, (width - 1) * cell);
      c.z = clamp(c.z + c.vz * dt, cell, (height - 1) * cell);
      // Shadows can't pass through buildings any more: they slide along walls like the boat.
      this.collideCircle(c, kind.radius, 1.0);

      if (d < 0.55 + kind.radius && c.stun <= 0) {
        this.oil -= HIT_COST * kind.steal * this.stats.hitMult;
        c.stun = 2.5 * this.stats.stunMult;
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
    const lantern = 0.6 + 0.4 * (this.oil / this.tank);
    const list = [{
      pos: [b.x + Math.sin(b.angle) * this.stats.lanternZ, this.stats.lanternY, b.z + Math.cos(b.angle) * this.stats.lanternZ],
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
