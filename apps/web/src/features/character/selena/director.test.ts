import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SelenaDirector,
  SHORT_NAMES,
  VIDEO_KEYS,
  type StageElements,
  type StageState,
  type VideoKey,
} from "./director";
import { LEAD_FRAMES } from "./phase";
import { SELENA_EXTRA_FRAMES, SELENA_FPS, SELENA_PAGES, SELENA_SHORTS } from "./timeline.generated";

/** Just enough of a video element, with the frame callback driven by the test. */
class FakeVideo {
  dataset: Record<string, string> = {};
  style = { setProperty: () => undefined };
  currentTime = 0;
  muted = false;
  readyState = 4;
  duration = 10;
  error: unknown = null;
  paused = true;
  plays = 0;
  private frames: Array<(now: number, meta: { mediaTime: number }) => void> = [];

  play() {
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {
    /* the tests end videos by ticking to their last frames */
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

const FPS = SELENA_FPS;
const EARLY = (LEAD_FRAMES + SELENA_EXTRA_FRAMES) / FPS;

function setup(options: { reduced?: boolean } = {}) {
  const els = Object.fromEntries(VIDEO_KEYS.map((k) => [k, new FakeVideo()])) as Record<
    VideoKey,
    FakeVideo
  >;
  els.welcome.duration = 15.8;
  els.idle.duration = 8.1;
  for (const [name, page] of Object.entries(SELENA_PAGES)) {
    els[`${name as keyof typeof SELENA_PAGES}-in`].duration = page.in.frames / FPS;
    els[`${name as keyof typeof SELENA_PAGES}-loop`].duration = page.loop.frames / FPS;
    els[`${name as keyof typeof SELENA_PAGES}-out`].duration = page.out.frames / FPS;
  }
  for (const [name, short] of Object.entries(SELENA_SHORTS)) {
    els[name as keyof typeof SELENA_SHORTS].duration = short.frames / FPS;
  }
  const attached: VideoKey[] = [];
  const states: StageState[] = [];
  const director = new SelenaDirector(els as unknown as StageElements, {
    muted: () => false,
    reduced: options.reduced ?? false,
    onState: (s) => states.push(s),
    attach: (key) => attached.push(key),
  });
  return { els, director, states, attached };
}

type Ctx = ReturnType<typeof setup>;

const settle = () => vi.advanceTimersByTimeAsync(1500);

/** Start the director and play the welcome out until the idle loop runs. */
async function toIdle(ctx: Ctx) {
  void ctx.director.start();
  await settle();
  ctx.els.welcome.tick(ctx.els.welcome.duration - EARLY);
  await settle();
}

/** Tick the idle loop over the frame a scene's entrance starts on. */
async function enter(ctx: Ctx, phase: number) {
  const trigger = phase - LEAD_FRAMES;
  ctx.els.idle.tick((trigger - 1) / FPS);
  ctx.els.idle.tick(trigger / FPS);
  await settle();
}

async function toPage(ctx: Ctx, name: keyof typeof SELENA_PAGES) {
  await toIdle(ctx);
  ctx.director.request(name);
  await enter(ctx, SELENA_PAGES[name].in.startPhases[0]);
  const intro = ctx.els[`${name}-in`];
  intro.tick(intro.duration - EARLY);
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("welcome and idle", () => {
  it("shows the welcome's first frame before it plays", () => {
    const ctx = setup();
    expect(ctx.els.welcome.dataset.layer).toBe("front");
    expect(ctx.els.idle.dataset.layer).toBe("off");
    expect(setup({ reduced: true }).els.welcome.dataset.layer).toBe("off");
  });

  it("plays the welcome, then hands over to the idle loop a few frames before the end", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");
    expect(ctx.els.idle.plays).toBe(0);
    ctx.els.welcome.tick(5);
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");

    ctx.els.welcome.tick(ctx.els.welcome.duration - EARLY);
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
    expect(ctx.els.idle.currentTime).toBe(0);
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(ctx.els.welcome.dataset.layer).toBe("off");
    expect(ctx.els.welcome.paused).toBe(true);
  });

  it("jumps straight to the idle loop from the welcome (Skip)", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    const jump = ctx.director.jumpToIdle();
    await settle();
    await jump;
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(ctx.els.welcome.dataset.layer).toBe("off");
    expect(ctx.els.welcome.paused).toBe(true);
    expect(ctx.els.idle.currentTime).toBe(0);
  });

  it("ignores a request while the welcome plays", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    ctx.director.request("about");
    expect(ctx.director.current.mode).toBe("welcome");
  });
});

describe("pages", () => {
  it("queues a page and starts its entrance when the idle loop reaches the start frame", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("skills");
    expect(ctx.director.current).toMatchObject({ mode: "queued", scene: "skills" });
    expect(ctx.attached).toEqual(
      expect.arrayContaining(["skills-in", "skills-loop", "skills-out"]),
    );

    const phase = SELENA_PAGES.skills.in.startPhases[0];
    const trigger = phase - LEAD_FRAMES;
    for (const f of [trigger - 3, trigger - 2, trigger - 1]) ctx.els.idle.tick(f / FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("queued");
    expect(ctx.els["skills-in"].plays).toBe(0);

    ctx.els.idle.tick(trigger / FPS);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "intro", scene: "skills" });
    expect(ctx.els["skills-in"].plays).toBe(1);
    expect(ctx.els["skills-in"].dataset.layer).toBe("front");
    expect(ctx.els.idle.dataset.layer).toBe("off");
  });

