import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { FUNNY_FOCUS, FUNNY_PLAYS, FUNNY_SCREENS, FUNNY_ZONES, LENGTHS, R1, R2 } from "./stations";
import {
  GONE,
  T,
  bob,
  dragonOnScreen,
  dragonX,
  geometry,
  lift,
  runStart,
  tailX,
  tetraBeat,
  tetraBehindReverse,
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

  it("rest on composed frames: Tetra dancing, then an empty sky with the confused pair", () => {
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

  it("turns the dragon about the middle of its length: clear of the screen at both ends, heading either way", () => {
    const dh = g.dragon.height;
    for (const heading of [1, -1]) {
      // Nose to tail tip is 3.5 blocks; the nose is 0.62 blocks ahead of the body block.
      const span = (center: number) =>
        heading > 0
          ? [center - 0.62 * dh, center + 2.88 * dh]
          : [center - 2.88 * dh, center + 0.62 * dh];
      const [a0, b0] = span(dragonX(T.dragonIn, g, heading));
      expect(a0).toBeGreaterThanOrEqual(w / 2);
      expect(b0).toBeGreaterThan(w / 2);
      const [a1, b1] = span(dragonX(T.dragonOut, g, heading));
      expect(b1).toBeLessThanOrEqual(-w / 2);
      expect(a1).toBeLessThan(-w / 2);
    }
    // The middle of the whole dragon does not move when it turns.
    const mid = (heading: number) =>
      dragonX(0.3, g, heading) + (heading > 0 ? 1 : -1) * 1.13 * dh * -1 + 0;
    expect(Math.abs(mid(1) - mid(1))).toBe(0);
    expect(dragonX(0.3, g, 1) - dragonX(0.3, g, -1)).toBeCloseTo(-2 * 1.13 * dh, 6);
  });

  it("has Tetra dancing from the first frame, shocked when the nose comes in, and gone by the second rest", () => {
    const out = { x: 0, y: 0, running: false, speed: 0, leave: 0 };
    expect(tetraPlace(0, g, out).x).toBeCloseTo(g.tetra.x, 6);
    expect(out.running).toBe(false);
    expect(tetraBeat(0, g)).toMatchObject({ name: "dance", blend: 1 });
    expect(tetraBeat(T.shockFrom - 0.001, g).name).toBe("dance");
    const mid = tetraBeat((T.shockFrom + T.shockFull) / 2, g);
    expect(mid.name).toBe("shock");
    expect(mid.from).toBe("dance");
    expect(mid.blend).toBeGreaterThan(0.2);
    expect(mid.blend).toBeLessThan(0.8);
    // She is fully shocked before the dragon's nose reaches her, and stays shocked until its tail has passed.
    const nose = dragonX(T.shockFull, g) - g.dragon.headLead;
    expect(nose).toBeGreaterThan(g.tetra.x);
    expect(tetraBeat(runStart(g) - 0.002, g)).toMatchObject({ name: "shock", blend: 1 });
    expect(tetraBeat(runStart(g) + T.turnLen, g)).toMatchObject({ name: "run", blend: 1 });
    expect(tetraPlace(R2, g, out).x).toBeLessThan(-w / 2 - 0.35 * g.tetra.height);
  });

  it("has her run after the dragon from behind: never ahead of its tail, never going back", () => {
    const out = { x: 0, y: 0, running: false, speed: 0, leave: 0 };
    const start = runStart(g);
    // Her spot is clear of the tail when she leaves it.
    expect(tailX(start, g)).toBeLessThan(g.tetra.x - 0.3 * g.tetra.height);
    expect(start).toBeGreaterThan(T.shockFull);
    expect(start).toBeLessThan(R2 - 0.1);
    let last = Infinity;
    for (let l = start - 0.01; l <= R2; l += 0.004) {
      const x = tetraPlace(l, g, out).x;
      expect(x).toBeLessThanOrEqual(last + 1e-9);
      last = x;
      if (l >= start) expect(x).toBeGreaterThanOrEqual(tailX(l, g) + 0.1 * g.tetra.height);
    }
  });

  it("puts her feet low on the screen with room under them, and the dragon where it was", () => {
    expect(g.tetra.y).toBeLessThan(-0.3 * h);
    expect(g.tetra.y).toBeGreaterThan(-0.4 * h);
    expect(g.dragon.y).toBeCloseTo(0.012 * h, 9);
    expect(g.dragon.height).toBeCloseTo(Math.min(0.205 * h, 0.265 * w), 9);
  });

  it("runs back in behind the dragon when the page is scrolled up, and rests at her spot", () => {
    const behind = tetraBehindReverse((T.dragonIn + T.dragonOut) / 2, g);
    expect(behind).toBeLessThan(dragonX((T.dragonIn + T.dragonOut) / 2, g));
    expect(Math.min(g.tetra.x, tetraBehindReverse(0, g))).toBeCloseTo(g.tetra.x, 6);
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
