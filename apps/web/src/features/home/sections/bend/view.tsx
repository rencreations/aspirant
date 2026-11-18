import { ReportLink } from "@/features/legal/takedown/report-link";
import { CanonBadge, CreditLine } from "@/features/library/shell/credit";

import { BEND } from "../../content";
import home from "../../home.module.css";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import styles from "./bend.module.css";
import { restScreens } from "./plays";
import { FAN_PICS } from "./pictures";

/**
 * What the server draws for the section: the two titles with their buttons (the fan art wall's and
 * the spiral's), the small takedown link for the fan art, and one plate for each fan picture with its
 * credit (the pictures themselves are in the canvas; the plates are the real text a visitor and a
 * screen reader get, and the page shows the one of the picture under the pointer). All copy is the
 * owner's or the site's own data (`content.ts`, `fan-data.ts`).
 */
export function view(): SectionMarkup {
  return {
    text: (
      <>
        <div className={styles.group} data-bend="fan" data-home-focus-at={restScreens(1)}>
          <h2 className={`${home.title} ${styles.title}`}>{BEND.title}</h2>
          <div className={`${home.actions} ${styles.actions}`}>
            <Pill href={BEND.fanart.href} label="Fan art">
              {BEND.fanart.label}
            </Pill>
          </div>
        </div>
        {FAN_PICS.some((pic) => pic.canon !== "official") ? (
          <p className={styles.notice} data-bend="notice" data-home-focus-at={restScreens(1)}>
            <ReportLink item={{ title: "Fan art on the home page" }} />
          </p>
        ) : null}
        <ul
          className={styles.plates}
          data-bend="plates"
          data-home-focus-at={restScreens(1)}
          aria-label="The fan art and its credits"
        >
          {FAN_PICS.map((pic, i) => (
            <li className={styles.plate} key={pic.id} data-bend-plate={i}>
              <CanonBadge canon={pic.canon} />
              <p className={styles.plateTitle}>{pic.title}</p>
              <span className={home.srOnly}>{pic.alt}</span>
              <CreditLine canon={pic.canon} credit={pic.credit} />
              {pic.canon !== "official" ? (
                <ReportLink
                  className={styles.plateReport}
                  item={{ id: pic.report.item, title: pic.report.title }}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <div
          className={`${styles.group} ${styles.groupTop}`}
          data-bend="art"
          data-home-focus-at={restScreens(2)}
        >
          <h2 className={`${home.title} ${styles.title}`}>{BEND.artworkTitle}</h2>
          <div className={`${home.actions} ${styles.actions}`}>
            <Pill href={BEND.artwork.href} label="Arts">
              {BEND.artwork.label}
            </Pill>
          </div>
        </div>
      </>
    ),
  };
}
