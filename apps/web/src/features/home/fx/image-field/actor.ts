/**
 * The picture field as an actor of the home's one stage: the premotio hero's floating cards,
 * rebuilt for the Aspirants. A section drives it with a few setters every frame it shows the field
 * (they persist, so the lab can set them once):
 *
 *   show(name, t)                 one formation: scatter, gather, ring, land, wall, rows, story
 *   blend(from, to, t, opts)      a staggered blend of two formations (cards at the top go first)
 *   custom(fn, opts)              a pose for every card from the section's own function
 *   setSlide({ rate, offset })    the wall's own glide (px/s) and an offset to add (px)
 *   setInteractive(on)            hover, click, the pointer's push and the wake
 *   onClick(cb)  setCursor(label) a press on a card, and the word the site's cursor shows over one
 *   setClip(rect | null)          draw only inside a rectangle (CSS px, top left)
 *   slotRect(i)                   where card i is on the screen (CSS px), for DOM that goes between
 *
 * What moves by itself (the idle float, the parallax, the push and its springs, the hover lift, the
 * glide, the streak and the bend that follow a card's speed, the wake) is integrated in `update`.
 * Nothing is sprung toward a formation's pose: the pose is a pure function of what the section
 * sets, so a jump (a seek, a scrollbar drag) lands exactly and leaves nothing flying.
 *
 * Drawing: every card goes into one full-size RGBA8 target (premultiplied), then one composite pass
 * writes it to the canvas through the multi-tap smear and the wake. `docs/design/home/fx-image-field.md`
 * has the numbers and the way to look at it.
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  type PerspectiveCamera,
  RGBAFormat,
  Scene,
  Texture,
  UnsignedByteType,
  Vector4,
  type WebGLRenderer,
} from "three";

import type { ActorCtx } from "../../actors/shared/types";
import { makePixelPerspectiveCamera, pixelFov, type StageTarget } from "../../kernel/stage";
import type { Actor, FrameInfo, HitTarget, Pass } from "../../kernel/types";
import { getBitmap, onBitmap, peekBitmap, releaseBitmap } from "./bitmaps";
import { CardView, disposeCardGeometry, type CardLook } from "./card";
import { makeCarousel, stepCarousel } from "./carousel";
import {
  blendFormations,
  blendLens,
  buildFormations,
  lensOf,
  poseOf,
  rankCards,
  storyProgress,
  type FormationName,
  type FormationSet,
  type RankBy,
} from "./formations";
import {
  OFFSET_SPRING,
  TILT_SPRING,
  bendOf,
  edgeStrength,
  flutterOf,
  hoverEase,
  idleMotion,
  parallaxOffset,
  pointerForce,
  pushRadius,
  quadPad,
  streakOf,
  type Idle,
} from "./live";
import { clamp, clipSoftEdges, mix, qFromEuler, qMul, type Q } from "./math";
import { cardCountOf, assignPictures, cardKeys, slotKeys, type CardPictures } from "./pictures";
import { Composite, type CompositeParams } from "./post";
import { cardQuad, pointInQuad, quadBounds } from "./project";
import {
  focusInWindow,
  portraitSource,
  setDef,
  wideSource,
  type FieldSetDef,
  type FieldSetName,
  type PicSource,
  type PortraitPic,
  type WidePic,
} from "./sets";
import { lowpassGain, makeSpring, softClamp, springStep, type Spring } from "./spring";
import { makePose, type CardPose, type PoseFn, type Quad, type Rect } from "./types";
import { WakeField, type Stir } from "./wake";
import { smoothVelocity, stirForce, STIR_MIN } from "./wake-math";

/** The pass of the field, behind the logo (15) and the drones (20): the cards are the ground of the hero. */
export const FIELD_ORDER = 12;
/** The same pass over the logo and the drones (and under the lit cast at 30), for a section that wants it. */
export const FIELD_ORDER_FRONT = 25;

/** How far a hovered card comes toward the camera (px at z = 0). */
const HOVER_LIFT = 46;
/** How much a hovered card grows. */
const HOVER_GROW = 0.05;
/** How far the neighbours of a hovered card part (screen px). */
const PART_REACH = 22;

export interface FormationRef {
  name: FormationName;
  /** The progress inside the window of that name (the story and the windows read it). */
  t?: number;
}

type Spec =
  | { kind: "one"; name: FormationName; t: number }
  | { kind: "blend"; from: FormationRef; to: FormationRef; t: number; spread: number; by: RankBy }
  | { kind: "custom"; fn: PoseFn; lens: number; edges: number };

/** What a press on a card reports. */
export interface CardPress {
  /** The card's index. */
  index: number;
  /** The picture the card shows on the wall. */
  wide: WidePic;
  /** The picture the card shows in the hero and the ring. */
  portrait: PortraitPic;
  /** The wall slot it stands in. */
  slot: number;
}

interface Cell {
  readonly view: CardView;
  readonly seed: number;
  readonly base: CardPose;
  readonly pose: CardPose;
  readonly q: Q;
  readonly extra: Q;
  readonly ox: Spring;
  readonly oy: Spring;
  readonly tx: Spring;
  readonly ty: Spring;
  readonly tz: Spring;
  /** The pointer's push after the low-pass, screen px/s^2, y down. */
  fx: number;
  fy: number;
  hover: number;
  press: number;
  /** The parting of a neighbour, screen px, y up. */
  partX: number;
  partY: number;
  /** Speed on the screen, px/s, y up. */
  vx: number;
  vy: number;
  /** The centre of the card on the screen last frame (CSS px, y down), for its speed. */
  prevX: number;
  prevY: number;
  hasPrev: boolean;
  phase: number;
  /** The centre of the base pose on the screen, CSS px, y down. */
  bx: number;
  by: number;
  readonly quad: Quad;
  quadOk: boolean;
  shown: boolean;
  /** The lens scale at the displayed pose. */
  scale: number;
}

