/**
 * The shaders of the picture field. Colour is raw sRGB end to end: the textures are not decoded,
 * nothing is encoded, the card target holds the picture's own bytes (premultiplied by coverage),
 * and the composite writes them back unchanged, because the canvas is transparent over the DOM
 * ground. Dimming and smearing happen on those bytes, as premotio's own pass does.
 *
 * Frames. A card's local plane is in frame pixels, y up. Pictures are uploaded unflipped, so the
 * picture's v runs from the top. Screen vectors (the streak) are in device pixels with y up,
 * like `gl_FragCoord`.
 */

const SPECTRUM = /* glsl */ `
// Red at 0, green at 0.5, blue at 1, mixed 85 percent with white: the weight of one tap.
vec3 spectrum(float t) {
  vec3 c = clamp(abs(mod(t * 4.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return mix(vec3(1.0), c, 0.85);
}
// Interleaved gradient noise: the start of the taps moves per pixel, so steps read as grain.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
`;

/** The card's quad is the card plus `uPad` all round (the shadow and the streak live there). */
export const CARD_VERTEX = /* glsl */ `
uniform vec2 uHalf;
uniform float uPad;
uniform float uBend;
uniform float uFlutter;
uniform float uPhase;
varying vec2 vLp;
varying vec3 vView;

void main() {
  vec2 lp = position.xy * 2.0 * (uHalf + vec2(uPad));
  vec3 p = vec3(lp, 0.0);
  if (abs(uBend) > 0.001) {
    float r = 2.0 * uHalf.x / uBend;
    float a = lp.x / r;
    p.x = r * sin(a);
    p.z = r * (1.0 - cos(a));
  }
  p.z += uFlutter * sin(lp.y * 1.5707963 / max(uHalf.y, 1.0) + uPhase);
  vLp = lp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * One card: two pictures (the portrait and the wide one) cross-faded by `uMix`, each cover-fitted
 * to the card's own shape and centred on its subject, a rounded rectangle by distance (a pixel of
 * soft edge, and the colour is premultiplied by the same coverage, so no fringe), a hair of edge
 * shade, one light, a soft shadow, and a streak of weighted taps along the card's own screen
 * motion (premotio's red to blue spectrum) that smears the edge as well as the picture.
 */
export const CARD_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tA;
uniform sampler2D tB;
uniform vec2 uAsp;
uniform vec4 uFocus;
uniform float uMix;
uniform vec2 uHalf;
uniform float uCorner;
uniform float uOpacity;
uniform vec2 uStreak;
uniform vec4 uShadow;
uniform float uHover;
uniform float uLight;
varying vec2 vLp;
varying vec3 vView;
${SPECTRUM}
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// The share of the picture a card shows when it covers its shape.
vec2 coverShare(float ca, float pa) {
  return ca > pa ? vec2(1.0, pa / ca) : vec2(ca / pa, 1.0);
}

void main() {
  vec2 dx = dFdx(vLp);
  vec2 dy = dFdy(vLp);
  float pxl = max(0.5 * (length(dx) + length(dy)), 1e-4);
  float ca = uHalf.x / uHalf.y;
  vec2 sA = coverShare(ca, uAsp.x);
  vec2 sB = coverShare(ca, uAsp.y);
  vec2 mA = clamp(uFocus.xy, 0.5 * sA, 1.0 - 0.5 * sA);
  vec2 mB = clamp(uFocus.zw, 0.5 * sB, 1.0 - 0.5 * sB);
  // Picture gradients are analytic: the taps move per pixel, so the hardware's would be noise.
  vec2 gA = vec2(sA.x, -sA.y) / (2.0 * uHalf);
  vec2 gB = vec2(sB.x, -sB.y) / (2.0 * uHalf);
  float face = gl_FrontFacing ? 1.0 : -1.0;

  float slen = length(uStreak);
  int taps = slen < 0.75 ? 1 : int(clamp(ceil(slen / 3.0), 4.0, 14.0));
  vec2 stretch = dx * uStreak.x + dy * uStreak.y;
  float grain = ign(gl_FragCoord.xy);
  vec4 sum = vec4(0.0);
  vec4 wsum = vec4(0.0);
  for (int i = 0; i < 14; i++) {
    if (i >= taps) break;
    float t = taps == 1 ? 0.5 : (float(i) + grain) / float(taps);
    vec2 q = vLp + stretch * (t - 0.5);
    float a = clamp(0.5 - sdBox(q, uHalf, uCorner) / pxl, 0.0, 1.0);
    vec3 k = taps == 1 ? vec3(1.0) : spectrum(t);
    float ka = (k.r + k.g + k.b) / 3.0;
    vec3 col = vec3(0.0);
    if (a > 0.0) {
      vec2 c = q / (2.0 * uHalf);
      c.x *= face;
      if (uMix < 0.999) {
        vec2 uvA = vec2(mA.x + c.x * sA.x, mA.y - c.y * sA.y);
        col += (1.0 - uMix) * textureGrad(tA, uvA, dx * gA, dy * gA).rgb;
      }
      if (uMix > 0.001) {
        vec2 uvB = vec2(mB.x + c.x * sB.x, mB.y - c.y * sB.y);
        col += uMix * textureGrad(tB, uvB, dx * gB, dy * gB).rgb;
      }
    }
    sum += vec4(col * a * k, a * ka);
    wsum += vec4(k, ka);
  }
  vec4 acc = sum / wsum;

  // One light from the upper left front. A card that faces the viewer is not changed.
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  float facing = abs(dot(n, normalize(vec3(-0.35, 0.5, 0.8))));
  float dimmed = 1.0 - uLight * (1.0 - smoothstep(-0.1, 0.8, facing));
  float inside = clamp(-sdBox(vLp, uHalf, uCorner) / pxl, 0.0, 4.0);
  float rim = 1.0 - 0.1 * (1.0 - smoothstep(0.0, 1.5, inside));
  acc.rgb *= dimmed * rim * (1.0 + 0.05 * uHover);

  // The shadow: the card's own shape, moved and blurred (local units), under the card.
  float sa = 0.0;
  if (uShadow.x > 0.0 && acc.a < 0.999) {
    float ssd = sdBox(vLp - uShadow.yz, uHalf, uCorner);
    float blur = max(uShadow.w, 1e-3);
    float s = 1.0 - smoothstep(-0.5 * blur, blur, ssd);
    sa = uShadow.x * s * s;
  }
  vec4 outc = acc + vec4(vec3(0.04, 0.06, 0.12) * sa, sa) * (1.0 - acc.a);
  if (outc.a < 0.002) discard;
  gl_FragColor = outc * uOpacity;
}
`;

