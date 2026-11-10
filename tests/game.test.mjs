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
