import { ReportLink } from "@/features/legal/takedown/report-link";

import { BEND } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="bend" note="Tetra bends the pictures" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{BEND.title}</h2>
        <div className={styles.actions}>
          <Pill href={BEND.fanart.href} label="Fan art">
            {BEND.fanart.label}
          </Pill>
        </div>
        <h2 className={styles.title + " " + styles.titleSmall}>{BEND.artworkTitle}</h2>
        <div className={styles.actions}>
          <Pill href={BEND.artwork.href} label="Arts">
            {BEND.artwork.label}
          </Pill>
        </div>
        <p className={styles.notice}>
          <ReportLink item={{ title: "Fan art on the home page" }} />
        </p>
      </>
    ),
  };
}
