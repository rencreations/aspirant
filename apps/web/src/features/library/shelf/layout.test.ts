import { describe, expect, it } from "vitest";

import { COLLECTIONS } from "../registry";
import {
  CLEAR_GAP,
  COLS,
  COVER_COUNT,
  DROP_MS,
  DROP_STAGGER_MS,
  ENTRANCE_MS,
  OPEN_BELOW,
  OPEN_H,
  PHONE_MAX_W,
  SHORT_H,
  SPLIT_CLOSE_MS,
  SPLIT_OPEN_MS,
  SPLIT_RELEASE,
  SPLIT_ROOM,
  SPLIT_ROOM_PHONE,
  SPLIT_ROOM_SHORT,
  backAt,
  captionAt,
  clamp,
  clearAbove,
  clearBelow,
  damp,
  dragToStack,
  dropState,
  fitFontSize,
  flapCentre,
  flapCentreB,
  foldGeometry,
  flank,
  flapShade,
  focusPose,
  focusRoom,
  focusTarget,
  formatCount,
  frontIndex,
  gatefoldDepth,
  hoverPose,
  isPhone,
  isShort,
  lerpPose,
  lineCount,
  moveHalf,
  moveIndex,
  movePart,
  noObstacles,
  restPose,
  shelfGeometry,
  slotOf,
  snapStack,
  splitCaption,
  splitFrame,
  splitGeometry,
  stackGeometry,
  stackPose,
  swingEase,
  textOn,
  tripLineFont,
  tripTail,
  triptychDepth,
  triptychFrame,
  triptychGeometry,
  type Box,
  type Obstacles,
} from "./layout";
import { ARTS_PARTS, artsPartCounts } from "./arts-parts";
import { ARTS_SPLIT, SPLITS, VIDEO_SPLIT, partCount, splitIndexOf, splitOf } from "./splits";
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

// Room for the controls ------------------------------------------------------------------------

/**
 * The controls as the browser lays them out (read from real Chrome at these sizes, in CSS px from
 * the top left): the tagline and Search block, the Continue button and the phone's name bar.
 */
function controls(w: number, h: number): Obstacles {
  const phone = isPhone(w);
  const navH = w >= 901 ? 80 : 64;
  const top: Box = phone
    ? { left: 17, right: 191, top: 68, bottom: 150 }
    : { left: 29, right: 210, top: 72, bottom: 156 };
  const continueBox: Box =
    w > 832
      ? { left: w - 227, right: w - 28, top: 78, bottom: 131 }
      : { left: w - 211, right: w - 17, top: 117, bottom: 152 };
  const bar: Box[] = [
    { left: 17, right: 30, top: h - 92, bottom: h - 78 },
    { left: 17, right: 85, top: h - 76, bottom: h - 44 },
    { left: 17, right: 300, top: h - 40, bottom: h - 20 },
  ];
  const index: Box = { left: 0, right: w, top: h - 95, bottom: h };
  const short = isShort(h);
  return {
    short,
    navH,
    focusAbove: [top, continueBox],
    focusBelow: phone ? bar : short ? [] : [index],
    splitAbove: phone ? [continueBox] : [top, continueBox],
  };
}

const overlap = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Screen box (from the top left) of the focused cover. */
function focusBox(w: number, h: number, size: number, o?: Obstacles): Box {
  const room = o ? focusRoom(w, h, o) : undefined;
  const f = focusPose(w, h, size, room);
  const side = f.s * size;
  return {
    left: w / 2 - side / 2,
    right: w / 2 + side / 2,
    top: h / 2 - (f.y + side),
    bottom: h / 2 - f.y,
  };
}

