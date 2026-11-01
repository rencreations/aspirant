/**
 * One Part of the story, server rendered: its heading, every chapter with its text, and the way on
 * to the next Part. Part One opens with "Before you begin"; Part Twelve ends with the questions
 * the story leaves open. There is no scene, backdrop or effect behind the text.
 */
import { cn } from "@aspirant/ui/lib/utils";

import { storyIndex } from "@/content/story";
import type { Chapter, FrontSection, PartFile, PartMeta } from "@/content/story-types";

import { ChapterBlocks } from "./ChapterBlocks";
import { EndMatter } from "./EndMatter";
import { FrontMatter } from "./FrontMatter";
import { PartNav } from "./PartNav";
import s from "./reader.module.css";
import { ReaderRoot } from "./ReaderRoot";
import { getUnit, unitLabel } from "./story-data";

const fmt = new Intl.NumberFormat("en-GB");

function chapterSpan(part: PartMeta): string {
  const numbers = part.chapterIds
    .map((id) => getUnit(id)?.number)
    .filter((n): n is number => typeof n === "number");
  const first = numbers[0];
  const last = numbers.at(-1);
  const interludes = part.chapterIds.length - numbers.length;
  const span =
    first === undefined ? "" : first === last ? `Chapter ${first}` : `Chapters ${first} to ${last}`;
  return interludes ? `${span}, and an interlude` : span;
}

function PartHead({ part }: { part: PartMeta }) {
  return (
    <header className={s.partHead}>
      <div className={s.column}>
        <p className={s.partLabel}>{part.label}</p>
        <h1 className={s.partTitle}>{part.title}</h1>
        <p className={s.partSetting}>{part.setting}</p>
        {part.number === 1 && (
          <figure className={s.epigraph}>
            <blockquote>
              <p>
                {storyIndex.epigraph.lines.map((line, i) => (
                  <span key={line}>
                    {line}
                    {i < storyIndex.epigraph.lines.length - 1 && <br />}
                  </span>
                ))}
              </p>
            </blockquote>
            <figcaption>{storyIndex.epigraph.attribution}</figcaption>
          </figure>
        )}
        <p className={cn(s.partMeta, "hud-label")}>
          <span>{chapterSpan(part)}</span>
          <span aria-hidden="true"> / </span>
          <span>{fmt.format(part.wordCount)} words</span>
        </p>
      </div>
    </header>
  );
}

function ChapterHead({ chapter }: { chapter: Chapter }) {
  return (
    <header className={s.head}>
      <p className={s.headLabel} aria-hidden="true">
        {unitLabel(chapter)}
      </p>
      <h2 id={`${chapter.id}-title`} className={s.headTitle} tabIndex={-1}>
        <span className="sr-only">{unitLabel(chapter)}: </span>
        {chapter.title}
      </h2>
      {chapter.timeNote && <p className={s.timeNote}>{chapter.timeNote}</p>}
    </header>
  );
}

export function PartPage({
  file,
  front,
}: {
  file: PartFile;
  /** The front matter ("Before you begin"), shown on Part One. */
  front: readonly FrontSection[];
}) {
  const { part, chapters } = file;
  return (
    <ReaderRoot part={part.number}>
      <PartHead part={part} />
      {part.number === 1 && <FrontMatter front={front} />}
      {chapters.map((chapter) => (
        <article
          key={chapter.id}
          id={chapter.id}
          className={cn(s.chapter, chapter.kind === "interlude" && s.interlude)}
          data-chapter={chapter.id}
          aria-labelledby={`${chapter.id}-title`}
        >
          <div className={s.column}>
            <ChapterHead chapter={chapter} />
            <ChapterBlocks chapter={chapter} />
          </div>
        </article>
      ))}
      {part.number === 12 && <EndMatter />}
      <PartNav part={part.number} />
    </ReaderRoot>
  );
}
