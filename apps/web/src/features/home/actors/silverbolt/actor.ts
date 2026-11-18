/**
 * Silverbolt, the dragon of the home page: a plain class that the sections drive and the stage
 * draws in the shared cast pass. See `docs/design/home/actor-silverbolt.md` for the API and the
 * numbers. The contract in short:
 *
 *  - `place` puts it on the stage in pixels; the rest is "set the target state, every frame it is
 *    shown": `fly`, `dance`, `clip`, `jaw`, `face`, `look`, `follow`, `lids`. What a section does
 *    not set again in a frame goes back to its default (the kernel hides every actor first, so a
 *    state from another section never leaks in).
 *  - Its own motion is integrated in `update`: springs, the blink, the tail, the reactions to the
 *    pointer, the annoyed meter. A jump of the scroll snaps it, it never flies.
 *  - Comic marks are not drawn here: `onMark` says when one belongs and at which socket.
 *  - Nothing is allocated in `update`.
 */
import {
  type Bone,
  Euler,
  Group,
  type MeshStandardMaterial,
  type Object3D,
  Object3D as Node,
  type PerspectiveCamera,
  Quaternion,
  type SkinnedMesh,
  Vector2,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Actor, FrameInfo, HitTarget } from "../../kernel/types";
import { forgetGltf, loadGltf } from "../shared/gltf";
import { getCast, type Cast } from "../shared/cast";
import type { ActorCtx } from "../shared/types";
import {
  BLADE_LENGTH,
  BLADES,
  BODY_CENTRE,
  BODY_HEIGHT_M,
  BONE,
  CLIP,
  CLIP_DURATION,
  CLIP_LOOPS,
  DOLL_SOCKET_M,
  HINGE,
  JAW_ANGLE,
  JAW_AXIS,
  SB_MODEL,
  SB_NAME,
  TAIL,
  TAIL_PITCH_AXIS,
  TAIL_YAW_AXIS,
  TONGUE_AXIS,
  type ClipName,
} from "./facts";
import { FACES, Blinker, blendFace, neutralFace, type FaceName, type FaceState } from "./face";
import { HitField } from "./hit";
import { MarkBus, type MarkEvent, type MarkKind, type MarkListener } from "./marks";
import {
  clamp,
  clampDepth,
  clipJumped,
  damp,
  perspectiveFactor,
  scaleForHeight,
  smoothstep,
  softClamp,
  springSnap,
  springStep,
  unprojectToDepth,
  wrapAngle,
  type SpringState,
} from "./math";
import { disposeStandard, dress, setOutlineNdc, type SbMaterials } from "./materials";
import { AnnoyMeter, Reactions } from "./mood";
import { Pose, dancePose, flightPose, hoverPose } from "./pose";
import { Rig } from "./rig";
import { ClipSampler, clipTime } from "./sampler";
import { TailBody, dragPose, dragWeights, type DragOptions, type FollowOptions } from "./tail";

/** The parts the pointer can be on. */
export type SilverboltPart = "head" | "jaw" | "body" | "wings" | "tail";

export type SocketName =
  | "headTop"
  | "mouth"
  | "jawTip"
  | "tongue"
  | "tailTip"
  | "bodyCentre"
  | "wingL"
  | "wingR"
  | "snout"
  | "cheekL"
  | "cheekR"
  | "eyeL"
  | "eyeR";

export interface Placement {
  /** The picture-plane position of the body centre, in CSS pixels from the middle of the screen, y up. */
  x?: number;
  y?: number;
  /** Pixels toward the camera. The nearest it may come is about 0.985 of the camera distance. */
  z?: number;
  /** The on-screen height of the body block (head, wings and body, about 1 m of the model), in CSS pixels. */
  height?: number;
  /** About the vertical axis. 0 faces the camera. Positive turns the head toward screen right. */
  yaw?: number;
  /** About the dragon's own side axis. Positive lifts the nose. */
  pitch?: number;
  /** About the dragon's own head axis. Positive banks it. */
  roll?: number;
}

export interface FlyParams {
  /** Wing beats per second as a multiple of the base 1.7 Hz. */
  speed?: number;
  /** 0 is a hover, 1 the normal beat, above 1 an effort. */
  amplitude?: number;
}

export interface ClipOptions {
  /**
   * "pin" (the default): the root bone is put back to its rest place, so the clip animates the body
   * and `place` decides where and how big it is. "keep": the clip's own root path and scale (0.4 to
   * 0.64 for `city_intercation03`) stay, so the dragon moves through the world of the file, the
   * world of Selena and of `cameras.json`. Then place it with `placeWorld`.
   */
  root?: "pin" | "keep";
  /** Cross fade to a second clip (a loop into the way out). */
  blend?: { name: ClipName; time: number; weight: number };
}

/** The most the tail's tip may be dragged away from where the animation has it, as a share of its length. */
const DRAG: DragOptions = { maxPull: 0.42 };
const DRAG_OMEGA = 20;
const FOLLOW: FollowOptions = { omega: [0, 9, 7.5, 6.3, 5.4, 4.7, 4.2], zeta: 0.55 };
const BEAT_HZ = 1.7;
const DANCE_HZ = 0.95;
/** The head's turn toward the pointer, radians. */
const FOLLOW_YAW = 0.55;
const FOLLOW_UP = 0.35;
const FOLLOW_DOWN = 0.45;
/** Radians of head lag per pixel per second of the dragon's own speed, and its limit. */
const LAG_K = 2.4e-4;
const LAG_MAX = 0.3;

const SOCKET_AT: Readonly<
  Record<SocketName, { bone: string; at: readonly [number, number, number] }>
> = {
  headTop: { bone: BONE.head, at: [0, 3.93, -0.1] },
  // On the head, so it stays in the gap while the jaw swings: the middle of the open mouth (jaw 0.7).
  mouth: { bone: BONE.head, at: [0, 3.17, 0.15] },
  // On the lower jaw: the front teeth. It swings with the jaw.
  jawTip: { bone: BONE.jaw, at: [0, 3.256, 0.3] },
  tongue: { bone: BONE.tongue1, at: [0, 3.265, 0.14] },
  tailTip: { bone: TAIL[6], at: [0.029, 3.209, -3.2] },
  bodyCentre: { bone: TAIL[0], at: [0, 3.62, -0.62] },
  wingL: { bone: BLADES[0], at: [0.344, 3.553, -0.857] },
  wingR: { bone: BLADES[1], at: [-0.344, 3.553, -0.857] },
  snout: { bone: BONE.head, at: [0, 3.52, 0.52] },
  cheekL: { bone: BONE.cheekL, at: [0.305, 4.071, -0.377] },
  cheekR: { bone: BONE.cheekR, at: [-0.305, 4.071, -0.377] },
  eyeL: { bone: BONE.eyeL, at: [0.108, 3.576, 0.151] },
  eyeR: { bone: BONE.eyeR, at: [-0.108, 3.576, 0.151] },
};

