import type { CSSProperties, Ref } from "react";

import { STRIP } from "../../content";

import dk from "./deck.module.css";

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
        <circle cx="8" cy="8" r="7" style={{ fill: "var(--deck-mark-ice)" }} />
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

export function FilmBands({ aspect, lines }: { aspect: number; lines: readonly string[] }) {
  const firstStrip = lines[0] ?? "";
  const longestStrip = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <div
      className={dk.deckBelow}
      data-strip-deck-below=""
      style={{ "--wa": aspect } as CSSProperties}
      aria-hidden="true"
    >
      <div className={dk.deco}>
        <Band position="top" firstLine={firstStrip} longestLine={longestStrip} />
        <Band position="bottom" firstLine={firstStrip} longestLine={longestStrip} />
      </div>
    </div>
  );
}

export function FilmControls({
  aspect,
  readout,
  label,
  focusAt,
  playRef,
  initiallyDisabled,
  duration,
}: {
  aspect: number;
  readout: string;
  label: string;
  focusAt?: string;
  playRef?: Ref<HTMLButtonElement>;
  initiallyDisabled?: boolean;
  duration?: string;
}) {
  return (
    <div className={dk.deck} data-strip-deck="" style={{ "--wa": aspect } as CSSProperties}>
      <span className={dk.scrim} aria-hidden="true" />
      <div className={dk.readout} data-deck="readout" aria-hidden="true">
        <span className={dk.readoutDot} />
        <span className={dk.readoutMask}>
          <span className={dk.readoutLine} data-deck="readout-line">
            {readout}
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
          ref={playRef}
          type="button"
          className={dk.play}
          data-strip-play=""
          disabled={initiallyDisabled}
          data-home-focus-at={focusAt}
          aria-label={label}
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
      {duration && <p className={dk.plain}>{duration}</p>}
    </div>
  );
}
