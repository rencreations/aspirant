"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";
import { expectReady } from "@/lib/page-ready";

import { fetchLibraryJson } from "../../data";
import { Lightbox, useLightboxParam, type GalleryItem } from "../../shared/gallery";
import { characterOptions, Chips, ControlBar, type ChipOption } from "../../shell/controls";
import { useQueryState } from "../../use-query-state";
import { FilmRail } from "./film-rail";
import { FilmSection } from "./film-section";
import {
  countScenes,
  estimateHeight,
  filterFilms,
  hasSceneFilters,
  sceneFacets,
  sceneSummary,
  watchHref,
} from "./logic";
import styles from "./scenes.module.css";
import {
  SCENES_FILE,
  type SceneFilm,
  type SceneFilters,
  type SceneView,
  type Scene,
  type ScenesFile,
} from "./types";
import { useFilmTracker } from "./use-film-tracker";

const SLICE = 3;

function toItem(film: SceneFilm, scene: Scene): GalleryItem {
  return {
    id: scene.id,
    title: `${film.title}, ${scene.time}`,
    alt: scene.note
      ? `${film.title} at ${scene.time}: ${scene.note}`
      : `A scene of ${film.title} at ${scene.time}`,
    img: scene.img,
    chars: film.chars,
    pair: film.pair,
    canon: "official",
    ...(scene.note ? { note: scene.note } : {}),
    facts: [
      ["Film", film.title],
      ["Kind", film.kind],
      ["Time", scene.time],
    ],
    link: { href: watchHref(film.id, scene.t), label: "Watch this scene" },
  };
}

