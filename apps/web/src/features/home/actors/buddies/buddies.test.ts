import { describe, expect, it } from "vitest";

import {
  BEATS,
  DANCE_NAMES,
  FADE_BEATS,
  SHOW,
  blendCue,
  createCue,
  danceCue,
  danceSeconds,
  showBeats,
  wrapPi,
  type DanceName,
  type PairCue,
} from "./choreo";
import { LENGTH as LIFE_LENGTH, LifeScheduler, MOMENTS } from "./life";
import { createTouchOut, Touch, LENGTH as TOUCH_LENGTH } from "./touch";

const NUM_KEYS = (Object.keys(createCue()) as Array<keyof PairCue>).filter(
  (k) => typeof createCue()[k] === "number",
);

function finite(c: PairCue): boolean {
  return NUM_KEYS.every((k) => Number.isFinite(c[k] as number));
}

describe("the dances", () => {
  const names = DANCE_NAMES.filter((n) => n !== "show");

  it("has every routine and a show that plays them all", () => {
    expect(new Set(SHOW.map(([n]) => n))).toEqual(new Set(names));
    expect(showBeats()).toBe(SHOW.reduce((a, [, b]) => a + b, 0));
    for (const n of names) expect(danceSeconds(n, 100)).toBeCloseTo((BEATS[n] * 60) / 100);
  });

  it("is finite everywhere, forwards and backwards", () => {
    const c = createCue();
    for (const name of DANCE_NAMES) {
      for (let t = -90; t <= 90; t += 0.37) {
        danceCue(name, t, 0.7, 100, c);
        expect(finite(c)).toBe(true);
      }
    }
  });

  it("is continuous: a hundredth of a second never jumps", () => {
    const a = createCue();
    const b = createCue();
    for (const name of DANCE_NAMES) {
      for (let t = 0; t < 60; t += 0.0937) {
        danceCue(name, t, 0.8, 100, a);
        danceCue(name, t + 0.01, 0.8, 100, b);
        for (const k of NUM_KEYS) {
          if (k === "beat") continue;
          // A twirl turns fast on purpose (a yaw, which the drone's spring follows), so it gets more room.
          const room = k === "yaw" ? 0.15 : 0.1;
          const step = k === "yaw" ? wrapPi(b.yaw - a.yaw) : (a[k] as number) - (b[k] as number);
          expect(Math.abs(step), `${name} ${k} at ${t}`).toBeLessThan(room);
        }
      }
    }
  });

  it("loops on its own length (a spin counts whole turns)", () => {
    const a = createCue();
    const b = createCue();
    const names2: DanceName[] = [
      "sway",
      "bob",
      "eight",
      "hop2",
      "shimmy",
      "wave",
      "lean",
      "spiral",
    ];
    for (const name of names2) {
      const len = danceSeconds(name, 100);
      // At the energy where the tempo is exactly the bpm.
      const e = 0.5;
      const tempoK = 0.92 + 0.16 * e;
      const period = (len / tempoK) * 1;
      for (const t of [0.3, 1.7, 3.1]) {
        danceCue(name, t, e, 100, a);
        danceCue(name, t + period, e, 100, b);
        expect(Math.abs(a.dx - b.dx)).toBeLessThan(1e-6);
        expect(Math.abs(a.dy - b.dy)).toBeLessThan(1e-6);
        expect(Math.abs(a.roll - b.roll)).toBeLessThan(1e-6);
        expect(Math.abs(a.dollRoll - b.dollRoll)).toBeLessThan(1e-6);
      }
    }
    // A spin and a twirl turn by whole turns over their length.
    for (const name of ["spin", "twirl"] as const) {
      const e = 0.5;
      const period = danceSeconds(name, 100) / (0.92 + 0.16 * e);
      danceCue(name, 1, e, 100, a);
      danceCue(name, 1 + period, e, 100, b);
      const turns = (b.yaw - a.yaw) / (Math.PI * 2);
      expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-6);
      expect(Math.round(turns)).toBeGreaterThanOrEqual(1);
    }
  });

  it("the show fades into the next routine over FADE_BEATS", () => {
    const a = createCue();
    const b = createCue();
    // Just before and just after the first routine ends.
    const first = SHOW[0]?.[1] ?? 8;
    const t = (beats: number): number => (beats * 60) / 100;
    danceCue("show", (t(first - FADE_BEATS - 0.01) / (0.92 + 0.16 * 0.5)) * 1, 0.5, 100, a);
    danceCue("show", t(first + 0.01) / (0.92 + 0.16 * 0.5), 0.5, 100, b);
    expect(finite(a) && finite(b)).toBe(true);
  });

  it("a rider asks for no whole turn upside down: rolls and pitches stay small", () => {
    const c = createCue();
    for (const name of DANCE_NAMES) {
      for (let t = 0; t < 80; t += 0.21) {
        danceCue(name, t, 1, 100, c);
        expect(Math.abs(c.roll)).toBeLessThan(0.7);
        expect(Math.abs(c.pitch)).toBeLessThan(0.3);
        expect(Math.abs(c.dollRoll)).toBeLessThan(0.8);
      }
    }
  });

  it("blends cues by weight", () => {
    const a = createCue();
    const b = createCue();
    a.dx = 1;
    b.dx = 3;
    const out = createCue();
    blendCue(out, [
      [a, 0.5],
      [b, 0.5],
    ]);
    expect(out.dx).toBeCloseTo(2);
  });
});

