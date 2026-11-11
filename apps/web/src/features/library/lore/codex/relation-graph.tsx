"use client";

import { type CSSProperties } from "react";

import { hubPoints, REL_META, relLabel, type Neighbour } from "./model";
import styles from "./relation-graph.module.css";
import type { CodexEntry } from "./types";

const W = 820;
const H = 520;
const HUB_W = 200;
const HUB_H = 56;
const NODE_W = 160;
const NODE_H = 40;
/** The most neighbours drawn; the rest are in the list under the picture. */
const GRAPH_MAX = 12;

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export interface RelationGraphProps {
  hub: CodexEntry;
  /** The neighbours in order of importance; the first `GRAPH_MAX` are drawn. */
  neighbours: readonly Neighbour[];
  nameOf: (slug: string) => string;
  kindOf: (slug: string) => string;
  onOpenEntry: (slug: string) => void;
  onOpenPair: (a: string, b: string) => void;
}

/**
 * The relationships of one entry as a picture: the entry in the middle and the entries it is tied
 * to round it, a line to each coloured by what sort of tie it is, and a label on the line. A name
 * opens that entry, a label opens the page of the two together. The list under it says the same in
 * words, so the picture is hidden from screen readers.
 */
export function RelationGraph({
  hub,
  neighbours,
  nameOf,
  kindOf,
  onOpenEntry,
  onOpenPair,
}: RelationGraphProps) {
  const shown = neighbours.slice(0, GRAPH_MAX);
  const points = hubPoints(shown.length, W, H);
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg
      className={styles.graph}
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      aria-hidden="true"
      focusable="false"
    >
      {shown.map((n, i) => {
        const p = points[i];
        if (!p) return null;
        const first = n.ties[0];
        const family = first ? REL_META[first.type].family : "bond";
        return (
          <line
            key={`l-${n.slug}`}
            className={styles.edge}
            data-family={family}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
          />
        );
      })}
      {shown.map((n, i) => {
        const p = points[i];
        if (!p) return null;
        const first = n.ties[0];
        const family = first ? REL_META[first.type].family : "bond";
        const label = first
          ? `${relLabel(first.type, first.dir)}${n.ties.length > 1 ? ` +${String(n.ties.length - 1)}` : ""}`
          : "";
        const mx = (cx + p.x) / 2;
        const my = (cy + p.y) / 2;
        const lw = Math.max(46, label.length * 7.2 + 16);
        return (
          <g key={`n-${n.slug}`} data-family={family} style={{ "--i": i } as CSSProperties}>
            <g
              className={styles.tag}
              transform={`translate(${String(mx)} ${String(my)})`}
              onClick={() => {
                onOpenPair(hub.slug, n.slug);
              }}
            >
              <rect x={-lw / 2} y={-11} width={lw} height={22} rx={11} className={styles.tagBox} />
              <text className={styles.tagText} textAnchor="middle" y={4}>
                {label}
              </text>
            </g>
            <g
              className={styles.node}
              data-kind={kindOf(n.slug)}
              transform={`translate(${String(p.x - NODE_W / 2)} ${String(p.y - NODE_H / 2)})`}
              onClick={() => {
                onOpenEntry(n.slug);
              }}
            >
              <title>{nameOf(n.slug)}</title>
              <rect width={NODE_W} height={NODE_H} rx={6} className={styles.nodeBox} />
              <text
                className={styles.nodeText}
                x={NODE_W / 2}
                y={NODE_H / 2 + 5}
                textAnchor="middle"
              >
                {short(nameOf(n.slug), 20)}
              </text>
            </g>
          </g>
        );
      })}
      <g transform={`translate(${String(cx - HUB_W / 2)} ${String(cy - HUB_H / 2)})`}>
        <rect width={HUB_W} height={HUB_H} rx={8} className={styles.hubBox} />
        <text className={styles.hubText} x={HUB_W / 2} y={HUB_H / 2 + 6} textAnchor="middle">
          {short(hub.name, 18)}
        </text>
      </g>
    </svg>
  );
}
