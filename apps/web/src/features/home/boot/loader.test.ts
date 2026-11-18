import { describe, expect, it } from "vitest";

import {
  QUARTERS,
  STILL_AFTER,
  newLoaderAction,
  newLoaderBrain,
  stepLoader,
  type LoaderAction,
  type LoaderInput,
} from "./loader";

const DT = 1 / 60;

function input(over: Partial<LoaderInput> = {}): LoaderInput {
  return {
    dt: DT,
    progress: 0,
    done: false,
    slow: false,
    offline: false,
    retrying: false,
    pointerInside: true,
    ...over,
  };
}

/** Run for `seconds` with a changing input and collect what the drone is asked to do. */
function run(
  seconds: number,
  at: (t: number) => Partial<LoaderInput>,
  seed = 7,
): Array<{ t: number; a: LoaderAction }> {
  const brain = newLoaderBrain(seed);
  const out = newLoaderAction();
  const log: Array<{ t: number; a: LoaderAction }> = [];
  for (let t = 0; t < seconds; t += DT) {
    stepLoader(brain, input(at(t)), out);
    if (out.trick || out.face || out.bubble) log.push({ t, a: { ...out } });
  }
  return log;
}

describe("the loader drone's idle life", () => {
  it("does a little trick every few seconds while it waits", () => {
    // Progress creeps along, so it is never taken for a stall.
    const log = run(60, (t) => ({ progress: Math.min(0.7, t / 90) }));
    const idle = log.filter((l) => l.a.why === "idle");
    expect(idle.length).toBeGreaterThanOrEqual(7);
    expect(idle.length).toBeLessThanOrEqual(16);
  });

  it("never asks for the same trick twice in a row", () => {
    const log = run(120, (t) => ({ progress: Math.min(0.7, t / 200) })).filter(
      (l) => l.a.why === "idle",
    );
    for (let i = 1; i < log.length; i += 1) {
      expect(log[i]?.a.trick).not.toBe(log[i - 1]?.a.trick);
    }
  });

  it("is the same every run with the same seed", () => {
    const a = run(40, () => ({ progress: 0.1 }), 3).map((l) => `${l.t.toFixed(2)}${l.a.trick}`);
    const b = run(40, () => ({ progress: 0.1 }), 3).map((l) => `${l.t.toFixed(2)}${l.a.trick}`);
    expect(a).toEqual(b);
  });

  it("keeps the moves apart (never two in a second)", () => {
    const log = run(90, (t) => ({ progress: Math.min(0.6, t / 150) }));
    const times = log.filter((l) => l.a.trick).map((l) => l.t);
    for (let i = 1; i < times.length; i += 1) {
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThan(1);
    }
  });
});

describe("a cheer at each real quarter", () => {
  it("cheers once at 25, 50 and 75 percent of the REAL progress, never before", () => {
    const log = run(40, (t) => ({ progress: t / 40 }));
    const cheers = log.filter((l) => l.a.why === "cheer");
    expect(cheers).toHaveLength(3);
    QUARTERS.forEach((q, i) => {
      // The cheer comes when the real fraction reaches the quarter, within a frame.
      expect(cheers[i]?.t).toBeGreaterThanOrEqual(q * 40 - 0.02);
      expect(cheers[i]?.t).toBeLessThan(q * 40 + 0.05);
    });
  });

  it("makes a bigger one when everything has arrived, once", () => {
    const log = run(20, (t) => ({ progress: t > 8 ? 1 : t / 10, done: t > 8 }));
    expect(log.filter((l) => l.a.why === "ready")).toHaveLength(1);
  });

  it("a jump past several quarters gives each its own cheer, one a frame", () => {
    const brain = newLoaderBrain();
    const out = newLoaderAction();
    const whys: Array<string | null> = [];
    for (let i = 0; i < 5; i += 1) {
      stepLoader(brain, input({ progress: 0.9 }), out);
      whys.push(out.why);
    }
    expect(whys.filter((w) => w === "cheer")).toHaveLength(3);
  });
});

describe("the truth shows", () => {
  it("looks worried when the files really have stopped for a while", () => {
    const log = run(30, () => ({ progress: 0.3 }));
    const worry = log.filter((l) => l.a.why === "stall");
    expect(worry.length).toBeGreaterThan(0);
    expect(worry[0]?.t).toBeGreaterThanOrEqual(STILL_AFTER - 0.1);
    expect(worry[0]?.a.face).toBe("sweat");
  });

  it("does not look worried while the bar moves", () => {
    const log = run(30, (t) => ({ progress: Math.min(0.9, 0.01 * t) }));
    expect(log.filter((l) => l.a.why === "stall")).toHaveLength(0);
  });

  it("looks worried at once when a download is being tried again", () => {
    const log = run(5, () => ({ progress: 0.4, retrying: true }));
    expect(log.some((l) => l.a.why === "stall")).toBe(true);
  });

  it("is sad when there is no connection, and says so with an icon only", () => {
    const log = run(14, () => ({ progress: 0.4, offline: true }));
    const sad = log.filter((l) => l.a.why === "offline");
    expect(sad.length).toBeGreaterThanOrEqual(2);
    expect(sad[0]?.a.face).toBe("sad");
    expect(sad[0]?.a.bubble).toBe("dots");
  });

  it("never worries once everything has arrived", () => {
    const log = run(30, () => ({ progress: 1, done: true }));
    expect(log.filter((l) => l.a.why === "stall" || l.a.why === "offline")).toHaveLength(0);
  });
});

describe("the eyes", () => {
  it("wander on their own when nobody points, and stay put when a mouse is there", () => {
    const brain = newLoaderBrain();
    const out = newLoaderAction();
    let looks = 0;
    for (let t = 0; t < 20; t += DT) {
      stepLoader(brain, input({ pointerInside: false, progress: 0.1 }), out);
      if (out.look) {
        looks += 1;
        expect(Math.abs(out.look.x)).toBeLessThanOrEqual(0.8);
        expect(Math.abs(out.look.y)).toBeLessThanOrEqual(0.55);
      }
    }
    expect(looks).toBeGreaterThan(100);
    const mouse = newLoaderBrain();
    for (let t = 0; t < 20; t += DT) {
      stepLoader(mouse, input({ pointerInside: true, progress: 0.1 }), out);
      expect(out.look).toBeNull();
    }
  });

  it("a frozen scene (dt 0) asks for nothing and changes nothing", () => {
    const brain = newLoaderBrain();
    const out = newLoaderAction();
    for (let i = 0; i < 200; i += 1) {
      stepLoader(brain, input({ dt: 0, progress: 0.1 }), out);
      expect(out.trick).toBeNull();
    }
    expect(brain.time).toBe(0);
  });
});
