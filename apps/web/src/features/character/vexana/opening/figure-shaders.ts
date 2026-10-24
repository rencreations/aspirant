/**
 * The figure: one plane that shows two pictures, the normal form and the Ender form. A field `f`
 * (positive inside) says where the Ender form shows. It is the union of the blob under the
 * cursor and of the shape the idle director is playing. The edges of the field are torn
 * (staggered bands, ragged noise), glow, and bend the picture a little.
 */
export const FIGURE_VERT = /* glsl */ `
uniform sampler2D uDepth;
uniform float uDepthScale;
varying vec2 vUv;
void main() {
  vUv = uv;
  // The picture is a relief: the face stands out of the plane, the hair and the shoulders sit
  // behind it. The camera and the turn of the head do the rest, in real perspective.
  vec3 pos = position;
  pos.z += texture2D(uDepth, uv).r * uDepthScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const FIGURE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uDepth;
uniform vec2 uTilt;
uniform vec3 uCur;
uniform float uCurR;
uniform vec4 uIdle;
uniform float uTime;
uniform float uAspect;
uniform float uShine;
uniform float uFade;
varying vec2 vUv;

float h11(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 rot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// The blob under the cursor, cut into slanted bands that each reach a different distance.
float fCursor(vec2 p) {
  if (uCur.z < 0.01) return -1.0;
  vec2 c = vec2((uCur.x - 0.5) * uAspect, uCur.y - 0.5);
  vec2 d = p - c;
  vec2 q = rot(d, 0.5);
  float band = floor(q.y / 0.045);
  float j = h11(band * 9.1 + 2.0);
  float r = uCurR * uCur.z * (0.62 + 0.75 * j + 0.08 * sin(uTime * 1.3 + band));
  float n = (vn(d * 14.0 + uTime * 0.6) - 0.5) * 0.05;
  return r - length(d * vec2(0.95, 1.0)) + n;
}

float fIdle(vec2 p) {
  float e = uIdle.y;
  if (e < 0.002) return -1.0;
  float sd = uIdle.z;
  int s = int(uIdle.x + 0.5);
  if (s == 0) {
    // Slices: slanted bands slide in from one side, each late by its own amount.
    vec2 q = rot(p, 0.12 + (sd - 0.5) * 0.2);
    float b = floor(q.y / 0.07);
    float lag = h11(b + sd * 50.0) * 0.45;
    float dir = sd > 0.5 ? 1.0 : -1.0;
    float front = (e * 1.5 - lag) * 1.9 - 0.95;
    return front - q.x * dir;
  }
  if (s == 1) {
    // Tear: a ragged column opens down the middle.
    float w = pow(e, 0.85) * 0.3;
    float jag = 0.55 + 0.9 * vn(vec2(p.y * 7.0 + sd * 20.0, sd * 3.0));
    float cx = (sd - 0.5) * 0.4 + (vn(vec2(p.y * 3.0, sd)) - 0.5) * 0.12;
    return w * jag - abs(p.x - cx);
  }
  if (s == 2) {
    // Bloom: a ragged circle grows from a point.
    vec2 c = vec2((sd - 0.5) * 0.9, (h11(sd * 7.0) - 0.3) * 0.5);
    return e * 0.7 - length(p - c) + (vn(p * 9.0 + sd * 10.0) - 0.5) * 0.09;
  }
  if (s == 3) {
    // Crown: the top comes in, horns and hair, with a torn lower edge.
    float edge = 0.5 - e * 0.62 - 0.05 + (vn(vec2(p.x * 12.0, sd * 4.0)) - 0.5) * 0.12;
    float f1 = p.y - edge;
    float f2 = 0.44 - abs(p.x) + (vn(vec2(p.y * 9.0, sd)) - 0.5) * 0.08;
    return min(f1, f2);
  }
  // Shatter: shards in a slanted grid come in, each at its own time.
  vec2 q = rot(p, 0.65);
  float col = floor(q.x * 9.0);
  vec2 g = vec2(q.x * 9.0, (q.y + h11(col) * 0.4) * 5.0);
  vec2 id = floor(g);
  vec2 cell = fract(g);
  float thr = e * 0.9;
  float me = step(h21(id + sd * 13.0), thr);
  // Only the borders between a shard that is in and one that is not glow.
  float nx = cell.x < 0.5 ? -1.0 : 1.0;
  float ny = cell.y < 0.5 ? -1.0 : 1.0;
  float diffX = abs(step(h21(id + vec2(nx, 0.0) + sd * 13.0), thr) - me);
  float diffY = abs(step(h21(id + vec2(0.0, ny) + sd * 13.0), thr) - me);
  float dx = diffX > 0.5 ? min(cell.x, 1.0 - cell.x) * 0.1 : 0.06;
  float dy = diffY > 0.5 ? min(cell.y, 1.0 - cell.y) * 0.2 : 0.06;
  float ed = min(min(dx, dy), 0.06);
  return me > 0.5 ? ed : -ed;
}

void main() {
  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
  float f = max(fCursor(p), fIdle(p));
  float m = smoothstep(-0.004, 0.004, f);
  float edge = 1.0 - smoothstep(0.0, 0.016, abs(f));
  float wide = 1.0 - smoothstep(0.0, 0.07, abs(f));
  vec2 disp = vec2(vn(p * 22.0 + uTime) - 0.5, vn(p * 22.0 + 7.3 - uTime) - 0.5) * 0.02 * wide;
  vec2 uvA = vUv + disp;
  // Both pictures share one relief, so the Ender form stays exactly on top of the normal one.
  vec2 uvB = vUv + disp;
  vec4 a = texture2D(uA, uvA);
  vec4 b = texture2D(uB, uvB);
  vec4 c = mix(a, b, m);

  // A rim of light on the side that faces the cursor.
  vec2 off = normalize(uTilt + vec2(0.0001)) * 0.006;
  float aRim = mix(texture2D(uA, uvA + off).a, texture2D(uB, uvB + off).a, m);
  float rim = clamp(c.a - aRim, 0.0, 1.0);
  c.rgb += vec3(0.78, 0.7, 1.0) * rim * 0.55;

  // Relief light: the slope of the depth map takes the light that comes from the cursor's side,
  // so the nose, the cheek and the hair catch it as the head turns.
  vec2 te = vec2(1.0 / 192.0, 1.0 / 108.0);
  float dx = texture2D(uDepth, vUv + vec2(te.x, 0.0)).r - texture2D(uDepth, vUv - vec2(te.x, 0.0)).r;
  float dy = texture2D(uDepth, vUv + vec2(0.0, te.y)).r - texture2D(uDepth, vUv - vec2(0.0, te.y)).r;
  vec3 nrm = normalize(vec3(-dx * 5.0, -dy * 5.0, 1.0));
  vec3 lig = normalize(vec3(uTilt.x * 1.1, -uTilt.y * 1.1 + 0.45, 0.8));
  c.rgb *= 1.0 + 0.7 * (dot(nrm, lig) - lig.z);

  // The torn edge glows.
  float body = clamp(max(a.a, b.a), 0.0, 1.0);
  c.rgb += vec3(0.95, 0.45, 0.9) * edge * 1.1 * body;

  // Tone, a slow shine, and grain, so the picture is never flat.
  c.rgb *= 0.9 + 0.12 * vUv.y;
  float sh = 1.0 - smoothstep(0.0, 0.07, abs(vUv.x * 0.65 + vUv.y * 0.35 - uShine));
  c.rgb += sh * 0.1 * c.a;
  c.rgb += (h21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.03 * c.a;

  // Where the picture ends at the top its last pixels fade, so no flat cut shows.
  c *= 1.0 - smoothstep(0.994, 1.0, vUv.y);

  gl_FragColor = c * uFade;
}
`;

export const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
