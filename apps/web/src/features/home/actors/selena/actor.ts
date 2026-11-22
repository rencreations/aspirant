/**
 * Selena, in the shared cast pass. A plain class: a section builds her through `ensureSelena`,
 * sets her state every frame it shows her (`place`, `drive` or a clip, an expression), and she
 * integrates her own motion in `update`: the clip (the four states of `states.ts`), the head and
 * eyes that follow the pointer a little, the hair and skirt springs and the face. She has no touch
 * targets: the pointer only turns her head and eyes (in the pose and in the idle) and the view.
 *
 * The pose is made without the animation mixer: the clips are sampled by `sampler.ts` (a pure
 * scrub of any time, a cross fade of any two), turns are added on top (`skeleton.ts`), the springs
 * run last (`physics.ts`), and the result is written to the bones once. Docs: `docs/design/home/actor-selena.md`.
 */
import {
  Box3,
  Float32BufferAttribute,
  Group,
  Matrix3,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type SkinnedMesh,
  type Texture,
  type WebGLRenderer,
} from "three";

import { PIXEL_DISTANCE } from "../../kernel/stage";
import type { Actor, FrameInfo } from "../../kernel/types";
import type { Cast } from "../shared/cast";
import { INK_FLOOR_BODY, INK_TINTS, toonify, type ToonPick, type ToonSet } from "../shared/toon";
import { FACE_LINE, FRINGE_COPIES, INK_FLOORS, SELENA_TUNE } from "./toon-look";
import type { ActorCtx } from "../shared/types";

import { type CameraData, frameCamera, sampleBakedCamera, type FrameOptions } from "./camera";
import { ANCHOR, BAKED, BONE, CLIP, POSE_FIT, REF_HEIGHT, type PoseFitName } from "./constants";
import { IdleTouch } from "./touch";
import { Face, MORPH_NAMES, type Expression } from "./face";
import { frameFor, worldPoint, worldScale, type PlaceInput, type Rect } from "./framing";
import { emptyGaze, gentleGaze } from "./look";
import { Spring, approach, clamp } from "./motion";
import { SpringBones, emptyEnv, type SpringEnv } from "./physics";
import { ClipPlayer, type ClipName, type PlayOptions } from "./player";
import { POINT, pointSpecs } from "./points";
import { qaxis, qmul, qrotate } from "./quat";
import { buildRig, standardOf, type Rig } from "./rig";
import { POSE_STRIDE, blendPoses, sampleClip } from "./sampler";
import { PoseWork } from "./skeleton";
import { PullArm, type PullInput } from "./pull-arm";
import { buildSpringDefs } from "./springs";
import { STATE_FADE, StateMachine, interactionOf, type SelenaState } from "./states";
import {
  R7_SHY,
  R7_STRIDE,
  R7_VFOV,
  VIEW_TURN,
  cropFor,
  lensFor,
  lensForCrop,
  mixLens,
  mixR7,
  newLens,
  orbitAbout,
  sampleR7,
  type R7Data,
  type R7Lens,
} from "./camera-r7";
import { Sky } from "./sky";

export type { ClipName, PlayOptions } from "./player";
export type { Expression } from "./face";
export type { PlaceInput, Rect } from "./framing";
export type { FrameOptions } from "./camera";

export type SocketName = "rightHand" | "leftHand" | "mouth" | "head";

/** Where she looks: the pointer (default), the viewer, a point on the screen, or the idle drift. */
export type LookTarget = "pointer" | "viewer" | "idle" | { x: number; y: number };

export interface SelenaStats {
  /** Milliseconds `update` took on the last frame, and the average of the last sixty. */
  updateMs: number;
  updateAvgMs: number;
}

/** What the lab and the probes may read. */
export interface SelenaDebug {
  scale: number;
  /** The state of the machine and how much the cursor turns her head and eyes and the view. */
  state: SelenaState | "free";
  look: number;
  view: number;
  points: Float32Array;
  filmCamera: PerspectiveCamera;
}

const D = PIXEL_DISTANCE;
const DEG = Math.PI / 180;

/** What `cameraFor(clip, ...)` may be asked (round seven). */
export interface R7Options {
  shift?: number;
  /** 1 or true: the frame covers `rect` (the list's window); 0 or false: the whole recording frame on the screen. */
  portrait?: number | boolean;
  /** CSS pixels, top left origin: the window the frame is shown in (the lens is centred on it). Default the whole screen. */
  rect?: Rect | null;
  /** What the screen shows of that window (the scissor), when it is only a part of it. Default `rect`. */
  clip?: Rect | null;
  /** Draw the cast through the camera for the next frame (default true). */
  draw?: boolean;
}
/** How big she is by default: a share of the viewport height. */
const DEFAULT_HEIGHT = 0.8;
/** A frame this far from the last one is a jump: the springs start over. */
const GAP_FRAMES = 2;
/** A scrub that moves the clip by more than this in a frame is a jump (seconds). */
const SCRUB_JUMP = 0.3;
/** The cross fade of a jump (a seek, a reload, the machine taking the control back): never a pop. */
const JUMP_FADE = 0.2;
/** The share of the head's turn the neck takes. */
const NECK_SHARE = 0.3;
/** While a section drives a clip itself the cursor keeps what it had. */
const FREE_WEIGHTS = { look: 0, view: 0 } as const;

export class SelenaActor implements Actor {
  readonly name = "selena";
  visible = false;
  /** The root the cast draws. Its transform is her placement (position, yaw, scale). */
  readonly object = new Group();
  /**
   * Her own space, in metres, the one `cameras.json` is in (she faces +z, y is up). Its world
   * matrix is what a baked camera and everything that stands in the film (Silverbolt, the doll)
   * must be composed with.
   */
  readonly film = new Group();

  private readonly rig: Rig;
  private readonly cast: Cast;
  private readonly cams: CameraData;
  private readonly player: ClipPlayer;
  private readonly work: PoseWork;
  private readonly springs: SpringBones;
  /** The pulling arm of the out animation (`pull-arm.ts`) and what a section asked for this frame. */
  private readonly pullArm: PullArm;
  private pullIn: PullInput | null = null;
  /** Sockets a section pinned on bones (`pin`), moved with the others every frame. */
  private readonly pins: Array<{ obj: Object3D; node: number; along: number }> = [];
  private readonly face = new Face();

  private readonly pose: Float32Array;
  private readonly poseB: Float32Array;
  private readonly hier: { count: number; parent: Int32Array };
  private readonly tmp = new Float32Array(16);
  /** Scratch that a frame reuses: no frame makes an array or an object. */
  private readonly wish = new Float32Array(6);
  /** Bone indexes the frame turns, found once. */
  private readonly ix = {
    neck: -1,
    head: -1,
    eyeL: -1,
    eyeR: -1,
    handL: -1,
    handR: -1,
    mouth: -1,
  };
  private readonly env: SpringEnv = emptyEnv();

  /** Her toon materials, their ink and her pictures (`actors/shared/toon.ts`). */
  private readonly toon: ToonSet;
  private readonly textures: Set<Texture>;
  private readonly geometries = new Set<BufferGeometry>();
  private readonly planes = [new Plane(), new Plane(), new Plane(), new Plane()];
  private readonly morphIndex: Int16Array;
  private readonly head: SkinnedMesh;
  private readonly sockets: Record<SocketName, Object3D>;

