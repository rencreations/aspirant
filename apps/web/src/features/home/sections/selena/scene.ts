import { type Camera, Euler, type Object3D, Quaternion, Vector3 } from "three";

import { DOLL_RATIO, type BuddyPair } from "../../actors/buddies";
import { FILM_DOLL_HEIGHT } from "../../actors/doll/place";
import { STAGE_DEPTH } from "../../actors/drone/coords";
import type { SelenaActor } from "../../actors/selena";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { FrameInfo } from "../../kernel/types";
import { dockPlace } from "../descent/dock";
import { showDragon } from "../list/dragon";
import { selenaEnd } from "../list/selena-frame";
import { mix, seg, smooth } from "../vp";
import { biteFlight } from "./bite";
import { CONTACT, DOLL_MOODS, GIVE, PLACED, dollBeatAt, newDollBeat } from "./doll-beats";
import type { Beats } from "./timeline";

const HOVER = new Vector3(-0.098, 0.706, -0.352);
const STRIKE = new Vector3(-0.14, 0.733, -0.497);
/** The idle she showed in the room gives way to the film over this much of the clip (seconds). */
const IDLE_OUT = 0.35;
/** The drone has flown in front of her right hand, near the lens (clip seconds). */
const ARRIVE = 1.3;
/**
 * It bows as she hops off, waits by her while she lands, then backs away out of the picture (by the
 * left edge) and to its own depth. It leaves only after she has landed, so a hard scroll back up finds it at her hand
 * again before she is handed back (its flight is a spring and lags a fast scroll).
 */
const BOW: readonly [number, number] = [1.3, 1.9];
const LEAVE: readonly [number, number] = [1.85, 2.7];
/** The drone keeps to the film's path from this far into the clip (it flies on springs in the room). */
const HOLD_IN = 0.3;
/** The jaws pull her in over this window, to `CONTACT`. */
const CATCH = 3.62;
/** Her middle stands this many drone heights over the drone's middle while she sits on it. */
const RISE = 0.53;
/** The most the drone is brought toward the lens (it is never nearer than this share of the way). */
const MAX_NEAR = 0.8;

export class SelenaScene {
  sl: SelenaActor | null = null;
  sb: SilverboltActor | null = null;
  pair: BuddyPair | null = null;
  private readonly spot = new Vector3();
  private readonly mouth = new Vector3();
  private readonly projected = new Vector3();
  private readonly offset = new Vector3();
  private readonly seatAt = new Vector3();
  private readonly axis = new Vector3();
  private readonly ray = new Vector3();
  private readonly facing = new Quaternion();
  private readonly grip = new Quaternion();
  private readonly local = new Quaternion();
  private readonly angles = new Euler(0, 0, 0, "ZXY");
  private readonly dock = { x: 0, y: 0, height: 0 };
  private readonly seat = { x: 0, y: 0, height: 0, roll: 0, q: new Quaternion() };
  private readonly turn = new Quaternion();
  private readonly beat = newDollBeat();
  /**
   * The jaws' socket as Silverbolt last drew it, the frame before, and the guess for this frame: the
   * scene runs before he moves, and the doll is handed to the live socket when the jaws close, so the
   * last frames of the catch aim where the socket will be (a bite is fast: one frame behind is a jump).
   */
  private readonly biteNow = new Vector3();
  private readonly biteWas = new Vector3();
  private readonly biteGuess = new Vector3();
  private readonly biteQNow = new Quaternion();
  private readonly biteQWas = new Quaternion();
  private readonly biteQGuess = new Quaternion();
  private biteFrame = -10;
  /** The time of the idle she showed in the room, and the frame time it belonged to. */
  private idleT = 0;
  private idleAt = 0;

  leave(): void {
    if (this.pair?.doll.parentSocket && !this.pair.doll.riding) this.pair.doll.detach();
    this.pair?.doll.reset();
    this.pair?.mode("dock");
    this.pair?.setInteractive(true);
  }

