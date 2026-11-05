import { describe, expect, it } from "vitest";

import { PAGE_NAMES, SHORT_NAMES } from "@/features/character/stage/timeline";

import { readStageData } from "../bundle";

/** Every `<slug>.generated.ts` that `scripts/library/animation/stage.py` has written. */
const modules = import.meta.glob<unknown>("./*.generated.ts", { eager: true });

describe("the generated stage data of the Animation room", () => {
  const entries = Object.entries(modules).map(([path, mod]) => ({
    slug: path.replace("./", "").replace(".generated.ts", ""),
    data: readStageData(mod),
  }));

  it("has a file for each of the six characters that were built", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  describe.each(entries)("$slug", ({ data }) => {
    it("is read whole (a timeline, the sizes and the byte table)", () => {
      expect(data).not.toBeNull();
    });

    it("has a size and a byte count for every file of every size", () => {
      const { timeline, tiers, bytes } = data!;
      const files = new Set<string>(["welcome.mp4", "idle.mp4"]);
      for (const page of Object.values(timeline.pages)) {
        files.add(page.in.file);
        files.add(page.loop.file);
        files.add(page.out.file);
      }
      for (const short of Object.values(timeline.shorts)) files.add(short.file);
      expect(Object.keys(tiers)).toEqual(expect.arrayContaining(["1080", "1440"]));
      for (const tier of Object.keys(tiers)) {
        for (const file of files) {
          expect(bytes[tier]?.[file], `${tier}/${file}`).toBeGreaterThan(100_000);
        }
        // Nothing is listed that no scene plays.
        expect(Object.keys(bytes[tier]!).sort()).toEqual([...files].sort());
      }
    });

    it("starts every page and short on a phase inside the idle loop, one per cycle", () => {
      const { timeline } = data!;
      const starts = [
        ...PAGE_NAMES.map((p) => timeline.pages[p].in.startPhases),
        ...SHORT_NAMES.map((s) => timeline.shorts[s].startPhases),
      ];
      for (const phases of starts) {
        expect(phases.length).toBeGreaterThan(0);
        const gap = timeline.loopFrames / phases.length;
        phases.forEach((p, i) => {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(timeline.loopFrames);
          if (i > 0) expect(p - phases[i - 1]!).toBe(gap);
        });
      }
    });

    it("gives every exit and short a panel point before its dissolve point, and room to dissolve", () => {
      const { timeline } = data!;
      const backs = [
        ...PAGE_NAMES.map((p) => ({
          ...timeline.pages[p].out,
          frames: timeline.pages[p].out.frames,
        })),
        ...SHORT_NAMES.map((s) => ({
          ...timeline.shorts[s].back,
          frames: timeline.shorts[s].frames,
        })),
      ];
      for (const b of backs) {
        expect(b.syncPhase).toBeGreaterThanOrEqual(0);
        expect(b.syncPhase).toBeLessThan(timeline.loopFrames);
        // The panel is back at least a third of a second into the clip (an exit can be quick).
        expect(b.uiFrame).toBeGreaterThan(20);
        expect(b.uiFrame).toBeLessThan(b.syncFrame);
        expect(b.syncFrame + (b.blendMs / 1000) * timeline.fps).toBeLessThan(b.frames);
        expect(b.align).toBeGreaterThan(0.98);
        expect(b.align).toBeLessThan(1.02);
      }
    });

    it("gives the pose a loop, an entrance that reaches it and an exit that starts inside it", () => {
      const { timeline } = data!;
      for (const page of Object.values(timeline.pages)) {
        expect(page.loop.frames).toBeGreaterThanOrEqual(300);
        expect(page.out.startPhase).toBeGreaterThanOrEqual(0);
        expect(page.out.startPhase).toBeLessThan(page.loop.frames);
        expect(page.in.loopOffset).toBeGreaterThanOrEqual(0);
        expect(page.in.loopOffset).toBeLessThan(page.loop.frames);
        expect(page.in.handFrame).toBeLessThan(page.in.frames);
        expect(page.in.handFrame).toBeGreaterThan(0);
      }
    });

    it("makes the idle loop at least five seconds, and never waits long for a frame", () => {
      const { timeline } = data!;
      expect(timeline.loopFrames).toBeGreaterThanOrEqual(300);
      for (const page of Object.values(timeline.pages)) {
        expect(page.in.maxWait).toBeLessThanOrEqual(30);
        expect(page.out.maxWait).toBeLessThanOrEqual(30);
      }
      for (const short of Object.values(timeline.shorts))
        expect(short.maxWait).toBeLessThanOrEqual(30);
    });
  });
});
