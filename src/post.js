// Post-processing: the scene is drawn into an offscreen multisampled framebuffer, then
//   1. resolved (anti-aliased) into a texture,
//   2. a bright-pass picks out the glowing parts at quarter resolution,
//   3. a separable Gaussian blur spreads them out (bloom),
//   4. a final pass combines scene + bloom and adds a vignette, film grain, a red/blue
//      colour split when you're hit, and a cold, desaturated look when oil runs low.
// Everything here is plain WebGL2: framebuffers, renderbuffers, textures and two tiny shaders.
import { createProgram } from './gl.js';

// A triangle that covers the whole screen, made from gl_VertexID (no vertex buffer needed).
const fullscreenVS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Keeps only the bright parts of the image, softly.
const brightFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uThreshold;
out vec4 outColor;
void main() {
  // Average 4 texels: the bright-pass is also the downsample.
  vec2 t = 1.0 / vec2(textureSize(uScene, 0));
  vec3 c = texture(uScene, vUv + t * vec2(-1, -1)).rgb + texture(uScene, vUv + t * vec2(1, -1)).rgb
         + texture(uScene, vUv + t * vec2(-1, 1)).rgb + texture(uScene, vUv + t * vec2(1, 1)).rgb;
  c *= 0.25;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThreshold, uThreshold + 0.25, lum);
  outColor = vec4(c * k, 1.0);
}`;

// 9-tap Gaussian blur in one direction (run twice: horizontal, then vertical).
const blurFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  vec2 t = uDir / vec2(textureSize(uImage, 0));
  // Linear-sampling trick: 5 fetches give a 9-tap blur.
  vec3 c = texture(uImage, vUv).rgb * 0.2270270270;
  c += (texture(uImage, vUv + t * 1.3846153846).rgb + texture(uImage, vUv - t * 1.3846153846).rgb) * 0.3162162162;
  c += (texture(uImage, vUv + t * 3.2307692308).rgb + texture(uImage, vUv - t * 3.2307692308).rgb) * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const compositeFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uTime;
uniform float uHit;      // 0..1, flashes when a shadow steals oil
uniform float uDanger;   // 0..1, rises as oil runs low
uniform float uFade;     // 0 = black, 1 = normal (level transitions)
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 fromCentre = vUv - 0.5;
  // Colour split on hit: red and blue are sampled slightly apart.
  vec2 shift = fromCentre * 0.012 * uHit;
  vec3 scene = vec3(
    texture(uScene, vUv + shift).r,
    texture(uScene, vUv).g,
    texture(uScene, vUv - shift).b);
  vec3 c = scene + texture(uBloom, vUv).rgb * uBloomStrength;

  // Low oil: drain the colour out and tint it cold.
  float grey = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(grey) * vec3(0.8, 0.9, 1.15), uDanger * 0.6);

  // Vignette, darker and redder on a hit.
  float v = smoothstep(0.85, 0.25, length(fromCentre * vec2(1.25, 1.0)));
  c *= mix(0.35, 1.0, v);
  c = mix(c, c * vec3(1.6, 0.35, 0.45), uHit * (1.0 - v) * 0.8);

  // Film grain keeps the dark areas from banding.
  c += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.025;
  outColor = vec4(c * uFade, 1.0);
}`;

