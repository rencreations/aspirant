/**
 * The doll as a rider (round four, `actor-doll.md` "Round four: riding"). One object owned by the
 * actor. While it is active she sits on a seat socket of another actor and:
 *
 *  - reacts to EVERY movement of the seat: the seat's world motion is measured each frame
 *    (`SeatMotion`) and drives spring chains (`RiderChains`): the trunk's roll and nod, the head's lag,
 *    the legs' swing, her slide on the seat. She never looks put there;
 *  - holds on with her hands: both arms are solved by a two bone IK to the grip sockets
 *    (`arm-ik.ts`) after her body has moved, so the hands stay planted while the trunk and the head
 *    move round them, and the elbows and shoulders flex;
 *  - lives: a seeded behaviour (`idle.ts`) sits, looks round, fidgets, adjusts her seat and grip,
 *    nearly falls and recovers, and strains when the dragon shakes. Her face follows the behaviour
 *    (scared, relieved, determined: the doll's 26 expressions, never a bubble);
 *  - looks at the pointer when it is near, otherwise ahead.
 *
 * Everything runs on the actor's own clock (frame time), never the scroll. Nothing is allocated in
 * a frame. The actor calls: `measure` (start of `update`), `addTurns` (with the other layers),
 * `offset` (in `placeRoot`) and `solveArms` (after `placeRoot`'s matrices).
 */
import { Matrix4, Quaternion, Vector3, type Bone, type Object3D } from "three";

import type { FaceName } from "./face/presets";
import { solveArm, type ArmChain } from "./arm-ik";
import { RideBehaviour, type Cue } from "./idle";
import { Spring, approach, clamp } from "./motion";
import { RiderChains, SeatMotion, type RideBody } from "./ride-physics";
import { BONE, addFlail } from "./pose/layers";
import type { PoseDef } from "./pose/poses";

/** How long the ride layers take to fade out after `release()`, seconds (her own clock). */
const RELEASE_FADE = 0.25;
/** How long the grip takes to go once `loseGrip()` is called, seconds. */
const GRIP_LOSS = 0.12;
/** How long after `loseGrip()` the let go callback fires, seconds. */
const LET_GO_AFTER = 0.15;

/** The seated pose of a rider: thighs forward and a little apart, knees bent, a slight lean, the arms forward (the IK finishes them). */
export const RIDE_POSE: PoseDef = {
  turns: {
    LeftUpLeg: [-82, 0, 14],
    RightUpLeg: [-82, 0, -14],
    LeftLeg: [78, 0, 0],
    RightLeg: [84, 0, 0],
    Spine02: [-6, 0, 0],
    Spine: [-4, 0, 0],
    LeftArm: [-80, 0, 10],
    RightArm: [-80, 0, -10],
    LeftForeArm: [-40, 0, 0],
    RightForeArm: [-40, 0, 0],
  },
};

/** How much of the seat's tilt (the dragon pitching in the screen plane) she holds against, and the lag's spring. */
const UPRIGHT = 0.82;
const UPRIGHT_OMEGA = 7;
const UPRIGHT_ZETA = 0.55;

export interface RideOptions {
  gripL?: Object3D | null;
  gripR?: Object3D | null;
  headPoint?: Object3D | null;
  seed?: number;
  /** Where she sits from the seat socket, in her drawn heights along its axes (the dragon's neck by default). */
  seatOffset?: readonly [number, number, number];
  /** How much of the seat's tilt she holds against (0 leans with it, 1 stays upright). Default `UPRIGHT`. */
  upright?: number;
  /**
   * The ride pose and the hands' hold come in over `RELEASE_FADE` instead of at once: for a doll that
   * was drawn in another pose a frame ago and is handed back to the seat.
   */
  blendIn?: boolean;
  /** A host whose grips are hand targets a controller moves: no walk toward the grips, no spread rule, no slips. */
  free?: boolean;
}

