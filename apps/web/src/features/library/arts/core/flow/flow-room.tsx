"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { expectReady } from "@/lib/page-ready";

import { useQueryState } from "../../../use-query-state";
import { CanonBadge, CreditLine } from "../../../shell/credit";
import { ArtsBack, ArtsSubNav, ArtsTakedown, useArtsBar } from "../chrome";
import type { OfficialRoom } from "../routes";
import type { ArtsItem, Facet } from "../types";
import { FilterChips, SearchField } from "./controls";
import { FlowField } from "./field";
import {
  buildIndex,
  chipsFor,
  countFacets,
  filterIndexes,
  liveFacets,
  searchIndexes,
  splitFacets,
} from "./filter";
import styles from "./flow.module.css";
import { ZoomProvider, type ZoomPicture } from "../zoom";

/** The rooms that use the flow. The three Official ones carry the sub-page buttons; Fanart and Cosplay do not. */
type FlowRoomId = "scene" | "game" | "others" | "fanart" | "cosplay";

const OFFICIAL: readonly string[] = ["scene", "game", "others"];

interface FlowRoomProps<T extends ArtsItem> {
  room: FlowRoomId;
  /** The big word at the top. */
  title: string;
  /** The pictures, in the order the rows take them. Null while the data loads. */
  items: readonly T[] | null;
  /** The data file could not be read. */
  failed?: boolean;
  /** The filter, ordered by how many pictures each holds. A stable array (a module constant or memoised). */
  facets: readonly Facet[];
  /** The facet ids of one picture. A stable function. */
  facetOf: (item: T) => readonly string[];
  /** Everything that can be searched in one picture, as one string. A stable function. */
  searchOf: (item: T) => string;
  /** The name of the filter for a screen reader, for example "Places". */
  facetLabel?: string;
  /** The word for one picture and for many. Default picture, pictures. */
  nouns?: readonly [string, string];
  /** The search field's label and placeholder. Default "Search". */
  searchLabel?: string;
  /** Extra controls beside the search (Fanart's artist view, Cosplay's switcher). */
  controls?: ReactNode;
  /** Extra lines under the title. */
  header?: ReactNode;
  /** What the zoom shows under the picture. Default: the title, and the badge and credit of work that is not official. A stable function. */
  caption?: (item: T) => ReactNode;
  /** A mark on a tile (a badge, a play sign). A stable function: a new one every render makes every row draw again. */
  overlay?: (item: T) => ReactNode;
}

function defaultCaption(item: ArtsItem): ReactNode {
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

function toZoom<T extends ArtsItem>(item: T, caption: (item: T) => ReactNode): ZoomPicture {
  return { id: item.id, img: item.img, alt: item.alt, title: item.title, caption: caption(item) };
}

/**
 * A room that is a flow of pictures: rows that slide sideways while the page scrolls, one way
 * down and the other way up, row by row. A search, a filter of the things that appear most (with
 * "See more"), the zoom, the way back and, for the Official rooms, the sub-page buttons. Nothing
 * else. Scene, Game, Others, Fanart and Cosplay are this component with their own data.
 */
export function FlowRoom<T extends ArtsItem>({
  room,
  title,
  items,
  failed = false,
  facets,
  facetOf,
  searchOf,
  facetLabel = "Filter",
  nouns = ["picture", "pictures"],
  searchLabel = "Search",
  controls,
  header,
  caption,
  overlay,
}: FlowRoomProps<T>) {
  useArtsBar("daybreak");
  const [q, setQ] = useQueryState("q");
  const [f, setF] = useQueryState("f");
  const { getLenis } = useLenis();

  const all = useMemo<readonly T[]>(() => items ?? [], [items]);
  const index = useMemo(
    () => buildIndex(all, facetOf, searchOf, facets),
    [all, facetOf, searchOf, facets],
  );

  // The search, then the filter. The counts on the chips follow the search only.
  const searched = useMemo(() => searchIndexes(index, q), [index, q]);
  const counts = useMemo(() => countFacets(index, searched), [index, searched]);
  const chosen = facets.some((facet) => facet.id === f) ? f : "";
  const shown = useMemo(() => {
    const keep = filterIndexes(index, searched, chosen);
    return keep.map((i) => all[i]).filter((item): item is T => item !== undefined);
  }, [index, searched, chosen, all]);

  const live = useMemo(
    () => liveFacets(facets, counts, q.trim() !== "", chosen),
    [facets, counts, q, chosen],
  );
  const wide = useChipCount();
  const { chips, more } = useMemo(() => splitFacets(live, wide, chosen), [live, wide, chosen]);

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

  // The curtain waits until the first rows stand.
  const mark = useRef<(() => void) | null>(null);
  useEffect(() => {
    mark.current = expectReady(`flow-${room}`);
    return () => {
      mark.current?.();
    };
  }, [room]);
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

  // The zoom.
  const captionOf = (caption ?? defaultCaption) as (item: T) => ReactNode;
  const pictures = useMemo(() => shown.map((item) => toZoom(item, captionOf)), [shown, captionOf]);

  const clear = useCallback(() => {
    setQ("");
    setF("");
  }, [setQ, setF]);

  const total = all.length;
  const searching = q.trim() !== "";
  const countText =
    items === null
      ? " "
      : shown.length === total
        ? `${total.toLocaleString("en-US")} ${total === 1 ? nouns[0] : nouns[1]}`
        : `${shown.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${nouns[1]}`;

  return (
    <ZoomProvider pictures={pictures} tone="light">
      <main className={styles.room} data-flow-room={room}>
        <ArtsBack />
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <div className={styles.heading}>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.count} aria-live="polite" data-flow-count="">
                {countText}
              </p>
            </div>
            <div className={styles.tools}>
              <SearchField value={q} onCommit={setQ} label={searchLabel} />
              {controls}
            </div>
          </div>
          {header}
          {items !== null && facets.length > 0 ? (
            <FilterChips
              total={searched.length}
              chips={chips}
              more={more}
              chosen={chosen}
              onPick={setF}
              label={facetLabel}
            />
          ) : null}
        </header>

        <FlowField
          // A new result fades in.
          key={`${q}|${chosen}`}
          items={shown}
          overlay={overlay}
          loading={items === null}
          onStanding={onStanding}
        />

        {failed ? (
          <div className={styles.empty}>
            <p>The pictures could not be read. Reload the page to try again.</p>
          </div>
        ) : items !== null && shown.length === 0 ? (
          <div className={styles.empty} data-flow-empty="">
            <p>
              {searching || chosen
                ? "Nothing matches. Clear the search or the filter to see every picture."
                : "There is nothing here yet."}
            </p>
            {searching || chosen ? (
              <button type="button" className={styles.plain} onClick={clear}>
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {OFFICIAL.includes(room) ? <ArtsSubNav room={room as OfficialRoom} /> : null}
        <ArtsTakedown />
      </main>
    </ZoomProvider>
  );
}

/** How many chips the page's width allows, and the same on the first render. */
function useChipCount(): number {
  const [n, setN] = useState(6);
  useEffect(() => {
    const set = () => {
      setN(chipsFor(window.innerWidth));
    };
    set();
    window.addEventListener("resize", set, { passive: true });
    return () => {
      window.removeEventListener("resize", set);
    };
  }, []);
  return n;
}
