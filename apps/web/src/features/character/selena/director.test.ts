import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLIP_NAMES, SelenaDirector, type StageElements, type StageState } from "./director";
import { LEAD_FRAMES } from "./phase";
import { SELENA_CLIPS, SELENA_FPS, SELENA_WELCOME_EXTRA_FRAMES } from "./timeline.generated";

/** Just enough of a video element, with the frame callback driven by the test. */
class FakeVideo {
  dataset: Record<string, string> = {};
  style = { setProperty: () => undefined };
  currentTime = 0;
  muted = false;
  preload = "none";
  readyState = 4;
  buffered = { length: 0, end: () => 0 };
  duration = 10;
  error: unknown = null;
  paused = true;
  plays = 0;
  loads = 0;
  private frames: Array<(now: number, meta: { mediaTime: number }) => void> = [];
  private listeners = new Map<string, Array<() => void>>();

  play() {
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loads += 1;
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  requestVideoFrameCallback(cb: (now: number, meta: { mediaTime: number }) => void) {
    this.frames.push(cb);
    return this.frames.length;
  }
  /** Present a frame at this media time. */
  tick(mediaTime: number) {
    this.currentTime = mediaTime;
    const due = this.frames.splice(0);
    for (const cb of due) cb(0, { mediaTime });
  }
}

function setup(options: { reduced?: boolean } = {}) {
  const welcome = new FakeVideo();
  welcome.duration = 15.8;
  const loop = new FakeVideo();
  loop.duration = 8.1;
  const clips = Object.fromEntries(CLIP_NAMES.map((n) => [n, new FakeVideo()])) as Record<
    (typeof CLIP_NAMES)[number],
    FakeVideo
  >;
  for (const n of CLIP_NAMES) clips[n].duration = SELENA_CLIPS[n].frames / SELENA_FPS;
  const states: StageState[] = [];
  const director = new SelenaDirector({ welcome, loop, clips } as unknown as StageElements, {
    muted: () => false,
    reduced: options.reduced ?? false,
    onState: (s) => states.push(s),
  });
  return { welcome, loop, clips, director, states };
}

const settle = () => vi.advanceTimersByTimeAsync(1500);

/** Start the director and play the welcome out until the loop runs. */
async function toLoop(ctx: ReturnType<typeof setup>) {
  void ctx.director.start();
  await settle();
  ctx.welcome.tick(ctx.welcome.duration - (LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES) / SELENA_FPS);
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SelenaDirector", () => {
  it("shows the welcome's first frame before it plays", () => {
    const ctx = setup();
    expect(ctx.welcome.dataset.layer).toBe("front");
    expect(ctx.loop.dataset.layer).toBe("off");
    expect(setup({ reduced: true }).welcome.dataset.layer).toBe("off");
  });

  it("plays the welcome, then hands over to the loop a few frames before the end", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");
    expect(ctx.welcome.dataset.layer).toBe("front");
    expect(ctx.loop.plays).toBe(0);

    // Not yet: well before the end.
    ctx.welcome.tick(5);
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");

    ctx.welcome.tick(
      ctx.welcome.duration - (LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES) / SELENA_FPS,
    );
    await settle();
    expect(ctx.director.current.mode).toBe("loop");
    expect(ctx.loop.plays).toBe(1);
    expect(ctx.loop.currentTime).toBe(0);
    expect(ctx.loop.dataset.layer).toBe("front");
    expect(ctx.welcome.dataset.layer).toBe("off");
    expect(ctx.welcome.paused).toBe(true);
  });

