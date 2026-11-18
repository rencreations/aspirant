import { describe, expect, it } from "vitest";

import { SIZE_PER_HEIGHT } from "../../actors/drone/model";
import { layoutSections } from "../../kernel/layout";
import { SECTIONS } from "../../kernel/sections";
import { spotsOf } from "../bend/beats";

import { STEPS, stripGeo } from "./geometry";
import {
  AT,
  IN_RING,
  aboutEntry,
  coverIn,
  coverOut,
  defaultFoot,
  droneAt,
  hairAt,
  headAt,
  lightAt,
  newTetraWant,
  restSpot,
  stageTop,
  tetraAt,
  toStage,
  tourAt,
  type Spot,
} from "./route";

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [1440, 900],
  [1706, 950],
  [1366, 768],
  [390, 844],
  [820, 1180],
];

const spot = (): Spot => ({ x: 0, y: 0, height: 0 });

/** The drone at S for a viewport, the light on the tour's own position, the page where S says. */
function at(S: number, w: number, h: number, raw = S): Spot {
  const vp = { w, h };
  const strip = stripGeo(w, h);
  return droneAt(S, raw, tourAt(S), vp, strip, defaultFoot(vp), spot());
}

describe("the times", () => {
  it("start where the registry starts the archive and end where it ends the page", () => {
    const layout = layoutSections(SECTIONS);
    const archive = layout.placed.find((p) => p.id === "archive")!;
    const footer = layout.placed.find((p) => p.id === "footer")!;
    expect(AT.start).toBeCloseTo(archive.start, 9);
    expect(AT.stuck).toBeCloseTo(footer.start, 9);
    expect(AT.end).toBeCloseTo(layout.total, 9);
    // The footer's lead begins where the footer's runtime takes the drone.
    expect(AT.handover).toBeCloseTo(footer.from, 9);
  });

  it("are in order", () => {
    expect(AT.start).toBeLessThan(AT.leave);
    expect(AT.leave).toBeLessThan(AT.arrive);
    expect(AT.runFrom).toBeLessThan(AT.runTo);
    expect(AT.coversIn).toBeLessThan(AT.tourFrom);
    expect(AT.tourFrom).toBeLessThan(AT.tourTo);
    expect(AT.runTo).toBeLessThan(AT.tourTo);
    expect(AT.tourTo).toBeLessThan(AT.handover);
    expect(AT.handover).toBeLessThan(AT.stuck);
    expect(AT.stuck).toBeLessThan(AT.hairFrom);
    expect(AT.hairFrom).toBeLessThan(AT.exitFrom);
    expect(AT.exitFrom).toBeLessThan(AT.hairTo);
    expect(AT.hairTo).toBeLessThan(AT.end);
  });

  it("fills the hairline at the point where the page opens About", () => {
    // FooterAction arms at 0.025 of a screen from the end of the document.
    expect(hairAt(AT.end - 0.025)).toBe(1);
    expect(hairAt(AT.hairFrom)).toBe(0);
    expect(hairAt(AT.hairFrom + 0.01)).toBeGreaterThan(0);
  });
});

describe("the drone's route", () => {
  it("starts at the rest the bend section ends in (J14)", () => {
    for (const [w, h] of SIZES) {
      const p = at(AT.start, w, h);
      const rest = spotsOf({ w, h }).restDrone;
      expect(p.x).toBeCloseTo(w / 2 + rest.x * w, 6);
      expect(p.y).toBeCloseTo(h / 2 - rest.y * h, 6);
      expect(p.height).toBeCloseTo(rest.h * h, 6);
      expect(p).toEqual(restSpot({ w, h }, spot()));
    }
  });

  it("arrives over the first cover, at the hovering height, with no jump", () => {
    for (const [w, h] of SIZES) {
      const strip = stripGeo(w, h);
      const p = at(AT.arrive, w, h);
      expect(p.x).toBeCloseTo(strip.x0, 6);
      expect(p.y).toBeCloseTo(strip.droneY, 6);
      expect(p.height).toBeCloseTo(strip.droneH, 6);
    }
  });

  it("is over the middle of the footer's ring when the card stands (J15)", () => {
    for (const [w, h] of SIZES) {
      const foot = defaultFoot({ w, h });
      const p = at(AT.stuck, w, h);
      expect(p.x).toBeCloseTo(foot.x, 6);
      expect(p.y).toBeCloseTo(foot.offY, 6);
      expect(p.height).toBeCloseTo(IN_RING * foot.size, 6);
    }
  });

  it("is glued to the card while it rises, then holds still while it stands", () => {
    const a = at(59.5, 1440, 900);
    const b = at(59.9, 1440, 900);
    expect(b).toEqual(a);
    // With the page lower, the ring is lower by the same amount.
    const higher = at(58.9, 1440, 900, 58.9);
    const lower = at(58.9, 1440, 900, 58.8);
    expect(lower.y).toBeGreaterThan(higher.y);
  });

  it("leaves past the right edge, at the height and size where About's drone comes in", () => {
    for (const [w, h] of SIZES) {
      const p = at(AT.end, w, h);
      const enter = aboutEntry({ w, h });
      const width = p.height * SIZE_PER_HEIGHT;
      expect(p.x - width / 2, `${w}x${h} off the screen`).toBeGreaterThan(w);
      expect(p.y).toBeCloseTo(enter.y, 6);
      expect(width).toBeCloseTo(enter.size, 6);
    }
  });

  it("never jumps and is always finite from the start to the end", () => {
    for (const [w, h] of SIZES) {
      const diag = Math.hypot(w, h);
      let last = at(AT.start, w, h);
      for (let S = AT.start; S <= AT.end + 0.001; S += 0.002) {
        const p = at(S, w, h);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.height)).toBe(
          true,
        );
        expect(p.height).toBeGreaterThan(0);
        expect(Math.hypot(p.x - last.x, p.y - last.y), `${w}x${h} at ${S.toFixed(3)}`).toBeLessThan(
          0.02 * diag,
        );
        last = p;
      }
    }
  });

  it("is the same line forwards and backwards (a pure function of the scroll)", () => {
    const a = { ...at(57.3, 1440, 900) };
    at(60.2, 1440, 900);
    expect(at(57.3, 1440, 900)).toEqual(a);
  });

  it("converts to the stage frame", () => {
    expect(toStage({ w: 1440, h: 900 }, { x: 720, y: 450, height: 10 }, spot())).toEqual({
      x: 0,
      y: 0,
      height: 10,
    });
    expect(toStage({ w: 1440, h: 900 }, { x: 0, y: 0, height: 5 }, spot())).toEqual({
      x: -720,
      y: 450,
      height: 5,
    });
  });
});

