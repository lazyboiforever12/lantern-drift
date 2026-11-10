// Builds low-poly meshes out of boxes. Each mesh is one vertex buffer.
import { createMesh } from './gl.js';

// The six faces of a unit box: normal, then four corners (as signs of the half sizes).
const FACES = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
  [[0, 0, 1], [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]],
  [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
];

export class MeshBuilder {
  constructor() {
    this.data = [];
  }

  vertex(p, n, color, emissive) {
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], emissive);
  }

  // Box centred at (x, y, z) with full size (w, h, d).
  box(x, y, z, w, h, d, color, emissive = 0) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    for (const [normal, corners] of FACES) {
      const p = corners.map(([sx, sy, sz]) => [x + sx * hx, y + sy * hy, z + sz * hz]);
      for (const i of [0, 1, 2, 0, 2, 3]) this.vertex(p[i], normal, color, emissive);
    }
    return this;
  }

  // Flat grid on y = 0 (the water shader makes it wavy).
  plane(x0, z0, x1, z1, step, color) {
    const n = [0, 1, 0];
    for (let x = x0; x < x1; x += step) {
      for (let z = z0; z < z1; z += step) {
        const a = [x, 0, z], b = [x + step, 0, z], c = [x + step, 0, z + step], d = [x, 0, z + step];
        for (const p of [a, b, c, a, c, d]) this.vertex(p, n, color, 0);
      }
    }
    return this;
  }

  build(gl) {
    return createMesh(gl, new Float32Array(this.data));
  }
}

const WOOD = [0.45, 0.28, 0.15];
const DARK_WOOD = [0.28, 0.17, 0.09];
const LANTERN = [1.0, 0.78, 0.42];

// A Boatyard boat: its design (boxes) in the chosen paints, plus the lantern at the top.
// Glow paints make the painted parts emissive, so they shine in the dark.
function paintedBuilder(paint) {
  const b = new MeshBuilder();
  const box = b.box.bind(b);
  b.box = (x, y, z, w, h, d, color, em = 0) => {
    if (color === paint.hull) em = Math.max(em, paint.hullGlow);
    if (color === paint.trim) em = Math.max(em, paint.trimGlow);
    return box(x, y, z, w, h, d, color, em);
  };
  return { b, box };
}

// A boat's moving part (radar, propeller, turret...), built around its own pivot.
export function boatPartMesh(gl, part, paint) {
  const { b } = paintedBuilder(paint);
  part.design(b, paint);
  return b.build(gl);
}

export function designBoatMesh(gl, design, paint, stats) {
  const { b, box } = paintedBuilder(paint);
  design(b, paint);
  // A pole from the deck up to the lantern, so it never floats in mid-air.
  const poleBottom = 0.35, poleTop = stats.lanternY - 0.16;
  box(0, (poleBottom + poleTop) / 2, stats.lanternZ, 0.07, poleTop - poleBottom, 0.07, paint.dark);
  box(0, stats.lanternY, stats.lanternZ, 0.28, 0.32, 0.28, LANTERN, 1);
  box(0, stats.lanternY + 0.2, stats.lanternZ, 0.36, 0.06, 0.36, [0.15, 0.12, 0.1]);
  return b.build(gl);
}

// The boat's bow points along +Z.
export function boatMesh(gl) {
  return new MeshBuilder()
    .box(0, 0.15, 0, 1.0, 0.45, 2.0, WOOD)
    .box(0, 0.12, 1.15, 0.66, 0.38, 0.5, WOOD)
    .box(0, 0.42, 0, 1.06, 0.08, 2.06, DARK_WOOD)
    .box(0, 0.55, -0.45, 0.7, 0.4, 0.6, [0.55, 0.42, 0.3])
    .box(0, 1.0, 0.3, 0.08, 1.4, 0.08, DARK_WOOD)
    .box(0, 1.85, 0.3, 0.28, 0.32, 0.28, LANTERN, 1)
    .box(0, 2.05, 0.3, 0.36, 0.06, 0.36, [0.15, 0.12, 0.1])
    .build(gl);
}

