/**
 * The four elements of Tetra's bending scene: earth (stone and dust), air (wind and swirls), water
 * (caustics and ripples) and fire (flame and embers).
 */

export const EARTH = /* glsl */ `
// A faceted boulder: the farthest of six jittered faces, each flat-shaded by its own direction.
float rockD(vec2 q, float seed, out float shade) {
  float d = -1e3;
  shade = 0.5;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float an = (fi + 0.8 * (h11(seed + fi * 1.7) - 0.5)) / 6.0 * TAU;
    vec2 nrm = vec2(cos(an), sin(an));
    float off = 0.1 + 0.075 * h11(seed * 2.3 + fi * 5.1);
    float fd = dot(q, nrm) - off;
    if (fd > d) {
      d = fd;
      shade = 0.5 + 0.5 * dot(nrm, vec2(-0.6, 0.8)) + 0.12 * (h11(seed + fi) - 0.5);
    }
  }
  return d;
}
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 pc = vec3(0.0);
  float pa = 0.0;
  float haze = fbm(p * 2.0 + vec2(t * 0.03, 0.0)) * smoothstep(0.6, -0.5, p.y);
  over(pc, pa, pal(0.45), haze * 0.3);
  for (int ll = 0; ll < 3; ll++) {
    float fl = float(2 - ll);
    float sc = 2.2 + fl * 1.9;
    vec2 g = p * sc + vec2(fl * 9.0, -t * (0.035 + 0.02 * fl) + uS * 0.25 * (fl + 1.0)) - pt * 0.05 * (3.0 - fl) * uPointer.z;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float rn = h21(id + fl * 19.0);
    if (rn < 0.45) continue;
    vec2 off = (h22(id + 3.0) - 0.5) * 0.22;
    float ang = (h21(id + 7.0) - 0.5) * 2.0 + t * 0.05 * (h21(id + 1.0) - 0.5);
    vec2 q = rot(ang) * (f - off);
    float shade;
    float d = rockD(q, rn * 10.0 + fl, shade);
    float aa = 0.006 * sc * 0.5 + 0.004;
    float body = smoothstep(aa, -aa, d);
    float cel = floor(clamp(shade, 0.0, 0.999) * 4.0) / 3.0;
    vec3 c = mix(pal(0.0), pal(0.55), clamp(cel, 0.0, 1.0));
    float rim = exp(-abs(d) * 70.0) * 0.55;
    vec3 rc = mix(c, pal(1.0), rim);
    float depth = 0.96 - fl * 0.2;
    over(pc, pa, rc, clamp((body + rim * 0.2) * depth, 0.0, 1.0));
  }
  vec2 dg = p * 38.0 + vec2(-t * 1.8, t * 0.5);
  vec2 did = floor(dg);
  float dr = h21(did);
  vec2 dv = fract(dg) - h22(did + 4.0);
  float dust = step(0.82, dr) * exp(-dot(dv, dv) / 0.015) * (0.5 + 0.5 * sin(t * 1.5 + dr * 80.0));
  over(pc, pa, pal(0.8), dust * 0.7);
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;

export const AIR = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 v1 = vec2(-0.32 + 0.1 * sin(t * 0.2), 0.12);
  vec2 v2 = vec2(0.36, -0.16 + 0.08 * cos(t * 0.17));
  vec2 d1 = p - v1;
  vec2 d2 = p - v2;
  float r1 = length(d1);
  float r2 = length(d2);
  vec2 q = p;
  q = v1 + rot(1.5 * exp(-r1 * 3.0) * sin(t * 0.3 + 1.0)) * (q - v1);
  q = v2 + rot(-1.4 * exp(-r2 * 3.0) * sin(t * 0.27)) * (q - v2);
  q.y += 0.07 * sin(q.x * 2.4 + t * 0.5) + 0.04 * sin(q.x * 5.0 - t * 0.7);
  float s1 = vn(vec2(q.x * 1.1 - t * 0.55, q.y * 34.0));
  float s2 = vn(vec2(q.x * 0.6 - t * 0.8 + 7.0, q.y * 14.0 + 3.0));
  float mask = smoothstep(0.3, 0.7, fbm(vec2(q.x * 0.8 - t * 0.2, q.y * 2.0)));
  float streak = (smoothstep(0.62, 0.98, s1) * 0.9 + smoothstep(0.68, 1.0, s2) * 0.7) * mask;
  float a1 = atan(d1.y, d1.x);
  float a2 = atan(d2.y, d2.x);
  float sp = smoothstep(0.92, 1.0, sin(r1 * 42.0 - a1 * 2.0 + t * 1.5)) * exp(-r1 * 4.0);
  sp += smoothstep(0.92, 1.0, sin(r2 * 38.0 + a2 * 2.0 - t * 1.3)) * exp(-r2 * 4.0);
  float haze = 0.06 * mask;
  vec3 col = mix(pal(0.25 + streak * 0.2), uInk, clamp(streak * 0.5 + sp * 0.4, 0.0, 1.0));
  return vec4(col, clamp(streak + sp * 0.8 + haze, 0.0, 1.0) * uIntensity);
}
`;

