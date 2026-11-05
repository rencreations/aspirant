"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import type { CharacterSlug } from "@/lib/slugs";

import { hasStage } from "./characters";
import styles from "./picker.module.css";
import { accentOf } from "./room-math";
import type { AnimChar } from "./types";

interface Props {
  characters: readonly AnimChar[];
  selected: CharacterSlug | null;
  onPick: (slug: CharacterSlug) => void;
  onWarm: (slug: CharacterSlug) => void;
}

/**
 * The ten Aspirants as slanted portrait tabs, in a bar that stays under the site's bar. A plate
 * behind the chosen tab slides to the next one with a spring (a transform). Arrow keys move between
 * the tabs, a pointer that rests on a tab warms its animation.
 */
export function Picker({ characters, selected, onPick, onWarm }: Props) {
  const list = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    characters.findIndex((c) => c.slug === selected),
  );
  const chosen = characters[index];

  // On a phone the strip scrolls: bring the chosen tab to the middle of it.
  useEffect(() => {
    const el = list.current;
    const tab = el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!el || !tab) return;
    const left = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
    // An arrow key moved the choice: the keyboard goes with it.
    if (el.contains(document.activeElement) && document.activeElement !== tab) {
      tab.focus({ preventScroll: true });
    }
  }, [selected]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = characters[e.key === "Home" ? 0 : characters.length - 1];
    if (next) onPick(next.slug);
  };

  return (
    <div className={styles.bar}>
      <div className="shell">
        <div
          ref={list}
          role="tablist"
          aria-label="Character"
          className={styles.tabs}
          onKeyDown={onKeyDown}
          style={
            {
              "--n": characters.length,
              "--i": index,
              "--sel": chosen ? accentOf(chosen.palette) : "var(--lib-colour)",
            } as CSSProperties
          }
        >
          <span className={styles.plate} aria-hidden="true" />
          {characters.map((c, i) => {
            const ready = hasStage(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                role="tab"
                id={`anim-tab-${c.slug}`}
                aria-selected={c.slug === selected}
                aria-controls="anim-stage"
                tabIndex={c.slug === selected ? 0 : -1}
                className={styles.tab}
                data-ready={ready}
                style={
                  {
                    "--tab-c": accentOf(c.palette),
                    "--fx": `${c.face.x}%`,
                    "--fy": `${c.face.y}%`,
                    "--zoom": c.face.zoom,
                  } as CSSProperties
                }
                onClick={() => {
                  audio.blip("click");
                  onPick(c.slug);
                }}
                onPointerEnter={() => {
                  audio.blip("hover");
                  onWarm(c.slug);
                }}
                onFocus={() => {
                  onWarm(c.slug);
                }}
              >
                <span className={styles.art} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(`/img/char/${c.slug}/splash-sm.webp`)}
                    alt=""
                    width={800}
                    height={450}
                    draggable={false}
                    decoding="async"
                  />
                </span>
                <span className={styles.meta}>
                  <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.name}>{c.name}</span>
                </span>
                {ready ? null : <span className={styles.soon}>Preparing</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
