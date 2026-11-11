"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { expectReady } from "@/lib/page-ready";

import { CanonBadge, CreditLine } from "../../shell/credit";
import { useQueryState } from "../../use-query-state";
import { ArtsBack, ArtsSubNav, ArtsTakedown, useArtsBar } from "../core/chrome";
import { useArtsData } from "../core/data";
import { SearchField } from "../core/flow/controls";
import { ZoomProvider, type ZoomPicture } from "../core/zoom";
import { Finder } from "./finder";
import styles from "./design.module.css";
import { alignOffset, sheetKey } from "./layout";
import {
  buildDesignIndex,
  isWideWriting,
  kindFacets,
  resolveQuery,
  sheetNumber,
  viewOf,
  whoFacets,
} from "./model";
import { Rail, type RailEntry } from "./rail";
import { Sheet } from "./sheet";
import type { DesignHead, DesignItem } from "./types";

/** The sheets the curtain waits for: the ones on the first screen. */
const FIRST_SHEETS = 3;
const NO_ITEMS: readonly DesignItem[] = [];

interface Screen {
  vw: number;
  vh: number;
  dpr: number;
}

const SERVER_SCREEN: Screen = { vw: 1440, vh: 900, dpr: 1 };

function readScreen(): Screen {
  if (typeof window === "undefined") return SERVER_SCREEN;
  return {
    vw: document.documentElement.clientWidth,
    vh: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

/** The size of the screen, which decides what size of file a sheet asks for. It follows a resize 150 ms after it stops. */
function useScreen(): Screen {
  const [screen, setScreen] = useState<Screen>(readScreen);
  useEffect(() => {
    let timer = 0;
    const set = () => {
      const next = readScreen();
      setScreen((old) =>
        old.vw === next.vw && old.vh === next.vh && old.dpr === next.dpr ? old : next,
      );
    };
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(set, 150);
    };
    set();
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return screen;
}

function captionOf(item: DesignItem): ReactNode {
  return (
    <>
      <span>{item.title}</span>
      {item.canon !== "official" || item.credit ? (
        <>
          <CanonBadge canon={item.canon} />
          <CreditLine credit={item.credit} canon={item.canon} />
        </>
      ) : null}
    </>
  );
}

function toZoom(item: DesignItem): ZoomPicture {
  return {
    id: item.id,
    img: item.img,
    alt: item.alt,
    title: item.title,
    caption: captionOf(item),
  };
}

/** The section of a sheet, by id. */
function sectionOf(id: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(
      `[data-design-section][data-id="${CSS.escape(id)}"]`,
    );
  } catch {
    return null;
  }
}

/**
 * Design: the character and equipment sheets, one to a section in a calm vertical scroll, on a
 * quiet plate with the name and notes beside each. A search, a filter by kind and by Aspirant,
 * the zoom, an index that follows the scroll, the sub-page buttons and the way back.
 */
export default function DesignPage() {
  useArtsBar("daybreak");
  const { data, failed } = useArtsData<DesignItem, DesignHead>("design");
  const [q, setQ] = useQueryState("q");
  const [k, setK] = useQueryState("k");
  const [a, setA] = useQueryState("a");
  const [wanted] = useQueryState("i");
  const { getLenis } = useLenis();
  const transition = useTransitionRouter();
  const screen = useScreen();
  const roomRef = useRef<HTMLElement>(null);

  const items = data?.items ?? NO_ITEMS;
  const index = useMemo(() => buildDesignIndex(items), [items]);
  const kinds = useMemo(() => kindFacets(data), [data]);
  const who = useMemo(() => whoFacets(items), [items]);
  const query = useMemo(
    () => resolveQuery({ q, kind: k, who: a }, kinds, who),
    [q, k, a, kinds, who],
  );
  const view = useMemo(() => viewOf(items, index, query), [items, index, query]);
  const places = useMemo(() => new Map(items.map((item, i) => [item.id, i + 1])), [items]);
  const shown = view.shown;

  // The zoom steps through the sheets that show.
  const pictures = useMemo(() => shown.map(toZoom), [shown]);

  // The curtain waits until the first sheets have arrived (or failed), then two frames more.
  const mark = useRef<(() => void) | null>(null);
  const settled = useRef(new Set<string>());
  const [arrived, setArrived] = useState(0);
  useEffect(() => {
    mark.current = expectReady("library-arts-design");
    return () => {
      mark.current?.();
    };
  }, []);
  const onSettled = useCallback((id: string) => {
    if (settled.current.has(id)) return;
    settled.current.add(id);
    setArrived((n) => n + 1);
  }, []);
  const firstIds = useMemo(() => shown.slice(0, FIRST_SHEETS).map((item) => item.id), [shown]);
  useEffect(() => {
    const ready =
      failed ||
      (data !== null && firstIds.length === 0) ||
      (arrived > 0 && firstIds.every((id) => settled.current.has(id)));
    if (!ready) return;
    // One frame later, so the curtain opens on a drawn page.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mark.current?.();
      });
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [failed, data, firstIds, arrived]);

  // A new result starts at the top of the page, where the filter is.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (window.scrollY > 0) {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    }
  }, [q, k, a, getLenis]);

  // The sheets come in as they reach the screen, once the page is uncovered.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!data) return;
    let timer = 0;
    let waited = 0;
    const go = () => {
      if (transition.isTransitioning() && waited < 60) {
        waited += 1;
        timer = window.setTimeout(go, 80);
        return;
      }
      setEntered(true);
    };
    go();
    return () => {
      window.clearTimeout(timer);
    };
  }, [data, transition]);

  useEffect(() => {
    if (!entered) return;
    const root = roomRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.seen = "";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    root.querySelectorAll("[data-design-section]:not([data-seen])").forEach((el) => {
      io.observe(el);
    });
    return () => {
      io.disconnect();
    };
  }, [entered, shown]);

  // The index: the sheet that stands across the middle of the screen is the current one.
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const root = roomRef.current;
    if (!root || shown.length === 0) return;
    const inBand = new Set<HTMLElement>();
    const choose = () => {
      let best: HTMLElement | null = null;
      let gap = Infinity;
      const mid = window.innerHeight / 2;
      for (const el of inBand) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < gap) {
          gap = d;
          best = el;
        }
      }
      if (best?.dataset.id) setCurrent(best.dataset.id);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) inBand.add(el);
          else inBand.delete(el);
        }
        choose();
      },
      { rootMargin: "-46% 0px -46% 0px" },
    );
    root.querySelectorAll("[data-design-section]").forEach((el) => {
      io.observe(el);
    });
    setCurrent((old) =>
      old && shown.some((item) => item.id === old) ? old : (shown[0]?.id ?? null),
    );
    return () => {
      io.disconnect();
    };
  }, [shown]);

  // The nav bar's height, read when it is needed.
  const barHeight = () => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const nav = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
    );
    return (Number.isFinite(nav) ? nav : 4) * rem;
  };

  /** Bring a sheet into view, now (behind the viewer) or by gliding (the index). */
  const bring = useCallback(
    (id: string, now: boolean) => {
      const el = sectionOf(id);
      if (!el) return;
      // A sheet brought in behind the viewer is shown at once, so it is still when the viewer lands on it.
      if (now) el.dataset.seen = "";
      const offset = alignOffset(el.offsetHeight, window.innerHeight, barHeight());
      const lenis = getLenis();
      if (lenis) {
        // The sections have only just stood: let the smooth scroll measure the page first, or it
        // clamps the move to the old, shorter page.
        lenis.resize();
        lenis.scrollTo(
          el,
          now ? { offset, immediate: true, force: true } : { offset, duration: 1.1 },
        );
      } else {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset });
      }
    },
    [getLenis],
  );

  // A sheet named by the address (a deep link, the library search, the arrow keys in the viewer) is
  // brought into view behind the viewer, so its tile is there for the viewer to land on.
  useEffect(() => {
    if (!wanted || !data) return;
    const el = sectionOf(wanted);
    const tile = el?.querySelector<HTMLElement>("[data-design-sheet]");
    if (!el || !tile) return;
    const r = tile.getBoundingClientRect();
    const seen = r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    if (!seen) bring(wanted, true);
  }, [wanted, data, bring, shown]);

  const clear = useCallback(() => {
    setQ("");
    setK("");
    setA("");
  }, [setQ, setK, setA]);

  const total = items.length;
  const searching = q.trim() !== "";
  const filtered = query.kind !== "" || query.who !== "";
  const countText =
    data === null
      ? " "
      : shown.length === total
        ? `${total} ${total === 1 ? "sheet" : "sheets"}`
        : `${shown.length} of ${total} ${total === 1 ? "sheet" : "sheets"}`;

  const entries = useMemo<RailEntry[]>(
    () =>
      shown.map((item) => ({
        id: item.id,
        no: sheetNumber(places.get(item.id) ?? 0),
        title: item.title,
      })),
    [shown, places],
  );

  return (
    <ZoomProvider pictures={pictures} tone="light">
      <main ref={roomRef} className={styles.room} data-design-room="" data-reveal="on">
        <ArtsBack />
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <div className={styles.heading}>
              <h1 className={styles.title}>Design</h1>
              <p className={styles.count} aria-live="polite" data-design-count="">
                {countText}
              </p>
            </div>
            <div className={styles.tools}>
              <SearchField value={q} onCommit={setQ} label="Search designs" />
            </div>
          </div>
          {data !== null ? (
            <Finder
              kinds={kinds}
              who={who}
              view={view}
              chosenKind={query.kind}
              chosenWho={query.who}
              onKind={setK}
              onWho={setA}
              onAll={() => {
                setK("");
                setA("");
              }}
            />
          ) : null}
        </header>

        {data !== null && shown.length > 0 ? (
          <div className={styles.list} data-design-list="">
            {shown.map((item, i) => (
              <Sheet
                key={item.id}
                item={item}
                place={places.get(item.id) ?? i + 1}
                total={total}
                fileKey={sheetKey(item.img, screen.vw, screen.vh, screen.dpr)}
                first={i < FIRST_SHEETS}
                turnHint={isWideWriting(item)}
                onSettled={i < FIRST_SHEETS ? onSettled : undefined}
              />
            ))}
          </div>
        ) : null}

        {failed ? (
          <div className={styles.empty}>
            <p>The sheets could not be read. Reload the page to try again.</p>
          </div>
        ) : data !== null && shown.length === 0 ? (
          <div className={styles.empty} data-design-empty="">
            <p>
              {searching || filtered
                ? "Nothing matches. Clear the search or the filter to see every sheet."
                : "There is nothing here yet."}
            </p>
            {searching || filtered ? (
              <button type="button" className={styles.plain} onClick={clear}>
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        <Rail
          entries={entries}
          current={current}
          onPick={(id) => {
            bring(id, false);
          }}
        />
        <ArtsSubNav room="design" />
        <ArtsTakedown />
      </main>
    </ZoomProvider>
  );
}
