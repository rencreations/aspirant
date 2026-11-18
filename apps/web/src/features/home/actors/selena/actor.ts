/**
 * Selena, in the shared cast pass. A plain class: a section builds her through `ensureSelena`,
 * sets her state every frame it shows her (`place`, a clip, a look, an expression), and she
 * integrates her own motion in `update`: the clip, the head and eyes that follow the pointer, the
 * fingers, the hair and skirt springs, the face, the reactions to being touched. Every one-shot
 * reaction is timed here and always finishes.
 *
 * The pose is made without the animation mixer: the four clips are sampled by `sampler.ts` (a pure
 * scrub of any time, a cross fade of any two), turns are added on top (`skeleton.ts`), the springs
 * run last (`physics.ts`), and the result is written to the bones once. Docs: `docs/design/home/actor-selena.md`.
 */
import {
  Box3,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshToonMaterial,
  type SkinnedMesh,
  type Texture,
  type WebGLRenderer,
} from "three";

import { PIXEL_DISTANCE } from "../../kernel/stage";
import type { Actor, FrameInfo, HitTarget } from "../../kernel/types";
import type { Cast } from "../shared/cast";
import type { ActorCtx } from "../shared/types";

import {
  type CameraData,
  dollOffset,
  frameCamera,
  sampleBakedCamera,
  type FrameOptions,
} from "./camera";
import {
  ANCHOR,
  BAKED,
  BONE,
  CLIP,
  DOLL_ANCHOR,
  FADE,
  LOOK_RECIPE,
  POSE_FIT,
  REF_HEIGHT,
  fingerBones,
  type PoseFitName,
} from "./constants";
import { Face, MORPH_NAMES, type Expression } from "./face";
import {
  FIST,
  FINGERS,
  FingerBank,
  breath,
  flexAxis,
  jointAngle,
  pointerCurl,
  waveCurl,
  type HandInput,
} from "./fingers";
import { frameFor, inside, worldPoint, worldScale, type PlaceInput, type Rect } from "./framing";
import { capsuleHit } from "./hit";
import { emptyGaze, gazeAngles, splitGaze } from "./look";
import { makeInk, makeShared, makeToon, type Ink, type ToonShared } from "./material";
import { Spring, clamp } from "./motion";
import { outlineUnits } from "./outline";
import { SpringBones, emptyEnv, type SpringEnv } from "./physics";
import { ClipPlayer, type ClipName, type PlayOptions, type PlayerPose } from "./player";
import { POINT, pointSpecs } from "./points";
import { qaxis, qmul, qrotate } from "./quat";
import { Pulse } from "./reactions";
import { buildRig, standardOf, type Rig } from "./rig";
import { POSE_STRIDE, blendPoses, sampleClip } from "./sampler";
import { PoseWork } from "./skeleton";
import { buildSpringDefs } from "./springs";

export type { ClipName, PlayOptions } from "./player";
export type { Expression } from "./face";
export type { PlaceInput, Rect } from "./framing";
export type { FrameOptions } from "./camera";

export type SocketName = "rightHand" | "leftHand" | "mouth" | "head" | "rightHover";

/** Where she looks: the pointer (default), the viewer, a point on the screen, or the idle drift. */
export type LookTarget = "pointer" | "viewer" | "idle" | { x: number; y: number };

export interface SelenaStats {
  /** Milliseconds `update` took on the last frame, and the average of the last sixty. */
  updateMs: number;
  updateAvgMs: number;
}

/** What the lab and the probes may read. */
export interface SelenaDebug {
  /** The ten finger curls (left hand thumb to pinky, then the right). */
  curl: number[];
  fist: boolean[];
  scale: number;
  points: Float32Array;
  filmCamera: PerspectiveCamera;
}