const CURSOR: Readonly<Record<SilverboltPart, string>> = {
  head: "PET",
  jaw: "BOOP",
  body: "POKE",
  wings: "FLAP",
  tail: "DRAG",
};
/** What the cursor says while the dragon is annoyed. */
const CURSOR_ANNOYED: Readonly<Record<SilverboltPart, string>> = {
  head: "STOP IT",
  jaw: "GRRR",
  body: "GRRR",
  wings: "GRRR",
  tail: "LET GO",
};
/** A part that wins an overlap with another gets a smaller bias. */
const BIAS: Readonly<Record<SilverboltPart, number>> = {
  jaw: -8,
  head: -6,
  wings: -2,
  tail: 2,
  body: 6,
};
const PARTS: readonly SilverboltPart[] = ["head", "jaw", "body", "wings", "tail"];

const eulerA = new Euler();
const quatA = new Quaternion();
const quatT = new Quaternion();
const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3();
const pt = { x: 0, y: 0 };

/** What a section asked for in one frame. Two of these swap, so nothing is allocated per frame. */
class Want {
  fly = false;
  flyAmp = 1;
  dance = false;
  danceAmp = 1;
  clip = false;
  clipName: ClipName = CLIP.idle;
  clipTime = 0;
  keepRoot = false;
  blend = false;
  blendName: ClipName = CLIP.idle;
  blendTime = 0;
  blendWeight = 0;
  /** Below 0 means unset. */
  jaw = -1;
  face = false;
  faceName: FaceName = "neutral";
  faceWeight = 0;
  look = false;
  lookX = 0;
  lookY = 0;
  follow = 0;
  /** Below 0 means unset. */
  lids = -1;

  reset(): void {
    this.fly = false;
    this.dance = false;
    this.clip = false;
    this.keepRoot = false;
    this.blend = false;
    this.jaw = -1;
    this.face = false;
    this.look = false;
    this.follow = 0;
    this.lids = -1;
  }
}

export class SilverboltActor implements Actor {
  readonly name = SB_NAME;
  visible = false;
  /** The root the stage draws. `place` moves, turns and scales it. */
  readonly object = new Group();
  /** Where a ribbon trail starts: both wing tips and the tail tip. They follow the animated bones. */
  readonly trailAnchors: readonly Object3D[];
  /** The milliseconds `update` took on average (an exponential mean). The lab reads it. */
  cost = 0;

  private readonly stage: ActorCtx["stage"];
  private readonly pointer: ActorCtx["pointer"];
  private readonly cursorApi: ActorCtx["cursor"];
  private readonly cast: Cast;
  private readonly camera: PerspectiveCamera;
  private readonly puff = new Group();
  private readonly pivot = new Group();
  private readonly model: Object3D;
  private readonly rig: Rig;
  private readonly sampler: ClipSampler;
  private readonly mats: SbMaterials;
  private readonly extra: SkinnedMesh[];
  private readonly outlineSize = new Vector2();
  private outlineW = 0;
  private outlineH = 0;
  private readonly sockets = new Map<SocketName, Object3D>();
  private readonly jawTipNode: Object3D;
  private readonly bus = new MarkBus();
  private readonly removeTargets: Array<() => void> = [];
  private readonly targets: HitTarget[] = [];

  // Bones.
  private readonly iRoot: number;
  private readonly iHead: number;
  private readonly iJaw: number;
  private readonly iWing: number;
  private readonly iBlade: number[];
  private readonly bladeLen: number[];
  private readonly iCheek: [number, number];
  private readonly iCrest: number;
  private readonly iTongue: [number, number];
  private readonly iEye: [number, number];
  private readonly iTail: number[];
  private readonly tailBones: Bone[];

  // What the section last asked for.
  private pl = { x: 0, y: 0, z: 0, height: 300, yaw: 0, pitch: 0, roll: 0 };
  private world: { scale: number; set: boolean } = { scale: 1, set: false };
  private want = new Want();
  private spare = new Want();

  // Integrated state.
  private lastFrame = -1;
  private clock = 0;
  private breathPhase = 0;
  private snap = true;
  private prevX = 0;
  private prevY = 0;
  private prevScale = 1;
  private velX = 0;
  private velY = 0;
  private prevClip: ClipName | null = null;
  private prevClipTime = 0;
  private flyPhase = 0;
  private flyT: number | null = null;
  private dancePhase = 0;
  private danceT: number | null = null;
  private wFly = 0;
  private wDance = 0;
  private flyAmp = 1;
  private danceAmp = 1;
  private readonly poseHover = new Pose();
  private readonly poseFly = new Pose();
  private readonly poseDance = new Pose();
  private readonly poseFlutter = new Pose();
  private readonly pose = new Pose();
  private readonly faceCur: FaceState = neutralFace();
  private readonly faceTgt: FaceState = neutralFace();
  private readonly blinker = new Blinker();
  private readonly annoy = new AnnoyMeter();
  private readonly reactions = new Reactions();
  private readonly followYaw: SpringState = { x: 0, v: 0 };
  private readonly followPitch: SpringState = { x: 0, v: 0 };
  private readonly lookX: SpringState = { x: 0, v: 0 };
  private readonly lookY: SpringState = { x: 0, v: 0 };
  /** The light spring of the head and wings against the dragon's own velocity. */
  private readonly lagYaw: SpringState = { x: 0, v: 0 };
  private readonly lagPitch: SpringState = { x: 0, v: 0 };
  private readonly lagWing: SpringState = { x: 0, v: 0 };
  private followW = 0;
  private lastOutbursts = 0;
  private smokeAt = 0;
  private heartAt = 0;
  private sweatAt = 0;
  private hover: SilverboltPart | null = null;
  /** The hit targets answer (a section turns them off while the baked camera draws the cast). */
  private interactiveOn = true;
  private readonly hoverW: Record<SilverboltPart, number> = {
    head: 0,
    jaw: 0,
    body: 0,
    wings: 0,
    tail: 0,
  };
  private pxPerMetre = 1;

  // The tail.
  private readonly tail = new TailBody(7);
  private readonly tailBase = new Float64Array(21);
  private readonly tailSolved = new Float64Array(21);
  private readonly tailLengths = new Float64Array(6);
  private readonly tailWeights = dragWeights(7);
  private readonly pull = { target: this.tailSolved, omega: DRAG_OMEGA };
  private tailReady = false;
  private drag = { on: false, x0: 0, y0: 0 };
  private dragHeld = 0;

  // Hit cache.
  private readonly hits = new HitField(48);
  private readonly ranges: Record<SilverboltPart, { start: number; count: number }> = {
    head: { start: 0, count: 0 },
    jaw: { start: 0, count: 0 },
    body: { start: 0, count: 0 },
    wings: { start: 0, count: 0 },
    tail: { start: 0, count: 0 },
  };
  private cacheMs = -1e9;
  private readonly headWorld = new Vector3();

