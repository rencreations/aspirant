"use client";

import { useEffect, type CSSProperties, type SyntheticEvent } from "react";

import { TLink } from "@/components/transition/t-link";

import { LEDGER, type LedgerRow } from "../content";
import { stageRefs } from "../stage-bus";

import { useArrive } from "./arrive";
import kit from "./kit.module.css";
import styles from "./ledger.module.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * A figure that counts up like a mechanical counter: each digit is a strip of the ten figures
 * behind a window one figure tall, and the strip rolls to its place when the row arrives. The
 * last digit goes round once more than the others. Only a transform moves, so nothing is laid
 * out again and nothing is written per frame.
 */
function Counter({ value }: { value: number }) {
  // The figure as the site writes a count ("3,046"): the comma stands still between the strips.
  const chars = value.toLocaleString("en-US").split("");
  const digits = chars.filter((c) => c !== ",").length;
  // Each digit's place among the digits (a comma has none).
  const places = chars.map((c, at) =>
    c === "," ? -1 : chars.slice(0, at).filter((d) => d !== ",").length,
  );
  return (
    <span className={styles.counter} aria-hidden="true">
      {chars.map((char, at) => {
        if (char === ",") {
          return (
            <span key={at} className={styles.sep}>
              ,
            </span>
          );
        }
        const k = places[at] ?? 0;
        const digit = Number(char);
        const turns = k === digits - 1 ? 1 : 0;
        const cells = Array.from({ length: turns + 1 }, () => DIGITS).flat();
        return (
          <span key={at} className={styles.col}>
            <span
              className={styles.strip}
              style={{ "--to": turns * 10 + digit, "--k": digits - 1 - k } as CSSProperties}
            >
              {cells.map((cell, n) => (
                <span key={n} className={styles.cell}>
                  {cell}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** What a row shows. It is drawn twice: in ink on the paper, and in paper on the ink plate. */
function Face({ row, index, copy = false }: { row: LedgerRow; index: number; copy?: boolean }) {
  return (
    <span className={styles.face}>
      <span className={`${styles.index} ${kit.rise}`} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className={`display ${styles.figure}`}>
        {copy ? null : <span className="sr-only">{row.figure.toLocaleString("en-US")} </span>}
        <Counter value={row.figure} />
      </span>
      <span className={styles.text}>
        <span className={kit.mask}>
          <span className={`display ${kit.line} ${styles.unit}`}>{row.unit}</span>
        </span>
        <span className={`${styles.line} ${kit.rise}`} style={i(2)}>
          {row.line}
        </span>
      </span>
      <span className={`${styles.room} ${kit.rise}`} style={i(3)}>
        {row.room}
      </span>
      <span className={`${styles.go} ${kit.rise}`} style={i(3)} aria-hidden="true" data-go="">
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
          <path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5" />
        </svg>
      </span>
    </span>
  );
}

/**
 * The drone looks at the row the visitor is on: at its arrow, which is the last thing before the
 * lane the drone floats in. Only read here, never written.
 */
function look(event: SyntheticEvent<HTMLElement>) {
  const row = event.currentTarget;
  const box = (row.querySelector("[data-go]") ?? row).getBoundingClientRect();
  stageRefs.gaze = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function rest() {
  stageRefs.gaze = null;
}

/**
 * What was made around the skins, as six large figures in hairline rows. A row is one link to the
 * room that keeps the thing it counts. Its figure rolls up when it arrives; on hover a slanted
 * plate of ink wipes in behind it and the drone turns to look at it.
 *
 * The list is longer than a screen, so the drone does not wait at one end of it. The right of the
 * section is a lane the words keep out of (the hairlines and the plate run through it), and the
 * drone's place is a square that starts beside the head and then stays at one height of the
 * screen while the rows pass (sticky inside a rail as tall as the head and the list).
 */
export function Ledger() {
  const ref = useArrive<HTMLElement>();

  useEffect(() => rest, []);

  return (
    <section
      ref={ref}
      className={`${kit.section} ${styles.ledger}`}
      data-about-section="ledger"
      aria-labelledby="about-ledger"
    >
      <div className={`${kit.inner} ${styles.inner}`}>
        <header className={styles.head} data-in="false">
          <p className={kit.eyebrow}>
            <b>04</b>
            <span>Around the skins</span>
            <span className={kit.eyebrowRule} aria-hidden="true" />
          </p>
          <h2 id="about-ledger" className={`display ${kit.title}`}>
            <span className={kit.mask}>
              <span className={kit.line}>Aspirant </span>
            </span>
            <span className={kit.mask}>
              <span className={kit.line} style={i(1)}>
                resources
              </span>
            </span>
          </h2>
          <p className={`serif ${kit.lead} ${kit.rise}`} style={i(4)}>
            Aspirant produced many content from each phases that you can view below.
          </p>
        </header>

        <div className={styles.rail} aria-hidden="true">
          <div
            className={`${kit.anchor} ${styles.anchor}`}
            data-drone-anchor="ledger"
            data-drone-face="scan"
            data-drone-turn={-30}
          />
        </div>

        <ul className={styles.rows}>
          {LEDGER.map((row, index) => (
            <li key={row.id} className={styles.item} data-in="false">
              <TLink
                href={row.href}
                className={styles.row}
                transitionLabel={row.room}
                onPointerEnter={look}
                onPointerMove={look}
                onPointerLeave={rest}
                onPointerCancel={rest}
                onFocus={look}
                onBlur={rest}
              >
                <Face row={row} index={index} />
                <span className={styles.plate} aria-hidden="true">
                  <span className={styles.plateIn}>
                    <Face row={row} index={index} copy />
                  </span>
                </span>
              </TLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
