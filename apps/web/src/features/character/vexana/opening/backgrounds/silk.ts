/** Folds of satin that drift. */
export const SILK = /* glsl */ `
vec3 background(vec2 uv, vec2 p, float tone) {
  float t = uTime * 0.22;
  vec2 q = p * 2.0;
  q += 0.45 * vec2(sin(q.y * 1.7 + t * 1.1), cos(q.x * 1.3 - t * 0.9));
  q += 0.25 * vec2(sin(q.y * 3.1 - t), cos(q.x * 2.7 + t * 0.7));
  float s = 0.5 + 0.5 * sin(q.x * 3.4 + q.y * 1.2 + sin(q.y * 2.3 + t) * 1.4);
  float sheen = pow(s, 4.0);
  vec3 lightCol = mix(vec3(0.945, 0.925, 0.985), vec3(0.80, 0.72, 0.97), s) + vec3(1.0, 0.86, 1.0) * sheen * 0.1;
  vec3 darkCol = mix(vec3(0.066, 0.046, 0.14), vec3(0.34, 0.22, 0.68), s * 0.8) + vec3(0.93, 0.62, 0.95) * sheen * 0.3;
  return mix(lightCol, darkCol, tone);
}
`;