  apply(b: Beats, frame: FrameInfo): void {
    const { sl, sb, pair } = this;
    if (!sl || !b.actors) return;
    const vp = frame.viewport;
    const t = b.clip;
    sl.visible = true;
    sl.place(selenaEnd(vp));
    sl.clipRectangle(null);
    sl.look("pointer");
    const shift = 0.13 * b.drawer;
    // The idle the room shows goes on into the film at the phase it had (the machine's own clock
    // until the film starts, then the frame's), so neither she nor the dragon jumps at the first notch.
    let idleTime = this.idleT + (frame.time - this.idleAt);
    const idleW = mix(1, 0.012, smooth(seg(t, 0, IDLE_OUT)));
    if (t === 0) {
      const shown = sl.clipState();
      if (shown.playing && shown.clip === "city_idle") {
        this.idleT = shown.time;
        this.idleAt = frame.time - frame.dt;
        idleTime = this.idleT + frame.dt;
      }
      sl.drive(1);
      sl.frame(vp, { shift });
    } else {
      // A small moving idle contribution keeps the held pose breathing between inputs.
      sl.blend("city_intercation03", t, "city_idle", idleTime, idleW);
    }
    if (sb) {
      showDragon(sl, sb, this.offset.fromArray(biteFlight.evaluate(t)));
      if (t > 0) {
        // The dragon is part of her picture: the same clips at the same weights as hers.
        sb.clip("city_intercation03", t, {
          root: "keep",
          blend: { name: "city_idle", time: idleTime, weight: idleW },
        });
        sb.straighten(1 - smooth(seg(t, 0, 0.45)));
        sb.gripDoll(smooth(seg(t, 3.66, 3.81)));
      }
    }
    const camera = t > 0 ? sl.exitCamera(t, vp) : null;
    if (!pair) return;
    dockPlace(vp, this.dock);
    pair.mode(t < GIVE ? "dock" : "apart");
    pair.visible = true;
    pair.layer("front");
    pair.setInteractive(b.o === 0);
    pair.capFlight(false);
    const doll = pair.doll;
    if (t < GIVE) {
      // She rides: nothing of the hand is left on her, and the ride pose is under the rider's own.
      doll.reset();
      doll.setPose("ride", "ride", 0);
    }
    if (!camera) {
      pair.place(this.dock);
      return;
    }
    const scale = sl.object.scale.x;
    const hand = sl.socket("rightHand");
    hand.getWorldPosition(this.spot);
    sl.object.worldToLocal(this.spot);
    this.spot.x -= 0.06;
    this.spot.y += 0.27 + 0.012 * Math.sin(frame.time * 3);
    // She hangs in the air when Selena draws her hand back to give the order.
    this.offset.lerpVectors(HOVER, STRIKE, smooth(seg(t, 2.85, CONTACT)));
    this.offset.y += 0.008 * Math.sin(frame.time * 3) * (1 - smooth(seg(t, 3.55, CONTACT)));
    this.spot.lerp(this.offset, smooth(seg(t, 2.55, 2.85)));
    sl.object.localToWorld(this.spot);

    // Where her middle is over the palm on the screen, and how tall she is drawn there: the drone
    // brings her to that size by coming toward the lens (perspective only, nothing is scaled).
    this.projected.copy(this.spot).project(camera);
    const hx = (this.projected.x * vp.w) / 2;
    const hy = (this.projected.y * vp.h) / 2;
    const depth = this.viewDepth(this.spot, camera);
    const focal = (camera.projectionMatrix.elements[5] * vp.h) / 2;
    const worldHeight = FILM_DOLL_HEIGHT * scale;
    const handHeight = (worldHeight * focal) / depth;
    const riding = this.dock.height * DOLL_RATIO;
    const near = 1 / (1 - MAX_NEAR);
    const kHand = Math.min(near, Math.max(1, handHeight / Math.max(1, riding)));
    const approach = smooth(seg(t, 0, ARRIVE));
    const away = smooth(seg(t, LEAVE[0], LEAVE[1]));
    // Once she is off its head it sinks back a little, down, to the right and away from the lens, so
    // it never stands in front of her while it waits.
    const back = smooth(seg(t, GIVE, PLACED + 0.1));
    const k = mix(mix(1, kHand, approach) * (1 - 0.15 * back), 1, away);
    const tall = this.dock.height * kHand;
    // The drone's middle on the screen: under her middle while it carries her, then out by the left
    // edge, the near one, so it never crosses Selena or the dragon coming in from the right.
    let sx = mix(this.dock.x, hx, approach) + back * 0.3 * tall;
    let sy = mix(this.dock.y, hy - RISE * tall, approach) - back * 0.35 * tall;
    sx = mix(sx, -vp.w * 0.72, away);
    sy = mix(sy, hy - RISE * tall - vp.h * 0.22, away);
    pair.place({
      x: sx / k,
      y: sy / k,
      z: STAGE_DEPTH * (1 - 1 / k),
      height: this.dock.height,
      pitch: -0.42 * Math.sin(Math.PI * seg(t, BOW[0], BOW[1])),
    });
    // In the film the drone is the scroll's, like everything in the picture: its springs would leave
    // it behind a fast scroll, and she is handed between it and the palm. It is let go to its own
    // flight at the room's end of the film.
    pair.drone.hold(smooth(seg(t, 0, HOLD_IN)));
    if (t < GIVE) return;

    // Silverbolt from her, on the screen: her eyes go there once she has seen him.
    let toward = 1;
    let up = 0;
    const bite = sb?.socket("bite");
    if (bite) {
      this.guessBite(bite, frame.frame);
      this.mouth.copy(this.biteGuess).project(camera);
      const dx = ((this.mouth.x - this.projected.x) * vp.w) / 2;
      const dy = ((this.mouth.y - this.projected.y) * vp.h) / 2;
      const len = Math.max(1, Math.hypot(dx, dy));
      toward = Math.max(-1, Math.min(1, (1.4 * dx) / len));
      up = Math.max(-1, Math.min(1, dy / len));
    }
    const beat = dollBeatAt(t, frame.time, toward, up, this.beat);

    // The hand over: from the seat as the drone was drawn to the air over her palm. The first frame
    // she is the scene's, she is where the seat had her and as big (the drone came near enough).
    // Her size is the hand's from the first frame: the drone came near enough that the seat's size is
    // the same then (measured within one percent), and it shrinks as the drone sinks back after.
    const give = smooth(seg(t, GIVE, PLACED));
    const height = worldHeight;
    if (give < 1) {
      pair.seatView(this.seat);
      this.unproject(this.seat.x, this.seat.y, depth, camera, vp, this.seatAt);
      this.spot.lerpVectors(this.seatAt, this.spot, give);
    }
    // Her own moves, in the picture's axes and her heights.
    this.axis.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.spot.addScaledVector(this.axis, beat.lift * height);
    this.axis.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.spot.addScaledVector(this.axis, beat.side * height);

    const caught = bite ? smooth(seg(t, CATCH, CONTACT)) : 0;
    const parent = caught === 1 && bite ? bite : sl.object;
    if (parent === bite) {
      this.spot.set(0, 0, 0);
      this.angles.set(0, 0, 0.9);
    } else {
      this.angles.set(0, beat.yaw, beat.roll);
      this.facing.copy(camera.quaternion).multiply(this.local.setFromEuler(this.angles));
      // The hand over starts from her turn on the seat, as the drone's lens saw it. That lens looks
      // straight at the drone; this one sees her off its axis, so the turn is about the ray to her.
      if (give < 1) {
        this.ray.set(0, 0, -1).applyQuaternion(camera.quaternion);
        this.axis.copy(this.seatAt).sub(camera.position).normalize();
        this.turn.setFromUnitVectors(this.ray, this.axis).multiply(camera.quaternion);
        this.turn.multiply(this.seat.q);
        this.facing.slerp(this.turn, 1 - give);
      }
      if (bite && caught > 0) {
        this.spot.lerp(this.biteGuess, caught);
        this.angles.set(0, 0, 0.9);
        this.grip.copy(this.biteQGuess).multiply(this.local.setFromEuler(this.angles));
        this.facing.slerp(this.grip, caught);
      }
      sl.object.worldToLocal(this.spot);
      sl.object.getWorldQuaternion(this.local).invert().multiply(this.facing);
      this.angles.setFromQuaternion(this.local);
    }
    doll.visible = true;
    doll.reset();
    doll.placeInScene(parent, {
      x: this.spot.x,
      y: this.spot.y,
      z: this.spot.z,
      height,
      pitch: this.angles.x,
      yaw: this.angles.y,
      roll: this.angles.z,
      pivot: "center",
    });
    doll.setPose(beat.poseA, beat.poseB, beat.poseW);
    doll.flail(beat.flail, 1.15);
    doll.sprint(beat.sprint, beat.sprintPhase);
    doll.squash(beat.squash);
    doll.talk(beat.talk);
    doll.headTurn(beat.headRoll, beat.headNod, beat.headTurn);
    doll.gaze(beat.gazeX, beat.gazeY);
    doll.mood(DOLL_MOODS, t - GIVE);
  }

