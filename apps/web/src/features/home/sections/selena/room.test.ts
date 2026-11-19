import { describe, expect, it } from "vitest";

import { selenaEnd } from "../list/selena-frame";

import { roomPlace } from "./room";

describe("the dragon's place in the room", () => {
  it("is below Selena on a wide screen and on a phone, so the two read apart", () => {
    for (const vp of [
      { w: 1440, h: 900 },
      { w: 1706, h: 950 },
      { w: 390, h: 844 },
    ]) {
      const place = roomPlace(vp);
      expect(place.dy).toBeLessThan(0);
      expect(Math.abs(place.dx)).toBeLessThan(0.2);
      expect(place.scale).toBeGreaterThan(0.5);
      expect(place.scale).toBeLessThan(1.5);
    }
  });

  it("leaves room for the dragon: Selena takes less than the whole free area", () => {
    const wide = selenaEnd({ w: 1440, h: 900 });
    expect(wide.height).toBeGreaterThan(0);
    // Her height on a 900 px screen is below the screen's, whatever the pose does.
    expect(wide.height).toBeLessThan(900);
  });
});