/**
 * What a controller asks of the rider each frame on top of her own life (round six: the pair). The
 * hands are the grip sockets themselves (a controller moves them); these are the rest of the body.
 * Radians unless said. The controller eases them, the rider adds them as they are.
 */
export interface RideGesture {
  /** The weight of each hand on its socket, 0 to 1 (times the grip weight of the behaviour). */
  handL: number;
  handR: number;
  /** The trunk: sideways lean (positive: the top to her left), forward nod, a twist about her vertical. */
  roll: number;
  nod: number;
  twist: number;
  /** The head on top: tilt, turn about the vertical, nod. */
  headTilt: number;
  headTurn: number;
  headNod: number;
  /** The legs swing: amplitude (radians), rate (hertz), the knees lifted 0 to 1. */
  legAmp: number;
  legRate: number;
  knees: number;
  /** A slide off the seat to the side, -1 to 1, with no flail (the pair's nearly slip). */
  slide: number;
  /** Where she looks, in stage pixels, when `look` is true. */
  lookX: number;
  lookY: number;
  look: boolean;
  /**
   * How much of her own life shows, 0 to 1: the behaviour's fidgets, looks round, seat shifts, kicks and
   * trembles (not a lost grip). A controller that drives her entirely (a dance) eases it to 0 and back.
   */
  idle: number;
}

function createGesture(): RideGesture {
  return {
    handL: 1,
    handR: 1,
    roll: 0,
    nod: 0,
    twist: 0,
    headTilt: 0,
    headTurn: 0,
    headNod: 0,
    legAmp: 0,
    legRate: 2,
    knees: 0,
    slide: 0,
    lookX: 0,
    lookY: 0,
    look: false,
    idle: 1,
  };
}

/** What the actor gives the rider. */
export interface RideHost {
  bone(i: number): Bone;
  /** The model's own group: its axes are the doll's (X her left, Y up, Z her front). */
  frame(): Object3D;
  /** The hand bones' base scales this frame (the pose's own), so a stretch can be put on and taken off. */
  armScale(i: number): number;
  /** The doll's head on the screen (stage pixels) and her drawn height, from the last frame. */
  head(): { x: number; y: number; h: number };
  /** The pointer in stage pixels, or null when it is not over the page. */
  pointer(): { x: number; y: number } | null;
}

const _m = new Matrix4();
const _p = new Vector3();
const _d = new Vector3();
const _q = new Quaternion();
const _pole = new Vector3();
const _target = new Vector3();
const _look = { x: 0, y: 0 };
const _grip = new Vector3();
const _grip2 = new Vector3();
const _shoulder = new Vector3();

/** The share of her reach at which the middle of the grips should be from her shoulders, how fast she walks there, and the most she may (in her heights). */
const FIT_REACH = 0.72;
const FIT_RATE = 9;
/** The farthest a hand may be from the middle of the grips, as a share of her reach. */
const SPREAD = 0.5;
const FIT_MAX = 0.35;
/** Where she sits from the seat socket, in her drawn heights along the socket's axes (tuned by eye on the dragon's neck, `ride-physics` notes). */
const SEAT_OFFSET: readonly [number, number, number] = [0.9, 0.65, 0.65];

function addTurn(turns: Float32Array, bone: number, x: number, y: number, z: number): void {
  const k = bone * 3;
  turns[k] = (turns[k] ?? 0) + x;
  turns[k + 1] = (turns[k + 1] ?? 0) + y;
  turns[k + 2] = (turns[k + 2] ?? 0) + z;
}