/** The scene stills: a rail of films, each film a strip of stills with a scrubber. */
export default function ScenesTab() {
  const [file, setFile] = useState<ScenesFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useQueryState("sq");
  const [who, setWho] = useQueryState("sw");
  const [pair, setPair] = useQueryState("sp");
  const [filmId, setFilmId] = useQueryState("sf");
  const [viewRaw, setViewRaw] = useQueryState("sv");
  const view: SceneView = viewRaw === "sheet" ? "sheet" : "strips";
  const lenis = useLenis();

  const rootRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(1000);
  const [limit, setLimit] = useState(2);

  // The file arrives after the first paint of the page. The curtain waits for the first strips.
  useEffect(() => {
    let live = true;
    const mark = expectReady("library-arts-scenes");
    fetchLibraryJson<ScenesFile>(SCENES_FILE).then(
      (f) => {
        if (!live) return;
        setFile(f);
        requestAnimationFrame(() => {
          requestAnimationFrame(mark);
        });
      },
      () => {
        if (live) setFailed(true);
        mark();
      },
    );
    return () => {
      live = false;
      mark();
    };
  }, []);

  const films = useMemo<readonly SceneFilm[]>(() => file?.films ?? [], [file]);
  const dq = useDeferredValue(q);
  const filters = useMemo<SceneFilters>(
    () => ({ q: dq, who, pair, film: filmId }),
    [dq, who, pair, filmId],
  );
  const filtered = hasSceneFilters(filters);
  const activeFilters = [who, pair, filmId, q.trim()].filter(Boolean).length;
  const shown = useMemo(() => filterFilms(films, filters), [films, filters]);
  const facets = useMemo(() => sceneFacets(films, filters), [films, filters]);
  const total = file?.totals.scenes ?? 0;

  // Built in slices: two films at once, then a few more each time the browser is idle.
  useEffect(() => {
    if (limit >= shown.length) return;
    const run = () => {
      setLimit((n) => Math.min(shown.length, n + SLICE));
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run);
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 32);
    return () => {
      window.clearTimeout(id);
    };
  }, [limit, shown.length]);
  const visible = useMemo(() => shown.slice(0, limit), [shown, limit]);

  // The viewer: every shown still, and the whole set for a link to a still that a filter hides.
  const items = useMemo(
    () => shown.flatMap((s) => s.scenes.map((sc) => toItem(s.film, sc))),
    [shown],
  );
  const everything = useMemo(
    () => films.flatMap((f) => f.scenes.map((sc) => toItem(f, sc))),
    [films],
  );
  const lb = useLightboxParam(items, "i", everything);
  const openRef = useRef(lb.open);
  useEffect(() => {
    openRef.current = lb.open;
  }, [lb.open]);
  const onOpen = useCallback((id: string) => {
    audio.blip("click");
    openRef.current(id);
  }, []);

  // The bar's height and the sizes of the sections that are not drawn yet.
  const applySizes = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    const byId = new Map(shown.map((s) => [s.film.id, s]));
    for (const el of main.querySelectorAll<HTMLElement>("[data-film]")) {
      const s = byId.get(el.dataset.film ?? "");
      if (s) el.style.containIntrinsicSize = `auto ${estimateHeight(s, widthRef.current, view)}px`;
    }
  }, [shown, view]);

  useLayoutEffect(() => {
    applySizes();
  }, [applySizes, visible]);

  useEffect(() => {
    const root = rootRef.current;
    const main = mainRef.current;
    if (!root || !main) return;
    const bar = root.querySelector<HTMLElement>("[data-bar]")?.firstElementChild as
      HTMLElement | null | undefined;
    const ro = new ResizeObserver(() => {
      widthRef.current = main.clientWidth || widthRef.current;
      if (bar) root.style.setProperty("--bar-h", `${bar.offsetHeight}px`);
      applySizes();
    });
    ro.observe(main);
    if (bar) ro.observe(bar);
    return () => {
      ro.disconnect();
    };
  }, [applySizes, file]);

  const { activeId } = useFilmTracker(rootRef, shown, view, file !== null);

  // Scrolling to a film or a still. The sticky bars cover the top of the page, so the target goes below them.
  const stickBottom = useCallback((): number => {
    const root = rootRef.current;
    const bar = root?.querySelector<HTMLElement>("[data-bar]")?.firstElementChild;
    const rail = root?.querySelector<HTMLElement>("[data-rail]");
    const narrow = window.matchMedia("(max-width: 70em)").matches;
    return Math.max(
      bar?.getBoundingClientRect().bottom ?? 0,
      narrow ? (rail?.getBoundingClientRect().bottom ?? 0) : 0,
    );
  }, []);

  const goTo = useCallback(
    (el: HTMLElement, below: number, immediate: boolean) => {
      const offset = -(stickBottom() + below);
      if (lenis.getLenis()) {
        lenis.scrollTo(el, { offset, immediate, duration: immediate ? 0 : 0.9 });
      } else {
        const top = el.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
      }
    },
    [lenis, stickBottom],
  );

  const onPick = useCallback(
    (id: string) => {
      const idx = shown.findIndex((s) => s.film.id === id);
      const reveal = () => {
        const el = mainRef.current?.querySelector<HTMLElement>(`[data-film="${CSS.escape(id)}"]`);
        if (!el) return;
        goTo(el, 6, false);
        // Sections that were not drawn yet change size as they come near: settle on the film.
        window.setTimeout(() => {
          if (Math.abs(el.getBoundingClientRect().top - stickBottom() - 6) > 8) goTo(el, 6, false);
        }, 1300);
      };
      if (idx >= limit) {
        // Draw the films in front of it first, so the page does not move under the scroll.
        setLimit(shown.length);
        requestAnimationFrame(() => {
          requestAnimationFrame(reveal);
        });
      } else {
        reveal();
      }
    },
    [shown, limit, goTo, stickBottom],
  );

  const onSeek = useCallback(
    (id: string, index: number, immediate: boolean) => {
      const cell = mainRef.current?.querySelector<HTMLElement>(
        `[data-film="${CSS.escape(id)}"] [data-cell="${index}"]`,
      );
      if (!cell) return;
      const below =
        (rootRef.current?.querySelector<HTMLElement>("[data-scrub]")?.offsetHeight ?? 64) + 14;
      goTo(cell, below, immediate);
      if (!immediate) {
        // Sections that were not drawn yet change size as they come near: settle on the still.
        window.setTimeout(() => {
          if (Math.abs(cell.getBoundingClientRect().top - stickBottom() - below) > 10) {
            goTo(cell, below, false);
          }
        }, 1300);
      }
    },
    [goTo, stickBottom],
  );

  const clearAll = () => {
    setQ("");
    setWho("");
    setPair("");
    setFilmId("");
  };

  const pairOptions: ChipOption[] = pairs.map((p) => ({
    value: p.id,
    label: p.names,
    count: facets.pair[p.id] ?? 0,
  }));

  if (failed) {
    return (
      <div className="shell">
        <p className={`${styles.status} hud-label`} role="status">
          The scene stills could not be read. Reload the page to try again.
        </p>
      </div>
    );
  }
  if (!file) {
    return (
      <div className="shell">
        <p className={`${styles.status} hud-label`} role="status">
          Reading the stills
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={`${styles.filters} shell`} ref={filtersRef} data-filters="">
        <Chips
          label="Character"
          options={characterOptions(facets.who)}
          value={who}
          onChange={setWho}
        />
        <Chips label="Pair" options={pairOptions} value={pair} onChange={setPair} />
        <div className={styles.filmPick}>
          <label className={`${styles.filmPickLabel} hud-label`} htmlFor="scenes-film">
            Film
          </label>
          <select
            id="scenes-film"
            className={styles.select}
            data-set={filmId ? "true" : "false"}
            value={filmId}
            onChange={(e) => {
              audio.blip("click");
              setFilmId(e.target.value);
            }}
          >
            <option value="">All films</option>
            {films.map((f) => (
              <option key={f.id} value={f.id} disabled={(facets.film[f.id] ?? 0) === 0}>
                {f.title} ({facets.film[f.id] ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A wrapper without a box: the bar sticks inside the whole tab. */}
      <div data-bar="" className={styles.barWrap}>
        <ControlBar
          query={q}
          onQuery={setQ}
          placeholder="Search the notes, the films and the times"
          summary={sceneSummary(shown, total, filtered)}
          trailing={
            <>
              <button
                type="button"
                className={`${styles.filterBtn} hud-label`}
                onClick={() => {
                  audio.blip("click");
                  const el = filtersRef.current;
                  if (el) goTo(el, 12, false);
                }}
              >
                Filters
                {activeFilters > 0 ? (
                  <span className={styles.filterCount}>{activeFilters}</span>
                ) : null}
              </button>
              <div className={styles.view} role="group" aria-label="Layout">
                {(["strips", "sheet"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.viewBtn} hud-label`}
                    aria-pressed={view === v}
                    onClick={() => {
                      audio.blip("click");
                      setViewRaw(v === "sheet" ? "sheet" : "");
                    }}
                  >
                    {v === "strips" ? "Strips" : "Sheet"}
                  </button>
                ))}
              </div>
            </>
          }
        />
      </div>

      <div className="shell">
        <div className={styles.layout}>
          <FilmRail shown={shown} activeId={activeId} onPick={onPick} />
          <div ref={mainRef} className={styles.main}>
            <p className={styles.intro}>
              <span className={styles.lead}>
                A still from every scene of every animated film. Hover one for what happens, press
                it to see it large and to watch that moment.
              </span>
            </p>
            {visible.map((s) => (
              <FilmSection
                key={s.film.id}
                film={s.film}
                scenes={s.scenes}
                groups={s.groups}
                view={view}
                onOpen={onOpen}
                onSeek={onSeek}
              />
            ))}
            {shown.length === 0 ? (
              <div className={styles.empty}>
                <h2 className={`${styles.emptyTitle} display`}>No scene matches</h2>
                <p>Try fewer words, or clear the filters.</p>
                <button type="button" className={styles.clear} onClick={clearAll}>
                  Clear the filters
                </button>
              </div>
            ) : null}
            <p className="hud-label" aria-hidden="true">
              {countScenes(shown).toLocaleString("en-US")} stills
            </p>
          </div>
        </div>
      </div>

      <Lightbox items={lb.list} index={lb.index} onIndexChange={lb.setIndex} label="Scene stills" />
    </div>
  );
}
