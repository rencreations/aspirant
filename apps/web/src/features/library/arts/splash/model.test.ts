import { describe, expect, it } from "vitest";

import { sourcePose, type Rect } from "../core/zoom/zoom-math";
import {
  ARRIVE,
  LAMBDA,
  LEAVE,
  MAX_LEAD,
  NEAR,
  REACH,
  ROW_REACH,
  SETTLE,
  STEP_GAP_MS,
  WheelGate,
  activeOf,
  computeLayout,
  innerY,
  keyAction,
  limitLead,
  mod,
  nearIndexes,
  offsetOf,
  rebase,
  rowOpacity,
  signedWrap,
  slotOf,
  stepPos,
  stepTarget,
  touchPlace,
  touchStep,
  visibleFrame,
  waveDelays,
  wheelPixels,
  windowY,
} from "./model";

describe("wrap", () => {
  it("brings a number into half a list either side of zero", () => {
    expect(signedWrap(0, 14)).toBe(0);
    expect(signedWrap(3, 14)).toBe(3);
    expect(signedWrap(8, 14)).toBe(-6);
    expect(signedWrap(-8, 14)).toBe(6);
    expect(signedWrap(14, 14)).toBe(0);
    expect(signedWrap(-1.3, 14)).toBeCloseTo(-1.3, 10);
  });

  it("mod is never negative", () => {
    expect(mod(-1, 14)).toBe(13);
    expect(mod(15, 14)).toBe(1);
    expect(mod(0, 14)).toBe(0);
  });

  it("the offset of a picture round the end is small, so the loop has no jump", () => {
    // The place is 13.4 of 14: picture 0 is 0.6 below, picture 13 is 0.4 above.
    expect(offsetOf(0, 13.4, 14)).toBeCloseTo(0.6, 10);
    expect(offsetOf(13, 13.4, 14)).toBeCloseTo(-0.4, 10);
    // And going on past the end changes nothing but the number.
    expect(offsetOf(0, 14.6, 14)).toBeCloseTo(-0.6, 10);
  });

  it("the picture in front is the place rounded, in the list", () => {
    expect(activeOf(0.49, 14)).toBe(0);
    expect(activeOf(0.51, 14)).toBe(1);
    expect(activeOf(-0.6, 14)).toBe(13);
    expect(activeOf(27.7, 14)).toBe(0);
  });

  it("the place of a jump is the short way round", () => {
    expect(slotOf(13, 0, 14)).toBe(-1);
    expect(slotOf(1, 13, 14)).toBe(15);
    expect(slotOf(5, 0.2, 14)).toBe(5);
    expect(slotOf(9, 0, 14)).toBe(-5);
  });

  it("rebase moves nothing on the screen", () => {
    const { pos, target } = rebase(31.3, 32, 14);
    expect(pos).toBeCloseTo(3.3, 10);
    expect(target).toBeCloseTo(4, 10);
    for (let k = 0; k < 14; k += 1) {
      expect(offsetOf(k, pos, 14)).toBeCloseTo(offsetOf(k, 31.3, 14), 9);
    }
  });

  it("mounts seven windows, fewer in a short list", () => {
    expect(nearIndexes(0, 14)).toEqual([11, 12, 13, 0, 1, 2, 3]);
    expect(nearIndexes(7, 14)).toHaveLength(2 * NEAR + 1);
    expect(nearIndexes(0, 4)).toEqual([1, 2, 3, 0]);
  });
});

