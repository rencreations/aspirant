"use client";

import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";

import styles from "./drawer.module.css";

export interface DrawerTab {
  id: string;
  /** The word on the tab. */
  label: string;
  render: (scroller: RefObject<HTMLDivElement | null>) => ReactNode;
}

interface Props {
  /**
   * The drawer is mounted. It stays mounted while it slides away, and the page may mount it ahead
   * of time, off screen, so that building it never competes with an entrance.
   */
  present: boolean;
  /** The drawer is open. */
  shown: boolean;
  /**
   * Draw the content now, still off screen. The first drawing of a drawer's text is a frame of
   * work, so the page asks for it in the middle of the entrance, when the picture runs on the
   * browser's compositor and the main thread is free, and not when the drawer slides in.
   */
  warm?: boolean;
  /** Name of the drawer for assistive technology, for example "About Obsidia". */
  label: string;
  tabs: readonly DrawerTab[];
  /** What sits in the bottom right corner of the picture (the trailer, the demonstration). */
  dock?: ReactNode;
}

/** The content of one tab, built when `built` says so. */
function Content({
  tab,
  scroller,
  built,
}: {
  tab: DrawerTab;
  scroller: RefObject<HTMLDivElement | null>;
  built: boolean;
}) {
  return built ? tab.render(scroller) : null;
}

/** One tab's scrolling panel. It owns its ref, so the content can scroll itself to a place. */
function Panel({
  tab,
  panelId,
  hidden,
  inert,
  build,
}: {
  tab: DrawerTab;
  panelId: string;
  hidden: boolean;
  inert: boolean;
  /** The content is built. Before that the panel is an empty frame. */
  build: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      id={panelId}
      className={styles.scroll}
      role="tabpanel"
      aria-label={`${tab.label}, scrollable`}
      hidden={hidden}
      tabIndex={0}
      data-lenis-prevent
      inert={inert}
    >
      <Content tab={tab} scroller={ref} built={build} />
    </div>
  );
}

/**
 * Her drawer: one panel that slides in from the left and takes at most 40 percent of the screen,
 * so she stays in view on the right. Tabs along the top switch what the panel shows, and a tab on
 * its edge folds it away. On a narrow or tall screen it is a sheet at the bottom. The corner
 * `dock` holds one small thing that plays (a trailer or a clip).
 */
export function ObsidiaDrawer({ present, shown, warm = false, label, tabs, dock }: Props) {
  const id = useId();
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(true);
  const narrow = useMediaQuery("(max-width: 56em), (max-aspect-ratio: 1/1)");
  const root = useRef<HTMLDivElement>(null);
  // Each tab is built after the one before it, so no single frame carries them all. A page that
  // is opened builds whatever is missing at once.
  const [built, setBuilt] = useState(0);
  useEffect(() => {
    if (!present || built >= tabs.length) return;
    const timer = window.setTimeout(
      () => {
        startTransition(() => {
          setBuilt((n) => n + 1);
        });
      },
      built === 0 ? 0 : 350,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [present, built, tabs.length]);

  // Away again: the next visit starts as the first did (open, the first tab, at the top). State is
  // adjusted while rendering, the pattern React gives for state that follows a prop.
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    if (!shown) {
      setOpen(true);
      setTab(0);
    }
  }
  useEffect(() => {
    if (shown) return;
    const timer = window.setTimeout(() => {
      for (const el of root.current?.querySelectorAll("[role='tabpanel']") ?? []) el.scrollTop = 0;
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [shown]);

  if (!present) return null;
  const folded = !open && !narrow;
  return (
    <div ref={root} className={styles.shell} data-shown={shown} data-warm={warm} data-tab={tab}>
      <aside className={styles.drawer} data-open={!folded} aria-label={label}>
        <div className={styles.tabs} role="tablist" aria-label={label}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              aria-selected={tab === i}
              aria-controls={`${id}-panel-${t.id}`}
              tabIndex={shown && !folded ? 0 : -1}
              onClick={() => {
                setTab(i);
                audio.blip("click");
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tabs.map((t, i) => (
          <Panel
            key={t.id}
            tab={t}
            panelId={`${id}-panel-${t.id}`}
            hidden={tab !== i}
            inert={!shown || folded}
            build={i < built || shown}
          />
        ))}
        <button
          type="button"
          className={styles.handle}
          aria-expanded={!folded}
          aria-label={folded ? `Show ${label}` : `Hide ${label}`}
          tabIndex={shown ? 0 : -1}
          onClick={() => {
            setOpen((o) => !o);
            audio.blip("click");
          }}
        >
          <span>{folded ? tabs[tab]?.label : "Hide"}</span>
        </button>
      </aside>
      {dock ? <div className={styles.dock}>{dock}</div> : null}
    </div>
  );
}