  // Placement.
  private pz = 0;
  private height = 0;
  private scale = 1;
  private readonly gq = new Float32Array([0, 0, 0, 1]);
  private placed = false;
  /** How far her frame moved since the last update, in her own space (the springs lag by it). */
  private shiftX = 0;
  private shiftY = 0;
  private shiftZ = 0;

  // Frame, clip and camera.
  private clipRect: Rect | null = null;
  private clipKey = "";
  private readonly filmCamera = new PerspectiveCamera(BAKED.vfovDeg, BAKED.aspect, 0.1, 1000);
  private readonly roomCamera = new PerspectiveCamera();
  private readonly camScratch = new Float32Array(7);

  // Round seven's cameras (`camera-r7.ts`): fitted to the recording; the sky; the view turn.
  private readonly r7: R7Data | null;
  /** The skybox behind her: null when the picture was not given. Drawn only while a camera is. */
  readonly sky: Sky | null;
  private readonly keyA = new Float32Array(R7_STRIDE);
  private readonly keyB = new Float32Array(R7_STRIDE);
  private readonly keyC = new Float32Array(R7_STRIDE);
  private readonly lensA: R7Lens = newLens();
  private readonly lensB: R7Lens = newLens();
  private readonly cropNow = new Float32Array(3);
  private readonly lensC: R7Lens = newLens();
  private readonly r7Pos = new Float32Array(3);
  private readonly r7Quat = new Float32Array(4);
  private readonly r7Base = new Matrix4();
  private readonly r7Film = new Matrix4();
  private readonly r7Q = new Quaternion();
  private r7Clip: ClipName = CLIP.idle;
  /** The cursor turns the whole model (the camera orbits her): springs, no overshoot. */
  private readonly turnYaw = new Spring(6, 1, 0);
  private readonly turnPitch = new Spring(6, 1, 0);
  private readonly turnW = new Spring(5, 1, 0);
  private readonly idleTouch: IdleTouch;
  private turnClock = 0;
  private skyOn = true;
  /** What `frame()` asked for, kept for `update`. */
  private readonly frameAsk = {
    on: false,
    vp: { w: 1, h: 1 },
    rect: { x: 0, y: 0, w: 1, h: 1 },
    cut: { x: 0, y: 0, w: 1, h: 1 },
    options: {
      portrait: 0,
      rect: null as Rect | null,
      clip: null as Rect | null,
      draw: true,
    } as R7Options,
  };
  /** The roots drawn through the fitted camera (hers, and Silverbolt's once `frameWith` added it). */
  private readonly framed: Object3D[] = [];
  /** Her height on the screen while a fitted camera is drawn (CSS pixels): the ink follows it. */
  private inkHeight = 0;
  private lastFrame = -10;
  private lastClip: ClipName = CLIP.idle;
  private lastClipTime = 0;
  private lastScrubbed = false;
  private clock = 0;
  private filmDrawn = false;

  // The four states (`states.ts`): the machine runs inside `update`, from the growth `drive` gave.
  private readonly machine = new StateMachine();
  /** The scene is driving her (`drive` was called and no direct clip call since). */
  private driven = false;
  private expand = 0;
  /** A jump was asked for: the next `update` sets the loop with no transition. */
  private jumpAsked = false;
  /**
   * The handover fade: when a section takes a clip from the machine (`clip`, `blend`) the clip she
   * was showing keeps running under the new pose for `JUMP_FADE` seconds and fades out, so a flick
   * that skips a section's own first blend (the out zone) never pops her pose.
   */
  private carryClip: ClipName = CLIP.idle;
  private carryT = 0;
  private carryW = 0;
  /** How much the head and eyes follow the cursor, and how much the model turns with it (0 to 1). */
  private lookW = 0;
  private viewW = 0;
  /** The cursor, eased, as a share of the screen from her eyes (-1 to 1): the view turn reads it. */
  private readonly viewX = new Spring(4, 1, 0);
  private readonly viewY = new Spring(4, 1, 0);

  // Look.
  private lookTarget: LookTarget = "pointer";
  private readonly gaze = emptyGaze();
  /** The head and the eyes follow the cursor on slow springs; the eyes lead the head a little. */
  private readonly gazeSprings = [
    new Spring(5, 0.9, 0),
    new Spring(5, 0.9, 0),
    new Spring(9, 0.9, 0),
    new Spring(9, 0.9, 0),
  ];

  // Projection of her points to the screen: x, y (stage pixels) and the pixel size of a metre.
  private readonly scr = new Float32Array(POINT.count * 3);
  private readonly pointNode: Int32Array;
  private readonly pointAlong: Float32Array;
  private readonly eyeR: number;

  private updateMs = 0;
  private updateAvg = 0;

  constructor(
    private readonly ctx: ActorCtx,
    gltf: Parameters<typeof buildRig>[0],
    cams: CameraData,
    cast: Cast,
    r7: R7Data | null = null,
    skyTexture: Texture | null = null,
  ) {
    this.cams = cams;
    this.cast = cast;
    this.r7 = r7;
    const m = r7?.sky.fromFilm ?? [];
    this.sky =
      r7 && skyTexture
        ? new Sky(
            skyTexture,
            new Matrix3().set(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[6]!, m[7]!, m[8]!),
            r7.sky.poly,
          )
        : null;
    const rig = buildRig(gltf);
    this.rig = rig;
    this.idleTouch = new IdleTouch(rig);
    const n = rig.nodes.length;
    this.hier = { count: n, parent: rig.parent };
    this.work = new PoseWork(n);
    this.pose = new Float32Array(rig.rest);
    this.poseB = new Float32Array(rig.rest);
    this.player = new ClipPlayer(rig.info, CLIP.idle);
    this.springs = new SpringBones(buildSpringDefs(rig.names, rig.parent, rig.rest));
    this.pullArm = new PullArm(rig);

    // The scene graph: root > film > the loaded scene.
    this.film.add(rig.scene);
    this.object.add(this.film);
    this.framed.push(this.object);
    // The sky is a screen quad (it ignores this transform) that hides and shows with her.
    if (this.sky) this.object.add(this.sky.mesh);
    this.object.visible = false;
    cast.add(this.object);

    this.head = rig.meshes.head;
    this.morphIndex = new Int16Array(MORPH_NAMES.length).fill(-1);
    this.splitBlink(this.head);
    const aniso = Math.min(8, ctx.stage.renderer.capabilities.getMaxAnisotropy());
    this.toon = this.dress(rig, aniso);
    this.textures = this.toon.textures;
    MORPH_NAMES.forEach((name, i) => {
      this.morphIndex[i] = this.head.morphTargetDictionary?.[name] ?? -1;
    });

    // Sockets: children of her own space, moved every frame onto the animated bones.
    this.sockets = {
      rightHand: new Object3D(),
      leftHand: new Object3D(),
      mouth: new Object3D(),
      head: new Object3D(),
    };
    for (const [key, socket] of Object.entries(this.sockets)) {
      socket.name = `selena_socket_${key}`;
      this.film.add(socket);
    }

    // The points to project, and the bones the frame turns.
    const specs = pointSpecs();
    this.pointNode = new Int32Array(specs.length);
    this.pointAlong = new Float32Array(specs.length);
    specs.forEach((spec, i) => {
      this.pointNode[i] = rig.index.get(spec.bone) ?? -1;
      this.pointAlong[i] = spec.along;
    });
    this.eyeR = rig.index.get(BONE.eyeR) ?? -1;
    const at = (name: string): number => rig.index.get(name) ?? -1;
    Object.assign(this.ix, {
      neck: at(BONE.neck),
      head: at(BONE.head),
      eyeL: at(BONE.eyeL),
      eyeR: at(BONE.eyeR),
      handL: at(BONE.handL),
      handR: at(BONE.handR),
      mouth: at(BONE.mouth),
    });

    // The idle pose at time zero, composed once so the first frame is already her.
    this.writePose(0);
    this.place({
      x: 0,
      y: 0,
      z: 0,
      height: DEFAULT_HEIGHT * ctx.viewport().h,
    });
    this.updateClip();
    ctx.stage.renderer.localClippingEnabled = true;
  }

