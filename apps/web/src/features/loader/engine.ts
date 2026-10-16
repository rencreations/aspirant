import { wordShare } from "./budget";
import { COLORS, FINE_STEP } from "./constants";
import { formAmount } from "./progress";
import { createRng } from "./random";
import type { SampledPoints } from "./textMask";

const VERT = `
precision highp float;
attribute vec4 aDyn;
attribute vec3 aCol;
attribute vec4 aMeta;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uTilt;
uniform float uFocal;
uniform vec4 uLight;
uniform vec3 uSheen;
uniform float uDot;
uniform float uForm;
uniform float uFlash;
uniform float uMaxPoint;
varying vec3 vCol;
varying float vAlpha;
varying float vGlyph;
varying float vSolid;
varying float vAdd;
varying float vCrisp;

const vec3 FIELD = vec3(${COLORS.field.join(", ")});
const vec3 WHITE = vec3(1.0, 0.97, 0.92);

void main() {
  float flags = aMeta.w;
  float fine = step(7.5, flags);
  flags -= fine * 8.0;
  float spark = step(3.5, flags);
  float rest = flags - spark * 4.0;
  float edge = step(1.5, rest);
  float word = rest - edge * 2.0;
  float f = aDyn.w * word;
  float seed = aMeta.x;
  float sz = aMeta.y;

  vec3 p = vec3(aDyn.xy - uCenter, aMeta.z * mix(1.0, 0.4, f));
  float cy = cos(uTilt.y);
  float sy = sin(uTilt.y);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float cx = cos(uTilt.x);
  float sx = sin(uTilt.x);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  float persp = uFocal / max(uFocal - p.z, 1.0);
  vec2 screen = uCenter + p.xy * persp;
  vec2 clip = screen / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

  float twinkle = 0.5 + 0.5 * sin(uTime * (1.3 + sz * 2.4) + seed * 61.0);
  float fieldSize = mix(7.0, 15.0, sz) * mix(1.0, 0.7, uForm * (1.0 - word));
  float wordSize = uDot * mix(0.95, 1.12, sz) * mix(1.0, 0.86, edge) * mix(1.0, ${FINE_STEP.toFixed(3)}, fine);
  float size = mix(fieldSize, wordSize, f);
  size = mix(size, mix(7.0, 14.0, sz) * (0.5 + 0.5 * twinkle) * mix(1.0, 0.55, word), spark);
  float px = clamp(size * persp * uDpr, 1.0, uMaxPoint);
  gl_PointSize = px;

  float roll = floor(uTime * (1.2 + sz * 4.0) + seed * 97.0);
  vGlyph = mix(mod(floor(seed * 16.0 + roll * 7.0), 16.0), 16.0, spark);
  vSolid = (1.0 - spark) * clamp(f * 1.4 + smoothstep(11.0, 5.0, px), 0.0, 1.0);
  vCrisp = f;

  float shimmer = 0.8 + 0.2 * sin(uTime * (0.8 + sz * 1.6) + seed * 40.0);
  vec3 base = mix(FIELD * (0.5 + 0.5 * sz), aCol * (1.0 + 0.3 * edge * f), max(f, spark));
  float dl = distance(screen, uLight.xy);
  float spot = exp(-dl * dl / (2.0 * uLight.w * uLight.w)) * uLight.z;
  float band = screen.x + screen.y * 0.45 - uSheen.x;
  float sheen = exp(-band * band / (2.0 * uSheen.z * uSheen.z)) * uSheen.y;
  float energy = aDyn.z;
  float glow = spot * 0.55 + sheen * 0.9 + energy * 0.8 + uFlash * 1.5;
  vCol = base * (shimmer + glow * 0.85) + WHITE * glow * (0.1 + 0.16 * f);

  float fieldAlpha = mix(0.22, 0.7, sz) * (1.0 - 0.55 * uForm * (1.0 - word));
  vAlpha = mix(fieldAlpha, mix(0.8, 1.0, edge), f);
  vAlpha = mix(vAlpha, 0.35 + 0.65 * twinkle, spark);
  vAdd = mix(0.92, 0.3, f);
}
`;

