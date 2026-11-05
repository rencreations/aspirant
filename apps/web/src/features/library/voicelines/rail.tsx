"use client";

import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import type { VoiceCharacter } from "./types";
import styles from "./voicelines.module.css";

export interface RailEntry {
  id: string;
  name: string;
  count: number;
  colour: string;
  splash?: string;
}

interface RailProps {
  entries: readonly RailEntry[];
  active: string;
  onPick: (id: string) => void;
}

/** The ten characters (and the trailer clips) as a sticky rail. A press scrolls to the panel. */
export function Rail({ entries, active, onPick }: RailProps) {
  return (
    <nav className={styles.rail} aria-label="Characters">
      <ol>
        {entries.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              className={styles.railBtn}
              aria-current={active === e.id ? "true" : undefined}
              disabled={e.count === 0}
              style={{ "--accent": e.colour } as CSSProperties}
              onClick={() => {
                audio.blip("click");
                onPick(e.id);
              }}
            >
              <span className={styles.railThumb} aria-hidden="true">
                {e.splash ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset(e.splash)}
                    alt=""
                    width={96}
                    height={54}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className={styles.railIcon}>{String(i + 1).padStart(2, "0")}</span>
                )}
              </span>
              <span className={styles.railName}>{e.name}</span>
              <span className={`${styles.railCount} hud-label`}>{e.count}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function railEntries(
  characters: readonly VoiceCharacter[],
  counts: Readonly<Record<string, number>>,
  trailerCount: number,
): RailEntry[] {
  return [
    ...characters.map((c) => ({
      id: c.slug,
      name: c.name,
      count: counts[c.slug] ?? 0,
      colour: c.palette.primary,
      splash: c.splash,
    })),
    { id: "trailer", name: "Trailer clips", count: trailerCount, colour: "#1E2A57" },
  ];
}
