/**
 * The pair (round six): the normal drone carries the Obsidia doll, she sits on its head. One actor
 * of the registry ("buddies") that steps the drone and the doll itself, in the order the seat needs
 * (drone, seat, doll), and owns everything that makes them one creature: the seat, the modes
 * (carry, dance, dock, apart), the dances, the docked life, the answers to the pointer.
 * `docs/design/home/actor-buddies.md` is the API and the numbers.
 *
 * A section sets, every frame it shows the pair: `visible`, `place`, `mode` (sticky), maybe `dance`,
 * `descent`, `look`. Nothing a visitor does moves the place the section gave.
 *
 * Round eight: while she rides, the doll is in the drone's own scene (one world, one lens, one depth
 * buffer), so the drone's body hides her parts; and the pair's life (the cursor, the hover and press
 * answers, the docked moments, the drone's float) is locked while the visitor scrolls and while a dance
 * drives them, with a tolerance before and after (`lock.ts`).
 */
import { Object3D } from "three";

import type { Actor, FrameInfo } from "../../kernel/types";
import type { ActorCtx } from "../shared/types";
import type { DollActor } from "../doll/actor";
import type { FaceName as DollFace } from "../doll/face/presets";
import { DOLL_SIZE } from "../doll/place";
import type { DroneActor, DroneLayer } from "../drone/actor";
import type { DronePlace } from "../drone/coords";
import { lensDistance } from "../drone/model";
import type { TrickKind } from "../drone/tricks";

import {
  blendCue,
  clearCue,
  createCue,
  danceCue,
  DANCE_NAMES,
  type DanceName,
  type PairCue,
} from "./choreo";
import { LifeScheduler } from "./life";
import { createHands, stepHands, type Hands } from "./hands";
import { closeLock, createLock, stepLock } from "./lock";
import { createHeadFrame, headFrame, modelToStage, FACE_POINT, perMetreOf } from "./seat";
import { createTouchOut, Touch, type TouchOut } from "./touch";

export type PairMode = "carry" | "dance" | "dock" | "apart";
export type ReactName =
  "cheer" | "giggle" | "hug" | "wave" | "startle" | "hop" | "wiggle" | "spin" | "dizzy" | "laugh";

/** How tall she is drawn beside the drone (her drawn height over its height). Tuned by eye. */
export const DOLL_RATIO = 0.5;
/**
 * Where her hips sit from the seat, in her drawn heights along the seat's axes. Round eight: she is in
 * the drone's own scene, so the helmet's dome is a real surface. Its top is flat from 0.06 m behind the
 * seat to 0.15 m in front (the profile of the model), so she sits on the front half of it, high enough
 * that her seat rests on the dome and her legs go over its front edge. Looked at on eight attitudes.
 */
const SEAT_OFFSET: readonly [number, number, number] = [0, 0.24, 0.5];
/** How much of the drone's roll she holds against. */
const UPRIGHT = 0.5;
/** A frame longer than this is taken as this long. */
const DT_MAX = 0.05;
/** How fast the mode weights move, per second (about 0.5 s to blend). */
const MODE_RATE = 5;
/** How long a change of her face takes. */
const FACE_RAMP = 0.16;
/** A press is heard only while the lock's weight is at least this (the hit shapes are off under 0.02). */
const PRESS_MIN = 0.5;
/** The pair's own life and the cursor's pull count as on above this share of their weight. */
const CURSOR_ON = 0.5;