const FRAG = `
precision mediump float;
uniform sampler2D uAtlas;
varying vec3 vCol;
varying float vAlpha;
varying float vGlyph;
varying float vSolid;
varying float vAdd;
varying float vCrisp;

void main() {
  vec2 pc = gl_PointCoord;
  vec2 cell = vec2(mod(vGlyph, 8.0), floor(vGlyph / 8.0));
  float glyph = texture2D(uAtlas, (cell + pc) / vec2(8.0, 4.0)).a;
  float r = length(pc - 0.5) * 2.0;
  float dotA = 1.0 - smoothstep(mix(0.35, 0.7, vCrisp), 1.0, r);
  float a = mix(glyph, dotA, vSolid) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol * a, a * (1.0 - vAdd));
}
`;

const UNIFORMS = [
  "uRes",
  "uDpr",
  "uTime",
  "uCenter",
  "uTilt",
  "uFocal",
  "uLight",
  "uSheen",
  "uDot",
  "uForm",
  "uFlash",
  "uMaxPoint",
  "uAtlas",
] as const;
type UniformName = (typeof UNIFORMS)[number];

const FLAG_WORD = 1;
const FLAG_EDGE = 2;
const FLAG_SPARK = 4;
const FLAG_FINE = 8;

const ATLAS_CELL = 64;
const STAR_CELL = 16;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ripple {
  x: number;
  y: number;
  born: number;
  strength: number;
}

export interface EngineOptions {
  count: number;
  width: number;
  height: number;
  dpr: number;
  /** Called once if the GPU drops the context; the caller should switch to the static title. */
  onLost: () => void;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pinch: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + pinch, cy - pinch, cx + r, cy);
  ctx.quadraticCurveTo(cx + pinch, cy + pinch, cx, cy + r);
  ctx.quadraticCurveTo(cx - pinch, cy + pinch, cx - r, cy);
  ctx.quadraticCurveTo(cx - pinch, cy - pinch, cx, cy - r);
  ctx.fill();
}

/** 8 by 4 cells: hex digits 0 to F, then the four-pointed star. Only alpha is used. */
function buildAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL * 8;
  canvas.height = ATLAS_CELL * 4;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("atlas");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${ATLAS_CELL * 0.7}px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
  const glyphs = "0123456789ABCDEF";
  for (let i = 0; i < glyphs.length; i++) {
    const cx = (i % 8) * ATLAS_CELL + ATLAS_CELL / 2;
    const cy = Math.floor(i / 8) * ATLAS_CELL + ATLAS_CELL / 2 + 2;
    ctx.fillText(glyphs.charAt(i), cx, cy);
  }
  const sx = (STAR_CELL % 8) * ATLAS_CELL + ATLAS_CELL / 2;
  const sy = Math.floor(STAR_CELL / 8) * ATLAS_CELL + ATLAS_CELL / 2;
  drawStar(ctx, sx, sy, ATLAS_CELL * 0.46, ATLAS_CELL * 0.07);
  return canvas;
}

function gradient(u: number, out: Float32Array, o: number) {
  const { cyan, ice, gold } = COLORS;
  const a = u < 0.5 ? cyan : ice;
  const b = u < 0.5 ? ice : gold;
  const t = smooth(u < 0.5 ? u * 2 : (u - 0.5) * 2);
  out[o] = a[0] + (b[0] - a[0]) * t;
  out[o + 1] = a[1] + (b[1] - a[1]) * t;
  out[o + 2] = a[2] + (b[2] - a[2]) * t;
}

/**
 * The particle title. Plain WebGL points (one draw call) with physics on the CPU in typed
 * arrays. No React state is touched from the frame loop.
 */
export class ParticleEngine {
  private readonly gl: WebGLRenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly program: WebGLProgram;
  private readonly buffers: WebGLBuffer[];
  private readonly dynBuf: WebGLBuffer;
  private readonly colBuf: WebGLBuffer;
  private readonly metaBuf: WebGLBuffer;
  private readonly atlas: WebGLTexture;
  private readonly u: Record<UniformName, WebGLUniformLocation | null>;
  private readonly maxPoint: number;
  private readonly onLost: () => void;