export const WATER = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 6.0 - 250.0;
  float tt = t * 0.35 + 23.0;
  vec2 i = q;
  float c = 1.0;
  float inten = 0.0055;
  for (int n = 0; n < 4; n++) {
    float tn = tt * (1.0 - (3.5 / float(n + 1)));
    i = q + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tn) / inten), q.y / (cos(i.y + tn) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  float caus = pow(abs(c), 8.0);
  vec2 dp = p - pt;
  float dr = length(dp);
  float rip = sin(dr * 52.0 - t * 3.2) * exp(-dr * 4.5) * uPointer.z * 0.5;
  float cyc = t / 3.2 + uSeed;
  float ci = floor(cyc);
  float cf = fract(cyc);
  vec2 dpos = (h22(vec2(ci, 3.0)) - 0.5) * vec2(uAsp * 0.8, 0.7);
  float rad = cf * 0.45;
  float ring = exp(-pow((length(p - dpos) - rad) / 0.012, 2.0)) * (1.0 - cf);
  float depth = 0.5 + 0.5 * fbm(p * 1.6 + vec2(t * 0.03, 0.0));
  vec3 base = mix(pal(0.15), pal(0.55), depth);
  vec3 col = mix(base, pal(1.0), clamp(caus * 0.9 + ring * 0.8 + abs(rip) * 0.9, 0.0, 1.0));
  float a = (0.5 + 0.3 * depth + caus * 0.5 + ring * 0.5 + abs(rip) * 0.4) * uIntensity;
  return vec4(col, clamp(a, 0.0, 1.0));
}
`;

export const FIRE = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = vec2(p.x * 2.2, p.y + 0.5);
  float n = fbm(vec2(q.x * 1.6, q.y * 1.2 - t * 0.9));
  float n2 = fbm(vec2(q.x * 3.3 + 5.0, q.y * 2.4 - t * 1.4));
  float flick = 0.92 + 0.08 * sin(t * 13.0 + n * 6.0);
  float f = (1.0 - q.y * 0.95) + (n - 0.5) * 1.15 + (n2 - 0.5) * 0.4;
  f = smoothstep(0.35, 1.1, f) * flick;
  vec3 col = pal(clamp(1.0 - f * 1.15, 0.0, 1.0));
  vec3 pc = col * f * 0.9;
  float pa = f * 0.9;
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float cols = 10.0 + 7.0 * fl;
    vec2 g = vec2(p.x * cols + fl * 5.0, p.y * (cols * 0.55) - t * (0.55 + 0.3 * fl));
    vec2 id = floor(g);
    float r = h21(id + fl * 9.0);
    if (r < 0.62) continue;
    vec2 f2 = fract(g) - 0.5;
    f2.x += 0.22 * sin(t * (1.0 + r) + r * 40.0 + g.y * 0.8);
    float d = length(f2 - (h22(id + 3.0) - 0.5) * 0.3);
    float life = 0.4 + 0.6 * sin(t * 2.5 * r + r * 70.0) * sin(t * 2.5 * r + r * 70.0);
    float e = exp(-d * d / (0.012 + 0.012 * r)) * life * smoothstep(-0.55, 0.0, p.y + 0.1);
    over(pc, pa, mix(pal(0.0), pal(0.3), r), clamp(e, 0.0, 1.0));
  }
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;
