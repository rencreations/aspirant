import { describe, expect, it } from "vitest";

import { stickerOn, stickerShow, stickerSpring } from "./sticker-math";

const area = { nx: 0, ny: -1, nz: 0, radius: 0.16 };

describe("the sticker over Selena's idle", () => {
  it("shows when the camera is close and on the side the area faces", () => {
    expect(stickerShow({ dx: 0, dy: -1, dz: 0, ...area })).toBe(1);
  });

  it("does not show from the other side, from the side or from far away", () => {
    expect(stickerShow({ dx: 0, dy: 1, dz: 0, ...area })).toBe(0);
    expect(stickerShow({ dx: 1, dy: 0, dz: 0, ...area })).toBe(0);
    expect(stickerShow({ dx: 0, dy: -4, dz: 0, ...area })).toBe(0);
  });

  it("grows in smoothly between far and near", () => {
    const mid = stickerShow({ dx: 0, dy: -1.76, dz: 0, ...area });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("is on or off, with a gap between the two so it never flickers", () => {
    expect(stickerOn(false, 0.3)).toBe(false);
    expect(stickerOn(false, 0.5)).toBe(true);
    expect(stickerOn(true, 0.3)).toBe(true);
    expect(stickerOn(true, 0.1)).toBe(false);
  });

  it("springs to its goal and rests at zero when it goes", () => {
    const s = { value: 0, speed: 0 };
    for (let i = 0; i < 120; i += 1) stickerSpring(s, 1, 1 / 60);
    expect(s.value).toBeCloseTo(1, 2);
    for (let i = 0; i < 240; i += 1) stickerSpring(s, 0, 1 / 60);
    expect(s.value).toBe(0);
  });
});