describe("the helpers of room", () => {
  const boxes: Box[] = [
    { left: 0, right: 100, top: 10, bottom: 50 },
    { left: 300, right: 400, top: 20, bottom: 60 },
    { left: 0, right: 400, top: 700, bottom: 760 },
  ];

  it("clears the lowest box over the columns, and nothing else", () => {
    expect(clearBelow(boxes.slice(0, 2), 120, 280)).toBe(0);
    expect(clearBelow(boxes.slice(0, 2), 90, 280)).toBe(50 + CLEAR_GAP);
    expect(clearBelow(boxes.slice(0, 2), 0, 400)).toBe(60 + CLEAR_GAP);
    expect(clearBelow([], 0, 400)).toBe(0);
    // Touching is not over.
    expect(clearBelow(boxes.slice(0, 1), 100, 200)).toBe(0);
  });

  it("clears the highest box under the columns, and nothing else", () => {
    expect(clearAbove(boxes, 120, 280, 800)).toBe(700 - CLEAR_GAP);
    expect(clearAbove(boxes.slice(0, 2), 120, 280, 800)).toBe(800);
    expect(clearAbove([], 0, 400, 800)).toBe(800);
  });

  it("finds the free columns between the controls at the two sides", () => {
    expect(flank([], 800, 24)).toEqual({ from: 24, to: 776 });
    const left: Box = { left: 20, right: 120, top: 0, bottom: 50 };
    const right: Box = { left: 600, right: 780, top: 0, bottom: 50 };
    expect(flank([left, right], 800, 24)).toEqual({
      from: 120 + CLEAR_GAP,
      to: 600 - CLEAR_GAP,
    });
  });
});

describe("the focused cover keeps clear of the controls", () => {
  const PHONES: Array<[number, number]> = [
    [390, 844],
    [375, 667],
    [360, 640],
    [414, 896],
    [390, 664],
    [360, 560],
    [320, 568],
  ];

  it.each(PHONES)("on a phone %ix%i it stands under the controls and over the bar", (w, h) => {
    const o = controls(w, h);
    const size = stackGeometry(w, h).size;
    const c = focusBox(w, h, size, o);
    for (const b of o.focusAbove) expect(overlap(c, b)).toBe(false);
    for (const b of o.focusBelow) {
      expect(overlap({ ...c, bottom: c.bottom + OPEN_BELOW + OPEN_H }, b)).toBe(false);
    }
    expect(c.top).toBeGreaterThanOrEqual(o.navH);
    expect(c.right - c.left).toBeGreaterThanOrEqual(180);
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(w);
  });

  it("is the pose it always was where it already had the room (a tall phone)", () => {
    for (const [w, h] of [
      [390, 844],
      [414, 896],
    ] as const) {
      const size = stackGeometry(w, h).size;
      expect(focusPose(w, h, size, focusRoom(w, h, controls(w, h)))).toEqual(focusPose(w, h, size));
    }
  });

  it("moves down and shrinks only as much as a short phone needs", () => {
    const size = stackGeometry(375, 667).size;
    const plain = focusPose(375, 667, size);
    const fitted = focusPose(375, 667, size, focusRoom(375, 667, controls(375, 667)));
    // y is up: lower on the screen is a smaller y.
    expect(fitted.y).toBeLessThan(plain.y);
    expect(fitted.s).toBeCloseTo(plain.s, 6);
    const small = stackGeometry(320, 480).size;
    expect(focusPose(320, 480, small, focusRoom(320, 480, controls(320, 480))).s).toBeLessThan(
      focusPose(320, 480, small).s,
    );
  });

  it("never gets smaller than a legible cover, whatever the room", () => {
    const f = focusPose(375, 667, 100, { top: 300, foot: 340, from: 0, to: 375 });
    expect(f.s * 100).toBe(120);
  });

  it.each([
    [667, 375],
    [568, 320],
    [844, 390],
    [740, 360],
  ] as Array<[number, number]>)(
    "on a phone on its side %ix%i it stays between the controls",
    (w, h) => {
      expect(isShort(h)).toBe(true);
      const o = controls(w, h);
      const size = (isPhone(w) ? stackGeometry(w, h) : shelfGeometry(w, h)).size;
      const c = focusBox(w, h, size, o);
      for (const b of o.focusAbove) expect(overlap(c, b)).toBe(false);
      for (const b of o.focusBelow) {
        expect(overlap({ ...c, bottom: c.bottom + OPEN_BELOW + OPEN_H }, b)).toBe(false);
      }
      expect(c.bottom + OPEN_BELOW + OPEN_H).toBeLessThanOrEqual(h);
    },
  );

  it("is not moved on a short screen where the controls already flank it", () => {
    for (const [w, h] of [
      [667, 375],
      [844, 390],
      [740, 360],
    ] as const) {
      const size = (isPhone(w) ? stackGeometry(w, h) : shelfGeometry(w, h)).size;
      const plain = focusPose(w, h, size);
      const fitted = focusPose(w, h, size, focusRoom(w, h, controls(w, h)));
      expect(fitted.x).toBe(0);
      expect(fitted.s).toBeCloseTo(plain.s, 9);
      // Only the top bar's edge may nudge it, by under a pixel.
      expect(Math.abs(fitted.y - plain.y)).toBeLessThan(1);
    }
  });

  it("shrinks and slides sideways when a narrow short screen leaves less than it needs", () => {
    const size = stackGeometry(568, 320).size;
    const o = controls(568, 320);
    const plain = focusPose(568, 320, size);
    const fitted = focusPose(568, 320, size, focusRoom(568, 320, o));
    expect(fitted.s).toBeLessThan(plain.s);
    expect(fitted.x).toBeLessThan(0);
  });

  it("measures the largest side the way the pose does", () => {
    expect(focusTarget(390, 844)).toBe(312);
    expect(focusTarget(1440, 900)).toBe(414);
    expect(focusRoom(1440, 900, noObstacles(1440, 900))).toEqual({
      top: 80,
      foot: 900 - CLEAR_GAP,
      from: 0,
      to: 1440,
    });
  });
});