  private constructor(ctx: ActorCtx, gltf: GLTF) {
    this.stage = ctx.stage;
    this.pointer = ctx.pointer;
    this.cursorApi = ctx.cursor;
    this.cast = getCast(ctx.stage);
    this.camera = this.cast.pass.camera as PerspectiveCamera;
    this.model = gltf.scene;
    setOutlineNdc(this.outlineSize, ctx.stage.width, ctx.stage.height);

    this.rig = new Rig(this.model);
    const rig = this.rig;
    this.iRoot = rig.id(BONE.root);
    this.iHead = rig.id(BONE.head);
    this.iJaw = rig.id(BONE.jaw);
    this.iWing = rig.id(BONE.wingRoot);
    this.iBlade = BLADES.map((n) => rig.id(n));
    this.bladeLen = BLADES.map((n) => BLADE_LENGTH[n] ?? 0.3);
    this.iCheek = [rig.id(BONE.cheekL), rig.id(BONE.cheekR)];
    this.iCrest = rig.id(BONE.crest);
    this.iTongue = [rig.id(BONE.tongue0), rig.id(BONE.tongue1)];
    this.iEye = [rig.id(BONE.eyeL), rig.id(BONE.eyeR)];
    this.iTail = TAIL.map((n) => rig.id(n));
    this.tailBones = TAIL.map((n) => rig.bone(n));

    // The sockets are made at the rest pose, in the model's own space, before the model is moved.
    this.model.updateMatrixWorld(true);
    for (const [name, def] of Object.entries(SOCKET_AT) as Array<
      [SocketName, (typeof SOCKET_AT)[SocketName]]
    >) {
      const s = new Node();
      s.name = `sb_socket_${name}`;
      s.position.set(def.at[0], def.at[1], def.at[2]);
      this.model.add(s);
      rig.bone(def.bone).attach(s);
      this.sockets.set(name, s);
    }
    this.jawTipNode = this.socket("jawTip");
    this.trailAnchors = [this.socket("wingL"), this.socket("wingR"), this.socket("tailTip")];

    const dressed = dress(this.model, this.cast.env, this.outlineSize);
    this.mats = dressed.materials;
    this.extra = dressed.extra;

    this.pivot.add(this.model);
    this.pivot.position.set(-BODY_CENTRE[0], -BODY_CENTRE[1], -BODY_CENTRE[2]);
    this.puff.add(this.pivot);
    this.object.add(this.puff);
    this.object.visible = false;
    this.cast.add(this.object);

    this.sampler = new ClipSampler(
      gltf.animations,
      new Map(this.rig.bones.map((bone) => [bone.name, bone])),
    );

    for (const part of PARTS) this.registerPart(ctx, part);
  }

  /** Load the model and build the actor. The registry's `ensureActor` calls this once. */
  static async create(ctx: ActorCtx): Promise<SilverboltActor> {
    const gltf = await loadGltf(SB_MODEL);
    // The actor owns this parsed copy (it changes its materials and adds meshes): nobody else gets it.
    forgetGltf(SB_MODEL);
    return new SilverboltActor(ctx, gltf);
  }

  // ---------------------------------------------------------------- what a section sets

  /** Put the dragon on the stage. Set what changes; the rest stays. */
  place(p: Placement): void {
    const pl = this.pl;
    if (p.x !== undefined) pl.x = p.x;
    if (p.y !== undefined) pl.y = p.y;
    if (p.z !== undefined) pl.z = p.z;
    if (p.height !== undefined) pl.height = p.height;
    if (p.yaw !== undefined) pl.yaw = p.yaw;
    if (p.pitch !== undefined) pl.pitch = p.pitch;
    if (p.roll !== undefined) pl.roll = p.roll;
    this.world.set = false;
  }

  /**
   * Put the model's own space on the stage, for a clip played with `root: "keep"`: the same
   * position, turn and scale as Selena's actor, so the two share one world. `scale` is stage units
   * per metre.
   */
  placeWorld(
    position: { x: number; y: number; z: number },
    scale: number,
    quaternion?: Quaternion,
  ): void {
    this.pl.x = position.x;
    this.pl.y = position.y;
    this.pl.z = position.z;
    this.world.scale = scale;
    this.world.set = true;
    if (quaternion) this.object.quaternion.copy(quaternion);
    else this.object.quaternion.identity();
  }

  /** The flight loop. `t` is a clock in seconds (the frame's time or a scroll derived one). */
  fly(t: number, params?: FlyParams): void {
    const speed = params?.speed ?? 1;
    if (this.flyT === null || Math.abs(t - this.flyT) > 1.5) {
      this.flyPhase = t * speed * BEAT_HZ * Math.PI * 2;
    } else {
      this.flyPhase += (t - this.flyT) * speed * BEAT_HZ * Math.PI * 2;
    }
    this.flyT = t;
    this.want.fly = true;
    this.want.flyAmp = params?.amplitude ?? 1;
  }

  /** The dance: a bob on every beat, the wings in turn, the body swaying, a grin. */
  dance(t: number, amplitude = 1): void {
    if (this.danceT === null || Math.abs(t - this.danceT) > 1.5) {
      this.dancePhase = t * DANCE_HZ * Math.PI * 2;
    } else {
      this.dancePhase += (t - this.danceT) * DANCE_HZ * Math.PI * 2;
    }
    this.danceT = t;
    this.want.dance = true;
    this.want.danceAmp = amplitude;
  }

  /** Scrub a baked clip: a pure function of `time` (seconds). Loops wrap, the others hold their ends. */
  clip(name: ClipName, time: number, options?: ClipOptions): void {
    const w = this.want;
    w.clip = true;
    w.clipName = name;
    w.clipTime = time;
    w.keepRoot = options?.root === "keep";
    const blend = options?.blend;
    w.blend = blend !== undefined;
    if (blend) {
      w.blendName = blend.name;
      w.blendTime = blend.time;
      w.blendWeight = blend.weight;
    }
  }

  /** The jaw: 0 shut, 1 wide. Unset, the face decides (the model's own mouth is about 0.23). */
  jaw(open: number): void {
    this.want.jaw = clamp(open, 0, 1);
  }

  /**
   * Whether the pointer reaches the dragon. Persistent: a section that draws the cast through
   * another camera (the hit shapes are projected through the pixel camera) turns it off, and back on.
   */
  interactive(on: boolean): void {
    this.interactiveOn = on;
    if (!on) {
      this.hover = null;
      if (this.drag.on) this.endDrag();
    }
  }

  /** A named face, blended in by `weight` 0..1. */
  face(name: FaceName, weight = 1): void {
    this.want.face = true;
    this.want.faceName = name;
    this.want.faceWeight = clamp(weight, 0, 1);
  }