function makeCell(view: CardView, seed: number): Cell {
  return {
    view,
    seed,
    base: makePose(),
    pose: makePose(),
    q: [0, 0, 0, 1],
    extra: [0, 0, 0, 1],
    ox: makeSpring(),
    oy: makeSpring(),
    tx: makeSpring(),
    ty: makeSpring(),
    tz: makeSpring(),
    fx: 0,
    fy: 0,
    hover: 0,
    press: 0,
    partX: 0,
    partY: 0,
    vx: 0,
    vy: 0,
    prevX: 0,
    prevY: 0,
    hasPrev: false,
    phase: seed * 2.1,
    bx: 0,
    by: 0,
    quad: [0, 0, 0, 0, 0, 0, 0, 0],
    quadOk: false,
    shown: false,
    scale: 1,
  };
}

interface TextureEntry {
  readonly src: PicSource;
  texture: Texture | null;
  ready: boolean;
}

/** The pass the stage draws: a thin shell over the actor, whose order may change. */
class FieldPass implements Pass {
  readonly name = "field";
  order = FIELD_ORDER;
  /** True while the stage moves the pass (it is taken out and put back, not disposed). */
  moving = false;

  constructor(private readonly owner: FieldActor) {}

  active(): boolean {
    return this.owner.isDrawn();
  }

  render(renderer: WebGLRenderer): void {
    this.owner.draw(renderer);
  }

  resize(w: number, h: number): void {
    this.owner.resized(w, h);
  }

  rebuild(): void {
    this.owner.rebuilt();
  }

  dispose(): void {
    if (!this.moving) this.owner.disposeGpu();
  }
}

/** The one hit target of the field: the nearest card under the pointer. */
class FieldHit implements HitTarget {
  readonly id = "field";

  constructor(private readonly owner: FieldActor) {}

  get cursor(): string | undefined {
    return this.owner.cursorLabel ?? undefined;
  }

  test(x: number, y: number): number | null {
    return this.owner.hitDepth(x, y);
  }

  enter(): void {
    this.owner.hoverEntered();
  }

  leave(): void {
    this.owner.hoverLeft();
  }

  press(x: number, y: number): void {
    this.owner.pressed(x, y);
  }

  release(x: number, y: number): void {
    this.owner.released(x, y);
  }
}

export class FieldActor implements Actor {
  readonly name = "field";
  visible = false;
  /** The word the site's cursor shows over a card, or null for none. Set it with `setCursor`. */
  cursorLabel: string | null = null;
  /** Resolves when the portrait pictures (what the hero shows) are textures. The wide ones follow. */
  readonly ready: Promise<void>;

  private readonly def: FieldSetDef;
  private readonly n: number;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly cells: Cell[] = [];
  private readonly blank: DataTexture;
  private readonly textures = new Map<string, TextureEntry>();
  private readonly uploads: Texture[] = [];
  private uploading = false;
  private readonly target: StageTarget;
  private readonly composite = new Composite();
  private wake: WakeField | null = null;
  private wakeWanted = true;
  private readonly pass: FieldPass;
  private removePass: () => void;
  private readonly removeHit: () => void;
  private readonly maxAnisotropy: number;

  private vp = { w: 1, h: 1 };
  private dpr = 1;
  private layout: FormationSet;
  private pictures: CardPictures[] = [];
  private ranks: Float64Array;
  private rankFrom: FormationName | "" = "";
  private rankBy: RankBy = "top";
  private rankW = 0;
  private rankH = 0;
  private spec: Spec = { kind: "one", name: "scatter", t: 0 };
  private lens = 1000;
  private edges = 1;
  private edgesOverride: number | null = null;

  // What the section set.
  private rate = 0;
  private offset = 0;
  private opacity = 1;
  private interactive = true;
  private holdOnHover = true;
  private clickHandler: ((press: CardPress) => void) | null = null;
  private clipRect: Rect | null = null;
  /** The widest soft edge (CSS px) the clip may have: where it cuts the picture short of the screen's edge. */
  private clipSoft = 0;
  private readonly softBox = [0, 0, 0, 0];
  private readonly softWidths = [0, 0, 0, 0];

