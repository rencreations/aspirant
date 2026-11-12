"use client";

import { memo, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";

import { TAKEDOWN_URL } from "../../shell/library-shell";
import { BackToCollection } from "../../shell/room-chrome";
import { ARTS_SHELF_HREF, OFFICIAL_NAV } from "../core/routes";
import styles from "./splash.module.css";

/**
 * A label whose letters roll on hover, one after the other from the left: each letter stands in a
 * mask one line high that holds it twice, one above the other, and both move up one line (0.4 s,
 * 0.02 s apart). On leaving they roll back the same way. Transform only. The letters are hidden from
 * a screen reader, which reads the plain text beside them.
 */
function Roll({ text }: { text: string }) {
  return (
    <>
      <span className={styles.roll} aria-hidden="true">
        {Array.from(text).map((ch, i) => (
          <span key={i} className={styles.rl} style={{ "--i": i } as CSSProperties}>
            <span>{ch === " " ? " " : ch}</span>
            <span>{ch === " " ? " " : ch}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/**
 * The corners of the stage: the way back under the bar, the six sub-pages of Official at the
 * bottom left (a row at the foot on a phone), and the takedown box at the bottom right. The shared
 * `ArtsSubNav` and `ArtsTakedown` cannot carry the rolling letters, so this room draws its own with
 * the same routes, the same labels and the same attributes.
 */
export const Chrome = memo(function Chrome() {
  return (
    <>
      <BackToCollection tone="dark" href={ARTS_SHELF_HREF} label="Collection" />
      <div className={styles.foot} data-foot="">
        <nav aria-label="Official art" data-arts-subnav="" className={styles.subnav}>
          <ul>
            {OFFICIAL_NAV.map((item) => (
              <li key={item.room}>
                <TLink
                  href={item.href}
                  transitionLabel={item.label}
                  className={styles.sub}
                  aria-current={item.room === "splash" ? "page" : undefined}
                >
                  <i className={styles.triangle} aria-hidden="true" />
                  <Roll text={item.label} />
                </TLink>
              </li>
            ))}
          </ul>
        </nav>
        <TLink href={TAKEDOWN_URL} className={styles.takedown} data-takedown="">
          <i className={styles.triangle} aria-hidden="true" />
          <Roll text="Takedown" />
          <span className="sr-only">
            . Fan made archive, not affiliated with Moonton. To ask for something to be taken down,
            use the takedown page.
          </span>
        </TLink>
      </div>
    </>
  );
});
