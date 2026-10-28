"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { asset } from "@/lib/asset";

import { CHAPTERS, DRAMA_NODES, DRAMA_START, nodeById } from "./drama-graph";
import {
  GRAPH_COLUMNS,
  GRAPH_ROWS,
  edgeMiddle,
  edgePath,
  graphEdges,
  graphNodes,
  neighbour,
  type Move,
} from "./drama-layout";
import { dramaThumb } from "./drama-media";
import { hasSeenEnding, isCrossed, isUnlocked, type DramaSave } from "./drama-state";
import styles from "./levels.module.css";

interface LevelSelectProps {
  save: DramaSave;
  /** The episode of the run that is open, if there is one: it is marked "you are here". */
  here: string | null;
  onBack: () => void;
  onPlayFrom: (id: string) => void;
}

/** The graph is drawn on a grid of 100 units to a column and a row: 600 wide, 300 high. */
const COL = 100;
const ROW = 100;
const HALF_CARD = 36;
const BELOW = GRAPH_ROWS * ROW - 8;

const MOVES: Readonly<Record<string, Move>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const pct = (n: number, of: number) => `${String(Math.round((n / of) * 1000) / 10)}%`;

/**
 * The decision tree. Six columns, one for each chapter, and a line for every answer. Only what the
 * player has been to is open: the other episodes are locked, with their place in the tree still
 * drawn, so it is clear where the answers can lead. An episode that is open can be played from.
 */
