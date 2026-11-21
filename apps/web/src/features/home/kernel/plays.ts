/**
 * Plays: a scene that is triggered by the scroll and then runs on a clock. Pure: no DOM, no three.
 *
 * A section keeps `update(local)` as a pure function of one number. A section with plays gets a
 * virtual `local` (`v`) in place of the scroll's: `v` rests on a station, and when the visitor
 * crosses a threshold (`at`, a fraction of the section's own range) `v` runs to the next station on
 * a clock while the scroll is held. Crossing back up runs it the other way, shorter. Everything the
 * runner needs is in `PlayMachine`; `docs/design/home/kernel-plays.md` says how to use it.
 *
 * Units. `at` and the scroll `s` are in `local` units (0 at the start of the section, 1 at its end,
 * a little outside in its lead and tail). `from` and `to` are values of the `local` that `update`
 * gets. Time is in seconds, the clock's `dt`; the safety limit is in wall-clock milliseconds.
 */

export type PlayEase = "inOut" | "out" | "inOutSoft" | "linear";

export interface HomePlay {
  /** Where the play fires: a fraction (0 to 1) of the section's own range. Down fires it forward. */
  readonly at: number;
  /** The value of `local` before the play. The first play's is the value at the start of the section. */
  readonly from: number;
  /** The value of `local` after the play. The last play's is the value at the end of the section. */
  readonly to: number;
  /** How long the play runs going forward, in seconds. */
  readonly seconds: number;
  /** The curve, applied toward the target both ways. Default `inOut`. */
  readonly ease?: PlayEase;
  /** The share of `seconds` that the play takes when it runs backward. Default `PLAY_BACK`. */
  readonly back?: number;
  /**
   * With a span the play is a ZONE (`kernel/scrub.ts`, `kernel-scrub.md`): it has no clock and holds
   * nothing. While the scroll is inside `[at, at + span]` (fractions of the section) the value is
   * `from + (to - from) * ease(p)`, `p` being how far through the zone the scroll is, up or down. The
   * curve defaults to `linear`. `seconds` is then the length of the idle snap for a full traverse.
   */
  readonly span?: number;
  /**
   * A zone only: the page does not finish it by itself when the visitor stops inside it (no idle snap,
   * and no joint snap while the page is inside it either). It is a plain scroll linked passage: the
   * scene follows the scroll up and down and the page stays where the visitor leaves it (round five).
   */
  readonly noSnap?: boolean;
}

/** The share of a play's length that its backward run takes when the play does not say. */
export const PLAY_BACK = 0.7;
/** The wall-clock slack added to a play's length for the hold's safety limit. */
export const HOLD_SLACK_MS = 1500;
/** The longest play the table accepts (the owner asked for short scenes). */
export const MAX_PLAY_SECONDS = 10;
/** A table of values closer than this counts as equal. */
const SAME = 1e-9;
/** The least gap (screens) between a zone's end and a clock play after it (a dev warning, not an error). */
const ZONE_CLOCK_GAP = 0.15;

/** The hysteresis below a threshold, in `local` units: 0.04 of the section or 0.12 screens. */
export function hystOf(screens: number): number {
  return Math.max(0.04, 0.12 / Math.max(screens, 1e-6));
}

