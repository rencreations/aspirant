/** Contour lines and flat tints, after the page the hero is drawn from, in lavender. */
export const TOPO = /* glsl */ `
vec3 background(vec2 uv, vec2 p, float tone) {
  float t = uTime * 0.035;
  vec2 q = p * 0.9;
  float aspect = uRes.x / uRes.y;
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  float md = length(p - m);
  q += (p - m) * 0.09 * exp(-md * md * 5.0);
  float n = fbm(q * 1.15 + vec2(t, -t * 0.6) + 2.2 * fbm(q * 0.55 + t * 0.8));
  float lv = n * 8.0;
  float fl = fract(lv);
  float id = floor(lv);
  float w = fwidth(lv);
  float line = 1.0 - smoothstep(0.0, 1.5 * w + 0.0001, min(fl, 1.0 - fl));
  float fill = mod(id, 2.0);
  vec3 a = mix(vec3(0.973, 0.961, 0.988), vec3(0.075, 0.052, 0.146), tone);
  vec3 b = mix(vec3(0.930, 0.914, 0.961), vec3(0.108, 0.078, 0.205), tone);
  vec3 base = mix(a, b, fill * 0.9);
  vec3 lineC = mix(vec3(0.63, 0.56, 0.82), vec3(0.46, 0.35, 0.80), tone);
  return mix(base, lineC, line * mix(0.42, 0.55, tone));
}
`;