export function LevelSelect({ save, here, onBack, onPlayFrom }: LevelSelectProps) {
  const nodes = useMemo(() => graphNodes(), []);
  const edges = useMemo(() => graphEdges(), []);
  const [selected, setSelected] = useState(here ?? DRAMA_START);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const board = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // The focus follows the keys.
  useEffect(() => {
    if (moved.current) cards.current.get(selected)?.focus({ preventScroll: true });
  }, [selected]);

  // On a narrow screen the tree is wider than the screen and slides sideways: the chosen episode
  // is kept in the middle. (Only the board moves, never the page.)
  const first = useRef(true);
  useEffect(() => {
    const el = cards.current.get(selected);
    const box = board.current;
    if (!el || !box) return;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const left = box.scrollLeft + (a.left + a.width / 2) - (b.left + b.width / 2);
    box.scrollTo({ left, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  }, [selected]);

  // On opening, the focus is on the card that is selected.
  useEffect(() => {
    cards.current.get(here ?? DRAMA_START)?.focus({ preventScroll: true });
  }, [here]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onBack();
      return;
    }
    const target = e.target as HTMLElement;
    // Enter on an episode that is open plays from it (a mouse or a finger has the button for that).
    if (e.key === "Enter" && target.closest("[data-card]")) {
      if (isUnlocked(save, selected)) {
        e.preventDefault();
        e.stopPropagation();
        onPlayFrom(selected);
      }
      return;
    }
    const move = MOVES[e.key];
    if (!move) return;
    if (!target.closest("[data-card]")) return;
    e.preventDefault();
    e.stopPropagation();
    const next = neighbour(nodes, selected, move);
    if (next) {
      moved.current = true;
      setSelected(next);
    }
  };

  const node = nodeById(selected);
  const open = isUnlocked(save, selected);
  const seen = hasSeenEnding(save, selected);

  return (
    <div
      className={styles.levels}
      role="group"
      aria-label="Level select"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div ref={board} className={styles.board}>
        <div className={styles.sheet}>
          <div className={styles.captions} aria-hidden="true">
            {CHAPTERS.map((c) => (
              <span key={c.number}>
                <b>{c.number}</b>
                {c.title}
              </span>
            ))}
          </div>
          <div className={styles.graph}>
            <svg
              className={styles.edges}
              viewBox={`0 0 ${String(GRAPH_COLUMNS * COL)} ${String(GRAPH_ROWS * ROW)}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {edges.map((e) => {
                const a = pos.get(e.from);
                const b = pos.get(e.to);
                if (!a || !b) return null;
                const from = { x: (a.col + 0.5) * COL + HALF_CARD, y: (a.row + 0.5) * ROW };
                const to = { x: (b.col + 0.5) * COL - HALF_CARD, y: (b.row + 0.5) * ROW };
                const crossed = isCrossed(save, e.from, e.choice);
                const state = crossed ? "crossed" : isUnlocked(save, e.from) ? "open" : "far";
                return (
                  <path
                    key={`${e.from}:${String(e.choice)}`}
                    d={edgePath(from, to, e.skip, BELOW)}
                    className={styles.edge}
                    data-state={state}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            {edges.map((e) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              // Tags are only written on the answers that touch the episode that is chosen: all of them
              // at once would run into the cards.
              if (e.from !== selected && e.to !== selected) return null;
              const crossed = isCrossed(save, e.from, e.choice);
              const known = isUnlocked(save, e.from);
              if (!crossed && !known) return null;
              const from = { x: (a.col + 0.5) * COL + HALF_CARD, y: (a.row + 0.5) * ROW };
              const to = { x: (b.col + 0.5) * COL - HALF_CARD, y: (b.row + 0.5) * ROW };
              const mid = edgeMiddle(from, to, e.skip, BELOW);
              const choice = nodeById(e.from).choices[e.choice];
              return (
                <span
                  key={`${e.from}:${String(e.choice)}`}
                  className={styles.tag}
                  data-crossed={crossed}
                  style={{
                    left: pct(mid.x, GRAPH_COLUMNS * COL),
                    top: pct(mid.y, GRAPH_ROWS * ROW),
                  }}
                  title={crossed ? choice?.label : undefined}
                >
                  {crossed ? choice?.tag : "?"}
                </span>
              );
            })}
            {DRAMA_NODES.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              const isOpen = isUnlocked(save, n.id);
              const state = isOpen ? (hasSeenEnding(save, n.id) ? "ending" : "open") : "locked";
              return (
                <button
                  key={n.id}
                  ref={(el) => {
                    if (el) cards.current.set(n.id, el);
                    else cards.current.delete(n.id);
                  }}
                  type="button"
                  data-card
                  className={styles.card}
                  data-state={state}
                  data-selected={selected === n.id}
                  data-here={here === n.id}
                  aria-pressed={selected === n.id}
                  aria-label={
                    isOpen
                      ? `Chapter ${String(n.chapter)}, ${n.title}`
                      : `Chapter ${String(n.chapter)}, locked`
                  }
                  style={{
                    left: pct((p.col + 0.5) * COL, GRAPH_COLUMNS * COL),
                    top: pct((p.row + 0.5) * ROW, GRAPH_ROWS * ROW),
                    width: pct(HALF_CARD * 2, GRAPH_COLUMNS * COL),
                  }}
                  onClick={() => {
                    setSelected(n.id);
                  }}
                  onFocus={() => {
                    setSelected(n.id);
                  }}
                >
                  <span className={styles.thumb}>
                    {isOpen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset(dramaThumb(n.file))}
                        alt=""
                        draggable={false}
                        loading="lazy"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={styles.name}>{isOpen ? n.title : "???"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className={styles.info} aria-live="polite">
        <p className={styles.chapter}>
          Chapter {node.chapter}
          {open && node.ending ? <span>{seen ? "Ending seen" : "Ending"}</span> : null}
        </p>
        <h3 className={styles.title}>{open ? node.title : "???"}</h3>
        <p className={styles.summary}>
          {open ? node.summary : "You have not reached this episode yet. Play on to open it."}
        </p>
        {open && node.choices.length > 0 ? (
          <ul className={styles.answers} aria-label="Answers">
            {node.choices.map((c, i) => {
              const crossed = isCrossed(save, node.id, i);
              return (
                <li key={c.tag} data-crossed={crossed}>
                  {crossed ? (
                    <>
                      <b>{c.tag}</b>
                      <span>leads to {nodeById(c.to).title}</span>
                    </>
                  ) : (
                    <>
                      <b>?</b>
                      <span>Not chosen yet</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className={styles.actions}>
          {open && here !== null ? (
            <p className={styles.warn}>
              {here === node.id
                ? "This episode starts again from its beginning."
                : "Your run in progress is replaced. What you unlocked stays."}
            </p>
          ) : null}
          <button
            type="button"
            className={styles.play}
            disabled={!open}
            onClick={() => {
              onPlayFrom(node.id);
            }}
          >
            Play from here
          </button>
          <button type="button" className={styles.back} onClick={onBack}>
            Back
          </button>
        </div>
      </aside>
    </div>
  );
}
