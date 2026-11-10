// Rule tests for the game logic (no browser needed). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LEVELS, parseLevel } from '../src/levels.js';

const IDLE = { forward: false, back: false, left: false, right: false };
const DT = 1 / 60;
const run = (game, seconds, input = IDLE) => {
  for (let t = 0; t < seconds; t += DT) game.update(DT, input);
};
// A level with no shadows, so tests aren't disturbed by attacks.
const calm = (i = 0) => {
  const g = new Game(LEVELS[i], i);
  g.creatures.length = 0;
  return g;
};

test('every level parses, has buoys, oil and a lighthouse', () => {
  for (const def of LEVELS) {
    const L = parseLevel(def);
    assert.ok(L.buoys.length > 0, def.name);
    assert.ok(L.oils.length > 0, def.name);
    assert.ok(L.lighthouse, def.name);
  }
});

test('oil drains over time at the level rate', () => {
  const g = calm();
  run(g, 2);
  assert.ok(Math.abs(g.oil - (100 - LEVELS[0].drain * 2)) < 0.2);
});

test('oil pickup adds 35, capped at 100', () => {
  const g = calm();
  g.oil = 50;
  const o = g.oils[0];
  g.boat.x = o.x; g.boat.z = o.z;
  g.update(DT, IDLE);
  assert.ok(o.taken);
  assert.ok(g.oil > 84 && g.oil <= 85);
  g.oil = 90;
  const o2 = g.oils[1];
  g.boat.x = o2.x; g.boat.z = o2.z;
  g.update(DT, IDLE);
  assert.equal(g.oil <= 100, true);
});

test('lighting every buoy wakes the lighthouse, and reaching it wins', () => {
  const g = calm();
  for (const u of g.buoys) {
    assert.equal(g.lighthouseActive, false);
    g.boat.x = u.x; g.boat.z = u.z;
    g.update(DT, IDLE);
  }
  assert.equal(g.lighthouseActive, true);
  const lh = g.lighthouse;
  g.boat.x = lh.x - 2.6; g.boat.z = lh.z; g.boat.vx = g.boat.vz = 0;
  g.update(DT, IDLE);
  assert.equal(g.result, 'won');
});

test('the lighthouse does not count as reached before it is awake', () => {
  const g = calm();
  const lh = g.lighthouse;
  g.boat.x = lh.x - 2.6; g.boat.z = lh.z;
  g.update(DT, IDLE);
  assert.equal(g.result, null);
});

test('running out of oil loses', () => {
  const g = calm();
  g.oil = 0.01;
  g.update(DT, IDLE);
  assert.equal(g.result, 'lost');
});

test('a flare costs 12 oil and stuns nearby shadows', () => {
  const g = new Game(LEVELS[0], 0);
  const c = g.creatures[0];
  c.x = g.boat.x + 3; c.z = g.boat.z;
  g.flare();
  assert.equal(g.oil, 88);
  assert.ok(c.stun > 0);
  const before = g.oil;
  g.flare(); // still cooling down
  assert.equal(g.oil, before);
});

test('no flare when oil is too low', () => {
  const g = calm();
  g.oil = 10;
  g.flare();
  assert.equal(g.oil, 10);
  assert.ok(g.events.some((e) => e.type === 'noFlare'));
});

test('a shadow touching the boat steals 18 oil', () => {
  const g = new Game(LEVELS[0], 0);
  g.creatures.length = 1;
  const c = g.creatures[0];
  c.x = g.boat.x + 0.5; c.z = g.boat.z; c.stun = 0;
  g.update(DT, IDLE);
  assert.ok(g.events.some((e) => e.type === 'hit'));
  assert.ok(g.oil < 100 - 17);
});

test('the boat cannot sail through buildings', () => {
  const g = calm();
  g.boat.angle = Math.PI; // facing the top wall
  run(g, 3, { ...IDLE, forward: true });
  // The wall's edge is at z = 2 (one 2-unit cell), and the boat's radius is 0.75.
  assert.ok(g.boat.z >= 2 + 0.75 - 0.01, `z=${g.boat.z}`);
});

test('the boat starts facing open water', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = calm(i);
    const fx = Math.round(Math.sin(g.boat.angle)), fz = Math.round(Math.cos(g.boat.angle));
    const col = Math.floor(g.boat.x / 2) + fx, row = Math.floor(g.boat.z / 2) + fz;
    assert.equal(g.isSolid(col, row), false, LEVELS[i].name);
  }
});

test('currents carry the boat', () => {
  const i = LEVELS.findIndex((d) => d.name === 'The Canals');
  const g = calm(i);
  // Put the boat on a '>' cell and let it drift with no input.
  const row = 1, col = LEVELS[i].map[row].indexOf('>');
  g.boat.x = col * 2 + 1; g.boat.z = row * 2 + 1;
  const x0 = g.boat.x;
  run(g, 1);
  assert.ok(g.boat.x > x0 + 2, `moved ${g.boat.x - x0}`);
});

