import { STRIP } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="strip" note="the ultra wide frame and its expand" />,
    text: (
      <>
        <h2 className={styles.srOnly}>Trailer</h2>
        <p className={styles.eyebrow}>
          <b>{STRIP.topLeft}</b> {STRIP.topRightTag}
        </p>
        <p className={styles.lead}>{STRIP.topRight}</p>
        <p className={styles.eyebrow}>
          {STRIP.middleLeft} <b>/</b> {STRIP.middleRight}
        </p>
        <p className={styles.eyebrow}>
          {STRIP.bottomLeft.rest[0]} <b>/</b> {STRIP.bottomLeft.rest[1]}
        </p>
        <div className={styles.actions}>
          <Pill href={STRIP.button.href} label="Collection">
            {STRIP.button.label}
          </Pill>
          <Pill href={STRIP.expand.button.href} label="Films">
            {STRIP.play.label} {STRIP.play.duration}
          </Pill>
        </div>
        <h2 className={styles.title + " " + styles.titleSmall}>
          <span className={styles.eyebrow}>{STRIP.expand.lead}</span> {STRIP.expand.title}
        </h2>
        <p className={styles.lead}>{STRIP.expand.body}</p>
        <div className={styles.actions}>
          <Pill href={STRIP.expand.button.href} label="Films">
            {STRIP.expand.button.label}
          </Pill>
        </div>
      </>
    ),
  };
}