describe("a wide screen does not change", () => {
  // What `focusPose` and `splitGeometry` returned before the room was added (Chrome at these sizes).
  const PINNED: Array<
    [
      number,
      number,
      { y: number; s: number },
      { size: number; gap: number; cx: number; cy: number },
    ]
  > = [
    [1440, 900, { y: -180, s: 2.145077720207254 }, { size: 360, gap: 20, cx: 0, cy: 42 }],
    [1280, 720, { y: -144, s: 2.1506493506493505 }, { size: 268, gap: 18, cx: 0, cy: 42 }],
    [1024, 768, { y: -151.04, s: 2.2755555555555556 }, { size: 307, gap: 14, cx: 0, cy: 42 }],
    [1920, 1080, { y: -216, s: 2.1413793103448278 }, { size: 432, gap: 27, cx: 0, cy: 42 }],
    [820, 1180, { y: -104, s: 2.2666666666666666 }, { size: 355, gap: 14, cx: 0, cy: 50 }],
    [1366, 600, { y: -120, s: 2.13953488372093 }, { size: 148, gap: 19, cx: 0, cy: 42 }],
  ];

  it.each(PINNED)("keeps the focus pose and the split at %ix%i", (w, h, focus, split) => {
    const size = shelfGeometry(w, h).size;
    const o = controls(w, h);
    for (const room of [undefined, focusRoom(w, h, o)]) {
      const f = focusPose(w, h, size, room);
      expect(f.y).toBeCloseTo(focus.y, 9);
      expect(f.s).toBeCloseTo(focus.s, 12);
    }
    for (const g of [
      splitGeometry(w, h),
      splitGeometry(w, h, o.navH, { short: o.short, above: o.splitAbove }),
    ]) {
      expect(g).toEqual({ ...split, vertical: false });
    }
  });
});

