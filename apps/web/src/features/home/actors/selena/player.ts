/**
 * The clip state machine: which clip plays, at what time, and the cross fade between two. Pure
 * (no three.js). Two ways to drive it, and a section may use either from one frame to the next:
 *
 *  - `scrub(a, ta, b, tb, w)`: the section says the pose. Nothing here keeps time.
 *  - `play(clip, options)`: the machine keeps its own time. Calling it again with what is already
 *    the target does nothing, so a section can call it every frame. A chain (`then`) and a switch
 *    at the end of a loop (`when: "loopEnd"`) are finished by the machine itself, whatever the
 *    section does next: the way out of the hands-at-mouth loop is a one shot that always ends.
 */
import { clipTime } from "./sampler";

export type ClipName =
  | "city_idle"
  | "city_interaction_R_loop"
  | "city_interaction_back_R"
  | "city_interaction_R"
  | "city_intercation02"
  | "city_intercation03";

interface ClipInfo {
  readonly duration: number;
  readonly loop: boolean;
}

export type ClipTable = Readonly<Record<ClipName, ClipInfo>>;

export interface Segment {
  clip: ClipName;
  loop?: boolean;
  /** Seconds of cross fade from what was playing. */
  fade?: number;
  speed?: number;
}

export interface PlayOptions extends Omit<Segment, "clip"> {
  /** "now" (default) starts at once. "loopEnd" waits for the current loop to come round. */
  when?: "now" | "loopEnd";
  /** What follows when this one ends (a clip that does not loop). */
  then?: Segment[];
}

/** What to draw: clip `a` at `ta`, and when `b` is set, `b` at `tb` blended in by `w` (0 to 1). */
export interface PlayerPose {
  a: ClipName;
  ta: number;
  b: ClipName | null;
  tb: number;
  w: number;
}

interface Running {
  clip: ClipName;
  time: number;
  loop: boolean;
  speed: number;
}

const DEFAULT_FADE = 0.18;

export class ClipPlayer {
  readonly pose: PlayerPose;
  private cur: Running;
  private from: Running | null = null;
  private fadeT = 0;
  private fadeDur = 0;
  private queue: Segment[] = [];
  private pending: Segment[] | null = null;
  private scrubbed = false;
  private ended = false;

  constructor(
    private readonly info: ClipTable,
    first: ClipName = "city_idle",
  ) {
    this.cur = this.running({ clip: first });
    this.pose = { a: first, ta: 0, b: null, tb: 0, w: 0 };
  }

  /** The clip the machine is heading for at the end of everything queued. */
  target(): ClipName {
    const chain = this.pending ?? this.queue;
    return chain[chain.length - 1]?.clip ?? this.cur.clip;
  }

  /** The clip playing now (the incoming one while a fade runs). */
  current(): ClipName {
    return this.cur.clip;
  }

  /** True while the machine keeps its own time (not scrubbed). */
  playing(): boolean {
    return !this.scrubbed;
  }

  /** A one shot clip has reached its end and nothing follows. */
  hasEnded(): boolean {
    return this.ended && !this.scrubbed;
  }

  /** The clip time of the current clip. */
  time(): number {
    return this.cur.time;
  }

  play(clip: ClipName, options: PlayOptions = {}): void {
    const loop = options.loop ?? this.info[clip].loop;
    const seg: Segment = { clip, loop, fade: options.fade, speed: options.speed };
    const rest = options.then ?? [];
    if (!this.scrubbed && options.when === "loopEnd" && this.cur.loop) {
      if (this.cur.clip === clip && this.cur.loop === loop) return;
      if (this.pending?.[0]?.clip === clip) return;
      this.pending = [seg, ...rest];
      return;
    }
    if (
      !this.scrubbed &&
      this.cur.clip === clip &&
      this.cur.loop === loop &&
      this.sameQueue(rest)
    ) {
      // Already playing it: a request that was waiting for the loop end is dropped, nothing restarts.
      this.pending = null;
      return;
    }
    this.start(seg);
    this.queue = rest.slice();
    this.pending = null;
  }

  scrub(a: ClipName, ta: number, b: ClipName | null = null, tb = 0, w = 0): void {
    if (!this.scrubbed) {
      this.scrubbed = true;
      this.from = null;
      this.queue = [];
      this.pending = null;
    }
    const pose = this.pose;
    pose.a = a;
    pose.ta = clipTime(ta, this.info[a].duration, this.info[a].loop);
    if (b !== null && w > 0) {
      pose.b = b;
      pose.tb = clipTime(tb, this.info[b].duration, this.info[b].loop);
      pose.w = w > 1 ? 1 : w;
    } else {
      pose.b = null;
      pose.tb = 0;
      pose.w = 0;
    }
  }

  /** Advance by `dt` seconds (0 changes nothing) and return the pose to draw. */
  step(dt: number): PlayerPose {
    if (this.scrubbed || !(dt > 0)) return this.pose;
    if (this.from) this.advance(this.from, dt);
    const cur = this.cur;
    cur.time += dt * cur.speed;
    const dur = this.info[cur.clip].duration;
    if (cur.loop) {
      if (cur.time >= dur) {
        cur.time -= Math.floor(cur.time / dur) * dur;
        if (this.pending) {
          const [next, ...rest] = this.pending;
          this.pending = null;
          if (next) {
            this.start(next);
            this.queue = rest;
          }
        }
      }
    } else if (cur.time >= dur) {
      cur.time = dur;
      const next = this.queue.shift();
      if (next) this.start(next);
      else this.ended = true;
    }
    if (this.from) {
      this.fadeT += dt;
      if (this.fadeT >= this.fadeDur) this.from = null;
    }
    this.fill();
    return this.pose;
  }

  private sameQueue(rest: Segment[]): boolean {
    if (rest.length !== this.queue.length) return false;
    return rest.every((s, i) => s.clip === this.queue[i]?.clip);
  }

  private running(seg: Segment): Running {
    return {
      clip: seg.clip,
      time: 0,
      loop: seg.loop ?? this.info[seg.clip].loop,
      speed: seg.speed ?? 1,
    };
  }

  private start(seg: Segment): void {
    if (this.scrubbed) {
      // Leave a scrub: fade out of the pose that was shown.
      this.from = {
        clip: this.pose.a,
        time: this.pose.ta,
        loop: this.info[this.pose.a].loop,
        speed: 0,
      };
      this.scrubbed = false;
    } else {
      this.from = { ...this.cur };
    }
    this.cur = this.running(seg);
    this.fadeT = 0;
    this.fadeDur = seg.fade ?? DEFAULT_FADE;
    if (!(this.fadeDur > 0)) this.from = null;
    this.ended = false;
    this.fill();
  }

  private advance(r: Running, dt: number): void {
    const dur = this.info[r.clip].duration;
    r.time += dt * r.speed;
    if (r.loop) r.time -= Math.floor(r.time / dur) * dur;
    else if (r.time > dur) r.time = dur;
  }

  private fill(): void {
    const pose = this.pose;
    if (this.from && this.fadeDur > 0) {
      const x = Math.min(1, this.fadeT / this.fadeDur);
      pose.a = this.from.clip;
      pose.ta = this.from.time;
      pose.b = this.cur.clip;
      pose.tb = this.cur.time;
      pose.w = x * x * (3 - 2 * x);
    } else {
      pose.a = this.cur.clip;
      pose.ta = this.cur.time;
      pose.b = null;
      pose.tb = 0;
      pose.w = 0;
    }
  }
}
