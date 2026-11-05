"use client";

import type { CSSProperties } from "react";

import { VideoCard } from "@/components/video-player/video-card";
import { libUrl } from "@/lib/library";

import { CreditLine } from "../shell/credit";
import { clock } from "./filters";
import styles from "./sections.module.css";
import type { GameplayItem } from "./types";

/** The gameplay clips. They open in the site's player. Nothing plays by itself. */
export function GameplayGrid({ items }: { items: readonly GameplayItem[] }) {
  return (
    <>
      <p className={styles.note}>
        These clips show the game itself. They were posted by the official account and are not part
        of the story.
      </p>
      <ul className={styles.clips} aria-label="Gameplay clips">
        {items.map((c, i) => {
          const wide = c.video.w > c.video.h;
          return (
            <li
              key={c.id}
              id={c.id}
              className={`${styles.item} ${styles.clip} ${wide ? styles.clipWide : ""}`}
              style={{ "--i": i } as CSSProperties}
            >
              <VideoCard
                className={styles.clipCard ?? ""}
                video={{
                  sources: [
                    {
                      label: `${Math.min(c.video.w, c.video.h)}p`,
                      height: Math.min(c.video.w, c.video.h),
                      src: libUrl(c.video.src),
                    },
                  ],
                  poster: libUrl(c.video.poster),
                  title: c.title,
                }}
                duration={c.video.dur}
                tag="Gameplay"
              />
              <span className={`${styles.clipTag} hud-label`}>Not story</span>
              <h3 className={styles.clipTitle}>{c.title}</h3>
              <p className={styles.clipText}>{c.caption}</p>
              <p className={`${styles.clipMeta} hud-label`}>
                {c.date} / {clock(c.video.dur)}
                {c.chars.length ? ` / ${c.chars.join(", ")}` : ""}
              </p>
              <CreditLine credit={c.credit} canon={c.canon} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
