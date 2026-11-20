import { describe, expect, it } from "vitest";

import {
  danceClock,
  GUEST_GONE,
  GUEST_IN_FROM,
  GUEST_LEAVE_TO,
  guestPlace,
  guestsAt,
  newGuestState,
  type GuestState,
} from "./guests";

describe("the guests' schedule", () => {
  it("is absent before 20 percent and after the gone mark, and off the screen at both ends", () => {
    const s = newGuestState();
    expect(guestsAt(GUEST_IN_FROM - 0.01, s).shown).toBe(false);
    expect(guestsAt(GUEST_GONE + 0.01, s).shown).toBe(false);
    // The first and the last frame they are drawn, they are all the way out (leave 1).
    const first = guestsAt(GUEST_IN_FROM + 1e-6, newGuestState());
    expect(first.pose).toBe("leave");
    expect(first.w).toBeGreaterThan(0.999);
    const last = guestsAt(GUEST_GONE - 1e-6, newGuestState());
    expect(last.pose).toBe("leave");
    expect(last.w).toBe(1);
    expect(guestsAt(GUEST_LEAVE_TO, newGuestState()).w).toBe(1);
  });

  it("walks the scroll with no jump in the weight where the pose changes", () => {
    const a = newGuestState();
    const b: GuestState = newGuestState();
    let worst = 0;
    // The leave weight is the distance out: it must be continuous, the other poses start and end at 0.
    for (let i = 0; i < 2000; i += 1) {
      const p = 0.2 + (0.64 * i) / 2000;
      guestsAt(p, a);
      guestsAt(p + 0.64 / 2000, b);
      const wa = a.pose === "leave" ? 1 - a.w : a.w;
      const wb = b.pose === "leave" ? 1 - b.w : b.w;
      if (a.pose !== b.pose) {
        // Across a change of pose both sides are at rest (leave 0, bow 0, dance 0, float 1).
        expect(a.pose === "leave" ? a.w : a.pose === "float" ? 0 : a.w).toBeLessThan(0.02);
        continue;
      }
      worst = Math.max(worst, Math.abs(wa - wb));
    }
    expect(worst).toBeLessThan(0.02);
  });

  it("is the same both ways (a pure function of p)", () => {
    const a = newGuestState();
    const b = newGuestState();
    for (const p of [0.1, 0.25, 0.33, 0.5, 0.64, 0.7, 0.8, 0.9]) {
      guestsAt(p, a);
      guestsAt(0.9, b);
      guestsAt(p, b);
      expect(b).toEqual(a);
    }
  });
});

describe("danceClock", () => {
  it("skips the fist bump and never steps back", () => {
    let last = danceClock(0);
    for (let i = 1; i < 400; i += 1) {
      const t = danceClock(i * 0.05);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    // Phrase 2 ends at 6 s of the loop and phrase 4 begins at 9: the clock jumps by exactly one phrase there.
    expect(danceClock(5.999)).toBeCloseTo(5.999, 6);
    expect(danceClock(6)).toBeCloseTo(9, 6);
    expect(danceClock(9)).toBeCloseTo(12, 6);
  });

  it("runs backwards for a negative time", () => {
    expect(danceClock(-1)).toBeCloseTo(-1 - 3 + 3 + 0, 6);
    expect(danceClock(-9)).toBeCloseTo(-12, 6);
  });
});

describe("guestPlace", () => {
  it("keeps the whole drone on the screen when the pair is at the edge", () => {
    const out = { x: 0, y: 0, height: 0 };
    guestPlace(1, 640, 0, 126, 1440, 0, out);
    expect(out.x + (out.height / 2) * 2.8).toBeLessThanOrEqual(720 + 1e-6);
    guestPlace(-1, -640, 0, 126, 1440, 0, out);
    expect(out.x - (out.height / 2) * 2.8).toBeGreaterThanOrEqual(-720 - 1e-6);
  });

  it("stands one on each side of the pair", () => {
    const l = guestPlace(-1, 0, 0, 100, 1440, 0, { x: 0, y: 0, height: 0 });
    const r = guestPlace(1, 0, 0, 100, 1440, 0, { x: 0, y: 0, height: 0 });
    expect(l.x).toBeLessThan(-100);
    expect(r.x).toBeGreaterThan(100);
    expect(l.height).toBeLessThan(100);
  });
});
