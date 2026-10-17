import { StarGlyph } from "@/components/star-glyph";
import { Reveal } from "@/components/ui/reveal";

import styles from "./shared.module.css";

export interface SectionHeadProps {
  /** Id for the h2, referenced by the section's `aria-labelledby`. */
  id: string;
  /** HUD code, for example "01 / Where you are". */
  code: string;
  title: string;
  lead?: string;
}

/** Section opening: HUD code, a display h2 that rises from a mask, and an optional lead. */
export function SectionHead({ id, code, title, lead }: SectionHeadProps) {
  return (
    <header className={styles.head}>
      <p className={`${styles.code} hud-label`}>
        <StarGlyph />
        {code}
      </p>
      <Reveal variant="mask-up">
        <h2 id={id} className={`${styles.title} display`}>
          {title}
        </h2>
      </Reveal>
      {lead && (
        <Reveal delay={120}>
          <p className={styles.lead}>{lead}</p>
        </Reveal>
      )}
    </header>
  );
}
