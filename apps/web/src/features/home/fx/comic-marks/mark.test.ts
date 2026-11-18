import { describe, expect, it } from "vitest";

import { AnchorRef, MarkPool, isObject3D } from "./mark";

describe("MarkPool", () => {
  it("hands out marks and takes the dead ones back in order", () => {
    const pool = new MarkPool(8);
    const a = pool.acquire(1);
    const b = pool.acquire(1);
    const c = pool.acquire(1);
    expect(pool.live).toBe(3);
    b.alive = false;
    pool.sweep();
    expect(pool.live).toBe(2);
    expect(pool.layers[1]).toEqual([a, c]);
  });

  it("draws the three layers apart and the newest last", () => {
    const pool = new MarkPool(8);
    const back = pool.acquire(0);
    const front = pool.acquire(2);
    const mid = pool.acquire(1);
    expect(pool.layers[0]).toEqual([back]);
    expect(pool.layers[1]).toEqual([mid]);
    expect(pool.layers[2]).toEqual([front]);
  });

  it("bumps the serial each time a mark is handed out again", () => {
    const pool = new MarkPool(1);
    const m = pool.acquire(1);
    const first = m.serial;
    m.alive = false;
    pool.sweep();
    const again = pool.acquire(1);
    expect(again).toBe(m);
    expect(again.serial).toBe(first + 1);
  });

  it("recycles the oldest mark of the furthest back layer when it is full, and never throws", () => {
    const pool = new MarkPool(3);
    const oldest = pool.acquire(0);
    pool.acquire(1);
    pool.acquire(2);
    const extra = pool.acquire(2);
    expect(extra).toBe(oldest);
    expect(pool.live).toBe(3);
    for (let i = 0; i < 20; i++) pool.acquire(1);
    expect(pool.live).toBe(3);
  });

  it("clears everything", () => {
    const pool = new MarkPool(4);
    pool.acquire(0);
    pool.acquire(2);
    pool.clear();
    expect(pool.live).toBe(0);
    pool.acquire(1);
    expect(pool.live).toBe(1);
  });

  it("resets a recycled mark to its defaults", () => {
    const pool = new MarkPool(1);
    const m = pool.acquire(1);
    m.vx = 5;
    m.held = true;
    m.life = 9;
    m.alive = false;
    pool.sweep();
    const again = pool.acquire(1);
    expect(again.vx).toBe(0);
    expect(again.held).toBe(false);
    expect(again.life).toBe(1);
  });
});

describe("AnchorRef", () => {
  it("tells a point from an object", () => {
    const ref = new AnchorRef();
    ref.set({ x: 3, y: 4 }, null, 1, 2);
    expect(ref.point).toEqual({ x: 3, y: 4 });
    expect(ref.object).toBeNull();
    expect(ref.offX).toBe(1);
    const fake = { isObject3D: true } as never;
    expect(isObject3D(fake)).toBe(true);
    ref.set(fake, null, 0, 0);
    expect(ref.object).toBe(fake);
    expect(ref.point).toBeNull();
  });
});