  private readonly n: number;
  private readonly wordN: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly hx: Float32Array;
  private readonly hy: Float32Array;
  private readonly fi: Float32Array;
  private readonly delay: Float32Array;
  private readonly spring: Float32Array;
  private readonly rnd: Float32Array;
  private readonly starX: Float32Array;
  private readonly starY: Float32Array;
  private readonly dyn: Float32Array;
  private readonly col: Float32Array;
  private readonly meta: Float32Array;
  private readonly spark: Uint8Array;

  private width: number;
  private height: number;
  private dpr: number;
  private box: Box;
  private hasHome = false;
  private dot = 3;

  private progress = 0;
  private interactive = false;
  private exiting = false;
  private exitAt = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  private pointerX = 0;
  private pointerY = 0;
  private pointerVX = 0;
  private pointerVY = 0;
  private pointerActive = false;
  private pointerTouch = false;
  private lastMoveAt = -10;
  private down = false;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private dragged = false;
  private gather = 0;

  private ripples: Ripple[] = [];
  private nextIdleRipple = 0;
  private tiltX = 0;
  private tiltY = 0;
  private lightX = 0;
  private lightY = 0;
  private lightAmt = 0;
  private sheenPos = -1e4;
  private sheenAmt = 0;
  private sweepStart = -10;
  private nextSweep = 0;

  static create(canvas: HTMLCanvasElement, options: EngineOptions): ParticleEngine | null {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl || gl.isContextLost()) return null;
    try {
      return new ParticleEngine(canvas, gl, options);
    } catch {
      return null;
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    { count, width, height, dpr, onLost }: EngineOptions,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.onLost = onLost;
    this.n = Math.max(1, Math.floor(count));
    this.wordN = Math.floor(this.n * wordShare(this.n));
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.box = { x: width * 0.1, y: height * 0.35, w: width * 0.8, h: height * 0.25 };

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      throw new Error("link");
    }
    this.program = program;
    const u = {} as Record<UniformName, WebGLUniformLocation | null>;
    for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
    this.u = u;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    this.maxPoint = Math.max(8, range?.[1] ?? 64);

    const n = this.n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.hx = new Float32Array(n);
    this.hy = new Float32Array(n);
    this.fi = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.spring = new Float32Array(n);
    this.rnd = new Float32Array(n);
    this.starX = new Float32Array(n);
    this.starY = new Float32Array(n);
    this.dyn = new Float32Array(n * 4);
    this.col = new Float32Array(n * 3);
    this.meta = new Float32Array(n * 4);
    this.spark = new Uint8Array(n);

    const rng = createRng(0x5e1c);
    for (let i = 0; i < n; i++) {
      const isWord = i < this.wordN;
      this.px[i] = rng() * width;
      this.py[i] = rng() * height;
      this.vx[i] = (rng() - 0.5) * 30;
      this.vy[i] = (rng() - 0.5) * 30;
      this.rnd[i] = rng();
      this.spring[i] = 0.75 + rng() * 0.5;
      this.delay[i] = rng();
      // A point inside a four-pointed star (superellipse with exponent 0.5), weighted to the rim.
      const theta = rng() * Math.PI * 2;
      const c = Math.abs(Math.cos(theta));
      const s = Math.abs(Math.sin(theta));
      const rim = 1 / (Math.sqrt(c) + Math.sqrt(s)) ** 2;
      const r = rim * (rng() < 0.45 ? 0.9 + rng() * 0.1 : Math.sqrt(rng()));
      this.starX[i] = Math.cos(theta) * r;
      this.starY[i] = Math.sin(theta) * r * 1.2;
      const spark = rng() < (isWord ? 0.01 : 0.06);
      this.spark[i] = spark ? 1 : 0;
      const m = i * 4;
      this.meta[m] = rng();
      this.meta[m + 1] = rng() ** 1.6;
      this.meta[m + 2] = isWord ? (rng() - 0.5) * 40 : (rng() - 0.5) * 700;
      this.meta[m + 3] = (isWord ? FLAG_WORD : 0) + (spark ? FLAG_SPARK : 0);
      const sparkColor = rng() < 0.5 ? COLORS.amber : COLORS.violet;
      const base = spark ? sparkColor : COLORS.cyan;
      this.col[i * 3] = base[0];
      this.col[i * 3 + 1] = base[1];
      this.col[i * 3 + 2] = base[2];
    }

