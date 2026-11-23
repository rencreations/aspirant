import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { FUNNY_FOCUS, FUNNY_PLAYS, FUNNY_SCREENS, FUNNY_ZONES, LENGTHS, R1, R2 } from "./stations";
import {
  GONE,
  T,
  bob,
  cutMoment,
  dragonOnScreen,
  dragonX,
  geometry,
  lift,
  tetraPlace,
} from "./timeline";

const SIZES: ReadonlyArray<[number, number]> = [
  [1440, 900],
  [1706, 950],
  [390, 844],
];

describe("the zones", () => {
  it("are a valid table: the stations are the end of each zone and the next one's start", () => {
    expect(() => {
      validatePlays("funny", FUNNY_PLAYS);
    }).not.toThrow();
    expect(FUNNY_PLAYS.map((p) => p.from)).toEqual([0, R1, R2]);
    expect(FUNNY_PLAYS.map((p) => p.to)).toEqual([R1, R2, 1]);
    for (const p of FUNNY_PLAYS) expect(p.span).toBeGreaterThan(0);
  });

  it("lay out in screens: three zones with a rest after each, the last the longest", () => {
    const [arrive, cross, ask] = FUNNY_ZONES;
    expect(arrive!.from).toBe(0);
    expect(cross!.from).toBeCloseTo(arrive!.to + LENGTHS.watch, 9);
    expect(ask!.from).toBeCloseTo(cross!.to + LENGTHS.confused, 9);
    expect(ask!.to + LENGTHS.words).toBeCloseTo(FUNNY_SCREENS, 9);
    expect(LENGTHS.words).toBeGreaterThan(LENGTHS.watch);
    expect(LENGTHS.words).toBeGreaterThan(LENGTHS.confused);
  });

  it("keep every zone short: the crossing about a screen, none over 1.5", () => {
    for (const z of FUNNY_ZONES) expect(z.to - z.from).toBeLessThanOrEqual(1.5);
    expect(LENGTHS.cross).toBeGreaterThanOrEqual(0.9);
    expect(LENGTHS.ask).toBeGreaterThanOrEqual(0.8);
  });

  it("put the focus in the middle of the last rest, where the words are in", () => {
    const at = FUNNY_FOCUS * FUNNY_SCREENS;
    expect(at).toBeGreaterThan(FUNNY_ZONES[2]!.to);
    expect(at).toBeLessThan(FUNNY_SCREENS);
  });

  it("rest on composed frames: Tetra with the kite, then an empty sky with the confused pair", () => {
    // First rest: Tetra has stopped, the dragon has not come, the pair stare.
    expect(R1).toBeGreaterThanOrEqual(T.enterEnd);
    expect(R1).toBeLessThan(T.dragonIn);
    expect(R1).toBeGreaterThan(T.watchFrom + 0.04);
    // Second rest: the dragon has left, the confusion is whole, the pair has not moved yet.
    expect(R2).toBeGreaterThanOrEqual(T.dragonOut);
    expect(R2).toBeGreaterThanOrEqual(T.confusedTo);
    expect(R2).toBeLessThanOrEqual(T.centreFrom);
    // Last rest: the words are in.
    expect(T.textTo).toBeLessThan(1);
  });
});

describe("the story order", () => {
  it("goes in order: arrive, watch, dragon, confusion, middle, question, words, lift", () => {
    expect(T.enterEnd).toBeLessThan(T.dragonIn);
    expect(T.watchFrom).toBeLessThan(T.dragonIn);
    expect(T.dragonIn).toBeLessThan(T.confusedFrom);
    expect(T.confusedFrom).toBeLessThan(T.confusedTo);
    expect(T.confusedTo).toBeLessThanOrEqual(T.centreFrom + 0.05);
    expect(T.centreFrom).toBeLessThan(T.centreTo);
    expect(T.centreTo).toBeLessThanOrEqual(T.questionFrom);
    expect(T.questionFrom).toBeLessThan(T.textFrom);
    expect(T.textFrom).toBeLessThan(T.textTo);
    expect(T.textTo).toBeLessThan(1);
  });
});

