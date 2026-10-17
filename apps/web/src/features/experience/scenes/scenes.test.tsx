import fs from "node:fs";
import path from "node:path";

import { act, render } from "@testing-library/react";

import type { PartFile, StoryIndex } from "@/content/story-types";

import { useExperience } from "../contract";
import { cueFile, VOICE_CUES } from "./audio-cues";
import { driver, syncDriver } from "./driver";
import { CHAPTERS, PARTS, type SceneKey } from "./parts";
import ScenesLayer from "./ScenesLayer";
import { SET_PIECE_ANCHORS, setPieceRegistry } from "./setpieces";
import { PRESETS } from "./world/presets";

const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");
const STORY_DIR = path.join(PUBLIC_DIR, "data/story");
const index = JSON.parse(fs.readFileSync(path.join(STORY_DIR, "index.json"), "utf8")) as StoryIndex;
const blocks = new Map<string, string>();
for (const part of index.parts) {
  const file = JSON.parse(
    fs.readFileSync(path.join(STORY_DIR, part.file.replace("data/story/", "")), "utf8"),
  ) as PartFile;
  for (const chapter of file.chapters) for (const b of chapter.blocks) blocks.set(b.id, b.type);
}

describe("scene presets", () => {
  it("has a composition with an intent for every scene the tables name", () => {
    const keys = new Set<SceneKey>();
    for (const p of Object.values(PARTS)) keys.add(p.scene);
    for (const c of Object.values(CHAPTERS)) {
      keys.add(c.scene);
      for (const t of c.turns ?? []) keys.add(t.scene);
    }
    for (const key of keys) {
      expect(PRESETS[key], key).toBeDefined();
      expect(PRESETS[key].intent.length, key).toBeGreaterThan(30);
      expect(PRESETS[key].intent).not.toMatch(/[–—]/);
    }
  });
});

describe("set piece registry", () => {
  it("has a lazy module for every anchor and nothing else", () => {
    const ids = SET_PIECE_ANCHORS.map((a) => a.id).sort();
    expect(Object.keys(setPieceRegistry).sort()).toEqual(ids);
  });

  it("loads every piece as a component", async () => {
    for (const load of Object.values(setPieceRegistry)) {
      const mod = await load();
      expect(typeof mod.default).toBe("function");
    }
  });
});

describe("voice cues", () => {
  it("sit on real paragraphs and point at voice files that exist", () => {
    for (const [id, cue] of Object.entries(VOICE_CUES)) {
      expect(blocks.get(id), id).toBe("p");
      expect(fs.existsSync(path.join(PUBLIC_DIR, cueFile(cue))), cueFile(cue)).toBe(true);
      expect(cue.line).not.toMatch(/[–—]|conviction/i);
    }
  });
});

describe("driver", () => {
  it("mirrors the store, turns scenes at paragraphs and resets the beat", async () => {
    const off = syncDriver();
    act(() => {
      useExperience
        .getState()
        .setPosition({ partNumber: 3, chapterId: "c11", paragraphId: "c11-p000" });
    });
    expect(driver.scene).toBe("lanterns-978");
    act(() => {
      useExperience.getState().setPosition({ paragraphId: "c11-p030" });
    });
    expect(driver.scene).toBe("storm-978");
    expect(driver.mood).toBe("storm");
    const before = driver.beats;
    act(() => useExperience.getState().pulse());
    await act(async () => {
      await Promise.resolve();
    });
    expect(useExperience.getState().beat).toBe(0);
    act(() => useExperience.getState().pulse());
    expect(driver.beats).toBe(before + 2);
    off();
  });
});

describe("ScenesLayer", () => {
  it("renders a decorative still backdrop and the legibility veil without WebGL", () => {
    const { container } = render(<ScenesLayer />);
    const layer = container.querySelector("[data-scenes-layer]");
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    const img = layer?.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(layer?.querySelector("canvas")).toBeNull();
  });
});
