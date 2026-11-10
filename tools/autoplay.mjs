// Headless play-tester: a simple bot plays every level many times and prints how it went.
// Run: node tools/autoplay.mjs [runs]
// Useful for difficulty tuning: if the bot wins easily with lots of oil left, a level is too easy.
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels.js';

const RUNS = Number(process.argv[2]) || 20;
// Two skill levels: 'good' reacts fast and flares well, 'sloppy' is closer to a first-time player.
const SKILL = {
  good: { react: 0.1, flareChance: 0.85, jitter: 0.2 },
  sloppy: { react: 0.28, flareChance: 0.45, jitter: 0.9 },
};
const DT = 1 / 60;
const TIME_LIMIT = 150;
const ONLY = process.env.LEVEL ? Number(process.env.LEVEL) - 1 : -1; // e.g. LEVEL=5 to test one level

// Seeded random so results are repeatable.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Travel cost from every water cell to the goal cell. Rowing with a current is cheap,
// against it is expensive (a small Dijkstra search; the grids are tiny).
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

function makeBot(game, random, skill) {
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

function playOnce(def, index, seed, skill) {
  const random = rng(seed);
  const game = new Game(def, index);
  for (const c of game.creatures) { c.cool += random() * 2; c.x += random() - 0.5; c.z += random() - 0.5; }
  const think = makeBot(game, random, skill);
  const stats = { hits: 0, flares: 0, minOil: 100, bumps: 0 };
  let thinkTimer = 0, input = null;
  while (!game.result && game.time < TIME_LIMIT) {
    thinkTimer -= DT;
    if (thinkTimer <= 0) { input = think(); thinkTimer = skill.react + random() * 0.08; } // human-ish reaction time
    if (input.flare) { game.flare(); input.flare = false; }
    game.update(DT, input);
    for (const e of game.events) {
      if (e.type === 'hit') stats.hits++;
      if (e.type === 'flare') stats.flares++;
      if (e.type === 'bump') stats.bumps++;
    }
    game.events.length = 0;
    stats.minOil = Math.min(stats.minOil, game.oil);
  }
  if (process.env.TRACE) console.log(`run ${seed}: ${game.result || 'timeout'} at ${game.time.toFixed(0)}s`);
  if (process.env.TRACE && !game.result) {
    const b = game.boat;
    console.log(`timeout at cell ${Math.floor(b.x / 2)},${Math.floor(b.z / 2)} oil ${game.oil.toFixed(0)} lit ${game.buoysLit}/${game.buoys.length}`);
  }
  return { result: game.result || 'timeout', time: game.time, oil: game.oil, ...stats };
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

// VOYAGES=1: play generated voyages instead, a different map for every run, at each depth.
if (process.env.VOYAGES) {
  const { generateVoyage, dailyVoyage } = await import('../src/voyages.js');
  for (const [skillName, skill] of Object.entries(SKILL)) {
    console.log(`--- ${skillName} bot, generated voyages ---`);
    for (let depth = 0; depth < 12; depth++) {
      const runs = [];
      for (let s = 0; s < RUNS; s++) runs.push(playOnce(generateVoyage(5000 + s * 31 + depth * 1009, depth), 0, 1000 + s * 77, skill));
      const wins = runs.filter((r) => r.result === 'won');
      console.log(`depth ${String(depth).padStart(2)}  win ${String(wins.length).padStart(2)}/${RUNS}  time ${avg(wins.map((r) => r.time)).toFixed(1).padStart(5)}s  timeouts ${runs.filter((r) => r.result === 'timeout').length}`);
    }
    const daily = [];
    for (let d = 1; d <= RUNS; d++) daily.push(playOnce(dailyVoyage(`2026-11-${String(d).padStart(2, '0')}`), 0, 2000 + d, skill));
    console.log(`daily (Nov 1-${RUNS})  win ${daily.filter((r) => r.result === 'won').length}/${RUNS}`);
  }
  process.exit(0);
}

for (const [skillName, skill] of Object.entries(SKILL)) {
console.log(`--- ${skillName} bot ---`);
LEVELS.forEach((def, i) => {
  if (ONLY >= 0 && i !== ONLY) return;
  const runs = [];
  for (let s = 0; s < RUNS; s++) runs.push(playOnce(def, i, 1000 + s * 77, skill));
  const wins = runs.filter((r) => r.result === 'won');
  const fmt = (x) => x.toFixed(1).padStart(5);
  console.log(
    `${String(i + 1)}. ${def.name.padEnd(20)} win ${String(wins.length).padStart(2)}/${RUNS}` +
    `  time ${fmt(avg(wins.map((r) => r.time)))}s  oil left ${fmt(avg(wins.map((r) => r.oil)))}` +
    `  min oil ${fmt(avg(runs.map((r) => r.minOil)))}  hits ${fmt(avg(runs.map((r) => r.hits)))}` +
    `  flares ${fmt(avg(runs.map((r) => r.flares)))}  bumps ${fmt(avg(runs.map((r) => r.bumps)))}` +
    `  losses ${runs.filter((r) => r.result === 'lost').length} timeouts ${runs.filter((r) => r.result === 'timeout').length}`,
  );
});
}
