import { describe, expect, it } from "vitest";

import { LINES, lineAt } from "./lines";

describe("the wavy lines", () => {
  const out = { head: 0, phase: 0 };

  it("keep the reference's table: four lines, two white and two mint", () => {
    expect(LINES).toHaveLength(4);
    expect(new Set(LINES.map((l) => l.colour)).size).toBe(2);
    expect(LINES.map((l) => l.y)).toEqual([0.6, 0.2, -0.2, -0.6]);
  });

  it("start undrawn, draw on from the right, hold, and erase", () => {
    const spec = LINES[0]!;
    // The stroke is visible where u is between head - 4 and head (u runs 0 at the right end to 1).
    expect(lineAt(0, spec, out).head).toBe(0);
    const drawn = lineAt(0.5, spec, out).head;
    expect(drawn).toBeGreaterThan(1);
    expect(drawn).toBeLessThan(4);
    expect(lineAt(1, spec, out).head).toBeCloseTo(5, 9);
  });

  it("turn the wave one whole cycle over the section", () => {
    const spec = LINES[1]!;
    expect(lineAt(0, spec, out).phase).toBeCloseTo(spec.phase, 9);
    expect(lineAt(1, spec, out).phase).toBeCloseTo(spec.phase + Math.PI * 2, 9);
  });

  it("start the lines one after another by their delays", () => {
    const early = LINES[0]!;
    const late = LINES[3]!;
    expect(lineAt(0.1, early, out).head).toBeGreaterThan(
      lineAt(0.1, late, { head: 0, phase: 0 }).head,
    );
  });
});
