import { describe, expect, it } from "vitest";

import { fillStops, parseColor, parseColors, sameColors, type RGB } from "./colors";

const close = (a: RGB | null, b: readonly number[]) => {
  expect(a).not.toBeNull();
  for (let i = 0; i < 3; i++) expect(a![i]).toBeCloseTo(b[i]!, 2);
};

describe("parseColor", () => {
  it("reads hex in the three and six digit forms, with or without alpha", () => {
    close(parseColor("#fff"), [1, 1, 1]);
    close(parseColor("#5ce1ff"), [0x5c / 255, 0xe1 / 255, 1]);
    close(parseColor("#5ce1ff80"), [0x5c / 255, 0xe1 / 255, 1]);
    close(parseColor("#f00c"), [1, 0, 0]);
  });

  it("reads rgb and rgba in 0 to 255 and in percent", () => {
    close(parseColor("rgb(255, 0, 128)"), [1, 0, 128 / 255]);
    close(parseColor("rgba(0 51 255 / 0.5)"), [0, 0.2, 1]);
    close(parseColor("rgb(100%, 50%, 0%)"), [1, 0.5, 0]);
  });

  it("reads hsl", () => {
    close(parseColor("hsl(0, 100%, 50%)"), [1, 0, 0]);
    close(parseColor("hsl(120deg 100% 25%)"), [0, 0.5, 0]);
    close(parseColor("hsla(240, 100%, 50%, 0.3)"), [0, 0, 1]);
  });

  it("gives null for what it cannot read", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("banana")).toBeNull();
    expect(parseColor("#12")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("rgb(a, b, c)")).toBeNull();
  });

  it("clamps what is out of range", () => {
    close(parseColor("rgb(300, -5, 0)"), [1, 0, 0]);
  });
});

describe("parseColors", () => {
  const fallback: RGB[] = [[0.1, 0.2, 0.3]];

  it("skips what does not parse and keeps the order", () => {
    const out = parseColors(["#000", "nope", "#fff"], fallback);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual([1, 1, 1]);
  });

  it("falls back when nothing parses or the list is missing", () => {
    expect(parseColors(["x", "y"], fallback)).toEqual(fallback);
    expect(parseColors(undefined, fallback)).toEqual(fallback);
    expect(parseColors([], fallback)).toEqual(fallback);
  });

  it("keeps four at most", () => {
    expect(parseColors(["#111", "#222", "#333", "#444", "#555"], fallback)).toHaveLength(4);
  });
});

describe("fillStops", () => {
  const a: RGB = [1, 0, 0];
  const b: RGB = [0, 1, 0];
  const c: RGB = [0, 0, 1];
  const d: RGB = [1, 1, 0];

  it("makes four stops from one to four colours", () => {
    expect(fillStops([a])).toEqual([a, a, a, a]);
    expect(fillStops([a, b])).toEqual([a, b, a, b]);
    expect(fillStops([a, b, c])).toEqual([a, b, c, b]);
    expect(fillStops([a, b, c, d])).toEqual([a, b, c, d]);
  });

  it("never returns an undefined stop, even for an empty list", () => {
    for (const stop of fillStops([])) expect(stop).toHaveLength(3);
  });
});

describe("sameColors", () => {
  it("compares by content, not by reference", () => {
    expect(sameColors(["#fff", "#000"], ["#fff", "#000"])).toBe(true);
    expect(sameColors(["#fff"], ["#fff", "#000"])).toBe(false);
    expect(sameColors(["#fff", "#111"], ["#fff", "#000"])).toBe(false);
    expect(sameColors(undefined, undefined)).toBe(true);
    expect(sameColors(undefined, ["#fff"])).toBe(false);
  });
});
