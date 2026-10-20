import { crossed, frameAt, LEAD_FRAMES, triggerFrames, waitFrames, wrapFrame } from "./phase";
import { SELENA_EXTRA_FRAMES, SELENA_FPS, SELENA_PAGES, SELENA_SHORTS } from "./timeline.generated";

export type PageName = keyof typeof SELENA_PAGES;
export type ShortName = keyof typeof SELENA_SHORTS;
export type SceneName = PageName | ShortName;

const PAGE_NAMES = Object.keys(SELENA_PAGES) as PageName[];
export const SHORT_NAMES = Object.keys(SELENA_SHORTS) as ShortName[];

export type VideoKey = "welcome" | "idle" | `${PageName}-${"in" | "loop" | "out"}` | ShortName;

export const VIDEO_KEYS: VideoKey[] = [
  "welcome",
  "idle",
  ...PAGE_NAMES.flatMap((p) => [`${p}-in`, `${p}-loop`, `${p}-out`] as const),
  ...SHORT_NAMES,
];

/** The file name of a video (inside its size folder). */
export function videoFile(key: VideoKey): string {
  if (key === "welcome") return "welcome.mp4";
  if (key === "idle") return "idle.mp4";
  if (key in SELENA_SHORTS) return SELENA_SHORTS[key as ShortName].file;
  const [page, part] = key.split("-") as [PageName, "in" | "loop" | "out"];
  return SELENA_PAGES[page][part].file;
}

const isPage = (scene: SceneName): scene is PageName => scene in SELENA_PAGES;

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
  /**
   * How long the wait for the matching frame is, measured when it began. The page uses it to run
   * a waiting animation of exactly that length. Null when it is not known.
   */
  wait: { ms: number; at: number } | null;
}

export type StageElements = Record<VideoKey, HTMLVideoElement>;

interface DirectorOptions {
  /** Reduced motion: nothing starts by itself and nothing loops. */
  reduced: boolean;
  /** Start on the idle loop with no welcome (the visitor came to one of her pages). */
  skipWelcome?: boolean;
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
const EARLY = LEAD_FRAMES + SELENA_EXTRA_FRAMES;
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
 * Runs the Selena stage. A video per piece sits on top of the others and only one is on top at a
 * time: the welcome, the idle loop, for each page an entrance, a loop and an exit, and the short
 * animations. Every hand-over is cut on matching frames (see scripts/selena/build.py), so each
 * swap is a dissolve between two pictures that are nearly the same:
 *
 *   welcome -> idle   when the welcome is a few frames from its end
 *   idle -> intro     when the idle loop reaches the frame the entrance was cut from
 *   intro -> page     when the entrance is a few frames from its end (the page loop begins there)
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
export class SelenaDirector {
  private state: StageState = {
    mode: "boot",
    scene: null,
    loading: false,
    ui: false,
    next: null,
    leaving: false,
    wait: null,
  };
  private stopWatch: (() => void) | null = null;
  private pending: SceneName | null = null;
  private after: SceneName | null = null;
  private prevFrame: number | null = null;
  private handed = false;
  private destroyed = false;
  private leaveAsked = false;
  /** She is back in her idle pose, so the panel may show before the hand-over has finished. */
  private poseBack = false;
  /** A page opened without its video (no codec): it shows over the still picture. */
  private degraded = false;
  /** The scene whose first video was warmed by a hover, so only one is ever held that way. */
  private warmed: SceneName | null = null;