  // ------------------------------------------------------------------ placement

  /**
   * Put her on the screen. `x`, `y` are where her anchor (near the pelvis) goes in the stage's
   * pixel frame (origin in the middle, x right, y up), `z` pixels toward the camera, `height` how
   * tall a standing person of her reference size is on the screen, `yaw` a turn about her vertical
   * axis (0 faces the viewer). Works at any height from a few pixels to several screens.
   */
  place(input: PlaceInput): void {
    const z = input.z ?? 0;
    const yaw = input.yaw ?? 0;
    const roll = input.roll ?? 0;
    const height = Math.max(1, input.height);
    const scale = worldScale(height, REF_HEIGHT, z, D);
    const [wx, wy, wz] = worldPoint(input.x, input.y, z, D);
    // The figure's frame moved: the springs see it as a shift in her own space.
    if (this.placed) {
      this.shiftX = (wx - this.object.position.x) / scale;
      this.shiftY = (wy - this.object.position.y) / scale;
      this.shiftZ = (wz - this.object.position.z) / scale;
      // A teleport is not a swing: a step of more than half her height starts the springs over.
      if (Math.hypot(this.shiftX, this.shiftY, this.shiftZ) > REF_HEIGHT * 0.5) this.snap();
      if (Math.abs(scale / this.scale - 1) > 0.5) this.snap();
    }
    this.pz = z;
    this.height = height;
    this.scale = scale;
    this.object.position.set(wx, wy, wz);
    this.object.scale.setScalar(scale);
    // Yaw about up, then a roll about the view axis.
    const q = this.tmp;
    qaxis(0, 1, 0, yaw, q, 0);
    qaxis(0, 0, 1, roll, q, 4);
    qmul(q, 4, q, 0, this.gq, 0);
    this.object.quaternion.set(this.gq[0]!, this.gq[1]!, this.gq[2]!, this.gq[3]!);
    this.film.position.set(-ANCHOR[0], -ANCHOR[1], -ANCHOR[2]);
    this.placed = true;
  }

  /**
   * The `x`, `y` and `height` for `place` that make a pose fill a rectangle of the screen (CSS
   * pixels, top left origin): "hands" is her body at the mouth (a portrait frame crops the far
   * claws), "idle" the whole of her lying in the air. `fill` is the share of the rectangle she takes.
   */
  frameFor(
    rect: Rect,
    pose: PoseFitName = "idle",
    fill = 0.94,
  ): { x: number; y: number; height: number } {
    return frameFor(
      rect,
      this.ctx.viewport(),
      POSE_FIT[pose],
      { x: ANCHOR[0], y: ANCHOR[1] },
      REF_HEIGHT,
      fill,
    );
  }

  /**
   * Draw her only inside a rectangle of the screen (CSS pixels, top left origin), or everywhere
   * with null. Four clipping planes on her own materials cut her, so the doll and Silverbolt in the
   * same pass are not cut by it. It follows the pixel camera: while a baked camera is drawn it is
   * ignored.
   */
  clipRectangle(rect: Rect | null): void {
    this.clipRect = rect;
  }

  // ------------------------------------------------------------------ clips

  /**
   * The state machine takes (back) the control. `expand` is the growth of the list's last frame, 0
   * to 1: past 0.12 going up she goes to the idle, below 0.04 going down she goes back to the pose
   * (`states.ts`). Call it every frame she is shown in the frame or the room. A transition clip
   * that began always plays to its end, whatever `expand` does.
   */
  drive(expand: number): void {
    this.expand = expand;
    if (!this.driven) {
      // Taking the control back: the loop that matches, cross faded from what was showing.
      this.driven = true;
      this.jumpAsked = true;
    }
  }

  /** A seek or a reload: the loop that matches `expand`, no transition. */
  jump(expand: number): void {
    this.expand = expand;
    this.driven = true;
    this.jumpAsked = true;
  }

  /** The state of the machine, or "free" when a section plays or scrubs a clip itself. */
  state(): SelenaState | "free" {
    return this.driven ? this.machine.state : "free";
  }

  /** Let go of the machine: she keeps what she plays until a section plays or scrubs something else. */
  handOver(): void {
    this.driven = false;
  }

  /** Show a clip at a time: a pure scrub. Loops wrap, the others hold their first and last pose. */
  clip(name: ClipName, time: number): void {
    this.startCarry();
    this.driven = false;
    this.player.scrub(name, time);
  }

  /** Show two clips at once, `b` blended over `a` by `w` (0 to 1): a cross fade a section drives. */
  blend(a: ClipName, ta: number, b: ClipName, tb: number, w: number, carry = true): void {
    if (carry) this.startCarry();
    else this.carryW = 0;
    this.driven = false;
    this.player.scrub(a, ta, b, tb, w);
  }

  /** The machine had her and a section takes a clip: remember what she showed (see `carryW`). */
  private startCarry(): void {
    if (!this.driven) return;
    this.carryClip = this.player.current();
    this.carryT = this.player.time();
    this.carryW = 1;
  }

  /**
   * Let her play on her own clock: loops loop (the seams are exact), a one shot holds its last
   * pose, `then` chains. Asking again for what already plays does nothing, so a section may call it
   * every frame. `fade` seconds cross fade from what was showing. The machine lets go.
   */
  play(name: ClipName, options?: PlayOptions): void {
    this.driven = false;
    this.player.play(name, options);
  }

  /** What the player shows now: the clip, its time, and whether it plays by itself. */
  clipState(): { clip: ClipName; time: number; playing: boolean; ended: boolean } {
    return {
      clip: this.player.playing() ? this.player.current() : this.player.pose.a,
      time: this.player.playing() ? this.player.time() : this.player.pose.ta,
      playing: this.player.playing(),
      ended: this.player.hasEnded(),
    };
  }

  // ------------------------------------------------------------------ the baked camera

