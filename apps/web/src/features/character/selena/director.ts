import { crossed, frameAt, LEAD_FRAMES, triggerFrames, wrapFrame } from "./phase";
import { SELENA_CLIPS, SELENA_FPS, SELENA_WELCOME_EXTRA_FRAMES } from "./timeline.generated";

export type ClipName = keyof typeof SELENA_CLIPS;
export const CLIP_NAMES = Object.keys(SELENA_CLIPS) as ClipName[];

/**
 * - boot: nothing plays yet, the still image shows.
 * - welcome: the welcome animation.
 * - loop: the idle animation loops.
 * - queued: a clip was asked for and waits for the loop to reach its start frame.
 * - clip: a clip plays.
 * - returning: a clip is handing back to the loop.
 */
type StageMode = "boot" | "welcome" | "loop" | "queued" | "clip" | "returning";

export interface StageState {
  mode: StageMode;
  /** The clip that is queued or playing. */
  clip: ClipName | null;
  /** True while a queued clip is still downloading. */
  loading: boolean;
}

export interface StageElements {
  welcome: HTMLVideoElement;
  loop: HTMLVideoElement;
  clips: Record<ClipName, HTMLVideoElement>;
}

export interface DirectorOptions {
  /** Read at the moment a video starts, so the sound button is always honoured. */
  muted: () => boolean;
  /** Reduced motion: nothing starts by itself, clips play at once. */
  reduced: boolean;
  onState: (state: StageState) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

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

/** Enough of a clip is downloaded to play through the first seconds without a stall. */
function isReady(video: HTMLVideoElement): boolean {
  // A video that cannot load (no codec, a network error) counts as ready: the page then falls
  // back to the still image instead of waiting for ever.
  if (video.error) return true;
  if (video.readyState >= 4) return true;
  if (video.readyState < 3 || video.buffered.length === 0) return false;
  const need = Math.min(Number.isFinite(video.duration) ? video.duration : 8, 8);
  return video.buffered.end(video.buffered.length - 1) >= need;
}

/**
 * Runs the Selena stage. Four kinds of video sit on top of each other: the welcome animation, the
 * idle loop and one video per action clip. Only one is on top at a time. The hand-overs are cut
 * on matching frames (see scripts/selena/build.py), so each swap is a short dissolve between two
 * pictures that are nearly the same:
 *
 *   welcome -> loop    when the welcome is a few frames from its end
 *   loop    -> clip    when the loop reaches the frame the clip was cut from
 *   clip    -> loop    when the clip is a few frames from its end, the loop resumes at the
 *                      frame that matches the clip's last
 *
 * Nothing here touches React. The page passes the elements and listens to `onState`.
 */
export class SelenaDirector {
  private state: StageState = { mode: "boot", clip: null, loading: false };
  private stopWatch: (() => void) | null = null;
  private pending: ClipName | null = null;
  private prevFrame: number | null = null;
  private handed = false;
  private destroyed = false;
  private requested = new Set<ClipName>();

  constructor(
    private readonly els: StageElements,
    private readonly opts: DirectorOptions,
  ) {
    for (const el of this.all()) el.dataset.layer = "off";
    // Until it plays, the welcome shows its own first frame, so the animation does not pop in
    // over a different picture. Reduced motion never plays it.
    if (!opts.reduced) els.welcome.dataset.layer = "front";
  }

  get current(): StageState {
    return this.state;
  }

