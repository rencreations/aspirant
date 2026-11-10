import type { CSSProperties } from "react";

import { StarButton } from "@/components/ui/star-button";
import { DRAMA_NODES } from "@/features/character/vexana/drama/drama-graph";
import {
  edgePath,
  graphEdges,
  graphNodes,
  GRAPH_COLUMNS,
} from "@/features/character/vexana/drama/drama-layout";

import styles from "./drama-section.module.css";

/** The route through the drama that the story follows (the episode ids, in order). */
const CANON = ["1", "2B", "3B", "4B", "5C", "6C"] as const;

const STEP_X = 96;
const STEP_Y = 74;
const PAD_X = 36;
const PAD_Y = 34;
const NODE_W = 44;
const NODE_H = 28;
const WIDTH = PAD_X * 2 + STEP_X * (GRAPH_COLUMNS - 1) + NODE_W;
const HEIGHT = PAD_Y * 2 + STEP_Y * 2 + NODE_H;

const nodes = graphNodes(DRAMA_NODES);
const edges = graphEdges(DRAMA_NODES);
const at = (id: string) => {
  const n = nodes.find((x) => x.id === id);
  return { x: PAD_X + (n?.col ?? 0) * STEP_X, y: PAD_Y + (n?.row ?? 0) * STEP_Y + NODE_H / 2 };
};
const routeIndex = (id: string) => (CANON as readonly string[]).indexOf(id);
const onRoute = (from: string, to: string) => {
  const i = routeIndex(from);
  return i >= 0 && CANON[i + 1] === to;
};

/**
 * The interactive drama on the story page, made to be seen: a dark console on the white page, the
 * drama's own title, and the decision tree of the six chapters with the route the story follows
 * lit in gold. Nothing in it moves but opacity and transform.
 */
export function DramaSection() {
  return (
    <section className={styles.drama} data-theme="storm" aria-labelledby="drama-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.badge}>
            <span className={styles.live} aria-hidden="true" />
            Part of the lore
          </p>
          <p className={styles.kicker}>The interactive drama</p>
          <h2 id="drama-title" className={styles.title}>
            Become the <span>Aspirants</span>
          </h2>
          <p className={styles.lead}>
            The official game made from the story itself. You make the choices, and the story
            branches. What it shows is canon, and this book follows one of its routes.
          </p>
          <ul className={styles.facts}>
            <li>Six chapters</li>
            <li>Three endings</li>
            <li>Plays in your browser</li>
          </ul>
          <div className={styles.cta}>
            <StarButton
              pulse
              size="lg"
              className={styles.play}
              href="/story/interactive-drama"
              transitionLabel="Interactive drama"
            >
              Play the drama
            </StarButton>
          </div>
        </div>

        <figure className={styles.console}>
          <span className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
          <span className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
          <span className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
          <span className={`${styles.corner} ${styles.br}`} aria-hidden="true" />
          <svg
            className={styles.tree}
            viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
            role="img"
            aria-label="The decision tree of the drama: six chapters, with the route the story follows in gold"
          >
            {edges.map((e) => {
              const a = at(e.from);
              const b = at(e.to);
              return (
                <path
                  key={`${e.from}-${String(e.choice)}`}
                  className={onRoute(e.from, e.to) ? styles.edgeGold : styles.edge}
                  d={edgePath({ x: a.x + NODE_W, y: a.y }, { x: b.x, y: b.y }, e.skip, HEIGHT - 8)}
                />
              );
            })}
            {nodes.map((n) => {
              const p = at(n.id);
              const i = routeIndex(n.id);
              return (
                <rect
                  key={n.id}
                  className={i >= 0 ? styles.nodeGold : styles.node}
                  style={i >= 0 ? ({ "--i": i } as CSSProperties) : undefined}
                  x={p.x}
                  y={p.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={5}
                />
              );
            })}
            {CANON.map((id, i) => {
              const p = at(id);
              return (
                <text
                  key={id}
                  className={styles.nodeLabel}
                  x={p.x + NODE_W / 2}
                  y={p.y + 4}
                  textAnchor="middle"
                >
                  {String(i + 1)}
                </text>
              );
            })}
          </svg>
          <figcaption className={styles.caption}>
            <span className={styles.key} aria-hidden="true" />
            The gold route is the one this story follows.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
