import { THEMLABEL_LOGO } from "@/features/about/media";
import { asset } from "@/lib/asset";

import { ASPIRANTS } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="aspirants" note="the sliding wall of wide cards" />,
    text: (
      <div className={styles.rightBox}>
        <h2 className={styles.title}>{ASPIRANTS.title}</h2>
        <p className={styles.lead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img
            src={asset("/img/home/mlbb.webp")}
            alt={ASPIRANTS.game}
            width={555}
            height={167}
          />{" "}
          {ASPIRANTS.line}
        </p>
        <p className={styles.lead}>
          {ASPIRANTS.partOf}{" "}
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img src={asset(THEMLABEL_LOGO)} alt={ASPIRANTS.label} width={720} height={184} />{" "}
          {ASPIRANTS.partOfEnd}
        </p>
        <div className={styles.actions}>
          <Pill href={ASPIRANTS.button.href} label="About">
            {ASPIRANTS.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
