"use client";

import { useMemo } from "react";

import { useLibraryData } from "../data";
import { Lightbox, useLightboxParam } from "../shared/gallery";
import { characterOptions, Chips, ControlBar, type ChipOption } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { Artists } from "./artists";
import styles from "./fanart.module.css";
import {
  artistOrder,
  byDate,
  countBy,
  filterItems,
  groupByArtist,
  isFiltered,
  kindOf,
  pairName,
  toPicture,
} from "./model";
import type { FanItem, Filters, KindFilter } from "./types";
import { VideoRow } from "./video-row";
import { Wall } from "./wall";

const KINDS: readonly KindFilter[] = ["art", "cosplay", "video"];
const KIND_LABEL: Record<Exclude<KindFilter, "">, string> = {
  art: "Art",
  cosplay: "Cosplay",
  video: "Videos",
};
const PAIR_IDS = [
  "fanny-layla",
  "ruby-angela",
  "lesley-change",
  "guinevere-vexana",
  "selena-obsidia",
];

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export default function FanartPage() {
  const { data, failed } = useLibraryData<FanItem>("fanart");
  const [q, setQ] = useQueryState("q");
  const [pair, setPair] = useQueryState("pair");
  const [who, setWho] = useQueryState("who");
  const [platform, setPlatform] = useQueryState("platform");
  const [kindRaw, setKind] = useQueryState("kind");
  const [viewRaw, setView] = useQueryState("view");

  const kind: KindFilter = (KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as KindFilter)
    : "";
  const view = viewRaw === "artist" ? "artist" : "wall";
  const filters: Filters = useMemo(
    () => ({ q, pair, who, platform, kind }),
    [q, pair, who, platform, kind],
  );
  const filtered = isFiltered(filters);

  const all = useMemo(() => byDate(data?.items ?? []), [data]);
  const allPictures = useMemo(() => all.filter((i) => i.kind !== "video").map(toPicture), [all]);
  const shown = useMemo(() => filterItems(all, filters), [all, filters]);
  const shownPictures = useMemo(() => {
    const ids = new Set(shown.filter((i) => i.kind !== "video").map((i) => i.id));
    return allPictures.filter((p) => ids.has(p.id));
  }, [shown, allPictures]);
  // Fan videos first, then the official reels.
  const shownVideos = useMemo(
    () =>
      shown
        .filter((i) => i.kind === "video")
        .sort((a, b) => Number(a.canon !== "fan") - Number(b.canon !== "fan")),
    [shown],
  );
  const byArtist = useMemo(() => groupByArtist(shown), [shown]);

  // The viewer walks the pictures in the order the page shows them.
  const viewerList = useMemo(() => {
    if (view !== "artist") return shownPictures;
    const pics = new Map(allPictures.map((p) => [p.id, p]));
    return artistOrder(byArtist)
      .map((i) => pics.get(i.id))
      .filter((p): p is (typeof allPictures)[number] => Boolean(p));
  }, [view, shownPictures, allPictures, byArtist]);
  const lightbox = useLightboxParam(viewerList, "i", allPictures);
  const focusVideo = all.find((i) => i.id === lightbox.id && i.kind === "video") ? lightbox.id : "";

  const pairCounts = useMemo(() => countBy(all, filters, "pair", (i) => i.pairs), [all, filters]);
  const whoCounts = useMemo(() => countBy(all, filters, "who", (i) => i.chars), [all, filters]);
  const platformCounts = useMemo(
    () => countBy(all, filters, "platform", (i) => (i.platform ? [i.platform] : [])),
    [all, filters],
  );
  const kindCounts = useMemo(
    () => countBy(all, filters, "kind", (i) => [kindOf(i)]),
    [all, filters],
  );

  const pairOptions: ChipOption[] = PAIR_IDS.map((id) => ({
    value: id,
    label: pairName(id),
    count: pairCounts.get(id) ?? 0,
  }));
  const platformOptions: ChipOption[] = useMemo(() => {
    const names = new Set(all.map((i) => i.platform).filter((p): p is string => Boolean(p)));
    return [...names]
      .map((p) => ({ value: p, label: p, count: platformCounts.get(p) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));
  }, [all, platformCounts]);
  const kindOptions: ChipOption[] = KINDS.map((k) => ({
    value: k,
    label: KIND_LABEL[k as Exclude<KindFilter, "">],
    count: kindCounts.get(k) ?? 0,
  }));

  const artistCount = useMemo(
    () => new Set(all.filter((i) => i.artist && i.canon === "fan").map((i) => i.artist)).size,
    [all],
  );

  const clear = () => {
    setQ("");
    setPair("");
    setWho("");
    setPlatform("");
    setKind("");
  };

  const summary = `${plural(shownPictures.length, "picture", "pictures")} and ${plural(shownVideos.length, "video", "videos")}${filtered ? " match" : ""}`;
  const hasPictures = kind !== "video";
  const showVideoRow =
    view === "wall" && shownVideos.length > 0 && kind !== "art" && kind !== "cosplay";
  const nothing = data !== null && shown.length === 0;

  const controls = (
    <ControlBar
      query={q}
      onQuery={setQ}
      placeholder="Search by title, artist, character or word"
      summary={summary}
      trailing={
        <div className={styles.views} role="group" aria-label="View">
          <button
            type="button"
            className={styles.view}
            aria-pressed={view === "wall"}
            onClick={() => {
              setView("");
            }}
          >
            Wall
          </button>
          <button
            type="button"
            className={styles.view}
            aria-pressed={view === "artist"}
            onClick={() => {
              setView("artist");
            }}
          >
            By artist
          </button>
        </div>
      }
    />
  );

  return (
    <LibraryShell
      slug="fanart"
      count={data ? data.items.length : null}
      stat={data ? plural(artistCount, "named artist", "named artists") : undefined}
      controls={controls}
    >
      {failed ? (
        <div className="shell">
          <p className={styles.empty}>
            The fan art could not be loaded. Reload the page to try again.
          </p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="shell">
            <div className={styles.filters}>
              <Chips
                label="Kind"
                options={kindOptions}
                value={kind}
                onChange={setKind}
                all="Everything"
              />
              <Chips label="Pair" options={pairOptions} value={pair} onChange={setPair} />
              <Chips
                label="Character"
                options={characterOptions(Object.fromEntries(whoCounts))}
                value={who}
                onChange={setWho}
              />
              <Chips
                label="Platform"
                options={platformOptions}
                value={platform}
                onChange={setPlatform}
              />
              {filtered ? (
                <button type="button" className={styles.clear} onClick={clear}>
                  Clear the filters
                </button>
              ) : null}
            </div>
          </div>

          {showVideoRow ? (
            <VideoRow videos={shownVideos} focusId={focusVideo} grid={kind === "video"} />
          ) : null}

          {nothing ? (
            <div className="shell">
              <div className={styles.empty}>
                <p className={`${styles.emptyTitle} display`}>Nothing matches.</p>
                <p>Try fewer words, or another character, pair or platform.</p>
                <button type="button" className={styles.clear} onClick={clear}>
                  Clear the filters
                </button>
              </div>
            </div>
          ) : view === "artist" ? (
            <Artists
              artists={byArtist.artists}
              posts={byArtist.posts}
              official={byArtist.official}
              unnamed={byArtist.unnamed}
              activeId={lightbox.id || null}
              onOpen={lightbox.open}
            />
          ) : hasPictures ? (
            <div className={`shell ${styles.wallBox}`}>
              <Wall
                all={allPictures}
                shown={shownPictures}
                label="Fan art"
                activeId={lightbox.id || null}
                onOpen={lightbox.open}
              />
            </div>
          ) : null}

          <Lightbox
            items={lightbox.list}
            index={lightbox.index}
            onIndexChange={lightbox.setIndex}
            label="Fan art"
          />
        </>
      ) : null}
    </LibraryShell>
  );
}
