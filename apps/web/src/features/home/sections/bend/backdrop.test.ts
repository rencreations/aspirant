import { describe, expect, it } from "vitest";

import { backdropAt } from "./backdrop";
import { BEAT_SPAN, T, beatAt, newBeat, type BeatState } from "./beats";

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
