"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

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
  /**
   * The drawers are mounted. They stay mounted while they slide away, and the page may mount them
   * ahead of time, off screen, so that building them never competes with an entrance.
   */
  present: boolean;
  /** The drawers are open. */
  shown: boolean;
  /**
   * Draw the content now, still off screen. The first drawing of a drawer's text is a frame of
   * work, so the page asks for it in the middle of the entrance, when the picture runs on the
   * browser's compositor and the main thread is free, and not when the drawer slides in.
   */
  warm?: boolean;
  label: string;
  left: Side;
  right: Side;
}

/** The content of one side, built when `built` says so. */
function Content({
  side,
  scroller,
  built,
}: {
  side: Side;
  scroller: RefObject<HTMLDivElement | null>;
  built: boolean;
}) {
  return built ? side.render(scroller) : null;
}

function Drawer({
  side,
  place,
  open,
  inert,
  built,
  onToggle,
}: {
  side: Side;
  place: "left" | "right";
  open: boolean;
  inert: boolean;
  /** The content is built. Before that the drawer is an empty frame. */
  built: boolean;
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
        <Content side={side} scroller={scroller} built={built} />
      </div>
    </aside>
  );
}

/**
 * Two drawers over the page, one from each side, with the character between them. Each scrolls on
 * its own and has a tab that folds it away. On a narrow or tall screen they become one sheet at
 * the bottom with a tab for each. Used by the About and Skills pages.
 */
export function DrawerShell({ present, shown, warm = false, label, left, right }: Props) {
  const [open, setOpen] = useState({ left: true, right: true });
  const [tab, setTab] = useState<"left" | "right">("left");
  // On a narrow screen the drawers are one sheet and cannot be folded.
  const narrow = useMediaQuery("(max-width: 56em), (max-aspect-ratio: 1/1)");
  const root = useRef<HTMLDivElement>(null);

  // The two sides are built one after the other, so no single frame carries both (a drawer is
  // hundreds of elements). A page that is opened builds whatever is missing at once.
  const [built, setBuilt] = useState({ left: false, right: false });
  useEffect(() => {
    if (!present) return;
    const first = window.setTimeout(() => {
      startTransition(() => {
        setBuilt((b) => ({ ...b, left: true }));
      });
    }, 0);
    const second = window.setTimeout(() => {
      startTransition(() => {
        setBuilt((b) => ({ ...b, right: true }));
      });
    }, 350);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [present]);

  // Away again: the next visit starts as the first did (both open, the first tab, at the top).
  // State is adjusted while rendering, the pattern React gives for state that follows a prop.
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    if (!shown) {
      setOpen({ left: true, right: true });
      setTab("left");
    }
  }
  useEffect(() => {
    if (shown) return;
    const timer = window.setTimeout(() => {
      for (const el of root.current?.querySelectorAll("[role='region']") ?? []) el.scrollTop = 0;
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [shown]);

  if (!present) return null;
  const sides = [
    { key: "left", side: left },
    { key: "right", side: right },
  ] as const;
  return (
    <div
      ref={root}
      className={styles.drawers}
      data-shown={shown}
      data-warm={warm}
      data-tab={tab}
      data-theme="daybreak"
    >
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
          built={built[key] || shown}
          onToggle={() => {
            setOpen((o) => ({ ...o, [key]: !o[key] }));
            audio.blip("click");
          }}
        />
      ))}
    </div>
  );
}