describe("the ease", () => {
  /** The share of the way done after `ms` of 60 Hz frames. */
  const done = (ms: number, hz = 60) => {
    let pos = 0;
    const dt = 1 / hz;
    for (let i = 0; i < Math.round((ms / 1000) * hz); i += 1) pos = stepPos(pos, 1, dt);
    return pos;
  };

  it("follows the reference's table at 60 Hz", () => {
    // 9 percent of what is left each frame: 0.25, 0.43, 0.57, 0.68, 0.82, 0.90, 0.97, 0.99.
    const table: Array<[number, number]> = [
      [50, 0.25],
      [100, 0.43],
      [150, 0.57],
      [200, 0.68],
      [300, 0.82],
      [400, 0.9],
      [600, 0.97],
      [800, 0.99],
    ];
    for (const [ms, share] of table) expect(done(ms)).toBeCloseTo(share, 1);
  });

  it("takes as long on a fast screen as on a slow one", () => {
    for (const ms of [100, 300, 800]) {
      expect(done(ms, 120)).toBeCloseTo(done(ms, 60), 2);
      expect(done(ms, 30)).toBeCloseTo(done(ms, 60), 2);
    }
  });

  it("has no overshoot and snaps to the target", () => {
    let pos = 0;
    let steps = 0;
    while (pos !== 1 && steps < 1000) {
      pos = stepPos(pos, 1, 1 / 60);
      expect(pos).toBeLessThanOrEqual(1);
      steps += 1;
    }
    expect(pos).toBe(1);
    // About 1.1 s at 60 Hz: ln(1 / 0.002) / 5.66.
    expect(steps / 60).toBeCloseTo(Math.log(1 / SETTLE) / LAMBDA, 0);
    expect(stepPos(0.9995, 1, 1 / 60)).toBe(1);
  });

  it("steps from the target rounded to a whole place", () => {
    expect(stepTarget(0, 1)).toBe(1);
    expect(stepTarget(1.4, 1)).toBe(2);
    expect(stepTarget(1.6, -1)).toBe(1);
    expect(stepTarget(-0.2, -1)).toBe(-1);
  });

  it("never lets a held key run far ahead", () => {
    expect(limitLead(5, 0)).toBe(MAX_LEAD);
    expect(limitLead(-5, 1)).toBe(1 - MAX_LEAD);
    expect(limitLead(1.5, 1)).toBe(1.5);
  });
});

describe("the layout", () => {
  it("at 1440 by 900 follows the reference with a 16:9 window and a quieter inset", () => {
    const l = computeLayout(1440, 900);
    expect(l.mode).toBe("wide");
    expect(l.list).toBe(true);
    expect(l.ww).toBe(726);
    expect(l.wh).toBe(408);
    expect(l.step).toBe(648);
    expect(l.a).toBe(130);
    expect(l.inset).toBe(0.1);
    // The pane is the window with a tenth of the pane more on each side.
    expect(l.pw).toBeCloseTo(l.ww / 0.8, -1);
    expect(l.ph).toBeCloseTo(l.wh / 0.8, -1);
    expect(l.b).toBe(l.padY);
    expect(l.b).toBe(51);
  });

  it("at 1920 by 1080 the window pitch and parallax are the measured ones", () => {
    const l = computeLayout(1920, 1080);
    expect(l.ww).toBe(928);
    expect(l.step).toBe(864);
    expect(l.a).toBeCloseTo(172.8, 0);
  });

  it("on a phone three pictures show and there is no list", () => {
    const l = computeLayout(390, 844);
    expect(l.mode).toBe("phone");
    expect(l.list).toBe(false);
    expect(l.ww).toBe(348);
    expect(l.step).toBe(274);
    expect(l.a).toBe(17);
    expect(l.inset).toBe(0.08);
    // The next window starts below the middle one with a gap, as the reference's phone does.
    expect(l.step - l.a).toBeGreaterThan(l.wh);
  });

  it("a tablet has the desktop spacing and no list", () => {
    const l = computeLayout(820, 1180);
    expect(l.mode).toBe("tablet");
    expect(l.list).toBe(false);
    expect(l.ww).toBe(568);
  });

  it("a short screen scales the stage so a window is at most half the height", () => {
    const l = computeLayout(1440, 600);
    expect(l.wh).toBeLessThanOrEqual(300);
    expect(l.wh).toBeGreaterThan(280);
    // The whole stage scales together.
    expect(l.step).toBeLessThan(648);
    expect(l.ww % 2).toBe(0);
  });

  it("the window and the pane share a centre to the pixel", () => {
    for (const [w, h] of [
      [1440, 900],
      [1920, 1080],
      [1280, 720],
      [1024, 768],
      [390, 844],
      [820, 1180],
      [2560, 1440],
    ] as const) {
      const l = computeLayout(w, h);
      expect(l.pw - l.ww).toBe(2 * l.padX);
      expect(l.ph - l.wh).toBe(2 * l.padY);
      expect(l.b).toBeLessThanOrEqual(l.padY);
    }
  });

  it("the row pitch follows the width within bounds", () => {
    expect(computeLayout(1440, 900).row).toBe(23);
    expect(computeLayout(1024, 768).row).toBe(20);
    expect(computeLayout(2560, 1440).row).toBe(28);
  });
});

