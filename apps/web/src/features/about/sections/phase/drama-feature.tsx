"use client";

import { useId, useState, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import styles from "./drama-feature.module.css";
import {
  countWord,
  DRAMA_EDGES,
  DRAMA_TREE,
  edgeCurve,
  filmOfStill,
  pointOf,
  type TreeNode,
} from "./drama-tree";
import type { PhaseDrama } from "./types";

/**
 * The two drawings of the tree. Across the page the chapters run from left to right; on a narrow
 * screen the drawing stands upright and they run down. `box` is the drawing's own frame, with
 * room on one side for the one answer that skips a chapter.
 */
const WIDE = {
  across: 1200,
  span: 280,
  box: { x: 0, y: -205, w: 1200, h: 460 },
  /** A still, as a share of the drawing's width, and its shape. */
  lit: 14,
} as const;
const TALL = {
  across: 900,
  span: 232,
  box: { x: -186, y: 0, w: 400, h: 900 },
  lit: 31,
} as const;

function Edges({ upright, hot }: { upright: boolean; hot: string | null }) {
  const shape = upright ? TALL : WIDE;
  const size = { across: shape.across, span: shape.span, chapters: 6 };
  const at = (id: string) => {
    const node = DRAMA_TREE.find((n) => n.id === id);
    return node ? pointOf(node, size, upright) : { x: 0, y: 0 };
  };
  return (
    <span className={styles.wipe} data-upright={upright}>
      <svg
        className={styles.edges}
        viewBox={`${shape.box.x} ${shape.box.y} ${shape.box.w} ${shape.box.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {DRAMA_EDGES.map((edge) => {
          const a = at(edge.from);
          const b = at(edge.to);
          const skip = Math.abs(Number.parseInt(edge.to, 10) - Number.parseInt(edge.from, 10)) > 1;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              className={styles.edge}
              data-hot={hot === edge.from || hot === edge.to}
              d={edgeCurve(a, b, upright, skip ? shape.span * 0.34 : 0)}
            />
          );
        })}
      </svg>
    </span>
  );
}

function place(node: TreeNode): CSSProperties {
  const spot = (shape: typeof WIDE | typeof TALL, upright: boolean) => {
    const p = pointOf(node, { across: shape.across, span: shape.span, chapters: 6 }, upright);
    return {
      x: `${(((p.x - shape.box.x) / shape.box.w) * 100).toFixed(3)}%`,
      y: `${(((p.y - shape.box.y) / shape.box.h) * 100).toFixed(3)}%`,
    };
  };
  const wide = spot(WIDE, false);
  const tall = spot(TALL, true);
  return {
    "--wx": wide.x,
    "--wy": wide.y,
    "--tx": tall.x,
    "--ty": tall.y,
    "--c": node.chapter,
  } as CSSProperties;
}

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * The interactive drama of the fourth phase, as a small console on the page's own paper: the
 * decision tree of the game, drawn as it is (thirteen films, six chapters, twenty answers, three
 * endings), with one picture for each chapter standing on its film and the other films as empty
 * frames. The lines draw themselves from the first chapter, the frames are dealt out chapter by
 * chapter, and a frame under the pointer comes forward and lights the answers that lead to it and
 * away from it. The whole console is one link to the drama.
 */
export function DramaFeature({ drama }: { drama: PhaseDrama }) {
  const titleId = useId();
  const [hot, setHot] = useState<string | null>(null);
  // The title is set on two lines: its last word stands alone.
  const words = drama.title.split(" ");
  const stills = new Map(drama.stills.map((still) => [filmOfStill(still.id), still]));

  return (
    <section
      className={styles.drama}
      data-phase-part="drama"
      data-phase="4"
      aria-labelledby={titleId}
    >
      <div className={styles.say} data-in="false">
        <div className={styles.name}>
          <p className={styles.eyebrow}>
            <b>Interactive drama</b>
            <span className={styles.eyebrowRule} aria-hidden="true" />
            <span>Official</span>
          </p>
          <h4 id={titleId} className={`display ${styles.title}`}>
            <span className={styles.mask}>
              <span className={styles.line}>{words.slice(0, -1).join(" ")} </span>
            </span>
            <span className={styles.mask}>
              <span className={styles.line} style={i(1)}>
                {words.at(-1)}
              </span>
            </span>
          </h4>
        </div>
        <div className={styles.facts}>
          <p className={`serif ${styles.lead} ${styles.rise}`} style={i(2)}>
            An official interactive drama in {countWord(drama.chapters)} chapters, with{" "}
            {countWord(drama.endings)} endings. It plays here, in the browser.
          </p>
          <dl className={styles.figures}>
            <div className={styles.rise} style={i(3)}>
              <dt>Chapters</dt>
              <dd className="display">{drama.chapters}</dd>
            </div>
            <div className={styles.rise} style={i(4)}>
              <dt>Endings</dt>
              <dd className="display">{drama.endings}</dd>
            </div>
          </dl>
          <TLink
            href={drama.href}
            className={`${styles.pill} ${styles.rise}`}
            style={i(5)}
            transitionLabel="Interactive drama"
            data-cursor="PLAY"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path
                d="M4.2 2.3v11.4c0 .6.7 1 1.2.6l8.4-5.7c.5-.3.5-1 0-1.3L5.4 1.7c-.5-.4-1.2 0-1.2.6Z"
                fill="currentColor"
              />
            </svg>
            Play the drama
          </TLink>
        </div>
      </div>

      <TLink
        href={drama.href}
        className={styles.console}
        data-in="false"
        data-in-at="14"
        data-hot={hot !== null}
        tabIndex={-1}
        aria-label="Play the drama"
        transitionLabel="Interactive drama"
        data-cursor="PLAY"
        onPointerLeave={() => {
          setHot(null);
        }}
      >
        <span className={styles.board}>
          <Edges upright={false} hot={hot} />
          <Edges upright hot={hot} />
          {DRAMA_TREE.map((node) => {
            const still = stills.get(node.id);
            const ending = node.to.length === 0;
            return (
              <span
                key={node.id}
                className={styles.node}
                data-lit={still ? "true" : "false"}
                data-ending={ending}
                data-hot={hot === node.id}
                style={place(node)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") setHot(node.id);
                }}
              >
                <span className={styles.frame}>
                  {still ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a still of the drama, a file of the site */}
                      <img
                        className={styles.still}
                        src={asset(still.thumb)}
                        width={480}
                        height={270}
                        alt={still.alt}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className={styles.veil} aria-hidden="true" />
                    </>
                  ) : null}
                  <span className={styles.tag} aria-hidden="true">
                    {node.id}
                  </span>
                </span>
              </span>
            );
          })}
          <span className={styles.axis} aria-hidden="true">
            {Array.from({ length: drama.chapters }, (_, k) => (
              <span key={k} className={styles.tick} style={{ "--c": k } as CSSProperties}>
                {k === drama.chapters - 1
                  ? `${drama.endings} endings`
                  : `Chapter ${String(k + 1).padStart(2, "0")}`}
              </span>
            ))}
          </span>
        </span>
      </TLink>
    </section>
  );
}
