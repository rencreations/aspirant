import { LampText } from "@/components/text/lamp-text";
import { ThemeZone } from "@/components/theme-zone";

import type { CounterView } from "../types";
import { Counters } from "./Counters";
import { LampRail } from "./LampRail";
import styles from "./manifesto.module.css";

/** Our own words. Facts from the spec, `world.ts` and the canon notes; nothing invented. */
const MANIFESTO =
  "Aspirant is a story series from Mobile Legends: Bang Bang. It is set in an alternate universe, A5-01, apart from the main game. The Aspirants are young women at Selrick Academy in Terrinia, the last great city on Dawnbreak. They fight the Enders with aspirant power: the power of a heart that holds on to one thing. There are ten of them, and one of them commands the Enders. This archive keeps their whole story, with the art and the voices that came with it. Read at your own pace. Someone is always waiting.";

/** "What is Aspirant": a manifesto lit word by word as you scroll, and the counter strip. */
export function Manifesto({ counters }: { counters: readonly CounterView[] }) {
  return (
    <ThemeZone
      theme="daybreak"
      id="what-is"
      aria-labelledby="what-is-title"
      className={styles.section}
    >
      <div className={styles.grid} aria-hidden="true" />
      <div className={`${styles.inner} shell`}>
        <header className={styles.head}>
          <p className="hud-label">02 / Briefing</p>
          <h2 id="what-is-title" className={styles.title}>
            What is Aspirant
          </h2>
        </header>
        <div className={styles.body}>
          <LampRail />
          <div data-lamp-target="" className={styles.textWrap}>
            <LampText as="p" className={styles.text} text={MANIFESTO} />
          </div>
        </div>
        <Counters items={counters} />
      </div>
    </ThemeZone>
  );
}
