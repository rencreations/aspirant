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
  type Object3D,
  Object3D as Node,
  type PerspectiveCamera,
  Quaternion,
  type SkinnedMesh,
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
  HEAD_DROP,
  type ClipName,
} from "./facts";
import { FACES, Blinker, blendFace, neutralFace, type FaceName, type FaceState } from "./face";
import { HitField } from "./hit";
import { leanFor, newLean } from "./lean";
import { MarkBus, type MarkEvent, type MarkKind, type MarkListener } from "./marks";
import {
  clamp,
  clampDepth,
  clipJumped,
  damp,
  facing,
  perspectiveFactor,
  scaleForHeight,
  springSnap,
  springStep,
  unprojectToDepth,
  type SpringState,
} from "./math";
import { dress, type SbMaterials } from "./materials";
import { AnnoyMeter, Reactions } from "./mood";
import { Pose, dancePose, flightPose, hoverPose } from "./pose";
import { Rig } from "./rig";
import { ClipSampler, clipTime } from "./sampler";
import { newShakeValues, shakeAt, shakeLength } from "./shake";
import {
  measureStraight,
  meanStraightAngle,
  straightAngle,
  straightTurn,
  uprightFix,
  type StraightRest,
} from "./straight";
import { TailBody, dragPose, dragWeights, type DragOptions, type FollowOptions } from "./tail";

/** The parts the pointer can be on. */
export type SilverboltPart = "body" | "wings" | "tail";

export type SocketName =
  | "headTop"
  | "mouth"
  | "bite"
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
  | "eyeR"
  // Round four: where a rider sits and holds (see `actor-silverbolt.md`, "Round four").
  | "seat"
  | "gripL"
  | "gripR"
  | "headPoint";

