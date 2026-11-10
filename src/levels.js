// Level maps. Each character is one 2x2 cell:
//   #  building      .  water       B  boat start
//   o  oil can       u  buoy        L  lighthouse
//   c  shadow creature spawn

export const CELL = 2;

export const LEVELS = [
  {
    name: 'The Flooded Market',
    drain: 2.2,
    creatureSpeed: 2.6,
    lungeCooldown: 3.5,
    map: [
      '################################',
      '#B......o.....###..............#',
      '#.............###.......o......#',
      '#...####......###..............#',
      '#...####..............u........#',
      '#...####.......................#',
      '#..........u.....####.....c....#',
      '#.....o..........####..........#',
      '#................####......o...#',
      '#..####..................###...#',
      '#..####.....c.....u......###...#',
      '#..####..................###.L.#',
      '#..............o...............#',
      '################################',
    ],
  },
  {
    name: 'Lantern Row',
    drain: 2.5,
    creatureSpeed: 3.3,
    lungeCooldown: 2.9,
    map: [
      '####################################',
      '#B.....###........o.......###......#',
      '#......###................###..c...#',
      '#..o...###....u.....###...###......#',
      '#.............#.....###............#',
      '#####.........#.....###.....u......#',
      '#.......c.....#.................####',
      '#....u........######......o.....####',
      '#..........o.............c.........#',
      '#...####...........###.............#',
      '#...####....u......###....####.....#',
      '#...####......c....###....####..u..#',
      '#.........o..........o....####...L.#',
      '####################################',
    ],
  },
  {
    name: 'The Old Harbour',
    drain: 2.4,
    creatureSpeed: 3.4,
    lungeCooldown: 3.1,
    map: [
      '########################################',
      '#B....###.......o......###.......c.....#',
      '#.....###..............###.............#',
      '#..o..###....####..u...###....####.....#',
      '#............####.............####..u..#',
      '#...u........####......o......####.....#',
      '####......c...........#####............#',
      '#.........o...........#####......o.....#',
      '#...#####.......u.....#####...c........#',
      '#...#####..............................#',
      '#...#####....c......####.......####....#',
      '#..............o....####...u...####....#',
      '#....u..............####.......####..c.#',
      '######.....####...........o............#',
      '#..........####.....c........#####.....#',
      '#..o.......####..............#####..L..#',
      '#..................o...........o.......#',
      '########################################',
    ],
  },
  {
    name: 'The Canals',
    tip: 'Currents carry your boat. Ride them, or row hard against them.',
    drain: 2.4,
    creatureSpeed: 3.4,
    lungeCooldown: 3.1,
    map: [
      '######################################',
      '#B.....o....>>>>>>>>>>>>>.....u......#',
      '#...........>>>>>>>>>>>>>............#',
      '#..####..##############..#######..c..#',
      '#..####..##############..#######.....#',
      '#..u.....v.........o..^..............#',
      '#........v............^...####..o....#',
      '#####....v....c.......^...####.......#',
      '#...o....v............^..............#',
      '#........v..#######...^.....u........#',
      '#.......<<<<<<<<<<<<<<<<<<<<<........#',
      '#.......<<<<<<<<<<<<<<<<<<<<<...c....#',
      '#..####.....o.....######.......####..#',
      '#..####..u........######...o...####L.#',
      '#...........c........................#',
      '######################################',
    ],
  },
  {
    name: 'Ember Bay',
    tip: 'Buoys burn out here! Light them all before the first one fades.',
    drain: 2.35,
    creatureSpeed: 3.6,
    lungeCooldown: 3.0,
    buoyTime: 40,
    map: [
      '########################################',
      '#B.......o.....####........u..........##',
      '#..............####...................##',
      '#..u...####....>>>>>>>>>>>>>>>>v...c...#',
      '#......####....^...............v.......#',
      '#..............^...######......v...o...#',
      '####...c.......^...######..u...v.......#',
      '#..............^...............v.......#',
      '#....o.....u...^<<<<<<<<<<<<<<<<.......#',
      '#......................................#',
      '#...######.......c.......######...u....#',
      '#...######...o...........######........#',
      '#.......................c..............#',
      '#..o.......####.............o.....L....#',
      '#..........####........................#',
      '########################################',
    ],
  },
  {
    name: 'The Storm',
    tip: 'A storm! Wind pushes your boat. Lightning stuns shadows, so lure them under it, but stay clear yourself.',
    drain: 2.6,
    creatureSpeed: 3.6,
    lungeCooldown: 3.0,
    storm: { wind: 2.0, lightningEvery: 5 },
    map: [
      '########################################',
      '#B....o.........###.............c......#',
      '#...............###......u.............#',
      '#...####...u..........................##',
      '#...####...........#####......####...o##',
      '#..................#####..c...####.....#',
      '#....o.....###.................u.......#',
      '###........###.....o...................#',
      '#.....c.............####.......####....#',
      '#...........u.......####...o...####....#',
      '#..####..............................c.#',
      '#..####.......o.....######.............#',
      '#.................c.######.....u.......#',
      '#..o.........###..............o....L...#',
      '#............###.......................#',
      '########################################',
    ],
  },
  {
    name: 'Lighthouse Point',
    tip: 'The last lighthouse. The shadows are thick out here.',
    drain: 2.55,
    creatureSpeed: 3.7,
    lungeCooldown: 2.9,
    map: [
      '############################################',
      '#B......o.......#####...........c..........#',
      '#...............#####......u...............#',
      '#..###..>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v..o..#',
      '#..###..^...........................v......#',
      '#.......^...######.....o.....####...v..###.#',
      '#..u....^...######...........####...v..###.#',
      '#.......^...######...c..............v......#',
      '####....^.................u.........v......#',
      '#..o....^.....#####.......####......v...c..#',
      '#.......^.....#####...L...####......v......#',
      '#.......^.....#####...............o.v......#',
      '#...c...^...............####........v..u...#',
      '#.......^<<<<<<<<<<<<<<<<<<<<<<<<<<<<......#',
      '#..u..............o.......................##',
      '#.........####..........c.....######......##',
      '#..o......####......u.........######...o..##',
      '#..............c...........................#',
      '############################################',
    ],
  },
];

