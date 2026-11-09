// Procedural textures: brick walls, roof tiles and wooden planks are generated pixel by pixel
// in code (no image files), stored as layers of one WebGL2 texture array, and given a full
// mipmap chain so they stay smooth instead of shimmering when seen small or at an angle.

const SIZE = 256;
export const TEX = { none: -1, brick: 0, roof: 1, wood: 2, stone: 3 };

// Small value-noise helpers so surfaces aren't perfectly flat.
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2, y * 2) * 0.25 + noise(x * 4, y * 4) * 0.125;

// Each layer returns a brightness multiplier per pixel (around 1.0) and a slight tint.
// Patterns repeat exactly at the texture edge so tiling is seamless.
function brick(x, y) {
  const rows = 8, cols = 4;
  const row = Math.floor((y / SIZE) * rows);
  const offset = row % 2 ? 0.5 : 0;
  const bx = (x / SIZE) * cols + offset;
  const fx = bx - Math.floor(bx), fy = (y / SIZE) * rows - row;
  const mortar = fx < 0.04 || fx > 0.96 || fy < 0.07 || fy > 0.93;
  const id = hash(Math.floor(bx) % cols, row);
  const grain = fbm(x * 0.15, y * 0.15);
  if (mortar) return [0.55 + grain * 0.2, 0.55 + grain * 0.2, 0.55 + grain * 0.2];
  const k = 0.85 + id * 0.35 + (grain - 0.4) * 0.3;
  return [k * 1.08, k * 0.95, k * 0.88];
}
function roof(x, y) {
  const rows = 10, cols = 8;
  const row = Math.floor((y / SIZE) * rows);
  const fy = (y / SIZE) * rows - row;
  const bx = (x / SIZE) * cols + (row % 2) * 0.5;
  const fx = bx - Math.floor(bx);
  const shade = 0.75 + fy * 0.4 - (fx < 0.05 ? 0.3 : 0);  // each tile darker at its top edge
  const id = hash(Math.floor(bx) % cols, row);
  const k = shade * (0.85 + id * 0.3) + (fbm(x * 0.2, y * 0.2) - 0.4) * 0.2;
  return [k * 0.95, k * 0.9, k * 0.95];
}
function wood(x, y) {
  const planks = 6;
  const p = Math.floor((x / SIZE) * planks);
  const fx = (x / SIZE) * planks - p;
  const seam = fx < 0.05 || fx > 0.95;
  const grain = Math.sin((y / SIZE) * Math.PI * 2 * 3 + fbm(p * 7 + x * 0.05, y * 0.03) * 8) * 0.5 + 0.5;
  const k = seam ? 0.45 : 0.8 + grain * 0.25 + hash(p, 3) * 0.2;
  return [k * 1.05, k * 0.95, k * 0.85];
}
function stone(x, y) {
  const k = 0.75 + fbm(x * 0.08, y * 0.08) * 0.5 + (hash(x, y) - 0.5) * 0.08;
  return [k, k, k * 1.02];
}

export function createTextures(gl) {
  const layers = [brick, roof, wood, stone];
  const data = new Uint8Array(SIZE * SIZE * 4 * layers.length);
  layers.forEach((fn, layer) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const [r, g, b] = fn(x, y);
        const o = ((layer * SIZE + y) * SIZE + x) * 4;
        // Stored at half scale so values up to 2.0 fit; the shader multiplies by 2.
        data[o] = Math.min(255, r * 127.5);
        data[o + 1] = Math.min(255, g * 127.5);
        data[o + 2] = Math.min(255, b * 127.5);
        data[o + 3] = 255;
      }
    }
  });
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, SIZE, SIZE, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY); // the mipmap chain: 256, 128, 64 ... 1
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // Anisotropic filtering keeps walls sharp when seen at a steep angle (if the GPU supports it).
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso) {
    const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
  }
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return tex;
}
