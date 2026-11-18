import { TLink } from "@/components/transition/t-link";

import { CHASE } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="chase" note="the chase and the comic" />,
    text: (
      <div className={styles.centreBox}>
        <h2 className={styles.title}>{CHASE.title}</h2>
        <ul className={styles.list}>
          <li>
            <TLink href={CHASE.left.href} transitionLabel="Comic">
              {CHASE.left.label}
            </TLink>
          </li>
          <li>
            <TLink href={CHASE.right.href} transitionLabel="Comic">
              {CHASE.right.label}
            </TLink>
          </li>
        </ul>
        <div className={styles.actions}>
          <Pill href={CHASE.button.href} label="Comic">
            {CHASE.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
