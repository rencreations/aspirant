/**
 * Backdrops made of beams, rays, strands and streaks. Hairline ones read CSS pixels from `uCss` so
 * their lines stay one pixel wide at any buffer size.
 */

export const BEAMS = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 col = vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float s = h11(fi * 3.7 + 1.0);
    float x0 = (fi / 6.0 - 0.5) * 1.5 + 0.08 * sin(t * (0.15 + 0.1 * s) + fi * 2.0);
    float ang = 0.32 + 0.12 * sin(t * 0.11 + fi) + pt.x * 0.05 * uPointer.z;
    vec2 q = rot(ang) * (p - vec2(x0, 0.62));
    float w = 0.01 + 0.03 * s;
    float d = abs(q.x);
    float core = exp(-d * d / (w * w));
    float halo = exp(-d / (w * 6.0)) * 0.25;
    float along = q.y < 0.0 ? exp(q.y * 0.9) : 0.0;
    float pulse = 0.65 + 0.35 * sin(q.y * 7.0 - t * (0.6 + s) + fi);
    float b = (core + halo) * along * pulse * (0.6 + 0.4 * sin(t * 0.4 + fi * 5.0));
    col += pal(fi / 6.0) * b;
    acc += b;
  }
  return vec4(col / max(acc, 1e-4), 1.0 - exp(-acc * 1.5 * uIntensity));
}
`;

export const LIGHT_RAYS = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 src = vec2(-0.2 + pt.x * 0.12, 0.74);
  vec2 q = p - src;
  float r = length(q);
  float a = atan(q.x, -q.y);
  float rays = vn(vec2(a * 14.0 + t * 0.15, 1.0));
  rays += 0.6 * vn(vec2(a * 31.0 - t * 0.11, 4.0));
  rays += 0.4 * vn(vec2(a * 63.0 + t * 0.2, 9.0));
  rays = pow(rays / 2.0, 2.2) * 2.6;
  float fall = exp(-r * 1.25);
  float spread = smoothstep(1.1, 0.0, abs(a));
  float dust = fbm(q * 6.0 + vec2(0.0, t * 0.05));
  float v = rays * fall * spread * (0.65 + 0.6 * dust);
  vec3 col = pal(clamp(r * 0.7 + 0.2 * a + 0.2, 0.0, 1.0));
  return vec4(col, clamp(v * uIntensity, 0.0, 1.0));
}
`;

export const THREADS = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  const float N = 26.0;
  float spread = 0.95 - 0.4 * exp(-p.x * p.x * 1.3);
  float best = 1e3;
  float bk = 0.0;
  float kb = floor((p.y / spread + 0.5) * N);
  for (int j = -1; j <= 1; j++) {
    float k = kb + float(j);
    float base = ((k + 0.5) / N - 0.5) * spread;
    float wv = 0.15 * (vn(vec2(p.x * 1.3 + k * 0.21, t * 0.11 + k * 0.05)) - 0.5) + 0.03 * sin(p.x * 3.1 + k * 0.37 + t * 0.3);
    float d = abs(p.y - (base + wv * (0.4 + 0.6 * spread)));
    if (d < best) { best = d; bk = k; }
  }
  float w = 1.3 * CPX;
  float line = 1.0 - smoothstep(0.35 * w, w, best);
  float glow = exp(-best * 55.0) * 0.1;
  float pulse = 0.4 + 0.6 * (0.5 + 0.5 * sin(p.x * 2.2 + bk * 0.4 + t * 0.5));
  vec3 col = pal(clamp(bk / N + 0.5 + 0.12 * sin(t * 0.1), 0.0, 1.0));
  return vec4(col, (line * pulse + glow) * uIntensity);
}
`;

export const FLOATING_LINES = /* glsl */ `
float flY(float x, float y0, float s, float fi, float t) {
  return y0 + 0.12 * sin(x * (1.2 + s) + fi * 2.0 + t * 0.25) + 0.05 * sin(x * 3.1 + t * 0.4 + s * 6.0);
}
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 pc = vec3(0.0);
  float pa = 0.0;
  float half_ = uAsp * 0.5;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float s = h11(fi * 5.3 + 2.0);
    float y0 = (fi / 5.0 - 0.5) * 0.9;
    float y = flY(p.x, y0, s, fi, t);
    float d = abs(p.y - y);
    if (d > 0.22) continue;
    float w = (1.1 + 0.8 * s) * CPX;
    float l = 1.0 - smoothstep(0.3 * w, w, d);
    float glow = exp(-d * 30.0) * 0.18;
    float fade = smoothstep(-half_, -half_ * 0.45, p.x) * smoothstep(half_, half_ * 0.45, p.x);
    float nx = (fract(t * 0.04 * (0.6 + s) + s) - 0.5) * uAsp;
    float nd = length(vec2(p.x - nx, p.y - flY(nx, y0, s, fi, t)));
    float node = exp(-nd * nd / 0.00012) * 0.9 + exp(-nd * 40.0) * 0.12;
    float a = (l * 0.55 + glow + node) * fade;
    over(pc, pa, pal(fi / 5.0), clamp(a, 0.0, 1.0));
  }
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;

