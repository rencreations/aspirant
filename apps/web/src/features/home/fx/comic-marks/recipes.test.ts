import { describe, expect, it } from "vitest";

import { KIND_INFO, MARK_KINDS, PRIM, defaultDirection, type MarkKind } from "./kinds";
import { MarkPool, type Mark } from "./mark";
import { Spawn, spawnKind } from "./recipes";

function make(kind: MarkKind, seed: number, size?: number): { pool: MarkPool; marks: Mark[] } {
  const pool = new MarkPool(256);
  const s = new Spawn(pool);
  const info = KIND_INFO[kind];
  s.kind = kind;
  s.size = size ?? info.size;
  s.duration = info.duration;
  s.count = info.count;
  s.seed = seed;
  s.rot = defaultDirection(kind);
  s.bx = 10;
  s.by = -20;
  spawnKind(s);
  return { pool, marks: pool.layers.flat() };
}

const FIELDS = [
  "bx",
  "by",
  "ox",
  "oy",
  "vx",
  "vy",
  "gx",
  "gy",
  "drag",
  "rot",
  "spin",
  "size",
  "aspect",
  "param",
  "life",
  "age",
  "popT",
  "fadeT",
  "overshoot",
  "squash",
  "throb",
  "wobble",
  "grow",
] as const;

describe("every kind", () => {
  it.each(MARK_KINDS)("%s puts at least one finite mark on the stage", (kind) => {
    const { marks } = make(kind, 7);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) {
      for (const f of FIELDS) expect(Number.isFinite(m[f])).toBe(true);
      expect(m.life).toBeGreaterThan(0);
      expect(m.size).toBeGreaterThan(0);
      expect(m.alive).toBe(true);
      expect(Object.values(PRIM)).toContain(m.prim);
    }
  });

  it.each(MARK_KINDS)("%s draws the same marks for the same seed", (kind) => {
    const a = make(kind, 42).marks;
    const b = make(kind, 42).marks;
    expect(a.length).toBe(b.length);
    a.forEach((m, i) => {
      for (const f of FIELDS) expect(m[f]).toBe(b[i]![f]);
    });
  });

  it.each(MARK_KINDS)("%s scales with its size", (kind) => {
    const small = make(kind, 3, 40).marks;
    const big = make(kind, 3, 80).marks;
    const sum = (list: Mark[]): number => list.reduce((n, m) => n + m.size, 0);
    expect(sum(big)).toBeCloseTo(sum(small) * 2, 3);
  });
});

describe("kinds that vary", () => {
  it("a burst differs from seed to seed", () => {
    const a = make("starburst", 1).marks.map((m) => m.vx);
    const b = make("starburst", 2).marks.map((m) => m.vx);
    expect(a).not.toEqual(b);
  });

  it("the stars of a burst use the colours of the set, not one", () => {
    const colours = new Set(make("starburst", 5).marks.map((m) => `${m.fr}${m.fg}${m.fb}`));
    expect(colours.size).toBeGreaterThan(1);
  });

  it("a dizzy ring orbits instead of flying", () => {
    const { marks } = make("dizzy", 1);
    expect(marks.length).toBe(KIND_INFO.dizzy.count);
    expect(marks.every((m) => m.orbit)).toBe(true);
  });

  it("air streaks lie on both sides and are fatter near the object", () => {
    const { marks } = make("air", 9);
    const sides = new Set(marks.map((m) => Math.sign(m.ox)));
    expect(sides.size).toBeGreaterThan(1);
    expect(Math.max(...marks.map((m) => m.param))).toBeGreaterThan(
      Math.min(...marks.map((m) => m.param)),
    );
  });

  it("a poof has a centre and a ring of puffs", () => {
    const { marks } = make("poof", 1);
    expect(marks.length).toBe(KIND_INFO.poof.count + 1);
    expect(marks.every((m) => m.prim === PRIM.puff)).toBe(true);
  });

  it("the cursing mark is one big mark on the front layer", () => {
    const { pool, marks } = make("swear", 1);
    expect(marks.length).toBe(1);
    expect(pool.layers[2].length).toBe(1);
    expect(marks[0]!.prim).toBe(PRIM.swear);
  });
});