  /** Read the jaws' socket and carry its last move one frame on (see `biteGuess`). */
  private guessBite(bite: Object3D, at: number): void {
    bite.getWorldPosition(this.biteNow);
    bite.getWorldQuaternion(this.biteQNow);
    if (at === this.biteFrame + 1) {
      this.biteGuess.copy(this.biteNow).multiplyScalar(2).sub(this.biteWas);
      // The last turn (now times the inverse of before) once more on top of now.
      this.biteQGuess
        .copy(this.biteQWas)
        .invert()
        .premultiply(this.biteQNow)
        .multiply(this.biteQNow);
    } else {
      this.biteGuess.copy(this.biteNow);
      this.biteQGuess.copy(this.biteQNow);
    }
    this.biteWas.copy(this.biteNow);
    this.biteQWas.copy(this.biteQNow);
    this.biteFrame = at;
  }

  /** How far in front of the camera a point of the world is, along its axis. */
  private viewDepth(p: Vector3, camera: Camera): number {
    const e = camera.matrixWorldInverse.elements;
    const z = e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14];
    return Math.max(1e-6, -z);
  }

  /**
   * The point of the world that the camera draws at stage pixel (`x`, `y`) (origin in the middle, y
   * up), `depth` in front of it.
   */
  private unproject(
    x: number,
    y: number,
    depth: number,
    camera: Camera,
    vp: { w: number; h: number },
    out: Vector3,
  ): Vector3 {
    out.set((2 * x) / vp.w, (2 * y) / vp.h, 0.5).unproject(camera);
    out.sub(camera.position);
    const along = this.viewDepth(this.ray.copy(camera.position).add(out), camera);
    return out.multiplyScalar(depth / along).add(camera.position);
  }
}