  /** Look at a point of the stage (pixels from the middle, y up): the eyes lead, the head follows a little. */
  look(x: number, y: number): void {
    this.want.look = true;
    this.want.lookX = x;
    this.want.lookY = y;
  }

  /** Follow the pointer with the eyes and the head, within limits, by `weight` 0..1. */
  follow(weight = 1): void {
    this.want.follow = clamp(weight, 0, 1);
  }

  /** Force how open the eyes are, 0 (shut) to 1.3 (wide), over the face and the blink's own. */
  lids(open: number): void {
    this.want.lids = clamp(open, 0, 1.3);
  }

  /** Close the eyes now (a reaction can call it). The dragon also blinks by itself. */
  blink(): void {
    this.blinker.now();
  }

  /** Add to the annoyed meter by hand (1 fills it). */
  annoyBy(amount: number): void {
    this.annoy.poke(amount);
  }

  /** Make a mood go at once (the meter empties, the reactions stop). */
  calm(): void {
    this.annoy.reset();
    this.reactions.clear();
  }

  /** Run a reaction by hand (a section's cue: the doll lands on the head, the dragon puffs). */
  react(kind: "shake" | "puff" | "flutter" | "chomp" | "flinch" | "yelp", strength = 1): void {
    this.reactions.trigger(kind, strength);
  }

  /** True while the dragon is in its annoyed state. */
  get annoyed(): boolean {
    return this.annoy.annoyed;
  }

  /** 0 to 1, how full the annoyed meter is. */
  get annoyance(): number {
    return this.annoy.annoyed ? 1 : this.annoy.level;
  }

  /** Subscribe to the comic marks. Returns the way to stop. */
  onMark(listener: MarkListener): () => void {
    return this.bus.on(listener);
  }

  /**
   * A point that follows the animated bone (see `SocketName`). Parent another actor's root to it
   * with `attach`, or read `getWorldPosition` each frame. The socket's space is the model's: 1 unit
   * is one metre of the 3.5 m dragon (the clips' dragon is 0.4 of that), so the doll, 0.12 m beside
   * the 1.4 m dragon, is `DOLL_SOCKET_M` (0.30) tall there.
   */
  socket(name: SocketName): Object3D {
    const s = this.sockets.get(name);
    if (!s) throw new Error(`Silverbolt has no socket "${name}"`);
    return s;
  }

  /** The stage pixels (at the dragon's depth) of one metre of the model's rest scale. */
  get metre(): number {
    return this.pxPerMetre;
  }

  /** The doll's height in a socket's space (see `socket`). */
  static readonly dollMetres = DOLL_SOCKET_M;

  // ---------------------------------------------------------------- the frame

  update(frame: FrameInfo): void {
    const start = performance.now();
    const dt = clamp(frame.dt, 0, 1 / 20);
    const gap = this.lastFrame >= 0 && frame.frame !== this.lastFrame + 1;
    this.lastFrame = frame.frame;
    this.cacheMs = start;
    this.clock += dt;
    // What the section set since the last update is read now; the setters write the other buffer.
    const want = this.want;
    this.want = this.spare;
    this.spare = want;
    this.want.reset();

    this.integrate(dt, want, gap);
    this.poseBones(dt, want);
    this.placeObject(want);
    this.object.updateMatrixWorld(true);
    this.runTail(dt);
    this.cacheHits();
    this.dressMaterials();

    // A section that stops calling `fly` or `dance` for a while loses the continuity of its clock.
    if (!want.fly) this.flyT = null;
    if (!want.dance) this.danceT = null;

    const took = performance.now() - start;
    this.cost = this.cost === 0 ? took : this.cost * 0.96 + took * 0.04;
  }

  // ---------------------------------------------------------------- integration

