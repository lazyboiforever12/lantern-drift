// Headless play-tester: a simple bot plays every level many times and prints how it went.
// Run: node tools/autoplay.mjs [runs]
// Useful for difficulty tuning: if the bot wins easily with lots of oil left, a level is too easy.
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels.js';
import { rng, SKILL, createAutopilot } from '../src/autopilot.js';

const RUNS = Number(process.argv[2]) || 20;
const DT = 1 / 60;
const TIME_LIMIT = 150;
const ONLY = process.env.LEVEL ? Number(process.env.LEVEL) - 1 : -1; // e.g. LEVEL=5 to test one level

function playOnce(def, index, seed, skill) {
  const random = rng(seed);
  const game = new Game(def, index);
  for (const c of game.creatures) { c.cool += random() * 2; c.x += random() - 0.5; c.z += random() - 0.5; }
  const think = createAutopilot(game, random, skill);
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
