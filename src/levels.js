// Level maps. Each character is one 2x2 cell:
//   #  building      .  water       B  boat start
//   o  oil can       u  buoy        L  lighthouse
//   c  shadow creature spawn
//   q  wisp (a small, fast shadow)       g  brute (a big, slow shadow that takes two flares)
//   w  whirlpool (pulls in the boat and shadows)
//   e  ember shard (optional collectible worth Embers)
//   d  floodgate (a wall that sinks once half the buoys are lit; def.gateAt can change how many)
//   >  <  ^  v  current (water that flows that way)
// Optional level settings: weather, tip (shown at the start), story (shown when it's cleared),
// buoyTime (buoys burn out), storm, eclipse ({ every, length }: the moon goes dark now and then).

export const CELL = 2;

export const LEVELS = [
  {
    name: 'The Flooded Market',
    drain: 2.2,
    creatureSpeed: 2.6,
    lungeCooldown: 3.5,
    map: [
      '################################',
      '#B......o.....###...e..........#',
      '#.............###.......o......#',
      '#...####......###..............#',
      '#...####..............u........#',
      '#...####.......................#',
      '#..........u.....####.....c....#',
      '#.....o..........####..........#',
      '#................####......o...#',
      '#..####..................###..e#',
      '#..####.....c.....u......###...#',
      '#..####..................###.L.#',
      '#............e.o...............#',
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
      '#B.....###........o.....e.###......#',
      '#......###................###..c...#',
      '#..o...###....u.....###...###......#',
      '#.............#.....###............#',
      '#####.........#.....###.....u......#',
      '#.......c.....#.................####',
      '#....u........######......o.....####',
      '#..........o.............c.........#',
      '#...####...........###.............#',
      '#...####....u......###....####....e#',
      '#...####......c....###....####..u..#',
      '#.........o.....e....o....####...L.#',
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
      '#B....###.......o......###.e.....c.....#',
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
      '#...............e..o...........o......e#',
      '########################################',
    ],
  },
  {
    name: 'The Canals',
    weather: 'fog',
    tip: 'Currents carry your boat. Ride them, or row hard against them.',
    drain: 2.4,
    creatureSpeed: 3.4,
    lungeCooldown: 3.1,
    map: [
      '######################################',
      '#B.....o....>>>>>>>>>>>>>.e...u......#',
      '#...........>>>>>>>>>>>>>............#',
      '#..####..##############..#######..c..#',
      '#..####..##############..#######.....#',
      '#..u.....v.........o..^..............#',
      '#........v............^...####..o....#',
      '#####....v....c.......^...####.......#',
      '#...o....v............^..............#',
      '#........v..#######...^.....u........#',
      '#.......<<<<<<<<<<<<<<<<<<<<<........#',
      '#.......<<<<<<<<<<<<<<<<<<<<<...c...e#',
      '#..####.....o.....######.......####..#',
      '#..####..u........######...o...####L.#',
      '#...........c...e....................#',
      '######################################',
    ],
  },
  {
    name: 'Ember Bay',
    weather: 'clear',
    tip: 'Buoys burn out here! Light them all before the first one fades.',
    drain: 2.35,
    creatureSpeed: 3.6,
    lungeCooldown: 3.0,
    buoyTime: 40,
    map: [
      '########################################',
      '#B.......o.....####...e....u..........##',
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
      '#.........e####.......................e#',
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
      '#B....o.........###...e.........c......#',
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
      '#..........e.###......................e#',
      '########################################',
    ],
  },
  {
    name: 'The Frozen Quay',
    tip: 'Snow on the quays, and something big in the square. A brute takes two flares!',
    weather: 'snow',
    drain: 2.4,
    creatureSpeed: 3.35,
    lungeCooldown: 3.1,
    map: [
      '########################################',
      '#B.......o......####......e.......####.#',
      '#...............####..............####.#',
      '#..####.....u...####.....u...........o.#',
      '#..####.........####.........####......#',
      '#..####..####............q...####...c..#',
      '#........####....................####..#',
      '#e..o....####......######.......o####..#',
      '#................g.######..............#',
      '######...............####....u.........#',
      '######.....####......####........#######',
      '#..........####...o..........e...#######',
      '#..u...c...####.........####...........#',
      '#.......................####.....q..u..#',
      '#...####......o...######.......o.......#',
      '#...####..............######.........L.#',
      '########################################',
    ],
  },
  {
    name: 'Whirlpool Reach',
    tip: 'Whirlpools pull you in. Skim the edges, and lure shadows into the middle.',
    weather: 'rain',
    drain: 2.3,
    creatureSpeed: 3.2,
    lungeCooldown: 3.3,
    map: [
      '########################################',
      '#B......#####..........o.......#####...#',
      '#.......#####..u...............#####.u.#',
      '#..o....#####.........###......#####...#',
      '#...............w.....###..............#',
      '#####.................###.....q....o...#',
      '#####......>>>>>>>>>>>>>>>>>>>v........#',
      '#...e......^..................v...####.#',
      '#..u.......^.....######.......v...####.#',
      '#..........^.....######...w...v........#',
      '#....###...^..c..######.......v..u.....#',
      '#....###...^<<<<<<<<<<<<<<<<<<<........#',
      '#....###.......o..........e.....###....#',
      '#.........q..........###........###..c.#',
      '#..o.....######......###....u...###....#',
      '#........######..e..............o....L.#',
      '########################################',
    ],
  },
  {
    name: 'Lighthouse Point',
    weather: 'snow',
    tip: 'The last lighthouse. The shadows are thick out here.',
    story: 'As the lighthouse wakes, a cold green light blinks back from far out at sea. The shadows never came from the town. Something out there is calling them.',
    drain: 2.55,
    creatureSpeed: 3.7,
    lungeCooldown: 2.9,
    map: [
      '############################################',
      '#B......o.......#####....e......c..........#',
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
      '#............e.c..........................e#',
      '############################################',
    ],
  },
  // ---- Act two: the green light ----
  {
    name: 'The Breakwater',
    weather: 'clear',
    drain: 2.35,
    creatureSpeed: 3.4,
    lungeCooldown: 3.0,
    tip: 'The old breakwater is shut with floodgates. Light two buoys and they will sink.',
    story: 'The floodgates groan open. Beyond the breakwater the sea is darker than the town ever was.',
    map: [
      '########################################',
      '#B......o......###.........e......o....#',
      '#..............###.....................#',
      '#..###.....u...###.................u...#',
      '#..###...........c.......###...........#',
      '#...........o............###.....c.....#',
      '#......###........###......o...........#',
      '#......................................#',
      '####dd#######dd##########dd######dd#####',
      '#......................................#',
      '#...c.......u..........###.......u.....#',
      '#..........o.....###...###....##...o...#',
      '#..###...........###......g...##.......#',
      '#..###......e...............o......L...#',
      '#.....................c...............e#',
      '########################################',
    ],
  },
  {
    name: 'Drowned Gardens',
    weather: 'clear',
    drain: 2.3,
    creatureSpeed: 3.05,
    lungeCooldown: 3.1,
    eclipse: { every: 24, length: 6 },
    tip: 'The moon keeps hiding tonight. In an eclipse your light shrinks and shadows hurry: wait it out by a buoy.',
    story: 'Each eclipse lines up with the green light blinking. It is not the moon going dark. Something is drinking the light.',
    map: [
      '########################################',
      '#B.........#.....#.....#.....#.........#',
      '#...o......#..u..#.....#..e..#.........#',
      '#.....##...........##...........##.....#',
      '#.....##.....c.....##.....o.....##.c...#',
      '#..........#.....#.....#.....#.........#',
      '#.u........#.....#..u..#.....#.........#',
      '#...##..........................##.....#',
      '#...##.....##.........##.....o..##.....#',
      '#..........##...q.....##...............#',
      '#.....o..............................e.#',
      '#..........#...###.....#....##.........#',
      '#.....u....#...###.c...#.o..##.......L.#',
      '#..........#o....#.....#.....#.u.......#',
      '#.....e..........##..........c.........#',
      '#................##.......o............#',
      '########################################',
    ],
  },
  {
    name: 'Bellwater Channels',
    weather: 'fog',
    drain: 2.35,
    creatureSpeed: 3.45,
    lungeCooldown: 3.0,
    gateAt: 2,
    tip: 'The canal locks open once two buoys are lit. One canal flows down, the other flows up.',
    story: 'The canal bells ring by themselves. A keeper\'s logbook drifts past: \'The second lighthouse fell in the great flood.\'',
    map: [
      '##########################################',
      '#B........#...v......#.........#...^...e.#',
      '#.........#...v..o...#......c..#...^.....#',
      '#....u....#...v......#..###....d...^.....#',
      '#.........d...v......#..###....#...^.....#',
      '#.........#...v......d.......e.#...^..u..#',
      '#...###...#...v..c...#.........#...^.....#',
      '#...###...#...v......#.....o...#...^.....#',
      '#.........#...v......#.........#...^..c..#',
      '#..o......#...v...u..#...##....#...^.....#',
      '#.........#.o.v......#..q##....d...^.....#',
      '#.........d...v......#...##....#...^..o..#',
      '#......u..#...v......d.........#...^.....#',
      '#..c......#...v.##...#.o.......#...^.....#',
      '#.......o.#...v.##...#......u..#.o.^...L.#',
      '#.........#...v.e....#.........#...^.....#',
      '##########################################',
    ],
  },
  {
    name: 'The Sunken Fair',
    weather: 'rain',
    drain: 2.3,
    creatureSpeed: 3.3,
    lungeCooldown: 3.1,
    tip: 'The fair sank with its rides still turning. Wisps swarm here; skim the whirlpool to reach the inner buoys.',
    story: 'Among the stalls you find a lantern just like yours, still warm. Someone sailed here before you.',
    map: [
      '##########################################',
      '#B...................o..............q..e.#',
      '#.......u................................#',
      '#...........########..########....###....#',
      '#..###......#................#....###....#',
      '#..###......#.o............q.#...........#',
      '#...........#...#.######.#...#...........#',
      '#...........#...#...e....#...#........u..#',
      '#.o.........#.....u..........#...........#',
      '#.......u.......#...w....#......o........#',
      '#...........#.q........u.....#...........#',
      '#...##......#...#.....e..#...#...........#',
      '#...##......#...#.######.#...#.....###...#',
      '#...##...o..#..............o.#.....###...#',
      '#...........#................#...........#',
      '#..c...###..########..########..c.....L..#',
      '#....................c..............o....#',
      '##########################################',
    ],
  },
  {
    name: 'Saltglass Narrows',
    drain: 2.4,
    creatureSpeed: 3.4,
    lungeCooldown: 3.0,
    storm: { wind: 1.7, lightningEvery: 6 },
    tip: 'The Narrows zig-zag through a storm. The wind throws you at the walls, so steer early.',
    story: 'Lightning shows the green light clearly now: a drowned lighthouse, its lamp still burning under the water.',
    map: [
      '############################################',
      '#B..........................##............e#',
      '#.........o...##......u.....##..c..........#',
      '#.................................o........#',
      '#####################################......#',
      '#..........................................#',
      '#.....o.........u...##....c.............u..#',
      '#e..........q.........................o....#',
      '#......#####################################',
      '#.........##...............................#',
      '#...o.....##............u.....##......c....#',
      '#.................c.................o.....e#',
      '#####################################......#',
      '#..........................................#',
      '#.......u.....o...##......c.......##.....L.#',
      '#.................##........o..............#',
      '############################################',
    ],
  },
  {
    name: 'Clocktower Flats',
    weather: 'snow',
    drain: 2.3,
    creatureSpeed: 3.3,
    lungeCooldown: 3.1,
    gateAt: 6,
    buoyTime: 55,
    tip: 'The lighthouse is locked in the clock square. Its gates open only when every buoy burns at once, and these buoys burn out!',
    story: 'The town clock strikes midnight. The logbook\'s last page: \'If it ever shines green, bring my lantern home.\'',
    map: [
      '##########################################',
      '#B.....u.................o......u.......e#',
      '#..###...###...###...###...###...###...###',
      '#..###...###o..###...###...###...###...###',
      '#..###...###...###.c.###...###...###...###',
      '#.................................c......#',
      '#................###dd###................#',
      '#..###..o###...###......#..###..o###...###',
      '#..###...###...##d..L...#..###...###...###',
      '#.u###...###...###....e.d..###...###..u###',
      '#................#......#................#',
      '#.............o..###dd###................#',
      '#..###..c###...###...###...###.q.###...###',
      '#..###o..###...###...###..o###...###...###',
      '#..###...###...###..c###...###...###...###',
      '#......................................o.#',
      '#e...........u...............u...........#',
      '##########################################',
    ],
  },
  {
    name: 'Isle of Echoes',
    weather: 'clear',
    drain: 2.4,
    creatureSpeed: 3.4,
    lungeCooldown: 3.0,
    eclipse: { every: 26, length: 8 },
    tip: 'Open sea, rocky isles and two brutes. Out here the eclipses come slowly, but they last.',
    story: 'The green light is close. Every shadow on the sea is turning towards it, like moths to a flame.',
    map: [
      '############################################',
      '#B..........o.............................e#',
      '#..............###............o..####......#',
      '#..............###...u...........####...o..#',
      '#....####.................e................#',
      '#....####..u............###................#',
      '#....####..........g....#####..........##..#',
      '#.....##................#####..........##..#',
      '#..o................o...###.........c......#',
      '#..............................u...........#',
      '#.......c.....#####......................L.#',
      '#.............#####...o...q........###.....#',
      '#....u........#####..........o.....###.....#',
      '#...............##.................###.....#',
      '#.......###..............####....g.........#',
      '#.......###..........u...####...........u..#',
      '#...........o.c...................o........#',
      '#e.........................................#',
      '############################################',
    ],
  },
  {
    name: 'The Green Light',
    weather: 'fog',
    drain: 2.4,
    creatureSpeed: 3.35,
    lungeCooldown: 3.0,
    eclipse: { every: 25, length: 7 },
    tip: 'A current spirals in to the drowned lighthouse. Ride it round, or light buoys to open the shortcut gates.',
    story: 'It was never a monster. The green light is the old keeper\'s lantern, lost with the second lighthouse, calling for someone to bring it home.',
    map: [
      '###########################################',
      '#B.......................................e#',
      '#....>>>>>>>>>>>>>>>......>>>>>>>>>>>.....#',
      '#...##################dd###############.v.#',
      '#...#.................................#.v.#',
      '#.o.#.........u.....q.........o.......#.v.#',
      '#...#.................................#.v.#',
      '#...#...##########################....#.v.#',
      '#...#............................#....#.v.#',
      '#...#.c...e.....o...L.........c..#.u..#.v.#',
      '#.u.#............................#....#.v.#',
      '#...#.......######################....#.v.#',
      '#...#.................................#.vo#',
      '#.........u..............o..q.......o.#.v.#',
      '#.....................................#.v.#',
      '#.......##############dd###############.v.#',
      '#.........<<<<<<<<<<......<<<<<<<<<<<<<<..#',
      '#e....o.................u...........c.....#',
      '###########################################',
    ],
  },
  {
    name: 'The Last Keeper',
    weather: 'rain',
    drain: 2.4,
    creatureSpeed: 3.45,
    lungeCooldown: 3.0,
    gateAt: 3,
    eclipse: { every: 28, length: 8 },
    tip: 'The last harbour. Light three buoys to sink the floodgates, then wake the keeper\'s lighthouse.',
    map: [
      '##############################################',
      '#B.............#............e..#............e#',
      '#........u.....#.......v.......#..o.......o..#',
      '#..............#...###.v...u...#...###.......#',
      '#...###......q.#...###.v.......#...###.......#',
      '#...###........d...###.v.......#.......u.....#',
      '#..............#.......v..c....d.............#',
      '#.....o.....o..#...o...v.......#......c......#',
      '#..............#.......v.......#........###..#',
      '#..u...........#.......v.###...#........###..#',
      '#.......###....#.......v.###...#........###..#',
      '#.......###....#..u....v.......#....u........#',
      '#.o.....###....#.......v.......#.............#',
      '#..............#.......v....o..d...........o.#',
      '#.......c......d....####.......#...###.......#',
      '#..####........#....####.......#...###.......#',
      '#..####.....u..#..o....v.......#..g.......L..#',
      '#..............#....o..v.....q.#......o......#',
      '#.e............#...............#.............#',
      '##############################################',
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
  const wall = (c, r) => r < 0 || c < 0 || r >= height || c >= width || grid[r][c] === '#' || grid[r][c] === 'L';
  for (let c = 0; c < width; c++) if (!wall(c, 0) || !wall(c, height - 1)) { problems.push('The outer wall has a gap'); break; }
  for (let r = 0; r < height; r++) if (!wall(0, r) || !wall(width - 1, r)) { problems.push('The outer wall has a gap'); break; }
  // Everything the boat can reach from the start (gatesOpen: whether floodgates count as water).
  const flood = (gatesOpen) => {
    const solid = (c, r) => wall(c, r) || (!gatesOpen && grid[r][c] === 'd');
    const reached = new Set();
    const start = [Math.floor(L.start.x / cell), Math.floor(L.start.z / cell)];
    const queue = [start];
    reached.add(start.join());
    for (let i = 0; i < queue.length; i++) {
      const [c, r] = queue[i];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c + dc},${r + dr}`;
        if (!reached.has(k) && !solid(c + dc, r + dr)) { reached.add(k); queue.push([c + dc, r + dr]); }
      }
    }
    return reached;
  };
  const seen = flood(true);
  const at = (p) => `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
  if (L.gates.length) {
    // Floodgates only open once enough buoys are lit, so that many must be reachable with them shut.
    const before = flood(false);
    const need = Math.min(L.buoys.length, def.gateAt || Math.ceil(L.buoys.length / 2));
    if (L.buoys.filter((p) => before.has(at(p))).length < need) {
      problems.push(`Floodgates open after ${need} buoy${need > 1 ? 's are' : ' is'} lit, so put that many where the boat can reach with the gates shut`);
    }
  }
  if (L.buoys.some((p) => !seen.has(at(p)))) problems.push('A buoy can\'t be reached by boat');
  if (L.oils.some((p) => !seen.has(at(p)))) problems.push('An oil can can\'t be reached by boat');
  if (L.shards.some((p) => !seen.has(at(p)))) problems.push('An ember shard can\'t be reached by boat');
  if (L.whirlpools.some((p) => Math.hypot(p.x - L.start.x, p.z - L.start.z) < 7)) problems.push('A whirlpool is too close to the boat start');
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
  const ok = /^[#.BouLcqgwed<>^v]+$/;
  if (map.length < 4 || map.length > 40 || map.some((row) => !ok.test(row) || row.length > 60)) {
    throw new Error('That code is not a Lantern Drift level');
  }
  return map;
}

// Weather changes how a level looks (particles, mist, snow on roofs), not how it plays.
export const WEATHERS = [
  { id: 'rain', name: 'Rain' },
  { id: 'snow', name: 'Snow' },
  { id: 'fog', name: 'Fog' },
  { id: 'clear', name: 'Clear night' },
];

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
  { name: 'Eclipse', eclipse: { every: 24, length: 7 }, tip: 'Eclipses tonight! When the moon goes dark, your light shrinks and shadows hurry.' },
];

// Full share code: the map code, then "~" + difficulty, twist and weather digits, then "~" + the level's name.
// Old codes (map only) still load, as Normal with no twist.
export function encodeShare({ map, difficulty = 1, twist = 0, weather = 0, name = '' }) {
  let code = `${encodeLevel(map)}~${difficulty}${twist}${weather}`;
  if (name) code += `~${encodeURIComponent(name.slice(0, 40))}`;
  return code;
}

export function decodeShare(text) {
  const [mapCode, opts = '10', name = ''] = text.trim().split('~');
  const difficulty = Math.min(DIFFICULTIES.length - 1, Number(opts[0]) || 0);
  const twist = Math.min(TWISTS.length - 1, Number(opts[1]) || 0);
  const weather = Math.min(WEATHERS.length - 1, Number(opts[2]) || 0);
  let title = '';
  // Names come from links anyone can make, so drop characters that could be read as HTML.
  try { title = decodeURIComponent(name).replace(/[<>&"'`]/g, '').slice(0, 40); } catch { /* bad name: leave it blank */ }
  return { map: decodeLevel(mapCode), difficulty, twist, weather, name: title };
}

// Builds a playable level definition from editor settings.
export function customLevel({ map, difficulty = 1, twist = 0, weather = 0, name = '' }) {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES[1];
  const t = TWISTS[twist] || TWISTS[0];
  const def = { name: name || 'Your level', drain: d.drain, creatureSpeed: d.creatureSpeed, lungeCooldown: d.lungeCooldown, map };
  if (t.buoyTime) def.buoyTime = t.buoyTime;
  if (t.storm) def.storm = t.storm;
  if (t.eclipse) def.eclipse = t.eclipse;
  if (t.tip) def.tip = t.tip;
  def.weather = t.storm ? 'rain' : (WEATHERS[weather] || WEATHERS[0]).id; // storms always rain
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
    whirlpools: [],
    shards: [],
    gates: [],
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
      else if (ch === 'q') level.creatures.push({ ...p, kind: 'wisp' });
      else if (ch === 'g') level.creatures.push({ ...p, kind: 'brute' });
      else if (ch === 'L') level.lighthouse = p;
      else if (ch === 'w') level.whirlpools.push(p);
      else if (ch === 'e') level.shards.push(p);
      else if (ch === 'd') level.gates.push({ ...p, col, row });
    }
  }
  if (!level.lighthouse) throw new Error(`Level "${def.name}" has no lighthouse`);
  return level;
}
