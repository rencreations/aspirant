/**
 * Backdrops made of points, cells and grids. The crisp ones (dots, squares, grids, pixels, stars)
 * work in CSS pixels from `uCss`, measured from the top left like the CSS ground under them, so a
 * dot of the grid sits exactly on a dot of the ground.
 */

export const PARTICLES = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 col = vec3(0.0);
  float acc = 0.0;
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    float z = 1.0 + fl * 0.85;
    vec2 g = p * z * 6.0 + vec2(fl * 17.0, -t * (0.18 + 0.11 * fl) + uS * (0.35 + 0.3 * fl));
    g -= pt * (0.3 + fl * 0.4) * uPointer.z;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float r = h21(id + fl * 31.0);
    if (r < 0.5) continue;
    vec2 off = (h22(id + fl * 7.0) - 0.5) * 0.6 + 0.1 * vec2(sin(t * 0.6 * r + r * 40.0), cos(t * 0.5 * r + r * 25.0));
    float d = length(f - off);
    float rad = (0.08 + 0.12 * h21(id + 9.0)) * (1.15 - 0.12 * fl);
    float tw = 0.55 + 0.45 * sin(t * (1.0 + 2.0 * r) + r * 50.0);
    float b = exp(-d * d / (rad * rad)) * tw * (0.45 + 0.55 * h21(id + 3.0));
    col += pal(h21(id + 5.0)) * b;
    acc += b;
  }
  return vec4(col / max(acc, 1e-4), clamp(acc * uIntensity, 0.0, 1.0));
}
`;

export const GALAXY = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = rot(t * 0.03) * (p * 1.1 - pt * 0.03 * uPointer.z);
  float r = length(q);
  float a = atan(q.y, q.x);
  float arms = pow(0.5 + 0.5 * cos(2.0 * (a - log(r + 0.04) * 3.2)), 2.2);
  float core = exp(-r * r * 14.0);
  float disc = exp(-r * 2.1);
  float dust = fbm(q * 5.0 + 3.0);
  float neb = (arms * 0.8 + core * 1.1) * disc * (0.45 + dust);
  float st = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 g = q * (26.0 + 22.0 * fl);
    vec2 id = floor(g);
    float rr = h21(id + fl * 11.0);
    float dens = 0.03 + 0.3 * arms * disc + 0.5 * core;
    if (rr < dens) {
      float d = length(fract(g) - h22(id + 2.0));
      st += smoothstep(0.14, 0.0, d) * (0.55 + 0.45 * sin(t * 2.0 + rr * 90.0));
    }
  }
  vec3 col = mix(pal(clamp(r * 1.5, 0.0, 1.0)), uInk, clamp(core * 0.8 + st * 0.7, 0.0, 1.0));
  float al = clamp(neb * 0.95 + st * 0.9, 0.0, 1.0) * uIntensity;
  return vec4(col, al);
}
`;

export const STARS = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 pc = vec3(0.0);
  float pa = 0.0;
  vec2 css = uv * uCss;
  vec2 mp = (uPointer.xy - 0.5) * uPointer.z;
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sz = (30.0 + 22.0 * fl) * uScale;
    vec2 cp = css + vec2(t * (1.5 + fl * 1.2), uS * (14.0 + 30.0 * fl)) - mp * (5.0 + 11.0 * fl);
    vec2 id = floor(cp / sz);
    vec2 f = fract(cp / sz);
    float r = h21(id + fl * 13.0);
    if (r < 0.3) continue;
    vec2 dv = (f - (0.15 + 0.7 * h22(id + 3.0))) * sz;
    float d = length(dv);
    float rad = (0.5 + 1.1 * h21(id + 8.0)) * (1.0 + 0.45 * fl);
    float tw = 0.5 + 0.5 * sin(t * (0.8 + 2.0 * r) + r * 60.0);
    float core = d < rad * 4.0 ? exp(-d * d / (rad * rad)) : 0.0;
    float spark = 0.0;
    if (r > 0.94) {
      spark = (exp(-abs(dv.x) / 0.55) * exp(-abs(dv.y) / (rad * 7.0)) + exp(-abs(dv.y) / 0.55) * exp(-abs(dv.x) / (rad * 7.0))) * tw;
    }
    if (core + spark < 0.002) continue;
    vec3 c = mix(pal(h21(id + 5.0)), uInk, 0.45);
    over(pc, pa, c, clamp(core * (0.45 + 0.55 * tw) + spark * 0.75, 0.0, 1.0));
  }
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;