  // What the field integrates by itself.
  private readonly car = makeCarousel();
  private readonly idle: Idle = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
  private readonly force: [number, number] = [0, 0];
  private readonly streak: [number, number] = [0, 0];
  private readonly stirVec: [number, number] = [0, 0];
  private lsx = 0;
  private lsy = 0;
  private pvx = 0;
  private pvy = 0;
  private lastPx = 0;
  private lastPy = 0;
  private hasPointer = false;
  private readonly stirData: Stir = { fromX: 0, fromY: 0, toX: 0, toY: 0, forceX: 0, forceY: 0 };
  private stirOn = false;
  /** One look and one composite description, written again each frame (nothing is allocated per frame). */
  private readonly look: CardLook = {
    x: 0,
    y: 0,
    z: 0,
    q: [0, 0, 0, 1],
    halfW: 0,
    halfH: 0,
    pad: 0,
    corner: 0,
    opacity: 1,
    mix: 0,
    hover: 0,
    streakX: 0,
    streakY: 0,
    bend: 0,
    flutter: 0,
    phase: 0,
    shadow: 0,
    shadowX: 0,
    shadowY: 0,
    shadowBlur: 0,
    light: 0,
  };
  private readonly compositeParams: CompositeParams;
  private wideSources: PicSource[] = [];
  private wideRequested = false;
  private unsubscribe: (() => void) | null = null;
  private hoverCard = -1;
  private pressCard = -1;
  private pressX = 0;
  private pressY = 0;
  private pointerLive = false;
  private noseX = 0;
  private noseY = 0;
  private time = 0;
  private dt = 0;
  private updated = false;
  /** The quads of an earlier frame exist: the kernel's hit test runs before this frame's update. */
  private hasQuads = false;
  private disposed = false;
  private labelShown: string | null = null;

  constructor(
    private readonly ctx: ActorCtx,
    setName: FieldSetName = "hero",
  ) {
    const { stage } = ctx;
    this.def = setDef(setName);
    this.n = cardCountOf(this.def);
    const vp = ctx.viewport();
    this.vp = { w: vp.w, h: vp.h };
    this.dpr = vp.dpr;
    this.maxAnisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());

    this.blank = new DataTexture(
      new Uint8Array([46, 50, 58, 255]),
      1,
      1,
      RGBAFormat,
      UnsignedByteType,
    );
    this.blank.needsUpdate = true;

    this.layout = this.makeLayout();
    this.ranks = new Float64Array(this.n);
    this.camera = makePixelPerspectiveCamera(vp.w, vp.h);
    this.lens = this.camera.position.z;

    for (let i = 0; i < this.n; i++) {
      const view = new CardView(this.blank, `field-card-${i}`);
      this.scene.add(view.mesh);
      this.cells.push(makeCell(view, i));
    }
    this.pictures = assignPictures(this.def, this.layout.story.wallSlot, this.n);

    this.target = stage.target(1, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    if (WakeField.supported(stage.renderer)) this.wake = new WakeField(vp.w, vp.h);
    this.compositeParams = {
      cards: this.target.target.texture,
      wake: null,
      deviceW: 1,
      deviceH: 1,
      cssW: 1,
      cssH: 1,
      pixel: 1,
      edges: 1,
      noseX: 0,
      noseY: 0,
      clip: new Vector4(-1e6, -1e6, 1e6, 1e6),
      soft: new Vector4(0, 0, 0, 0),
    };

    this.pass = new FieldPass(this);
    this.removePass = stage.addPass(this.pass);
    this.removeHit = ctx.pointer.add(new FieldHit(this));

    this.composite.compile(stage.renderer);
    this.wake?.compile(stage.renderer);
    stage.renderer.compile(this.scene, this.camera);

    this.ready = this.loadAll();
  }

  // ---------------------------------------------------------------------------------------------
  // What a section sets

  /** Show one formation. `t` is the progress inside the window of that name (the story reads 0 to 1). */
  show(name: FormationName, t = 0): void {
    const s = this.spec;
    if (s.kind === "one") {
      s.name = name;
      s.t = t;
    } else {
      this.spec = { kind: "one", name, t };
    }
  }

  /**
   * A blend of two formations at `t` (0 to 1). `spread` (0 to 1) staggers the cards by `by`: with
   * "top" the cards highest on the screen start first and every card has arrived at `t` = 1.
   */
  blend(from: FormationRef, to: FormationRef, t: number, spreadBy = 0.5, by: RankBy = "top"): void {
    const spread = clamp(spreadBy);
    const s = this.spec;
    if (s.kind === "blend") {
      s.from = from;
      s.to = to;
      s.t = t;
      s.spread = spread;
      s.by = by;
    } else {
      this.spec = { kind: "blend", from, to, t, spread, by };
    }
    this.rankFor(from, by);
  }

  /**
   * The section's own pose for every card: `fn(i, out)` writes it in the stage's frame. `lens` is
   * the camera distance (1000 is the pixel lens, 2000 the wall's long one), `edges` the edge smear.
   */
  custom(fn: PoseFn, lens = 1000, edges = 0.35): void {
    const s = this.spec;
    if (s.kind === "custom") {
      s.fn = fn;
      s.lens = lens;
      s.edges = edges;
    } else {
      this.spec = { kind: "custom", fn, lens, edges };
    }
  }

  /**
   * The wall's glide: `rate` px/s of the wall plane (a row of the wall is about 4000 px, 40 is
   * calm) and an `offset` added to it (a section that scrolls the rows sets this and a rate of 0).
   */
  setSlide(rate: number, offset?: number): void {
    this.rate = rate;
    if (offset !== undefined) this.offset = offset;
  }

  /** A multiplier of every card's opacity, 0 to 1 (fading the field in or out). */
  setOpacity(opacity: number): void {
    this.opacity = clamp(opacity);
  }

  /** Hover, click, the pointer's push and the wake. Off while a preview is open. */
  setInteractive(on: boolean): void {
    this.interactive = on;
  }

  /** Whether a hovered card stops the glide of the wall (default yes). */
  setHoldOnHover(on: boolean): void {
    this.holdOnHover = on;
  }

  /** What a press on a card does. Pass null to take it away. */
  onClick(handler: ((press: CardPress) => void) | null): void {
    this.clickHandler = handler;
  }

