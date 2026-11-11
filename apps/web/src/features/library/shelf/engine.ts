import {
  BoxGeometry,
  CanvasTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
} from "three";

import {
  COVER_COUNT,
  ENTRANCE_MS,
  SPLIT_CLOSE_MS,
  SPLIT_OPEN_MS,
  SPLIT_RELEASE,
  clamp,
  clampStack,
  damp,
  dragToStack,
  dropState,
  easeInOutCubic,
  flapShade,
  focusPose,
  focusRoom,
  frontIndex,
  gatefoldDepth,
  hoverPose,
  isPhone,
  lerpPose,
  noObstacles,
  restPose,
  shelfGeometry,
  snapStack,
  splitFrame,
  splitGeometry,
  stackGeometry,
  stackPose,
  type FocusRoom,
  type Obstacles,
  type Pose,
  type ShelfGeometry,
  type SplitGeometry,
  type StackGeometry,
} from "./layout";

/** A cover as the scene needs it: the canvas the picture and the text were drawn on. */
export interface CoverInput {
  canvas: HTMLCanvasElement;
}

/** The cover that opens in two (Video): a gatefold of two panels. */
export interface SplitInput {
  /** Index of the cover on the shelf. */
  index: number;
  /** The two inside pictures, Films (inside of the front panel) then Others (face of the back panel). */
  halves: [HTMLCanvasElement, HTMLCanvasElement];
  /** Start open (the address asked for it). */
  open: boolean;
}

/** One half of the open Video cover: 0 Films, 1 Others. */
export type Half = 0 | 1;

/** Frame sheets and checks: hold the split at a progress and count the frames drawn. */
interface ShelfDebug {
  /** Frames drawn since the scene started. */
  frames: number;
  /** The split progress now, 0 shut to 1 open. */
  p: number;
  /** Hold the split where it is (true) or let it run (false). */
  hold: (on: boolean) => void;
  /** Jump the split to `p` (hold it first to keep it there). */
  seek: (p: number) => void;
  /** Where the focused cover is drawn now (CSS px from the top left of the stage), or null. */
  readonly focus: Rect | null;
  /** Where the two halves of the open Video cover are drawn now, or null while it is shut. */
  readonly films: Rect | null;
  readonly others: Rect | null;
}