describe("what moves, and how far", () => {
  const l = computeLayout(1440, 900);

  it("the window moves less than the step within one place of the middle, then the full step", () => {
    expect(windowY(0, l)).toBe(0);
    expect(windowY(1, l)).toBe(l.step - l.a);
    expect(windowY(-1, l)).toBe(-(l.step - l.a));
    expect(windowY(2, l)).toBe(2 * l.step - l.a);
    expect(windowY(0.5, l)).toBeCloseTo(0.5 * l.step - 0.5 * l.a, 10);
  });

  it("the picture moves inside its window the other way, and settles slowly", () => {
    expect(innerY(0, l)).toBeCloseTo(0, 10);
    expect(innerY(1, l)).toBe(-l.b);
    expect(innerY(-1, l)).toBe(l.b);
    expect(innerY(3, l)).toBe(-l.b);
    // At half a place it has moved only 29 percent of the way (0.5 to the power 1.8).
    expect(innerY(0.5, l)).toBeCloseTo(-0.287 * l.b, 1);
    // The window and the picture inside it move in opposite directions.
    expect(Math.sign(innerY(0.7, l))).toBe(-Math.sign(windowY(0.7, l)));
  });

  it("the picture never leaves a gap inside its window", () => {
    for (let d = -3; d <= 3; d += 0.1) expect(Math.abs(innerY(d, l))).toBeLessThanOrEqual(l.padY);
  });

  it("at most five windows are drawn at once", () => {
    for (let pos = 0; pos < 14; pos += 0.07) {
      let drawn = 0;
      for (let k = 0; k < 14; k += 1) if (Math.abs(offsetOf(k, pos, 14)) < REACH) drawn += 1;
      expect(drawn).toBeLessThanOrEqual(5);
    }
  });
});

describe("the title list", () => {
  it("fades by the ladder 1, 0.8, 0.5, 0.2, 0.1", () => {
    expect(rowOpacity(0)).toBe(1);
    expect(rowOpacity(1)).toBeCloseTo(0.8, 10);
    expect(rowOpacity(2)).toBeCloseTo(0.5, 10);
    expect(rowOpacity(3)).toBeCloseTo(0.2, 10);
    expect(rowOpacity(4)).toBeCloseTo(0.1, 10);
  });

  it("is the same above and below, and goes out at five and a half", () => {
    expect(rowOpacity(-2)).toBeCloseTo(rowOpacity(2), 10);
    expect(rowOpacity(5)).toBeCloseTo(0.06, 10);
    expect(rowOpacity(ROW_REACH)).toBe(0);
    expect(rowOpacity(9)).toBe(0);
  });

  it("only ever gets fainter with distance", () => {
    let last = 2;
    for (let r = 0; r <= 6; r += 0.05) {
      const v = rowOpacity(r);
      expect(v).toBeLessThanOrEqual(last + 1e-12);
      last = v;
    }
  });
});

