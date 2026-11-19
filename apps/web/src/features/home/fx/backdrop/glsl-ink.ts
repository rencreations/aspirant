/**
 * The ink field: the dark ground of the strip, in the spirit of the mist behind psychoactive.co.nz
 * (a near black blue ground, slow luminous clouds that flow, a soft light that follows the cursor, a
 * film grain, a vignette), written from scratch in the Aspirants' own colours (deep blue ground,
 * cyan light, a hot pink where the cursor touches it). It answers three inputs:
 *
 *  - the cursor: a pull and a slow twist of the flow around the pointer and a soft pink light on it;
 *  - the trail: a ring of ripples that the pointer leaves behind (a press leaves a stronger one),
 *    each one a ring that widens, pushes the flow outward as it passes and fades (`uTrail`, see
 *    `trail.ts`: x and y in 0..1 from the left and the bottom, age in seconds, strength);
 *  - the film: a glow around the rectangle the trailer stands in (`uX`: glow 0..1, the rectangle's
 *    half width and half height in the units of the screen's height), so the light of the picture
 *    bleeds into the ground as the frame opens.
 *
 * The coverage is low where the field is dark, so the storm ground does the darkening and only the
 * luminous parts cover it: a handover from a light ground never shows a grey wash.
 */
export const INK_FIELD = /* glsl */ `
uniform vec4 uTrail[10];
uniform vec4 uX;

vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float on = uPointer.z;
  vec2 u0 = (uv - 0.5) * vec2(uAsp, 1.0);

  // The cursor pulls the flow toward it and turns it, slowly.
  vec2 q = p * 1.05;
  vec2 dp = q - pt * 1.05;
  float pull = exp(-dot(dp, dp) * 8.0) * on;
  q = pt * 1.05 + rot(pull * 0.8) * dp * (1.0 - 0.14 * pull);

  // Every ripple of the trail: a ring that widens and fades, and a push on the flow as it passes.
  float rings = 0.0;
  float cores = 0.0;
  vec2 push = vec2(0.0);
  for (int i = 0; i < 10; i++) {
    vec4 tr = uTrail[i];
    if (tr.w > 0.0) {
      vec2 d = u0 - (tr.xy - 0.5) * vec2(uAsp, 1.0);
      float r = length(d);
      float rad = 0.05 + tr.z * 0.34;
      float fade = exp(-tr.z * 1.25) * tr.w;
      float k = (r - rad) * 27.0;
      float ring = exp(-k * k) * fade;
      rings += ring;
      cores += exp(-r * r * 60.0) * exp(-tr.z * 2.6) * tr.w;
      push += d / (r + 0.03) * ring * 0.022;
    }
  }
  q += push;

  // The flow: a domain warped field of cloud, two slow layers going the other way to each other.
  float f = t * (1.0 + uVel * 0.25);
  vec2 w = vec2(
    fbm(q + vec2(f * 0.040, -f * 0.026)),
    fbm(q + vec2(5.2 - f * 0.031, 1.3 + f * 0.036))
  );
  float n = fbm(q * 1.15 + (w - 0.5) * 1.9 + vec2(0.0, f * 0.02));
  float n2 = fbm(q * 2.4 - (w - 0.5) * 1.3 + vec2(9.1 - f * 0.03, 3.7));

  float body = smoothstep(0.36, 0.88, n);
  vec3 cBody = pal(0.02 + 0.4 * body + 0.1 * n2);
  float aBody = 0.08 + 0.3 * body;

  // The thin edge light of the cloud, where its density crosses a level (the ink's own line).
  float ridge = clamp(1.0 - abs(n - 0.58) * 7.0, 0.0, 1.0);
  ridge *= ridge * (0.45 + 0.9 * n2);
  vec3 cRidge = mix(pal(0.62), uInk, 0.3);

  // The light under the cursor, a soft pink with a cyan skirt.
  float halo = exp(-dot(dp, dp) * 34.0) * on;
  float skirt = exp(-dot(dp, dp) * 6.5) * on;

  // The glow of the film: strongest at the frame's edge and gone a little way out of it.
  vec2 box = uX.yz;
  float away = length(max(abs(u0) - box, 0.0));
  float bleed = uX.x * (exp(-away * 7.0) * 0.8 + 0.2 * exp(-away * 2.2));

  vec3 pc = cBody * aBody;
  float a = aBody;
  over(pc, a, cRidge, ridge * 0.55);
  over(pc, a, pal(0.66), skirt * 0.12);
  over(pc, a, pal(1.0), halo * 0.3);
  over(pc, a, mix(pal(0.7), pal(1.0), 0.45), clamp(rings, 0.0, 1.0) * 0.55);
  over(pc, a, uInk, clamp(cores, 0.0, 1.0) * 0.28);
  over(pc, a, mix(pal(0.64), pal(0.9), 0.3), clamp(bleed, 0.0, 1.0) * 0.5);

  // The vignette (the edges fall away into the ground) and a fine grain that never rests.
  vec3 col = pc / max(a, 1e-4);
  float edge = length((uv - 0.5) * vec2(1.0, 0.92)) * 1.55;
  a *= 1.0 - 0.5 * smoothstep(0.5, 1.15, edge);
  a *= 0.965 + 0.07 * h21(gl_FragCoord.xy + floor(t * 24.0) * 7.3);
  return vec4(col, a * uIntensity);
}
`;
