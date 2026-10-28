import {
  crossed,
  frameAt,
  LEAD_FRAMES,
  skipRate,
  skipWallMs,
  tooFar,
  triggerFrames,
  waitFrames,
  wrapFrame,
  type SkipOptions,
} from "./phase";
import {
  isPage,
  type PageName,
  type SceneName,
  type ShortName,
  type Timeline,
  type VideoKey,
} from "./timeline";

/** The file name of a video (inside its size folder). */
export function videoFile(timeline: Timeline, key: VideoKey): string {
  if (key === "welcome") return "welcome.mp4";
  if (key === "idle") return "idle.mp4";
  if (key in timeline.shorts) return timeline.shorts[key as ShortName].file;
  const [page, part] = key.split("-") as [PageName, "in" | "loop" | "out"];
  return timeline.pages[page][part].file;
}

/**
 * - boot: nothing plays yet.
 * - welcome: the welcome animation.
 * - idle: the idle animation loops.
 * - queued: a scene was asked for and waits for the idle loop to reach its start frame.
 * - intro: a page's entrance plays.
 * - page: the page's own animation loops.
 * - leaving: the visitor left the page and the loop waits for the frame its exit starts on.
 * - outro: the page's exit plays.
 * - short: a short animation plays.
 * - returning: a video is handing back to the idle loop.
 */
type StageMode =
  | "boot"
  | "welcome"
  | "idle"
  | "queued"
  | "intro"
  | "page"
  | "leaving"
  | "outro"
  | "short"
  | "returning";

export interface StageState {
  mode: StageMode;
  /** The scene that is queued or playing. */
  scene: SceneName | null;
  /** True while a queued scene is still loading. */
  loading: boolean;
  /**
   * The main panel can show. It is true while she idles, and it comes back as soon as she is in
   * her idle pose again, a moment before the exit or the short has finished handing over.
   */
  ui: boolean;
  /** A scene the visitor chose while she was still finishing another one. */
  next: SceneName | null;
  /** True once the visitor asked to leave a page, until she is back in her idle pose. */
  leaving: boolean;
  /** The picture is running faster than normal, to get to its frame sooner (see `skip`). */
  fast: boolean;
  /**
   * How long the wait for the matching frame is, measured when it began. The page uses it to run
   * a waiting animation of exactly that length. Null when it is not known.
   */
  wait: { ms: number; at: number } | null;
}

export type StageElements = Record<VideoKey, HTMLVideoElement>;

interface DirectorOptions {
  /**
   * Speed the picture up while it waits for the frame a video hands over on, and ease it back to
   * normal as that frame comes. A character whose idle never repeats has long waits (up to the
   * whole loop), and this makes them a fraction as long. Null or missing: normal speed.
   */
  skip?: () => SkipOptions | null;
  /** Her videos: the frame numbers every hand-over is cut on (`timeline.generated.ts`). */
  timeline: Timeline;
  /** Reduced motion: nothing starts by itself and nothing loops. */
  reduced: boolean;
  /** Start on the idle loop with no welcome (the visitor came to one of her pages). */
  skipWelcome?: boolean;
  /** Called once, as the stage begins: the page starts the music here. */
  onBegin?: () => void;
  /** How long the music plays alone before the welcome video starts, in ms. Default 0. */
  welcomeDelayMs?: number;
  onState: (state: StageState) => void;
  /** Called before a video is first used, so the page can give it its source. */
  attach?: (key: VideoKey, el: HTMLVideoElement) => void;
  /**
   * Called when a video is done for now. The page lets go of its source, so the browser frees the
   * decoder and the frames it holds (a 4K video holds many). `attach` gives it back when needed.
   */
  detach?: (key: VideoKey, el: HTMLVideoElement) => void;
}

interface Back {
  syncFrame: number;
  syncPhase: number;
  uiFrame: number;
  blendMs: number;
  align: number;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
/** A video needs a few frames to show its first picture after play(). */
const START_LATENCY = LEAD_FRAMES + 2;
const HANDOVER_MS = 160;

/** Move a video to `time` and wait until the seek is done, so no old picture is left on show. */
function seekTo(video: HTMLVideoElement, time: number, ms = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.002 && !video.seeking) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    video.addEventListener("seeked", finish);
    video.currentTime = time;
  });
}

