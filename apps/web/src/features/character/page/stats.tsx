import type { ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { HudPanel } from "@/components/ui/hud-panel";
import type { Character } from "@/content/types";
import { characterRoute } from "@/lib/site";

import { mbtiMeaning } from "./mbti";
import styles from "./stats.module.css";

interface StatProps {
  label: string;
  children: ReactNode;
  note?: string;
  wide?: boolean;
}

function Stat({ label, children, note, wide }: StatProps) {
  return (
    <div className={styles.stat} data-wide={wide ? "" : undefined}>
      <dt className="hud-label">{label}</dt>
      <dd className={styles.value}>
        {children}
        {note && <span className={styles.note}>{note}</span>}
      </dd>
    </div>
  );
}

export interface StatsProps {
  character: Character;
  partner: { slug: Character["slug"]; name: string } | null;
  /** The other member of the grouping when there is no partner (Selena and Obsidia). */
  grouped: { slug: Character["slug"]; name: string } | null;
}

/** The HUD stat block: values from the character file, "Not specified" where it is silent. */
export function Stats({ character: c, partner, grouped }: StatsProps) {
  return (
    <HudPanel
      tone="glass"
      label={`File ${String(c.order).padStart(2, "0")} / ${c.aspirantName}`}
      code={c.side === "storm" ? "Storm" : "Daybreak"}
      bodyClassName={styles.body}
    >
      <dl className={styles.grid}>
        <Stat label="Age" note={c.ageNote}>
          {c.ageText}
        </Stat>
        <Stat label="Birthday">{c.birthday}</Stat>
        <Stat label="MBTI" note={mbtiMeaning(c.mbti)}>
          <span className="mono">{c.mbti}</span>
        </Stat>
        <Stat label="Side">
          <span className={styles.side} data-side={c.side}>
            {c.side === "storm" ? "Storm" : "Daybreak"}
          </span>
        </Stat>
        <Stat
          label="Partner"
          note={grouped ? `Grouped with ${grouped.name} as creator and creation.` : undefined}
        >
          {partner ? (
            <TLink
              href={characterRoute(partner.slug)}
              transitionLabel={partner.name}
              className={styles.partner}
            >
              {partner.name}
            </TLink>
          ) : (
            "None"
          )}
        </Stat>
        <Stat label="Role" wide>
          {c.role}
        </Stat>
        <Stat label="Weapon" wide>
          {c.weapon}
        </Stat>
      </dl>
    </HudPanel>
  );
}
