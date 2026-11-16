import { describe, expect, it } from "vitest";

import { artLayout, artName, heroIndex } from "./art-layout";

describe("artLayout", () => {
  it("composes the wall by the number of pictures", () => {
    expect(artLayout(1)).toBe("solo");
    expect(artLayout(2)).toBe("pair");
    expect(artLayout(4)).toBe("collage");
    expect(artLayout(5)).toBe("mosaic");
  });

  it("falls back to plain rows for a count it has no composition for", () => {
    expect(artLayout(3)).toBe("rows");
    expect(artLayout(6)).toBe("rows");
    expect(artLayout(0)).toBe("solo");
  });
});

describe("heroIndex", () => {
  it("names the picture that hangs largest", () => {
    expect(heroIndex(4)).toBe(0);
    expect(heroIndex(5)).toBe(2);
    expect(heroIndex(1)).toBe(0);
  });

  it("names none where the pictures are peers", () => {
    expect(heroIndex(2)).toBe(-1);
    expect(heroIndex(3)).toBe(-1);
  });
});

describe("artName", () => {
  it("drops the opening of a description and keeps the names", () => {
    expect(artName("The official splash art of Fanny, Blade of Kibou")).toBe(
      "Fanny, Blade of Kibou",
    );
    expect(artName("Official art of Fanny and Layla under a blue sky")).toBe(
      "Fanny and Layla under a blue sky",
    );
    expect(artName("The key art of The Aspirants: Fanny and Layla")).toBe("Fanny and Layla");
  });

  it("shows any other description whole", () => {
    expect(artName("A scene of the official interactive drama")).toBe(
      "A scene of the official interactive drama",
    );
    expect(artName("Official art of ")).toBe("Official art of ");
  });
});
