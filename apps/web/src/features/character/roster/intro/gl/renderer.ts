import type { Slug } from "@/content/types";

import { clipRect, type Quad, quadOf, slotOf, splashRect, type View } from "../geometry";
import { BEAM, type BeamKind, PANEL_SLUGS, type Scene } from "../timeline";
import { type StillName, STILLS } from "../stills";
import { FLAT, GROUND, PANEL, SPRITE, THIN, VEIL, VERT, WEDGE } from "./shaders";

/** A picture the renderer can take as a texture. */
export type Source = ImageBitmap | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface Assets {
  splash: Partial<Record<Slug, Source>>;
  /** The welcome clips, played by the caller. Absent on `lite`. */
  clips: Partial<Record<Slug, HTMLVideoElement>>;
  stills: Partial<Record<StillName, Source>>;
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
  "u_thin",
  "u_thin2",
  "u_thin3",
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

/** The still each kind of beam draws. */
const BEAM_STILLS: Record<BeamKind, StillName | null> = {
  [BEAM.none]: null,
  [BEAM.pink]: "beam-pink",
  [BEAM.hold]: "beam-hold",
  [BEAM.blue]: "beam-blue",
};

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

/**
 * The intro's renderer: one WebGL2 canvas, a handful of small programs, one unit quad. It owns the
 * textures. It allocates nothing per frame.
 */
export class IntroRenderer {
  readonly gl: WebGL2RenderingContext;
  private programs: Record<
    "ground" | "flat" | "wedge" | "thin" | "panel" | "sprite" | "veil",
    Program
  >;
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
      thin: this.program(THIN),
      veil: this.program(VEIL),
      panel: this.program(PANEL),
      sprite: this.program(SPRITE),
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

    this.blank = this.texture(null);
    for (const slug of PANEL_SLUGS) {
      const src = assets.splash[slug];
      this.splash.set(slug, src ? this.texture(src, true) : this.blank);
      if (assets.clips[slug]) this.clip.set(slug, this.texture(null));
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

  private program(frag: string): Program {
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
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
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

    // The panels.
    this.drawPanels(scene);

    // A pale wash over the lineup, one frame before the held beam.
    if (scene.wash > 0) {
      this.use(pr.flat);
      const a = scene.wash;
      gl.uniform4f(pr.flat.u.u_color ?? null, 1 * a, 0.78 * a, 0.86 * a, a);
      this.full(pr.flat);
    }

    // The veil over Obsidia's panel (it lies on the page, under the beam).
    this.drawVeil(scene);

    // The speed lines come first, under the beam.
    if (scene.speed.on) {
      this.still(
        "speed-lines",
        scene.speed.x * cw,
        scene.speed.y * ch,
        0.8 * scene.speed.size,
        1,
        scene.speed.rot,
      );
    }

    // The beam, and the thin line that follows it.
    const bm = scene.beam;
    const bs = bm.kind !== 0 ? BEAM_STILLS[bm.kind] : null;
    if (bs) this.still(bs, bm.x * cw, bm.y * ch, bm.size, bm.alpha, 0);
    this.drawOverlays(scene);
    if (this.debug) {
      const err = gl.getError();
      if (err !== gl.NO_ERROR) console.warn(`[roster intro] GL error ${err} at t=${scene.t}`);
    }
  }

  private drawPanels(scene: Scene): void {
    if (scene.lineup <= 0.001) return;
    const gl = this.gl;
    const p = this.programs.panel;
    const { dpr } = this;
    this.use(p);
    gl.uniform1i(p.u.u_splash ?? null, 0);
    gl.uniform1i(p.u.u_clip ?? null, 1);
    const vw = this.view;
    for (const s of scene.panels) {
      if (!s.on || s.grow <= 0.001) continue;
      const slug = s.slug;
      const slot = slotOf(slug);
      const q = quadOf(slot, vw, scene.shift, this.quad);
      q.y1 += s.drop * vw.u;
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
      gl.uniform4f(p.u.u_c ?? null, s.flare, s.alpha * scene.lineup, s.bevel, s.seed);
      const hasClip = s.mix < 0.999 && !this.light ? this.feedClip(slug, s.frame) : false;
      gl.uniform4f(p.u.u_d ?? null, scene.lineart, hasClip ? 1 : 0, Math.floor(scene.t * 30), dpr);
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
   * Draw a still with its point (`tip`) at (`x`, `y`) pixels, `size` times the size it had in the
   * recording, turned by `rot`. A still cut at the edge of the frame is made big enough to still
   * reach that edge on a wider screen.
   */
  private still(
    name: StillName,
    x: number,
    y: number,
    size: number,
    alpha: number,
    rot: number,
    absolute = 0,
  ): void {
    const s = this.stills.get(name);
    if (!s || alpha <= 0.001) return;
    const gl = this.gl;
    const p = this.programs.sprite;
    const meta = STILLS[name];
    let k = absolute > 0 ? absolute : (this.ch / meta.refH) * size;
    if (meta.reach) {
      const need = Math.max(
        meta.tip.u > 0.5 ? x / (meta.tip.u * s.w) : 0,
        meta.tip.u < 0.5 ? (this.cw - x) / ((1 - meta.tip.u) * s.w) : 0,
      );
      k = Math.max(k, need * 1.01);
    }
    const w = s.w * k;
    const h = s.h * k;
    this.use(p);
    gl.uniform1i(p.u.u_tex ?? null, 0);
    gl.uniform4f(p.u.u_tint ?? null, 1, 1, 1, alpha);
    gl.uniform4f(p.u.u_hue ?? null, 0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.uniform1f(p.u.u_rot ?? null, rot);
    gl.uniform2f(p.u.u_pivot ?? null, x, y);
    gl.uniform2f(p.u.u_rectPos ?? null, x - meta.tip.u * w, y - meta.tip.v * h);
    gl.uniform2f(p.u.u_rectSize ?? null, w, h);
    // Only the part of the screen the turned picture can reach.
    const rx = x - meta.tip.u * w;
    const ry = y - meta.tip.v * h;
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = rx + (i & 1 ? w : 0) - x;
      const dy = ry + (i & 2 ? h : 0) - y;
      const px = x + c * dx - sn * dy;
      const py = y + sn * dx + c * dy;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
    }
    this.rect(p, x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  }

  private drawVeil(scene: Scene): void {
    const page = this.page;
    const { dpr } = this;
    const gl = this.gl;
    if (scene.veil > 0.001 && page) {
      const p = this.programs.veil;
      const q = page.quad;
      this.use(p);
      gl.uniform4f(p.u.u_xs ?? null, q.x0 * dpr, q.x1 * dpr, q.x2 * dpr, q.x3 * dpr);
      gl.uniform2f(p.u.u_ys ?? null, q.y0 * dpr, q.y1 * dpr);
      gl.uniform4f(p.u.u_color ?? null, 0.5, 0.07, 0.17, scene.veil);
      const x0 = Math.min(q.x0, q.x1) * dpr;
      const x1 = Math.max(q.x2, q.x3) * dpr;
      this.rect(p, x0 - 2, q.y0 * dpr - 2, x1 - x0 + 4, (q.y1 - q.y0) * dpr + 4);
    }
  }

  /** The things that run over the page after the flash: the slash, the thin line, the fire, the arcs. */
  private drawOverlays(scene: Scene): void {
    const { cw, ch, dpr } = this;
    const gl = this.gl;
    const page = this.page;
    if (scene.slash > 0 && page) {
      const c = page.slash;
      this.still("energy-slash", c.x * dpr, c.y * dpr, 1, scene.slash, 0, (c.height * dpr) / 2048);
    }
    if (scene.thin.on) {
      const p = this.programs.thin;
      this.use(p);
      const th = scene.thin;
      gl.uniform4f(p.u.u_thin ?? null, th.x * cw, th.y * ch, th.base * ch, 34 * (ch / 1080));
      gl.uniform2f(p.u.u_thin2 ?? null, th.phase, th.alpha);
      gl.uniform1f(p.u.u_thin3 ?? null, dpr);
      const top = Math.min(th.base, th.y) * ch - 90 * dpr;
      this.rect(p, 0, top, th.x * cw * 1.03, Math.abs(th.base - th.y) * ch + 180 * dpr);
    }
    if (scene.fire.on && page) {
      const f = scene.fire;
      const o = page.obsidia;
      const unit = (o.h * dpr) / 895;
      // Alive: a little bigger and smaller, turned a little, moved a little, at 20 steps a second.
      const n = f.frame;
      const wob = 1 + 0.06 * Math.sin(n * 2.1) + 0.04 * Math.sin(n * 0.7);
      this.still(
        "fire",
        (o.x + o.w * (0.4 + 0.02 * Math.sin(n * 1.3))) * dpr,
        (o.y + o.h * (0.58 + 0.015 * Math.cos(n * 1.7))) * dpr,
        1,
        f.alpha,
        0.06 * Math.sin(n * 1.9),
        unit * 1.15 * wob,
      );
    }
    if (scene.arcs > 0 && page) {
      const o = page.obsidia;
      const unit = (o.h * dpr) / 895;
      this.still("ring-arcs", 0, (o.y + o.h * 0.04) * dpr, 1, scene.arcs, 0, unit * 1.1);
    }
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
    gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
