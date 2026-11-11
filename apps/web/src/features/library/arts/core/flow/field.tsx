"use client";

import { memo, useEffect, useMemo, useRef, type FocusEvent, type ReactNode } from "react";

import { useQueryState } from "../../../use-query-state";
import type { ArtsItem } from "../types";
import { findZoomTile } from "../zoom";
import { useFlowEngine, useFlowMetrics } from "./engine";
import styles from "./flow.module.css";
import { boxHeight, planRows, tileRatio } from "./math";
import { Row } from "./rows";

interface FlowFieldProps<T extends ArtsItem> {
  /** The pictures to show, in order. */
  items: readonly T[];
  overlay: ((item: T) => ReactNode) | undefined;
  /** The data has not arrived: nothing stands yet, and the room is not ready. */
  loading: boolean;
  /** Called once the first rows stand in the page (or at once when there is nothing to show). */
  onStanding: () => void;
}

/**
 * The rows. It holds the engine, so the scroll's work (which rows stand, and where they sit) stays
 * in here: the head of the room does not draw again while the page scrolls. A press on a tile is the
 * zoom's own (`useZoomTile`).
 */
function FlowFieldInner<T extends ArtsItem>({
  items,
  overlay,
  loading,
  onStanding,
}: FlowFieldProps<T>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const metrics = useFlowMetrics(boxRef);
  const ratios = useMemo(() => items.map((item) => tileRatio(item.img.w, item.img.h)), [items]);
  const rows = useMemo(() => (metrics ? planRows(ratios, metrics) : []), [ratios, metrics]);
  const { range, place, reveal, onScreen } = useFlowEngine({ boxRef, rows, metrics });
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  const indexById = useMemo(() => new Map(items.map((item, i) => [item.id, i])), [items]);

  const [first, last] = range;
  const standing = useMemo(
    () => (last >= first ? rows.slice(first, last + 1) : []),
    [rows, first, last],
  );

  const ready =
    !loading && ((last >= first && rows.length > 0) || (metrics !== null && items.length === 0));
  useEffect(() => {
    if (!ready) return;
    onStanding();
  }, [ready, onStanding]);

  // A picture named by the address (a deep link, the library search, the arrow keys in the viewer)
  // is brought into view, so its tile is there for the viewer to land on.
  const [wanted] = useQueryState("i");
  useEffect(() => {
    if (!wanted || !metrics) return;
    const index = indexById.get(wanted);
    if (index === undefined) return;
    const tile = findZoomTile(wanted);
    if (tile) {
      const r = tile.getBoundingClientRect();
      const seen =
        r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (seen) return;
    }
    reveal(index);
  }, [wanted, metrics, indexById, reveal]);

  // A tile that takes the keyboard focus while it is off the screen sideways is brought in by the
  // same maths (the rows are clipped, so the browser cannot scroll to it).
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const tile =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-flow-tile]")
        : null;
    if (!tile?.dataset.id) return;
    // Only a keyboard focus: a press or a tap on a tile opens the zoom, which clamps its start to the screen.
    if (!tile.matches(":focus-visible")) return;
    const index = indexById.get(tile.dataset.id);
    if (index === undefined) return;
    const bringIn = () => {
      const r = tile.getBoundingClientRect();
      if (r.left >= 0 && r.right <= window.innerWidth) return;
      reveal(index, true);
    };
    bringIn();
    // The browser scrolls a focused element into view by itself after this event, which moves the
    // rows under the tile: look again once it has, and bring the tile in if it is off the screen.
    requestAnimationFrame(() => {
      requestAnimationFrame(bringIn);
    });
  };

  return (
    <div
      ref={boxRef}
      className={styles.box}
      style={{ height: metrics ? boxHeight(rows.length, metrics) : 0 }}
      data-flow-rows={rows.length}
    >
      {metrics ? (
        <div className={styles.field} onFocus={onFocus}>
          {standing.map((row) => (
            <Row<T>
              key={row.index}
              row={row}
              m={metrics}
              items={items}
              dpr={dpr}
              eager={onScreen(row)}
              place={place}
              overlay={overlay}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const FlowField = memo(FlowFieldInner) as typeof FlowFieldInner;