const D = PIXEL_DISTANCE;
/** How big she is by default: a share of the viewport height. */
const DEFAULT_HEIGHT = 0.8;
/** A frame this far from the last one is a jump: the springs and the fingers start over. */
const GAP_FRAMES = 2;
/** A scrub that moves the clip by more than this in a frame is a jump (seconds). */
const SCRUB_JUMP = 0.3;

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
  private readonly fingers = new FingerBank();
  private readonly face = new Face();

  private readonly pose: Float32Array;
  private readonly poseB: Float32Array;
  private readonly hier: { count: number; parent: Int32Array };
  private readonly tmp = new Float32Array(16);
  /** Scratch that a frame reuses: no frame makes an array or an object. */
  private readonly wish = new Float32Array(6);
  private readonly curlScratch = new Float32Array(5);
  private readonly tipScratch = new Float32Array(10);
  private readonly hoverScratch = [0, 0, 0];
  private readonly angleScratch = { yaw: 0, pitch: 0 };
  private readonly handIn: HandInput = {
    px: 0,
    py: 0,
    tips: this.tipScratch,
    palmX: 0,
    palmY: 0,
    radius: 1,
    live: false,
  };
  /** Bone indexes the frame turns, found once. */
  private readonly ix = {
    neck: -1,
    head: -1,
    eyeL: -1,
    eyeR: -1,
    spine1: -1,
    spine2: -1,
    pelvis: -1,
    propL: -1,
    propR: -1,
    handL: -1,
    handR: -1,
    mouth: -1,
  };
  /** The nodes and the flex axes of the fingers: [hand][finger][joint] flattened. */
  private readonly fingerNode = new Int32Array(30);
  private readonly fingerAxis = new Float32Array(30 * 3);
  private readonly env: SpringEnv = emptyEnv();

  private readonly shared: ToonShared;
  private readonly inks: Ink[] = [];
  private readonly toons: MeshToonMaterial[] = [];
  private readonly materials: Material[] = [];
  private readonly textures = new Set<Texture>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly planes = [new Plane(), new Plane(), new Plane(), new Plane()];
  private readonly morphIndex: Int16Array;
  private readonly head: SkinnedMesh;
  private readonly sockets: Record<SocketName, Object3D>;
  private readonly removeHits: Array<() => void> = [];

  // Placement.
  private pz = 0;
  private height = 0;
  private yaw = 0;
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
  private readonly camScratch = new Float32Array(7);
  private lastFrame = -10;
  private lastClip: ClipName = CLIP.idle;
  private lastClipTime = 0;
  private lastScrubbed = false;
  private clock = 0;
  private interactiveOn = true;
  private filmDrawn = false;
  /** The baked camera was drawn on the last frame: the pointer is not on the pixel picture. */
  private filmWas = false;

  // Look.
  private lookTarget: LookTarget = "pointer";
  private readonly gaze = emptyGaze();
  private readonly gazeSprings = Array.from({ length: 6 }, () => new Spring(10, 0.8, 0));
  private readonly bodyYaw = new Spring(5, 0.8, 0);
  private readonly bodyLean = new Spring(6, 0.7, 0);

  // Touch.
  private readonly pat = new Pulse();
  private readonly tilt = new Pulse();
  private readonly hip = new Pulse();
  private readonly wiggle = [new Pulse(), new Pulse()];
  private readonly fist: [boolean, boolean] = [false, false];
  private readonly clawSpin = [new Spring(7, 0.55, 0), new Spring(7, 0.55, 0)];
  private readonly clawTurns = [0, 0];
  private tiltSign = 1;
  private hairLastX = 0;
  private hairLastY = 0;
  private hairHas = false;

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
  ) {
    this.cams = cams;
    this.cast = cast;
    const rig = buildRig(gltf);
    this.rig = rig;
    const n = rig.nodes.length;
    this.hier = { count: n, parent: rig.parent };
    this.work = new PoseWork(n);
    this.pose = new Float32Array(rig.rest);
    this.poseB = new Float32Array(rig.rest);
    this.player = new ClipPlayer(rig.info, CLIP.idle);
    this.springs = new SpringBones(buildSpringDefs(rig.names, rig.parent, rig.rest));

    // The scene graph: root > film > the loaded scene.
    this.film.add(rig.scene);
    this.object.add(this.film);
    this.object.visible = false;
    cast.add(this.object);

    this.head = rig.meshes.head;
    this.morphIndex = new Int16Array(MORPH_NAMES.length).fill(-1);
    this.splitBlink(this.head);
    this.shared = makeShared(1);
    this.dress(rig);
    MORPH_NAMES.forEach((name, i) => {
      this.morphIndex[i] = this.head.morphTargetDictionary?.[name] ?? -1;
    });

    const aniso = Math.min(8, ctx.stage.renderer.capabilities.getMaxAnisotropy());
    for (const toon of this.toons) {
      if (toon.map) toon.map.anisotropy = aniso;
    }

    // Sockets: children of her own space, moved every frame onto the animated bones.
    this.sockets = {
      rightHand: new Object3D(),
      leftHand: new Object3D(),
      mouth: new Object3D(),
      head: new Object3D(),
      rightHover: new Object3D(),
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
      spine1: at(BONE.spine[1]),
      spine2: at(BONE.spine[2]),
      pelvis: at(BONE.pelvis),
      propL: at(BONE.propL),
      propR: at(BONE.propR),
      handL: at(BONE.handL),
      handR: at(BONE.handR),
      mouth: at(BONE.mouth),
    });
    (["L", "R"] as const).forEach((side, hand) => {
      FINGERS.forEach((finger, f) => {
        const chain = fingerBones(side, finger);
        const axis = flexAxis(side, finger);
        for (let j = 0; j < 3; j += 1) {
          const slot = (hand * 5 + f) * 3 + j;
          this.fingerNode[slot] = at(chain[j]!);
          this.fingerAxis[slot * 3] = axis[0];
          this.fingerAxis[slot * 3 + 1] = axis[1];
          this.fingerAxis[slot * 3 + 2] = axis[2];
        }
      });
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
    this.registerHits();
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
    this.yaw = yaw;
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

  /** Show a clip at a time: a pure scrub. Loops wrap, the others hold their first and last pose. */
  clip(name: ClipName, time: number): void {
    this.player.scrub(name, time);
  }

  /** Show two clips at once, `b` blended over `a` by `w` (0 to 1): a cross fade a section drives. */
  blend(a: ClipName, ta: number, b: ClipName, tb: number, w: number): void {
    this.player.scrub(a, ta, b, tb, w);
  }

  /**
   * Let her play on her own clock: loops loop (the seams are exact), a one shot holds its last
   * pose, `then` chains. Asking again for what already plays does nothing, so a section may call it
   * every frame. `fade` seconds cross fade from what was showing.
   */
  play(name: ClipName, options?: PlayOptions): void {
    this.player.play(name, options);
  }

  /** The way out of the hands at the mouth: wait for the loop, release, then idle. */
  playRelease(): void {
    this.player.play(CLIP.release, {
      when: "loopEnd",
      fade: FADE.intoRelease,
      then: [{ clip: CLIP.idle, fade: FADE.intoIdle }],
    });
  }

  /** What the player shows now: the clip, its time, and whether it plays by itself. */
  clipState(): { clip: ClipName; time: number; playing: boolean; ended: boolean } {
    return {
      clip: this.player.current(),
      time: this.player.time(),
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

  /** Whether the hit targets answer (a section turns them off while she is only to be watched). */
  interactive(on: boolean): void {
    this.interactiveOn = on;
  }

  /** A point of her body, in her own space (an Object3D that follows the animated bone). */
  socket(name: SocketName): Object3D {
    return this.sockets[name];
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
      curl: Array.from({ length: 10 }, (_, i) => this.fingers.value(i < 5 ? 0 : 1, i % 5)),
      fist: [...this.fist],
      scale: this.scale,
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

    this.writePose(dt);
    this.updateClip();
    this.updateOutline();
    this.ctx.stage.renderer.localClippingEnabled = true;
    // The baked camera, if a section asked for it, is drawn this frame: the pointer is not on her.
    this.filmWas = this.filmDrawn;
    this.filmDrawn = false;

    const ms = performance.now() - t0;
    this.updateMs = ms;
    this.updateAvg += (ms - this.updateAvg) * 0.05;
    this.shiftX = 0;
    this.shiftY = 0;
    this.shiftZ = 0;
  }

  dispose(): void {
    for (const remove of this.removeHits) remove();
    this.removeHits.length = 0;
    this.object.removeFromParent();
    for (const ink of this.inks) ink.mesh.removeFromParent();
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
    for (const t of this.textures) t.dispose();
    this.shared.gradient.dispose();
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
    this.addTurns(dt, pp.a === CLIP.fall || pp.b === CLIP.fall);
    work.compose(this.hier, pose);

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
    this.writeSockets(pp);
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
  private writeSockets(pp: PlayerPose): void {
    const { ix, sockets } = this;
    this.putSocket(sockets.rightHand, ix.handR, 0.045);
    this.putSocket(sockets.leftHand, ix.handL, 0.045);
    this.putSocket(sockets.head, ix.head, 0.2);
    this.putSocket(sockets.mouth, ix.mouth, 0.02);
    // The doll's hover point in the film: the hand plus the notes' offset (model space, y up).
    let time = 0;
    if (pp.a === CLIP.fall) time = pp.ta;
    else if (pp.b === CLIP.fall && pp.w > 0.5) time = pp.tb;
    const offs = this.hoverScratch;
    dollOffset(time, DOLL_ANCHOR, offs);
    this.putSocket(sockets.rightHover, ix.handR, 0, offs[0], offs[1], offs[2], false);
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

  // ------------------------------------------------------------------ turns on top of the clip

  private addTurns(dt: number, inFall: boolean): void {
    const { work, ix } = this;

    // --- the pointer and the gaze
    const ps = this.ctx.pointer.state;
    const W = this.ctx.stage.width;
    const H = this.ctx.stage.height;
    const live = ps.type === "touch" ? ps.down : ps.inside;
    let tx = 0;
    let ty = 0;
    let mode: "point" | "viewer" | "idle" = "idle";
    if (this.lookTarget === "pointer") {
      if (live) {
        mode = "point";
        tx = ps.x - W / 2;
        ty = H / 2 - ps.y;
      }
    } else if (this.lookTarget === "viewer") {
      mode = "viewer";
    } else if (this.lookTarget !== "idle") {
      mode = "point";
      tx = this.lookTarget.x;
      ty = this.lookTarget.y;
    }
    let yawWish = 0;
    let pitchWish = 0;
    const eyes = POINT.eyes * 3;
    if (mode === "point") {
      const dx = tx - this.scr[eyes]!;
      const dy = ty - this.scr[eyes + 1]!;
      const depth = Math.max(260, H * 0.7);
      const c = Math.cos(this.yaw);
      const sn = Math.sin(this.yaw);
      const a = gazeAngles(dx * c - depth * sn, dy, dx * sn + depth * c, this.angleScratch);
      yawWish = a.yaw;
      pitchWish = a.pitch;
    } else if (mode === "viewer") {
      yawWish = -this.yaw;
    } else {
      const c = this.clock;
      yawWish = 0.16 * Math.sin(c * 0.37) + 0.08 * Math.sin(c * 0.93 + 1);
      pitchWish = 0.05 * Math.sin(c * 0.53 + 2);
    }
    // The fall clip has its own head: she looks where the film looks.
    if (inFall) {
      yawWish = 0;
      pitchWish = 0;
    }
    const split = splitGaze(yawWish, pitchWish, this.gaze);
    const gs = this.gazeSprings;
    const v = this.wish;
    v[0] = split.neckYaw;
    v[1] = split.neckPitch;
    v[2] = split.headYaw;
    v[3] = split.headPitch;
    v[4] = split.eyeYaw;
    v[5] = split.eyePitch;
    for (let i = 0; i < 6; i += 1) gs[i]!.step(v[i]!, dt);
    this.bodyYaw.step(clamp(gs[2]!.x * 0.5 + gs[0]!.x * 0.5, -0.4, 0.4) * 0.4, dt);
    this.bodyLean.step(clamp(gs[3]!.x + gs[1]!.x, -0.4, 0.4) * 0.25, dt);

    // --- the touches
    const patV = this.pat.step(dt);
    const tiltV = this.tilt.step(dt);
    const hipV = this.hip.step(dt);
    const c = this.clock;
    const { neck, head, spine1, spine2, pelvis } = ix;

    if (neck >= 0) {
      work.turnModel(neck, 0, 1, 0, gs[0]!.x);
      work.turnModel(neck, 1, 0, 0, -(gs[1]!.x - patV * 0.07));
    }
    if (head >= 0) {
      work.turnModel(head, 0, 1, 0, gs[2]!.x);
      work.turnModel(head, 1, 0, 0, -(gs[3]!.x - patV * 0.2));
      work.turnModel(head, 0, 0, 1, Math.sin(c * 11) * patV * 0.04);
    }
    if (ix.eyeL >= 0) {
      work.turnModel(ix.eyeL, 0, 1, 0, gs[4]!.x);
      work.turnModel(ix.eyeL, 1, 0, 0, -gs[5]!.x);
    }
    if (ix.eyeR >= 0) {
      work.turnModel(ix.eyeR, 0, 1, 0, gs[4]!.x);
      work.turnModel(ix.eyeR, 1, 0, 0, -gs[5]!.x);
    }
    if (spine1 >= 0) {
      work.turnModel(spine1, 0, 1, 0, this.bodyYaw.x);
      work.turnModel(spine1, 1, 0, 0, -this.bodyLean.x);
      work.turnModel(spine1, 0, 0, 1, this.tiltSign * tiltV * 0.1);
    }
    if (spine2 >= 0) work.turnModel(spine2, 0, 0, 1, this.tiltSign * tiltV * 0.06);
    if (pelvis >= 0) work.turnModel(pelvis, 0, 0, 1, hipV * 0.06 * Math.sin(c * 13));

    // --- the claws spin when poked
    const spinL = this.clawSpin[0]!;
    const spinR = this.clawSpin[1]!;
    spinL.step(this.clawTurns[0]! * 2 * Math.PI, dt);
    spinR.step(this.clawTurns[1]! * 2 * Math.PI, dt);
    if (ix.propL >= 0) work.turnModel(ix.propL, 0, 1, 0, spinL.x);
    if (ix.propR >= 0) work.turnModel(ix.propR, 0, 1, 0, spinR.x);

    // --- the fingers
    this.addFingers(dt);
  }

  private addFingers(dt: number): void {
    const { work } = this;
    const ps = this.ctx.pointer.state;
    const input = this.handIn;
    input.px = ps.x - this.ctx.stage.width / 2;
    input.py = this.ctx.stage.height / 2 - ps.y;
    input.live = (ps.type === "touch" ? ps.down : ps.inside) && this.interactiveOn;
    const curl = this.curlScratch;
    const tips = this.tipScratch;
    for (let h = 0; h < 2; h += 1) {
      const hand = h === 0 ? 0 : 1;
      const side = hand === 0 ? "L" : "R";
      const tipBase = hand === 0 ? POINT.tipsL : POINT.tipsR;
      const palm = (hand === 0 ? POINT.handL : POINT.handR) * 3;
      for (let f = 0; f < 5; f += 1) {
        tips[f * 2] = this.scr[(tipBase + f) * 3]!;
        tips[f * 2 + 1] = this.scr[(tipBase + f) * 3 + 1]!;
      }
      const middle = (tipBase + 2) * 3;
      input.palmX = this.scr[palm]!;
      input.palmY = this.scr[palm + 1]!;
      input.radius =
        Math.hypot(input.palmX - this.scr[middle]!, input.palmY - this.scr[middle + 1]!) * 1.1;
      pointerCurl(input, curl, 0);
      const wave = this.wiggle[hand]!.step(dt);
      for (let f = 0; f < 5; f += 1) {
        const wanted = (this.fist[hand] ? FIST : 0) + curl[f]! + waveCurl(f, this.clock, wave);
        const value = this.fingers.step(hand, f, wanted, dt);
        const finger = FINGERS[f]!;
        for (let j = 0; j < 3; j += 1) {
          const slot = (hand * 5 + f) * 3 + j;
          const node = this.fingerNode[slot]!;
          if (node < 0) continue;
          const angle = jointAngle(finger, j as 0 | 1 | 2, value) + breath(side, f, j, this.clock);
          work.turnLocal(
            node,
            this.fingerAxis[slot * 3]!,
            this.fingerAxis[slot * 3 + 1]!,
            this.fingerAxis[slot * 3 + 2]!,
            angle,
          );
        }
      }
    }
  }

  /** Start the springs and the fingers over (a jump, or a frame after she was hidden). */
  private snap(): void {
    this.springs.snap();
    this.fingers.snap();
    for (const s of this.gazeSprings) s.snap(0);
    this.pat.reset();
    this.tilt.reset();
    this.hip.reset();
    for (const w of this.wiggle) w.reset();
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

  /** Keep the ink line about a pixel and a half wide whatever her size on the screen. */
  private updateOutline(): void {
    const pxPerMetre = (this.height / REF_HEIGHT) * (D / Math.max(1, D - this.pz));
    const width = outlineUnits(
      LOOK_RECIPE.outlinePx,
      pxPerMetre,
      1,
      LOOK_RECIPE.outlineMin,
      LOOK_RECIPE.outlineMax,
    );
    for (const ink of this.inks) ink.width.value = width;
  }

  // ------------------------------------------------------------------ build

  /** Put the toon look, the ink and the draw order on every mesh. */
  private dress(rig: Rig): void {
    const { head, eye, hair01, hair02, body } = rig.meshes;
    for (const mesh of rig.meshes.all) {
      mesh.frustumCulled = false;
      const source = standardOf(mesh);
      if (source.map) this.textures.add(source.map);
      this.geometries.add(mesh.geometry);
    }
    const toon = (mesh: SkinnedMesh, alpha: boolean): void => {
      const made = makeToon(standardOf(mesh), this.shared, { alpha }, 1);
      made.clippingPlanes = this.planes;
      this.toons.push(made);
      this.materials.push(made);
      mesh.material = made;
    };
    const ink = (mesh: SkinnedMesh): void => {
      const made = makeInk(mesh, mesh.geometry);
      const material = made.mesh.material as Material;
      material.clippingPlanes = this.planes;
      this.materials.push(material);
      mesh.parent?.add(made.mesh);
      this.inks.push(made);
    };
    for (const mesh of [head, hair02, ...body]) {
      toon(mesh, false);
      ink(mesh);
    }
    toon(hair01, true);
    hair01.renderOrder = 1;
    // The eyes are painted bright: they take no light.
    const eyeSource = standardOf(eye);
    const basic = new MeshBasicMaterial({
      map: eyeSource.map,
      color: eyeSource.color,
      side: DoubleSide,
      clippingPlanes: this.planes,
    });
    this.materials.push(basic);
    eye.material = basic;
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

  // ------------------------------------------------------------------ hit targets

  /** The distance from the camera of a point whose metre is `k` pixels: nearer parts win a tie. */
  private depthOf(k: number): number {
    return D / Math.max(0.05, k / this.scale);
  }

  private registerHits(): void {
    const scr = this.scr;
    const W = (): number => this.ctx.stage.width;
    const H = (): number => this.ctx.stage.height;
    const live = (x: number, y: number): boolean =>
      this.visible &&
      this.interactiveOn &&
      !this.filmWas &&
      (this.clipRect === null || inside(this.clipRect, x, y));
    const to = (x: number, y: number): [number, number] => [x - W() / 2, H() / 2 - y];

    const disc =
      (index: number, metres: number, bias: number) =>
      (x: number, y: number): number | null => {
        if (!live(x, y)) return null;
        const [sx, sy] = to(x, y);
        const ax = scr[index * 3]!;
        const ay = scr[index * 3 + 1]!;
        const k = scr[index * 3 + 2]!;
        return capsuleHit(sx, sy, ax, ay, ax, ay, metres * k, this.depthOf(k), bias);
      };
    const capsule =
      (a: number, b: number, metres: number, bias: number) =>
      (x: number, y: number): number | null => {
        if (!live(x, y)) return null;
        const [sx, sy] = to(x, y);
        const k = scr[a * 3 + 2]!;
        return capsuleHit(
          sx,
          sy,
          scr[a * 3]!,
          scr[a * 3 + 1]!,
          scr[b * 3]!,
          scr[b * 3 + 1]!,
          metres * k,
          this.depthOf(k),
          bias,
        );
      };
    const first =
      (...tests: Array<(x: number, y: number) => number | null>) =>
      (x: number, y: number): number | null => {
        for (const test of tests) {
          const hit = test(x, y);
          if (hit !== null) return hit;
        }
        return null;
      };
    const add = (target: HitTarget): void => {
      this.removeHits.push(this.ctx.pointer.add(target));
    };

    const headTest = disc(POINT.head, 0.13, 0);
    add({
      id: "selena:head",
      cursor: "PAT",
      test: headTest,
      enter: () => {
        this.face.react("happy", 0.9);
      },
      press: () => {
        this.pat.start(1.3, 0.14, 0.7);
        this.face.react("content", 1.4);
        this.springs.kick("hair", 0, -0.9, 0);
        this.springs.kick("ponytail", 0, -0.6, 0.2);
      },
    });

    const strands = first(
      ...[POINT.ponyL, POINT.ponyR].flatMap((base) =>
        [0, 1, 2, 3].map((i) => capsule(base + i, base + i + 1, 0.06, 30)),
      ),
      disc(POINT.frontHair, 0.08, 45),
    );
    // The face wins where hair lies over it: the hair is what is left around the head.
    const hairTest = (x: number, y: number): number | null =>
      headTest(x, y) === null ? strands(x, y) : null;
    add({
      id: "selena:hair",
      cursor: "SWISH",
      test: hairTest,
      enter: () => {
        this.hairHas = false;
      },
      move: (x, y) => {
        // Brush the hair along the pointer: the move since the last frame is the push.
        const had = this.hairHas;
        const dx = x - this.hairLastX;
        const dy = this.hairLastY - y;
        this.hairLastX = x;
        this.hairLastY = y;
        this.hairHas = true;
        if (!had) return;
        const k = 0.03 / Math.max(1, this.scale);
        this.springs.kick(
          "ponytail",
          clamp(dx * k, -1.6, 1.6),
          clamp(dy * k * 0.4, -0.8, 0.8),
          0.05,
        );
        this.springs.kick(
          "hair",
          clamp(dx * k * 0.6, -1.2, 1.2),
          clamp(dy * k * 0.3, -0.6, 0.6),
          0,
        );
      },
      leave: () => {
        this.hairHas = false;
      },
      press: () => {
        this.springs.kick("ponytail", 2.2, 0.8, 0.5);
        this.springs.kick("hair", 1.4, 0.5, 0.3);
        this.face.react("surprised", 0.7);
      },
    });

    for (const hand of [0, 1] as const) {
      add({
        id: hand === 0 ? "selena:hand-l" : "selena:hand-r",
        cursor: "WIGGLE",
        // The hand and its fingers, from the wrist along the hand's own axis (the curl of the
        // fingers does not move this, so a fist does not let go of itself).
        test: capsule(
          hand === 0 ? POINT.handL : POINT.handR,
          hand === 0 ? POINT.handEndL : POINT.handEndR,
          0.07,
          0,
        ),
        enter: () => {
          this.wiggle[hand]!.start(1.6, 0.1, 0.8);
          if (hand === 1) this.face.react("wink", 1.1);
        },
        press: () => {
          this.fist[hand] = true;
        },
        release: () => {
          this.fist[hand] = false;
        },
        leave: () => {
          // A fist is held while the pointer is down, even if it slides off the hand.
          if (!this.ctx.pointer.state.down) this.fist[hand] = false;
        },
      });
    }

    for (const k of [0, 1] as const) {
      add({
        id: k === 0 ? "selena:claw-l" : "selena:claw-r",
        cursor: "SPIN",
        test: disc(k === 0 ? POINT.propL : POINT.propR, 0.2, 6),
        enter: () => {
          this.clawTurns[k] = this.clawTurns[k]! + 1;
        },
        press: () => {
          this.clawTurns[k] = this.clawTurns[k]! + 2;
          this.face.react("surprised", 0.9);
        },
      });
    }

    add({
      id: "selena:body",
      cursor: "POKE",
      test: capsule(POINT.neck, POINT.pelvis, 0.17, 60),
      press: (x) => {
        const [sx] = to(x, 0);
        this.tiltSign = sx > scr[POINT.pelvis * 3]! ? -1 : 1;
        this.tilt.start(1.1, 0.12, 0.7);
        this.face.react("laugh", 1.2);
        this.springs.kick("skirt", this.tiltSign * -0.9, 0.3, 0);
        this.springs.kick("ponytail", this.tiltSign * -0.6, 0.2, 0);
      },
    });

    add({
      id: "selena:legs",
      cursor: "TAP",
      test: first(
        capsule(POINT.thighL, POINT.footL, 0.085, 70),
        capsule(POINT.thighR, POINT.footR, 0.085, 70),
      ),
      press: () => {
        this.hip.start(1.2, 0.1, 0.6);
        this.face.react("wink", 0.9);
        this.springs.kick("skirt", 0, 0.8, 0.5);
      },
    });
  }
}