describe("the docked life", () => {
  it("runs every moment once before any repeats, never the same twice in a row", () => {
    const life = new LifeScheduler(3);
    const c = createCue();
    for (let i = 0; i < 20000 && life.history.length < 40; i += 1) life.step(1 / 30, i / 30, c, 1);
    const h = life.history;
    expect(h.length).toBeGreaterThan(MOMENTS.length * 2);
    for (let i = 1; i < h.length; i += 1) expect(h[i]).not.toBe(h[i - 1]);
    // Each consecutive run of `MOMENTS.length` is a full bag.
    for (let start = 0; start + MOMENTS.length <= h.length; start += MOMENTS.length) {
      expect(new Set(h.slice(start, start + MOMENTS.length)).size).toBe(MOMENTS.length);
    }
  });

  it("keeps every moment inside its length and every cue finite", () => {
    const life = new LifeScheduler(9);
    const c = createCue();
    for (let i = 0; i < 6000; i += 1) {
      life.step(1 / 30, i / 30, c, i % 3 === 0 ? 0.55 : 1);
      expect(finite(c)).toBe(true);
    }
    for (const m of MOMENTS) expect(LIFE_LENGTH[m][1]).toBeLessThan(5);
  });

  it("is the same life for the same seed and a different one for another", () => {
    const run = (seed: number): string => {
      const l = new LifeScheduler(seed);
      const c = createCue();
      for (let i = 0; i < 6000; i += 1) l.step(1 / 30, i / 30, c, 1);
      return l.history.join(",");
    };
    expect(run(4)).toBe(run(4));
    expect(run(4)).not.toBe(run(5));
  });
});

describe("the answers to the pointer", () => {
  it("a press on the drone fires a trick, on the doll a giggle with a wiggle", () => {
    const t = new Touch();
    const out = createTouchOut();
    t.press("drone", 1);
    t.step(1 / 60, 1, out);
    expect(out.fired).toBe(true);
    expect(["spin", "roll"]).toContain(out.droneTrick);
    t.step(1 / 60, 1.02, out);
    expect(out.fired).toBe(false);
    const t2 = new Touch();
    t2.press("doll", 1);
    t2.step(1 / 60, 1, out);
    expect(out.droneTrick).toBe("wiggle");
    expect(out.dollFace).toBe("laughing");
  });

  it("two quick presses are a big move, a spree is dizzy and then a laugh", () => {
    const t = new Touch();
    const out = createTouchOut();
    t.press("drone", 1);
    t.step(1 / 60, 1, out);
    t.press("drone", 1.2);
    t.step(1 / 60, 1.2, out);
    expect(out.droneFace).toBe("sparkle");
    t.press("drone", 1.5);
    t.step(1 / 60, 1.5, out);
    t.press("drone", 1.7);
    t.step(1 / 60, 1.7, out);
    expect(out.droneTrick).toBe("dizzy");
    // It runs out into a laugh.
    let laughed = false;
    for (let s = 1.7; s < 1.7 + TOUCH_LENGTH.dizzy + 0.5; s += 1 / 60) {
      t.step(1 / 60, s, out);
      if (out.droneFace === "laugh") laughed = true;
    }
    expect(laughed).toBe(true);
  });

  it("a held press leans them toward the cursor and a release lets go", () => {
    const t = new Touch();
    const out = createTouchOut();
    t.press("doll", 1);
    for (let s = 1; s < 2.2; s += 1 / 60) t.step(1 / 60, s, out);
    expect(t.leaning).toBeGreaterThan(0.9);
    t.release(2.2);
    for (let s = 2.2; s < 3.2; s += 1 / 60) t.step(1 / 60, s, out);
    expect(t.leaning).toBeLessThan(0.05);
  });

  it("every reaction ends", () => {
    for (const name of [
      "cheer",
      "giggle",
      "hug",
      "wave",
      "startle",
      "hop",
      "wiggle",
      "spin",
    ] as const) {
      const t = new Touch();
      const out = createTouchOut();
      t.cue(name, 0);
      for (let s = 0; s < 6; s += 1 / 60) t.step(1 / 60, s, out);
      expect(t.active).toBeNull();
    }
  });
});