export function buoyMesh(gl, lampColor) {
  return new MeshBuilder()
    .box(0, 0.1, 0, 0.7, 0.35, 0.7, [0.75, 0.2, 0.15])
    .box(0, 0.32, 0, 0.6, 0.1, 0.6, [0.85, 0.85, 0.8])
    .box(0, 0.75, 0, 0.12, 1.0, 0.12, [0.3, 0.3, 0.32])
    .box(0, 1.35, 0, 0.3, 0.3, 0.3, lampColor, 1)
    .build(gl);
}

export function oilMesh(gl) {
  return new MeshBuilder()
    .box(0, 0, 0, 0.45, 0.6, 0.45, [0.85, 0.42, 0.1])
    .box(0, 0.05, 0, 0.5, 0.12, 0.5, [1.0, 0.72, 0.3], 1)
    .box(0, 0.36, 0, 0.16, 0.12, 0.16, [0.3, 0.3, 0.3])
    .build(gl);
}

// One flat fleck of foam for the boat's wake. The renderer scales and fades it.
export function foamMesh(gl) {
  return new MeshBuilder().box(0, 0.2, 0, 0.34, 0.03, 0.34, [0.75, 0.85, 0.9], 0.35).build(gl);
}

// A whirlpool: a dark eye with three spiral arms of foam. The renderer spins it.
export function whirlpoolMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, 0.03, 0, 1.3, 0.02, 1.3, [0.02, 0.04, 0.06]);
  b.box(0, 0.02, 0, 2.2, 0.02, 2.2, [0.05, 0.1, 0.13]);
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const r = 0.45 + t * 2.9;
      const a = (arm * Math.PI * 2) / 3 + t * 3.6;
      const s = 0.4 * (1 - t * 0.55);
      b.box(Math.cos(a) * r, 0.06, Math.sin(a) * r, s, 0.03, s, [0.7, 0.82, 0.88], 0.3 * (1 - t * 0.7));
    }
  }
  return b.build(gl);
}

// An ember shard: a small glowing three-armed star.
export function shardMesh(gl) {
  const gold = [1.0, 0.82, 0.42];
  return new MeshBuilder()
    .box(0, 0, 0, 0.12, 0.55, 0.12, gold, 1)
    .box(0, 0, 0, 0.45, 0.12, 0.12, gold, 1)
    .box(0, 0, 0, 0.12, 0.12, 0.45, gold, 1)
    .box(0, 0, 0, 0.22, 0.22, 0.22, [1.0, 0.95, 0.8], 1)
    .build(gl);
}

// A thin streak drifting along a current, pointing along +Z.
export function streakMesh(gl) {
  return new MeshBuilder().box(0, 0.22, 0, 0.09, 0.02, 0.75, [0.55, 0.75, 0.9], 0.3).build(gl);
}

// A shadow creature: a dark blob with a trailing tail and two glowing eyes. Faces +Z.
export function creatureMesh(gl) {
  const body = [0.09, 0.03, 0.13];
  const eye = [0.85, 0.65, 1.0];
  return new MeshBuilder()
    .box(0, 0, 0, 0.9, 0.8, 0.9, body)
    .box(0, 0.5, 0.05, 0.6, 0.35, 0.6, body)
    .box(0, -0.15, -0.7, 0.55, 0.5, 0.6, body)
    .box(0, -0.3, -1.15, 0.3, 0.3, 0.4, body)
    .box(-0.2, 0.15, 0.46, 0.14, 0.14, 0.05, eye, 1)
    .box(0.2, 0.15, 0.46, 0.14, 0.14, 0.05, eye, 1)
    .build(gl);
}

export function lighthouseMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, -0.2, 0, 2.4, 1.0, 2.4, [0.35, 0.33, 0.3]);
  const white = [0.85, 0.85, 0.8];
  const red = [0.7, 0.15, 0.12];
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const w = 1.4 - i * 0.07;
    b.box(0, 0.75 + i, 0, w, 1.0, w, i % 2 === 0 ? white : red);
  }
  b.box(0, 6.45, 0, 1.15, 0.9, 1.15, [1.0, 0.9, 0.6], 1);
  b.box(0, 7.05, 0, 0.75, 0.3, 0.75, [0.4, 0.1, 0.08]); // small roof so the lamp shows from above
  return b.build(gl);
}

