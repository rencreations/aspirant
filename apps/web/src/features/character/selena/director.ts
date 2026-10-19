import { crossed, frameAt, LEAD_FRAMES, triggerFrames, wrapFrame } from "./phase";
import {
  SELENA_EXTRA_FRAMES,
  SELENA_FPS,
  SELENA_LOOP_FRAMES,
  SELENA_PAGES,
  SELENA_SHORTS,
} from "./timeline.generated";

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
}

export type StageElements = Record<VideoKey, HTMLVideoElement>;

interface DirectorOptions {
  /** Read at the moment a video starts, so the sound button is always honoured. */
  muted: () => boolean;
  /** Reduced motion: nothing starts by itself and nothing loops. */
  reduced: boolean;
  onState: (state: StageState) => void;
  /** Called before a video is first used, so the page can give it its source. */
  attach?: (key: VideoKey, el: HTMLVideoElement) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const EARLY = LEAD_FRAMES + SELENA_EXTRA_FRAMES;
const HANDOVER_MS = 110;

/** Resolve at the next frame the video presents (or after `ms`, so a stall never hangs). */
function firstFrame(video: HTMLVideoElement, ms = 900): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    window.setTimeout(finish, ms);
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => {
        finish();
      });
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
 * swap is a short dissolve between two pictures that are nearly the same:
 *
 *   welcome -> idle   when the welcome is a few frames from its end
 *   idle -> intro     when the idle loop reaches the frame the entrance was cut from
 *   intro -> page     when the entrance is a few frames from its end (the page loop begins there)
 *   page -> outro     after `leave()`, when the page loop reaches the frame the exit starts on
 *   outro -> idle     when the exit is a few frames from its end; the idle loop resumes at the
 *                     frame that matches the exit's last
 *   idle -> short     like idle -> intro, and back to idle like outro -> idle
 *
 * Nothing here touches React. The page passes the elements and listens to `onState`.
 */
export class SelenaDirector {
  private state: StageState = { mode: "boot", scene: null, loading: false };
  private stopWatch: (() => void) | null = null;
  private pending: SceneName | null = null;
  private prevFrame: number | null = null;
  private handed = false;
  private destroyed = false;
  private leaveAsked = false;
  /** A page opened without its video (no codec): it shows over the still picture. */
  private degraded = false;

