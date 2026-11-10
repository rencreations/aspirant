"use client";

import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { asset } from "@/lib/asset";

import type { PanelEls } from "./ring-driver";
import styles from "./scene.module.css";
import type { CoreLoad } from "./use-core";

interface Props {
  index: number;
  slug: string;
  /** The point of the picture that stays in view (percent from the left). */
  focus: number;
  still: string;
  /** The live stage, on the panel in front only. */
  live: ReactNode;
  /** The character in front is still waiting for its first videos. */
  waiting: boolean;
  /** Their load, when the bytes are known. */
  load: CoreLoad | null;
  register: (index: number, els: PanelEls | null) => void;
}

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * One panel of the ring: a box the size of the screen, its picture seen through a window. The ring
 * driver places it and moves it; React only fills it.
 */
export const Panel = memo(function Panel({
  index,
  slug,
  focus,
  still,
  live,
  waiting,
  load,
  register,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!panel.current || !dim.current || !outer.current || !inner.current) return;
    if (!counter.current || !content.current) return;
    register(index, {
      panel: panel.current,
      dim: dim.current,
      outer: outer.current,
      inner: inner.current,
      counter: counter.current,
      content: content.current,
    });
    return () => {
      register(index, null);
    };
  }, [index, register]);

  const known = load !== null && load.total > 0;

  return (
    <div ref={panel} className={styles.panel} data-panel={slug} data-index={index}>
      <div ref={outer} className={styles.outer}>
        <div ref={inner} className={styles.inner}>
          <div ref={counter} className={styles.counter}>
            <div
              ref={content}
              className={styles.content}
              data-index={index}
              style={{ "--focus": `${focus}% 50%` } as CSSProperties}
            >
              {/* Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.still}
                src={asset(still)}
                alt=""
                draggable={false}
                decoding="async"
              />
              {live}
              <i className={styles.rim} aria-hidden="true" />
              <i ref={dim} className={styles.dim} aria-hidden="true" />
              <div className={styles.load} data-show={waiting}>
                <span className={styles.loadLabel}>
                  {known ? `Loading ${mb(load.received)} of ${mb(load.total)}` : "Loading"}
                </span>
                <span className={styles.loadRail}>
                  <i style={{ transform: `scaleX(${load?.fraction ?? 0})` }} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