// Cheap repeatable "random" number from a grid cell.
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Roof height of the building in a grid cell. The renderer's ray-traced shadows use the same numbers.
export function buildingHeight(col, row) {
  return 1.0 + hash(col, row) * 1.5; // kept low so buildings never hide the boat
}

// The four sides of a cell: grid step, and which way the face points.
const SIDES = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const ROOF_TILES = [[0.36, 0.16, 0.13], [0.22, 0.24, 0.28], [0.3, 0.2, 0.15], [0.42, 0.3, 0.2]];
const WINDOW_LIT = [1.0, 0.75, 0.4];
const WINDOW_DARK = [0.07, 0.09, 0.13];
const FRAME = [0.16, 0.13, 0.11];

// Every building cell is a small house: walls, a pitched or flat roof, maybe a chimney, and
// windows (some lit, some dark, with frames) on each side that faces water. All one static mesh.
export function buildingsMesh(gl, level) {
  const b = new MeshBuilder();
  const { grid, cell } = level;
  const solid = (c, r) => !grid[r] || grid[r][c] === undefined || grid[r][c] === '#';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== '#') continue;
      const x = col * cell + cell / 2;
      const z = row * cell + cell / 2;
      const h = buildingHeight(col, row);
      const shade = 0.28 + hash(row, col) * 0.18;
      const color = [shade, shade * 0.95, shade * 0.9];
      b.box(x, h / 2 - 1, z, cell, h + 2, cell, color);
      const roof = ROOF_TILES[Math.floor(hash(col + 3, row + 11) * ROOF_TILES.length)];
      if (hash(col + 1, row + 2) > 0.4) {
        // Pitched roof: three steps narrowing to a ridge, running along x or z.
        const alongX = hash(col + 9, row) > 0.5;
        for (let i = 0; i < 3; i++) {
          const w = cell * (0.98 - i * 0.32);
          b.box(x, h + 0.09 + i * 0.17, z, alongX ? cell * 0.98 : w, 0.18, alongX ? w : cell * 0.98, roof);
        }
      } else {
        // Flat roof with a low parapet around the edge.
        const p = 0.12, e = cell / 2 - p / 2;
        const cap = [shade * 0.6, shade * 0.55, shade * 0.5];
        b.box(x, h + 0.08, z - e, cell, 0.16, p, cap).box(x, h + 0.08, z + e, cell, 0.16, p, cap);
        b.box(x - e, h + 0.08, z, p, 0.16, cell, cap).box(x + e, h + 0.08, z, p, 0.16, cell, cap);
      }
      if (hash(col + 5, row + 7) > 0.68) {
        const cx = x + (hash(col, row + 13) - 0.5) * 1.0, cz = z + (hash(col + 13, row) - 0.5) * 1.0;
        b.box(cx, h + 0.4, cz, 0.28, 0.75, 0.28, [0.3, 0.17, 0.13]);
        b.box(cx, h + 0.8, cz, 0.36, 0.08, 0.36, [0.18, 0.14, 0.12]);
      }
      // Windows on every side that faces open water.
      SIDES.forEach(([dc, dr], s) => {
        if (solid(col + dc, row + dr)) return;
        const count = h > 1.9 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          if (hash(col * 3 + s, row * 5 + k) < 0.3) continue;
          const lit = hash(col + s * 17, row + k * 29) > 0.5;
          const along = (k - (count - 1) / 2) * 0.85 + (hash(col + k, row + s) - 0.5) * 0.3;
          const wy = 0.55 + (h - 0.9) * hash(col + s, row + k + 9) * 0.8;
          const fx = x + dc * (cell / 2 + 0.02) + (dr !== 0 ? along : 0);
          const fz = z + dr * (cell / 2 + 0.02) + (dc !== 0 ? along : 0);
          const across = dc !== 0; // the face points along x, so the window is thin in x
          b.box(fx, wy, fz, across ? 0.05 : 0.56, 0.62, across ? 0.56 : 0.05, FRAME, 0.02);
          b.box(fx + dc * 0.02, wy, fz + dr * 0.02, across ? 0.05 : 0.42, 0.48, across ? 0.42 : 0.05,
            lit ? WINDOW_LIT : WINDOW_DARK, lit ? 0.55 : 0.03);
          b.box(fx + dc * 0.05, wy - 0.3, fz + dr * 0.05, across ? 0.12 : 0.6, 0.05, across ? 0.6 : 0.12, FRAME, 0.02);
        }
      });
    }
  }
  return b.build(gl);
}

