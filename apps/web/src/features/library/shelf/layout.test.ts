import { describe, expect, it } from "vitest";

import { COLLECTIONS } from "../registry";
import {
  COLS,
  COVER_COUNT,
  DROP_MS,
  DROP_STAGGER_MS,
  ENTRANCE_MS,
  PHONE_MAX_W,
  clamp,
  damp,
  dragToStack,
  dropState,
  fitFontSize,
  focusPose,
  formatCount,
  frontIndex,
  hoverPose,
  isPhone,
  lerpPose,
  moveIndex,
  restPose,
  shelfGeometry,
  slotOf,
  snapStack,
  stackGeometry,
  stackPose,
  textOn,
} from "./layout";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1920, 1080],
  [1280, 720],
  [2560, 1440],
  [1024, 768],
];

describe("shelf geometry", () => {
  it.each(SIZES)("keeps both shelves inside %ix%i with room for the index row", (w, h) => {
    const g = shelfGeometry(w, h);
    for (let i = 0; i < COVER_COUNT; i += 1) {
      const p = restPose(i, g);
      expect(p.x - g.size / 2).toBeGreaterThan(-w / 2);
      expect(p.x + g.size / 2).toBeLessThan(w / 2);
      // y is up: the top of the cover stays under the top bar, the bottom above the index row.
      expect(h / 2 - (p.y + g.size)).toBeGreaterThan(h * 0.15);
      expect(h / 2 - p.y).toBeLessThan(h - 120);
    }
    expect(g.boardW).toBeLessThan(w * 0.9);
  });

  it("puts row one above row two and orders each row left to right", () => {
    const g = shelfGeometry(1440, 900);
    expect(g.floor[0]).toBeGreaterThan(g.floor[1]);
    for (let i = 1; i < COVER_COUNT; i += 1) {
      if (slotOf(i).row === slotOf(i - 1).row) {
        expect(restPose(i, g).x).toBeGreaterThan(restPose(i - 1, g).x);
      }
    }
  });

  it("is symmetric about the middle and matches the registry's two shelves", () => {
    const g = shelfGeometry(1440, 900);
    expect(restPose(0, g).x).toBeCloseTo(-restPose(4, g).x, 6);
    expect(restPose(2, g).x).toBeCloseTo(0, 6);
    COLLECTIONS.forEach((c, i) => {
      expect(slotOf(i).row + 1).toBe(c.shelf);
    });
  });

  it("matches the reference proportions at 1440x900 (cover about 200 px, pitch about 225 px)", () => {
    const g = shelfGeometry(1440, 900);
    expect(g.size).toBeGreaterThan(190);
    expect(g.size).toBeLessThan(225);
    expect(g.pitch / g.size).toBeCloseTo(1.125, 3);
  });

  it("lifts a hovered cover up and toward the viewer", () => {
    const g = shelfGeometry(1440, 900);
    const a = restPose(7, g);
    const b = hoverPose(7, g);
    expect(b.y).toBeGreaterThan(a.y);
    expect(b.z).toBeGreaterThan(a.z);
    expect(b.x).toBe(a.x);
    expect(Math.abs(b.lean)).toBeLessThan(Math.abs(a.lean));
  });
});

describe("focus pose", () => {
  it("puts the cover in the middle, larger than on the shelf, never off screen", () => {
    for (const [w, h] of [...SIZES, [390, 844] as [number, number]]) {
      const g = isPhone(w) ? stackGeometry(w, h) : shelfGeometry(w, h);
      const f = focusPose(w, h, g.size);
      expect(f.x).toBe(0);
      expect(f.s).toBeGreaterThan(1);
      const size = f.s * g.size;
      expect(f.y).toBeGreaterThan(-h / 2 + 60);
      expect(f.y + size).toBeLessThan(h / 2 - 60);
      expect(size).toBeLessThanOrEqual(w);
    }
  });
});

