import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBuddies, type BuddyPair } from "../../actors/buddies";
import type { DuoActor } from "../../actors/duo";
import { showBeats } from "../../actors/buddies/choreo";
import { dampTo, setDamped, type Damped } from "../../actors/buddies/smooth";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { whenIdle } from "../idle";
import { clamp01, seg, smooth } from "../vp";

import { dockPlace } from "./dock";
import {
  danceClock,
  GUEST_DANCE_FROM,
  guestPlace,
  guestsAt,
  newGuestState,
  type GuestPlace,
} from "./guests";
import { newPairPlace, pairAt, type PairPlace } from "./route";
import { DESCENT_SCREENS, LIST_RISE_AT_U } from "./stations";
import { STREAKS } from "./streaks";

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/** The show starts a little after the pair are in and ends where the dock life takes over. */
const SHOW_FROM_U = -0.35;
const SHOW_TO_U = 4.55;
/** From here the pair stop dancing and settle into the dock's own life (it blends over half a second). */
const SETTLE_U = DESCENT_SCREENS - 0.45;
/** The tempo of the show, beats a minute. The beat is made from the scroll, so the speed is the visitor's. */
const BPM = 100;
/** Beats of the show that pass for each screen of scroll. */
const BEATS_PER_SCREEN = showBeats() / (SHOW_TO_U - SHOW_FROM_U);
/** A little of the dance runs on the clock, in beats a second, so a standing visitor still sees them move. */
const CLOCK_BEATS = 0.35;
/**
 * The dance's phase follows the scroll's beat on a critically damped follower with a limit on its speed
 * (round nine): a flick of the wheel cannot make the show run at the frame rate. The routines are
 * made to be read at about 100 beats a minute; at the limit they run at 2.7 times that and no more.
 * A jump of more than `JUMP_SCREENS` in a frame (a seek, a drag of the scrollbar) puts it on the
 * target at once: the springs of the drone smooth what that leaves.
 */
const BEAT_TIME = 0.3;
const BEAT_MAX = 4.5;
const JUMP_SCREENS = 1.2;
/**
 * The guests' progress follows the descent's with a limit (0.2 of the descent a second, a screen a
 * second), so a flick cannot make them zip in and out. Two guards keep that from stranding them: they
 * are forced out before the pair dock and before the descent's start, whatever the lag.
 */
const GUEST_TIME = 0.25;
const GUEST_MAX = 0.2;
/** The duo's beat is half a second: one of the pair's beats is one of theirs. */
const GUEST_BEAT_SECONDS = 0.5;
/** The beat at which the guests' dance begins, on the show's scale. */
const BEAT_AT_GUEST_DANCE = (GUEST_DANCE_FROM * DESCENT_SCREENS - SHOW_FROM_U) * BEATS_PER_SCREEN;

/** The least progress the guests may show when the scroll is at `p` (a lagging follower is pulled on). */
const forcedHigh = (p: number): number => 0.86 * seg(p, 0.5, 0.86);
/** The most progress they may show: before the start they are hidden even if the follower still lags. */
const forcedLow = (p: number): number => 0.19 + 0.81 * seg(p, 0.07, 0.17);

class DescentRuntime implements SectionRuntime {
  private pair: BuddyPair | null = null;
  private disposed = false;
  private readonly place: PairPlace = newPairPlace();
  private readonly dock = { x: 0, y: 0, height: 0 };
  private readonly streaks: HTMLElement[];
  private energy = 0.5;
  private clock = 0;
  private readonly beatNow: Damped = { x: 0, v: 0 };
  private lastU = Number.NaN;
  private duo: DuoActor | null = null;
  private readonly guestP: Damped = { x: 0, v: 0 };
  private readonly guest = newGuestState();
  private readonly guestA: GuestPlace = { x: 0, y: 0, height: 0 };
  private readonly guestB: GuestPlace = { x: 0, y: 0, height: 0 };
  private readonly look = { x: 0, y: 0 };
  private guestsOn = false;
  private vpW = 1440;

