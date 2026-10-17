import fs from "node:fs";
import path from "node:path";

import type { PartFile, StoryIndex } from "@/content/story-types";

import type { PartNumber } from "../contract";
import {
  CHAPTERS,
  PARTS,
  chapterMood,
  moodAt,
  paragraphIndex,
  partMood,
  sceneAt,
  type SceneKey,
} from "./parts";
import { SET_PIECE_ANCHORS } from "./setpieces";

const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");
const STORY_DIR = path.join(PUBLIC_DIR, "data/story");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(STORY_DIR, file), "utf8")) as T;
}

const index = readJson<StoryIndex>("index.json");
const partFiles = index.parts.map((part) =>
  readJson<PartFile>(part.file.replace("data/story/", "")),
);
const storyChapters = partFiles.flatMap((file) =>
  file.chapters.map((chapter) => ({ chapter, part: file.part.number as PartNumber })),
);
const blockById = new Map(
  storyChapters.flatMap(({ chapter }) =>
    chapter.blocks.map((block) => [block.id, { block, chapterId: chapter.id }] as const),
  ),
);
const PART_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

describe("Part moods", () => {
  it("covers Parts One to Twelve with a mood, palette, tag and still that exists", () => {
    for (const n of PART_NUMBERS) {
      const part = PARTS[n];
      expect(part.part).toBe(n);
      expect(["daybreak", "storm"]).toContain(partMood(n));
      expect(part.tag).toMatch(new RegExp(`^PART ${String(n).padStart(2, "0")} / `));
      for (const color of Object.values(part.palette)) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(part.stills.length).toBeGreaterThan(0);
      for (const still of part.stills) {
        expect(fs.existsSync(path.join(PUBLIC_DIR, still)), still).toBe(true);
      }
    }
  });

  it("uses the story's own Part titles", () => {
    for (const file of partFiles) {
      expect(PARTS[file.part.number as PartNumber].title).toBe(file.part.title);
    }
  });
});

describe("Chapter scenes", () => {
  it("has an entry for every chapter and interlude in the story, in the right Part", () => {
    const ids = storyChapters.map(({ chapter }) => chapter.id);
    expect(Object.keys(CHAPTERS).sort()).toEqual([...ids].sort());
    for (const { chapter, part } of storyChapters) {
      expect(CHAPTERS[chapter.id]?.part, chapter.id).toBe(part);
      expect(["daybreak", "storm"]).toContain(chapterMood(chapter.id, part));
    }
  });

  it("turns only at real paragraphs of the same chapter, in reading order", () => {
    for (const [chapterId, chapter] of Object.entries(CHAPTERS)) {
      let last = -1;
      for (const turn of chapter.turns ?? []) {
        const hit = blockById.get(turn.at);
        expect(hit, turn.at).toBeDefined();
        expect(hit?.chapterId).toBe(chapterId);
        expect(hit?.block.type).toBe("p");
        expect(paragraphIndex(turn.at)).toBeGreaterThan(last);
        last = paragraphIndex(turn.at);
      }
      if (chapter.still) expect(fs.existsSync(path.join(PUBLIC_DIR, chapter.still))).toBe(true);
      for (const turn of chapter.turns ?? []) {
        if (turn.still) expect(fs.existsSync(path.join(PUBLIC_DIR, turn.still))).toBe(true);
      }
    }
  });

  it("advances the scene at each turn and keeps the text theme for the chapter", () => {
    expect(sceneAt("c11", "c11-p000", 3).scene).toBe("lanterns-978");
    expect(sceneAt("c11", "c11-p028", 3).scene).toBe("lanterns-978");
    expect(sceneAt("c11", "c11-p029", 3).scene).toBe("storm-978");
    expect(moodAt("c11", "c11-p029", 3)).toBe("storm");
    expect(chapterMood("c11", 3)).toBe("daybreak");
    expect(sceneAt("c52", "c52-p066", 11).scene).toBe("rift-opens");
    // A paragraph from another chapter does not advance the turns.
    expect(sceneAt("c11", "c12-p040", 3).scene).toBe("lanterns-978");
    // No chapter: the Part's default scene.
    expect(sceneAt(null, null, 7).scene).toBe(PARTS[7].scene);
  });

  it("names a scene for every Part and chapter", () => {
    const keys = new Set<SceneKey>();
    for (const n of PART_NUMBERS) keys.add(PARTS[n].scene);
    for (const chapter of Object.values(CHAPTERS)) {
      keys.add(chapter.scene);
      for (const turn of chapter.turns ?? []) keys.add(turn.scene);
    }
    expect(keys.size).toBeGreaterThan(40);
  });
});

describe("Set piece anchors", () => {
  it("anchors every piece after a real paragraph of its chapter, in reading order", () => {
    const order = new Map<string, number>(storyChapters.map(({ chapter }, i) => [chapter.id, i]));
    let last = -1;
    const ids = new Set<string>();
    for (const anchor of SET_PIECE_ANCHORS) {
      const hit = blockById.get(anchor.after);
      expect(hit, anchor.after).toBeDefined();
      expect(hit?.block.type).toBe("p");
      expect(hit?.chapterId).toBe(anchor.chapterId);
      const position = (order.get(anchor.chapterId) ?? -1) * 1000 + paragraphIndex(anchor.after);
      expect(position).toBeGreaterThan(last);
      last = position;
      expect(ids.has(anchor.id)).toBe(false);
      ids.add(anchor.id);
      expect(anchor.caption).not.toMatch(/[–—]/);
      expect(anchor.label).not.toMatch(/[–—]/);
      expect(anchor.label.length).toBeGreaterThan(20);
    }
  });

  it("covers the set pieces the spec asks for", () => {
    const chapters = new Set(SET_PIECE_ANCHORS.map((a) => a.chapterId));
    for (const id of ["c01", "c10", "c12", "c18", "c21", "c24", "c33", "c47", "c57", "c60"]) {
      expect(chapters.has(id), id).toBe(true);
    }
  });
});
