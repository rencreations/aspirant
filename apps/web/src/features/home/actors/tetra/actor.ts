import {
  Vector3,
  type Object3D,
  type OrthographicCamera,
  type Texture,
  type WebGLRenderer,
} from "three";

import type { Actor, FrameInfo, HitTarget, Pass } from "../../kernel/types";
import { makePixelOrthoCamera } from "../../kernel/stage";
import type { ActorCtx } from "../shared/types";

import { type Channels, restChannels } from "./channels";
import { clamp, springTo, type Sprung } from "./ease";
import { FaceState, createFaceOut, type FaceName, type FaceOut } from "./face";
import { gazeFor, type Gaze } from "./gaze";
import { PoseMixer } from "./mixer";
import { TETRA_NAME } from "./model";
import { inQuad } from "./quad";
import { type Placed, type TetraPlace, clientToStage, placeToCanvas, stageToClient } from "./place";
import { POSE_FACE, type BendKind, type PoseName } from "./poses";
import { BookState } from "./props/book";
import { BOOK_H, BookMesh } from "./props/book-mesh";
import { KiteLayer } from "./props/kite-mesh";
import { KiteSim, type CutOutcome, type KiteState } from "./props/kite-sim";
import { SpoolMesh } from "./props/spool-mesh";
import {
  applyShot,
  createPresses,
  createShot,
  pressAnswer,
  startShot,
  stepShot,
  type ShotName,
} from "./reactions";
import { TetraModel, type Marks, type Point2 } from "./scene";

/** Over the flat passes (10, 20) and the drone's back layer (25), under the cast (30) and the front drone (35). */
const ORDER = 27;
/** The longest step the actor's own clock takes in one frame. */
const DT_MAX = 0.05;
/** The scene moving more than this many screens in one frame is a jump (a scrollbar drag). */
const S_JUMP = 1.2;
/** A hand that moves this far in one frame has jumped: the rope is laid again, not dragged. */
const JUMP_PX = 700;

export type LookAt = { x: number; y: number } | "pointer" | null;
export type Side = "left" | "right";

/** The kite and its rope. Set the spot every frame it is shown; `null` puts it away. */
export interface KiteHandle {
  /** Where the kite hangs in the sky (the knot's place, the stage's frame) and how tall the sail is. */
  fly(spot: { x: number; y: number; height: number } | null): void;
  /** The rope breaks at `at` (0 her hand, 1 the kite). "fall" brings the kite down, "fly" lets it go. */
  cut(at?: number, outcome?: CutOutcome): void;
  /** The same as `cut`. */
  snap(at?: number, outcome?: CutOutcome): void;
  /**
   * How near a point of the screen (the stage's frame) is to the rope: `at` along it (0 her hand, 1 the
   * kite) and `dist` in pixels, or null when the rope is cut or the kite is away. Silverbolt crossing the
   * rope: `const r = kite.ropeNear(x, y); if (r && r.dist < 30) kite.cut(r.at)`.
   */
  ropeNear(x: number, y: number): { at: number; dist: number } | null;
  /** The rope is whole again, laid taut. */
  mend(): void;
  /** The ground a fallen kite lands on, in the stage's y (null for none). */
  ground(y: number | null): void;
  /** Run the world this many seconds at once (a jump past the cut). */
  settle(seconds: number): void;
  state(): {
    state: KiteState;
    outcome: CutOutcome;
    sinceCut: number;
    sail: { x: number; y: number; height: number; roll: number };
    reel: Point2;
    shown: boolean;
  };
}

/** The comic book in her hands. */
export interface BookHandle {
  /** How far the book is out (0 in her pocket, 1 in her hands) and how open (0 shut, 1 open). Sticky. */
  set(present: number, open: number): void;
  /** Let the pose decide (the read pose has it out and open, the close pose has it shut). */
  auto(): void;
  /** Turn a page. False when the book is not open or a page is turning. */
  turnPage(): boolean;
  /** The covers: the back cover on the left, the front cover on the right (null keeps the plain one). */
  setCovers(left: Texture | null, right: Texture | null): void;
  setCoverUrls(left: string | null, right: string | null): Promise<void>;
  /** A press on a cover. */
  onPress(fn: ((side: Side) => void) | null): void;
  /** The words the site's cursor shows over each cover. */
  labels(left: string, right: string): void;
  /** Where each cover is on the screen (four corners each, the stage's frame), or null when the book is away. */
  quads(): { left: Point2[]; right: Point2[] } | null;
}

