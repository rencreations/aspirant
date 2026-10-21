import { prefersReducedMotion } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";

import { FACE, RIG } from "./layout";

/**
 * What a panel does while the pointer is on it, and only then.
 *
 * The panel is marked `data-hover` (the stylesheet reads it to take the haze off, colour the rim,
 * lift the frame and show the sparkles). The picture itself is redrawn by one WebGL canvas that moves
 * to the hovered panel. It does not follow the pointer. Instead the flat splash art is given a rig,
 * as the animated cards of the game have: the whole figure sways from the hips, the chest breathes,
 * the head turns on the neck, and the hair streams in waves that grow toward its tips, each part on
 * its own rhythm. Light plays on the subject too: highlights glint, the bright parts pulse in the
 * character's colour, the edges catch a rim light, the eyes glow, bloom breathes, and a grain of
 * glitter twinkles on the brightest pixels.
 *
 * The regions are placed from where the face is in each picture (`FACE`) and how big the head is
 * (`RIG`), measured on the art. One canvas and one loop serve the hovered panel, which eases in and
 * out; when nothing is hovered the loop stops and the canvas is taken away.
 */

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform vec2 res;
uniform vec4 box;
uniform float t;
uniform float k;
uniform float q;
uniform vec2 face;
uniform float hs;
uniform float hair;
uniform vec3 tint;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 uv = (p - box.xy) / box.zw;
  const float R = 1.7778;

  // Where each part of the rig is, in the picture.
  vec2 d0 = vec2((uv.x - face.x) * R, uv.y - face.y);
  float head = exp(-dot(d0, d0) / (hs * hs * 1.7));
  vec2 dh = vec2(d0.x / (hs * 3.4), (d0.y - hs * 0.9) / (hs * 3.2));
  float hairM = clamp(exp(-dot(dh, dh)) - head * 0.55, 0.0, 1.0);
  float below = clamp((uv.y - face.y) / (0.98 - face.y), 0.0, 1.0);
  float above = 1.0 - below;
  vec2 chestC = vec2(face.x, face.y + hs * 2.7);
  vec2 dc = vec2((uv.x - chestC.x) * R, uv.y - chestC.y);
  float chest = exp(-dot(dc, dc) / (hs * hs * 6.0));

  vec2 disp = vec2(0.0);
  // The body sways from the hips: the further from the bottom, the more it moves.
  disp.x += (sin(t * 0.8) * 0.7 + sin(t * 1.9 + 1.0) * 0.3) * 0.008 * above * above;
  disp.y += sin(t * 1.25) * 0.0035 * above;
  // The chest breathes.
  disp += (uv - chestC) * sin(t * 1.25 + 0.4) * 0.016 * chest;
  // The head turns and nods on the neck.
  vec2 neck = vec2(face.x, face.y + hs * 1.0);
  vec2 rr = vec2((uv.x - neck.x) * R, uv.y - neck.y);
  float ang = (sin(t * 0.7 + 1.3) * 0.7 + sin(t * 1.6) * 0.3) * 0.036 * head;
  disp += ang * vec2(-rr.y / R, rr.x);
  disp.y += sin(t * 1.1 + 0.8) * 0.0028 * head;
  // The hair streams: waves that travel down it and grow toward the tips.
  float tip = clamp(length(vec2(d0.x, d0.y - hs * 0.5)) / (hs * 3.0), 0.0, 1.0);
  float wave = sin(t * 1.9 + uv.y * 12.0 + uv.x * 5.0) * 0.6 + sin(t * 3.1 + uv.y * 21.0) * 0.4;
  disp.x += wave * 0.009 * hair * hairM * (0.35 + tip);
  disp.y += sin(t * 1.5 + uv.x * 10.0 + uv.y * 4.0) * 0.005 * hair * hairM * (0.3 + tip);
  // Cloth and the rest of the air move a little, so no part is dead still.
  disp += vec2(sin(t * 1.4 + uv.y * 16.0), cos(t * 1.2 + uv.x * 14.0)) * 0.0011 * (1.0 - head) * q;

  vec2 suv = uv + disp * k;
  vec3 c = texture(tex, suv).rgb;
  float L = luma(c);

  // Light that plays on the subject.
  float hl = smoothstep(0.7, 0.98, L);
  float pulse = 0.5 + 0.5 * sin(t * 2.2 + suv.y * 5.0 + suv.x * 3.0);
  c += tint * hl * (0.1 + 0.2 * pulse) * k;
  // Bloom that breathes.
  c += vec3(1.0, 0.97, 0.92) * pow(L, 4.0) * (0.06 + 0.07 * sin(t * 1.7)) * k;
  // The eyes glow.
  vec2 de = d0 - vec2(0.0, hs * 0.05);
  float eye = exp(-dot(de, de) / (hs * hs * 0.35));
  c += tint * eye * (0.12 + 0.14 * sin(t * 2.6)) * k;

  if (q > 0.5) {
    // Rim light: the edges of the figure catch light that travels around them.
    vec2 px = 1.6 / box.zw;
    float lx = luma(texture(tex, suv + vec2(px.x, 0.0)).rgb) - luma(texture(tex, suv - vec2(px.x, 0.0)).rgb);
    float ly = luma(texture(tex, suv + vec2(0.0, px.y)).rgb) - luma(texture(tex, suv - vec2(0.0, px.y)).rgb);
    float edge = clamp(length(vec2(lx, ly)) * 2.6, 0.0, 1.0);
    float swing = 0.5 + 0.5 * sin(t * 1.4 + atan(ly, lx) + suv.y * 3.0);
    c += mix(tint, vec3(1.0), 0.45) * edge * swing * 0.28 * k;
    // Glitter on the brightest pixels, each twinkling on its own.
    vec2 gs = suv * vec2(190.0, 107.0);
    vec2 cell = floor(gs);
    vec2 f = fract(gs) - 0.5;
    float g = hash(cell);
    float tw = pow(0.5 + 0.5 * sin(t * (2.0 + g * 5.0) + g * 40.0), 10.0);
    // A small soft point with a faint cross, not a square.
    float spark = exp(-dot(f, f) * 40.0) + 0.5 * exp(-abs(f.x) * 30.0 - abs(f.y) * 4.0) + 0.5 * exp(-abs(f.y) * 30.0 - abs(f.x) * 4.0);
    c += mix(vec3(1.0), tint, 0.3) * step(0.86, g) * tw * spark * smoothstep(0.5, 0.88, L) * 1.1 * k;
    // A touch more colour while it is alive.
    float gray = luma(c);
    c = mix(vec3(gray), c, 1.0 + 0.16 * k);
  }
  o = vec4(c, 1.0);
}`;

interface Panel {
  li: HTMLElement;
  art: HTMLElement;
  img: HTMLImageElement;
  slug: keyof typeof FACE;
  tint: [number, number, number];
  /** 0 off the panel, 1 on it. */
  k: number;
  goal: number;
  /** A time offset, so two panels never move in step. */
  phase: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex.trim());
  if (!m) return [1, 0.4, 0.6];
  return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
}

export function createHoverFx() {
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let failed = false;
  const textures = new Map<string, WebGLTexture>();
  const uniforms: Record<string, WebGLUniformLocation | null> = {};

  let current: Panel | null = null;
  let leaving: Panel | null = null;
  let raf = 0;
  let shownOn: Panel | null = null;

  const canDraw = () => !failed && !prefersReducedMotion() && perfLevel() !== "lite";

  const hideCanvas = () => {
    if (canvas) {
      canvas.style.display = "none";
      canvas.remove();
    }
    shownOn = null;
  };

  /** The canvas, the context and the program are made on the first hover. */
  const setup = (): boolean => {
    if (canvas && gl && program) return true;
    if (failed) return false;
    try {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:absolute;left:0;top:0;width:100%;height:100%;display:none;pointer-events:none";
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
      });
      if (!gl) throw new Error("no webgl2");
      const ctx = gl;
      const compile = (type: number, src: string) => {
        const sh = ctx.createShader(type)!;
        ctx.shaderSource(sh, src);
        ctx.compileShader(sh);
        if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) {
          throw new Error(ctx.getShaderInfoLog(sh) ?? "shader");
        }
        return sh;
      };
      program = ctx.createProgram();
      ctx.attachShader(program, compile(ctx.VERTEX_SHADER, VERT));
      ctx.attachShader(program, compile(ctx.FRAGMENT_SHADER, FRAG));
      ctx.linkProgram(program);
      if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) throw new Error("link");
      ctx.useProgram(program);
      const buf = ctx.createBuffer();
      ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
      ctx.bufferData(
        ctx.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        ctx.STATIC_DRAW,
      );
      const loc = ctx.getAttribLocation(program, "a");
      ctx.enableVertexAttribArray(loc);
      ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
      for (const n of ["tex", "res", "box", "t", "k", "q", "face", "hs", "hair", "tint"]) {
        uniforms[n] = ctx.getUniformLocation(program, n);
      }
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        failed = true;
        hideCanvas();
      });
      return true;
    } catch {
      failed = true;
      canvas = null;
      gl = null;
      program = null;
      return false;
    }
  };

  const textureFor = (p: Panel): WebGLTexture | null => {
    if (!gl) return null;
    const have = textures.get(p.slug);
    if (have) return have;
    if (!p.img.complete || p.img.naturalWidth === 0) return null;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, p.img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(p.slug, tex);
    // Only the last few pictures stay on the graphics card.
    if (textures.size > 4) {
      const oldest = textures.keys().next().value;
      if (oldest !== undefined && oldest !== p.slug) {
        gl.deleteTexture(textures.get(oldest) ?? null);
        textures.delete(oldest);
      }
    }
    return tex;
  };

  /** Put the canvas over the picture of this panel and size it. */
  const mount = (p: Panel): boolean => {
    if (!canvas || !gl) return false;
    if (shownOn === p) return true;
    const w = p.li.offsetWidth;
    const h = p.li.offsetHeight;
    if (w < 2 || h < 2) return false;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.max(2, Math.round(Math.min(w * scale, 1500)));
    const ch = Math.max(2, Math.round((h * cw) / w));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl.viewport(0, 0, cw, ch);
    p.art.after(canvas);
    canvas.style.display = "block";
    shownOn = p;
    return true;
  };

  const draw = (p: Panel, now: number): boolean => {
    if (!canvas || !gl || !program) return false;
    const tex = textureFor(p);
    if (!tex || !mount(p)) return false;
    const cs = getComputedStyle(p.img);
    const s = canvas.width / p.li.offsetWidth;
    const f = FACE[p.slug];
    const r = RIG[p.slug];
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniforms.tex!, 0);
    gl.uniform2f(uniforms.res!, canvas.width, canvas.height);
    gl.uniform4f(
      uniforms.box!,
      parseFloat(cs.left) * s,
      parseFloat(cs.top) * s,
      parseFloat(cs.width) * s,
      parseFloat(cs.height) * s,
    );
    gl.uniform1f(uniforms.t!, now / 1000 + p.phase);
    gl.uniform1f(uniforms.k!, p.k);
    gl.uniform1f(uniforms.q!, perfLevel() === "full" ? 1 : 0);
    gl.uniform2f(uniforms.face!, f.fx, f.fy);
    gl.uniform1f(uniforms.hs!, r.hs);
    gl.uniform1f(uniforms.hair!, r.hair);
    gl.uniform3f(uniforms.tint!, p.tint[0], p.tint[1], p.tint[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };

  const release = (p: Panel) => {
    delete p.li.dataset.hover;
    if (shownOn === p) hideCanvas();
  };

  const frame = (now: number) => {
    raf = 0;
    let busy = false;
    for (const p of [current, leaving]) {
      if (!p) continue;
      p.k += (p.goal - p.k) * 0.09;
      if (p.goal === 0 && p.k < 0.01) {
        if (p === leaving) {
          release(p);
          leaving = null;
        }
        continue;
      }
      // The panel that is leaving gives the canvas up to the one that arrives.
      if (p === leaving && current && shownOn !== p) {
        release(p);
        leaving = null;
        continue;
      }
      if (!draw(p, now)) {
        // No picture to draw yet: the plain picture stays.
        if (p === leaving) {
          release(p);
          leaving = null;
        }
        continue;
      }
      busy = true;
    }
    if (busy) raf = requestAnimationFrame(frame);
  };

  const run = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  return {
    /** The pointer came onto a panel (or moved onto one from another). */
    enter(li: HTMLElement) {
      if (current?.li === li) return;
      if (current) this.leave();
      // The frame is lit at once, whatever the device.
      li.dataset.hover = "true";
      if (!canDraw() || !setup()) return;
      const img = li.querySelector<HTMLImageElement>("img");
      const art = li.querySelector<HTMLElement>("[data-fx='art']");
      const slug = li.dataset.slug as keyof typeof FACE | undefined;
      if (!img || !art || !slug || !(slug in FACE)) return;
      if (leaving?.li === li) {
        current = leaving;
        leaving = null;
        current.goal = 1;
      } else {
        current = {
          li,
          art,
          img,
          slug,
          tint: hexToRgb(getComputedStyle(li).getPropertyValue("--c")),
          k: 0,
          goal: 1,
          phase: Math.random() * 30,
        };
      }
      run();
    },
    /** The pointer left it: it eases back to rest. */
    leave() {
      if (!current) return;
      current.goal = 0;
      // The frame goes back to its shade at once, with the stylesheet's own fade.
      delete current.li.dataset.hover;
      if (leaving && leaving !== current) release(leaving);
      leaving = current;
      current = null;
      run();
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (current) release(current);
      if (leaving) release(leaving);
      current = null;
      leaving = null;
      for (const t of textures.values()) gl?.deleteTexture(t);
      textures.clear();
      hideCanvas();
    },
  };
}
