import { describe, expect, it } from "vitest";

import {
  BEND_SCREENS,
  DRONE_CARD,
  FROM_CHASE,
  REST,
  STAGE,
  STANCES,
  T,
  artNeeded,
  beatAt,
  fanNeeded,
  newBeat,
  ramp,
  smoother,
  waveAt,
  waveStart,
} from "./beats";

const at = (s: number) => beatAt(s / BEND_SCREENS, newBeat());

describe("the times", () => {
  it("run in the order of the story", () => {
    const order = [
      T.closeFrom,
      T.standAt,
      T.bendFrom,
      T.bendFrom + 4 * T.wave,
      T.holdFrom,
      T.gatherFrom,
      T.gatherTo,
      T.ringTo,
      T.outTo,
      T.spiralTo,
      T.advTo,
      T.glideTo,
      T.popTo,
      T.patTo,
      T.hugTo,
      T.goTo,
    ];
    for (let i = 1; i < order.length; i += 1) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
  });

  it("end the four stances before the wall holds, and the section at its length", () => {
    expect(T.bendFrom + 4 * T.wave).toBeLessThanOrEqual(T.holdFrom);
    expect(T.goTo).toBe(BEND_SCREENS);
    expect(T.holdTo).toBe(T.gatherFrom);
    expect(T.ringTo).toBe(T.outFrom);
  });

  it("let the spiral advance end before the drone's picture glides, and the pop follow the glide", () => {
    expect(T.advTo).toBeLessThanOrEqual(T.glideFrom + 1e-9);
    expect(T.glideTo).toBeLessThanOrEqual(T.popFrom);
    expect(T.popFrom).toBeLessThanOrEqual(T.meetFrom);
  });
});

describe("Tetra", () => {
  it("opens reading, closes the book, then stands", () => {
    expect(at(0).pose).toBe("read");
    expect(at(T.closeFrom + 0.05).pose).toBe("close");
    expect(at(T.standAt + 0.05).pose).toBe("stand");
  });

  it("bends the four stances in order, each aimed to the other side", () => {
    for (let w = 0; w < 4; w += 1) {
      const s = waveStart(w) + T.wave * 0.5;
      const b = at(s);
      expect(b.pose).toBe("bend");
      expect(b.bend).toBe(STANCES[w]!.kind);
      expect(b.aim).toBe(STANCES[w]!.aim);
      expect(b.wave).toBe(w);
      expect(waveAt(s)).toBe(w);
      expect(b.blend).toBeCloseTo(1, 5);
    }
    expect(STANCES.map((x) => x.kind)).toEqual(["earth", "air", "water", "fire"]);
  });

  it("dips toward the stand between two stances, so the change is a breath and not a pop", () => {
    for (let w = 1; w < 4; w += 1) {
      const edge = waveStart(w);
      const before = at(edge - 0.01).blend;
      const after = at(edge + 0.01).blend;
      expect(before).toBeLessThan(0.4);
      expect(after).toBeLessThan(0.4);
      expect(at(edge + 0.2).blend).toBeCloseTo(1, 5);
    }
  });

  it("never changes the stance while it is worn strongly", () => {
    // Walk the whole section: where the stance (kind or aim) changes, the blend must be low.
    let prev = at(0);
    for (let s = 0.001; s <= BEND_SCREENS; s += 0.002) {
      const b = at(s);
      if (
        b.pose === "bend" &&
        prev.pose === "bend" &&
        (b.bend !== prev.bend || b.aim !== prev.aim)
      ) {
        expect(Math.min(b.blend, prev.blend)).toBeLessThan(0.45);
      }
      prev = b;
    }
  });

  it("pats and hugs one after the other, then runs to the rest", () => {
    expect(at((T.flyTo + T.patTo) / 2).pose).toBe("pat");
    expect(at((T.patTo + T.hugTo) / 2).pose).toBe("hug");
    expect(at((T.hugTo + T.goTo) / 2).pose).toBe("run");
    expect(at(BEND_SCREENS).pose).toBe("idle");
  });

  it("walks from the chase's frame to the stage, and from the stage to the rest", () => {
    expect(at(0).spot).toEqual(FROM_CHASE);
    expect(at(T.moveTo + 0.01).spot.th).toBeCloseTo(STAGE.th, 3);
    expect(at(T.holdFrom).spot).toEqual(STAGE);
    expect(at(T.hugTo).spot).toEqual(STAGE);
    expect(at(BEND_SCREENS).spot.tx).toBeCloseTo(REST.tx, 6);
    expect(at(BEND_SCREENS).spot.ty).toBeCloseTo(REST.ty, 6);
    expect(at(BEND_SCREENS).spot.th).toBeCloseTo(REST.th, 6);
  });

  it("moves smoothly: no step of her place between two close samples is large", () => {
    let prev = at(0).spot;
    for (let s = 0.005; s <= BEND_SCREENS; s += 0.005) {
      const sp = at(s).spot;
      expect(Math.abs(sp.tx - prev.tx)).toBeLessThan(0.02);
      expect(Math.abs(sp.ty - prev.ty)).toBeLessThan(0.02);
      expect(Math.abs(sp.th - prev.th)).toBeLessThan(0.02);
      prev = sp;
    }
  });
});