export function easeValue(ease: PlayEase, t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  switch (ease) {
    case "linear":
      return x;
    case "out":
      return 1 - Math.pow(1 - x, 3);
    case "inOutSoft":
      return 0.5 - 0.5 * Math.cos(Math.PI * x);
    case "inOut":
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

/** A play with a span is a scroll zone (no clock, no hold). */
export function isZone(p: HomePlay): boolean {
  return p.span !== undefined;
}

/** How far through a zone the section's scroll `s` is: 0 before it, 1 after it. A clock play is 0 or 1 at `at`. */
export function zoneProgress(p: HomePlay, s: number): number {
  const span = p.span ?? 0;
  if (!(span > 0)) return s >= p.at ? 1 : 0;
  const x = (s - p.at) / span;
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

/** The value a zone gives at the section's scroll `s`: `from` before it, `to` after it, the curve between. */
export function zoneValue(p: HomePlay, s: number): number {
  const k = easeValue(p.ease ?? "linear", zoneProgress(p, s));
  return p.from + (p.to - p.from) * k;
}

/**
 * Check a table of plays. Throws an error that names the section and the play, so a bad table fails
 * at startup (`layoutSections`) and not in the middle of a scroll.
 */
export function validatePlays(id: string, plays: readonly HomePlay[]): void {
  const fail = (index: number, why: string): never => {
    throw new Error(`section ${id}: plays[${index}] ${why}`);
  };
  if (plays.length === 0) throw new Error(`section ${id}: plays is empty (leave it out instead)`);
  plays.forEach((p, i) => {
    for (const key of ["at", "from", "to", "seconds"] as const) {
      if (!Number.isFinite(p[key])) fail(i, `${key} is not a finite number (${String(p[key])})`);
    }
    if (p.at < 0 || p.at > 1) fail(i, `at ${p.at} is outside 0 to 1 (a fraction of the section)`);
    if (!(p.seconds > 0)) fail(i, `seconds ${p.seconds} must be above 0`);
    if (p.seconds > MAX_PLAY_SECONDS) {
      fail(i, `seconds ${p.seconds} is over ${MAX_PLAY_SECONDS} (the scroll is held that long)`);
    }
    if (p.back !== undefined && !(p.back > 0 && p.back <= 2)) {
      fail(i, `back ${p.back} must be above 0 and at most 2 (a share of seconds)`);
    }
    if (Math.abs(p.to - p.from) < SAME)
      fail(i, `from ${p.from} equals to ${p.to}: nothing to play`);
    if (p.noSnap !== undefined && p.span === undefined) {
      fail(i, "noSnap is for a zone (a play with a span): a clock play holds the page by design");
    }
    if (p.span !== undefined) {
      if (!Number.isFinite(p.span) || !(p.span > 0)) {
        fail(i, `span ${String(p.span)} must be above 0 (a fraction of the section)`);
      }
      if (p.at + p.span > 1 + SAME) {
        fail(
          i,
          `a zone ends at ${p.at + p.span}, past the section's end 1 (at ${p.at} + span ${p.span}): the tail is for the scroll's passthrough`,
        );
      }
    }
    const prev = plays[i - 1];
    if (prev) {
      if (!(p.at > prev.at)) {
        fail(i, `at ${p.at} must be above the previous at ${prev.at} (the list is ordered by at)`);
      }
      if (prev.span !== undefined && p.at < prev.at + prev.span - SAME) {
        fail(
          i,
          `at ${p.at} is inside the previous zone (${prev.at} to ${prev.at + prev.span}): zones and plays do not overlap in position`,
        );
      }
      if (Math.abs(p.from - prev.to) > SAME) {
        fail(
          i,
          `from ${p.from} must equal the previous play's to ${prev.to} (the list is contiguous)`,
        );
      }
    }
  });
}

/** How many plays have their threshold at or before `s`: the resting station for a position. */
export function restingIndexAt(plays: readonly HomePlay[], s: number): number {
  let n = 0;
  for (const p of plays) {
    if (p.at <= s) n++;
    else break;
  }
  return n;
}

/** The resting value after `fired` plays have run (0: the first play's `from`). */
export function restingValueOf(plays: readonly HomePlay[], fired: number): number {
  if (fired <= 0) return plays[0]!.from;
  return plays[Math.min(fired, plays.length) - 1]!.to;
}

/** What `v` adds to the animated value outside the section: the scroll goes on linearly there. */
export function passthrough(s: number): number {
  if (s < 0) return s;
  if (s > 1) return s - 1;
  return 0;
}

const alwaysReady = (): boolean => true;

/** The longest the hold of one play is kept, in wall-clock milliseconds. */
export function playLimitMs(seconds: number): number {
  return seconds * 1000 + HOLD_SLACK_MS;
}

export interface PlayOptions {
  /** The section's length in screens (the hysteresis is 0.12 of a screen at least). */
  readonly screens: number;
  /**
   * The lowest `local` the scroll can reach in this section: the page's top for the first section
   * (`(max(start - lead, 0) - start) / screens`). A threshold is kept above it so that it can be
   * crossed back. Defaults to the start of the lead, one `hyst` below 0.
   */
  readonly floor?: number;
  /**
   * The lead and the tail rest: `value` is the animated value only, with no passthrough of the scroll.
   * For a section whose scene must follow its clock and nothing else (it runs in its lead and tail
   * only so that it is still running while its play holds the page).
   */
  readonly restOutside?: boolean;
  /**
   * The ready gate: a forward play whose threshold is reached does not start (and does not hold the
   * scroll) while this says false, and starts on the first step after it says true if the scroll is
   * still past the threshold. A play that runs backward never waits. Default: always ready.
   */
  readonly ready?: () => boolean;
}

/**
 * The state of one section's plays. The runner feeds it the scroll every frame it runs. It is plain
 * numbers: nothing is allocated per frame.
 *
 * `step(sRaw, sShown, dt, now)`: `sRaw` is the real scroll in `local` units, and decides the
 * thresholds (the lock lands on the visitor's own position, not 0.2 screens late); `sShown` is the
 * scene's smoothed scroll, and drives the lead and the tail (so the joints with a neighbour that
 * is not on plays stay continuous); `dt` is the frame's seconds; `now` is wall-clock milliseconds
 * (the safety limit).
 */
export class PlayMachine {
  private readonly plays: readonly HomePlay[];
  private readonly backAt: Float64Array;
  private readonly restOutside: boolean;
  private readonly gate: () => boolean;
  /** A forward play is due (its threshold is reached) but the ready gate is closed. */
  private due = false;
  /** How many plays have fired (the resting station; moves when a play starts). */
  private idx = 0;
  /** The animated value, without the lead and tail passthrough. */
  private base: number;
  private sShown = 0;
  private playing = false;
  private playIdx = -1;
  private dir: -1 | 0 | 1 = 0;
  private t = 0;
  private duration = 0;
  private startedAt = 0;
  private limit = 0;
  private starts = 0;

  constructor(
    readonly id: string,
    plays: readonly HomePlay[],
    options: PlayOptions,
  ) {
    validatePlays(id, plays);
    this.plays = plays;
    const hyst = hystOf(options.screens);
    const floor = options.floor ?? -hyst;
    this.backAt = new Float64Array(plays.length);
    plays.forEach((p, i) => {
      // At most half the way down to the lowest reachable scroll, so the threshold can be crossed.
      const room = Math.max(0, p.at - floor) / 2;
      this.backAt[i] = p.at - Math.min(hyst, room);
    });
    if (process.env.NODE_ENV === "development") {
      // A clock play right after a zone: the idle snap lands on the zone's end, which would be the play's threshold.
      plays.forEach((p, i) => {
        const prev = plays[i - 1];
        if (prev?.span === undefined || p.span !== undefined) return;
        const gap = (p.at - (prev.at + prev.span)) * options.screens;
        if (gap < ZONE_CLOCK_GAP) {
          console.warn(
            `[home] section ${id}: plays[${i}] fires ${gap.toFixed(2)} screens after the zone before it ends. Leave at least ${ZONE_CLOCK_GAP} (kernel-scrub.md section 5).`,
          );
        }
      });
    }
    this.base = plays[0]!.from;
    this.restOutside = options.restOutside === true;
    this.gate = options.ready ?? alwaysReady;
  }

  /**
   * `v`: the value `update` gets. The animated value (a running clock play) or the zone the scroll is
   * in or has passed (a pure function of the smoothed scroll), or the resting station; plus the lead
   * and tail passthrough.
   */
  get value(): number {
    let v = this.base;
    if (!this.playing) {
      const z = this.zoneBehind();
      v = z ? zoneValue(z, this.sShown) : this.resting;
    }
    return this.restOutside ? v : v + passthrough(this.sShown);
  }

  /** The zone the machine stands in or just after (the play before the station), or null. */
  private zoneBehind(): HomePlay | null {
    if (this.idx <= 0) return null;
    const p = this.plays[this.idx - 1]!;
    return p.span === undefined ? null : p;
  }

  /** The table, for the probe and the zone snap. */
  get table(): readonly HomePlay[] {
    return this.plays;
  }

  /** The index of the zone the machine is in or just after, or -1 (the probe). */
  get zoneIndex(): number {
    return this.zoneBehind() ? this.idx - 1 : -1;
  }

  /** The value the machine rests on, or runs toward. */
  get resting(): number {
    return restingValueOf(this.plays, this.idx);
  }

  /** The value `update` gets after a jump past the section: where the last play ends. */
  get end(): number {
    return this.plays[this.plays.length - 1]!.to;
  }

  /** How many plays have fired (the station). */
  get fired(): number {
    return this.idx;
  }

  /** A play is running: the scroll is held. */
  get active(): boolean {
    return this.playing;
  }

  /** A forward play is due but the ready gate is closed: nothing runs and nothing holds yet. */
  get waiting(): boolean {
    return this.due;
  }

  /** 1 forward, -1 backward, 0 at rest. */
  get direction(): -1 | 0 | 1 {
    return this.playing ? this.dir : 0;
  }

  /** 0 to 1 over the running play (time, not eased), 0 at rest. */
  get progress(): number {
    return this.playing ? Math.min(1, this.t / this.duration) : 0;
  }

  /** The index of the running play, or -1. */
  get index(): number {
    return this.playing ? this.playIdx : -1;
  }

  /** How many plays have started since the machine was made (a new one while holding renews the hold). */
  get started(): number {
    return this.starts;
  }

  /** The wall-clock limit of the running play's hold, in milliseconds (0 at rest). */
  get limitMs(): number {
    return this.playing ? this.limit : 0;
  }

  get length(): number {
    return this.plays.length;
  }

  /**
   * A jump (a scrollbar drag, Back, a reload, a probe, the first frame, a programmatic move): the
   * resting value for the position, no play and no hold.
   */
  jump(sRaw: number, sShown: number = sRaw): void {
    this.sShown = sShown;
    this.due = false;
    this.playing = false;
    this.dir = 0;
    this.t = 0;
    this.idx = this.indexAt(sRaw, sShown);
    this.base = this.resting;
  }

  /**
   * How many plays are passed at a position: a clock play by the real scroll (its threshold), a zone
   * by the smoothed one (its value follows that scroll, so its start must too).
   */
  private indexAt(sRaw: number, sShown: number): number {
    let n = 0;
    for (const p of this.plays) {
      if (p.at <= (p.span === undefined ? sRaw : sShown)) n++;
      else break;
    }
    return n;
  }

  /**
   * The section came into range by a scroll that was running (not a jump). From above nothing has
   * fired yet, so the crossing fires it; from below everything has. The next `step` does the rest.
   */
  enter(sShown: number): void {
    this.sShown = sShown;
    this.due = false;
    this.playing = false;
    this.dir = 0;
    this.t = 0;
    this.idx = sShown <= 0.5 ? 0 : this.plays.length;
    this.base = this.resting;
  }

  /** The section went out of range: a play that was running ends where it was going. */
  leave(): void {
    this.due = false;
    if (this.playing) this.finish();
  }

  /** One frame. See the class comment for the four inputs. */
  step(sRaw: number, sShown: number, dt: number, now: number): void {
    this.sShown = sShown;
    // The safety: a play that has outlived its hold (a slow machine, a frozen frame) is ended, so
    // the visitor is never left standing in a scene.
    if (this.playing && now - this.startedAt > this.limit) this.finish();
    let budget = dt > 0 ? dt : 0;
    const guard = this.plays.length * 2 + 2;
    for (let i = 0; i < guard; i++) {
      if (this.playing) {
        const left = this.duration - this.t;
        if (budget < left) {
          this.t += budget;
          this.base = this.valueAt(this.t / this.duration);
          return;
        }
        budget -= left;
        this.finish();
      }
      // A play that ended re-reads the scroll: a flick that carried the page past the next
      // threshold goes straight on into the next play, with the time that was left over.
      if (!this.trigger(sRaw, now)) return;
    }
  }

  private trigger(sRaw: number, now: number): boolean {
    const n = this.plays.length;
    // Zones have no clock: the station follows the smoothed scroll, down into a zone and up out of it.
    while (this.idx < n) {
      const z = this.plays[this.idx]!;
      if (z.span !== undefined && this.sShown >= z.at) this.idx++;
      else break;
    }
    while (this.idx > 0) {
      const z = this.plays[this.idx - 1]!;
      if (z.span !== undefined && this.sShown < z.at) this.idx--;
      else break;
    }
    const next = this.idx < n ? this.plays[this.idx]! : null;
    if (next && next.span === undefined && sRaw >= next.at) {
      // A clock play after a zone waits until the smoothed scroll has finished the zone, so the
      // scene never jumps from the middle of the zone to the play's start.
      const before = this.idx > 0 ? this.plays[this.idx - 1]! : null;
      if (before?.span !== undefined && this.sShown < before.at + before.span) {
        this.due = false;
        return false;
      }
      if (!this.gate()) {
        this.due = true;
        return false;
      }
      this.due = false;
      this.begin(this.idx, 1, now);
      this.idx++;
      return true;
    }
    this.due = false;
    if (
      this.idx > 0 &&
      this.plays[this.idx - 1]!.span === undefined &&
      sRaw < this.backAt[this.idx - 1]!
    ) {
      this.idx--;
      this.begin(this.idx, -1, now);
      return true;
    }
    return false;
  }

  private begin(i: number, dir: 1 | -1, now: number): void {
    const p = this.plays[i]!;
    this.playing = true;
    this.playIdx = i;
    this.dir = dir;
    this.t = 0;
    this.duration = p.seconds * (dir < 0 ? (p.back ?? PLAY_BACK) : 1);
    this.startedAt = now;
    this.limit = playLimitMs(this.duration);
    this.starts++;
    this.base = dir > 0 ? p.from : p.to;
  }

  private finish(): void {
    const p = this.plays[this.playIdx]!;
    this.base = this.dir > 0 ? p.to : p.from;
    this.playing = false;
    this.dir = 0;
    this.t = 0;
  }

  private valueAt(x: number): number {
    const p = this.plays[this.playIdx]!;
    const k = easeValue(p.ease ?? "inOut", x);
    return this.dir > 0 ? p.from + (p.to - p.from) * k : p.to + (p.from - p.to) * k;
  }
}
