import { describe, expect, it } from "vitest";

import { playsOf } from "../../kernel/beat";
import { validatePlays } from "../../kernel/plays";

import {
  FRAME_COUNT,
  frameRestScreens,
  LIST_LAST,
  LIST_LEAD,
  LIST_SCREENS,
  LIST_STEPS,
  TURN_SPAN,
} from "./stations";
import { listBeats, newListBeats, thumbRise } from "./timeline";

describe("the list's zones", () => {
  it("make a valid table of plays that ends before the dwell", () => {
    const plays = playsOf(0, LIST_LAST, LIST_SCREENS, LIST_STEPS);
    expect(plays).toHaveLength(FRAME_COUNT);
    expect(() => {
      validatePlays("list", plays);
    }).not.toThrow();
    const last = plays[plays.length - 1]!;
    expect(last.at + (last.span ?? 0)).toBeLessThanOrEqual(1);
    expect(last.to).toBe(1);
  });

  it("rest every frame between two zones, on the middle of the rest", () => {
    for (let k = 0; k < FRAME_COUNT; k += 1) {
      const at = frameRestScreens(k);
      const before = LIST_STEPS[k - 1];
      const after = LIST_STEPS[k];
      if (before) expect(at).toBeGreaterThan(before.atScreens + TURN_SPAN);
      if (after) expect(at).toBeLessThan(after.atScreens);
    }
  });

  it("have a lead the descent agrees on", () => {
    expect(LIST_LEAD).toBe(1.6);
  });
});

describe("the list's beats", () => {
  const b = newListBeats();

  it("rise from the bottom in the lead and are in place at the section's start", () => {
    listBeats(-LIST_LEAD, b);
    expect(b.rise).toBe(0);
    expect(b.strip).toBe(0);
    expect(b.head).toBe(0);
    listBeats(-LIST_LEAD / 2, b);
    expect(b.rise).toBeCloseTo(0.5, 9);
    expect(b.strip).toBeGreaterThan(0);
    expect(b.strip).toBeLessThan(1);
    // The heading is a little later than the strip.
    expect(b.head).toBeLessThan(b.strip + 0.2);
    listBeats(0, b);
    expect(b.rise).toBe(1);
    expect(b.strip).toBe(1);
    expect(b.head).toBe(1);
    expect(b.cue).toBe(1);
    expect(b.chrome).toBe(1);
  });

  it("keep the strip's index inside the frames and start the growth at the last frame", () => {
    listBeats(-3, b);
    expect(b.index).toBe(0);
    listBeats(4.5, b);
    expect(b.index).toBe(4.5);
    expect(b.expandRaw).toBe(0);
    listBeats(FRAME_COUNT - 1, b);
    expect(b.index).toBe(FRAME_COUNT - 1);
    expect(b.expand).toBe(0);
    listBeats(LIST_LAST - 0.5, b);
    expect(b.expandRaw).toBeCloseTo(0.5, 9);
    expect(b.expand).toBeCloseTo(0.5, 9);
    listBeats(LIST_LAST + 2, b);
    expect(b.index).toBe(FRAME_COUNT - 1);
    expect(b.expand).toBe(1);
  });

  it("send the far small pictures up later than the near ones", () => {
    expect(thumbRise(0, 0)).toBe(1);
    expect(thumbRise(1, 6)).toBe(0);
    expect(thumbRise(0.5, 4)).toBeGreaterThan(thumbRise(0.5, 0));
  });
});
