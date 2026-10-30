/**
 * The GLSL of the intro. Every program draws one rectangle (a pixel-space quad) and does its work
 * in the fragment shader, with premultiplied alpha out (blend ONE, ONE_MINUS_SRC_ALPHA).
 */

export const VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
uniform vec2 u_res;
uniform vec4 u_rect; // x, y, w, h in canvas pixels (y down)
out vec2 v_px;
out vec2 v_uv;
void main() {
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  v_px = p;
  v_uv = a_pos;
  vec2 ndc = vec2(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_px;
in vec2 v_uv;
out vec4 o_col;
uniform vec2 u_res;

// smoothstep that is also right when the first edge is above the second
float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
vec3 rainbow(float h) {
  vec3 k = fract(vec3(0.0, 1.0 / 3.0, 2.0 / 3.0) + h);
  return clamp(abs(k * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}
`;

/** The ground: black, the page's cool grey with its faint dot grid, dark maroon, white. */
export const GROUND = /* glsl */ `${COMMON}
uniform vec4 u_ground; // mode, dot size px, step, vignette
void main() {
  float m = u_ground.x;
  vec3 c = vec3(0.0);
  if (m > 0.5 && m < 1.5) {
    c = vec3(171.0, 175.0, 183.0) / 255.0;
    // a faint grid of dots, 38 px apart, a little lighter than the field
    float d = u_ground.y;
    vec2 g = mod(v_px, d * 2.2) - d * 1.1;
    float dot = sstep(d * 0.5, d * 0.2, length(g));
    c += dot * 0.035;
    // a little darker toward the bottom left
    float v = length((v_px / u_res - vec2(0.55, 0.45)) * vec2(1.0, 1.1));
    c *= 1.0 - 0.07 * sstep(0.4, 0.9, v);
  } else if (m > 1.5 && m < 2.5) {
    c = vec3(46.0, 26.0, 34.0) / 255.0;
    float v = length(v_px / u_res - vec2(0.5, 0.5));
    c *= 1.0 - 0.25 * sstep(0.3, 0.8, v);
  } else if (m > 2.5) {
    c = vec3(1.0);
  }
  o_col = vec4(c, 1.0);
}
`;

/** A flat colour with an alpha (the flash, the pink wash). */
export const FLAT = /* glsl */ `${COMMON}
uniform vec4 u_color; // premultiplied by the caller
void main() { o_col = u_color; }
`;

/** A slanted panel filled with one colour, with a soft dark edge (the veil over Obsidia's panel). */
export const VEIL = /* glsl */ `${COMMON}
uniform vec4 u_xs; // x0 (bottom left), x1 (top left), x2 (top right), x3 (bottom right)
uniform vec2 u_ys; // y0 (top), y1 (bottom)
uniform vec4 u_color; // rgb, alpha
void main() {
  vec2 p = v_px;
  float v = (p.y - u_ys.x) / (u_ys.y - u_ys.x);
  float xl = mix(u_xs.y, u_xs.x, v);
  float xr = mix(u_xs.z, u_xs.w, v);
  float cov = clamp(min(p.x - xl, xr - p.x) + 0.5, 0.0, 1.0) * step(u_ys.x, p.y) * step(p.y, u_ys.y);
  if (cov <= 0.0) discard;
  // a little lighter toward the right, where the slash is
  vec3 c = mix(u_color.rgb * 0.8, u_color.rgb * 1.15, v * 0.3 + 0.2);
  float a = cov * u_color.a;
  o_col = vec4(c * a, a);
}
`;

/**
 * The red wedge that grows in from the left edge: a half plane leaning like the panels, red with a
 * lighter core, a radial glow, a dotted grid, and a thin hot line along its edge.
 */
export const WEDGE = /* glsl */ `${COMMON}
uniform vec4 u_wedge; // edge x at the top (px), lean (px per px), step, alpha
void main() {
  vec2 p = v_px;
  float edge = u_wedge.x - p.y * u_wedge.y;
  float d = edge - p.x; // inside when positive
  if (d < -2.0) discard;
  float cov = clamp(d + 0.5, 0.0, 1.0);
  vec2 q = p / u_res;
  float dn = d / u_res.x;
  float blot = fbm(q * 4.0 + u_wedge.z * 0.05);
  vec3 maroon = vec3(120.0, 44.0, 74.0) / 255.0;
  vec3 red = vec3(236.0, 24.0, 56.0) / 255.0;
  vec3 hot = vec3(255.0, 64.0, 100.0) / 255.0;
  // saturated red along the edge, maroon and purple toward the left rim of the screen
  vec3 c = mix(red, maroon, sstep(0.02, 0.55, dn) * (0.78 + 0.3 * blot));
  float core = exp(-pow(length((vec2(dn, q.y) - vec2(0.12, 0.3)) * vec2(1.0, 1.3)) * 3.2, 2.0));
  c = mix(c, hot, core * 0.45);
  // a pale haze low in the middle of the field
  float haze = exp(-pow(length((q - vec2(0.3, 0.56)) * vec2(1.0, 1.25)) * 5.2, 2.0));
  c = mix(c, vec3(1.0, 0.8, 0.88), haze * 0.55);
  // dim the corners
  c *= 1.0 - 0.3 * sstep(0.55, 1.0, length((q - vec2(0.3, 0.5)) * vec2(1.0, 1.0)));
  // the dotted grid
  vec2 g = mod(p, 38.0) - 19.0;
  c += sstep(2.6, 1.0, length(g)) * 0.07;
  // the edge: a thin pale line high up, a dark crack lower down
  float hi = sstep(2.5, 0.0, d);
  float lowZone = sstep(0.35, 0.65, q.y);
  c = mix(c, vec3(1.0, 0.86, 0.9), hi * (1.0 - lowZone) * 0.9);
  c = mix(c, vec3(0.28, 0.02, 0.06), sstep(3.0, 0.0, d - 1.0) * lowZone * 0.75);
  o_col = vec4(c * cov, cov) * u_wedge.w;
}
`;

/**
 * The thin beam: a long tapering line from the left edge to a point, pink at its base, yellow in the
 * middle and cyan at the tip, with a soft glow round it.
 */
export const THIN = /* glsl */ `${COMMON}
uniform vec4 u_thin; // tip x, tip y, base y, base half width (px)
uniform vec2 u_thin2; // colour phase, alpha
uniform float u_thin3; // dpr
void main() {
  vec2 p = v_px;
  float L = max(u_thin.x, 1.0);
  float x = p.x / L;
  if (x < 0.0 || x > 1.02) discard;
  float xc = clamp(x, 0.0, 1.0);
  float cy = mix(u_thin.z, u_thin.y, xc);
  float hw = max(u_thin.w * pow(1.0 - xc, 1.25), 0.8 * u_thin3);
  float d = abs(p.y - cy);
  float core = sstep(hw, hw * 0.55, d);
  float glow = exp(-d / (hw * 2.2 + 4.0 * u_thin3)) * 0.45;
  vec3 pink = vec3(1.0, 0.42, 0.68);
  vec3 yellow = vec3(1.0, 0.92, 0.45);
  vec3 cyan = vec3(0.45, 0.93, 0.95);
  float m = clamp(xc * 1.15 + u_thin2.x * 0.5 - 0.15, 0.0, 1.0);
  vec3 c = m < 0.6 ? mix(pink, yellow, m / 0.6) : mix(yellow, cyan, (m - 0.6) / 0.4);
  c = mix(c, vec3(1.0), core * 0.35);
  float a = clamp(core + glow * (1.0 - xc), 0.0, 1.0) * u_thin2.y * sstep(1.02, 0.97, x);
  o_col = vec4(c * a, a);
}
`;

/**
 * One panel: a slanted parallelogram of a welcome clip or the splash art, with the impact frame
 * (a black and white threshold), the white glow outline, the rainbow fringe, the prism flare, the
 * blue bevel and the line art of the flash.
 */
export const PANEL = /* glsl */ `${COMMON}
uniform sampler2D u_splash;
uniform sampler2D u_clip;
uniform vec4 u_xs; // x0 (bottom left), x1 (top left), x2 (top right), x3 (bottom right)
uniform vec2 u_ys; // y0 (top), y1 (bottom)
uniform vec2 u_vis; // visible rows from, to (px, y down)
uniform vec4 u_picS; // splash origin xy, size zw (px)
uniform vec4 u_picV; // clip origin xy, size zw (px)
uniform vec4 u_a; // mix, pale, thr, inv
uniform vec4 u_b; // white, black, glow, fringe
uniform vec4 u_c; // flare, alpha, bevel, seed
uniform vec4 u_d; // lineart, hasClip, step, dpr
uniform vec4 u_e; // split, stripes, plate extension (px)

void main() {
  vec2 p = v_px;
  float dpr = u_d.w;
  float y0 = u_ys.x;
  float y1 = u_ys.y;
  float v = (p.y - y0) / (y1 - y0);
  float xl = mix(u_xs.y, u_xs.x, v);
  float xr = mix(u_xs.z, u_xs.w, v);
  float lean = (u_xs.y - u_xs.x) / (y1 - y0);
  float k = inversesqrt(1.0 + lean * lean);
  float dl = (p.x - xl) * k; // distance inside from the left edge
  float dr = (xr - p.x) * k;
  float dt = p.y - u_vis.x;
  float db = u_vis.y - p.y;
  float inside = min(min(dl, dr), min(dt, db));
  float sd = -inside;
  // the whole shape (the blue plate shows here before the picture has grown into it)
  float plate = u_c.z;
  float sdFull = -min(min(dl + u_e.z * k, dr), min(p.y - y0, y1 - p.y));

  float glow = u_b.z;
  float seed = u_c.w + u_d.z * 0.37;
  // the white light round a panel when it lands: a soft rim, and two thin tapering strokes that
  // lie along the top edge and run past its corner
  float halo = 0.0;
  if (glow > 0.001) {
    vec2 cc = vec2((u_xs.x + u_xs.z) * 0.5, (y0 + y1) * 0.5);
    float ang = atan(p.y - cc.y, p.x - cc.x);
    float n = vnoise(vec2(ang * 6.0, seed * 3.1));
    float R = (7.0 + 16.0 * n) * glow * dpr;
    halo = sstep(R, 0.0, sd) * 0.7 * glow;
    float pw = max(u_xs.z - u_xs.y, 1.0);
    float s1 = (p.x - (u_xs.y - 0.04 * pw)) / (pw * 0.55);
    if (s1 > 0.0 && s1 < 1.0) {
      float j = vnoise(vec2(s1 * 9.0, seed * 2.0 + 1.0));
      float h = (1.0 - s1) * (5.0 + 5.0 * j) * glow * dpr;
      float c1 = y0 - (3.0 + 5.0 * j) * dpr;
      halo = max(halo, sstep(h, h * 0.35, abs(p.y - c1)) * sstep(1.0, 0.7, s1));
    }
    float s2 = (p.x - (u_xs.y + 0.30 * pw)) / (pw * 0.45);
    if (s2 > 0.0 && s2 < 1.0) {
      float j2 = vnoise(vec2(s2 * 7.0, seed * 5.0 + 3.0));
      float h2 = (1.0 - s2) * (4.0 + 7.0 * j2) * glow * dpr;
      float c2 = y0 - (11.0 + 7.0 * j2) * dpr;
      halo = max(halo, sstep(h2, h2 * 0.3, abs(p.y - c2)) * sstep(1.0, 0.6, s2));
    }
  }

  float picCov = clamp(0.5 - sd, 0.0, 1.0);
  float cov = plate > 0.001 ? clamp(0.5 - sdFull, 0.0, 1.0) : picCov;
  if (cov <= 0.0 && halo <= 0.003) discard;

  vec3 col = vec3(0.0);
  if (cov > 0.0) {
    vec2 uvS = (p - u_picS.xy) / u_picS.zw;
    vec2 uvV = (p - u_picV.xy) / u_picV.zw;
    float fringe = u_b.w;
    vec3 s;
    vec3 c;
    if (fringe > 0.001) {
      float sh = 6.0 * fringe * dpr;
      vec2 o = vec2(sh, 0.0) / u_picV.zw;
      vec2 o2 = vec2(sh, 0.0) / u_picS.zw;
      c = vec3(texture(u_clip, uvV - o).r, texture(u_clip, uvV).g, texture(u_clip, uvV + o).b);
      s = vec3(texture(u_splash, uvS - o2).r, texture(u_splash, uvS).g, texture(u_splash, uvS + o2).b);
    } else {
      c = texture(u_clip, uvV).rgb;
      s = texture(u_splash, uvS).rgb;
    }
    if (u_d.y < 0.5) c = s;
    col = mix(c, s, u_a.x);
    col = mix(col, vec3(0.78, 0.7, 0.95), u_a.y);

    // the impact frame: the picture as black and white, with ragged ink edges
    if (u_a.z >= 0.0) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float jag = (vnoise(p * 0.09 + seed * 5.0) - 0.5) * 0.16;
      float kk = step(u_a.z + jag, lum);
      kk = mix(kk, 1.0 - kk, u_a.w);
      col = vec3(kk);
    }
    if (u_e.x >= 0.0) {
      // black and white split along the diagonal of the panel
      float px = (p.x - u_xs.x) / max(u_xs.z - u_xs.x, 1.0);
      float py = (p.y - y0) / (y1 - y0);
      float sv = px * 0.5 + (1.0 - py) * 0.5;
      float edge = vnoise(vec2(py * 14.0, seed)) * 0.04;
      col = vec3(step(sv + edge, u_e.x));
    }
    if (u_e.y > 0.0) {
      // thick black and white bars with a colour fringe
      float w = 46.0 * dpr;
      float q = (p.x * 0.55 + p.y * 0.83) / w + vnoise(p * 0.006) * 1.6;
      float id = floor(q);
      float duty = 0.35 + 0.35 * hash(vec2(id, 3.0));
      float sh = 3.5 * dpr / w;
      vec3 bars = vec3(step(duty, fract(q - sh)), step(duty, fract(q)), step(duty, fract(q + sh)));
      col = mix(col, bars, u_e.y);
    }
    col = mix(col, vec3(1.0), u_b.x);
    col = mix(col, vec3(0.0), u_b.y);
    // the soft light along the left edge
    col += vec3(1.0) * sstep(34.0 * dpr, 0.0, dl) * 0.55 * glow;

    // the rainbow refraction along the left edge
    if (fringe > 0.001) {
      float band = fract(dl / (7.0 * dpr) - seed * 0.1);
      float w = sstep(46.0 * dpr, 0.0, dl) * fringe;
      col = mix(col, rainbow(band * 0.9), w * 0.75);
      float bottom = sstep(46.0 * dpr, 0.0, db) * fringe;
      col = mix(col, rainbow(fract(db / (7.0 * dpr))), bottom * 0.6);
    }

    // the prism flare: rays of colour thrown to the lower left from a point, on black; past 1 it
    // opens into a starburst
    if (u_c.x > 0.001) {
      float fx = min(u_c.x, 1.0);
      vec2 c0 = vec2(mix(xl, xr, 0.62), mix(y0, y1, 0.62));
      vec2 d = p - c0;
      float r = length(d) / dpr;
      float a = atan(d.y, d.x);
      float dirw = mix(0.12, 1.0, pow(0.5 + 0.5 * cos(a - 2.6), 2.0));
      dirw = mix(dirw, 1.0, clamp((u_c.x - 0.9) * 4.0, 0.0, 1.0));
      vec3 rays = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float off = float(i) * 0.05;
        float f = pow(abs(sin((a + off) * 7.0 + seed)), 18.0) + 0.5 * pow(abs(sin((a + off) * 19.0 + seed * 2.0)), 50.0);
        rays[i] = f * dirw;
      }
      float fall = 1.0 / (1.0 + r * 0.02);
      float core = exp(-r * 0.05) + 0.5 * exp(-abs(d.y / dpr) * 0.08) * exp(-abs(d.x / dpr) * 0.012);
      vec3 fl = rays * fall * 1.5 + vec3(core) * 0.9;
      col = mix(col, clamp(fl, 0.0, 1.0), fx);
    }

    // the blue plate of the first panel, with its dots, where the picture has not grown yet
    if (plate > 0.001) {
      vec2 g = mod(p, 38.0 * dpr) - 19.0 * dpr;
      vec3 pl = vec3(62.0, 110.0, 186.0) / 255.0 + sstep(2.5 * dpr, 1.0 * dpr, length(g)) * 0.18;
      col = mix(pl, col, picCov);
    }

    // the line art of the flash: edges of the picture in pink on the white
    if (u_d.x > 0.5) {
      vec2 e = vec2(2.0) / u_picS.zw;
      vec2 uvs = (p - u_picS.xy) / u_picS.zw;
      float l1 = dot(texture(u_splash, uvs + vec2(e.x, 0.0)).rgb, vec3(0.333));
      float l2 = dot(texture(u_splash, uvs - vec2(e.x, 0.0)).rgb, vec3(0.333));
      float l3 = dot(texture(u_splash, uvs + vec2(0.0, e.y)).rgb, vec3(0.333));
      float l4 = dot(texture(u_splash, uvs - vec2(0.0, e.y)).rgb, vec3(0.333));
      float ed = clamp(length(vec2(l1 - l2, l3 - l4)) * 4.5, 0.0, 1.0);
      col = mix(vec3(1.0), vec3(0.96, 0.62, 0.9), ed);
    }
  }

  float a = cov * u_c.y;
  vec3 outc = col * a;
  // the halo sits under the panel and over what is behind
  float ha = halo * (1.0 - a) * u_c.y;
  outc += vec3(1.0) * ha;
  a += ha;
  o_col = vec4(outc, a);
}
`;

/** A picture (a still of the reference) at a place, with a tint and an alpha, turned about a point. */
export const SPRITE = /* glsl */ `${COMMON}
uniform sampler2D u_tex;
uniform vec4 u_tint; // rgb multiply, alpha
uniform vec4 u_hue; // rgb add, 0
uniform float u_rot;
uniform vec2 u_pivot;
uniform vec2 u_rectPos;
uniform vec2 u_rectSize;
void main() {
  vec2 d = v_px - u_pivot;
  float c = cos(u_rot);
  float s = sin(u_rot);
  // find the picture's own point that lands here
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) + u_pivot;
  vec2 uv = (q - u_rectPos) / u_rectSize;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  vec4 t = texture(u_tex, uv);
  vec3 col = t.rgb * u_tint.rgb + u_hue.rgb * t.a;
  o_col = vec4(col, t.a) * u_tint.a;
}
`;
