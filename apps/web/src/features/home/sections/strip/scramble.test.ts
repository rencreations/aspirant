import { describe, expect, it } from "vitest";

import { scrambleAt } from "./scramble";

describe("scrambleAt", () => {
  it("is the word at 1 and noise of the same length at 0", () => {
    expect(scrambleAt("Collections", 1, 3)).toBe("Collections");
    const s = scrambleAt("Collections", 0, 3);
    expect(s).toHaveLength(11);
    expect(s).toMatch(/^[A-Z]{11}$/);
  });

  it("resolves from the left and keeps spaces and marks", () => {
    const s = scrambleAt("Aspirant 5.0", 0.5, 7);
    expect(s.slice(0, 6)).toBe("Aspira");
    expect(s[8]).toBe(" ");
    expect(s[10]).toBe(".");
  });

  it("is the same for the same tick and changes with it", () => {
    expect(scrambleAt("Trailer", 0.2, 5)).toBe(scrambleAt("Trailer", 0.2, 5));
    const seen = new Set<string>();
    for (let t = 0; t < 12; t++) seen.add(scrambleAt("Trailer", 0.2, t));
    expect(seen.size).toBeGreaterThan(3);
  });
});
