import { describe, expect, it } from "vitest";

import { FACES } from "../hand/faces";
import { fallEnd, handGeometry, J6 } from "../hand/timeline";

import {
  END_FEET_Y,
  END_HEIGHT,
  FALL_MOODS,
  HIPS_ABOVE_FEET,
  Journey,
  PAIR_FACES,
  pathParam,
  wheelPosition,
} from "./journey";
import { KEY_CENTRE, KEY_FALL, keyFraction, newPathPoint, pathAt } from "./path";
import { BEAT, BOLT_LAST, WHEEL_FROM, WHEEL_ITEMS, WHEEL_STEP } from "./stations";

const sizes = [
  [1440, 900],
  [1706, 950],
  [390, 844],
] as const;

describe("the path", () => {
  it("starts and ends at the keys and has the centre key between", () => {
    const p = newPathPoint();
    pathAt(0, p);
    expect(p.x).toBeCloseTo(0.78, 6);
    expect(p.y).toBeCloseTo(-0.78, 6);
    pathAt(1, p);
    expect(p.x).toBeCloseTo(-0.85, 6);
    expect(p.y).toBeCloseTo(0.85, 6);
    const c = keyFraction(KEY_CENTRE);
    expect(c).toBeGreaterThan(0.3);
    expect(c).toBeLessThan(0.6);
    pathAt(c, p);
    expect(p.x).toBeCloseTo(0.05, 2);
    expect(p.y).toBeCloseTo(-0.17, 2);
  });

  it("is continuous and goes from the lower right to the upper left", () => {
    const a = newPathPoint();
    const b = newPathPoint();
    let lastX = Infinity;
    let lastY = -Infinity;
    for (let p = -0.1; p <= 1.1; p += 0.005) {
      pathAt(p, a);
      pathAt(p + 0.005, b);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.05);
      expect(a.x).toBeLessThan(lastX + 1e-9);
      expect(a.y).toBeGreaterThan(lastY - 1e-9);
      lastX = a.x;
      lastY = a.y;
    }
  });

  it("has unit tangents that point to the upper left", () => {
    const p = newPathPoint();
    for (const at of [0.1, 0.5, 0.9, 1.05]) {
      pathAt(at, p);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 6);
      expect(p.tx).toBeLessThan(0);
      expect(p.ty).toBeGreaterThan(0);
    }
  });
});

