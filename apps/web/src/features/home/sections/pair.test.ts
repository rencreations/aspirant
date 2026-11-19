import { describe, expect, it } from "vitest";

import { floorOf, localOf, type Placed } from "../kernel/layout";
import { PlayMachine, hystOf } from "../kernel/plays";
import { homeLayout } from "../kernel/where";

/**
 * Two sections can share one scene when the last play of the earlier one and the first play of the
 * later one fire at the same scroll, run the same time on the same curve and come back at the same
 * scroll (hero with aspirants, rows with strip). This holds the arithmetic: a drift of either side
 * would break the scene (the words arriving while the cards do not).
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  // Round three: the hero is a scroll zone and the aspirants' words are a trigger of their own, so
  // the two no longer run one play in step (kernel-scrub.md).
  ["rows", "strip"],
];

const placedOf = (id: string): Placed => homeLayout().placed.find((p) => p.id === id)!;

/** The scroll (screens) at which a play fires going down, and at which it comes back going up. */
function thresholds(p: Placed, playIndex: number): { down: number; up: number } {
  const plays = p.def.plays!;
  const play = plays[playIndex]!;
  const hyst = hystOf(p.def.screens);
  const room = Math.max(0, play.at - floorOf(p)) / 2;
  const down = p.start + play.at * p.def.screens;
  const up = p.start + (play.at - Math.min(hyst, room)) * p.def.screens;
  return { down, up };
}

describe("two sections that share a scene run their plays in step", () => {
  for (const [a, b] of PAIRS) {
    describe(`${a} and ${b}`, () => {
      const first = placedOf(a);
      const second = placedOf(b);
      const last = first.def.plays!.length - 1;

      it("meet at one joint", () => {
        expect(first.end).toBeCloseTo(second.start, 9);
      });

      it("fire at the same scroll going down and come back at the same scroll going up", () => {
        const x = thresholds(first, last);
        const y = thresholds(second, 0);
        expect(x.down).toBeCloseTo(y.down, 9);
        expect(x.up).toBeCloseTo(y.up, 9);
      });

      it("run the same seconds, curve and backward share", () => {
        const x = first.def.plays![last]!;
        const y = second.def.plays![0]!;
        expect(x.seconds).toBe(y.seconds);
        expect(x.ease ?? "inOut").toBe(y.ease ?? "inOut");
        expect(x.back ?? 0.7).toBe(y.back ?? 0.7);
        expect(x.ease).toBe("linear");
      });

      it("are both running where the play fires and while it holds the page", () => {
        const x = thresholds(first, last);
        // The later section is in range (lead) before the joint, the earlier one (tail) after it,
        // with room for the scene's smoothing (0.2 screens) and for a flick past the threshold.
        expect(second.from).toBeLessThanOrEqual(x.up - 0.01);
        expect(first.to).toBeGreaterThanOrEqual(x.down + 0.15);
      });

      it("hold in step: a run down, a rest, a run up, and a flick, with the same progress", () => {
        const m1 = new PlayMachine(first.id, first.def.plays!, {
          screens: first.def.screens,
          floor: floorOf(first),
        });
        const m2 = new PlayMachine(second.id, second.def.plays!, {
          screens: second.def.screens,
          floor: floorOf(second),
        });
        const joint = first.end;
        let raw = joint - 0.5;
        let now = 0;
        const step = (dt: number): void => {
          now += dt * 1000;
          m1.step(localOf(first, raw), localOf(first, raw), dt, now);
          m2.step(localOf(second, raw), localOf(second, raw), dt, now);
          expect(m2.active, `raw ${raw.toFixed(3)}`).toBe(m1.active);
          expect(m2.direction).toBe(m1.direction);
          expect(m2.progress).toBeCloseTo(m1.progress, 9);
        };
        m1.jump(localOf(first, raw));
        m2.jump(localOf(second, raw));
        // Walk down to the joint and a little past it, as a wheel would.
        for (; raw < joint + 0.05; raw += 0.02) step(1 / 60);
        expect(m1.active).toBe(true);
        expect(m2.active).toBe(true);
        // The page is held: the scroll does not move while it runs.
        for (let i = 0; i < 400; i++) step(1 / 60);
        expect(m1.active).toBe(false);
        expect(m2.active).toBe(false);
        expect(m1.fired).toBe(first.def.plays!.length);
        expect(m2.fired).toBeGreaterThanOrEqual(1);
        // Back up across the threshold.
        const up = thresholds(first, last).up;
        for (; raw > up - 0.02; raw -= 0.02) step(1 / 60);
        for (let i = 0; i < 400; i++) step(1 / 60);
        expect(m1.fired).toBe(first.def.plays!.length - 1);
        expect(m2.fired).toBe(0);
      });
    });
  }
});
