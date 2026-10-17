import { cn } from "@aspirant/ui/lib/utils";

import { TLink } from "@/components/transition/t-link";

import { chapterName, chapterShort, experienceHref } from "./experience-href";
import styles from "./shared.module.css";

export interface ChapterLinkProps {
  /** `c01` to `c60`, or an interlude id. */
  id: string;
  /** Visible text. Default "Ch 12". The accessible name is always the full chapter name. */
  children?: string;
  className?: string;
}

/**
 * A chip that opens a chapter in the reader. The visible text is short ("Ch 12"), the
 * accessible name is full ("Read Chapter 12").
 */
export function ChapterLink({ id, children, className }: ChapterLinkProps) {
  return (
    <TLink
      href={experienceHref(id)}
      transitionLabel={chapterName(id)}
      aria-label={`Read ${chapterName(id)}`}
      className={cn(styles.chip, className)}
    >
      {children ?? chapterShort(id)}
    </TLink>
  );
}

/** A row of chapter chips. */
export function ChapterLinks({ ids, className }: { ids: readonly string[]; className?: string }) {
  return (
    <ul className={cn(styles.chips, className)}>
      {ids.map((id) => (
        <li key={id}>
          <ChapterLink id={id} />
        </li>
      ))}
    </ul>
  );
}
