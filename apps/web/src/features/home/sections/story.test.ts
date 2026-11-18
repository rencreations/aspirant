import { describe, expect, it } from "vitest";

import { STORY, storyAt, storyEnd } from "./story";

describe("the story axis", () => {
  it("is one piece: each section starts where the one before it ends", () => {
    expect(STORY.hero.start).toBe(0);
    expect(storyEnd("hero")).toBeCloseTo(STORY.aspirants.start, 9);
    expect(storyEnd("aspirants")).toBeCloseTo(STORY.rows.start, 9);
    expect(storyEnd("rows")).toBeCloseTo(STORY.strip.start, 9);
  });

  it("keeps the old lengths of the rows and the strip, so their beats are untouched", () => {
    expect(STORY.rows.length).toBe(2.4);
    expect(STORY.strip.length).toBe(3.1);
  });

  it("places a position of a section on the axis", () => {
    expect(storyAt("rows", 1)).toBeCloseTo(6.3, 9);
    expect(storyAt("strip", 0)).toBeCloseTo(7.7, 9);
  });
});
