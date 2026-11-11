// The night sky: drawn first each frame as one full-screen triangle behind everything.
// For each pixel the view ray is rebuilt from the inverse view-projection matrix, then coloured:
// a dark gradient with a warm glow low down (the flooded town's lights on the haze), twinkling
// stars, a moon with a halo, and slow clouds lit from behind by the moon. In the reflection pass
// it is drawn mirrored, so the moon and clouds also show in the water.
import { createProgram } from './gl.js';

const VS = /* glsl */ `#version 300 es
out vec2 vNdc;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vNdc = p * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 0.99999, 1.0);
}
`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uMoonDir;
uniform float uTime;
uniform float uEclipse;  // 0..1: the moon darkens to a dim red and the stars come out
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec4 far = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCamPos);
  float h = dir.y;
  float m = max(dot(dir, uMoonDir), 0.0);

  vec3 col = mix(vec3(0.022, 0.028, 0.048), vec3(0.004, 0.006, 0.018), smoothstep(0.0, 0.7, h));
  col += vec3(0.06, 0.035, 0.018) * exp(-abs(h) * 9.0);       // warm haze over the town
  vec3 halo = vec3(0.05, 0.06, 0.09) * pow(m, 10.0) + vec3(0.2, 0.24, 0.35) * pow(m, 300.0);
  vec3 redHalo = vec3(0.07, 0.015, 0.01) * pow(m, 40.0) + vec3(0.12, 0.03, 0.02) * pow(m, 600.0);
  col += mix(halo, redHalo, uEclipse);  // moon halo

  if (h > 0.0) {
    // Stars: one possible star per cell of a grid projected on the sky; most cells are empty.
    vec2 sp = dir.xz / (h + 0.25) * 70.0;
    vec2 cell = floor(sp);
    float r = hash(cell);
    if (r > 0.982) {
      vec2 at = (vec2(hash(cell + 1.7), hash(cell + 3.1)) - 0.5) * 0.6;
      float d = length(fract(sp) - 0.5 - at);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + r * 6.0) + r * 50.0);
      col += vec3(0.85, 0.9, 1.0) * smoothstep(0.09, 0.0, d) * twinkle * smoothstep(0.02, 0.25, h) * (1.0 + 0.8 * uEclipse);
    }
    // The moon's disc, with a little shading.
    float disc = smoothstep(0.99935, 0.99955, dot(dir, uMoonDir));
    vec3 moon = mix(vec3(0.92, 0.94, 1.0), vec3(0.3, 0.06, 0.04), uEclipse);
    col = mix(col, moon * (0.85 + 0.15 * noise(dir.xz * 900.0)), disc);
    // Clouds drifting slowly, brighter where the moon is behind them.
    vec2 cp = dir.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.012, uTime * 0.006);
    float c = smoothstep(0.42, 0.85, fbm(cp));
    vec3 cloud = vec3(0.04, 0.045, 0.06) + mix(vec3(0.2, 0.22, 0.3), vec3(0.06, 0.02, 0.015), uEclipse) * pow(m, 5.0);
    col = mix(col, cloud, c * 0.8 * smoothstep(0.0, 0.12, h) * (1.0 - disc * 0.6));
  }
  outColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor(gl) {
    this.gl = gl;
    this.program = createProgram(gl, VS, FS);
    this.vao = gl.createVertexArray(); // empty: the triangle comes from gl_VertexID
    this.u = {};
    for (const n of ['uInvViewProj', 'uCamPos', 'uMoonDir', 'uTime', 'uEclipse']) this.u[n] = gl.getUniformLocation(this.program, n);
  }

  // Draws behind everything (no depth writes), then the caller switches back to its own program.
  draw(invViewProj, camPos, moonDir, time, eclipse = 0) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.uInvViewProj, false, invViewProj);
    gl.uniform3fv(this.u.uCamPos, camPos);
    gl.uniform3fv(this.u.uMoonDir, moonDir);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uEclipse, eclipse);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }
}
