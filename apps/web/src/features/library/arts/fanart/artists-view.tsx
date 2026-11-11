"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";

import { useQueryState } from "../../use-query-state";
import { ArtsBack, ArtsTakedown, useArtsBar } from "../core/chrome";
import { FilterChips, SearchField } from "../core/flow/controls";
import {
  buildIndex,
  chipsFor,
  countFacets,
  liveFacets,
  searchIndexes,
  splitFacets,
} from "../core/flow/filter";
import { tileRatio } from "../core/flow/math";
import { ZoomProvider, useZoomTile, type ZoomPicture } from "../core/zoom";
import styles from "./artists.module.css";
import { fanCaption } from "./caption";
import {
  allNewest,
  artistOrder,
  canonLabel,
  fanFacetOf,
  fanFacets,
  fanFilter,
  fanSearchOf,
  formatDate,
  groupByArtist,
} from "./model";
import type { FanItem } from "./types";
import { VideoEntry } from "./video-strip";
import { ViewToggle } from "./view-toggle";

/** How many chips the page's width allows (the same count the flow uses). */
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

function toZoom(item: FanItem): ZoomPicture {
  return {
    id: item.id,
    img: item.img,
    alt: item.alt,
    title: item.title,
    caption: fanCaption(item),
  };
}

/** One picture: a button that opens the zoom, in the picture's own shape. */
function ArtTile({ item }: { item: FanItem }) {
  const zoom = useZoomTile(item.id, "light");
  return (
    <button
      type="button"
      {...zoom}
      className={`${zoom.className} ${styles.tile}`}
      aria-label={item.alt}
      data-fanart-tile=""
      data-id={item.id}
      style={{
        aspectRatio: tileRatio(item.img.w, item.img.h),
        backgroundColor: item.img.c,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.pic}
        src={libUrl(item.img.t)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </button>
  );
}

function Tiles({ items, focusId }: { items: readonly FanItem[]; focusId: string }) {
  return (
    <ul className={styles.tiles}>
      {items.map((item) =>
        item.kind === "video" ? (
          <li key={item.id} className={styles.videoCell}>
            <VideoEntry item={item} focused={item.id === focusId} />
          </li>
        ) : (
          <li key={item.id} className={styles.cell}>
            <ArtTile item={item} />
          </li>
        ),
      )}
    </ul>
  );
}

function tally(items: readonly FanItem[]): { pictures: number; videos: number } {
  const videos = items.filter((i) => i.kind === "video").length;
  return { pictures: items.length - videos, videos };
}

function Counts({ items }: { items: readonly FanItem[] }) {
  const { pictures, videos } = tally(items);
  return (
    <p className={`${styles.counts} hud-label`}>
      {pictures > 0 ? (
        <span>
          <b>{pictures}</b> {pictures === 1 ? "picture" : "pictures"}
        </span>
      ) : null}
      {videos > 0 ? (
        <span>
          <b>{videos}</b> {videos === 1 ? "video" : "videos"}
        </span>
      ) : null}
    </p>
  );
}

function Block({
  id,
  title,
  sub,
  link,
  items,
  focusId,
}: {
  id: string;
  title: string;
  sub?: string | null;
  link?: string | null;
  items: readonly FanItem[];
  focusId: string;
}) {
  const colour = items[0]?.img.c ?? "#888888";
  return (
    <section
      className={styles.block}
      style={{ ["--c" as string]: colour }}
      aria-labelledby={id}
      data-fanart-block=""
    >
      <header className={styles.blockHead}>
        <div className={styles.who}>
          <h2 id={id} className={styles.name}>
            {title}
          </h2>
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </div>
        <Counts items={items} />
        {link ? (
          <TLink href={link as `https://${string}`} className="link">
            View the original
          </TLink>
        ) : null}
      </header>
      <Tiles items={items} focusId={focusId} />
    </section>
  );
}

/**
 * Fanart by artist: every piece under the artist who made it, with how many pictures and videos
 * each made. Group posts (the post does not say who made which picture), the official reels and the
 * work whose maker the sources do not name are kept apart, as before. The head, the search, the
 * filter and the zoom are the flow's: the same address (`q`, `f`), the same chips.
 */
export function ArtistsView({ all, failed }: { all: readonly FanItem[] | null; failed: boolean }) {
  useArtsBar("daybreak");
  const [q, setQ] = useQueryState("q");
  const [f, setF] = useQueryState("f");

  const sorted = useMemo(() => (all ? allNewest(all) : null), [all]);
  const facets = useMemo(() => (sorted ? fanFacets(sorted) : []), [sorted]);
  const chosen = facets.some((facet) => facet.id === f) ? f : "";
  const shown = useMemo(
    () => (sorted ? fanFilter(sorted, facets, q, f) : []),
    [sorted, facets, q, f],
  );

  const index = useMemo(
    () => buildIndex(sorted ?? [], fanFacetOf, fanSearchOf, facets),
    [sorted, facets],
  );
  const searched = useMemo(() => searchIndexes(index, q), [index, q]);
  const counts = useMemo(() => countFacets(index, searched), [index, searched]);
  const live = useMemo(
    () => liveFacets(facets, counts, q.trim() !== "", chosen),
    [facets, counts, q, chosen],
  );
  const wide = useChipCount();
  const { chips, more } = useMemo(() => splitFacets(live, wide, chosen), [live, wide, chosen]);

  const groups = useMemo(() => groupByArtist(shown), [shown]);
  const pictures = useMemo(
    () =>
      artistOrder(groups)
        .filter((i) => i.kind !== "video")
        .map(toZoom),
    [groups],
  );

  // A video that the address names is marked once and brought into view. It never starts. A
  // picture opened and closed afterwards takes the address to its own id and back: that changes
  // nothing here (no jump, no new mark). A cleared address forgets the video.
  const [wanted] = useQueryState("i");
  const named = shown.some((item) => item.kind === "video" && item.id === wanted) ? wanted : "";
  const [marked, setMarked] = useState("");
  const nextMark = wanted ? named || marked : "";
  if (nextMark !== marked) setMarked(nextMark);
  useEffect(() => {
    if (!marked) return;
    document
      .querySelector(`[data-video="${CSS.escape(marked)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [marked]);

  const clear = useCallback(() => {
    setQ("");
    setF("");
  }, [setQ, setF]);

  const total = all?.length ?? 0;
  const countText =
    all === null
      ? " "
      : shown.length === total
        ? `${total.toLocaleString("en-US")} pieces`
        : `${shown.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} pieces`;
  const filtered = q.trim() !== "" || chosen !== "";

  return (
    <ZoomProvider pictures={pictures} tone="light">
      <main className={styles.room} data-fanart-artists="">
        <ArtsBack />
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <div className={styles.heading}>
              <h1 className={styles.title}>Fanart</h1>
              <p className={styles.count} aria-live="polite" data-flow-count="">
                {countText}
              </p>
            </div>
            <div className={styles.tools}>
              <SearchField value={q} onCommit={setQ} label="Search fan art" />
              <ViewToggle />
            </div>
          </div>
          {all !== null && facets.length > 0 ? (
            <FilterChips
              total={searched.length}
              chips={chips}
              more={more}
              chosen={chosen}
              onPick={setF}
              label="Filter by Aspirant, pair, platform or artist"
            />
          ) : null}
        </header>

        {failed ? (
          <div className={styles.empty}>
            <p>The pieces could not be read. Reload the page to try again.</p>
          </div>
        ) : all !== null && shown.length === 0 ? (
          <div className={styles.empty} data-fanart-empty="">
            <p>
              {filtered
                ? "Nothing matches. Clear the search or the filter to see every piece."
                : "There is nothing here yet."}
            </p>
            {filtered ? (
              <button type="button" className={styles.plain} onClick={clear}>
                Clear
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.blocks}>
            {groups.artists.map((a, n) => (
              <Block
                key={a.key}
                id={`artist-${n}`}
                title={a.name}
                sub={a.platform}
                items={a.items}
                focusId={marked}
              />
            ))}

            {groups.posts.length > 0 ? (
              <h2 className={styles.part}>Group posts, several artists</h2>
            ) : null}
            {groups.posts.map((p, n) => (
              <Block
                key={p.key}
                id={`post-${n}`}
                title={`Group post${p.date ? `, ${formatDate(p.date) ?? ""}` : ""}`}
                sub={
                  p.artists.length > 0
                    ? `Named in the post: ${p.artists.join(", ")}`
                    : (p.platform ?? undefined)
                }
                link={p.key.startsWith("https://") ? p.key : null}
                items={p.items}
                focusId={marked}
              />
            ))}

            {groups.official.length > 0 ? (
              <Block
                id="official"
                title="Mobile Legends: Bang Bang"
                sub={canonLabel(groups.official[0]!)}
                items={groups.official}
                focusId={marked}
              />
            ) : null}

            {groups.unnamed.length > 0 ? (
              <Block
                id="unnamed"
                title="Artist not named"
                sub="The sources do not say who made these"
                items={groups.unnamed}
                focusId={marked}
              />
            ) : null}
          </div>
        )}

        <ArtsTakedown />
      </main>
    </ZoomProvider>
  );
}
