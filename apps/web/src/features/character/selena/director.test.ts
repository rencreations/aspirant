import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SelenaDirector,
  SHORT_NAMES,
  VIDEO_KEYS,
  type StageElements,
  type StageState,
  type VideoKey,
} from "./director";
import { LEAD_FRAMES, triggerFrames, waitFrames } from "./phase";
import { SELENA_EXTRA_FRAMES, SELENA_FPS, SELENA_PAGES, SELENA_SHORTS } from "./timeline.generated";

type Listener = () => void;

/** Just enough of a video element, with the frame callback driven by the test. */
class FakeVideo {
  dataset: Record<string, string> = {};
  props: Record<string, string> = {};
  style = {
    setProperty: (k: string, v: string) => {
      this.props[k] = v;
    },
  };
  offsetWidth = 0;
  readyState = 4;
  duration = 10;
  error: unknown = null;
  paused = true;
  seeking = false;
  plays = 0;
  failPlay = false;
  private time = 0;
  private frames: Array<(now: number, meta: { mediaTime: number }) => void> = [];
  private listeners = new Map<string, Set<Listener>>();

  get currentTime() {
    return this.time;
  }
  /** Setting the time starts a seek that ends a moment later, like a real video. */
  set currentTime(value: number) {
    this.time = value;
    this.seeking = true;
    queueMicrotask(() => {
      this.seeking = false;
      this.emit("seeked");
    });
  }
  play() {
    if (this.failPlay) return Promise.reject(new Error("no codec"));
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type: string, fn: Listener) {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  private emit(type: string) {
    for (const fn of Array.from(this.listeners.get(type) ?? [])) fn();
  }
  requestVideoFrameCallback(cb: (now: number, meta: { mediaTime: number }) => void) {
    this.frames.push(cb);
    return this.frames.length;
  }
  /** Present a frame at this media time. */
  tick(mediaTime: number) {
    this.time = mediaTime;
    const due = this.frames.splice(0);
    for (const cb of due) cb(0, { mediaTime });
  }
}

const FPS = SELENA_FPS;
const EARLY = (LEAD_FRAMES + SELENA_EXTRA_FRAMES) / FPS;
const f = (frame: number) => frame / FPS;

function setup(
  options: { reduced?: boolean; skipWelcome?: boolean; welcomeDelayMs?: number } = {},
) {
  const els = Object.fromEntries(VIDEO_KEYS.map((k) => [k, new FakeVideo()])) as Record<
    VideoKey,
    FakeVideo
  >;
  els.welcome.duration = 15.8;
  els.idle.duration = 8.1;
  for (const [name, page] of Object.entries(SELENA_PAGES)) {
    const n = name as keyof typeof SELENA_PAGES;
    els[`${n}-in`].duration = f(page.in.frames);
    els[`${n}-loop`].duration = f(page.loop.frames);
    els[`${n}-out`].duration = f(page.out.frames);
  }
  for (const [name, short] of Object.entries(SELENA_SHORTS)) {
    els[name as keyof typeof SELENA_SHORTS].duration = f(short.frames);
  }
  const begun = { count: 0 };
  const attached: VideoKey[] = [];
  const detached: VideoKey[] = [];
  const states: StageState[] = [];
  const director = new SelenaDirector(els as unknown as StageElements, {
    reduced: options.reduced ?? false,
    skipWelcome: options.skipWelcome,
    welcomeDelayMs: options.welcomeDelayMs,
    onBegin: () => {
      begun.count += 1;
    },
    onState: (s) => states.push(s),
    attach: (key) => attached.push(key),
    detach: (key) => detached.push(key),
  });
  return { els, director, states, attached, detached, begun };
}

type Ctx = ReturnType<typeof setup>;

const settle = () => vi.advanceTimersByTimeAsync(4000);

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
  ctx.els.idle.tick(f(trigger - 1));
  ctx.els.idle.tick(f(trigger));
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

/** Leave a page and play its exit until the video is where the hand-over to the idle loop starts. */
async function toOutro(ctx: Ctx, name: keyof typeof SELENA_PAGES) {
  await toPage(ctx, name);
  const page = SELENA_PAGES[name];
  ctx.director.leave();
  const trigger = page.out.startPhase - LEAD_FRAMES;
  const loop = ctx.els[`${name}-loop`];
  loop.tick(f(trigger - 1));
  loop.tick(f(trigger));
  await settle();
  return ctx.els[`${name}-out`];
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

  it("begins at once (the music starts) and starts the welcome video only after the delay", async () => {
    const ctx = setup({ welcomeDelayMs: 500 });
    void ctx.director.start();
    await vi.advanceTimersByTimeAsync(200);
    expect(ctx.begun.count).toBe(1);
    expect(ctx.els.welcome.plays).toBe(0);
    expect(ctx.director.current.mode).toBe("boot");
    await vi.advanceTimersByTimeAsync(600);
    expect(ctx.els.welcome.plays).toBe(1);
  });

  it("does not wait when she goes straight to a page or motion is reduced", async () => {
    const page = setup({ welcomeDelayMs: 500, skipWelcome: true });
    void page.director.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(page.begun.count).toBe(1);
    expect(page.els.idle.plays).toBe(1);
    const still = setup({ welcomeDelayMs: 500, reduced: true });
    void still.director.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(still.director.current.mode).toBe("idle");
  });

  it("starts straight on the idle loop when the visitor came to one of her pages", async () => {
    const ctx = setup({ skipWelcome: true });
    expect(ctx.els.welcome.dataset.layer).toBe("off");
    void ctx.director.start();
    await settle();
    ctx.els.idle.tick(0);
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(ctx.els.welcome.plays).toBe(0);
    expect(ctx.els.idle.plays).toBe(1);
    expect(ctx.attached).not.toContain("welcome");
  });

  it("plays the welcome, then hands over to the idle loop a few frames before the end", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");
    expect(ctx.director.current.ui).toBe(false);
    expect(ctx.els.idle.plays).toBe(0);
    ctx.els.welcome.tick(5);
    await settle();
    expect(ctx.director.current.mode).toBe("welcome");

    ctx.els.welcome.tick(ctx.els.welcome.duration - EARLY);
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "idle", ui: true });
    expect(ctx.els.idle.currentTime).toBeLessThan(1);
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
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null, ui: true });
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(ctx.els.welcome.dataset.layer).toBe("off");
    expect(ctx.els.welcome.paused).toBe(true);
  });

  it("ignores a request while the welcome plays", async () => {
    const ctx = setup();
    void ctx.director.start();
    await settle();
    ctx.director.request("about");
    expect(ctx.director.current.mode).toBe("welcome");
  });
});

