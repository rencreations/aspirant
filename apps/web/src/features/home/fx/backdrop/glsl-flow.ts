/**
 * Backdrops that flow: fields of colour that drift and fold. Soft, so they are drawn at half
 * resolution. Each string is the body of one kind (see `glsl-prelude.ts` for the frame).
 */

export const AURORA = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec3 col = vec3(0.0);
  float acc = 0.0;
  float x = p.x;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float wob = fbm(vec2(x * 1.1 + fi * 7.3, t * 0.10 + fi * 3.1));
    float edge = -0.14 + 0.36 * wob - fi * 0.09 + 0.04 * sin(x * 2.3 + t * 0.28 + fi * 1.7);
    float h = p.y - edge;
    float f = h < 0.0 ? exp(h * 22.0) : exp(-h * 4.5);
    float rays = pow(0.25 + 1.2 * vn(vec2(x * 30.0 + fi * 11.0, t * 0.3 + fi)), 1.7);
    rays *= 0.5 + 0.8 * vn(vec2(x * 4.5 - t * 0.1, h * 3.0 + fi));
    float fold = 0.55 + 0.45 * sin(x * 7.0 + fi * 2.0 + t * 0.2 + 2.0 * wob);
    float w = f * rays * fold;
    col += pal(0.1 + fi * 0.3 + clamp(h, -0.2, 0.6) * 0.6) * w;
    acc += w;
  }
  return vec4(col / max(acc, 1e-4), 1.0 - exp(-acc * 0.95 * uIntensity));
}
`;

export const SOFT_AURORA = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 0.85;
  float n1 = fbm(q + vec2(t * 0.05, -t * 0.03));
  float n2 = fbm(q * 1.3 + vec2(-t * 0.04, t * 0.05) + n1 * 1.6);
  float n3 = fbm(q * 0.7 + n2 * 1.2 + t * 0.02);
  vec3 col = pal(n2 * 0.95 + n3 * 0.35 - 0.1);
  float pool = smoothstep(0.95, 0.0, length(p - vec2(-0.25 + 0.2 * sin(t * 0.07), 0.22)));
  float pool2 = smoothstep(0.8, 0.0, length(p - vec2(0.3 + 0.15 * cos(t * 0.06), -0.18)));
  col = mix(col, pal(0.85), pool2 * 0.4);
  float a = (smoothstep(0.22, 0.9, n1 * 0.7 + n2 * 0.5) * 0.75 + pool * 0.3 + pool2 * 0.2) * uIntensity;
  return vec4(col, a);
}
`;

export const PLASMA = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 6.0;
  q += 0.45 * vec2(sin(q.y * 1.3 + t * 0.4), cos(q.x * 1.1 - t * 0.3));
  float v = sin(q.x + t * 0.7);
  v += sin((q.y + t * 0.5) * 1.3);
  v += sin((q.x + q.y + t * 0.4) * 0.9);
  v += sin(length(q + vec2(sin(t * 0.3), cos(t * 0.37)) * 1.6) * 1.6 - t * 0.6);
  v *= 0.25;
  float k = 0.5 + 0.5 * v;
  vec3 col = pal(k);
  float iso = 0.5 + 0.5 * sin(v * 11.0 + t * 0.4);
  col = mix(col, pal(fract(k + 0.35)), 0.28 * iso);
  float a = (0.5 + 0.4 * v + 0.1 * iso) * uIntensity;
  return vec4(col, a);
}
`;

export const SILK = /* glsl */ `
// Cloth: bands that bend with a slow wave, a fine ripple riding on them, and a sheen on the crests.
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 1.15 + pt * 0.03 * uPointer.z;
  q.y += 0.045 * sin(7.0 * q.x - t * 0.5);
  float w = q.x + q.y + 0.6 * cos(3.0 * q.x + 5.0 * q.y) + 0.04 * t;
  float h = 0.6 + 0.4 * sin(5.0 * w + 0.7 * sin(38.0 * (q.x + q.y - 0.05 * t)));
  float h2 = 0.5 + 0.5 * sin(3.0 * w + 1.3 + 0.5 * sin(9.0 * q.x - t * 0.3));
  vec3 col = pal(0.08 + 0.5 * h + 0.35 * h2);
  float sheen = pow(h, 7.0);
  col = mix(col, pal(1.0), sheen * 0.3);
  return vec4(col * (0.72 + 0.4 * h), (0.62 + 0.33 * h) * uIntensity);
}
`;

export const IRIDESCENCE = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 1.3;
  float f = fbm(q * 1.4 + vec2(t * 0.04, -t * 0.03));
  float f2 = fbm(q * 2.2 + f * 2.0 - t * 0.05);
  float ph = f * 2.4 + f2 * 1.6 + p.x * 0.5 + t * 0.03 + length(p - pt) * 0.4 * uPointer.z;
  vec3 film = 0.5 + 0.5 * cos(TAU * (ph + vec3(0.0, 0.33, 0.67)));
  vec3 col = mix(film, pal(1.0 - abs(2.0 * fract(ph) - 1.0)), 0.9);
  float a = (0.5 + 0.35 * f) * uIntensity;
  return vec4(col, a);
}
`;