describe.each(SIZES)("the geometry at %i x %i", (w, h) => {
  const g = geometry(w, h);

  it("keeps the two watching drones apart and on the screen", () => {
    const [a, b] = g.watch;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.6 * a.height);
    for (const d of g.watch) {
      expect(Math.abs(d.x) + d.height).toBeLessThan(w / 2 + 10);
      expect(Math.abs(d.y) + 0.5 * d.height).toBeLessThan(h / 2);
    }
  });

  it("puts the two drones in the middle side by side, big, and clear of each other", () => {
    const [a, b] = g.centre;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(0.85 * a.height);
    expect(a.height).toBeGreaterThan(g.watch[0].height);
    expect(Math.abs(a.x) + 1.7 * 0.5 * a.height).toBeLessThan(w / 2);
  });

  it("has the dragon come from beyond the right edge and leave beyond the left", () => {
    const x0 = dragonX(T.dragonIn, g);
    const x1 = dragonX(T.dragonOut, g);
    expect(x0 - g.dragon.headLead).toBeGreaterThan(w / 2);
    expect(x1 + 2.8 * g.dragon.height).toBeLessThan(-w / 2);
    let last = Infinity;
    for (let l = T.dragonIn; l <= T.dragonOut; l += 0.01) {
      const x = dragonX(l, g);
      expect(x).toBeLessThanOrEqual(last);
      last = x;
    }
  });

  it("cuts the rope while the dragon is crossing, at a place along the rope", () => {
    const cut = cutMoment(g);
    expect(cut.local).toBeGreaterThan(T.dragonIn);
    expect(cut.local).toBeLessThan(T.dragonOut);
    expect(cut.at).toBeGreaterThan(0.1);
    expect(cut.at).toBeLessThan(0.9);
    // The head is on the screen at the cut.
    const head = dragonX(cut.local, g) - g.dragon.headLead;
    expect(Math.abs(head)).toBeLessThan(w / 2);
  });

  it("has Tetra already flying her kite, and run off to the left after the cut", () => {
    const cut = cutMoment(g).local;
    const out = { x: 0, y: 0, running: false, speed: 0, arrive: 0, leave: 0 };
    expect(tetraPlace(0, g, cut, out).x).toBeCloseTo(g.tetra.x, 6);
    expect(tetraPlace(0, g, cut, out).running).toBe(false);
    const stand = tetraPlace((T.enterEnd + cut) / 2, g, cut, out);
    expect(stand.x).toBeCloseTo(g.tetra.x, 3);
    expect(stand.running).toBe(false);
    const gone = tetraPlace(cut + T.runTo + 0.01, g, cut, out);
    expect(gone.x).toBeLessThan(-w / 2);
    // She never goes backwards after the cut.
    let last = Infinity;
    for (let l = cut; l < cut + T.runTo + 0.02; l += 0.005) {
      const x = tetraPlace(l, g, cut, out).x;
      expect(x).toBeLessThanOrEqual(last + 1e-9);
      last = x;
    }
  });

  it("has the duo gone off the top of the screen once the page has ridden up past GONE", () => {
    for (const d of g.centre) {
      const bottom = d.y - 0.5 * d.height - 0.45 * d.height + lift(GONE) * h;
      expect(bottom).toBeGreaterThan(h / 2);
    }
  });

  it("keeps the dragon bob small and finite", () => {
    for (let l = 0; l <= 6; l += 0.1) {
      const b = bob(l, g);
      expect(Number.isFinite(b.y + b.pitch + b.roll)).toBe(true);
      expect(Math.abs(b.y - g.dragon.y)).toBeLessThan(0.05 * h);
    }
  });
});

describe("the lift", () => {
  it("is zero until the page has passed the end and grows with the scroll, one screen a screen", () => {
    expect(lift(-0.4)).toBe(0);
    expect(lift(0)).toBe(0);
    expect(lift(0.5)).toBeCloseTo(0.5, 9);
  });

  it("knows when the dragon is on the screen", () => {
    expect(dragonOnScreen(0)).toBe(false);
    expect(dragonOnScreen((T.dragonIn + T.dragonOut) / 2)).toBe(true);
    expect(dragonOnScreen(1)).toBe(false);
  });
});
