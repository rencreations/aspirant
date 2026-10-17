/** Shared GLSL chunks for the scene shaders. */

export const NOISE = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.07 + vec2(11.3, 5.7); a *= 0.5; }
  return v;
}
`;

/** Four-pointed star signed distance (the Emblem, the rift). r: size, k: pinch (0.1 to 0.5). */
export const STAR4 = /* glsl */ `
float star4(vec2 p, float r, float k) {
  p = abs(p);
  float d = pow(pow(p.x, k) + pow(p.y, k), 1.0 / k);
  return d - r;
}
`;
