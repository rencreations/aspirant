/**
 * The shader of a picture card of the bend section. Colour is raw sRGB end to end, as in the picture
 * field: the textures are not decoded, nothing is encoded, and the canvas is transparent over the
 * ground. The card is a rounded rectangle by distance. Out of focus is drawn in the shader (garuda's
 * depth of field without its second texture): the picture is read with a ring of taps at a mip level
 * that grows with the blur, and the edge of the card softens by the same amount, so a near poster
 * spills a little past its border like a lens out of focus does.
 *
 * A card of the "drone" kind holds a sheet of paper (the plain colour with the site's dot grid) and
 * the flat picture of the drone on it. `uPop` takes the flat drone away (the real one is drawn over
 * it by then) and leaves its silhouette as a darker hole in the paper.
 *
 * Frames: the card's local plane is in frame pixels, y up. Pictures are uploaded unflipped, so the
 * picture's v runs from the top.
 */

export const CARD_VERTEX = /* glsl */ `
uniform vec2 uHalf;
uniform float uPad;
uniform float uFlutter;
uniform float uPhase;
varying vec2 vLp;

void main() {
  vec2 lp = position.xy * 2.0 * (uHalf + vec2(uPad));
  vec3 p = vec3(lp, 0.0);
  p.z += uFlutter * sin(lp.y * 1.5707963 / max(uHalf.y, 1.0) + uPhase);
  vLp = lp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const CARD_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform sampler2D tSprite;
uniform vec2 uHalf;
uniform vec2 uTex;
uniform vec3 uColor;
uniform float uReveal;
uniform float uCorner;
uniform float uOpacity;
uniform float uShade;
uniform float uBlur;
uniform float uHover;
uniform float uShadow;
uniform float uPaper;
uniform vec4 uSprite;
uniform float uPop;
varying vec2 vLp;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Interleaved gradient noise: the taps turn per pixel, so the steps of a blur read as grain.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

vec3 picture(vec2 uv, float radiusUv, float lod, float spin) {
  vec2 c = clamp(uv, vec2(0.001), vec2(0.999));
  vec3 sum = texture2D(tMap, c).rgb;
  float w = 1.0;
  if (radiusUv > 0.0005) {
    for (int i = 0; i < 8; i++) {
      float a = spin + float(i) * 0.7853982;
      float r = radiusUv * (0.45 + 0.55 * mod(float(i) * 0.618, 1.0));
      vec2 o = vec2(cos(a), sin(a)) * r;
      sum += textureLod(tMap, clamp(uv + o, vec2(0.001), vec2(0.999)), lod).rgb;
      w += 1.0;
    }
  }
  return sum / w;
}

void main() {
  vec2 dx = dFdx(vLp);
  vec2 dy = dFdy(vLp);
  float pxl = max(0.5 * (length(dx) + length(dy)), 1e-4);
  float size = 2.0 * min(uHalf.x, uHalf.y);
  float blurPx = uBlur * 0.055 * size;
  float soft = max(pxl, blurPx);

  float sd = sdBox(vLp, uHalf, uCorner);
  float cover = clamp(0.5 - sd / (2.0 * soft), 0.0, 1.0);
  // A card out of focus is thinner at its edge: its middle stays, its rim thins out.
  cover *= 1.0 - 0.18 * uBlur * smoothstep(-2.5 * soft, 0.0, sd);

  vec2 uv = vec2(0.5 + vLp.x / (2.0 * uHalf.x), 0.5 - vLp.y / (2.0 * uHalf.y));
  vec3 col;
  if (uPaper > 0.5) {
    // Paper: the plain colour, a faint dot grid, a thin inner rule.
    vec2 g = vLp / 14.0;
    float grid = smoothstep(0.2, 0.05, length(fract(g) - 0.5));
    col = uColor * (1.0 - 0.045 * grid);
    float rule = smoothstep(2.0, 0.0, abs(sdBox(vLp, uHalf - 9.0, uCorner * 0.6)) - 0.6);
    col = mix(col, uColor * 0.82, 0.55 * rule);
    // The silhouette of the drone stays on the paper as a hole once it has come out.
    vec2 hole = (uv - uSprite.xy) / (2.0 * uSprite.zw) + 0.5;
    if (hole.x > 0.0 && hole.x < 1.0 && hole.y > 0.0 && hole.y < 1.0) {
      float a = texture2D(tSprite, hole).a;
      col *= 1.0 - 0.2 * a * uPop;
      // The flat drone, lifting off the paper as it goes.
      vec2 lifted = hole + vec2(0.0, 0.1 * uPop);
      vec4 sp = texture2D(tSprite, clamp(lifted, 0.001, 0.999));
      float vis = 1.0 - uPop;
      col = col * (1.0 - sp.a * vis) + sp.rgb * vis;
    }
  } else {
    float radiusUv = blurPx / (2.0 * min(uHalf.x, uHalf.y));
    float texelsAcross = radiusUv * max(uTex.x, uTex.y);
    float lod = max(0.0, log2(max(texelsAcross, 1.0)) - 0.5);
    col = picture(uv, radiusUv, lod, ign(gl_FragCoord.xy) * 6.2831853);
    col = mix(uColor, col, uReveal);
  }

  // A hair of rim shade on a sharp card, then the card's own shade and the hover.
  float inside = clamp(-sd / pxl, 0.0, 4.0);
  float rim = 1.0 - 0.1 * (1.0 - smoothstep(0.0, 1.5, inside)) * (1.0 - uBlur);
  col *= uShade * rim * (1.0 + 0.06 * uHover);

  // The shadow: the card's own shape, moved down and blurred, under the card.
  float sa = 0.0;
  if (uShadow > 0.0 && cover < 0.999) {
    float ssd = sdBox(vLp - vec2(0.0, -0.025 * size), uHalf, uCorner);
    float blur = 0.07 * size + blurPx;
    float s = 1.0 - smoothstep(-0.5 * blur, blur, ssd);
    sa = uShadow * s * s * (1.0 - 0.6 * uBlur);
  }
  vec4 outc = vec4(col * cover, cover) + vec4(vec3(0.04, 0.06, 0.12) * sa, sa) * (1.0 - cover);
  if (outc.a < 0.002) discard;
  gl_FragColor = outc * uOpacity;
}
`;