  /**
   * The baked camera of `city_intercation03` at a clip time, for a screen of this size: fov,
   * aspect, a view offset (the screen is the bottom 80 percent of the baked frame) and a pose in
   * the world, composed with her own placement so the picture is the recording's whatever
   * `place` says. With `draw` (default) the whole cast is drawn through it for the next frame; call
   * it every frame it is wanted. Silverbolt and the doll must stand in `film` space (see
   * `docs/design/home/actor-selena.md`).
   */
  cameraFor(
    clipTime: number,
    viewport: { w: number; h: number },
    options?: FrameOptions & { draw?: boolean },
  ): PerspectiveCamera;
  /**
   * Round seven: the camera fitted to the recording for a clip at a clip time (`camera-r7.ts`,
   * `cameras-r7.json`). `portrait` 1 puts the frame in `rect` and covers it (the list's 4:5
   * window), 0 shows the whole recording frame on the screen, a number between mixes the two
   * lenses (the frame growing). With `draw` (default) the cast is drawn through it for the next
   * frame, with the sky behind her, and the cursor's view turn (`setView`) orbits it round her.
   */
  cameraFor(
    clip: ClipName,
    clipTime: number,
    viewport: { w: number; h: number },
    options?: R7Options,
  ): PerspectiveCamera;
  cameraFor(
    a: number | ClipName,
    b: number | { w: number; h: number },
    c?: { w: number; h: number } | (FrameOptions & { draw?: boolean }),
    d?: R7Options,
  ): PerspectiveCamera {
    if (typeof a === "string") {
      return this.cameraForClip(a, b as number, c as { w: number; h: number }, d);
    }
    return this.cameraForBaked(
      a,
      b as { w: number; h: number },
      c as (FrameOptions & { draw?: boolean }) | undefined,
    );
  }

