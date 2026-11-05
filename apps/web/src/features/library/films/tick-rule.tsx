import type { CSSProperties } from "react";

import styles from "./films.module.css";
import { clock } from "./film-data";
import type { Film } from "./types";

interface RuleProps {
  film: Film;
  /** `strip` sits on a picture, `line` stands alone under it. */
  variant: "strip" | "line";
  /** The scene that is current, when the rule belongs to an open film. */
  current?: number;
  /** When given, the scene ticks are buttons that go to that scene. */
  onSeek?: (index: number) => void;
}

/**
 * A ruler for a film's length. Fine ticks run along it, and a taller tick marks the start of
 * each scene. It is drawn with one gradient and a few small elements, so a whole room of them is cheap.
 */
export function TickRule({ film, variant, current = -1, onSeek }: RuleProps) {
  const dur = film.video.dur;
  return (
    <span className={styles.rule} data-variant={variant} aria-hidden={onSeek ? undefined : "true"}>
      {film.chapters.map((c, i) => {
        if (i === 0 || dur <= 0) return null;
        const at = { left: `${Math.min(99.5, (c.t / dur) * 100)}%` } as CSSProperties;
        return onSeek ? (
          <button
            key={c.t}
            type="button"
            className={styles.ruleMark}
            style={at}
            data-on={current === i}
            tabIndex={-1}
            aria-label={`Scene ${i + 1}, ${clock(c.t)}, ${c.l}`}
            onClick={() => {
              onSeek(i);
            }}
          />
        ) : (
          <i key={c.t} className={styles.ruleMark} style={at} />
        );
      })}
      {variant === "line" ? (
        <span className={styles.ruleEnds} aria-hidden="true">
          <span>0:00</span>
          <span>{clock(dur)}</span>
        </span>
      ) : null}
    </span>
  );
}