describe("the open Video cover keeps clear of the controls", () => {
  const SCREENS: Array<[number, number]> = [
    [390, 844],
    [414, 896],
    [375, 667],
    [360, 640],
    [390, 664],
    [360, 560],
    [667, 375],
    [568, 320],
    [844, 390],
    [740, 360],
    [820, 1180],
    [1440, 900],
  ];

  it.each(SCREENS)("at %ix%i the pair is clear of Continue, Search and the foot", (w, h) => {
    const o = controls(w, h);
    const g = splitGeometry(w, h, o.navH, { short: o.short, above: o.splitAbove });
    const half = g.vertical ? g.size / 2 : g.size + g.gap / 2;
    const reach = g.vertical ? g.size + g.gap / 2 : g.size / 2;
    const pair: Box = {
      left: w / 2 + g.cx - half,
      right: w / 2 + g.cx + half,
      top: h / 2 - g.cy - reach,
      bottom: h / 2 - g.cy + reach,
    };
    for (const b of o.splitAbove) expect(overlap(pair, b)).toBe(false);
    expect(pair.left).toBeGreaterThanOrEqual(0);
    expect(pair.right).toBeLessThanOrEqual(w);
    expect(pair.top).toBeGreaterThanOrEqual(o.navH);
    // The caption under the lower half, and Back under the pair on a wide screen.
    const cap = splitCaption(w, h);
    const tail = isPhone(w) ? (g.vertical || isShort(h) ? cap : cap * 2) : cap + 52;
    expect(pair.bottom + tail).toBeLessThanOrEqual(h);
    if (isShort(h)) {
      expect(g.size).toBeGreaterThanOrEqual(h >= 360 ? 100 : 80);
      if (!isPhone(w)) expect(pair.bottom + SPLIT_ROOM_SHORT.caption + 37).toBeLessThanOrEqual(h);
    }
  });

  it("starts under a control that reaches lower than the room set aside for it", () => {
    const low: Box = { left: 164, right: 358, top: 117, bottom: 230 };
    const g = splitGeometry(375, 667, 64, { above: [low] });
    const top = 667 / 2 - g.cy - (g.vertical ? g.size + g.gap / 2 : g.size / 2);
    expect(top).toBeGreaterThanOrEqual(230 + CLEAR_GAP - 0.5);
  });

  it("holds a tall phone's room under the Continue button", () => {
    expect(64 + SPLIT_ROOM_PHONE.top).toBeGreaterThanOrEqual(152 + CLEAR_GAP);
    expect(isShort(SHORT_H - 1)).toBe(true);
    expect(isShort(SHORT_H)).toBe(false);
  });

  it("has no line under a half on a short screen, so the caption is shorter", () => {
    expect(splitCaption(844, 390)).toBeLessThan(splitCaption(844, 900));
    expect(splitCaption(667, 375)).toBeLessThan(splitCaption(390, 844));
    expect(splitCaption(1440, 900)).toBe(SPLIT_ROOM.caption);
  });
});

// The Arts triptych ----------------------------------------------------------------------------

