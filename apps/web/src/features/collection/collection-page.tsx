"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { ThemeZone } from "@/components/theme-zone";
import { HudPanel } from "@/components/ui/hud-panel";
import { useReducedMotion } from "@/lib/hooks";

import { ArchiveHeader } from "./archive-header";
import { FilterBar, type SectionFilter } from "./filter-bar";
import { itemText, matchesQuery, matchesWho, whoLabel } from "./filter";
import { whenIdle } from "./idle";
import { MiniPlayer } from "./mini-player";
import { closePlayer, setQueue } from "./player-store";
import { SectionShell } from "./section-shell";
import {
  ComicsContent,
  EmptySection,
  FanCredit,
  FilmsContent,
  GalleryContent,
  MusicContent,
} from "./sections";
import styles from "./sections.module.css";
import {
  SECTIONS,
  type ArtItem,
  type ClientCatalog,
  type ComicItem,
  type FanArtItem,
  type FilmItem,
  type SectionId,
  type WhoFilter,
} from "./types";
import VoiceArchive from "./voice-archive";
import {
  buildVoiceRows,
  roundRobin,
  voiceMatches,
  voicePair,
  type VoiceRow,
  type VoiceTable,
} from "./voice-data";

const CinemaDialog = dynamic(() => import("./cinema-dialog"), { ssr: false });
const ArtViewer = dynamic(() => import("./art-viewer"), { ssr: false });
const ComicReader = dynamic(() => import("./comic-reader"), { ssr: false });

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/** How many cards each section shows in the "All" overview. */
const DIGEST = { wide: 6, vertical: 5, art: 8, fanart: 10, voice: 6 } as const;
const VOICE_PAGE = 24;

const textCache = new WeakMap<object, string>();
function textOf(item: Parameters<typeof itemText>[0]): string {
  let text = textCache.get(item);
  if (text === undefined) {
    text = itemText(item);
    textCache.set(item, text);
  }
  return text;
}

function voiceMatchesWho(row: VoiceRow, who: WhoFilter): boolean {
  if (who.type === "all") return true;
  if (who.type === "pair") return voicePair(row.slug) === who.id;
  return row.slug === who.slug;
}

const byId = <T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, number> =>
  new Map(items.map((item, i) => [item.id, i]));

/** Fan art in three groups: both together, Fanny, Layla. */
function groupFanArt(items: readonly FanArtItem[]) {
  return [
    { id: "both", label: "Fanny and Layla", items: items.filter((p) => p.characters.length > 1) },
    {
      id: "fanny",
      label: "Fanny",
      items: items.filter((p) => p.characters.length === 1 && p.characters[0] === "fanny"),
    },
    {
      id: "layla",
      label: "Layla",
      items: items.filter((p) => p.characters.length === 1 && p.characters[0] === "layla"),
    },
  ].filter((group) => group.items.length > 0);
}

interface CollectionPageProps {
  catalog: ClientCatalog;
}

/**
 * The archive. Holds the filters (type, character or pair, search), turns the catalog into the
 * visible sections, and owns the dialogs: the cinema, the art viewer and the comic reader.
 */