describe("a choice reacts at once", () => {
  it("is queued in the same call, with the length of the wait", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els.idle.tick(f(10));
    const t0 = performance.now();
    ctx.director.request("skills");
    const s = ctx.director.current;
    expect(s).toMatchObject({ mode: "queued", scene: "skills", ui: true, loading: false });
    const frames = waitFrames(10, triggerFrames(SELENA_PAGES.skills.in.startPhases));
    expect(s.wait?.ms).toBeCloseTo((frames / FPS) * 1000, 3);
    expect(s.wait?.at).toBeGreaterThanOrEqual(t0);
  });

  it("does not know the wait while the clip is still loading", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els["about-in"].readyState = 1;
    ctx.director.request("about");
    expect(ctx.director.current).toMatchObject({ mode: "queued", loading: true, wait: null });
  });

  it("keeps a choice made while she is still finishing, and starts it when she is idle", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "about");
    expect(ctx.director.current.mode).toBe("outro");
    const back = SELENA_PAGES.about.out;
    // The panel is not back yet, so the choice is ignored.
    ctx.director.request("skills");
    expect(ctx.director.current.next).toBeNull();
    // She is back in her idle pose: the panel is back and a choice is kept.
    out.tick(f(back.uiFrame));
    expect(ctx.director.current).toMatchObject({ mode: "outro", ui: true });
    ctx.director.request("skills");
    expect(ctx.director.current).toMatchObject({ next: "skills", mode: "outro" });
    // The hand-over finishes, and the choice starts waiting for its frame.
    out.tick(f(back.syncFrame - LEAD_FRAMES));
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "queued", scene: "skills", next: null });
    await enter(ctx, SELENA_PAGES.skills.in.startPhases[0]);
    expect(ctx.director.current).toMatchObject({ mode: "intro", scene: "skills" });
  });

  it("a kept choice can be taken back", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "gallery");
    out.tick(f(SELENA_PAGES.gallery.out.uiFrame));
    ctx.director.request("about");
    expect(ctx.director.current.next).toBe("about");
    ctx.director.cancel();
    expect(ctx.director.current.next).toBeNull();
  });
});