describe("the Arts triptych", () => {
  /** The screens the owner's brief names, then a spread of others. */
  const PINNED_SCREENS: Array<[number, number]> = [
    [390, 844],
    [375, 667],
    [360, 640],
    [414, 896],
    [844, 390],
    [820, 1180],
  ];
  const OTHER_SCREENS: Array<[number, number]> = [
    [1440, 900],
    [1920, 1080],
    [1280, 720],
    [1024, 768],
    [701, 900],
    [2560, 1440],
    [667, 375],
    [568, 320],
    [740, 360],
    [390, 664],
  ];
  const chars = Math.max(...ARTS_PARTS.map((p) => p.line.length));

  /** The three squares from the geometry, each as a box from the top left of the screen. */
  function trio(w: number, h: number) {
    const o = controls(w, h);
    const g = triptychGeometry(w, h, o.navH, {
      short: o.short,
      above: o.splitAbove,
      lineChars: chars,
    });
    const cx = w / 2 + g.cx;
    const cy = h / 2 - g.cy;
    const squares: Box[] = [-1, 0, 1].map((k) =>
      g.vertical
        ? {
            left: cx - g.size / 2,
            right: cx + g.size / 2,
            top: cy + k * (g.size + g.gap) - g.size / 2,
            bottom: cy + k * (g.size + g.gap) + g.size / 2,
          }
        : {
            left: cx + k * (g.size + g.gap) - g.size / 2,
            right: cx + k * (g.size + g.gap) + g.size / 2,
            top: cy - g.size / 2,
            bottom: cy + g.size / 2,
          },
    );
    return { o, g, squares };
  }

  it.each([...PINNED_SCREENS, ...OTHER_SCREENS])(
    "stands clear of Continue, Search and the foot at %ix%i",
    (w, h) => {
      const { o, g, squares } = trio(w, h);
      const [first, , last] = squares as [Box, Box, Box];
      const whole: Box = {
        left: first.left,
        right: g.vertical ? last.right + 16 + g.captionW : last.right,
        top: first.top,
        bottom: last.bottom,
      };
      for (const b of o.splitAbove) expect(overlap(whole, b)).toBe(false);
      for (const sq of squares) {
        expect(sq.left).toBeGreaterThanOrEqual(0);
        expect(sq.right).toBeLessThanOrEqual(w);
        expect(sq.top).toBeGreaterThanOrEqual(o.navH);
        expect(sq.bottom).toBeLessThanOrEqual(h);
      }
      expect(whole.right).toBeLessThanOrEqual(w + 0.5);
      expect(g.size).toBeGreaterThanOrEqual(80);
      // The words under the lowest square, and Back under them on a wide screen (a phone has Back in
      // its bar), end above the foot of the room set aside for them.
      const room = isPhone(w)
        ? isShort(h)
          ? 112
          : SPLIT_ROOM_PHONE.bottom
        : isShort(h)
          ? SPLIT_ROOM_SHORT.bottom
          : SPLIT_ROOM.bottom;
      const back = isPhone(w) ? 0 : 37;
      expect(last.bottom + g.tail + back).toBeLessThanOrEqual(h - room + 0.5);
    },
  );

  it.each(PINNED_SCREENS)("is large enough to read at %ix%i", (w, h) => {
    const { g } = trio(w, h);
    expect(g.size).toBeGreaterThanOrEqual(Math.min(w, h) * 0.25);
    expect(g.beside).toBe(w < 700 && h >= 540);
  });

  it("stands three across on a wide screen, centred, one size, with a seam between", () => {
    for (const [w, h] of [
      [1440, 900],
      [1920, 1080],
      [1280, 720],
    ] as const) {
      const { g, squares } = trio(w, h);
      expect(g.vertical).toBe(false);
      expect(g.beside).toBe(false);
      expect(g.cx).toBe(0);
      const [a, b, c] = squares as [Box, Box, Box];
      expect(a.top).toBeCloseTo(b.top, 6);
      expect(b.top).toBeCloseTo(c.top, 6);
      expect(b.left - a.right).toBeCloseTo(g.gap, 6);
      expect(c.left - b.right).toBeCloseTo(g.gap, 6);
      expect((a.left + c.right) / 2).toBeCloseTo(w / 2, 6);
    }
  });

  it("is as large as a gatefold half where the height decides (the room is the same)", () => {
    const o = controls(1440, 900);
    const trio3 = triptychGeometry(1440, 900, o.navH, { above: o.splitAbove, lineChars: chars });
    const pair = splitGeometry(1440, 900, o.navH, { above: o.splitAbove });
    expect(trio3.size).toBe(pair.size);
    expect(Math.abs(trio3.cy - pair.cy)).toBeLessThan(12);
  });

  it("stacks three rows on a phone, the words beside each square", () => {
    for (const [w, h] of [
      [390, 844],
      [414, 896],
      [375, 667],
      [360, 640],
    ] as const) {
      const { g, squares } = trio(w, h);
      expect(g.vertical).toBe(true);
      expect(g.beside).toBe(true);
      const [a, b, c] = squares as [Box, Box, Box];
      expect(a.bottom).toBeLessThan(b.top);
      expect(b.bottom).toBeLessThan(c.top);
      expect(b.top - a.bottom).toBeCloseTo(g.gap, 6);
      // The words fit between the square and the right edge.
      expect(a.right + 16 + g.captionW).toBeLessThanOrEqual(w - 16 + 0.5);
      expect(g.captionW).toBeGreaterThanOrEqual(132);
    }
  });

  it("keeps a tall tablet three across, with the words under each square", () => {
    const { g } = trio(820, 1180);
    expect(g.vertical).toBe(false);
    expect(g.beside).toBe(false);
    expect(g.size).toBeGreaterThanOrEqual(220);
    expect(g.lines).toBeGreaterThanOrEqual(2);
  });

  it("sets the three squares side by side on a short screen, between the controls", () => {
    for (const [w, h] of [
      [844, 390],
      [667, 375],
    ] as const) {
      const { g } = trio(w, h);
      expect(isShort(h)).toBe(true);
      expect(g.vertical).toBe(false);
      expect(g.size).toBeGreaterThanOrEqual(100);
    }
  });

  it("does not touch the gatefold: two parts give what they always gave", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [844, 390],
    ] as const) {
      const o = controls(w, h);
      const inputs = { short: o.short, above: o.splitAbove };
      expect(foldGeometry(2, w, h, o.navH, inputs)).toEqual(splitGeometry(w, h, o.navH, inputs));
      expect(Object.keys(foldGeometry(2, w, h, o.navH, inputs)).sort()).toEqual(
        ["cx", "cy", "gap", "size", "vertical"].sort(),
      );
    }
    expect(foldGeometry(3, 1440, 900)).toHaveProperty("parts", 3);
  });

  it("starts as the shut cover: all three panels lie on it", () => {
    const g = triptychGeometry(1440, 900);
    const from = { x: 12, y: 40, size: 400 };
    const f = triptychFrame(0, from, g);
    expect(f.size).toBe(400);
    expect(f.angle).toBe(0);
    expect(f.angle2).toBe(0);
    expect(f.part).toBe(0);
    expect(f.leaf).toEqual({ x: 12, y: 40 });
    expect(flapCentre(f, false).x).toBeCloseTo(12, 6);
    expect(flapCentreB(f, false).x).toBeCloseTo(12, 6);
    expect(flapCentre(f, false).y).toBeCloseTo(40, 6);
    const v = triptychFrame(0, from, triptychGeometry(390, 844));
    expect(flapCentre(v, true).y).toBeCloseTo(40, 6);
    expect(flapCentreB(v, true).y).toBeCloseTo(40, 6);
  });

  it("ends as three squares with the middle one where the trio is centred", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const g = triptychGeometry(w, h);
      const f = triptychFrame(1, { x: 0, y: 0, size: 300 }, g);
      expect(f.angle).toBeCloseTo(Math.PI, 9);
      expect(f.angle2).toBeCloseTo(Math.PI, 9);
      expect(f.part).toBe(1);
      expect(f.leaf).toEqual({ x: g.cx, y: g.cy });
      const a = flapCentre(f, g.vertical);
      const c = flapCentreB(f, g.vertical);
      const step = g.size + g.gap;
      if (g.vertical) {
        expect(a.y - f.leaf.y).toBeCloseTo(step, 6);
        expect(f.leaf.y - c.y).toBeCloseTo(step, 6);
        expect(a.x).toBeCloseTo(g.cx, 6);
      } else {
        expect(f.leaf.x - a.x).toBeCloseTo(step, 6);
        expect(c.x - f.leaf.x).toBeCloseTo(step, 6);
        expect(a.y).toBeCloseTo(g.cy, 6);
      }
    }
  });

  it("moves without a jump at any point, both ways, and never crosses the panels", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const g = triptychGeometry(w, h);
      const from = { x: 0, y: 30, size: 300 };
      let prev = triptychFrame(0, from, g);
      for (let i = 1; i <= 200; i += 1) {
        const f = triptychFrame(i / 200, from, g);
        expect(Math.abs(f.angle - prev.angle)).toBeLessThan(0.075);
        expect(Math.abs(f.angle2 - prev.angle2)).toBeLessThan(0.075);
        expect(Math.hypot(f.leaf.x - prev.leaf.x, f.leaf.y - prev.leaf.y)).toBeLessThan(12);
        const a = flapCentre(f, g.vertical);
        const pa = flapCentre(prev, g.vertical);
        const c = flapCentreB(f, g.vertical);
        const pc = flapCentreB(prev, g.vertical);
        expect(Math.hypot(a.x - pa.x, a.y - pa.y)).toBeLessThan(16);
        expect(Math.hypot(c.x - pc.x, c.y - pc.y)).toBeLessThan(16);
        expect(Math.abs(f.size - prev.size)).toBeLessThan(4);
        // The front panel is left of the middle one once it is past upright, the third is right of it.
        if (!g.vertical && f.angle > Math.PI / 2) expect(a.x).toBeLessThanOrEqual(f.leaf.x + 1);
        if (!g.vertical && f.angle2 > Math.PI / 2) expect(c.x).toBeGreaterThanOrEqual(f.leaf.x - 1);
        prev = f;
      }
    }
  });

  it("makes the third panel swing a little after the front one, and both end flat together", () => {
    const g = triptychGeometry(1440, 900);
    const from = { x: 0, y: 0, size: 300 };
    const early = triptychFrame(0.3, from, g);
    expect(early.angle).toBeGreaterThan(early.angle2);
    const end = triptychFrame(1, from, g);
    expect(end.angle2).toBeCloseTo(end.angle, 9);
  });

  it("keeps the shut cover one box as thick as the others", () => {
    for (const started of [false, true]) {
      const d = triptychDepth(12, started);
      expect(d.flap + d.leaf + d.flapB).toBe(12);
      // The front face of the front panel stays at 0, the panels follow one behind another.
      expect(d.hingeZ + d.flap).toBe(0);
      expect(d.hingeZB).toBeLessThanOrEqual(d.hingeZ);
    }
    expect(triptychDepth(12, false).leaf).toBe(0);
    expect(triptychDepth(12, false).flapB).toBe(0);
    const open = triptychDepth(12, true);
    expect(open.hingeZ - open.leaf).toBeCloseTo(open.hingeZB, 9);
  });

  it("moves between the three parts with the arrows, and stays on an end part", () => {
    expect(movePart(0, "ArrowRight", false, 3)).toBe(1);
    expect(movePart(1, "ArrowRight", false, 3)).toBe(2);
    expect(movePart(2, "ArrowRight", false, 3)).toBe(2);
    expect(movePart(2, "ArrowLeft", false, 3)).toBe(1);
    expect(movePart(0, "ArrowLeft", false, 3)).toBe(0);
    expect(movePart(1, "ArrowDown", true, 3)).toBe(2);
    expect(movePart(1, "ArrowUp", true, 3)).toBe(0);
    expect(movePart(null, "ArrowRight", false, 3)).toBe(1);
    expect(movePart(null, "ArrowLeft", false, 3)).toBe(0);
    // Two parts behave as moveHalf does.
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const) {
      for (const cur of [null, 0, 1] as const) {
        for (const v of [false, true]) {
          expect(movePart(cur, key, v, 2)).toBe(moveHalf(cur, key, v));
        }
      }
    }
  });

  it("estimates the lines a caption takes, and the room under the parts", () => {
    expect(tripLineFont(1440)).toBeCloseTo(17.2, 6);
    expect(tripLineFont(300)).toBe(15);
    expect(tripLineFont(5000)).toBe(19.2);
    // The longest line in a narrow column takes more lines than in a wide one.
    expect(lineCount(chars, 360, 17)).toBeLessThan(lineCount(chars, 180, 17));
    expect(lineCount(1, 1000, 17)).toBe(1);
    expect(tripTail(3, 17)).toBeGreaterThan(tripTail(2, 17));
  });
});

