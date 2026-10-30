import type { Slug } from "@/content/types";

import { clipRect, type Quad, quadOf, slotOf, splashRect, type View } from "../geometry";
import { type StillName, STILLS } from "../stills";
import { PANEL_SLUGS, type Scene } from "../timeline";
import {
  EMBER_FRAG,
  EMBER_VERT,
  FLAT,
  GLOW,
  GROUND,
  HIT,
  PANEL,
  SHARD_FRAG,
  SHARD_VERT,
  SPRITE,
  VERT,
  WEDGE,
} from "./shaders";

/** A picture the renderer can take as a texture. */
export type Source = ImageBitmap | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface Assets {
  splash: Partial<Record<Slug, Source>>;
  /** The welcome clips, played by the caller. Absent on `lite`. */
  clips: Partial<Record<Slug, HTMLVideoElement>>;
  stills: Partial<Record<StillName, Source>>;
  /** Obsidia's cut-out, for the impact frame. */
  cutout?: Source;
  clipInfo: Partial<Record<Slug, { focus: { x: number; y: number }; aspect: number }>>;
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  "u_res",
  "u_rect",
  "u_ground",
  "u_color",
  "u_wedge",
  "u_cut",
  "u_rectH",
  "u_h",
  "u_pc",
  "u_g",
  "u_gc",
  "u_g2",
  "u_P",
  "u_u",
  "u_sc",
  "u_age",
  "u_crack",
  "u_dpr",
  "u_rot",
  "u_rectPos",
  "u_rectSize",
  "u_pivot",
  "u_splash",
  "u_clip",
  "u_xs",
  "u_ys",
  "u_vis",
  "u_picS",
  "u_picV",
  "u_a",
  "u_b",
  "u_c",
  "u_d",
  "u_e",
  "u_tex",
  "u_tint",
  "u_hue",
] as const;

/** Boxes of the real page the layers over it are placed by (CSS pixels). */
export interface PageBoxes {
  obsidia: { x: number; y: number; w: number; h: number };
  /** The four corners of Obsidia's panel (bottom left, top left, top right, bottom right). */
  quad: { x0: number; x1: number; x2: number; x3: number; y0: number; y1: number };
  /** The middle of the slash: where it is and how big the still must be to span it. */
  slash: { x: number; y: number; height: number };
}

/** A picture's rectangle scaled about the middle of the panel and moved down by `shy` panel heights. */
function zoomed(
  r: [number, number, number, number],
  q: Quad,
  zoom: number,
  shy: number,
): [number, number, number, number] {
  if (zoom === 1 && shy === 0) return r;
  const cx = (q.x0 + q.x2) / 2;
  const cy = (q.y0 + q.y1) / 2;
  return [
    cx + (r[0] - cx) * zoom,
    cy + (r[1] - cy) * zoom + shy * (q.y1 - q.y0),
    r[2] * zoom,
    r[3] * zoom,
  ];
}

/** How far past a panel the quad reaches, so its glow has room (CSS pixels). */
const PAD = 120;

/** How many embers fly from the boom. */
const EMBERS = 160;

/** The random numbers each ember keeps for itself (the same every time, so a frame is repeatable). */
function emberData(): Float32Array {
  const data = new Float32Array(EMBERS * 4);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < data.length; i++) data[i] = rnd();
  return data;
}

/**
 * The intro's renderer: one WebGL2 canvas, a handful of small programs, one unit quad. It owns the
 * textures. It allocates nothing per frame.
 */
