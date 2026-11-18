import { describe, expect, it } from "vitest";

import { KIND_INFO, MARK_KINDS } from "./kinds";
import { STRIDE, type AnchorRef, type Projector } from "./mark";
import { SUSTAIN_IDLE_S, MarkSystem } from "./system";

/** An "object" that is just a place: the projector reads it. */
interface Body {
  isObject3D: true;
  x: number;
  y: number;
  hidden: boolean;
}

function body(x = 0, y = 0): Body {
  return { isObject3D: true, x, y, hidden: false };
}

const projector: Projector = {
  project(ref: AnchorRef): void {
    const b = ref.object as unknown as Body;
    ref.visible = !b.hidden;
    ref.x = b.x + ref.offX;
    ref.y = b.y + ref.offY;
  },
};

const FRAME = 1 / 60;

function run(system: MarkSystem, seconds: number, tick?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += FRAME) {
    tick?.();
    system.step(FRAME);
  }
}

function finite(system: MarkSystem): boolean {
  for (let i = 0; i < system.count * STRIDE; i++)
    if (!Number.isFinite(system.data[i])) return false;
  return true;
}

describe("emit", () => {
  it("puts marks in the buffer, and they all end", () => {
    const system = new MarkSystem(projector, 64);
    system.emit("bang", { at: { x: 5, y: 6 } });
    system.step(0.2);
    expect(system.count).toBe(1);
    expect(system.alive).toBe(1);
    expect(system.data[0]).toBeCloseTo(5, 3);
    expect(system.data[1]).toBeGreaterThan(5.99);
    run(system, KIND_INFO.bang.duration + 0.5);
    expect(system.count).toBe(0);
    expect(system.alive).toBe(0);
  });

  it.each(MARK_KINDS)("%s writes finite numbers for its whole life and then ends", (kind) => {
    const system = new MarkSystem(projector, 128);
    system.emit(kind, { at: { x: 0, y: 0 }, seed: 11 });
    let seen = 0;
    for (let t = 0; t < KIND_INFO[kind].duration + 1.5; t += FRAME) {
      system.step(FRAME);
      expect(finite(system)).toBe(true);
      seen = Math.max(seen, system.count);
    }
    expect(seen).toBeGreaterThan(0);
    expect(system.alive).toBe(0);
  });

  it("holds still when dt is 0", () => {
    const system = new MarkSystem(projector, 16);
    system.emit("starburst", { at: { x: 0, y: 0 }, seed: 2 });
    run(system, 0.3);
    const before = Array.from(system.data.slice(0, system.count * STRIDE));
    for (let i = 0; i < 10; i++) system.step(0);
    expect(Array.from(system.data.slice(0, system.count * STRIDE))).toEqual(before);
    expect(system.alive).toBeGreaterThan(0);
  });

  it("waits for its delay", () => {
    const system = new MarkSystem(projector, 16);
    system.emit("bang", { at: { x: 0, y: 0 }, delay: 0.5 });
    run(system, 0.3);
    expect(system.count).toBe(0);
    expect(system.alive).toBe(1);
    run(system, 0.4);
    expect(system.count).toBe(1);
  });

  it("a weak one is smaller and has fewer parts", () => {
    const strong = new MarkSystem(projector, 64);
    const weak = new MarkSystem(projector, 64);
    strong.emit("starburst", { at: { x: 0, y: 0 }, seed: 1, strength: 1 });
    weak.emit("starburst", { at: { x: 0, y: 0 }, seed: 1, strength: 0 });
    strong.step(0.3);
    weak.step(0.3);
    expect(weak.count).toBeLessThan(strong.count);
    expect(weak.count).toBeGreaterThan(0);
    expect(weak.data[2]).toBeLessThan(strong.data[2]!);
  });

  it("never throws when more is asked for than the pool holds", () => {
    const system = new MarkSystem(projector, 10);
    for (let i = 0; i < 50; i++) system.emit("starburst", { at: { x: i, y: 0 } });
    system.step(0.1);
    expect(system.alive).toBeLessThanOrEqual(10);
    expect(system.count).toBeLessThanOrEqual(10);
  });

  it("the same seed makes the same picture", () => {
    const a = new MarkSystem(projector, 32);
    const b = new MarkSystem(projector, 32);
    a.emit("spark", { at: { x: 1, y: 2 }, seed: 8 });
    b.emit("spark", { at: { x: 1, y: 2 }, seed: 8 });
    run(a, 0.2);
    run(b, 0.2);
    expect(Array.from(a.data.slice(0, a.count * STRIDE))).toEqual(
      Array.from(b.data.slice(0, b.count * STRIDE)),
    );
  });
});

