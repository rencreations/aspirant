/**
 * The normal drone of the home: the Aspirants' official mascot, in the shared renderer, drawn with
 * the About look. A plain class (no React). A section drives it by setting a TARGET STATE every
 * frame it shows the drone; the drone integrates its own motion toward it in `update`:
 *
 *   drone.place({ x, y, height });       // where, in the stage's pixel frame (y up)
 *   drone.face("shocked", 1);            // a face, and how strongly it is worn
 *   drone.look("pointer");               // eyes and body follow the cursor
 *
 * One-shot reactions (a blink, a hop, the shock mark) are timed inside the drone and always finish. A
 * jump of the scroll, a drone that was hidden and is shown again, and a target that moves by most of
 * the screen in one frame all put the drone on its target at once, with no spring left flying.
 * `docs/design/home/actor-drone.md` has the whole API, the numbers and how to look at it.
 *
 * Coordinates: the API speaks the stage's pixel frame (origin in the middle of the viewport, x
 * right, y UP). Inside, the motion is the About page's, in the SCREEN frame (middle origin, y DOWN):
 * the two meet only in `coords.ts`.
 */
import { Object3D, type WebGLRenderer } from "three";

import type { Actor, FrameInfo, HitTarget, Pass } from "../../kernel/types";
import type { ActorCtx } from "../shared/types";

import { clientToScreen, isJump, placeToTarget, type DronePlace, type Target } from "./coords";
import { mix, ramp } from "./ease";
import { createFace, createFaceFrame, setFaceNow, stepFace } from "./face-state";
import { ENTER_BLEND, LEAVE_BLEND, moodOf, type FaceName } from "./faces";
import { FlatLayer, TRAIL_POINTS, type TrailPoint } from "./flat";
import {
  createFlight,
  createFollower,
  floatOf,
  flightOf,
  lookAt,
  snapFollower,
  stepFollower,
} from "./follow";
import { createShockLook, SHOCK_MIN_SECONDS, SHOCK_SECONDS, shockAt } from "./marks-anim";
import { SIZE_PER_HEIGHT } from "./model";
import { createPresence, stepPresence } from "./presence";
import { clearPose, createPoseLook, createPoseState, stepPose, type PoseName } from "./pose";
import {
  createAnswer,
  createReactions,
  press as pressAnswer,
  resetReactions,
  stepReactions,
  type Answer,
} from "./reactions";
import { createRig, createRigInput, createRigPose, stepRig } from "./rig";
import { DroneModel, type DroneDraw } from "./scene";
import {
  clearTrick,
  createTrickPose,
  createTricks,
  rockForRider,
  startTrick,
  stepTricks,
  trickPose,
  type TrickKind,
} from "./tricks";

/** Which side of the cast the drone is drawn on: the back (the default) or the front. */
export type DroneLayer = "back" | "front";
/** What the eyes and the body follow. */
export type LookAt = { x: number; y: number } | "pointer" | null;

/** A frame longer than this is taken as this long, so a stall does not throw the springs. */
const DT_MAX = 0.05;
/** A move of the scene's position of more than this many screens in a frame is a jump. */
const S_JUMP = 1.2;
const DEFAULT_HEIGHT = 160;
/** The step of an `advance`. */
const ADVANCE_STEP = 1 / 60;
/** The trail keeps this many places, for this many seconds. */
const TRAIL_LIFE = 0.36;
/** The hover lifts the drone this far (in its widths) and makes it this much bigger. */
const HOVER_LIFT = 0.045;
const HOVER_GROW = 0.05;
/** Where the drone's two passes sit among the stage's (ortho 10, perspective 20, cast 30, marks 40). */
const BACK_ORDER = 25;
const FRONT_ORDER = 35;
/** The depths a hit reports (smaller is nearer): the front layer is in front of the cast, the back behind. */
const DEPTH_BACK = 600;
const DEPTH_FRONT = 100;
const CURSOR_LABEL = "HELLO";

/**
 * What a pair controller does with a press or a hover instead of the drone's own answer (round six:
 * the drone and the doll answer together). Set `hooks` and the drone's reactions to the pointer are
 * off; its hover look (a lift, the eyes) stays.
 */
