import { LAYER } from "../layout";

import { LabelContent } from "./content";
import styles from "./mlabel.module.css";
import { Stage } from "./stage";

/**
 * TheMLabel: the close of the page, made after the label's own ident. The section rises over the
 * drone's ring, which is held on the screen under it. Its stage closes a black ground over the
 * page, with the page seen only through an M, flips five M plates of footage up from the floor
 * and spells the logo out (`stage.tsx`, the measurements in `choreo.ts`). What TheMLabel is
 * follows in the dark (`content.tsx`), and the page ends there: no footer to a next page. The
 * site's cursor shows only its ring here, without its warm light (`data-cursor-glow`).
 */
export function MLabel() {
  return (
    <section
      className={styles.label}
      data-about-section="label"
      data-cursor-glow="off"
      style={{ zIndex: LAYER.cover }}
    >
      <Stage />
      <LabelContent />
    </section>
  );
}
