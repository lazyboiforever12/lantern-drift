// Procedural voyages: endless, seeded levels for the Daily Voyage and Endless mode.
// The same seed always builds the same map, so everyone gets the same Daily Voyage.
// Every map is checked with checkLevel (the editor's fairness check) before it's used.
import { checkLevel } from './levels.js';

// mulberry32: a tiny, fast seeded random number generator (returns 0..1).
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turns a string (like a date) into a 32-bit seed (FNV-1a hash).
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Today's date as YYYY-MM-DD in the player's own time zone.
export function todayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const ADJ = ['Drowned', 'Quiet', 'Sunken', 'Willow', 'Copper', 'Misty', 'Hollow', 'Broken', 'Silver', 'Ashen',
  'Winding', 'Forgotten', 'Moonlit', 'Tidal', 'Crooked', 'Lonely', 'Amber', 'Rainy', 'Weeping', 'Narrow'];
const NOUN = ['Lanes', 'Basin', 'Wharf', 'Arcade', 'Square', 'Docks', 'Canal', 'Terraces', 'Market', 'Crossing',
  'Quay', 'Reach', 'Moorings', 'Steps', 'Gardens', 'Yard', 'Rows', 'Bridges', 'Corner', 'Harbour'];

// How hard a voyage is at a given depth (0 = the first voyage of an Endless run).
export function voyageDifficulty(depth) {
  return {
    drain: Math.min(2.7, 2.15 + depth * 0.05),
    creatureSpeed: Math.min(4.0, 2.6 + depth * 0.13),
    lungeCooldown: Math.max(2.6, 3.5 - depth * 0.08),
    buoys: 3 + Math.min(4, Math.floor(depth / 2)),
    creatures: 1 + Math.min(6, Math.floor(depth * 0.7)),
  };
}

// Builds one voyage. twist picks an extra rule: 'none', 'fading' (buoys burn out), 'storm' or 'currents'.
// size: optional { width, height } to force a map size (the level editor's Random button uses 32 x 16).
export function generateVoyage(seed, depth, twist = autoTwist(depth), size = null) {
  // Each failed attempt tries a new seed with fewer buildings; the last attempt is open water,
  // which always passes, so this never gives up.
  for (let attempt = 0; attempt < 40; attempt++) {
    const density = attempt < 30 ? 1 : 0.4;
    const def = buildVoyage((seed + attempt * 7919) >>> 0, depth, twist, attempt === 39 ? 0 : density, size);
    if (checkLevel(def).length === 0) return def;
  }
  throw new Error('Could not build a voyage'); // unreachable in practice: open water always passes
}

function autoTwist(depth) {
  if (depth >= 5 && depth % 5 === 4) return 'storm';
  if (depth >= 3 && depth % 4 === 3) return 'fading';
  if (depth >= 2 && depth % 3 === 2) return 'currents';
  return 'none';
}

function buildVoyage(seed, depth, twist, density, size) {
  const rand = seededRandom(seed);
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const W = size ? size.width : 30 + Math.min(14, depth * 2) + int(0, 4);
  const H = size ? size.height : 14 + Math.min(6, depth) + int(0, 2);
  const g = [];
  for (let r = 0; r < H; r++) {
    g.push([]);
    for (let c = 0; c < W; c++) g[r].push(r === 0 || c === 0 || r === H - 1 || c === W - 1 ? '#' : '.');
  }

  // Blocks of buildings, kept away from the start corner.
  const blocks = Math.round(((W * H) / 38) * density);
  for (let i = 0; i < blocks; i++) {
    const bw = int(2, 5), bh = int(2, 3);
    const bx = int(2, W - bw - 2), by = int(2, H - bh - 2);
    if (bx < 6 && by < 5) continue;
    for (let r = by; r < by + bh; r++) for (let c = bx; c < bx + bw; c++) g[r][c] = '#';
  }

  // A current: a long lane of flowing water (more lanes on 'currents' voyages).
  const lanes = twist === 'currents' ? 3 : depth >= 2 && rand() < 0.4 ? 1 : 0;
  for (let i = 0; i < lanes; i++) {
    if (rand() < 0.6) {
      const r = int(3, H - 4), c0 = int(3, Math.floor(W / 2)), len = int(8, Math.floor(W / 2));
      const ch = rand() < 0.5 ? '>' : '<';
      for (let c = c0; c < Math.min(W - 2, c0 + len); c++) if (g[r][c] === '.') g[r][c] = ch;
    } else {
      const c = int(6, W - 4), r0 = int(2, Math.floor(H / 2)), len = int(5, H - 4);
      const ch = rand() < 0.5 ? 'v' : '^';
      for (let r = r0; r < Math.min(H - 2, r0 + len); r++) if (g[r][c] === '.') g[r][c] = ch;
    }
  }

  // The boat starts in the top-left corner, in a clear patch of water.
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 4; c++) g[r][c] = '.';
  g[1][1] = 'B';

  const isWater = (c, r) => g[r] && g[r][c] === '.';
  const taken = [];
  const farFrom = (c, r, list, d) => list.every(([pc, pr]) => Math.hypot(pc - c, pr - r) >= d);
  // Scatter items on open water: at least minStart cells from the boat and spacing from each other.
  function place(ch, count, minStart, spacing, area = () => true) {
    const mine = [];
    for (let tries = 0; mine.length < count && tries < 600; tries++) {
      const c = int(1, W - 2), r = int(1, H - 2);
      if (!isWater(c, r) || !area(c, r) || Math.hypot(c - 1, r - 1) < minStart) continue;
      if (!farFrom(c, r, mine, spacing) || !farFrom(c, r, taken, 1.5)) continue;
      g[r][c] = ch;
      mine.push([c, r]);
      taken.push([c, r]);
    }
  }
  // The lighthouse goes in the far half of the map.
  place('L', 1, W * 0.45, 1, (c) => c > W * 0.6);
  const diff = voyageDifficulty(depth);
  place('u', diff.buoys, 6, 5);
  place('o', 4 + Math.floor((W * H) / 160), 3, 3);
  place('c', diff.creatures, 10, 4);
  // Whirlpools from voyage 3 on, and a few ember shards to hunt on every voyage.
  if (depth >= 2) place('w', depth >= 6 ? 2 : int(0, 1), 9, 8);
  place('e', 2 + int(0, 2), 4, 4);

  const name = `The ${ADJ[int(0, ADJ.length - 1)]} ${NOUN[int(0, NOUN.length - 1)]}`;
  const def = {
    name,
    generated: true,
    seed,
    depth,
    drain: diff.drain,
    creatureSpeed: diff.creatureSpeed,
    lungeCooldown: diff.lungeCooldown,
    map: g.map((row) => row.join('')),
  };
  if (twist === 'fading') {
    def.buoyTime = 48;
    def.tip = 'Buoys burn out on this voyage. Light them all quickly!';
  } else if (twist === 'storm') {
    def.storm = { wind: 1.6, lightningEvery: 6 };
    def.tip = 'A storm rolls in. Lure shadows under the lightning.';
  } else if (twist === 'currents') {
    def.tip = 'Strong currents here. Ride them where you can.';
  }
  return def;
}

// The Daily Voyage: one seed per calendar day, medium difficulty, with a twist that rotates.
export function dailyVoyage(dateKey = todayKey()) {
  const seed = hashString(`lantern-drift-daily-${dateKey}`);
  const twist = ['none', 'currents', 'fading', 'storm'][seed % 4];
  const def = generateVoyage(seed, 4, twist);
  def.name = `Daily: ${def.name.replace(/^The /, '')}`;
  def.daily = dateKey;
  return def;
}
