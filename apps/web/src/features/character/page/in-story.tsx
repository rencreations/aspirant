import type { Route } from "next";

import { TLink } from "@/components/transition/t-link";

import styles from "./in-story.module.css";
import { SectionHead } from "./section-head";

export interface ChapterChip {
  readonly id: string;
  readonly href: Route;
  /** "05" or "Interlude". */
  readonly number: string;
  readonly title: string;
  readonly part: string;
}

interface InStoryProps {
  name: string;
  chapters: readonly ChapterChip[];
}

/** The chapters she appears in, as links into the Experience reader. */
export function InStory({ name, chapters }: InStoryProps) {
  return (
    <section aria-labelledby="story-title" className={`${styles.section} shell`}>
      <SectionHead id="story-title" index="05" code="Chapter index" title="In the story">
        {`${name} appears in these ${chapters.length} chapters. Each one opens in the reader.`}
      </SectionHead>
      <ol className={styles.list}>
        {chapters.map((c, i) => {
          const prev = chapters[i - 1];
          const newPart = !prev || prev.part !== c.part;
          return (
            <li key={c.id} className={styles.item} data-new-part={newPart || undefined}>
              {newPart && (
                <span className={styles.part} aria-hidden="true">
                  {c.part}
                </span>
              )}
              <TLink href={c.href} className={styles.chip} transitionLabel={c.title}>
                <span className={styles.num}>
                  {c.number === "Interlude" ? (
                    <span className={styles.interlude}>Interlude</span>
                  ) : (
                    <>
                      <span className="sr-only">Chapter </span>
                      {c.number}
                    </>
                  )}
                </span>
                <span className={styles.title}>{c.title}</span>
                <span className="sr-only">, {c.part}</span>
              </TLink>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