  private integrate(dt: number, want: Want, gap: boolean): void {
    const pl = this.pl;
    const z = clampDepth(pl.z, this.camera.position.z);
    const scale = this.world.set
      ? this.world.scale
      : scaleForHeight(pl.height, z, this.camera.position.z, BODY_HEIGHT_M);
    const dx = pl.x - this.prevX;
    const dy = pl.y - this.prevY;
    const stepPx = Math.hypot(dx, dy);
    const stepScale = Math.abs(Math.log(Math.max(1e-6, scale) / Math.max(1e-6, this.prevScale)));
    let jumped = stepPx > this.stage.height * 0.6 || stepScale > 0.7;
    // A clip that was scrubbed to another place (or another clip, or none) moved every bone at once.
    if (want.clip) {
      jumped =
        jumped ||
        this.prevClip !== want.clipName ||
        clipJumped(
          this.prevClipTime,
          want.clipTime,
          CLIP_DURATION[want.clipName],
          CLIP_LOOPS[want.clipName],
        );
      this.prevClip = want.clipName;
      this.prevClipTime = want.clipTime;
    } else {
      jumped = jumped || this.prevClip !== null;
      this.prevClip = null;
    }
    this.prevX = pl.x;
    this.prevY = pl.y;
    this.prevScale = scale;
    this.pxPerMetre = scale * perspectiveFactor(z, this.camera.position.z);
    const reset = gap || jumped || this.snap;
    if (reset) {
      this.snap = false;
      this.tailReady = false;
      springSnap(this.followYaw, 0);
      springSnap(this.followPitch, 0);
      springSnap(this.lookX, 0);
      springSnap(this.lookY, 0);
      springSnap(this.lagYaw, 0);
      springSnap(this.lagPitch, 0);
      springSnap(this.lagWing, 0);
      this.velX = 0;
      this.velY = 0;
      this.wFly = want.fly ? 1 : 0;
      this.wDance = want.dance ? 1 : 0;
      this.drag.on = false;
    } else if (stepPx > this.stage.height * 0.25) {
      // Placed somewhere else in one frame: a move of the section's, not a speed of the dragon's.
      this.velX = 0;
      this.velY = 0;
    } else if (dt > 1e-4) {
      this.velX = damp(this.velX, dx / dt, 18, dt);
      this.velY = damp(this.velY, dy / dt, 18, dt);
    }

    // Weights of the procedural poses.
    this.wFly = damp(this.wFly, want.fly ? 1 : 0, 5, dt);
    this.wDance = damp(this.wDance, want.dance ? 1 : 0, 5, dt);
    if (want.fly) this.flyAmp = damp(this.flyAmp, want.flyAmp, 6, dt);
    if (want.dance) this.danceAmp = damp(this.danceAmp, want.danceAmp, 6, dt);

    // Moods.
    this.annoy.step(dt);
    this.reactions.step(dt);
    if (this.annoy.outbursts !== this.lastOutbursts) {
      this.lastOutbursts = this.annoy.outbursts;
      this.reactions.trigger("shake", 1.4);
      this.mark("vein", "headTop", 1);
      this.mark("stars", "headTop", 0.7);
      this.blinker.now();
    }
    if (this.annoy.annoyed) {
      this.smokeAt -= dt;
      if (this.smokeAt <= 0) {
        this.smokeAt = 0.45;
        this.mark("smoke", "snout", 0.8);
      }
    } else {
      this.smokeAt = 0;
    }
    if (this.hover === "head" && !this.annoy.annoyed) {
      this.heartAt -= dt;
      if (this.heartAt <= 0) {
        this.heartAt = 1.3;
        this.mark("heart", "headTop", 0.6);
      }
    } else {
      this.heartAt = 0.4;
    }
    if (this.drag.on) {
      this.dragHeld += dt;
      this.annoy.poke(0.1 * dt);
      this.sweatAt -= dt;
      if (this.sweatAt <= 0) {
        this.sweatAt = 1.2;
        this.mark("sweat", "headTop", 0.7);
      }
    } else {
      this.dragHeld = 0;
      this.sweatAt = 0.5;
    }
    for (const part of PARTS) {
      this.hoverW[part] = damp(this.hoverW[part], this.hover === part ? 1 : 0, 10, dt);
    }

    // The face: what the section asks for, then the moods lay over it.
    const tgt = this.faceTgt;
    if (want.face) blendFace(tgt, FACES.neutral, FACES[want.faceName], want.faceWeight);
    else if (want.dance) blendFace(tgt, FACES.neutral, FACES.smile, 1);
    else blendFace(tgt, FACES.neutral, FACES.neutral, 0);
    if (!this.annoy.annoyed && this.hoverW.head > 0.01) {
      blendFace(tgt, tgt, FACES.content, 0.55 * this.hoverW.head);
    }
    blendFace(tgt, tgt, FACES.annoyed, this.annoy.anger());
    // A hard poke on the head: a growl for as long as the shake lasts.
    blendFace(tgt, tgt, FACES.growl, 0.6 * this.reactions.remaining("shake"));
    const yelp = this.reactions.value("yelp");
    if (yelp > 0) blendFace(tgt, tgt, FACES.surprised, clamp(yelp, 0, 1) * 0.8);
    if (want.lids >= 0) tgt.lid = want.lids;
    const k = 1 - Math.exp(-9 * dt);
    const cur = this.faceCur;
    cur.lid += (tgt.lid - cur.lid) * k;
    cur.slant += (tgt.slant - cur.slant) * k;
    cur.jaw += (tgt.jaw - cur.jaw) * k;
    cur.headDip += (tgt.headDip - cur.headDip) * k;
    cur.headTilt += (tgt.headTilt - cur.headTilt) * k;
    cur.glow += (tgt.glow - cur.glow) * k;
    cur.anger += (tgt.anger - cur.anger) * k;
    cur.breath += (tgt.breath - cur.breath) * k;
    cur.lash += (tgt.lash - cur.lash) * k;
    cur.flare += (tgt.flare - cur.flare) * k;
    this.breathPhase += dt * cur.breath;

    // The light spring of the head and wings: the head trails its own motion, the wings lift with speed.
    quatA.copy(this.object.quaternion).invert();
    vD.set(this.velX, this.velY, 0).applyQuaternion(quatA);
    const speed = Math.hypot(this.velX, this.velY);
    springStep(this.lagYaw, clamp(-vD.x * LAG_K, -LAG_MAX, LAG_MAX), 9, 0.45, dt);
    springStep(this.lagPitch, clamp(-vD.y * LAG_K, -LAG_MAX, LAG_MAX), 9, 0.45, dt);
    springStep(this.lagWing, clamp(speed * LAG_K, 0, LAG_MAX), 8, 0.5, dt);

    // Follow the pointer.
    const wantFollow = Math.max(want.follow, 0.65 * this.hoverW.head);
    this.followW = damp(this.followW, wantFollow, 6, dt);
    this.updateGaze(dt, want);
    this.updateCursor();
  }

  /** Where the pointer (or a `look` point) is, as angles of the head and the eyes. */
  private updateGaze(dt: number, want: Want): void {
    const state = this.pointer.state;
    const W = this.stage.width;
    const H = this.stage.height;
    let sx = 0;
    let sy = 0;
    let have = false;
    if (want.look) {
      sx = want.lookX;
      sy = want.lookY;
      have = true;
    } else if (this.hoverW.tail > 0.3 && this.tailReady) {
      const f = perspectiveFactor(this.tail.q[20]!, this.camera.position.z);
      sx = this.tail.q[18]! * f;
      sy = this.tail.q[19]! * f;
      have = true;
    } else if (state.inside || state.down) {
      sx = state.x - W / 2;
      sy = H / 2 - state.y;
      have = this.followW > 0.01 || this.hover !== null;
    }
    let tYaw = 0;
    let tPitch = 0;
    let eyeX = 0;
    let eyeY = 0;
    let weight = this.followW;
    if (want.look) weight = Math.max(weight, 0.8);
    if (have) {
      // The head's place and the point, on the plane at the head's depth, in the dragon's frame.
      const hz = this.headWorld.z;
      unprojectToDepth(sx, sy, hz, this.camera.position.z, pt);
      vA.set(pt.x - this.headWorld.x, pt.y - this.headWorld.y, 0);
      const px = vA.length() * perspectiveFactor(hz, this.camera.position.z);
      quatA.copy(this.object.quaternion).invert();
      vA.applyQuaternion(quatA);
      // A pointer in front of the screen plane looks like a point a little toward the camera.
      vA.z += px * 0.6 + 1;
      const yawAbs = Math.atan2(vA.x, vA.z);
      const pitchAbs = Math.atan2(vA.y, Math.hypot(vA.x, vA.z));
      // Near the head itself the angle means nothing: ease the follow off inside 14 to 90 px.
      const near = smoothstep(14, 90, px);
      tYaw = softClamp(wrapAngle(yawAbs), FOLLOW_YAW) * near;
      tPitch =
        softClamp(pitchAbs, pitchAbs > 0 ? FOLLOW_UP : FOLLOW_DOWN) *
        near *
        (pitchAbs > 0 ? 1 : 0.8);
      const len = Math.max(1, Math.hypot(vA.x, vA.y, vA.z));
      eyeX = clamp(vA.x / len, -1, 1) * near;
      eyeY = clamp(vA.y / len, -1, 1) * near;
    }
    springStep(this.followYaw, tYaw * weight, 11, 0.8, dt);
    springStep(this.followPitch, tPitch * weight, 11, 0.8, dt);
    const eyeW = Math.max(weight, this.hover ? 0.8 : 0);
    springStep(this.lookX, eyeX * eyeW, 22, 0.9, dt);
    springStep(this.lookY, eyeY * eyeW, 22, 0.9, dt);
  }