const POSES_ALL: readonly PoseName[] = [
  "idle",
  "kite",
  "run",
  "pant",
  "wave",
  "sit",
  "read",
  "close",
  "stand",
  "bend",
  "pat",
  "hug",
];

/** How much of the pointer's look each pose keeps (the others keep all of it). */
const OWN_GAZE: Readonly<Partial<Record<PoseName, number>>> = {
  kite: 0,
  run: 0,
  read: 0,
  pant: 0.3,
  bend: 0.3,
  hug: 0.2,
  pat: 0.3,
  wave: 0.7,
  close: 0.5,
};

export class TetraActor implements Actor {
  readonly name = TETRA_NAME;
  visible = false;
  readonly object: Object3D;
  readonly kite: KiteHandle;
  readonly book: BookHandle;

  private readonly ctx: ActorCtx;
  private readonly model: TetraModel;
  private readonly kiteLayer: KiteLayer | null;
  private readonly kiteSim = new KiteSim();
  private readonly bookMesh = new BookMesh();
  private readonly bookState = new BookState();
  private readonly spool = new SpoolMesh();
  private readonly kiteCamera: OrthographicCamera;
  private readonly removers: Array<() => void> = [];
  private disposed = false;

  // What a section asks for (sticky between frames).
  private readonly placeAsk: TetraPlace = { x: 0, y: 0, height: 300 };
  private readonly placed: Placed = { markX: 0, groundY: 0, tall: 300 };
  private flip = false;
  private lookMode: LookAt = "pointer";
  private faceAskName: FaceName | null = null;
  private faceAskBlend = 1;
  private interactive = true;
  private kiteSpot: { x: number; y: number; height: number } | null = null;
  private spoolOn = false;
  private bookAuto = true;
  private bookPress: ((side: Side) => void) | null = null;
  private bookLabels = { left: "OPEN", right: "OPEN" };
  private readonly quadL: Point2[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
  private readonly quadR: Point2[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
  private quadsLive = false;

  // Her own state.
  private time = 0;
  private dt = 1 / 60;
  private lastFrame = -10;
  private readonly mixer = new PoseMixer();
  private readonly face = new FaceState();
  private readonly faceOut: FaceOut = createFaceOut();
  private readonly channels: Channels = restChannels();
  private readonly gaze: Gaze = { yaw: 0, nod: 0 };
  private readonly headYaw: Sprung = { x: 0, v: 0 };
  private readonly headNod: Sprung = { x: 0, v: 0 };
  private readonly bodyYaw: Sprung = { x: 0, v: 0 };
  private readonly eyeX: Sprung = { x: 0, v: 0 };
  private readonly eyeY: Sprung = { x: 0, v: 0 };
  private readonly eyes = { x: 0, y: 0 };
  private tweaker: ((c: Channels) => void) | null = null;
  private readonly shot = createShot();
  private pendingShot: ShotName | null = null;
  private readonly presses = createPresses();
  private emote: FaceName | null = null;
  private emoteLeft = 0;
  private hovered = false;
  private lastPose: PoseName = "idle";
  private readonly point = { x: 0, y: 0 };
  private readonly reel = { x: 0, y: 0 };
  private lastReel = { x: 0, y: 0 };
  private hasReel = false;
  private readonly nearest = { at: 0, dist: 0 };
  private snapNext = true;
  private lastS = 0;
  private readonly vA = new Vector3();
  private readonly vB = new Vector3();
  private readonly vHold = new Vector3();
  private readonly vPocket = new Vector3();
  private readonly cornerBuf: Vector3[] = [];

  constructor(ctx: ActorCtx, model: TetraModel, kiteLayer: KiteLayer | null) {
    this.ctx = ctx;
    this.model = model;
    this.kiteLayer = kiteLayer;
    this.object = model.root;
    model.props.add(this.bookMesh.root, this.spool.root);
    this.kiteCamera = makePixelOrthoCamera(ctx.stage.width, ctx.stage.height);
    this.kite = this.makeKiteHandle();
    this.book = this.makeBookHandle();

    const stage = ctx.stage;
    const pass: Pass = {
      name: "tetra",
      order: ORDER,
      active: () => !this.disposed && this.object.visible,
      render: (renderer) => {
        this.render(renderer);
      },
      resize: (w, h) => {
        this.model.resize(w, h);
        this.kiteCamera.left = -w / 2;
        this.kiteCamera.right = w / 2;
        this.kiteCamera.top = h / 2;
        this.kiteCamera.bottom = -h / 2;
        this.kiteCamera.updateProjectionMatrix();
      },
      rebuild: () => {
        this.warm();
      },
    };
    this.removers.push(stage.addPass(pass));
    this.warm();

    const body: HitTarget = {
      id: TETRA_NAME,
      cursor: "HI",
      test: (x, y) => this.hit(x, y),
      enter: () => {
        this.hovered = true;
      },
      leave: () => {
        this.hovered = false;
      },
      press: () => {
        this.onPress();
      },
    };
    this.removers.push(ctx.pointer.add(body));
    for (const side of ["left", "right"] as const) {
      // The word the cursor shows over a cover is the section's: set it through `labels`.
      const word = () => this.bookLabels[side];
      const cover: HitTarget = {
        id: `${TETRA_NAME}-book-${side}`,
        get cursor() {
          return word();
        },
        test: (x, y) => this.hitCover(side, x, y),
        press: () => {
          this.bookPress?.(side);
        },
      };
      this.removers.push(ctx.pointer.add(cover));
    }
    this.mixer.snap();
    this.face.snap();
  }

  // ---------------------------------------------------------------- what a section sets

  /** Where she stands and how tall. Call it every frame she is shown. */
  place(p: TetraPlace): void {
    this.placeAsk.x = p.x;
    this.placeAsk.y = p.y;
    this.placeAsk.z = p.z ?? 0;
    this.placeAsk.height = p.height;
    this.placeAsk.yaw = p.yaw ?? 0;
    this.placeAsk.flip = p.flip ?? false;
    this.placeAsk.origin = p.origin ?? "feet";
    const flip = p.flip ?? false;
    // The hair runs in world space: turning her round puts it back at rest, so it never whips across.
    if (flip !== this.flip) this.model.settle();
    this.flip = flip;
  }

  /** The pose and how strongly it is worn over the plain stand (0 to 1). Call it every frame. */
  pose(name: PoseName, blend = 1): void {
    this.mixer.set(name, blend);
  }

  /** How fast she runs, 0 to 1 (the cycle quickens with it). */
  runSpeed(speed: number): void {
    this.mixer.input.speed = speed;
  }

  /** Which hand waves: -1 her right (the left of the screen), 1 her left. */
  waveWith(side: number): void {
    this.mixer.input.side = side < 0 ? -1 : 1;
  }

  /** The stance of a bending pose, and where it is aimed (-1 left to 1 right). */
  bend(kind: BendKind, aim = 0): void {
    this.mixer.input.bend.kind = kind;
    this.mixer.input.bend.aim = clamp(aim, -1, 1);
  }

  /** A pat on the head from `side` (-1 her right, 1 her left), and how far she leans into it (0 to 1). */
  patFrom(side: number, lean = 1): void {
    this.mixer.input.pat.side = side < 0 ? -1 : 1;
    this.mixer.input.pat.lean = lean;
  }

  /** Where a hug goes: a point in the stage's frame (the drone's place). The arms go round it. */
  hugAt(x: number, y: number): void {
    const m = this.model.marks;
    const k = 1 / Math.max(1, m.scale);
    const side = this.flip ? -1 : 1;
    this.mixer.input.hug.x = (x - m.ground.x) * k * side;
    this.mixer.input.hug.y = (y - m.ground.y) * k;
    this.mixer.input.hug.z = 0.17;
  }

  /** A face and how strongly it is worn. With none asked for, each pose wears its own. */
  setFace(name: FaceName | null, blend = 1): void {
    this.faceAskName = name;
    this.faceAskBlend = blend;
  }

  /** A face for a while over the others, then given back. */
  emoteFace(name: FaceName, seconds = 1.2): void {
    this.emote = name;
    this.emoteLeft = seconds;
  }

  /** One of her small moves: it plays at once, or after the one that is playing. */
  play(name: ShotName): void {
    if (!startShot(this.shot, name)) this.pendingShot = name;
  }

  look(at: LookAt): void {
    this.lookMode = at;
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
  }

  /** The reel in her hands, with or without the kite (the string in a chase after the cut). */
  setReel(on: boolean): void {
    this.spoolOn = on;
  }

  /** Where her head, hands and feet are on the screen (the stage's frame), as of the last frame. */
  marks(): Marks {
    return this.model.marks;
  }

  /** A point on her that moves with the bones, as an object in her own scene (her metres). */
  socket(name: "handL" | "handR" | "head"): Object3D {
    return this.model.sockets[name];
  }

  /** The screen place of a socket (the stage's frame) and the pixels a metre is, for another actor to follow. */
  socketPoint(name: "handL" | "handR" | "head", out: { x: number; y: number; scale: number }) {
    const m = this.model.marks;
    const p = name === "head" ? m.crown : name === "handL" ? m.handL : m.handR;
    out.x = p.x;
    out.y = p.y;
    out.scale = m.scale;
    return out;
  }

  /** Put an object of her own scene (her metres) on a socket, keeping where it is. */
  attach(object: Object3D, name: "handL" | "handR" | "head"): void {
    this.model.sockets[name].attach(object);
  }

  /** Take it off again, keeping where it is. */
  detach(object: Object3D): void {
    this.model.props.attach(object);
  }

  /** A probe's hook: runs on the composed channels each frame, before they are laid on the bones. */
  tweak(fn: ((c: Channels) => void) | null): void {
    this.tweaker = fn;
  }

  /** Run her own clock this many seconds, in 1/60 s steps (probes and jumps). */
  advance(seconds: number): void {
    const step = 1 / 60;
    for (let t = 0; t < seconds - 1e-9; t += step) {
      this.tick(Math.min(step, seconds - t));
      this.draw();
    }
  }

  /** What is drawn, for a probe. */
  state() {
    return {
      pose: this.mixer.current,
      blend: this.mixer.strength,
      weights: Object.fromEntries(POSES_ALL.map((n) => [n, this.mixer.weightOf(n)])),
      face: this.faceOut,
      marks: this.model.marks,
      time: this.time,
      hovered: this.hovered,
      tall: this.placed.tall,
      shot: this.shot.name,
      channels: this.channels,
    };
  }

  // ---------------------------------------------------------------- the kernel's call

  update(frame: FrameInfo): void {
    if (this.disposed) return;
    // A frame that is not the one after the last (she was hidden) starts from what is asked at once.
    // A scrollbar drag while she stays shown has contiguous frames, so a big step of the scene counts too.
    const jumped = frame.frame !== this.lastFrame + 1 || Math.abs(frame.S - this.lastS) > S_JUMP;
    this.lastFrame = frame.frame;
    this.lastS = frame.S;
    if (jumped) {
      // What is asked is put on at once, in the tick, after the section's wants are in.
      this.snapNext = true;
      this.model.settle();
      this.hasReel = false;
    }
    this.tick(Math.min(frame.dt, DT_MAX));
    this.draw();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const remove of this.removers) remove();
    this.removers.length = 0;
    this.kiteLayer?.dispose();
    this.bookMesh.dispose();
    this.spool.dispose();
    this.model.dispose();
  }

  // ---------------------------------------------------------------- inside

  private warm(): void {
    this.model.warm(this.ctx.stage.renderer);
    this.kiteLayer?.warm(this.ctx.stage.renderer, this.kiteCamera);
  }

  private makeKiteHandle(): KiteHandle {
    return {
      fly: (spot) => {
        this.kiteSpot = spot;
      },
      cut: (at = 0.45, outcome = "fall") => {
        this.kiteSim.cut(at, outcome);
      },
      snap: (at = 0.45, outcome = "fall") => {
        this.kiteSim.cut(at, outcome);
      },
      ropeNear: (x, y) => (this.kiteSim.nearest(x, y, this.nearest) ? this.nearest : null),
      mend: () => {
        this.kiteSim.reset();
      },
      ground: (y) => {
        this.kiteSim.setFloor(y);
      },
      settle: (seconds) => {
        this.kiteSim.settle(seconds);
      },
      state: () => ({
        state: this.kiteSim.state,
        outcome: this.kiteSim.outcome,
        sinceCut: this.kiteSim.sinceCut,
        sail: {
          x: this.kiteSim.look.x,
          y: this.kiteSim.look.y,
          height: this.kiteSim.look.height,
          roll: this.kiteSim.look.roll,
        },
        reel: this.reel,
        shown: this.kiteSpot !== null,
      }),
    };
  }

  private makeBookHandle(): BookHandle {
    return {
      set: (present, open) => {
        this.bookAuto = false;
        this.bookState.wantPresent = clamp(present, 0, 1);
        this.bookState.wantOpen = clamp(open, 0, 1);
      },
      auto: () => {
        this.bookAuto = true;
      },
      turnPage: () => {
        const ok = this.bookState.turnPage();
        if (ok) this.face.restartReading();
        return ok;
      },
      setCovers: (l, r) => {
        this.bookMesh.setCovers(l, r);
      },
      setCoverUrls: (l, r) => this.bookMesh.setCoverUrls(l, r),
      onPress: (fn) => {
        this.bookPress = fn;
      },
      labels: (l, r) => {
        this.bookLabels = { left: l, right: r };
      },
      quads: () => (this.quadsLive ? { left: this.quadL, right: this.quadR } : null),
    };
  }

  private tick(dt: number): void {
    this.dt = dt;
    this.time += dt;
    const stage = this.ctx.stage;
    const input = this.mixer.input;
    input.time = this.time;
    const speed = Math.max(0.15, input.speed);
    input.phase += dt * (1.8 + 2.2 * speed);
    input.bend.phase += dt * 0.42;

    // The pose changes: from a seat to her feet she jumps up.
    const now = this.mixer.current;
    if (now !== this.lastPose) {
      const seated =
        this.lastPose === "sit" || this.lastPose === "read" || this.lastPose === "close";
      const standing = now === "stand" || now === "idle" || now === "bend";
      if (seated && standing && !this.snapNext) this.play("rise");
      this.lastPose = now;
    }
    if (this.snapNext) this.mixer.snap();
    this.mixer.step(dt, this.channels);

    // The book follows the pose unless a section holds it.
    if (this.bookAuto) {
      const read = this.mixer.weightOf("read");
      const close = this.mixer.weightOf("close");
      this.bookState.wantPresent = clamp((read + close) * 1.2, 0, 1) > 0.55 ? 1 : 0;
      this.bookState.wantOpen = read > 0.5 ? 1 : 0;
    }
    if (this.snapNext) this.bookState.snap();
    this.bookState.step(dt);

    // Where she looks: a point on the screen, in client pixels.
    const m = this.model.marks;
    let held = 0;
    const hx = stage.width / 2 + m.head.x;
    const hy = stage.height / 2 - m.head.y;
    if (this.lookMode === "pointer") {
      const p = this.ctx.pointer.state;
      if (p.inside && p.type === "mouse")
        held = gazeFor(p.x, p.y, hx, hy, this.placed.tall, this.gaze);
    } else if (this.lookMode) {
      const c = stageToClient(
        this.lookMode.x,
        this.lookMode.y,
        stage.width,
        stage.height,
        this.point,
      );
      held = gazeFor(c.x, c.y, hx, hy, this.placed.tall, this.gaze);
    }
    if (held === 0) {
      this.gaze.yaw = 0;
      this.gaze.nod = -0.04;
    }
    // The poses that look at something of their own look less at the pointer.
    const gazeWeight = this.gazeWeight();
    const yaw = (this.flip ? -this.gaze.yaw : this.gaze.yaw) * gazeWeight;
    const nod = this.gaze.nod * gazeWeight;
    springTo(this.headYaw, yaw, 7, dt);
    springTo(this.headNod, nod, 7, dt);
    springTo(this.bodyYaw, yaw * 0.3, 2.6, dt);
    springTo(this.eyeX, clamp((yaw - this.headYaw.x) * 3 + yaw * 0.5, -1, 1), 18, dt);
    springTo(this.eyeY, clamp(-(nod - this.headNod.x) * 3 - nod * 0.8, -1, 1), 18, dt);
    this.eyes.x = this.flip ? -this.eyeX.x : this.eyeX.x;
    this.eyes.y = this.eyeY.x;

    // Her small move and her emote.
    if (!stepShot(this.shot, dt) && this.pendingShot) {
      startShot(this.shot, this.pendingShot);
      this.pendingShot = null;
    }
    if (this.emoteLeft > 0) this.emoteLeft -= dt;

    if (this.emoteLeft > 0 && this.emote) this.face.set(this.emote, 1);
    else if (this.faceAskName) this.face.set(this.faceAskName, this.faceAskBlend);
    else if (this.hovered && gazeWeight > 0.5) this.face.set("happy", 0.7);
    else this.face.set(POSE_FACE[this.mixer.current], Math.max(0.0001, this.mixer.strength));
    if (this.snapNext) this.face.snap();
    this.snapNext = false;
    this.face.step(dt, this.eyes, this.faceOut);

    const c = this.channels;
    c.head.y += this.headYaw.x;
    c.head.x += this.headNod.x;
    c.spine.y += this.bodyYaw.x;
    c.yaw += this.placeAsk.yaw ?? 0;
    applyShot(this.shot, c);
    this.tweaker?.(c);
  }

  /** How much of the pointer's look she keeps in the pose she is in. */
  private gazeWeight(): number {
    const w = this.mixer.strength;
    const k = OWN_GAZE[this.mixer.current] ?? 1;
    return 1 + (k - 1) * w;
  }

  private draw(): void {
    const stage = this.ctx.stage;
    const placed = placeToCanvas(this.placeAsk, stage.width, stage.height, this.placed);
    this.model.frame({
      width: stage.width,
      height: stage.height,
      markX: placed.markX,
      groundY: placed.groundY,
      tall: placed.tall,
      flip: this.flip,
    });
    this.model.pose(this.channels, this.faceOut, this.dt);
    this.model.readMarks();
    this.followProps();
  }

  /** The reel, the book and the kite, laid where her hands came out this frame. */
  private followProps(): void {
    const model = this.model;
    const sockets = model.sockets;
    const c = this.channels;
    const kiteOn = this.kiteSpot !== null && this.kiteLayer !== null;
    // The reel sits between her hands while she holds it with both, in her right hand otherwise.
    sockets.handL.getWorldPosition(this.vA);
    sockets.handR.getWorldPosition(this.vB);
    const both = this.mixer.weightOf("kite");
    const spoolOn = kiteOn || this.spoolOn;
    this.spool.root.visible = spoolOn;
    if (spoolOn) {
      this.vHold.copy(this.vB).lerp(this.vA, 0.5 * both);
      if (both > 0.5) this.vHold.copy(this.vA).add(this.vB).multiplyScalar(0.5);
      this.spool.root.position.copy(this.vHold).add(this.vPocket.set(0, 0.012, 0.045));
      this.spool.root.rotation.set(0, 0, 0);
    }
    // The book is out when the pose, or the section, says so.
    this.vHold
      .copy(this.vA)
      .add(this.vB)
      .multiplyScalar(0.5)
      .add(this.vPocket.set(0, BOOK_H * 0.5 - 0.035, 0.012));
    this.vPocket.copy(this.vB).add(this.vA.set(0.06, 0.02, -0.15));
    this.bookMesh.update(this.bookState, this.vHold, this.vPocket);
    const flip = this.flip ? -1 : 1;
    this.bookMesh.root.rotation.order = "YXZ";
    this.bookMesh.root.rotation.set(-0.3 + c.pitch, flip * (c.yaw + 0.0), c.roll);
    this.quadsLive = this.bookMesh.shown;
    if (this.quadsLive) {
      this.bookMesh.root.updateMatrixWorld(true);
      this.projectQuad("left", this.quadL);
      this.projectQuad("right", this.quadR);
    }

    // The kite: the rope is held at the reel's top.
    const layer = this.kiteLayer;
    if (layer && kiteOn && this.kiteSpot) {
      this.vA.copy(this.spool.root.position).add(this.vPocket.set(0, 0.03, 0));
      model.toStage(this.vA, this.reel);
      const jump =
        this.hasReel &&
        Math.hypot(this.reel.x - this.lastReel.x, this.reel.y - this.lastReel.y) > JUMP_PX;
      this.lastReel.x = this.reel.x;
      this.lastReel.y = this.reel.y;
      const sim = this.kiteSim;
      sim.setHand(this.reel.x, this.reel.y);
      sim.setSpot(this.kiteSpot.x, this.kiteSpot.y, this.kiteSpot.height);
      if (sim.state === "tethered" && (!this.hasReel || jump)) sim.reset();
      this.hasReel = true;
      sim.step(this.dt);
      layer.update(sim, this.time, 1);
    } else {
      layer?.hide();
    }
  }

  /** The four corners of a cover on the screen. */
  private projectQuad(side: Side, quad: Point2[]): void {
    this.bookMesh.corners(side, this.cornerBuf);
    for (let i = 0; i < 4; i += 1) {
      const corner = this.cornerBuf[i];
      const p = quad[i];
      if (corner && p) this.model.toStage(corner, p);
    }
  }

  private render(renderer: WebGLRenderer): void {
    // The sail and its tail first (they are far behind her), then her, then the rope, which runs from the reel in front of her.
    const kite = this.kiteLayer?.visible ? this.kiteLayer : null;
    if (kite) {
      renderer.render(kite.scene, this.kiteCamera);
      renderer.clearDepth();
    }
    this.model.draw(renderer);
    if (kite) {
      renderer.clearDepth();
      renderer.render(kite.ropes, this.kiteCamera);
    }
  }

  private onPress(): void {
    if (!this.interactive || !this.visible) return;
    const a = pressAnswer(this.presses, this.time);
    this.play(a.shot);
    this.emoteFace(a.face, a.seconds);
  }

  private hit(cx: number, cy: number): number | null {
    if (!this.visible || !this.interactive || this.disposed) return null;
    const stage = this.ctx.stage;
    const p = clientToStage(cx, cy, stage.width, stage.height, this.point);
    const m = this.model.marks;
    const r = 0.2 * m.scale;
    const dh = Math.hypot(p.x - m.head.x, p.y - m.head.y);
    const dc = Math.hypot(p.x - m.chest.x, p.y - m.chest.y);
    if (dh > r && dc > 0.75 * r) return null;
    return 300;
  }

  private hitCover(side: Side, cx: number, cy: number): number | null {
    if (!this.visible || !this.quadsLive || this.disposed || this.bookState.open.x < 0.5)
      return null;
    const stage = this.ctx.stage;
    const p = clientToStage(cx, cy, stage.width, stage.height, this.point);
    return inQuad(side === "left" ? this.quadL : this.quadR, p.x, p.y) ? 200 : null;
  }
}

/** Build her: the model and the kite's pictures load in parallel (through the media store). */
export async function buildTetra(ctx: ActorCtx): Promise<TetraActor> {
  const [model, kite] = await Promise.all([TetraModel.load(), KiteLayer.load()]);
  return new TetraActor(ctx, model, kite);
}