  constructor(
    private readonly els: StageElements,
    private readonly opts: DirectorOptions,
  ) {
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
  idleClock(): { time: number; playing: boolean } | null {
    const idle = this.els.idle;
    if (idle.readyState === 0) return null;
    return { time: idle.currentTime, playing: !idle.paused && !idle.ended };
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
    const lead = EARLY / SELENA_FPS;
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
    this.pending = null;
    this.after = null;
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
      const frame = frameAt(t);
      const pending = this.pending;
      if (pending && this.state.mode === "queued") {
        const phases = isPage(pending)
          ? SELENA_PAGES[pending].in.startPhases
          : SELENA_SHORTS[pending].startPhases;
        const hit =
          this.prevFrame !== null && crossed(this.prevFrame, frame, triggerFrames(phases));
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
    const phases = isPage(scene)
      ? SELENA_PAGES[scene].in.startPhases
      : SELENA_SHORTS[scene].startPhases;
    const frames = waitFrames(frameAt(idle.currentTime), triggerFrames(phases));
    return (frames / SELENA_FPS) * 1000;
  }

  /**
   * The visitor chose a scene. It reacts at once: the state changes in this call, so the page can
   * show it. If she is still finishing another animation, the choice is kept and starts when she
   * is back in her idle pose.
   */
  request(scene: SceneName) {
    const { mode, ui } = this.state;
    if (mode === "outro" || mode === "returning" || mode === "short") {
      if (!ui) return;
      this.after = scene;
      this.set({ next: scene, wait: null });
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
    this.set({
      mode: "queued",
      scene,
      loading,
      next: null,
      wait: ms === null ? null : { ms, at: performance.now() },
    });
  }

  /** Leave the queue. */
  cancel() {
    if (this.after) {
      this.after = null;
      this.set({ next: null });
      return;
    }
    if (this.state.mode !== "queued") return;
    this.unprime(this.pending);
    this.pending = null;
    this.set({ mode: "idle", scene: null, loading: false, wait: null });
  }

  private async startScene(scene: SceneName) {
    if (this.destroyed || (this.state.mode !== "queued" && this.state.mode !== "idle")) return;
    this.pending = null;
    this.poseBack = false;
    const page = isPage(scene);
    const key: VideoKey = page ? `${scene}-in` : scene;
    const el = this.use(key);
    const timing = page ? SELENA_PAGES[scene].in : SELENA_SHORTS[scene];
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
    const lead = EARLY / SELENA_FPS;
    if (page) {
      this.stopWatch = watchFrames(el, (t) => {
        if (Number.isFinite(el.duration) && t >= el.duration - lead) void this.handToPage(scene);
      });
      el.addEventListener("ended", () => void this.handToPage(scene), { once: true });
    } else {
      const back = SELENA_SHORTS[scene].back;
      this.stopWatch = watchFrames(el, (t) => {
        this.watchBack(t * SELENA_FPS, back, el, scene);
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
    await this.startAt(loop, 0);
    await this.swap(loop, from, HANDOVER_MS);
    from.currentTime = 0;
    this.opts.detach?.(`${scene}-in`, from);
    this.set({ mode: "page", scene });
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
    const page = SELENA_PAGES[scene];
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
    const frames = waitFrames(frameAt(loop.currentTime, n), triggers, n);
    this.set({
      mode: "leaving",
      leaving: true,
      wait: { ms: (frames / SELENA_FPS) * 1000, at: performance.now() },
    });
    this.stopWatch?.();
    this.prevFrame = null;
    this.stopWatch = watchFrames(loop, (t) => {
      const frame = frameAt(t, n);
      const hit = this.prevFrame !== null && crossed(this.prevFrame, frame, triggers, n);
      this.prevFrame = frame;
      if (hit && isReady(out)) void this.startOutro(scene);
    });
  }

  private async startOutro(scene: PageName) {
    if (this.destroyed || this.state.mode !== "leaving") return;
    this.set({ mode: "outro", wait: null });
    this.stopWatch?.();
    const out = this.els[`${scene}-out`];
    const loop = this.els[`${scene}-loop`];
    const timing = SELENA_PAGES[scene].out;
    const ok = await this.startAt(out, 0);
    if (!ok) {
      await this.toIdle(loop, timing, scene, true);
      return;
    }
    await this.swap(out, loop, HANDOVER_MS);
    loop.currentTime = 0;
    this.opts.detach?.(`${scene}-loop`, loop);
    this.stopWatch = watchFrames(out, (t) => {
      this.watchBack(t * SELENA_FPS, timing, out, scene);
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
    const ahead = from.currentTime * SELENA_FPS - back.syncFrame + START_LATENCY;
    const phase = immediate || reduced ? back.syncPhase : wrapFrame(back.syncPhase + ahead);
    const ms = reduced ? 380 : back.blendMs;
    this.zoomNow(idle, back.align === 1 ? 1 : 1 / back.align);
    if (reduced) idle.currentTime = 0;
    else await this.startAt(idle, phase / SELENA_FPS);
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
    const after = this.after;
    if (after) {
      this.after = null;
      this.set({ next: null });
      this.request(after);
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
    for (const el of this.all()) el.pause();
  }
}