describe("the journey", () => {
  it("is written in beat time: it does not read the registry", () => {
    expect(BEAT.at75).toBeGreaterThan(BEAT.launch);
    expect(BEAT.end).toBe(6.6);
    expect(BOLT_LAST).toBeLessThanOrEqual(BEAT.leave);
  });

  it("pauses at the centre key and has no jump in the path parameter", () => {
    const c = keyFraction(KEY_CENTRE);
    expect(pathParam(BEAT.arrive)).toBeCloseTo(c, 9);
    expect(pathParam((BEAT.arrive + BEAT.leave) / 2)).toBeCloseTo(c, 9);
    expect(pathParam(BEAT.leave)).toBeCloseTo(c, 9);
    expect(pathParam(BEAT.at75)).toBeCloseTo(keyFraction(KEY_FALL), 9);
    let last = pathParam(0);
    for (let t = 0.01; t < BEAT.end; t += 0.01) {
      const p = pathParam(t);
      expect(p).toBeGreaterThanOrEqual(last - 1e-12);
      expect(p - last).toBeLessThan(0.02);
      last = p;
    }
  });

  it.each(sizes)("brings the dragon in from off screen at %i x %i", (w, h) => {
    const j = new Journey();
    j.at(BEAT.enter, w, h);
    expect(j.dragonX).toBeGreaterThan(w / 2);
    expect(j.dragonY).toBeLessThan(-h / 2);
    j.at(BEAT.arrive, w, h);
    expect(Math.abs(j.dragonX)).toBeLessThan(w * 0.2);
    expect(Math.abs(j.dragonY)).toBeLessThan(h * 0.25);
    expect(j.dragonVisible).toBe(true);
  });

  it("is a pure function of t: the same t gives the same state however it is reached", () => {
    const a = new Journey();
    const b = new Journey();
    a.at(0.3, 1440, 900);
    a.at(4.4, 1440, 900);
    a.at(2.2, 1440, 900);
    b.at(2.2, 1440, 900);
    for (const k of [
      "dragonX",
      "dragonY",
      "yaw",
      "pitch",
      "roll",
      "flyAmp",
      "dollHeight",
    ] as const) {
      expect(a[k]).toBeCloseTo(b[k], 9);
    }
    a.at(5.5, 1440, 900);
    b.at(0, 1440, 900);
    b.at(5.5, 1440, 900);
    for (const k of ["dollX", "dollY", "dollHeight", "dollRoll", "zoom", "camX", "camY"] as const) {
      expect(a[k]).toBeCloseTo(b[k], 9);
    }
  });

  it.each(sizes)("keeps the doll on the head until the throw, then free (%i x %i)", (w, h) => {
    const j = new Journey();
    expect(j.at(0, w, h).dollMode).toBe("hidden");
    expect(j.at(2, w, h).dollMode).toBe("ride");
    expect(j.at(BEAT.launch, w, h).dollMode).toBe("ride");
    expect(j.at(BEAT.launch + 0.01, w, h).dollMode).toBe("fall");
    expect(j.at(BEAT.end, w, h).dollMode).toBe("fall");
  });

  it.each(sizes)(
    "puts the dragon at the 75 percent point, upper left, at 1.3 (%i x %i)",
    (w, h) => {
      const j = new Journey().at(BEAT.at75, w, h);
      expect(j.dragonX).toBeLessThan(0);
      expect(j.dragonY).toBeGreaterThan(0);
      expect(j.dragonVisible).toBe(true);
      const ref = Math.min(h, 1.5 * w);
      expect(j.dragonHeight / ref).toBeGreaterThan(0.24 * 1.2);
      expect(j.dragonHeight / ref).toBeLessThan(0.24 * 1.4);
    },
  );

  it.each(sizes)("ends the fall with the doll upright at the centre (%i x %i)", (w, h) => {
    const j = new Journey().at(BEAT.end, w, h);
    expect(j.dollX).toBeCloseTo(0, 6);
    expect(j.dollHeight / h).toBeCloseTo(END_HEIGHT, 6);
    // The pivot is her hips: her feet are `HIPS_ABOVE_FEET` of her height below it.
    expect((j.dollY - HIPS_ABOVE_FEET * j.dollHeight) / h).toBeCloseTo(END_FEET_Y, 6);
    expect(j.settle).toBeCloseTo(1, 6);
    expect(Math.abs(j.dollRoll % (Math.PI * 2))).toBeCloseTo(0, 6);
    expect(j.dollPitch).toBeCloseTo(0, 3);
    expect(j.dollYaw).toBeCloseTo(0, 3);
    expect(j.dragonVisible).toBe(false);
  });

  it.each(sizes)("ends where the hand section starts her (joint J6, %i x %i)", (w, h) => {
    const j = new Journey().at(BEAT.end, w, h);
    const hand = handGeometry({ w, h });
    const end = fallEnd({ w, h });
    expect(j.dollX).toBeCloseTo(end.x, 6);
    expect(j.dollY).toBeCloseTo(end.y, 6);
    expect(j.dollHeight).toBeCloseTo(end.height, 6);
    expect(j.dollHeight).toBeCloseTo(hand.airHeight, 6);
    expect(j.dollY - HIPS_ABOVE_FEET * j.dollHeight).toBeCloseTo(hand.airY, 6);
    // The hand goes on from a doll that is 0.7 of the way from the fall pose to standing, with a
    // flail of 0.2 at rate 0.6, no talk and the face `gloom`.
    expect(j.poseA).toBe("fall");
    expect(j.poseB).toBe("stand");
    expect(j.poseW).toBeCloseTo(J6.standWeight, 6);
    expect(j.flail).toBeCloseTo(J6.flail, 6);
    expect(j.flailRate).toBeCloseTo(J6.flailRate, 6);
    expect(J6.z).toBe(60);
    expect(j.talk).toBeCloseTo(0, 6);
    expect(FALL_MOODS[FALL_MOODS.length - 1]!.face).toBe(FACES[0]!.face);
    // The last step of the fall's mood sequence has been reached (the steps before it run 4.5 s).
    expect(j.moodT).toBeGreaterThan(5);
  });

  it("lets the air streaks go before the rest at the end of the fall", () => {
    const j = new Journey();
    expect(j.at(BEAT.end, 1440, 900).air).toBe(0);
    expect(j.at(BEAT.end - 0.25, 1440, 900).air).toBeGreaterThan(0);
    expect(j.at(BEAT.end - 1.5, 1440, 900).air).toBeGreaterThan(0.1);
  });

  it.each(sizes)("moves the doll without a jump across the whole fall (%i x %i)", (w, h) => {
    const j = new Journey();
    let lx = NaN;
    let ly = NaN;
    let lh = NaN;
    for (let t = BEAT.launch + 0.001; t <= BEAT.end; t += 0.01) {
      j.at(t, w, h);
      if (!Number.isNaN(lx)) {
        expect(Math.hypot(j.dollX - lx, j.dollY - ly)).toBeLessThan(h * 0.08);
        expect(Math.abs(j.dollHeight - lh)).toBeLessThan(h * 0.02);
      }
      lx = j.dollX;
      ly = j.dollY;
      lh = j.dollHeight;
    }
  });

  it("starts the fall where the doll was riding: the world, the camera and the size agree at the throw", () => {
    const j = new Journey();
    const before = j.at(BEAT.launch - 1e-6, 1440, 900);
    const dragonBefore = before.dragonX;
    const after = j.at(BEAT.launch + 1e-6, 1440, 900);
    expect(after.zoom).toBeCloseTo(1, 4);
    expect(after.camX).toBeCloseTo(0, 1);
    expect(after.camY).toBeCloseTo(0, 1);
    expect(after.dragonX).toBeCloseTo(dragonBefore, 1);
  });

  it("zooms in and brings the dragon out of the picture during the fall", () => {
    const j = new Journey();
    const z = [4.0, 4.5, 5.2, 6].map((t) => j.at(t, 1440, 900).zoom);
    for (let i = 1; i < z.length; i += 1) expect(z[i]!).toBeGreaterThan(z[i - 1]!);
    expect(j.at(4.9, 1440, 900).dragonVisible).toBe(false);
  });

  it("turns one pair at a time and has a face for each", () => {
    expect(PAIR_FACES).toHaveLength(WHEEL_ITEMS);
    expect(new Set(PAIR_FACES).size).toBe(WHEEL_ITEMS);
    expect(Math.round(wheelPosition(WHEEL_FROM))).toBe(0);
  });

  it("rests every station on its own pair, with that pair's face, and not on a pair's edge", () => {
    for (let i = 0; i < WHEEL_ITEMS; i += 1) {
      const t = WHEEL_FROM + i * WHEEL_STEP;
      expect(wheelPosition(t)).toBeCloseTo(i, 9);
      expect(new Journey().at(t, 1440, 900).dwellFace).toBe(PAIR_FACES[i]);
    }
  });

  it("is calm at the rests: the dragon hovers, the doll sits, nothing has been thrown", () => {
    for (let i = 0; i < WHEEL_ITEMS; i += 1) {
      const j = new Journey().at(WHEEL_FROM + i * WHEEL_STEP, 1440, 900);
      expect(j.dollMode).toBe("ride");
      expect(j.hover).toBeCloseTo(1, 6);
    }
    // The first station has the dragon in, whole and still on its path.
    expect(pathParam(WHEEL_FROM)).toBeCloseTo(keyFraction(KEY_CENTRE), 9);
  });

  it("rears only after the last station, and the head is down again for the sneeze", () => {
    const rest = new Journey().at(BOLT_LAST, 1440, 900);
    expect(rest.fright).toBe(0);
    const rearing = new Journey().at(BEAT.launch - 0.2, 1440, 900);
    expect(rearing.fright).toBeGreaterThan(0.9);
    expect(rest.pitch).not.toBeCloseTo(rearing.pitch, 2);
  });
});