describe("pages", () => {
  it("queues a page and starts its entrance when the idle loop reaches the start frame", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("skills");
    expect(ctx.director.current).toMatchObject({ mode: "queued", scene: "skills" });
    // Only the entrance is held while it waits. The loop is attached when the entrance plays.
    expect(ctx.attached).toContain("skills-in");
    expect(ctx.attached).not.toContain("skills-loop");

    const phase = SELENA_PAGES.skills.in.startPhases[0];
    const trigger = phase - LEAD_FRAMES;
    for (const fr of [trigger - 3, trigger - 2, trigger - 1]) ctx.els.idle.tick(f(fr));
    await settle();
    expect(ctx.director.current.mode).toBe("queued");
    expect(ctx.els["skills-in"].plays).toBe(0);

    ctx.els.idle.tick(f(trigger));
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "intro", scene: "skills", ui: false });
    expect(ctx.els["skills-in"].plays).toBe(1);
    expect(ctx.els["skills-in"].dataset.layer).toBe("front");
    expect(ctx.els.idle.dataset.layer).toBe("off");
  });

  it("seeks to the start and waits for the seek before it plays, so no old picture shows", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els["skills-in"].tick(7.5);
    ctx.director.request("skills");
    await enter(ctx, SELENA_PAGES.skills.in.startPhases[0]);
    expect(ctx.els["skills-in"].currentTime).toBe(0);
    expect(ctx.els["skills-in"].seeking).toBe(false);
  });

  it("eases the idle picture to the new camera while it dissolves, then puts it back", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("about");
    expect(SELENA_PAGES.about.in.align).toBeLessThan(1);
    await enter(ctx, SELENA_PAGES.about.in.startPhases[0]);
    // After the dissolve the idle picture is back at its own scale.
    expect(ctx.els.idle.props["--zoom"]).toBe("1");
    expect(ctx.els.idle.dataset.layer).toBe("off");
  });

  it("hands the entrance over to the page loop, which then plays until the visitor leaves", async () => {
    const ctx = setup();
    await toPage(ctx, "about");
    expect(ctx.director.current).toMatchObject({ mode: "page", scene: "about" });
    expect(ctx.els["about-loop"].plays).toBe(1);
    expect(ctx.els["about-loop"].dataset.layer).toBe("front");
    expect(ctx.els["about-in"].dataset.layer).toBe("off");
  });

  it("leaving reacts at once, waits for the exit's frame, then plays the exit", async () => {
    const ctx = setup();
    await toPage(ctx, "about");
    const page = SELENA_PAGES.about;
    ctx.els["about-loop"].tick(f(40));
    ctx.director.leave();
    expect(ctx.director.current).toMatchObject({ mode: "leaving", leaving: true });
    expect(ctx.director.current.wait?.ms).toBeGreaterThanOrEqual(0);

    const trigger = page.out.startPhase - LEAD_FRAMES;
    const loop = ctx.els["about-loop"];
    loop.tick(f(trigger - 2));
    loop.tick(f(trigger - 1));
    await settle();
    expect(ctx.director.current.mode).toBe("leaving");
    expect(ctx.els["about-out"].plays).toBe(0);

    loop.tick(f(trigger));
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "outro", ui: false, leaving: true });
    expect(ctx.els["about-out"].plays).toBe(1);
    expect(ctx.els["about-out"].dataset.layer).toBe("front");
  });

  it("brings the panel back as soon as she is in her idle pose, before the hand-over", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "skills");
    const back = SELENA_PAGES.skills.out;
    const plays = ctx.els.idle.plays;
    out.tick(f(back.uiFrame - 2));
    expect(ctx.director.current.ui).toBe(false);
    out.tick(f(back.uiFrame));
    expect(ctx.director.current).toMatchObject({ mode: "outro", ui: true });
    // The hand-over to the idle loop has not started yet: only the panel came back.
    expect(ctx.els.idle.plays).toBe(plays);
  });

  it("starts the idle loop at the phase that matches the exit and dissolves while both play", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "gallery");
    const back = SELENA_PAGES.gallery.out;
    const at = back.syncFrame - LEAD_FRAMES;
    out.tick(f(at));
    await settle();
    expect(ctx.director.current).toMatchObject({
      mode: "idle",
      scene: null,
      ui: true,
      leaving: false,
    });
    const ahead = at - back.syncFrame + (LEAD_FRAMES + 2);
    expect(ctx.els.idle.currentTime).toBeCloseTo(f(back.syncPhase + ahead), 5);
    expect(ctx.els.idle.dataset.layer).toBe("front");
    expect(out.dataset.layer).toBe("off");
    expect(out.paused).toBe(true);
  });

  it("pressing Back during the entrance leaves as soon as the page loop is up", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("gallery");
    await enter(ctx, SELENA_PAGES.gallery.in.startPhases[0]);
    expect(ctx.director.current.mode).toBe("intro");
    ctx.director.leave();
    expect(ctx.director.current.leaving).toBe(true);
    const intro = ctx.els["gallery-in"];
    intro.tick(intro.duration - EARLY);
    await settle();
    expect(ctx.director.current.mode).toBe("leaving");
  });

  it("can leave the queue", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("about");
    ctx.director.cancel();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null, wait: null });
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
  it("plays a short, brings the panel back when she is idle again and hands over to the idle loop", async () => {
    const ctx = setup();
    await toIdle(ctx);
    const name = SHORT_NAMES[1]!;
    ctx.director.request(name);
    await enter(ctx, SELENA_SHORTS[name].startPhases[0]);
    expect(ctx.director.current).toMatchObject({ mode: "short", scene: name, ui: false });
    const clip = ctx.els[name];
    expect(clip.plays).toBe(1);
    const back = SELENA_SHORTS[name].back;
    clip.tick(f(back.uiFrame));
    expect(ctx.director.current).toMatchObject({ mode: "short", ui: true });
    clip.tick(f(back.syncFrame - LEAD_FRAMES));
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
    expect(ctx.els.idle.dataset.layer).toBe("front");
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
  it("opens a page over the still picture when its video cannot play, and closes it again", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.els["about-in"].failPlay = true;
    ctx.director.request("about");
    await enter(ctx, SELENA_PAGES.about.in.startPhases[0]);
    expect(ctx.director.current).toMatchObject({ mode: "page", scene: "about" });
    ctx.director.leave();
    expect(ctx.director.current).toMatchObject({ mode: "idle", scene: null });
  });

  it("lets go of the videos that are done, so the browser frees their decoders", async () => {
    const ctx = setup();
    await toIdle(ctx);
    // The welcome is done once the idle loop has taken over.
    expect(ctx.detached).toContain("welcome");
    ctx.director.request("skills");
    await enter(ctx, SELENA_PAGES.skills.in.startPhases[0]);
    expect(ctx.attached).toContain("skills-loop");
    const intro = ctx.els["skills-in"];
    intro.tick(intro.duration - EARLY);
    await settle();
    expect(ctx.detached).toContain("skills-in");
    expect(ctx.detached).not.toContain("skills-loop");
  });

  it("lets go of the whole page once its exit has handed over to the idle loop", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "gallery");
    out.tick(f(SELENA_PAGES.gallery.out.syncFrame));
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
    expect(ctx.detached).toEqual(
      expect.arrayContaining(["gallery-in", "gallery-loop", "gallery-out"]),
    );
  });

  it("draws the waiting entrance at 1 percent, and puts it away if the choice is taken back", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("skills");
    expect(ctx.els["skills-in"].dataset.layer).toBe("warm");
    ctx.director.cancel();
    expect(ctx.els["skills-in"].dataset.layer).toBe("off");
    ctx.director.request("skills");
    await enter(ctx, SELENA_PAGES.skills.in.startPhases[0]);
    expect(ctx.els["skills-in"].dataset.layer).toBe("front");
  });

  it("works when the video shows every other frame, as the light size (30 fps) does", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.request("gallery");
    const trigger = SELENA_PAGES.gallery.in.startPhases[0] - LEAD_FRAMES;
    // The loop is seen at every second frame, and the trigger frame is one that is skipped.
    ctx.els.idle.tick(f(trigger - 1));
    ctx.els.idle.tick(f(trigger + 1));
    await settle();
    expect(ctx.director.current).toMatchObject({ mode: "intro", scene: "gallery" });
    // The entrance ends: the hand-over to the page loop comes from the last frames seen.
    const intro = ctx.els["gallery-in"];
    intro.tick(intro.duration - 2 * EARLY);
    intro.tick(intro.duration - EARLY + 1 / SELENA_FPS);
    await settle();
    expect(ctx.director.current.mode).toBe("page");
  });

  it("takes the size of the idle loop that the device asks for when she comes back to it", async () => {
    const ctx = setup();
    const out = await toOutro(ctx, "skills");
    const before = ctx.attached.filter((k) => k === "idle").length;
    out.tick(f(SELENA_PAGES.skills.out.syncFrame));
    await settle();
    expect(ctx.director.current.mode).toBe("idle");
    // The idle loop was asked for again on the way back, so it can be given another size then.
    expect(ctx.attached.filter((k) => k === "idle").length).toBeGreaterThan(before);
  });

  it("can swap the idle loop for another size while she idles", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.detached.length = 0;
    void ctx.director.retier();
    await settle();
    ctx.els.idle.tick(0);
    await settle();
    expect(ctx.detached).toContain("idle");
    expect(ctx.director.current.mode).toBe("idle");
    expect(ctx.els.idle.dataset.layer).toBe("front");
    // Not while something else is playing.
    ctx.director.request("about");
    ctx.detached.length = 0;
    await ctx.director.retier();
    expect(ctx.detached).not.toContain("idle");
  });

  it("holds only one warmed entrance at a time", async () => {
    const ctx = setup();
    await toIdle(ctx);
    ctx.director.warm("about");
    ctx.director.warm("skills");
    expect(ctx.detached).toEqual(expect.arrayContaining(["about-in", "about-loop", "about-out"]));
    expect(ctx.detached).not.toContain("skills-in");
    // The one that was chosen is kept when the pointer moves on.
    ctx.director.request("skills");
    ctx.director.warm("gallery");
    expect(ctx.detached).not.toContain("skills-in");
  });

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
