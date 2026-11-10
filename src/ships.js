// The big (and silly) end of the Boatyard: liners, warships, a submarine... and furniture.
// Same format as BOATS in boats.js, plus:
//   paint: default hull/trim paints when bought
//   trait: one line shown in the Boatyard explaining the special ability
//   parts: moving pieces drawn as separate meshes, rotating about a pivot
//          { pivot: [x, y, z], axis: 'x' | 'y' | 'z', speed (rad/s), bySpeed (extra per unit of boat speed),
//            osc (if set, swings back and forth by this many radians instead of spinning), design(b, p) }
//   smoke: funnel tops [x, y, z] that puff steam while you play

const BLACK = [0.07, 0.07, 0.08];
const BUFF = [0.85, 0.62, 0.3];       // the famous White Star Line funnel colour
const DECK = [0.6, 0.47, 0.32];
const GREY = [0.42, 0.45, 0.48];
const DARK_GREY = [0.25, 0.27, 0.29];
const WINDOW = [1.0, 0.85, 0.55];     // lit windows (emissive)
const RED = [0.75, 0.1, 0.08];
const GREEN = [0.12, 0.5, 0.2];

// A row of lit portholes along both sides of a hull.
function portholes(b, y, z0, z1, halfWidth, count, size = 0.06) {
  for (let i = 0; i < count; i++) {
    const z = z0 + ((z1 - z0) * (i + 0.5)) / count;
    b.box(-halfWidth, y, z, 0.02, size, size, WINDOW, 0.7);
    b.box(halfWidth, y, z, 0.02, size, size, WINDOW, 0.7);
  }
}

// A spinning radar bar on a small post.
const radar = (pivot, speed = 3) => ({
  pivot, axis: 'y', speed,
  design(b) { b.box(0, 0.04, 0, 0.05, 0.08, 0.05, DARK_GREY).box(0, 0.1, 0, 0.5, 0.06, 0.08, GREY); },
});

// A gun turret with two barrels that slowly sweeps from side to side.
const turret = (pivot, facing = 1, size = 1) => ({
  pivot, axis: 'y', speed: 0.6, osc: 0.6,
  design(b) {
    b.box(0, 0.08 * size, 0, 0.36 * size, 0.16 * size, 0.4 * size, GREY);
    b.box(-0.07 * size, 0.1 * size, 0.38 * size * facing, 0.04, 0.04, 0.45 * size, DARK_GREY);
    b.box(0.07 * size, 0.1 * size, 0.38 * size * facing, 0.04, 0.04, 0.45 * size, DARK_GREY);
  },
});

// A propeller under the stern; it spins faster the faster you go.
const propeller = (pivot) => ({
  pivot, axis: 'z', speed: 2, bySpeed: 3,
  design(b) { b.box(0, 0, 0, 0.5, 0.07, 0.03, [0.7, 0.55, 0.25]).box(0, 0, 0, 0.07, 0.5, 0.03, [0.7, 0.55, 0.25]); },
});

// Four funnels in a row (Olympic-class liners).
function liner(b, p, { white = false } = {}) {
  b.box(0, 0.2, 0, 1.0, 0.5, 2.8, p.hull);                       // hull
  b.box(0, 0.2, 1.55, 0.62, 0.46, 0.35, p.hull);                 // tapering bow
  b.box(0, 0.22, 1.78, 0.3, 0.4, 0.15, p.hull);
  b.box(0, 0.22, -1.55, 0.8, 0.45, 0.3, p.hull);                 // stern
  b.box(0, 0.47, 0, 1.03, 0.05, 2.85, p.trim);                   // white band
  if (white) b.box(0, 0.32, 0, 1.03, 0.06, 2.85, GREEN);         // hospital ship's green stripe
  b.box(0, 0.58, -0.05, 0.86, 0.2, 2.3, p.trim);                 // decks
  b.box(0, 0.76, -0.1, 0.74, 0.18, 1.9, p.trim);
  b.box(0, 0.89, 0.8, 0.5, 0.1, 0.25, p.trim);                   // bridge
  portholes(b, 0.3, -1.3, 1.3, 0.505, 12);
  portholes(b, 0.6, -1.0, 1.05, 0.435, 9, 0.07);
  for (const z of [0.6, 0.18, -0.24, -0.66]) {
    b.box(0, 1.22, z, 0.17, 0.62, 0.22, BUFF);
    b.box(0, 1.55, z, 0.18, 0.06, 0.23, BLACK);
  }
  b.box(0, 1.3, 1.25, 0.04, 1.4, 0.04, BLACK);                    // masts
  b.box(0, 1.2, -1.25, 0.04, 1.2, 0.04, BLACK);
  b.box(0, 0.5, 1.2, 0.5, 0.06, 0.35, DECK);                     // foredeck
}