describe("pose and ease helpers", () => {
  it("interpolates every field of a pose", () => {
    const a = { x: 0, y: 0, z: 0, s: 1, lean: 0, yaw: 0 };
    const b = { x: 10, y: 20, z: 30, s: 3, lean: -1, yaw: 0.5 };
    expect(lerpPose(a, b, 0.5)).toEqual({ x: 5, y: 10, z: 15, s: 2, lean: -0.5, yaw: 0.25 });
  });

  it("damp moves toward the target and never overshoots", () => {
    let v = 0;
    for (let i = 0; i < 60; i += 1) {
      v = damp(v, 1, 10, 1 / 60);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(v).toBeGreaterThan(0.99);
    expect(damp(0.4, 1, 10, 0)).toBeCloseTo(0.4, 9);
  });
});

describe("text on a field", () => {
  it("uses white on dark colours and ink on light ones", () => {
    expect(textOn("#2a5bff")).toBe("#ffffff");
    expect(textOn("#5d6b82")).toBe("#ffffff");
    expect(textOn("#f0b100")).toBe("#0b0b0e");
    expect(textOn("#ff7a1a")).toBe("#0b0b0e");
    expect(textOn("#10a5d8")).toBe("#0b0b0e");
  });

  it("covers every registry colour with a legible ink", () => {
    for (const c of COLLECTIONS) expect(["#ffffff", "#0b0b0e"]).toContain(textOn(c.colour));
  });

  it("fits a name to the box", () => {
    const measure = (size: number) => size * 4.5;
    expect(fitFontSize(measure, 900, 250)).toBe(200);
    expect(fitFontSize(measure, 9000, 250)).toBe(250);
    expect(fitFontSize(() => 0, 900, 250)).toBe(250);
  });
});

describe("entrance", () => {
  it("starts row one first, 40 ms apart", () => {
    expect(DROP_STAGGER_MS).toBe(40);
    for (let i = 1; i < COVER_COUNT; i += 1) {
      const t = 200;
      expect(dropState(i - 1, t).fall).toBeLessThanOrEqual(dropState(i, t).fall);
    }
    expect(dropState(0, 0).fall).toBe(1);
    expect(dropState(0, 0).opacity).toBe(0);
    expect(dropState(5, 5 * DROP_STAGGER_MS + 1).fall).toBeGreaterThan(0.9);
  });

  it("lands every cover and finishes at the end", () => {
    for (let i = 0; i < COVER_COUNT; i += 1) {
      const end = dropState(i, ENTRANCE_MS + 1);
      expect(end.fall).toBe(0);
      expect(end.tilt).toBe(0);
      expect(end.hop).toBe(0);
      expect(end.opacity).toBe(1);
    }
    expect(ENTRANCE_MS).toBe(9 * DROP_STAGGER_MS + DROP_MS);
  });

  it("falls monotonically before it lands", () => {
    let last = 2;
    for (let t = 0; t < DROP_MS * 0.6; t += 10) {
      const f = dropState(0, t).fall;
      expect(f).toBeLessThanOrEqual(last);
      last = f;
    }
  });
});

describe("keys", () => {
  it("moves along a row and between the two rows", () => {
    expect(moveIndex(null, "ArrowRight")).toBe(0);
    expect(moveIndex(null, "ArrowLeft")).toBe(9);
    expect(moveIndex(0, "ArrowRight")).toBe(1);
    expect(moveIndex(4, "ArrowRight")).toBe(5);
    expect(moveIndex(0, "ArrowLeft")).toBe(0);
    expect(moveIndex(9, "ArrowRight")).toBe(9);
    expect(moveIndex(2, "ArrowDown")).toBe(2 + COLS);
    expect(moveIndex(7, "ArrowUp")).toBe(7 - COLS);
    expect(moveIndex(7, "ArrowDown")).toBe(7);
    expect(moveIndex(2, "ArrowUp")).toBe(2);
  });

  it("moves through the stack one cover at a time on the phone", () => {
    expect(moveIndex(3, "ArrowDown", true)).toBe(4);
    expect(moveIndex(3, "ArrowUp", true)).toBe(2);
    expect(moveIndex(0, "ArrowUp", true)).toBe(0);
    expect(moveIndex(9, "ArrowDown", true)).toBe(9);
  });
});

describe("phone stack", () => {
  const g = stackGeometry(390, 844);

  it("is used under the phone width only", () => {
    expect(isPhone(PHONE_MAX_W - 1)).toBe(true);
    expect(isPhone(PHONE_MAX_W)).toBe(false);
  });

  it("shows the front cover full and the others as strips behind it", () => {
    const front = stackPose(0, 0, g);
    const second = stackPose(1, 0, g);
    const third = stackPose(2, 0, g);
    expect(front.pose.y).toBeLessThan(second.pose.y);
    expect(second.pose.y - front.pose.y).toBeCloseTo(g.strip, 6);
    expect(third.pose.y - second.pose.y).toBeCloseTo(g.strip, 6);
    expect(front.order).toBeGreaterThan(second.order);
    expect(second.order).toBeGreaterThan(third.order);
    expect(front.pose.s).toBeGreaterThan(second.pose.s);
    expect(front.alpha).toBe(1);
  });

  it("keeps all ten inside the screen at the first position", () => {
    for (let i = 0; i < COVER_COUNT; i += 1) {
      const { pose } = stackPose(i, 0, g);
      const top = pose.y + g.size * Math.cos(g.lean);
      expect(top).toBeLessThan(844 / 2 - 80);
    }
  });

  it("slides the front cover away and fades it as the stack moves on", () => {
    const mid = stackPose(0, 0.5, g);
    const gone = stackPose(0, 1, g);
    expect(mid.alpha).toBeCloseTo(0.5, 6);
    expect(mid.pose.y).toBeLessThan(g.frontY);
    expect(gone.alpha).toBe(0);
    // The next cover has become the front one.
    expect(stackPose(1, 1, g).pose.y).toBeCloseTo(g.frontY, 6);
  });

  it("maps a drag to a scroll position and snaps to a cover", () => {
    expect(dragToStack(2, -g.strip * 3.2, g)).toBeCloseTo(3, 6);
    expect(dragToStack(0, 500, g)).toBe(0);
    expect(dragToStack(9, -500, g)).toBe(9);
    expect(snapStack(2.4, 0)).toBe(2);
    expect(snapStack(2.4, 3)).toBe(3);
    expect(snapStack(8.9, 9)).toBe(9);
    expect(frontIndex(3.6)).toBe(4);
    expect(frontIndex(-2)).toBe(0);
  });
});

describe("misc", () => {
  it("formats counts and hides a missing one", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(undefined)).toBe("");
    expect(formatCount(Number.NaN)).toBe("");
  });

  it("clamps", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