  /** The word the site's cursor shows over a card ("VIEW" on the wall), or null. */
  setCursor(label: string | null): void {
    if (label === this.cursorLabel) return;
    this.cursorLabel = label;
    if (this.hoverCard >= 0) this.showLabel(label);
  }

  /** Draw only inside a rectangle (CSS px from the top left), or everywhere with null. */
  setClip(rect: Rect | null, soft = 0): void {
    this.clipRect = rect;
    this.clipSoft = soft;
  }

  /** The edge smear (0 to 1) to use instead of the formation's own, or null to follow the formation. */
  setEdges(edges: number | null): void {
    this.edgesOverride = edges;
  }

  /** The wake on or off (the wave under the cursor). On by default. */
  setWake(on: boolean): void {
    this.wakeWanted = on;
  }

  /** Move the pass: `FIELD_ORDER` (behind the logo and the drones, the default) or `FIELD_ORDER_FRONT`. */
  setOrder(order: number): void {
    if (order === this.pass.order || this.disposed) return;
    this.pass.moving = true;
    this.removePass();
    this.pass.moving = false;
    this.pass.order = order;
    this.removePass = this.ctx.stage.addPass(this.pass);
  }

  /** Let every spring and every ease rest where its target is (a seek, a probe frame). */
  snap(): void {
    for (const c of this.cells) {
      c.ox.x = c.oy.x = c.tx.x = c.ty.x = c.tz.x = 0;
      c.ox.v = c.oy.v = c.tx.v = c.ty.v = c.tz.v = 0;
      c.fx = c.fy = 0;
      c.partX = c.partY = 0;
      c.vx = c.vy = 0;
      c.hasPrev = false;
      c.hover = this.cells.indexOf(c) === this.hoverCard ? 1 : 0;
      c.press = 0;
    }
    this.wake?.reset();
  }

  // ---------------------------------------------------------------------------------------------
  // What a section asks

  get count(): number {
    return this.n;
  }

  /** The lens distance of the last frame (px): 1000 is the pixel lens, 2000 the wall's. */
  get lensDistance(): number {
    return this.lens;
  }

  /** How far the wall has glided and been offset, px of the wall plane (for probes and for a section that continues a slide). */
  get slideAt(): number {
    return this.car.pos + this.offset;
  }

  /** The index of the card under the pointer, or -1. */
  get hovered(): number {
    return this.hoverCard;
  }

  /**
   * The rectangle the wall (or the rows) is laid out in, CSS px from the top left. The wall slides
   * past its right edge, so a section shows it with `setClip(field.frameRect("wall"))`.
   */
  frameRect(kind: "wall" | "rows" = "wall", out: Rect = { x: 0, y: 0, w: 0, h: 0 }): Rect {
    const f = kind === "rows" ? this.layout.rows.frame : this.layout.story.wall.frame;
    out.x = this.vp.w / 2 + f.cx - f.w / 2;
    out.y = this.vp.h / 2 - f.cy - f.h / 2;
    out.w = f.w;
    out.h = f.h;
    return out;
  }

  /** Where card `i` is on the screen: the box of its quad in CSS px from the top left. Null when it is not drawn. */
  slotRect(i: number, out: Rect = { x: 0, y: 0, w: 0, h: 0 }): Rect | null {
    const c = this.cells[i];
    if (!c || !c.shown || !c.quadOk) return null;
    return quadBounds(c.quad, out);
  }

  /** What card `i` shows and where it stands on the wall. */
  cardInfo(i: number): CardPress | null {
    const p = this.pictures[i];
    if (!p) return null;
    const wide = this.def.walls[p.wide];
    const portrait = this.def.portraits[p.portrait];
    if (!wide || !portrait) return null;
    return { index: i, wide, portrait, slot: this.layout.story.wallSlot[i]! };
  }

  // ---------------------------------------------------------------------------------------------
  // The frame

