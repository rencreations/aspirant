/**
 * Selena's left hand, the black clawed glove with the gold and violet bracer, seen from the visitor's
 * own elbow with the palm turned up toward the camera. A plain class: it owns its model, its look,
 * its fingers and its hit target, and a section drives it by setting a state every frame it shows
 * it (`place`, `rise`, `sink`, `setBurden`, `curlTowards`). See `docs/design/home/actor-hand.md`.
 *
 * The hierarchy: `root` (the wrist: position, the view rotation and the scale that `place` fixes)
 * holds the glTF scene, whose bones hang on its root with no armature. Two baked clips write the
 * pose: the reach (scrubbed by the rise) and the breath (a loop that takes over once the hand is
 * up). The fingers are turned on top of the clip after the mixer, so the idle keeps running under
 * the pointer's reach. Everything the actor moves in a frame is allocated once.
 */
import {
  AnimationClip,
  AnimationMixer,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
  type AnimationAction,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type SkinnedMesh,
  type WebGLRenderer,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Cast } from "../shared/cast";
import { forgetGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";
import type { Actor, FrameInfo } from "../../kernel/types";

import {
  BONE,
  BREATH_SECONDS,
  CLIP,
  FINGER_HIT_RADIUS,
  HAND_MODEL,
  LOOK,
  PALM,
  REACH_SECONDS,
} from "./constants";
import {
  FINGERS,
  FINGER_COUNT,
  FIST,
  FingerBank,
  fingerBones,
  flexAxis,
  idleAngle,
  jointAngle,
  REACH_GAIN,
  makeReach,
  reachFor,
  rippleEnvelope,
  spreadAxis,
  waveCurl,
  type FingerName,
} from "./fingers";
import { handHit, makeShape } from "./hit";
import {
  makeGlove,
  makeInk,
  makeUniforms,
  type Glove,
  type Ink,
  type LookUniforms,
} from "./material";
import { Spring, approach, clamp, smoothstep } from "./motion";
import {
  depthScale,
  fitScale,
  hiddenY,
  lift,
  projectToStage,
  reachProgress,
  viewRotation,
} from "./place";

/** Where a section puts the hand. The hand's root is the wrist; x, y, z are stage pixels. */
export interface HandPlacement {
  x: number;
  y: number;
  /** Pixels toward the camera at the wrist (default 0). */
  z?: number;
  /** The on-screen height in CSS pixels from the wrist to the highest claw, at rest. Kept from the last call when omitted. */
  height?: number;
  /** A further multiplier on the size (default 1). */
  scale?: number;
  /** Turns the hand about the screen's own axis, radians (positive is counter clockwise). */
  roll?: number;
  /** Small taste turns of the view, radians. */
  yaw?: number;
  pitch?: number;
}

export type HandSocketName = "palm" | "stand" | FingerName;

/** The doll lands, the hand gives. `impact` takes this much of a pixel per unit. */
const IMPACT_PX = 26;
/** The press: how long a grip lasts at most, and how long the ripple of a touch runs. */
const GRIP_MAX = 1.2;
const RIPPLE_SECONDS = 1.1;
/** A frame this long after the last one means the actor was hidden: its springs start from rest. */
const GAP_FRAMES = 6;
/** The ink's width in pixels is turned into mesh units by the world scale. */
const INK_MIN = 0.0002;

/** The flat rest of a spread, positive toward the thumb: `SPREAD_SIGN` turns the maths into the model's axis. */
const SPREAD_SIGN = 1;

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _qb = new Quaternion();
const _m = new Matrix4();
const _m2 = new Matrix4();
const _s = { x: 0, y: 0, s: 1 };
const _view = new Quaternion();

export interface HandStats {
  /** The last update, milliseconds, and its running average. */
  updateMs: number;
  updateAvg: number;
}

interface FingerRig {
  name: FingerName;
  bones: [Bone, Bone, Bone];
  flex: Vector3;
  spread: Vector3;
}

export class HandActor implements Actor {
  readonly name = "hand";
  visible = false;
  readonly object: Group;
  readonly stats: HandStats = { updateMs: 0, updateAvg: 0 };

  private readonly model: Object3D;
  private readonly mesh: SkinnedMesh;
  private readonly ink: Ink;
  private readonly glove: Glove;
  private readonly uniforms: LookUniforms;
  private readonly mixer: AnimationMixer;
  private readonly reachAction: AnimationAction;
  private readonly breathAction: AnimationAction;
  private readonly handBone: Bone;
  private readonly fingers: FingerRig[] = [];
  /**
   * The bones the actor turns on top of the clip, and the pose the clip gave them. The mixer writes a
   * bone only when its own result changed, so a turn added after it would pile up from frame to
   * frame: the clip's pose is put back before every update.
   */
  private readonly driven: Bone[] = [];
  private readonly drivenBase: Quaternion[] = [];
  private haveBase = false;
  private readonly sockets = new Map<HandSocketName, Object3D>();
  private readonly palmSocket: Object3D;
  private readonly standSocket: Object3D;
  /** The claw tips in the hand's own space at the end of the reach (three numbers a finger). */
  private readonly restTips = new Float32Array(FINGER_COUNT * 3);
  /** The wrist's roll axis (along the hand) and its nod axis (across it), in the hand bone's frame. */
  private readonly rollAxis = new Vector3();
  private readonly nodAxis = new Vector3();
  private rollSign = 1;

  // What a section sets.
  private px = 0;
  private py = 0;
  private pz = 0;
  private pheight = 0;
  private pscale = 1;
  private proll = 0;
  private pyaw = 0;
  private ppitch = 0;
  private riseT = 0;
  private sinkT = 0;
  private reactivity = 1;
  private burden = 0;
  private gripSet = 0;
  private interactive = true;
  private explicit: { x: number; y: number } | null = null;

  // The hand's own motion.
  private clock = 0;
  private readonly bank = new FingerBank();
  private readonly reach = makeReach();
  private readonly wantCurl = new Float32Array(FINGER_COUNT);
  private readonly tips = new Float32Array(FINGER_COUNT * 2);
  private readonly knuckles = new Float32Array(FINGER_COUNT * 2);
  private readonly dip = new Spring(2 * Math.PI * 2.4, 0.32, 0);
  private readonly leanRoll = new Spring(2 * Math.PI * 2, 0.8, 0);
  private readonly leanNod = new Spring(2 * Math.PI * 2, 0.8, 0);
  private hovered = false;
  private pressed = false;
  private pressAge = 0;
  private grip = 0;
  private rippleAge = RIPPLE_SECONDS;
  private rippleFrom = 2;
  private lastFrame = -1;
  private k = 1;
  private wristY = 0;
  private lifted = 0;
  private disposed = false;
  private readonly shape = makeShape();
  private readonly removeHit: () => void;
  private readonly palmScreen = { x: 0, y: 0, s: 1 };

  constructor(
    private readonly ctx: ActorCtx,
    gltf: GLTF,
    private readonly cast: Cast,
  ) {
    this.model = gltf.scene;
    this.object = new Group();
    this.object.name = "hand";
    this.object.visible = false;
    this.object.add(this.model);

    const skinned: SkinnedMesh[] = [];
    this.model.traverse((node) => {
      if ((node as SkinnedMesh).isSkinnedMesh) skinned.push(node as SkinnedMesh);
    });
    const mesh = skinned[0];
    if (!mesh) throw new Error("hand: the model has no skinned mesh");
    this.mesh = mesh;
    mesh.frustumCulled = false;

    this.uniforms = makeUniforms();
    const anisotropy = Math.min(8, ctx.stage.renderer.capabilities.getMaxAnisotropy());
    this.glove = makeGlove(mesh.material as MeshStandardMaterial, this.uniforms, anisotropy);
    mesh.material = this.glove.material;
    mesh.renderOrder = 1;
    this.ink = makeInk(mesh, mesh.geometry, this.uniforms);
    this.ink.mesh.renderOrder = 0;
    (mesh.parent ?? this.model).add(this.ink.mesh);

    // The bones.
    const bone = (name: string): Bone => {
      const found = this.model.getObjectByName(name);
      if (!found) throw new Error(`hand: no bone ${name}`);
      return found as Bone;
    };
    this.handBone = bone(BONE.hand);
    for (const name of FINGERS) {
      const [a, b, c] = fingerBones(name);
      this.fingers.push({
        name,
        bones: [bone(a), bone(b), bone(c)],
        flex: new Vector3(...flexAxis(name)),
        spread: new Vector3(...spreadAxis(name)),
      });
    }

    // The clips.
    this.mixer = new AnimationMixer(this.model);
    const reach = AnimationClip.findByName(gltf.animations, CLIP.reach);
    const breath = AnimationClip.findByName(gltf.animations, CLIP.breath);
    if (!reach || !breath) throw new Error("hand: the model lacks its clips");
    this.reachAction = this.mixer.clipAction(reach);
    this.breathAction = this.mixer.clipAction(breath);
    this.reachAction.play();
    this.breathAction.play();
    this.reachAction.setEffectiveWeight(1);
    this.breathAction.setEffectiveWeight(0);

    // Sockets: a node that moves with the animated bone. Their scale takes the root's out, so a
    // child of a socket works in stage pixels.
    this.palmSocket = new Object3D();
    this.palmSocket.name = "socket_palm";
    this.handBone.add(this.palmSocket);
    this.standSocket = new Object3D();
    this.standSocket.name = "socket_stand";
    this.standSocket.matrixAutoUpdate = false;
    this.object.add(this.standSocket);
    this.sockets.set("palm", this.palmSocket);
    this.sockets.set("stand", this.standSocket);

    for (const rig of this.fingers) this.driven.push(...rig.bones);
    this.driven.push(this.handBone);
    for (const _bone of this.driven) this.drivenBase.push(new Quaternion());
    this.measure();
    cast.add(this.object);
    this.removeHit = this.addHit();
  }

  // ------------------------------------------------------------------ what a section sets

  /** Where the hand rests (the wrist, in stage pixels) and how big. Call it every frame the hand is shown. */
  place(p: HandPlacement): void {
    this.px = p.x;
    this.py = p.y;
    this.pz = p.z ?? 0;
    if (p.height !== undefined) this.pheight = p.height;
    this.pscale = p.scale ?? 1;
    this.proll = p.roll ?? 0;
    this.pyaw = p.yaw ?? 0;
    this.ppitch = p.pitch ?? 0;
  }

  /** 0: below the bottom edge with a flat hand. 1: arrived, the palm open. Scrub it with the scroll. */
  rise(t: number): void {
    this.riseT = clamp(t, 0, 1);
  }

  /** 0: at rest. 1: gone below the bottom edge. The same way down as the rise is up. */
  sink(t: number): void {
    this.sinkT = clamp(t, 0, 1);
  }

  /**
   * How much the pointer moves the fingers, 0 to 1 (oryzo's `fingersActive`: a section ramps it up
   * once the doll has settled). The hover ripple and the press are not scaled by it.
   */
  setReactivity(v: number): void {
    this.reactivity = clamp(v, 0, 1);
  }

  /** A thing sits in the palm, 0 to 1: the fingers react a little less and never close past a cup. */
  setBurden(v: number): void {
    this.burden = clamp(v, 0, 1);
  }

  /** Close the hand by hand, 0 (open) to 1 (the grip). A section may use it for a scripted beat. */
  setGrip(v: number): void {
    this.gripSet = clamp(v, 0, 1);
  }

  /** The hover, the press and the pointer's reach answer only while this is on. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) {
      this.hovered = false;
      this.pressed = false;
    }
  }

  /**
   * Make the fingers reach toward a point (stage pixels, origin at the middle, y up) instead of the
   * pointer, or back to the pointer with null. The point holds until it is changed.
   */
  curlTowards(x: number | null, y = 0): void {
    this.explicit = x === null ? null : { x, y };
  }

  /** A ripple runs along the fingers, as if she were touched (the doll landing, a section's cue). */
  wiggle(from: FingerName | number = "middle"): void {
    this.rippleAge = 0;
    this.rippleFrom = typeof from === "number" ? from : FINGERS.indexOf(from);
  }

  /** The hand gives under a weight that lands in it: it dips and comes back, and the fingers ripple. `strength` is about 0 to 1. */
  impact(strength: number): void {
    this.dip.kick(-IMPACT_PX * Math.max(0, strength) * 14);
    this.wiggle("middle");
  }

  // ------------------------------------------------------------------ what a section reads

  /** A node that moves with the hand. `palm`: on the palm, +Y along its normal, in stage pixels. `stand`: at the palm, upright on the screen. A finger name: at the claw tip. */
  socket(name: HandSocketName): Object3D {
    const found = this.sockets.get(name);
    if (!found) throw new Error(`hand: no socket ${name}`);
    return found;
  }

  /** The palm socket: where the doll stands and sits (+Y is the palm's normal, +Z points to the wrist). */
  palm(): Object3D {
    return this.palmSocket;
  }

  /** The palm's centre on the screen (stage pixels, and the depth magnification there). Valid after the frame's update. */
  palmCentre(out: { x: number; y: number; s: number }): { x: number; y: number; s: number } {
    out.x = this.palmScreen.x;
    out.y = this.palmScreen.y;
    out.s = this.palmScreen.s;
    return out;
  }

  /** The palm's radius on the screen, in pixels. */
  palmRadius(): number {
    return this.shape.palmR;
  }

  /** A claw tip on the screen (stage pixels). */
  tipPoint(finger: FingerName, out: { x: number; y: number }): { x: number; y: number } {
    const i = FINGERS.indexOf(finger);
    out.x = this.tips[i * 2]!;
    out.y = this.tips[i * 2 + 1]!;
    return out;
  }

  /** How far from hidden the hand is, 0 to 1 (0 means nothing of it is on the screen). */
  get shown(): number {
    return this.lifted;
  }

  /** The scale now, in stage pixels to a metre of the model, at the wrist's depth. */
  get pixelsPerMetre(): number {
    return this.k;
  }

  // ------------------------------------------------------------------ build

  /** Compile the programs and upload the pictures now, so the first frame the hand shows does not hitch. */
  async warm(renderer: WebGLRenderer, camera: PerspectiveCamera): Promise<void> {
    const was = this.object.visible;
    this.object.visible = true;
    try {
      const map = this.glove.material.map;
      if (map) renderer.initTexture(map);
      await renderer.compileAsync(this.object, camera);
    } catch {
      // A failed warm only means the first frame compiles them.
    }
    this.object.visible = was;
  }

  /**
   * Read the end of the reach once: where the claws end (the farthest skinned vertex of each
   * finger), the palm's frame (a quaternion in the hand bone) and the wrist's roll and nod axes.
   * All of it is in the hand's own space, with the root at the origin.
   */
  private measure(): void {
    this.reachAction.time = REACH_SECONDS;
    this.breathAction.time = 0;
    this.mixer.update(0);
    this.object.updateMatrixWorld(true);
    this.mesh.skeleton.update();

    const skeleton = this.mesh.skeleton;
    const index = new Map<Bone, number>();
    skeleton.bones.forEach((b, i) => index.set(b, i));
    const skinIndex = this.mesh.geometry.getAttribute("skinIndex");
    const skinWeight = this.mesh.geometry.getAttribute("skinWeight");
    const count = this.mesh.geometry.getAttribute("position").count;

    // The farthest skinned vertex along each finger, taken by the bone that owns most of it.
    const owner = new Int32Array(count).fill(-1);
    for (let v = 0; v < count; v += 1) {
      let weight = 0;
      for (let c = 0; c < 4; c += 1) {
        const w = skinWeight.getComponent(v, c);
        if (w > weight) {
          weight = w;
          owner[v] = skinIndex.getComponent(v, c);
        }
      }
    }
    const world = new Vector3();
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      const rig = this.fingers[f]!;
      const set = new Set(rig.bones.map((b) => index.get(b)!));
      const head1 = rig.bones[1].getWorldPosition(new Vector3());
      const head2 = rig.bones[2].getWorldPosition(new Vector3());
      const dir = head2.clone().sub(head1).normalize();
      let farthest = -Infinity;
      const tip = head2.clone();
      for (let v = 0; v < count; v += 1) {
        if (!set.has(owner[v]!)) continue;
        this.mesh.getVertexPosition(v, world).applyMatrix4(this.mesh.matrixWorld);
        const along = world.clone().sub(head2).dot(dir);
        if (along > farthest) {
          farthest = along;
          tip.copy(world);
        }
      }
      this.restTips[f * 3] = tip.x;
      this.restTips[f * 3 + 1] = tip.y;
      this.restTips[f * 3 + 2] = tip.z;
      // The socket sits at the claw tip, in the frame of the last bone.
      const socket = new Object3D();
      socket.name = `socket_tip_${rig.name}`;
      socket.position.copy(rig.bones[2].worldToLocal(tip.clone()));
      rig.bones[2].add(socket);
      this.sockets.set(rig.name, socket);
    }

    // The palm: its frame in the hand bone, from the surface offset and the normal of the notes.
    this.handBone.updateWorldMatrix(true, false);
    const boneQuat = this.handBone.getWorldQuaternion(new Quaternion());
    const normal = new Vector3(...PALM.normal).normalize();
    const knuckle = this.fingers[2]!.bones[0].getWorldPosition(new Vector3());
    const wrist = this.handBone.getWorldPosition(new Vector3());
    const along = knuckle.sub(wrist);
    along.addScaledVector(normal, -along.dot(normal)).normalize();
    const back = along.clone().negate();
    const across = new Vector3().crossVectors(normal, back).normalize();
    _m.makeBasis(across, normal, back);
    const palmWorld = new Quaternion().setFromRotationMatrix(_m);
    this.palmSocket.position.set(...PALM.offset);
    this.palmSocket.quaternion.copy(boneQuat.clone().invert().multiply(palmWorld));

    // The wrist's roll is about the line along the hand; its nod is about the line across it.
    const toLocal = boneQuat.clone().invert();
    this.rollAxis.copy(along).applyQuaternion(toLocal).normalize();
    this.nodAxis.copy(across).applyQuaternion(toLocal).normalize();
    // A positive roll should turn the palm toward the screen's right: the palm's normal moves by
    // axis x normal, and screen right is +X in the hand's own space.
    this.rollSign = new Vector3().crossVectors(along, normal).x >= 0 ? 1 : -1;
  }

  // ------------------------------------------------------------------ the frame

  update(frame: FrameInfo): void {
    const t0 = performance.now();
    const dt = frame.dt;
    if (frame.frame - this.lastFrame > GAP_FRAMES) this.snap();
    this.lastFrame = frame.frame;
    if (dt > 0) this.clock += dt;

    const W = this.ctx.stage.width;
    const H = this.ctx.stage.height;
    const height = this.pheight > 0 ? this.pheight : H * 0.7;

    // --- where the hand is: the rest, and how far up from hidden it has come
    const lf = lift(this.riseT, this.sinkT);
    this.lifted = lf;
    this.dip.step(0, dt);
    const hidden = hiddenY(H, height);
    this.wristY =
      hidden +
      (this.py - hidden) * lf +
      this.dip.x +
      Math.sin(this.clock * 2 * Math.PI * 0.21) * 2.2 * lf;
    viewRotation(_view, this.px, this.py, this.proll, this.pyaw, this.ppitch);
    this.k = fitScale(height, this.restTips, _view, this.py, this.pz) * this.pscale;

    // The wrist is seen at (px, wristY): in the world it is that over the depth magnification.
    const mag = depthScale(this.pz);
    this.object.position.set(this.px / mag, this.wristY / mag, this.pz);
    this.object.quaternion.copy(_view);
    this.object.scale.setScalar(this.k);
    // Nothing of the hand is on the screen: the pass need not draw it.
    this.object.visible = lf > 0.0001;
    if (!this.object.visible) {
      this.stats.updateMs = performance.now() - t0;
      return;
    }

    // --- the pose: the reach scrubbed by the rise, the breath once the hand is up
    const progress = reachProgress(this.riseT, this.sinkT);
    const breathW = smoothstep(0.8, 1, this.riseT) * (1 - smoothstep(0, 0.6, this.sinkT));
    this.reachAction.time = progress * REACH_SECONDS;
    this.breathAction.time = this.clock % BREATH_SECONDS;
    this.reachAction.setEffectiveWeight(1 - breathW);
    this.breathAction.setEffectiveWeight(breathW);
    if (this.haveBase) {
      for (let i = 0; i < this.driven.length; i += 1)
        this.driven[i]!.quaternion.copy(this.drivenBase[i]!);
    }
    this.mixer.update(0);
    for (let i = 0; i < this.driven.length; i += 1)
      this.drivenBase[i]!.copy(this.driven[i]!.quaternion);
    this.haveBase = true;

    // --- the base pose on the screen: the fingers' reach is read from where they would be open
    this.object.updateMatrixWorld(true);
    this.readScreen();
    const L = Math.max(
      10,
      Math.hypot(this.tips[4]! - this.palmScreen.x, this.tips[5]! - this.palmScreen.y),
    );

    // --- what the pointer asks
    const ps = this.ctx.pointer.state;
    let px = ps.x - W / 2;
    let py = H / 2 - ps.y;
    let live = (ps.type === "touch" ? ps.down : ps.inside) && this.interactive;
    if (this.explicit) {
      px = this.explicit.x;
      py = this.explicit.y;
      live = true;
    }
    reachFor(
      {
        px,
        py,
        live: live && this.reactivity > 0,
        tips: this.tips,
        knuckles: this.knuckles,
        palmX: this.palmScreen.x,
        palmY: this.palmScreen.y,
        length: L,
      },
      this.reach,
    );

    // --- the press, the ripple, the grip
    if (this.pressed) {
      this.pressAge += dt;
      if (this.pressAge > GRIP_MAX) this.pressed = false;
    }
    this.rippleAge += dt;
    const ripple = rippleEnvelope(this.rippleAge, RIPPLE_SECONDS);
    const gripWanted = Math.max(this.pressed ? 1 : 0, this.gripSet);
    this.grip = approach(this.grip, gripWanted, gripWanted > this.grip ? 16 : 7, dt);
    // A weight in the palm: the reach is a little lighter, and the grip is only a cup.
    const lighter = 1 - 0.15 * this.burden;
    // The pointer on the palm closes the fingers a long way; around a doll it may only cup them.
    const reachCap = REACH_GAIN + (1 - REACH_GAIN) * this.burden;
    const cup = FIST + (1.25 - FIST) * this.burden;
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      this.wantCurl[f] =
        Math.min(this.reach.curl[f]!, reachCap) * this.reactivity * lighter +
        waveCurl(f, this.rippleFrom, this.clock, ripple) +
        this.grip * cup;
    }
    this.bank.step(this.wantCurl, this.reach.spread, this.reach.nearest, dt);
    this.leanRoll.step(this.reach.roll * this.reactivity, dt);
    this.leanNod.step(this.reach.nod * this.reactivity, dt);

    // --- turn the bones, on top of what the mixer wrote
    const idle = smoothstep(0.7, 1, this.riseT);
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      const rig = this.fingers[f]!;
      const curl = this.bank.curl[f]!;
      for (let j = 0; j < 3; j += 1) {
        const angle =
          jointAngle(rig.name, j as 0 | 1 | 2, curl) + idleAngle(f, j, this.clock) * idle;
        rig.bones[j]!.quaternion.multiply(_q.setFromAxisAngle(rig.flex, angle));
      }
      if (f > 0) {
        rig.bones[0].quaternion.multiply(
          _q.setFromAxisAngle(rig.spread, this.bank.spread[f]! * SPREAD_SIGN),
        );
      }
    }
    const sway = Math.sin(this.clock * 2 * Math.PI * 0.2) * 0.014 * idle;
    this.handBone.quaternion
      .multiply(_q.setFromAxisAngle(this.rollAxis, this.leanRoll.x * this.rollSign + sway))
      .multiply(_qb.setFromAxisAngle(this.nodAxis, -this.leanNod.x));

    // --- the final matrices, the sockets, the hit shape, the ink
    this.object.updateMatrixWorld(true);
    const inv = 1 / this.k;
    this.palmSocket.scale.setScalar(inv);
    for (const rig of this.fingers) this.sockets.get(rig.name)!.scale.setScalar(inv);
    this.placeStand();
    this.readScreen();
    this.fillShape();
    this.ink.width.value = Math.max(INK_MIN, LOOK.inkPx / (this.k * depthScale(this.pz)));

    const ms = performance.now() - t0;
    this.stats.updateMs = ms;
    this.stats.updateAvg += (ms - this.stats.updateAvg) * 0.05;
  }

  /** The tips, the knuckles and the palm on the screen, from the matrices of this moment. */
  private readScreen(): void {
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      const rig = this.fingers[f]!;
      _v.setFromMatrixPosition(this.sockets.get(rig.name)!.matrixWorld);
      projectToStage(_s, _v.x, _v.y, _v.z);
      this.tips[f * 2] = _s.x;
      this.tips[f * 2 + 1] = _s.y;
      _v.setFromMatrixPosition(rig.bones[0].matrixWorld);
      projectToStage(_s, _v.x, _v.y, _v.z);
      this.knuckles[f * 2] = _s.x;
      this.knuckles[f * 2 + 1] = _s.y;
    }
    _v.setFromMatrixPosition(this.palmSocket.matrixWorld);
    projectToStage(this.palmScreen, _v.x, _v.y, _v.z);
  }

  /** The upright socket: at the palm's point, no turn, no scale (so its children work in pixels). */
  private placeStand(): void {
    _v2.setFromMatrixPosition(this.palmSocket.matrixWorld);
    _m.copy(this.object.matrixWorld).invert();
    _m2.makeTranslation(_v2.x, _v2.y, _v2.z);
    this.standSocket.matrix.multiplyMatrices(_m, _m2);
    this.standSocket.matrixWorld.multiplyMatrices(this.object.matrixWorld, this.standSocket.matrix);
  }

  private fillShape(): void {
    const shape = this.shape;
    const s = this.palmScreen.s;
    shape.palmX = this.palmScreen.x;
    shape.palmY = this.palmScreen.y;
    shape.palmR = PALM.radius * this.k * s;
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      const c = shape.fingers[f]!;
      c.ax = this.knuckles[f * 2]!;
      c.ay = this.knuckles[f * 2 + 1]!;
      c.bx = this.tips[f * 2]!;
      c.by = this.tips[f * 2 + 1]!;
      c.r = FINGER_HIT_RADIUS * this.k * s;
    }
    _v.setFromMatrixPosition(this.palmSocket.matrixWorld);
    shape.depth = 1000 - _v.z;
  }

  /** Put every spring at rest (a jump, or the first frame after the hand was hidden). */
  private snap(): void {
    this.bank.snap();
    this.dip.snap(0);
    this.leanRoll.snap(0);
    this.leanNod.snap(0);
    this.grip = 0;
    this.pressed = false;
    this.rippleAge = RIPPLE_SECONDS;
  }

  // ------------------------------------------------------------------ the pointer

  private addHit(): () => void {
    const stage = this.ctx.stage;
    return this.ctx.pointer.add({
      id: "hand",
      // No label: the hand has no word to show, but it still answers.
      test: (x, y) => {
        if (!this.visible || !this.object.visible || !this.interactive || this.lifted < 0.5)
          return null;
        return handHit(this.shape, x - stage.width / 2, stage.height / 2 - y, 25);
      },
      enter: () => {
        this.hovered = true;
        this.rippleAge = 0;
        this.rippleFrom = this.reach.nearest;
      },
      leave: () => {
        this.hovered = false;
      },
      press: () => {
        this.pressed = true;
        this.pressAge = 0;
        this.dip.kick(-380);
      },
      release: () => {
        this.pressed = false;
      },
    });
  }

  /** True while the pointer is over the hand. */
  get isHovered(): boolean {
    return this.hovered;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeHit();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.object.removeFromParent();
    const geometry = this.mesh.geometry;
    geometry.dispose();
    const dispose = (m: Material | Material[]): void => {
      for (const one of Array.isArray(m) ? m : [m]) one.dispose();
    };
    const map = this.glove.material.map;
    dispose(this.glove.material);
    dispose(this.ink.material);
    this.glove.gradient.dispose();
    map?.dispose();
    forgetGltf(HAND_MODEL);
    this.cast.pass.scene.remove(this.object);
  }
}