  /** The word the cursor shows follows the mood, also while the pointer rests on a part. */
  private updateCursor(): void {
    const part = this.hover;
    if (!part) return;
    const target = this.targets[PARTS.indexOf(part)];
    if (!target) return;
    const label = this.annoy.annoyed ? CURSOR_ANNOYED[part] : CURSOR[part];
    if (target.cursor === label) return;
    target.cursor = label;
    this.cursorApi.set(label);
  }

  // ---------------------------------------------------------------- the bones

  private poseBones(dt: number, want: Want): void {
    const rig = this.rig;
    rig.reset();

    // The base: a clip, or the rest pose.
    if (want.clip) {
      this.playClip(want);
      if (!want.keepRoot) rig.restore(BONE.root);
    }

    // The procedural pose.
    const pose = this.pose.reset();
    if (!want.clip) {
      pose.addScaled(hoverPose(this.poseHover, this.breathPhase), 1);
      if (this.wFly > 0.001) {
        pose.addScaled(flightPose(this.poseFly, this.flyPhase, this.flyAmp), this.wFly);
      }
      if (this.wDance > 0.001) {
        pose.addScaled(dancePose(this.poseDance, this.dancePhase, this.danceAmp), this.wDance);
      }
    }
    const flutter = this.reactions.value("flutter");
    if (flutter > 0.001) {
      pose.addScaled(
        flightPose(this.poseFlutter, this.clock * Math.PI * 2 * 5.5, 1.1),
        flutter * 1.3,
      );
    }
    pose.wingRoot += 0.28 * this.hoverW.wings + this.lagWing.x;
    pose.cheekSpread += 0.25 * this.hoverW.wings + 0.5 * this.faceCur.flare;

    // Wings and blades along their measured hinges.
    this.hinge(this.iWing, BONE.wingRoot, pose.wingRoot, 0);
    for (let i = 0; i < 6; i++) {
      this.hinge(this.iBlade[i]!, BLADES[i] as string, pose.blade[i]!, pose.bladeSpread[i]!);
    }
    this.hinge(this.iCheek[0], BONE.cheekL, pose.cheekRaise, pose.cheekSpread);
    this.hinge(this.iCheek[1], BONE.cheekR, pose.cheekRaise, pose.cheekSpread);
    this.hinge(this.iCrest, BONE.crest, pose.crest, 0);

    // The head: the pose, the face, the reactions and the follow, in the model's frame.
    const shake = this.reactions.value("shake");
    const flinch = this.reactions.value("flinch");
    const chomp = this.reactions.value("chomp");
    const yelp = this.reactions.value("yelp");
    const lash = this.faceCur.lash;
    const yaw =
      pose.headYaw +
      this.followYaw.x +
      this.lagYaw.x +
      shake * 0.4 +
      flinch * 0.15 * this.reactions.flinchSide;
    const pitch =
      pose.headPitch +
      this.followPitch.x +
      this.lagPitch.x -
      this.faceCur.headDip -
      yelp * 0.2 -
      chomp * 0.08 +
      flinch * 0.1;
    const roll = pose.headRoll + this.faceCur.headTilt + shake * 0.08;
    eulerA.set(-pitch, yaw, roll, "YXZ");
    quatA.setFromEuler(eulerA);
    rig.turnFrame(this.iHead, quatA);
    // The wing root rides a quarter of the head's turn (there is no neck bone).
    eulerA.set(-pitch * 0.25, yaw * 0.25, 0, "YXZ");
    quatA.setFromEuler(eulerA);
    rig.turnFrame(this.iWing, quatA);

    // The jaw, relative to the modelled mouth (angle 0).
    const talk = this.annoy.annoyed ? 0.05 * Math.sin(this.clock * 26) : 0;
    let open = want.jaw >= 0 ? want.jaw : this.faceCur.jaw;
    open = clamp(open + chomp * (1 - open) + yelp * 0.2 + talk + this.hoverW.jaw * 0.1, 0, 1);
    const angle = JAW_ANGLE.closed + open * (JAW_ANGLE.wide - JAW_ANGLE.closed);
    rig.turnLocal(this.iJaw, JAW_AXIS[0], JAW_AXIS[1], JAW_AXIS[2], angle - JAW_ANGLE.rest);
    const tongue = pose.tongue + open * 0.25;
    rig.turnLocal(
      this.iTongue[0],
      TONGUE_AXIS.tongue0[0],
      TONGUE_AXIS.tongue0[1],
      TONGUE_AXIS.tongue0[2],
      tongue,
    );
    rig.turnLocal(
      this.iTongue[1],
      TONGUE_AXIS.tongue1[0],
      TONGUE_AXIS.tongue1[1],
      TONGUE_AXIS.tongue1[2],
      tongue * 0.6,
    );

    // The eyes: squash for the lids and the blink, slant for the mood, a small slide to look.
    const rate = this.annoy.annoyed ? 2.5 : 1;
    const closed = this.blinker.step(dt, rate);
    const lid = clamp(this.faceCur.lid * (1 - closed), 0.05, 1.35);
    const slide = 0.011;
    for (let side = 0; side < 2; side++) {
      const i = this.iEye[side]!;
      const sign = side === 0 ? 1 : -1;
      rig.scaleBy(i, 1, lid, 1);
      eulerA.set(0, 0, sign * this.faceCur.slant);
      quatA.setFromEuler(eulerA);
      rig.turnFrame(i, quatA);
      rig.offsetFrame(i, this.lookX.x * slide, this.lookY.x * slide, 0);
    }

    // The tail's own wave (the body of the pose); the physics and the drag come after the matrices.
    const lashWave = lash * 0.2;
    for (let j = 0; j < 7; j++) {
      const bone = this.iTail[j]!;
      const yawJ =
        pose.tailYaw[j]! + lashWave * (0.3 + j / 8) * Math.sin(this.clock * 17 - 0.9 * j);
      rig.turnLocal(bone, TAIL_YAW_AXIS[0], TAIL_YAW_AXIS[1], TAIL_YAW_AXIS[2], yawJ);
      rig.turnLocal(
        bone,
        TAIL_PITCH_AXIS[0],
        TAIL_PITCH_AXIS[1],
        TAIL_PITCH_AXIS[2],
        pose.tailPitch[j]!,
      );
    }
    rig.apply();
  }

  private hinge(i: number, name: string, raise: number, spread: number): void {
    const h = HINGE[name];
    if (!h) return;
    this.rig.turnLocal(i, h.raise[0], h.raise[1], h.raise[2], raise);
    if (spread !== 0) this.rig.turnLocal(i, h.spread[0], h.spread[1], h.spread[2], spread);
  }

