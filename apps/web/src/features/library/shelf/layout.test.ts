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
  clamp,
  clearAbove,
  clearBelow,
  damp,
  dragToStack,
  dropState,
  fitFontSize,
  flapCentre,
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
  moveHalf,
  moveIndex,
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
  type Box,
  type Obstacles,
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
