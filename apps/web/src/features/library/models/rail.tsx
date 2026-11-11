"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { count, pad2, whoOf } from "./logic";
import styles from "./models.module.css";
import { bundleState, bundlesVersion, subscribeBundles } from "./model-bundle";
import type { ModelItem } from "./types";

interface RailProps {
  models: readonly ModelItem[];
  /** The id of the model on the stage. */
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * The nine models as a row of small plates under the stage. A plate shows how far its model has
 * come while the model is downloading in the background (a hairline under the picture), and a
 * press on one that has not arrived yet loads it behind the stage's own percentage.
 */
export function Rail({ models, selected, onSelect }: RailProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Redraw as the downloads move (the store tells at most ten times a second).
  useSyncExternalStore(subscribeBundles, bundlesVersion, bundlesVersion);

  // Keep the chosen plate in view inside the row (the row scrolls, the page does not).
  useEffect(() => {
    const row = rowRef.current;
    const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chosen) return;
    row.scrollTo({
      left: chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [selected]);

  return (
    <div
      ref={rowRef}
      className={styles.rail}
      role="group"
      aria-label="Choose a model"
      data-testid="model-picker"
    >
      {models.map((it, i) => {
        const state = bundleState(it.id);
        const pending = !state.ready && state.fraction > 0;
        return (
          <button
            key={it.id}
            type="button"
            className={styles.plate}
            aria-pressed={it.id === selected}
            aria-label={`${it.title}, ${count(it.model.verts)} points`}
            data-id={it.id}
            data-ready={state.ready}
            onClick={() => {
              audio.blip("click");
              onSelect(it.id);
            }}
          >
            <span className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={libUrl(it.img.t)}
                alt=""
                width={it.img.w}
                height={it.img.h}
                decoding="async"
                crossOrigin="anonymous"
                draggable={false}
              />
              <span className={styles.plateNo}>{pad2(i + 1)}</span>
              <span
                className={styles.plateBar}
                data-on={pending}
                style={{ transform: `scaleX(${state.fraction})` }}
              />
            </span>
            <span className={styles.plateName}>{whoOf(it)}</span>
            <span className={styles.plateMeta}>{it.skin ?? `${count(it.model.verts)} points`}</span>
          </button>
        );
      })}
    </div>
  );
}
