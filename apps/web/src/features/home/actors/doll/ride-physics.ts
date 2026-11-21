/**
 * The physics of a rider, pure (numbers only, nothing allocated per step). Two parts:
 *
 *  - `SeatMotion` measures how the seat moves from where it is each frame: a velocity and an
 *    acceleration of its position and a turning rate of its angle, all in HER heights (so a big
 *    doll and a small one answer the same), low passed hard and clamped, because the scroll drives
 *    the dragon and a wheel notch is a spike.
 *  - `RiderChains` are spring-damper chains driven by that motion: the trunk's roll and nod, the
 *    head's extra lag, the legs' swing, the free arm's sway and her seat's slide. Each one is a
 *    damped spring on its own clock (`Spring` is exact for any `dt`), so a stopped frame changes
 *    nothing and a long frame is stable.
 *
 * Signs (the screen: x right, y up). The dragon accelerates to the right: she is left behind, so the
 * top of her trunk leans to the left (a positive roll) and her legs swing to the left too. The dragon
 * accelerates up: her trunk sinks (a squash) and her head nods down.
 */
import { Spring, approach, clamp } from "./motion";

/** The most the smoothed acceleration may be, in her heights a second squared. */
const ACC_MAX = 28;
/** The most the smoothed turning rate may be, radians a second. */
const TURN_MAX = 7;
/** How fast the raw velocity and acceleration are smoothed (1 over the time constant, per second). */
const VEL_RATE = 22;
const ACC_RATE = 12;
/** The part of the acceleration that is ordinary flight (the dragon's own bob): it makes no lean. */
const ACC_DEAD = 6;

/** The acceleration with the dead zone taken off (the sign kept). */
function liveAcc(a: number): number {
  const m = Math.abs(a) - ACC_DEAD;
  return m > 0 ? Math.sign(a) * m : 0;
}

/** A soft clamp: linear near 0, never beyond `limit`. */
function softClamp(x: number, limit: number): number {
  return limit * Math.tanh(x / limit);
}

export class SeatMotion {
  /** Velocity (her heights a second), acceleration (heights a second squared) and turning rate (rad a second). */
  vx = 0;
  vy = 0;
  ax = 0;
  ay = 0;
  turn = 0;
  private px = 0;
  private py = 0;
  private angle = 0;
  private have = false;
  private svx = 0;
  private svy = 0;

  reset(): void {
    this.vx = this.vy = this.ax = this.ay = this.turn = 0;
    this.svx = this.svy = 0;
    this.have = false;
  }

  /**
   * One frame: the seat is at (`x`, `y`) in stage pixels with its up turned by `angle` radians, and
   * she is `height` px tall. A `dt` of 0 changes nothing. A step of more than `jump` heights is a
   * jump of the target (the scrollbar was dragged): it measures nothing.
   */
  update(dt: number, x: number, y: number, angle: number, height: number, jump = 1.6): void {
    if (!(dt > 0)) return;
    // A seat that is not placed yet (a hidden actor, a zero scale) says nothing.
    if (!Number.isFinite(x + y + angle + height)) return;
    const h = Math.max(1, height);
    if (!this.have) {
      this.px = x;
      this.py = y;
      this.angle = angle;
      this.have = true;
      return;
    }
    const dx = (x - this.px) / h;
    const dy = (y - this.py) / h;
    let da = angle - this.angle;
    // The angle wraps: the shortest way.
    da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
    this.px = x;
    this.py = y;
    this.angle = angle;
    if (Math.hypot(dx, dy) > jump) {
      this.vx = this.vy = this.ax = this.ay = this.turn = 0;
      this.svx = this.svy = 0;
      return;
    }
    const rvx = dx / dt;
    const rvy = dy / dt;
    const rturn = da / dt;
    const prevVx = this.vx;
    const prevVy = this.vy;
    this.vx = approach(this.vx, rvx, VEL_RATE, dt);
    this.vy = approach(this.vy, rvy, VEL_RATE, dt);
    this.turn = softClamp(approach(this.turn, rturn, VEL_RATE, dt), TURN_MAX);
    this.svx = (this.vx - prevVx) / dt;
    this.svy = (this.vy - prevVy) / dt;
    this.ax = softClamp(approach(this.ax, this.svx, ACC_RATE, dt), ACC_MAX);
    this.ay = softClamp(approach(this.ay, this.svy, ACC_RATE, dt), ACC_MAX);
  }
}

/** The body the chains give, in radians (and heights for the shifts). Read after `step`. */
export interface RideBody {
  /** The trunk's roll in the screen plane (positive: the top to her left) and its nod (positive: forward). */
  roll: number;
  nod: number;
  /** The head's own extra lag on top of the trunk's. */
  headRoll: number;
  headNod: number;
  /** The legs: a swing sideways (positive: to her left) and a flop up and down (positive: forward and up). */
  legSwing: number;
  legFlop: number;
  /** The free arm's sway. */
  armSway: number;
  /** The seat's slide, in her heights: x to the right, y up. */
  shiftX: number;
  shiftY: number;
  /** A squash and stretch of her trunk, -0.1 to 0.1. */
  squash: number;
}