  /** Write the clip's pose (and a second clip blended in) onto the bones. */
  private playClip(want: Want): void {
    this.sampler.pose(
      want.clipName,
      clipTime(want.clipTime, CLIP_DURATION[want.clipName], CLIP_LOOPS[want.clipName]),
    );
    if (want.blend) {
      this.sampler.mix(
        want.blendName,
        clipTime(want.blendTime, CLIP_DURATION[want.blendName], CLIP_LOOPS[want.blendName]),
        clamp(want.blendWeight, 0, 1),
      );
    }
  }

  // ---------------------------------------------------------------- the group

  private placeObject(want: Want): void {
    const pl = this.pl;
    const o = this.object;
    const cam = this.camera.position.z;
    const z = clampDepth(pl.z, cam);
    const worldMode = this.world.set;
    const scale = worldMode ? this.world.scale : scaleForHeight(pl.height, z, cam, BODY_HEIGHT_M);
    o.position.set(pl.x, pl.y, z);
    o.scale.setScalar(scale);
    if (!worldMode) {
      eulerA.set(-pl.pitch, pl.yaw, pl.roll, "YXZ");
      o.quaternion.setFromEuler(eulerA);
    }
    if (worldMode || (want.clip && want.keepRoot)) {
      // The clip's own world: no sway, no bob, the model's origin on the placed point.
      this.pivot.position.set(0, 0, 0);
      this.puff.scale.setScalar(1);
      this.puff.quaternion.identity();
      return;
    }
    const p = this.pose;
    const puff = this.reactions.value("puff");
    // The body puffs on a poke and swells a little when it is angry.
    this.puff.scale.setScalar(
      1 + 0.14 * puff + 0.04 * this.hoverW.body + 0.05 * this.faceCur.anger,
    );
    eulerA.set(-p.bodyPitch, p.bodyYaw, p.bodyRoll, "YXZ");
    this.puff.quaternion.setFromEuler(eulerA);
    this.pivot.position.set(-BODY_CENTRE[0], -BODY_CENTRE[1] + p.bob, -BODY_CENTRE[2]);
  }

  // ---------------------------------------------------------------- the tail

  private runTail(dt: number): void {
    const base = this.tailBase;
    const bones = this.tailBones;
    for (let i = 0; i < 7; i++) {
      const m = bones[i]!.matrixWorld.elements;
      base[3 * i] = m[12];
      base[3 * i + 1] = m[13];
      base[3 * i + 2] = m[14];
    }
    for (let i = 0; i < 6; i++) {
      this.tailLengths[i] = Math.max(
        1e-6,
        Math.hypot(
          base[3 * i + 3]! - base[3 * i]!,
          base[3 * i + 4]! - base[3 * i + 1]!,
          base[3 * i + 5]! - base[3 * i + 2]!,
        ),
      );
    }
    if (!this.tailReady) {
      this.tail.snap(base);
      this.tailReady = true;
    }
    const cam = this.camera.position.z;
    if (this.drag.on) {
      const state = this.pointer.state;
      if (!state.down) {
        this.endDrag();
      } else {
        const tipZ = base[20]!;
        unprojectToDepth(
          state.x - this.stage.width / 2,
          this.stage.height / 2 - state.y,
          tipZ,
          cam,
          pt,
        );
        const tx = base[18]! + (pt.x - this.drag.x0);
        const ty = base[19]! + (pt.y - this.drag.y0);
        dragPose(base, this.tailLengths, this.tailWeights, tx, ty, tipZ, DRAG, this.tailSolved);
        this.tail.step(dt, base, this.tailLengths, FOLLOW, this.pull);
      }
    }
    if (!this.drag.on) this.tail.step(dt, base, this.tailLengths, FOLLOW);

    // Write the chain back as rotations: each bone aims at the next joint.
    const q = this.tail.q;
    for (let i = 0; i < 6; i++) {
      const bone = bones[i]!;
      const parent = bone.parent;
      if (!parent) continue;
      vB.set(
        q[3 * i + 3]! - q[3 * i]!,
        q[3 * i + 4]! - q[3 * i + 1]!,
        q[3 * i + 5]! - q[3 * i + 2]!,
      );
      if (vB.lengthSq() < 1e-12) continue;
      vB.normalize();
      bone.matrixWorld.decompose(vC, quatA, vD);
      vA.set(0, 1, 0).applyQuaternion(quatA);
      quatT.setFromUnitVectors(vA, vB);
      quatA.premultiply(quatT);
      parent.matrixWorld.decompose(vC, quatT, vD);
      bone.quaternion.copy(quatT.invert()).multiply(quatA);
      bone.updateMatrixWorld(true);
    }
  }

  private endDrag(): void {
    if (!this.drag.on) return;
    this.drag.on = false;
    this.tail.still();
    this.reactions.trigger("flinch", 1);
    this.reactions.flinchSide = Math.random() < 0.5 ? -1 : 1;
    this.reactions.trigger("yelp", 0.8);
  }

  // ---------------------------------------------------------------- hits and materials

  private cacheHits(): void {
    const hf = this.hits;
    const cam = this.camera.position.z;
    hf.clear();
    const m = this.rig.bones[this.iRoot]!.matrixWorld;
    const ws = m.getMaxScaleOnAxis();
    const head = this.rig.bones[this.iHead]!;
    vA.setFromMatrixPosition(head.matrixWorld);
    this.headWorld.copy(vA);
    // The way the face points: from the head bone to the middle of the eyes.
    const eL = this.rig.bones[this.iEye[0]]!.matrixWorld;
    const eR = this.rig.bones[this.iEye[1]]!.matrixWorld;
    vB.set(
      (eL.elements[12] + eR.elements[12]) / 2,
      (eL.elements[13] + eR.elements[13]) / 2,
      (eL.elements[14] + eR.elements[14]) / 2,
    );
    vC.copy(vB).sub(vA).normalize();
    const r = this.ranges;

    // Head: from the head bone along the face to the snout, and the crest above.
    let start = hf.mark();
    hf.add(
      vA.x,
      vA.y,
      vA.z,
      vA.x + vC.x * 0.62 * ws,
      vA.y + vC.y * 0.62 * ws,
      vA.z + vC.z * 0.62 * ws,
      0.27 * ws,
      cam,
    );
    r.head.start = start;
    r.head.count = hf.count(start);

    // Jaw and neck.
    start = hf.mark();
    const jaw = this.rig.bones[this.iJaw]!;
    vB.setFromMatrixPosition(jaw.matrixWorld);
    // The chin: from the hinge to the front teeth, wherever the jaw swings.
    vD.setFromMatrixPosition(this.jawTipNode.matrixWorld);
    hf.add(vB.x, vB.y, vB.z, vD.x, vD.y, vD.z, 0.11 * ws, cam);
    const neck = this.tailBones[0]!;
    vB.setFromMatrixPosition(neck.matrixWorld);
    hf.add(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, 0.2 * ws, cam);
    r.jaw.start = start;
    r.jaw.count = hf.count(start);

    // Body: the first two tail segments, thick.
    start = hf.mark();
    const b = this.tailBase;
    for (let i = 0; i < 2; i++) {
      hf.add(
        b[3 * i]!,
        b[3 * i + 1]!,
        b[3 * i + 2]!,
        b[3 * i + 3]!,
        b[3 * i + 4]!,
        b[3 * i + 5]!,
        0.3 * ws,
        cam,
      );
    }
    r.body.start = start;
    r.body.count = hf.count(start);

    // Wings: each blade from its joint to its tip, and the two cheek blades.
    start = hf.mark();
    for (let i = 0; i < 6; i++) {
      this.bladeCapsule(this.rig.bones[this.iBlade[i]!]!, this.bladeLen[i]!, 0.12, ws);
    }
    this.bladeCapsule(this.rig.bones[this.iCheek[0]]!, 0.643, 0.1, ws);
    this.bladeCapsule(this.rig.bones[this.iCheek[1]]!, 0.643, 0.1, ws);
    r.wings.start = start;
    r.wings.count = hf.count(start);

    // Tail: the animated joints from the second on (the tail swings away from the body).
    start = hf.mark();
    const q = this.tail.q;
    for (let i = 1; i < 6; i++) {
      hf.add(
        q[3 * i]!,
        q[3 * i + 1]!,
        q[3 * i + 2]!,
        q[3 * i + 3]!,
        q[3 * i + 4]!,
        q[3 * i + 5]!,
        (0.2 - 0.02 * i) * ws,
        this.camera.position.z,
      );
    }
    r.tail.start = start;
    r.tail.count = hf.count(start);
  }