  private all(): HTMLVideoElement[] {
    return [this.els.welcome, this.els.loop, ...Object.values(this.els.clips)];
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

  private async playMuted(video: HTMLVideoElement, silent = false): Promise<boolean> {
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
    for (const el of [this.els.welcome, ...Object.values(this.els.clips)]) el.muted = muted;
  }

  /** Start a download early (the pointer is on its button). */
  warm(name: ClipName) {
    if (this.requested.has(name)) return;
    this.requested.add(name);
    const el = this.els.clips[name];
    el.preload = "auto";
    el.load();
  }

  async start() {
    if (this.destroyed || this.state.mode !== "boot") return;
    const { welcome, loop } = this.els;
    if (this.opts.reduced) {
      // No motion: the loop shows its first frame and stays there.
      loop.currentTime = 0;
      await this.swap(loop, null, 0);
      this.set({ mode: "loop" });
      return;
    }
    welcome.currentTime = 0;
    const ok = await this.playMuted(welcome);
    if (!ok || this.destroyed) {
      await this.handToLoop();
      return;
    }
    await firstFrame(welcome);
    await this.swap(welcome, null, 0);
    this.set({ mode: "welcome" });
    const lead = (SELENA_WELCOME_EXTRA_FRAMES + LEAD_FRAMES) / SELENA_FPS;
    this.stopWatch = watchFrames(welcome, (t) => {
      if (Number.isFinite(welcome.duration) && t >= welcome.duration - lead) void this.handToLoop();
    });
    welcome.addEventListener(
      "ended",
      () => {
        void this.handToLoop();
      },
      { once: true },
    );
  }

  /** The visitor skips the welcome. */
  skipWelcome() {
    const w = this.els.welcome;
    if (this.state.mode !== "welcome" || !Number.isFinite(w.duration)) return;
    w.currentTime = Math.max(0, w.duration - 0.25);
  }

  private async handToLoop() {
    if (this.handed || this.destroyed) return;
    this.handed = true;
    this.stopWatch?.();
    const { loop, welcome } = this.els;
    loop.currentTime = 0;
    await this.playMuted(loop, true);
    await firstFrame(loop);
    await this.swap(loop, this.topVideo() === welcome ? welcome : null, 110);
    welcome.currentTime = 0;
    this.set({ mode: "loop" });
    this.watchLoop();
  }

  private watchLoop() {
    this.stopWatch?.();
    this.prevFrame = null;
    this.stopWatch = watchFrames(this.els.loop, (t) => {
      const frame = frameAt(t);
      const pending = this.pending;
      if (pending && this.state.mode === "queued") {
        const triggers = triggerFrames(SELENA_CLIPS[pending].startPhases);
        const hit = this.prevFrame !== null && crossed(this.prevFrame, frame, triggers);
        if (hit) {
          if (isReady(this.els.clips[pending])) void this.startClip(pending);
          else if (!this.state.loading) this.set({ loading: true });
        }
      }
      this.prevFrame = frame;
    });
  }

  /** The visitor chose a clip. */
  request(name: ClipName) {
    const { mode } = this.state;
    if (mode !== "loop" && mode !== "queued") return;
    this.warm(name);
    this.pending = name;
    // Reduced motion, or a loop that cannot play (no codec): there is no phase to wait for.
    if (this.opts.reduced || this.els.loop.error) {
      void this.startClip(name);
      return;
    }
    this.set({ mode: "queued", clip: name, loading: !isReady(this.els.clips[name]) });
  }

  /** Leave the queue or the clip. */
  cancel() {
    if (this.state.mode === "queued") {
      this.pending = null;
      this.set({ mode: "loop", clip: null, loading: false });
    } else if (this.state.mode === "clip" && this.state.clip) {
      void this.endClip(this.state.clip, true);
    }
  }

  private async startClip(name: ClipName) {
    if (this.destroyed || this.state.mode === "clip") return;
    this.pending = null;
    const clip = this.els.clips[name];
    this.set({ mode: "clip", clip: name, loading: false });
    this.stopWatch?.();
    clip.currentTime = 0;
    const ok = await this.playMuted(clip);
    if (!ok) {
      this.set({ mode: "loop", clip: null });
      this.watchLoop();
      return;
    }
    await firstFrame(clip);
    await this.swap(clip, this.els.loop, this.opts.reduced ? 220 : SELENA_CLIPS[name].blendMs);
    const lead = (LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES) / SELENA_FPS;
    this.stopWatch = watchFrames(clip, (t) => {
      if (Number.isFinite(clip.duration) && t >= clip.duration - lead)
        void this.endClip(name, false);
    });
    clip.addEventListener(
      "ended",
      () => {
        void this.endClip(name, false);
      },
      { once: true },
    );
  }

  private async endClip(name: ClipName, aborted: boolean) {
    if (this.destroyed || this.state.mode !== "clip" || this.state.clip !== name) return;
    this.stopWatch?.();
    const clip = this.els.clips[name];
    const { loop } = this.els;
    this.set({ mode: "returning" }); // blocks a second end while the hand-over runs
    // The loop is told to resume a few frames before the matching frame, because the clip keeps
    // playing for the few frames the loop needs to start.
    const early = aborted ? 0 : LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES;
    loop.currentTime = this.opts.reduced
      ? 0
      : wrapFrame(SELENA_CLIPS[name].endPhase - early) / SELENA_FPS;
    if (!this.opts.reduced) {
      await this.playMuted(loop, true);
    }
    await firstFrame(loop, 500);
    await this.swap(loop, clip, aborted || this.opts.reduced ? 380 : SELENA_CLIPS[name].blendMs);
    clip.currentTime = 0;
    this.set({ mode: "loop", clip: null, loading: false });
    if (!this.opts.reduced) this.watchLoop();
  }

  /** The tab is hidden or shown again: stop the picture and the sound, then carry on. */
  setHidden(hidden: boolean) {
    const top = this.topVideo();
    if (!top || this.state.mode === "boot") return;
    if (hidden) top.pause();
    else if (!(this.opts.reduced && top === this.els.loop)) void top.play().catch(() => undefined);
  }

  destroy() {
    this.destroyed = true;
    this.stopWatch?.();
    for (const el of this.all()) el.pause();
  }
}
