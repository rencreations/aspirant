/**
 * The film plane's shader: one program for the trailer and the ten previews. Colour is raw sRGB end
 * to end, as in the picture field: the video texture is not decoded, the shader writes bytes, and
 * the canvas is transparent over the DOM ground, so the output is premultiplied by coverage.
 *
 * Frames. A plane's local frame is in stage pixels, y up. The picture's v runs from the top (the
 * video texture is uploaded unflipped). `c` is the point on the plane in fractions of its size
 * (-0.5 to 0.5, y up); `uWin` is the window of the picture the plane shows: centre x, centre y,
 * width, height as fractions of the picture, so the picture is placed by the plane's own size and
 * never refitted when a frame opens.
 *
 * The look has two layers, each an amount the actor sets. The film itself is always the clean picture:
 * there is no overlay over it and no light that follows the pointer (round five, the owner).
 *  - the hover (`uHover` and the two weights of `uFx`): a lens that magnifies under the pointer
 *    with a ripple, and a colour split on the pointer's side. (The tilt and the shift of the
 *    picture are written by the actor, in the plane's pose and in `uWin`.)
 *  - the edge: a hairline of light inside the rim.
 */

export const FILM_VERTEX = /* glsl */ `
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

export const FILM_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tVideo;
uniform vec4 uWin;
uniform vec2 uHalf;
uniform float uCorner;
uniform float uOpacity;
uniform vec3 uColor;
uniform float uReady;
uniform float uTime;
uniform float uHover;
uniform vec2 uPointer;
uniform vec2 uFx;
uniform float uLight;
uniform float uShadow;
uniform vec2 uLoad;
varying vec2 vLp;
varying vec3 vView;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 pic(vec2 c) {
  vec2 uv = vec2(uWin.x + c.x * uWin.z, uWin.y - c.y * uWin.w);
  return texture2D(tVideo, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
}

void main() {
  vec2 dx = dFdx(vLp);
  vec2 dy = dFdy(vLp);
  float pxl = max(0.5 * (length(dx) + length(dy)), 1e-4);
  float sd = sdBox(vLp, uHalf, uCorner);
  float cover = clamp(0.5 - sd / pxl, 0.0, 1.0);

  // A soft shadow under the card, on the light page (round five): a blurred copy of the card's shape
  // pushed a little down and to the right. Only a plane that asked for it (uShadow) has a margin wide
  // enough to show it. It is drawn premultiplied, behind the card's own colour.
  float shade = 0.0;
  if (uShadow > 0.001) {
    float blur = clamp(uHalf.y * 0.55, 8.0, 24.0);
    float sds = sdBox(vLp - vec2(blur * 0.12, -blur * 0.5), uHalf, uCorner);
    shade = uShadow * 0.5 * (1.0 - smoothstep(-blur * 0.25, blur, sds));
  }
  if (cover <= 0.0 && shade <= 0.004) discard;

  float face = gl_FrontFacing ? 1.0 : -1.0;
  vec2 c = vLp / (2.0 * uHalf);
  c.x *= face;
  float asp = uHalf.x / uHalf.y;
  vec2 q = c;

  // The hover lens: the picture swells under the pointer, with a ripple that runs out from it.
  vec2 d = c - uPointer;
  vec2 dn = vec2(d.x * asp, d.y);
  float r = length(dn);
  float bump = uFx.x > 0.001 ? smoothstep(0.62, 0.0, r) : 0.0;
  if (bump > 0.0) {
    q = uPointer + d * (1.0 - 0.42 * uFx.x * bump * bump);
    q += normalize(d + 1e-5) * sin(r * 30.0 - uTime * 5.0) * 0.006 * uFx.x * bump * bump;
  }

  // The split of the colour, on the pointer's side on hover.
  vec2 split = vec2(0.0);
  float side = 0.0;
  if (uFx.y > 0.001) {
    vec2 pd = uPointer / max(length(uPointer), 1e-3);
    float near = smoothstep(0.18, 0.5, length(uPointer * vec2(asp, 1.0)));
    side = uFx.y * (0.25 + 0.75 * near) * smoothstep(-0.1, 0.55, dot(c, pd));
    split += pd * 0.014 * side * vec2(1.0 / max(asp, 1.0), 1.0);
  }
  vec3 rgb;
  if (uFx.y > 0.001) {
    rgb = vec3(pic(q + split).r, pic(q).g, pic(q - split).b);
  } else {
    rgb = pic(q);
  }

  // The picture before it has arrived is the clip's own colour.
  rgb = mix(uColor, rgb, uReady);

  // One light from the upper left front, as on the picture field's cards: a plane that faces the viewer is not changed.
  vec3 nrm = normalize(cross(dFdx(vView), dFdy(vView)));
  float facing = abs(dot(nrm, normalize(vec3(-0.35, 0.5, 0.8))));
  rgb *= 1.0 - uLight * (1.0 - smoothstep(-0.1, 0.8, facing));

  // A hairline of light inside the rim.
  float inside = clamp(-sd / pxl, 0.0, 4.0);
  rgb += 0.054 * (1.0 - smoothstep(0.0, 1.4, inside));

  // The calm loading line of a film that waits for more picture: a thin track along the foot of the
  // plane with the seconds in hand lit, inside the rim. It is drawn only when uLoad.x is above zero.
  if (uLoad.x > 0.002) {
    float m = clamp(uHalf.x * 0.06, 6.0, 20.0);
    float span = max(uHalf.x - m, 1.0);
    float y0 = -uHalf.y + m;
    float on = 1.0 - smoothstep(0.0, pxl, abs(vLp.y - y0) - pxl);
    float u = (vLp.x * face + span) / (2.0 * span);
    float within = step(0.0, u) * step(u, 1.0);
    float lit = 1.0 - smoothstep(0.0, 2.0 * pxl / (2.0 * span), u - uLoad.y);
    float line = on * within * (0.28 + 0.72 * lit) * uLoad.x;
    rgb = mix(rgb, vec3(1.0), line * 0.9);
  }

  vec3 shadowRgb = vec3(0.06, 0.09, 0.22);
  float a = cover + shade * (1.0 - cover);
  gl_FragColor = vec4(rgb * cover + shadowRgb * shade * (1.0 - cover), a) * uOpacity;
}
`;

export const TRAIL_VERTEX = /* glsl */ `
attribute float aA;
varying float vA;
void main() {
  vA = aA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TRAIL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main() {
  float a = vA * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`;
