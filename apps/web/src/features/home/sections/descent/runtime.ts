import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBuddies, type BuddyPair } from "../../actors/buddies";
import { showBeats } from "../../actors/buddies/choreo";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { whenIdle } from "../idle";
import { clamp01, seg, smooth } from "../vp";

import { dockPlace } from "./dock";
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

class DescentRuntime implements SectionRuntime {
  private pair: BuddyPair | null = null;
  private disposed = false;
  private readonly place: PairPlace = newPairPlace();
  private readonly dock = { x: 0, y: 0, height: 0 };
  private readonly streaks: HTMLElement[];
  private energy = 0.5;
  private clock = 0;

  constructor(ctx: SectionCtx) {
    this.streaks = Array.from(ctx.dom.below.querySelectorAll<HTMLElement>("[data-descent-streak]"));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  setPair(pair: BuddyPair | null): void {
    this.pair = pair;
  }

  enter(): void {
    this.pair?.reset();
  }

  update(local: number, frame: FrameInfo): void {
    const u = local * DESCENT_SCREENS;
    const vp = frame.viewport;
    this.clock += frame.dt;
    this.wind(u, vp.h);

    const pair = this.pair;
    if (!pair) return;
    const place = pairAt(u, vp, this.place);
    // Before the pair are on the page and after the list has taken them over, nothing is set.
    if (!place.visible) return;
    pair.visible = true;
    pair.place(place);
    pair.descent(place.descent);

    if (u >= SETTLE_U) {
      // The last half screen: they come to the dock and live there.
      dockPlace(vp, this.dock);
      pair.mode("dock");
      return;
    }
    // The dance is a function of the scroll (a reverse scroll plays it backwards) and of the visitor's
    // speed, which lifts the energy. The phase is made from beats, so a change of energy (which
    // changes the tempo a little inside `dance`) never jumps it.
    const target = 0.5 + 0.5 * clamp01(Math.abs(frame.velocity) / 1.4);
    this.energy += (target - this.energy) * Math.min(1, frame.dt * 3);
    const tempo = BPM * (0.92 + 0.16 * this.energy);
    const beat = (u - SHOW_FROM_U) * BEATS_PER_SCREEN + this.clock * CLOCK_BEATS;
    pair.dance("show", (beat * 60) / tempo, { energy: this.energy, bpm: BPM });
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
    this.disposed = true;
    this.pair = null;
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
  return runtime;
}
