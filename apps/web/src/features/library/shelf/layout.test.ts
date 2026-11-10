import { describe, expect, it } from "vitest";

import { COLLECTIONS } from "../registry";
import {
  COLS,
  COVER_COUNT,
  DROP_MS,
  DROP_STAGGER_MS,
  ENTRANCE_MS,
  PHONE_MAX_W,
  SPLIT_CLOSE_MS,
  SPLIT_OPEN_MS,
  SPLIT_RELEASE,
  SPLIT_ROOM,
  SPLIT_ROOM_PHONE,
  clamp,
  damp,
  dragToStack,
  dropState,
  fitFontSize,
  flapCentre,
  flapShade,
  focusPose,
  formatCount,
  frontIndex,
  gatefoldDepth,
  hoverPose,
  isPhone,
  lerpPose,
  moveHalf,
  moveIndex,
  restPose,
  shelfGeometry,
  slotOf,
  snapStack,
  splitFrame,
  splitGeometry,
  stackGeometry,
  stackPose,
  swingEase,
  textOn,
} from "./layout";
import { VIDEO_HALVES, halfCounts } from "./video-halves";

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

describe("the Video split", () => {
  const SPLIT_SIZES: Array<[number, number]> = [
    [701, 900],
    [1024, 768],
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
    [390, 844],
    [375, 667],
    [430, 932],
  ];

  /** Screen box (from the top left) of a square of side `size` centred on `c` (y up, from the middle). */
  const box = (w: number, h: number, c: { x: number; y: number }, size: number) => ({
    left: w / 2 + c.x - size / 2,
    right: w / 2 + c.x + size / 2,
    top: h / 2 - (c.y + size / 2),
    bottom: h / 2 - (c.y - size / 2),
  });

  it.each(SPLIT_SIZES)(
    "fits both halves, their lines and Back between the bars at %ix%i",
    (w, h) => {
      const g = splitGeometry(w, h);
      const navH = w >= 901 ? 80 : 64;
      const end = splitFrame(1, { x: 0, y: 0, size: 100 }, g);
      expect(end.size).toBe(g.size);
      const films = box(w, h, flapCentre(end, g.vertical), g.size);
      const others = box(w, h, end.leaf, g.size);
      for (const b of [films, others]) {
        expect(b.left).toBeGreaterThanOrEqual(16);
        expect(b.right).toBeLessThanOrEqual(w - 16);
      }
      if (isPhone(w)) {
        expect(films.top).toBeGreaterThanOrEqual(navH + SPLIT_ROOM_PHONE.top - 0.5);
        expect(g.size).toBeGreaterThan(Math.min(w, h) * 0.38);
        if (g.vertical) {
          // Films above Others, the upper line between them, the lower line above the bar.
          expect(films.bottom + SPLIT_ROOM_PHONE.caption).toBeLessThanOrEqual(others.top);
          expect(others.bottom + SPLIT_ROOM_PHONE.caption).toBeLessThanOrEqual(
            h - SPLIT_ROOM_PHONE.bottom + 0.5,
          );
        } else {
          // A short phone: side by side, a line of two rows under each.
          expect(films.right).toBeLessThan(others.left);
          expect(others.bottom + SPLIT_ROOM_PHONE.caption * 2).toBeLessThanOrEqual(
            h - SPLIT_ROOM_PHONE.bottom + 0.5,
          );
        }
      } else {
        expect(g.vertical).toBe(false);
        // Films on the left, a seam between, both on one line.
        expect(films.right).toBeLessThan(others.left);
        expect(others.left - films.right).toBeCloseTo(g.gap, 6);
        expect(films.top).toBeCloseTo(others.top, 6);
        expect(films.top).toBeGreaterThanOrEqual(navH + SPLIT_ROOM.top - 0.5);
        expect(films.bottom + SPLIT_ROOM.caption + SPLIT_ROOM.back).toBeLessThanOrEqual(
          h - SPLIT_ROOM.bottom + 0.5,
        );
        // A large pair, centred.
        expect(g.size).toBeGreaterThan(Math.min(w * 0.18, h * 0.3));
        expect((films.left + others.right) / 2).toBeCloseTo(w / 2, 6);
      }
    },
  );

  it("starts as the shut cover", () => {
    const g = splitGeometry(1440, 900);
    const from = { x: 12, y: 40, size: 400 };
    const f = splitFrame(0, from, g);
    expect(f.size).toBe(400);
    expect(f.angle).toBe(0);
    expect(f.part).toBe(0);
    expect(f.leaf).toEqual({ x: 12, y: 40 });
    expect(flapCentre(f, false).x).toBeCloseTo(12, 6);
    expect(flapCentre(f, false).y).toBeCloseTo(40, 6);
    const v = splitFrame(0, from, splitGeometry(390, 844));
    expect(flapCentre(v, true).y).toBeCloseTo(40, 6);
  });

  it("ends as two squares, symmetric about the middle of the pair", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const g = splitGeometry(w, h);
      const f = splitFrame(1, { x: 0, y: 0, size: 300 }, g);
      expect(f.angle).toBeCloseTo(Math.PI, 9);
      expect(f.part).toBe(1);
      const a = flapCentre(f, g.vertical);
      const b = f.leaf;
      expect((a.x + b.x) / 2).toBeCloseTo(g.cx, 6);
      expect((a.y + b.y) / 2).toBeCloseTo(g.cy, 6);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(g.size + g.gap, 6);
    }
  });

  it("moves without a jump at any point, both ways", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const g = splitGeometry(w, h);
      const from = { x: 0, y: 30, size: 380 };
      let prev = splitFrame(0, from, g);
      for (let i = 1; i <= 200; i += 1) {
        const f = splitFrame(i / 200, from, g);
        const a = flapCentre(f, g.vertical);
        const pa = flapCentre(prev, g.vertical);
        // At most the fastest step of the swing (about 12 radians over the whole of p).
        expect(Math.abs(f.angle - prev.angle)).toBeLessThan(0.075);
        expect(Math.hypot(f.leaf.x - prev.leaf.x, f.leaf.y - prev.leaf.y)).toBeLessThan(12);
        expect(Math.hypot(a.x - pa.x, a.y - pa.y)).toBeLessThan(16);
        expect(Math.abs(f.size - prev.size)).toBeLessThan(4);
        prev = f;
      }
    }
  });

  it("swings to flat with a soft landing of at most a few degrees", () => {
    expect(swingEase(0)).toBe(0);
    expect(swingEase(1)).toBeCloseTo(1, 9);
    let max = 0;
    let last = 0;
    for (let t = 0; t <= 0.8; t += 0.01) {
      const v = swingEase(t);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
    for (let t = 0; t <= 1; t += 0.005) max = Math.max(max, swingEase(t));
    expect(max).toBeGreaterThan(1);
    expect((max - 1) * 180).toBeLessThan(4);
  });

  it("keeps the shut Video cover one box as thick as the others", () => {
    for (const started of [false, true]) {
      const d = gatefoldDepth(12, started);
      expect(d.flap + d.leaf).toBe(12);
      // The front face of the front panel stays at 0.
      expect(d.hingeZ + d.flap).toBe(0);
    }
    expect(gatefoldDepth(12, false).leaf).toBe(0);
  });

  it("moves between the halves with the arrows", () => {
    expect(moveHalf(null, "ArrowRight", false)).toBe(1);
    expect(moveHalf(null, "ArrowLeft", false)).toBe(0);
    expect(moveHalf(0, "ArrowRight", false)).toBe(1);
    expect(moveHalf(1, "ArrowLeft", false)).toBe(0);
    expect(moveHalf(0, "ArrowDown", false)).toBe(1);
    expect(moveHalf(1, "ArrowUp", false)).toBe(0);
    expect(moveHalf(null, "ArrowDown", true)).toBe(1);
    expect(moveHalf(1, "ArrowUp", true)).toBe(0);
    expect(moveHalf(0, "ArrowRight", true)).toBe(1);
  });

  it("darkens the front face as it turns away and lights the inside as it comes round", () => {
    expect(flapShade(0)).toEqual({ front: 1, back: 0.6 });
    expect(flapShade(Math.PI).back).toBeCloseTo(1, 6);
    expect(flapShade(Math.PI / 2).front).toBeLessThan(0.7);
  });

  it("opens slower than it closes, and lets go of the focus only when shut", () => {
    expect(SPLIT_OPEN_MS).toBeGreaterThan(SPLIT_CLOSE_MS);
    expect(SPLIT_OPEN_MS).toBeLessThanOrEqual(1000);
    const g = splitGeometry(1440, 900);
    expect(splitFrame(SPLIT_RELEASE, { x: 0, y: 0, size: 300 }, g).angle).toBe(0);
  });
});

describe("the two halves", () => {
  it("are Films then Others, with a line, a legible ink and their own route", () => {
    expect(VIDEO_HALVES.map((h) => h.room)).toEqual(["films", "others"]);
    expect(VIDEO_HALVES[0].href).toBe("/collection/video/films");
    expect(VIDEO_HALVES[1].href).toBe("/collection/video/others");
    for (const h of VIDEO_HALVES) {
      expect(h.line).toMatch(/^[A-Z].*\.$/);
      for (const code of [0x2013, 0x2014]) expect(h.line).not.toContain(String.fromCharCode(code));
      expect(h.index).toContain("VIDEO");
      expect(["#ffffff", "#0b0b0e"]).toContain(textOn(h.colour));
      expect(h.cover).toMatch(/^covers\/video-(films|others)\.webp$/);
    }
    expect(COLLECTIONS[1]?.slug).toBe("video");
  });

  it("counts Films as the ten films and Others as the rest", () => {
    expect(halfCounts(67, 10)).toEqual([10, 57]);
    expect(halfCounts(undefined, 10)).toEqual([10, undefined]);
    expect(halfCounts(5, 10)).toEqual([10, undefined]);
    expect(halfCounts(67, 10, { films: 10, others: 60 })).toEqual([10, 60]);
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
