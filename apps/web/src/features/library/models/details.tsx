"use client";

import { forwardRef } from "react";

import type { ViewerApi } from "./use-viewer";
import { count, humanBytes } from "./logic";
import styles from "./models.module.css";
import type { ModelItem, ModelLayer } from "./types";

const LAYERS: Array<{ id: ModelLayer; label: string }> = [
  { id: "body", label: "Body, face and hair" },
  { id: "weapon", label: "Weapon" },
  { id: "robot", label: "Robot" },
];

/** The nine expression sheets of the robot's face: the one the model came with, then eight more. */
const FACE_SHEETS = [-1, 0, 1, 2, 3, 4, 5, 6, 7];

interface DetailsProps {
  model: ModelItem;
  viewer: ViewerApi;
  /** On a narrow screen the details are a sheet that the Details button opens. */
  open: boolean;
  inert: boolean;
  onClose: () => void;
}

/**
 * The facts of the model, its layers and the robot's faces. On a wide screen the facts stand under
 * the title on the left and the layers and faces on the right. On a narrow one they are one sheet
 * that rises from the foot of the screen.
 */
export const Details = forwardRef<HTMLButtonElement, DetailsProps>(function Details(
  { model, viewer, open, inert, onClose },
  closeRef,
) {
  const m = model.model;
  const ready = viewer.status === "ready";
  const drawn = viewer.status === "ready" || viewer.status === "loading";
  const switches = LAYERS.filter((l) => m.layers.includes(l.id));
  return (
    <aside
      id="model-details"
      className={styles.sheet}
      aria-label="Model facts and controls"
      data-open={open}
      data-lenis-prevent=""
      inert={inert}
    >
      <div className={styles.sheetHead}>
        <p className="hud-label">Details</p>
        <button ref={closeRef} type="button" className={styles.sheetClose} onClick={onClose}>
          Close
        </button>
      </div>

      <section className={styles.facts} aria-label="Facts">
        {model.note ? <p className={styles.note}>{model.note}</p> : null}
        <dl className={styles.dl}>
          <dt>Points</dt>
          <dd>{count(m.verts)}</dd>
          <dt>Triangles</dt>
          <dd>{count(m.tris)}</dd>
          <dt>Format</dt>
          <dd>{m.format.toUpperCase()}</dd>
          <dt>Files</dt>
          <dd>{m.files}</dd>
          <dt>Download</dt>
          <dd>{humanBytes(m.totalBytes)}</dd>
        </dl>
        {model.credit?.by ? (
          <p className={`${styles.credit} hud-label`}>{model.credit.by}</p>
        ) : null}
      </section>

      {drawn ? (
        <section className={styles.parts} aria-label="Layers and faces">
          <div>
            <p className={`${styles.partsHead} hud-label`}>Layers</p>
            <div className={styles.switches}>
              {switches.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="switch"
                  aria-checked={viewer.layers[l.id]}
                  className={styles.switch}
                  disabled={!ready}
                  onClick={() => {
                    viewer.toggleLayer(l.id);
                  }}
                >
                  <span>{l.label}</span>
                  <span className={styles.switchBox} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {m.faces.length > 0 ? (
            <div>
              <p className={`${styles.partsHead} hud-label`}>
                Robot face, {FACE_SHEETS.length} sheets
              </p>
              <div className={styles.faces} role="group" aria-label="Robot face">
                {FACE_SHEETS.map((i) => {
                  const url = viewer.faceUrl(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={styles.face}
                      aria-pressed={viewer.face === i}
                      aria-label={
                        i < 0 ? "Robot face, original sheet" : `Robot face, sheet ${i + 2}`
                      }
                      disabled={!ready || !url}
                      onClick={() => {
                        viewer.pickFace(i);
                      }}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" draggable={false} />
                      ) : null}
                      <span className={styles.faceNo}>{i + 2}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className={`${styles.btn} ${styles.onlyNarrow}`}
            aria-pressed={viewer.all}
            disabled={!ready}
            onClick={viewer.toggleAll}
          >
            Frame every part
          </button>
        </section>
      ) : null}
    </aside>
  );
});
