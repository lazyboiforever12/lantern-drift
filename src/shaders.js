// One shader for everything. Lighting is hand-written: a faint moon, up to 16 point lights
// (the boat's lantern, flares, buoys, the lighthouse) and emissive parts that glow in the dark.

export const MAX_LIGHTS = 16;
export const MAX_OCCLUDERS = 8;  // shadow creatures, traced as soft spheres

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
#define MAX_OCCLUDERS ${MAX_OCCLUDERS}
#define MAX_STEPS 40
#define ROOF_MAX 2.6   // no roof is taller, so a ray above this can't be blocked

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

// Ray tracing. The level is a grid of building heights (one texel per cell, water is far below 0).
// Each light ray walks that grid cell by cell, so buildings cast real shadows from every light.
uniform highp sampler2D uHeightMap;
uniform ivec2 uGridSize;
uniform float uCell;
uniform int uRayShadows;
uniform int uOccluderCount;
uniform vec4 uOccluders[MAX_OCCLUDERS]; // xyz centre, w radius
uniform float uFog;                      // density of the lit mist; 0 turns it off
uniform float uTime;                     // seconds, for the lapping foam
uniform float uRain;                     // 1 while it rains: raindrop rings on the water
uniform float uSelfLit;                  // glows by itself (the ghost boat), even far from any lamp

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Fine detail for the water's surface, as a tilt of the normal (x and z). Three small wind
// ripples, each a cosine with an exact slope, plus rings spreading from raindrops: the water is
// split into cells, each with a drop landing at a random moment and place, and the ring is a
// thin band around a growing radius.
vec2 waterDetail(vec2 p) {
  vec2 g = vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 3.1 + uTime * 2.3) * 0.05;
  g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 4.7 + uTime * 2.9) * 0.035;
  g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 6.3 + uTime * 3.7) * 0.025;
  if (uRain > 0.0) {
    for (int k = 0; k < 2; k++) {
      vec2 q = p * 1.4 + float(k) * 17.3;
      vec2 id = floor(q);
      float h = hash2(id);
      float t = fract(uTime * 0.8 + h);
      vec2 d = fract(q) - 0.5 - (vec2(hash2(id + 3.1), hash2(id + 7.7)) - 0.5) * 0.5;
      float r = length(d);
      float band = exp(-pow((r - t * 0.45) * 22.0, 2.0)) * (1.0 - t);
      g += d / max(r, 0.001) * band * 0.5 * uRain;
    }
  }
  return g;
}

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

float cellHeight(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= uGridSize.x || c.y >= uGridSize.y) return -100.0;
  return texelFetch(uHeightMap, c, 0).r;
}

// Visibility (0..1) from p to a light at lp through the building grid: a 2D DDA (Amanatides-Woo)
// in cell space. In each cell the ray is a straight line in height, so the lowest point is at the
// cell's entry or exit. Passing just over a roof gives a soft edge instead of a hard cut.
float traceGrid(vec3 p, vec3 lp) {
  vec3 d = lp - p;
  vec2 a = p.xz / uCell;
  vec2 dir = d.xz / uCell;
  ivec2 c = ivec2(floor(a));
  ivec2 stepDir = ivec2(dir.x >= 0.0 ? 1 : -1, dir.y >= 0.0 ? 1 : -1);
  vec2 inv = 1.0 / max(abs(dir), vec2(1e-5));
  vec2 frac = a - vec2(c);
  vec2 tMax = vec2(dir.x >= 0.0 ? 1.0 - frac.x : frac.x, dir.y >= 0.0 ? 1.0 - frac.y : frac.y) * inv;
  float len = length(d);
  float vis = 1.0;
  float t = 0.0;
  bool startSolid = cellHeight(c) > -50.0;  // a roof: skip its own cell
  for (int i = 0; i < MAX_STEPS; i++) {
    float tNext = min(min(tMax.x, tMax.y), 1.0);
    if (i > 0 || !startSolid) {
      float h = cellHeight(c);
      float yMin = p.y + d.y * (d.y < 0.0 ? tNext : t);
      // Distance above the roof, compared with how far along the ray we are: a light is not a point.
      vis = min(vis, clamp((yMin - h) * 6.0 / (0.6 + t * len * 0.35), 0.0, 1.0));
      if (vis <= 0.0) return 0.0;
    }
    if (tNext >= 1.0) break;
    t = tNext;
    if (d.y > 0.0 && p.y + d.y * t > ROOF_MAX) break;  // climbing above every roof: nothing left to hit
    if (tMax.x < tMax.y) { c.x += stepDir.x; tMax.x += inv.x; } else { c.y += stepDir.y; tMax.y += inv.y; }
  }
  return vis;
}

// Distance across the water (in x and z) from p to the nearest building, checking the 3 x 3 cells
// around it. Used for foam where water laps against walls, and for ambient occlusion.
float wallDistance(vec3 p) {
  vec2 a = p.xz / uCell;
  ivec2 c = ivec2(floor(a));
  float best = 9.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 q = c + ivec2(dx, dy);
      if (cellHeight(q) < -50.0) continue;
      vec2 lo = vec2(q) * uCell, hi = lo + uCell;
      vec2 d = max(max(lo - p.xz, p.xz - hi), 0.0);
      best = min(best, length(d));
    }
  }
  return best;
}

// Soft shadow of a sphere along a ray (ro, unit rd) up to distance tMax.
float sphereShadow(vec3 ro, vec3 rd, vec4 s, float tMax) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - s.w * s.w;
  float h = b * b - c;
  float d = -s.w + sqrt(max(0.0, s.w * s.w - h));
  float t = -b - sqrt(max(0.0, h));
  if (t < 0.0 || t > tMax) return 1.0;
  return smoothstep(0.0, 1.0, 5.0 * d / t);
}