/**
 * Resolve when the video presents the picture at `time` (or after `ms`, so a stall never hangs).
 * A picture from before the seek, left over from the last time the video played, does not count.
 */
function presented(video: HTMLVideoElement, time: number, ms = 900): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    if (typeof video.requestVideoFrameCallback === "function") {
      const check = (_now: number, meta: VideoFrameCallbackMetadata) => {
        if (meta.mediaTime >= time - 0.05) finish();
        else video.requestVideoFrameCallback(check);
      };
      video.requestVideoFrameCallback(check);
    } else {
      video.addEventListener("playing", finish, { once: true });
    }
  });
}

/** Call `fn` with the media time of every frame the video presents. Returns a stop function. */
function watchFrames(video: HTMLVideoElement, fn: (mediaTime: number) => void): () => void {
  let stopped = false;
  if (typeof video.requestVideoFrameCallback === "function") {
    const step = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (stopped) return;
      fn(meta.mediaTime);
      video.requestVideoFrameCallback(step);
    };
    video.requestVideoFrameCallback(step);
  } else {
    const step = () => {
      if (stopped) return;
      fn(video.currentTime);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  return () => {
    stopped = true;
  };
}

/** A video is loaded enough to start. One that cannot load counts as ready: the page falls back
 * to the still picture instead of waiting for ever. */
function isReady(video: HTMLVideoElement): boolean {
  if (video.error) return true;
  return video.readyState >= 3;
}

/**
 * Runs a character's stage. A video per piece sits on top of the others and only one is on top at a
 * time: the welcome, the idle loop, for each page an entrance, a loop and an exit, and the short
 * animations. Every hand-over is cut on matching frames (see scripts/<name>/build.py), so each
 * swap is a dissolve between two pictures that are nearly the same:
 *
 *   welcome -> idle   when the welcome is a few frames from its end
 *   idle -> intro     when the idle loop reaches the frame the entrance was cut from
 *   intro -> page     when she is in the page's pose (`handFrame` of the entrance). From there the
 *                     entrance is the page loop itself, frame for frame, so the loop starts at the
 *                     matching phase and the page shows at once
 *   page -> outro     after `leave()`, when the page loop reaches the frame the exit starts on
 *   outro -> idle     in the stretch at the end of the exit where she is back in her idle pose.
 *                     The idle loop starts at the phase that matches, the two play together, and
 *                     they dissolve while both move
 *   idle -> short     like idle -> intro, and back to idle like outro -> idle
 *
 * The recordings were made one by one and the camera sits a fraction of a percent closer in some,
 * so the idle picture is eased by that fraction while it dissolves with them.
 *
 * Nothing here touches React. The page passes the elements and listens to `onState`.
 */
export class StageDirector {
  private state: StageState = {
    mode: "boot",
    scene: null,
    loading: false,
    ui: false,
    next: null,
    leaving: false,
    fast: false,
    wait: null,
  };
  private stopWatch: (() => void) | null = null;
  private pending: SceneName | null = null;
  private after: SceneName | null = null;
  /** The wait shown for `after`, so it carries on, and does not start again, when it begins. */
  private afterWait: { ms: number; at: number } | null = null;
  /** The exit or short that is playing, to work out how long until she is back in the idle loop. */
  private exit: { clip: HTMLVideoElement; back: Back } | null = null;
  private prevFrame: number | null = null;
  private skipTimer = 0;
  private skipped: HTMLVideoElement | null = null;
  private handed = false;
  private destroyed = false;
  private leaveAsked = false;
  /** She is back in her idle pose, so the panel may show before the hand-over has finished. */
  private poseBack = false;
  /** A page opened without its video (no codec): it shows over the still picture. */
  private degraded = false;
  /** The scene whose first video was warmed by a hover, so only one is ever held that way. */
  private warmed: SceneName | null = null;

  private readonly tl: Timeline;
  /** Frames a second, and frames in the idle loop. */
  private readonly fps: number;
  private readonly n: number;

  constructor(
    private readonly els: StageElements,
    private readonly opts: DirectorOptions,
  ) {
    this.tl = opts.timeline;
    this.fps = this.tl.fps;
    this.n = this.tl.loopFrames;
    for (const el of this.all()) el.dataset.layer = "off";
    // Until it plays, the welcome shows its own first frame, so the animation does not pop in
    // over a different picture. Reduced motion never plays it.
    if (!opts.reduced && !opts.skipWelcome) this.use("welcome").dataset.layer = "front";
    this.use("idle");
  }

  get current(): StageState {
    return this.state;
  }

  private all(): HTMLVideoElement[] {
    return Object.values(this.els);
  }

  private use(key: VideoKey): HTMLVideoElement {
    const el = this.els[key];
    this.opts.attach?.(key, el);
    return el;
  }

  private keysOf(scene: SceneName): VideoKey[] {
    return isPage(scene) ? [`${scene}-in`, `${scene}-loop`, `${scene}-out`] : [scene];
  }

  /**
   * While a scene waits for its frame, its first video sits on screen at 1 percent opacity. The
   * browser has then made its layer and picture before the dissolve starts, instead of doing it
   * in the first frames of the dissolve (a 4K layer takes a while to set up).
   */
  private prime(scene: SceneName) {
    const el = this.els[this.keysOf(scene)[0]!];
    if (el.dataset.layer === "off") el.dataset.layer = "warm";
  }

  private unprime(scene: SceneName | null) {
    if (!scene) return;
    const el = this.els[this.keysOf(scene)[0]!];
    if (el.dataset.layer === "warm") el.dataset.layer = "off";
  }

  /** Let go of the videos of a scene that is not on screen. */
  private releaseScene(scene: SceneName) {
    for (const key of this.keysOf(scene)) this.opts.detach?.(key, this.els[key]);
  }

  private set(next: Partial<Omit<StageState, "ui">>) {
    const merged = { ...this.state, ...next };
    merged.ui = merged.mode === "idle" || merged.mode === "queued" || this.poseBack;
    this.state = merged;
    this.opts.onState(this.state);
  }

  /** Ease the picture's scale. A video's zoom is set in CSS (`--zoom`). */
  private zoom(el: HTMLVideoElement, scale: number, ms: number) {
    el.style.setProperty("--zoom-ms", `${ms}ms`);
    el.style.setProperty("--zoom", String(scale));
  }

  private zoomNow(el: HTMLVideoElement, scale: number) {
    el.style.setProperty("--zoom-ms", "0ms");
    el.style.setProperty("--zoom", String(scale));
    // Let the browser take the new scale before an easing starts from it.
    void el.offsetWidth;
  }

  /** Put `to` on top and let `from` go once the dissolve is done. */
  private async swap(to: HTMLVideoElement, from: HTMLVideoElement | null, ms: number) {
    to.style.setProperty("--xfade", `${ms}ms`);
    if (from) from.dataset.layer = "back";
    to.dataset.layer = "front";
    if (!from) return;
    await sleep(ms + 40);
    if (from !== to) {
      from.dataset.layer = "off";
      from.pause();
    }
  }

  private topVideo(): HTMLVideoElement | null {
    return this.all().find((v) => v.dataset.layer === "front") ?? null;
  }

  /** The speed-up in force, or null when there is none (reduced motion, or the character has none). */
  private skipOptions(): SkipOptions | null {
    return this.opts.reduced ? null : (this.opts.skip?.() ?? null);
  }

  /**
   * Run `video` faster while it waits for one of `triggers`, and ease back to normal speed as the
   * frame comes. The speed is set every 50 ms from how many frames are left.
   */
  private startSkip(video: HTMLVideoElement, triggers: readonly number[], n: number) {
    this.stopSkip();
    const skip = this.skipOptions();
    if (!skip) return;
    const left = () => waitFrames(frameAt(video.currentTime, n, this.fps), triggers, n);
    if (left() <= skip.minFrames) return;
    const from = performance.now();
    this.skipped = video;
    this.skipTimer = window.setInterval(() => {
      if (video.paused || document.hidden) return;
      const rate = this.state.loading
        ? 1
        : skipRate(left(), performance.now() - from, skip.maxRate);
      video.playbackRate = rate;
      const fast = rate > 1.05;
      if (fast !== this.state.fast) this.set({ fast });
    }, 50);
  }

  /** Back to normal speed. */
  private stopSkip() {
    window.clearInterval(this.skipTimer);
    this.skipTimer = 0;
    if (this.skipped) {
      this.skipped.playbackRate = 1;
      this.skipped = null;
    }
    if (this.state.fast) this.set({ fast: false });
  }

  /** The videos have no sound, so the browser lets them start by themselves. */
  private async play(video: HTMLVideoElement): Promise<boolean> {
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  }

  /** Seek, play and wait for the picture at `time` to be on screen. */
  private async startAt(video: HTMLVideoElement, time: number): Promise<boolean> {
    await seekTo(video, time);
    if (!(await this.play(video))) return false;
    await presented(video, time);
    return true;
  }

  /**
   * The idle loop's clock while it can be read, for things that follow its picture: its time, and
   * whether it is playing (it is paused while a page or a short is on top).
   */
  idleClock(): { time: number; playing: boolean; rate: number } | null {
    const idle = this.els.idle;
    if (idle.readyState === 0) return null;
    return {
      time: idle.currentTime,
      playing: !idle.paused && !idle.ended,
      rate: idle.playbackRate || 1,
    };
  }

  /** Frames the video on top has dropped and shown (counters that only grow), or null. */
  videoQuality(): { dropped: number; total: number } | null {
    const top = this.topVideo();
    const q = top?.getVideoPlaybackQuality?.();
    return q ? { dropped: q.droppedVideoFrames, total: q.totalVideoFrames } : null;
  }

  /**
   * Get a scene's first video ready (the pointer is on its button). Only the entrance is warmed:
   * the rest of a page is attached when the entrance plays, and the one warmed before is let go,
   * so a pointer moving over the buttons never leaves several 4K decoders behind.
   */
  warm(scene: SceneName) {
    const before = this.warmed;
    if (
      before &&
      before !== scene &&
      before !== this.state.scene &&
      before !== this.pending &&
      before !== this.after
    ) {
      this.releaseScene(before);
    }
    this.warmed = scene;
    this.use(this.keysOf(scene)[0]!);
  }

  async start() {
    if (this.destroyed || this.state.mode !== "boot") return;
    this.opts.onBegin?.();
    // The music comes first. The welcome video starts after the delay, on a black screen that then
    // fades away, so the picture is already moving when it is seen.
    const delay = this.opts.welcomeDelayMs ?? 0;
    if (delay > 0 && !this.opts.skipWelcome && !this.opts.reduced) {
      await sleep(delay);
      if (this.destroyed) return;
    }
    if (this.opts.skipWelcome && !this.opts.reduced) {
      await this.jumpToIdle();
      return;
    }
    const welcome = this.use("welcome");
    const idle = this.use("idle");
    if (this.opts.reduced) {
      // No motion: the idle loop shows its first frame and stays there.
      idle.currentTime = 0;
      await this.swap(idle, null, 0);
      this.set({ mode: "idle" });
      return;
    }
    const ok = await this.startAt(welcome, 0);
    if (!ok || this.destroyed) {
      await this.handToIdle();
      return;
    }
    await this.swap(welcome, null, 0);
    this.set({ mode: "welcome" });
    const lead = (LEAD_FRAMES + this.tl.extraFrames) / this.fps;
    this.stopWatch = watchFrames(welcome, (t) => {
      if (Number.isFinite(welcome.duration) && t >= welcome.duration - lead) void this.handToIdle();
    });
    welcome.addEventListener(
      "ended",
      () => {
        void this.handToIdle();
      },
      { once: true },
    );
  }

  private async handToIdle() {
    if (this.handed || this.destroyed) return;
    this.handed = true;
    this.stopWatch?.();
    const idle = this.use("idle");
    const welcome = this.els.welcome;
    await this.startAt(idle, 0);
    await this.swap(idle, this.topVideo() === welcome ? welcome : null, HANDOVER_MS);
    welcome.currentTime = 0;
    this.opts.detach?.("welcome", welcome);
    this.set({ mode: "idle" });
    this.watchIdle();
  }

  /**
   * Go straight to the idle loop, from wherever the stage is. The page covers the screen while
   * this happens, so there is nothing to blend. Used by Skip and by Back from the short animations.
   */
  async jumpToIdle() {
    if (this.destroyed) return;
    this.stopWatch?.();
    this.stopSkip();
    this.pending = null;
    this.after = null;
    this.afterWait = null;
    this.exit = null;
    this.leaveAsked = false;
    this.degraded = false;
    this.poseBack = false;
    this.handed = true;
    const idle = this.use("idle");
    for (const [key, el] of Object.entries(this.els) as Array<[VideoKey, HTMLVideoElement]>) {
      if (el === idle) continue;
      el.pause();
      el.dataset.layer = "off";
      this.opts.detach?.(key, el);
    }
    this.warmed = null;
    this.zoomNow(idle, 1);
    if (!this.opts.reduced) await this.startAt(idle, 0);
    else idle.currentTime = 0;
    idle.style.setProperty("--xfade", "0ms");
    idle.dataset.layer = "front";
    this.set({ mode: "idle", scene: null, loading: false, next: null, leaving: false, wait: null });
    if (!this.opts.reduced) this.watchIdle();
  }

  /**
   * Give the idle loop the size the device asks for now (the performance level stepped down while
   * she idles). It restarts from its first frame, so the page covers the screen while this runs
   * (the same wipe as Skip). Does nothing unless she is idling.
   */
  async retier() {
    if (this.destroyed || this.state.mode !== "idle") return;
    this.opts.detach?.("idle", this.els.idle);
    await this.jumpToIdle();
  }

  private watchIdle() {
    this.stopWatch?.();
    this.prevFrame = null;
    this.stopWatch = watchFrames(this.els.idle, (t) => {
      const frame = frameAt(t, this.n, this.fps);
      const pending = this.pending;
      if (pending && this.state.mode === "queued") {
        const timing = isPage(pending) ? this.tl.pages[pending].in : this.tl.shorts[pending];
        const triggers = triggerFrames(timing.startPhases, this.n);
        // A video that does not make the visitor wait a whole loop starts at once when the loop
        // is far from its frame (see `maxWait`).
        const hit =
          tooFar(frame, triggers, timing.maxWait, this.n) ||
          (this.prevFrame !== null && crossed(this.prevFrame, frame, triggers, this.n));
        if (hit) {
          if (
            this.keysOf(pending)
              .slice(0, 1)
              .every((k) => isReady(this.els[k]))
          ) {
            void this.startScene(pending);
          } else if (!this.state.loading) {
            this.set({ loading: true, wait: null });
          }
        }
      }
      this.prevFrame = frame;
    });
  }

  /** Milliseconds until the idle loop reaches one of the frames a scene can start at. */
  private idleWait(scene: SceneName): number | null {
    const idle = this.els.idle;
    if (idle.paused || idle.error) return null;
    const timing = isPage(scene) ? this.tl.pages[scene].in : this.tl.shorts[scene];
    const now = frameAt(idle.currentTime, this.n, this.fps);
    const triggers = triggerFrames(timing.startPhases, this.n);
    if (tooFar(now, triggers, timing.maxWait, this.n)) return 0;
    const frames = waitFrames(now, triggers, this.n);
    return skipWallMs(frames, this.fps, this.skipOptions());
  }

  /**
   * The visitor chose a scene. It reacts at once: the state changes in this call, so the page can
   * show it. If she is still finishing another animation, the choice is kept and starts when she
   * is back in her idle pose.
   */
  request(scene: SceneName, carry: { ms: number; at: number } | null = null) {
    const { mode, ui } = this.state;
    if (mode === "outro" || mode === "returning" || mode === "short") {
      if (!ui) return;
      // Chosen while she is still handing back to the idle loop: it starts as soon as she idles.
      // Its first video loads now, and the wait shown is the real one: the rest of the hand-over
      // and then the idle loop's wait for the frame the entrance starts on.
      this.after = scene;
      this.warm(scene);
      this.prime(scene);
      this.refreshAfter(scene);
      return;
    }
    if (mode !== "idle" && mode !== "queued") return;
    this.warm(scene);
    this.prime(scene);
    this.pending = scene;
    // Reduced motion, or an idle loop that cannot play (no codec): there is no frame to wait for.
    if (this.opts.reduced || this.els.idle.error) {
      void this.startScene(scene);
      return;
    }
    const first = this.els[this.keysOf(scene)[0]!];
    const loading = !isReady(first);
    const ms = loading ? null : this.idleWait(scene);
    // A wait that was already running (the choice was made during the hand-over) keeps running if
    // it is still right, so the bar does not start again.
    const now = performance.now();
    const keep = carry !== null && ms !== null && Math.abs(carry.ms - (now - carry.at) - ms) < 300;
    this.set({
      mode: "queued",
      scene,
      loading,
      next: null,
      wait: keep ? carry : ms === null ? null : { ms, at: now },
    });
    const phases = isPage(scene)
      ? this.tl.pages[scene].in.startPhases
      : this.tl.shorts[scene].startPhases;
    this.startSkip(this.els.idle, triggerFrames(phases, this.n), this.n);
  }

  /** Frames of the idle loop's wait for an entrance, from the moment she is handed back to it. */
  private afterEstimate(scene: SceneName): number | null {
    const exit = this.exit;
    if (!exit) return null;
    const { clip, back } = exit;
    const timing = isPage(scene) ? this.tl.pages[scene].in : this.tl.shorts[scene];
    const phases = timing.startPhases;
    // The video plays on to the frame the hand-over starts at, then the idle loop dissolves in.
    const toSync = Math.max(0, back.syncFrame - LEAD_FRAMES - clip.currentTime * this.fps);
    const blend = (((this.opts.reduced ? 380 : back.blendMs) + 40) / 1000) * this.fps;
    // The idle loop starts a few frames after the matching phase, and runs while it dissolves in.
    const phase = wrapFrame(back.syncPhase + START_LATENCY - LEAD_FRAMES + blend, this.n);
    const triggers = triggerFrames(phases, this.n);
    const wait = tooFar(phase, triggers, timing.maxWait, this.n)
      ? 0
      : waitFrames(phase, triggers, this.n);
    // Measured: the entrance starts about 0.15 s after the idle loop reaches its frame.
    return (
      ((toSync + blend) / this.fps) * 1000 + skipWallMs(wait, this.fps, this.skipOptions()) + 150
    );
  }

  /** Work out the wait for the scene chosen during the hand-over, and follow its first video. */
  private refreshAfter(scene: SceneName) {
    const first = this.els[this.keysOf(scene)[0]!];
    const loading = !isReady(first);
    const ms = loading ? null : this.afterEstimate(scene);
    this.afterWait = ms === null ? null : { ms, at: performance.now() };
    this.set({ next: scene, loading, wait: this.afterWait });
    if (loading) {
      // Show the real state of the load, and the wait once the video is ready.
      const ready = () => {
        first.removeEventListener("canplay", ready);
        first.removeEventListener("loadeddata", ready);
        if (this.after === scene && this.state.next === scene && isReady(first)) {
          this.refreshAfter(scene);
        }
      };
      first.addEventListener("canplay", ready);
      first.addEventListener("loadeddata", ready);
    }
  }

  /** Leave the queue. */
  cancel() {
    if (this.after) {
      this.unprime(this.after);
      this.after = null;
      this.afterWait = null;
      this.set({ next: null, loading: false, wait: null });
      return;
    }
    if (this.state.mode !== "queued") return;
    this.stopSkip();
    this.unprime(this.pending);
    this.pending = null;
    this.set({ mode: "idle", scene: null, loading: false, wait: null });
  }

  private async startScene(scene: SceneName) {
    if (this.destroyed || (this.state.mode !== "queued" && this.state.mode !== "idle")) return;
    this.stopSkip();
    this.pending = null;
    this.poseBack = false;
    const page = isPage(scene);
    const key: VideoKey = page ? `${scene}-in` : scene;
    const el = this.use(key);
    const timing = page ? this.tl.pages[scene].in : this.tl.shorts[scene];
    const idle = this.els.idle;
    this.warmed = scene;
    // The loop starts when the entrance ends: have it loaded by then.
    if (page) this.use(`${scene}-loop`);
    this.set({ mode: page ? "intro" : "short", scene, loading: false, wait: null });
    this.stopWatch?.();
    if (this.opts.reduced && page) {
      // No intro: the page loop shows its first frame.
      const loop = this.use(`${scene}-loop`);
      loop.currentTime = 0;
      await this.swap(loop, idle, 280);
      this.set({ mode: "page" });
      return;
    }
    const ok = await this.startAt(el, 0);
    if (!ok) {
      if (page) {
        // The video cannot play, but the page is the point: open it over the still picture.
        this.degraded = true;
        this.set({ mode: "page", scene });
        return;
      }
      this.set({ mode: "idle", scene: null });
      this.watchIdle();
      return;
    }
    // The idle picture, still moving under the new one, eases to the new one's camera.
    const ms = this.opts.reduced ? 280 : timing.blendMs;
    if (timing.align !== 1) this.zoom(idle, 1 / timing.align, ms);
    await this.swap(el, idle, ms);
    this.zoomNow(idle, 1);
    if (page) {
      // Hand over to the loop when she is in the page's pose, not when the entrance ends: the
      // content shows as soon as she is posed. (The start is a few frames early, as everywhere.)
      const hand = this.tl.pages[scene].in.handFrame - LEAD_FRAMES;
      this.stopWatch = watchFrames(el, (t) => {
        if (t * this.fps >= hand) void this.handToPage(scene);
      });
      el.addEventListener("ended", () => void this.handToPage(scene), { once: true });
    } else {
      const back = this.tl.shorts[scene].back;
      this.exit = { clip: el, back };
      this.stopWatch = watchFrames(el, (t) => {
        this.watchBack(t * this.fps, back, el, scene);
      });
      el.addEventListener("ended", () => void this.toIdle(el, back, scene), { once: true });
    }
  }

  /** While an exit or a short plays: bring the panel back, then hand over to the idle loop. */
  private watchBack(frame: number, back: Back, clip: HTMLVideoElement, scene: SceneName) {
    if (!this.poseBack && frame >= back.uiFrame) {
      this.poseBack = true;
      this.set({});
    }
    if (frame >= back.syncFrame - LEAD_FRAMES) void this.toIdle(clip, back, scene);
  }

  private async handToPage(scene: PageName) {
    if (this.destroyed || this.state.mode !== "intro" || this.state.scene !== scene) return;
    this.set({ mode: "returning" }); // blocks a second hand-over
    this.stopWatch?.();
    const from = this.els[`${scene}-in`];
    const loop = this.use(`${scene}-loop`);
    this.use(`${scene}-out`);
    // From the pose frame the entrance is the page loop itself: the loop starts at the frame that
    // matches the entrance now (and the frames it takes to start), so the two play together.
    const page = this.tl.pages[scene];
    const phase = wrapFrame(
      Math.round(from.currentTime * this.fps) + page.in.loopOffset + START_LATENCY,
      page.loop.frames,
    );
    await this.startAt(loop, phase / this.fps);
    if (this.destroyed) return;
    const dissolve = this.swap(loop, from, HANDOVER_MS);
    // She is in the pose: the page shows now, while the entrance finishes dissolving away.
    this.set({ mode: "page", scene });
    await dissolve;
    from.currentTime = 0;
    this.opts.detach?.(`${scene}-in`, from);
    if (this.leaveAsked) {
      this.leaveAsked = false;
      this.leave();
    }
  }

  /**
   * The visitor leaves a page. Its exit plays, then the idle loop carries on. The call changes
   * the state at once; the exit itself starts when the page loop reaches the frame it was cut at.
   */
  leave() {
    const { mode, scene } = this.state;
    if (!scene || !isPage(scene)) return;
    if (mode === "intro") {
      this.leaveAsked = true;
      this.set({ leaving: true });
      return;
    }
    if (mode !== "page") return;
    const page = this.tl.pages[scene];
    const loop = this.els[`${scene}-loop`];
    const out = this.use(`${scene}-out`);
    if (this.degraded) {
      this.degraded = false;
      this.set({ mode: "idle", scene: null, leaving: false });
      return;
    }
    if (this.opts.reduced) {
      this.set({ leaving: true });
      void this.swap(this.els.idle, loop, 380).then(() => {
        this.set({ mode: "idle", scene: null, leaving: false });
      });
      return;
    }
    const n = page.loop.frames;
    const triggers = triggerFrames([page.out.startPhase], n);
    const here = frameAt(loop.currentTime, n, this.fps);
    const frames = tooFar(here, triggers, page.out.maxWait, n) ? 0 : waitFrames(here, triggers, n);
    this.set({
      mode: "leaving",
      leaving: true,
      wait: { ms: skipWallMs(frames, this.fps, this.skipOptions()), at: performance.now() },
    });
    this.startSkip(loop, triggers, n);
    this.stopWatch?.();
    this.prevFrame = null;
    this.stopWatch = watchFrames(loop, (t) => {
      const frame = frameAt(t, n, this.fps);
      const hit =
        tooFar(frame, triggers, page.out.maxWait, n) ||
        (this.prevFrame !== null && crossed(this.prevFrame, frame, triggers, n));
      this.prevFrame = frame;
      if (hit && isReady(out)) void this.startOutro(scene);
    });
  }

  private async startOutro(scene: PageName) {
    if (this.destroyed || this.state.mode !== "leaving") return;
    this.stopSkip();
    const timing = this.tl.pages[scene].out;
    // The way back is over when she is in her idle pose (`uiFrame`): that is how long the screen
    // that says so lasts (a few frames more, for the video to start).
    this.set({
      mode: "outro",
      wait: {
        ms: (timing.uiFrame / this.fps) * 1000 + (START_LATENCY / this.fps) * 1000,
        at: performance.now(),
      },
    });
    this.stopWatch?.();
    const out = this.els[`${scene}-out`];
    const loop = this.els[`${scene}-loop`];
    const ok = await this.startAt(out, 0);
    if (!ok) {
      await this.toIdle(loop, timing, scene, true);
      return;
    }
    await this.swap(out, loop, HANDOVER_MS);
    loop.currentTime = 0;
    this.opts.detach?.(`${scene}-loop`, loop);
    this.exit = { clip: out, back: timing };
    this.stopWatch = watchFrames(out, (t) => {
      this.watchBack(t * this.fps, timing, out, scene);
    });
    out.addEventListener("ended", () => void this.toIdle(out, timing, scene), { once: true });
  }

  /**
   * Hand a video that is back in its idle pose over to the idle loop. The idle loop starts at the
   * frame that matches the video now, the two play together, and the idle picture dissolves in
   * (easing its scale to the video's camera first, so the edges do not jump).
   */
  private async toIdle(from: HTMLVideoElement, back: Back, scene: SceneName, immediate = false) {
    if (this.destroyed || this.state.scene !== scene) return;
    if (this.state.mode === "returning" || this.state.mode === "idle") return;
    this.stopWatch?.();
    this.set({ mode: "returning" });
    // The idle loop is out of sight and paused: this is where it takes the size the device
    // asks for now, if the performance level stepped down while the page played.
    const idle = this.use("idle");
    const reduced = this.opts.reduced;
    const ahead = from.currentTime * this.fps - back.syncFrame + START_LATENCY;
    const phase = immediate || reduced ? back.syncPhase : wrapFrame(back.syncPhase + ahead, this.n);
    const ms = reduced ? 380 : back.blendMs;
    this.zoomNow(idle, back.align === 1 ? 1 : 1 / back.align);
    if (reduced) idle.currentTime = 0;
    else await this.startAt(idle, phase / this.fps);
    if (back.align !== 1) this.zoom(idle, 1, ms);
    await this.swap(idle, from, ms);
    this.zoomNow(idle, 1);
    from.currentTime = 0;
    this.releaseScene(scene);
    if (this.warmed === scene) this.warmed = null;
    this.poseBack = false;
    this.set({ mode: "idle", scene: null, loading: false, leaving: false, wait: null });
    if (!reduced) this.watchIdle();
    // Something chosen while she was finishing starts now.
    this.exit = null;
    const after = this.after;
    if (after) {
      const carry = this.afterWait;
      this.after = null;
      this.afterWait = null;
      this.set({ next: null });
      this.request(after, carry);
    }
  }

  /** The tab is hidden or shown again: stop the picture and the sound, then carry on. */
  setHidden(hidden: boolean) {
    const top = this.topVideo();
    if (!top || this.state.mode === "boot") return;
    if (hidden) top.pause();
    else if (!(this.opts.reduced && top === this.els.idle)) void top.play().catch(() => undefined);
  }

  destroy() {
    this.destroyed = true;
    this.stopWatch?.();
    this.stopSkip();
    for (const el of this.all()) el.pause();
  }
}
