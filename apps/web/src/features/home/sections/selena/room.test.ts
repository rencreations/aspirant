import { describe, expect, it } from "vitest";

import { selenaEnd } from "../list/selena-frame";

import { roomPlace } from "./room";

describe("the dragon's place in the room", () => {
  it("is where the clip puts it (round seven: the recording's own composition)", () => {
    for (const vp of [
      { w: 1440, h: 900 },
      { w: 1706, h: 950 },
      { w: 390, h: 844 },
    ]) {
      expect(roomPlace(vp)).toEqual({ dx: 0, dy: 0, scale: 1 });
    }
  });

  it("leaves room for the dragon: Selena takes less than the whole free area", () => {
    const wide = selenaEnd({ w: 1440, h: 900 });
    expect(wide.height).toBeGreaterThan(0);
    // Her height on a 900 px screen is below the screen's, whatever the pose does.
    expect(wide.height).toBeLessThan(900);
  });
});