  constructor(ctx: SectionCtx) {
    this.streaks = Array.from(ctx.dom.below.querySelectorAll<HTMLElement>("[data-descent-streak]"));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  setPair(pair: BuddyPair | null): void {
    this.pair = pair;
  }

  setDuo(duo: DuoActor | null): void {
    this.duo = duo;
  }

  enter(): void {
    this.pair?.reset();
    this.lastU = Number.NaN;
  }

  leave(): void {
    this.releaseGuests();
  }

  update(local: number, frame: FrameInfo): void {
    const u = local * DESCENT_SCREENS;
    const vp = frame.viewport;
    this.clock += frame.dt;
    this.wind(u, vp.h);

    const pair = this.pair;
    if (!pair) return;
    this.vpW = vp.w;
    const place = pairAt(u, vp, this.place);
    // Before the pair are on the page and after the list has taken them over, nothing is set.
    if (!place.visible) return;
    pair.visible = true;
    pair.place(place);
    pair.descent(place.descent);
    const dt = Math.min(frame.dt, 0.05);
    const jumped = !Number.isFinite(this.lastU) || Math.abs(u - this.lastU) > JUMP_SCREENS;

    if (u >= SETTLE_U) {
      // The last half screen: they come to the dock and live there.
      dockPlace(vp, this.dock);
      pair.mode("dock");
      this.releaseGuests();
      pair.look(null);
      this.lastU = u;
      return;
    }
    // The dance is a function of the scroll (a reverse scroll plays it backwards), seen through a
    // follower that cannot run faster than the routines can be read. The phase is made from beats, so a
    // change of energy (which changes the tempo a little inside `dance`) never jumps it. The energy
    // follows how fast the dance runs, so a quick scroll is a livelier dance and never a jerk.
    const wanted = (u - SHOW_FROM_U) * BEATS_PER_SCREEN + this.clock * CLOCK_BEATS;
    if (jumped) setDamped(this.beatNow, wanted);
    else dampTo(this.beatNow, wanted, BEAT_TIME, BEAT_MAX, dt);
    this.lastU = u;
    const target = 0.5 + 0.5 * clamp01(Math.abs(this.beatNow.v) / BEAT_MAX);
    this.energy += (target - this.energy) * Math.min(1, dt * 3);
    const tempo = BPM * (0.92 + 0.16 * this.energy);
    pair.dance("show", (this.beatNow.x * 60) / tempo, { energy: this.energy, bpm: BPM });
    this.guests(u / DESCENT_SCREENS, jumped, dt, pair);
  }

  /**
   * The two Guinevere drones (`guests.ts`): they fly in from the edges at 20 percent of the descent, greet
   * the pair, dance with them on the pair's beat, and fly out before the pair dock. A function of the
   * descent's progress through a limited follower, so a quick scroll never makes them jump.
   */
  private guests(p: number, jumped: boolean, dt: number, pair: BuddyPair): void {
    const duo = this.duo;
    if (!duo) return;
    if (jumped) setDamped(this.guestP, p);
    else dampTo(this.guestP, p, GUEST_TIME, GUEST_MAX, dt);
    // The follower may lag the scroll: it never strands them on the screen.
    const shownP = Math.min(Math.max(this.guestP.x, forcedHigh(p)), forcedLow(p));
    const g = guestsAt(shownP, this.guest);
    if (!g.shown) {
      this.releaseGuests();
      pair.look(null);
      return;
    }
    if (!this.guestsOn) {
      this.guestsOn = true;
      duo.ambient(false);
      duo.restart();
    }
    duo.visible = true;
    duo.locked = true;
    const place = this.place;
    const lift = g.pose === "bow" ? g.w / 0.6 : 0;
    const a = guestPlace(-1, place.x, place.y, place.height, this.vpW, lift, this.guestA);
    const b = guestPlace(1, place.x, place.y, place.height, this.vpW, lift, this.guestB);
    duo.place(a, b);
    duo.pose(g.pose, g.w);
    const tau = (this.beatNow.x - BEAT_AT_GUEST_DANCE) * GUEST_BEAT_SECONDS;
    duo.poseClock = danceClock(tau);
    if (g.attention > 0.01) {
      const k = 0.5 + 0.5 * g.gaze;
      this.look.x = a.x + (b.x - a.x) * k;
      this.look.y = a.y + (b.y - a.y) * k;
      pair.look(this.look);
    } else {
      pair.look(null);
    }
  }

  /** The guests are not asked for this frame: the duo goes back to the sections that use it. */
  private releaseGuests(): void {
    if (!this.guestsOn) return;
    this.guestsOn = false;
    const duo = this.duo;
    if (!duo) return;
    duo.locked = false;
    duo.poseClock = null;
    duo.ambient(true);
  }

  /**
   * The wind: streaks and dots that rush up the screen faster than the page scrolls, so the pair look
   * like they are flying down. A function of `u`; transform and opacity only.
   */
  private wind(u: number, h: number): void {
    const into = smooth(seg(u, -0.3, 0.5));
    const out = 1 - smooth(seg(u, LIST_RISE_AT_U, DESCENT_SCREENS - 0.3));
    const env = into * out;
    const list = this.streaks;
    for (let i = 0; i < list.length; i += 1) {
      const el = list[i];
      const s = STREAKS[i];
      if (!el || !s) continue;
      const cycle = h + s.size;
      const raw = (s.phase * cycle + u * s.speed * h) % cycle;
      const at = raw < 0 ? raw + cycle : raw;
      const y = h - at;
      const edge = Math.sin((Math.PI * at) / cycle);
      put(el, "transform", `translate3d(0, ${f(y)}px, 0)`);
      put(el, "opacity", f(s.alpha * env * Math.min(1, edge * 2.2)));
    }
  }

  dispose(): void {
    this.releaseGuests();
    this.disposed = true;
    this.pair = null;
    this.duo = null;
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  const runtime = new DescentRuntime(ctx);
  // The pair are the biggest files of this part of the page: the section is built without them and
  // they join when ready, in a pause of the scroll (the build is a long task of a few hundred ms).
  whenIdle(() => {
    if (runtime.isDisposed) return;
    void ensureBuddies(ctx).then(
      (pair) => {
        if (!runtime.isDisposed) runtime.setPair(pair);
      },
      () => runtime.setPair(null),
    );
  }, 3000);
  // The two guests are small (a model of 241 KB shared with /about): built after the pair, in a pause.
  whenIdle(() => {
    if (runtime.isDisposed) return;
    void import("../../actors/duo")
      .then((m) => m.ensureDuo(ctx))
      .then(
        (duo) => {
          if (!runtime.isDisposed) runtime.setDuo(duo);
        },
        () => runtime.setDuo(null),
      );
  }, 3500);
  return runtime;
}