export interface Placement {
  /** The picture-plane position of the body centre, in CSS pixels from the middle of the screen, y up. */
  x?: number;
  y?: number;
  /** Pixels toward the camera. The nearest it may come is about 0.985 of the camera distance. */
  z?: number;
  /** The on-screen height of the body block (head, wings and body, about 1 m of the model), in CSS pixels. */
  height?: number;
  /**
   * The screen angle of the nose, radians (0 right, PI/2 up, 3 PI/4 upper left): the dragon is seen
   * in pure side view with its body axis in the screen plane. Wins over `yaw` and `pitch`.
   */
  heading?: number;
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
/** How many times a clip is sampled to find the middle of its head motion. */
const LIFT_SAMPLES = 32;
const BEAT_HZ = 1.7;
const DANCE_HZ = 0.95;
/** Radians of wing lift per pixel per second of the dragon's own speed, and its limit. */
const LAG_K = 2.4e-4;
const LAG_MAX = 0.3;
/** The default pose of a dragon nobody placed: side view, the nose to the upper left. */
const DEFAULT_YAW = -Math.PI / 2;
const DEFAULT_PITCH = 0.5;
/** Snout to tail tip at the rest scale, metres (a side view at `height` h is `h * LENGTH_M` px long). */
const LENGTH_M = 3.6;
/** How far the tip of the level tail hangs below the body's axis, radians (4 degrees: a calm long line). */
const TAIL_DROOP = 0.07;
/** The body's own calm: the breath moves the whole body by this much, uniformly (2 percent). */
const BREATH_SCALE = 0.012;

const SOCKET_AT: Readonly<
  Record<SocketName, { bone: string; at: readonly [number, number, number] }>
> = {
  // The model's rest pose hangs the head down; these two are rest points of the head, which the
  // straightening (`straight.ts`) turns up with it. `headTop` is the skull between the horns and the
  // eyes, `snout` the nose, wherever the head is.
  headTop: { bone: BONE.head, at: [0, 3.73, 0.22] },
  // On the head, so it stays in the gap while the jaw swings: the middle of the open mouth (jaw 0.7).
  mouth: { bone: BONE.head, at: [0, 3.17, 0.15] },
  // Just behind the front teeth of the closed jaw, inside the width of the skull.
  bite: { bone: BONE.head, at: [0, 3.465, 0.225] },
  // On the lower jaw: the front teeth. It swings with the jaw.
  jawTip: { bone: BONE.jaw, at: [0, 3.256, 0.3] },
  tongue: { bone: BONE.tongue1, at: [0, 3.265, 0.14] },
  tailTip: { bone: TAIL[6], at: [0.029, 3.209, -3.2] },
  bodyCentre: { bone: TAIL[0], at: [0, 3.62, -0.62] },
  wingL: { bone: BLADES[0], at: [0.344, 3.553, -0.857] },
  wingR: { bone: BLADES[1], at: [-0.344, 3.553, -0.857] },
  snout: { bone: BONE.head, at: [0, 3.33, 0.38] },
  cheekL: { bone: BONE.cheekL, at: [0.305, 4.071, -0.377] },
  cheekR: { bone: BONE.cheekR, at: [-0.305, 4.071, -0.377] },
  eyeL: { bone: BONE.eyeL, at: [0.108, 3.576, 0.151] },
  eyeR: { bone: BONE.eyeR, at: [-0.108, 3.576, 0.151] },
  // Round four. Rest points of the model (the head hangs down at rest, see `straight.ts`); the seat
  // is on the neck (the wing root, which the head's straightening barely moves), the grips and the
  // head point are on the head and follow its straightening. Placed by eye on side views.
  seat: { bone: BONE.wingRoot, at: [0, 3.86, -0.3] },
  gripL: { bone: BONE.wingRoot, at: [0.04, 3.9, -0.24] },
  gripR: { bone: BONE.wingRoot, at: [-0.04, 3.9, -0.24] },
  headPoint: { bone: BONE.head, at: [0, 3.55, 0.2] },
};

/** The head and jaw are not separate targets any more (the head is locked): the body answers. */
const CURSOR: Readonly<Record<SilverboltPart, string>> = {
  body: "POKE",
  wings: "FLAP",
  tail: "DRAG",
};
/** What the cursor says while the dragon is annoyed. */
const CURSOR_ANNOYED: Readonly<Record<SilverboltPart, string>> = {
  body: "GRRR",
  wings: "GRRR",
  tail: "LET GO",
};
/** A part that wins an overlap with another gets a smaller bias. */
const BIAS: Readonly<Record<SilverboltPart, number>> = {
  wings: -2,
  tail: 2,
  body: 0,
};
const PARTS: readonly SilverboltPart[] = ["body", "wings", "tail"];

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
  grip = 0;
  face = false;
  faceName: FaceName = "neutral";
  faceWeight = 0;
  look = false;
  lookX = 0;
  lookY = 0;
  follow = 0;
  /** Below 0 means unset. */
  lids = -1;
  /** How much of the straightening of the head is laid on (1 is all of it). */
  straight = 1;

