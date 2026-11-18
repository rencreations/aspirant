import { TLink } from "@/components/transition/t-link";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { LIST, listHref } from "../../content";
import type { SectionMarkup } from "../../kernel/types";

import { PICTURE_FRAMES, SELENA_FRAME } from "./frames";
import styles from "./list.module.css";

/**
 * What the server draws for the section. The frames are pictures in the layer under the canvas
 * (the doll and Selena are drawn in front of them); the words, the links and the one button that
 * opens a picture are in the text layer, over everything. Every name is a real link to the
 * Aspirant's page, in the owner's order, so the plain page is a readable list.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.below}>
        <div className={styles.panel} data-list-panel="">
          <div className={styles.panelOuter} data-list-panel-outer="">
            <div className={styles.panelInner} data-list-panel-inner="">
              <div className={styles.panelCounter} data-list-panel-counter="">
                <div className={styles.panelSky} data-list-sky="" />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.window} data-list-window="">
          <div className={styles.row} data-list-row="">
            {PICTURE_FRAMES.map((f, i) => (
              <div key={f.slug} className={styles.item} data-list-item={i}>
                <div className={styles.inner} data-list-inner="">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a decorative picture of the stage */}
                  <img
                    className={styles.poster}
                    data-list-poster=""
                    src={f.poster}
                    alt=""
                    decoding="async"
                  />
                </div>
              </div>
            ))}
            <div className={styles.item} data-list-item={PICTURE_FRAMES.length}>
              <div className={styles.inner} data-list-inner="">
                {/* eslint-disable-next-line @next/next/no-img-element -- Selena's card, until she is drawn */}
                <img
                  className={styles.poster}
                  data-list-poster=""
                  data-list-selena-poster=""
                  src={SELENA_FRAME.poster}
                  alt=""
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
        <svg className={styles.chrome} data-list-chrome="" aria-hidden="true">
          <rect className={styles.chromeRect} data-list-chrome-rect="" />
        </svg>
        <i className={styles.dot} data-list-dot="" />
      </div>
    ),
    text: (
      <div className={styles.stage}>
        <div className={styles.head} data-list-head="">
          <h2 className={styles.title} data-list-title="">
            {LIST.title}
          </h2>
          <ol className={styles.names} data-list-names="">
            {LIST.order.map((slug, i) => {
              const frame = PICTURE_FRAMES[i];
              return (
                <li key={slug} className={styles.entry} data-list-li={i}>
                  <div className={styles.name} data-list-name={i}>
                    <TLink href={listHref(slug)} transitionLabel={CHARACTER_NAMES[slug]}>
                      {CHARACTER_NAMES[slug]}
                    </TLink>
                  </div>
                  {frame ? (
                    <button
                      type="button"
                      className={styles.open}
                      data-list-open={i}
                      data-cursor="Click to view"
                      aria-disabled="true"
                      aria-label={`Open the picture of ${frame.name}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    ),
  };
}
