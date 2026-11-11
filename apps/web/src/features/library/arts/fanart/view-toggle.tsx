"use client";

import { useQueryState } from "../../use-query-state";
import styles from "./view-toggle.module.css";

/** The two views of Fanart: the gallery of rows (the default) and the pieces grouped under their artist. The address keeps it (`?view=artist`). */
export function ViewToggle() {
  const [view, setView] = useQueryState("view");
  const byArtist = view === "artist";
  return (
    <div className={styles.views} role="group" aria-label="View" data-fanart-views="">
      <button
        type="button"
        className={styles.view}
        aria-pressed={!byArtist}
        data-view=""
        onClick={() => {
          setView("");
        }}
      >
        Gallery
      </button>
      <button
        type="button"
        className={styles.view}
        aria-pressed={byArtist}
        data-view="artist"
        onClick={() => {
          setView("artist");
        }}
      >
        By artist
      </button>
    </div>
  );
}