export interface PointerHooks {
  enter?(): void;
  leave?(): void;
  press?(x: number, y: number): void;
  release?(x: number, y: number): void;
}

/** A place in the stage frame, for the probes. */
interface DroneState {
  x: number;
  y: number;
  height: number;
  yaw: number;
  pitch: number;
  roll: number;
  face: string;
  trick: TrickKind | null;
  pose: PoseName | null;
  hovered: boolean;
  presence: number;
  mood: string;
  shock: boolean;
  layer: DroneLayer;
  snaps: number;
}

export class DroneActor implements Actor {
  readonly name = "drone";
  visible = false;
  readonly object: Object3D;
  /**
   * A pair controller steps the drone itself (it must run before the doll that sits on it): the
   * kernel's `update` is then a no-op and the controller calls `drive`.
   */
  external = false;
  /** A pair controller answers the pointer (see `PointerHooks`). */
  hooks: PointerHooks | null = null;
  /** A rider sits on the drone: a roll or a flip is a rock from side to side (`rockForRider`), a spin stays a spin. */
  carrying = false;
  /** A pair controller sets the depth the drone's hit reports (larger is farther): the doll on its head is hit first. */
  hitDepth: number | null = null;

  private readonly ctx: ActorCtx;
  private readonly model: DroneModel;
  private readonly flat: FlatLayer;
  private readonly removers: Array<() => void> = [];
  private disposed = false;

  // What a section asks for (sticky between frames).
  private readonly target: Target = { x: 0, y: 0, size: 0, yaw: 0, pitch: 0, roll: 0 };
  private readonly lastTarget = { x: 0, y: 0 };
  private hasTarget = false;
  private snapNext = true;
  private layerName: DroneLayer = "back";
  private baseFace: FaceName = "normal";
  private baseBlend = 1;
  private baseOn = false;
  private lookMode: LookAt = null;
  private poseName: PoseName | null = null;
  private poseSide = 1;
  private interactive = true;
  private presenceGoal = 1;
  private appearAsked = false;

  // The drone's own state.
  private time = 0;
  private lastFrame = -10;
  private lastS = 0;
  private snaps = 0;
  private readonly follower = createFollower();
  private readonly flight = createFlight();
  private readonly tricks = createTricks();
  private readonly trick = createTrickPose();
  private pendingTrick: TrickKind | null = null;
  private readonly rig = createRig();
  private readonly rigInput = createRigInput();
  private readonly rigPose = createRigPose();
  private readonly faceState = createFace();
  private readonly faceFrame = createFaceFrame();
  private readonly reactions = createReactions();
  private readonly answer: Answer = createAnswer();
  private readonly poseState = createPoseState();
  private readonly poseLook = createPoseLook();
  private emoteFace: FaceName | null = null;
  private emoteLeft = 0;
  private flutterAmount = 0;
  private spinYaw = 0;
  private hovered = false;
  private readonly lift = { x: 0, v: 0 };
  private readonly presence = createPresence();
  private engaged = 0;
  private readonly bob = { dx: 0, dy: 0, roll: 0, pitch: 0 };
  private readonly gaze = { yaw: 0, pitch: 0, eyeX: 0, eyeY: 0 };
  /** The point the eyes go to (the screen frame), the point a section gave, and a scratch for the hit test. */
  private readonly point = { x: 0, y: 0 };
  private readonly lookPoint = { x: 0, y: 0 };
  private readonly hitPoint = { x: 0, y: 0 };

  // The marks.
  private shockT = -1;
  private shockLife = SHOCK_SECONDS;
  private readonly shockLook = createShockLook();

  // What is drawn: the composed pose, in the screen frame.
  private readonly draw: DroneDraw;
  private readonly at = { x: 0, y: 0, size: 100 };
  private readonly rest = { yaw: 0, pitch: 0 };
  private readonly trailPoints: TrailPoint[] = Array.from({ length: TRAIL_POINTS }, () => ({
    x: 0,
    y: 0,
    age: 0,
  }));
  private readonly history = {
    x: new Float32Array(TRAIL_POINTS),
    y: new Float32Array(TRAIL_POINTS),
    t: new Float32Array(TRAIL_POINTS),
    count: 0,
  };
  private readonly sockets = { above: new Object3D(), side: new Object3D() };