export class Rider {
  /** True from `start` until the fade after `stop` has run out. */
  get active(): boolean {
    return this.seat !== null || this.fade > 0;
  }
  /** True while she is on the seat (before `stop`). */
  get seated(): boolean {
    return this.seat !== null;
  }
  seat: Object3D | null = null;
  /** 1 while seated, then down to 0 over `RELEASE_FADE` after `stop`. The ride layers, the ride pose and the IK are scaled by it. */
  fade = 0;
  /** How much of the ride pose and the hold has come in since `start` (1 at once without `blendIn`). */
  poseIn = 1;
  readonly body: RideBody;
  /** The behaviour's cue this frame (a probe reads it). */
  get cue(): Cue {
    return this.behaviour.cue;
  }
  /** A look target in stage pixels for the actor's eyes and head. */
  look: { x: number; y: number } | null = null;
  /** The face the ride wants now, or null for none. */
  face: FaceName | null = null;
  /** The ride's own seat offset, in the seat's axes and stage pixels (added to `place`). */
  readonly off = new Vector3();
  /** The turn that keeps her up: about the camera's axis (in the seat's frame), against the seat's tilt. Premultiplied on her root. */
  readonly counter = new Quaternion();
  grip = 1;
  onLetGo: (() => void) | null = null;
  /** A controller's asks (see `RideGesture`): written each frame, read in `measure`, `addTurns` and `solveArms`. */
  readonly gesture: RideGesture = createGesture();
  private seatOffset: readonly [number, number, number] = SEAT_OFFSET;
  private uprightShare = UPRIGHT;
  private free = false;

  /** The walk toward the grips (world px): she sits where her hands can hold (see `fitToGrips`). */
  private readonly fit = new Vector3();
  private readonly motion = new SeatMotion();
  private readonly chains = new RiderChains();
  /** The counter turn's angle: she keeps her head up while the dragon pitches, with a lag. */
  private readonly upright = new Spring(UPRIGHT_OMEGA, UPRIGHT_ZETA);
  private behaviour = new RideBehaviour(1);
  private gripL: Object3D | null = null;
  private gripR: Object3D | null = null;
  /**
   * Where the grips were in her own frame when she left the seat: while the ride fades out the hands
   * ease off from there. The grips themselves stay in the seat's world, which is no longer hers (a
   * section may put her in another scene at once, Selena's film), so reaching for them flung her arms.
   */
  private readonly leftL = new Vector3();
  private readonly leftR = new Vector3();
  private leftOn = false;
  /** Handed back to the seat: the counter turn starts where it would rest, not from upright. */
  private upAtRest = false;
  private headPoint: Object3D | null = null;
  private lost = false;
  private lostAt = 0;
  private fired = false;
  private time = 0;
  private shaken = 0;
  private violence = 0;
  /** Her arm's reach now (world px), measured in `fitToGrips`. */
  private reachNow = 1;
  private readonly chainL: ArmChain;
  private readonly chainR: ArmChain;

  constructor(private readonly host: RideHost) {
    this.chainL = {
      arm: host.bone(BONE.armL),
      fore: host.bone(BONE.foreL),
      hand: host.bone(BONE.handL),
    };
    this.chainR = {
      arm: host.bone(BONE.armR),
      fore: host.bone(BONE.foreR),
      hand: host.bone(BONE.handR),
    };
    this.body = this.chains.body;
  }

  start(seat: Object3D, opts: RideOptions = {}): void {
    this.seat = seat;
    this.gripL = opts.gripL ?? null;
    this.gripR = opts.gripR ?? null;
    this.headPoint = opts.headPoint ?? null;
    this.behaviour = new RideBehaviour(opts.seed ?? 7);
    this.seatOffset = opts.seatOffset ?? SEAT_OFFSET;
    this.uprightShare = opts.upright ?? UPRIGHT;
    this.free = opts.free ?? false;
    this.behaviour.noSlip = this.free;
    Object.assign(this.gesture, createGesture());
    this.motion.reset();
    this.chains.reset();
    this.upright.reset();
    this.counter.identity();
    this.lost = false;
    this.fired = false;
    this.shaken = 0;
    this.violence = 0;
    this.fade = 1;
    this.poseIn = opts.blendIn ? 0 : 1;
    this.upAtRest = opts.blendIn ?? false;
    this.grip = 1;
  }

