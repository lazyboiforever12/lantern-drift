// Autopilot: a simple bot that plays a level. The title screen uses it for the live demo,
// and tools/autoplay.mjs uses it to play-test difficulty.
// It follows a travel-cost map (rowing with a current is cheap, against it is dear) to the
// nearest unlit buoy, oil when it's worth the detour, then the lighthouse, and fires a flare
// when a shadow gets close.

// Seeded random so play-tests are repeatable.
export function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Two skill levels: 'good' reacts fast and flares well, 'sloppy' is closer to a first-time player.
export const SKILL = {
  good: { react: 0.1, flareChance: 0.85, jitter: 0.2 },
  sloppy: { react: 0.28, flareChance: 0.45, jitter: 0.9 },
};

// Travel cost from every water cell to the goal cell (a small Dijkstra search; the grids are tiny).
function distanceField(game, gx, gz) {
  const { grid, width, height, cell } = game.level;
  const start = [Math.floor(gx / cell), Math.floor(gz / cell)];
  const d = new Float64Array(width * height).fill(Infinity); // 64-bit: 32-bit rounding made the search loop
  const open = [[0, start[0], start[1]]];
  d[start[1] * width + start[0]] = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [cost, c, r] = open.splice(bi, 1)[0];
    if (cost > d[r * width + c]) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
      if (game.isSolid(nc, nr) && !(grid[nr][nc] === 'L')) continue;
      // The boat travels from (nc, nr) towards (c, r), i.e. in direction (-dc, -dr).
      const cur = game.currentAt(nc * cell + cell / 2, nr * cell + cell / 2);
      const withFlow = cur ? cur.x * -dc + cur.z * -dr : 0;
      const step = Math.max(0.35, 1 - 0.65 * withFlow);
      const k = nr * width + nc;
      if (cost + step < d[k]) { d[k] = cost + step; open.push([cost + step, nc, nr]); }
    }
  }
  return d;
}

// Returns think(): call it every so often for { forward, back, left, right, flare }.
export function createAutopilot(game, random = Math.random, skill = SKILL.good) {
  const fields = new Map();
  const field = (p) => {
    if (!fields.has(p)) fields.set(p, distanceField(game, p.x, p.z));
    return fields.get(p);
  };
  const { width, cell } = game.level;
  const cellOf = (x, z) => Math.floor(z / cell) * width + Math.floor(x / cell);

  return function think() {
    const b = game.boat;
    const here = cellOf(b.x, b.z);
    // Pick a target: the nearest unlit buoy, or oil when it's worth the detour.
    const options = [];
    for (const u of game.buoys) if (!u.lit) options.push({ p: u, w: 1 });
    if (game.lighthouseActive) options.push({ p: game.lighthouse, w: 1 });
    const oilWeight = game.oil > 75 ? 4 : game.oil > 45 ? 1.3 : 0.4;
    for (const o of game.oils) if (!o.taken) options.push({ p: o, w: oilWeight });
    let best = null, bestCost = Infinity;
    for (const o of options) {
      const cost = field(o.p)[here] * o.w;
      if (cost < bestCost) { bestCost = cost; best = o.p; }
    }
    if (!best) return { forward: false, back: false, left: false, right: false, flare: false };

    // Follow the distance field downhill a few cells ahead.
    const f = field(best);
    let c = Math.floor(b.x / cell), r = Math.floor(b.z / cell);
    let tx = best.x, tz = best.z;
    for (let step = 0; step < 2 && f[r * width + c] > 1; step++) {
      let next = null, nd = f[r * width + c];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (r + dr) * width + (c + dc);
        if (f[k] < nd) { nd = f[k]; next = [c + dc, r + dr]; }
      }
      if (!next) break;
      [c, r] = next;
      tx = c * cell + cell / 2;
      tz = r * cell + cell / 2;
    }
    const want = Math.atan2(tx - b.x, tz - b.z);
    let diff = want - b.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const jitter = (random() - 0.5) * skill.jitter;

    // Flare when a shadow is about to reach us.
    let flare = false;
    for (const cr of game.creatures) {
      const d = Math.hypot(cr.x - b.x, cr.z - b.z);
      if (cr.stun <= 0 && (d < 2.2 || (cr.lunge > 0 && d < 4))) flare = random() < skill.flareChance;
    }
    return {
      forward: Math.abs(diff) < 1.1,
      back: false,
      left: diff + jitter > 0.08,
      right: diff + jitter < -0.08,
      flare,
    };
  };
}
