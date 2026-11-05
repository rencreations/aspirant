"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { charName } from "./filter";
import { REST, ribbonPose } from "./ribbon-math";
import styles from "./ribbon.module.css";
import type { ArtItem } from "./types";

interface Props {
  /** The ten splash arts, in roster order. */
  items: readonly ArtItem[];
  /** The character chosen in the filters: the other panels sit back. */
  who: string;
  onOpen: (id: string) => void;
}

/**
 * The ten splash arts as slanted panels side by side. The panel under the pointer rises and
 * grows, its neighbours step aside and the pictures slide toward the pointer. Only `transform`
 * changes (through custom properties on each panel, set once a frame). A press opens the picture.
 * On a phone the ribbon is a strip that scrolls sideways.
 */
export function Ribbon({ items, who, onOpen }: Props) {
  const root = useRef<HTMLOListElement>(null);
  const frame = useRef(0);

  const pose = useCallback((x: number | null) => {
    const el = root.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    for (const child of Array.from(el.children)) {
      const slot = child as HTMLElement;
      let p = REST;
      if (x !== null) {
        const middle = slot.offsetLeft + slot.offsetWidth / 2 - el.scrollLeft;
        p = ribbonPose((x - rect.left - middle) / Math.max(1, slot.offsetWidth));
      }
      slot.style.setProperty("--sc", String(p.scale));
      slot.style.setProperty("--ty", `${p.lift}px`);
      slot.style.setProperty("--tx", `${p.push}px`);
      slot.style.setProperty("--ix", `${p.slide}%`);
    }
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const x = e.clientX;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      pose(x);
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      pose(null);
    });
  };

  return (
    <div className={styles.wrap}>
      <div className="shell">
        <ol
          ref={root}
          className={styles.ribbon}
          aria-label="The ten splash arts"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          {items.map((it, i) => {
            const first = it.chars[0] ?? "";
            const dim = Boolean(who) && !it.chars.includes(who as (typeof it.chars)[number]);
            return (
              <li
                key={it.id}
                className={styles.slot}
                data-dim={dim || undefined}
                style={{ "--n": i } as CSSProperties}
              >
                <button
                  type="button"
                  className={styles.panel}
                  aria-label={it.title}
                  onClick={() => {
                    audio.blip("click");
                    onOpen(it.id);
                  }}
                >
                  <span className={styles.cut} style={{ backgroundColor: it.img.c }}>
                    {/* Plain <img>: static export, and the library lives on another origin. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.art}
                      src={libUrl(it.img.p)}
                      alt=""
                      width={it.img.w}
                      height={it.img.h}
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  <span className={`${styles.index} hud-label`} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`${styles.name} display`} aria-hidden="true">
                    {charName(first)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