test('on Ember Bay, lit buoys burn out until the lighthouse wakes', () => {
  const i = LEVELS.findIndex((d) => d.name === 'Ember Bay');
  const g = calm(i);
  const u = g.buoys[0];
  g.boat.x = u.x; g.boat.z = u.z;
  g.update(DT, IDLE);
  assert.equal(u.lit, true);
  g.boat.x = 3; g.boat.z = 3; // sail away
  g.oil = 1e9;                // don't run out while waiting
  run(g, LEVELS[i].buoyTime + 1);
  assert.equal(u.lit, false);
  assert.ok(g.events.some((e) => e.type === 'buoyOut'));
});

test('share codes round-trip every built-in level', async () => {
  const { encodeLevel, decodeLevel } = await import('../src/levels.js');
  for (const def of LEVELS) assert.deepEqual(decodeLevel(encodeLevel(def.map)), def.map, def.name);
  assert.throws(() => decodeLevel('bm90IGEgbGV2ZWw'));
});

test('the level checker catches unfair maps', async () => {
  const { checkLevel } = await import('../src/levels.js');
  const ok = ['#####', '#B.u#', '#..L#', '#####'];
  assert.deepEqual(checkLevel({ map: ok }), []);
  assert.ok(checkLevel({ map: ['#####', '#B.u#', '#...#', '#####'] }).length > 0);   // no lighthouse
  assert.ok(checkLevel({ map: ['#####', '#B#u#', '###L#', '#####'] }).length > 0);   // buoy walled off
  assert.ok(checkLevel({ map: ['##.##', '#B.u#', '#..L#', '#####'] }).length > 0);   // gap in the wall
});

test('storm lightning stuns nearby shadows and can hurt the boat', () => {
  const i = LEVELS.findIndex((d) => d.name === 'The Storm');
  const g = new Game(LEVELS[i], i);
  const c = g.creatures[0];
  c.x = g.boat.x + 3; c.z = g.boat.z;
  g.strike = { x: g.boat.x + 1, z: g.boat.z, warn: 0.01 };
  const oil = g.oil;
  g.update(DT, IDLE);
  assert.ok(c.stun > 0);
  assert.ok(g.oil < oil - 11);
  assert.ok(g.events.some((e) => e.type === 'lightning' && e.hurt));
});

test('shadows never end up inside buildings', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = new Game(LEVELS[i], i);
    g.oil = 1e9;
    for (let t = 0; t < 25; t += DT) {
      g.update(DT, { ...IDLE, forward: t % 6 < 3, left: t % 4 < 1 });
      for (const c of g.creatures) {
        const col = Math.floor(c.x / 2), row = Math.floor(c.z / 2);
        assert.equal(g.isSolid(col, row), false, `${LEVELS[i].name}: shadow inside a wall at ${c.x.toFixed(1)},${c.z.toFixed(1)}`);
      }
    }
  }
});

test('boat stats change how the game plays', async () => {
  const { boatStats } = await import('../src/boats.js');
  const tug = new Game(LEVELS[0], 0, boatStats('tug', { tank: 3 }));
  assert.equal(tug.oil, 150 + 36);         // bigger tank, full at the start
  tug.creatures.length = 0;
  const skiff = new Game(LEVELS[0], 0);
  skiff.creatures.length = 0;
  run(tug, 2); run(skiff, 2);
  assert.ok(186 - tug.oil < 100 - skiff.oil, 'the tug burns less oil');
  const racer = new Game(LEVELS[2], 2, boatStats('racer', { engine: 3 }));
  racer.creatures.length = 0;
  racer.boat.x = 20; racer.boat.z = 19; racer.boat.angle = Math.PI / 2; // open water in The Old Harbour
  run(racer, 1.5, { ...IDLE, forward: true });
  assert.ok(Math.hypot(racer.boat.vx, racer.boat.vz) > 8, 'the racer is faster than the skiff can go');
});