declare global {
  interface Window {
    __shelf?: ShelfDebug;
  }
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface EngineOptions {
  /** The element the canvas is added to. */
  host: HTMLElement;
  /** The element that receives the pointer (the stage, which also holds the buttons). */
  pointerTarget: HTMLElement;
  covers: CoverInput[];
  /** The pointer is over a cover (or left them all). Not called for keyboard or index hovers. */
  onHover: (index: number | null) => void;
  /** A click or tap on a cover of the shelf, or on a cover of the phone stack. */
  onPick: (index: number) => void;
  /** A click on the cover that is already focused. */
  onOpen: (index: number) => void;
  /** A click or tap outside the focused cover. */
  onBack: () => void;
  /** The phone stack came to rest on another front cover (or is being dragged past one). */
  onFront: (index: number) => void;
  /** The scroll position of the phone stack, 0 to 9, for the thumb. */
  onStack: (s: number) => void;
  /** Screen rectangles (CSS px, from the top left of the stage) of the hovered cover and the focused one. */
  onLayout: (hover: Rect | null, focus: Rect | null) => void;
  /** The Video cover and its two halves. */
  split: SplitInput;
  /** The pointer is over one half of the open Video cover (or left both). */
  onHalfHover: (half: Half | null) => void;
  /** A click or tap on one half of the open Video cover. */
  onHalfOpen: (half: Half) => void;
  /** Screen rectangles of the two halves while the Video cover is open or moving; nulls when shut. */
  onSplitLayout: (films: Rect | null, others: Rect | null) => void;
  /** The Video cover came to rest, open or shut. */
  onSplitSettled: (open: boolean) => void;
}

/** The two panels of the Video cover. The front panel is the rig's `body`, turning on `hinge`. */
interface Gatefold {
  hinge: Group;
  /** The back panel: Others on its face. */
  leaf: Mesh;
  leafMats: MeshBasicMaterial[];
  /** The shadow of the front panel as it swings (the rig's own shadow follows the back panel). */
  flapShadow: Mesh;
  films: CanvasTexture;
  others: CanvasTexture;
  /** Hover lift of each half, 0 to 1. */
  lift: [number, number];
}

interface Rig {
  root: Group;
  pivot: Group;
  body: Mesh;
  shadow: Mesh;
  contact: Mesh;
  mats: MeshBasicMaterial[];
  texture: CanvasTexture;
  /** Hover amount and focus amount, 0 to 1. */
  h: number;
  f: number;
  opacity: number;
  order: number;
  gate?: Gatefold;
}

const FOV = 28;
const MAX_DPR = 1.75;
/** Below this focus amount a cover still counts as part of the shelf (the blur pass draws it). */
const EPS = 0.004;
const BLUR_STRIDE = 1;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** The ground: a soft grey wall, lighter in the middle, with fine static grain. Written in sRGB, converted to linear. */
const GROUND_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec2 uShift;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 c = (vUv - 0.5 - uShift) * vec2(uRes.x / uRes.y, 1.0);
  float d = length(c * vec2(0.58, 0.95));
  vec3 inner = vec3(0.905, 0.912, 0.93);
  vec3 outer = vec3(0.775, 0.785, 0.815);
  vec3 col = mix(inner, outer, smoothstep(0.08, 0.95, d));
  col += (vUv.y - 0.5) * 0.04;
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.04;
  col = pow(max(col, vec3(0.0)), vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uDir;
void main() {
  // One direction of a gaussian: 25 taps one texel apart (sigma 5 texels), so the covers' text
  // melts instead of combing. Run along x, then along y, at half size.
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -12; i <= 12; i++) {
    float f = float(i);
    float w = exp(-f * f / 50.0);
    sum += texture2D(tMap, vUv + uDir * f) * w;
    total += w;
  }
  gl_FragColor = sum / total;
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform float uOpacity;
uniform float uDim;
uniform float uWash;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), 0.35 * uDim);
  c *= 1.0 - 0.18 * uDim;
  // The open Video cover on a phone washes the stack toward the ground (see renderFrame).
  c = mix(c, vec3(0.76, 0.77, 0.8), uWash);
  gl_FragColor = vec4(c, uOpacity);
  #include <colorspace_fragment>
}
`;

function quadMaterial(
  frag: string,
  uniforms: ShaderMaterial["uniforms"],
  transparent = false,
): ShaderMaterial {
  const mat = new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent,
    toneMapped: false,
  });
  if (!transparent) mat.blending = NoBlending;
  return mat;
}

/** A soft dark shape for shadows, made once with the canvas shadow blur (no image file). */
function shadowTexture(
  w: number,
  h: number,
  shape: "rect" | "ellipse",
  blur: number,
  inset: number,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const off = 4000;
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = off;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    if (shape === "rect") ctx.rect(inset - off, inset, w - inset * 2, h - inset * 2);
    else ctx.ellipse(w / 2 - off, h / 2, w / 2 - inset, h / 2 - inset, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export class ShelfEngine {
  private readonly opts: EngineOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 10, 10000);
  private readonly world = new Group();
  private readonly wall = new Group();
  private readonly fsScene = new Scene();
  private readonly fsCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsMesh: Mesh;
  private readonly ground: Mesh;
  private readonly groundMat: ShaderMaterial;
  private readonly blurMat: ShaderMaterial;
  private readonly compositeMat: ShaderMaterial;
  private rtA: WebGLRenderTarget;
  private rtB: WebGLRenderTarget;
  private readonly rigs: Rig[] = [];
  private readonly boards: Mesh[] = [];
  private readonly boardShadows: Mesh[] = [];
  private readonly shared: Array<{ dispose: () => void }> = [];
  private readonly coverGeo = new BoxGeometry(1, 1, 1);
  private readonly planeGeo = new PlaneGeometry(1, 1);
  private readonly rectShadow: CanvasTexture;
  private readonly bandShadow: CanvasTexture;
  private readonly contactShadow: CanvasTexture;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly tmp = new Vector3();

  private w = 1;
  private h = 1;
  private phone = false;
  private shelfG: ShelfGeometry = shelfGeometry(1440, 900);
  private stackG: StackGeometry = stackGeometry(390, 844);

  private pointerHover: number | null = null;
  private forcedHover: number | null = null;
  private focus: number | null = null;
  private blur = 0;
  private px = 0;
  private py = 0;
  private tpx = 0;
  private tpy = 0;
  private stackS = 0;
  private stackTarget = 0;
  private lastFront = 0;
  private drag: {
    id: number;
    startY: number;
    startS: number;
    lastY: number;
    lastT: number;
    v: number;
    moved: boolean;
  } | null = null;
  private wheelAt = 0;

  /** The Video split: the cover's index, where `p` is going (0 or 1) and where it is. */
  private readonly gateIndex: number;
  private splitTarget = 0;
  private splitP = 0;
  private splitHold = false;
  /** The target the scene last said it had come to rest at. */
  private splitSettled = 0;
  private splitG: SplitGeometry = splitGeometry(1440, 900);
  /** The controls the focused cover and the open Video cover keep clear of (`setObstacles`). */
  private obstacles: Obstacles | null = null;
  private room: FocusRoom | null = null;
  private pointerHalf: Half | null = null;
  private forcedHalf: Half | null = null;
  private frames = 0;
  private debug: ShelfDebug | null = null;

  private entranceAt: number | null = null;
  private raf = 0;
  private last = 0;
  private visible = true;
  private inView = true;
  private disposed = false;
  private firstFrame = false;
  private hoverRect: Rect = { left: 0, right: 0, top: 0, bottom: 0 };
  private focusRect: Rect = { left: 0, right: 0, top: 0, bottom: 0 };
  private filmsRect: Rect = { left: 0, right: 0, top: 0, bottom: 0 };
  private othersRect: Rect = { left: 0, right: 0, top: 0, bottom: 0 };
  /** The halves' rectangles were last reported (so a shut cover reports nulls once). */
  private splitShown = false;
  private cleanups: Array<() => void> = [];

  constructor(opts: EngineOptions) {
    this.opts = opts;
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      depth: false,
      powerPreference: "high-performance",
    });
    renderer.autoClear = false;
    renderer.setClearColor(0xcfd1d8, 1);
    this.renderer = renderer;
    const canvas = renderer.domElement;
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
    opts.host.appendChild(canvas);

    this.rectShadow = shadowTexture(256, 256, "rect", 42, 70);
    this.bandShadow = shadowTexture(512, 128, "rect", 40, 34);
    this.contactShadow = shadowTexture(256, 64, "ellipse", 14, 20);

    // The ground and the two screen space passes share one quad.
    const quad = new PlaneGeometry(2, 2);
    this.shared.push(quad);
    this.groundMat = quadMaterial(GROUND_FRAG, {
      uRes: { value: new Vector2(1, 1) },
      uShift: { value: new Vector2(0, 0) },
    });
    this.blurMat = quadMaterial(BLUR_FRAG, {
      tMap: { value: null },
      uDir: { value: new Vector2() },
    });
    this.compositeMat = quadMaterial(
      COMPOSITE_FRAG,
      { tMap: { value: null }, uOpacity: { value: 0 }, uDim: { value: 0 }, uWash: { value: 0 } },
      true,
    );
    this.ground = new Mesh(quad, this.groundMat);
    this.ground.frustumCulled = false;
    this.ground.renderOrder = -1000;
    this.wall.add(this.ground);
    this.fsMesh = new Mesh(quad, this.blurMat);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);

    const rtOpts = {
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    } as const;
    this.rtA = new WebGLRenderTarget(2, 2, rtOpts);
    this.rtB = new WebGLRenderTarget(2, 2, rtOpts);

    this.scene.add(this.wall, this.world);
    this.buildBoards();
    this.buildCovers(opts.covers);
    this.gateIndex = opts.split.index;
    this.buildGatefold(opts.split);

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const textures = this.rigs.flatMap((rig) =>
      rig.gate ? [rig.texture, rig.gate.films, rig.gate.others] : [rig.texture],
    );
    for (const t of textures) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = anisotropy;
      t.minFilter = LinearMipmapLinearFilter;
      t.magFilter = LinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      renderer.initTexture(t);
    }
    for (const t of [this.rectShadow, this.bandShadow, this.contactShadow]) renderer.initTexture(t);

    this.bind();
    this.resize();
    if (opts.split.open) {
      // The address asked for the open Video cover: start there, with nothing to animate.
      const rig = this.rigs[this.gateIndex];
      this.focus = this.gateIndex;
      this.splitTarget = 1;
      this.splitP = 1;
      this.splitSettled = 1;
      this.blur = 1;
      if (rig) rig.f = 1;
      if (this.phone) {
        this.stackS = this.stackTarget = this.gateIndex;
        this.lastFront = this.gateIndex;
      }
    }
    this.warmUp();
    this.renderFrame();
    this.firstFrame = true;
    this.exposeDebug();
  }

  /** `window.__shelf`: hold and seek the split for frame sheets, and count the frames drawn. */
  private exposeDebug(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const engine = this;
    this.debug = window.__shelf = {
      get frames() {
        return engine.frames;
      },
      get p() {
        return engine.splitP;
      },
      hold: (on: boolean) => {
        engine.splitHold = on;
        engine.requestRender();
      },
      seek: (p: number) => {
        engine.splitP = clamp(p, 0, 1);
        engine.requestRender();
      },
      get focus() {
        return engine.focusNow !== null ? { ...engine.focusRect } : null;
      },
      get films() {
        return engine.splitShown ? { ...engine.filmsRect } : null;
      },
      get others() {
        return engine.splitShown ? { ...engine.othersRect } : null;
      },
    };
  }

  /**
   * Compile every program the scene will ever use, and touch both render targets, now, behind the
   * loading curtain. A material that is drawn into a render target is a different program from the
   * same material drawn to the screen, and a cover that is not drawn yet is not compiled at all, so
   * without this the first Details press and the first drop would stall on shader compiles.
   */
  private warmUp(): void {
    const r = this.renderer;
    // Lay every cover out once (the Video cover's panels included) so each face has a size.
    this.applyPoses(-1);
    for (const rig of this.rigs) {
      rig.root.visible = true;
      rig.mats.forEach((m) => {
        m.opacity = 1;
      });
      // The Video cover's back panel, the swing's shadow, and the inside of the front panel (turned
      // over, so its Films picture is drawn once now and not on the first opening).
      if (rig.gate) {
        rig.gate.leaf.visible = true;
        rig.gate.flapShadow.visible = true;
        rig.gate.hinge.rotation.set(0, Math.PI, 0);
      }
    }
    this.scene.updateMatrixWorld();
    r.setRenderTarget(this.rtA);
    r.clear(true, false, false);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.clear(true, false, false);
    r.render(this.scene, this.camera);
    for (const rig of this.rigs) {
      rig.root.visible = false;
      rig.mats.forEach((m) => {
        m.opacity = 0;
      });
      if (rig.gate) {
        rig.gate.leaf.visible = false;
        rig.gate.flapShadow.visible = false;
        rig.gate.hinge.rotation.set(0, 0, 0);
      }
    }

    this.fsMesh.material = this.blurMat;
    this.blurMat.uniforms.tMap!.value = this.rtA.texture;
    r.setRenderTarget(this.rtB);
    r.render(this.fsScene, this.fsCamera);
    this.blurMat.uniforms.tMap!.value = this.rtB.texture;
    r.setRenderTarget(this.rtA);
    r.render(this.fsScene, this.fsCamera);
    r.setRenderTarget(null);
    this.fsMesh.material = this.compositeMat;
    this.compositeMat.uniforms.tMap!.value = this.rtA.texture;
    this.compositeMat.uniforms.uOpacity!.value = 0;
    r.render(this.fsScene, this.fsCamera);
    r.clear(true, false, false);
  }

  // Building ----------------------------------------------------------------------------------

  private buildBoards(): void {
    for (let row = 0; row < 2; row += 1) {
      const faces = [0xf1f2f5, 0xf1f2f5, 0xfdfdfe, 0xcfd2d8, 0xffffff, 0xe6e8ec].map(
        (c) =>
          new MeshBasicMaterial({
            color: c,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
      );
      const board = new Mesh(this.coverGeo, faces);
      board.frustumCulled = false;
      board.renderOrder = -800 + row;
      this.world.add(board);
      this.boards.push(board);
      this.shared.push(...faces);

      const sh = new Mesh(
        this.planeGeo,
        new MeshBasicMaterial({
          map: this.bandShadow,
          transparent: true,
          opacity: 0.2,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      sh.frustumCulled = false;
      sh.renderOrder = -900 + row;
      this.world.add(sh);
      this.boardShadows.push(sh);
      this.shared.push(sh.material);
    }
  }

  private buildCovers(covers: CoverInput[]): void {
    covers.forEach((cover, i) => {
      const texture = new CanvasTexture(cover.canvas);
      const spine = new MeshBasicMaterial({
        color: 0xf2f3f6,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const right = new MeshBasicMaterial({
        color: 0xbfc3cc,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const top = new MeshBasicMaterial({
        color: 0xf8f9fb,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const bottom = new MeshBasicMaterial({
        color: 0x8f94a0,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const front = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const back = new MeshBasicMaterial({
        color: 0x9a9fab,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const mats = [right, spine, top, bottom, front, back];

      const body = new Mesh(this.coverGeo, mats);
      body.frustumCulled = false;
      const pivot = new Group();
      pivot.rotation.order = "YXZ";
      pivot.add(body);

      const shadow = new Mesh(
        this.planeGeo,
        new MeshBasicMaterial({
          map: this.rectShadow,
          transparent: true,
          opacity: 0.3,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.frustumCulled = false;
      const contact = new Mesh(
        this.planeGeo,
        new MeshBasicMaterial({
          map: this.contactShadow,
          transparent: true,
          opacity: 0.4,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      contact.frustumCulled = false;

      const root = new Group();
      root.add(shadow, contact, pivot);
      this.world.add(root);
      this.rigs.push({
        root,
        pivot,
        body,
        shadow,
        contact,
        mats,
        texture,
        h: 0,
        f: 0,
        opacity: 0,
        order: i,
      });
    });
  }

  /**
   * The Video cover becomes a gatefold: its body is the front panel (the Video picture outside,
   * Films inside), turning on a hinge, and a second panel behind it carries Others. Until the split
   * starts the back panel is hidden and the front panel is the whole cover (`gatefoldDepth`).
   */
  private buildGatefold(split: SplitInput): void {
    const rig = this.rigs[split.index];
    if (!rig) return;
    const flat = (color: number, map: CanvasTexture | null = null) =>
      new MeshBasicMaterial({
        color,
        map,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
    const films = new CanvasTexture(split.halves[0]);
    const others = new CanvasTexture(split.halves[1]);
    // Stacked on a phone the panel flips over its top edge, which turns its inside upside down:
    // the picture is turned back by half a turn about its middle (see `resize`).
    films.center.set(0.5, 0.5);
    const inside = rig.mats[5];
    if (inside) {
      inside.map = films;
      inside.color.setHex(0xffffff);
      inside.needsUpdate = true;
    }
    const leafMats = [
      flat(0xbfc3cc),
      flat(0xf2f3f6),
      flat(0xf8f9fb),
      flat(0x8f94a0),
      flat(0xffffff, others),
      flat(0x9a9fab),
    ];
    const leaf = new Mesh(this.coverGeo, leafMats);
    leaf.frustumCulled = false;
    leaf.visible = false;
    const hinge = new Group();
    rig.pivot.remove(rig.body);
    hinge.add(rig.body);
    rig.pivot.add(leaf, hinge);
    const flapShadow = new Mesh(this.planeGeo, flat(0xffffff, this.rectShadow));
    flapShadow.frustumCulled = false;
    flapShadow.visible = false;
    rig.root.add(flapShadow);
    rig.mats.push(...leafMats);
    rig.gate = { hinge, leaf, leafMats, flapShadow, films, others, lift: [0, 0] };
  }

  // Input -------------------------------------------------------------------------------------

  private bind(): void {
    const { pointerTarget: target, host } = this.opts;
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      o?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn, o);
      this.cleanups.push(() => {
        el.removeEventListener(type, fn);
      });
    };
    on(target, "pointermove", (e) => {
      this.onMove(e);
    });
    on(target, "pointerleave", () => {
      this.tpx = 0;
      this.tpy = 0;
      this.setPointerHover(null);
      this.setPointerHalf(null);
      this.requestRender();
    });
    on(target, "pointerdown", (e) => {
      this.onDown(e);
    });
    on(target, "pointerup", (e) => {
      this.onUp(e);
    });
    on(target, "pointercancel", () => {
      this.drag = null;
    });
    on(
      target,
      "wheel",
      (e) => {
        if (!this.phone || this.focusNow !== null) return;
        const now = performance.now();
        if (now - this.wheelAt < 220 || Math.abs(e.deltaY) < 4) return;
        this.wheelAt = now;
        this.stackTarget = clampStack(Math.round(this.stackTarget) + Math.sign(e.deltaY));
        this.requestRender();
      },
      { passive: true },
    );

    const ro = new ResizeObserver(() => {
      this.resize();
      this.requestRender();
    });
    ro.observe(host);
    this.cleanups.push(() => {
      ro.disconnect();
    });

    const io = new IntersectionObserver((entries) => {
      this.inView = entries[entries.length - 1]?.isIntersecting ?? true;
      if (this.inView) this.requestRender();
    });
    io.observe(host);
    this.cleanups.push(() => {
      io.disconnect();
    });

    const onVis = () => {
      this.visible = !document.hidden;
      if (this.visible) {
        this.last = 0;
        this.requestRender();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    this.cleanups.push(() => {
      document.removeEventListener("visibilitychange", onVis);
    });

    const canvas = this.renderer.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
    };
    const restored = () => {
      this.requestRender();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    this.cleanups.push(() => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    });
  }

  private local(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.opts.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** The cover under a point of the stage, the nearest of those drawn on top. -1 when none. */
  private pick(x: number, y: number, only: number | null = null): number {
    this.ndc.set((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.scene.updateMatrixWorld();
    let best = -1;
    let bestOrder = -Infinity;
    this.rigs.forEach((rig, i) => {
      if (only !== null && i !== only) return;
      if (rig.opacity < 0.5) return;
      const hit = this.raycaster.intersectObject(rig.body, false);
      if (hit.length === 0) return;
      // The cover drawn last is the one on top.
      if (rig.order > bestOrder) {
        bestOrder = rig.order;
        best = i;
      }
    });
    return best;
  }

  /** The half of the open Video cover under a point of the stage: 0 Films, 1 Others, -1 none. */
  private pickHalf(x: number, y: number): Half | -1 {
    const rig = this.rigs[this.gateIndex];
    const gate = rig?.gate;
    if (!rig || !gate || this.splitP <= 0 || rig.opacity < 0.5) return -1;
    this.ndc.set((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.scene.updateMatrixWorld();
    if (this.raycaster.intersectObject(rig.body, false).length > 0) return 0;
    if (gate.leaf.visible && this.raycaster.intersectObject(gate.leaf, false).length > 0) return 1;
    return -1;
  }

  /** The cover in the focus now. The Video cover keeps it while it is open and until it has shut. */
  private get focusNow(): number | null {
    if (this.rigs[this.gateIndex] && (this.splitTarget === 1 || this.splitP > SPLIT_RELEASE))
      return this.gateIndex;
    return this.focus;
  }

  private onMove(e: PointerEvent): void {
    const p = this.local(e);
    this.tpx = clamp((p.x / this.w) * 2 - 1, -1, 1);
    this.tpy = clamp((p.y / this.h) * 2 - 1, -1, 1);
    if (this.drag && this.phone) {
      const d = this.drag;
      d.moved = d.moved || Math.abs(p.y - d.startY) > 8;
      if (d.moved) {
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT) / 1000;
        d.v = d.v * 0.6 + ((d.lastY - p.y) / (this.stackG.strip * 3.2) / dt) * 0.4;
        d.lastY = p.y;
        d.lastT = now;
        this.stackS = dragToStack(d.startS, p.y - d.startY, this.stackG);
        this.stackTarget = this.stackS;
      }
    } else if (e.pointerType !== "touch" && this.splitTarget === 1) {
      // The open Video cover: the pointer lifts the half it is over.
      const half = this.splitP > 0.9 ? this.pickHalf(p.x, p.y) : -1;
      this.setPointerHalf(half === -1 ? null : half);
    } else if (!this.phone && this.focusNow === null && e.pointerType !== "touch") {
      const hit = this.pick(p.x, p.y);
      this.setPointerHover(hit >= 0 ? hit : null);
    }
    this.requestRender();
  }

  private setPointerHover(i: number | null): void {
    if (this.pointerHover === i) return;
    this.pointerHover = i;
    this.opts.onHover(i);
    this.requestRender();
  }

  private setPointerHalf(half: Half | null): void {
    if (this.pointerHalf === half) return;
    this.pointerHalf = half;
    this.opts.onHalfHover(half);
    this.requestRender();
  }

  private onDown(e: PointerEvent): void {
    if ((e.target as HTMLElement | null)?.closest("button, a, [data-ui]")) return;
    if (!this.phone || this.focusNow !== null) return;
    const p = this.local(e);
    this.drag = {
      id: e.pointerId,
      startY: p.y,
      startS: this.stackS,
      lastY: p.y,
      lastT: performance.now(),
      v: 0,
      moved: false,
    };
    try {
      this.opts.pointerTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that is already gone.
    }
  }

  private onUp(e: PointerEvent): void {
    if ((e.target as HTMLElement | null)?.closest("button, a, [data-ui]")) return;
    const p = this.local(e);
    const drag = this.drag;
    this.drag = null;
    if (this.phone && drag) {
      if (drag.moved) {
        this.stackTarget = snapStack(this.stackS, drag.v);
        this.requestRender();
        return;
      }
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // A tap or a click.
    if (this.splitTarget === 1) {
      // The open Video cover: a half opens its room (once it has settled), anywhere else shuts it.
      const half = this.pickHalf(p.x, p.y);
      if (half === -1) this.opts.onBack();
      else if (this.splitP > 0.9) this.opts.onHalfOpen(half);
      return;
    }
    const focus = this.focusNow;
    if (focus !== null) {
      if (this.pick(p.x, p.y, focus) >= 0) this.opts.onOpen(focus);
      else this.opts.onBack();
      return;
    }
    const hit = this.pick(p.x, p.y);
    if (hit < 0) return;
    if (this.phone && hit !== frontIndex(this.stackS)) {
      this.stackTarget = hit;
      this.requestRender();
      return;
    }
    this.opts.onPick(hit);
  }

  // Public controls ------------------------------------------------------------------------------

  /** The shelf follows the index row or the keyboard. */
  setHover(i: number | null): void {
    this.forcedHover = i;
    this.requestRender();
  }

  setFocus(i: number | null): void {
    this.focus = i;
    // The pointer is not followed while a cover is focused: forget what it was over.
    this.pointerHover = null;
    this.requestRender();
  }

  /**
   * Open (true) or shut (false) the Video cover. Give it the focus too (`setFocus`): when it shuts,
   * the scene keeps it in the focus until the panel has closed, then lets it fly back.
   */
  setSplit(open: boolean): void {
    const target = open ? 1 : 0;
    if (this.splitTarget === target) return;
    this.splitTarget = target;
    if (!open) {
      this.forcedHalf = null;
      this.setPointerHalf(null);
    }
    this.requestRender();
  }

  /**
   * The boxes of the controls over the scene (measured by the component, once per layout). The
   * focused cover and the open Video cover are laid out to keep clear of them.
   */
  setObstacles(o: Obstacles): void {
    this.obstacles = o;
    this.refit();
    this.requestRender();
  }

  /** The room of the focused cover and the place of the open pair, from the size and the obstacles. */
  private refit(): void {
    const { w, h } = this;
    const o = this.obstacles ?? noObstacles(w, h);
    this.room = focusRoom(w, h, o);
    this.splitG = splitGeometry(w, h, o.navH, { short: o.short, above: o.splitAbove });
    const gate = this.rigs[this.gateIndex]?.gate;
    if (gate) gate.films.rotation = this.splitG.vertical ? Math.PI : 0;
  }

  /** The half the keyboard is on (lifted like a hovered one). */
  setHalf(half: Half | null): void {
    this.forcedHalf = half;
    this.requestRender();
  }

  /** Phone: bring cover `i` to the front. */
  setStack(i: number): void {
    this.stackTarget = clampStack(i);
    this.requestRender();
  }

  /** Phone: the thumb of the scroll bar, 0 to 1. */
  setStackFraction(f: number): void {
    this.stackS = clampStack(f * (COVER_COUNT - 1));
    this.stackTarget = this.stackS;
    this.requestRender();
  }

  releaseStackThumb(): void {
    this.stackTarget = clampStack(Math.round(this.stackS));
    this.requestRender();
  }

  /** Start the drop of the ten covers (the curtain has opened). */
  playEntrance(): void {
    if (this.entranceAt !== null) return;
    this.entranceAt = performance.now();
    this.requestRender();
  }

  get isPhone(): boolean {
    return this.phone;
  }

  // Layout --------------------------------------------------------------------------------------

  private resize(): void {
    const host = this.opts.host;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const z = h / 2 / Math.tan((FOV * Math.PI) / 360);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, z);
    this.camera.far = z * 4;
    this.camera.updateProjectionMatrix();
    (this.groundMat.uniforms.uRes!.value as Vector2).set(w, h);

    const rw = Math.max(2, Math.round((w * dpr) / 2));
    const rh = Math.max(2, Math.round((h * dpr) / 2));
    this.rtA.setSize(rw, rh);
    this.rtB.setSize(rw, rh);

    this.phone = isPhone(w);
    this.shelfG = shelfGeometry(w, h);
    this.stackG = stackGeometry(w, h);
    const g = this.phone ? this.stackG : this.shelfG;

    this.rigs.forEach((rig) => {
      // The Video cover's panels are laid out every frame (`applyGate`).
      if (rig.gate) return;
      rig.body.scale.set(g.size, g.size, g.thick);
      rig.body.position.set(0, g.size / 2, -g.thick / 2);
    });
    this.refit();
    const sg = this.shelfG;
    this.boards.forEach((b, row) => {
      b.visible = !this.phone;
      b.scale.set(sg.boardW, sg.boardH, sg.boardDepth);
      b.position.set(0, sg.floor[row]! - sg.boardH / 2, -sg.boardDepth / 2);
    });
    this.boardShadows.forEach((s, row) => {
      s.visible = !this.phone;
      s.scale.set(sg.boardW * 1.06, sg.size * 0.4, 1);
      s.position.set(0, sg.floor[row]! - sg.boardH - sg.size * 0.1, -sg.boardDepth - 1);
    });
  }

  // Frame ---------------------------------------------------------------------------------------

  private requestRender(): void {
    if (this.disposed || this.raf || !this.visible || !this.inView) return;
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      this.tick(now);
    });
  }

  private tick(now: number): void {
    if (this.disposed) return;
    const dt = this.last ? clamp((now - this.last) / 1000, 0, 0.05) : 1 / 60;
    this.last = now;
    const moving = this.update(dt);
    this.renderFrame();
    if (moving) this.requestRender();
    else this.last = 0;
  }

  /** Move every animated value toward its target. True while something is still moving. */
  private update(dt: number): boolean {
    const state = { moving: false };
    const step = (cur: number, target: number, rate: number): number => {
      const v = damp(cur, target, rate, dt);
      if (Math.abs(v - target) < 0.0015) return target;
      state.moving = true;
      return v;
    };

    // The Video split: `p` runs at a constant speed toward its target (eased per part when read).
    if (!this.splitHold) {
      if (this.splitP !== this.splitTarget) {
        const up = this.splitTarget > this.splitP;
        const by = (dt * 1000) / (up ? SPLIT_OPEN_MS : SPLIT_CLOSE_MS);
        this.splitP = up ? Math.min(1, this.splitP + by) : Math.max(0, this.splitP - by);
        if (this.splitP !== this.splitTarget) state.moving = true;
      }
      if (this.splitP === this.splitTarget && this.splitSettled !== this.splitTarget) {
        this.splitSettled = this.splitTarget;
        this.opts.onSplitSettled(this.splitTarget === 1);
      }
    }
    const gate = this.rigs[this.gateIndex]?.gate;
    if (gate) {
      const half =
        this.splitTarget === 1 && this.splitP > 0.9 ? (this.pointerHalf ?? this.forcedHalf) : null;
      gate.lift[0] = step(gate.lift[0], half === 0 ? 1 : 0, 14);
      gate.lift[1] = step(gate.lift[1], half === 1 ? 1 : 0, 14);
    }

    const focus = this.focusNow;
    const hover = focus === null && !this.phone ? (this.pointerHover ?? this.forcedHover) : null;
    for (let i = 0; i < this.rigs.length; i += 1) {
      const rig = this.rigs[i]!;
      rig.h = step(rig.h, i === hover ? 1 : 0, 14);
      rig.f = step(rig.f, i === focus ? 1 : 0, 8.5);
    }
    this.blur = step(this.blur, focus !== null ? 1 : 0, 8.5);
    this.px = step(this.px, this.tpx, 5);
    this.py = step(this.py, this.tpy, 5);

    if (this.phone && !this.drag) this.stackS = step(this.stackS, this.stackTarget, 10);
    if (this.phone) {
      this.opts.onStack(this.stackS);
      const front = frontIndex(this.stackS);
      if (front !== this.lastFront) {
        this.lastFront = front;
        this.opts.onFront(front);
      }
    }

    const t = this.entranceAt === null ? -1 : performance.now() - this.entranceAt;
    if (this.entranceAt !== null && t < ENTRANCE_MS + 60) state.moving = true;
    this.applyPoses(t);
    return state.moving || this.drag !== null;
  }

  private applyPoses(t: number): void {
    const phone = this.phone;
    const sg = this.shelfG;
    const stg = this.stackG;
    const g = phone ? stg : sg;
    const fp = focusPose(this.w, this.h, g.size, this.room ?? undefined);
    const dropH = g.size * 1.7;
    this.world.position.set(-this.px * 9, this.py * 5, 0);
    (this.groundMat.uniforms.uShift!.value as Vector2).set(-this.px * 0.008, this.py * 0.006);

    for (let i = 0; i < this.rigs.length; i += 1) {
      const rig = this.rigs[i]!;
      let base: Pose;
      let alpha = 1;
      let order = i;
      if (phone) {
        const sp = stackPose(i, this.stackS, stg);
        base = sp.pose;
        alpha = sp.alpha;
        order = sp.order;
      } else {
        base = lerpPose(restPose(i, sg), hoverPose(i, sg), easeInOutCubic(rig.h));
      }
      const pose = lerpPose(base, fp, easeInOutCubic(rig.f));
      const drop = dropState(phone ? COVER_COUNT - 1 - i : i, t);
      const entering = this.entranceAt === null ? { fall: 1, tilt: 0, hop: 0, opacity: 0 } : drop;
      const depthX = -this.px * 4 * (1 - rig.f);
      const depthY = this.py * 2.5 * (1 - rig.f);
      // A cover that is already in the focus (the Video cover opened from the address) fades in
      // where it stands instead of dropping.
      const lift = (entering.fall * dropH + entering.hop * g.size) * (1 - rig.f);
      const zBase = phone ? 0 : -sg.boardDepth * 0.45;

      rig.root.position.set(depthX, depthY, 0);
      rig.pivot.position.set(pose.x, pose.y + lift, pose.z + zBase);
      rig.pivot.scale.setScalar(pose.s);
      rig.pivot.rotation.set(pose.lean - entering.tilt * (1 - rig.f), pose.yaw, 0);

      const opacity = alpha * entering.opacity;
      rig.opacity = opacity;
      rig.order = order;
      for (const m of rig.mats) m.opacity = opacity;
      rig.root.visible = opacity > 0.002;

      // Shadow on the wall behind the cover: it separates as the cover lifts.
      const sep = Math.max(rig.h, rig.f);
      const ss = g.size * pose.s;
      const sh = rig.shadow;
      sh.scale.set(ss * 1.22, ss * 1.22, 1);
      if (phone) {
        sh.position.set(
          pose.x,
          pose.y + lift + ss * Math.cos(stg.lean) * 0.5 + 6,
          pose.z + zBase - 1,
        );
        (sh.material as MeshBasicMaterial).opacity = 0.34 * opacity;
      } else {
        sh.position.set(
          pose.x + 6 + sep * 12,
          pose.y + lift + ss * 0.5 - 8 - sep * 14,
          -sg.boardDepth - 2,
        );
        (sh.material as MeshBasicMaterial).opacity = (0.26 - sep * 0.07) * opacity;
      }
      const ct = rig.contact;
      ct.visible = !phone;
      ct.scale.set(ss * 1.04, Math.max(8, ss * 0.075), 1);
      ct.position.set(pose.x, pose.y + lift - 1, -sg.boardDepth * 0.2);
      (ct.material as MeshBasicMaterial).opacity = 0.5 * (1 - sep) * opacity;

      const base0 = 1000 + order * 10;
      sh.renderOrder = base0;
      ct.renderOrder = base0 + 1;
      rig.body.renderOrder = base0 + 2;
      if (rig.gate) {
        // Back panel, then the shadow the front panel casts on it, then the front panel.
        rig.gate.leaf.renderOrder = base0 + 2;
        rig.gate.flapShadow.renderOrder = base0 + 3;
        rig.body.renderOrder = base0 + 4;
        const wallZ = phone ? pose.z + zBase - 1 : -sg.boardDepth - 2;
        this.applyGate(rig, rig.gate, pose, g, fp, lift, wallZ, opacity);
      }
    }
  }

  /**
   * Lay out the two panels of the Video cover inside its pivot (in the pivot's own units, where the
   * shut cover is `g.size` square), and their shadows on the wall. The open pair's place on screen
   * (`splitGeometry`) is turned into those units at the focus pose, where the split happens.
   */
  private applyGate(
    rig: Rig,
    gate: Gatefold,
    pose: Pose,
    g: { size: number; thick: number },
    fp: Pose,
    liftY: number,
    wallZ: number,
    opacity: number,
  ): void {
    const started = this.splitP > 0;
    const depth = gatefoldDepth(g.thick, started);
    const sg = this.splitG;
    const v = sg.vertical;
    const k = 1 / fp.s;
    const f = splitFrame(
      this.splitP,
      { x: 0, y: g.size / 2, size: g.size },
      {
        cx: (sg.cx - fp.x) * k,
        cy: (sg.cy - fp.y) * k,
        size: sg.size * k,
        gap: sg.gap * k,
        vertical: v,
      },
    );
    const S = f.size;
    const [liftA, liftB] = gate.lift;

    // The back panel (Others).
    gate.leaf.visible = started;
    const ls = S * (1 + 0.012 * liftB);
    gate.leaf.scale.set(ls, ls, Math.max(0.01, depth.leaf));
    gate.leaf.position.set(f.leaf.x, f.leaf.y, depth.hingeZ - depth.leaf / 2 + liftB * S * 0.035);

    // The front panel (Video outside, Films inside) on its hinge.
    const fs = S * (1 + 0.012 * liftA);
    gate.hinge.position.set(f.hinge.x, f.hinge.y, depth.hingeZ + liftA * S * 0.035);
    if (v) {
      gate.hinge.rotation.set(-f.angle, 0, 0);
      rig.body.position.set(0, -S / 2, depth.flap / 2);
    } else {
      gate.hinge.rotation.set(0, -f.angle, 0);
      rig.body.position.set(S / 2, 0, depth.flap / 2);
    }
    rig.body.scale.set(fs, fs, depth.flap);
    const shade = flapShade(f.angle);
    rig.mats[4]?.color.setScalar(shade.front);
    rig.mats[5]?.color.setScalar(shade.back);

    const fsh = gate.flapShadow;
    fsh.visible = started;
    if (!started) return;

    // Shadows on the wall. Positions in the rig's space: the pivot's units times its scale.
    const s = pose.s;
    const X = (x: number) => pose.x + x * s;
    const Y = (y: number) => pose.y + liftY + y * s;
    const Sw = S * s;
    const sh = rig.shadow;
    const lb = liftB * Sw * 0.04;
    sh.scale.set(Sw * 1.22 + lb, Sw * 1.22 + lb, 1);
    sh.position.set(X(f.leaf.x) + 18 + lb, Y(f.leaf.y) - 22 - lb, wallZ);
    (sh.material as MeshBasicMaterial).opacity = 0.19 * opacity;

    // The front panel's shadow narrows as it stands up off the wall, grows softer and slides
    // away from it, and is full again when the panel lies flat beside the other one.
    const sin = Math.max(0, Math.sin(f.angle));
    const cos = Math.cos(f.angle);
    const reach = Math.max(0.1, Math.abs(cos));
    const la = liftA * Sw * 0.04;
    const across = Sw * (reach * 1.22 + sin * 0.2) + la;
    const along = Sw * (1.22 + sin * 0.12) + la;
    const cx = v ? X(f.hinge.x) : X(f.hinge.x + (cos * S) / 2);
    const cy = v ? Y(f.hinge.y - (cos * S) / 2) : Y(f.hinge.y);
    fsh.scale.set(v ? along : across, v ? across : along, 1);
    fsh.position.set(cx + 18 + sin * Sw * 0.1 + la, cy - 22 - sin * Sw * 0.07 - la, wallZ);
    const appear = clamp(f.angle / 0.6, 0, 1);
    (fsh.material as MeshBasicMaterial).opacity =
      0.19 * appear * appear * (3 - 2 * appear) * (1 - 0.4 * sin) * opacity;
  }

  /** Draw: the shelf (blurred behind the focused cover), then the covers that are on top. */
  private renderFrame(): void {
    if (this.disposed) return;
    const r = this.renderer;
    const p = this.blur;
    const blurred = p > 0.002;

    const showBase = (base: boolean, top: boolean) => {
      this.wall.visible = base;
      this.world.children.forEach((c) => {
        // Boards and board shadows are part of the shelf; the covers' rigs are decided below.
        if (this.boards.includes(c as Mesh) || this.boardShadows.includes(c as Mesh))
          c.visible = base && !this.phone;
      });
      this.rigs.forEach((rig) => {
        const isTop = rig.f > EPS;
        const alive = rig.opacity > 0.002;
        rig.root.visible = alive && (isTop ? top : base);
      });
    };

    r.setRenderTarget(null);
    r.clear(true, false, false);

    if (blurred) {
      showBase(true, false);
      r.setRenderTarget(this.rtA);
      r.clear(true, false, false);
      r.render(this.scene, this.camera);
      this.fsMesh.material = this.blurMat;
      const bu = this.blurMat.uniforms;
      bu.tMap!.value = this.rtA.texture;
      (bu.uDir!.value as Vector2).set(BLUR_STRIDE / this.rtA.width, 0);
      r.setRenderTarget(this.rtB);
      r.render(this.fsScene, this.fsCamera);
      bu.tMap!.value = this.rtB.texture;
      (bu.uDir!.value as Vector2).set(0, BLUR_STRIDE / this.rtA.height);
      r.setRenderTarget(this.rtA);
      r.render(this.fsScene, this.fsCamera);
      r.setRenderTarget(null);
    }

    if (!blurred || p < 0.995) {
      showBase(true, false);
      r.render(this.scene, this.camera);
    }
    if (blurred) {
      this.fsMesh.material = this.compositeMat;
      const cu = this.compositeMat.uniforms;
      cu.tMap!.value = this.rtA.texture;
      cu.uOpacity!.value = easeInOutCubic(p);
      cu.uDim!.value = p;
      // On a phone the open halves stand on the blurred stack itself: wash it toward the ground
      // so their lines read. On a wide screen the blur and the dim are those of any focus.
      cu.uWash!.value = this.phone ? 0.62 * easeInOutCubic(this.splitP) : 0;
      r.render(this.fsScene, this.fsCamera);
    }
    if (this.rigs.some((rig) => rig.f > EPS && rig.opacity > 0.002)) {
      showBase(false, true);
      r.render(this.scene, this.camera);
    }
    showBase(true, true);
    this.frames += 1;
    this.emitLayout();
  }

  /** Screen box of a box mesh: the corners of its front face (`z` 0.5) or its middle (`z` 0). */
  private project(mesh: Mesh, out: Rect, z = 0.5): void {
    let l = Infinity;
    let rr = -Infinity;
    let t = Infinity;
    let b = -Infinity;
    this.scene.updateMatrixWorld();
    for (const [sx, sy] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ] as const) {
      this.tmp.set(sx, sy, z);
      mesh.localToWorld(this.tmp);
      this.tmp.project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * this.w;
      const y = (-this.tmp.y * 0.5 + 0.5) * this.h;
      l = Math.min(l, x);
      rr = Math.max(rr, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
    }
    out.left = l;
    out.right = rr;
    out.top = t;
    out.bottom = b;
  }

  private emitLayout(): void {
    const focus = this.focusNow;
    const hover = focus === null && !this.phone ? (this.pointerHover ?? this.forcedHover) : null;
    const hr = hover !== null ? this.rigs[hover] : undefined;
    const fr = focus !== null ? this.rigs[focus] : undefined;
    if (hr) this.project(hr.body, this.hoverRect);
    if (fr) this.project(fr.body, this.focusRect);
    this.opts.onLayout(hr ? this.hoverRect : null, fr ? this.focusRect : null);

    const gr = this.rigs[this.gateIndex];
    if (gr?.gate && this.splitP > 0) {
      this.project(gr.body, this.filmsRect, 0);
      this.project(gr.gate.leaf, this.othersRect, 0);
      this.opts.onSplitLayout(this.filmsRect, this.othersRect);
      this.splitShown = true;
    } else if (this.splitShown) {
      this.splitShown = false;
      this.opts.onSplitLayout(null, null);
    }
  }

  get drawn(): boolean {
    return this.firstFrame;
  }

  // End ----------------------------------------------------------------------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanups.forEach((fn) => {
      fn();
    });
    this.cleanups = [];
    for (const rig of this.rigs) {
      rig.texture.dispose();
      rig.mats.forEach((m) => {
        m.dispose();
      });
      (rig.shadow.material as Material).dispose();
      (rig.contact.material as Material).dispose();
      if (rig.gate) {
        rig.gate.films.dispose();
        rig.gate.others.dispose();
        (rig.gate.flapShadow.material as Material).dispose();
      }
    }
    if (window.__shelf === this.debug) delete window.__shelf;
    this.shared.forEach((s) => {
      s.dispose();
    });
    this.coverGeo.dispose();
    this.planeGeo.dispose();
    this.rectShadow.dispose();
    this.bandShadow.dispose();
    this.contactShadow.dispose();
    this.groundMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    const canvas = this.renderer.domElement;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
