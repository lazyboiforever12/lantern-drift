// Particles drawn with instancing: one small quad, drawn once per particle in a single call.
// Each particle's position, velocity, size and colour live in a per-instance buffer that is
// refilled every frame. Additive blending makes them glow, and they write no depth.
import { createProgram } from './gl.js';

const MAX = 1500;
const FLOATS = 11; // pos 3, stretch direction 3, size 1, colour rgba 4

const vs = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;      // -1..1 quad corner
layout(location = 1) in vec3 iPos;
layout(location = 2) in vec3 iStretch;     // non-zero: a streak along this direction
layout(location = 3) in float iSize;
layout(location = 4) in vec4 iColor;
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vCorner;
out vec4 vColor;
void main() {
  vec3 across = uCamRight * iSize;
  vec3 along = uCamUp * iSize;
  if (length(iStretch) > 0.0001) {
    // A streak: stretch along its motion, and keep its width facing the camera.
    vec3 viewDir = cross(uCamRight, uCamUp);
    vec3 side = cross(iStretch, viewDir);
    if (length(side) > 1e-4) across = normalize(side) * iSize;
    along = iStretch + normalize(iStretch) * iSize;
  }
  vec3 world = iPos + across * aCorner.x + along * aCorner.y;
  vCorner = aCorner;
  vColor = iColor;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const fs = /* glsl */ `#version 300 es
precision highp float;
in vec2 vCorner;
in vec4 vColor;
out vec4 outColor;
void main() {
  float r = dot(vCorner, vCorner);
  if (r > 1.0) discard;
  float soft = (1.0 - r) * (1.0 - r);
  outColor = vec4(vColor.rgb * vColor.a * soft, 1.0);
}`;

export class Particles {
  constructor(gl) {
    this.gl = gl;
    this.prog = createProgram(gl, vs, fs);
    this.u = {};
    for (const n of ['uViewProj', 'uCamRight', 'uCamUp']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.data = new Float32Array(MAX * FLOATS);
    this.list = [];
    this.count = 0;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const attr = (loc, size, offset) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1); // advance once per instance, not per vertex
    };
    attr(1, 3, 0);
    attr(2, 3, 3);
    attr(3, 1, 6);
    attr(4, 4, 7);
    gl.bindVertexArray(null);
  }

  // Add a particle that moves and fades by itself.
  // opts: x y z, vx vy vz, life, size, color [r,g,b], gravity, drag, streak (length factor), grow
  spawn(o) {
    if (this.list.length >= MAX) return;
    this.list.push({
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life, maxLife: o.life,
      size: o.size || 0.1, grow: o.grow || 0,
      color: o.color, alpha: o.alpha === undefined ? 1 : o.alpha,
      gravity: o.gravity || 0, drag: o.drag || 0, streak: o.streak || 0,
    });
  }

  // A burst of sparks flying outwards from a point.
  burst(x, y, z, { count = 30, speed = 6, up = 3, life = 0.9, size = 0.12, color = [1, 0.8, 0.4], gravity = -9 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vy: up * (0.4 + Math.random()), vz: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.5), size: size * (0.6 + Math.random() * 0.8),
        color, gravity, drag: 1.5, streak: 0.05,
      });
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp; p.vz *= damp; p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.size += p.grow * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  // Pack the live particles plus any one-frame extras (like the lighthouse beam) and draw.
  draw(viewProj, camRight, camUp, extras = []) {
    const gl = this.gl;
    let n = 0;
    const put = (x, y, z, sx, sy, sz, size, r, g, b, a) => {
      if (n >= MAX) return;
      const o = n * FLOATS;
      const d = this.data;
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = sx; d[o + 4] = sy; d[o + 5] = sz;
      d[o + 6] = size;
      d[o + 7] = r; d[o + 8] = g; d[o + 9] = b; d[o + 10] = a;
      n++;
    };
    for (const p of this.list) {
      const k = p.life / p.maxLife;           // 1 = new, 0 = gone
      const a = p.alpha * Math.min(1, k * 2); // fade out over the second half of its life
      const s = p.streak;
      put(p.x, p.y, p.z, p.vx * s, p.vy * s, p.vz * s, p.size, p.color[0], p.color[1], p.color[2], a);
    }
    for (const e of extras) put(...e);
    if (!n) return;

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uViewProj, false, viewProj);
    gl.uniform3fv(this.u.uCamRight, camRight);
    gl.uniform3fv(this.u.uCamUp, camUp);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, n * FLOATS);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  clear() {
    this.list.length = 0;
  }
}