float lightVisibility(vec3 p, vec3 lp) {
  // A ray that starts above every roof and goes up can't hit a building.
  float vis = (p.y > ROOF_MAX && lp.y > p.y) ? 1.0 : traceGrid(p, lp);
  if (vis <= 0.0) return 0.0;
  vec3 L = lp - p;
  float dist = length(L);
  L /= dist;
  for (int i = 0; i < MAX_OCCLUDERS; i++) {
    if (i >= uOccluderCount) break;
    vis *= sphereShadow(p, L, uOccluders[i], dist);
  }
  return vis;
}

// Light scattered towards the camera by mist along the view ray, from one point light.
// The integral of 1 / distance^2 along a line has a closed form (an arctangent), so this
// costs a few instructions instead of marching through the fog.
float inScatter(vec3 ro, vec3 rd, float tEnd, vec3 lp, float radius) {
  vec3 oc = lp - ro;
  float tca = dot(oc, rd);
  float h = sqrt(max(dot(oc, oc) - tca * tca, 0.09));
  float t0 = max(0.0, tca - radius), t1 = min(tEnd, tca + radius);
  if (t1 <= t0) return 0.0;
  return (atan((t1 - tca) / h) - atan((t0 - tca) / h)) / h;
}

void main() {
  // In the mirrored (reflection) pass, nothing below the water line should show.
  if (uClip == 1 && vWorld.y < -0.02) discard;
  vec3 n = normalize(vNormal);
  if (uWater == 1) {
    vec2 g = waterDetail(vWorld.xz);
    n = normalize(n + vec3(g.x, 0.0, g.y));
  }
  vec3 base = vColor * uTint;
  if (uTexSide >= 0 && vEmissive < 0.01) base *= surfaceTexture();
  vec3 V = normalize(uCamPos - vWorld);
  bool water = uWater == 1;
  float shininess = water ? 70.0 : 18.0;
  float specAmount = water ? 1.4 : 0.12;

  // Ambient occlusion: water hemmed in by walls, and the bottoms of walls, get less light.
  // Foam: a lapping white line where the water meets a wall.
  float ao = 1.0;
  float foam = 0.0;
  if (uGridSize.x > 0) {
    if (water) {
      float wd = wallDistance(vWorld);
      ao = mix(0.35, 1.0, smoothstep(0.0, 1.4, wd));
      float edge = 0.32 + 0.12 * sin(uTime * 1.7 + vWorld.x * 2.1 + vWorld.z * 1.7);
      foam = (1.0 - smoothstep(0.03, edge, wd)) * (0.65 + 0.35 * sin(uTime * 3.0 + (vWorld.x + vWorld.z) * 4.0));
      base = mix(base, vec3(0.8, 0.88, 0.92), foam * 0.75);
      specAmount *= 1.0 - foam * 0.7;
    } else if (uTexSide == 0) {
      ao = mix(0.45, 1.0, smoothstep(-0.3, 0.9, vWorld.y)); // brick walls darken towards the water
    }
  }

  vec3 lit = uAmbient * base * ao;
  lit += uMoonColor * base * max(dot(n, uMoonDir), 0.0) * ao;
  lit += uMoonColor * foam * 0.35; // a faint moonlit edge only: brighter made glowing outlines in the dark
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
    att *= att * (0.5 + 0.5 * ao);
    if (att <= 0.0) continue;
    float facing = dot(n, L);
    if (facing <= 0.0 && !water) continue;  // faces away: no light to shadow
    if (uRayShadows == 1 && att * max(facing, 0.2) * max(uLightColor[i].r, uLightColor[i].g) > 0.004) {
      // Start just off the surface so a wall doesn't shadow itself.
      att *= lightVisibility(vWorld + n * 0.04, uLightPos[i]);
      if (att <= 0.0) continue;
    }
    float diff = max(dot(n, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), shininess) * specAmount;
    lit += uLightColor[i] * att * (diff * base + spec);
  }

  lit += vColor * vEmissive * uEmissiveBoost;
  lit += base * uSelfLit;

  if (water && uReflect == 1) {
    // Look up the mirrored scene at this pixel, nudged by the wave normal so it ripples.
    vec2 suv = gl_FragCoord.xy / uViewport + n.xz * 0.06;
    vec3 refl = texture(uReflection, suv).rgb;
    // The reflection was stored after tone mapping; undo that so it blends like real light.
    refl = min(pow(refl, vec3(2.2)), vec3(0.95));
    refl = refl / (1.0 - refl);
    // Fresnel: water reflects more at grazing angles.
    float fres = 0.35 + 0.65 * pow(1.0 - max(dot(n, V), 0.0), 3.0);
    lit += refl * fres * 1.5 * (1.0 - foam * 0.8); // foam is opaque: it hides the reflection
  }

  if (uFog > 0.0 && uClip == 0) {
    vec3 rd = vWorld - uCamPos;
    float tEnd = length(rd);
    rd /= tEnd;
    vec3 mist = vec3(0.0);
    // Only the first few lights (lantern, flare, lighthouse) are bright enough to light the mist.
    for (int i = 0; i < 3; i++) {
      if (i >= uLightCount) break;
      mist += uLightColor[i] * inScatter(uCamPos, rd, tEnd, uLightPos[i], uLightRadius[i]);
    }
    lit += mist * uFog;
  }

  // Simple tone map and gamma, so bright lights roll off softly.
  lit = lit / (1.0 + lit);
  lit = pow(lit, vec3(1.0 / 2.2));
  outColor = vec4(lit, 1.0);
}
`;
