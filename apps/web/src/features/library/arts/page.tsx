"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";

import { fetchLibraryJson, useLibraryData } from "../data";
import { useLightboxParam } from "../shared/gallery";
import { characterOptions, Chips, ControlBar, type ChipOption } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import styles from "./arts.module.css";
import { facetCounts, filterArts, splashRibbon, summaryLine } from "./filter";
import { OfficialTab } from "./official-tab";
import { Ribbon } from "./ribbon";
import { TabBar, TAB_IDS, type ArtsTab } from "./tab-bar";
import { ART_KINDS, KIND_LABELS, SCENES_DATA, type ArtItem, type ScenesFileHead } from "./types";
import { useArtFilters, type ArtView } from "./use-art-filters";
import { useQueryState } from "../use-query-state";

// The scene stills are the other half of the room, built on their own. Their code is a chunk of
// its own, and its file is read after the first paint.
const ScenesTab = dynamic(() => import("./scenes/scenes-tab"), { ssr: false });

const NONE: readonly ArtItem[] = [];

/** How many stills the scenes file holds, once it has arrived (null while unknown or missing). */
function useScenesCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    // After the first paint, so it never competes with the page itself.
    const timer = window.setTimeout(() => {
      fetchLibraryJson<ScenesFileHead>(SCENES_DATA).then(
        (file) => {
          if (live) setCount(file.items.length);
        },
        () => undefined,
      );
    }, 500);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, []);
  return count;
}

const VIEWS: ReadonlyArray<{ id: ArtView; label: string }> = [
  { id: "gallery", label: "Gallery" },
  { id: "wall", label: "Wall" },
];

export default function ArtsPage() {
  const { data } = useLibraryData<ArtItem>("arts");
  const [tabRaw, setTabRaw] = useQueryState("tab");
  const tab: ArtsTab = tabRaw === "scenes" ? "scenes" : "official";
  const scenes = useScenesCount();
  const state = useArtFilters();
  const { filters } = state;

  const all = data?.items ?? NONE;
  const shown = useMemo(() => filterArts(all, filters), [all, filters]);
  const counts = useMemo(() => facetCounts(all, filters), [all, filters]);
  // The kind chips count with the other filters kept, so the tally under the bar is the same.
  const lightbox = useLightboxParam(shown, "i", all);
  const ribbon = useMemo(() => splashRibbon(all), [all]);
  const isFiltered = Boolean(filters.q.trim() || filters.who || filters.kind || filters.pair);

  const kindOptions: ChipOption[] = ART_KINDS.map((k) => ({
    value: k,
    label: KIND_LABELS[k],
    count: counts.kind[k] ?? 0,
  }));
  const pairOptions: ChipOption[] = pairs.map((p) => ({
    value: p.id,
    label: p.names,
    count: counts.pair[p.id] ?? 0,
  }));

  const total = data ? all.length + (scenes ?? 0) : null;
  const onOfficial = tab === "official";

  const controls = (
    <>
      <TabBar
        tab={tab}
        onTab={(next) => {
          setTabRaw(next === "scenes" ? "scenes" : "");
        }}
        official={data ? all.length : null}
        scenes={scenes}
      />
      {onOfficial && data ? (
        <>
          <Ribbon
            items={ribbon}
            who={filters.who}
            onOpen={(id) => {
              lightbox.open(id);
            }}
          />
          <ControlBar
            query={filters.q}
            onQuery={state.setQ}
            placeholder="Search by name, character or kind"
            summary={summaryLine(shown.length, all.length, filters)}
            trailing={
              <div className={styles.views} role="group" aria-label="Layout">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`${styles.view} hud-label`}
                    aria-pressed={state.view === v.id}
                    onClick={() => {
                      audio.blip("click");
                      state.setView(v.id);
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className={styles.chipLine}>
              <Chips
                label="Character"
                options={characterOptions(counts.who)}
                value={filters.who}
                onChange={state.setWho}
              />
            </div>
          </ControlBar>
        </>
      ) : null}
    </>
  );

  return (
    <LibraryShell
      slug="arts"
      count={total}
      stat={data ? (scenes ? `${all.length} art, ${scenes} stills` : "Full quality") : undefined}
      controls={controls}
    >
      <div
        role="tabpanel"
        id={TAB_IDS[tab].panel}
        aria-labelledby={TAB_IDS[tab].tab}
        className={styles.panel}
      >
        {onOfficial ? (
          data ? (
            <OfficialTab
              all={all}
              shown={shown}
              view={state.view}
              lightbox={lightbox}
              filtered={isFiltered}
              onClear={state.clear}
              filterRows={
                <>
                  <Chips
                    label="Kind"
                    options={kindOptions}
                    value={filters.kind}
                    onChange={state.setKind}
                  />
                  <Chips
                    label="Pair"
                    options={pairOptions}
                    value={filters.pair}
                    onChange={state.setPair}
                  />
                </>
              }
            />
          ) : null
        ) : (
          <ScenesTab />
        )}
      </div>
    </LibraryShell>
  );
}
