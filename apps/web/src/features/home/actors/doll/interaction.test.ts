import { describe, expect, it } from "vitest";

import {
  DIZZY_SECONDS,
  HOP_SECONDS,
  Reactions,
  SPAM_COUNT,
  SPAM_WINDOW,
  SQUEAKS,
  SQUEAK_SECONDS,
  type ReactionKind,
} from "./interaction";

const DT = 1 / 60;

/** Step by `seconds` and return what happened. */
function run(
  r: Reactions,
  seconds: number,
): { began: ReactionKind[]; peakHop: number; faces: Set<string | null> } {
  const began: ReactionKind[] = [];
  const faces = new Set<string | null>();
  let peakHop = 0;
  for (let t = 0; t < seconds; t += DT) {
    const o = r.update(DT);
    if (o.began) began.push(o.began);
    peakHop = Math.max(peakHop, o.hop);
    faces.add(o.face);
  }
  return { began, peakHop, faces };
}

describe("hover", () => {
  it("is a single hop that rises and lands, and reports it once", () => {
    const r = new Reactions();
    r.enter();
    const seen = run(r, HOP_SECONDS + 0.2);
    expect(seen.began).toEqual(["hover"]);
    expect(seen.peakHop).toBeGreaterThan(0.95);
    expect(r.out.hop).toBe(0);
  });

  it("does not change her face", () => {
    const r = new Reactions();
    r.enter();
    expect(run(r, 1).faces).toEqual(new Set([null]));
  });
});

describe("press", () => {
  it("picks the squeak by the random number, over the whole list", () => {
    const got: string[] = [];
    for (const u of [0, 0.34, 0.5, 0.67, 0.99, 1]) {
      const r = new Reactions();
      r.press(u);
      got.push(r.update(DT).face ?? "none");
    }
    expect(new Set(got)).toEqual(new Set(SQUEAKS));
    expect(got[0]).toBe("shocked");
    expect(got.at(-1)).toBe(SQUEAKS.at(-1));
  });

  it("holds the squeak face for its time, then gives the face back", () => {
    const r = new Reactions();
    r.press(0);
    run(r, SQUEAK_SECONDS - 0.1);
    expect(r.out.face).not.toBeNull();
    run(r, 0.3);
    expect(r.out.face).toBeNull();
  });

  it("spins a whole turn and lands upright", () => {
    const r = new Reactions();
    r.press(0.2);
    let peak = 0;
    for (let t = 0; t < 4; t += DT) peak = Math.max(peak, Math.abs(r.update(DT).spin));
    expect(peak).toBeGreaterThan(Math.PI);
    expect(r.out.spin).toBe(0);
  });

  it("squashes and stretches, within a small band", () => {
    const r = new Reactions();
    r.press(0.2);
    let lo = 0;
    let hi = 0;
    for (let t = 0; t < 2; t += DT) {
      const s = r.update(DT).squash;
      lo = Math.min(lo, s);
      hi = Math.max(hi, s);
    }
    expect(hi).toBeGreaterThan(0.05);
    expect(lo).toBeGreaterThanOrEqual(-0.3);
    expect(hi).toBeLessThanOrEqual(0.3);
  });
});

describe("spam", () => {
  it("presses that come fast enough make her dizzy, and say so once", () => {
    const r = new Reactions();
    const began: ReactionKind[] = [];
    for (let i = 0; i < SPAM_COUNT; i++) {
      r.press(0.1);
      const o = r.update(0.1);
      if (o.began) began.push(o.began);
    }
    expect(began.at(-1)).toBe("dizzy");
    expect(began.filter((k) => k === "dizzy").length).toBe(1);
    expect(r.out.face).toBe("dizzy");
  });

  it("presses that are far apart do not", () => {
    const r = new Reactions();
    const began: ReactionKind[] = [];
    for (let i = 0; i < 6; i++) {
      r.press(0.1);
      const seen = run(r, SPAM_WINDOW + 0.4);
      began.push(...seen.began);
    }
    expect(began).not.toContain("dizzy");
  });

  it("stays dizzy for its time and does not start again while it lasts", () => {
    const r = new Reactions();
    for (let i = 0; i < 8; i++) {
      r.press(0.1);
      r.update(0.05);
    }
    const seen = run(r, DIZZY_SECONDS - 0.5);
    expect(seen.began).not.toContain("dizzy");
    expect(r.out.face).toBe("dizzy");
  });

  it("the head sways while she is dizzy, inside -1 to 1", () => {
    const r = new Reactions();
    for (let i = 0; i < 4; i++) {
      r.press(0.1);
      r.update(0.05);
    }
    let peak = 0;
    for (let t = 0; t < DIZZY_SECONDS; t += DT) {
      const w = r.update(DT).wobble;
      expect(Math.abs(w)).toBeLessThanOrEqual(1);
      peak = Math.max(peak, Math.abs(w));
    }
    expect(peak).toBeGreaterThan(0.3);
  });
});

describe("it always finishes", () => {
  it("after any storm of hovers and presses, a few seconds later nothing moves and nothing is held", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = new Reactions();
      let x = seed * 7919;
      const rand = (): number => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x / 2147483648;
      };
      for (let t = 0; t < 12; t += DT) {
        const u = rand();
        if (u < 0.01) r.enter();
        else if (u < 0.03) r.press(rand());
        r.update(DT);
      }
      run(r, 6);
      expect(r.busy).toBe(false);
      expect(r.out.face).toBeNull();
      expect(r.out.spin).toBe(0);
      expect(r.out.hop).toBe(0);
      expect(Math.abs(r.out.squash)).toBeLessThan(0.01);
      expect(Math.abs(r.out.wobble)).toBeLessThan(0.01);
    }
  });

  it("a very long frame is taken as at most a tenth of a second", () => {
    const r = new Reactions();
    r.press(0.2);
    r.update(30);
    expect(r.busy).toBe(true);
  });

  it("is idle when nothing happened", () => {
    const r = new Reactions();
    run(r, 1);
    expect(r.busy).toBe(false);
  });
});
