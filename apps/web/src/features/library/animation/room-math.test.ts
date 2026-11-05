import { describe, expect, it } from "vitest";

import type { StageState } from "@/features/character/stage/director";
import { SELENA_TIMELINE } from "@/features/character/selena/timeline.generated";
import { VEXANA_STAGE_TIMELINE } from "@/features/character/vexana/room/timeline.generated";

import {
  accentOf,
  buildButtons,
  buttonForDigit,
  contrast,
  formatSeconds,
  hintFor,
  nowPlaying,
  sceneProgress,
  sceneSeconds,
  stepIndex,
} from "./room-math";
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

const STATE: StageState = {
  mode: "idle",
  scene: null,
  loading: false,
  ui: true,
  next: null,
  leaving: false,
  fast: false,
  wait: null,
};

describe("buildButtons", () => {
  it("gives the digits to everything but the welcome, in order", () => {
    const buttons = buildButtons(CLIPS, SELENA_TIMELINE);
    expect(buttons.map((b) => [b.clip.label, b.key])).toEqual([
      ["Welcome", null],
      ["Idle", 1],
      ["Pose", 2],
      ["Badge", 3],
      ["Arm", 4],
    ]);
  });

  it("lists the files a scene needs", () => {
    const buttons = buildButtons(CLIPS, SELENA_TIMELINE);
    expect(buttons.find((b) => b.clip.label === "Pose")?.files).toEqual([
      "gallery-in.mp4",
      "gallery-loop.mp4",
      "gallery-out.mp4",
    ]);
    expect(buttons.find((b) => b.clip.label === "Badge")?.files).toEqual(["short-2.mp4"]);
    expect(buttons.find((b) => b.clip.kind === "idle")?.files).toEqual([]);
  });

  it("finds a button from a digit", () => {
    const buttons = buildButtons(CLIPS, SELENA_TIMELINE);
    expect(buttonForDigit(buttons, 3)?.clip.label).toBe("Badge");
    expect(buttonForDigit(buttons, 9)).toBeNull();
  });

  it("keeps every button while the timeline is not known", () => {
    expect(buildButtons(CLIPS, null)).toHaveLength(5);
  });
});

describe("stepIndex", () => {
  it("wraps at both ends", () => {
    expect(stepIndex(9, 1, 10)).toBe(0);
    expect(stepIndex(0, -1, 10)).toBe(9);
    expect(stepIndex(3, 1, 10)).toBe(4);
  });
});

describe("sceneProgress", () => {
  it("weights files by size", () => {
    const size = (f: string) => (f === "a" ? 3 : 1);
    expect(sceneProgress(["a", "b"], (f) => (f === "a" ? 1 : 0), size)).toBeCloseTo(0.75);
    expect(sceneProgress([], () => 0, size)).toBe(1);
  });
});

describe("sceneSeconds", () => {
  it("counts a short by its frames and a pose by its three parts", () => {
    const short = SELENA_TIMELINE.shorts["short-1"];
    expect(sceneSeconds(SELENA_TIMELINE, "short-1")).toBeCloseTo(short.frames / 60);
    const page = VEXANA_STAGE_TIMELINE.pages.gallery;
    expect(sceneSeconds(VEXANA_STAGE_TIMELINE, "gallery")).toBeCloseTo(
      (page.in.frames + page.loop.frames + page.out.frames) / 60,
    );
  });
});

describe("formatSeconds", () => {
  it("writes one decimal, and says so when the length is not known", () => {
    expect(formatSeconds(4.25)).toBe("4.3 s");
    expect(formatSeconds(null)).toBe("length not known yet");
  });
});

describe("nowPlaying", () => {
  const buttons = buildButtons(CLIPS, SELENA_TIMELINE);

  it("is empty before the stage begins", () => {
    expect(nowPlaying({ ...STATE, mode: "boot" }, SELENA_TIMELINE, buttons).key).toBeNull();
  });

  it("describes the idle loop as a loop of the timeline's length", () => {
    const now = nowPlaying(STATE, SELENA_TIMELINE, buttons);
    expect(now).toMatchObject({ key: "idle", loop: true });
    expect(now.durMs).toBeCloseTo((SELENA_TIMELINE.loopFrames / SELENA_TIMELINE.fps) * 1000);
  });

  it("follows a short, and the three parts of a pose", () => {
    expect(
      nowPlaying({ ...STATE, mode: "short", scene: "short-2" }, SELENA_TIMELINE, buttons),
    ).toMatchObject({
      key: "short-2",
      label: "Badge",
      loop: false,
    });
    const keys = (["intro", "page", "outro"] as const).map(
      (mode) => nowPlaying({ ...STATE, mode, scene: "gallery" }, SELENA_TIMELINE, buttons).key,
    );
    expect(keys).toEqual(["gallery-in", "gallery-loop", "gallery-out"]);
  });
});

describe("hintFor", () => {
  const base = "Press a button.";
  it("says what is happening", () => {
    expect(
      hintFor({ phase: "preparing", state: STATE, label: null, waitSeconds: null, base }),
    ).toContain("Preparing");
    expect(hintFor({ phase: "ready", state: STATE, label: null, waitSeconds: null, base })).toBe(
      base,
    );
    expect(
      hintFor({
        phase: "ready",
        state: { ...STATE, mode: "queued", scene: "short-1" },
        label: "Face",
        waitSeconds: 2.04,
        base,
      }),
    ).toContain("2.0 s");
  });
});

describe("accentOf", () => {
  it("keeps a primary that reads on its ink, and swaps one that does not", () => {
    const layla = { primary: "#FF7F7A", secondary: "#14B3A6", glow: "#7DF7EC", ink: "#14222B" };
    expect(accentOf(layla)).toBe(layla.primary);
    const ruby = { primary: "#1E2A57", secondary: "#E0388E", glow: "#F2B83B", ink: "#0A0F24" };
    expect(contrast(ruby.primary, ruby.ink)).toBeLessThan(4.5);
    expect(accentOf(ruby)).toBe(ruby.secondary);
  });
});
