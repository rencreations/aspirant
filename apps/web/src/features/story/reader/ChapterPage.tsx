/**
 * One chapter of the story, server rendered: the title card, the text with its pictures, voice
 * lines and clips set in between, and the way on. The text is in the page's own HTML.
 */
import { nextChapter, previousChapter } from "@/content/story";
import type { Chapter, ChapterEntry } from "@/content/story-types";

import { ChapterPull } from "../morph/ChapterPull";
import { Blocks } from "./Blocks";
import { ChapterEnd } from "./ChapterEnd";
import s from "./reader.module.css";
import { ReaderRoot } from "./ReaderRoot";
import { TitleCard } from "./TitleCard";

export function ChapterPage({ chapter, entry }: { chapter: Chapter; entry: ChapterEntry }) {
  return (
    <ReaderRoot
      chapterId={chapter.id}
      score={chapter.score}
      aside={
        <ChapterPull
          current={entry}
          next={nextChapter(entry.id) ?? null}
          previous={previousChapter(entry.id) ?? null}
        />
      }
    >
      <article
        id={chapter.id}
        className={s.chapter}
        data-chapter={chapter.id}
        aria-labelledby={`${chapter.id}-title`}
      >
        <TitleCard chapter={chapter} entry={entry} />
        <div className={s.body}>
          <Blocks chapter={chapter} />
        </div>
      </article>
      <ChapterEnd entry={entry} />
    </ReaderRoot>
  );
}
