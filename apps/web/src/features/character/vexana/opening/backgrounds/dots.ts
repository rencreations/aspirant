/** A halftone grid: dots swell where the field is high and near the cursor. */
export const DOTS = /* glsl */ `
vec3 background(vec2 uv, vec2 p, float tone) {
  float cell = 0.034;
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 cp = (id + 0.5) * cell;
  float t = uTime * 0.25;
  float n = vn(id * 0.07 + vec2(t, -t * 0.7));
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float prox = exp(-pow(length(cp - m) * 3.2, 2.0));
  float rad = 0.07 + 0.32 * n * n + 0.3 * prox;
  float d = length(f) - rad;
  float aa = fwidth(d) + 0.0001;
  float dotM = 1.0 - smoothstep(-aa, aa, d);
  vec3 baseL = vec3(0.968, 0.954, 0.986);
  vec3 baseD = vec3(0.07, 0.05, 0.14);
  vec3 dotL = mix(vec3(0.66, 0.58, 0.86), vec3(0.88, 0.25, 0.63), prox);
  vec3 dotD = mix(vec3(0.42, 0.32, 0.78), vec3(0.92, 0.42, 0.82), prox);
  return mix(mix(baseL, dotL, dotM * 0.62), mix(baseD, dotD, dotM * 0.85), tone);
}
`;
