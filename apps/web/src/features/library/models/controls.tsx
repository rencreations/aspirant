"use client";

import type { ViewerApi } from "./use-viewer";
import styles from "./models.module.css";

interface ControlsProps {
  viewer: ViewerApi;
  /** On a narrow screen the facts and layers are a sheet. */
  sheetOpen: boolean;
  onDetails: () => void;
}

/** The row of buttons under the stage: reset, auto turn, zoom, frame every part, and Details on a narrow screen. */
export function Controls({ viewer, sheetOpen, onDetails }: ControlsProps) {
  const ready = viewer.status === "ready";
  // With no 3D (no WebGL, or a model that will not load) there is nothing to turn or zoom.
  const drawing = viewer.status === "ready" || viewer.status === "loading";
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Viewer controls">
      {drawing ? (
        <>
          <button
            type="button"
            className={styles.btn}
            aria-label="Reset view"
            disabled={!ready}
            onClick={viewer.reset}
          >
            <span aria-hidden="true">
              Reset<span className={styles.wide}> view</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-label={`Auto turn: ${viewer.spin ? "on" : "off"}`}
            aria-pressed={viewer.spin}
            disabled={!ready}
            onClick={viewer.toggleSpin}
          >
            <span aria-hidden="true">
              <span className={styles.wide}>Auto </span>turn: {viewer.spin ? "on" : "off"}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.zoomBtn}`}
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => {
              viewer.zoomBy(1.2);
            }}
          >
            <span aria-hidden="true">
              <span className={styles.word}>Zoom </span>-
            </span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.zoomBtn}`}
            aria-label="Zoom in"
            disabled={!ready}
            onClick={() => {
              viewer.zoomBy(0.83);
            }}
          >
            <span aria-hidden="true">
              <span className={styles.word}>Zoom </span>+
            </span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.onlyWide}`}
            aria-pressed={viewer.all}
            disabled={!ready}
            onClick={viewer.toggleAll}
          >
            Frame every part
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={`${styles.btn} ${styles.onlyNarrow}`}
        aria-expanded={sheetOpen}
        aria-controls="model-details"
        onClick={onDetails}
      >
        Details
      </button>
    </div>
  );
}
