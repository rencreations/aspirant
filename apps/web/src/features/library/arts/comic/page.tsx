"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { expectReady } from "@/lib/page-ready";

import { useQueryState } from "../../use-query-state";
import { ArtsBack, ArtsSubNav, ArtsTakedown, useArtsBar } from "../core/chrome";
import { FilterChips, SearchField } from "../core/flow/controls";
import {
  buildIndex,
  countFacets,
  filterIndexes,
  liveFacets,
  searchIndexes,
  splitFacets,
} from "../core/flow/filter";
import { useArtsData } from "../core/data";
import { ZoomProvider, type ZoomPicture } from "../core/zoom";
import { comicFacetOf, comicFacets, comicSearchOf, placeLabel } from "./facets";
import { ComicField } from "./field";
import styles from "./comic.module.css";
import type { ComicHead, ComicItem } from "./types";

/** Every chip shows (there are six). A longer list would put the rest behind "See more". */
const CHIPS = 8;

function captionOf(item: ComicItem): ReactNode {
  return item.note ? `${item.alt} ${item.note}` : item.alt;
}

/** A strip taller than the screen is read by scrolling it in the viewer; every other panel is shown whole. */
function toZoom(item: ComicItem): ZoomPicture {
  return {
    id: item.id,
    img: item.img,
    alt: item.alt,
    title: placeLabel(item),
    mode: item.shape === "tall" ? "scroll" : "fit",
    caption: captionOf(item),
  };
}

/**
 * Comic: the art made for the two webtoons, without their words, in the order of the books. The
 * panels are of every shape, so they stand in lanes at one width each and are read by scrolling
 * (see `layout.ts`). A search, a filter by comic and by Aspirant, the sub-page buttons and the way
 * back. Nothing else.
 */
export default function ComicPage() {
  useArtsBar("daybreak");
  const { data, failed } = useArtsData<ComicItem, ComicHead>("comic");
  const [q, setQ] = useQueryState("q");
  const [f, setF] = useQueryState("f");
  const { getLenis } = useLenis();

  const items = data?.items ?? null;
  const all = useMemo<readonly ComicItem[]>(() => items ?? [], [items]);
  const facets = useMemo(() => comicFacets(data), [data]);
  const index = useMemo(() => buildIndex(all, comicFacetOf, comicSearchOf, facets), [all, facets]);

  // The search, then the filter. The counts on the chips follow the search only.
  const searched = useMemo(() => searchIndexes(index, q), [index, q]);
  const counts = useMemo(() => countFacets(index, searched), [index, searched]);
  const chosen = facets.some((facet) => facet.id === f) ? f : "";
  const shown = useMemo(() => {
    const keep = filterIndexes(index, searched, chosen);
    return keep.map((i) => all[i]).filter((item): item is ComicItem => item !== undefined);
  }, [index, searched, chosen, all]);

  const live = useMemo(
    () => liveFacets(facets, counts, q.trim() !== "", chosen),
    [facets, counts, q, chosen],
  );
  const { chips, more } = useMemo(() => splitFacets(live, CHIPS, chosen), [live, chosen]);

  // A new result starts at the top of the page, where the filter is.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.scrollY > 0) {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    }
  }, [q, chosen, getLenis]);

  // The curtain waits until the first panels have drawn.
  const mark = useRef<(() => void) | null>(null);
  useEffect(() => {
    mark.current = expectReady("comic-room");
    return () => {
      mark.current?.();
    };
  }, []);
  const onStanding = useCallback(() => {
    // One frame later, so the curtain opens on a drawn page.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mark.current?.();
      });
    });
  }, []);
  useEffect(() => {
    if (failed) mark.current?.();
  }, [failed]);

  const pictures = useMemo(() => shown.map(toZoom), [shown]);

  const clear = useCallback(() => {
    setQ("");
    setF("");
  }, [setQ, setF]);

  const total = all.length;
  const searching = q.trim() !== "";
  const countText =
    items === null
      ? " "
      : shown.length === total
        ? `${total.toLocaleString("en-US")} ${total === 1 ? "panel" : "panels"}`
        : `${shown.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} panels`;

  return (
    <ZoomProvider pictures={pictures} tone="light">
      <main className={styles.room} data-comic-room="">
        <ArtsBack />
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <div className={styles.heading}>
              <h1 className={styles.title}>Comic</h1>
              <p className={styles.count} aria-live="polite" data-comic-count="">
                {countText}
              </p>
            </div>
            <div className={styles.tools}>
              <SearchField value={q} onCommit={setQ} label="Search panels" />
            </div>
          </div>
          {items !== null && facets.length > 0 ? (
            <FilterChips
              total={searched.length}
              chips={chips}
              more={more}
              chosen={chosen}
              onPick={setF}
              label="Comic and Aspirant"
            />
          ) : null}
        </header>

        {items !== null && shown.length > 0 ? (
          // A new result fades in.
          <ComicField key={`${q}|${chosen}`} items={shown} onStanding={onStanding} />
        ) : null}

        {failed ? (
          <div className={styles.empty}>
            <p>The pictures could not be read. Reload the page to try again.</p>
          </div>
        ) : items !== null && shown.length === 0 ? (
          <div className={styles.empty} data-comic-empty="">
            <p>
              {searching || chosen
                ? "Nothing matches. Clear the search or the filter to see every panel."
                : "There is nothing here yet."}
            </p>
            {searching || chosen ? (
              <button type="button" className={styles.plain} onClick={clear}>
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {items !== null && shown.length === 0 ? <Ready onStanding={onStanding} /> : null}

        <ArtsSubNav room="comic" />
        <ArtsTakedown />
      </main>
    </ZoomProvider>
  );
}

/** A result with nothing in it has no pictures to wait for. */
function Ready({ onStanding }: { onStanding: () => void }) {
  useEffect(() => {
    onStanding();
  }, [onStanding]);
  return null;
}