export const WAVES = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 pc = vec3(0.0);
  float pa = 0.0;
  for (int ii = 0; ii < 5; ii++) {
    float fi = float(4 - ii);
    float k = fi / 4.0;
    float y = -0.32 + k * 0.42 + 0.05 * sin(p.x * (1.8 + k * 1.4) + t * (0.3 + k * 0.18) + fi * 1.7) + 0.022 * sin(p.x * 5.1 - t * 0.5 + fi) + 0.02 * (vn(vec2(p.x * 2.0 + fi * 4.0, t * 0.2)) - 0.5);
    float below = p.y - y;
    float body = smoothstep(0.004, -0.004, below);
    float foam = exp(-abs(below) * 70.0) * 0.8;
    vec3 c = mix(pal(k), pal(clamp(k + 0.25, 0.0, 1.0)), smoothstep(0.0, -0.4, below));
    over(pc, pa, c, clamp(body * (0.8 - 0.1 * fi) + foam * 0.55, 0.0, 1.0));
  }
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;

export const GRADIENT_BLINDS = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float N = 22.0;
  float u = (p.x / uAsp + 0.5) * N;
  float id = floor(u);
  float f = fract(u);
  float tilt = sin(id * 0.4 + t * 0.45 + p.y * 1.2) - (p.x - pt.x) * 0.5 * uPointer.z;
  float lit = smoothstep(0.0, 1.0, f * 0.55 + 0.22 + tilt * 0.4);
  vec3 col = mix(pal(id / N + 0.1 * p.y), pal(fract(id / N + 0.35)), lit);
  col *= 0.7 + 0.45 * lit;
  float gap = smoothstep(0.0, 0.06, f) * smoothstep(1.0, 0.94, f);
  float a = (0.3 + 0.55 * lit) * (0.35 + 0.65 * gap) * uIntensity;
  return vec4(col, a);
}
`;

export const HYPERSPEED = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p - pt * 0.06 * uPointer.z;
  float r = length(q);
  float a = atan(q.y, q.x);
  float N = 90.0;
  float id = floor(a / TAU * N + 0.5);
  float sa = (a / TAU * N + 0.5 - id);
  float hs = h11(id * 1.37 + uSeed);
  float z = fract(hs + t * (0.1 + 0.2 * h11(id * 7.1)));
  float head = pow(z, 2.1) * 1.25;
  float len = 0.04 + 0.4 * z;
  float lat = sa * (TAU / N) * r;
  float wdt = (0.0016 + 0.002 * hs) * (0.4 + z);
  float along = smoothstep(len, 0.0, head - r) * step(r, head);
  float line = exp(-lat * lat / (wdt * wdt)) * along;
  float glow = exp(-r * 3.0) * 0.12;
  vec3 col = pal(h11(id * 3.3 + 1.0));
  return vec4(mix(col, uInk, line * 0.4 * z), (line * (0.4 + 0.9 * z) + glow) * uIntensity);
}
`;

