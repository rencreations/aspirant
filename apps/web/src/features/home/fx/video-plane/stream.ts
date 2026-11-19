/**
 * The trailer, streamed. The strip plays the library's whole film (145 MB, 3 minutes), so it is
 * never held in memory like the small clips: one `<video>` element that the browser fills with
 * range requests a few seconds ahead of where it plays, the way the Films room streams its films
 * (`features/library/video/films/film-pool.ts`). This file owns that one element. The loading
 * list waits until the first seconds are buffered (`warmTrailer`, real seconds over the seconds
 * wanted, so the bar is real) and the film plane puts the same element in its texture, so the
 * seconds that were buffered are the seconds that play.
 *
 * Why its own element and not the Films room's pool: that pool is keyed by the film's id, and the
 * Films room releases whatever it does not show. A texture also needs `crossOrigin` set before the
 * first byte, or the picture cannot be uploaded to WebGL.
 *
 * Behaviour:
 *  - The film rests at `TRAILER_FILM.start` and plays on to its end, then goes back there.
 *  - A stall (the picture ran out) holds the last frame: the texture only takes new frames, so it
 *    keeps the old one by itself. The element is paused and plays again only when
 *    `RESUME_SECONDS` are in hand, so a link slower than the film does not stutter. `status`
 *    says how much is in hand for the plane's thin loading line.
 *  - A download that stalls (no new second for `STALL_MS`), drops or fails is started again from
 *    where it stood, after a short wait, for as long as it takes (`lib/retry.ts`). Only a file the
 *    server says is gone, or one this browser cannot play, ends as `failed`: nothing can fix it.
 *  - No progress is made up. The plane may wait `SHOW_AFTER_MS` before it draws the line, so a
 *    short stall shows nothing: that is a delay of the line, not a made up number.
 *
 * No three.js here: the loading list imports this file.
 */
import { bufferGoal, bufferedAhead } from "@/features/library/video/films/film-math";
import { NAVIGATED_EVENT } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { STALL_MS } from "@/lib/media-store";
import { PermanentFailure, isGone, untilItArrives } from "@/lib/retry";

import { TRAILER_FILM } from "./data";

/** Seconds in hand before the film plays again after it ran out. */
export const RESUME_SECONDS = 3;
/**
 * A held element does not always buffer as far as `RESUME_SECONDS`: a paused element may stop asking
 * for more at a couple of seconds. When nothing new has arrived for this long (ms) and at least
 * `PLATEAU_SECONDS` are in hand, the film plays on (a playing element asks for more again).
 */
const PLATEAU_MS = 1500;
const PLATEAU_SECONDS = 1.5;
/** The film goes back to its rest moment this close to its end. */
const LOOP_MARGIN = 0.12;
/** How often the playback is looked at (ms). */
const CHECK_MS = 200;

type StreamState = "idle" | "loading" | "ready" | "failed";

/** What the plane reads (one object, changed in place: nothing is made per frame). */
export interface StreamStatus {
  state: StreamState;
  /** The film cannot play right now: it ran out of picture, or it is being fetched again. */
  stalled: boolean;
  /** 0 to 1: the seconds in hand over the seconds it needs to go on. */
  progress: number;
  /** Seconds buffered after the playhead. */
  ahead: number;
}

/** The stream was let go while it was loading. Not a failure of the file. */
class Released extends PermanentFailure {
  constructor() {
    super("released the trailer");
    this.name = "Released";
  }
}

function unload(el: HTMLVideoElement): void {
  el.pause();
  el.removeAttribute("src");
  el.load();
}

/** The end of the buffered stretch that holds `t` (or the nearest one after it), or `t` when none. */
export function bufferedEnd(ranges: TimeRanges, t: number): number {
  for (let i = 0; i < ranges.length; i += 1) {
    const end = ranges.end(i);
    if (t >= ranges.start(i) - 0.3 && t <= end + 0.01) return end;
  }
  return t;
}

export class TrailerStream {
  readonly el: HTMLVideoElement;
  readonly status: StreamStatus = { state: "idle", stalled: false, progress: 0, ahead: 0 };
  private readonly url = libUrl(TRAILER_FILM.key);
  private wantPlay = false;
  private released = false;
  private rebuffering = false;
  private loadingAgain = false;
  private warming: Promise<void> | null = null;
  private stop: AbortController | null = null;
  private lastCheck = 0;
  private lastTime = -1;
  private lastEnd = -1;
  private lastGrowth = 0;
  private onReport: Array<(fraction: number, bytes: { received: number; total: number }) => void> =
    [];
  /** How many times a download was started again (for the probes). */
  retries = 0;
  /** The last things that happened to the stream, for the probes: `time what`. */
  readonly events: string[] = [];