export function CollectionPage({ catalog }: CollectionPageProps) {
  const reduced = useReducedMotion();
  const { scrollTo } = useLenis();
  const [section, setSection] = useState<SectionFilter>("all");
  const [who, setWho] = useState<WhoFilter>({ type: "all" });
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query).trim();
  const [voiceTable, setVoiceTable] = useState<VoiceTable | null>(null);
  const [voiceLimit, setVoiceLimit] = useState(VOICE_PAGE);
  const [cinemaIndex, setCinemaIndex] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ kind: "art" | "fanart"; index: number } | null>(null);
  const [comic, setComic] = useState<ComicItem | null>(null);
  const [armed, setArmed] = useState({ cinema: false, viewer: false, comic: false });
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasFilter = who.type !== "all" || deferredQuery !== "";
  const digest = section === "all" && !hasFilter;

  // Orders in the full lists keep each card's number and shape the same while filtering.
  const orders = useMemo(
    () => ({
      films: byId(catalog.films),
      music: byId(catalog.music),
      art: byId(catalog.art),
      fanart: byId(catalog.fanart),
    }),
    [catalog],
  );

  // The voice text is a separate chunk, loaded when the browser is idle.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void import("@/content/voice.generated").then((mod) => {
        if (!cancelled) setVoiceTable(mod.voiceLines);
      });
    };
    const cancel = whenIdle(load, 2500);
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  // Warm the dialogs so the first open is quick.
  useEffect(() => {
    const warm = () => {
      void import("./cinema-dialog");
      void import("./art-viewer");
      void import("./comic-reader");
    };
    return whenIdle(warm, 4000);
  }, []);

  // The player belongs to this page: set its queue, and stop the music when leaving.
  useEffect(() => {
    setQueue(catalog.music);
    return () => closePlayer();
  }, [catalog.music]);

  const voiceRows = useMemo(
    () => (voiceTable ? buildVoiceRows(voiceTable, catalog.voiceDurations) : null),
    [voiceTable, catalog.voiceDurations],
  );

  // Filtered lists ---------------------------------------------------------------------
  const films = useMemo(
    () => catalog.films.filter((f) => matchesWho(f, who) && matchesQuery(textOf(f), deferredQuery)),
    [catalog.films, who, deferredQuery],
  );
  const music = useMemo(
    () => catalog.music.filter((t) => matchesWho(t, who) && matchesQuery(textOf(t), deferredQuery)),
    [catalog.music, who, deferredQuery],
  );
  const comics = useMemo(
    () =>
      catalog.comics.filter((c) => matchesWho(c, who) && matchesQuery(textOf(c), deferredQuery)),
    [catalog.comics, who, deferredQuery],
  );
  const art = useMemo(
    () => catalog.art.filter((a) => matchesWho(a, who) && matchesQuery(textOf(a), deferredQuery)),
    [catalog.art, who, deferredQuery],
  );
  const fanGroups = useMemo(
    () =>
      groupFanArt(
        catalog.fanart.filter((p) => matchesWho(p, who) && matchesQuery(textOf(p), deferredQuery)),
      ),
    [catalog.fanart, who, deferredQuery],
  );
  const fan = useMemo(() => fanGroups.flatMap((g) => g.items), [fanGroups]);
  const voice = useMemo(() => {
    if (!voiceRows) return null;
    return voiceRows.filter((row) => voiceMatchesWho(row, who) && voiceMatches(row, deferredQuery));
  }, [voiceRows, who, deferredQuery]);

  const counts: Record<SectionId, number> = {
    films: films.length,
    music: music.length,
    comics: comics.length,
    art: art.length,
    fanart: fan.length,
    voice: voice ? voice.length : hasFilter ? 0 : catalog.stats.counts.voice,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shownTotal = section === "all" ? total : counts[section];

  const label = SECTIONS.find((s) => s.id === section)?.label.toLowerCase();
  const context = [
    section !== "all" && label ? `in ${label}` : "",
    who.type !== "all" ? `for ${whoLabel(who)}` : "",
    deferredQuery ? `matching "${deferredQuery}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const summary =
    section === "all" && !hasFilter
      ? `${total} items in the archive.`
      : `${shownTotal} ${shownTotal === 1 ? "result" : "results"}${context ? ` ${context}` : ""}.`;

  // Navigation --------------------------------------------------------------------------
  const focusResults = useCallback(
    (force: boolean) => {
      const el = resultsRef.current;
      if (!el) return;
      const bar = document.querySelector<HTMLElement>("[data-collection-bar]");
      const stickyTop = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
      const offset = stickyTop + (bar?.offsetHeight ?? 0);
      if (force || el.getBoundingClientRect().top < offset) {
        scrollTo(el, { offset: -offset + 8, ...(reduced ? { immediate: true } : {}) });
      }
    },
    [reduced, scrollTo],
  );

  const select = useCallback(
    (next: SectionFilter, force = false) => {
      setSection(next);
      setVoiceLimit(VOICE_PAGE);
      const meta = SECTIONS.find((s) => s.id === next);
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(window.history.state, "", meta ? `${base}#${meta.hash}` : base);
      window.setTimeout(() => focusResults(force), 30);
    },
    [focusResults],
  );

  // Open a filter from the URL hash, for example /collection/#fan-art.
  useEffect(() => {
    const meta = SECTIONS.find((s) => `#${s.hash}` === window.location.hash);
    if (!meta) return;
    const first = window.setTimeout(() => setSection(meta.id), 0);
    const second = window.setTimeout(() => focusResults(true), 300);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () => {
    setWho({ type: "all" });
    setQuery("");
    select("all");
  };

  // Openers -----------------------------------------------------------------------------
  const openFilm = (film: FilmItem, el: HTMLElement) => {
    setOpener(el);
    setArmed((a) => ({ ...a, cinema: true }));
    setCinemaIndex(
      Math.max(
        0,
        films.findIndex((f) => f.id === film.id),
      ),
    );
  };
  const openArt = (item: ArtItem | FanArtItem, el: HTMLElement) => {
    setOpener(el);
    setArmed((a) => ({ ...a, viewer: true }));
    if (item.kind === "fanart") {
      setViewer({
        kind: "fanart",
        index: Math.max(
          0,
          fan.findIndex((p) => p.id === item.id),
        ),
      });
    } else {
      setViewer({
        kind: "art",
        index: Math.max(
          0,
          art.findIndex((a) => a.id === item.id),
        ),
      });
    }
  };
  const openComic = (item: ComicItem, el: HTMLElement) => {
    setOpener(el);
    setArmed((a) => ({ ...a, comic: true }));
    setComic(item);
  };

  const showing = (id: SectionId) =>
    section === id || (section === "all" && (!hasFilter || counts[id] > 0));
  /** The section's full count when the overview hides some of it, else undefined. */
  const hiddenTotal = (id: SectionId, shown: number) =>
    digest && counts[id] > shown ? counts[id] : undefined;
  const meta = (id: SectionId) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]!;

  const wideFilms = films.filter((f) => !f.vertical);
  const verticalFilms = films.filter((f) => f.vertical);
  const wideShown = digest ? wideFilms.slice(0, DIGEST.wide) : wideFilms;
  const verticalShown = digest ? verticalFilms.slice(0, DIGEST.vertical) : verticalFilms;
  const filmsShown = wideShown.length + verticalShown.length;

  const artShown = digest ? art.slice(0, DIGEST.art) : art;
  const fanShown = digest ? fan.slice(0, DIGEST.fanart) : fan;
  const fanShownGroups = digest ? groupFanArt(fanShown) : fanGroups;

  const voiceShown = voice ? (digest ? roundRobin(voice).slice(0, DIGEST.voice) : voice) : [];
  const viewerItems = viewer?.kind === "fanart" ? fan : art;

  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <ThemeZone theme="daybreak" surface={false} as="div" className="relative">
          <ArchiveHeader stats={catalog.stats} onJump={(id) => select(id, true)} />

          <FilterBar
            section={section}
            onSection={(next) => select(next)}
            counts={counts}
            query={query}
            onQuery={(value) => {
              setQuery(value);
              setVoiceLimit(VOICE_PAGE);
            }}
            who={who}
            onWho={(next) => {
              setWho(next);
              setVoiceLimit(VOICE_PAGE);
            }}
            summary={summary}
            onClear={clearAll}
          />

          <div ref={resultsRef} id="collection-results">
            {showing("films") && (
              <SectionShell
                meta={meta("films")}
                theme="daybreak"
                count={counts.films}
                seeAllTotal={hiddenTotal("films", filmsShown)}
                onSeeAll={() => select("films", true)}
              >
                {films.length === 0 ? (
                  <EmptySection onClear={clearAll} />
                ) : (
                  <FilmsContent
                    wide={wideShown}
                    vertical={verticalShown}
                    order={orders.films}
                    onOpen={openFilm}
                  />
                )}
              </SectionShell>
            )}

            {showing("music") && (
              <SectionShell meta={meta("music")} theme="daybreak" count={counts.music}>
                {music.length === 0 ? (
                  <EmptySection onClear={clearAll} />
                ) : (
                  <MusicContent tracks={music} order={orders.music} />
                )}
              </SectionShell>
            )}

            {showing("comics") && (
              <SectionShell meta={meta("comics")} theme="daybreak" count={counts.comics}>
                {comics.length === 0 ? (
                  <EmptySection onClear={clearAll} />
                ) : (
                  <ComicsContent comics={comics} onOpen={openComic} />
                )}
              </SectionShell>
            )}

            {showing("art") && (
              <SectionShell
                meta={meta("art")}
                theme="daybreak"
                count={counts.art}
                seeAllTotal={hiddenTotal("art", artShown.length)}
                onSeeAll={() => select("art", true)}
              >
                {art.length === 0 ? (
                  <EmptySection onClear={clearAll} />
                ) : (
                  <GalleryContent
                    items={artShown}
                    order={orders.art}
                    label="Official art"
                    onOpen={openArt}
                  />
                )}
              </SectionShell>
            )}

            {showing("fanart") && (
              <SectionShell
                meta={meta("fanart")}
                theme="daybreak"
                count={counts.fanart}
                seeAllTotal={hiddenTotal("fanart", fanShown.length)}
                onSeeAll={() => select("fanart", true)}
              >
                {fan.length === 0 ? (
                  <EmptySection onClear={clearAll} />
                ) : (
                  fanShownGroups.map((group, i) => (
                    <div key={group.id}>
                      {!digest && fanShownGroups.length > 1 && (
                        <h3 className={styles.sub} style={i === 0 ? { marginTop: 0 } : undefined}>
                          {group.label} <span>{group.items.length}</span>
                        </h3>
                      )}
                      <GalleryContent
                        items={group.items}
                        order={orders.fanart}
                        label={`Fan art, ${group.label}`}
                        onOpen={openArt}
                        caption={(piece) => <FanCredit piece={piece} />}
                      />
                    </div>
                  ))
                )}
              </SectionShell>
            )}

            {showing("voice") && (
              <SectionShell
                meta={meta("voice")}
                theme="daybreak"
                count={counts.voice}
                seeAllTotal={hiddenTotal("voice", voiceShown.length)}
                onSeeAll={() => select("voice", true)}
              >
                {voice === null ? (
                  <p className={styles.blurb}>Loading the voice lines.</p>
                ) : (
                  <VoiceArchive
                    rows={voiceShown}
                    limit={digest ? DIGEST.voice : voiceLimit}
                    matches={digest ? voiceShown.length : voice.length}
                    paged={!digest}
                    onMore={() => setVoiceLimit((n) => n + VOICE_PAGE)}
                  />
                )}
              </SectionShell>
            )}
          </div>

          <section className={`${styles.note} shell`} aria-labelledby="not-hosted-title">
            <HudPanel label="Not hosted" code="3 recordings" tone="glass" bodyClassName="p-sp-m">
              <div className={styles.noteBody}>
                <h2 id="not-hosted-title" className="m-0 display text-step-3">
                  Not on this site
                </h2>
                <p>
                  Three recordings are left out. One is a live-action parody, which is{" "}
                  <strong>non-canon</strong>. Two are long livestream recordings that are too large
                  to host. The story does not depend on any of them.
                </p>
              </div>
            </HudPanel>
          </section>
          <div className={styles.pad} aria-hidden="true" />
        </ThemeZone>

        <MiniPlayer />

        {armed.cinema && (
          <CinemaDialog
            films={films}
            index={cinemaIndex}
            onIndexChange={setCinemaIndex}
            opener={opener}
          />
        )}
        {armed.viewer && (
          <ArtViewer
            items={viewerItems}
            index={viewer ? viewer.index : null}
            onIndexChange={(i) =>
              setViewer((v) => (i === null || !v ? null : { kind: v.kind, index: i }))
            }
            label={viewer?.kind === "fanart" ? "Fan art" : "Official art"}
            opener={opener}
          />
        )}
        {armed.comic && (
          <ComicReader comic={comic} opener={opener} onClose={() => setComic(null)} />
        )}
      </MotionConfig>
    </LazyMotion>
  );
}