describe("following an object", () => {
  it("follows it by default, and a point stays where it was made", () => {
    const system = new MarkSystem(projector, 16);
    const o = body(0, 0);
    system.emit("heart", { at: o });
    system.emit("heart", { at: { x: 0, y: 0 } });
    system.step(0.3);
    expect(system.count).toBe(2);
    const followX = system.data[0]!;
    o.x = 200;
    system.step(0.016);
    const moved = system.data[0]!;
    expect(moved - followX).toBeGreaterThan(150);
    // The second mark (a point) did not move with the object.
    expect(Math.abs(system.data[STRIDE]! - followX)).toBeLessThan(40);
  });

  it("follow false leaves the marks where they were made", () => {
    const system = new MarkSystem(projector, 16);
    const o = body(0, 0);
    system.emit("bang", { at: o, follow: false });
    system.step(0.3);
    const x = system.data[0]!;
    o.x = 300;
    system.step(0.016);
    expect(system.data[0]!).toBeCloseTo(x, 1);
  });

  it("is not drawn while its object is hidden, and comes back", () => {
    const system = new MarkSystem(projector, 16);
    const o = body(0, 0);
    system.emit("zzz", { at: o });
    system.step(0.4);
    expect(system.count).toBeGreaterThan(0);
    o.hidden = true;
    system.step(0.016);
    expect(system.count).toBe(0);
    o.hidden = false;
    system.step(0.016);
    expect(system.count).toBeGreaterThan(0);
  });

  it("makes nothing for an object that is hidden when it is asked", () => {
    const system = new MarkSystem(projector, 16);
    const o = body();
    o.hidden = true;
    system.emit("bang", { at: o });
    expect(system.alive).toBe(0);
  });

  it("adds the offset in pixels", () => {
    const system = new MarkSystem(projector, 16);
    system.emit("sparkle", { at: body(10, 20), offset: { x: 5, y: -7 } });
    system.step(0.2);
    expect(system.data[0]).toBeCloseTo(15, 3);
    expect(system.data[1]).toBeCloseTo(13, 3);
  });
});