  /** She leaves the seat: the layers fade out over `RELEASE_FADE`. */
  stop(): void {
    const frame = this.host.frame();
    frame.updateWorldMatrix(true, false);
    _m.copy(frame.matrixWorld).invert();
    this.leftOn = false;
    if (this.gripL && this.gripR) {
      this.gripL.updateWorldMatrix(true, false);
      this.gripR.updateWorldMatrix(true, false);
      this.gripL.getWorldPosition(this.leftL).applyMatrix4(_m);
      this.gripR.getWorldPosition(this.leftR).applyMatrix4(_m);
      this.leftOn = true;
    }
    this.seat = null;
    this.look = null;
    this.face = null;
  }

  loseGrip(): void {
    if (!this.seat || this.lost) return;
    this.lost = true;
    this.lostAt = this.time;
    this.fired = false;
  }

  /** A shove the seat's motion does not show: 0 to 1. */
  shake(strength: number): void {
    this.shaken = Math.max(this.shaken, clamp(strength, 0, 1));
    this.chains.kick(strength * 22, strength * 14);
  }

  /** The state for a probe. */
  state(): { idle: string; grip: number; slip: number; lean: number } {
    return {
      idle: this.behaviour.state,
      grip: this.grip,
      slip: Math.abs(this.cue.slide),
      lean: this.body.roll,
    };
  }

  /** Measure the seat and step the behaviour and the chains. Start of the actor's `update`. */
  measure(dt: number, drawnHeight: number): void {
    this.time += dt;
    if (!this.seat) {
      this.fade = Math.max(0, this.fade - dt / RELEASE_FADE);
      if (this.fade > 0) this.chains.step(dt, this.motion);
      else this.counter.identity();
      return;
    }
    this.poseIn = Math.min(1, this.poseIn + dt / RELEASE_FADE);
    const seat = this.seat;
    seat.updateWorldMatrix(true, false);
    seat.getWorldPosition(_p);
    seat.getWorldQuaternion(_q);
    // The seat's up, as an angle in the screen plane: where its +Y points.
    _d.set(0, 1, 0).applyQuaternion(_q);
    const angle = Math.atan2(-_d.x, _d.y);
    this.holdUp(dt, angle);
    // The motion in stage pixels: x and y of the world are the stage's at z 0 (the depth scale is near 1 here).
    this.motion.update(dt, _p.x, _p.y, angle, drawnHeight);
    // The dragon's shake shows as a violent seat: a hard acceleration for a moment.
    // Ordinary flight never gets there (the acceleration is soft clamped at 28 on each axis); a shake does.
    this.violence = approach(
      this.violence,
      clamp((Math.hypot(this.motion.ax, this.motion.ay) - 28) / 11, 0, 1),
      7,
      dt,
    );
    const violence = this.violence;
    this.shaken = approach(this.shaken, 0, 2.2, dt);
    const shake = Math.max(violence, this.shaken);
    if (!Number.isFinite(shake)) this.motion.reset();
    const cue = this.behaviour.step(dt, { shake, lostGrip: this.lost });
    // A slip tips and slides her; a tremble shakes her.
    const g = this.gesture;
    const k = clamp(g.idle, 0, 1);
    const slide = k * cue.slide + g.slide;
    const roll = 0.55 * slide + 0.03 * k * cue.tremble * Math.sin(this.time * 41) + g.roll;
    this.chains.step(
      dt,
      this.motion,
      roll,
      -0.26 * slide + k * cue.shiftX,
      -0.12 * Math.abs(slide) + k * cue.shiftY,
    );
    // The grip: it eases to the cue (a loss goes in `GRIP_LOSS`). A fidget of the grip shows as much as her life does.
    const gone = cue.name === "gone";
    this.grip = approach(
      this.grip,
      gone ? cue.grip : 1 - (1 - cue.grip) * k,
      gone ? 1 / GRIP_LOSS : 9,
      dt,
    );
    if (this.lost && !this.fired && this.time - this.lostAt >= LET_GO_AFTER) {
      this.fired = true;
      this.onLetGo?.();
    }
    this.face = cue.face;
    this.aim(cue);
  }

