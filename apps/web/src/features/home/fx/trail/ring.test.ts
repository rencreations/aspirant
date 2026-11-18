import { describe, expect, it } from "vitest";

import { TrailHistory } from "./ring";

describe("TrailHistory", () => {
  it("keeps points newest first", () => {
    const h = new TrailHistory(4);
    h.push(1, 10, 0.1);
    h.push(2, 20, 0.2);
    h.push(3, 30, 0.3);
    expect(h.length).toBe(3);
    expect(h.x[h.newest(0)]).toBe(3);
    expect(h.x[h.newest(1)]).toBe(2);
    expect(h.x[h.newest(2)]).toBe(1);
    expect(h.newestTime()).toBeCloseTo(0.3, 6);
  });

  it("overwrites the oldest when it is full", () => {
    const h = new TrailHistory(3);
    for (let i = 1; i <= 5; i++) h.push(i, 0, i);
    expect(h.length).toBe(3);
    expect([0, 1, 2].map((i) => h.x[h.newest(i)])).toEqual([5, 4, 3]);
  });

  it("drops what is older than a time", () => {
    const h = new TrailHistory(8);
    for (let i = 0; i < 6; i++) h.push(i, 0, i * 0.1);
    h.dropBefore(0.25);
    expect(h.length).toBe(3);
    expect(h.x[h.newest(2)]).toBe(3);
    h.dropBefore(99);
    expect(h.length).toBe(0);
    expect(h.newestTime()).toBe(-Infinity);
  });

  it("keeps working after a wrap and a reset", () => {
    const h = new TrailHistory(3);
    for (let i = 0; i < 10; i++) h.push(i, 0, i);
    h.dropBefore(8);
    h.push(10, 0, 10);
    expect([0, 1, 2].map((i) => h.x[h.newest(i)])).toEqual([10, 9, 8]);
    h.reset();
    expect(h.length).toBe(0);
    h.push(7, 0, 1);
    expect(h.x[h.newest(0)]).toBe(7);
  });
});
