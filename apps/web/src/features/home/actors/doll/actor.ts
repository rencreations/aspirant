/**
 * The Obsidia doll: a plain class, no React. She is the lit skinned doll of `doll.glb` drawn in the
 * home's shared cast pass, with a face that is drawn by a shader (24 expressions, a blend between
 * any two, an automatic blink, eyes that look, a mouth that talks), poses authored as turns about
 * the model's axes with a procedural layer on top (flail, run lean, breath, a head on a spring,
 * squash and stretch), a baked walk that can be scrubbed by distance, sockets for other actors,
 * a hit target with small reactions and a faked hang by one hand. See `docs/design/home/actor-doll.md`.
 *
 * A section drives her by SETTING THE STATE every frame it shows her (`place`, `pose`, `face`,
 * ...); `update` integrates her own motion toward it. One-shot reactions (a hop, a squeak, a blink)
 * are timed in here and always finish.
 *
 * The hierarchy: `root` (position, rotation, scale: what `place` and `attach` move) > `squash`
 * (scale about the pivot) > `shift` (puts the pivot at the origin) > the GLB's own group.
 */
import {
  Color,
  Group,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  Vector4,
  type AnimationClip,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { Actor, FrameInfo } from "../../kernel/types";
import type { Cast } from "../shared/cast";
import { forgetGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";

import { FACE_FRAME, type FaceName } from "./face/presets";
import { FACE_ARRAY_LENGTH, FACES, applyLive, autoBlink, mixFaces, swapsEyes } from "./face/mix";
import {
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
} from "./face/shader";
import { moodAt, type MoodStep } from "./face/sequence";
import { HANG_POSE, hangSway, rollToHang, wrapPi } from "./hang";
import { Reactions, type ReactionKind } from "./interaction";
import { Spring, approach, at, clamp } from "./motion";
import {
  clientToStage,
  depthScale,
  fitScale,
  hitDepth,
  insideCapsule,
  insideCircle,
  projectToStage,
  rootScale,
} from "./place";
import { addBreath, addDangle, addFlail, addHead, addRunLean, BONE } from "./pose/layers";
import {
  BONE_COUNT,
  BONE_NAMES,
  applyTurns,
  blendPoseData,
  buildBind,
  compilePose,
  copyPoseData,
  createPoseData,
  stretchArm,
  type PoseData,
} from "./pose/math";
import { POSES, type PoseDef, type PoseName } from "./pose/poses";
import { WalkSampler } from "./pose/walk";
import { DOLL_HEIGHT, FACE_POINTS, RIG_BONES, WALK_SECONDS } from "./rig";

type Pivot = "feet" | "hips" | "center" | "head" | "handL" | "handR";

export interface DollPlacement {
  /** Where the pivot stands, in stage pixels (origin at the middle of the screen, y up). */
  x: number;
  y: number;
  /** Her on-screen height in CSS pixels, feet to the crown of the hair, standing. */
  height: number;
  /** Toward the camera, in pixels. 0 is the picture plane. */
  z?: number;
  /** Turn about her vertical axis, radians. 0 faces the screen. */
  yaw?: number;
  /** Tip about the screen's X axis, radians. */
  pitch?: number;
  /** Turn in the screen plane, radians, counter-clockwise. */
  roll?: number;
  /** The point the placement and the rotations are about. Default the feet. */
  pivot?: Pivot;
}

export type DollSocketName =
  "handL" | "handR" | "headTop" | "head" | "mouth" | "cheekL" | "cheekR" | "hips";

export interface AttachOptions {
  /** Keep her world transform at the moment of the attach (default). False: she sits at the socket's origin, upright. */
  keepWorld?: boolean;
}

export interface DollStats {
  /** Rolling average of `update`, milliseconds. */
  updateMs: number;
  frames: number;
  /** The work `warm()` did the first time, milliseconds: the whole, and the part that was the program. */
  warmMs: number;
  warmCompileMs: number;
}

/** What a mark layer can ask for: a point of her in stage pixels and how big a file unit is there. */
export interface MarkPoint {
  x: number;
  y: number;
  /** How much larger than at z = 0 the point is drawn. */
  s: number;
  /** Stage pixels per unit of the doll's own file (1.7 units tall). */
  unit: number;
}

const PIVOT_POINTS: Readonly<
  Record<Exclude<Pivot, "handL" | "handR">, readonly [number, number, number]>
> = {
  feet: [0, 0, 0],
  hips: [0, 0.396, 0],
  center: [0, 0.85, 0],
  head: [0, 1.05, 0],
};

/** The hit shapes, in the doll's own units: a circle for the head and hair, capsules for the body. */
const HEAD_HIT = { y: 1.15, r: 0.56 } as const;
const BODY_HIT_R = 0.17;
const LEG_HIT_R = 0.1;
/** The hop of a hover, as a share of her height. */
const HOP_SHARE = 0.07;
/** How fast the stretch of a fall comes on: at this many heights a second the doll is stretched to `MAX_STRETCH`. */
const STRETCH_SPEED = 7;
const MAX_STRETCH = 0.16;
/** A step bigger than this many heights in a frame is a jump: nothing springs over it. */
const JUMP_HEIGHTS = 1.2;
/** The light trim of the doll inside the shared rig (see `docs/design/home/actor-doll.md`). */
const DEFAULT_LIGHT = { direct: 0.45, ambient: 0.7, env: 0.45 } as const;

/** The next animation frame, or 40 ms later where there are none (a hidden tab). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, 40);
    requestAnimationFrame(() => {
      clearTimeout(id);
      resolve();
    });
  });
}

const _v = new Vector3();
const _m = new Matrix4();
const _s = new Vector3();
const _own = new Vector3();

export class DollActor implements Actor {
  readonly name = "doll";
  visible = false;
  readonly object: Group;
  readonly stats: DollStats = { updateMs: 0, frames: 0, warmMs: 0, warmCompileMs: 0 };
  /** Called when she is touched: a hover, a press or a dizzy spell began. Marks (stars, sweat) hang on this. */
  onReact: ((kind: ReactionKind) => void) | null = null;

  private readonly root = new Group();
  private readonly squashNode = new Group();
  private readonly shift = new Group();
  private readonly model: Group;
  private readonly body: SkinnedMesh;
  private readonly bones: Bone[] = [];
  private readonly sockets = new Map<DollSocketName, Object3D>();
  private readonly bind = buildBind();
  private readonly cast: Cast;
  private readonly ctx: ActorCtx;
  private readonly gltfPath: string;
  private readonly walkSampler: WalkSampler | null;
  private readonly material: MeshStandardMaterial;
  private readonly uniforms: {
    uFaceF: { value: Float32Array };
    uFaceFrame: { value: Vector4 };
    uIrisL: { value: Color };
    uIrisR: { value: Color };
    uInk: { value: Color };
    uDollLight: { value: Vector2 };
  };
  private removeHit: (() => void) | null = null;
  private disposed = false;

  // Placement, as the section set it.
  private px = 0;
  private py = 0;
  private pz = 0;
  private pheight = 100;
  private pyaw = 0;
  private ppitch = 0;
  private proll = 0;
  private ppivot: Pivot = "feet";
  private attachedTo: Object3D | null = null;
  private lastX = 0;
  private lastY = 0;
  private haveLast = false;
  private lastFrame = -10;
  private updatedAt = -1e9;

  // Pose and body layers.
  private readonly poses = new Map<PoseName | "hang", PoseData>();
  private poseA: PoseName = "stand";
  private poseB: PoseName = "stand";
  private poseW = 0;
  private readonly work = createPoseData();
  private readonly walkBuf = createPoseData();
  private readonly turns = new Float32Array(BONE_COUNT * 3);
  private walkWeight = 0;
  private walkPhase = 0;
  private walkRate = 1;
  private walkLean = 0;
  private walkByTime = true;
  private flailAmount = 0;
  private flailRate = 1;
  private dangleAmount = 0;
  private squashTarget = 0;
  private stretchL = 0;
  private stretchR = 0;
  private hangW = 0;
  private readonly hangVec = new Vector3();
  private hangSwing = 1;
  private hangKickAt = -100;
  private hangKickSize = 0;
  private clock = 0;
  private readonly headRoll = new Spring(15, 0.3);
  private readonly headNod = new Spring(15, 0.32);
  private readonly lookTurn = new Spring(16, 1);
  private readonly lookNodSpring = new Spring(16, 1);
  private readonly squashSpring = new Spring(24, 0.35);
  private readonly lookX = new Spring(26, 1);
  private readonly lookY = new Spring(26, 1);

  // Face.
  private readonly faceFrom = new Float32Array(FACE_ARRAY_LENGTH);
  private faceTarget: Float32Array = FACES.neutral;
  private faceT = 1;
  private faceDur = 0.14;
  // A face that is a pure function of a weight (`face`, `setFace`, `mood`): no allocation per call.
  private mixOn = false;
  private mixA: Float32Array = FACES.neutral;
  private mixB: Float32Array = FACES.neutral;
  private mixW = 0;
  private readonly base = new Float32Array(FACE_ARRAY_LENGTH);
  private readonly shown = new Float32Array(FACE_ARRAY_LENGTH);
  private overFace: Float32Array = FACES.neutral;
  private overW = 0;
  private talkAmount = 0;
  private readonly live = { blink: 0, lookX: 0, lookY: 0, talk: 0, t: 0 };
  private readonly moodOut: { a: FaceName; b: FaceName; w: number } = {
    a: "neutral",
    b: "neutral",
    w: 0,
  };
  private autoBlinkOn = true;
  private lookAt: { x: number; y: number } | null = null;
  private hovered = false;

  // Interaction.
  private readonly reactions = new Reactions();
  private interactive = true;
  private readonly hit = {
    headX: 0,
    headY: 0,
    headR: 0,
    neckX: 0,
    neckY: 0,
    hipX: 0,
    hipY: 0,
    footLX: 0,
    footLY: 0,
    footRX: 0,
    footRY: 0,
    bodyR: 0,
    legR: 0,
    depth: 0,
  };
  private readonly tmpStage = { x: 0, y: 0 };
  private readonly tmpMark = { x: 0, y: 0, s: 1 };

  constructor(ctx: ActorCtx, gltf: GLTF, path: string, cast: Cast) {
    this.ctx = ctx;
    this.cast = cast;
    this.gltfPath = path;
    this.object = this.root;
    this.root.name = "doll-root";
    this.root.rotation.order = "ZXY";
    this.root.visible = false;

    this.model = cloneSkinned(gltf.scene) as Group;
    let body: SkinnedMesh | null = null;
    this.model.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && o.name === "doll_body") body = o as SkinnedMesh;
    });
    if (!body) throw new Error("doll: the model has no doll_body");
    this.body = body;
    // The skinned bounds are the bind pose's: a fall or a hang would be culled wrongly.
    this.body.frustumCulled = false;
    this.bones = BONE_NAMES.map((n) => {
      const bone = this.body.skeleton.bones.find((b) => b.name === n);
      if (!bone) throw new Error(`doll: the model has no bone ${n}`);
      return bone;
    });

    this.material = this.wireMaterial(this.body.material as MeshStandardMaterial);
    this.body.material = this.material;
    this.uniforms = this.makeUniforms();
    this.installShader();

    this.root.add(this.squashNode);
    this.squashNode.add(this.shift);
    this.shift.add(this.model);
    cast.add(this.root);

    this.buildSockets();
    const clip = gltf.animations.find((a: AnimationClip) => a.name === "walk") ?? null;
    this.walkSampler = clip ? new WalkSampler(clip) : null;
    for (const name of Object.keys(POSES) as PoseName[]) {
      this.poses.set(name, compilePose(this.bind, POSES[name]));
    }
    this.poses.set("hang", compilePose(this.bind, HANG_POSE));
    copyPoseData(this.work, this.poses.get("stand") ?? this.work);
    this.measureHang();
    this.faceFrom.set(FACES.neutral);
    this.base.set(FACES.neutral);

    this.removeHit = ctx.pointer.add({
      id: "doll",
      cursor: "POKE",
      test: (x, y) => this.hitTest(x, y),
      enter: () => {
        this.hovered = true;
        if (this.interactive) this.reactions.enter();
      },
      leave: () => {
        this.hovered = false;
      },
      press: () => {
        if (this.interactive) this.reactions.press(Math.random());
      },
    });
  }

  // ---------------------------------------------------------------------------------------------
  // The state a section sets, every frame it shows her.

  /** Where she stands and how big. Omitted fields go back to their defaults: the call sets the whole placement. */
  place(p: DollPlacement): void {
    this.px = p.x;
    this.py = p.y;
    this.pz = p.z ?? 0;
    this.pheight = p.height;
    this.pyaw = p.yaw ?? 0;
    this.ppitch = p.pitch ?? 0;
    this.proll = p.roll ?? 0;
    this.ppivot = p.pivot ?? "feet";
  }

  /** `name` at weight `w` over the plain standing pose. */
  pose(name: PoseName, w = 1): void {
    this.setPose("stand", name, w);
  }

  /** A blend of two poses: `a` at w 0, `b` at w 1. Scrub it with a scroll. */
  setPose(a: PoseName, b: PoseName, w: number): void {
    this.poseA = a;
    this.poseB = b;
    this.poseW = clamp(w, 0, 1);
  }

  /**
   * The baked walk on top of the pose, at `weight` 0 to 1. Pass `phase` (cycles, any number) to
   * scrub it by distance (`walkPhaseFor` in motion.ts), or leave it out and she walks by time at `rate`
   * (1 is the clip's own speed, 1.8 and more is a run). `lean` 0 to 1 is the forward run lean.
   */
  walk(weight: number, opts: { phase?: number; rate?: number; lean?: number } = {}): void {
    this.walkWeight = clamp(weight, 0, 1);
    this.walkRate = opts.rate ?? 1;
    this.walkLean = opts.lean ?? 0;
    if (opts.phase !== undefined) this.walkPhase = opts.phase;
    this.walkByTime = opts.phase === undefined;
  }

  /** The flail of a fall, 0 to 1. `rate` scales its speed. */
  flail(amount: number, rate = 1): void {
    this.flailAmount = clamp(amount, 0, 1);
    this.flailRate = rate;
  }

  /** The legs of a seated doll swing over an edge, 0 to 1. */
  dangle(amount: number): void {
    this.dangleAmount = clamp(amount, 0, 1);
  }

  /** Squash (below 0) and stretch (above 0) on top of the automatic stretch of a fast fall. About -0.3 to 0.3. */
  squash(amount: number): void {
    this.squashTarget = clamp(amount, -0.45, 0.45);
  }

  /** Stretch an arm to 1.6 times its length at 1 (the rig's recipe: never the forearm). */
  stretch(side: "L" | "R", amount: number): void {
    if (side === "L") this.stretchL = clamp(amount, 0, 1);
    else this.stretchR = clamp(amount, 0, 1);
  }

  /** A hit of landing: squashes her and shakes her head. 0 to 1. */
  bump(strength: number): void {
    const s = clamp(strength, 0, 1);
    this.squashSpring.kick(-9 * s);
    this.headNod.kick(5 * s);
    this.headRoll.kick((Math.random() < 0.5 ? -1 : 1) * 4 * s);
    this.hangKickAt = this.clock;
    this.hangKickSize = 0.3 * s;
  }

  /**
   * The faked hang by one hand, `w` 0 to 1 (a scroll can scrub it in). The pose is the stretched
   * reach arm with limp legs; her pivot becomes the left hand, which a section puts where the ledge
   * is (`place` x, y, z are then the hand's); and she is rolled about the hand so that her body
   * hangs straight down, swaying. `swing` 0 to 1 scales the sway.
   */
  hang(w: number, swing = 1): void {
    this.hangW = clamp(w, 0, 1);
    this.hangSwing = swing;
  }

  /** Put every section-set target back to rest: stand, no walk, no flail, no look, no hang. Placement, face and attachment stay. */
  reset(): void {
    this.poseA = "stand";
    this.poseB = "stand";
    this.poseW = 0;
    this.walkWeight = 0;
    this.flailAmount = 0;
    this.dangleAmount = 0;
    this.squashTarget = 0;
    this.stretchL = 0;
    this.stretchR = 0;
    this.hangW = 0;
    this.talkAmount = 0;
    this.lookAt = null;
  }

  /**
   * Replace a pose with a hand authored one (turns in degrees about the model's axes, see
   * `pose/poses.ts`). For the lab and for a section that needs a pose of its own; the shipped poses
   * are the defaults.
   */
  tunePose(name: PoseName | "hang", def: PoseDef): void {
    this.poses.set(name, compilePose(this.bind, def));
    if (name === "hang") this.measureHang();
  }

  // ---------------------------------------------------------------------------------------------
  // The face.

  /**
   * Wear `name` at weight `w` over the neutral face, 0 to 1 (the same shape as `pose(name, w)`).
   * A pure function of its arguments: nothing is remembered, so a scroll can scrub it, and a
   * section calls it every frame it shows her.
   */
  face(name: FaceName, w = 1): void {
    this.setFace("neutral", name, w);
  }

  /**
   * Change to `name` over `seconds` from whatever is on her face now. Call it once, or every frame
   * with the same name (it does not restart). A change of eye family takes a blink longer.
   */
  faceTo(name: FaceName, seconds = 0.14): void {
    const to = FACES[name];
    if (!this.mixOn && this.faceTarget === to) return;
    this.faceFrom.set(this.base);
    this.faceTarget = to;
    this.faceT = 0;
    this.mixOn = false;
    this.faceDur = Math.max(0.03, swapsEyes(this.faceFrom, to) ? Math.max(seconds, 0.2) : seconds);
  }

  /** A face that is a pure function of `w`: `a` at 0, `b` at 1, nothing remembered (scroll scrubbing, the sequencer). */
  setFace(a: FaceName, b: FaceName = a, w = 0): void {
    this.mixOn = true;
    this.mixA = FACES[a];
    this.mixB = FACES[b];
    this.mixW = w;
  }

  /** Script moods: the face at time `t` of a timeline (see `face/sequence.ts`). */
  mood(steps: readonly MoodStep[], t: number): void {
    const m = moodAt(steps, t, this.moodOut);
    this.setFace(m.a, m.b, m.w);
  }

  /** How much the mouth is speaking, 0 to 1 (a scream and a curse open and close). */
  talk(amount: number): void {
    this.talkAmount = clamp(amount, 0, 1);
  }

  /** The automatic blink (on by default). */
  blinkAuto(on: boolean): void {
    this.autoBlinkOn = on;
  }

  /** Look at a point of the stage (pixels, origin at the middle, y up), or at nothing with null. */
  look(point: { x: number; y: number } | null): void {
    this.lookAt = point;
  }

  // ---------------------------------------------------------------------------------------------
  // Sockets and attachment.

  /** A node that moves with her bone. Other actors parent to it; marks read `markPoint`. */
  socket(name: DollSocketName): Object3D {
    const found = this.sockets.get(name);
    if (!found) throw new Error(`doll: no socket ${name}`);
    return found;
  }

  /** A point of her in stage pixels, for a mark (sweat, stars, anger) to follow. Valid after the frame's update. */
  markPoint(name: DollSocketName, out: MarkPoint): MarkPoint {
    const node = this.socket(name);
    _v.setFromMatrixPosition(node.matrixWorld);
    projectToStage(this.tmpMark, _v.x, _v.y, _v.z);
    out.x = this.tmpMark.x;
    out.y = this.tmpMark.y;
    out.s = this.tmpMark.s;
    const e = this.root.matrixWorld.elements;
    out.unit = Math.hypot(e[0], e[1], e[2]) * this.tmpMark.s;
    return out;
  }

  /**
   * Hang her under a socket of another actor (Silverbolt's head, Selena's palm). `place` then means
   * an offset from the socket: x, y, z in stage pixels along the socket's axes, rotations local,
   * and `height` is still her height on the screen, whatever the parent's scale. With `keepWorld`
   * (the default) she stays exactly where she is on the screen. Only sockets of actors in the cast
   * pass keep her lit and in order: a socket of an unlit pass would draw her unlit and in the wrong depth.
   * `attach(null)` is `detach()`.
   */
  attach(socket: Object3D | null, opts: AttachOptions = {}): void {
    if (!socket) {
      this.detach();
      return;
    }
    const keep = opts.keepWorld ?? true;
    if (keep) {
      this.root.updateWorldMatrix(true, false);
      const worldHeight = this.worldHeightPx();
      socket.attach(this.root);
      this.attachedTo = socket;
      socket.updateWorldMatrix(true, false);
      const ps = this.parentScale();
      this.px = this.root.position.x * ps;
      this.py = this.root.position.y * ps;
      this.pz = this.root.position.z * ps;
      this.pyaw = this.root.rotation.y;
      this.ppitch = this.root.rotation.x;
      this.proll = this.root.rotation.z;
      this.pheight = worldHeight;
    } else {
      socket.add(this.root);
      this.attachedTo = socket;
      this.px = 0;
      this.py = 0;
      this.pz = 0;
      this.pyaw = 0;
      this.ppitch = 0;
      this.proll = 0;
    }
    this.haveLast = false;
  }

  /** Take her out from under a socket, keeping where she is on the screen. She goes back to the cast pass's scene. */
  detach(): void {
    if (!this.attachedTo) return;
    this.root.updateWorldMatrix(true, false);
    this.cast.pass.scene.attach(this.root);
    this.attachedTo = null;
    this.px = this.root.position.x;
    this.py = this.root.position.y;
    this.pz = this.root.position.z;
    this.pyaw = this.root.rotation.y;
    this.ppitch = this.root.rotation.x;
    this.proll = this.root.rotation.z;
    this.pheight = this.worldHeightPx();
    this.haveLast = false;
  }

  /** The socket she hangs under, or null. */
  get parentSocket(): Object3D | null {
    return this.attachedTo;
  }

  // ---------------------------------------------------------------------------------------------
  // Interaction and light.

  /**
   * Compile her shader (the face is a long program) and send her maps to the GPU now, so that the
   * first frame she is shown does not stall. The three maps go one to a frame: sent together they
   * cost about 25 ms on a fresh load (measured), which is two dropped frames in a scroll. Waits for
   * a frame between them (or 40 ms in a hidden tab, where there are none). `ensureDoll` awaits it.
   * Safe to call again.
   */
  async warm(): Promise<void> {
    if (this.disposed) return;
    const t0 = performance.now();
    let spent = 0;
    const { renderer } = this.ctx.stage;
    const was = this.root.visible;
    // `compile` takes only what is visible.
    this.root.visible = true;
    try {
      renderer.compile(this.cast.pass.scene, this.cast.pass.camera);
    } catch {
      // A lost context compiles on the first draw instead: nothing to do.
    } finally {
      this.root.visible = was;
    }
    const compiled = performance.now() - t0;
    spent += compiled;
    const m = this.material;
    for (const t of new Set([m.map, m.normalMap, m.metalnessMap, m.roughnessMap])) {
      if (!t || this.disposed) continue;
      await nextFrame();
      const t1 = performance.now();
      try {
        renderer.initTexture(t);
      } catch {
        // As above.
      }
      spent += performance.now() - t1;
    }
    if (this.stats.warmMs === 0) {
      this.stats.warmCompileMs = compiled;
      this.stats.warmMs = spent;
    }
  }

  /** Turn the hover and the press reactions on or off. The hit target answers only while it is on. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.hovered = false;
  }

  /** Trim the doll inside the shared cast rig. `direct` scales the key and fill on her, `ambient` the ambient light and the environment's diffuse. */
  light(direct: number, ambient: number, env: number = DEFAULT_LIGHT.env): void {
    this.uniforms.uDollLight.value.set(direct, ambient);
    this.material.envMapIntensity = env;
  }

  // ---------------------------------------------------------------------------------------------
  // The frame.

  update(frame: FrameInfo): void {
    if (this.disposed) return;
    const t0 = performance.now();
    const dt = frame.dt;
    this.updatedAt = t0;
    if (frame.frame !== this.lastFrame + 1 && frame.frame !== this.lastFrame) this.resync();
    this.lastFrame = frame.frame;
    this.clock += dt;
    const time = frame.time;

    const r = this.reactions.update(dt);
    if (r.began) this.onReact?.(r.began);

    this.stepSprings(dt);
    this.composePose(time, dt, r.wobble);
    this.applyToBones();
    this.placeRoot(r.hop, r.spin, r.squash, time);
    this.updateFace(frame, r.face, dt);
    this.cacheHit();

    const ms = performance.now() - t0;
    this.stats.updateMs = this.stats.frames === 0 ? ms : this.stats.updateMs * 0.95 + ms * 0.05;
    this.stats.frames += 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeHit?.();
    this.removeHit = null;
    this.root.removeFromParent();
    this.body.geometry.dispose();
    this.body.skeleton.dispose();
    const textures: Array<Texture | null> = [
      this.material.map,
      this.material.normalMap,
      this.material.metalnessMap,
      this.material.roughnessMap,
    ];
    for (const t of new Set(textures)) t?.dispose();
    this.material.dispose();
    this.sockets.clear();
    if (this.ctx.pointer.state.hit === "doll") this.ctx.cursor.set(null);
    // A later engine must parse a fresh copy: this one is disposed.
    forgetGltf(this.gltfPath);
  }

  // ---------------------------------------------------------------------------------------------
  // Inside.

  private resync(): void {
    this.haveLast = false;
    this.headRoll.reset();
    this.headNod.reset();
    this.squashSpring.reset();
    this.lookTurn.reset();
    this.lookNodSpring.reset();
  }

  private stepSprings(dt: number): void {
    // Her head lags behind her motion and swings back.
    let vx = 0;
    let vy = 0;
    if (this.haveLast && dt > 0) {
      const dx = this.px - this.lastX;
      const dy = this.py - this.lastY;
      if (Math.hypot(dx, dy) > this.pheight * JUMP_HEIGHTS) {
        this.resync();
        this.haveLast = true;
      } else {
        vx = dx / dt;
        vy = dy / dt;
      }
    }
    this.lastX = this.px;
    this.lastY = this.py;
    this.haveLast = true;
    const h = Math.max(1, this.pheight);
    const stretchAuto = clamp(Math.abs(vy) / (h * STRETCH_SPEED), 0, 1) * MAX_STRETCH;
    this.headRoll.step(clamp(-vx * 0.0004, -0.35, 0.35), dt);
    this.headNod.step(clamp(vy * 0.0002, -0.25, 0.25), dt);
    this.squashSpring.step(this.squashTarget + stretchAuto, dt);
  }

  private composePose(time: number, dt: number, wobble: number): void {
    const a = this.poses.get(this.poseA);
    const b = this.poses.get(this.poseB);
    if (!a || !b) return;
    blendPoseData(this.work, a, b, this.poseW);
    const hang = this.poses.get("hang");
    if (this.hangW > 0 && hang) blendPoseData(this.work, this.work, hang, this.hangW);
    if (this.walkWeight > 0 && this.walkSampler) {
      if (this.walkByTime) this.walkPhase += (dt * this.walkRate) / WALK_SECONDS;
      copyPoseData(this.walkBuf, this.work);
      this.walkSampler.sample(this.walkPhase, this.walkBuf);
      blendPoseData(this.work, this.work, this.walkBuf, this.walkWeight);
    }
    this.turns.fill(0);
    addBreath(this.turns, time);
    addFlail(this.turns, time, this.flailAmount, this.flailRate);
    addDangle(this.turns, time, this.dangleAmount);
    addRunLean(this.turns, this.walkWeight * this.walkLean);
    // The head: its spring, the look and a dizzy wobble.
    addHead(
      this.turns,
      this.headRoll.x + wobble * 0.5,
      this.headNod.x + this.lookNodSpring.x,
      this.lookTurn.x,
    );
    applyTurns(this.bind, this.work.q, this.turns);
    stretchArm(this.work.scale, BONE.armL, BONE.handL, 1 + 0.6 * this.stretchL);
    stretchArm(this.work.scale, BONE.armR, BONE.handR, 1 + 0.6 * this.stretchR);
  }

  private bone(i: number): Bone {
    const b = this.bones[i];
    if (!b) throw new Error(`doll: no bone ${i}`);
    return b;
  }

  private applyToBones(data: PoseData = this.work): void {
    const q = data.q;
    const s = data.scale;
    for (let i = 0; i < BONE_COUNT; i++) {
      const bone = this.bones[i];
      if (!bone) continue;
      bone.quaternion.set(at(q, i * 4), at(q, i * 4 + 1), at(q, i * 4 + 2), at(q, i * 4 + 3));
      bone.scale.set(at(s, i * 3), at(s, i * 3 + 1), at(s, i * 3 + 2));
    }
    this.bone(0).position.set(at(data.hips, 0), at(data.hips, 1), at(data.hips, 2));
  }

  /**
   * The line from her left hand to her hips in the full hang pose, in the model's frame, measured
   * once (and again when the hang pose is replaced). The roll that hangs her is computed from this
   * fixed line, not from the pose of the moment, so it grows smoothly with the weight of the hang
   * and never wraps round while a half-raised arm sweeps past.
   */
  private measureHang(): void {
    const hang = this.poses.get("hang");
    if (!hang) return;
    this.applyToBones(hang);
    this.model.updateMatrixWorld(true);
    _m.copy(this.model.matrixWorld).invert();
    const hand = _v.setFromMatrixPosition(this.socket("handL").matrixWorld).applyMatrix4(_m);
    const hips = _s.setFromMatrixPosition(this.socket("hips").matrixWorld).applyMatrix4(_m);
    this.hangVec.copy(hips).sub(hand);
    this.applyToBones(this.work);
  }

  /** The pivot, in the model's frame (file units). A hand pivot follows the posed hand. */
  private pivotPoint(out: Vector3, which: Pivot): Vector3 {
    if (which === "handL" || which === "handR") {
      const socket = this.socket(which);
      this.model.updateMatrixWorld(true);
      _m.copy(this.model.matrixWorld).invert();
      return out.setFromMatrixPosition(socket.matrixWorld).applyMatrix4(_m);
    }
    const p = PIVOT_POINTS[which];
    return out.set(p[0], p[1], p[2]);
  }

  private placeRoot(hop: number, spin: number, reactSquash: number, time: number): void {
    const pivotName: Pivot = this.hangW > 0.001 ? "handL" : this.ppivot;
    // A moving hand pivot is blended with the section's own pivot by the hang weight.
    const pivot = this.pivotPoint(_v, pivotName);
    if (this.hangW > 0.001 && this.hangW < 1 && this.ppivot !== "handL") {
      this.pivotPoint(_own, this.ppivot);
      pivot.lerp(_own, 1 - this.hangW);
    }
    this.shift.position.copy(pivot).negate();

    let roll = this.proll;
    if (this.hangW > 0.001) {
      const v = this.hangVec;
      const want = wrapPi(rollToHang(v.x, v.y, v.z, this.pyaw, this.ppitch));
      const sway = hangSway(time, this.hangSwing, this.clock - this.hangKickAt, this.hangKickSize);
      roll = roll + (want + sway - roll) * this.hangW;
    }

    const sq = clamp(this.squashSpring.x + reactSquash, -0.5, 0.5);
    this.squashNode.scale.set(1 / Math.sqrt(1 + sq), 1 + sq, 1 / Math.sqrt(1 + sq));

    this.root.rotation.set(this.ppitch, this.pyaw + spin, roll);
    const lift = hop * HOP_SHARE * this.pheight;
    if (this.attachedTo) {
      // The depth that sizes her is her own, not the socket's: the pivot's world z.
      this.attachedTo.updateWorldMatrix(true, false);
      const ps = this.parentScale();
      this.root.position.set(this.px / ps, (this.py + lift) / ps, this.pz / ps);
      const worldZ = _v.copy(this.root.position).applyMatrix4(this.attachedTo.matrixWorld).z;
      this.root.scale.setScalar(fitScale(this.pheight, worldZ, ps));
    } else {
      this.root.position.set(this.px, this.py + lift, this.pz);
      this.root.scale.setScalar(rootScale(this.pheight, this.pz));
    }
    this.root.updateMatrixWorld(true);
  }

  private parentScale(): number {
    const parent = this.attachedTo;
    if (!parent) return 1;
    const e = parent.matrixWorld.elements;
    const s = Math.hypot(e[0], e[1], e[2]);
    return s > 1e-9 ? s : 1;
  }

  /** Her height on the screen now, from her world scale (the inverse of `rootScale`). */
  private worldHeightPx(): number {
    const e = this.root.matrixWorld.elements;
    const worldScale = Math.hypot(e[0], e[1], e[2]);
    const z = e[14];
    return worldScale * DOLL_HEIGHT * depthScale(z);
  }

  private updateFace(frame: FrameInfo, reactFace: FaceName | null, dt: number): void {
    // The expression the section asked for.
    if (this.mixOn) {
      mixFaces(this.base, this.mixA, this.mixB, this.mixW);
    } else {
      if (this.faceT < 1) this.faceT = Math.min(1, this.faceT + dt / this.faceDur);
      mixFaces(this.base, this.faceFrom, this.faceTarget, this.faceT);
    }
    // A reaction takes the face over and gives it back.
    if (reactFace) this.overFace = FACES[reactFace];
    this.overW = approach(this.overW, reactFace ? 1 : 0, 18, dt);
    if (this.overW > 0.999) this.overW = 1;
    if (this.overW < 0.001) this.overW = 0;
    if (this.overW > 0) mixFaces(this.shown, this.base, this.overFace, this.overW);
    else this.shown.set(this.base);

    // Where the eyes look: the pointer while she is hovered, else what the section asked for.
    let target = this.lookAt;
    if (this.hovered && this.interactive) {
      const s = this.ctx.pointer.state;
      const vp = this.ctx.viewport();
      target = clientToStage(this.tmpStage, s.x, s.y, vp.w, vp.h);
    }
    let lx = 0;
    let ly = 0;
    if (target && this.hit.headR > 0) {
      const dx = target.x - this.hit.headX;
      const dy = target.y - this.hit.headY;
      const range = this.hit.headR * 1.6;
      // The face's own frame is turned by her roll.
      const c = Math.cos(-this.root.rotation.z);
      const s = Math.sin(-this.root.rotation.z);
      lx = clamp((dx * c - dy * s) / range, -1, 1);
      ly = clamp((dx * s + dy * c) / range, -1, 1);
    }
    this.lookX.step(lx, dt);
    this.lookY.step(ly, dt);
    this.lookTurn.step(lx * 0.28, dt);
    this.lookNodSpring.step(-ly * 0.14, dt);

    const live = this.live;
    live.blink = this.autoBlinkOn ? autoBlink(frame.time) : 0;
    live.lookX = this.lookX.x;
    live.lookY = this.lookY.x;
    live.talk = this.talkAmount;
    live.t = frame.time;
    applyLive(this.shown, live);
    this.uniforms.uFaceF.value.set(this.shown);
  }

  /** A node's origin in stage pixels (into `out`); returns its world z. */
  private stagePoint(node: Object3D, out: { x: number; y: number }): number {
    _v.setFromMatrixPosition(node.matrixWorld);
    const s = depthScale(_v.z);
    out.x = _v.x * s;
    out.y = _v.y * s;
    return _v.z;
  }

  /** Project the shapes the pointer tests against, once a frame, from the final matrices. */
  private cacheHit(): void {
    const h = this.hit;
    const tmp = this.tmpStage;
    const headZ = this.stagePoint(this.socket("head"), tmp);
    h.headX = tmp.x;
    h.headY = tmp.y;
    this.stagePoint(this.bone(BONE.spine), tmp);
    h.neckX = tmp.x;
    h.neckY = tmp.y;
    this.stagePoint(this.bone(BONE.hips), tmp);
    h.hipX = tmp.x;
    h.hipY = tmp.y;
    this.stagePoint(this.bone(BONE_NAMES.indexOf("LeftFoot")), tmp);
    h.footLX = tmp.x;
    h.footLY = tmp.y;
    this.stagePoint(this.bone(BONE_NAMES.indexOf("RightFoot")), tmp);
    h.footRX = tmp.x;
    h.footRY = tmp.y;
    // One file unit, in stage pixels, at the head's depth.
    const e = this.root.matrixWorld.elements;
    const unit = Math.hypot(e[0], e[1], e[2]) * depthScale(headZ);
    h.headR = HEAD_HIT.r * unit;
    h.bodyR = BODY_HIT_R * unit;
    h.legR = LEG_HIT_R * unit;
    h.depth = hitDepth(headZ);
  }

  /** The hit target's test: client pixels in, a depth or null out. Cheap: a circle and three capsules. */
  private hitTest(clientX: number, clientY: number): number | null {
    if (!this.interactive || this.disposed) return null;
    // Not drawn, not hit: the actor's own hide, a hidden parent, or a frame that never ran.
    if (performance.now() - this.updatedAt > 200) return null;
    for (let n: Object3D | null = this.root; n; n = n.parent) if (!n.visible) return null;
    const vp = this.ctx.viewport();
    const p = clientToStage(this.tmpStage, clientX, clientY, vp.w, vp.h);
    const h = this.hit;
    if (
      insideCircle(h.headX, h.headY, h.headR, p.x, p.y) ||
      insideCapsule(h.neckX, h.neckY, h.hipX, h.hipY, h.bodyR, p.x, p.y) ||
      insideCapsule(h.hipX, h.hipY, h.footLX, h.footLY, h.legR, p.x, p.y) ||
      insideCapsule(h.hipX, h.hipY, h.footRX, h.footRY, h.legR, p.x, p.y)
    ) {
      return h.depth;
    }
    return null;
  }

  private wireMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
    const mat = source.clone();
    mat.envMap = this.cast.env;
    mat.envMapIntensity = DEFAULT_LIGHT.env;
    return mat;
  }

  private makeUniforms(): DollActor["uniforms"] {
    return {
      uFaceF: { value: new Float32Array(FACE_ARRAY_LENGTH) },
      uFaceFrame: {
        value: new Vector4(FACE_FRAME[0], FACE_FRAME[1], FACE_FRAME[2], FACE_FRAME[3]),
      },
      uIrisL: { value: new Color(0xd9262f) },
      uIrisR: { value: new Color(0x5cbcf2) },
      uInk: { value: new Color(0x1d0f1d) },
      uDollLight: { value: new Vector2(DEFAULT_LIGHT.direct, DEFAULT_LIGHT.ambient) },
    };
  }

  private installShader(): void {
    const uniforms = this.uniforms;
    const material: Material = this.material;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${FACE_VERTEX_HEAD}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${FACE_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${FACE_FRAGMENT_HEAD}\nuniform vec2 uDollLight;`,
        )
        .replace("#include <map_fragment>", `#include <map_fragment>\n${FACE_FRAGMENT_MAP}`)
        // The shared cast rig is brighter than the doll's recipe: trim her light here.
        .replace(
          "#include <aomap_fragment>",
          "reflectedLight.directDiffuse *= uDollLight.x;\nreflectedLight.directSpecular *= uDollLight.x;\nreflectedLight.indirectDiffuse *= uDollLight.y;\n#include <aomap_fragment>",
        );
    };
    material.customProgramCacheKey = () => "home-doll-face-v1";
    material.needsUpdate = true;
  }

  private buildSockets(): void {
    const find = (name: string): Object3D => {
      const o = this.model.getObjectByName(name);
      if (!o) throw new Error(`doll: the model has no ${name}`);
      return o;
    };
    this.sockets.set("handL", find("socket_hand_L"));
    this.sockets.set("handR", find("socket_hand_R"));
    this.sockets.set("headTop", find("socket_head_top"));
    this.sockets.set("hips", this.bone(BONE.hips));
    const head = this.bone(BONE.head);
    const make = (name: DollSocketName, point: readonly [number, number, number]): void => {
      const node = new Group();
      node.name = `socket_${name}`;
      node.position.copy(this.headLocal(point));
      head.add(node);
      this.sockets.set(name, node);
    };
    const zFace = this.faceFrontZ();
    make("head", [0, HEAD_HIT.y, 0]);
    make("mouth", [FACE_POINTS.mouth[0], FACE_POINTS.mouth[1], zFace]);
    make("cheekL", [FACE_POINTS.eyeBlue[0], FACE_POINTS.eyeBlue[1] - 0.09, zFace]);
    make("cheekR", [FACE_POINTS.eyeRed[0], FACE_POINTS.eyeRed[1] - 0.09, zFace]);
  }

  /** A point of the file's frame (bind pose) as a position in the Head bone's local frame. */
  private headLocal(p: readonly [number, number, number]): Vector3 {
    const headIndex = BONE_NAMES.indexOf("Head");
    const rig = RIG_BONES[headIndex];
    if (!rig) throw new Error("doll: the rig has no Head");
    const pw = new Quaternion().fromArray(this.bind.parentWorld, headIndex * 4);
    const rest = new Quaternion().fromArray(this.bind.rest, headIndex * 4);
    const world = pw.multiply(rest);
    return new Vector3(
      p[0] - rig.world[0],
      p[1] - rig.world[1],
      p[2] - rig.world[2],
    ).applyQuaternion(world.invert());
  }

  /** The z of the face's front, from the face vertices (the `_face` attribute) near the middle of the eyes. */
  private faceFrontZ(): number {
    const geo = this.body.geometry;
    const face = geo.getAttribute("_face");
    const pos = geo.getAttribute("position");
    let z = 0.2;
    if (face && pos) {
      let best = -Infinity;
      for (let i = 0; i < face.count; i++) {
        if (face.getX(i) < 0.5) continue;
        if (Math.abs(pos.getX(i) - FACE_FRAME[0]) > 0.15 || Math.abs(pos.getY(i) - 0.84) > 0.2)
          continue;
        best = Math.max(best, pos.getZ(i));
      }
      if (best > -Infinity) z = best + 0.004;
    }
    return z;
  }
}