  private bladeCapsule(bone: Bone, length: number, radius: number, ws: number): void {
    vB.setFromMatrixPosition(bone.matrixWorld);
    vC.setFromMatrixColumn(bone.matrixWorld, 1)
      .normalize()
      .multiplyScalar(length * ws);
    this.hits.add(
      vB.x,
      vB.y,
      vB.z,
      vB.x + vC.x,
      vB.y + vC.y,
      vB.z + vC.z,
      radius * ws,
      this.camera.position.z,
    );
  }

  private dressMaterials(): void {
    const { gem, crystal } = this.mats;
    const f = this.faceCur;
    const hot = clamp(f.anger, 0, 1);
    const lidK = clamp(f.lid, 0.2, 1.2);
    gem.emissiveIntensity = (0.55 + 0.45 * lidK) * f.glow;
    crystal.emissiveIntensity = (0.8 + 0.2 * Math.sin(this.breathPhase * 2)) * f.glow;
    gem.emissive.setRGB(1, 1 - 0.7 * hot, 1 - 0.85 * hot);
    crystal.emissive.setRGB(1, 1 - 0.6 * hot, 1 - 0.8 * hot);
    if (this.outlineW !== this.stage.width || this.outlineH !== this.stage.height) {
      this.outlineW = this.stage.width;
      this.outlineH = this.stage.height;
      setOutlineNdc(this.outlineSize, this.outlineW, this.outlineH);
    }
  }

  // ---------------------------------------------------------------- the pointer

  private registerPart(ctx: ActorCtx, part: SilverboltPart): void {
    const target: HitTarget = {
      id: `${SB_NAME}.${part}`,
      cursor: CURSOR[part],
      test: (x, y) => this.testPart(part, x, y),
      enter: () => {
        this.hover = part;
        target.cursor = this.annoy.annoyed ? CURSOR_ANNOYED[part] : CURSOR[part];
        if (part === "tail") this.reactions.trigger("flinch", 0.5);
      },
      leave: () => {
        if (this.hover === part) this.hover = null;
      },
      press: (x, y) => {
        this.press(part, x, y);
      },
      release: () => {
        if (part === "tail") this.endDrag();
      },
    };
    this.targets.push(target);
    this.removeTargets.push(ctx.pointer.add(target));
  }

  private testPart(part: SilverboltPart, x: number, y: number): number | null {
    if (!this.visible || !this.interactiveOn) return null;
    if (performance.now() - this.cacheMs > 120) return null;
    const r = this.ranges[part];
    return this.hits.test(
      r.start,
      r.count,
      x - this.stage.width / 2,
      this.stage.height / 2 - y,
      BIAS[part],
    );
  }

  private press(part: SilverboltPart, x: number, y: number): void {
    const re = this.reactions;
    const cam = this.camera.position.z;
    switch (part) {
      case "head":
        re.trigger("shake", 1);
        this.blinker.now();
        this.mark("sparks", "headTop", 1);
        this.annoy.poke(0.22);
        break;
      case "jaw":
        re.trigger("chomp", 1);
        this.mark("chomp", "mouth", 0.8);
        this.annoy.poke(0.1);
        break;
      case "body":
        re.trigger("puff", 1);
        this.mark("puff", "bodyCentre", 0.8);
        this.annoy.poke(0.1);
        break;
      case "wings":
        re.trigger("flutter", 1);
        this.mark("gust", "wingL", 0.9);
        this.mark("gust", "wingR", 0.9);
        this.annoy.poke(0.06);
        break;
      case "tail": {
        const tipZ = this.tailReady ? this.tail.q[20]! : this.pl.z;
        unprojectToDepth(x - this.stage.width / 2, this.stage.height / 2 - y, tipZ, cam, pt);
        this.drag.on = true;
        this.drag.x0 = pt.x;
        this.drag.y0 = pt.y;
        this.tail.still();
        re.trigger("yelp", 0.7);
        this.annoy.poke(0.08);
        break;
      }
    }
    if (this.annoy.annoyed && part !== "tail") re.trigger("yelp", 0.6);
  }

  private mark(kind: MarkKind, socket: SocketName, strength: number): void {
    if (this.bus.size === 0) return;
    const event: MarkEvent = { kind, socket, at: this.socket(socket), strength };
    this.bus.emit(event);
  }

  // ---------------------------------------------------------------- the lab

  /** What a probe wants to read: plain data (it allocates, so the lab calls it, never a frame). */
  snapshot(): Record<string, unknown> {
    return {
      annoyed: this.annoy.annoyed,
      meter: this.annoy.level,
      hover: this.hover,
      dragging: this.drag.on,
      costMs: this.cost,
      pxPerMetre: this.pxPerMetre,
      face: { ...this.faceCur },
      last: { ...this.spare },
    };
  }

  dispose(): void {
    for (const remove of this.removeTargets) remove();
    this.removeTargets.length = 0;
    this.cast.pass.scene.remove(this.object);
    for (const s of this.extra) s.parent?.remove(s);
    const seen = new Set<unknown>();
    this.model.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        if (seen.has(m)) continue;
        seen.add(m);
        disposeStandard(m as MeshStandardMaterial);
      }
      mesh.skeleton?.dispose();
    });
    this.mats.outline.dispose();
    forgetGltf(SB_MODEL);
  }
}
