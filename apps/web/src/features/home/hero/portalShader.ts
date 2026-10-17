/**
 * The portal hero shader: one full-screen pass. All positions are CSS px from the top left of
 * the hero. The figure is a 4:5 portrait lifted into pseudo 3D (a small perspective yaw and
 * pitch toward the pointer, plus depth-map parallax), and a circular portal at the pointer
 * reveals the other form through a warped, glowing rim with sparks. Textures are uploaded
 * with premultiplied alpha and the output is premultiplied.
 */

export const portalVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const portalFragment = /* glsl */ `
precision highp float;

uniform vec2 uRes;
uniform vec4 uFig;
uniform vec2 uCam;
uniform vec3 uPortal;
uniform vec3 uWipe;
uniform float uForm;
uniform float uFormE;
uniform vec2 uShift;
uniform float uEnergy;
uniform float uTime;
uniform float uDissolve;
uniform float uIntro;
uniform sampler2D uBase;
uniform sampler2D uAlt;
uniform sampler2D uDepth;
uniform sampler2D uDepthAlt;
uniform float uAltOpaque;
uniform float uBaseOpaque;
uniform vec3 uGlowA;
uniform vec3 uGlowA2;
uniform vec3 uGlowB;
uniform vec3 uGlowB2;
uniform vec3 uTintA;
uniform vec3 uTintB;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.0;
    a *= 0.5;
  }
  return v;
}

// Screen px to figure UV through a small perspective turn (yaw, then pitch).
vec2 figureUv(vec2 px) {
  vec2 c = uFig.xy + uFig.zw * 0.5;
  vec2 p = (px - c) / uFig.w;
  float D = 2.4;
  float ry = uCam.x * 0.2;
  float rx = uCam.y * 0.11;
  float sy = sin(ry);
  float cy = cos(ry);
  float u = p.x * D / (D * cy - p.x * sy);
  float v = p.y * (D + u * sy) / D;
  float sx = sin(rx);
  float cx = cos(rx);
  float v2 = v * D / (D * cx - v * sx);
  float u2 = u * (D + v2 * sx) / D;
  // Idle breathing: a slow, tiny scale.
  float breathe = 1.0 + 0.006 * sin(uTime * 0.9);
  return vec2(u2 / (uFig.z / uFig.w) / breathe + 0.5, v2 / breathe + 0.5);
}

// Depth parallax: a short fixed-point search so near parts slide further than far ones.
vec2 parallax(sampler2D depthMap, vec2 uv) {
  vec2 off = uCam * vec2(0.03, 0.022);
  vec2 q = uv;
  for (int i = 0; i < 4; i++) {
    float d = texture2D(depthMap, clamp(q, 0.001, 0.999)).r;
    q = uv - off * (d - 0.35);
  }
  return q;
}

float edgeFade(vec2 uv, float opaque) {
  float side = mix(0.13, 0.2, opaque);
  float e = smoothstep(0.0, side, uv.x) * smoothstep(0.0, side, 1.0 - uv.x);
  e *= smoothstep(0.0, mix(0.03, 0.12, opaque), uv.y);
  // The lower body fades into the dark so the crop never shows a hard line.
  e *= smoothstep(0.0, 0.24, 1.0 - uv.y);
  return e;
}

vec4 sampleFigure(sampler2D tex, sampler2D depthMap, vec2 uv, float opaque) {
  if (uv.x < -0.02 || uv.x > 1.02 || uv.y < -0.02 || uv.y > 1.02) return vec4(0.0);
  vec2 q = clamp(parallax(depthMap, uv), 0.001, 0.999);
  vec4 c = texture2D(tex, q);
  return c * edgeFade(uv, opaque);
}

// Circular mask with a noisy, living edge. Returns (mask, rim glow, rim distance).
vec3 ring(vec2 px, vec2 centre, float radius, float rough) {
  vec2 d = px - centre;
  float dist = length(d);
  vec2 dir = d / max(dist, 0.001);
  float warp = fbm(dir * 1.8 + vec2(uTime * 0.35, -uTime * 0.27)) - 0.5;
  warp += 0.35 * (noise(dir * 6.0 + uTime * 1.3) - 0.5);
  float R = radius * (1.0 + warp * rough);
  float feather = 1.2 + radius * 0.012;
  float mask = 1.0 - smoothstep(R - feather, R + feather, dist);
  float sd = dist - R;
  // A thin hot core, a soft glow that spills outward, and a faint inner fringe.
  float core = exp(-abs(sd) / 1.3);
  float outer = exp(-max(sd, 0.0) / (5.0 + radius * 0.06)) * step(0.0, sd);
  float inner = exp(min(sd, 0.0) / (2.5 + radius * 0.02)) * step(sd, 0.0);
  float glow = core * 0.95 + outer * 0.45 + inner * 0.25;
  return vec3(mask, glow, sd);
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;

  // Portal and wipe masks.
  float rough = 0.16 + 0.22 * uEnergy;
  vec3 pr = uPortal.z > 0.5 ? ring(px, uPortal.xy, uPortal.z, rough) : vec3(0.0, 0.0, 1e4);
  vec3 wr = uWipe.z > 0.5 ? ring(px, uWipe.xy, uWipe.z, 0.12) : vec3(0.0, 0.0, 1e4);
  float mP = pr.x;
  float mW = uForm >= 0.999 ? 1.0 : wr.x;
  // The portal always shows the opposite of what surrounds it.
  float showAlt = mW * (1.0 - mP) + (1.0 - mW) * mP;

  // Lens: the view through the rim bends toward the centre.
  vec2 toC = px - uPortal.xy;
  float lens = uPortal.z > 0.5 ? smoothstep(0.45, 1.0, length(toC) / max(uPortal.z, 1.0)) * mP : 0.0;
  vec2 pxIn = px - toC * lens * 0.12;
  float outside = (1.0 - mP) * smoothstep(28.0, 0.0, pr.z) * step(0.0, pr.z);
  vec2 pxOut = px + normalize(toC + 0.001) * outside * 5.0;

  vec2 pxBase = mix(pxOut, pxIn, step(0.5, mP));
  vec2 pxAlt = pxBase;

  vec4 base = vec4(0.0);
  vec4 alt = vec4(0.0);
  // Face meets face: the other form is shifted so its face sits under the portal's face.
  if (showAlt < 0.999)
    base = sampleFigure(uBase, uDepth, figureUv(pxBase) - uShift * uFormE, uBaseOpaque);
  if (showAlt > 0.001)
    alt = sampleFigure(uAlt, uDepthAlt, figureUv(pxAlt) + uShift * (1.0 - uFormE), uAltOpaque);

  // Pair dissolve and intro: noise threshold with an ember edge.
  float dis = max(uDissolve, 1.0 - uIntro);
  float emberEdge = 0.0;
  float figA = mix(base.a, alt.a, showAlt);
  if (dis > 0.001) {
    vec2 fuv = (px - uFig.xy) / uFig.w;
    float n = fbm(fuv * 5.0 + vec2(0.0, uTime * 0.15));
    n = mix(n, 1.0 - (px.y - uFig.y) / uFig.w * 0.8, 0.35);
    float thr = dis * 1.25 - 0.1;
    float keep = smoothstep(thr - 0.02, thr + 0.02, n);
    emberEdge = smoothstep(0.09, 0.0, abs(n - thr)) * step(0.001, dis) * (1.0 - step(0.999, dis));
    base *= keep;
    alt *= keep;
  }

  vec4 fig = mix(base, alt, showAlt);

  // The other world seen through the portal: a tinted, slowly moving haze with scan lines.
  float inPortal = mP;
  float inWipe = mW * (1.0 - smoothstep(0.6, 1.0, uForm));
  float worldA = clamp(inPortal + inWipe * (1.0 - mP), 0.0, 1.0);
  vec3 tint = mix(uTintA, uTintB, showAlt);
  float haze = fbm(px / 240.0 + vec2(uTime * 0.04, -uTime * 0.03));
  vec3 world = tint * (0.55 + 0.9 * haze);
  world *= 0.9 + 0.1 * sin(px.y * 1.4 + uTime * 3.0);
  float worldAlpha = worldA * 0.62;
  vec4 back = vec4(world * worldAlpha, worldAlpha);
  vec4 col = fig + back * (1.0 - fig.a);

  // Rims: portal (warped, bright) and the travelling edge of the wipe.
  float t = atan(toC.y, toC.x);
  vec3 glowIn = mix(uGlowB, uGlowB2, 0.5 + 0.5 * sin(t * 2.0 + uTime * 1.7));
  vec3 glowOut = mix(uGlowA, uGlowA2, 0.5 + 0.5 * sin(t * 2.0 - uTime * 1.3));
  vec3 rimCol = mix(glowIn, glowOut, mW);
  float rimVis = smoothstep(2.0, 26.0, uPortal.z);
  vec3 light = rimCol * pr.y * rimVis * (0.85 + 0.5 * uEnergy);
  float wipeVis = uForm > 0.001 && uForm < 0.999 ? 1.0 : 0.0;
  light += mix(uGlowB, uGlowB2, 0.5) * wr.y * wipeVis;

  // Sparks thrown off the rim.
  if (rimVis > 0.01) {
    float sparks = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float h1 = hash(vec2(fi, 1.7));
      float h2 = hash(vec2(fi, 9.1));
      float life = fract(uTime * (0.32 + h2 * 0.45) + h1);
      float spin = (h2 > 0.5 ? 1.0 : -1.0) * (0.15 + h2 * 0.4);
      float a = h1 * 6.2831 + uTime * spin;
      float rr = uPortal.z + life * (14.0 + 46.0 * h2) * (0.7 + uEnergy);
      vec2 sp = uPortal.xy + vec2(cos(a), sin(a)) * rr;
      float d = length(px - sp);
      float size = 1.0 + 1.8 * h1;
      sparks += smoothstep(size * 2.6, 0.0, d) * (1.0 - life) * min(1.0, life * 6.0);
    }
    light += rimCol * sparks * rimVis * 1.6;
  }

  // Ember edge of the dissolve.
  light += mix(uGlowA, uGlowB, 0.5) * emberEdge * 1.4 * smoothstep(0.05, 0.45, figA);

  col.rgb += light;
  col.a = clamp(col.a + dot(light, vec3(0.3)) * 0.65, 0.0, 1.0);
  gl_FragColor = col;
}
`;