describe("the zoom starts from what the window shows", () => {
  const l = computeLayout(1440, 900);
  const frame = { x: 0, y: 0, w: 1, h: 1 };

  it("the visible frame is the middle of the pane, moved by the picture's offset", () => {
    const v = visibleFrame(frame, l);
    expect(v.x).toBeCloseTo(l.padX / l.pw, 10);
    expect(v.w).toBeCloseTo(l.ww / l.pw, 10);
    expect(v.y).toBeCloseTo(l.padY / l.ph, 10);
    expect(v.h).toBeCloseTo(l.wh / l.ph, 10);
    // The picture moved down inside the window: the window sees higher up in it.
    expect(visibleFrame(frame, l, 20).y).toBeLessThan(v.y);
    expect(visibleFrame(frame, l, -20).y).toBeGreaterThan(v.y);
  });

  it("is inside the frame", () => {
    const part = { x: 0.1, y: 0.2, w: 0.5, h: 0.28125 };
    const v = visibleFrame(part, l);
    expect(v.x).toBeGreaterThanOrEqual(part.x);
    expect(v.y).toBeGreaterThanOrEqual(part.y);
    expect(v.x + v.w).toBeLessThanOrEqual(part.x + part.w + 1e-9);
    expect(v.y + v.h).toBeLessThanOrEqual(part.y + part.h + 1e-9);
  });

  it("places the whole picture where the stage's own pane places it", () => {
    // The stage draws the frame to fill the pane: the picture is pw / frame.w wide and its
    // frame's corner is at the pane's corner. The zoom must start from the same place.
    for (const iy of [0, 20, -35]) {
      const win: Rect = { x: 357, y: 245 + 3, w: l.ww, h: l.wh };
      const box = { w: 1280, h: 720 };
      const view = { w: 1440, h: 900 };
      const pose = sourcePose(win, visibleFrame(frame, l, iy), box, view);
      const paneLeft = win.x - l.padX;
      const paneTop = win.y - l.padY + iy;
      const wide = l.pw / frame.w;
      const tall = l.ph / frame.h;
      expect(pose.c.x).toBeCloseTo(paneLeft - (frame.x / frame.w) * l.pw, 0);
      expect(pose.c.y).toBeCloseTo(paneTop - (frame.y / frame.h) * l.ph, 0);
      // The pane is 16:9 to within a pixel of rounding, so the cover can be a pixel off.
      expect(Math.abs(box.w * pose.c.s - wide)).toBeLessThan(1.5);
      expect(Math.abs(box.h * pose.c.s - tall)).toBeLessThan(1.5);
    }
  });

  it("holds for a frame that is a part of the picture", () => {
    // A 16:9 part of a 16:9 picture is half as wide and half as tall.
    const part = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
    const win: Rect = { x: 100, y: 100, w: l.ww, h: l.wh };
    const box = { w: 2560, h: 1440 };
    const pose = sourcePose(win, visibleFrame(part, l, 0), box, { w: 1440, h: 900 });
    const paneLeft = win.x - l.padX;
    const paneTop = win.y - l.padY;
    expect(Math.abs(pose.c.x - (paneLeft - (part.x / part.w) * l.pw))).toBeLessThan(1.5);
    expect(Math.abs(pose.c.y - (paneTop - (part.y / part.h) * l.ph))).toBeLessThan(1.5);
    expect(Math.abs(box.w * pose.c.s - l.pw / part.w)).toBeLessThan(2);
  });
});

