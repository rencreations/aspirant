import { describe, expect, it } from "vitest";

import { OBSIDIA_TIMELINE } from "../obsidia/timeline.generated";
import { SELENA_TIMELINE } from "../selena/timeline.generated";
import { framesUntil } from "./phase";
import type { Timeline } from "./timeline";

const LOOP = { selena: [240, 486], obsidia: [180, 182] } as const;

describe.each([
  ["selena", SELENA_TIMELINE as Timeline],
  ["obsidia", OBSIDIA_TIMELINE as Timeline],
] as const)("timeline data of %s", (name, tl) => {
  it("has idle start phases inside the loop for every page and short", () => {
    const starts = [
      ...Object.values(tl.pages).map((p) => p.in.startPhases),
      ...Object.values(tl.shorts).map((s) => s.startPhases),
    ];
    for (const phases of starts) {
      expect(phases.length).toBeGreaterThan(0);
      for (const p of phases) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(tl.loopFrames);
      }
    }
  });

  it("gives each exit and short a dissolve point inside the video, a panel point before it and a matching idle phase", () => {
    const backs = [
      ...Object.values(tl.pages).map((p) => ({ ...p.out, frames: p.out.frames })),
      ...Object.values(tl.shorts).map((s) => ({ ...s.back, frames: s.frames })),
    ];
    for (const b of backs) {
      expect(b.syncPhase).toBeGreaterThanOrEqual(0);
      expect(b.syncPhase).toBeLessThan(tl.loopFrames);
      // The panel is back before the dissolve starts, and the dissolve fits in the video.
      expect(b.uiFrame).toBeGreaterThan(60);
      expect(b.uiFrame).toBeLessThan(b.syncFrame);
      const dissolveFrames = (b.blendMs / 1000) * tl.fps;
      expect(b.syncFrame + dissolveFrames).toBeLessThan(b.frames);
      expect(b.align).toBeGreaterThan(0.98);
      expect(b.align).toBeLessThan(1.02);
    }
  });

  it("gives each page a loop and an exit that starts inside it", () => {
    for (const page of Object.values(tl.pages)) {
      expect(LOOP[name]).toContain(page.loop.frames);
      expect(page.out.startPhase).toBeGreaterThanOrEqual(0);
      expect(page.out.startPhase).toBeLessThan(page.loop.frames);
      expect(page.in.frames).toBeGreaterThan(120);
      expect(page.in.handFrame).toBeLessThan(page.in.frames);
      expect(page.out.frames).toBeGreaterThan(140);
      expect(page.in.align).toBeGreaterThan(0.98);
      expect(page.in.align).toBeLessThan(1.02);
    }
    for (const short of Object.values(tl.shorts)) expect(short.frames).toBeGreaterThan(280);
  });
});

describe("the idle loops", () => {
  it("has three start phases 162 frames apart for every page and short of Selena", () => {
    const starts = [
      ...Object.values(SELENA_TIMELINE.pages).map((p) => p.in.startPhases),
      ...Object.values(SELENA_TIMELINE.shorts).map((s) => s.startPhases),
    ];
    for (const phases of starts) {
      expect(phases).toHaveLength(3);
      expect(framesUntil(phases[0], phases[1], 486)).toBe(162);
      expect(framesUntil(phases[1], phases[2], 486)).toBe(162);
    }
  });

  it("has one start phase for every page and short of Obsidia (her idle never repeats inside the loop)", () => {
    for (const p of Object.values(OBSIDIA_TIMELINE.pages)) expect(p.in.startPhases).toHaveLength(1);
    for (const s of Object.values(OBSIDIA_TIMELINE.shorts)) expect(s.startPhases).toHaveLength(1);
    expect(OBSIDIA_TIMELINE.loopFrames).toBe(482);
  });
});
