"use client";

import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";

import { useQueryState } from "../../../use-query-state";
import type { ArtsItem } from "../types";
import { findZoomTile } from "../zoom";
import styles from "./flow.module.css";
import { planWall, tileRatio, type FlowPart } from "./math";
import { Row } from "./rows";
import { useFlowMetrics } from "./use-metrics";

/** The first rows are asked for at once (the first screen), the rest as they near it. */
const EAGER_ROWS = 4;

interface FlowFieldProps<T extends ArtsItem> {
  /** The pictures to show, in order. */
  items: readonly T[];
  /** The groups, as ranges of `items`, or null for one wall with no headings. */
  parts: readonly FlowPart[] | null;
  overlay: ((item: T) => ReactNode) | undefined;
  /** The data has not arrived: nothing stands yet, and the room is not ready. */
  loading: boolean;
  /** Called once the first rows stand in the page (or at once when there is nothing to show). */
  onStanding: () => void;
}

/**
 * The wall: every picture of the list in rows that fill the page's width and stand still, in groups
 * under small headings when the list has them. Every tile is in the page from the start (a picture
 * is asked for when its row nears the screen), so the browser's own scroll, find and focus keys all
 * work and nothing moves but the page. A press on a tile is the zoom's own (`useZoomTile`).
 */
function FlowFieldInner<T extends ArtsItem>({
  items,
  parts,
  overlay,
  loading,
  onStanding,
}: FlowFieldProps<T>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const metrics = useFlowMetrics(boxRef);
  const { getLenis } = useLenis();
  const ratios = useMemo(() => items.map((item) => tileRatio(item.img.w, item.img.h)), [items]);
  const blocks = useMemo(
    () => (metrics ? planWall(ratios, parts, metrics) : []),
    [ratios, parts, metrics],
  );
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  const rowCount = blocks.reduce((n, block) => n + block.rows.length, 0);
  const ready = !loading && (rowCount > 0 || (metrics !== null && items.length === 0));
  useEffect(() => {
    if (!ready) return;
    onStanding();
  }, [ready, onStanding]);

  // A picture named by the address (a deep link, the library search, the arrow keys in the viewer)
  // is brought to the middle of the screen when it is not on it, so its tile is there for the viewer to land on.
  const [wanted] = useQueryState("i");
  useEffect(() => {
    if (!wanted || !metrics) return;
    const tile = findZoomTile(wanted);
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) return;
    const y = Math.max(0, window.scrollY + r.top + r.height / 2 - window.innerHeight / 2);
    const lenis = getLenis();
    if (lenis) {
      // Lenis keeps the page's length from its last measure and stops a jump at that.
      lenis.resize();
      lenis.scrollTo(y, { immediate: true, force: true });
    } else window.scrollTo(0, y);
  }, [wanted, metrics, blocks, getLenis]);

  let seen = 0;
  return (
    <div ref={boxRef} className={styles.box} data-flow-rows={rowCount}>
      {metrics
        ? blocks.map((block) => {
            const { part } = block;
            const head = part ? (
              <header className={styles.partHead}>
                <h2 id={`flow-part-${part.id}`} className={styles.partName}>
                  {part.name}
                </h2>
              </header>
            ) : null;
            const rows = block.rows.map((row) => {
              const index = seen++;
              return (
                <Row<T>
                  key={row.start}
                  row={row}
                  index={index}
                  m={metrics}
                  items={items}
                  dpr={dpr}
                  eager={index < EAGER_ROWS}
                  overlay={overlay}
                />
              );
            });
            return (
              <section
                key={part?.id ?? "all"}
                className={part ? styles.part : styles.whole}
                aria-labelledby={part ? `flow-part-${part.id}` : undefined}
                data-flow-part={part?.id}
                style={
                  part ? { ["--c" as string]: items[part.start]?.img.c ?? "#888888" } : undefined
                }
              >
                {head}
                <div className={styles.rows} style={{ gap: metrics.gap }}>
                  {rows}
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}

export const FlowField = memo(FlowFieldInner) as typeof FlowFieldInner;
