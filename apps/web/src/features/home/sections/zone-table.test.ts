import { describe, expect, it } from "vitest";

import { validatePlays } from "../kernel/plays";

import { snapSeconds, zoneTable } from "./zone-table";

describe("zoneTable", () => {
  const table = zoneTable(0, [
    { zone: 1, to: 0.25 },
    { rest: 2 },
    { zone: 1.5, to: 1 },
    { rest: 0.5 },
  ]);

  it("adds the segments up to the section's length", () => {
    expect(table.screens).toBeCloseTo(5, 9);
  });

  it("writes `at` and `span` as shares of the section and keeps the stations contiguous", () => {
    const [a, b] = table.plays;
    expect(a!.at).toBe(0);
    expect(a!.span).toBeCloseTo(0.2, 9);
    expect(a!.from).toBe(0);
    expect(a!.to).toBe(0.25);
    expect(b!.at).toBeCloseTo(0.6, 9);
    expect(b!.span).toBeCloseTo(0.3, 9);
    expect(b!.from).toBe(0.25);
    expect(b!.to).toBe(1);
  });

  it("is a table the kernel accepts, and says where each zone lies in screens", () => {
    expect(() => {
      validatePlays("x", table.plays);
    }).not.toThrow();
    expect(table.zones).toEqual([
      { from: 0, to: 1 },
      { from: 3, to: 4.5 },
    ]);
  });

  it("snaps a full traverse in about half a second a screen, within 0.35 and 0.9 s", () => {
    expect(snapSeconds(0.2)).toBe(0.35);
    expect(snapSeconds(1)).toBeCloseTo(0.55, 9);
    expect(snapSeconds(3)).toBe(0.9);
  });
});