  reset(): void {
    this.fly = false;
    this.dance = false;
    this.clip = false;
    this.keepRoot = false;
    this.blend = false;
    this.jaw = -1;
    this.grip = 0;
    this.face = false;
    this.look = false;
    this.follow = 0;
    this.lids = -1;
    this.straight = 1;
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
  private readonly sockets = new Map<SocketName, Object3D>();
  private readonly jawTipNode: Object3D;
  private readonly snoutNode: Object3D;
  private readonly bus = new MarkBus();
  private readonly removeTargets: Array<() => void> = [];
  private readonly targets: HitTarget[] = [];

  // Bones.
  private readonly iRoot: number;
  private readonly iHead: number;
  private readonly iJaw: number;
  private readonly heldJaw = new Quaternion();
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
  private pl = {
    x: 0,
    y: 0,
    z: 0,
    height: 300,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    roll: 0,
    heading: NaN,
  };
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
  private prevYaw = DEFAULT_YAW;
  private prevPitch = DEFAULT_PITCH;
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
  /** The body's answer to the pointer (`lean.ts`): slow springs, the head is locked to the body. */
  private readonly leanPitch: SpringState = { x: 0, v: 0 };
  private readonly leanRoll: SpringState = { x: 0, v: 0 };
  private readonly leanShift: SpringState = { x: 0, v: 0 };
  private readonly leanTail: SpringState = { x: 0, v: 0 };
  private readonly leanGoal = newLean();
  /** The light spring of the wings against the dragon's own velocity. */
  private readonly lagWing: SpringState = { x: 0, v: 0 };
  private followW = 0;
  /** The hard shake (round four): seconds since it started (-1 none), its strength, this frame's values. */
  private shakeAge = -1;
  private shakeStrength = 0;
  private readonly shakeNow = newShakeValues();
  /** What the rider's physics reads (`sb.motion`). Plain numbers, updated every frame. */
  readonly motion = {
    seatVel: { x: 0, y: 0, z: 0 },
    seatAcc: { x: 0, y: 0, z: 0 },
    shake: 0,
    shakeOsc: 0,
    lean: 0,
    tilt: 0,
  };
  private readonly seatPrev = new Vector3();
  private seatPrevReady = false;
  private readonly seatVelPrev = new Vector3();
  /** The straight head (`straight.ts`): what was measured at rest, and the turn made this frame. */
  private readonly straightRest: StraightRest;
  private readonly headBone: Bone;
  private readonly headBefore = new Quaternion();
  private readonly headTurn = new Quaternion();
  private readonly seatFix = new Quaternion();
  private readonly seatRest = new Quaternion();
  private readonly seatNode: Object3D;
  private readonly spine = new Vector3();
  /** Per tail joint, the pitch that lays the rest tail on the body's axis (a long body, no droop). */
  private readonly tailLevel = new Float64Array(7);
  /** The lift of the head, radians, in the rest pose and in the middle of each baked clip. */
  private readonly restLift: number;
  private readonly clipLift = new Map<string, number>();
  private lastOutbursts = 0;
  private smokeAt = 0;
  private sweatAt = 0;
  private hover: SilverboltPart | null = null;
  /** The hit targets answer (a section turns them off while the baked camera draws the cast). */
  private interactiveOn = true;
  private readonly hoverW: Record<SilverboltPart, number> = {
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

    this.rig = new Rig(this.model);
    const rig = this.rig;
    this.iRoot = rig.id(BONE.root);
    this.iHead = rig.id(BONE.head);
    this.iJaw = rig.id(BONE.jaw);
    this.heldJaw
      .copy(rig.bones[this.iJaw]!.quaternion)
      .multiply(quatA.setFromAxisAngle(vA.set(0, 0, 1), 0.22));
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
    this.snoutNode = this.socket("snout");
    this.headBone = rig.bone(BONE.head);
    this.straightRest = measureStraight(
      rig.bone(BONE.root).quaternion,
      this.headBone.quaternion,
      HEAD_DROP,
    );
    this.seatNode = this.socket("headTop");
    this.seatRest.copy(this.seatNode.quaternion);
    this.trailAnchors = [this.socket("wingL"), this.socket("wingR"), this.socket("tailTip")];

    this.mats = dress(this.model).materials;

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

    this.restLift = this.measureLifts();
    this.measureTailLevel();
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
    if (p.heading !== undefined) {
      // A heading drawn on the screen: the exact side view of the nose along it (never upside down).
      pl.heading = p.heading;
      const hx = Math.cos(p.heading);
      const f = facing(Math.abs(hx) < 1e-3 ? -1e-3 : hx, Math.sin(p.heading), 0);
      pl.yaw = f.yaw;
      pl.pitch = f.pitch;
      if (p.roll === undefined) pl.roll = 0;
    }
    this.world.set = false;
  }

  /**
   * One hard shake of the whole body, 0.8 to 1.2 s: it rattles along its own axis with a decaying
   * oscillation, the spine rolls once, the wings flare. It throws a rider off; nothing is hit.
   * `strength` 0 to 1. A shake that is running restarts at the larger of the two strengths.
   */
  shake(strength = 1): void {
    const s = clamp(strength, 0, 1);
    this.shakeStrength = this.shakeAge >= 0 ? Math.max(this.shakeStrength, s) : s;
    this.shakeAge = 0;
  }

  /** The shake's envelope, 0 to 1 (1 as it starts, 0 when it is over). */
  get shakeAmount(): number {
    return this.shakeNow.amount;
  }

  /** The shake's signed oscillation, -1 to 1 (positive is toward the tail). */
  get shakeOsc(): number {
    return this.shakeNow.osc;
  }

  /** How long the shake last asked for, seconds (0.8 to 1.2 by strength). */
  static shakeSeconds(strength: number): number {
    return shakeLength(strength);
  }

  /** Snout to tail tip at the rest scale, in metres of the model: `sb.metre * LENGTH_M` pixels in a side view. */
  static readonly LENGTH_M = LENGTH_M;

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

  /** Close around the doll while the head continues the authored turn. */
  gripDoll(weight: number): void {
    this.want.grip = clamp(weight, 0, 1);
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

  /** Lean toward a point of the stage (pixels from the middle, y up). Only the body answers: the head is locked. */
  look(x: number, y: number): void {
    this.want.look = true;
    this.want.lookX = x;
    this.want.lookY = y;
  }

  /** Lean the body toward the pointer, slowly and within small limits, by `weight` 0..1. The head does not follow. */
  follow(weight = 1): void {
    this.want.follow = clamp(weight, 0, 1);
  }

  /** Force how open the eyes are, 0 (shut) to 1.3 (wide), over the face and the blink's own. */
  lids(open: number): void {
    this.want.lids = clamp(open, 0, 1.3);
  }

  /**
   * How much of the straightening of the head is laid on this frame, 0 to 1. The model hangs its
   * head down from the neck like a seahorse; by default (1) the head is turned up into one line
   * with the body in every pose and every clip. A section that must have the file's own pose (a
   * pass that is matched to a recording) can ease it to 0.
   */
  straighten(weight: number): void {
    this.want.straight = clamp(weight, 0, 1);
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
    this.updateMotion(dt);
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
    // The nose swung round in one frame (a section changed the heading): the tail cannot follow that.
    const turned = Math.abs(pl.yaw - this.prevYaw) + Math.abs(pl.pitch - this.prevPitch);
    this.prevYaw = pl.yaw;
    this.prevPitch = pl.pitch;
    jumped = jumped || turned > 0.5;
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
      springSnap(this.leanPitch, 0);
      springSnap(this.leanRoll, 0);
      springSnap(this.leanShift, 0);
      springSnap(this.leanTail, 0);
      springSnap(this.lagWing, 0);
      this.seatPrevReady = false;
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
    // The hard shake: a pure function of its age (a jump of the scroll does not restart it).
    if (this.shakeAge >= 0) {
      this.shakeAge += dt;
      if (this.shakeAge >= shakeLength(this.shakeStrength)) this.shakeAge = -1;
    }
    if (this.shakeAge >= 0) shakeAt(this.shakeNow, this.shakeAge, this.shakeStrength);
    else shakeAt(this.shakeNow, -1, 0);
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
    if (!this.annoy.annoyed && this.hoverW.body > 0.01) {
      blendFace(tgt, tgt, FACES.content, 0.4 * this.hoverW.body);
    }
    blendFace(tgt, tgt, FACES.annoyed, this.annoy.anger());
    // A hard poke: a growl for as long as the shiver lasts. The hard shake (the throw) growls too.
    blendFace(tgt, tgt, FACES.growl, 0.6 * this.reactions.remaining("shake"));
    if (this.shakeAge >= 0) blendFace(tgt, tgt, FACES.growl, 0.7 * this.shakeNow.amount);
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

    // The light spring of the wings: they lift with the dragon's own speed (the head is locked).
    const speed = Math.hypot(this.velX, this.velY);
    springStep(this.lagWing, clamp(speed * LAG_K, 0, LAG_MAX), 8, 0.5, dt);

    // The pointer: only the body answers it, slowly. The head is one piece with the body.
    const wantFollow = Math.max(want.follow, 0.5 * this.hoverW.body);
    this.followW = damp(this.followW, wantFollow, 4, dt);
    this.updateLean(dt, want);
    this.updateCursor();
  }

  /**
   * The body's lean toward the pointer (or a `look` point): a small turn in the screen plane, a bank,
   * a shift along the body and a livelier tail, all slow and small (`lean.ts`). The head does not
   * move on its own and the eyes do not follow.
   */
  private updateLean(dt: number, want: Want): void {
    const state = this.pointer.state;
    const goal = this.leanGoal;
    let have = false;
    let sx = 0;
    let sy = 0;
    if (want.look) {
      sx = want.lookX;
      sy = want.lookY;
      have = true;
    } else if (state.inside || state.down) {
      sx = state.x - this.stage.width / 2;
      sy = this.stage.height / 2 - state.y;
      have = this.followW > 0.01;
    }
    if (have) {
      // The point on the plane at the head's depth, in the dragon's frame, in metres of the model.
      unprojectToDepth(sx, sy, this.headWorld.z, this.camera.position.z, pt);
      vA.set(pt.x - this.headWorld.x, pt.y - this.headWorld.y, 0);
      quatA.copy(this.object.quaternion).invert();
      vA.applyQuaternion(quatA);
      const metres = 1 / Math.max(1e-6, this.object.scale.x);
      leanFor(goal, vA.z * metres, vA.y * metres, Math.max(this.followW, want.look ? 0.8 : 0));
    } else {
      leanFor(goal, 0, 0, 0);
    }
    springStep(this.leanPitch, goal.pitch, 5, 1, dt);
    springStep(this.leanRoll, goal.roll, 5, 1, dt);
    springStep(this.leanShift, goal.shift, 4, 1, dt);
    springStep(this.leanTail, goal.tail, 3, 1, dt);
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
    // The head in line with the body, under every turn that follows.
    this.straightenHead(want.straight, want);

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
    // The hard shake flares the wings and the cheek blades (the body's own rattle is in `placeObject`).
    const sh = this.shakeNow;
    if (sh.amount > 0.001) {
      const flare = sh.amount;
      pose.wingRoot += 0.4 * flare * (0.7 + 0.3 * Math.sin(this.clock * 34));
      for (let i = 0; i < 6; i++) {
        pose.blade[i] = pose.blade[i]! + 0.3 * flare * Math.sin(this.clock * 29 + i * 1.3);
        pose.bladeSpread[i] = pose.bladeSpread[i]! + 0.28 * flare;
      }
      pose.cheekSpread += 0.55 * flare;
      pose.crest += 0.18 * flare * Math.sin(this.clock * 37);
    }

    // Wings and blades along their measured hinges.
    this.hinge(this.iWing, BONE.wingRoot, pose.wingRoot, 0);
    for (let i = 0; i < 6; i++) {
      this.hinge(this.iBlade[i]!, BLADES[i] as string, pose.blade[i]!, pose.bladeSpread[i]!);
    }
    this.hinge(this.iCheek[0], BONE.cheekL, pose.cheekRaise, pose.cheekSpread);
    this.hinge(this.iCheek[1], BONE.cheekR, pose.cheekRaise, pose.cheekSpread);
    this.hinge(this.iCrest, BONE.crest, pose.crest, 0);

    // The head is locked: straight, in one line with the body, looking toward the heading. It has no
    // turn of its own (no pose, no follow, no reaction); it moves only with the body.
    const chomp = this.reactions.value("chomp");
    const yelp = this.reactions.value("yelp");
    const lash = this.faceCur.lash;

    // The jaw, relative to the modelled mouth (angle 0).
    const talk = this.annoy.annoyed ? 0.05 * Math.sin(this.clock * 26) : 0;
    let open = want.jaw >= 0 ? want.jaw : this.faceCur.jaw;
    open = clamp(open + chomp * (1 - open) + yelp * 0.2 + talk, 0, 1);
    const angle = JAW_ANGLE.closed + open * (JAW_ANGLE.wide - JAW_ANGLE.closed);
    rig.turnLocal(
      this.iJaw,
      JAW_AXIS[0],
      JAW_AXIS[1],
      JAW_AXIS[2],
      (angle - JAW_ANGLE.rest) * (1 - want.grip),
    );
    if (want.grip > 0) rig.bones[this.iJaw]!.quaternion.slerp(this.heldJaw, want.grip);
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
    for (let side = 0; side < 2; side++) {
      const i = this.iEye[side]!;
      const sign = side === 0 ? 1 : -1;
      rig.scaleBy(i, 1, lid, 1);
      eulerA.set(0, 0, sign * this.faceCur.slant);
      quatA.setFromEuler(eulerA);
      rig.turnFrame(i, quatA);
    }

    // The tail's own wave (the body of the pose); the physics and the drag come after the matrices.
    // In a side view the pitch is what the eye sees, so the wave a pointer or a shake adds is a pitch
    // wave first. It travels back from the body: gentle, never a stretch.
    const lashWave = lash * 0.2;
    const lively = this.leanTail.x;
    const whip = this.shakeNow.whip;
    for (let j = 0; j < 7; j++) {
      const bone = this.iTail[j]!;
      const grow = 0.4 + (0.6 * j) / 6;
      const travel = this.clock * 3.1 - 0.85 * j;
      const yawJ =
        pose.tailYaw[j]! +
        lashWave * (0.3 + j / 8) * Math.sin(this.clock * 17 - 0.9 * j) +
        0.03 * lively * grow * Math.sin(travel + 1.2) +
        0.1 * whip * grow * Math.sin(this.clock * 52 - 1.1 * j);
      const pitchJ =
        pose.tailPitch[j]! +
        (want.clip ? 0 : this.tailLevel[j]!) +
        0.04 * lively * grow * Math.sin(travel) +
        0.12 * whip * grow * Math.sin(this.clock * 47 - 1.0 * j + 0.5);
      rig.turnLocal(bone, TAIL_YAW_AXIS[0], TAIL_YAW_AXIS[1], TAIL_YAW_AXIS[2], yawJ);
      rig.turnLocal(bone, TAIL_PITCH_AXIS[0], TAIL_PITCH_AXIS[1], TAIL_PITCH_AXIS[2], pitchJ);
    }
    rig.apply();
  }

  /**
   * The lift that puts the head in line with the spine: in the rest pose, and in the middle of each
   * baked clip (sampled over its length). Called once, with the model at rest.
   */
  private measureLifts(): number {
    const head = this.headBone;
    this.spine.subVectors(head.position, this.tailBones[0]!.position);
    const rest = straightAngle(this.straightRest, head.quaternion, this.spine);
    const samples: Quaternion[] = [];
    for (let k = 0; k < LIFT_SAMPLES; k++) samples.push(new Quaternion());
    for (const name of Object.values(CLIP)) {
      const duration = CLIP_DURATION[name];
      for (let k = 0; k < LIFT_SAMPLES; k++) {
        this.sampler.pose(name, (duration * k) / LIFT_SAMPLES);
        samples[k]!.copy(head.quaternion);
      }
      this.clipLift.set(name, meanStraightAngle(this.straightRest, samples, this.spine));
    }
    this.rig.reset();
    return rest;
  }

  /**
   * The rest tail leaves the neck steeply and bends down (about 26 degrees on the first segment): the
   * seahorse's curl. Measure, once, the pitch of each joint that lays every segment on the body's axis
   * (the line from the head joint to the first tail joint, the one the head is straightened to) with
   * a very slight droop, so the whole dragon is one long line. Called once, with the model at rest.
   */
  private measureTailLevel(): void {
    this.model.updateMatrixWorld(true);
    const pos: Vector3[] = [new Vector3(), ...this.tailBones.map(() => new Vector3())];
    this.headBone.getWorldPosition(pos[0]!);
    for (let i = 0; i < 7; i++) this.tailBones[i]!.getWorldPosition(pos[i + 1]!);
    // Elevation of a direction about the side axis: 0 along -Z (toward the tail), positive up.
    const elevation = (a: Vector3, b: Vector3): number => Math.atan2(b.y - a.y, -(b.z - a.z));
    const axis = elevation(pos[0]!, pos[1]!);
    let currentPrev = axis;
    let targetPrev = axis;
    for (let i = 0; i < 6; i++) {
      const current = elevation(pos[i + 1]!, pos[i + 2]!);
      const target = axis - TAIL_DROOP * ((i + 1) / 6);
      this.tailLevel[i] = target - targetPrev - (current - currentPrev);
      currentPrev = current;
      targetPrev = target;
    }
    this.tailLevel[6] = 0;
  }

  /** The lift to lay on the head this frame: the rest pose's, or the clip's (and the blended clip's). */
  private liftFor(want: Want): number {
    if (!want.clip) return this.restLift;
    const a = this.clipLift.get(want.clipName) ?? this.restLift;
    if (!want.blend) return a;
    const b = this.clipLift.get(want.blendName) ?? this.restLift;
    return a + (b - a) * clamp(want.blendWeight, 0, 1);
  }

  /**
   * Turn the head up about its joint so it is in line with the spine (see `straight.ts`). The doll's
   * seat on the head is turned back by the same amount so a rider stays upright.
   */
  private straightenHead(weight: number, want: Want): void {
    const head = this.headBone;
    this.headBefore.copy(head.quaternion);
    const angle = this.liftFor(want) * weight;
    straightTurn(this.headTurn, this.straightRest, angle);
    head.quaternion.premultiply(this.headTurn);
    uprightFix(this.seatFix, this.headBefore, this.headTurn);
    this.seatNode.quaternion.copy(this.seatFix).multiply(this.seatRest);
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
    const sh = this.shakeNow;
    // A poke or an old style `shake` reaction is a small jolt of the whole body, never a stretch.
    const jolt = this.reactions.value("puff");
    const shiver = this.reactions.value("shake");
    const flinch = this.reactions.value("flinch");
    // The whole body breathes by a uniform two percent at most: the proportions are the model's.
    this.puff.scale.setScalar(1 + BREATH_SCALE * Math.sin(this.breathPhase * 1.3));
    const pitch =
      p.bodyPitch + this.leanPitch.x + sh.nod + 0.05 * jolt + 0.025 * shiver + 0.03 * flinch;
    const roll = p.bodyRoll + this.leanRoll.x + sh.roll + 0.03 * shiver;
    eulerA.set(-pitch, p.bodyYaw, roll, "YXZ");
    this.puff.quaternion.setFromEuler(eulerA);
    // Along the body: the pointer's shift (toward the nose) and the shake's rattle (+ toward the tail).
    this.pivot.position.set(
      -BODY_CENTRE[0],
      -BODY_CENTRE[1] + p.bob + sh.up + 0.02 * jolt,
      -BODY_CENTRE[2] + this.leanShift.x - sh.along + 0.015 * shiver,
    );
  }

  /**
   * What the rider's physics reads (`motion`): the seat's velocity and acceleration in stage pixels,
   * the shake and the lean, the angle of the body axis on the screen. After the matrices, before the
   * hit shapes. A step that is a jump (a snap, a teleport) gives no speed.
   */
  private updateMotion(dt: number): void {
    const m = this.motion;
    const seat = this.sockets.get("seat");
    if (seat) {
      vA.setFromMatrixPosition(seat.matrixWorld);
      const far =
        Math.hypot(vA.x - this.seatPrev.x, vA.y - this.seatPrev.y) > this.stage.height * 0.25;
      if (!this.seatPrevReady || dt < 1e-4 || far) {
        m.seatVel.x = m.seatVel.y = m.seatVel.z = 0;
        m.seatAcc.x = m.seatAcc.y = m.seatAcc.z = 0;
      } else {
        vB.copy(vA)
          .sub(this.seatPrev)
          .multiplyScalar(1 / dt);
        // A light smoothing (a 60 Hz position difference of a spring driven body is noisy).
        const k = 1 - Math.exp(-40 * dt);
        vC.copy(this.seatVelPrev).lerp(vB, k);
        m.seatAcc.x = (vC.x - this.seatVelPrev.x) / dt;
        m.seatAcc.y = (vC.y - this.seatVelPrev.y) / dt;
        m.seatAcc.z = (vC.z - this.seatVelPrev.z) / dt;
        m.seatVel.x = vC.x;
        m.seatVel.y = vC.y;
        m.seatVel.z = vC.z;
      }
      this.seatPrev.copy(vA);
      this.seatVelPrev.set(m.seatVel.x, m.seatVel.y, m.seatVel.z);
      this.seatPrevReady = true;
    }
    m.shake = this.shakeNow.amount;
    m.shakeOsc = this.shakeNow.osc;
    m.lean = this.leanPitch.x;
    // The nose's direction on the screen, with the body's own lean and shake laid on.
    vB.set(0, 0, 1).applyQuaternion(this.puff.quaternion).applyQuaternion(this.object.quaternion);
    m.tilt = Math.atan2(vB.y, vB.x);
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
    // The way the head points: from the head's joint to the nose.
    vB.setFromMatrixPosition(this.snoutNode.matrixWorld);
    vC.copy(vB).sub(vA).normalize();
    const r = this.ranges;

    // Body: the head (from its joint along it to the nose), the chin, the neck and the first two
    // tail segments, thick. The head is not a target of its own any more: the body answers.
    let start = hf.mark();
    hf.add(
      vA.x,
      vA.y,
      vA.z,
      vA.x + vC.x * 0.46 * ws,
      vA.y + vC.y * 0.46 * ws,
      vA.z + vC.z * 0.46 * ws,
      0.25 * ws,
      cam,
    );
    const jaw = this.rig.bones[this.iJaw]!;
    vB.setFromMatrixPosition(jaw.matrixWorld);
    // The chin: from the hinge to the front teeth, wherever the jaw swings.
    vD.setFromMatrixPosition(this.jawTipNode.matrixWorld);
    hf.add(vB.x, vB.y, vB.z, vD.x, vD.y, vD.z, 0.11 * ws, cam);
    const neck = this.tailBones[0]!;
    vB.setFromMatrixPosition(neck.matrixWorld);
    hf.add(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, 0.2 * ws, cam);
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
    const { gem, crystal, set } = this.mats;
    const f = this.faceCur;
    const hot = clamp(f.anger, 0, 1);
    const lidK = clamp(f.lid, 0.2, 1.2);
    // The eyes: the picture, brighter with a wide eye, going red with anger.
    const eye = (0.72 + 0.28 * lidK) * Math.min(1.15, f.glow);
    gem.color.setRGB(eye, eye * (1 - 0.7 * hot), eye * (1 - 0.85 * hot));
    // The crystals glow with the breath, and go red too.
    const glow = (0.42 + 0.14 * Math.sin(this.breathPhase * 2)) * f.glow;
    crystal.setEmissive(glow, glow * (1 - 0.6 * hot), glow * (1 - 0.8 * hot));
    // The ink keeps its width in pixels: it needs the height of the body block on the screen.
    set.setHeight(this.pxPerMetre * BODY_HEIGHT_M);
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
      case "body":
        // A quiet shiver of the whole body: a small jolt, a mark, a little more annoyance.
        re.trigger("puff", 0.8);
        this.mark("puff", "bodyCentre", 0.6);
        this.annoy.poke(0.12);
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
    this.model.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      mesh.skeleton?.dispose();
    });
    // The hulls, the materials and the shared ink first, then the pictures they read.
    this.mats.set.dispose();
    for (const texture of this.mats.set.textures) texture.dispose();
    forgetGltf(SB_MODEL);
  }
}
