import { describe, expect, it } from "vitest";

import { SELENA_TIMELINE } from "@/features/character/selena/timeline.generated";

import { fieldColors, mixHex } from "./colors";
import { contourPaths } from "./contours";
import { describeClips, pairOf } from "./copy";
import { contrast, optionButtons, sceneProgress } from "./room-math";
import type { AnimClip } from "./types";

function clip(partial: Partial<AnimClip> & Pick<AnimClip, "kind" | "label" | "order">): AnimClip {
  return {
    id: `animation-x-${partial.label.toLowerCase()}`,
    title: partial.label,
    collection: "animation",
    chars: ["selena"],
    pair: "selena-obsidia",
    canon: "official",
    tags: [],
    scene: null,
    line: "",
    dur: 1,
    src: "",
    ...partial,
  };
}

const CLIPS: AnimClip[] = [
  clip({ kind: "welcome", label: "Welcome", order: 0 }),
  clip({ kind: "idle", label: "Idle", order: 1 }),
  clip({ kind: "pose", label: "Pose", order: 2, scene: "gallery" }),
  clip({ kind: "short", label: "Badge", order: 3, scene: "short-2" }),
  clip({ kind: "short", label: "Arm", order: 4, scene: "short-3" }),
];

describe("optionButtons", () => {
  it("gives the digits in order and leaves the idle loop out", () => {
    const buttons = optionButtons(CLIPS, SELENA_TIMELINE);
    expect(buttons.map((b) => [b.clip.label, b.key])).toEqual([
      ["Welcome", 1],
      ["Pose", 2],
      ["Badge", 3],
      ["Arm", 4],
    ]);
  });

  it("lists the files a scene needs", () => {
    const buttons = optionButtons(CLIPS, SELENA_TIMELINE);
    expect(buttons.find((b) => b.clip.label === "Pose")?.files).toEqual([
      "gallery-in.mp4",
      "gallery-loop.mp4",
      "gallery-out.mp4",
    ]);
    expect(buttons.find((b) => b.clip.label === "Badge")?.files).toEqual(["short-2.mp4"]);
    expect(buttons.find((b) => b.clip.kind === "welcome")?.files).toEqual([]);
  });

  it("keeps every button while the timeline is not known", () => {
    expect(optionButtons(CLIPS, null)).toHaveLength(4);
  });
});

describe("sceneProgress", () => {
  it("weights files by size", () => {
    const size = (f: string) => (f === "a" ? 3 : 1);
    expect(sceneProgress(["a", "b"], (f) => (f === "a" ? 1 : 0), size)).toBeCloseTo(0.75);
    expect(sceneProgress([], () => 0, size)).toBe(1);
  });
});

describe("colours", () => {
  it("mixes two colours", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#ff0000");
  });

  it("gives every field a colour white type reads on", () => {
    const palettes = [
      { primary: "#A6DCFF", secondary: "#C7D0DD", glow: "#8B5CF6", ink: "#0D1424" },
      { primary: "#FF7F7A", secondary: "#14B3A6", glow: "#7DF7EC", ink: "#14222B" },
      { primary: "#1E2A57", secondary: "#E0388E", glow: "#F2B83B", ink: "#0A0F24" },
      { primary: "#F6B98A", secondary: "#E1322E", glow: "#2ED3C5", ink: "#24110E" },
    ];
    for (const p of palettes) {
      const { main, deep } = fieldColors(p);
      expect(contrast(main, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(deep, "#ffffff")).toBeGreaterThan(contrast(main, "#ffffff"));
      // Her own colour, not a grey: the field keeps the hue of her primary.
      expect(main).not.toBe(p.ink.toLowerCase());
    }
  });
});

describe("copy", () => {
  it("names the pair, the character first", () => {
    expect(pairOf("obsidia")).toEqual(["obsidia", "selena"]);
    expect(pairOf("layla")).toEqual(["layla", "fanny"]);
  });

  it("says what a character's animation holds, in words", () => {
    expect(describeClips(CLIPS)).toBe("A welcome, an idle loop, a close pose and two clips.");
    expect(describeClips(CLIPS.slice(0, 2))).toBe("A welcome and an idle loop.");
  });
});

describe("contourPaths", () => {
  it("draws closed lines from the panel out past the corners of the screen", () => {
    const paths = contourPaths({ cx: 720, cy: 420, hw: 440, hh: 280 }, { w: 1440, h: 900 }, 50);
    expect(paths.length).toBeGreaterThan(8);
    expect(paths.every((d) => d.startsWith("M") && d.endsWith("Z"))).toBe(true);
  });
});