export class IntroRenderer {
  readonly gl: WebGL2RenderingContext;
  private programs: Record<
    "ground" | "flat" | "wedge" | "panel" | "sprite" | "hit" | "glow" | "shard" | "ember",
    Program
  >;
  private shardVao: WebGLVertexArrayObject;
  private shardBuf: WebGLBuffer;
  private shardCount = 0;
  private emberVao: WebGLVertexArrayObject;
  private emberBuf: WebGLBuffer;
  private cut: { tex: WebGLTexture; aspect: number } | null = null;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private splash = new Map<Slug, WebGLTexture>();
  private clip = new Map<Slug, WebGLTexture>();
  private clipFrame = new Map<Slug, number>();
  private clipLoaded = new Set<Slug>();
  private stills = new Map<StillName, { tex: WebGLTexture; w: number; h: number }>();
  private blank: WebGLTexture;
  private view: View;
  private dpr = 1;
  private cw = 1;
  private ch = 1;
  private quad: Quad = { x0: 0, x1: 0, x2: 0, x3: 0, y0: 0, y1: 0 };
  private lost = false;
  /** Report GL errors to the console (`?introDebug`). */
  debug = false;
  private page: PageBoxes | null = null;
  onLost: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: Assets,
    view: View,
    private light = false,
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl;
    this.view = view;
    canvas.addEventListener("webglcontextlost", this.handleLost);
    this.programs = {
      ground: this.program(GROUND),
      flat: this.program(FLAT),
      wedge: this.program(WEDGE),
      panel: this.program(PANEL),
      sprite: this.program(SPRITE),
      hit: this.program(HIT),
      glow: this.program(GLOW),
      shard: this.program(SHARD_FRAG, SHARD_VERT),
      ember: this.program(EMBER_FRAG, EMBER_VERT),
    };
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    if (!vao || !buf) throw new Error("no buffers");
    this.vao = vao;
    this.buf = buf;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The glass (rebuilt when the window changes size) and the embers (fixed).
    const sv = gl.createVertexArray();
    const sb = gl.createBuffer();
    const ev = gl.createVertexArray();
    const eb = gl.createBuffer();
    if (!sv || !sb || !ev || !eb) throw new Error("no buffers");
    this.shardVao = sv;
    this.shardBuf = sb;
    this.emberVao = ev;
    this.emberBuf = eb;
    gl.bindVertexArray(sv);
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
    gl.bindVertexArray(ev);
    gl.bindBuffer(gl.ARRAY_BUFFER, eb);
    gl.bufferData(gl.ARRAY_BUFFER, emberData(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(vao);

    this.blank = this.texture(null);
    for (const slug of PANEL_SLUGS) {
      const src = assets.splash[slug];
      this.splash.set(slug, src ? this.texture(src, true) : this.blank);
      if (assets.clips[slug]) this.clip.set(slug, this.texture(null));
    }
    if (assets.cutout) {
      const c = assets.cutout;
      const cw = "naturalWidth" in c ? c.naturalWidth : c.width;
      const chh = "naturalHeight" in c ? c.naturalHeight : c.height;
      this.cut = { tex: this.texture(c, false, true), aspect: cw / Math.max(chh, 1) };
    }
    for (const name of Object.keys(assets.stills) as StillName[]) {
      const src = assets.stills[name];
      if (!src) continue;
      const w = "naturalWidth" in src ? src.naturalWidth : "width" in src ? src.width : 1;
      const h = "naturalHeight" in src ? src.naturalHeight : "height" in src ? src.height : 1;
      this.stills.set(name, { tex: this.texture(src, false, true), w, h });
    }
  }

  private handleLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.onLost?.();
  };