    const make = () => {
      const b = gl.createBuffer();
      if (!b) throw new Error("buffer");
      return b;
    };
    this.dynBuf = make();
    this.colBuf = make();
    this.metaBuf = make();
    this.buffers = [this.dynBuf, this.colBuf, this.metaBuf];
    gl.useProgram(program);
    this.bindAttribute(this.dynBuf, "aDyn", 4, this.dyn, gl.DYNAMIC_DRAW);
    this.bindAttribute(this.colBuf, "aCol", 3, this.col, gl.STATIC_DRAW);
    this.bindAttribute(this.metaBuf, "aMeta", 4, this.meta, gl.STATIC_DRAW);

    const tex = gl.createTexture();
    if (!tex) throw new Error("texture");
    this.atlas = tex;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(u.uAtlas, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.02, 0.024, 0.04, 1);

    this.resize(width, height, dpr);
    canvas.addEventListener("webglcontextlost", this.handleLost);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private bindAttribute(
    buffer: WebGLBuffer,
    name: string,
    size: number,
    data: Float32Array,
    usage: number,
  ) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(this.program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
  }

  /** Particles that build the wordmark; the mask is sampled to exactly this many points. */
  get wordCount() {
    return this.wordN;
  }

  private readonly handleLost = (event: Event) => {
    event.preventDefault();
    this.stop();
    this.onLost();
  };

