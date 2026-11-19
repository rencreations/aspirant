import type { Route } from "next";
import { Fragment, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import type { PlayerVideo } from "@/components/video-player/player-overlay";
import { libUrl } from "@/lib/library";

import filmsFile from "../../../../../public/data/library/video-films.json";
import { STRIP } from "../../content";
import styles from "../../home.module.css";
import { PREVIEWS, TRAILER_FILM } from "../../fx/video-plane/data";
import type { SectionMarkup } from "../../kernel/types";

import { DECK_READOUT, DECK_STRIPS } from "./deck-copy";
import { focusScreensOf, STRIP_FOCUS_AT } from "./dwell";
import { StripPlayerHost } from "./player";
import dk from "./deck.module.css";
import local from "./strip.module.css";

const firstStrip = DECK_STRIPS[0] ?? "";
const longestStrip = DECK_STRIPS.reduce((a, b) => (b.length > a.length ? b : a), "");

/** A word made of letters the runtime can bring in one by one: the plain text for the reader, the letters for the eye. */
function Chars({ text, group }: { text: string; group: string }) {
  return (
    <>
      <span className={local.plain}>{text}</span>
      <span className={dk.chars} aria-hidden="true" data-strip-chars={group}>
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

/** The letters of one layer of a swap: every character is a letter of its own (a space is kept as a blank one). */
function SwapLayer({ text, name }: { text: string; name: "rest" | "hover" }) {
  return (
    <span
      className={name === "hover" ? `${local.swapLayer} ${local.swapHover}` : local.swapLayer}
      data-sw-layer={name}
    >
      {Array.from(text).map((c, i) => (
        <span key={i} className={local.sw} data-sw="">
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

/**
 * A word that changes letter by letter on a hover: the word at rest and the word of the hover stand
 * in one grid cell (so the cell is as wide as the wider, and nothing under it moves), the runtime
 * gives each letter its own moment. The plain text is what a reader gets; the letters are for the eye.
 */
function Swap({ rest, hover, slot }: { rest: string; hover: string; slot: number }) {
  return (
    <span className={local.swapWord} data-strip-swap={slot}>
      <span className={local.plain} data-sw-plain="">
        {rest}
      </span>
      <span className={local.swapStack} aria-hidden="true">
        <SwapLayer text={rest} name="rest" />
        <SwapLayer text={hover} name="hover" />
      </span>
    </span>
  );
}

/** The five marks of a band: each is one shape at a time (the controller changes `data-kind`). */
function MarkShapes() {
  return (
    <svg className={dk.mark} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g className={dk.kindPlus}>
        <rect x="0" y="7" width="16" height="2" fill="currentColor" />
        <rect x="7" y="0" width="2" height="16" fill="currentColor" />
      </g>
      <g className={dk.kindX} transform="rotate(45 8 8)">
        <rect x="-0.5" y="7" width="17" height="2.2" style={{ fill: "var(--deck-cyan)" }} />
        <rect x="6.9" y="-0.5" width="2.2" height="17" style={{ fill: "var(--deck-cyan)" }} />
      </g>
      <g className={dk.kindCircle}>
        <circle cx="8" cy="8" r="7" style={{ fill: "var(--deck-ice)" }} />
      </g>
      <g className={dk.kindTriangle}>
        <path d="M8 1.2 15.2 14.4H.8Z" style={{ fill: "var(--deck-blue)" }} />
      </g>
      <g className={dk.kindHalf}>
        <path d="M.8 11.5a7.2 7.2 0 0 1 14.4 0Z" style={{ fill: "var(--deck-sky)" }} />
      </g>
    </svg>
  );
}

/** A band above or below the picture: five marks, and a strip of running words that takes their place on a hover. */
function Band({
  position,
  firstLine,
  longestLine,
}: {
  position: "top" | "bottom";
  firstLine: string;
  longestLine: string;
}) {
  return (
    <div className={`${dk.band} ${position === "top" ? dk.bandTop : dk.bandBottom}`}>
      <div className={dk.marks}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={dk.markSlot} data-deck="mark-slot">
            <span className={dk.markEmerge} data-deck="mark-emerge">
              <span className={dk.markSwap} data-deck="mark-swap" data-kind="plus">
                <MarkShapes />
              </span>
            </span>
          </span>
        ))}
      </div>
      <div className={dk.strip} data-deck="strip">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={dk.stripItem} data-deck="strip-item">
            <svg className={dk.stripArrows} viewBox="0 0 26 8" aria-hidden="true" focusable="false">
              <path d="M0 0 7 4 0 8ZM9.5 0l7 4-7 4ZM19 0l7 4-7 4Z" fill="currentColor" />
            </svg>
            <span className={dk.stripMask}>
              <span className={dk.stripSizer}>{longestLine}</span>
              <span className={dk.stripText} data-deck="strip-text">
                {firstLine}
              </span>
              <span className={dk.stripText} data-deck="strip-text" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** One of the two big words, a letter at a time: each letter is a mask with two glyphs (it rolls over). */
function PlayWord({ text }: { text: string }) {
  return (
    <span className={dk.playWord} data-deck="word">
      <span className={dk.plain}>{text}</span>
      <span className={dk.playChars} aria-hidden="true">
        {Array.from(text.toUpperCase()).map((char, index) => (
          <span key={index} className={dk.char} data-deck="char">
            <span className={dk.charMask}>
              <span className={dk.charTrack} data-deck="char-track">
                <span className={dk.glyph}>{char}</span>
                <span className={dk.glyph}>{char}</span>
              </span>
            </span>
          </span>
        ))}
      </span>
    </span>
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
            transitionLabel="Films"
            data-strip-cta=""
            data-home-focus-at={focusScreensOf(STRIP_FOCUS_AT.small)}
          >
            {STRIP.button.label}
          </TLink>
        </div>

        <p className={`${local.mono} ${local.coord} ${local.coordLeft}`} data-strip-g="coordl">
          <Chars text={STRIP.middleLeft} group="coordl" />
        </p>
        <p className={`${local.mono} ${local.coord} ${local.coordRight}`} data-strip-g="coordr">
          <Chars text={STRIP.middleRight} group="coordr" />
        </p>

        <div className={local.bottomBox} data-strip-g="bottom">
          <p className={`${local.display} ${local.smallWord}`}>
            <Swap rest={STRIP.bottomLeft.rest[0]} hover={STRIP.bottomLeft.hover[0]} slot={0} />
          </p>
          <p className={`${local.display} ${local.bigWord}`}>
            <Swap rest={STRIP.bottomLeft.rest[1]} hover={STRIP.bottomLeft.hover[1]} slot={1} />
          </p>
        </div>

        <div
          className={dk.deck}
          data-strip-deck=""
          style={{ "--wa": TRAILER_FILM.aspect } as CSSProperties}
        >
          <span className={dk.scrim} aria-hidden="true" />
          <div className={dk.deco} aria-hidden="true">
            <Band position="top" firstLine={firstStrip} longestLine={longestStrip} />
            <Band position="bottom" firstLine={firstStrip} longestLine={longestStrip} />
          </div>
          <div className={dk.readout} data-deck="readout" aria-hidden="true">
            <span className={dk.readoutDot} />
            <span className={dk.readoutMask}>
              <span className={dk.readoutLine} data-deck="readout-line">
                {DECK_READOUT[0]}
              </span>
              <span className={dk.readoutLine} data-deck="readout-line" />
            </span>
          </div>
          <div className={dk.words}>
            <PlayWord text={STRIP.play.left} />
            <PlayWord text={STRIP.play.right} />
          </div>
          <div className={dk.magnet}>
            <span className={dk.watchRing} data-deck="watch-ring" aria-hidden="true" />
            <button
              type="button"
              className={dk.play}
              data-strip-play=""
              data-home-focus-at={focusScreensOf(STRIP_FOCUS_AT.window)}
              aria-label={STRIP.play.open}
              aria-haspopup="dialog"
            >
              <span className={dk.watchFill} aria-hidden="true" />
              <svg
                className={dk.watchIcon}
                data-deck="watch-icon"
                viewBox="0 0 36 36"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M12 9.6v16.8c0 1.3 1.4 2.1 2.5 1.4l13.3-8.4c1-.6 1-2.1 0-2.8L14.5 8.2c-1.1-.7-2.5.1-2.5 1.4Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <p className={styles.srOnly}>{STRIP.play.duration}</p>
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
            data-home-focus-at={focusScreensOf(STRIP_FOCUS_AT.hold)}
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
                data-home-focus-at={focusScreensOf(STRIP_FOCUS_AT.hold)}
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
