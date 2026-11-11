import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { StageState } from "@/features/character/stage/director";
import { GUINEVERE_STAGE_TIMELINE } from "@/features/character/guinevere/room/timeline.generated";
import { OBSIDIA_TIMELINE } from "@/features/character/obsidia/timeline.generated";
import { SELENA_TIMELINE } from "@/features/character/selena/timeline.generated";
import type { Timeline } from "@/features/character/stage/timeline";
import { VEXANA_STAGE_TIMELINE } from "@/features/character/vexana/room/timeline.generated";

import { readStageData } from "./bundle";
import { ORDER } from "./characters";
import {
  fullPhase,
  optionViews,
  roleOf,
  waitOf,
  type FullPhase,
  type PhaseInput,
} from "./full-state";
import { optionButtons } from "./room-math";
import type { AnimationFile } from "./types";

const DATA = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/data/library/animation.json"), "utf8"),
) as AnimationFile;

/** The timeline of each of the ten, as the room loads it: the site's own four and the six built for it. */
function timelines(): Record<string, Timeline> {
  const out: Record<string, Timeline> = {
    selena: SELENA_TIMELINE,
    obsidia: OBSIDIA_TIMELINE,
    vexana: VEXANA_STAGE_TIMELINE,
    guinevere: GUINEVERE_STAGE_TIMELINE,
  };
  const mods = import.meta.glob<unknown>("./stage-data/*.generated.ts", { eager: true });
  for (const [file, mod] of Object.entries(mods)) {
    const slug = file.replace("./stage-data/", "").replace(".generated.ts", "");
    const data = readStageData(mod);
    if (data) out[slug] = data.timeline;
  }
  return out;
}

const TIMELINES = timelines();

describe("the clips of the ten, as the engine sees them", () => {
  it("has a timeline for every character of the ring", () => {
    expect(Object.keys(TIMELINES).sort()).toEqual([...ORDER].sort());
  });

  it.each(ORDER)(
    "%s: every button's role comes from the timeline and agrees with the data",
    (slug) => {
      const timeline = TIMELINES[slug]!;
      const clips = DATA.items.filter((c) => c.chars[0] === slug);
      const buttons = optionButtons(clips, timeline);
      // The welcome, then every pose and action of the data: nothing is dropped.
      expect(buttons.length).toBe(clips.filter((c) => c.kind !== "idle").length);
      for (const b of buttons) {
        const expected = { welcome: "welcome", pose: "pose", short: "action" }[
          b.clip.kind as "welcome" | "pose" | "short"
        ];
        expect(b.role, `${slug} ${b.clip.label}`).toBe(expected);
        if (b.role === "pose") {
          // A pose has its own loop: it holds until the visitor leaves it.
          const page = timeline.pages[b.clip.scene as "about" | "skills" | "gallery"];
          expect(page.loop.frames).toBeGreaterThan(0);
          expect(b.files).toContain(page.loop.file);
        }
        if (b.role === "action") {
          // An action is one file that hands back to the idle loop by itself, at its ui frame.
          const short = timeline.shorts[b.clip.scene as "short-1" | "short-2" | "short-3"];
          expect(b.files).toEqual([short.file]);
          expect(short.back.uiFrame).toBeLessThan(short.frames);
        }
      }
    },
  );

  it("knows a scene the timeline lacks", () => {
    expect(roleOf("nothing", SELENA_TIMELINE)).toBeNull();
    expect(roleOf(null, null)).toBe("welcome");
    expect(roleOf("gallery", null)).toBe("pose");
    expect(roleOf("short-2", null)).toBe("action");
  });
});

// The phases ---------------------------------------------------------------------------------------

type Stage = PhaseInput["stage"];

const at = (mode: StageState["mode"], extra: Partial<Stage> = {}): Stage => ({
  mode,
  scene: null,
  ui: mode === "idle" || mode === "queued",
  next: null,
  leaving: false,
  ...extra,
});

function phases(steps: Array<Partial<PhaseInput> & { stage: Stage }>): FullPhase[] {
  return steps.map((s) => fullPhase({ core: "ready", replay: false, held: null, ...s }).phase);
}