export const DOT_GRID = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 cp = vec2(uv.x * uCss.x, (1.0 - uv.y) * uCss.y);
  vec2 mp = vec2(uPointer.x * uCss.x, (1.0 - uPointer.y) * uCss.y);
  float pitch = 28.0 * uScale;
  vec2 id = floor(cp / pitch);
  vec2 c = (id + 0.5) * pitch;
  vec2 d = c - mp;
  float dist = length(d);
  float infl = exp(-dist * dist / (120.0 * 120.0)) * uPointer.z;
  vec2 pos = c + d / max(dist, 1.0) * infl * 6.0;
  float wave = 0.5 + 0.5 * sin(length(c - uCss * 0.5) * 0.012 - t * 1.1 + h21(id) * 0.8);
  float rad = (1.3 + 1.2 * wave + 2.8 * infl) * min(uScale, 1.4);
  float aa = 1.0 / uPx;
  float dot_ = 1.0 - smoothstep(rad - aa, rad + aa, length(cp - pos));
  vec3 col = mix(pal(wave * 0.4), pal(0.85), infl);
  return vec4(col, dot_ * (0.5 + 0.4 * wave + 0.6 * infl) * uIntensity);
}
`;

export const SQUARES = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 css = uv * uCss;
  float size = 44.0 * uScale;
  vec2 drift = vec2(t * 7.0, t * 4.2);
  vec2 g = (css + drift) / size;
  vec2 id = floor(g);
  vec2 f = fract(g);
  vec2 e = min(f, 1.0 - f) * size;
  float edge = 1.0 - smoothstep(0.4, 1.4, min(e.x, e.y));
  vec2 mid = floor((uPointer.xy * uCss + drift) / size);
  float near = exp(-length(id - mid) * 0.8) * uPointer.z;
  float rnd = h21(id);
  float breath = step(0.93, rnd) * (0.5 + 0.5 * sin(t * 1.3 + rnd * 60.0));
  float fill = near * 0.55 + breath * 0.4;
  vec3 col = pal(fract((id.x + id.y) * 0.06));
  return vec4(col, (edge * 0.32 + fill * (1.0 - edge * 0.6)) * uIntensity);
}
`;

export const GRID_DISTORTION = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 cp = uv * uCss;
  vec2 mp = uPointer.xy * uCss;
  vec2 dv = cp - mp;
  float dist = length(dv);
  float pull = exp(-dist * dist / (200.0 * 200.0)) * 0.3 * uPointer.z;
  vec2 q = cp - dv * pull;
  q += 15.0 * vec2(sin(cp.y * 0.011 + t * 0.6), cos(cp.x * 0.009 + t * 0.5));
  float spacing = 36.0 * uScale;
  vec2 g = q / spacing;
  vec2 f = abs(fract(g - 0.5) - 0.5) * spacing;
  float line = 1.0 - smoothstep(0.4, 1.4, min(f.x, f.y));
  float lit = exp(-dist / 160.0) * uPointer.z;
  vec3 col = pal(clamp(0.15 + lit * 0.7 + 0.1 * sin(t * 0.2 + cp.x * 0.003), 0.0, 1.0));
  return vec4(col, line * (0.25 + 0.55 * lit) * uIntensity);
}
`;

export const RIPPLE_GRID = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 cp = uv * uCss;
  vec2 mp = uPointer.xy * uCss;
  vec2 c0 = uCss * vec2(0.5, 0.45);
  float spacing = 34.0 * uScale;
  vec2 dsum = vec2(0.0);
  float energy = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 src = i == 0 ? c0 : mp;
    float amp = i == 0 ? 1.0 : uPointer.z;
    vec2 dv = cp - src;
    float dist = length(dv);
    float wv = sin(dist * 0.045 - t * 2.2);
    float env = exp(-dist * 0.0018) * amp;
    dsum += dv / max(dist, 1.0) * wv * env * 9.0 * smoothstep(0.0, 40.0, dist);
    energy += abs(wv) * env;
  }
  vec2 g = (cp + dsum) / spacing;
  vec2 f = abs(fract(g - 0.5) - 0.5) * spacing;
  float line = 1.0 - smoothstep(0.4, 1.4, min(f.x, f.y));
  vec3 col = pal(clamp(energy * 0.55 + 0.1, 0.0, 1.0));
  return vec4(col, line * (0.2 + 0.6 * energy) * uIntensity);
}
`;

export const PIXEL_BLAST = /* glsl */ `
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 css = uv * uCss;
  float cell = 11.0 * uScale;
  vec2 id = floor(css / cell);
  vec2 cc = (id + 0.5) * cell;
  float n = fbm(id * 0.085 + vec2(t * 0.1, -t * 0.07));
  float wave = 0.15 * sin(id.x * 0.07 + id.y * 0.05 - t * 0.6);
  float blast = uPointer.z * exp(-length(cc - uPointer.xy * uCss) / 130.0);
  float v = n + wave + blast * 0.6;
  float on = step(bayer4(id), (v - 0.38) * 1.9);
  vec2 f = abs(css - cc);
  float sq = 1.0 - smoothstep(cell * 0.5 - 1.6, cell * 0.5 - 0.6, max(f.x, f.y));
  vec3 col = pal(h21(id) * 0.7 + 0.3 * n);
  return vec4(col, on * sq * (0.55 + 0.35 * blast) * uIntensity);
}
`;
