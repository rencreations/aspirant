import { StarGlyph } from "@/components/star-glyph";
import { ScatterText } from "@/components/text/scatter-text";
import { characters } from "@/content/characters";
import { pairs } from "@/content/pairs";

import styles from "./header.module.css";

/** The roster's opening: title, a short welcome and a registry readout. */
export function RosterHeader() {
  const lines = characters.reduce((sum, c) => sum + c.voice.length, 0);
  const readout = [
    { label: "Aspirants", value: String(characters.length).padStart(2, "0") },
    { label: "Pairs", value: String(pairs.length).padStart(2, "0") },
    { label: "Voice lines", value: String(lines) },
  ];
  return (
    <header className={`${styles.header} shell below-nav`}>
      <p className={`${styles.code} hud-label`}>
        <StarGlyph className={styles.star} />
        04 / Roster <span aria-hidden="true">/</span> Selrick Academy registry
      </p>
      <h1 className={styles.title}>
        <ScatterText text="Meet the ten" className={styles.titleText} radius={110} />
      </h1>
      <div className={styles.foot}>
        <p className={styles.lead}>
          Ten names in the registry, in the pairs the story puts together. Hover or focus a card to
          hear a voice. Open one to read her file.
        </p>
        <dl className={styles.readout}>
          {readout.map((r) => (
            <div key={r.label} className={styles.readoutItem}>
              <dt className="hud-label">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
