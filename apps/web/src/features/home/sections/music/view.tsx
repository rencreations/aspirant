import { MUSIC, MUSIC_UI } from "../../content";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import styles from "./music.module.css";

/**
 * What the server draws for the section: the title, the words that go with the scene (what to do,
 * what plays, how to go on) and the button to the room. The gramophone, the crate and the two
 * drones are drawn by the stage. The words that only make sense with the stage are hidden on the
 * plain page.
 */
export function view(): SectionMarkup {
  return {
    below: null,
    text: (
      <div className={styles.music} data-music="" data-phase="away" data-held="0" data-again="0">
        <h2 className={styles.title} data-music-part="title">
          {MUSIC.title}
        </h2>
        <p className={styles.hint} data-music-part="hint">
          {MUSIC_UI.hint}
        </p>
        <p className={styles.loading} data-music-part="loading">
          {MUSIC_UI.loading}
        </p>
        <p className={styles.now} data-music-part="now" aria-live="polite">
          <span data-music-label="">{MUSIC_UI.nowPlaying}</span> <b data-music-track=""></b>
        </p>
        <div
          className={styles.keys}
          role="group"
          aria-label={MUSIC_UI.records}
          data-music-keys=""
        ></div>
        <div className={styles.actions} data-music-part="actions">
          <Pill href={MUSIC.button.href} label="Music">
            {MUSIC.button.label}
          </Pill>
          <button type="button" className={styles.text} data-music-another="">
            {MUSIC_UI.another}
          </button>
          <button type="button" className={styles.text} data-music-continue="">
            {MUSIC_UI.keep}
          </button>
        </div>
      </div>
    ),
  };
}