describe("the tour and the covers", () => {
  it("runs 0 to 9 over the tour and holds at the ends", () => {
    expect(tourAt(AT.start)).toBe(0);
    expect(tourAt(AT.tourFrom)).toBe(0);
    expect(tourAt(AT.tourTo)).toBe(STEPS);
    expect(tourAt(AT.end)).toBe(STEPS);
  });

  it("lights while the tour runs and not before or after", () => {
    expect(lightAt(AT.start)).toBe(0);
    expect(lightAt((AT.tourFrom + AT.tourTo) / 2)).toBe(1);
    expect(lightAt(AT.lightOut + AT.lightLen)).toBe(0);
    expect(lightAt(AT.end)).toBe(0);
  });

  it("rises in left to right and lifts away left to right, each from 0 to 1", () => {
    for (let i = 0; i < 10; i += 1) {
      expect(coverIn(AT.start, i)).toBe(0);
      expect(coverIn(AT.tourFrom + 0.5, i)).toBe(1);
      expect(coverOut(AT.tourFrom + 0.5, i)).toBe(0);
      expect(coverOut(AT.coversOut + 1, i)).toBe(1);
      if (i > 0 && i <= 3) expect(coverIn(56.5, i)).toBeLessThanOrEqual(coverIn(56.5, i - 1));
    }
  });

  it("shows the title once the first cover rises and takes it away with the covers", () => {
    expect(headAt(AT.start)).toBe(0);
    expect(headAt(AT.tourFrom + 0.3)).toBe(1);
    expect(headAt(AT.tourFrom + 0.45, 0.1)).toBe(1);
    expect(headAt(AT.coversOut + 0.6)).toBe(0);
    expect(headAt(AT.coversIn + 0.1, 0.1)).toBeLessThan(headAt(AT.coversIn + 0.1));
  });

  it("puts the footer's stage at the bottom before it rises and at the top once it stands", () => {
    expect(stageTop(58.1, { w: 1440, h: 900 })).toBeCloseTo(900, 6);
    expect(stageTop(59.1, { w: 1440, h: 900 })).toBe(0);
    expect(stageTop(60, { w: 1440, h: 900 })).toBe(0);
  });
});

describe("Tetra's goodbye", () => {
  it("stands where the bend section leaves her (J14) and waves", () => {
    for (const [w, h] of SIZES) {
      const t = tetraAt(AT.start + 0.1, { w, h }, newTetraWant());
      expect(t.visible).toBe(true);
      const rest = spotsOf({ w, h }).rest;
      expect(t.x).toBeCloseTo(w / 2 + rest.tx * w, 6);
      expect(t.y).toBeCloseTo(h / 2 - rest.ty * h, 6);
      expect(t.height).toBeCloseTo(rest.th * h, 6);
      expect(t.run).toBe(0);
      expect(t.wave).toBeCloseTo(1, 6);
      expect(tetraAt(AT.start, { w, h }, newTetraWant()).wave).toBe(0);
    }
  });

  it("runs off to the left, only ever leftwards, and is gone before the tour starts", () => {
    for (const [w, h] of SIZES) {
      expect(tetraAt(AT.runTo + 0.03, { w, h }, newTetraWant()).visible).toBe(false);
      const end = tetraAt(AT.runTo, { w, h }, newTetraWant());
      expect(end.x + 0.3 * end.height).toBeLessThan(0);
      let last = Infinity;
      for (let S = AT.start; S <= AT.runTo; S += 0.01) {
        const t = tetraAt(S, { w, h }, newTetraWant());
        expect(t.x).toBeLessThanOrEqual(last + 1e-9);
        last = t.x;
      }
    }
  });
});