export const SHIPS = [
  {
    id: 'mattress', name: 'Bed Mattress', price: 60,
    blurb: 'Somebody\'s mattress floated out of a flooded bedroom. You\'ve claimed it. Bedside lamp included.',
    trait: 'So comfy that stunned shadows nap 60% longer.',
    paint: { hull: 'white', trim: 'navy' },
    stats: { thrust: 7, maxSpeed: 5.8, turn: 1.4, grip: 2.5, tank: 85, lantern: 0.9, radius: 0.7, lanternY: 0.95, lanternZ: 0.75, stunMult: 1.6 },
    design(b, p) {
      b.box(0, 0.12, 0, 1.3, 0.24, 1.9, p.hull);
      for (let i = -2; i <= 2; i++) b.box(i * 0.24, 0.245, 0, 0.1, 0.01, 1.88, p.trim); // ticking stripes
      b.box(-0.3, 0.32, 0.65, 0.5, 0.14, 0.32, [0.95, 0.95, 0.92]);                     // pillows
      b.box(0.3, 0.32, 0.65, 0.5, 0.14, 0.32, [0.95, 0.95, 0.92]);
      b.box(0, 0.27, -0.35, 1.32, 0.06, 1.0, [0.55, 0.25, 0.3]);                          // duvet
      b.box(0.55, 0.45, 0.75, 0.12, 0.25, 0.12, [0.35, 0.25, 0.15]);                      // lamp base
    },
    parts: [],
  },
  {
    id: 'couch', name: 'Comfy Couch', price: 120,
    blurb: 'A three-seater sofa with the TV remote still down the side. It floats. Don\'t ask how.',
    trait: 'Couch potato: uses 40% less oil while you\'re not rowing.',
    paint: { hull: 'mustard', trim: 'oak' },
    stats: { thrust: 8, maxSpeed: 6.2, turn: 1.6, grip: 3, tank: 100, radius: 0.72, lanternY: 1.3, lanternZ: -0.55, idleDrain: 0.6 },
    design(b, p) {
      b.box(0, 0.18, 0, 1.0, 0.3, 1.9, p.hull);                       // base
      b.box(-0.42, 0.55, 0, 0.18, 0.5, 1.9, p.hull);                  // backrest
      b.box(0.02, 0.42, 0.85, 0.85, 0.28, 0.2, p.hull);               // arms
      b.box(0.02, 0.42, -0.85, 0.85, 0.28, 0.2, p.hull);
      for (const z of [-0.5, 0, 0.5]) b.box(0.08, 0.38, z, 0.62, 0.12, 0.46, p.trim); // cushions
      b.box(0.2, 0.47, 0.2, 0.08, 0.03, 0.18, BLACK);                 // the remote
      b.box(0.3, 0.06, 0.85, 0.08, 0.12, 0.08, [0.3, 0.2, 0.12]);     // little feet
    },
    parts: [],
  },
  {
    id: 'yacht', name: 'Luxury Yacht', price: 1800,
    blurb: 'Gleaming white, tinted windows and a hot tub nobody is using tonight.',
    trait: 'Party lights: the brightest lantern for its size, and quick.',
    paint: { hull: 'white', trim: 'navy' },
    stats: { thrust: 12, maxSpeed: 9.1, turn: 1.9, grip: 4.5, tank: 95, drain: 1.15, lantern: 1.45, radius: 0.8, lanternY: 1.75, lanternZ: -0.2 },
    design(b, p) {
      b.box(0, 0.2, -0.1, 1.05, 0.45, 2.4, p.hull);
      b.box(0, 0.2, 1.25, 0.7, 0.4, 0.5, p.hull).box(0, 0.22, 1.6, 0.35, 0.34, 0.3, p.hull);
      b.box(0, 0.43, 0, 1.08, 0.04, 2.6, p.trim);
      b.box(0, 0.62, -0.3, 0.85, 0.35, 1.3, p.hull);
      b.box(0, 0.62, 0.36, 0.8, 0.28, 0.04, [0.1, 0.15, 0.25], 0.15);  // tinted windscreen
      b.box(-0.43, 0.62, -0.3, 0.02, 0.14, 1.1, [0.1, 0.15, 0.25], 0.15);
      b.box(0.43, 0.62, -0.3, 0.02, 0.14, 1.1, [0.1, 0.15, 0.25], 0.15);
      b.box(0, 0.86, -0.45, 0.7, 0.14, 0.8, p.hull);                   // flybridge
      b.box(0.2, 0.47, -1.05, 0.45, 0.06, 0.45, [0.3, 0.9, 1.0], 0.35); // hot tub
      b.box(0, 1.2, -0.2, 0.05, 0.6, 0.05, p.trim);
    },
    parts: [radar([0, 1.0, -0.6], 4)],
  },
  {
    id: 'submarine', name: 'Submarine', price: 2400,
    blurb: 'Mostly underwater, which is exactly where the shadows aren\'t looking.',
    trait: 'Silent running: shadows only notice you within 7.5 m.',
    paint: { hull: 'navy', trim: 'tar' },
    stats: { thrust: 11, maxSpeed: 7.8, turn: 1.6, grip: 6, tank: 120, drain: 0.9, lantern: 0.85, radius: 0.7, lanternY: 1.45, lanternZ: 0.25, stealth: 7.5 },
    design(b, p) {
      b.box(0, 0.06, 0, 0.75, 0.3, 2.6, p.hull);                      // the hull, mostly submerged
      b.box(0, 0.06, 1.4, 0.5, 0.24, 0.3, p.hull).box(0, 0.06, -1.4, 0.45, 0.22, 0.3, p.hull);
      b.box(0, 0.23, 0, 0.5, 0.04, 2.3, p.trim);                      // deck casing
      b.box(0, 0.55, 0.25, 0.32, 0.6, 0.7, p.hull);                   // conning tower (the "sail")
      b.box(-0.35, 0.68, 0.3, 0.42, 0.04, 0.18, p.hull).box(0.35, 0.68, 0.3, 0.42, 0.04, 0.18, p.hull); // sail planes
      b.box(0, 0.15, -1.5, 0.04, 0.4, 0.25, p.trim);                  // rudder
    },
    parts: [
      { pivot: [0, 0.85, 0.15], axis: 'y', speed: 1.2, design(b) { b.box(0, 0.25, 0, 0.05, 0.5, 0.05, DARK_GREY).box(0, 0.5, 0.05, 0.07, 0.07, 0.14, DARK_GREY); } },
      propeller([0, 0.05, -1.62]),
    ],
  },
  {
    id: 'destroyer', name: 'Navy Destroyer', price: 3000,
    blurb: 'Lean, mean and grey. Built to hunt submarines; shadows are easy by comparison.',
    trait: 'Depth charges: flares reach 40% further and recharge almost twice as fast.',
    paint: { hull: 'silver', trim: 'tar' },
    stats: { thrust: 13, maxSpeed: 9.6, turn: 1.8, grip: 5, tank: 120, drain: 1.15, radius: 0.78, lanternY: 1.9, lanternZ: 0.05, flareRange: 1.4, flareCooldown: 0.55 },
    design(b, p) {
      b.box(0, 0.18, 0, 0.8, 0.42, 2.7, p.hull);
      b.box(0, 0.18, 1.5, 0.5, 0.38, 0.35, p.hull).box(0, 0.2, 1.75, 0.22, 0.32, 0.2, p.hull);
      b.box(0, 0.4, 0, 0.82, 0.03, 2.75, p.trim);
      b.box(0, 0.6, 0.35, 0.55, 0.35, 0.55, GREY);                   // bridge
      b.box(0, 0.72, 0.62, 0.5, 0.08, 0.02, WINDOW, 0.4);
      b.box(0, 0.75, -0.35, 0.28, 0.6, 0.3, DARK_GREY);              // funnel
      b.box(0, 1.2, 0.05, 0.04, 1.2, 0.04, DARK_GREY);               // mast
      b.box(0, 0.5, -1.1, 0.5, 0.15, 0.4, GREY);                     // depth charge racks
      portholes(b, 0.28, -1.0, 1.1, 0.405, 7, 0.05);
    },
    parts: [turret([0, 0.42, 0.95], 1, 0.9), turret([0, 0.42, -0.75], -1, 0.8), radar([0, 1.6, 0.05], 3.5), propeller([0, 0.02, -1.4])],
    smoke: [[0, 1.1, -0.35]],
  },
  {
    id: 'cruiser', name: 'Navy Warship', price: 3300,
    blurb: 'A modern guided-missile cruiser, a little over-equipped for a flooded high street.',
    trait: 'Missile flares: every flare costs 40% less oil.',
    paint: { hull: 'silver', trim: 'tar' },
    stats: { thrust: 12, maxSpeed: 8.7, turn: 1.5, grip: 5.5, tank: 150, drain: 1.05, lantern: 1.1, radius: 0.88, lanternY: 2.1, lanternZ: 0.2, flareCost: 0.6 },
    design(b, p) {
      b.box(0, 0.2, 0, 0.95, 0.46, 2.8, p.hull);
      b.box(0, 0.2, 1.55, 0.6, 0.42, 0.35, p.hull).box(0, 0.22, 1.8, 0.28, 0.36, 0.2, p.hull);
      b.box(0, 0.44, 0, 0.97, 0.03, 2.85, p.trim);
      b.box(0, 0.7, 0.2, 0.7, 0.5, 0.9, GREY);                       // big angular superstructure
      b.box(0, 1.0, 0.25, 0.55, 0.15, 0.6, GREY);
      b.box(0, 0.86, 0.66, 0.6, 0.08, 0.02, WINDOW, 0.4);
      b.box(-0.36, 0.75, 0.2, 0.02, 0.3, 0.3, [0.2, 0.22, 0.25]);   // flat radar panels
      b.box(0.36, 0.75, 0.2, 0.02, 0.3, 0.3, [0.2, 0.22, 0.25]);
      b.box(0, 0.55, 1.05, 0.5, 0.18, 0.4, DARK_GREY);              // missile cells
      for (const x of [-0.12, 0, 0.12]) b.box(x, 0.65, 1.05, 0.08, 0.02, 0.3, BLACK);
      b.box(0, 0.55, -0.85, 0.5, 0.18, 0.45, DARK_GREY);
      b.box(0, 0.75, -0.35, 0.3, 0.5, 0.35, DARK_GREY);             // funnel
      b.box(0, 1.55, 0.2, 0.04, 1.0, 0.04, DARK_GREY);
    },
    parts: [turret([0, 0.46, 1.45], 1, 0.75), radar([0, 2.05, 0.2], 2.5), propeller([0, 0.02, -1.5])],
    smoke: [[0, 1.05, -0.35]],
  },
  {
    id: 'battleship', name: 'Old Battleship', price: 3800,
    blurb: 'A 1910s dreadnought with tripod masts and enough armour to shrug off a lighthouse.',
    trait: 'Armour belt: shadows steal only half as much oil.',
    paint: { hull: 'silver', trim: 'tar' },
    stats: { thrust: 10, maxSpeed: 6.9, turn: 1.2, grip: 6, tank: 190, drain: 1.2, lantern: 1.15, radius: 0.95, lanternY: 2.3, lanternZ: 0.45, hitMult: 0.5 },
    design(b, p) {
      b.box(0, 0.2, 0, 1.05, 0.48, 2.9, p.hull);
      b.box(0, 0.2, 1.6, 0.65, 0.44, 0.35, p.hull).box(0, 0.22, 1.85, 0.3, 0.38, 0.2, p.hull);
      b.box(-0.53, 0.18, 0, 0.04, 0.2, 2.4, DARK_GREY).box(0.53, 0.18, 0, 0.04, 0.2, 2.4, DARK_GREY); // armour belt
      b.box(0, 0.45, 0, 1.07, 0.03, 2.95, p.trim);
      b.box(0, 0.62, 0.05, 0.7, 0.3, 1.2, GREY);
      b.box(0, 0.9, 0.45, 0.45, 0.25, 0.4, GREY);                   // conning tower
      b.box(0, 0.98, 0.66, 0.4, 0.06, 0.02, WINDOW, 0.35);
      for (const z of [0.0, -0.35]) {                                // two funnels
        b.box(0, 1.1, z, 0.22, 0.55, 0.26, DARK_GREY);
        b.box(0, 1.39, z, 0.24, 0.05, 0.28, BLACK);
      }
      for (const [z, h] of [[0.45, 1.8], [-0.75, 1.4]]) {            // tripod masts
        b.box(0, 0.45 + h / 2, z, 0.05, h, 0.05, DARK_GREY);
        b.box(-0.12, 0.45 + h / 2.4, z - 0.12, 0.03, h * 0.8, 0.03, DARK_GREY);
        b.box(0.12, 0.45 + h / 2.4, z - 0.12, 0.03, h * 0.8, 0.03, DARK_GREY);
        b.box(0, 0.45 + h, z, 0.22, 0.12, 0.22, GREY);
      }
      portholes(b, 0.3, -1.2, 1.2, 0.535, 10, 0.05);
    },
    parts: [
      turret([0, 0.47, 1.15], 1, 1.1), turret([0, 0.62, 0.8], 1, 1.0),
      turret([0, 0.47, -1.15], -1, 1.1), turret([0, 0.62, -0.95], -1, 1.0),
      propeller([0, 0.02, -1.55]),
    ],
    smoke: [[0, 1.45, 0.0], [0, 1.45, -0.35]],
  },
  {
    id: 'cruise', name: 'Cruise Ship', price: 4000,
    blurb: 'Twelve decks, three pools and a karaoke bar. The captain is not thrilled about the canals.',
    trait: 'All-you-can-eat buffet: oil cans give 50% more oil.',
    paint: { hull: 'navy', trim: 'white' },
    stats: { thrust: 10, maxSpeed: 6.8, turn: 1.1, grip: 6, tank: 210, drain: 1.1, lantern: 1.3, radius: 0.95, lanternY: 2.25, lanternZ: 1.0, pickup: 1.5 },
    design(b, p) {
      b.box(0, 0.2, 0, 1.1, 0.48, 2.9, p.hull);
      b.box(0, 0.2, 1.6, 0.7, 0.44, 0.35, p.hull).box(0, 0.22, 1.85, 0.32, 0.38, 0.2, p.hull);
      for (let d = 0; d < 4; d++) {                                  // stacked white decks with lit windows
        const y = 0.55 + d * 0.22, w = 1.06 - d * 0.08, l = 2.5 - d * 0.35;
        b.box(0, y, -0.15 + d * 0.02, w, 0.2, l, p.trim);
        portholes(b, y, -0.15 - l / 2 + 0.15, -0.15 + l / 2 - 0.15, w / 2 + 0.005, Math.round(l * 5), 0.07);
      }
      b.box(0, 1.5, -0.65, 0.35, 0.5, 0.5, RED);                    // big red funnel
      b.box(0, 1.77, -0.65, 0.37, 0.06, 0.52, BLACK);
      b.box(0, 1.43, 0.2, 0.4, 0.04, 0.5, [0.3, 0.9, 1.0], 0.4);     // pool
      b.box(0, 1.5, 0.75, 0.6, 0.15, 0.25, p.trim);                  // bridge
      b.box(0, 1.55, 0.88, 0.55, 0.06, 0.02, WINDOW, 0.6);
    },
    parts: [radar([0, 1.6, 0.75], 2), propeller([0, 0.02, -1.55])],
    smoke: [[0, 1.85, -0.65]],
  },
  {
    id: 'britannic', name: 'HMHS Britannic', price: 4200,
    blurb: 'The Titanic\'s younger sister, painted as a hospital ship with a green stripe and red crosses.',
    trait: 'Hospital ship: shadows steal 40% less oil.',
    paint: { hull: 'white', trim: 'white' },
    stats: { thrust: 9.5, maxSpeed: 7.1, turn: 1.2, grip: 6, tank: 220, drain: 1.1, lantern: 1.3, radius: 0.95, lanternY: 2.0, lanternZ: 1.25, hitMult: 0.6 },
    design(b, p) {
      liner(b, p, { white: true });
      for (const z of [-0.8, 0.8]) {                                  // red crosses on both sides
        for (const x of [-0.51, 0.51]) {
          b.box(x, 0.33, z, 0.02, 0.06, 0.24, RED, 0.3);
          b.box(x, 0.33, z, 0.02, 0.22, 0.07, RED, 0.3);
        }
      }
    },
    parts: [propeller([0, 0.02, -1.6])],
    smoke: [[0, 1.6, 0.6], [0, 1.6, 0.18], [0, 1.6, -0.24]],
  },
  {
    id: 'carrier', name: 'Aircraft Carrier', price: 4500,
    blurb: 'A floating airfield. A little patrol plane circles overhead looking for buoys.',
    trait: 'Spotter plane: lights buoys from almost twice as far away.',
    paint: { hull: 'silver', trim: 'tar' },
    stats: { thrust: 10.5, maxSpeed: 7.4, turn: 1.05, grip: 6.5, tank: 200, drain: 1.15, lantern: 1.2, radius: 0.95, lanternY: 1.85, lanternZ: -0.1, buoyRange: 1.9 },
    design(b, p) {
      b.box(0, 0.2, 0, 0.95, 0.46, 2.7, p.hull);
      b.box(0, 0.2, 1.45, 0.6, 0.42, 0.3, p.hull);
      b.box(0.1, 0.48, 0.05, 1.35, 0.08, 3.2, p.trim);                // the flight deck, overhanging
      b.box(0.1, 0.525, 0.05, 0.05, 0.01, 3.0, [0.9, 0.9, 0.85], 0.1); // centre line
      for (let i = -5; i <= 5; i++) b.box(0.1, 0.525, i * 0.27, 0.22, 0.01, 0.04, [0.95, 0.85, 0.3], 0.1); // runway dashes
      b.box(0.58, 0.8, -0.1, 0.2, 0.55, 0.6, GREY);                   // the island
      b.box(0.58, 1.1, -0.1, 0.22, 0.08, 0.62, DARK_GREY);
      b.box(0.58, 0.95, 0.21, 0.18, 0.08, 0.02, WINDOW, 0.4);
      for (const [x, z] of [[-0.25, 1.1], [-0.3, -0.9], [0.15, -1.25]]) { // parked planes
        b.box(x, 0.58, z, 0.06, 0.06, 0.4, GREY).box(x, 0.58, z, 0.42, 0.02, 0.1, GREY).box(x, 0.62, z - 0.17, 0.16, 0.02, 0.06, GREY);
      }
      b.box(0.58, 1.4, -0.1, 0.04, 0.6, 0.04, DARK_GREY);
    },
    parts: [
      radar([0.58, 1.72, -0.1], 3),
      {
        // The patrol plane flies in a circle around the ship.
        pivot: [0, 2.2, 0], axis: 'y', speed: 1.6,
        design(b) {
          b.box(1.4, 0, 0, 0.07, 0.07, 0.42, [0.8, 0.82, 0.85]);
          b.box(1.4, 0, 0.02, 0.5, 0.02, 0.12, [0.8, 0.82, 0.85]);
          b.box(1.4, 0.04, -0.18, 0.18, 0.02, 0.06, [0.8, 0.82, 0.85]);
          b.box(1.4, 0, 0.22, 0.03, 0.03, 0.03, [1, 0.3, 0.2], 1);     // nav light
        },
      },
      propeller([0, 0.02, -1.4]),
    ],
  },
  {
    id: 'titanic', name: 'RMS Titanic', price: 5000,
    blurb: 'The grandest liner ever built, now very carefully avoiding anything that looks like an iceberg.',
    trait: 'Enormous tank and a dazzling lantern, but hard bumps cost 6 oil (she hates icebergs).',
    paint: { hull: 'tar', trim: 'white' },
    stats: { thrust: 9.5, maxSpeed: 7.2, turn: 1.15, grip: 6, tank: 240, drain: 1.1, lantern: 1.45, radius: 0.95, lanternY: 2.05, lanternZ: 1.25, bumpCost: 6 },
    design(b, p) {
      liner(b, p);
      b.box(0, 0.08, 0, 1.01, 0.12, 2.82, RED);   // red anti-fouling paint at the waterline
    },
    parts: [propeller([-0.25, 0.02, -1.65]), propeller([0.25, 0.02, -1.65])],
    // The fourth funnel on the real Titanic was a dummy (just for looks), so only three smoke.
    smoke: [[0, 1.6, 0.6], [0, 1.6, 0.18], [0, 1.6, -0.24]],
  },
];