export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The wake: a small half-float velocity field the cursor stirs (premotio's, digest 1.6). It is
 * moved along itself (semi-Lagrangian), spread by the gradient of its divergence (that is the
 * wave that rolls up behind the cursor), and decays in 0.35 s. Velocities are pixels a second,
 * positions are CSS pixels from the bottom left.
 */
export const WAKE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tFlow;
uniform vec2 uTexel;
uniform vec2 uFrame;
uniform float uDt;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform vec2 uForce;
uniform float uRadius;
uniform float uStir;
varying vec2 vUv;

vec2 flow(vec2 uv) { return texture2D(tFlow, uv).xy; }

void main() {
  vec2 uv = vUv;
  vec2 back = uv - flow(uv) * uDt / uFrame;
  vec2 c = flow(back);
  vec2 e = flow(back + vec2(uTexel.x, 0.0));
  vec2 w = flow(back - vec2(uTexel.x, 0.0));
  vec2 n = flow(back + vec2(0.0, uTexel.y));
  vec2 s = flow(back - vec2(0.0, uTexel.y));
  vec2 ne = flow(back + uTexel);
  vec2 nw = flow(back + vec2(-uTexel.x, uTexel.y));
  vec2 se = flow(back + vec2(uTexel.x, -uTexel.y));
  vec2 sw = flow(back - uTexel);
  vec2 gath = vec2(
    e.x - 2.0 * c.x + w.x + 0.25 * (ne.y - nw.y - se.y + sw.y),
    n.y - 2.0 * c.y + s.y + 0.25 * (ne.x - nw.x - se.x + sw.x)
  );
  c = (c + 0.2 * gath) * exp(-uDt / 0.35);
  if (uStir > 0.5) {
    vec2 p = uv * uFrame;
    vec2 stroke = uTo - uFrom;
    float along = clamp(dot(p - uFrom, stroke) / max(dot(stroke, stroke), 1e-3), 0.0, 1.0);
    float d = length(p - uFrom - stroke * along);
    c += (uForce - c) * (1.0 - exp(-uDt * 22.0)) * exp(-(d * d) / (uRadius * uRadius));
  }
  float curl = (e.y - w.y) - (n.x - s.x);
  gl_FragColor = vec4(c, curl, 1.0);
}
`;

/**
 * The composite: the card render is drawn to the canvas through premotio's post pass. The wake
 * moves where the picture is read (the wave under the cursor), the weighted multi-tap smear
 * (red to blue) runs along the wake's flow and, at the edge of the frame, outward from the
 * centre, and the pointer's flow parts the three colours a little. Output is premultiplied.
 */
export const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tCards;
uniform sampler2D tWake;
uniform vec2 uSize;
uniform vec2 uFrame;
uniform float uPixel;
uniform float uEdges;
uniform float uWake;
uniform vec2 uNose;
varying vec2 vUv;
${SPECTRUM}

vec4 tap(vec2 uv) {
  return texture2D(tCards, clamp(uv, vec2(0.0), vec2(1.0)));
}

void main() {
  vec2 p = vUv * uSize;
  vec2 c = p - 0.5 * uSize;
  float dist = max(length(c), 1.0);
  vec2 dir = c / dist;
  float shorter = min(uSize.x, uSize.y);

  vec4 wk = uWake > 0.5 ? texture2D(tWake, vUv) : vec4(0.0);
  vec2 flowV = wk.xy;
  float speed = length(flowV);
  vec2 seenAt = p - flowV * 0.011 * uPixel;

  vec2 e = abs(2.0 * vUv - 1.0);
  float far = uEdges * smoothstep(0.0, 1.0, (max(e.x, e.y) - 0.84) / 0.16);
  float reach = shorter * far * 0.032;
  vec2 stretch = dir * reach;
  if (speed > 1.0) {
    float drawn = min(speed * 0.03, shorter / uPixel * 0.035) * uPixel;
    stretch += (flowV / speed) * drawn;
  }
  float total = length(stretch);
  int taps = total < 0.75 * uPixel ? 1 : int(clamp(ceil(total / (3.0 * uPixel)), 4.0, 16.0));
  float grain = ign(gl_FragCoord.xy);

  vec4 sum = vec4(0.0);
  vec4 wsum = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    float t = taps == 1 ? 0.5 : (float(i) + grain) / float(taps);
    vec4 col = tap((seenAt + stretch * (t - 0.5)) / uSize);
    vec3 k = taps == 1 ? vec3(1.0) : spectrum(t);
    float ka = (k.r + k.g + k.b) / 3.0;
    sum += vec4(col.rgb * k, col.a * ka);
    wsum += vec4(k, ka);
  }
  vec4 outc = sum / wsum;
  float cover = outc.a;
  vec3 rgb = min(outc.rgb, vec3(1.0));

  if (uWake > 0.5) {
    // Where the flow rises or falls the three colours part a little, near the pointer only.
    vec2 fdir = speed > 1.0 ? flowV / speed : vec2(0.0);
    vec2 off = fdir * 20.0 / uFrame;
    vec3 parted = vec3(length(texture2D(tWake, vUv + off).xy), speed, length(texture2D(tWake, vUv - off).xy));
    parted = clamp((parted - (parted.x + parted.y + parted.z) / 3.0) / 900.0, -1.0, 1.0);
    vec2 q = (p - uNose) / (0.08 * shorter);
    rgb += 0.2 * exp(-dot(q, q)) * parted * cover;
    rgb *= 1.0 + 0.035 * clamp(wk.z / 500.0, -1.0, 1.0);
  }
  rgb += (ign(gl_FragCoord.xy + 7.0) - 0.5) / 255.0 * cover;
  gl_FragColor = vec4(rgb, cover);
}
`;