// Checks a level is fair: one boat start, one lighthouse, at least one buoy, closed outer walls,
// and everything reachable by boat. Returns a list of problems (empty means OK).
export function checkLevel(def) {
  const problems = [];
  const count = (ch) => def.map.reduce((n, row) => n + row.split(ch).length - 1, 0);
  if (count('B') !== 1) problems.push('Place exactly one boat start (B)');
  if (count('L') !== 1) problems.push('Place exactly one lighthouse (L)');
  if (count('u') < 1) problems.push('Place at least one buoy');
  if (problems.length) return problems;
  const L = parseLevel(def);
  const { grid, width, height, cell } = L;
  const solid = (c, r) => r < 0 || c < 0 || r >= height || c >= width || grid[r][c] === '#' || grid[r][c] === 'L';
  for (let c = 0; c < width; c++) if (!solid(c, 0) || !solid(c, height - 1)) { problems.push('The outer wall has a gap'); break; }
  for (let r = 0; r < height; r++) if (!solid(0, r) || !solid(width - 1, r)) { problems.push('The outer wall has a gap'); break; }
  const seen = new Set();
  const start = [Math.floor(L.start.x / cell), Math.floor(L.start.z / cell)];
  const queue = [start];
  seen.add(start.join());
  for (let i = 0; i < queue.length; i++) {
    const [c, r] = queue[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c + dc},${r + dr}`;
      if (!seen.has(k) && !solid(c + dc, r + dr)) { seen.add(k); queue.push([c + dc, r + dr]); }
    }
  }
  const at = (p) => `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
  if (L.buoys.some((p) => !seen.has(at(p)))) problems.push('A buoy can\'t be reached by boat');
  if (L.oils.some((p) => !seen.has(at(p)))) problems.push('An oil can can\'t be reached by boat');
  const [lc, lr] = at(L.lighthouse).split(',').map(Number);
  if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${lc + dc},${lr + dr}`))) {
    problems.push('The lighthouse needs reachable water next to it');
  }
  return problems;
}

// Share codes: a map squeezed with run-length encoding ("12#" = 12 buildings), then base64.
export function encodeLevel(map) {
  const text = map.map((row) => row.replace(/(.)\1*/g, (run) => `${run.length}${run[0]}`)).join('/');
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeLevel(code) {
  const text = atob(code.trim().replace(/-/g, '+').replace(/_/g, '/'));
  const map = text.split('/').map((row) => row.replace(/(\d+)(\D)/g, (_, n, ch) => ch.repeat(Number(n))));
  const ok = /^[#.BouLc<>^v]+$/;
  if (map.length < 4 || map.length > 40 || map.some((row) => !ok.test(row) || row.length > 60)) {
    throw new Error('That code is not a Lantern Drift level');
  }
  return map;
}

// Level settings that travel with a share code: how hard it is, and an optional twist.
export const DIFFICULTIES = [
  { name: 'Calm', drain: 2.0, creatureSpeed: 2.4, lungeCooldown: 3.8 },
  { name: 'Normal', drain: 2.3, creatureSpeed: 3.2, lungeCooldown: 3.0 },
  { name: 'Hard', drain: 2.5, creatureSpeed: 3.6, lungeCooldown: 2.8 },
  { name: 'Nightmare', drain: 2.7, creatureSpeed: 4.0, lungeCooldown: 2.5 },
];
export const TWISTS = [
  { name: 'None' },
  { name: 'Buoys burn out', buoyTime: 40, tip: 'Buoys burn out! Light them all before the first one fades.' },
  { name: 'Storm', storm: { wind: 1.8, lightningEvery: 5 }, tip: 'A storm! Lure shadows under the lightning, but stay clear yourself.' },
];

// Full share code: the map code, then "~" + difficulty and twist digits, then "~" + the level's name.
// Old codes (map only) still load, as Normal with no twist.
export function encodeShare({ map, difficulty = 1, twist = 0, name = '' }) {
  let code = `${encodeLevel(map)}~${difficulty}${twist}`;
  if (name) code += `~${encodeURIComponent(name.slice(0, 40))}`;
  return code;
}

export function decodeShare(text) {
  const [mapCode, opts = '10', name = ''] = text.trim().split('~');
  const difficulty = Math.min(DIFFICULTIES.length - 1, Number(opts[0]) || 0);
  const twist = Math.min(TWISTS.length - 1, Number(opts[1]) || 0);
  let title = '';
  try { title = decodeURIComponent(name).slice(0, 40); } catch { /* bad name: leave it blank */ }
  return { map: decodeLevel(mapCode), difficulty, twist, name: title };
}

// Builds a playable level definition from editor settings.
export function customLevel({ map, difficulty = 1, twist = 0, name = '' }) {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES[1];
  const t = TWISTS[twist] || TWISTS[0];
  const def = { name: name || 'Your level', drain: d.drain, creatureSpeed: d.creatureSpeed, lungeCooldown: d.lungeCooldown, map };
  if (t.buoyTime) def.buoyTime = t.buoyTime;
  if (t.storm) def.storm = t.storm;
  if (t.tip) def.tip = t.tip;
  return def;
}

// Water that flows. The boat drifts with it.
export const CURRENTS = {
  '>': { x: 1, z: 0 },
  '<': { x: -1, z: 0 },
  '^': { x: 0, z: -1 },
  'v': { x: 0, z: 1 },
};

export function parseLevel(def) {
  const width = Math.max(...def.map.map((r) => r.length));
  // Pad short rows with buildings so typos can't open holes in the walls.
  const grid = def.map.map((r) => r.padEnd(width, '#').split(''));
  const level = {
    grid,
    width,
    height: grid.length,
    cell: CELL,
    start: { x: CELL * 1.5, z: CELL * 1.5 },
    oils: [],
    buoys: [],
    creatures: [],
    lighthouse: null,
  };
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < width; col++) {
      const ch = grid[row][col];
      const p = { x: col * CELL + CELL / 2, z: row * CELL + CELL / 2 };
      if (ch === 'B') level.start = p;
      else if (ch === 'o') level.oils.push(p);
      else if (ch === 'u') level.buoys.push(p);
      else if (ch === 'c') level.creatures.push(p);
      else if (ch === 'L') level.lighthouse = p;
    }
  }
  if (!level.lighthouse) throw new Error(`Level "${def.name}" has no lighthouse`);
  return level;
}
