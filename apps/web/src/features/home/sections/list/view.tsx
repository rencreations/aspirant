import { TLink } from "@/components/transition/t-link";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { LIST, listHref } from "../../content";
import type { SectionMarkup } from "../../kernel/types";

import { PICTURE_FRAMES, SELENA_FRAME } from "./frames";
import styles from "./list.module.css";

/** The posters of the strip in order: the nine pictures, then Selena's card. */
const POSTERS: readonly string[] = [...PICTURE_FRAMES.map((f) => f.poster), SELENA_FRAME.poster];

/** The four sides of the dashed line, in the order it is drawn: top, right, bottom, left. */
const EDGES = ["top", "right", "bottom", "left"] as const;

/**
 * What the server draws for the section (the oryzo.ai strip). The frames and the small pictures are
 * pictures in the layer under the canvas (the pair and Selena are drawn in front of them); the words,
 * the links, the hint and the one button that opens a picture are in the text layer, over everything.
 * Every name is a real link to the Aspirant's page, in the owner's order, so the plain page is a
 * readable list.
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
        {[0, 1].map((side) => (
          <div key={side} className={styles.side} data-list-side={side === 0 ? "left" : "right"}>
            <div className={styles.thumbRow} data-list-thumbs={side === 0 ? "left" : "right"}>
              {POSTERS.map((src, i) =>
                // The left row holds the frames that came before the one in the window, the right
                // row the ones to come: each row is clipped where the window begins.
                (side === 0 ? i < POSTERS.length - 1 : i > 0) ? (
                  <div key={src} className={styles.thumb} data-list-thumb={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a decorative small picture */}
                    <img src={src} alt="" decoding="async" fetchPriority="low" draggable={false} />
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
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
                    fetchPriority="low"
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
                  fetchPriority="low"
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.chrome} data-list-chrome="">
          {EDGES.map((edge, i) => (
            <i key={edge} className={`${styles.edge} ${styles[edge] ?? ""}`} data-list-edge={i}>
              <b className={styles.dash} />
            </i>
          ))}
          {EDGES.map((edge) => (
            <i
              key={edge}
              className={`${styles.tick} ${styles[`tick-${edge}`] ?? ""}`}
              data-list-tick=""
            />
          ))}
          <i className={styles.dot} data-list-dot="" />
        </div>
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
        <div className={styles.cueRow} data-list-cuerow="" aria-hidden="true">
          <div className={styles.cue} data-list-cue="">
            <span className={styles.ring}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M3 4.6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Scroll to continue</span>
          </div>
        </div>
      </div>
    ),
  };
}
