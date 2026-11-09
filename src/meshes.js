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

export function buildingsMesh(gl, level) {
  const b = new MeshBuilder();
  const { grid, cell } = level;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== '#') continue;
      const x = col * cell + cell / 2;
      const z = row * cell + cell / 2;
      const h = 1.0 + hash(col, row) * 1.5; // kept low so buildings never hide the boat
      const shade = 0.28 + hash(row, col) * 0.18;
      const color = [shade, shade * 0.95, shade * 0.9];
      b.box(x, h / 2 - 1, z, cell, h + 2, cell, color);
      b.box(x, h - 1 + 0.15, z, cell * 0.8, 0.3, cell * 0.8, [shade * 0.6, shade * 0.5, shade * 0.45]);
      // A lit window on the side facing the camera, if that side faces water.
      const below = grid[row + 1] && grid[row + 1][col];
      if (below && below !== '#' && hash(col + 7, row + 3) > 0.55) {
        const wy = 0.6 + hash(col, row + 9) * Math.max(0.1, h - 1.4);
        b.box(x + (hash(col, row + 5) - 0.5) * 0.8, wy, z + cell / 2 + 0.02, 0.45, 0.55, 0.05, [1.0, 0.75, 0.4], 0.55);
      }
    }
  }
  return b.build(gl);
}

export function waterMesh(gl, level) {
  const margin = 26; // far enough that the camera never sees past the water at a map corner
  const w = level.width * level.cell;
  const d = level.height * level.cell;
  return new MeshBuilder().plane(-margin, -margin, w + margin, d + margin, 1, [0.12, 0.28, 0.34]).build(gl);
}
