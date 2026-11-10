// The Boatyard's catalogue: boat designs (built from boxes), their stats, upgrades and paints.
// Stats feed straight into the boat physics in game.js; designs are turned into meshes in meshes.js.

// Default stats = the Little Skiff with no upgrades (what the levels were tuned for).
export const BASE_STATS = {
  thrust: 10,      // how hard it accelerates
  maxSpeed: 7.5,   // top speed
  turn: 1.7,       // turning rate
  grip: 5,         // sideways grip in the water (higher = less sliding)
  tank: 100,       // oil capacity
  drain: 1,        // oil use (multiplier; lower is better)
  lantern: 1,      // light radius (multiplier)
  radius: 0.75,    // size for collisions
  lanternY: 1.85,  // where the lantern hangs (for the light)
  lanternZ: 0.3,
};

// Each boat: price in Embers, a line of flavour, stat changes from the base, and a design
// function that adds boxes to a MeshBuilder. p = paint colours { hull, trim, dark, glow }.
export const BOATS = [
  {
    id: 'skiff', name: 'Little Skiff', price: 0,
    blurb: 'A trusty wooden rowing boat. Does everything well enough.',
    stats: {},
    design(b, p) {
      b.box(0, 0.15, 0, 1.0, 0.45, 2.0, p.hull).box(0, 0.12, 1.15, 0.66, 0.38, 0.5, p.hull)
        .box(0, 0.42, 0, 1.06, 0.08, 2.06, p.trim).box(0, 0.55, -0.45, 0.7, 0.4, 0.6, p.dark)
        .box(0, 1.0, 0.3, 0.08, 1.4, 0.08, p.trim);
    },
  },
  {
    id: 'dinghy', name: 'Rubber Dinghy', price: 150,
    blurb: 'Small, bouncy and nimble. Turns on a coin, but carries less oil.',
    stats: { turn: 2.4, maxSpeed: 6.9, tank: 90, drain: 0.9, radius: 0.62, lanternY: 1.5, lanternZ: 0 },
    design(b, p) {
      b.box(-0.42, 0.2, 0, 0.32, 0.4, 1.7, p.hull).box(0.42, 0.2, 0, 0.32, 0.4, 1.7, p.hull)
        .box(0, 0.2, 0.85, 1.16, 0.4, 0.3, p.hull).box(0, 0.2, -0.85, 1.16, 0.4, 0.3, p.trim)
        .box(0, 0.06, 0, 0.6, 0.12, 1.5, p.dark).box(0, 0.75, 0, 0.07, 1.1, 0.07, p.trim);
    },
  },
  {
    id: 'punt', name: 'Canal Punt', price: 300,
    blurb: 'Long and flat. Grips the water and holds a bigger tank.',
    stats: { grip: 7.5, maxSpeed: 7.2, turn: 1.5, tank: 115, radius: 0.72, lanternZ: 0.9 },
    design(b, p) {
      b.box(0, 0.12, 0, 0.95, 0.3, 2.7, p.hull).box(-0.5, 0.3, 0, 0.08, 0.2, 2.7, p.trim)
        .box(0.5, 0.3, 0, 0.08, 0.2, 2.7, p.trim).box(0, 0.32, -1.0, 0.8, 0.12, 0.5, p.dark)
        .box(0, 1.0, 0.9, 0.08, 1.4, 0.08, p.trim).box(0.25, 1.1, -0.9, 0.05, 2.0, 0.05, p.dark);
    },
  },
  {
    id: 'fishing', name: 'Fishing Boat', price: 500,
    blurb: 'A sturdy little cabin boat with room for spare oil.',
    stats: { tank: 130, drain: 0.95, maxSpeed: 7.1, lantern: 1.1, lanternY: 2.15, lanternZ: -0.2 },
    design(b, p) {
      b.box(0, 0.18, 0, 1.15, 0.5, 2.2, p.hull).box(0, 0.15, 1.3, 0.75, 0.42, 0.5, p.hull)
        .box(0, 0.46, 0, 1.2, 0.08, 2.25, p.trim).box(0, 0.8, -0.35, 0.85, 0.65, 0.9, p.trim)
        .box(0, 1.17, -0.35, 0.95, 0.1, 1.0, p.dark).box(0, 1.5, -0.2, 0.08, 1.2, 0.08, p.dark)
        .box(0.3, 0.6, 0.6, 0.35, 0.2, 0.35, p.dark);
    },
  },
  {
    id: 'speedboat', name: 'Speedboat', price: 800,
    blurb: 'Fast and thirsty. Slides in the corners.',
    stats: { thrust: 13, maxSpeed: 9.6, grip: 3.8, tank: 90, drain: 1.25, lanternY: 1.2, lanternZ: -0.6 },
    design(b, p) {
      b.box(0, 0.16, -0.1, 1.05, 0.38, 2.0, p.hull).box(0, 0.16, 1.1, 0.7, 0.32, 0.6, p.hull)
        .box(0, 0.16, 1.5, 0.35, 0.26, 0.35, p.hull).box(0, 0.38, 0, 1.1, 0.06, 2.1, p.trim)
        .box(0, 0.55, 0.35, 0.95, 0.25, 0.08, p.glow, 0.2).box(0, 0.5, -0.4, 0.8, 0.2, 0.7, p.dark)
        .box(0, 0.3, -1.15, 0.5, 0.45, 0.25, p.dark).box(0, 0.8, -0.6, 0.06, 0.6, 0.06, p.trim);
    },
  },
  {
    id: 'gondola', name: 'Gondola', price: 900,
    blurb: 'Elegant and steady, with a tall lantern that throws light further.',
    stats: { turn: 2.0, grip: 8, lantern: 1.2, maxSpeed: 7.3, radius: 0.68, lanternY: 2.3, lanternZ: -0.9 },
    design(b, p) {
      b.box(0, 0.15, 0, 0.8, 0.35, 2.4, p.hull).box(0, 0.4, 1.3, 0.3, 0.6, 0.3, p.hull)
        .box(0, 0.75, 1.45, 0.22, 0.4, 0.22, p.trim).box(0, 0.4, -1.3, 0.3, 0.55, 0.3, p.hull)
        .box(0, 0.36, 0, 0.84, 0.06, 2.0, p.trim).box(0, 0.5, -0.2, 0.6, 0.25, 0.5, p.glow, 0.15)
        .box(0, 1.3, -0.9, 0.06, 1.9, 0.06, p.dark);
    },
  },
  {
    id: 'tug', name: 'Tugboat', price: 1100,
    blurb: 'Slow but mighty. Shrugs off currents and wind, and sips oil.',
    stats: { thrust: 13.5, maxSpeed: 6.9, tank: 150, drain: 0.85, turn: 1.6, radius: 0.85, lanternY: 2.4, lanternZ: -0.3 },
    design(b, p) {
      b.box(0, 0.22, 0, 1.4, 0.55, 2.2, p.hull).box(0, 0.2, 1.25, 1.0, 0.5, 0.5, p.hull)
        .box(0, 0.52, 0, 1.46, 0.1, 2.3, p.trim).box(-0.75, 0.3, 0, 0.12, 0.3, 2.0, p.dark)
        .box(0.75, 0.3, 0, 0.12, 0.3, 2.0, p.dark).box(0, 0.95, -0.3, 1.0, 0.8, 1.0, p.trim)
        .box(0, 1.4, -0.3, 1.1, 0.1, 1.1, p.dark).box(0, 1.75, -0.65, 0.35, 0.7, 0.35, p.hull)
        .box(0, 2.15, -0.65, 0.4, 0.1, 0.4, p.dark);
    },
  },
  {
    id: 'steamer', name: 'Paddle Steamer', price: 1500,
    blurb: 'A grand old riverboat. Huge tank and a bright lamp, but she turns like a barge.',
    stats: { tank: 165, lantern: 1.25, maxSpeed: 7.4, turn: 1.35, radius: 0.9, drain: 0.95, lanternY: 2.6, lanternZ: 0.6 },
    design(b, p) {
      b.box(0, 0.2, 0, 1.3, 0.5, 2.6, p.hull).box(0, 0.5, 0, 1.36, 0.08, 2.66, p.trim)
        .box(-0.8, 0.45, -0.2, 0.25, 0.9, 0.9, p.dark).box(0.8, 0.45, -0.2, 0.25, 0.9, 0.9, p.dark)
        .box(0, 0.85, 0.1, 1.0, 0.6, 1.4, p.trim).box(0, 1.2, 0.1, 1.1, 0.1, 1.5, p.hull)
        .box(0, 1.75, -0.4, 0.3, 1.0, 0.3, p.dark).box(0, 2.3, -0.4, 0.4, 0.12, 0.4, p.trim)
        .box(0, 1.9, 0.6, 0.06, 1.2, 0.06, p.dark);
    },
  },
  {
    id: 'junk', name: 'Lantern Junk', price: 2000,
    blurb: 'Ribbed sails and a lantern so bright the shadows keep their distance.',
    stats: { lantern: 1.4, maxSpeed: 7.9, drain: 0.9, tank: 120, lanternY: 2.0, lanternZ: 1.0 },
    design(b, p) {
      b.box(0, 0.2, 0, 1.1, 0.5, 2.4, p.hull).box(0, 0.35, 1.3, 0.8, 0.6, 0.4, p.hull)
        .box(0, 0.4, -1.25, 1.0, 0.7, 0.35, p.hull).box(0, 0.48, 0, 1.16, 0.08, 2.4, p.trim)
        .box(0, 1.6, 0, 0.08, 2.4, 0.08, p.dark).box(0, 1.6, -0.05, 1.3, 1.9, 0.04, p.trim)
        .box(0, 1.0, -0.05, 1.34, 0.05, 0.08, p.dark).box(0, 1.6, -0.05, 1.34, 0.05, 0.08, p.dark)
        .box(0, 2.2, -0.05, 1.34, 0.05, 0.08, p.dark).box(0, 1.2, 1.0, 0.06, 1.4, 0.06, p.dark);
    },
  },
  {
    id: 'racer', name: 'Ember Racer', price: 2600,
    blurb: 'A twin-hulled racer with glowing fins. Very fast and very sharp.',
    stats: { thrust: 14.5, maxSpeed: 10.2, turn: 2.2, grip: 5.5, tank: 110, drain: 1.1, lanternY: 1.4, lanternZ: -0.2 },
    design(b, p) {
      b.box(-0.45, 0.15, 0, 0.35, 0.32, 2.4, p.hull).box(0.45, 0.15, 0, 0.35, 0.32, 2.4, p.hull)
        .box(-0.45, 0.15, 1.35, 0.22, 0.24, 0.4, p.hull).box(0.45, 0.15, 1.35, 0.22, 0.24, 0.4, p.hull)
        .box(0, 0.38, -0.1, 1.2, 0.08, 1.4, p.trim).box(0, 0.55, -0.2, 0.6, 0.3, 0.7, p.dark)
        .box(-0.45, 0.45, -1.0, 0.06, 0.45, 0.5, p.glow, 0.6).box(0.45, 0.45, -1.0, 0.06, 0.45, 0.5, p.glow, 0.6)
        .box(0, 0.9, -0.2, 0.06, 0.6, 0.06, p.trim);
    },
  },
  {
    id: 'clipper', name: 'Moonlit Clipper', price: 3500,
    blurb: 'The finest ship in the harbour: fast, frugal, huge tank, bright lamp.',
    stats: { thrust: 12.5, maxSpeed: 8.8, turn: 1.9, grip: 6, tank: 145, drain: 0.8, lantern: 1.3, radius: 0.85, lanternY: 2.2, lanternZ: 1.2 },
    design(b, p) {
      b.box(0, 0.22, 0, 1.15, 0.55, 2.7, p.hull).box(0, 0.22, 1.5, 0.75, 0.45, 0.5, p.hull)
        .box(0, 0.3, 1.9, 0.08, 0.08, 0.6, p.trim).box(0, 0.53, 0, 1.2, 0.08, 2.75, p.trim)
        .box(0, 0.7, -0.9, 0.9, 0.35, 0.7, p.dark)
        .box(0, 1.9, 0.5, 0.08, 2.8, 0.08, p.dark).box(0, 1.9, -0.4, 0.08, 2.4, 0.08, p.dark)
        .box(0, 2.2, 0.5, 1.2, 1.3, 0.04, p.trim).box(0, 1.3, 0.5, 1.4, 0.9, 0.04, p.trim)
        .box(0, 1.9, -0.4, 1.0, 1.1, 0.04, p.trim).box(0, 3.35, 0.5, 0.25, 0.15, 0.04, p.glow, 0.7);
    },
  },
];

