import { render } from "@testing-library/react";

import type { Block } from "@/content/story-types";

import { ChapterBlocks } from "./ChapterBlocks";
import { readIndex, readParts } from "./story-fixture";

function sourceText(block: Block): string {
  if (block.type === "p") return block.segments.map((s) => s.text).join("");
  if (block.type === "poem")
    return block.lines.map((line) => line.map((s) => s.text).join("")).join("");
  return "";
}

/** Text a reader sees and a screen reader reads (decorative hints removed). */
function shownText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const hint of copy.querySelectorAll('span[aria-hidden="true"]:not([data-ent])'))
    hint.remove();
  return copy.textContent ?? "";
}

/**
 * Every paragraph and poem in the story is rendered by the reader, word for word: render every
 * chapter of the twelve Parts through the real `ChapterBlocks` and compare with the JSON.
 */
describe("reader coverage", () => {
  const index = readIndex();
  const files = readParts();

  it("renders every paragraph id of every chapter in the index, with its whole text", () => {
    const expected: string[] = [];
    const rendered: string[] = [];
    const mismatched: string[] = [];
    for (const file of files) {
      file.chapters.forEach((chapter, i) => {
        expect(chapter.id).toBe(file.part.chapterIds[i]);
        const { container, unmount } = render(<ChapterBlocks chapter={chapter} />);
        for (const block of chapter.blocks) {
          if (block.type === "scene-break") continue;
          expected.push(block.id);
          const el = container.querySelector(`[id="${block.id}"]`);
          if (el && shownText(el) !== sourceText(block)) mismatched.push(block.id);
        }
        rendered.push(
          ...Array.from(container.querySelectorAll<HTMLElement>("[data-p]")).map((el) => el.id),
        );
        unmount();
      });
    }
    expect(rendered).toEqual(expected);
    expect(rendered).toHaveLength(index.stats.paragraphs);
    expect(mismatched).toEqual([]);
    const indexIds = index.chapters.map((chapter) => chapter.id);
    expect(files.flatMap((file) => file.chapters.map((chapter) => chapter.id))).toEqual(indexIds);
    // Renders all 2,569 paragraphs in jsdom: a few seconds alone, longer on a busy machine.
  }, 180_000);
});
