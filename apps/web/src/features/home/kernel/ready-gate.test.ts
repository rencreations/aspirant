import { describe, expect, it } from "vitest";

import { ActorRegistry } from "./actors";
import { layoutSections } from "./layout";
import { PlayMachine, type HomePlay } from "./plays";
import { SectionRunner } from "./run";
import type { FrameInfo, HomeSection, SectionCtx, SectionRuntime } from "./types";

const DT = 1 / 60;
const VIEW = { w: 1000, h: 800, dpr: 1 };

const PLAYS: HomePlay[] = [
  { at: 0.25, from: 0, to: 0.5, seconds: 1, ease: "linear" },
  { at: 0.75, from: 0.5, to: 1, seconds: 1, ease: "linear" },
];

function machine() {
  const gate = { open: false };
  const m = new PlayMachine("t", PLAYS, { screens: 4, floor: -0.1, ready: () => gate.open });
  let now = 1000;
  const step = (s: number, frames = 1, dt = DT) => {
    for (let i = 0; i < frames; i++) {
      now += dt * 1000;
      m.step(s, s, dt, now);
    }
  };
  return { m, gate, step };
}

describe("the ready gate of a play machine", () => {
  it("does not fire a forward play while the gate is closed, and does not hold", () => {
    const { m, step } = machine();
    m.jump(0, 0);
    step(0.3, 30);
    expect(m.active).toBe(false);
    expect(m.started).toBe(0);
    expect(m.fired).toBe(0);
    expect(m.waiting).toBe(true);
    expect(m.value).toBe(0);
  });

  it("fires on the first step after it opens, while the scroll is still past the threshold", () => {
    const { m, gate, step } = machine();
    m.jump(0, 0);
    step(0.3, 20);
    gate.open = true;
    step(0.3);
    expect(m.active).toBe(true);
    expect(m.direction).toBe(1);
    expect(m.waiting).toBe(false);
    expect(m.started).toBe(1);
    step(0.3, 70);
    expect(m.value).toBeCloseTo(0.5, 5);
  });

  it("does not fire when the visitor went back above the threshold before it opened", () => {
    const { m, gate, step } = machine();
    m.jump(0, 0);
    step(0.3, 10);
    expect(m.waiting).toBe(true);
    step(0.2, 5);
    expect(m.waiting).toBe(false);
    gate.open = true;
    step(0.2, 5);
    expect(m.started).toBe(0);
    expect(m.value).toBe(0);
  });

  it("chains the plays in order when the scroll passed several thresholds meanwhile", () => {
    const { m, gate, step } = machine();
    m.jump(0, 0);
    step(0.9, 10);
    expect(m.waiting).toBe(true);
    gate.open = true;
    step(0.9);
    expect(m.index).toBe(0);
    step(0.9, 60);
    expect(m.index).toBe(1);
    step(0.9, 70);
    expect(m.active).toBe(false);
    expect(m.fired).toBe(2);
    expect(m.value).toBeCloseTo(1, 5);
  });

  it("never makes a play going back wait", () => {
    const { m, gate, step } = machine();
    gate.open = true;
    m.jump(0, 0);
    step(0.3, 90);
    expect(m.fired).toBe(1);
    gate.open = false;
    step(0.1);
    expect(m.active).toBe(true);
    expect(m.direction).toBe(-1);
  });

  it("is not in the way of a jump", () => {
    const { m } = machine();
    m.jump(0.9, 0.9);
    expect(m.fired).toBe(2);
    expect(m.waiting).toBe(false);
    expect(m.value).toBe(1);
  });

  it("a machine with no gate is always ready", () => {
    const m = new PlayMachine("t", PLAYS, { screens: 4 });
    m.jump(0, 0);
    m.step(0.3, 0.3, DT, 1000);
    expect(m.active).toBe(true);
    expect(m.waiting).toBe(false);
  });

  it("forgets a due play when the section is left", () => {
    const { m, step } = machine();
    m.jump(0, 0);
    step(0.3, 5);
    expect(m.waiting).toBe(true);
    m.leave();
    expect(m.waiting).toBe(false);
  });
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function frame(S: number): FrameInfo {
  return { time: 0, dt: DT, S, raw: S, velocity: 0, viewport: VIEW, frame: 0, input: { wheel: 0 } };
}

describe("the ready gate in the runner", () => {
  function setup(ready: SectionRuntime["ready"]) {
    const calls: number[] = [];
    const runtime: SectionRuntime = {
      update: (local) => calls.push(local),
      ready,
      dispose: () => undefined,
    };
    const def = {
      id: "a",
      screens: 4,
      lead: 0.5,
      tail: 0.5,
      bg: "daybreak",
      nav: { theme: "daybreak" },
      dom: "fixed",
      plays: PLAYS,
      preload: () => [],
      mount: () => runtime,
    } as unknown as HomeSection;
    const errors: unknown[] = [];
    const clock = { now: 1000 };
    const runner = new SectionRunner({
      layout: layoutSections([def]),
      actors: new ActorRegistry(),
      ctxFor: () => ({}) as SectionCtx,
      now: () => clock.now,
      onError: (_id, e) => errors.push(e),
    });
    const tick = (S: number, opts: { jumped?: boolean } = {}) => {
      clock.now += DT * 1000;
      runner.step(frame(S), opts.jumped ?? false, false);
    };
    return { runner, tick, calls, errors };
  }

  it("holds nothing and plays nothing until the runtime is ready, then plays", async () => {
    const gate = { open: false };
    const p = setup(() => gate.open);
    p.tick(0.2, { jumped: true });
    await flush();
    p.tick(0.2);
    // the first threshold is 0.25 of 4 screens: S = 1
    for (let i = 0; i < 20; i++) p.tick(1.2);
    expect(p.runner.holdState().holding).toBe(false);
    expect(p.runner.plays()[0]).toMatchObject({ waiting: true, fired: 0, active: false });
    expect(p.runner.waiting()).toBe(true);
    gate.open = true;
    p.tick(1.2);
    expect(p.runner.holdState().holding).toBe(true);
    expect(p.runner.plays()[0]).toMatchObject({ waiting: false, active: true });
    expect(p.runner.waiting()).toBe(false);
  });

  it("lets a seek and a jump through a closed gate", async () => {
    const gate = { open: false };
    const p = setup(() => gate.open);
    p.tick(0.2, { jumped: true });
    await flush();
    p.tick(3.5, { jumped: true });
    expect(p.runner.plays()[0]).toMatchObject({ fired: 2, active: false, waiting: false });
    expect(p.runner.holdState().holding).toBe(false);
  });

  it("takes a runtime whose ready() throws as ready, and reports it once", async () => {
    const p = setup(() => {
      throw new Error("boom");
    });
    p.tick(0.2, { jumped: true });
    await flush();
    p.tick(0.2);
    for (let i = 0; i < 5; i++) p.tick(1.2);
    expect(p.runner.holdState().holding).toBe(true);
    expect(p.errors).toHaveLength(1);
  });

  it("a runtime without ready() is always ready", async () => {
    const p = setup(undefined);
    p.tick(0.2, { jumped: true });
    await flush();
    p.tick(0.2);
    p.tick(1.2);
    expect(p.runner.holdState().holding).toBe(true);
  });
});