describe("the joints", () => {
  it("holds the first state before the section starts (the lead)", () => {
    const a = beatAt(-0.05, newBeat());
    const b = at(0);
    expect(a.pose).toBe(b.pose);
    expect(a.spot).toEqual(b.spot);
    expect(a.adv).toBe(b.adv);
    expect(a.pop).toBe(0);
  });

  it("holds the last state after the section ends (the tail)", () => {
    const end = beatAt(1, newBeat());
    const tail = beatAt(1.06, newBeat());
    expect(tail.pose).toBe(end.pose);
    expect(tail.spot).toEqual(end.spot);
    expect(tail.pop).toBe(1);
    expect(tail.meet).toBe(1);
    expect(tail.adv).toBe(DRONE_CARD);
    expect(tail.fanTitle).toBe(0);
    expect(tail.artTitle).toBe(0);
  });

  it("is a function of the scroll only: the same local gives the same state, whatever came before", () => {
    const forward = newBeat();
    const jump = newBeat();
    for (let s = 0; s <= 6; s += 0.1) beatAt(s / BEND_SCREENS, forward);
    beatAt(6 / BEND_SCREENS, forward);
    beatAt(6 / BEND_SCREENS, jump);
    expect(forward).toEqual(jump);
  });
});

describe("the pictures and the words", () => {
  it("advances the spiral from 0 to the drone's card, and no further", () => {
    expect(at(T.advFrom - 0.1).adv).toBe(0);
    expect(at(T.advTo).adv).toBeCloseTo(DRONE_CARD, 6);
    expect(at(T.advTo + 2).adv).toBeCloseTo(DRONE_CARD, 6);
    let prev = 0;
    for (let s = T.advFrom; s <= T.advTo; s += 0.01) {
      const a = at(s).adv;
      expect(a).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = a;
    }
  });

  it("glides, pops and meets in order", () => {
    expect(at(T.glideFrom - 0.01).glide).toBe(0);
    expect(at(T.glideTo).glide).toBeCloseTo(1, 6);
    expect(at(T.popFrom - 0.01).pop).toBe(0);
    expect(at(T.popTo).pop).toBe(1);
    expect(at(T.meetFrom - 0.01).meet).toBe(0);
    expect(at(T.goTo).meet).toBe(1);
  });

  it("shows the fan words while the wall stands, the artwork words while the spiral turns, never both", () => {
    expect(at(T.fanTitleIn - 0.01).fanTitle).toBe(0);
    expect(at((T.holdFrom + T.holdTo) / 2).fanTitle).toBe(1);
    expect(at(T.fanTitleOut + 0.4).fanTitle).toBe(0);
    expect(at((T.artTitleIn + T.artTitleOut) / 2).artTitle).toBe(1);
    for (let s = 0; s <= BEND_SCREENS; s += 0.02) {
      const b = at(s);
      expect(b.fanTitle * b.artTitle).toBe(0);
    }
  });

  it("keeps the textures of a group only while it is used", () => {
    expect(fanNeeded(0)).toBe(true);
    expect(fanNeeded(T.outTo + 1)).toBe(false);
    // Both groups are asked for when the section is built (the constructor passes -2).
    expect(artNeeded(-2)).toBe(true);
    expect(artNeeded(T.spiralFrom)).toBe(true);
    expect(artNeeded(BEND_SCREENS)).toBe(true);
    // Never first asked for in the busy wall.
    expect(artNeeded(T.standAt)).toBe(true);
    expect(artNeeded(T.holdFrom)).toBe(true);
    // The two overlap in time, so the ring's exit and the spiral's entrance are both covered.
    expect(fanNeeded(T.spiralFrom) && artNeeded(T.spiralFrom)).toBe(true);
  });
});

describe("ramps", () => {
  it("are clamped and smooth", () => {
    expect(ramp(-1, 0, 1)).toBe(0);
    expect(ramp(2, 0, 1)).toBe(1);
    expect(smoother(0)).toBe(0);
    expect(smoother(1)).toBe(1);
    expect(smoother(0.5)).toBeCloseTo(0.5, 6);
  });
});
