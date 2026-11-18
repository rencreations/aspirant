import { describe, expect, it } from "vitest";

import type { AnchorRef, Projector } from "../comic-marks/mark";
import { TRAIL_SLOTS, TrailSystem } from "./system";

interface Body {
  isObject3D: true;
  x: number;
  y: number;
  hidden: boolean;
}

const body = (x = 0, y = 0): Body => ({ isObject3D: true, x, y, hidden: false });

const projector: Projector = {
  project(ref: AnchorRef): void {
    const b = ref.object as unknown as Body;
    ref.visible = !b.hidden;
    ref.x = b.x + ref.offX;
    ref.y = b.y + ref.offY;
  },
};

const FRAME = 1 / 60;

/** Move `o` along `path` for `seconds`, tracking every frame. */
function drive(
  system: TrailSystem,
  handle: ReturnType<TrailSystem["create"]>,
  o: Body,
  seconds: number,
  path: (t: number) => { x: number; y: number },
  from = 0,
): void {
  for (let t = from; t < from + seconds - 1e-9; t += FRAME) {
    const p = path(t);
    o.x = p.x;
    o.y = p.y;
    handle.track(o);
    system.step(FRAME);
  }
}

const finite = (system: TrailSystem): boolean => system.data.every((v) => Number.isFinite(v));