describe("fullPhase", () => {
  it("shows only the way back while the first welcome plays, then every option", () => {
    expect(
      phases([
        { core: "loading", stage: at("boot") },
        { stage: at("boot") },
        { stage: at("welcome") },
        { stage: at("idle") },
      ]),
    ).toEqual(["first-welcome", "first-welcome", "first-welcome", "idle"]);
  });

  it("calls the welcome asked for with the button a welcome again", () => {
    expect(
      phases([
        { replay: true, stage: at("boot") },
        { replay: true, stage: at("welcome") },
        { replay: true, stage: at("idle") },
      ]),
    ).toEqual(["welcome-again", "welcome-again", "idle"]);
  });

  it("runs an action: loading, its frame, playing, back in the idle pose", () => {
    const scene = "short-2" as const;
    expect(
      phases([
        { held: scene, stage: at("idle") },
        { stage: at("queued", { scene, ui: true }) },
        { stage: at("short", { scene, ui: false }) },
        // The engine's ui frame: she is in her idle pose while the clip hands back.
        { stage: at("short", { scene, ui: true }) },
        { stage: at("returning", { scene, ui: true }) },
        { stage: at("idle") },
      ]),
    ).toEqual(["loading", "loading", "action", "idle", "idle", "idle"]);
  });

  it("runs a pose: one way back while it loops, nothing while it leaves", () => {
    const scene = "skills" as const;
    expect(
      phases([
        { stage: at("queued", { scene, ui: true }) },
        { stage: at("intro", { scene }) },
        { stage: at("returning", { scene }) },
        { stage: at("page", { scene }) },
        { stage: at("leaving", { scene, leaving: true }) },
        { stage: at("outro", { scene, leaving: true }) },
        { stage: at("outro", { scene, leaving: true, ui: true }) },
        { stage: at("returning", { scene, leaving: true, ui: true }) },
        { stage: at("idle") },
      ]),
    ).toEqual(["loading", "pose", "pose", "pose", "leaving", "leaving", "idle", "idle", "idle"]);
  });

  it("leaves a pose asked to leave during its entrance", () => {
    const scene = "about" as const;
    expect(
      phases([
        { stage: at("intro", { scene, leaving: true }) },
        { stage: at("returning", { scene, leaving: true }) },
        { stage: at("page", { scene, leaving: true }) },
      ]),
    ).toEqual(["leaving", "leaving", "leaving"]);
  });

  it("shows the next choice made during a hand over as loading", () => {
    expect(
      fullPhase({
        core: "ready",
        replay: false,
        held: null,
        stage: at("short", { scene: "short-1", ui: true, next: "gallery" }),
      }),
    ).toEqual({ phase: "loading", scene: "gallery" });
  });

  it("has no option for a character with no stage", () => {
    expect(fullPhase({ core: "missing", replay: false, held: null, stage: at("boot") }).phase).toBe(
      "idle",
    );
  });
});

describe("optionViews", () => {
  const buttons = optionButtons(
    DATA.items.filter((c) => c.chars[0] === "selena"),
    SELENA_TIMELINE,
  );
  const shown = (phase: Parameters<typeof optionViews>[0]) =>
    optionViews(phase, buttons)
      .filter((v) => v.shown)
      .map((v) => `${v.button.clip.label}${v.back ? " (back)" : ""}`);

  it("shows every option at rest and none while something plays", () => {
    expect(shown({ phase: "idle", scene: null })).toEqual([
      "Welcome",
      "Phone",
      "Flight",
      "Lean",
      "Silverbolt",
      "Badge",
      "Right arm",
    ]);
    for (const phase of ["first-welcome", "welcome-again", "action", "leaving"] as const) {
      expect(shown({ phase, scene: "short-1" })).toEqual([]);
    }
  });

  it("keeps the pressed one while it loads, and the way back in a pose", () => {
    expect(shown({ phase: "loading", scene: "short-3" })).toEqual(["Right arm"]);
    expect(shown({ phase: "pose", scene: "skills" })).toEqual(["Flight (back)"]);
  });

  it("tells a load from a wait for the frame", () => {
    expect(waitOf({ phase: "loading", scene: "about" }, "about")).toBe("loading");
    expect(waitOf({ phase: "loading", scene: "about" }, null)).toBe("starting");
    expect(waitOf({ phase: "idle", scene: null }, null)).toBeNull();
  });
});
