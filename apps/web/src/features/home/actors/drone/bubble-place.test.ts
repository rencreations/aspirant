import { describe, expect, it } from "vitest";

import { bubbleSize, placeBubble, TIP_U, TIP_V, type BubblePlace } from "./bubble-place";

const out = (): BubblePlace => ({ side: 1, x: 0, y: 0 });
const W = 1440;
const H = 900;

describe("the size of the bubble", () => {
  it("follows the drone and stays between 60 and 300 pixels", () => {
    expect(bubbleSize(20)).toBe(60);
    expect(bubbleSize(160)).toBeCloseTo(124.8, 5);
    expect(bubbleSize(2000)).toBe(300);
  });
});

describe("where the bubble goes", () => {
  it("stands over the head on the right, its tail tip close to the head", () => {
    const p = placeBubble(0, 0, 160, 0, 1, W, H, out());
    expect(p.side).toBe(1);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(60);
    expect(p.y).toBeGreaterThan(40);
  });

  it("moves to the left when the right has no room, and back only when the left has none", () => {
    const right = placeBubble(W / 2 - 80, 0, 160, 0, 1, W, H, out());
    expect(right.side).toBe(-1);
    // In the middle it keeps the side it had.
    expect(placeBubble(0, 0, 160, 0, -1, W, H, out()).side).toBe(-1);
    const left = placeBubble(-W / 2 + 80, 0, 160, 0, -1, W, H, out());
    expect(left.side).toBe(1);
  });

  it("stands beside the head, not over its face, at the top of the screen", () => {
    const height = 160;
    const fy = H / 2 - 70;
    const p = placeBubble(0, fy, height, 0, 1, W, H, out());
    // Beside: about half a height to the side, and not above the head.
    expect(p.x).toBeGreaterThanOrEqual(0.5 * height);
    expect(p.y).toBeLessThanOrEqual(fy + 0.1 * height + 1e-9);
    // And the whole body of the bubble is on the screen.
    expect(p.y + TIP_V * bubbleSize(height)).toBeLessThanOrEqual(H / 2);
  });

  it("keeps the whole bubble on the screen at every place, on a desktop and on a phone", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      for (let fx = -w / 2; fx <= w / 2; fx += w / 12) {
        for (let fy = -h / 2; fy <= h / 2; fy += h / 12) {
          for (const height of [80, 160, 400]) {
            const size = bubbleSize(height);
            const p = placeBubble(fx, fy, height, 0.06, 1, w, h, out());
            // The tail tip is the pivot: the body reaches up and across from it.
            const left = p.side > 0 ? p.x - TIP_U * size : p.x - (1 - TIP_U) * size;
            const right = p.side > 0 ? p.x + (1 - TIP_U) * size : p.x + TIP_U * size;
            const label = `${w} x ${h}, drone at ${fx}, ${fy}, ${height} tall`;
            expect(p.y + TIP_V * size, label).toBeLessThanOrEqual(h / 2 + 1e-6);
            // A bubble wider than the room (a tall drone on a phone) keeps its tail inside at least.
            expect(p.x, label).toBeGreaterThanOrEqual(-w / 2 + 8);
            expect(p.x, label).toBeLessThanOrEqual(w / 2 - 8);
            if (size < w * 0.5) {
              expect(left, label).toBeGreaterThanOrEqual(-w / 2);
              expect(right, label).toBeLessThanOrEqual(w / 2);
            }
          }
        }
      }
    }
  });

  it("drifts up with the lift", () => {
    const a = placeBubble(0, 0, 160, 0, 1, W, H, out());
    const b = placeBubble(0, 0, 160, 0.1, 1, W, H, out());
    expect(b.y - a.y).toBeCloseTo(0.1 * bubbleSize(160), 5);
  });

  it("treats any negative side as the left and any other as the right", () => {
    expect(placeBubble(0, 0, 160, 0, -5, W, H, out()).side).toBe(-1);
    expect(placeBubble(0, 0, 160, 0, 0.2, W, H, out()).side).toBe(1);
  });
});