  constructor(ctx: ActorCtx, model: DroneModel, flat: FlatLayer) {
    this.ctx = ctx;
    this.model = model;
    this.flat = flat;
    this.object = model.root;
    this.draw = {
      x: 0,
      y: 0,
      size: 100,
      yaw: 0,
      pitch: 0,
      roll: 0,
      rig: this.rigPose,
      face: "normal",
      blink: 0,
      lookX: 0,
      lookY: 0,
    };
    this.sockets.above.name = "drone_above";
    this.sockets.side.name = "drone_side";

    const stage = ctx.stage;
    const pass = (name: string, order: number, layer: DroneLayer): Pass => ({
      name,
      order,
      active: () => this.layerName === layer && this.drawable(),
      render: (renderer) => {
        this.render(renderer);
      },
      resize: (w, h) => {
        this.model.resize(w, h);
        this.flat.resize(w, h);
      },
      rebuild: () => {
        this.warm();
      },
    });
    // Two passes, one behind the cast (25: over the flat pass 10 and the kernel's perspective pass
    // 20, under the cast 30) and one in front of it (35, under the comic marks at 40), so that a
    // section may put the drone in front of a character. Only one is ever active.
    this.removers.push(stage.addPass(pass("drone", BACK_ORDER, "back")));
    this.removers.push(stage.addPass(pass("drone-front", FRONT_ORDER, "front")));
    this.warm();

    const target: HitTarget = {
      id: "drone",
      cursor: CURSOR_LABEL,
      test: (x, y) => this.hit(x, y),
      enter: () => {
        this.hovered = true;
        this.hooks?.enter?.();
      },
      leave: () => {
        this.hovered = false;
        this.hooks?.leave?.();
      },
      press: (x, y) => {
        if (this.hooks) this.hooks.press?.(x, y);
        else this.onPress();
      },
      release: (x, y) => {
        this.hooks?.release?.(x, y);
      },
    };
    this.removers.push(ctx.pointer.add(target));
  }

  // ---------------------------------------------------------------- what a section sets

  /**
   * Where the drone is. A target the drone springs toward, with its attitude from its own movement
   * (a flight is nose first). `height` is the on-screen height in CSS pixels. Call it every frame.
   * Nothing the visitor does to the drone (hover, press) changes this target.
   */
  place(p: DronePlace): void {
    placeToTarget(p, this.ctx.stage.width, this.target);
    this.hasTarget = true;
  }

  /** Put the drone on a place now, with no flight: a jump, an opening, a probe. */
  snapTo(p: DronePlace): void {
    this.place(p);
    this.snapNext = true;
  }

  /** Which side of the lit characters it is drawn on. Default "back". */
  layer(layer: DroneLayer): void {
    this.layerName = layer;
  }

  /**
   * The face it wears. The drawings cannot blend, so `blend` (0 to 1) decides two things: the
   * drawing is worn once `blend` reaches 0.5 (and kept until it falls below 0.35, so a value
   * ramped by the scroll does not flicker), and the body language that goes with the face (fins
   * up for joy, wings wide for a fright, everything hanging for sorrow) is scaled by it. Below that
   * the plain face stays. A change of drawing is hidden behind a blink.
   */
  face(name: FaceName, blend = 1): void {
    this.baseFace = name;
    this.baseBlend = blend;
  }

  /** Wear a face for a while, over whatever `face` says, then give it back. */
  emote(name: FaceName, seconds = 1.2): void {
    this.emoteFace = name;
    this.emoteLeft = Math.max(0, seconds);
  }

  /** Eyes and body look at a point (stage frame), at the cursor (a mouse only), or at nothing. */
  look(at: LookAt): void {
    this.lookMode = at;
    if (at && at !== "pointer") {
      this.lookPoint.x = at.x;
      this.lookPoint.y = -at.y;
    }
  }

  /** The comic shock mark above the head: a burst of lines and a bang, for `seconds`. */
  shock(seconds = SHOCK_SECONDS): void {
    this.shockT = 0;
    this.shockLife = Math.max(SHOCK_MIN_SECONDS, seconds);
  }

