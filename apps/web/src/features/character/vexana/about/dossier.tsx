"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { getCharacter } from "@/content/characters";
import { useReducedMotion } from "@/lib/hooks";

import styles from "./about.module.css";

const c = getCharacter("vexana");

/** The five notes are five stars. Positions are in units of the sky's width (100 wide, 80 high). */
const STARS = [
  { key: "personality", title: "Temper", mark: "I", x: 15, y: 52 },
  { key: "appearance", title: "Look", mark: "II", x: 29, y: 17 },
  { key: "fighting", title: "Craft", mark: "III", x: 67, y: 11 },
  { key: "motivation", title: "Reason", mark: "IV", x: 87, y: 45 },
  { key: "flaws", title: "Weight", mark: "V", x: 62, y: 71 },
] as const;

/** Where the Emblem sits: the hub every beam leaves from. */
const HUB = { x: 46, y: 42 };

/** The thin thread that joins the stars into a shape, whether or not one is chosen. */
const THREADS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
];

/** The plate: the short facts, as figures that flip into place. */
const FIGURES: ReadonlyArray<readonly [string, string]> = [
  ["Age", c.ageText],
  ["Birthday", c.birthday],
  ["Type", c.mbti],
  ["Partner", "Guinevere"],
];

/** The lead of her file, as the owner wrote it. */
const LEAD =
  "Burdened by a heavy past, Vexana had no friends until Guinevere entered her life and formed the strongest combat duo with her. During one mission, Vexana came face-to-face with the Will of the Planet. She was not corrupted. Instead, her final hope erupted from within: she would step into the darkness and endure terrible pain, protecting the world for Guinevere in her own way!";

const AUTO_MS = 7000;