  /** The counter turn that keeps her upright on a seat that pitches in the screen plane. */
  private holdUp(dt: number, tilt: number): void {
    if (Number.isFinite(tilt) && this.upAtRest) this.upright.reset(-this.uprightShare * tilt);
    this.upAtRest = false;
    if (Number.isFinite(tilt)) this.upright.step(-this.uprightShare * tilt, dt);
    // The camera's axis, in the seat's frame: the turn is about it.
    _m.copy(this.seat?.matrixWorld ?? _m).invert();
    _d.set(0, 0, 1).transformDirection(_m);
    this.counter.setFromAxisAngle(_d, this.upright.x * this.fade);
  }

  /** Where her head looks: the pointer when it is near, otherwise ahead; a sweep of the behaviour on top. */
  private aim(cue: Cue): void {
    const head = this.host.head();
    const pointer = this.host.pointer();
    const near = head.h * 3.2;
    const out = _look;
    if (this.gesture.look) {
      out.x = this.gesture.lookX;
      out.y = this.gesture.lookY;
    } else if (pointer && Math.hypot(pointer.x - head.x, pointer.y - head.y) < near) {
      out.x = pointer.x;
      out.y = pointer.y;
    } else {
      // Ahead: along the seat's forward (the nose), a little up.
      let fx = -1;
      let fy = 0.35;
      const seat = this.seat;
      if (this.headPoint) {
        this.headPoint.getWorldPosition(_p);
        fx = _p.x - head.x;
        fy = (_p.y - head.y) * 0.45;
      } else if (seat) {
        _d.set(0, 0, 1).transformDirection(seat.matrixWorld);
        fx = _d.x;
        fy = _d.y + 0.2;
      }
      const l = Math.hypot(fx, fy) || 1;
      out.x = head.x + (fx / l) * head.h * 4;
      out.y = head.y + (fy / l) * head.h * 4;
    }
    out.x += cue.sweep * clamp(this.gesture.idle, 0, 1) * head.h * 3;
    this.look = out;
  }