/** What each chain is driven by, as the gain from the measured motion and the spring's numbers (omega, zeta). */
const CHAIN = {
  roll: { omega: 8.5, zeta: 0.34, gainAcc: 0.013, gainTurn: -0.03, limit: 0.62 },
  nod: { omega: 8, zeta: 0.36, gainAcc: 0.008, limit: 0.3 },
  headRoll: { omega: 13, zeta: 0.28, gainAcc: 0.009, limit: 0.42 },
  headNod: { omega: 13, zeta: 0.3, gainAcc: 0.009, limit: 0.3 },
  legSwing: { omega: 6.5, zeta: 0.22, gainAcc: 0.02, limit: 0.7 },
  legFlop: { omega: 6.5, zeta: 0.26, gainAcc: 0.016, limit: 0.6 },
  armSway: { omega: 7, zeta: 0.3, gainAcc: 0.02, limit: 0.7 },
  shiftX: { omega: 9, zeta: 0.55, gainAcc: 0.0018, limit: 0.07 },
  shiftY: { omega: 11, zeta: 0.4, gainAcc: 0.0012, limit: 0.05 },
  squash: { omega: 14, zeta: 0.4, gainAcc: 0.0016, limit: 0.1 },
} as const;

export class RiderChains {
  readonly body: RideBody = {
    roll: 0,
    nod: 0,
    headRoll: 0,
    headNod: 0,
    legSwing: 0,
    legFlop: 0,
    armSway: 0,
    shiftX: 0,
    shiftY: 0,
    squash: 0,
  };
  private readonly roll = new Spring(CHAIN.roll.omega, CHAIN.roll.zeta);
  private readonly nod = new Spring(CHAIN.nod.omega, CHAIN.nod.zeta);
  private readonly headRoll = new Spring(CHAIN.headRoll.omega, CHAIN.headRoll.zeta);
  private readonly headNod = new Spring(CHAIN.headNod.omega, CHAIN.headNod.zeta);
  private readonly legSwing = new Spring(CHAIN.legSwing.omega, CHAIN.legSwing.zeta);
  private readonly legFlop = new Spring(CHAIN.legFlop.omega, CHAIN.legFlop.zeta);
  private readonly armSway = new Spring(CHAIN.armSway.omega, CHAIN.armSway.zeta);
  private readonly shiftX = new Spring(CHAIN.shiftX.omega, CHAIN.shiftX.zeta);
  private readonly shiftY = new Spring(CHAIN.shiftY.omega, CHAIN.shiftY.zeta);
  private readonly squash = new Spring(CHAIN.squash.omega, CHAIN.squash.zeta);

  reset(): void {
    for (const s of [
      this.roll,
      this.nod,
      this.headRoll,
      this.headNod,
      this.legSwing,
      this.legFlop,
      this.armSway,
      this.shiftX,
      this.shiftY,
      this.squash,
    ])
      s.reset();
    this.read();
  }

  /** A shove from outside (the sneeze, a bump of the seat): heights a second squared along x and y. */
  kick(ax: number, ay: number): void {
    this.roll.kick(ax * 0.05);
    this.headRoll.kick(ax * 0.07);
    this.legSwing.kick(ax * 0.09);
    this.nod.kick(-ay * 0.03);
    this.legFlop.kick(ay * 0.06);
  }

  /**
   * One step. `m` is the seat's measured motion; `extra` adds a lean the behaviour asks for (a slip's
   * tip, a trembling shiver) to the trunk's roll target.
   */
  step(dt: number, m: SeatMotion, extraRoll = 0, extraShiftX = 0, extraShiftY = 0): RideBody {
    if (!(dt > 0)) return this.body;
    const c = CHAIN;
    const ax = liveAcc(m.ax);
    const ay = liveAcc(m.ay);
    this.roll.step(
      clamp(
        c.roll.gainAcc * ax + c.roll.gainTurn * m.turn + extraRoll,
        -c.roll.limit,
        c.roll.limit,
      ),
      dt,
    );
    this.nod.step(clamp(-c.nod.gainAcc * ay, -c.nod.limit, c.nod.limit), dt);
    this.headRoll.step(clamp(c.headRoll.gainAcc * ax, -c.headRoll.limit, c.headRoll.limit), dt);
    this.headNod.step(clamp(-c.headNod.gainAcc * ay, -c.headNod.limit, c.headNod.limit), dt);
    this.legSwing.step(clamp(-c.legSwing.gainAcc * ax, -c.legSwing.limit, c.legSwing.limit), dt);
    this.legFlop.step(clamp(c.legFlop.gainAcc * ay, -c.legFlop.limit, c.legFlop.limit), dt);
    this.armSway.step(clamp(-c.armSway.gainAcc * ax, -c.armSway.limit, c.armSway.limit), dt);
    this.shiftX.step(
      clamp(-c.shiftX.gainAcc * ax, -c.shiftX.limit, c.shiftX.limit) + extraShiftX,
      dt,
    );
    this.shiftY.step(
      clamp(-c.shiftY.gainAcc * ay, -c.shiftY.limit, c.shiftY.limit) + extraShiftY,
      dt,
    );
    this.squash.step(clamp(c.squash.gainAcc * ay, -c.squash.limit, c.squash.limit), dt);
    return this.read();
  }

  private read(): RideBody {
    const b = this.body;
    b.roll = this.roll.x;
    b.nod = this.nod.x;
    b.headRoll = this.headRoll.x;
    b.headNod = this.headNod.x;
    b.legSwing = this.legSwing.x;
    b.legFlop = this.legFlop.x;
    b.armSway = this.armSway.x;
    b.shiftX = this.shiftX.x;
    b.shiftY = this.shiftY.x;
    b.squash = this.squash.x;
    return b;
  }
}
