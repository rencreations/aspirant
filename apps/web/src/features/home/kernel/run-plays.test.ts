import { describe, expect, it } from "vitest";

import { ActorRegistry } from "./actors";
import { floorOf, layoutSections } from "./layout";
import type { HomePlay } from "./plays";
import { SectionRunner } from "./run";
import type { FrameInfo, HomeSection, SectionCtx, SectionRuntime } from "./types";

const VIEW = { w: 1000, h: 800, dpr: 1 };
const DT = 1 / 60;

function frame(S: number, raw = S, dt = DT): FrameInfo {
  return { time: 0, dt, S, raw, velocity: 0, viewport: VIEW, frame: 0 };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const PLAYS: HomePlay[] = [
  { at: 0.25, from: 0, to: 0.5, seconds: 1, ease: "linear" },
  { at: 0.75, from: 0.5, to: 1, seconds: 1, ease: "linear" },
];

function section(
  id: string,
  screens: number,
  lead: number,
  tail: number,
  calls: Array<[string, number]>,
  plays?: HomePlay[],
  mount?: () => Promise<SectionRuntime> | SectionRuntime,
): HomeSection {
  const runtime: SectionRuntime = {
    update: (local) => calls.push([id, local]),
    dispose: () => undefined,
  };
  return {
    id,
    screens,
    lead,
    tail,
    bg: "daybreak",
    nav: { theme: "daybreak" },
    dom: "fixed",
    plays,
    preload: () => [],
    mount: mount ?? (() => runtime),
  } as unknown as HomeSection;
}

function setup(build: (calls: Array<[string, number]>) => HomeSection[], clock = { now: 1000 }) {
  const calls: Array<[string, number]> = [];
  const layout = layoutSections(build(calls));
  const runner = new SectionRunner({
    layout,
    actors: new ActorRegistry(),
    ctxFor: () => ({}) as SectionCtx,
    now: () => clock.now,
  });
  const last = (id: string) => [...calls].reverse().find((c) => c[0] === id)?.[1];
  /** One frame at a scroll position (screens); the clock moves by `dt`. */
  const tick = (S: number, opts: { raw?: number; jumped?: boolean; snap?: boolean } = {}) => {
    clock.now += DT * 1000;
    runner.step(frame(S, opts.raw ?? S), opts.jumped ?? false, opts.snap ?? false);
  };
  return { calls, layout, runner, last, tick, clock };
}

/** A page of two sections: a (plain, 2 screens) then b (plays, 4 screens, at 2 to 6). */
function page() {
  return setup((calls) => [
    section("a", 2, 0, 0.5, calls),
    section("b", 4, 0.5, 0.5, calls, PLAYS),
  ]);
}

describe("a section with plays in the runner", () => {
  it("gives update the machine's value, and the others the scroll's local", async () => {
    const p = page();
    p.tick(1, { jumped: true });
    await flush();
    p.tick(1);
    expect(p.last("a")).toBeCloseTo(0.5);
    // b rests on its first value inside its range, however far the scroll goes below the threshold
    p.tick(2.4, { jumped: true });
    expect(p.last("b")).toBe(0);
    expect(p.runner.report(2.4)[1]?.v).toBe(0);
    // in its lead the scroll goes on linearly: local = (1.8 - 2) / 4
    p.tick(1.8, { jumped: true });
    expect(p.last("b")).toBeCloseTo(-0.05);
    expect(p.runner.report(1.8)[1]?.v).toBeCloseTo(-0.05);
  });

  it("rests below the first threshold, with no hold", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    for (let i = 0; i < 30; i++) p.tick(2.5 + i * 0.001);
    expect(p.last("b")).toBe(0);
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.plays()[0]).toMatchObject({ id: "b", active: false, fired: 0, resting: 0 });
  });

  it("fires at the threshold, holds the scroll, runs on the clock, then lets go", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    // b's first threshold is 0.25 of 4 screens: 3 screens (S = 2 + 1)
    p.tick(3.01);
    const h = p.runner.holdState();
    expect(h.holding).toBe(true);
    expect(h.playing).toBe("b");
    expect(h.limitMs).toBe(2500);
    expect(h.token).toBe(1);
    // The page is held at 3.01; half a second later the value is half way
    for (let i = 0; i < 30; i++) p.tick(3.01);
    expect(p.last("b")).toBeCloseTo(0.25, 1);
    expect(p.runner.plays()[0]).toMatchObject({
      active: true,
      direction: 1,
      fired: 1,
      resting: 0.5,
    });
    for (let i = 0; i < 32; i++) p.tick(3.01);
    expect(p.last("b")).toBeCloseTo(0.5, 5);
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.holdState().playing).toBeNull();
  });

  it("plays back going up, with the hold", async () => {
    const p = page();
    p.tick(5.5, { jumped: true });
    await flush();
    p.tick(5.5);
    expect(p.last("b")).toBe(1);
    // the second threshold is 0.75 of 4 screens: S = 5. It plays back below 5 - 0.16 = 4.84.
    p.tick(4.9);
    expect(p.runner.holdState().holding).toBe(false);
    p.tick(4.8);
    expect(p.runner.holdState().holding).toBe(true);
    expect(p.runner.plays()[0]).toMatchObject({
      active: true,
      direction: -1,
      fired: 1,
      resting: 0.5,
    });
    // a back play of 0.7 s: done in about 42 frames
    for (let i = 0; i < 44; i++) p.tick(4.8);
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.last("b")).toBeCloseTo(0.5, 5);
  });

  it("reads the thresholds from the real scroll and the lead and tail from the smoothed one", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    // The scene (S) still trails the page (raw) by 0.2 screens at the threshold
    p.tick(2.9, { raw: 3.05 });
    expect(p.runner.holdState().holding).toBe(true);
  });

  it("starts a play at once when the page runs into the range already past the threshold", async () => {
    const p = page();
    p.tick(1.9, { jumped: true });
    await flush();
    p.tick(1.9);
    // b's range starts at 1.5: it was entered on this frame, and the page is 0.2 ahead of the scene
    p.tick(2.45, { raw: 3.2 });
    expect(p.runner.holdState().holding).toBe(true);
    expect(p.runner.plays()[0]?.fired).toBe(1);
  });

  it("lands on the resting value after a jump: no animation, no hold", async () => {
    const p = page();
    p.tick(0.5, { jumped: true });
    await flush();
    p.tick(0.5);
    p.tick(5.5, { jumped: true });
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.last("b")).toBe(1);
    expect(p.runner.plays()[0]).toMatchObject({ fired: 2, active: false });
    p.tick(1.8, { jumped: true });
    expect(p.runner.plays()[0]?.fired).toBe(0);
    expect(p.last("b")).toBeCloseTo((1.8 - 2) / 4);
  });

  it("rests on the position while the page is moved by a script", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    for (const S of [3, 3.5, 4, 5.2]) p.tick(S, { snap: true });
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.plays()[0]?.fired).toBe(2);
    expect(p.last("b")).toBe(1);
    // The move is over: the page goes on from there
    for (let i = 0; i < 10; i++) p.tick(5.2);
    expect(p.runner.holdState().holding).toBe(false);
  });

  it("lets go of a play that is running when the section is left by a jump", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    p.tick(3.01);
    expect(p.runner.holdState().holding).toBe(true);
    p.tick(9, { jumped: true });
    expect(p.runner.holdState().holding).toBe(false);
    p.tick(1, { jumped: true });
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.plays()[0]?.active).toBe(false);
  });

  it("lets go when the scroll leaves the range with no jump (a hold that failed)", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    p.tick(3.01);
    expect(p.runner.holdState().holding).toBe(true);
    p.tick(0.5);
    expect(p.runner.holdState().holding).toBe(false);
  });

  it("replays a passed section at the end of its last play", async () => {
    const p = setup((calls) => [
      section("a", 2, 0, 0.5, calls, [{ at: 0.5, from: 0, to: 1.25, seconds: 1 }]),
      section("b", 2, 0, 0, calls),
    ]);
    p.tick(0.5, { jumped: true });
    await flush();
    p.tick(0.5);
    p.calls.length = 0;
    p.tick(3.5, { jumped: true });
    expect(p.calls.filter((c) => c[0] === "a")).toEqual([["a", 1.25]]);
  });

  it("does not hold for a runtime that is still mounting, and lands where the page is when it arrives", async () => {
    let arrive: (r: SectionRuntime) => void = () => undefined;
    const late = new Promise<SectionRuntime>((resolve) => {
      arrive = resolve;
    });
    const p = setup((calls) => [
      section("a", 2, 0, 0.5, calls),
      section("b", 4, 0.5, 0.5, calls, PLAYS, () => late),
    ]);
    p.tick(2.5, { jumped: true });
    for (let i = 0; i < 5; i++) p.tick(3.5 + i * 0.1);
    expect(p.runner.holdState().holding).toBe(false);
    arrive({ update: (local) => p.calls.push(["b", local]), dispose: () => undefined });
    await flush();
    p.tick(4.0);
    p.tick(4.0);
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.plays()[0]?.fired).toBe(1);
    expect(p.last("b")).toBe(0.5);
  });

  it("lets go of the hold when the runtime throws in the middle of a play", async () => {
    let boom = false;
    const p = setup((calls) => [
      section("a", 2, 0, 0.5, calls),
      {
        ...section("b", 4, 0.5, 0.5, calls, PLAYS),
        mount: () => ({
          update: () => {
            if (boom) throw new Error("boom");
          },
          dispose: () => undefined,
        }),
      },
    ]);
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    p.tick(3.01);
    expect(p.runner.holdState().holding).toBe(true);
    boom = true;
    p.tick(3.01);
    p.tick(3.01);
    expect(p.runner.holdState().holding).toBe(false);
  });

  it("counts every play that starts, so a chain renews the hold", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    // a hard flick past both thresholds
    p.tick(5.5, { raw: 6 });
    const first = p.runner.holdState().token;
    for (let i = 0; i < 70; i++) p.tick(5.5, { raw: 6 });
    expect(p.runner.holdState().token).toBeGreaterThan(first);
    expect(p.runner.holdState().holding).toBe(true);
    for (let i = 0; i < 70; i++) p.tick(5.5, { raw: 6 });
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.last("b")).toBeCloseTo(1 + 0.375 * 0, 5);
  });

  it("puts every machine at rest on dispose", async () => {
    const p = page();
    p.tick(2.5, { jumped: true });
    await flush();
    p.tick(2.5);
    p.tick(3.01);
    p.runner.dispose();
    expect(p.runner.plays()[0]?.active).toBe(false);
  });

  it("finds the lowest reachable position of the first section for its thresholds", () => {
    const layout = layoutSections([
      section("a", 4, 0, 0.5, [], [{ at: 0.01, from: 0, to: 1, seconds: 1 }]),
      section("b", 2, 0.5, 0, [], [{ at: 0.2, from: 0, to: 1, seconds: 1 }]),
    ]);
    expect(floorOf(layout.placed[0]!)).toBe(0);
    expect(floorOf(layout.placed[1]!)).toBeCloseTo(-0.25);
  });
});

describe("layoutSections and plays", () => {
  it("refuses a bad table at startup, naming the section", () => {
    expect(() =>
      layoutSections([
        section(
          "a",
          2,
          0,
          0,
          [],
          [
            { at: 0.2, from: 0, to: 0.5, seconds: 1 },
            { at: 0.6, from: 0.4, to: 1, seconds: 1 },
          ],
        ),
      ]),
    ).toThrow(/section a: plays\[1\] from 0.4 must equal the previous play's to 0.5/);
  });

  it("accepts a section with no plays", () => {
    expect(() => layoutSections([section("a", 2, 0, 0, [])])).not.toThrow();
  });
});