// Waterside clutter: wooden piers along some walls, moored rowboats, mooring posts, lamp posts
// with glowing heads, and floating crates. It keeps to the edge of each water cell, where the
// boat's own size already keeps it from going, so nothing here gets in the way.
export function propsMesh(gl, level) {
  const b = new MeshBuilder();
  const { grid, cell } = level;
  const WOOD_COL = [0.4, 0.27, 0.16];
  const DARK = [0.2, 0.14, 0.09];
  for (let row = 1; row < grid.length - 1; row++) {
    for (let col = 1; col < grid[row].length - 1; col++) {
      if (grid[row][col] !== '.') continue;
      const x = col * cell + cell / 2;
      const z = row * cell + cell / 2;
      SIDES.forEach(([dc, dr], s) => {
        if (grid[row + dr][col + dc] !== '#') return;
        const roll = hash(col * 7 + s, row * 3 - s);
        const ex = x + dc * (cell / 2 - 0.22), ez = z + dr * (cell / 2 - 0.22); // just off the wall
        const across = dc !== 0;
        if (roll < 0.16) {
          // A pier: planks on posts along the wall.
          b.box(ex, 0.22, ez, across ? 0.42 : cell, 0.08, across ? cell : 0.42, WOOD_COL);
          for (const t of [-0.8, 0, 0.8]) {
            b.box(ex + (across ? 0 : t), -0.05, ez + (across ? t : 0), 0.09, 0.6, 0.09, DARK);
          }
          if (hash(col, row + s) > 0.5) {
            // A lamp post on the pier.
            b.box(ex, 0.75, ez, 0.06, 1.0, 0.06, [0.12, 0.12, 0.13]);
            b.box(ex, 1.3, ez, 0.16, 0.18, 0.16, [1.0, 0.82, 0.5], 0.9);
            b.box(ex, 1.42, ez, 0.22, 0.04, 0.22, [0.1, 0.1, 0.1]);
          }
        } else if (roll < 0.26) {
          // A small moored rowboat, lying along the wall.
          const bx = x + dc * (cell / 2 - 0.35), bz = z + dr * (cell / 2 - 0.35);
          b.box(bx, 0.1, bz, across ? 0.42 : 1.1, 0.16, across ? 1.1 : 0.42, [0.32, 0.22, 0.14]);
          b.box(bx, 0.19, bz, across ? 0.32 : 0.95, 0.04, across ? 0.95 : 0.32, [0.2, 0.13, 0.08]);
          b.box(ex + dc * 0.1, 0.25, ez + dr * 0.1, 0.1, 0.3, 0.1, DARK); // its mooring post
        } else if (roll < 0.34) {
          // Mooring posts.
          const t = (hash(row, col + s) - 0.5) * 1.2;
          b.box(ex + (across ? 0 : t), 0.2, ez + (across ? t : 0), 0.13, 0.5, 0.13, DARK);
        }
      });
      // Now and then, a crate floating near the middle of open water.
      if (hash(col + 31, row + 17) > 0.975) {
        b.box(x + 0.5, 0.05, z - 0.4, 0.38, 0.3, 0.38, [0.42, 0.3, 0.17]);
      }
    }
  }
  if (!b.data.length) b.box(0, -50, 0, 0.01, 0.01, 0.01, DARK); // never an empty mesh
  return b.build(gl);
}

export function waterMesh(gl, level) {
  const margin = 26; // far enough that the camera never sees past the water at a map corner
  const w = level.width * level.cell;
  const d = level.height * level.cell;
  return new MeshBuilder().plane(-margin, -margin, w + margin, d + margin, 1, [0.12, 0.28, 0.34]).build(gl);
}