export const SPEED_LINES = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float boost = 1.0 + min(uVel, 3.0) * 0.8;
  vec3 pc = vec3(0.0);
  float pa = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float cols = 46.0 + 30.0 * fl;
    float u = (p.x / uAsp + 0.5) * cols;
    float id = floor(u);
    float f = fract(u) - 0.5;
    float hs = h21(vec2(id, fl * 9.0 + uSeed));
    if (hs < 0.28) continue;
    float spd = (0.5 + 0.9 * h21(vec2(id, 4.0 + fl))) * boost;
    float z = fract(hs * 7.0 + t * spd * 0.55);
    float y = 0.7 - z * 1.5;
    float len = 0.12 + 0.34 * h21(vec2(id, 8.0 + fl)) + min(uVel, 3.0) * 0.06;
    float tail = smoothstep(0.0, len, p.y - y) * step(y, p.y) * step(p.y, y + len);
    float wd = (0.07 - 0.02 * fl) * (0.6 + 0.8 * h21(vec2(id, 2.0)));
    float line = exp(-f * f / (wd * wd)) * tail;
    over(pc, pa, mix(pal(hs), uInk, 0.35 * tail), clamp(line * (0.8 - 0.25 * fl), 0.0, 1.0));
  }
  return vec4(pc / max(pa, 1e-4), pa * uIntensity);
}
`;

export const LIGHTNING = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float period = 2.2;
  float cyc = t / period + uSeed;
  float ci = floor(cyc);
  float ph = fract(cyc);
  float x0 = (h11(ci * 3.1 + 1.0) - 0.5) * uAsp * 0.7;
  float yy = 0.55 - p.y;
  float grow = clamp(ph * 28.0, 0.0, 1.0);
  float disp = (fbm(vec2(yy * 3.4, ci * 7.1)) - 0.5) * 0.5 + (vn(vec2(yy * 11.0, ci * 3.3)) - 0.5) * 0.12;
  float d = abs(p.x - (x0 + disp));
  float env = exp(-ph * 5.0) * (0.7 + 0.3 * step(0.5, fract(ph * 14.0)));
  float after = exp(-ph * 1.6);
  float seen = step(yy, grow * 1.15) * step(0.0, yy);
  float core = exp(-d * d / 0.000007) * seen;
  float glow = exp(-d * 14.0) * 0.45 * seen;
  float disp2 = disp * 1.5 + yy * 0.3 * (h11(ci * 5.0) - 0.5) * 2.0;
  float d2 = abs(p.x - (x0 + disp2));
  float br = smoothstep(0.25, 0.4, yy) * step(yy, grow * 1.15) * step(yy, 0.9);
  float branch = exp(-d2 * d2 / 0.000004) * br * 0.7;
  float sky = exp(-ph * 6.0) * 0.28 * smoothstep(1.2, 0.0, length(p - vec2(x0, 0.35)));
  float amb = 0.05 + 0.04 * sin(t * 0.6);
  vec2 vq = p * 2.2 + vec2(0.0, t * 0.02);
  float vv = fbm(vq * 2.4 + ci);
  float vein = pow(1.0 - abs(2.0 * vv - 1.0), 8.0);
  float lit = smoothstep(1.3, 0.1, length(p - vec2(x0, 0.1)));
  float v = (core + glow + branch) * env + core * after * 0.35 + sky + vein * (0.1 + 0.55 * after) * lit + amb * smoothstep(1.0, 0.0, length(p));
  vec3 col = mix(pal(0.55), uInk, clamp(core * env, 0.0, 1.0));
  return vec4(col, clamp(v, 0.0, 1.0) * uIntensity);
}
`;
