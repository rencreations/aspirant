/**
 * Test helper: reads the story JSON from `public/data/story` (Node only; used by the reader
 * tests, never by the app).
 */
import fs from "node:fs";
import path from "node:path";

import type { PartFile, StoryIndex } from "@/content/story-types";

const DIR = path.resolve(__dirname, "../../../../public/data/story");

export function readIndex(): StoryIndex {
  return JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")) as StoryIndex;
}

export function readParts(): PartFile[] {
  return readIndex().parts.map(
    (part) =>
      JSON.parse(
        fs.readFileSync(path.join(DIR, part.file.replace("data/story/", "")), "utf8"),
      ) as PartFile,
  );
}
