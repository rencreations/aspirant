import { describe, expect, it } from "vitest";

import { firstPlaces, laterPlaces, startIndex } from "./places";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("startIndex", () => {
  it("reads the picture the address names", () => {
    expect(startIndex("?i=c", items)).toBe(2);
    expect(startIndex("?q=1&i=b", items)).toBe(1);
  });

  it("starts on the first picture for no id or an unknown one", () => {
    expect(startIndex("", items)).toBe(0);
    expect(startIndex("?i=zzz", items)).toBe(0);
    expect(startIndex("?i=", items)).toBe(0);
  });
});

describe("firstPlaces", () => {
  it("is the places -1 to 3 round the loop", () => {
    expect(firstPlaces(0, 14)).toEqual([13, 0, 1, 2, 3]);
    expect(firstPlaces(12, 14)).toEqual([11, 12, 13, 0, 1]);
  });

  it("never repeats a picture of a short list", () => {
    expect(firstPlaces(0, 3)).toEqual([2, 0, 1]);
  });
});

describe("laterPlaces", () => {
  it("holds every picture that is not in the first screen, next ones first", () => {
    const later = laterPlaces(0, 14);
    expect(later).toHaveLength(14 - 5);
    expect(later.slice(0, 4)).toEqual([4, 12, 5, 11]);
    expect(new Set([...later, ...firstPlaces(0, 14)]).size).toBe(14);
  });

  it("is empty for a list that the first screen covers", () => {
    expect(laterPlaces(0, 5)).toEqual([]);
    expect(laterPlaces(0, 3)).toEqual([]);
  });
});
