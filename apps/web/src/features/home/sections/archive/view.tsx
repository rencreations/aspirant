import { TLink } from "@/components/transition/t-link";
import { COLLECTIONS } from "@/features/library/registry";
import { collectionRoute } from "@/lib/site";

import { ARCHIVE } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="archive" note="the collection and the drone" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{ARCHIVE.title}</h2>
        <ul className={styles.list}>
          {COLLECTIONS.map((room) => (
            <li key={room.slug}>
              <TLink href={collectionRoute(room.slug)} transitionLabel={room.name}>
                {room.name}
              </TLink>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Pill href={ARCHIVE.button.href} label="Collection">
            {ARCHIVE.button.label}
          </Pill>
        </div>
      </>
    ),
  };
}