  private program(frag: string, vert: string = VERT): Program {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error("no shader");
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`shader: ${gl.getShaderInfoLog(s) ?? "failed"}`);
      }
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(prog) ?? "failed"}`);
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of UNIFORMS) u[n] = gl.getUniformLocation(prog, n);
    return { prog, u };
  }

  private texture(src: Source | null, mips = false, premultiply = false): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    if (src) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([20, 20, 28, 255]),
      );
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips && src) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    if (!tex) throw new Error("no texture");
    return tex;
  }

  setView(view: View): void {
    this.view = view;
  }

  /** Size the canvas to the window. `dpr` is the render scale (1 on a light level). */
  resize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    this.cw = Math.max(2, Math.round(w * dpr));
    this.ch = Math.max(2, Math.round(h * dpr));
    if (this.canvas.width !== this.cw) this.canvas.width = this.cw;
    if (this.canvas.height !== this.ch) this.canvas.height = this.ch;
    this.gl.viewport(0, 0, this.cw, this.ch);
    this.buildShards();
  }

  /** Tile the screen with slanted, jittered triangles (the same lean as the panels). */
  private buildShards(): void {
    const gl = this.gl;
    const cs = Math.max(90, this.ch / 7.5);
    const lean = 0.64;
    const rows = Math.ceil(this.ch / cs) + 2;
    const i0 = -Math.ceil(lean * rows) - 1;
    const cols = Math.ceil(this.cw / cs) + 2 - i0;
    const jit = (i: number, j: number, k: number) => {
      const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const vx = (i: number, j: number) =>
      (i + (jit(i, j, 1) - 0.5) * 0.7) * cs + (j + (jit(i, j, 2) - 0.5) * 0.7) * cs * lean;
    const vy = (j: number, i: number) => (j + (jit(i, j, 2) - 0.5) * 0.7) * cs - cs;
    const data = new Float32Array(rows * cols * 2 * 3 * 8);
    let n = 0;
    const tri = (
      a: [number, number],
      b: [number, number],
      c: [number, number],
      r: [number, number, number],
    ) => {
      const cx = (a[0] + b[0] + c[0]) / 3;
      const cy = (a[1] + b[1] + c[1]) / 3;
      const vs = [a, b, c];
      for (let k = 0; k < 3; k++) {
        const v = vs[k]!;
        data[n++] = v[0];
        data[n++] = v[1];
        data[n++] = cx;
        data[n++] = cy;
        data[n++] = r[0];
        data[n++] = r[1];
        data[n++] = r[2];
        data[n++] = k;
      }
    };
    for (let j = 0; j < rows; j++) {
      for (let ii = 0; ii < cols; ii++) {
        const i = i0 + ii;
        const p00: [number, number] = [vx(i, j), vy(j, i)];
        const p10: [number, number] = [vx(i + 1, j), vy(j, i + 1)];
        const p01: [number, number] = [vx(i, j + 1), vy(j + 1, i)];
        const p11: [number, number] = [vx(i + 1, j + 1), vy(j + 1, i + 1)];
        const r1: [number, number, number] = [jit(i, j, 5), jit(i, j, 6), jit(i, j, 7)];
        const r2: [number, number, number] = [jit(i, j, 8), jit(i, j, 9), jit(i, j, 10)];
        if (jit(i, j, 11) < 0.5) {
          tri(p00, p10, p11, r1);
          tri(p00, p11, p01, r2);
        } else {
          tri(p00, p10, p01, r1);
          tri(p10, p11, p01, r2);
        }
      }
    }
    this.shardCount = n / 8;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shardBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n), gl.STATIC_DRAW);
  }

  private use(p: Program): void {
    const gl = this.gl;
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res ?? null, this.cw, this.ch);
  }

  private rect(p: Program, x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    gl.uniform4f(p.u.u_rect ?? null, x, y, w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private full(p: Program): void {
    this.rect(p, 0, 0, this.cw, this.ch);
  }

  /** Take the clip's current picture when the timeline asks for a new one. */
  private feedClip(slug: Slug, frame: number): boolean {
    const video = this.assets.clips[slug];
    const tex = this.clip.get(slug);
    if (!video || !tex) return false;
    if (video.readyState < 2) return this.clipLoaded.has(slug);
    if (this.clipFrame.get(slug) !== frame) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (this.clipLoaded.has(slug)) {
        // Same size as before: refill the texture instead of making it again.
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      }
      this.clipFrame.set(slug, frame);
      this.clipLoaded.add(slug);
    }
    return true;
  }

  draw(scene: Scene): void {
    if (this.lost) return;
    const gl = this.gl;
    const { cw, ch, dpr } = this;
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pr = this.programs;
    // The impact point, in canvas pixels: the middle of the page's red slash.
    const sl = this.page?.slash;
    const px = Math.min(Math.max((sl ? sl.x : this.view.w * 0.45) * dpr, cw * 0.18), cw * 0.82);
    const py = Math.min(Math.max((sl ? sl.y : this.view.h * 0.5) * dpr, ch * 0.2), ch * 0.8);
    const slashH = (sl ? sl.height : this.view.h * 0.83) * dpr;

    // The ground.
    if (!scene.clear) {
      this.use(pr.ground);
      gl.uniform4f(pr.ground.u.u_ground ?? null, scene.ground, 3.5 * dpr * 1.6, 0, 0);
      this.full(pr.ground);
    }

    // The red wedge.
    if (scene.wedge.on) {
      this.use(pr.wedge);
      gl.uniform4f(pr.wedge.u.u_wedge ?? null, scene.wedge.edge * cw, 0.64, scene.wedge.step, 1);
      this.full(pr.wedge);
    }

    // The panels (the intro's own, and Obsidia on the real page).
    this.drawPanels(scene);

    // A pale wash over the lineup, one frame before the dark.
    if (scene.wash > 0) {
      this.use(pr.flat);
      const a = scene.wash;
      gl.uniform4f(pr.flat.u.u_color ?? null, 1 * a, 0.78 * a, 0.86 * a, a);
      this.full(pr.flat);
    }

    // The charge: a crimson glow at the impact point, thin lines drawn in, a seed of white light.
    if (scene.charge.glow > 0.001) {
      this.glow(0, px, py, scene.charge.size * ch, scene.charge.glow, 0.95, 0.12, 0.28, 0);
    }
    if (scene.speed.on) {
      this.still("speed-lines", px, py, scene.speed.size * 0.8, scene.speed.alpha, scene.speed.rot);
    }
    if (scene.seed > 0.001) {
      this.still("energy-slash", px, py, 1, 1, 0, (scene.seed * slashH) / 2048, 0.55);
    }

    // The impact frame covers everything.
    if (scene.hit.on) this.drawHit(scene, px, py);

    // The flash.
    if (scene.flash > 0) {
      this.use(pr.flat);
      gl.uniform4f(pr.flat.u.u_color ?? null, 1, 1, 1, 1);
      this.full(pr.flat);
    }

    // The boom, under the glass: the slash flares, the fire opens, the core burns.
    if (scene.flare > 0.001) {
      this.still("energy-slash", px, py, 1, scene.flare, 0, slashH / 2048, 0.6);
    }
    if (scene.fire.on) {
      const f = scene.fire;
      const n = f.frame;
      const wob = 1 + 0.05 * Math.sin(n * 2.1) + 0.03 * Math.sin(n * 0.7);
      this.still(
        "fire",
        px + Math.sin(n * 1.3) * 0.012 * ch,
        py + Math.cos(n * 1.7) * 0.01 * ch,
        1,
        f.alpha,
        0.07 * Math.sin(n * 1.9),
        (slashH / 895) * 1.15 * f.scale * wob,
      );
    }
    const b = scene.boom;
    if (b.core > 0.001) {
      const r = ch * (0.35 + 0.5 * Math.min(1, b.age / 0.2));
      this.glow(2, px, py, r, b.core, 1, 0.75, 0.45, 0);
    }

    // The glass.
    if (scene.shatter.on) this.drawShards(scene, px, py);

    // The shock waves and the embers go over the glass.
    if (b.on) {
      const e1 = 1 - Math.pow(1 - b.ring, 3);
      if (b.ring > 0 && b.ring < 1) {
        this.glow(
          1,
          px,
          py,
          ch * 1.35 * e1,
          Math.pow(1 - b.ring, 0.7),
          1,
          1,
          1,
          ch * (0.006 + 0.04 * (1 - b.ring)),
        );
      }
      const e2 = 1 - Math.pow(1 - b.ring2, 3);
      if (b.ring2 > 0 && b.ring2 < 1) {
        this.glow(
          1,
          px,
          py,
          ch * 0.95 * e2,
          0.7 * (1 - b.ring2),
          1,
          1,
          1,
          ch * (0.004 + 0.022 * (1 - b.ring2)),
        );
      }
      this.drawEmbers(b.age, px, py);
    }

    if (this.debug) {
      const err = gl.getError();
      if (err !== gl.NO_ERROR) console.warn(`[roster intro] GL error ${err} at t=${scene.t}`);
    }
  }

  /** A glow (kind 0), a ring (1) or a white-hot core added to the picture (2). */
  private glow(
    kind: 0 | 1 | 2,
    x: number,
    y: number,
    radius: number,
    strength: number,
    r: number,
    g: number,
    b: number,
    thickness: number,
  ): void {
    const gl = this.gl;
    const p = this.programs.glow;
    this.use(p);
    gl.uniform4f(p.u.u_g ?? null, x, y, radius, strength);
    gl.uniform4f(p.u.u_gc ?? null, r, g, b, kind);
    gl.uniform2f(p.u.u_g2 ?? null, Math.max(thickness, 1), 0);
    const reach = radius + thickness * 3 + 8;
    this.rect(p, x - reach, y - reach, reach * 2, reach * 2);
  }

  /** Obsidia as a hard silhouette, full screen, thrown about (the impact frames). */
  private drawHit(scene: Scene, px: number, py: number): void {
    const cut = this.cut;
    if (!cut) return;
    const gl = this.gl;
    const { cw, ch, dpr } = this;
    const p = this.programs.hit;
    const h = scene.hit;
    // Her figure fills the height on a wide screen; on a tall one it is held to the width.
    const height = Math.min(ch * 0.98, (cw * 1.25) / cut.aspect) * h.zoom;
    const width = height * cut.aspect;
    const cx = cw * ((cw < ch ? 0.5 : 0.44) + h.shx);
    const cy = ch * (0.52 + h.shy);
    this.use(p);
    gl.uniform1i(p.u.u_cut ?? null, 0);
    gl.uniform4f(p.u.u_rectH ?? null, cx - width / 2, cy - height / 2, width, height);
    gl.uniform4f(p.u.u_h ?? null, h.inv, h.tint, dpr, Math.floor(scene.t * 30) % 97);
    gl.uniform2f(p.u.u_pc ?? null, px, py);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cut.tex);
    this.full(p);
  }

  private drawShards(scene: Scene, px: number, py: number): void {
    const gl = this.gl;
    const p = this.programs.shard;
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res ?? null, this.cw, this.ch);
    gl.uniform2f(p.u.u_P ?? null, px, py);
    gl.uniform1f(p.u.u_u ?? null, scene.shatter.u);
    gl.uniform1f(p.u.u_sc ?? null, this.ch / 1080);
    gl.uniform1f(p.u.u_crack ?? null, scene.shatter.crack);
    gl.uniform1f(p.u.u_dpr ?? null, this.dpr);
    gl.bindVertexArray(this.shardVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.shardCount);
    gl.bindVertexArray(this.vao);
  }

  private drawEmbers(age: number, px: number, py: number): void {
    const gl = this.gl;
    const p = this.programs.ember;
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res ?? null, this.cw, this.ch);
    gl.uniform2f(p.u.u_P ?? null, px, py);
    gl.uniform1f(p.u.u_age ?? null, age);
    gl.uniform1f(p.u.u_sc ?? null, this.ch / 1080);
    gl.bindVertexArray(this.emberVao);
    gl.drawArrays(gl.POINTS, 0, EMBERS);
    gl.bindVertexArray(this.vao);
  }

  private drawPanels(scene: Scene): void {
    const gl = this.gl;
    const p = this.programs.panel;
    const { dpr } = this;
    this.use(p);
    gl.uniform1i(p.u.u_splash ?? null, 0);
    gl.uniform1i(p.u.u_clip ?? null, 1);
    const vw = this.view;
    for (const s of scene.panels) {
      if (!s.on || s.grow <= 0.001) continue;
      const onPage = s.page > 0.5;
      if (onPage ? !this.page : scene.lineup <= 0.001) continue;
      const slug = s.slug;
      const slot = slotOf(slug);
      let q: Quad;
      if (onPage && this.page) {
        // On the real page: the box of the page's own panel.
        q = this.page.quad;
      } else {
        q = quadOf(slot, vw, scene.shift, this.quad);
        q.y1 += s.drop * vw.u;
      }
      const x0 = q.x0 * dpr;
      const x1 = q.x1 * dpr;
      const x2 = q.x2 * dpr;
      const x3 = q.x3 * dpr;
      const y0 = q.y0 * dpr;
      const y1 = q.y1 * dpr;
      // Off screen: nothing to draw.
      if (x2 + PAD * dpr < 0 || x0 - PAD * dpr > this.cw) continue;
      // The part that is shown: the slit opens from one edge.
      const h = y1 - y0;
      const from = s.top ? y0 : y1 - h * s.grow;
      const to = s.top ? y0 + h * s.grow : y1;
      gl.uniform4f(p.u.u_xs ?? null, x0, x1, x2, x3);
      gl.uniform2f(p.u.u_ys ?? null, y0, y1);
      gl.uniform2f(p.u.u_vis ?? null, from, to);
      const sr = zoomed(splashRect(slot, q), q, s.zoom, s.shy);
      gl.uniform4f(p.u.u_picS ?? null, sr[0] * dpr, sr[1] * dpr, sr[2] * dpr, sr[3] * dpr);
      const info = this.assets.clipInfo[slug] ?? { focus: { x: 0.5, y: 0.4 }, aspect: 20 / 9 };
      const cr = zoomed(clipRect(q, info.focus, info.aspect), q, s.zoom, s.shy);
      gl.uniform4f(p.u.u_picV ?? null, cr[0] * dpr, cr[1] * dpr, cr[2] * dpr, cr[3] * dpr);
      gl.uniform4f(p.u.u_a ?? null, s.mix, s.pale, s.thr, s.inv);
      gl.uniform4f(p.u.u_b ?? null, s.white, s.black, s.glow, s.fringe);
      gl.uniform4f(
        p.u.u_c ?? null,
        s.flare,
        s.alpha * (onPage ? 1 : scene.lineup),
        s.bevel,
        s.seed,
      );
      const hasClip = s.mix < 0.999 && !this.light ? this.feedClip(slug, s.frame) : false;
      gl.uniform4f(p.u.u_d ?? null, 0, hasClip ? 1 : 0, Math.floor(scene.t * 30), dpr);
      gl.uniform4f(p.u.u_e ?? null, s.split, s.stripes, s.bevel * 0.21 * this.cw, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.splash.get(slug) ?? this.blank);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.clip.get(slug) ?? this.blank);
      gl.activeTexture(gl.TEXTURE0);
      const minX = Math.min(x0, x1) - PAD * dpr - s.bevel * 0.21 * this.cw;
      const maxX = Math.max(x2, x3) + PAD * dpr;
      const minY = y0 - PAD * dpr;
      const maxY = y1 + PAD * dpr;
      this.rect(p, minX, minY, maxX - minX, maxY - minY);
    }
  }

  /**
   * Draw a still centred on (`x`, `y`) pixels, `size` times the size it had in the recording (or
   * `absolute` pixels per picture pixel), turned by `rot`. `heat` adds white to it, for a white-hot look.
   */
  private still(
    name: StillName,
    x: number,
    y: number,
    size: number,
    alpha: number,
    rot: number,
    absolute = 0,
    heat = 0,
  ): void {
    const s = this.stills.get(name);
    if (!s || alpha <= 0.001) return;
    const gl = this.gl;
    const p = this.programs.sprite;
    const meta = STILLS[name];
    const k = absolute > 0 ? absolute : (this.ch / meta.refH) * size;
    const w = s.w * k;
    const h = s.h * k;
    this.use(p);
    gl.uniform1i(p.u.u_tex ?? null, 0);
    gl.uniform4f(p.u.u_tint ?? null, 1, 1, 1, alpha);
    gl.uniform4f(p.u.u_hue ?? null, heat, heat, heat, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.uniform1f(p.u.u_rot ?? null, rot);
    gl.uniform2f(p.u.u_pivot ?? null, x, y);
    gl.uniform2f(p.u.u_rectPos ?? null, x - w / 2, y - h / 2);
    gl.uniform2f(p.u.u_rectSize ?? null, w, h);
    // Only the part of the screen the turned picture can reach.
    const reach = Math.hypot(w, h) / 2 + 2;
    this.rect(p, x - reach, y - reach, reach * 2, reach * 2);
  }

  /** Wait for the GPU to finish what was drawn (used once, after the warm up). */
  finish(): void {
    this.gl.finish();
  }

  /** Where the real page puts Obsidia's panel and the slash, in CSS pixels (for the layers over it). */
  setPage(page: PageBoxes | null): void {
    this.page = page;
  }

  dispose(): void {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    for (const t of this.splash.values()) gl.deleteTexture(t);
    for (const t of this.clip.values()) gl.deleteTexture(t);
    for (const s of this.stills.values()) gl.deleteTexture(s.tex);
    gl.deleteTexture(this.blank);
    for (const p of Object.values(this.programs)) gl.deleteProgram(p.prog);
    if (this.cut) gl.deleteTexture(this.cut.tex);
    gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.shardBuf);
    gl.deleteVertexArray(this.shardVao);
    gl.deleteBuffer(this.emberBuf);
    gl.deleteVertexArray(this.emberVao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
