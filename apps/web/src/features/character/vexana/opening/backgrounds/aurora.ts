/** Curtains of light that sway, violet and pink over the page. */
export const AURORA = /* glsl */ `
vec3 background(vec2 uv, vec2 p, float tone) {
  float t = uTime * 0.12;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * 1.1 + fi * 0.75 - 0.75 + 1.6 * (fbm(vec2(p.y * 0.7 + t + fi * 3.1, fi * 5.0 + t * 0.5)) - 0.5);
    float band = exp(-x * x * (2.4 + fi * 0.9));
    float vert = 0.3 + 0.7 * smoothstep(-0.6, 0.4, -p.y * 0.8 + fbm(vec2(p.x * 0.8 + fi, t + fi)) - 0.2);
    vec3 col = fi < 0.5 ? vec3(0.48, 0.31, 0.84) : (fi < 1.5 ? vec3(0.88, 0.25, 0.63) : vec3(0.36, 0.62, 0.95));
    acc += col * band * vert;
  }
  vec3 lightBase = vec3(0.968, 0.954, 0.986);
  vec3 darkBase = vec3(0.07, 0.05, 0.14);
  vec3 lightOut = mix(lightBase, acc * 0.75 + 0.25, clamp(length(acc) * 0.55, 0.0, 0.85));
  vec3 darkOut = darkBase + acc * 0.85;
  return mix(lightOut, darkOut, tone);
}
`;
