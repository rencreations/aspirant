import type { Route } from "next";
import { Fragment } from "react";

import { TLink } from "@/components/transition/t-link";
import type { PlayerVideo } from "@/components/video-player/player-overlay";
import { libUrl } from "@/lib/library";

import filmsFile from "../../../../../public/data/library/video-films.json";
import { STRIP } from "../../content";
import styles from "../../home.module.css";
import { PREVIEWS, TRAILER_FILM } from "../../fx/video-plane/data";
import type { SectionMarkup } from "../../kernel/types";

import { StripPlayerHost } from "./player";
import local from "./strip.module.css";

/** A word made of letters the runtime can bring in one by one: the plain text for the reader, the letters for the eye. */
function Chars({ text, group }: { text: string; group: string }) {
  return (
    <>
      <span className={local.plain}>{text}</span>
      <span className={local.chars} aria-hidden="true" data-strip-chars={group}>
        {text.split(" ").map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? " " : null}
            <span className={local.word}>
              {Array.from(word).map((c, i) => (
                <span key={i} className={local.ch} data-ch="">
                  {c}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  );
}

/** A word that changes on a hover (the runtime writes into the aria-hidden copy; the plain text stays the resting word). */
function Swap({ text, slot }: { text: string; slot: number }) {
  return (
    <>
      <span className={local.plain}>{text}</span>
      <span className={local.swap} aria-hidden="true" data-strip-swap={slot}>
        {text}
      </span>
    </>
  );
}

/** The trailer for the site's player: the collection's own film, which the strip's loop is cut from. */
function trailer(): PlayerVideo {
  const record = filmsFile.items.find((item) => item.id === TRAILER_FILM.id);
  if (!record) throw new Error(`The collection has no film called ${TRAILER_FILM.id}.`);
  const v = record.video;
  return {
    title: record.title,
    poster: libUrl(v.poster),
    sources: [{ label: `${v.h}p`, height: v.h, src: libUrl(v.src) }],
  };
}

/**
 * What the server draws for the section. The `below` part is the scene's chrome (the centre line, the
 * dots, the arcs), drawn under the film. The text part is the words of the reference's hero, in the
 * request's own order, the window's play button, the words of "Official animations for The Aspirants"
 * and a real link for each of the ten films (the films themselves are drawn on the canvas). The runtime
 * moves and fades the parts it finds by `data-strip-*`. Without scripts it is one readable column.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={local.sceneBelow} data-strip-below="">
        <div className={local.arcs} data-strip-arcs="">
          <svg viewBox="0 0 200 200">
            <path d="M199.7 100 A99.7 99.7 0 0 1 100 199.7" />
            <path d="M0.3 100 A99.7 99.7 0 0 1 100 0.3" />
            <circle cx="199.7" cy="100" r="1.3" fill="#878788" stroke="none" />
            <circle cx="0.3" cy="100" r="1.3" fill="#878788" stroke="none" />
          </svg>
        </div>
        <div className={local.line} data-strip-line="" />
        <i className={`${local.dot} ${local.endDot}`} data-strip-end="l" />
        <i className={`${local.dot} ${local.endDot}`} data-strip-end="r" />
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <i key={c} className={local.dot} data-strip-corner={c} />
        ))}
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <i key={c} className={local.cornerPlus} data-strip-cplus={c} />
        ))}
      </div>
    ),
    text: (
      <div className={local.scene} data-strip="">
        <h2 className={styles.srOnly}>Trailer</h2>

        <div className={local.brandBox} data-strip-g="brand">
          <p className={`${local.mono} ${local.brand}`}>
            <Chars text={STRIP.topLeft} group="brand" />
          </p>
          <i
            className={`${local.plus} ${local.plusRight}`}
            data-strip-plus="r"
            aria-hidden="true"
          />
          <i className={`${local.plus} ${local.plusDown}`} data-strip-plus="d" aria-hidden="true" />
        </div>

        <div className={local.rightBox}>
          <p className={`${local.mono} ${local.agency}`}>
            <Chars text={STRIP.topRight} group="agency" />
          </p>
          <p className={`${local.display} ${local.videoWord}`} data-strip-g="video">
            <Chars text={STRIP.topRightTag} group="video" />
          </p>
          <TLink
            href={STRIP.button.href}
            className={`${styles.pill} ${local.cta}`}
            transitionLabel="Collection"
            data-strip-cta=""
            data-home-focus-at="0.3"
          >
            {STRIP.button.label}
          </TLink>
        </div>

        <button
          type="button"
          className={local.scrollButton}
          data-strip-scroll=""
          data-home-focus-at="0.3"
          aria-label={STRIP.controls.scroll}
        >
          <i />
          <i />
          <i />
        </button>

        <p className={`${local.mono} ${local.coord} ${local.coordLeft}`} data-strip-g="coordl">
          <Chars text={STRIP.middleLeft} group="coordl" />
        </p>
        <p className={`${local.mono} ${local.coord} ${local.coordRight}`} data-strip-g="coordr">
          <Chars text={STRIP.middleRight} group="coordr" />
        </p>

        <div className={local.bottomBox} data-strip-g="bottom">
          <p className={`${local.display} ${local.smallWord}`}>
            <Swap text={STRIP.bottomLeft.rest[0]} slot={0} />
          </p>
          <p className={`${local.display} ${local.bigWord}`}>
            <Swap text={STRIP.bottomLeft.rest[1]} slot={1} />
          </p>
        </div>

        <div className={local.windowBox} data-strip-window="">
          <span className={local.scrim} aria-hidden="true" />
          <span className={`${local.mono} ${local.windowWord}`} data-strip-g="wl">
            <Chars text={STRIP.play.label} group="wl" />
          </span>
          <button
            type="button"
            className={local.play}
            data-strip-play=""
            data-home-focus-at="1.35"
            aria-label={STRIP.play.open}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.2v11.6L13.6 8z" />
            </svg>
          </button>
          <span className={`${local.mono} ${local.windowWord}`} data-strip-g="wd">
            <Chars text={STRIP.play.duration} group="wd" />
          </span>
        </div>

        <div className={local.amb} data-strip-amb="">
          <span className={local.ambScrim} data-strip-amb-scrim="" aria-hidden="true" />
          <h2 className={local.ambHeading}>
            <span className={local.ambLead} data-strip-g="ambl">
              <Chars text={STRIP.expand.lead} group="ambl" />
            </span>
            <span className={local.ambBig} data-strip-g="ambb">
              <Chars text={STRIP.expand.title} group="ambb" />
            </span>
          </h2>
          <p className={local.ambBody} data-strip-g="ambt">
            <Chars text={STRIP.expand.body} group="ambt" />
          </p>
          <TLink
            href={STRIP.expand.button.href}
            className={`${styles.pill} ${local.ambButton}`}
            transitionLabel="Films"
            data-strip-button=""
            data-home-focus-at="2.4"
          >
            {STRIP.expand.button.label}
          </TLink>
        </div>

        <ul className={local.previews} aria-label={STRIP.controls.previews}>
          {PREVIEWS.map((film) => (
            <li key={film.id}>
              <TLink
                href={film.href as Route}
                transitionLabel={film.title}
                data-strip-film=""
                data-home-focus-at="2.4"
              >
                {film.title}
              </TLink>
            </li>
          ))}
        </ul>

        <StripPlayerHost video={trailer()} />
      </div>
    ),
  };
}