function line(ax: number, ay: number, bx: number, by: number) {
  return { len: Math.hypot(bx - ax, by - ay), ang: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
}

/** The words of a line arrive one after another. Opacity and a small lift, nothing else moves. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span className={styles.word} style={{ ["--w" as string]: from + i }}>
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

/**
 * Her registry file, read by starlight: a plate of figures that flip into place, and a small sky
 * where the five notes are stars around her Emblem. Choose a star (click, tap or the arrow keys)
 * and a beam runs from the Emblem to it while its note is set word by word. Left alone, the sky
 * walks through the stars itself, and stops for good at the first choice.
 */
export function Dossier() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const touched = useRef(false);
  const held = useRef(false);
  const visible = useRef(false);

  // Walk through the stars by itself while the sky is on screen and nobody has chosen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        visible.current = e?.isIntersecting ?? false;
      },
      { threshold: 0.4 },
    );
    io.observe(root);
    const id = window.setInterval(() => {
      if (touched.current || held.current || !visible.current) return;
      setActive((n) => (n + 1) % STARS.length);
    }, AUTO_MS);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [reduced]);

  const choose = (i: number, focus = false) => {
    touched.current = true;
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const last = STARS.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      choose(active === last ? 0 : active + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(active === 0 ? last : active - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      choose(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      choose(last, true);
    }
  };

  const now = STARS[active] ?? STARS[0];
  const lines = c.sections[now.key];

  return (
    <div ref={rootRef} className={styles.dossier}>
      <p className={styles.summary}>{LEAD}</p>

      <div className={styles.plate} role="group" aria-label="Registry plate">
        <div className={styles.plateHead}>
          <StarGlyph className={styles.plateStar} />
          <span>Registry plate</span>
        </div>
        <span className={styles.stamp} aria-hidden="true">
          <StarGlyph className={styles.stampStar} />
          {c.aspirantName}
        </span>
        <dl className={styles.figures}>
          {FIGURES.map(([k, v], i) => (
            <div key={k} className={styles.cell} style={{ ["--i" as string]: i }}>
              <dt>{k}</dt>
              <dd>
                <span className={styles.face}>{v}</span>
              </dd>
            </div>
          ))}
        </dl>
        <dl className={styles.standing}>
          <div
            className={`${styles.stand} ${styles.standDivision}`}
            style={{ ["--i" as string]: 4 }}
          >
            <dt>Division</dt>
            <dd>
              <strong>Combat Division,</strong>
              <span>Selrick Academy</span>
            </dd>
          </div>
          <div className={`${styles.stand} ${styles.standPower}`} style={{ ["--i" as string]: 5 }}>
            <dt>Combat Power</dt>
            <dd>
              <StarGlyph className={styles.powerStar} />
              <strong>Ace</strong>
            </dd>
          </div>
          <div className={`${styles.stand} ${styles.standStatus}`} style={{ ["--i" as string]: 6 }}>
            <dt>Status</dt>
            <dd>
              <span className={styles.missing}>
                <i className={styles.missingDot} aria-hidden="true" />
                Missing
              </span>
            </dd>
          </div>
        </dl>
        <dl className={styles.stripes}>
          {(
            [
              ["Personality", "Cold and resolute"],
              ["Role", c.role],
              ["Weapon", c.weapon],
            ] as const
          ).map(([k, v], i) => (
            <div key={k} className={styles.stripe} style={{ ["--i" as string]: i + 7 }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className={styles.skyWrap}
        onPointerEnter={() => {
          held.current = true;
        }}
        onPointerLeave={() => {
          held.current = false;
        }}
        onFocus={() => {
          held.current = true;
        }}
        onBlur={() => {
          held.current = false;
        }}
      >
        <div className={styles.sky}>
          <div className={styles.threads} aria-hidden="true">
            {THREADS.map(([a, b]) => {
              const p = STARS[a];
              const q = STARS[b];
              if (!p || !q) return null;
              const l = line(p.x, p.y, q.x, q.y);
              return (
                <i
                  key={`${a}-${b}`}
                  className={styles.thread}
                  style={{
                    ["--x" as string]: p.x,
                    ["--y" as string]: p.y,
                    ["--len" as string]: l.len,
                    ["--ang" as string]: `${l.ang}deg`,
                  }}
                />
              );
            })}
            {STARS.map((s, i) => {
              const l = line(HUB.x, HUB.y, s.x, s.y);
              return (
                <i
                  key={s.key}
                  className={styles.beam}
                  data-on={i === active}
                  style={{
                    ["--x" as string]: HUB.x,
                    ["--y" as string]: HUB.y,
                    ["--len" as string]: l.len,
                    ["--ang" as string]: `${l.ang}deg`,
                  }}
                />
              );
            })}
          </div>

          <div
            className={styles.hub}
            aria-hidden="true"
            style={{ ["--x" as string]: HUB.x, ["--y" as string]: HUB.y }}
          >
            <span className={styles.hubHalo} />
            <StarGlyph className={styles.hubStar} />
            <span className={styles.hubLabel}>Emblem of Hope</span>
          </div>

          <div role="tablist" aria-label="Notes on Vexana" className={styles.stars}>
            {STARS.map((s, i) => (
              <button
                key={s.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`vx-star-${s.key}`}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls="vx-note"
                tabIndex={i === active ? 0 : -1}
                className={styles.star}
                data-on={i === active}
                data-cursor="READ"
                style={{ ["--x" as string]: s.x, ["--y" as string]: s.y, ["--i" as string]: i }}
                onClick={() => {
                  choose(i);
                }}
                onKeyDown={onKey}
              >
                <span className={styles.starHalo} aria-hidden="true" />
                <StarGlyph className={styles.starGlyph} />
                <span className={styles.starLabel}>
                  <span className={styles.starMark} aria-hidden="true">
                    {s.mark}
                  </span>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          id="vx-note"
          role="tabpanel"
          aria-labelledby={`vx-star-${now.key}`}
          aria-live="polite"
          className={styles.note}
        >
          <div key={now.key} className={styles.noteBody}>
            <p className={styles.noteHead}>
              <span className={styles.noteMark} aria-hidden="true">
                {now.mark}
              </span>
              <span className={styles.noteTitle}>{now.title}</span>
            </p>
            <ul className={styles.noteList}>
              {lines.map((t, i) => (
                <li key={t}>
                  <Words
                    text={t}
                    from={lines.slice(0, i).join(" ").split(" ").length * (i ? 1 : 0)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