  update(frame: FrameInfo): void {
    if (this.disposed) return;
    const dt = Math.max(0, frame.dt);
    // The field keeps its own clock from the frames' dt, so a frozen scene holds the idle float too
    // (the kernel's `frame.time` keeps running while it is frozen).
    this.time += dt;
    this.dt = dt;
    this.dpr = frame.viewport.dpr;
    const { w, h } = this.vp;
    const st = this.ctx.pointer.state;
    this.pointerLive = this.interactive && (st.inside || st.down);

    // The pointer: its velocity, the smoothed place for the parallax, the stir for the wake.
    this.stepPointer(st.x, st.y, st.nx, st.ny, dt);

    // The card under the pointer (the kernel says the field is the target, the quads say which card).
    this.hoverCard =
      this.interactive && st.hit === "field" && this.pointerLive ? this.cardAt(st.x, st.y) : -1;

    // The glide of the wall.
    stepCarousel(this.car, dt, this.rate, this.holdOnHover && this.hoverCard >= 0);
    const slide = this.car.pos + this.offset;

    // The formation, and the lens it is seen through.
    this.lens = this.lensOfSpec();
    this.edges = this.edgesOverride ?? this.edgesOfSpec();
    this.fitCamera(this.lens);
    const d = this.lens;

    // 1. Base poses and where they are on the screen.
    for (let i = 0; i < this.n; i++) {
      const c = this.cells[i]!;
      this.evalBase(i, slide, c.base);
      const s0 = d / (d - c.base.z);
      c.bx = w / 2 + c.base.x * s0;
      c.by = h / 2 - c.base.y * s0;
    }

    // 2. The live motion and the final pose of each card.
    const radius = pushRadius(w, h);
    const shorter = Math.min(w, h);
    const hovered = this.hoverCard >= 0 ? this.cells[this.hoverCard]! : null;
    const pushOn = this.pointerLive && this.dt > 0;
    let needWide = false;
    for (let i = 0; i < this.n; i++) {
      const c = this.cells[i]!;
      const b = c.base;
      const live = b.live;
      const s0 = d / (d - b.z);

      // The hover and the press ease.
      c.hover = hoverEase(c.hover, i === this.hoverCard ? 1 : 0, dt);
      c.press = clamp(
        c.press +
          ((i === this.pressCard ? 1 : 0) - c.press) *
            lowpassGain(i === this.pressCard ? 24 : 9, dt),
      );

      // The push of the pointer: low-passed, then a spring on the offset (premotio's).
      let fx = 0;
      let fy = 0;
      if (pushOn && live > 0.001) {
        const speed = Math.hypot(this.pvx, this.pvy);
        pointerForce(
          this.lastPx,
          this.lastPy,
          c.bx,
          c.by,
          radius,
          speed,
          this.pvx,
          this.pvy,
          this.force,
        );
        const k = live * (1 - 0.85 * c.hover);
        fx = this.force[0] * k;
        fy = this.force[1] * k;
      }
      const lp = lowpassGain(8, dt);
      c.fx += (fx - c.fx) * lp;
      c.fy += (fy - c.fy) * lp;
      springStep(c.ox, 0, OFFSET_SPRING.omega, OFFSET_SPRING.zeta, dt, c.fx);
      springStep(c.oy, 0, OFFSET_SPRING.omega, OFFSET_SPRING.zeta, dt, -c.fy);

      // The parting of a neighbour of the hovered card.
      let partTx = 0;
      let partTy = 0;
      if (hovered && hovered !== c) {
        const dx = c.bx - hovered.bx;
        const dy = c.by - hovered.by;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = (hovered.base.h * hovered.scale + b.h * c.scale) * 0.9;
        const near = clamp(1 - dist / reach);
        const amount = PART_REACH * near * near * hovered.hover;
        partTx = (dx / dist) * amount;
        partTy = (-dy / dist) * amount;
      }
      const pk = lowpassGain(9, dt);
      c.partX += (partTx - c.partX) * pk;
      c.partY += (partTy - c.partY) * pk;

      // The idle float and the parallax, which belong to the field's own life (`live`).
      idleMotion(this.time, c.seed, this.idle);
      const px = (this.idle.x + parallaxOffset(this.lsx, b.z)) * live;
      const py = (this.idle.y + parallaxOffset(this.lsy, b.z)) * live;
      const sx = px + softClamp(c.ox.x, 300) + c.partX;
      const sy = py + softClamp(c.oy.x, 300) + c.partY;

      // The tilt springs follow the push's own velocity and the hover's lean toward the pointer.
      let leanX = 0;
      let leanY = 0;
      if (c.hover > 0.001) {
        leanX = clamp(
          (this.lastPx - (c.bx + sx)) / Math.max(40, b.h * c.scale * b.aspect * 0.5),
          -1,
          1,
        );
        leanY = clamp(-(this.lastPy - (c.by - sy)) / Math.max(40, b.h * c.scale * 0.5), -1, 1);
      }
      springStep(
        c.tx,
        softClamp(-c.oy.v * 0.0011, 0.6) + leanY * 0.12 * c.hover,
        TILT_SPRING.omega,
        TILT_SPRING.zeta,
        dt,
      );
      springStep(
        c.ty,
        softClamp(c.ox.v * 0.0011, 0.6) + leanX * 0.12 * c.hover,
        TILT_SPRING.omega,
        TILT_SPRING.zeta,
        dt,
      );
      springStep(c.tz, softClamp(-c.ox.v * 0.0004, 0.5), TILT_SPRING.omega, TILT_SPRING.zeta, dt);
      qFromEuler(
        c.tx.x + (this.idle.rx + this.lsy * 0.06) * live,
        c.ty.x + (this.idle.ry + this.lsx * 0.1) * live,
        c.tz.x + this.idle.rz * live,
        c.extra,
      );
      qMul(b.q, c.extra, c.q);

      // The final pose.
      const grow = 1 + HOVER_GROW * c.hover - 0.03 * c.press;
      const p = c.pose;
      p.x = b.x + sx / s0;
      p.y = b.y + sy / s0;
      p.z = b.z + HOVER_LIFT * c.hover;
      p.h = b.h * grow;
      p.aspect = b.aspect;
      p.shape = b.shape;
      p.opacity = b.opacity * this.opacity;
      p.live = live;
      c.scale = d / (d - p.z);

      // Its speed on the screen, for the streak and the bend (not across a jump, not for no time).
      const cx = w / 2 + p.x * c.scale;
      const cy = h / 2 - p.y * c.scale;
      if (c.hasPrev && dt > 0) {
        const jump = Math.hypot(cx - c.prevX, cy - c.prevY);
        if (jump > 0.5 * shorter) {
          c.vx = 0;
          c.vy = 0;
        } else {
          const k = lowpassGain(12.5, dt);
          c.vx += ((cx - c.prevX) / dt - c.vx) * k;
          c.vy += (-(cy - c.prevY) / dt - c.vy) * k;
        }
      }
      if (dt > 0 || !c.hasPrev) {
        c.prevX = cx;
        c.prevY = cy;
        c.hasPrev = true;
      }

      if (p.shape > 0.001) needWide = true;
      this.writeCell(c, shorter);
    }
    if (needWide && !this.wideRequested) this.wantWide();
    this.updated = true;
    this.hasQuads = true;
  }