  /** The ride's layers, added to the turns of the frame (model axes, radians). */
  addTurns(turns: Float32Array, time: number): void {
    const f = this.fade;
    if (f <= 0) return;
    const b = this.body;
    const c = this.cue;
    const k = clamp(this.gesture.idle, 0, 1);
    // The trunk: roll in the screen plane (about the model's Z) and a nod (about X, forward is negative).
    const g = this.gesture;
    addTurn(turns, BONE.spine02, -f * (b.nod + g.nod) * 0.5, f * g.twist * 0.5, f * b.roll * 0.55);
    addTurn(turns, BONE.spine, -f * (b.nod + g.nod) * 0.3, f * g.twist * 0.3, f * b.roll * 0.3);
    addTurn(turns, BONE.neck, -f * (b.nod + g.nod) * 0.2, f * g.twist * 0.2, f * b.roll * 0.15);
    // The head lags on top of the trunk, tilts and turns with the behaviour.
    addTurn(
      turns,
      BONE.head,
      -f * (b.headNod + g.headNod + 0.02 * k * c.tremble * Math.sin(time * 37)),
      f * g.headTurn,
      f * (b.headRoll + k * c.tilt + g.headTilt),
    );
    // The legs swing like pendulums (about Z) and flop (about X), a kick bends the knees.
    const swing = f * b.legSwing;
    addTurn(turns, BONE.upLegL, -f * b.legFlop, 0, swing);
    addTurn(turns, BONE.upLegR, -f * b.legFlop, 0, swing);
    const kick = f * k * c.legs * (0.5 + 0.5 * Math.sin(time * 15));
    addTurn(turns, BONE.legL, -0.9 * kick, 0, 0);
    addTurn(
      turns,
      BONE.legR,
      -0.9 * (f * k * c.legs * (0.5 + 0.5 * Math.sin(time * 15 + 2))),
      0,
      0,
    );
    // The legs swing like a child's on a high seat: the shins kick forward and back in turn.
    if (g.legAmp > 0 || g.knees > 0) {
      const w = Math.PI * 2 * g.legRate * time;
      const a = f * g.legAmp;
      addTurn(turns, BONE.legL, -a * (0.5 + 0.5 * Math.sin(w)), 0, 0);
      addTurn(turns, BONE.legR, -a * (0.5 + 0.5 * Math.sin(w + Math.PI)), 0, 0);
      addTurn(turns, BONE.upLegL, -f * g.knees * 0.5 - a * 0.12 * Math.sin(w), 0, 0);
      addTurn(turns, BONE.upLegR, -f * g.knees * 0.5 + a * 0.12 * Math.sin(w), 0, 0);
    }
    // The arms that are free sway, and flail when she slips.
    const free = 1 - this.grip;
    addTurn(turns, BONE.armL, 0, 0, f * free * b.armSway);
    addTurn(turns, BONE.armR, 0, 0, f * free * b.armSway);
    if (c.flail > 0) addFlail(turns, time, f * k * c.flail, 1.3);
  }

  /** The seat offset in the seat's own axes (stage pixels): the chains' slide along the screen's x and y. */
  offset(drawn: number): Vector3 {
    this.off.set(0, 0, 0);
    const seat = this.seat;
    if (!seat || this.fade <= 0) return this.off;
    const b = this.body;
    _m.copy(seat.matrixWorld).invert();
    // Screen right and up, as directions in the seat's frame (the matrix has the seat's scale: normalise).
    _d.set(1, 0, 0).transformDirection(_m);
    this.off.addScaledVector(_d, b.shiftX * drawn * this.fade);
    _d.set(0, 1, 0).transformDirection(_m);
    this.off.addScaledVector(_d, b.shiftY * drawn * this.fade);
    // Her place on the dragon: on the near side of the neck (toward the camera, so the wings do not
    // cover her), above it and a little forward, in the seat's axes (+X the dragon's near side, +Y up, +Z the nose).
    this.off.x += this.seatOffset[0] * drawn * this.fade;
    this.off.y += this.seatOffset[1] * drawn * this.fade;
    this.off.z += this.seatOffset[2] * drawn * this.fade;
    // The walk toward the grips, a world vector turned into the seat's axes (its length kept).
    const len = this.fit.length();
    if (len > 1e-6) {
      _d.copy(this.fit).transformDirection(_m);
      this.off.addScaledVector(_d, len * this.fade);
    }
    return this.off;
  }

