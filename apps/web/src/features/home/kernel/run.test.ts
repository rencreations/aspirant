import type { Object3D } from "three";
import { describe, expect, it, vi } from "vitest";

import { ActorRegistry } from "./actors";
import { layoutSections } from "./layout";
import { SectionRunner } from "./run";
import type { Actor, FrameInfo, HomeSection, SectionCtx, SectionRuntime } from "./types";

const VIEW = { w: 1000, h: 800, dpr: 1 };

function frame(S: number): FrameInfo {
  return {
    time: 0,
    dt: 1 / 60,
    S,
    raw: S,
    velocity: 0,
    viewport: VIEW,
    frame: 0,
    input: { wheel: 0 },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** What a fake section does, recorded, so the order can be checked. */
interface Log {
  calls: string[];
  /** A persistent value the sections write, last writer wins. */
  shared: { value: string };
}

function fakeSection(
  id: string,
  screens: number,
  lead: number,
  tail: number,
  log: Log,
  actor: Actor,
  behave?: Partial<SectionRuntime>,
  mount?: () => Promise<SectionRuntime> | SectionRuntime,
): HomeSection {
  const runtime: SectionRuntime = {
    update: (local) => {
      log.calls.push(`${id}.update(${local.toFixed(2)})`);
      log.shared.value = `${id}@${Math.min(1, local).toFixed(2)}`;
      actor.visible = true;
    },
    enter: () => log.calls.push(`${id}.enter`),
    leave: () => log.calls.push(`${id}.leave`),
    dispose: () => log.calls.push(`${id}.dispose`),
    ...behave,
  };
  return {
    id,
    screens,
    lead,
    tail,
    bg: "daybreak",
    nav: { theme: "daybreak" },
    dom: "fixed",
    preload: () => [],
    mount: mount ?? (() => runtime),
  } as unknown as HomeSection;
}

function setup(defs: (log: Log, actors: ActorRegistry) => HomeSection[]) {
  const log: Log = { calls: [], shared: { value: "" } };
  const actors = new ActorRegistry();
  const layout = layoutSections(defs(log, actors));
  const onActive = vi.fn();
  const onError = vi.fn();
  const runner = new SectionRunner({
    layout,
    actors,
    ctxFor: () => ({}) as SectionCtx,
    onActive,
    onError,
  });
  return { log, actors, runner, onActive, onError };
}

describe("SectionRunner", () => {
  it("hides every actor before the sections run, so an actor nobody sets is not shown", async () => {
    const { runner, actors } = setup((log, reg) => {
      const shown = reg.register({ name: "shown", visible: true });
      reg.register({ name: "left-over", visible: true });
      return [fakeSection("a", 2, 0, 0, log, shown)];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    expect(actors.get("shown")?.visible).toBe(true);
    expect(actors.get("left-over")?.visible).toBe(false);
  });

  it("copies an actor's visibility to the thing the stage draws, after the sections have run", async () => {
    const object = { visible: true } as unknown as Object3D;
    const { runner, actors } = setup((log, reg) => {
      const a = reg.register({ name: "x", visible: false, object });
      return [fakeSection("a", 2, 0, 0, log, a)];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    expect(object.visible).toBe(true);
    runner.step(frame(5), false); // out of every range
    expect(actors.get("x")?.visible).toBe(false);
    expect(object.visible).toBe(false);
  });

  it("lets the later section win where two ranges overlap", async () => {
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 2, 0, 1, l, x), fakeSection("b", 2, 1, 0, l, x)];
    });
    runner.step(frame(2.2), true);
    await flush();
    log.calls.length = 0;
    runner.step(frame(2.2), false); // a is in its tail, b in its lead
    expect(log.calls.filter((c) => c.includes("update"))).toEqual([
      "a.update(1.10)",
      "b.update(0.10)",
    ]);
    expect(log.shared.value).toBe("b@0.10");
  });

  it("runs the passed sections once, in order, before it hides the actors, after a jump", async () => {
    const { runner, log, actors } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [
        fakeSection("a", 1, 0, 0, l, x),
        fakeSection("b", 1, 0, 0, l, x),
        fakeSection("c", 1, 0, 0, l, x),
      ];
    });
    // Everything is mounted near the start, then the visitor jumps to c.
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    log.calls.length = 0;
    runner.step(frame(2.5), true);
    expect(log.calls.filter((c) => c.includes(".update"))).toEqual([
      "a.update(1.00)",
      "b.update(1.00)",
      "c.update(0.50)",
    ]);
    expect(actors.get("x")?.visible).toBe(true);
  });

  it("replays a passed section with its tail ridden out, so what leaves in the tail is gone", async () => {
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 2, 0, 1, l, x), fakeSection("b", 1, 0, 0, l, x)];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    log.calls.length = 0;
    runner.step(frame(4), true);
    // a is 2 screens long with a tail of 1 screen: its last frame was at local 1.5.
    expect(log.calls.filter((c) => c.startsWith("a.update"))).toEqual(["a.update(1.50)"]);
  });

  it("does not run the passed sections again on a frame that is not a jump", async () => {
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 1, 0, 0, l, x), fakeSection("b", 1, 0, 0, l, x)];
    });
    runner.step(frame(0.5), true);
    runner.step(frame(1.5), true);
    await flush();
    runner.step(frame(1.5), false);
    log.calls.length = 0;
    runner.step(frame(1.6), false);
    expect(log.calls).toEqual(["b.update(0.60)"]);
  });

  it("gives the same state after a jump as after scrolling there slowly", async () => {
    const build = () =>
      setup((l, reg) => {
        const x = reg.register({ name: "x", visible: false });
        const y = reg.register({ name: "y", visible: false });
        return [
          fakeSection("a", 2, 0.5, 0.5, l, x),
          fakeSection("b", 3, 0.5, 0.5, l, y),
          fakeSection("c", 2, 0.5, 0.5, l, x),
        ];
      });
    const slow = build();
    const jump = build();
    // Both have everything mounted ahead of time.
    for (let S = 0; S <= 6; S += 0.5) {
      slow.runner.step(frame(S), false);
      jump.runner.step(frame(S), false);
    }
    await flush();
    // Scroll back to the start, slowly in one and by a jump in the other.
    for (let S = 6; S >= 0; S -= 0.05) slow.runner.step(frame(S), false);
    jump.runner.step(frame(0), true);
    // Then forward again to 4.6.
    for (let S = 0; S <= 4.6001; S += 0.05) slow.runner.step(frame(S), false);
    jump.runner.step(frame(4.6), true);
    slow.runner.step(frame(4.6), false);
    jump.runner.step(frame(4.6), false);
    const state = (s: ReturnType<typeof build>) => ({
      shared: s.log.shared.value,
      actors: s.actors.list().map((a) => [a.name, a.visible]),
    });
    expect(state(jump)).toEqual(state(slow));
  });

  it("skips a runtime that is still mounting, and replays its end once if it arrives passed", async () => {
    let arrive: (r: SectionRuntime) => void = () => undefined;
    const late = new Promise<SectionRuntime>((resolve) => {
      arrive = resolve;
    });
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      const a = fakeSection("a", 1, 0, 0, l, x, undefined, () => late);
      return [a, fakeSection("b", 1, 0, 0, l, x)];
    });
    runner.step(frame(0.5), true); // a starts to mount
    runner.step(frame(1.5), true); // the visitor moves on while it loads
    expect(runner.report(1.5)[0]?.mount).toBe("mounting");
    expect(log.calls.some((c) => c.startsWith("a."))).toBe(false);
    arrive({
      update: (local) => log.calls.push(`a.late(${local.toFixed(2)})`),
      dispose: () => undefined,
    });
    await flush();
    runner.step(frame(1.5), false);
    runner.step(frame(1.5), false);
    expect(log.calls.filter((c) => c.startsWith("a.late"))).toEqual(["a.late(1.00)"]);
  });

  it("mounts what is near without running anything, and counts what is still being built", async () => {
    let arrive: (r: SectionRuntime) => void = () => undefined;
    const late = new Promise<SectionRuntime>((resolve) => {
      arrive = resolve;
    });
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 2, 0, 0, l, x, undefined, () => late)];
    });
    runner.prime(0);
    expect(runner.mounting()).toBe(1);
    arrive({ update: () => log.calls.push("ran"), dispose: () => undefined });
    await flush();
    expect(runner.mounting()).toBe(0);
    expect(runner.report(0)[0]?.mount).toBe("ready");
    expect(log.calls).toEqual([]);
  });

  it("calls enter when a range is entered and leave when it is left", async () => {
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 2, 0, 0, l, x)];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    runner.step(frame(1), false);
    runner.step(frame(3), false);
    expect(log.calls.filter((c) => /enter|leave/.test(c))).toEqual(["a.enter", "a.leave"]);
  });

  it("mounts a section only when the scroll is within two screens of it", async () => {
    const mount = vi.fn(() => ({ update: () => undefined, dispose: () => undefined }));
    const log: Log = { calls: [], shared: { value: "" } };
    const actors = new ActorRegistry();
    const x = actors.register({ name: "x", visible: false });
    const layout = layoutSections([
      fakeSection("a", 4, 0, 0, log, x),
      fakeSection("b", 1, 0, 0, log, x, undefined, mount),
    ]);
    const r = new SectionRunner({ layout, actors, ctxFor: () => ({}) as SectionCtx });
    r.step(frame(1.9), true);
    await flush();
    expect(mount).not.toHaveBeenCalled(); // b starts at 4: it mounts from 2
    r.step(frame(2.1), false);
    await flush();
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it("reports a runtime that throws once, and leaves it out", async () => {
    const { runner, onError, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [
        fakeSection("a", 2, 0, 0, l, x, {
          update: () => {
            throw new Error("boom");
          },
        }),
        fakeSection("b", 2, 0, 0, l, x),
      ];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    runner.step(frame(0.6), false);
    runner.step(frame(0.7), false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(log.calls).toContain("a.dispose");
    expect(runner.report()[0]?.mount).toBe("failed");
  });

  it("reports a section that cannot mount", async () => {
    const { runner, onError } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [
        fakeSection("a", 2, 0, 0, l, x, undefined, () => Promise.reject(new Error("no chunk"))),
      ];
    });
    runner.step(frame(0.5), true);
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(runner.report()[0]?.mount).toBe("failed");
  });

  it("tells who owns the scroll position, once per change", () => {
    const { runner, onActive } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 1, 0, 0, l, x), fakeSection("b", 1, 0, 0, l, x)];
    });
    runner.step(frame(0.2), true);
    runner.step(frame(0.4), false);
    runner.step(frame(1.2), false);
    const ids = (onActive.mock.calls as Array<[{ id: string }]>).map((c) => c[0].id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("disposes every runtime, and does nothing after that", async () => {
    const { runner, log } = setup((l, reg) => {
      const x = reg.register({ name: "x", visible: false });
      return [fakeSection("a", 2, 0, 0, l, x)];
    });
    runner.step(frame(0.5), true);
    await flush();
    runner.step(frame(0.5), false);
    runner.dispose();
    expect(log.calls).toContain("a.leave");
    expect(log.calls).toContain("a.dispose");
    log.calls.length = 0;
    runner.step(frame(0.6), false);
    expect(log.calls).toEqual([]);
  });
});