// Upgrades: three levels each, bought per boat. Prices scale with the boat's price.
export const UPGRADES = [
  { id: 'engine', name: 'Engine', blurb: '+6% top speed and acceleration per level' },
  { id: 'tank', name: 'Oil tank', blurb: '+12 oil capacity per level' },
  { id: 'burner', name: 'Efficient burner', blurb: '-6% oil use per level' },
  { id: 'lens', name: 'Lantern lens', blurb: '+7% light radius per level' },
];
export const MAX_UPGRADE = 3;
export function upgradeCost(boat, level) {
  const base = [60, 140, 260][level] || 0;
  return Math.round((base * (1 + boat.price / 1500)) / 5) * 5;
}

// Paints for hull and trim. Bought once, usable on every boat. glow paints shine in the dark.
export const PAINTS = [
  { id: 'oak', name: 'Oak', color: [0.45, 0.28, 0.15], price: 0 },
  { id: 'pine', name: 'Pine', color: [0.62, 0.45, 0.26], price: 0 },
  { id: 'tar', name: 'Tar', color: [0.13, 0.12, 0.12], price: 0 },
  { id: 'white', name: 'Chalk white', color: [0.85, 0.84, 0.8], price: 0 },
  { id: 'red', name: 'Harbour red', color: [0.7, 0.13, 0.1], price: 40 },
  { id: 'navy', name: 'Navy', color: [0.1, 0.16, 0.38], price: 40 },
  { id: 'teal', name: 'Teal', color: [0.1, 0.48, 0.5], price: 40 },
  { id: 'forest', name: 'Forest', color: [0.14, 0.36, 0.17], price: 40 },
  { id: 'mustard', name: 'Mustard', color: [0.78, 0.6, 0.12], price: 60 },
  { id: 'plum', name: 'Plum', color: [0.42, 0.16, 0.45], price: 80 },
  { id: 'sunset', name: 'Sunset', color: [0.95, 0.42, 0.16], price: 80 },
  { id: 'rose', name: 'Rose', color: [0.9, 0.45, 0.58], price: 100 },
  { id: 'silver', name: 'Silver', color: [0.72, 0.75, 0.8], price: 150 },
  { id: 'gold', name: 'Gold', color: [0.95, 0.72, 0.25], price: 200 },
  { id: 'glowcyan', name: 'Glow cyan', color: [0.3, 1.0, 0.95], price: 350, glow: true },
  { id: 'glowamber', name: 'Glow amber', color: [1.0, 0.65, 0.2], price: 350, glow: true },
  { id: 'glowviolet', name: 'Glow violet', color: [0.75, 0.45, 1.0], price: 450, glow: true },
];
export const paintById = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];
export const boatById = (id) => BOATS.find((b) => b.id === id) || BOATS[0];

