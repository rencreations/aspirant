import { describe, expect, it } from "vitest";

import { CALM, GRID, backdropAt } from "./backdrop";

describe("the archive's backdrop", () => {
  it("leaves the neighbour's backdrop alone until the entry begins", () => {
    expect(backdropAt(10, 10, 14)).toBeNull();
    expect(backdropAt(9, 10, 14)).toBeNull();
  });

  it("is the grid for the entry and the tour, and the calm one once the covers lift", () => {
    expect(backdropAt(10.01, 10, 14)).toBe(GRID);
    expect(backdropAt(13.99, 10, 14)).toBe(GRID);
    expect(backdropAt(14, 10, 14)).toBe(CALM);
    expect(backdropAt(20, 10, 14)).toBe(CALM);
  });

  it("asks for the same calm backdrop as the footer, so the hand-over has no cross-fade", () => {
    expect(CALM.kind).toBe("iridescence");
  });
});