test('special ship traits work', async () => {
  const { boatStats } = await import('../src/boats.js');
  // Battleship armour: a hit steals half as much.
  const bs = new Game(LEVELS[0], 0, boatStats('battleship'));
  bs.creatures.length = 1;
  const c = bs.creatures[0];
  c.x = bs.boat.x + 0.5; c.z = bs.boat.z; c.stun = 0;
  bs.update(DT, IDLE);
  assert.ok(bs.tank - bs.oil < 10, `battleship lost ${bs.tank - bs.oil}`);
  // Couch: less oil used while not rowing.
  const couch = new Game(LEVELS[0], 0, boatStats('couch'));
  couch.creatures.length = 0;
  run(couch, 2);
  assert.ok(couch.tank - couch.oil < LEVELS[0].drain * 2 * 0.65);
  // Carrier: lights a buoy from 4 units away.
  const cv = new Game(LEVELS[0], 0, boatStats('carrier'));
  cv.creatures.length = 0;
  const u = cv.buoys[0];
  cv.boat.x = u.x + 4; cv.boat.z = u.z;
  cv.update(DT, IDLE);
  assert.equal(u.lit, true);
  // Cruise ship: oil cans give 50% more.
  const cr = new Game(LEVELS[0], 0, boatStats('cruise'));
  cr.creatures.length = 0;
  cr.oil = 50;
  const o = cr.oils[0];
  cr.boat.x = o.x; cr.boat.z = o.z;
  cr.update(DT, IDLE);
  assert.ok(cr.oil > 50 + 35 * 1.5 - 1);
  // Warship: cheaper flares.
  const ws = new Game(LEVELS[0], 0, boatStats('cruiser'));
  ws.flare();
  assert.ok(Math.abs(ws.tank - ws.oil - 12 * 0.6) < 0.01);
});

// ---------- Generated voyages ----------
import { generateVoyage, dailyVoyage, voyageDifficulty, hashString } from '../src/voyages.js';
import { checkLevel } from '../src/levels.js';

test('generated voyages are fair at every depth, and the same seed builds the same map', () => {
  for (let depth = 0; depth < 16; depth++) {
    for (let s = 0; s < 15; s++) {
      const seed = 100 + s * 977 + depth;
      const def = generateVoyage(seed, depth);
      assert.deepEqual(checkLevel(def), [], `${def.name} (seed ${seed}, depth ${depth})`);
      assert.deepEqual(generateVoyage(seed, depth).map, def.map);
      const L = parseLevel(def);
      assert.ok(L.oils.length >= 3 && L.buoys.length >= 3, def.name);
      // Shadows never start right on top of the boat.
      for (const c of L.creatures) assert.ok(Math.hypot(c.x - L.start.x, c.z - L.start.z) >= 18, def.name);
    }
  }
});

test('voyages get harder with depth', () => {
  for (let d = 1; d < 30; d++) {
    const a = voyageDifficulty(d - 1), b = voyageDifficulty(d);
    assert.ok(b.drain >= a.drain && b.creatureSpeed >= a.creatureSpeed && b.lungeCooldown <= a.lungeCooldown);
    assert.ok(b.creatures >= a.creatures && b.buoys >= a.buoys);
  }
});

test('the Daily Voyage is the same all day and changes the next day', () => {
  const a = dailyVoyage('2026-11-10');
  assert.deepEqual(dailyVoyage('2026-11-10').map, a.map);
  assert.notDeepEqual(dailyVoyage('2026-11-11').map, a.map);
  assert.equal(a.daily, '2026-11-10');
  assert.notEqual(hashString('a'), hashString('b'));
});

// ---------- Ray-traced shadows ----------
import { readFileSync } from 'node:fs';
import { buildingHeight } from '../src/meshes.js';