describe("the wheel", () => {
  it("reads lines and pages as pixels", () => {
    expect(wheelPixels(100, 0, 900)).toBe(100);
    expect(wheelPixels(3, 1, 900)).toBe(48);
    expect(wheelPixels(1, 2, 900)).toBe(900);
  });

  it("ignores a turn under four pixels", () => {
    const g = new WheelGate();
    expect(g.feed(0, 3)).toBe(0);
    expect(g.feed(500, 3.9)).toBe(0);
    expect(g.feed(1000, 4)).toBe(1);
  });

  it("gives one step to one notch of a mouse wheel", () => {
    const g = new WheelGate();
    expect(g.feed(0, 100)).toBe(1);
    expect(g.feed(500, -100)).toBe(-1);
  });

  it("gives one step to a whole trackpad swipe, a long tail of shrinking turns", () => {
    const g = new WheelGate();
    const swipe = [5, 12, 30, 60, 90, 80, 60, 40, 25, 12, 6, 5];
    let steps = 0;
    swipe.forEach((d, i) => {
      steps += Math.abs(g.feed(i * 16, d));
    });
    expect(steps).toBe(1);
  });

  it("gives another step to a new, harder swipe", () => {
    const g = new WheelGate();
    let steps = 0;
    const swipe = [10, 40, 90, 70, 40, 15];
    swipe.forEach((d, i) => {
      steps += Math.abs(g.feed(i * 16, d));
    });
    swipe.forEach((d, i) => {
      steps += Math.abs(g.feed(600 + i * 16, d));
    });
    expect(steps).toBe(2);
  });

  it("never gives two steps closer than 200 ms, so a hard wheel makes at most five a second", () => {
    const g = new WheelGate();
    const times: number[] = [];
    for (let t = 0; t < 2000; t += 30) if (g.feed(t, 100)) times.push(t);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(STEP_GAP_MS);
    }
    expect(times.length).toBeLessThanOrEqual(10);
    expect(times.length).toBeGreaterThanOrEqual(7);
  });

  it("steps up for a turn up", () => {
    expect(new WheelGate().feed(0, -80)).toBe(-1);
  });
});

describe("the finger", () => {
  it("follows the finger up to one place, after a dead zone of six pixels", () => {
    expect(touchPlace(0)).toBe(0);
    expect(touchPlace(-5)).toBe(0);
    expect(touchPlace(-6)).toBe(0);
    expect(touchPlace(-29)).toBeCloseTo(0.5, 10);
    expect(touchPlace(-52)).toBeCloseTo(1, 10);
    expect(touchPlace(-400)).toBe(1);
    expect(touchPlace(30)).toBeLessThan(0);
    expect(touchPlace(400)).toBe(-1);
  });

  it("makes the step only after more than 16 pixels, up for the next picture", () => {
    expect(touchStep(-10)).toBe(0);
    expect(touchStep(16)).toBe(0);
    expect(touchStep(-17)).toBe(1);
    expect(touchStep(17)).toBe(-1);
  });
});

describe("the keys", () => {
  it("steps with the arrows, Page keys and Space", () => {
    expect(keyAction("ArrowDown")).toBe(1);
    expect(keyAction("PageDown")).toBe(1);
    expect(keyAction("ArrowUp")).toBe(-1);
    expect(keyAction("PageUp")).toBe(-1);
    expect(keyAction(" ")).toBe(1);
    expect(keyAction(" ", true)).toBe(-1);
  });

  it("goes to the ends with Home and End, and opens with Enter", () => {
    expect(keyAction("Home")).toBe("first");
    expect(keyAction("End")).toBe("last");
    expect(keyAction("Enter")).toBe("open");
    expect(keyAction("a")).toBeNull();
    expect(keyAction("ArrowLeft")).toBeNull();
  });
});

describe("the caption wave", () => {
  it("starts in the middle and ends at the edges, over the spread", () => {
    const d = waveDelays([4, 2, 0, 2, 4], 0.4);
    expect(d[2]).toBe(0);
    expect(d[0]).toBeCloseTo(0.4, 10);
    expect(d[4]).toBeCloseTo(0.4, 10);
    expect(d[1]).toBeCloseTo(0.2, 10);
  });

  it("is flat for a caption with one place", () => {
    expect(waveDelays([0, 0], 0.4)).toEqual([0, 0]);
    expect(waveDelays([], 0.4)).toEqual([]);
  });

  it("takes about 1.3 s from the first letter leaving to the last arriving", () => {
    const total = LEAVE.duration + LEAVE.spread + ARRIVE.duration + ARRIVE.spread;
    expect(total).toBeGreaterThan(1.2);
    expect(total).toBeLessThan(1.4);
  });
});
