import { describe, expect, it } from "vitest";

import {
  azimuthDegrees,
  count,
  fetchOrder,
  fractionOf,
  humanBytes,
  indexOfId,
  pad2,
  stepIndex,
  whoOf,
} from "./logic";

describe("numbers", () => {
  it("formats bytes", () => {
    expect(humanBytes(512)).toBe("512 B");
    expect(humanBytes(1536)).toBe("1.5 KB");
    expect(humanBytes(4_300_000)).toBe("4.1 MB");
  });
  it("groups thousands", () => {
    expect(count(31620)).toBe("31,620");
  });
  it("pads to two digits", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });
  it("wraps the azimuth into 0 to 359", () => {
    expect(azimuthDegrees(0)).toBe(0);
    expect(azimuthDegrees(Math.PI)).toBe(180);
    expect(azimuthDegrees(-Math.PI / 2)).toBe(270);
    expect(azimuthDegrees(Math.PI * 2)).toBe(0);
  });
  it("never reports a download as whole before it is", () => {
    expect(fractionOf(50, 100)).toBe(0.5);
    expect(fractionOf(100, 100)).toBe(0.99);
    expect(fractionOf(5, 0)).toBe(0);
  });
});

describe("whoOf", () => {
  it("names the Aspirant, or falls back to the title", () => {
    expect(whoOf({ chars: ["vexana"], title: "Eternal Guard" })).toBe("Vexana");
    expect(whoOf({ chars: [], title: "A prop" })).toBe("A prop");
  });
});

describe("the picker", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  it("finds a model by id and falls back to the first", () => {
    expect(indexOfId(items, "c")).toBe(2);
    expect(indexOfId(items, "nope")).toBe(0);
    expect(indexOfId(items, "")).toBe(0);
  });
  it("steps round the ends both ways", () => {
    expect(stepIndex(3, 1, 4)).toBe(0);
    expect(stepIndex(0, -1, 4)).toBe(3);
    expect(stepIndex(1, 1, 4)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
  it("fetches the one on show first, then its neighbours, nearest first", () => {
    expect(fetchOrder(9, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fetchOrder(9, 4)).toEqual([4, 5, 3, 6, 2, 7, 1, 8, 0]);
    expect(fetchOrder(4, 3)).toEqual([3, 2, 1, 0]);
    expect(fetchOrder(0, 0)).toEqual([]);
  });
});