describe("where the words and Back stand", () => {
  const a: Box = { left: 100, right: 300, top: 100, bottom: 300 };
  const b: Box = { left: 320, right: 520, top: 100, bottom: 300 };
  const c: Box = { left: 540, right: 740, top: 100, bottom: 300 };

  it("puts the words of parts side by side on one baseline, even when one is lifted", () => {
    const lifted: Box = { ...b, top: 92, bottom: 292 };
    const rects = [a, lifted, c];
    expect(captionAt(rects, 0, false).y).toBe(314);
    expect(captionAt(rects, 1, false).y).toBe(314);
    expect(captionAt(rects, 2, false)).toEqual({ x: 540, y: 314 });
  });

  it("matches what the gatefold always did for two stacked parts", () => {
    const top: Box = { left: 100, right: 300, top: 100, bottom: 300 };
    const under: Box = { left: 100, right: 300, top: 400, bottom: 600 };
    expect(captionAt([top, under], 0, false)).toEqual({ x: 100, y: 314 });
    expect(captionAt([top, under], 1, false)).toEqual({ x: 100, y: 614 });
  });

  it("puts the words of a row to the right of its square, level with its top", () => {
    expect(captionAt([a, b, c], 1, true)).toEqual({ x: 536, y: 100 });
  });

  it("puts Back under the middle of the parts", () => {
    expect(backAt([a, b, c], 140)).toEqual({ x: 420, y: 440 });
  });
});