export interface PairState {
  mode: PairMode;
  drone: { x: number; y: number; height: number };
  doll: { x: number; y: number; drawnHeight: number };
  hover: "drone" | "doll" | null;
  life: string;
  reaction: string | null;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export class BuddyPair implements Actor {
  readonly name = "buddies";
  readonly drone: DroneActor;
  readonly doll: DollActor;

  /** The seat: a node of the drone's scene at the top of its helmet. The doll is its child while she rides. */
  readonly seat = new Object3D();
  private readonly gripL = new Object3D();
  private readonly gripR = new Object3D();

  private readonly ctx: ActorCtx;
  private readonly head = createHeadFrame();
  private readonly touch = new Touch();
  private readonly life = new LifeScheduler(11);
  private readonly touchOut: TouchOut = createTouchOut();
  private readonly hands: Hands = createHands();

  private shown = false;
  private baseMode: PairMode = "carry";
  private apartNow = false;
  private hasPlace = false;
  private time = 0;
  private lastFrame = -10;
  private readonly want = {
    x: 0,
    y: 0,
    z: 0,
    height: 160,
    yaw: undefined as number | undefined,
    pitch: 0,
    roll: 0,
  };
  private lookPoint: { x: number; y: number } | null = null;
  private descentAmount = 0;
  private descentNow = 0;

  // The mode weights and the cues.
  private readonly weight = { carry: 1, dance: 0, dock: 0 };
  private readonly cue: PairCue = createCue();
  private readonly cueDance: PairCue = createCue();
  private readonly cueLife: PairCue = createCue();
  private readonly cueTouch: PairCue = createCue();
  private danceName: DanceName | null = null;
  private danceT = 0;
  private danceEnergy = 0.6;
  private danceBpm = 100;
  private danceAsked = false;
  private hover: "drone" | "doll" | null = null;
  private seated = false;
  /** A trick asked while another plays waits for it (up to 1.4 s). */
  private pendingTrick: TrickKind | null = null;
  private pendingDir = 1;
  private pendingLeft = 0;
  private readonly droneHooks: NonNullable<DroneActor["hooks"]>;
  private readonly dollHooks: NonNullable<DollActor["hooks"]>;
  private faceFrom: DollFace = "smile";
  private faceTo: DollFace = "smile";
  private faceW = 1;
  private readonly cursor = { x: 0, y: 0, near: false };
  private readonly smooth = { lean: 0, lookUp: 0, looksDown: 0 };
  private readonly dollPoint = { x: 0, y: 0 };

  // The lock (`lock.ts`): the weight of the pair's own life, from the scroll and from how still the drone is.
  private readonly lock = createLock();
  private lockW = 0;
  private userInteractive = true;
  /** Which side of the cast the pair is drawn on this frame (`layer`). */
  private layerWant: DroneLayer = "back";
  private interactiveNow = true;
  private readonly lastDraw = { x: 0, y: 0, ok: false };
  private speed = 0;
  private cursorOn = false;
  /** Where her hips sit from the seat, in her drawn heights (see `SEAT_OFFSET`); a probe may tune it. */
  private seatOffset: [number, number, number] = [...SEAT_OFFSET];
  /** A probe's switch: the lock is open whatever the scroll does (to measure what it fixes). Never set by the page. */
  probeNoLock = false;

  constructor(ctx: ActorCtx, drone: DroneActor, doll: DollActor) {
    this.ctx = ctx;
    this.drone = drone;
    this.doll = doll;
    this.seat.name = "buddies-seat";
    this.seat.visible = false;
    this.gripL.name = "buddies-gripL";
    this.gripR.name = "buddies-gripR";
    this.seat.add(this.gripL, this.gripR);
    // The seat is in the drone's scene: she is drawn with the drone, through its lens, in its depth buffer.
    drone.hostScene.add(this.seat);
    // Her programs for that scene are made now, not in the first frame she rides.
    drone.warmGuest(doll.object);

    this.droneHooks = {
      enter: () => {
        this.hover = "drone";
        this.touch.hover("drone", this.time);
      },
      leave: () => {
        if (this.hover === "drone") this.hover = null;
        this.touch.hover(null, this.time);
      },
      press: () => {
        if (this.lockW >= PRESS_MIN) this.touch.press("drone", this.time);
      },
      release: () => this.touch.release(this.time),
    };
    this.dollHooks = {
      enter: () => {
        this.hover = "doll";
        this.touch.hover("doll", this.time);
      },
      leave: () => {
        if (this.hover === "doll") this.hover = null;
        this.touch.hover(null, this.time);
      },
      press: () => {
        if (this.lockW >= PRESS_MIN) this.touch.press("doll", this.time);
      },
      release: () => this.touch.release(this.time),
    };
  }

  // ---------------------------------------------------------------- what a section sets

  get visible(): boolean {
    return this.shown;
  }

  set visible(v: boolean) {
    this.shown = v;
    // While the pair is shown it answers the pointer for both and the doll on the head is hit first
    // (her depth is 1000 at z 0, the drone's 1200); a drone shown alone keeps its own answers.
    this.drone.hooks = v ? this.droneHooks : null;
    this.drone.hitDepth = v ? 1200 : null;
    this.drone.carrying = v && !this.apartNow;
    this.doll.hooks = v && !this.apartNow ? this.dollHooks : null;
    this.drone.visible = v;
    this.drone.external = v;
    this.seat.visible = v && !this.apartNow;
    if (this.apartNow) {
      // The doll is the section's own (Selena's hang): never touched here.
      this.doll.external = false;
    } else {
      this.doll.visible = v;
      this.doll.external = v;
    }
  }

  /** A probe's handle: sit her somewhere else on the helmet (her drawn heights along the seat's axes). */
  tuneSeat(x: number, y: number, z: number): void {
    this.seatOffset = [x, y, z];
    this.seated = false;
  }

  /** The DRONE's place (stage frame, y up). `height` is its on-screen height. She comes with it. */
  place(p: DronePlace): void {
    const w = this.want;
    w.x = p.x;
    w.y = p.y;
    w.z = p.z ?? 0;
    w.height = p.height;
    w.yaw = p.yaw;
    w.pitch = p.pitch ?? 0;
    w.roll = p.roll ?? 0;
    this.hasPlace = true;
  }

  /** `carry`, `dance`, `dock` or `apart`. Sticky. */
  mode(m: PairMode): void {
    if (m === this.baseMode) return;
    this.baseMode = m;
    if (m === "apart") this.letGo();
    else this.apartNow = false;
  }

  /** The routine `name` at `t` seconds, for this frame (see `choreo.ts`). */
  dance(name: DanceName, t: number, opts: { energy?: number; bpm?: number } = {}): void {
    if (!DANCE_NAMES.includes(name)) return;
    this.danceName = name;
    this.danceT = t;
    this.danceEnergy = clamp01(opts.energy ?? 0.6);
    this.danceBpm = opts.bpm ?? 100;
    this.danceAsked = true;
  }

  /** How much they are flying down, 0 to 1. */
  descent(amount: number): void {
    this.descentAmount = clamp01(amount);
  }

  /** Both look at a stage point; null: the cursor when it is near, else at each other. */
  look(at: { x: number; y: number } | null): void {
    this.lookPoint = at;
  }

  /** The hit targets answer or not (a section's switch). The scroll lock closes them too, by itself. */
  setInteractive(on: boolean): void {
    this.userInteractive = on;
    this.applyInteractive();
  }

  private applyInteractive(): void {
    const on = this.userInteractive && (this.lockW > 0.02 || this.probeNoLock);
    if (on === this.interactiveNow) return;
    this.interactiveNow = on;
    this.drone.setInteractive(on);
    this.doll.setInteractive(on);
    if (!on) {
      this.hover = null;
      this.touch.hover(null, this.time);
    }
  }

  /**
   * Draw the pair in front of the cast for this frame (the Selena room: its sky is drawn in the cast and
   * would cover a drone behind it). It lasts one frame: a section asks again every frame it wants it.
   */
  layer(layer: DroneLayer): void {
    this.layerWant = layer;
  }

  react(name: ReactName): void {
    this.touch.cue(name, this.time);
  }

  reset(): void {
    this.baseMode = "carry";
    this.lookPoint = null;
    this.descentAmount = 0;
    this.danceAsked = false;
    this.userInteractive = true;
    closeLock(this.lock);
    this.lockW = 0;
    // `drone.reset()` below opens its hit target: the lock closes it again at once.
    this.interactiveNow = true;
    this.touch.reset();
    this.drone.reset();
    this.drone.carrying = true;
    this.applyInteractive();
  }

  state(): PairState {
    const d = this.drone.state();
    return {
      mode: this.apartNow ? "apart" : this.baseMode,
      drone: { x: d.x, y: d.y, height: d.height },
      doll: { x: this.head.x, y: this.head.y, drawnHeight: this.dollAsked() * DOLL_SIZE },
      hover: this.hover,
      life: this.life.name,
      reaction: this.touch.active,
    };
  }

  // ---------------------------------------------------------------- the frame

  update(frame: FrameInfo): void {
    if (!this.shown) return;
    const resumed = frame.frame !== this.lastFrame + 1;
    this.lastFrame = frame.frame;
    const dt = Math.min(frame.dt, DT_MAX);
    this.time += dt;
    this.apartNow = this.baseMode === "apart";
    if (!this.hasPlace) this.place({ x: 0, y: 0, height: 160 });
    this.stepLock(frame, dt, resumed);

    // The modes: the weights move to the one that is wanted (a dance asked this frame counts).
    const goal: PairMode = this.danceAsked
      ? "dance"
      : this.baseMode === "apart"
        ? "carry"
        : this.baseMode;
    const k = resumed ? 1 : 1 - Math.exp(-MODE_RATE * dt);
    this.weight.carry += ((goal === "carry" ? 1 : 0) - this.weight.carry) * k;
    this.weight.dance += ((goal === "dance" ? 1 : 0) - this.weight.dance) * k;
    this.weight.dock += ((goal === "dock" ? 1 : 0) - this.weight.dock) * k;
    this.descentNow +=
      (this.descentAmount - this.descentNow) * (resumed ? 1 : 1 - Math.exp(-4 * dt));
    // What is the pair's own while nothing drives them: the cursor's pull, the docked moments, the
    // drone's float, her fidgets. It is off while a dance drives them and while the scroll does. What
    // the visitor starts (a hover, a press) is off while the scroll runs and back after it (`lockW`).
    const lockW = this.lockW;
    const own = lockW * (1 - this.weight.dance);
    this.cursorOn = own > CURSOR_ON;
    this.applyInteractive();

    // What each producer asks.
    clearCue(this.cueDance);
    clearCue(this.cueLife);
    if (this.weight.dance > 0.002 && this.danceName) {
      danceCue(this.danceName, this.danceT, this.danceEnergy, this.danceBpm, this.cueDance);
    }
    // The moments run on their own clock whatever the lock does (so none is lost), and show as much
    // as `own` lets them: a dance and the scroll fade them out and back, they are never cut.
    this.life.step(dt, this.time, this.cueLife, this.weight.dock + 0.55 * this.weight.carry);
    this.touch.step(dt, this.time, this.touchOut, this.cueTouch);
    blendCue(this.cue, [
      [this.cueDance, this.weight.dance],
      [this.cueLife, own],
      [this.cueTouch, lockW],
    ]);
    if (lockW >= PRESS_MIN) this.fireTouch(this.touchOut);
    else this.pendingTrick = null;
    if (this.pendingTrick) {
      this.pendingLeft -= dt;
      if (this.drone.trickNow(this.pendingTrick, this.pendingDir) || this.pendingLeft <= 0) {
        this.pendingTrick = null;
      }
    }
    this.danceAsked = false;

    this.readCursor();
    const c = this.cue;
    const s = this.smooth;
    const ease = resumed ? 1 : 1 - Math.exp(-8 * dt);
    s.lean += (this.touch.leaning * lockW - s.lean) * ease;
    s.lookUp += (c.droneLooksUp - s.lookUp) * ease;
    s.looksDown += (c.looksDown - s.looksDown) * ease;

    // The drone.
    const drone = this.drone;
    const w = this.want;
    const h = w.height;
    const d = this.descentNow;
    // Both lean toward the cursor while a press is held.
    const toward = this.cursor.near
      ? Math.max(-1, Math.min(1, (this.cursor.x - w.x) / (h * 3)))
      : 0;
    const lean = s.lean * toward;
    drone.carrying = !this.apartNow;
    drone.place({
      x: w.x + (c.dx + 0.07 * lean) * h,
      y: w.y + c.dy * h,
      z: w.z,
      height: h * (1 + c.scale),
      yaw: w.yaw,
      pitch: w.pitch + c.pitch + 0.22 * d,
      roll: w.roll + c.roll - 0.16 * lean,
    });
    drone.spin(c.yaw);
    drone.flutter(Math.max(c.flutter, 0.45 * d));
    drone.layer(this.layerWant);
    this.layerWant = "back";
    // The drone's own float is the pair's life (off in a dance); its answers to the visitor go with the lock.
    drone.gains(own, lockW);
    this.aimDrone(c);
    if (resumed) {
      drone.snapTo({ x: w.x, y: w.y, z: w.z, height: h, pitch: w.pitch, roll: w.roll });
    }
    drone.drive(frame);

    // The seat, from the pose the drone is drawn in this frame, then the doll.
    if (!this.apartNow) this.stepDoll(frame, c, dt, lean);
  }

  /**
   * The scroll lock for this frame (`lock.ts`): from the section's scroll (its speed and the visitor's
   * wheel or touch) and from how still the drone is drawn. A jump (a frame that did not follow the
   * last, a scroll that leapt) closes it with no ramp: nothing is animated across a jump.
   */
  private stepLock(frame: FrameInfo, dt: number, resumed: boolean): void {
    const dr = this.drone.drawn;
    const h = Math.max(1, this.drone.state().height);
    const last = this.lastDraw;
    let inst = 0;
    if (last.ok && !resumed && dt > 0) {
      inst = Math.hypot(dr.x - last.x, dr.y - last.y) / dt / h;
    }
    last.x = dr.x;
    last.y = dr.y;
    last.ok = true;
    // A short low pass, so one odd frame is not a gust.
    this.speed += (inst - this.speed) * (resumed ? 1 : 1 - Math.exp(-12 * dt));
    if (resumed) closeLock(this.lock);
    this.lockW = this.probeNoLock
      ? 1
      : stepLock(this.lock, dt, {
          velocity: frame.velocity,
          wheel: frame.input.wheel,
          droneSpeed: this.speed,
        });
  }

  /** The height she is asked for (the doll draws `DOLL_SIZE` of it). */
  private dollAsked(): number {
    return (this.drone.state().height * DOLL_RATIO) / DOLL_SIZE;
  }

  private stepDoll(frame: FrameInfo, c: PairCue, dt: number, lean: number): void {
    const doll = this.doll;
    const stage = this.ctx.stage;
    const dr = this.drone.drawn;
    const head = this.head;
    // The seat is where the top of the helmet is in the world the drone is drawn in, turned as it is:
    // she is in that scene, so the drone's body can hide her.
    headFrame(dr, head);
    this.seat.quaternion.copy(head.q);
    this.seat.position.set(head.x, head.y, head.z);
    this.seat.scale.setScalar(1);
    this.seat.visible = true;
    this.seat.updateMatrixWorld(true);
    // She is drawn through the drone's lens, which stands in front of the drone.
    doll.setLens(lensDistance(stage.height), dr.x, -dr.y);
    const asked = this.dollAsked();
    const drawn = asked * DOLL_SIZE;

    // Her hands: on the dome by default (the rider's IK holds them), the cue moves them.
    stepHands(this.hands, c, dt, this.time, drawn, head.perMetre, lean);
    this.gripL.position.set(this.hands.l.x, this.hands.l.y, this.hands.l.z);
    this.gripR.position.set(this.hands.r.x, this.hands.r.y, this.hands.r.z);

    if (!this.seated) {
      doll.rideOn(this.seat, {
        gripL: this.gripL,
        gripR: this.gripR,
        seatOffset: this.seatOffset,
        upright: UPRIGHT,
        free: true,
        seed: 5,
      });
      this.seated = true;
    }
    doll.visible = true;
    doll.place({
      x: 0,
      y: 0,
      z: 0,
      height: asked,
      yaw: 0.2 + c.dollYaw + 0.2 * lean,
      pivot: "hips",
    });
    const g = doll.gesture;
    g.roll = c.dollRoll - 0.22 * lean;
    g.nod = c.dollNod;
    g.twist = c.dollTwist;
    g.headTilt = c.headTilt - 0.15 * lean;
    g.headTurn = c.headTurn;
    g.headNod = c.headNod;
    g.legAmp = c.legAmp;
    g.legRate = c.legRate;
    g.knees = c.knees;
    g.slide = c.slide;
    g.handL = this.hands.wl;
    g.handR = this.hands.wr;
    // Her own fidgets go with the same weight as the drone's float.
    g.idle = this.lockW * (1 - this.weight.dance);
    this.aimDoll(c, drawn, g);
    this.setDollFace(c.dollFace ?? "smile", dt);
    doll.drive(frame);
  }

  private setDollFace(want: DollFace, dt: number): void {
    if (want !== this.faceTo) {
      this.faceFrom = this.faceW >= 0.5 ? this.faceTo : this.faceFrom;
      this.faceTo = want;
      this.faceW = 0;
    }
    this.faceW = Math.min(1, this.faceW + dt / FACE_RAMP);
    // A glyph face is held at 0 or 1: the swap behind a blink is the doll's own rule.
    this.doll.setFace(this.faceFrom, this.faceTo, this.faceW >= 1 ? 1 : this.faceW);
  }

  /** The drone's eyes and body: the section's point, her over its head, the cursor, otherwise ahead. */
  private aimDrone(c: PairCue): void {
    const drone = this.drone;
    if (this.lookPoint) {
      drone.look(this.lookPoint);
    } else if (this.smooth.lookUp > 0.4) {
      const s = drone.state();
      drone.look({ x: s.x, y: s.y + s.height * 2.2 });
    } else {
      // The cursor pulls its eyes and body only while the pair are their own (a dance and the scroll
      // let it go over about half a second: the drone's own gaze ease).
      drone.look(this.cursorOn ? "pointer" : null);
    }
    drone.face(c.droneFace ?? "normal", c.droneFace ? 1 : 0);
  }

  /** Where she looks: the section's point, the drone's face, the cursor when it is near, otherwise ahead. */
  private aimDoll(
    c: PairCue,
    drawn: number,
    g: { look: boolean; lookX: number; lookY: number },
  ): void {
    const doll = this.doll;
    void c;
    if (this.lookPoint) {
      g.look = true;
      g.lookX = this.lookPoint.x;
      g.lookY = this.lookPoint.y;
      return;
    }
    const head = this.head;
    if (this.smooth.looksDown > 0.4) {
      // Down at the drone's face.
      modelToStage(
        this.drone.drawn,
        this.head.q,
        FACE_POINT,
        this.ctx.stage.height,
        this.dollPoint,
      );
      g.look = true;
      g.lookX = this.dollPoint.x;
      g.lookY = this.dollPoint.y;
      return;
    }
    if (this.cursor.near && this.cursorOn) {
      g.look = true;
      g.lookX = this.cursor.x;
      g.lookY = this.cursor.y;
      return;
    }
    // Ahead: out at the page, a little up.
    g.look = true;
    g.lookX = head.x + (head.x > 0 ? -1 : 1) * drawn * 3;
    g.lookY = head.y + drawn * 0.5;
    void doll;
  }

  /** The cursor in stage pixels, and whether it is near the pair (a mouse only). */
  private readCursor(): void {
    const p = this.ctx.pointer.state;
    const vp = this.ctx.viewport();
    const cur = this.cursor;
    if (p.type !== "mouse" || !p.inside) {
      cur.near = false;
      return;
    }
    cur.x = p.x - vp.w / 2;
    cur.y = vp.h / 2 - p.y;
    const h = this.want.height;
    cur.near = Math.hypot(cur.x - this.want.x, cur.y - this.want.y) < h * 5;
  }

  /** The one-shots of the touch machine. */
  private fireTouch(t: TouchOut): void {
    if (!t.fired) return;
    const drone = this.drone;
    if (t.droneTrick) {
      this.pendingTrick = t.droneTrick;
      this.pendingDir = t.dir;
      this.pendingLeft = 1.4;
    }
    if (t.droneFace) drone.emote(t.droneFace, t.faceSeconds);
    if (t.shock) drone.shock();
  }

  private letGo(): void {
    if (this.seated) {
      this.doll.release();
      this.seated = false;
    }
    this.apartNow = true;
    this.doll.external = false;
    this.seat.visible = false;
  }

  dispose(): void {
    this.drone.hooks = null;
    this.drone.hitDepth = null;
    this.doll.hooks = null;
    this.drone.external = false;
    this.doll.external = false;
    this.doll.release();
    this.seat.removeFromParent();
  }
}

export { perMetreOf };
