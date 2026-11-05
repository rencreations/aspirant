import { describe, expect, it } from "vitest";

import * as selena from "@/features/character/selena/timeline.generated";

import { hasMaxWait, readStageData, sceneFiles } from "./bundle";

describe("readStageData", () => {
  it("tells the timeline, the sizes and the byte table apart whatever their names", () => {
    const data = readStageData({ ...selena, SOMETHING_ELSE: 4 });
    expect(data).not.toBeNull();
    expect(data?.timeline.loopFrames).toBe(selena.SELENA_TIMELINE.loopFrames);
    expect(Object.keys(data?.tiers ?? {})).toContain("1080");
    expect(data?.bytes["1080"]?.["idle.mp4"]).toBeGreaterThan(0);
  });

  it("gives null when a part is missing", () => {
    expect(readStageData({ SELENA_TIMELINE: selena.SELENA_TIMELINE })).toBeNull();
    expect(readStageData(null)).toBeNull();
    expect(readStageData({})).toBeNull();
  });
});

describe("sceneFiles", () => {
  it("lists a pose once per file and a short as its one file", () => {
    expect(sceneFiles(selena.SELENA_TIMELINE, "about")).toEqual([
      "about-in.mp4",
      "about-loop.mp4",
      "about-out.mp4",
    ]);
    expect(sceneFiles(selena.SELENA_TIMELINE, "short-3")).toEqual(["short-3.mp4"]);
    expect(sceneFiles(selena.SELENA_TIMELINE, "nothing")).toEqual([]);
  });
});

describe("hasMaxWait", () => {
  it("is false for a timeline that waits for its frame", () => {
    expect(hasMaxWait(selena.SELENA_TIMELINE)).toBe(false);
  });
});