function makeTexture(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function makeTarget(gl, w, h) {
  const tex = makeTexture(gl, w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

export class PostProcess {
  constructor(gl) {
    this.gl = gl;
    this.bright = this.program(brightFS, ['uScene', 'uThreshold']);
    this.blur = this.program(blurFS, ['uImage', 'uDir']);
    this.composite = this.program(compositeFS,
      ['uScene', 'uBloom', 'uBloomStrength', 'uTime', 'uHit', 'uDanger', 'uFade']);
    this.emptyVao = gl.createVertexArray();
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    this.size = [0, 0];
    this.targets = null;
  }

  program(fs, uniforms) {
    const prog = createProgram(this.gl, fullscreenVS, fs);
    const u = {};
    for (const n of uniforms) u[n] = this.gl.getUniformLocation(prog, n);
    return { prog, u };
  }

  // (Re)create the offscreen buffers when the canvas size changes.
  resize(w, h) {
    if (this.size[0] === w && this.size[1] === h) return;
    this.size = [w, h];
    const gl = this.gl;
    if (this.targets) this.free();
    // Multisampled colour + depth to draw the scene into. Very large buffers (4K) are already
    // supersampled, so 2 samples are enough there and save a lot of memory.
    const samples = w * h > 6e6 ? Math.min(2, this.samples) : this.samples;
    const msFbo = gl.createFramebuffer();
    const msColor = gl.createRenderbuffer();
    const msDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, msColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, msDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDepth);
    if (gl.getError() === gl.OUT_OF_MEMORY || gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error('Offscreen framebuffer is not supported here');
    }
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.targets = {
      msFbo, msColor, msDepth,
      scene: makeTarget(gl, w, h),     // the resolved, anti-aliased scene
      bloomA: makeTarget(gl, qw, qh),  // quarter-resolution ping-pong pair for the blur
      bloomB: makeTarget(gl, qw, qh),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  free() {
    const gl = this.gl;
    const t = this.targets;
    gl.deleteFramebuffer(t.msFbo);
    gl.deleteRenderbuffer(t.msColor);
    gl.deleteRenderbuffer(t.msDepth);
    for (const k of ['scene', 'bloomA', 'bloomB']) {
      gl.deleteFramebuffer(t[k].fbo);
      gl.deleteTexture(t[k].tex);
    }
    this.targets = null;
  }

  // Call before drawing the scene: everything drawn next goes offscreen.
  begin(w, h) {
    this.resize(w, h);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.msFbo);
    gl.viewport(0, 0, w, h);
  }

  pass(p, target) {
    const gl = this.gl;
    gl.useProgram(p.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    if (target) gl.viewport(0, 0, target.w, target.h);
    else gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  bindTex(unit, tex, loc) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  // Call after drawing the scene: runs the effect chain and draws to the screen.
  end({ time, hit = 0, danger = 0, fade = 1, bloom = 1 }) {
    const gl = this.gl;
    const t = this.targets;
    const [w, h] = this.size;

    // 1. Resolve the multisampled scene into a normal texture.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.msFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.scene.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.emptyVao);

    if (bloom > 0) {
      // 2. Bright pass (and downsample) into bloomA.
      gl.useProgram(this.bright.prog);
      this.bindTex(0, t.scene.tex, this.bright.u.uScene);
      gl.uniform1f(this.bright.u.uThreshold, 0.45);
      this.pass(this.bright, t.bloomA);
      // 3. Blur back and forth twice for a wide, soft glow.
      gl.useProgram(this.blur.prog);
      for (let i = 0; i < 2; i++) {
        this.bindTex(0, t.bloomA.tex, this.blur.u.uImage);
        gl.uniform2f(this.blur.u.uDir, 1 + i, 0);
        this.pass(this.blur, t.bloomB);
        this.bindTex(0, t.bloomB.tex, this.blur.u.uImage);
        gl.uniform2f(this.blur.u.uDir, 0, 1 + i);
        this.pass(this.blur, t.bloomA);
      }
    }

    // 4. Combine everything onto the screen.
    const c = this.composite;
    gl.useProgram(c.prog);
    this.bindTex(0, t.scene.tex, c.u.uScene);
    this.bindTex(1, t.bloomA.tex, c.u.uBloom);
    gl.uniform1f(c.u.uBloomStrength, bloom > 0 ? 0.9 * bloom : 0);
    gl.uniform1f(c.u.uTime, time % 100);
    gl.uniform1f(c.u.uHit, hit);
    gl.uniform1f(c.u.uDanger, danger);
    gl.uniform1f(c.u.uFade, fade);
    this.pass(c, null);

    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
  }
}
