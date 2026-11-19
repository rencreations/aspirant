/**
 * The ink field: the dark ground of the strip, in the spirit of the mist behind psychoactive.co.nz
 * (a near black blue ground, slow luminous clouds that flow, a film grain, a vignette), written from
 * scratch in the Aspirants' own colours (deep blue ground, blue and ice cyan light, no pink).
 *
 * Round three (20 Nov 2026, the owner): "just normal dynamic background with interactable cursor, no
 * glow or ripple animation", and "make it not react with scroll". So the field has:
 *
 *  - no light on the cursor, no ripples, no glow around the film, no bright spot of any kind;
 *  - no reaction to the scroll: it never reads `uVel` or `uS`, and its time runs at its own speed;
 *  - a calm reaction to the cursor only: the whole flow leans a little toward the pointer (a wide,
 *    soft pull that never makes a feature of its own), and the two layers of cloud slide against the
 *    pointer by different amounts (a gentle parallax).
 *
 * The coverage is low where the field is dark, so the storm ground does the darkening and only the
 * luminous parts cover it: a handover from a light ground never shows a grey wash.
 */
export const INK_FIELD = /* glsl */ `
vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float on = uPointer.z;
  vec2 lean = pt * on;

  // The cursor leans the flow toward it, very wide and very soft (no feature appears at the pointer).
  vec2 q = p * 1.05;
  vec2 toward = lean * 1.05 - q;
  q += toward * 0.07 * exp(-dot(toward, toward) * 0.9) * on;

  // Two layers slide against the pointer, the near one more (a parallax of a few percent of the screen).
  vec2 qa = q - lean * 0.05;
  vec2 qb = q - lean * 0.11;

  // The flow: a domain warped field of cloud, two slow layers going the other way to each other.
  float f = t;
  vec2 w = vec2(
    fbm(qa + vec2(f * 0.040, -f * 0.026)),
    fbm(qa + vec2(5.2 - f * 0.031, 1.3 + f * 0.036))
  );
  float n = fbm(qa * 1.15 + (w - 0.5) * 1.9 + vec2(0.0, f * 0.02));
  float n2 = fbm(qb * 2.4 - (w - 0.5) * 1.3 + vec2(9.1 - f * 0.03, 3.7));

  float body = smoothstep(0.36, 0.88, n);
  vec3 cBody = pal(0.02 + 0.5 * body + 0.1 * n2);
  float aBody = 0.08 + 0.26 * body;

  // The thin edge light of the cloud, where its density crosses a level (the ink's own line).
  float ridge = clamp(1.0 - abs(n - 0.58) * 7.0, 0.0, 1.0);
  ridge *= ridge * (0.4 + 0.8 * n2);
  vec3 cRidge = mix(pal(0.82), uInk, 0.25);

  vec3 pc = cBody * aBody;
  float a = aBody;
  over(pc, a, cRidge, ridge * 0.3);

  // The vignette (the edges fall away into the ground) and a fine grain that never rests.
  vec3 col = pc / max(a, 1e-4);
  float edge = length((uv - 0.5) * vec2(1.0, 0.92)) * 1.55;
  a *= 1.0 - 0.5 * smoothstep(0.5, 1.15, edge);
  a *= 0.965 + 0.07 * h21(gl_FragCoord.xy + floor(t * 24.0) * 7.3);
  return vec4(col, a * uIntensity);
}
`;
