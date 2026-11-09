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

void main() {
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

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = vColor * uTint;
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

  // Simple tone map and gamma, so bright lights roll off softly.
  lit = lit / (1.0 + lit);
  lit = pow(lit, vec3(1.0 / 2.2));
  outColor = vec4(lit, 1.0);
}
`;
