/**
 * The ink field: the strip's own backdrop, in the spirit of the mist behind psychoactive.co.nz, written
 * from scratch in the Aspirants' own colours. It was a dark luminous mist; the home page is light only
 * (round five, 20 Nov 2026, the owner), so it is now a very soft, slowly flowing pastel mist on the
 * off white paper: pale blue with a hint of lilac, low in contrast, with broad soft forms and no
 * fine texture, so the gradient reads smooth.
 *
 * Round three (20 Nov 2026, the owner): "just normal dynamic background with interactable cursor, no
 * glow or ripple animation", and "make it not react with scroll". So the field has:
 *
 *  - no light on the cursor, no ripples, no glow around the film, no bright spot of any kind;
 *  - no reaction to the scroll: it never reads `uVel` or `uS`, and its time runs at its own speed;
 *  - a calm reaction to the cursor only: the whole flow leans a little toward the pointer (a wide,
 *    soft pull that never makes a feature of its own), and the two layers of mist slide against the
 *    pointer by different amounts (a gentle parallax).
 *
 * The coverage is low everywhere (a pale tint over the paper, a little more where the mist is dense,
 * and thinner toward the edges), and the colour barely differs from the paper, so a handover from the
 * plain ground shows nothing. It does not read `uInk`: there is no edge light, nothing bright.
 */
export const INK_FIELD = /* glsl */ `
// Smooth value noise with two octaves only: broad soft forms, no fine texture.
float sn(vec2 p) {
  return 0.7 * vn(p) + 0.3 * vn(rot(0.9) * p * 2.1 + 3.7);
}

vec4 bg(vec2 uv, vec2 p, vec2 pt, float t) {
  float on = uPointer.z;
  vec2 lean = pt * on;

  // The cursor leans the flow toward it, very wide and very soft (no feature appears at the pointer).
  vec2 q = p * 0.85;
  vec2 toward = lean * 0.85 - q;
  q += toward * 0.06 * exp(-dot(toward, toward) * 0.9) * on;

  // Two layers slide against the pointer, the near one more (a parallax of a few percent of the screen).
  vec2 qa = q - lean * 0.05;
  vec2 qb = q - lean * 0.11;

  // The flow: a domain warped field of mist, two slow layers going the other way to each other.
  float f = t * 0.7;
  vec2 w = vec2(
    sn(qa + vec2(f * 0.040, -f * 0.026)),
    sn(qa + vec2(5.2 - f * 0.031, 1.3 + f * 0.036))
  );
  float n = sn(qa * 1.1 + (w - 0.5) * 1.7 + vec2(0.0, f * 0.02));
  float n2 = sn(qb * 1.7 - (w - 0.5) * 1.2 + vec2(9.1 - f * 0.03, 3.7));

  // The colour: pale blue, and where the second layer rises a hint of lilac (the palette's stops).
  vec3 col = pal(0.04 + 0.62 * smoothstep(0.22, 0.78, n2));

  // The coverage: a thin tint everywhere and a little more where the mist is dense.
  float body = smoothstep(0.3, 0.82, n);
  float a = 0.05 + 0.42 * body;

  // The edges fall away into the paper.
  float edge = length((uv - 0.5) * vec2(1.0, 0.92)) * 1.55;
  a *= 1.0 - 0.45 * smoothstep(0.55, 1.15, edge);
  return vec4(col, a * uIntensity);
}
`;