  private cameraForBaked(
    clipTime: number,
    viewport: { w: number; h: number },
    options: FrameOptions & { draw?: boolean } = {},
  ): PerspectiveCamera {
    this.object.updateMatrixWorld(true);
    const cam = this.filmCamera;
    const s = this.camScratch;
    sampleBakedCamera(this.cams, "city_intercation03", clipTime, s);
    const p = this.tmp;
    qrotate(this.gq, 0, s[0]! - ANCHOR[0], s[1]! - ANCHOR[1], s[2]! - ANCHOR[2], p, 0);
    cam.position.set(
      this.object.position.x + p[0]! * this.scale,
      this.object.position.y + p[1]! * this.scale,
      this.object.position.z + p[2]! * this.scale,
    );
    qmul(this.gq, 0, s, 3, p, 4);
    cam.quaternion.set(p[4]!, p[5]!, p[6]!, p[7]!);
    const f = frameCamera(viewport.w, viewport.h, options);
    cam.fov = f.fov;
    cam.aspect = f.aspect;
    cam.near = 0.04 * this.scale;
    cam.far = 120 * this.scale;
    cam.setViewOffset(
      f.view.fullWidth,
      f.view.fullHeight,
      f.view.x,
      f.view.y,
      f.view.width,
      f.view.height,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    if (options.draw !== false) {
      this.cast.setCamera(cam);
      this.filmDrawn = true;
    }
    return cam;
  }

  private cameraForClip(
    clip: ClipName,
    clipTime: number,
    viewport: { w: number; h: number },
    options: R7Options = {},
  ): PerspectiveCamera {
    const data = this.r7;
    if (!data) throw new Error("cameras-r7.json was not loaded");
    this.r7Clip = clip;
    this.object.updateMatrixWorld(true);
    const cam = this.filmCamera;
    const wide = this.keyA;
    sampleR7(data, clip, clipTime, wide);
    // The lens: the whole recording frame on the screen, or the portrait camera's frame covering the
    // window, or a mix of the two (the pose mixes too).
    const k =
      typeof options.portrait === "number"
        ? clamp(options.portrait, 0, 1)
        : options.portrait
          ? 1
          : 0;
    const screen = { x: 0, y: 0, w: viewport.w, h: viewport.h };
    let lens = lensFor(screen, viewport, wide[R7_VFOV]!, wide[R7_SHY]!, data.aspect, 0, this.lensA);
    let key = wide;
    if (k > 0) {
      const tall = this.keyB;
      sampleR7(data, clip, clipTime, tall, "portrait");
      const rect = options.rect ?? screen;
      // A portrait window is a crop of the recording's frame (the same camera): `cropFor`.
      cropFor(data, clip, clipTime, this.cropNow);
      lensForCrop(
        rect,
        viewport,
        tall[R7_VFOV]!,
        tall[R7_SHY]!,
        data.aspect,
        this.cropNow,
        this.lensB,
      );
      lens = k >= 1 ? this.lensB : mixLens(viewport, this.lensA, this.lensB, k, this.lensC);
      if (k >= 1) key = tall;
      else {
        mixR7(wide, tall, k, this.keyC);
        key = this.keyC;
      }
    }
    // The pose in her own space, then the cursor's turn: the camera orbits her about the anchor,
    // as if she and Silverbolt turned together the other way. The sky is read before the turn.
    const w = this.turnW.x;
    const yaw = -this.turnYaw.x * w * VIEW_TURN.yawDeg * DEG;
    const pitch = this.turnPitch.x * w * VIEW_TURN.pitchDeg * DEG;
    const pos = this.r7Pos;
    const quat = this.r7Quat;
    for (let i = 0; i < 3; i += 1) pos[i] = key[i]!;
    for (let i = 0; i < 4; i += 1) quat[i] = key[3 + i]!;
    const gq = this.gq;
    this.r7Q.set(gq[0]!, gq[1]!, gq[2]!, gq[3]!);
    this.r7Film.makeRotationFromQuaternion(this.r7Q);
    if (yaw !== 0 || pitch !== 0) orbitAbout(ANCHOR, yaw, pitch, pos, quat);
    const p = this.tmp;
    qrotate(gq, 0, pos[0]! - ANCHOR[0], pos[1]! - ANCHOR[1], pos[2]! - ANCHOR[2], p, 0);
    cam.position.set(
      this.object.position.x + p[0]! * this.scale,
      this.object.position.y + p[1]! * this.scale,
      this.object.position.z + p[2]! * this.scale,
    );
    qmul(gq, 0, quat, 0, p, 4);
    cam.quaternion.set(p[4]!, p[5]!, p[6]!, p[7]!);
    cam.fov = lens.fov;
    cam.aspect = lens.aspect;
    cam.near = 0.04 * this.scale;
    cam.far = 120 * this.scale;
    cam.setViewOffset(
      lens.fullWidth,
      lens.fullHeight,
      lens.x - (options.shift ?? 0) * viewport.w,
      lens.y,
      lens.width,
      lens.height,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    // How tall she is on the screen at the anchor's distance: the ink's width follows it.
    const dx = pos[0]! - ANCHOR[0];
    const dy = pos[1]! - ANCHOR[1];
    const dz = pos[2]! - ANCHOR[2];
    this.inkHeight = (lens.focal * REF_HEIGHT) / Math.max(0.2, Math.hypot(dx, dy, dz));
    if (options.draw !== false) {
      this.r7Base.makeRotationFromQuaternion(cam.quaternion);
      this.sky?.point(cam, this.r7Base, this.r7Film);
      const cut = options.clip ?? options.rect;
      if (k > 0 && cut) this.cast.clipOnce(cut);
      // Her and what she stands with are drawn through this lens; the pair is drawn after, in pixels.
      this.cast.setCamera(cam, this.framed);
      this.filmDrawn = true;
    }
    return cam;
  }

  /**
   * Draw a root (Silverbolt) through the same lens as her whenever a fitted camera is drawn: it
   * stands in her own space, so it keeps its place beside her. Call it once.
   */
  frameWith(root: Object3D): void {
    if (!this.framed.includes(root)) this.framed.push(root);
  }

  /** Leave the room through the lens and crop measured from the bite recording. */
  exitCamera(t: number, vp: { w: number; h: number }): PerspectiveCamera {
    const u = Math.min(1, t / 0.45);
    const w = u * u * (3 - 2 * u);
    const room = this.roomCamera;
    if (w < 1 && this.r7) room.copy(this.cameraForClip(CLIP.idle, 0, vp, { draw: false }), false);
    const cam = this.cameraForBaked(t, vp, { draw: false, band: 0.84 });
    // Keep the palm to the left of her face as in the recording, including on a 16:10 canvas.
    cam.view!.offsetX = -0.095 * vp.h;
    cam.updateProjectionMatrix();
    if (w < 1 && this.r7) {
      cam.position.lerp(room.position, 1 - w);
      cam.quaternion.slerp(room.quaternion, 1 - w);
      // Mix the focal lengths and principal point of the two off-centre frusta.
      for (const i of [0, 5, 8, 9]) {
        const e = cam.projectionMatrix.elements;
        e[i] = room.projectionMatrix.elements[i]! * (1 - w) + e[i]! * w;
      }
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
    this.pointSky(cam);
    this.cast.setCamera(cam, this.framed);
    return cam;
  }

  /**
   * Ask for her picture through the fitted camera of the clip she is playing, for the next draw:
   * the actor draws it itself in `update`, after the pose of this frame is written, so the camera
   * and the pose never differ by a frame. Call it every frame she is shown in a frame or a room.
   * `portrait` and `rect` are as in `cameraFor`. Nothing is allocated.
   */
  frame(viewport: { w: number; h: number }, options: R7Options = {}): void {
    const ask = this.frameAsk;
    ask.on = true;
    ask.vp.w = viewport.w;
    ask.vp.h = viewport.h;
    ask.options.shift = options.shift ?? 0;
    const portrait = options.portrait;
    ask.options.portrait = typeof portrait === "number" ? portrait : portrait ? 1 : 0;
    const r = options.rect;
    if (r) {
      ask.rect.x = r.x;
      ask.rect.y = r.y;
      ask.rect.w = r.w;
      ask.rect.h = r.h;
      ask.options.rect = ask.rect;
    } else {
      ask.options.rect = null;
    }
    const c = options.clip;
    if (c) {
      ask.cut.x = c.x;
      ask.cut.y = c.y;
      ask.cut.w = c.w;
      ask.cut.h = c.h;
      ask.options.clip = ask.cut;
    } else {
      ask.options.clip = null;
    }
  }

  private drawFrame(): void {
    const ask = this.frameAsk;
    if (!ask.on) return;
    ask.on = false;
    if (!this.r7) return;
    const c = this.clipState();
    this.cameraForClip(c.clip, c.time, ask.vp, ask.options);
  }

  /** True when `cameras-r7.json` was loaded: `cameraFor(clip, ...)` and `frame` work. */
  hasFittedCameras(): boolean {
    return this.r7 !== null;
  }

  /**
   * Point the sky through a camera a section set itself (a zoomed window of the out camera) and
   * draw it in this frame. The camera's own pose is the sky's: no view turn. Call it with every
   * `cast.setCamera(camera)` that is not made by `frame` or `cameraFor`.
   */
  pointSky(camera: PerspectiveCamera): void {
    if (!this.sky) return;
    camera.updateMatrixWorld(true);
    this.r7Base.extractRotation(camera.matrixWorld);
    this.r7Q.set(this.gq[0]!, this.gq[1]!, this.gq[2]!, this.gq[3]!);
    this.r7Film.makeRotationFromQuaternion(this.r7Q);
    this.sky.point(camera, this.r7Base, this.r7Film);
    this.filmDrawn = true;
  }

  /** The clip the last `cameraFor(clip, ...)` followed. */
  cameraClip(): ClipName {
    return this.r7Clip;
  }

  /** Show or hide the sky (default shown): a section that wants her over its own background hides it. */
  skyVisible(on: boolean): void {
    this.skyOn = on;
  }

  /**
   * The cursor turns the whole model, slightly: `nx` and `ny` are the cursor from the middle of the
   * screen, -1 to 1 (`nx` right, `ny` up), `weight` 0 to 1 how much of the turn is on (1 in the
   * idle, 0 in the pose and in the transitions). The camera orbits her about her anchor by up to
   * `VIEW_TURN` degrees on springs that do not overshoot, and the sky does not move, so she and
   * Silverbolt turn against it. Call it every frame.
   */
  setView(nx: number, ny: number, weight: number): void {
    const dt = Math.min(0.1, Math.max(0, this.clock - this.turnClock));
    this.turnClock = this.clock;
    this.turnYaw.step(clamp(nx, -1, 1), dt);
    this.turnPitch.step(clamp(ny, -1, 1), dt);
    this.turnW.step(clamp(weight, 0, 1), dt);
  }

  // ------------------------------------------------------------------ looks and the face

  /** Where she looks. The pointer by default (the head and eyes follow it, within limits). */
  look(target: LookTarget): void {
    this.lookTarget = target;
  }

  /** Hold an expression (`amount` 0 to 1). A section sets it every frame; a touch reacts on top. */
  expression(name: Expression, amount = 1): void {
    this.face.set(name, amount);
  }

  /** The mouth moves as if she spoke: 0 shut, 1 lively. */
  talk(level: number): void {
    this.face.talk(level);
  }

  /** A one-shot expression on top, for `seconds`. */
  react(name: Expression, seconds = 1.2): void {
    this.face.react(name, seconds);
  }

  /** A point of her body, in her own space (an Object3D that follows the animated bone). */
  socket(name: SocketName): Object3D {
    return this.sockets[name];
  }

  /**
   * A socket on any bone of hers (her own space), `along` the bone's axis, kept on it every frame.
   * The out animation pins the fingertips to hang the white sheet on them. Call it once.
   */
  pin(bone: string, along = 0): Object3D {
    const obj = new Object3D();
    obj.name = `selena_pin_${bone}`;
    this.film.add(obj);
    const node = this.rig.index.get(bone) ?? -1;
    this.pins.push({ obj, node, along });
    return obj;
  }

  /**
   * The out animation: for the next frame the right arm is solved so that the wrist is at a point
   * of the picture seen through `input.camera`, and the fingers close (`pull-arm.ts`). Call it every
   * frame it is wanted; a frame without a call is the clip's own arm.
   */
  pull(input: PullInput | null): void {
    this.pullIn = input;
  }

  /** The wrist in the world as the clip has it, before any pull (it reads what the last frame set). */
  clipHandWorld(): { x: number; y: number; z: number } {
    return this.pullArm.clipHand;
  }

  /** A bone's place on the screen right now (stage pixels), for a section that points at her. */
  screenPoint(
    name: "head" | "eyes" | "handL" | "handR" | "pelvis",
    out: { x: number; y: number },
  ): void {
    const i = POINT[name];
    out.x = this.scr[i * 3]!;
    out.y = this.scr[i * 3 + 1]!;
  }

  /**
   * The box of her skin in her own space for a clip at a time (metres). It scrubs her and skins every
   * vertex on the CPU, so it is for a probe that measures `ANCHOR`, `REF_HEIGHT` and `POSE_FIT`,
   * never for a frame.
   */
  measure(
    name: ClipName,
    time: number,
  ): { min: number[]; max: number[]; core: { min: number[]; max: number[] } } {
    this.player.scrub(name, time);
    this.writePose(0);
    this.object.updateMatrixWorld(true);
    const inverse = this.film.matrixWorld.clone().invert();
    const box = new Box3();
    const v = new Vector3();
    for (const mesh of this.rig.meshes.all) {
      if (mesh === this.rig.meshes.eye) continue;
      const count = mesh.geometry.getAttribute("position").count;
      for (let i = 0; i < count; i += 1) {
        mesh.getVertexPosition(i, v);
        v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        box.expandByPoint(v);
      }
    }
    // The core: the head with its horns, the hands, the feet, the pelvis.
    const core = new Box3();
    for (const p of [
      POINT.headTop,
      POINT.handL,
      POINT.handR,
      POINT.footL,
      POINT.footR,
      POINT.pelvis,
    ]) {
      const node = this.pointNode[p]!;
      qrotate(this.work.mq, node * 4, this.pointAlong[p]!, 0, 0, this.tmp, 0);
      core.expandByPoint(
        v.set(
          this.work.mp[node * 3]! + this.tmp[0]!,
          this.work.mp[node * 3 + 1]! + this.tmp[1]!,
          this.work.mp[node * 3 + 2]! + this.tmp[2]!,
        ),
      );
    }
    core.expandByScalar(0.12);
    return {
      min: box.min.toArray(),
      max: box.max.toArray(),
      core: { min: core.min.toArray(), max: core.max.toArray() },
    };
  }

  stats(): SelenaStats {
    return { updateMs: this.updateMs, updateAvgMs: this.updateAvg };
  }

  debug(): SelenaDebug {
    return {
      scale: this.scale,
      state: this.state(),
      look: this.lookW,
      view: this.viewW,
      points: this.scr,
      filmCamera: this.filmCamera,
    };
  }

  /** Compile her programs and upload her pictures now, so the first frame she shows does not hitch. */
  async warm(renderer: WebGLRenderer, camera: PerspectiveCamera): Promise<void> {
    const was = this.object.visible;
    // Compile far off the screen: the pass draws what is visible, and the page may be showing
    // while this awaits (a section builds its actors two screens early).
    const at = this.object.position.clone();
    this.object.position.set(0, 1e6, 0);
    this.object.visible = true;
    try {
      for (const texture of this.textures) renderer.initTexture(texture);
      await renderer.compileAsync(this.object, camera);
    } catch {
      // A failed warm only means the first frame compiles them.
    }
    this.object.visible = was;
    this.object.position.copy(at);
  }

  // ------------------------------------------------------------------ the frame

  update(frame: FrameInfo): void {
    const t0 = performance.now();
    const dt = frame.dt;
    this.clock += dt;
    if (frame.frame - this.lastFrame > GAP_FRAMES) this.snap();
    this.lastFrame = frame.frame;

    this.stepMachine();
    this.writePose(dt);
    // A pull lasts one frame: the section asks again while it wants the arm.
    this.pullIn = null;
    this.pushView();
    this.drawFrame();
    this.updateClip();
    this.updateOutline();
    this.ctx.stage.renderer.localClippingEnabled = true;
    // The sky is drawn only in a frame a camera was set for (`cameraFor`), like the clip rectangle.
    if (this.sky) this.sky.visible = this.filmDrawn && this.skyOn;
    this.filmDrawn = false;

    const ms = performance.now() - t0;
    this.updateMs = ms;
    this.updateAvg += (ms - this.updateAvg) * 0.05;
    this.shiftX = 0;
    this.shiftY = 0;
    this.shiftZ = 0;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.toon.dispose();
    for (const g of this.geometries) g.dispose();
    for (const t of this.textures) t.dispose();
  }

  // ------------------------------------------------------------------ pose

  /** Sample, add the turns, compose, spring, and write the bones. */
  private writePose(dt: number): void {
    const { rig, work, pose, poseB } = this;
    const pp = this.player.step(dt);
    pose.set(rig.rest);
    sampleClip(rig.clips[pp.a], pp.ta, pose);
    if (pp.b !== null && pp.w > 0) {
      poseB.set(rig.rest);
      sampleClip(rig.clips[pp.b], pp.tb, poseB);
      blendPoses(pose, poseB, pp.w, pose);
    }
    if (this.carryW > 0) {
      const k = this.carryW;
      poseB.set(rig.rest);
      sampleClip(rig.clips[this.carryClip], this.carryT, poseB);
      blendPoses(pose, poseB, k * k * (3 - 2 * k), pose);
      const info = rig.info[this.carryClip];
      this.carryT += dt;
      if (this.carryT > info.duration) {
        this.carryT = info.loop ? this.carryT - info.duration : info.duration;
      }
      this.carryW = Math.max(0, k - dt / JUMP_FADE);
    }

    // A scrub that jumps, or a clip switched while scrubbing, is not a swing.
    const scrubbed = !this.player.playing();
    if (scrubbed) {
      const dur = rig.info[pp.a].duration;
      let d = Math.abs(pp.ta - this.lastClipTime);
      if (rig.info[pp.a].loop) d = Math.min(d, dur - d);
      if (pp.a !== this.lastClip || d > SCRUB_JUMP) this.snap();
    } else if (this.lastScrubbed) {
      this.springs.snap();
    }
    this.lastScrubbed = scrubbed;
    this.lastClip = pp.a;
    this.lastClipTime = pp.ta;

    work.clearTurns();
    this.addTurns(dt);
    this.idleTouch.step(
      work,
      this.filmCamera,
      this.ctx.pointer.state,
      this.ctx.stage.width,
      this.ctx.stage.height,
      this.scale,
      this.driven && this.machine.state === "idle",
      this.viewW,
      dt,
      this.clock,
    );
    work.compose(this.hier, pose);
    // The out animation's pull: where the clip has the wrist, then (when a section asks) the arm
    // solved to the screen's target and the fingers closed, and the hierarchy composed once more.
    this.pullArm.measure(work, this.object.position, this.gq, this.scale);
    if (this.pullIn) {
      this.pullArm.apply(this.pullIn, work, this.object.position, this.gq, this.scale);
      work.compose(this.hier, pose);
    }

    // The springs, with what the world does to them: the figure's own move and a breeze.
    const env = this.env;
    env.shiftX = this.shiftX;
    env.shiftY = this.shiftY;
    env.shiftZ = this.shiftZ;
    const c = this.clock;
    env.windX = 0.9 * Math.sin(c * 0.7) + 0.5 * Math.sin(c * 1.9 + 1);
    env.windY = 0.25 * Math.sin(c * 1.1 + 2);
    env.windZ = 0.6 * Math.sin(c * 0.5 + 4);
    this.springs.step(dt, pose, work, env);

    this.writeBones();
    this.writeFace(dt);
    this.writeSockets();
    this.project();
  }

  private writeBones(): void {
    const { rig, work, pose } = this;
    for (let i = 0; i < rig.nodes.length; i += 1) {
      const node = rig.nodes[i]!;
      const o = i * POSE_STRIDE;
      node.position.set(pose[o]!, pose[o + 1]!, pose[o + 2]);
      node.quaternion.set(
        work.fq[i * 4]!,
        work.fq[i * 4 + 1]!,
        work.fq[i * 4 + 2]!,
        work.fq[i * 4 + 3]!,
      );
      if (rig.scaled[i]) node.scale.set(pose[o + 7]!, pose[o + 8]!, pose[o + 9]);
    }
  }

  private writeFace(dt: number): void {
    const weights = this.face.step(dt);
    const infl = this.head.morphTargetInfluences;
    if (!infl) return;
    for (let i = 0; i < weights.length; i += 1) {
      const at = this.morphIndex[i]!;
      if (at >= 0) infl[at] = weights[i]!;
    }
  }

  /** Put a socket on a bone (her own space), `along` its axis, plus an offset in her space. */
  private putSocket(
    socket: Object3D,
    bone: number,
    along: number,
    x = 0,
    y = 0,
    z = 0,
    keepTurn = true,
  ): void {
    if (bone < 0) return;
    const { work } = this;
    const t = this.tmp;
    qrotate(work.mq, bone * 4, along, 0, 0, t, 0);
    socket.position.set(
      work.mp[bone * 3]! + t[0]! + x,
      work.mp[bone * 3 + 1]! + t[1]! + y,
      work.mp[bone * 3 + 2]! + t[2]! + z,
    );
    if (keepTurn) {
      socket.quaternion.set(
        work.mq[bone * 4]!,
        work.mq[bone * 4 + 1]!,
        work.mq[bone * 4 + 2]!,
        work.mq[bone * 4 + 3]!,
      );
    } else {
      socket.quaternion.set(0, 0, 0, 1);
    }
  }

  /** Move the sockets onto the animated bones (her own space). */
  private writeSockets(): void {
    const { ix, sockets } = this;
    this.putSocket(sockets.rightHand, ix.handR, 0.045);
    this.putSocket(sockets.leftHand, ix.handL, 0.045);
    this.putSocket(sockets.head, ix.head, 0.2);
    this.putSocket(sockets.mouth, ix.mouth, 0.02);
    for (const pin of this.pins) this.putSocket(pin.obj, pin.node, pin.along);
  }

  /** Project her points to the screen, once a frame, for the gaze, the fingers and the hit tests. */
  private project(): void {
    const { work, scr } = this;
    const t = this.tmp;
    const g = this.gq;
    const s = this.scale;
    const cx = ANCHOR[0];
    const cy = ANCHOR[1];
    const cz = ANCHOR[2];
    for (let i = 0; i < POINT.count; i += 1) {
      const node = this.pointNode[i]!;
      if (node < 0) continue;
      qrotate(work.mq, node * 4, this.pointAlong[i]!, 0, 0, t, 0);
      let mx = work.mp[node * 3]! + t[0]!;
      let my = work.mp[node * 3 + 1]! + t[1]!;
      let mz = work.mp[node * 3 + 2]! + t[2]!;
      if (i === POINT.eyes && this.eyeR >= 0) {
        mx = (mx + work.mp[this.eyeR * 3]!) * 0.5;
        my = (my + work.mp[this.eyeR * 3 + 1]!) * 0.5;
        mz = (mz + work.mp[this.eyeR * 3 + 2]!) * 0.5;
      }
      qrotate(g, 0, (mx - cx) * s, (my - cy) * s, (mz - cz) * s, t, 4);
      const wx = this.object.position.x + t[4]!;
      const wy = this.object.position.y + t[5]!;
      const wz = this.object.position.z + t[6]!;
      const k = D / Math.max(1, D - wz);
      scr[i * 3] = wx * k;
      scr[i * 3 + 1] = wy * k;
      scr[i * 3 + 2] = s * k;
    }
  }

  // ------------------------------------------------------------------ the states

  /** Look at the growth and the machine, and start a clip only when the state changes. */
  private stepMachine(): void {
    if (!this.driven) return;
    const m = this.machine;
    if (this.jumpAsked) {
      this.jumpAsked = false;
      m.jump(this.expand);
      this.enter(m.state, JUMP_FADE);
      return;
    }
    m.target(this.expand);
    const next = m.step(this.player.hasEnded());
    if (next) this.enter(next, STATE_FADE[next]);
  }

  /** Start the clip of a state. A loop that already plays is not restarted (the player knows). */
  private enter(state: SelenaState, fade: number): void {
    switch (state) {
      case "pose":
        this.player.play(CLIP.hands, { loop: true, fade });
        break;
      case "idle":
        this.player.play(CLIP.idle, { loop: true, fade });
        break;
      case "toIdle":
        this.player.play(CLIP.release, { loop: false, fade });
        break;
      case "toPose":
        this.player.play(CLIP.poseIn, { loop: false, fade });
        break;
    }
  }

  // ------------------------------------------------------------------ turns on top of the clip

  /**
   * The only things the cursor does (round seven): her head and eyes follow it a little, in the
   * pose and in the idle, and the view turns a little in the idle. Both fade with the state and are
   * zero in the two transitions. Nothing else reacts.
   */
  private addTurns(dt: number): void {
    const { work, ix } = this;
    const want = this.driven ? interactionOf(this.machine.state) : FREE_WEIGHTS;
    const rate = approach(5, dt);
    this.lookW += (want.look - this.lookW) * rate;
    this.viewW += (want.view - this.viewW) * rate;

    // The pointer, as a share of the screen from her eyes (the head) and from the middle (the view).
    const ps = this.ctx.pointer.state;
    const W = this.ctx.stage.width;
    const H = this.ctx.stage.height;
    const live = ps.type === "touch" ? ps.down : ps.inside;
    let px = 0;
    let py = 0;
    let has = false;
    if (this.lookTarget === "pointer") {
      if (live) {
        px = ps.x - W / 2;
        py = H / 2 - ps.y;
        has = true;
      }
    } else if (typeof this.lookTarget === "object") {
      px = this.lookTarget.x;
      py = this.lookTarget.y;
      has = true;
    }
    const eyes = POINT.eyes * 3;
    const nx = has ? clamp((px - this.scr[eyes]!) / (0.5 * W), -1, 1) : 0;
    const ny = has ? clamp((py - this.scr[eyes + 1]!) / (0.5 * H), -1, 1) : 0;
    this.viewX.step(has ? clamp(px / (0.5 * W), -1, 1) : 0, dt);
    this.viewY.step(has ? clamp(py / (0.5 * H), -1, 1) : 0, dt);

    const split = gentleGaze(nx * this.lookW, ny * this.lookW, this.gaze);
    const gs = this.gazeSprings;
    const v = this.wish;
    v[0] = split.headYaw;
    v[1] = split.headPitch;
    v[2] = split.eyeYaw;
    v[3] = split.eyePitch;
    for (let i = 0; i < 4; i += 1) gs[i]!.step(v[i]!, dt);

    // The head takes most of its turn, the neck the rest; the eyes lead the head a little.
    const { neck, head } = ix;
    const yaw = gs[0]!.x;
    const pitch = gs[1]!.x;
    if (neck >= 0) {
      work.turnModel(neck, 0, 1, 0, yaw * NECK_SHARE);
      work.turnModel(neck, 1, 0, 0, -pitch * NECK_SHARE);
    }
    if (head >= 0) {
      work.turnModel(head, 0, 1, 0, yaw * (1 - NECK_SHARE));
      work.turnModel(head, 1, 0, 0, -pitch * (1 - NECK_SHARE));
    }
    for (const eye of [ix.eyeL, ix.eyeR]) {
      if (eye < 0) continue;
      work.turnModel(eye, 0, 1, 0, gs[2]!.x);
      work.turnModel(eye, 1, 0, 0, -gs[3]!.x);
    }
  }

  /**
   * Hand the cursor to the view turn (SEL-camera-sky's `setView(nx, ny, weight)`): the cursor as a
   * share of the screen from its middle, eased, and the weight that is 1 in the idle and 0 in the
   * pose and in the two transitions.
   */
  private pushView(): void {
    this.setView(this.viewX.x, this.viewY.x, this.viewW);
  }

  /** Start the springs and the gaze over (a jump, or a frame after she was hidden). */
  private snap(): void {
    this.springs.snap();
    for (const s of this.gazeSprings) s.snap(0);
  }

  // ------------------------------------------------------------------ the frame, the clip planes, the ink

  private updateClip(): void {
    const W = this.ctx.stage.width;
    const H = this.ctx.stage.height;
    const rect = this.filmDrawn ? null : this.clipRect;
    const key = rect ? `${rect.x},${rect.y},${rect.w},${rect.h},${W},${H}` : "open";
    if (key === this.clipKey) return;
    this.clipKey = key;
    // Planes through the camera and the four edges, in the stage's world (camera at z = D).
    const far = 1e5;
    const xl = rect ? rect.x - W / 2 : -far;
    const xr = rect ? rect.x + rect.w - W / 2 : far;
    const yt = rect ? H / 2 - rect.y : far;
    const yb = rect ? H / 2 - rect.y - rect.h : -far;
    const set = (plane: Plane, nx: number, ny: number, nz: number): void => {
      const len = Math.hypot(nx, ny, nz);
      plane.normal.set(nx / len, ny / len, nz / len);
      plane.constant = -(plane.normal.z * D);
    };
    set(this.planes[0]!, D, 0, xl);
    set(this.planes[1]!, -D, 0, -xr);
    set(this.planes[2]!, 0, D, yb);
    set(this.planes[3]!, 0, -D, -yt);
  }

  /** The ink keeps its width in pixels whatever her size: it only needs her height on the screen. */
  private updateOutline(): void {
    this.toon.setHeight(
      this.filmDrawn && this.inkHeight > 0
        ? this.inkHeight
        : (this.height * D) / Math.max(1, D - this.pz),
    );
  }

  // ------------------------------------------------------------------ build

  /**
   * Put the toon look and the ink on every mesh (`toonify`): skin warm on the face, hair with a
   * crisp highlight, the armour and claws as metal, the eyes unlit. The alpha cards of the fringe
   * have no ink (a line along a card's edge is a box) and write depth, drawn after the head.
   */
  private dress(rig: Rig, anisotropy: number): ToonSet {
    const { head, eye, hair01, hair02, body } = rig.meshes;
    for (const mesh of rig.meshes.all) {
      mesh.frustumCulled = false;
      this.geometries.add(mesh.geometry);
    }
    const fringe = standardOf(hair01);
    fringe.alphaTest = 0.02;
    fringe.depthWrite = true;
    hair01.renderOrder = 1;
    const looks = new Map<SkinnedMesh, ToonPick>([
      // The line is the in-game hairline in the colour of what it draws (warm on the hair, rose on
      // the skin, deep on the armour). The face has it on its outline only, none inside it.
      [
        head,
        {
          look: "skin",
          tune: SELENA_TUNE.head,
          inkTint: INK_TINTS.skin,
          inkFace: FACE_LINE,
          inkFloor: INK_FLOORS.skin,
        },
      ],
      [
        hair01,
        {
          look: "hair",
          tune: SELENA_TUNE.hair,
          ink: "card",
          inkCopies: FRINGE_COPIES,
          inkTint: INK_TINTS.hair,
          inkFloor: INK_FLOORS.hair,
        },
      ],
      [
        hair02,
        {
          look: "hair",
          tune: SELENA_TUNE.hair,
          inkWeight: 0.8,
          inkTint: INK_TINTS.hair,
          inkFloor: INK_FLOORS.hair,
        },
      ],
      [eye, { unlit: true }],
      // The body sheet holds her skin beside the armour: the skin colours take the warm shade.
      ...body.map((mesh): [SkinnedMesh, ToonPick] => [
        mesh,
        {
          look: "default",
          tune: SELENA_TUNE.body,
          skinSplit: true,
          inkTint: INK_TINTS.body,
          inkFloor: INK_FLOOR_BODY,
        },
      ]),
    ]);
    return toonify(rig.scene, {
      pick: (mesh) => looks.get(mesh as SkinnedMesh),
      clippingPlanes: this.planes,
      anisotropy,
      fineInk: true,
    });
  }

  /** Make a left and a right blink out of the one the file has, so she can wink. */
  private splitBlink(head: SkinnedMesh): void {
    const geo = head.geometry;
    const dict = head.morphTargetDictionary;
    const targets = geo.morphAttributes.position;
    const at = dict?.blink;
    if (!dict || !targets || at === undefined) return;
    const blink = targets[at];
    const pos = geo.getAttribute("position");
    if (!blink) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    const mid = (lo + hi) / 2;
    const left = new Float32Array(blink.count * 3);
    const right = new Float32Array(blink.count * 3);
    for (let i = 0; i < blink.count; i += 1) {
      // Her left is +x: the half of the face on that side.
      const into = pos.getX(i) > mid ? left : right;
      into[i * 3] = blink.getX(i);
      into[i * 3 + 1] = blink.getY(i);
      into[i * 3 + 2] = blink.getZ(i);
    }
    // The loader keeps the shape names in the dictionary only: give them to the shapes, because
    // `updateMorphTargets` below builds the dictionary again from the names the shapes carry.
    for (const [name, i] of Object.entries(dict)) {
      const shape = targets[i];
      if (shape) shape.name = name;
    }
    const names = ["wink_l", "wink_r"];
    [left, right].forEach((data, k) => {
      const attr = new Float32BufferAttribute(data, 3);
      attr.name = names[k]!;
      targets.push(attr);
      geo.morphAttributes.normal?.push(
        new Float32BufferAttribute(new Float32Array(data.length), 3),
      );
    });
    head.updateMorphTargets();
  }
}