  private writeCell(c: Cell, shorter: number): void {
    const p = c.pose;
    const speed = Math.hypot(c.vx, c.vy);
    streakOf(c.vx, c.vy, shorter, this.streak);
    const hh = p.h / 2;
    const hw = hh * p.aspect;
    const roll = Math.atan2(
      2 * (c.q[3] * c.q[2] + c.q[0] * c.q[1]),
      1 - 2 * (c.q[1] * c.q[1] + c.q[2] * c.q[2]),
    );
    c.phase += (this.dt > 0 ? this.dt : 0) * (6 + 12 * Math.min(1, speed / 2400));
    const hv = c.hover;
    const sOffY = -(0.035 + 0.03 * hv) * p.h;
    const sOffX = (0.012 + 0.01 * hv) * p.h;
    const blur = 0.06 * p.h * (1 + 0.8 * hv);
    const streakLen = Math.hypot(this.streak[0], this.streak[1]);
    const l = this.look;
    l.x = p.x;
    l.y = p.y;
    l.z = p.z;
    l.q = c.q;
    l.halfW = hw;
    l.halfH = hh;
    l.pad = quadPad(Math.hypot(sOffX, sOffY) + blur, streakLen, c.scale);
    l.corner = 0.06 * Math.min(hw, hh) * 2;
    l.opacity = p.opacity;
    l.mix = p.shape;
    l.hover = hv;
    l.streakX = this.streak[0] * this.dpr;
    l.streakY = this.streak[1] * this.dpr;
    l.bend = bendOf(c.vx, c.vy, roll);
    l.flutter = flutterOf(speed) * p.h;
    l.phase = c.phase;
    l.shadow = 0.18 + 0.1 * hv;
    l.shadowX = sOffX;
    l.shadowY = sOffY;
    l.shadowBlur = blur;
    l.light = 0.28;
    c.view.write(l);
    c.shown = p.opacity > 0.003;
    c.view.mesh.visible = c.shown;
    c.quadOk = c.shown && cardQuad(p.x, p.y, p.z, c.q, hw * 2, hh * 2, this.lens, this.vp, c.quad);
  }

  private evalBase(i: number, slide: number, out: CardPose): void {
    const s = this.spec;
    switch (s.kind) {
      case "one":
        poseOf(this.layout, s.name, s.t, i, slide, out);
        break;
      case "blend":
        blendFormations(this.layout, s.from, s.to, s.t, s.spread, this.ranks[i]!, i, slide, out);
        break;
      case "custom":
        // Every field of the pose starts from its default, so a function that leaves one out is not stale.
        out.x = out.y = out.z = 0;
        out.q[0] = out.q[1] = out.q[2] = 0;
        out.q[3] = 1;
        out.h = 100;
        out.aspect = 0.8;
        out.shape = 0;
        out.opacity = 1;
        out.live = 0;
        s.fn(i, out);
        break;
    }
  }

  private lensOfSpec(): number {
    const s = this.spec;
    switch (s.kind) {
      case "one":
        return lensOf(s.name, s.t);
      case "blend":
        return blendLens(lensOf(s.from.name, s.from.t ?? 0), lensOf(s.to.name, s.to.t ?? 0), s.t);
      case "custom":
        return s.lens;
    }
  }

  private edgesOfSpec(): number {
    const s = this.spec;
    switch (s.kind) {
      case "one":
        return edgeStrength(storyProgress(s.name, s.t));
      case "blend":
        return mix(
          edgeStrength(storyProgress(s.from.name, s.from.t ?? 0)),
          edgeStrength(storyProgress(s.to.name, s.to.t ?? 0)),
          clamp(s.t),
        );
      case "custom":
        return s.edges;
    }
  }

  /** The ranks of a blend, made again only when what they follow changes. */
  private rankFor(from: FormationRef, by: RankBy): void {
    if (
      from.name === this.rankFrom &&
      by === this.rankBy &&
      this.vp.w === this.rankW &&
      this.vp.h === this.rankH
    ) {
      return;
    }
    this.rankFrom = from.name;
    this.rankBy = by;
    this.rankW = this.vp.w;
    this.rankH = this.vp.h;
    rankCards(this.layout, { name: from.name, t: from.t ?? 0 }, by, 0, this.ranks);
  }

  private fitCamera(d: number): void {
    const cam = this.camera;
    const fov = pixelFov(this.vp.h, d);
    if (cam.position.z === d && cam.fov === fov && cam.aspect === this.vp.w / this.vp.h) return;
    cam.fov = fov;
    cam.aspect = this.vp.w / Math.max(1, this.vp.h);
    cam.position.z = d;
    cam.near = d * 0.01;
    cam.far = d * 40;
    cam.updateProjectionMatrix();
  }