  constructor() {
    const el = document.createElement("video");
    // Before the first byte: a cross origin picture is only usable as a texture with this.
    el.crossOrigin = "anonymous";
    el.muted = true;
    el.defaultMuted = true;
    el.loop = false;
    el.playsInline = true;
    el.preload = "auto";
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    el.disablePictureInPicture = true;
    el.disableRemotePlayback = true;
    this.el = el;
    el.addEventListener("waiting", this.onWaiting);
    el.addEventListener("ended", this.onEnded);
    el.addEventListener("error", this.onError);
    window.addEventListener(NAVIGATED_EVENT, this.onNavigated);
  }

  // ---------------------------------------------------------------------------------------------
  // Loading

  /**
   * Buffer the first `seconds` of the film from its rest moment (or from where it stands once it
   * has a file). Repeated calls share one try. `onProgress` gets the fraction and the bytes that
   * stands for. Resolves when the seconds are in hand; rejects only for a file that cannot be had.
   */
  warm(
    seconds: number = TRAILER_FILM.warmSeconds,
    onProgress?: (fraction: number, bytes: { received: number; total: number }) => void,
  ): Promise<void> {
    if (this.status.state === "ready" && !this.warming) {
      const total = Math.round((TRAILER_FILM.bytes * seconds) / TRAILER_FILM.dur);
      onProgress?.(1, { received: total, total });
      return Promise.resolve();
    }
    if (onProgress) this.onReport.push(onProgress);
    this.start(seconds);
    const done = this.warming ?? Promise.resolve();
    return done.finally(() => {
      if (onProgress) this.onReport = this.onReport.filter((f) => f !== onProgress);
    });
  }

  /** Begin loading (idempotent). */
  start(seconds: number = TRAILER_FILM.warmSeconds): void {
    if (this.released || this.warming) return;
    if (this.status.state === "failed" || this.status.state === "ready") return;
    const from = this.el.getAttribute("src") ? this.el.currentTime : TRAILER_FILM.start;
    this.begin(from, seconds);
  }

  private note(what: string): void {
    this.events.push(`${Math.round(performance.now())} ${what}`);
    if (this.events.length > 40) this.events.shift();
  }

  private begin(from: number, seconds: number): void {
    this.note(`begin from ${from.toFixed(2)} for ${seconds}s`);
    this.el.preload = "auto";
    const stop = new AbortController();
    this.stop = stop;
    this.status.state = "loading";
    const mine = untilItArrives((n) => {
      if (n > 0) {
        this.retries += 1;
        this.note(`try ${n + 1}`);
      }
      return this.attempt(from, seconds, stop.signal);
    }).then(
      () => {
        this.note("ready");
        this.status.state = "ready";
        this.loadingAgain = false;
        this.status.progress = 1;
        // The seconds wanted are in hand. Until the plane plays, the browser may keep what it has but
        // fetch no further ahead (it would otherwise pull about 14 s for a visitor who never scrolls).
        this.el.preload = this.wantPlay ? "auto" : "metadata";
        if (this.wantPlay) this.tryPlay();
      },
      (error: unknown) => {
        if (error instanceof Released) return;
        this.status.state = "failed";
        this.loadingAgain = false;
        throw error;
      },
    );
    this.warming = mine;
    void mine
      .finally(() => {
        if (this.warming === mine) {
          this.warming = null;
          this.stop = null;
        }
      })
      .catch(() => undefined);
  }

  /** Why a try failed: gone for good, unplayable here, or worth another try. */
  private async failure(): Promise<Error> {
    const code = this.el.error?.code ?? 0;
    let status = 0;
    try {
      const r = await fetch(this.url, {
        headers: { Range: "bytes=0-0" },
        cache: "no-store",
        mode: "cors",
      });
      status = r.status;
      void r.body?.cancel().catch(() => undefined);
    } catch {
      // No answer: the connection is down. `untilItArrives` waits for it.
    }
    if (isGone(status)) return new PermanentFailure(`HTTP ${status} for ${this.url}`, status);
    if (code === 4 && (status === 200 || status === 206)) {
      return new PermanentFailure(`This browser cannot play ${this.url}`, status);
    }
    return new Error(`Media error ${code} for ${this.url}`);
  }

