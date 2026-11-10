// Small hand-written maths helpers. Matrices are column-major Float32Arrays (WebGL layout).

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

// Translate * rotate around Y * scale. Local +Z ends up pointing at (sin ry, 0, cos ry).
export function model(tx, ty, tz, ry = 0, sx = 1, sy = sx, sz = sx) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return new Float32Array([
    c * sx, 0, -s * sx, 0,
    0, sy, 0, 0,
    s * sz, 0, c * sz, 0,
    tx, ty, tz, 1,
  ]);
}

export const IDENTITY = model(0, 0, 0);

// Rotation about one axis, placed at a pivot point. Used for a boat's moving parts.
export function pivotRotate(px, py, pz, axis, a) {
  const c = Math.cos(a), s = Math.sin(a);
  let m;
  if (axis === 'x') m = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0];
  else if (axis === 'z') m = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0];
  else m = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0];
  return new Float32Array([...m, px, py, pz, 1]);
}