export const LIQUID_CHROME = /* glsl */ `
// The warp is worked out once per pixel and shared by the three samples of the slope.
float chromeH(vec2 q, vec2 warp, float t) {
  return fbm((q + warp) * 0.75 + t * 0.03) * 1.8;
}
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 2.0;
  float e = 0.02;
  vec2 warp = 0.55 * vec2(fbm(q * 0.9 + t * 0.06), fbm(q * 0.9 + 5.2 - t * 0.05));
  float h0 = chromeH(q, warp, t);
  float hx = chromeH(q + vec2(e, 0.0), warp, t);
  float hy = chromeH(q + vec2(0.0, e), warp, t);
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.3, -(hy - h0) / e * 0.3, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float k = r.y * 0.5 + 0.5 + 0.08 * r.x;
  vec3 col = mix(pal(1.0), pal(0.0), smoothstep(0.44, 0.56, k));
  col = mix(col, pal(0.5), 0.5 * smoothstep(0.35, 0.0, abs(k - 0.5)));
  col += pow(max(dot(r, normalize(vec3(0.4 + pt.x * 0.2, 0.7, 0.6))), 0.0), 36.0) * 0.8;
  return vec4(col, 0.8 * uIntensity);
}
`;

export const DARK_VEIL = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = p * 1.3;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q += 0.38 * vec2(fbm(q + vec2(t * 0.07, fi)), fbm(q.yx - vec2(t * 0.06, fi * 2.0))) - 0.19;
  }
  float v = fbm(q * 1.4);
  float ridge = pow(1.0 - abs(2.0 * v - 1.0), 7.0);
  float vign = smoothstep(1.1, 0.15, length(p * vec2(0.8, 1.0)));
  vec3 col = mix(pal(v), pal(1.0), ridge);
  float a = (0.16 + 0.5 * v * v + ridge * 0.85) * (0.45 + 0.55 * vign) * uIntensity;
  return vec4(col, a);
}
`;

export const ORB = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 c = pt * 0.2 * uPointer.z + vec2(0.0, 0.02 * sin(t * 0.6));
  vec2 q = p - c;
  float r = length(q);
  float ang = atan(q.y, q.x);
  float R = 0.27 + 0.012 * sin(ang * 5.0 + t * 0.9) + 0.008 * sin(ang * 9.0 - t * 1.3);
  float body = smoothstep(R + 0.004, R - 0.012, r);
  float halo = exp(-max(r - R, 0.0) * 7.0) * 0.5;
  float swirl = fbm(q * 5.0 + vec2(t * 0.12, -t * 0.09) + 3.0 * fbm(q * 3.0 - t * 0.05));
  vec3 inner = pal(0.1 + swirl * 0.9);
  float shade = 0.55 + 0.6 * smoothstep(-R, R, dot(q, vec2(-0.5, 0.7)));
  vec3 outer = pal(0.75 + 0.25 * sin(ang + t * 0.3));
  vec3 col = mix(outer, inner * shade, body);
  float ring = exp(-pow((r - R * 1.4 - 0.02 * sin(t)) / 0.004, 2.0)) * 0.55;
  float ring2 = exp(-pow((r - R * 1.75 + 0.03 * sin(t * 0.7)) / 0.003, 2.0)) * 0.3;
  float al = body + halo * (1.0 - body) + ring + ring2;
  return vec4(col + (ring + ring2) * 0.3, al * uIntensity);
}
`;

export const PRISM = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  vec2 q = rot(0.08 * sin(t * 0.2) + pt.x * 0.04) * p;
  float tri = max(-q.y, abs(q.x) * 0.866025 + q.y * 0.5) - 0.11;
  float edge = exp(-abs(tri) * 70.0) * 0.8;
  float inside = smoothstep(0.004, -0.004, tri);
  // the white beam in from the left, along a slightly tilted line
  float by = q.y + 0.045 - q.x * 0.1;
  float beam = exp(-by * by / 0.00006) * smoothstep(-0.05, -0.2, q.x - 0.05) * step(q.x, -0.02);
  // the fan out of the right face
  vec2 o = q - vec2(0.075, -0.02);
  float ang = atan(o.y, o.x);
  float u = ang / 0.95 + 0.5;
  float fan = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.96, u) * step(0.0, o.x);
  float rl = length(o);
  float streak = 0.72 + 0.28 * sin(ang * 90.0 + t * 0.8 + fbm(vec2(ang * 6.0, t * 0.1)) * 6.0);
  float rays = fan * exp(-rl * 1.3) * streak * smoothstep(0.02, 0.18, rl);
  vec3 col = pal(clamp(u, 0.0, 1.0)) * rays + uInk * (beam + edge * 0.7) + pal(0.5) * inside * 0.15;
  float a = clamp(rays * 0.95 + beam + edge + inside * 0.14, 0.0, 1.0) * uIntensity;
  vec3 rgb = col / max(rays + beam + edge * 0.7 + inside * 0.15, 1e-3);
  return vec4(rgb, a);
}
`;