  private readonly handleVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const gl = this.gl;
    if (gl.isContextLost()) return;
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteTexture(this.atlas);
    gl.deleteProgram(this.program);
  }

  resize(width: number, height: number, dpr: number) {
    const sx = this.width > 0 ? width / this.width : 1;
    const sy = this.height > 0 ? height / this.height : 1;
    for (let i = 0; i < this.n; i++) {
      if ((this.fi[i] ?? 0) < 0.5) {
        this.px[i] = (this.px[i] ?? 0) * sx;
        this.py[i] = (this.py[i] ?? 0) * sy;
      }
    }
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * New targets for the wordmark. `points` are in mask pixels for a box at `box` (CSS
   * pixels, relative to the canvas), drawn at `scale` mask pixels per CSS pixel.
   */
  setWordmark(points: SampledPoints, box: Box, scale: number) {
    if (points.count === 0) return;
    const rng = createRng(0xa5);
    this.box = box;
    this.dot = clamp((points.spacing / scale) * 1.2, 1.6, 9);
    const count = Math.min(this.wordN, points.count);
    for (let i = 0; i < this.wordN; i++) {
      const src = i < count ? i : Math.floor(rng() * count);
      const x = box.x + (points.xy[src * 2] ?? 0) / scale;
      const y = box.y + (points.xy[src * 2 + 1] ?? 0) / scale;
      this.hx[i] = x;
      this.hy[i] = y;
      const u = clamp((x - box.x) / Math.max(1, box.w), 0, 1);
      this.delay[i] = 0.6 * u + 0.4 * (this.rnd[i] ?? 0);
      const m = i * 4 + 3;
      const spark = this.spark[i] === 1;
      this.meta[m] =
        FLAG_WORD +
        (points.edge[src] === 1 ? FLAG_EDGE : 0) +
        (spark ? FLAG_SPARK : 0) +
        (points.fine[src] === 1 ? FLAG_FINE : 0);
      if (!spark) gradient(u, this.col, i * 3);
    }
    this.hasHome = true;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.col);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.metaBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.meta);
    if (this.lightAmt === 0) {
      this.lightX = box.x + box.w / 2;
      this.lightY = box.y + box.h / 2;
    }
  }

  setProgress(p: number) {
    this.progress = clamp(p, 0, 1);
  }

  /** Marks the title as formed: interaction gets full strength and a glint crosses the letters. */
  setInteractive() {
    if (this.interactive) return;
    this.interactive = true;
    this.sweepStart = this.time;
    this.nextSweep = this.time + 7;
    this.nextIdleRipple = this.time + 5;
  }

  pointerMove(x: number, y: number, touch: boolean) {
    const now = this.time;
    const dt = Math.max(0.008, now - this.lastMoveAt);
    if (this.pointerActive && dt < 0.25) {
      this.pointerVX += ((x - this.pointerX) / dt - this.pointerVX) * 0.5;
      this.pointerVY += ((y - this.pointerY) / dt - this.pointerVY) * 0.5;
    }
    this.pointerX = x;
    this.pointerY = y;
    this.pointerTouch = touch;
    this.pointerActive = !touch || this.down;
    this.lastMoveAt = now;
    if (this.down && Math.hypot(x - this.downX, y - this.downY) > 10) this.dragged = true;
  }

  pointerDown(x: number, y: number, touch: boolean) {
    this.down = true;
    this.dragged = false;
    this.downAt = this.time;
    this.downX = x;
    this.downY = y;
    this.pointerMove(x, y, touch);
  }

  pointerUp(x: number, y: number) {
    if (!this.down) return;
    this.down = false;
    const held = this.time - this.downAt;
    if (this.gather > 0.05) this.release(x, y);
    else if (!this.dragged && held < 0.3) this.ripple(x, y, 1);
    this.gather = 0;
    if (this.pointerTouch) this.pointerActive = false;
  }

  pointerLeave() {
    this.pointerActive = false;
    if (this.down) {
      this.down = false;
      if (this.gather > 0.05) this.release(this.pointerX, this.pointerY);
      this.gather = 0;
    }
  }

  private ripple(x: number, y: number, strength: number) {
    if (this.ripples.length > 4) this.ripples.shift();
    this.ripples.push({ x, y, born: this.time, strength });
  }

  private release(x: number, y: number) {
    const g = this.gather;
    for (let i = 0; i < this.wordN; i++) {
      const dx = (this.px[i] ?? 0) - x;
      const dy = (this.py[i] ?? 0) - y;
      const d = Math.hypot(dx, dy) + 0.001;
      const speed = (500 + 900 * (this.rnd[i] ?? 0)) * g;
      this.vx[i] = (this.vx[i] ?? 0) + (dx / d) * speed;
      this.vy[i] = (this.vy[i] ?? 0) + (dy / d) * speed;
    }
    this.ripple(x, y, 1.3 * g);
  }

  /** The exit: every particle flies outward from the title and brightens. */
  burst() {
    if (this.exiting) return;
    this.exiting = true;
    this.exitAt = this.time;
    const cx = this.box.x + this.box.w / 2;
    const cy = this.box.y + this.box.h / 2;
    const rng = createRng(0xb0057);
    for (let i = 0; i < this.n; i++) {
      const dx = (this.px[i] ?? 0) - cx;
      const dy = (this.py[i] ?? 0) - cy;
      const d = Math.hypot(dx, dy) + 0.001;
      const speed = 700 + 1900 * rng() ** 2;
      this.vx[i] = (this.vx[i] ?? 0) + (dx / d) * speed + (rng() - 0.5) * 260;
      this.vy[i] = (this.vy[i] ?? 0) + (dy / d) * speed + (rng() - 0.5) * 260;
    }
  }

  private readonly frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = clamp((now - this.last) / 1000, 0.001, 1 / 20);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
  };

  private update(dt: number) {
    const t = this.time;
    const form = this.exiting ? 1 : formAmount(this.progress);
    const box = this.box;
    const bcx = box.x + box.w / 2;
    const bcy = box.y + box.h / 2;
    const W = this.width;
    const H = this.height;

    // Pointer state, tilt, light and sheen.
    const idle = !this.pointerActive || t - this.lastMoveAt > 2.5;
    this.pointerVX *= Math.exp(-dt * 6);
    this.pointerVY *= Math.exp(-dt * 6);
    let tiltX: number;
    let tiltY: number;
    if (idle) {
      tiltX = Math.sin(t * 0.31) * 0.05;
      tiltY = Math.sin(t * 0.23) * 0.08;
    } else {
      tiltX = -(this.pointerY / H - 0.5) * 0.34;
      tiltY = (this.pointerX / W - 0.5) * 0.44;
    }
    const tiltWeight = this.exiting ? 0 : form;
    this.tiltX += (tiltX * tiltWeight - this.tiltX) * ease(dt, 4);
    this.tiltY += (tiltY * tiltWeight - this.tiltY) * ease(dt, 4);

    const lightTX = idle ? bcx + Math.sin(t * 0.42) * box.w * 0.42 : this.pointerX;
    const lightTY = idle ? bcy + Math.sin(t * 0.73) * box.h * 0.35 : this.pointerY;
    this.lightX += (lightTX - this.lightX) * ease(dt, idle ? 1.5 : 9);
    this.lightY += (lightTY - this.lightY) * ease(dt, idle ? 1.5 : 9);
    const lightTarget = this.interactive ? (idle ? 0.55 : 1) : form * 0.4;
    this.lightAmt += (lightTarget - this.lightAmt) * ease(dt, 3);

    const sMin = box.x + box.y * 0.45 - box.h;
    const sMax = box.x + box.w + (box.y + box.h) * 0.45 + box.h;
    if (this.interactive && idle && t > this.nextSweep) {
      this.sweepStart = t;
      this.nextSweep = t + 7 + this.rnd[0]! * 3;
    }
    const sweep = (t - this.sweepStart) / 1.4;
    if (sweep >= 0 && sweep <= 1) {
      this.sheenPos = sMin + (sMax - sMin) * smooth(sweep);
      this.sheenAmt = Math.sin(sweep * Math.PI);
    } else if (!idle && this.interactive) {
      this.sheenPos += (this.pointerX + this.pointerY * 0.45 - this.sheenPos) * ease(dt, 5);
      this.sheenAmt += (0.55 - this.sheenAmt) * ease(dt, 3);
    } else {
      this.sheenAmt += (0 - this.sheenAmt) * ease(dt, 2);
    }

    // Hold to gather.
    if (this.down && !this.dragged && this.interactive && t - this.downAt > 0.22) {
      this.gather = Math.min(1, this.gather + dt / 0.9);
    }
    const gather = this.gather;
    const gatherR = clamp(box.h * 0.5, 48, 210) * (1 + 0.05 * Math.sin(t * 9));
    const rot = t * 0.8;
    const rc = Math.cos(rot);
    const rs = Math.sin(rot);

    // Idle ripples keep the title breathing.
    if (this.interactive && idle && t > this.nextIdleRipple && this.hasHome) {
      const k = Math.floor((this.rnd[(Math.floor(t * 13) % this.n) | 0] ?? 0) * this.wordN);
      this.ripple(this.hx[k] ?? bcx, this.hy[k] ?? bcy, 0.45);
      this.nextIdleRipple = t + 6 + ((t * 7.3) % 4);
    }
    this.ripples = this.ripples.filter((r) => (t - r.born) * 760 < Math.max(W, H) * 1.2);

    const R = clamp(box.h * 0.42, 60, 200);
    const R2 = R * R;
    const pointerOn = this.pointerActive && !this.exiting;
    const pX = this.pointerX;
    const pY = this.pointerY;
    const pVX = this.pointerVX;
    const pVY = this.pointerVY;
    // While gathering, the pointer holds the star instead of pushing particles away.
    const calm = 1 - gather;
    const repel = (this.interactive ? 4200 : 2600) * calm;
    const swirl = (this.interactive ? 2400 : 1600) * calm;
    const drag = 3.2 * calm;
    const breath = 1 + Math.sin(t * 0.55) * 0.006;
    const exiting = this.exiting;
    const hasHome = this.hasHome;
    const wordN = this.wordN;
    const ripples = this.ripples;
    const rippleWidth = clamp(box.h * 0.22, 40, 90);
    const { px, py, vx, vy, hx, hy, fi, delay, spring, rnd, starX, starY, dyn } = this;

    for (let i = 0; i < this.n; i++) {
      let x = px[i]!;
      let y = py[i]!;
      let ux = vx[i]!;
      let uy = vy[i]!;
      let ax = 0;
      let ay = 0;
      let f = fi[i]!;
      const r = rnd[i]!;

      if (exiting) {
        ax -= ux * 0.6;
        ay -= uy * 0.6;
      } else {
        if (i < wordN && hasHome) {
          const k = clamp((form - 0.5 * delay[i]!) / 0.5, 0, 1);
          f = k * k * (3 - 2 * k);
        }
        if (f < 0.999) {
          const flowX =
            Math.sin(y * 0.0042 + t * 0.35 + r * 6.28) + 0.5 * Math.sin(x * 0.0021 - t * 0.2);
          const flowY = Math.cos(x * 0.0037 - t * 0.3 + r * 6.28) * 0.8 - 0.4;
          const speed = 30 + r * 46;
          const steer = 1.6 * (1 - f);
          ax += (flowX * speed - ux) * steer;
          ay += (flowY * speed - uy) * steer;
        }
        if (f > 0) {
          let tx = bcx + (hx[i]! - bcx) * breath;
          let ty = bcy + (hy[i]! - bcy) * breath + Math.sin(t * 1.1 + hx[i]! * 0.012) * 0.6;
          if (gather > 0) {
            const g = clamp(gather * 1.5 - delay[i]! * 0.5, 0, 1);
            const sx = starX[i]!;
            const sy = starY[i]!;
            tx += (pX + (sx * rc - sy * rs) * gatherR - tx) * g;
            ty += (pY + (sx * rs + sy * rc) * gatherR - ty) * g;
          }
          const k = 95 * spring[i]! * f;
          ax += (tx - x) * k - ux * (2 + 8 * f);
          ay += (ty - y) * k - uy * (2 + 8 * f);
        }
      }

      if (pointerOn) {
        const dx = x - pX;
        const dy = y - pY;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 0.001;
          const fall = 1 - d / R;
          const f2 = fall * fall;
          ax += ((dx / d) * repel - (dy / d) * swirl) * f2 + pVX * drag * fall;
          ay += ((dy / d) * repel + (dx / d) * swirl) * f2 + pVY * drag * fall;
        }
      }

      for (const rp of ripples) {
        const dx = x - rp.x;
        const dy = y - rp.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const age = t - rp.born;
        const diff = Math.abs(d - age * 760);
        if (diff < rippleWidth) {
          const push = (1 - diff / rippleWidth) * 5200 * rp.strength * Math.max(0, 1 - age / 1.6);
          ax += (dx / d) * push;
          ay += (dy / d) * push;
        }
      }

      ux += ax * dt;
      uy += ay * dt;
      x += ux * dt;
      y += uy * dt;
      if (f < 0.02 && !exiting) {
        if (x < -40) x += W + 80;
        else if (x > W + 40) x -= W + 80;
        if (y < -40) y += H + 80;
        else if (y > H + 40) y -= H + 80;
      }
      px[i] = x;
      py[i] = y;
      vx[i] = ux;
      vy[i] = uy;
      fi[i] = f;
      const o = i * 4;
      dyn[o] = x;
      dyn[o + 1] = y;
      dyn[o + 2] = Math.min(1, Math.sqrt(ux * ux + uy * uy) / 900);
      dyn[o + 3] = f;
    }
  }

  private draw() {
    const gl = this.gl;
    const u = this.u;
    const box = this.box;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dyn);
    gl.uniform2f(u.uRes, this.width, this.height);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform2f(u.uCenter, box.x + box.w / 2, box.y + box.h / 2);
    gl.uniform2f(u.uTilt, this.tiltX, this.tiltY);
    gl.uniform1f(u.uFocal, Math.max(1200, box.w * 1.5));
    gl.uniform4f(u.uLight, this.lightX, this.lightY, this.lightAmt, clamp(box.h * 0.4, 70, 220));
    gl.uniform3f(u.uSheen, this.sheenPos, this.sheenAmt, clamp(box.h * 0.16, 24, 80));
    gl.uniform1f(u.uDot, this.dot);
    gl.uniform1f(u.uForm, this.exiting ? 1 : formAmount(this.progress));
    gl.uniform1f(u.uFlash, this.exiting ? clamp((this.time - this.exitAt) / 0.45, 0, 1) : 0);
    gl.uniform1f(u.uMaxPoint, this.maxPoint);
    gl.drawArrays(gl.POINTS, 0, this.n);
  }
}
