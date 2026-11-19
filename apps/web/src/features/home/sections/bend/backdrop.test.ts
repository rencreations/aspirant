import { describe, expect, it } from "vitest";

import { ELEMENT_FADE, backdropAt } from "./backdrop";
import { BEAT_SPAN, T, beatAt, newBeat, type BeatState } from "./beats";
import { REST_BEATS } from "./plays";

const at = (s: number): BeatState => beatAt(s / BEAT_SPAN, newBeat());

describe("the bend section's backdrop", () => {
  it("goes on with the chase's backdrop while the book closes", () => {
    expect(backdropAt(at(0)).kind).toBe("pixel-blast");
    expect(backdropAt(at(T.bendFrom - 0.01)).kind).toBe("pixel-blast");
  });

  it("draws the element she bends, one for each stance", () => {
    const kinds = [0, 1, 2, 3].map((w) => backdropAt(at(T.bendFrom + (w + 0.5) * T.wave)).kind);
    expect(kinds).toEqual(["earth", "air", "water", "fire"]);
  });

  it("asks for the element at the rest of its stance, formed, and crosses in a short fade", () => {
    const rests = [REST_BEATS[2]!, REST_BEATS[3]!, REST_BEATS[4]!, REST_BEATS[5]!];
    const kinds = rests.map((s) => backdropAt(at(s)).kind);
    expect(kinds).toEqual(["earth", "air", "water", "fire"]);
    // The change of element is a short cross, so a stance is whole a moment after it begins.
    expect(ELEMENT_FADE).toBeLessThanOrEqual(0.4);
    for (const w of [0, 1, 2, 3]) {
      expect(backdropAt(at(T.bendFrom + (w + 0.5) * T.wave)).options.fade).toBe(ELEMENT_FADE);
    }
  });

  it("asks for the next element only after the stance's own rest", () => {
    // The rest stands before the edge: the visitor who stops there sees this stance, not the next.
    for (let w = 0; w < 3; w += 1) {
      const rest = REST_BEATS[w + 2]!;
      const edge = T.bendFrom + (w + 1) * T.wave;
      expect(rest).toBeLessThan(edge);
      expect(backdropAt(at(rest)).kind).not.toBe(backdropAt(at(edge + 0.01)).kind);
    }
  });

  it("has a calm backdrop under the wall and the spiral at the rests", () => {
    expect(backdropAt(at(T.holdTo)).kind).toBe("soft-aurora");
    expect(backdropAt(at(T.restArt)).kind).toBe("aurora");
    expect(backdropAt(at(T.goTo)).kind).toBe("particles");
  });

  it("is thin-film colour while the ring turns and is thrown", () => {
    expect(backdropAt(at((T.gatherFrom + T.ringTo) / 2)).kind).toBe("iridescence");
    expect(backdropAt(at(T.outFrom)).kind).toBe("iridescence");
  });

  it("reuses its asks: no allocation per frame", () => {
    expect(backdropAt(at(T.holdTo))).toBe(backdropAt(at(T.holdTo + 0.01)));
  });
});
