import { TLink } from "@/components/transition/t-link";
import { collectionRoute } from "@/lib/site";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { VOICES, VOICE_PICKS } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="voices" note="the chooser and the voice lines" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{VOICES.title}</h2>
        <ul className={styles.list}>
          {VOICE_PICKS.map((pick) => (
            <li key={pick.slug}>
              <TLink
                href={collectionRoute(`voicelines/${pick.slug}`)}
                transitionLabel={CHARACTER_NAMES[pick.slug]}
              >
                {CHARACTER_NAMES[pick.slug]}
              </TLink>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Pill href={VOICES.button.href} label="Voicelines">
            {VOICES.button.label}
          </Pill>
        </div>
      </>
    ),
  };
}