  private stepPointer(x: number, y: number, nx: number, ny: number, dt: number): void {
    const live = this.pointerLive;
    // The parallax follows the pointer slowly, and goes home when it leaves.
    const k = lowpassGain(3, dt);
    this.lsx += ((live ? nx : 0) - this.lsx) * k;
    this.lsy += ((live ? -ny : 0) - this.lsy) * k;
    this.stirOn = false;
    if (!live) {
      const g = lowpassGain(8, dt);
      this.pvx -= this.pvx * g;
      this.pvy -= this.pvy * g;
      this.hasPointer = false;
      return;
    }
    if (!this.hasPointer) {
      this.lastPx = x;
      this.lastPy = y;
      this.hasPointer = true;
      return;
    }
    if (dt > 0) {
      this.pvx = smoothVelocity(this.pvx, (x - this.lastPx) / dt, dt);
      this.pvy = smoothVelocity(this.pvy, (y - this.lastPy) / dt, dt);
      const speed = stirForce(this.pvx, -this.pvy, this.stirVec);
      if (speed >= STIR_MIN && this.wakeWanted) {
        const s = this.stirData;
        s.fromX = this.lastPx;
        s.fromY = this.vp.h - this.lastPy;
        s.toX = x;
        s.toY = this.vp.h - y;
        s.forceX = this.stirVec[0];
        s.forceY = this.stirVec[1];
        this.stirOn = true;
      }
    }
    this.lastPx = x;
    this.lastPy = y;
    this.noseX = x;
    this.noseY = y;
  }

  // ---------------------------------------------------------------------------------------------
  // Pointer

  /** The nearest card whose quad holds the point (CSS px from the top left), or -1. */
  private cardAt(x: number, y: number): number {
    const clip = this.clipRect;
    if (clip && (x < clip.x || x > clip.x + clip.w || y < clip.y || y > clip.y + clip.h)) return -1;
    let best = -1;
    let bestZ = -Infinity;
    for (let i = 0; i < this.n; i++) {
      const c = this.cells[i]!;
      if (!c.quadOk || c.pose.opacity < 0.2) continue;
      if (c.pose.z <= bestZ) continue;
      if (pointInQuad(c.quad, x, y, i === this.hoverCard ? 6 : 0)) {
        best = i;
        bestZ = c.pose.z;
      }
    }
    return best;
  }

  /** The hit test of the kernel: depth from the lens (smaller is nearer), or null. */
  hitDepth(x: number, y: number): number | null {
    if (!this.visible || !this.interactive || !this.hasQuads) return null;
    const i = this.cardAt(x, y);
    return i < 0 ? null : this.lens - this.cells[i]!.pose.z;
  }

  /** The kernel has entered and left the field itself, and sets the site's cursor from `cursorLabel`. */
  hoverEntered(): void {
    this.labelShown = this.cursorLabel;
  }

  hoverLeft(): void {
    this.labelShown = null;
  }

  private showLabel(label: string | null): void {
    if (label === this.labelShown) return;
    this.labelShown = label;
    this.ctx.cursor.set(label);
  }

  pressed(x: number, y: number): void {
    this.pressCard = this.cardAt(x, y);
    this.pressX = x;
    this.pressY = y;
  }