  it("hands the entrance over to the page loop, which then plays until the visitor leaves", async () => {
    const ctx = setup();
    await toPage(ctx, "about");
    expect(ctx.director.current).toMatchObject({ mode: "page", scene: "about" });
    expect(ctx.els["about-loop"].plays).toBe(1);
    expect(ctx.els["about-loop"].currentTime).toBe(0);
    expect(ctx.els["about-loop"].dataset.layer).toBe("front");
    expect(ctx.els["about-in"].dataset.layer).toBe("off");
  });

  it("leaving waits for the loop frame the exit starts on, plays the exit, then resumes the idle loop", async () => {
    const ctx = setup();
    await toPage(ctx, "about");
    const page = SELENA_PAGES.about;
    ctx.director.leave();
    expect(ctx.director.current.mode).toBe("leaving");

    const trigger = page.out.startPhase - LEAD_FRAMES;
    const loop = ctx.els["about-loop"];
    loop.tick((trigger - 2) / FPS);
    loop.tick((trigger - 1) / FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("leaving");
    expect(ctx.els["about-out"].plays).toBe(0);

    loop.tick(trigger / FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("outro");
    expect(ctx.els["about-out"].plays).toBe(1);
    expect(ctx.els["about-out"].dataset.layer).toBe("front");

    const out = ctx.els["about-out"];
    out.tick(out.duration - EARLY);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(ctx.els.idle.currentTime).toBeCloseTo(
      (page.out.endPhase - (LEAD_FRAMES + SELENA_EXTRA_FRAMES)) / FPS,
      5,
    );
    expect(out.dataset.layer).toBe("off");
  });

  it("pressing Back during the entrance leaves as soon as the page loop is up", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("gallery");
    await enter(ctx, SELENA_PAGES.gallery.in.startPhases[0]);
    expect(ctx.director.current.mode).toBe("intro");
    ctx.director.leave();
    const intro = ctx.els["gallery-in"];
    intro.tick(intro.duration - EARLY);
    await settle();
    expect(ctx.director.current.mode).toBe("leaving");
  });

  it("can leave the queue", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("others");
    ctx.director.cancel();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
  });

  it("waits while the entrance is still loading, and says so", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els["skills-in"].readyState = 1;
    ctx.director.request("skills");
    expect(ctx.director.current.loading).toBe(true);
    const phases = SELENA_PAGES.skills.in.startPhases;
    await enter(ctx, phases[0]);
    expect(ctx.director.current.mode).toBe("queued");
    ctx.els["skills-in"].readyState = 4;
    await enter(ctx, phases[1]);
    expect(ctx.director.current.mode).toBe("intro");
  });
});

describe("shorts", () => {
  it("plays a short from the idle loop and hands back to the idle loop at its end phase", async () => {
    const ctx = setup();
    await toIdle(ctx);
    const name = SHORT_NAMES[1]!;
    ctx.director.request(name);
    await enter(ctx, SELENA_SHORTS[name].startPhases[0]);
    expect(ctx.director.current).toMatchObject({ mode: "short", scene: name });
    const clip = ctx.els[name];
    expect(clip.plays).toBe(1);
    clip.tick(clip.duration - EARLY);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
    expect(ctx.els.idle.currentTime).toBeCloseTo(
      (SELENA_SHORTS[name].endPhase - (LEAD_FRAMES + SELENA_EXTRA_FRAMES)) / FPS,
      5,
    );
  });

  it("jumps to the idle loop at once, from a short or a page (Back under the cover)", async () => {
    const ctx = setup();
    await toIdle(ctx);
    const name = SHORT_NAMES[0]!;
    ctx.director.request(name);
    await enter(ctx, SELENA_SHORTS[name].startPhases[0]);
    expect(ctx.director.current.mode).toBe("short");
    const jump = ctx.director.jumpToIdle();
    await settle();
    await jump;
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
    expect(ctx.els[name].paused).toBe(true);
    expect(ctx.els[name].dataset.layer).toBe("off");
    expect(ctx.els.idle.dataset.layer).toBe("front");
  });
});

describe("failure and reduced motion", () => {
  it("starts a scene at once when the idle loop cannot play", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els.idle.error = new Error("no codec");
    ctx.director.request(SHORT_NAMES[2]!);
    await settle();
    expect(ctx.els[SHORT_NAMES[2]!].plays).toBe(1);
  });

  it("reduced motion: no welcome, a still idle, pages show their loop's first frame", async () => {
    const ctx = setup({ reduced: true });
    void ctx.director.start();
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
    expect(ctx.els.welcome.plays).toBe(0);
    expect(ctx.els.idle.plays).toBe(0);
    ctx.director.request("about");
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "page", scene: "about" });
    expect(ctx.els["about-loop"].plays).toBe(0);
    ctx.director.leave();
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
  });
});
