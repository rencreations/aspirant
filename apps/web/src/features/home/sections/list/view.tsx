import { CHARACTER_NAMES } from "@/lib/slugs";

import { LIST, listHref } from "../../content";
import { TLink } from "@/components/transition/t-link";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="list" note="the list of ten frames" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{LIST.title}</h2>
        <ol className={styles.list}>
          {LIST.order.map((slug) => (
            <li key={slug}>
              <TLink href={listHref(slug)} transitionLabel={CHARACTER_NAMES[slug]}>
                {CHARACTER_NAMES[slug]}
              </TLink>
            </li>
          ))}
        </ol>
      </>
    ),
  };
}