describe("TrailSystem", () => {
  it("takes a slot when tracked and draws a ribbon behind a mover", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ width: 20, life: 0.6 });
    const o = body();
    expect(h.live).toBe(false);
    drive(system, h, o, 0.5, (t) => ({ x: t * 600, y: 0 }));
    expect(h.live).toBe(true);
    expect(system.active).toBe(1);
    expect(system.used).toBe(1);
    expect(finite(system)).toBe(true);
    // Something is drawn: some vertex has opacity.
    let max = 0;
    for (let i = 6; i < 7 * 82 * 2; i += 7) max = Math.max(max, system.data[i]!);
    expect(max).toBeGreaterThan(0.5);
  });

  it("remembers a point only when the anchor has moved far enough", () => {
    const system = new TrailSystem(projector);
    const still = system.create({ minDist: 10 });
    const o = body();
    drive(system, still, o, 0.5, () => ({ x: 0, y: 0 }));
    // A trail at rest holds the one point it started with.
    expect(system.remembered(still)).toBe(1);

    const slow = system.create({ minDist: 10 });
    const p = body();
    // 150 pixels a second is 2.5 a frame: a point about every four frames.
    drive(system, slow, p, 0.5, (t) => ({ x: t * 150, y: 0 }));
    const kept = system.remembered(slow);
    expect(kept).toBeGreaterThan(4);
    expect(kept).toBeLessThan(12);
  });

  it("remembers points no closer in time than its memory allows, at any refresh rate", () => {
    const at = (dt: number): number => {
      const system = new TrailSystem(projector);
      const h = system.create({ life: 0.6, minDist: 0.5 });
      const o = body();
      for (let t = 0; t < 1; t += dt) {
        o.x = t * 900;
        h.track(o);
        system.step(dt);
      }
      return system.remembered(h);
    };
    expect(at(1 / 60)).toBeGreaterThan(30);
    expect(at(1 / 240)).toBeGreaterThan(30);
    expect(at(1 / 240)).toBeLessThanOrEqual(40);
  });

  it("lets a trail that is no longer tracked dissolve and then gives the slot back", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ life: 0.4 });
    const o = body();
    drive(system, h, o, 0.5, (t) => ({ x: t * 500, y: 0 }));
    expect(h.live).toBe(true);
    for (let i = 0; i < 12; i++) system.step(FRAME);
    expect(h.live).toBe(true);
    for (let i = 0; i < 60; i++) system.step(FRAME);
    expect(h.live).toBe(false);
    expect(system.active).toBe(0);
    expect(system.used).toBe(0);
    expect(system.data.every((v) => v === 0)).toBe(true);
  });

  it("a trail can be tracked again after it has gone", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ life: 0.3 });
    const o = body();
    drive(system, h, o, 0.3, (t) => ({ x: t * 400, y: 0 }));
    for (let i = 0; i < 60; i++) system.step(FRAME);
    expect(h.live).toBe(false);
    drive(system, h, o, 0.3, (t) => ({ x: t * 400, y: 50 }));
    expect(h.live).toBe(true);
    expect(finite(system)).toBe(true);
  });

  it("cuts the tail when the anchor jumps, so no streak crosses the screen", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ jump: 300 });
    const o = body();
    drive(system, h, o, 0.4, (t) => ({ x: t * 400, y: 0 }));
    o.x = 1400;
    o.y = 700;
    h.track(o);
    system.step(FRAME);
    // After the jump the ribbon is the head and its cap only: nothing reaches back to the old place.
    let reach = 0;
    for (let i = 0; i < 82 * 2; i++) {
      const v = system.data[i * 7]!;
      const w = system.data[i * 7 + 6]!;
      if (w > 0) reach = Math.max(reach, Math.abs(v - 1400));
    }
    expect(reach).toBeLessThan(40);
  });

  it("an anchor that is hidden gets no head and starts afresh when it returns", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ life: 0.3 });
    const o = body();
    drive(system, h, o, 0.3, (t) => ({ x: t * 400, y: 0 }));
    o.hidden = true;
    h.track(o);
    system.step(FRAME);
    expect(finite(system)).toBe(true);
    for (let i = 0; i < 60; i++) {
      h.track(o);
      system.step(FRAME);
    }
    expect(h.live).toBe(false);
  });

  it("does not remember points while time is stopped", () => {
    const system = new TrailSystem(projector);
    const h = system.create();
    const o = body();
    drive(system, h, o, 0.3, (t) => ({ x: t * 400, y: 0 }));
    const before = Array.from(system.data);
    for (let i = 0; i < 30; i++) {
      h.track(o);
      system.step(0);
    }
    expect(Array.from(system.data)).toEqual(before);
  });

  it("cut forgets the tail", () => {
    const system = new TrailSystem(projector);
    const h = system.create();
    const o = body();
    drive(system, h, o, 0.4, (t) => ({ x: t * 400, y: 0 }));
    h.cut();
    h.track(o);
    system.step(FRAME);
    let reach = 0;
    for (let i = 0; i < 82 * 2; i++) {
      if (system.data[i * 7 + 6]! > 0) reach = Math.max(reach, Math.abs(system.data[i * 7]! - o.x));
    }
    expect(reach).toBeLessThan(40);
  });

  it("serves every slot, then ignores the next trail without breaking", () => {
    const system = new TrailSystem(projector);
    const bodies = Array.from({ length: TRAIL_SLOTS + 3 }, (_, i) => body(i * 10, 0));
    const handles = bodies.map(() => system.create());
    for (let f = 0; f < 10; f++) {
      handles.forEach((h, i) => {
        bodies[i]!.x += 8;
        h.track(bodies[i] as never);
      });
      system.step(FRAME);
    }
    expect(system.active).toBe(TRAIL_SLOTS);
    expect(handles.filter((h) => h.live).length).toBe(TRAIL_SLOTS);
    expect(finite(system)).toBe(true);
  });

  it("takes its tail length as `length` or as `life`, and `life` wins", () => {
    const system = new TrailSystem(projector);
    expect(system.create({ length: 0.9 }).life).toBe(0.9);
    expect(system.create({ life: 0.4 }).life).toBe(0.4);
    expect(system.create({ life: 0.4, length: 0.9 }).life).toBe(0.4);
    expect(system.create().life).toBeCloseTo(0.6, 6);
  });

  it("a point anchor and an offset work too", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ width: 10 });
    for (let f = 0; f < 20; f++) {
      h.track({ x: f * 10, y: 0 }, 0, 25);
      system.step(FRAME);
    }
    expect(h.live).toBe(true);
    expect(finite(system)).toBe(true);
  });

  it("a long run at a high refresh rate stays inside its memory", () => {
    const system = new TrailSystem(projector);
    const h = system.create({ life: 0.6 });
    const o = body();
    const dt = 1 / 240;
    for (let i = 0; i < 2400; i++) {
      o.x = Math.sin(i * 0.02) * 500;
      o.y = Math.cos(i * 0.03) * 200;
      h.track(o);
      system.step(dt);
    }
    expect(finite(system)).toBe(true);
  });
});