test('no roof is taller than the shadow tracer assumes', () => {
  // The shader stops a ray once it climbs above ROOF_MAX, so every building must be lower.
  const src = readFileSync(new URL('../src/shaders.js', import.meta.url), 'utf8');
  const roofMax = Number(src.match(/#define ROOF_MAX ([\d.]+)/)[1]);
  for (let c = 0; c < 80; c++) for (let r = 0; r < 60; r++) assert.ok(buildingHeight(c, r) < roofMax);
});

// ---------- Level editor v2 ----------
import { encodeShare, decodeShare, customLevel, encodeLevel as encodeMap } from '../src/levels.js';

test('share links carry the level name, difficulty and twist, and old codes still load', () => {
  const map = LEVELS[0].map;
  const back = decodeShare(encodeShare({ map, difficulty: 3, twist: 2, name: 'Harbour ✦ #1' }));
  assert.deepEqual(back.map, map);
  assert.equal(back.difficulty, 3);
  assert.equal(back.twist, 2);
  assert.equal(back.name, 'Harbour ✦ #1');
  const old = decodeShare(encodeMap(map));
  assert.equal(old.difficulty, 1);
  assert.equal(old.twist, 0);
  const def = customLevel(back);
  assert.ok(def.storm && def.creatureSpeed > customLevel(old).creatureSpeed);
  assert.equal(customLevel({ map, twist: 1 }).buoyTime, 40);
});

test('the editor\'s Random button builds fair 32 x 16 maps', () => {
  for (let s = 0; s < 30; s++) {
    const def = generateVoyage(s * 101, 1 + (s % 4), 'none', { width: 32, height: 16 });
    assert.equal(def.map.length, 16);
    assert.ok(def.map.every((row) => row.length === 32));
    assert.deepEqual(checkLevel(def), []);
  }
});

// ---------- Achievements ----------
import { Achievements, ACHIEVEMENTS } from '../src/achievements.js';

test('achievements unlock once, from totals, clears and the Boatyard', () => {
  const save = {};
  const got = [];
  const a = new Achievements(save, (x) => got.push(x.id));
  a.record('buoys');
  a.record('buoys');
  assert.deepEqual(got, ['firstLight']);
  for (let i = 0; i < 10; i++) a.record('flares');
  assert.ok(a.has('flares10') && !a.has('flares100'));
  a.cleared({ kind: 'story', levelIndex: 0, time: 35, oilPct: 80, hits: 0 });
  for (const id of ['harbour', 'untouched', 'thrifty', 'speedy']) assert.ok(a.has(id), id);
  a.cleared({ kind: 'endless', voyage: 5, oilPct: 50, hits: 2 });
  assert.ok(a.has('voyage5') && !a.has('voyage10'));
  a.boatyard({ boats: { skiff: { engine: 3 }, tug: {} }, paints: ['oak', 'tar', 'red'] }, 2);
  for (const id of ['shipowner', 'tinkerer', 'painter']) assert.ok(a.has(id), id);
  assert.equal(new Set(got).size, got.length); // nothing unlocked twice
  assert.equal(new Set(ACHIEVEMENTS.map((x) => x.id)).size, ACHIEVEMENTS.length);
});

test('a flare reports how many shadows it stunned', () => {
  const g = new Game(LEVELS[1], 1);
  for (const c of g.creatures) { c.x = g.boat.x + 1; c.z = g.boat.z; }
  g.flare();
  assert.equal(g.events.find((e) => e.type === 'flare').stunned, g.creatures.length);
});

// ---------- Whirlpools and ember shards ----------
const pool = (extra) => ({
  name: 'Pool', drain: 0, creatureSpeed: 3, lungeCooldown: 3,
  map: [
    '################',
    '#B.............#',
    '#..............#',
    '#..........w...#',
    '#.....e........#',
    '#...........u.L#',
    '################',
    ...(extra || []),
  ],
});

test('a whirlpool pulls the boat in, and its middle spits it out and costs oil', () => {
  const g = new Game(pool(), 0);
  const w = g.whirlpools[0];
  g.boat.x = w.x - 2.5; g.boat.z = w.z; g.boat.vx = 0; g.boat.vz = 0;
  g.update(DT, IDLE);
  assert.ok(g.boat.vx > 0, 'pulled towards the middle');
  g.boat.x = w.x + 0.2; g.boat.z = w.z;
  const before = g.oil;
  g.update(DT, IDLE);
  assert.ok(g.oil < before - 7, 'lost oil in the middle');
  assert.ok(g.events.some((e) => e.type === 'whirl' && e.boat));
  assert.ok(Math.hypot(g.boat.vx, g.boat.vz) > 8, 'flung out');
});

test('a whirlpool stuns a shadow dragged into its middle', () => {
  const g = new Game(pool(), 0);
  const w = g.whirlpools[0];
  g.creatures.push({ x: w.x + 0.3, z: w.z, vx: 0, vz: 0, stun: 0, lunge: 0, cool: 9, seed: 0 });
  g.update(DT, IDLE);
  assert.ok(g.creatures[0].stun > 3);
  assert.ok(g.events.some((e) => e.type === 'whirl' && !e.boat));
});

test('ember shards are picked up once, and the checker keeps whirlpools away from the start', () => {
  const g = new Game(pool(), 0);
  const s = g.shards[0];
  g.boat.x = s.x; g.boat.z = s.z;
  g.update(DT, IDLE);
  g.update(DT, IDLE);
  assert.equal(g.events.filter((e) => e.type === 'shard').length, 1);
  assert.equal(g.shardsTaken, 1);
  const near = pool();
  near.map[2] = '#..w...........#';
  assert.ok(checkLevel(near).some((p) => p.includes('whirlpool')));
  for (const def of LEVELS) assert.equal(new Game(def, 0).shards.length, 3, def.name);
});

// ---------- Maths ----------
import { invert, multiply as mul, perspective as persp, lookAt as look } from '../src/math.js';

test('a matrix times its inverse is the identity (the sky relies on it)', () => {
  const m = mul(persp(0.8, 1.6, 0.5, 120), look([4, 21, 12], [4, 0, 5.5]));
  const p = mul(m, invert(m));
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(p[i] - (i % 5 === 0 ? 1 : 0)) < 1e-4);
});
