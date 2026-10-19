"use client";

import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";

import styles from "./about.module.css";

interface Side {
  /** Short name: the fold tab and the sheet tab. */
  title: string;
  /** Name of the drawer for assistive tech. */
  aria: string;
  /** Name of its scrolling region. */
  region: string;
  /** Width on a wide screen (any CSS length). Default 28 percent of the screen. */
  width?: string;
  render: (scroller: RefObject<HTMLDivElement | null>) => ReactNode;
}

interface Props {
  /** The drawers are mounted. They stay mounted while they slide away. */
  present: boolean;
  /** The drawers are open. */
  shown: boolean;
  label: string;
  left: Side;
  right: Side;
}

function Drawer({
  side,
  place,
  open,
  inert,
  onToggle,
}: {
  side: Side;
  place: "left" | "right";
  open: boolean;
  inert: boolean;
  onToggle: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <aside
      className={styles.drawer}
      data-side={place}
      data-open={open}
      aria-label={side.aria}
      style={side.width ? ({ "--w-this": side.width } as CSSProperties) : undefined}
    >
      <button type="button" className={styles.handle} aria-expanded={open} onClick={onToggle}>
        <span>{open ? "Hide" : side.title}</span>
      </button>
      <div
        ref={scroller}
        className={styles.scroll}
        tabIndex={0}
        data-lenis-prevent
        role="region"
        aria-label={side.region}
        inert={inert}
      >
        {side.render(scroller)}
      </div>
    </aside>
  );
}

/**
 * Two drawers over the page, one from each side, with the character between them. Each scrolls on
 * its own and has a tab that folds it away. On a narrow or tall screen they become one sheet at
 * the bottom with a tab for each. Used by the About and Skills pages.
 */
export function DrawerShell({ present, shown, label, left, right }: Props) {
  const [open, setOpen] = useState({ left: true, right: true });
  const [tab, setTab] = useState<"left" | "right">("left");
  // On a narrow screen the drawers are one sheet and cannot be folded.
  const narrow = useMediaQuery("(max-width: 56em), (max-aspect-ratio: 1/1)");
  if (!present) return null;
  const sides = [
    { key: "left", side: left },
    { key: "right", side: right },
  ] as const;
  return (
    <div className={styles.drawers} data-shown={shown} data-tab={tab} data-theme="daybreak">
      <div className={styles.tabs} role="tablist" aria-label={label}>
        {sides.map(({ key, side }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              audio.blip("click");
            }}
          >
            {side.title}
          </button>
        ))}
      </div>
      {sides.map(({ key, side }) => (
        <Drawer
          key={key}
          side={side}
          place={key}
          open={open[key]}
          inert={!shown || (!open[key] && !narrow)}
          onToggle={() => {
            setOpen((o) => ({ ...o, [key]: !o[key] }));
            audio.blip("click");
          }}
        />
      ))}
    </div>
  );
}