describe("the covers that open", () => {
  it("lists Arts and Video, in shelf order, with their own folds", () => {
    expect(SPLITS.map((s) => s.slug)).toEqual(["arts", "video"]);
    expect(splitIndexOf(ARTS_SPLIT)).toBe(0);
    expect(splitIndexOf(VIDEO_SPLIT)).toBe(1);
    expect(partCount(ARTS_SPLIT)).toBe(3);
    expect(partCount(VIDEO_SPLIT)).toBe(2);
    expect(splitOf("arts")).toBe(ARTS_SPLIT);
    expect(splitOf("video")).toBe(VIDEO_SPLIT);
    expect(splitOf("music")).toBeUndefined();
    expect(ARTS_SPLIT.fold).toBe("triptych");
    expect(VIDEO_SPLIT.fold).toBe("gatefold");
    expect(COLLECTIONS[0]?.slug).toBe("arts");
  });

  it("makes Arts of Official, Fanart and Cosplay with their rooms, lines and legible inks", () => {
    expect(ARTS_PARTS.map((p) => p.room)).toEqual(["official", "fanart", "cosplay"]);
    expect(ARTS_PARTS.map((p) => p.href)).toEqual([
      "/collection/arts",
      "/collection/arts/fanart",
      "/collection/arts/cosplay",
    ]);
    expect(ARTS_PARTS[0].line).toBe("Splash art, scenes, comic panels, game, design and more.");
    expect(ARTS_PARTS[1].line).toBe("Made by readers and players, each piece credited.");
    expect(ARTS_PARTS[2].line).toBe("The ten Aspirants, a page for each.");
    const colours = new Set<string>();
    for (const p of ARTS_PARTS) {
      expect(p.line).toMatch(/^[A-Z].*\.$/);
      for (const code of [0x2013, 0x2014]) expect(p.line).not.toContain(String.fromCharCode(code));
      expect(p.index).toContain("ARTS");
      expect(["#ffffff", "#0b0b0e"]).toContain(textOn(p.colour));
      expect(p.cover).toMatch(/^covers\/arts-(official|fanart|cosplay)\.webp$/);
      colours.add(p.colour);
    }
    // Told apart by colour: three fields, not one.
    expect(colours.size).toBe(3);
    // A new key never shares one with the cover of the collection itself.
    expect(ARTS_PARTS.map((p) => p.cover)).not.toContain(COLLECTIONS[0]?.cover);
  });

  it("counts each Arts room from the index, and shows nothing for a room it does not know", () => {
    expect(artsPartCounts()).toEqual([undefined, undefined, undefined]);
    expect(
      artsPartCounts({ "arts/official": 1200, "arts/fanart": 180, "arts/cosplay": 40 }),
    ).toEqual([1200, 180, 40]);
    expect(artsPartCounts({ "arts/official": 1200, "arts/cosplay": 0 })).toEqual([
      1200,
      undefined,
      undefined,
    ]);
    expect(ARTS_SPLIT.counts({})).toEqual(["", "", ""]);
    expect(ARTS_SPLIT.counts({ rooms: { "arts/fanart": 1234 } })).toEqual(["", "1,234 pieces", ""]);
    // Video still counts the ten films and the rest.
    expect(VIDEO_SPLIT.counts({ counts: { video: 102 } })).toEqual(["10 films", "92 videos"]);
  });
});