describe("sustain", () => {
  it("takes no slot until it is set, and an unset loop keeps the pass idle", () => {
    const system = new MarkSystem(projector, 256);
    const handle = system.sustain("note", { at: { x: 0, y: 0 } });
    expect(handle.active).toBe(false);
    expect(system.sustains).toBe(0);
    run(system, 1);
    expect(system.alive).toBe(0);
  });

  it("a loop made long before its first update still starts (a loop made in mount)", () => {
    const system = new MarkSystem(projector, 256);
    const handle = system.sustain("note", { at: { x: 0, y: 0 } });
    run(system, 1);
    run(system, 0.5, () => {
      handle.update({ x: 0, y: 0 }, 1);
    });
    expect(handle.active).toBe(true);
    expect(system.alive).toBeGreaterThan(0);
  });

  it("runs while it is set and goes quiet by itself when it is not", () => {
    const system = new MarkSystem(projector, 256);
    const handle = system.sustain("note", { at: { x: 0, y: 0 } });
    run(system, 1.5, () => {
      handle.update({ x: 0, y: 0 }, 1);
    });
    expect(handle.active).toBe(true);
    expect(system.sustains).toBe(1);
    expect(system.alive).toBeGreaterThan(1);
    run(system, SUSTAIN_IDLE_S + 0.1);
    expect(handle.active).toBe(false);
    expect(system.sustains).toBe(0);
    run(system, KIND_INFO.note.duration + 1);
    expect(system.alive).toBe(0);
  });

  it("runs again when it is set after a pause (the visitor scrolled away and came back)", () => {
    const system = new MarkSystem(projector, 256);
    const handle = system.sustain("note", { at: { x: 0, y: 0 } });
    const set = (): void => {
      handle.update({ x: 0, y: 0 }, 1);
    };
    run(system, 0.5, set);
    run(system, 3);
    expect(system.alive).toBe(0);
    expect(handle.active).toBe(false);
    run(system, 0.5, set);
    expect(handle.active).toBe(true);
    expect(system.alive).toBeGreaterThan(0);
  });

  it("one long frame does not kill a loop that is being set", () => {
    const system = new MarkSystem(projector, 256);
    const handle = system.sustain("heart", { at: { x: 0, y: 0 } });
    handle.update({ x: 0, y: 0 }, 1);
    system.step(0.5);
    handle.update({ x: 0, y: 0 }, 1);
    system.step(FRAME);
    expect(handle.active).toBe(true);
    expect(system.alive).toBeGreaterThan(0);
  });

  it("a stronger loop makes more, and zero makes none", () => {
    const rate = (intensity: number): number => {
      const system = new MarkSystem(projector, 512);
      const h = system.sustain("dust", { at: { x: 0, y: 0 } });
      run(system, 1, () => {
        h.update({ x: 0, y: 0 }, intensity);
      });
      return system.alive;
    };
    expect(rate(1)).toBeGreaterThan(rate(0.3));
    expect(rate(0)).toBe(0);
  });

  it("stop ends it, what was made finishes, and it can be set again", () => {
    const system = new MarkSystem(projector, 128);
    const h = system.sustain("heart", { at: { x: 0, y: 0 } });
    run(system, 1, () => {
      h.update({ x: 0, y: 0 }, 1);
    });
    h.stop();
    expect(h.active).toBe(false);
    expect(system.sustains).toBe(0);
    run(system, KIND_INFO.heart.duration + 1.5);
    expect(system.alive).toBe(0);
    run(system, 0.5, () => {
      h.update({ x: 0, y: 0 }, 1);
    });
    expect(h.active).toBe(true);
    expect(system.alive).toBeGreaterThan(0);
  });

  it("two handles each run in a slot of their own, and a stopped one cannot touch the other", () => {
    const system = new MarkSystem(projector, 128);
    const a = system.sustain("heart", { at: { x: 0, y: 0 } });
    const b = system.sustain("note", { at: { x: 0, y: 0 } });
    a.update({ x: 0, y: 0 }, 1);
    b.update({ x: 0, y: 0 }, 1);
    expect(system.sustains).toBe(2);
    a.stop();
    expect(a.active).toBe(false);
    expect(b.active).toBe(true);
    // A third takes the slot a freed.
    const c = system.sustain("dust", { at: { x: 0, y: 0 } });
    c.update({ x: 0, y: 0 }, 1);
    expect(system.sustains).toBe(2);
    // The stopped handle's slot now belongs to c: a, stopped, cannot end it.
    a.stop();
    expect(c.active).toBe(true);
    expect(b.active).toBe(true);
  });

  it("dizzy stars are held while the loop runs and let go when it stops", () => {
    const system = new MarkSystem(projector, 64);
    const h = system.sustain("dizzy", { at: { x: 0, y: 0 } });
    run(system, 4, () => {
      h.update({ x: 0, y: 0 }, 1);
    });
    expect(system.alive).toBe(KIND_INFO.dizzy.count);
    h.stop();
    run(system, 1.2);
    expect(system.alive).toBe(0);
  });

  it("dizzy stars come back when the loop is set again after a pause", () => {
    const system = new MarkSystem(projector, 64);
    const h = system.sustain("dizzy", { at: { x: 0, y: 0 } });
    const set = (): void => {
      h.update({ x: 0, y: 0 }, 1);
    };
    run(system, 1, set);
    run(system, 2);
    expect(system.alive).toBe(0);
    run(system, 1, set);
    expect(system.alive).toBe(KIND_INFO.dizzy.count);
  });

  it("with every slot taken a loop does nothing, and works once a slot frees", () => {
    const system = new MarkSystem(projector, 512);
    const taken = Array.from({ length: 24 }, () => system.sustain("heart", { at: { x: 0, y: 0 } }));
    for (const h of taken) h.update({ x: 0, y: 0 }, 0);
    expect(system.sustains).toBe(24);
    const late = system.sustain("note", { at: { x: 0, y: 0 } });
    late.update({ x: 0, y: 0 }, 1);
    expect(late.active).toBe(false);
    late.stop();
    taken[0]!.stop();
    late.update({ x: 0, y: 0 }, 1);
    expect(late.active).toBe(true);
    expect(system.sustains).toBe(24);
  });

  it("streaks that stay with the anchor (air) move with it", () => {
    const system = new MarkSystem(projector, 256);
    const o = body(0, 0);
    const h = system.sustain("air", { at: o });
    run(system, 0.6, () => {
      h.update(o, 1);
    });
    expect(system.count).toBeGreaterThan(0);
    const before = system.data[0]!;
    o.x = 400;
    h.update(o, 1);
    system.step(FRAME);
    expect(system.data[0]! - before).toBeGreaterThan(300);
  });

  it("a direction given later is kept when the loop restarts", () => {
    const system = new MarkSystem(projector, 256);
    const h = system.sustain("air", { at: { x: 0, y: 0 } });
    h.update({ x: 0, y: 0 }, 1, Math.PI);
    expect(h.config.direction).toBeCloseTo(Math.PI, 6);
    run(system, 2);
    expect(h.active).toBe(false);
    h.update({ x: 0, y: 0 }, 1);
    expect(h.active).toBe(true);
    expect(h.slot!.direction).toBeCloseTo(Math.PI, 6);
  });

  it("clear removes every mark and loop, and a handle can start again", () => {
    const system = new MarkSystem(projector, 64);
    const h = system.sustain("heart", { at: { x: 0, y: 0 } });
    h.update({ x: 0, y: 0 }, 1);
    system.emit("bang", { at: { x: 0, y: 0 } });
    system.clear();
    expect(system.alive).toBe(0);
    expect(system.sustains).toBe(0);
    expect(system.count).toBe(0);
    h.update({ x: 0, y: 0 }, 1);
    expect(h.active).toBe(true);
  });
});