  /** One try: give the element its file and wait for the seconds wanted from `from`. */
  private attempt(from: number, seconds: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Released());
    const el = this.el;
    // A start inside the film goes in the address as a media fragment, so the browser fetches from
    // there instead of buffering the opening first.
    if (!el.getAttribute("src")) {
      el.src = from > 0.05 ? `${this.url}#t=${from.toFixed(2)}` : this.url;
    }
    const total = Math.round((TRAILER_FILM.bytes * seconds) / TRAILER_FILM.dur);
    return new Promise<void>((resolve, reject) => {
      let sought = from <= 0.05;
      let best = -1;
      let grew = performance.now();
      let ended = false;
      let suspended = false;
      const events = [
        "loadedmetadata",
        "loadeddata",
        "progress",
        "canplay",
        "canplaythrough",
        "seeked",
        "timeupdate",
      ] as const;
      const tell = (f: number) => {
        this.status.progress = Math.max(this.status.progress, f);
        const bytes = { received: Math.round(total * f), total };
        for (const fn of this.onReport) fn(f, bytes);
      };
      const check = () => {
        if (ended) return;
        if (!sought && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
          sought = true;
          if (Math.abs(el.currentTime - from) > 0.3) el.currentTime = from;
        }
        const at = sought ? el.currentTime : from;
        const goal = bufferGoal(seconds, at, el.duration || TRAILER_FILM.dur);
        const ahead = bufferedAhead(el.buffered, at);
        if (ahead > best + 0.01) {
          best = ahead;
          grew = performance.now();
        }
        this.status.ahead = ahead;
        tell(goal > 0 ? Math.min(1, ahead / goal) : 1);
        const enough = ahead >= goal - 0.05 && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
        // The browser has stopped fetching and says so (`suspend`): its buffer is full for now, or
        // it is one that loads a film only once it plays (a phone's Safari does). Waiting longer
        // would bring nothing, so that counts as ready too.
        const idle =
          suspended &&
          el.networkState === HTMLMediaElement.NETWORK_IDLE &&
          el.readyState >= HTMLMediaElement.HAVE_METADATA;
        if (sought && !el.seeking && (enough || idle)) finish();
      };
      const onSuspend = () => {
        suspended = true;
        check();
      };
      const onFetch = () => {
        suspended = false;
      };
      const onFail = () => {
        if (ended) return;
        void this.failure().then((error) => {
          finish(error);
        });
      };
      const onAbort = () => {
        finish(new Released());
      };
      // A dead connection can hold the socket open for minutes without a byte: start again.
      const watchdog = window.setInterval(() => {
        if (performance.now() - grew > STALL_MS) finish(new Error(`Stalled: ${this.url}`));
      }, 1000);
      function finish(error?: Error) {
        if (ended) return;
        ended = true;
        window.clearInterval(watchdog);
        for (const name of events) el.removeEventListener(name, check);
        el.removeEventListener("suspend", onSuspend);
        el.removeEventListener("loadstart", onFetch);
        el.removeEventListener("error", onFail);
        signal.removeEventListener("abort", onAbort);
        if (!error) {
          resolve();
          return;
        }
        // The next try starts clean (a stalled or broken stream is not reused).
        if (!(error instanceof Released)) unload(el);
        reject(error);
      }
      for (const name of events) el.addEventListener(name, check);
      el.addEventListener("suspend", onSuspend);
      el.addEventListener("loadstart", onFetch);
      el.addEventListener("error", onFail);
      signal.addEventListener("abort", onAbort);
      if (el.error) onFail();
      else check();
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Playing

  /** The plane shows the film: play it (loading it first if nothing has). */
  play(): void {
    if (this.released) return;
    this.wantPlay = true;
    if (this.el.preload !== "auto") this.el.preload = "auto";
    if (!this.warming && this.status.state === "idle") this.start();
    this.tryPlay();
  }

  /** The plane is off the screen: hold. The buffer stays. */
  pause(): void {
    this.wantPlay = false;
    this.rebuffering = false;
    if (!this.el.paused) this.el.pause();
    if (!this.warming && this.el.preload === "auto") this.el.preload = "metadata";
    this.status.stalled = this.loadingAgain;
  }

  get playing(): boolean {
    return !this.el.paused && !this.el.ended;
  }

  private tryPlay(): void {
    const el = this.el;
    if (this.released || !this.wantPlay || this.rebuffering || this.loadingAgain) return;
    if (!el.paused || el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    void el.play().catch(() => undefined);
  }

  /** The picture ran out while it was playing: hold the last frame until enough is in hand. */
  private readonly onWaiting = (): void => {
    if (!this.wantPlay || this.released || this.loadingAgain) return;
    if (!this.rebuffering) {
      this.rebuffering = true;
      this.lastGrowth = performance.now();
      this.note(`waiting at ${this.el.currentTime.toFixed(2)}`);
    }
    this.el.pause();
    this.status.stalled = true;
  };

  private readonly onEnded = (): void => {
    this.toStart();
  };

  /** The browser said the file is bad: fetch it again from where it stood. */
  private readonly onError = (): void => {
    if (this.released || this.warming) return;
    this.recover();
  };

  private readonly onNavigated = (): void => {
    // The home page is the only one that shows the film: leaving it lets the stream go.
    if (window.location.pathname.replace(/\/+$/u, "") !== "") this.release();
  };

  private toStart(): void {
    const el = this.el;
    if (this.released) return;
    this.note("loop");
    this.rebuffering = true;
    this.status.stalled = true;
    this.lastGrowth = performance.now();
    el.currentTime = TRAILER_FILM.start;
  }

  /** Start the download again from where it stood (stalled for too long, or the file errored). */
  private recover(): void {
    if (this.released) return;
    const at = Math.min(Math.max(TRAILER_FILM.start, this.el.currentTime), TRAILER_FILM.dur - 1);
    this.note(`recover at ${at.toFixed(2)}`);
    this.loadingAgain = true;
    this.status.stalled = true;
    this.status.progress = 0;
    unload(this.el);
    this.begin(at, RESUME_SECONDS);
  }

  /**
   * Called every frame by the plane that shows the film; looks at the playback a few times a second
   * and does nothing else. `now` is `performance.now()`.
   */
  update(now: number): void {
    if (this.released || now - this.lastCheck < CHECK_MS) return;
    this.lastCheck = now;
    const el = this.el;
    if (!el.getAttribute("src") || this.warming) {
      // Loading (first time or again): `attempt` reports the progress.
      if (this.warming) this.status.stalled = this.loadingAgain || this.status.stalled;
      return;
    }
    const t = el.currentTime;
    const end = bufferedEnd(el.buffered, t);
    const ahead = Math.max(0, end - t);
    this.status.ahead = ahead;
    if (t !== this.lastTime || end !== this.lastEnd) {
      this.lastTime = t;
      this.lastEnd = end;
      this.lastGrowth = now;
    }
    if (!this.wantPlay) return;

    const dur = el.duration;
    if (!this.rebuffering && Number.isFinite(dur) && dur > 0 && t >= dur - LOOP_MARGIN) {
      this.toStart();
      return;
    }
    if (this.rebuffering) {
      // The film's own end is a place that needs no more: a stretch up to it is enough.
      const fileEnd = Number.isFinite(dur) && end >= dur - 0.3;
      const goal = fileEnd ? Math.min(RESUME_SECONDS, Math.max(0.2, dur - t)) : RESUME_SECONDS;
      this.status.progress = Math.min(1, ahead / goal);
      const ready = el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !el.seeking;
      const plateau = now - this.lastGrowth > PLATEAU_MS && ahead >= PLATEAU_SECONDS;
      if (ready && (ahead >= goal - 0.05 || plateau)) {
        this.rebuffering = false;
        this.status.stalled = false;
        this.status.progress = 1;
        void el.play().catch(() => undefined);
      }
    } else if (this.status.stalled && !this.loadingAgain) {
      this.status.stalled = false;
    }
    // Nothing new for as long as a download is allowed to stand still: start it again from here.
    if ((this.rebuffering || !el.paused) && now - this.lastGrowth > STALL_MS) {
      this.lastGrowth = now;
      this.recover();
    }
  }

  // ---------------------------------------------------------------------------------------------

  /** Let the film go: the element drops its file and its buffer. The next visit makes a new one. */
  release(): void {
    if (this.released) return;
    this.note("release");
    this.released = true;
    this.stop?.abort();
    window.removeEventListener(NAVIGATED_EVENT, this.onNavigated);
    this.el.removeEventListener("waiting", this.onWaiting);
    this.el.removeEventListener("ended", this.onEnded);
    this.el.removeEventListener("error", this.onError);
    unload(this.el);
    this.el.remove();
    this.status.state = "idle";
    this.status.stalled = false;
    if (current === this) current = null;
  }

  get isReleased(): boolean {
    return this.released;
  }
}

let current: TrailerStream | null = null;

/** The one stream of the trailer (made on first ask, made again after `releaseTrailer`). */
export function trailerStream(): TrailerStream {
  if (!current || current.isReleased) current = new TrailerStream();
  return current;
}

/** Let the trailer go (the film plane is gone, or the visitor left the home page). */
export function releaseTrailer(): void {
  current?.release();
  current = null;
}

/** The loading list's call: have the first seconds of the trailer in hand. */
export function warmTrailer(
  onProgress?: (fraction: number, bytes: { received: number; total: number }) => void,
): Promise<void> {
  return trailerStream().warm(TRAILER_FILM.warmSeconds, onProgress);
}
