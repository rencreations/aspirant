"use client";

import type { CSSProperties } from "react";

import { libUrl } from "@/lib/library";

import { skillsByCharacter } from "./filters";
import styles from "./sections.module.css";
import type { SkillItem } from "./types";

/**
 * The skill icons. They are 100 px game interface icons, so they are drawn at 100 px with
 * pixel crisp scaling and are never stretched to fill a cell. Names come from the file names.
 */
export function SkillGrid({ items }: { items: readonly SkillItem[] }) {
  const rows = skillsByCharacter(items);
  let n = 0;
  return (
    <div role="list" aria-label="Skill icons by character">
      {rows.map((row) => (
        <div key={row.slug} role="listitem" className={styles.skillRow}>
          <div className={styles.skillWho}>
            <span className={styles.skillName}>{row.name}</span>
            <span className="hud-label">{row.items.length} icons</span>
          </div>
          <ul className={styles.icons}>
            {row.items.map((s) => {
              const i = n++;
              return (
                <li
                  key={s.id}
                  id={s.id}
                  className={styles.item}
                  style={{ "--i": i } as CSSProperties}
                >
                  <figure className={styles.icon}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.iconImg}
                      src={libUrl(s.img.f)}
                      width={100}
                      height={100}
                      alt={`${row.name}, ${s.label.toLowerCase()}, skill icon`}
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption className={styles.iconLabel}>{s.label}</figcaption>
                  </figure>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