  /**
   * The drone is here: it pops in with a spring that overshoots and a flutter of the wings, when it
   * was gone (`disappear()`) or when this is the first frame a section shows it again. Idempotent,
   * so a section may call it every frame.
   */
  appear(): void {
    this.appearAsked = true;
    if (this.presenceGoal === 1) return;
    this.presenceGoal = 1;
    this.presence.x = 0;
    this.presence.v = 0;
  }

  /** The drone goes: it shrinks away quickly. Idempotent. */
  disappear(): void {
    this.presenceGoal = 0;
  }

  /** Play one of the moves now (a barrel roll across a flight). False while another one plays. */
  trickNow(kind: TrickKind, dir = 1): boolean {
    return startTrick(this.tricks, kind, dir);
  }

  /**
   * A named pose, blended in and out: "peek" (it has stepped to a corner and looks at something
   * on `side`, -1 left and 1 right: the face, the eyes and the lean turn to it) and "thanks" (a
   * bow with the kind face, played once when the pose begins). `null`
   * gives the pose back. The section places the drone; the pose only shapes it.
   */
  pose(name: PoseName | null, side = 1): void {
    this.poseName = name;
    this.poseSide = side;
  }

  /** Whether hover and press reach the drone. On by default. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.hovered = false;
  }

  /** A section takes the drone over: face, look, pose, marks and layer back to their defaults, and it is here. */
  reset(): void {
    this.baseFace = "normal";
    this.baseBlend = 1;
    this.lookMode = null;
    this.poseName = null;
    this.layerName = "back";
    this.interactive = true;
    this.presenceGoal = 1;
    this.presence.x = 1;
    this.presence.v = 0;
    this.spinYaw = 0;
    this.flutterAmount = 0;
    this.clearOneShots();
  }

  // ---------------------------------------------------------------- what a section reads

  /** What is drawn this frame, in the screen frame (y down): for the pair's seat arithmetic. Read only. */
  get drawn(): Readonly<{
    x: number;
    y: number;
    size: number;
    yaw: number;
    pitch: number;
    roll: number;
  }> {
    return this.draw;
  }

  /** A turn about its vertical axis added to what is drawn, with no spring: a dance's spin (wrapped by the caller). */
  spin(angle: number): void {
    this.spinYaw = Number.isFinite(angle) ? angle : 0;
  }

  /** The wings work at least this hard, 0 to 1 (a dance, a descent). Sticky; 0 gives them back. */
  flutter(amount: number): void {
    this.flutterAmount = Math.max(0, Math.min(1, amount));
  }

  /** The drone as it is drawn (stage frame), for a probe or a section that stands something beside it. */
  state(): DroneState {
    return {
      x: this.draw.x,
      y: -this.draw.y,
      height: this.draw.size / SIZE_PER_HEIGHT,
      yaw: this.draw.yaw,
      pitch: this.draw.pitch,
      roll: this.draw.roll,
      face: this.faceFrame.shown,
      trick: this.tricks.kind,
      pose: this.poseState.current,
      hovered: this.hovered,
      presence: this.presence.x,
      mood: this.reactions.mood,
      shock: this.shockLook.bangAlpha > 0,
      layer: this.layerName,
      snaps: this.snaps,
    };
  }

  /**
   * Where a mark or another actor can attach, in the stage frame (an Object3D that is not in any
   * scene: its `position` is written once a frame, after the drone has moved, so a section that
   * reads it in its own update sees the last frame's). "above" is over the head, "side" beside the
   * body on the side that has room. `userData.height` is the drone's on-screen height. A section
   * copies the position; it never parents a thing to it, because the drone draws in a lens of its own.
   */
  socket(name: "above" | "side"): Object3D {
    return this.sockets[name];
  }

  /** Run the drone's own clock for `seconds` as if frames had passed: for probes holding a frozen scene. */
  advance(seconds: number): void {
    let left = Math.max(0, seconds);
    while (left > 1e-9) {
      const dt = Math.min(ADVANCE_STEP, left);
      this.step(dt);
      left -= dt;
    }
    if (seconds <= 0) this.step(0);
  }

  /** Wear a drawing at once, with no blink: for a probe's picture. */
  faceNow(name: FaceName): void {
    this.baseFace = name;
    this.baseBlend = 1;
    this.baseOn = true;
    setFaceNow(this.faceState, name);
    this.step(0);
  }

  // ---------------------------------------------------------------- the frame