// Final stats for a boat with its upgrades ({ engine, tank, burner, lens } levels 0..3).
export function boatStats(id, ups = {}) {
  const s = { ...BASE_STATS, ...boatById(id).stats };
  const e = ups.engine || 0, t = ups.tank || 0, u = ups.burner || 0, l = ups.lens || 0;
  s.thrust *= 1 + 0.06 * e;
  s.maxSpeed *= 1 + 0.06 * e;
  s.tank += 12 * t;
  s.drain *= 1 - 0.06 * u;
  s.lantern *= 1 + 0.07 * l;
  return s;
}

// 0..1 bars for the Boatyard's stat panel.
export function statBars(s) {
  const n = (v, lo, hi) => Math.max(0.04, Math.min(1, (v - lo) / (hi - lo)));
  return [
    { label: 'Top speed', value: n(s.maxSpeed, 6, 11.5) },
    { label: 'Acceleration', value: n(s.thrust, 8, 17) },
    { label: 'Handling', value: n(s.turn * 0.7 + s.grip * 0.15, 1.6, 3.2) },
    { label: 'Oil tank', value: n(s.tank, 70, 210) },
    { label: 'Fuel economy', value: n(1 / s.drain, 0.7, 1.75) },
    { label: 'Lantern', value: n(s.lantern, 0.9, 1.9) },
  ];
}

// What the player owns. Kept inside the saved progress (save.boatyard).
export function defaultBoatyard() {
  return {
    embers: 0,
    equipped: 'skiff',
    boats: { skiff: { engine: 0, tank: 0, burner: 0, lens: 0, hull: 'oak', trim: 'tar' } },
    paints: PAINTS.filter((p) => p.price === 0).map((p) => p.id),
  };
}

// Colours for building a boat's mesh from its chosen paints.
export function boatPaint(owned) {
  const hull = paintById(owned.hull), trim = paintById(owned.trim);
  return {
    hull: hull.color,
    trim: trim.color,
    dark: [0.16, 0.12, 0.09],
    glow: trim.glow ? trim.color : hull.glow ? hull.color : [0.9, 0.75, 0.45],
    hullGlow: hull.glow ? 0.18 : 0,
    trimGlow: trim.glow ? 0.22 : 0,
  };
}
