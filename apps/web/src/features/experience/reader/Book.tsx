/**
 * The whole book, server rendered: the opening, twelve Parts (title card, every chapter heading
 * with its text or a skeleton, the held beat) and the end. Chapter text arrives lazily inside
 * each `ChapterBody`; everything else is static HTML.
 */
import { cn } from "@aspirant/ui/lib/utils";

import { StarGlyph } from "@/components/star-glyph";
import type { ChapterMeta, FrontSection, PartMeta } from "@/content/story-types";
import { storyIndex } from "@/content/story";

import type { Mood } from "../contract";
import { chapterMood, partMood } from "../scenes/parts";
import { ChapterBody } from "./ChapterBody";
import { EndMatter } from "./EndMatter";
import { keyLineCount } from "./key-index";
import { HELD_BEATS } from "./key-lines";
import { Opening } from "./Opening";
import s from "./reader.module.css";
import { ReaderRoot } from "./ReaderRoot";
import {
  getPartMeta,
  getUnit,
  partAnchor,
  PARTS,
  toPartNumber,
  unitLabel,
} from "./story-data";

const fmt = new Intl.NumberFormat("en-GB");

function unitMood(unit: ChapterMeta): Mood {
  if (unit.kind === "interlude") return "storm";
  return chapterMood(unit.id, toPartNumber(unit.part));
}

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

function PartCard({ part, mood }: { part: PartMeta; mood: Mood }) {
  const next = getPartMeta(part.number + 1);
  const id = partAnchor(part.number);
  return (
    <div
      className={s.partCard}
      data-unit="part"
      data-part={part.number}
      data-mood={mood}
      data-theme={mood}
    >
      <a className={s.skipPart} href={next ? `#${partAnchor(next.number)}` : "#the-end"}>
        {next ? `Skip to ${next.label}` : "Skip to the end"}
      </a>
      <div className={s.partInner}>
        <span className={s.partNumeral} aria-hidden="true">
          {String(part.number).padStart(2, "0")}
        </span>
        <h2 id={`${id}-title`} className={s.partTitle} tabIndex={-1}>
          <span className={s.partLabel}>{part.label}</span>
          <span className={s.partName}>{part.title}</span>
        </h2>
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
    </div>
  );
}

function ChapterHead({ unit }: { unit: ChapterMeta }) {
  const interlude = unit.kind === "interlude";
  return (
    <header className={s.head}>
      <span className={s.headNumeral} aria-hidden="true">
        {interlude ? "" : String(unit.number).padStart(2, "0")}
      </span>
      <p className={cn(s.headCode, "hud-label")} aria-hidden="true">
        <span>{interlude ? "Transmission" : `File ${String(unit.number).padStart(2, "0")}`}</span>
        <span>{getPartMeta(unit.part)?.label}</span>
      </p>
      <h3 id={`${unit.id}-title`} className={s.headTitle} tabIndex={-1}>
        <span className={s.headLabel}>{unitLabel(unit)}</span>
        <span className={s.headText}>{unit.title}</span>
      </h3>
      {unit.timeNote && <p className={s.timeNote}>{unit.timeNote}</p>}
      <div className={s.headRule} aria-hidden="true">
        <StarGlyph className={s.headStar} />
      </div>
    </header>
  );
}

function HeldBeat({ part, mood }: { part: PartMeta; mood: Mood }) {
  const beat = HELD_BEATS.find((b) => b.part === part.number);
  if (!beat) return null;
  return (
    <div
      className={s.beat}
      data-unit="beat"
      data-part={part.number}
      data-chapter={part.chapterIds.at(-1)}
      data-mood={mood}
      data-theme={mood}
    >
      <figure className={s.beatInner}>
        <StarGlyph className={s.beatStar} />
        <blockquote className={s.beatQuote}>
          <p>{beat.text}</p>
        </blockquote>
        <figcaption className="hud-label">End of {part.label}</figcaption>
      </figure>
    </div>
  );
}

function PartSection({ part }: { part: PartMeta }) {
  const mood = partMood(toPartNumber(part.number));
  let previous: Mood = mood;
  return (
    <section
      id={partAnchor(part.number)}
      className={s.part}
      aria-labelledby={`${partAnchor(part.number)}-title`}
      tabIndex={-1}
    >
      <PartCard part={part} mood={mood} />
      {part.chapterIds.map((id, index) => {
        const unit = getUnit(id);
        if (!unit) return null;
        const unitMoodValue = unitMood(unit);
        const shift = unitMoodValue !== previous;
        previous = unitMoodValue;
        return (
          <article
            key={id}
            id={id}
            className={cn(s.chapter, unit.kind === "interlude" && s.interlude, shift && s.shift)}
            data-unit="chapter"
            data-part={part.number}
            data-chapter={id}
            data-mood={unitMoodValue}
            data-theme={unitMoodValue}
            aria-labelledby={`${id}-title`}
          >
            <div className={s.column}>
              <ChapterHead unit={unit} />
              <ChapterBody
                part={part.number}
                index={index}
                words={unit.wordCount}
                paragraphs={unit.paragraphCount}
                keys={keyLineCount(id)}
              />
            </div>
          </article>
        );
      })}
      <HeldBeat part={part} mood={previous} />
    </section>
  );
}

export function Book({ front }: { front: readonly FrontSection[] }) {
  return (
    <ReaderRoot>
      <Opening front={front} />
      {PARTS.map((part) => (
        <PartSection key={part.number} part={part} />
      ))}
      <EndMatter />
    </ReaderRoot>
  );
}