  it("skipping the welcome jumps to its last quarter second", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    ctx.director.skipWelcome();
    expect(ctx.welcome.currentTime).toBeCloseTo(ctx.welcome.duration - 0.25, 5);
  });

  it("ignores a clip request while the welcome plays", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    ctx.director.request("horizontal");
    expect(ctx.director.current.mode).toBe("welcome");
  });

  it("queues a clip and starts it when the loop reaches the clip's start frame", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.director.request("horizontal");
    expect(ctx.director.current).toMatchObject({ mode: "queued", clip: "horizontal" });
    expect(ctx.clips.horizontal.loads).toBe(1);

    const trigger = SELENA_CLIPS.horizontal.startPhases[0] - LEAD_FRAMES;
    for (const f of [trigger - 3, trigger - 2, trigger - 1]) ctx.loop.tick(f / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("queued");
    expect(ctx.clips.horizontal.plays).toBe(0);

    ctx.loop.tick(trigger / SELENA_FPS);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "clip", clip: "horizontal" });
    expect(ctx.clips.horizontal.plays).toBe(1);
    expect(ctx.clips.horizontal.currentTime).toBe(0);
    expect(ctx.clips.horizontal.dataset.layer).toBe("front");
    expect(ctx.loop.dataset.layer).toBe("off");
  });

  it("sees the trigger even when the screen skipped frames", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.director.request("vertical");
    const trigger = SELENA_CLIPS.vertical.startPhases[1] - LEAD_FRAMES;
    ctx.loop.tick((trigger - 4) / SELENA_FPS);
    ctx.loop.tick((trigger + 2) / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("clip");
  });

  it("waits while the clip is still downloading, and says so", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.clips.horizontal.readyState = 1;
    ctx.director.request("horizontal");
    expect(ctx.director.current.loading).toBe(true);
    const trigger = SELENA_CLIPS.horizontal.startPhases[0] - LEAD_FRAMES;
    ctx.loop.tick((trigger - 1) / SELENA_FPS);
    ctx.loop.tick(trigger / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("queued");
    expect(ctx.clips.horizontal.plays).toBe(0);

    ctx.clips.horizontal.readyState = 4;
    const again = SELENA_CLIPS.horizontal.startPhases[1] - LEAD_FRAMES;
    ctx.loop.tick((again - 1) / SELENA_FPS);
    ctx.loop.tick(again / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("clip");
  });

  it("returns to the loop at the clip's end phase, a few frames early", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.director.request("horizontal");
    const trigger = SELENA_CLIPS.horizontal.startPhases[0] - LEAD_FRAMES;
    ctx.loop.tick((trigger - 1) / SELENA_FPS);
    ctx.loop.tick(trigger / SELENA_FPS);
    await settle();
    const clip = ctx.clips.horizontal;

    clip.tick(clip.duration - 2);
    await settle();
    expect(ctx.director.current.mode).toBe("clip");

    clip.tick(clip.duration - (LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES) / SELENA_FPS);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "loop", clip: null });
    const early = LEAD_FRAMES + SELENA_WELCOME_EXTRA_FRAMES;
    expect(ctx.loop.currentTime).toBeCloseTo(
      (SELENA_CLIPS.horizontal.endPhase - early) / SELENA_FPS,
      5,
    );
    expect(ctx.loop.dataset.layer).toBe("front");
    expect(clip.dataset.layer).toBe("off");
    expect(clip.paused).toBe(true);
  });

  it("can leave the queue and a running clip", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.director.request("phone-empty");
    ctx.director.cancel();
    expect(ctx.director.current).toMatchObject({ mode: "loop", clip: null });

    ctx.director.request("phone-empty");
    const trigger = SELENA_CLIPS["phone-empty"].startPhases[0] - LEAD_FRAMES;
    ctx.loop.tick((trigger - 1) / SELENA_FPS);
    ctx.loop.tick(trigger / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("clip");
    ctx.director.cancel();
    await settle();
    expect(ctx.director.current.mode).toBe("loop");
    // An early exit resumes exactly at the end phase.
    expect(ctx.loop.currentTime).toBeCloseTo(SELENA_CLIPS["phone-empty"].endPhase / SELENA_FPS, 5);
  });

  it("starts a clip at once when the loop cannot play", async () => {
    const ctx = setup();
    await toLoop(ctx);
    ctx.loop.error = new Error("no codec");
    ctx.director.request("vertical");
    await settle();
    expect(ctx.clips.vertical.plays).toBe(1);
  });

  it("reduced motion: no welcome, a still loop, clips play at once", async () => {
    const ctx = setup({ reduced: true });
    void ctx.director.start();
    await settle();
    expect(ctx.director.current.mode).toBe("loop");
    expect(ctx.welcome.plays).toBe(0);
    expect(ctx.loop.plays).toBe(0);
    ctx.director.request("horizontal");
    await settle();
    expect(ctx.clips.horizontal.plays).toBe(1);
  });
});