  update(frame: FrameInfo): void {
    if (this.external) return;
    this.drive(frame);
  }

  /** The frame's work: the kernel's `update`, or a pair controller's call in its own order. */
  drive(frame: FrameInfo): void {
    const resumed = frame.frame !== this.lastFrame + 1;
    const jumped = Math.abs(frame.S - this.lastS) > S_JUMP;
    this.lastFrame = frame.frame;
    this.lastS = frame.S;
    // A drone that was not shown last frame, or a scroll that jumped: the drone is put on its target.
    if (resumed || jumped) this.snapNext = true;
    // `appear()` on the frame the drone is shown again pops it in, as on the first time.
    if (resumed && this.appearAsked) {
      this.presence.x = 0;
      this.presence.v = 0;
    }
    this.appearAsked = false;
    this.step(Math.min(frame.dt, DT_MAX));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const remove of this.removers) remove();
    this.removers.length = 0;
    this.flat.dispose();
    this.model.dispose();
  }

  // ---------------------------------------------------------------- inside

  private drawable(): boolean {
    return !this.disposed && this.object.visible && this.presence.x > 0.003;
  }

  private warm(): void {
    const renderer = this.ctx.stage.renderer;
    this.model.warm(renderer);
    this.flat.warm(renderer);
  }

  private render(renderer: WebGLRenderer): void {
    if (this.flat.hasTrail) renderer.render(this.flat.under, this.flat.camera);
    this.model.draw(renderer, this.draw);
    if (this.flat.hasMarks) renderer.render(this.flat.over, this.flat.camera);
  }

  private hit(cx: number, cy: number): number | null {
    if (!this.visible || !this.interactive || this.presence.x < 0.35 || this.disposed) return null;
    const stage = this.ctx.stage;
    const p = clientToScreen(cx, cy, stage.width, stage.height, this.hitPoint);
    const dx = p.x - this.draw.x;
    const dy = p.y - this.draw.y;
    const r = 0.5 * (this.draw.size / SIZE_PER_HEIGHT);
    if (dx * dx + dy * dy > r * r) return null;
    if (this.hitDepth !== null) return this.hitDepth;
    return this.layerName === "front" ? DEPTH_FRONT : DEPTH_BACK;
  }

  private onPress(): void {
    if (!this.interactive || !this.visible) return;
    pressAnswer(this.reactions, this.time, this.answer);
    this.applyAnswer();
  }

  private applyAnswer(): void {
    const a = this.answer;
    if (!a.fired) return;
    if (a.trick && !startTrick(this.tricks, a.trick, this.reactions.answer % 2 === 0 ? 1 : -1)) {
      this.pendingTrick = a.trick;
    }
    if (a.shock) this.shock();
    if (a.face) this.emote(a.face, a.faceSeconds);
  }

  private clearOneShots(): void {
    clearTrick(this.tricks);
    this.pendingTrick = null;
    this.emoteLeft = 0;
    this.emoteFace = null;
    this.shockT = -1;
    resetReactions(this.reactions);
    clearPose(this.poseState);
    this.history.count = 0;
  }

  /** Put the drone on its target at rest, forget what it was in the middle of. */
  private snap(): void {
    snapFollower(this.follower, this.target);
    this.clearOneShots();
    this.hovered = false;
    this.lift.x = 0;
    this.lift.v = 0;
    this.engaged = 0;
    this.snapNext = false;
    this.snaps += 1;
    this.lastTarget.x = this.target.x;
    this.lastTarget.y = this.target.y;
  }

  private step(dt: number): void {
    const stage = this.ctx.stage;
    const w = stage.width;
    const h = stage.height;
    if (!this.hasTarget) {
      // Nobody has placed it yet: it hovers in the middle of the screen.
      placeToTarget({ x: 0, y: 0, height: DEFAULT_HEIGHT }, w, this.target);
    }
    if (isJump(this.lastTarget, this.target, w, h)) this.snapNext = true;
    if (this.snapNext) this.snap();
    this.lastTarget.x = this.target.x;
    this.lastTarget.y = this.target.y;
    this.time += dt;
    const time = this.time;
    const t = this.target;

    // The presence: a spring that overshoots coming in, and one that does not going out.
    stepPresence(this.presence, this.presenceGoal === 1, dt);

    // What it looks at.
    // A hovered drone looks at whoever is over it, whatever the section asked.
    let hasPoint = false;
    if (this.lookMode === "pointer" || (this.hovered && this.interactive)) {
      const p = this.ctx.pointer.state;
      if (p.inside && p.type === "mouse") {
        clientToScreen(p.x, p.y, w, h, this.point);
        hasPoint = true;
      }
    } else if (this.lookMode) {
      this.point.x = this.lookPoint.x;
      this.point.y = this.lookPoint.y;
      hasPoint = true;
    }
    this.engaged = mix(this.engaged, hasPoint ? 1 : 0, 1 - Math.exp(-5 * dt));
    lookAt(this.at, this.point.x, this.point.y, h, this.gaze);

    // The poses and the answers to a press.
    stepPose(this.poseState, this.poseName, this.poseSide, dt, this.poseLook);
    stepReactions(this.reactions, time, this.answer);
    this.applyAnswer();
    if (this.pendingTrick && startTrick(this.tricks, this.pendingTrick, 1))
      this.pendingTrick = null;
    stepTricks(this.tricks, dt);
    trickPose(this.tricks, this.trick);
    if (this.carrying) rockForRider(this.tricks.kind, this.trick);
    this.emoteLeft = Math.max(0, this.emoteLeft - dt);

    // Hover: it lifts a little and gets a little bigger (it never moves its target).
    const hov = this.hovered && this.interactive ? 1 : 0;
    const k = 1 - Math.exp(-14 * dt);
    this.lift.x = mix(this.lift.x, hov, dt > 0 ? k : 0);

    // The flight.
    const poseL = this.poseLook;
    const rest = this.rest;
    rest.yaw = mix(t.yaw, t.yaw * 0.3 + this.gaze.yaw, this.engaged);
    rest.pitch = t.pitch + 0.03 + this.gaze.pitch * this.engaged;
    stepFollower(this.follower, t, rest, h, dt, this.flight);
    flightOf(this.follower, h, this.flight);
    const fl = this.flight;
    const calm = 1 - fl.fast;
    floatOf(time, calm, this.follower.size.x, this.bob);

    // The pose it is drawn in.
    const base = this.follower.size.x;
    const grow = 1 + HOVER_GROW * this.lift.x;
    const pres = Math.max(0, this.presence.x);
    const size = base * grow * poseL.scale * pres;
    const d = this.draw;
    d.x = this.follower.x.x + this.bob.dx + (this.trick.dx + poseL.dx) * base;
    d.y =
      this.follower.y.x +
      this.bob.dy +
      (this.trick.dy + poseL.dy - HOVER_LIFT * this.lift.x) * base;
    d.size = size;
    d.yaw = this.follower.yaw.x + this.trick.yaw + poseL.yaw + this.spinYaw;
    d.pitch = this.follower.pitch.x + this.bob.pitch + this.trick.pitch + poseL.pitch;
    d.roll = this.follower.roll.x + this.bob.roll + this.trick.roll + poseL.roll;
    this.at.x = d.x;
    this.at.y = d.y;
    this.at.size = size;

    // The face. The kind of answer decides which drawing: a reaction, then a pose, then a move, then
    // the joy of being hovered, then what the section asked for.
    if (this.baseBlend >= ENTER_BLEND) this.baseOn = true;
    else if (this.baseBlend < LEAVE_BLEND) this.baseOn = false;
    const baseName: FaceName = this.baseOn ? this.baseFace : "normal";
    let wanted: FaceName = baseName;
    let strength = this.baseOn ? Math.min(1, Math.max(0, this.baseBlend)) : 0;
    if (this.emoteLeft > 0 && this.emoteFace) {
      wanted = this.emoteFace;
      strength = 1;
    } else if (poseL.face) {
      wanted = poseL.face;
      strength = 1;
    } else if (this.trick.face) {
      wanted = this.trick.face;
      strength = 1;
    } else if (hov > 0 && wanted === "normal") {
      wanted = "happy";
      strength = 1;
    }

    // Body language: from the face, the joy of a hover, a pose, and the wings' brake on a hard stop.
    const mood = moodOf(wanted);
    const along =
      fl.speed > 0.05 ? -(fl.vx * this.follower.ax + fl.vy * this.follower.ay) / h / fl.speed : 0;
    const input = this.rigInput;
    input.fast = fl.fast;
    input.effort = this.trick.effort;
    input.flare = Math.max(
      mood.flare * strength,
      this.trick.flare,
      ramp(1.2, 5, along) * ramp(0.1, 0.5, fl.speed),
    );
    input.ax = this.follower.ax / h;
    input.ay = this.follower.ay / h;
    input.happy = Math.max(mood.happy * strength, hov * 0.9, poseL.happy);
    input.droop = Math.max(mood.droop * strength, poseL.droop);
    input.time = time;
    // The wings flutter as it pops in or out.
    if (Math.abs(this.presence.v) > 0.05) input.effort = Math.max(input.effort, 0.7);
    input.effort = Math.max(input.effort, this.flutterAmount);
    stepRig(this.rig, input, dt, this.rigPose);

    const eyeX = this.gaze.eyeX * this.engaged + poseL.eyeX;
    const eyeY = this.gaze.eyeY * this.engaged + poseL.eyeY;
    stepFace(this.faceState, wanted, eyeX, eyeY, dt, this.faceFrame);
    d.face = this.faceFrame.shown;
    d.blink = this.faceFrame.blink;
    d.lookX = this.faceFrame.lookX;
    d.lookY = this.faceFrame.lookY;

    this.stepTrail(dt, time, fl.speed);
    this.stepMarks(dt);
    this.stepSockets();
  }

  private stepTrail(dt: number, time: number, speed: number): void {
    const hs = this.history;
    const strength = ramp(0.55, 1.7, speed);
    if (dt > 0) {
      // The places it has just been, the newest first.
      for (let i = Math.min(hs.count, TRAIL_POINTS - 1); i > 0; i -= 1) {
        hs.x[i] = hs.x[i - 1] ?? 0;
        hs.y[i] = hs.y[i - 1] ?? 0;
        hs.t[i] = hs.t[i - 1] ?? 0;
      }
      hs.x[0] = this.draw.x;
      hs.y[0] = this.draw.y;
      hs.t[0] = time;
      hs.count = Math.min(TRAIL_POINTS, hs.count + 1);
      while (hs.count > 0 && time - (hs.t[hs.count - 1] ?? time) > TRAIL_LIFE) hs.count -= 1;
    }
    let n = 0;
    if (strength > 0.01) {
      for (let i = 0; i < hs.count; i += 1) {
        const p = this.trailPoints[i];
        if (!p) break;
        p.x = hs.x[i] ?? 0;
        p.y = hs.y[i] ?? 0;
        p.age = (time - (hs.t[i] ?? time)) / TRAIL_LIFE;
        n += 1;
      }
    }
    this.flat.setTrail(this.trailPoints, n, strength * 0.6, this.draw.size * 0.3);
  }

  private stepMarks(dt: number): void {
    const height = this.draw.size / SIZE_PER_HEIGHT;
    if (this.shockT >= 0) {
      this.shockT += dt;
      shockAt(this.shockT, this.shockLook, this.shockLife);
      if (this.shockT >= this.shockLife) this.shockT = -1;
    } else {
      this.shockLook.bangAlpha = 0;
      this.shockLook.lineAlpha = 0;
    }
    this.flat.setShock(this.shockLook, this.draw.x, this.draw.y, height);
  }

  private stepSockets(): void {
    const stage = this.ctx.stage;
    const height = this.draw.size / SIZE_PER_HEIGHT;
    const x = this.draw.x;
    const y = -this.draw.y;
    const above = this.sockets.above;
    above.position.set(x, y + 0.64 * height, 0);
    above.userData.height = height;
    const side = this.sockets.side;
    const dir = x > stage.width * 0.28 ? -1 : 1;
    side.position.set(x + dir * 0.6 * height, y + 0.1 * height, 0);
    side.userData.height = height;
  }
}

/** Build the drone: the model and its marks load in parallel (through the media store). */
export async function buildDrone(ctx: ActorCtx): Promise<DroneActor> {
  const [model, flat] = await Promise.all([DroneModel.load(), FlatLayer.load()]);
  return new DroneActor(ctx, model, flat);
}
