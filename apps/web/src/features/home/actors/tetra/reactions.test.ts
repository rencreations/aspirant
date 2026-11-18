import { describe, expect, it } from "vitest";

import { restChannels } from "./channels";
import {
  SHOT_SECONDS,
  applyShot,
  createPresses,
  createShot,
  pressAnswer,
  startShot,
  stepShot,
  type ShotName,
} from "./reactions";

const NAMES: ShotName[] = ["hop", "rise", "startle", "nod"];

describe("her small moves", () => {
  it("each finishes in its time and leaves nothing behind", () => {
    for (const name of NAMES) {
      const s = createShot();
      expect(startShot(s, name)).toBe(true);
      let t = 0;
      while (stepShot(s, 1 / 60)) t += 1 / 60;
      expect(t).toBeGreaterThan(SHOT_SECONDS[name] - 0.05);
      expect(t).toBeLessThan(SHOT_SECONDS[name] + 0.05);
      const c = restChannels();
      applyShot(s, c);
      expect(c.y).toBe(0);
      expect(c.squash).toBe(1);
    }
  });

  it("starts no second move while one plays", () => {
    const s = createShot();
    expect(startShot(s, "hop")).toBe(true);
    expect(startShot(s, "nod")).toBe(false);
    expect(s.name).toBe("hop");
  });

  it("stays finite and never takes her under the ground", () => {
    for (const name of NAMES) {
      const s = createShot();
      startShot(s, name);
      while (s.name) {
        const c = restChannels();
        applyShot(s, c);
        expect(Number.isFinite(c.y + c.squash + c.armL.z + c.head.x)).toBe(true);
        expect(c.y).toBeGreaterThanOrEqual(-1e-9);
        expect(c.squash).toBeGreaterThan(0.8);
        expect(c.squash).toBeLessThan(1.2);
        stepShot(s, 1 / 60);
      }
    }
  });

  it("a hop leaves the ground and comes back", () => {
    const s = createShot();
    startShot(s, "hop");
    let peak = 0;
    while (s.name) {
      const c = restChannels();
      applyShot(s, c);
      peak = Math.max(peak, c.y);
      stepShot(s, 1 / 60);
    }
    expect(peak).toBeGreaterThan(0.05);
  });
});

describe("the answer to a press", () => {
  it("is friendly, then startled, then annoyed when the presses keep coming", () => {
    const p = createPresses();
    expect(pressAnswer(p, 0).face).toBe("happy");
    expect(pressAnswer(p, 0.6).face).toBe("laugh");
    expect(pressAnswer(p, 1.2).face).toBe("surprised");
    expect(pressAnswer(p, 1.8).face).toBe("annoyed");
    expect(pressAnswer(p, 2.4).face).toBe("annoyed");
  });

  it("starts again after a pause", () => {
    const p = createPresses();
    pressAnswer(p, 0);
    pressAnswer(p, 0.5);
    pressAnswer(p, 1);
    expect(pressAnswer(p, 10).face).toBe("happy");
    expect(p.run).toBe(1);
  });
});
