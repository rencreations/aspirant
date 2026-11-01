import type { Route } from "next";

import { TLink } from "@/components/transition/t-link";
import { routes } from "@/lib/site";

import { partHref } from "../chapter-href";
import s from "./reader.module.css";
import { getPartMeta } from "./story-data";

/**
 * The way on at the end of a Part: the next Part's page (or, after the last, the way to the
 * characters), the one before, and the list of chapters.
 */
export function PartNav({ part }: { part: number }) {
  const previous = getPartMeta(part - 1);
  const next = getPartMeta(part + 1);
  return (
    <nav className={s.partNav} aria-label="Parts of the story">
      <div className={s.column}>
        {next ? (
          <TLink
            href={partHref(next.number)}
            transitionLabel={next.label}
            className={s.partNext}
            data-cursor="NEXT"
          >
            <span className={s.partNavKicker}>Next</span>
            <span className={s.partNavLabel}>{next.label}</span>
            <span className={s.partNavTitle}>{next.title}</span>
          </TLink>
        ) : (
          <TLink
            href={routes.characters}
            transitionLabel="Characters"
            className={s.partNext}
            data-cursor="NEXT"
          >
            <span className={s.partNavKicker}>The story ends here</span>
            <span className={s.partNavLabel}>Meet the ten</span>
            <span className={s.partNavTitle}>The Aspirants, one page each.</span>
          </TLink>
        )}
        <div className={s.partNavRow}>
          {previous ? (
            <TLink
              href={partHref(previous.number)}
              transitionLabel={previous.label}
              className={s.partNavLink}
            >
              Previous: {previous.label}
            </TLink>
          ) : (
            <span />
          )}
          <TLink
            href={`${routes.story}/#chapters` as Route}
            transitionLabel="Story"
            className={s.partNavLink}
          >
            All chapters
          </TLink>
        </div>
      </div>
    </nav>
  );
}