  /**
   * She sits where her hands can hold. The arms of a chibi are short (a third of her height) and the
   * dragon's grips can be a head away from its seat, so a seat that is fixed to the dragon leaves the
   * hands in the air. Each frame the rider measures how far the middle of the grips is from the middle
   * of her shoulders (the bones as the last frame left them) and walks her toward them, along the
   * line, until it is `FIT_REACH` of her reach. It never goes past `FIT_MAX` times her height and it
   * eases (a wheel notch must not teleport her). Matrices must be current (last frame's are).
   */
  fitToGrips(dt: number, drawn: number): void {
    const seat = this.seat;
    const a = this.gripL;
    const b = this.gripR;
    if (this.free || !seat || (!a && !b) || !(dt > 0)) {
      if (!seat) this.fit.set(0, 0, 0);
      return;
    }
    const L = this.chainL;
    const R = this.chainR;
    const reach =
      0.5 *
      (L.arm.getWorldPosition(_p).distanceTo(L.fore.getWorldPosition(_d)) +
        L.fore.getWorldPosition(_p).distanceTo(L.hand.getWorldPosition(_d)) +
        R.arm.getWorldPosition(_p).distanceTo(R.fore.getWorldPosition(_d)) +
        R.fore.getWorldPosition(_p).distanceTo(R.hand.getWorldPosition(_d)));
    if (!(reach > 1e-3)) return;
    this.reachNow = reach;
    // The middle of the grips and of the shoulders, in world space.
    if (a) a.getWorldPosition(_grip);
    if (b) b.getWorldPosition(a ? _grip2 : _grip);
    if (a && b) _grip.add(_grip2).multiplyScalar(0.5);
    L.arm.getWorldPosition(_shoulder);
    R.arm.getWorldPosition(_grip2);
    _shoulder.add(_grip2).multiplyScalar(0.5);
    _grip.sub(_shoulder);
    // Along the screen only: she never walks into the dragon (the grips are on its far and near sides).
    _grip.z = 0;
    const d = _grip.length();
    const want = FIT_REACH * reach;
    if (d > want) _grip.multiplyScalar(1 - want / d);
    else _grip.set(0, 0, 0);
    // Residual walk, integrated: the shoulders already contain the walk made so far.
    this.fit.addScaledVector(_grip, 1 - Math.exp(-FIT_RATE * dt));
    const max = FIT_MAX * drawn;
    const n = this.fit.length();
    if (n > max) this.fit.multiplyScalar(max / n);
  }

  /** Hold the grips: bring each hand to its socket by the grip weight. Matrices must be current. */
  solveArms(): void {
    const w = this.grip * this.fade * this.poseIn;
    if (w <= 0.001) return;
    const g = this.gesture;
    if (!this.seat) {
      // Off the seat: the hands ease off from where they held, in her own frame.
      if (!this.leftOn) return;
      const frame = this.host.frame();
      frame.updateWorldMatrix(true, false);
      this.hold(
        this.chainL,
        null,
        w * g.handL,
        1,
        _grip.copy(this.leftL).applyMatrix4(frame.matrixWorld),
      );
      this.hold(
        this.chainR,
        null,
        w * g.handR,
        -1,
        _grip2.copy(this.leftR).applyMatrix4(frame.matrixWorld),
      );
      return;
    }
    this.hold(this.chainL, this.gripL, w * g.handL, 1);
    this.hold(this.chainR, this.gripR, w * g.handR, -1);
  }

  private hold(
    chain: ArmChain,
    grip: Object3D | null,
    w: number,
    side: 1 | -1,
    at: Vector3 | null = null,
  ): void {
    if (w <= 0.001) return;
    if (at) {
      _target.copy(at);
    } else {
      if (!grip) return;
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(_target);
    }
    // Hands wider apart than her arms can spread are brought toward the middle of the grips.
    if (!at && !this.free && this.gripL && this.gripR) {
      this.gripL.getWorldPosition(_grip);
      this.gripR.getWorldPosition(_grip2);
      _grip.add(_grip2).multiplyScalar(0.5);
      const spread = _target.distanceTo(_grip);
      const limit = SPREAD * this.reachNow;
      if (spread > limit && spread > 1e-6) _target.lerpVectors(_grip, _target, limit / spread);
    }
    // The elbow bends out and down and a little back, in the doll's own frame: a rider's elbows hang.
    _pole.set(0.7 * side, -1, -0.35).normalize();
    this.host.frame().getWorldQuaternion(_q);
    _pole.applyQuaternion(_q);
    solveArm(
      chain,
      _target,
      w,
      _pole,
      1.45,
      this.host.armScale(chain.arm === this.chainL.arm ? BONE.armL : BONE.armR),
      this.host.armScale(chain.arm === this.chainL.arm ? BONE.handL : BONE.handR),
    );
  }
}