  constructor(
    private readonly els: StageElements,
    private readonly opts: DirectorOptions,
  ) {
    for (const el of this.all()) el.dataset.layer = "off";
    // Until it plays, the welcome shows its own first frame, so the animation does not pop in
    // over a different picture. Reduced motion never plays it.
    if (!opts.reduced) this.use("welcome").dataset.layer = "front";
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

  private set(next: Partial<StageState>) {
    this.state = { ...this.state, ...next };
    this.opts.onState(this.state);
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

  private async play(video: HTMLVideoElement, silent = false): Promise<boolean> {
    video.muted = silent || this.opts.muted();
    try {
      await video.play();
      return true;
    } catch {
      video.muted = true;
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Set the sound on whatever is playing (the sound button). */
  setMuted(muted: boolean) {
    for (const el of this.all()) el.muted = muted;
  }

  /** Get a scene's videos ready (the pointer is on its button). */
  warm(scene: SceneName) {
    for (const key of this.keysOf(scene)) this.use(key);
  }

  async start() {
    if (this.destroyed || this.state.mode !== "boot") return;
    const welcome = this.use("welcome");
    const idle = this.use("idle");
    if (this.opts.reduced) {
      // No motion: the idle loop shows its first frame and stays there.
      idle.currentTime = 0;
      await this.swap(idle, null, 0);
      this.set({ mode: "idle" });
      return;
    }
    welcome.currentTime = 0;
    const ok = await this.play(welcome);
    if (!ok || this.destroyed) {
      await this.handToIdle();
      return;
    }
    await firstFrame(welcome);
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
    idle.currentTime = 0;
    await this.play(idle, true);
    await firstFrame(idle);
    await this.swap(idle, this.topVideo() === welcome ? welcome : null, HANDOVER_MS);
    welcome.currentTime = 0;
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
    this.leaveAsked = false;
    this.degraded = false;
    this.handed = true;
    const idle = this.use("idle");
    for (const el of this.all()) {
      if (el === idle) continue;
      el.pause();
      el.dataset.layer = "off";
    }
    idle.currentTime = 0;
    if (!this.opts.reduced) {
      await this.play(idle, true);
      await firstFrame(idle, 500);
    }
    idle.style.setProperty("--xfade", "0ms");
    idle.dataset.layer = "front";
    this.set({ mode: "idle", scene: null, loading: false });
    if (!this.opts.reduced) this.watchIdle();
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
            this.set({ loading: true });
          }
        }
      }
      this.prevFrame = frame;
    });
  }

  /** The visitor chose a scene. */
  request(scene: SceneName) {
    const { mode } = this.state;
    if (mode !== "idle" && mode !== "queued") return;
    this.warm(scene);
    this.pending = scene;
    // Reduced motion, or an idle loop that cannot play (no codec): there is no frame to wait for.
    if (this.opts.reduced || this.els.idle.error) {
      void this.startScene(scene);
      return;
    }
    const first = this.els[this.keysOf(scene)[0]!];
    this.set({ mode: "queued", scene, loading: !isReady(first) });
  }

  /** Leave the queue. */
  cancel() {
    if (this.state.mode !== "queued") return;
    this.pending = null;
    this.set({ mode: "idle", scene: null, loading: false });
  }

  private async startScene(scene: SceneName) {
    if (this.destroyed || (this.state.mode !== "queued" && this.state.mode !== "idle")) return;
    this.pending = null;
    const page = isPage(scene);
    const key: VideoKey = page ? `${scene}-in` : scene;
    const el = this.use(key);
    const timing = page ? SELENA_PAGES[scene].in : SELENA_SHORTS[scene];
    this.set({ mode: page ? "intro" : "short", scene, loading: false });
    this.stopWatch?.();
    if (this.opts.reduced && page) {
      // No intro: the page loop shows its first frame.
      const loop = this.use(`${scene}-loop`);
      loop.currentTime = 0;
      await this.swap(loop, this.els.idle, 280);
      this.set({ mode: "page" });
      return;
    }
    el.currentTime = 0;
    const ok = await this.play(el);
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
    await firstFrame(el);
    await this.swap(el, this.els.idle, this.opts.reduced ? 280 : timing.blendMs);
    const lead = EARLY / SELENA_FPS;
    const done = () => {
      if (page) void this.handToPage(scene);
      else void this.toIdle(el, SELENA_SHORTS[scene].endPhase, SELENA_SHORTS[scene].blendMs, scene);
    };
    this.stopWatch = watchFrames(el, (t) => {
      if (Number.isFinite(el.duration) && t >= el.duration - lead) done();
    });
    el.addEventListener("ended", done, { once: true });
  }

  private async handToPage(scene: PageName) {
    if (this.destroyed || this.state.mode !== "intro" || this.state.scene !== scene) return;
    this.set({ mode: "returning" }); // blocks a second hand-over
    this.stopWatch?.();
    const from = this.els[`${scene}-in`];
    const loop = this.use(`${scene}-loop`);
    this.use(`${scene}-out`);
    loop.currentTime = 0;
    await this.play(loop, true);
    await firstFrame(loop);
    await this.swap(loop, from, HANDOVER_MS);
    from.currentTime = 0;
    this.set({ mode: "page", scene });
    if (this.leaveAsked) {
      this.leaveAsked = false;
      this.leave();
    }
  }

  /** The visitor leaves a page. Its exit plays, then the idle loop carries on. */
  leave() {
    const { mode, scene } = this.state;
    if (!scene || !isPage(scene)) return;
    if (mode === "intro") {
      this.leaveAsked = true;
      return;
    }
    if (mode !== "page") return;
    if (this.degraded) {
      this.degraded = false;
      this.set({ mode: "idle", scene: null });
      return;
    }
    const page = SELENA_PAGES[scene];
    const loop = this.els[`${scene}-loop`];
    const out = this.use(`${scene}-out`);
    if (this.opts.reduced) {
      void this.swap(this.els.idle, loop, 380).then(() => {
        this.set({ mode: "idle", scene: null });
      });
      return;
    }
    this.set({ mode: "leaving" });
    this.stopWatch?.();
    this.prevFrame = null;
    const n = page.loop.frames;
    const triggers = triggerFrames([page.out.startPhase], n);
    this.stopWatch = watchFrames(loop, (t) => {
      const frame = frameAt(t, n);
      const hit = this.prevFrame !== null && crossed(this.prevFrame, frame, triggers, n);
      this.prevFrame = frame;
      if (hit && isReady(out)) void this.startOutro(scene);
    });
  }

  private async startOutro(scene: PageName) {
    if (this.destroyed || this.state.mode !== "leaving") return;
    this.set({ mode: "outro" });
    this.stopWatch?.();
    const out = this.els[`${scene}-out`];
    const loop = this.els[`${scene}-loop`];
    const timing = SELENA_PAGES[scene].out;
    out.currentTime = 0;
    const ok = await this.play(out);
    if (!ok) {
      await this.toIdle(loop, timing.endPhase, timing.blendMs, scene, true);
      return;
    }
    await firstFrame(out);
    await this.swap(out, loop, HANDOVER_MS);
    loop.currentTime = 0;
    const lead = EARLY / SELENA_FPS;
    const done = () => {
      void this.toIdle(out, timing.endPhase, timing.blendMs, scene);
    };
    this.stopWatch = watchFrames(out, (t) => {
      if (Number.isFinite(out.duration) && t >= out.duration - lead) done();
    });
    out.addEventListener("ended", done, { once: true });
  }

  /** Hand a finished video back to the idle loop at the frame that matches its last. */
  private async toIdle(
    from: HTMLVideoElement,
    endPhase: number,
    blendMs: number,
    scene: SceneName,
    immediate = false,
  ) {
    if (this.destroyed || this.state.scene !== scene) return;
    if (this.state.mode === "returning" || this.state.mode === "idle") return;
    this.stopWatch?.();
    this.set({ mode: "returning" });
    const idle = this.els.idle;
    // Resume a few frames early: the video keeps playing for the frames the idle loop needs to start.
    const early = immediate || this.opts.reduced ? 0 : EARLY;
    idle.currentTime = this.opts.reduced
      ? 0
      : wrapFrame(endPhase - early, SELENA_LOOP_FRAMES) / SELENA_FPS;
    if (!this.opts.reduced) await this.play(idle, true);
    await firstFrame(idle, 500);
    await this.swap(idle, from, this.opts.reduced ? 380 : blendMs);
    from.currentTime = 0;
    this.set({ mode: "idle", scene: null, loading: false });
    if (!this.opts.reduced) this.watchIdle();
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