  released(x: number, y: number): void {
    const was = this.pressCard;
    this.pressCard = -1;
    if (was < 0) return;
    if (Math.hypot(x - this.pressX, y - this.pressY) > 12) return;
    if (this.cardAt(x, y) !== was) return;
    const info = this.cardInfo(was);
    if (info) this.clickHandler?.(info);
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing

  /** True when the stage should draw this pass: shown, with the frame's poses written. */
  isDrawn(): boolean {
    return this.visible && this.updated && !this.disposed;
  }

  draw(renderer: WebGLRenderer): void {
    const target = this.target.target;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    let wakeTexture: Texture | null = null;
    if (this.wake && this.wakeWanted && this.interactive) {
      this.wake.step(renderer, this.dt, this.time, this.stirOn ? this.stirData : null);
      if (this.wake.isLive(this.time)) wakeTexture = this.wake.texture;
    }
    renderer.setRenderTarget(null);

    const clip = this.clipRect;
    if (clip) {
      renderer.setScissorTest(true);
      renderer.setScissor(clip.x, this.vp.h - clip.y - clip.h, clip.w, clip.h);
    }
    const cp = this.compositeParams;
    cp.cards = target.texture;
    cp.wake = wakeTexture;
    cp.deviceW = target.width;
    cp.deviceH = target.height;
    cp.cssW = this.vp.w;
    cp.cssH = this.vp.h;
    cp.pixel = this.dpr;
    cp.edges = this.edges;
    cp.noseX = this.noseX * this.dpr;
    cp.noseY = (this.vp.h - this.noseY) * this.dpr;
    if (clip && this.clipSoft > 0) {
      clipSoftEdges(
        clip,
        this.vp.w,
        this.vp.h,
        this.clipSoft,
        this.dpr,
        this.softBox,
        this.softWidths,
      );
      cp.clip.fromArray(this.softBox);
      cp.soft.fromArray(this.softWidths);
    } else {
      cp.clip.set(-1e6, -1e6, 1e6, 1e6);
      cp.soft.set(0, 0, 0, 0);
    }
    this.composite.render(renderer, cp);
    if (clip) renderer.setScissorTest(false);
    this.updated = false;
  }

  // ---------------------------------------------------------------------------------------------
  // Pictures

  private async loadAll(): Promise<void> {
    const portraits = this.def.portraits.map((p) => portraitSource(p));
    this.wideSources = this.def.walls.map((p) => wideSource(p));
    for (const src of [...portraits, ...this.wideSources]) {
      this.textures.set(src.id, { src, texture: null, ready: false });
    }
    this.unsubscribe = onBitmap((id) => {
      this.adopt(id);
    });
    // The hero shows the portraits at once: they are waited for.
    await Promise.all(portraits.map((src) => this.fetchInto(src)));
    // The wide pictures are not fetched here. The ones the loading list has brought are taken now,
    // the ones it brings later are taken as they arrive, and a card that turns wide before its
    // picture is in asks for it (`wantWide`), so a deferred list stays deferred.
    for (const src of this.wideSources) this.adopt(src.id);
    this.applyPictures();
  }

  /** Make the texture of a picture that is in the store and has none yet. */
  private adopt(id: string): void {
    const entry = this.textures.get(id);
    if (!entry || entry.ready || this.disposed) return;
    const bitmap = peekBitmap(id);
    if (!bitmap) return;
    this.makeTexture(entry, bitmap);
    this.applyPictures();
  }

  /** Fetch a picture (or take it from the store, or from the download running) and make its texture. */
  private async fetchInto(src: PicSource): Promise<void> {
    const entry = this.textures.get(src.id);
    if (!entry || entry.ready) return;
    const bitmap = await getBitmap(src);
    if (!bitmap || this.disposed || entry.ready) return;
    this.makeTexture(entry, bitmap);
  }

  /** A card has turned wide: whatever wide picture is still missing is wanted now. */
  private wantWide(): void {
    this.wideRequested = true;
    for (const src of this.wideSources) {
      void this.fetchInto(src).then(() => {
        this.applyPictures();
      });
    }
  }

  private makeTexture(entry: TextureEntry, bitmap: ImageBitmap): void {
    const tex = entry.texture ?? new Texture();
    tex.image = bitmap;
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = this.maxAnisotropy;
    // The GPU has the picture after the first upload: this bitmap's memory goes back.
    tex.onUpdate = () => {
      releaseBitmap(entry.src.id, bitmap);
      tex.onUpdate = () => undefined;
    };
    tex.needsUpdate = true;
    entry.texture = tex;
    entry.ready = true;
    this.uploads.push(tex);
    this.drain();
  }

  /** Upload a couple of textures a frame, so no frame pays for all twenty-eight. */
  private drain(): void {
    if (this.uploading) return;
    this.uploading = true;
    const step = (): void => {
      if (this.disposed) return;
      for (let k = 0; k < 2; k++) {
        const t = this.uploads.shift();
        if (t && !this.ctx.stage.lost) this.ctx.stage.renderer.initTexture(t);
      }
      if (this.uploads.length > 0) window.requestAnimationFrame(step);
      else this.uploading = false;
    };
    window.requestAnimationFrame(step);
  }

  private isReady(src: PicSource): boolean {
    return this.textures.get(src.id)?.ready === true;
  }

  private textureOf(src: PicSource): Texture {
    const e = this.textures.get(src.id);
    return e?.ready && e.texture ? e.texture : this.blank;
  }

  /**
   * Point every card at its two pictures. A wide picture that is not in yet shows the card's own
   * portrait in its place (cover-cropped), never a blank.
   */
  private applyPictures(): void {
    for (let i = 0; i < this.n; i++) {
      const pic = this.pictures[i]!;
      const portrait = this.def.portraits[pic.portrait]!;
      const wide = this.def.walls[pic.wide]!;
      const ps = portraitSource(portrait);
      const ws = wideSource(wide);
      const focus = focusInWindow(wide);
      const cell = this.cells[i]!;
      cell.view.setPortrait(this.textureOf(ps), ps.aspect, portrait.focus.x, portrait.focus.y);
      if (this.isReady(ws)) cell.view.setWide(this.textureOf(ws), ws.aspect, focus.x, focus.y);
      else cell.view.setWide(this.textureOf(ps), ps.aspect, portrait.focus.x, portrait.focus.y);
    }
  }

  private makeLayout(): FormationSet {
    return buildFormations(this.n, this.vp, {
      cardKeys: cardKeys(this.def, this.n),
      slotKeys: slotKeys(this.def),
    });
  }

  // ---------------------------------------------------------------------------------------------
  // The stage's calls

  resized(w: number, h: number): void {
    if (this.disposed || (w === this.vp.w && h === this.vp.h)) return;
    this.vp = { w, h };
    this.layout = this.makeLayout();
    this.pictures = assignPictures(this.def, this.layout.story.wallSlot, this.n);
    this.applyPictures();
    if (this.spec.kind === "blend") this.rankFor(this.spec.from, this.spec.by);
    this.wake?.resize(w, h);
    for (const c of this.cells) {
      c.hasPrev = false;
      c.vx = c.vy = 0;
    }
    this.updated = false;
  }

  /** The GL context was made again: the pictures on the GPU are gone, fetch them once more. */
  rebuilt(): void {
    if (this.disposed) return;
    this.uploads.length = 0;
    const redo: PicSource[] = [];
    for (const e of this.textures.values()) {
      if (!e.texture) continue;
      e.ready = false;
      redo.push(e.src);
    }
    this.applyPictures();
    this.wake?.reset();
    for (const src of redo) {
      void this.fetchInto(src).then(() => {
        this.applyPictures();
      });
    }
  }

  disposeGpu(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeHit();
    this.unsubscribe?.();
    for (const c of this.cells) c.view.dispose();
    disposeCardGeometry();
    for (const e of this.textures.values()) {
      e.texture?.dispose();
      releaseBitmap(e.src.id);
    }
    this.textures.clear();
    this.blank.dispose();
    this.target.dispose();
    this.composite.dispose();
    this.wake?.dispose();
    this.showLabel(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.removePass();
    this.disposeGpu();
  }
}
