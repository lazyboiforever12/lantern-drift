// One shader for everything. Lighting is hand-written: a faint moon, up to 16 point lights
// (the boat's lantern, flares, buoys, the lighthouse) and emissive parts that glow in the dark.

export const MAX_LIGHTS = 16;

export const vertexShader = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aEmissive;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform float uTime;
uniform int uWater;

out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out float vEmissive;
out vec3 vLocal;       // position in the model's own space, for textures that stick to moving objects
out vec3 vLocalNormal;

void main() {
  vLocal = aPos;
  vLocalNormal = aNormal;
  vec4 world = uModel * vec4(aPos, 1.0);
  vec3 n = mat3(uModel) * aNormal;

  if (uWater == 1) {
    // Three overlapping sine waves, with the matching analytic normal.
    float x = world.x, z = world.z, t = uTime;
    world.y += 0.12 * sin(x * 0.6 + t * 1.3)
             + 0.10 * cos(z * 0.5 + t * 1.1)
             + 0.04 * sin((x + z) * 1.3 + t * 2.0);
    float dx = 0.072 * cos(x * 0.6 + t * 1.3) + 0.052 * cos((x + z) * 1.3 + t * 2.0);
    float dz = -0.05 * sin(z * 0.5 + t * 1.1) + 0.052 * cos((x + z) * 1.3 + t * 2.0);
    n = vec3(-dx, 1.0, -dz);
  }

  vWorld = world.xyz;
  vNormal = n;
  vColor = aColor;
  vEmissive = aEmissive;
  gl_Position = uViewProj * world;
}
`;

export const fragmentShader = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

#define MAX_LIGHTS ${MAX_LIGHTS}

in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in float vEmissive;
in vec3 vLocal;
in vec3 vLocalNormal;

// Textures: one texture array, picked per draw. -1 means untextured.
uniform highp sampler2DArray uTextures;
uniform int uTexSide;     // layer used on walls
uniform int uTexTop;      // layer used on upward-facing faces (roofs)
uniform float uTexScale;  // texture repeats per world unit

// Planar reflection (water only), plus clipping for the mirrored pass.
uniform sampler2D uReflection;
uniform int uReflect;
uniform vec2 uViewport;
uniform int uClip;

uniform int uWater;
uniform vec3 uTint;
uniform float uEmissiveBoost;
uniform vec3 uCamPos;
uniform vec3 uAmbient;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform int uLightCount;
uniform vec3 uLightPos[MAX_LIGHTS];
uniform vec3 uLightColor[MAX_LIGHTS];
uniform float uLightRadius[MAX_LIGHTS];

out vec4 outColor;

// Triplanar mapping: project the texture along whichever axis the surface faces most,
// so boxes get textured without storing any texture coordinates.
vec3 surfaceTexture() {
  vec3 an = abs(vLocalNormal);
  vec3 p = vLocal * uTexScale;
  vec2 uv;
  int layer = uTexSide;
  if (an.y > an.x && an.y > an.z) { uv = p.xz; if (vLocalNormal.y > 0.0) layer = uTexTop; }
  else if (an.x > an.z) uv = vec2(p.z, -p.y);
  else uv = vec2(p.x, -p.y);
  if (layer < 0) return vec3(1.0);
  return texture(uTextures, vec3(uv, float(layer))).rgb * 2.0;
}

void main() {
  // In the mirrored (reflection) pass, nothing below the water line should show.
  if (uClip == 1 && vWorld.y < -0.02) discard;
  vec3 n = normalize(vNormal);
  vec3 base = vColor * uTint;
  if (uTexSide >= 0 && vEmissive < 0.01) base *= surfaceTexture();
  vec3 V = normalize(uCamPos - vWorld);
  bool water = uWater == 1;
  float shininess = water ? 70.0 : 18.0;
  float specAmount = water ? 1.4 : 0.12;

  vec3 lit = uAmbient * base;
  lit += uMoonColor * base * max(dot(n, uMoonDir), 0.0);
  if (water) {
    vec3 H = normalize(uMoonDir + V);
    lit += uMoonColor * 2.0 * pow(max(dot(n, H), 0.0), 200.0);
  }

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec3 L = uLightPos[i] - vWorld;
    float d = length(L);
    L /= max(d, 0.0001);
    float att = clamp(1.0 - d / uLightRadius[i], 0.0, 1.0);
    att *= att;
    float diff = max(dot(n, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), shininess) * specAmount;
    lit += uLightColor[i] * att * (diff * base + spec);
  }

  lit += vColor * vEmissive * uEmissiveBoost;

  if (water && uReflect == 1) {
    // Look up the mirrored scene at this pixel, nudged by the wave normal so it ripples.
    vec2 suv = gl_FragCoord.xy / uViewport + n.xz * 0.06;
    vec3 refl = texture(uReflection, suv).rgb;
    // The reflection was stored after tone mapping; undo that so it blends like real light.
    refl = min(pow(refl, vec3(2.2)), vec3(0.95));
    refl = refl / (1.0 - refl);
    // Fresnel: water reflects more at grazing angles.
    float fres = 0.35 + 0.65 * pow(1.0 - max(dot(n, V), 0.0), 3.0);
    lit += refl * fres * 1.5;
  }

  // Simple tone map and gamma, so bright lights roll off softly.
  lit = lit / (1.0 + lit);
  lit = pow(lit, vec3(1.0 / 2.2));
  outColor = vec4(lit, 1.0);
}
`;
