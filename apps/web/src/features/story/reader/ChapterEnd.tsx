/**
 * The way on at the end of a chapter: the card of the next chapter (a small live copy of its title
 * card, which opens into it: the chapter morph), the way back to the chapter before (its title card
 * unrolls from the top), and the list. After the last chapter the card leads to the end page.
 */
import type { Route } from "next";

import { TLink } from "@/components/transition/t-link";
import { nextChapter, previousChapter } from "@/content/story";
import type { ChapterEntry } from "@/content/story-types";
import { routes } from "@/lib/site";

import { BeforeLink } from "../morph/BeforeLink";
import { Door } from "../morph/Door";
import s from "./reader.module.css";

export function ChapterEnd({ entry }: { entry: ChapterEntry }) {
  const next = nextChapter(entry.id);
  const previous = previousChapter(entry.id);
  return (
    <nav className={s.end} aria-label="Chapters">
      <Door next={next ?? null} from={entry} />
      <div className={s.endRow} data-end-row="">
        {previous ? <BeforeLink previous={previous} /> : <span />}
        <TLink
          href={`${routes.story}/#chapters` as Route}
          transitionLabel="Story"
          className={s.endLink}
        >
          All chapters
        </TLink>
      </div>
    </nav>
  );
}
