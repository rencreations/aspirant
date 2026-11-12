"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { useLenis } from "@/components/smooth-scroll";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";

import { useLibraryData } from "../../data";
import { getCollection } from "../../registry";
import { TAKEDOWN_URL } from "../../shell/library-shell";
import { BackToCollection } from "../../shell/room-chrome";
import { useQueryState } from "../../use-query-state";
import { Finder } from "./finder";
import styles from "./others.module.css";
import type { OtherVideo } from "./types";
import { useOpenVideo } from "./use-open-video";
import { useRoomMemory } from "./use-memory";
import { Viewer } from "./viewer";
import {
  estimateShelf,
  facets,
  filterVideos,
  findVideo,
  groupVideos,
  hasFilters,
  isGroupMode,
  neighbour,
  parseSeconds,
  runtimeWords,
  shelfOf,
  thumbUrl,
  totalRuntime,
  type Group,
  type VideoFilters,
  type WallSize,
} from "./video-data";
import wallStyles from "./wall.module.css";
import { Shelf } from "./wall";

const NONE: readonly OtherVideo[] = [];

/** Where a takedown request goes (the same page as every other room of the library). */

/** How many shelves are built at once. The rest follow while nothing else is happening. */
const FIRST_SHELVES = 3;
const SLICE_SHELVES = 2;

/** The video under the finder when the visitor stops, remembered after this many ms without a scroll. */
const REMEMBER_AFTER_MS = 500;

/** Run `work` when the browser is idle (or soon, where it has no idle callback). */
function whenIdle(work: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work, { timeout: 400 });
    return () => {
      window.cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(work, 32);
  return () => {
    window.clearTimeout(id);
  };
}

/** The picture of a tile on the wall, or null when it is not on the screen. */
function figureRect(id: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-tile="${CSS.escape(id)}"] [data-figure]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return r;
}

/**
 * The tile an arrow key moves to from the tile that has focus: Left and Right go to the one before and
 * after, Up and Down to the nearest one in the row above or below (the closest in the middle of its
 * picture). It is how a keyboard moves over the wall without tabbing through every video.
 */
function arrowTarget(from: HTMLElement, key: string, all: HTMLElement[]): HTMLElement | undefined {
  const i = all.indexOf(from);
  if (i < 0) return undefined;
  if (key === "ArrowRight") return all[i + 1];
  if (key === "ArrowLeft") return all[i - 1];
  const here = from.querySelector("[data-figure]")?.getBoundingClientRect();
  if (!here) return undefined;
  const down = key === "ArrowDown";
  const middle = here.left + here.width / 2;
  let best: HTMLElement | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const el of all) {
    const r = el.querySelector("[data-figure]")?.getBoundingClientRect();
    if (!r) continue;
    const gap = down ? r.top - here.bottom : here.top - r.bottom;
    // Only the next row (or the next shelf's first row): a tile that starts below this one's bottom.
    if (gap < -4) continue;
    const score = gap * 4 + Math.abs(r.left + r.width / 2 - middle);
    if (score < bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

/** Everything of one group after `current`, then the ones before it, up to `limit`. */
function after(items: readonly OtherVideo[], current: OtherVideo, limit = 12): OtherVideo[] {
  const i = items.indexOf(current);
  if (i < 0) return items.slice(0, limit);
  return [...items.slice(i + 1), ...items.slice(0, i)].slice(0, limit);
}

/** Where the page is asked to go: to a shelf, or to a tile. */
interface Jump {
  kind: "shelf" | "video";
  id: string;
  smooth: boolean;
}

/**
 * The Others room: every video that is not one of the ten films, on one wall that is made to be
 * scrolled. Shelves by kind (or by pair, or by length), a sticky finder with search, filters and an
 * index of the shelves, a preview on hover, and a viewer that opens from the tile without leaving
 * the scroll. A video opens from `?i=<id>`, and `&t=<seconds>` starts it there (the scene stills of
 * the Arts room and the library search point at it).
 */
export default function OthersPage() {
  const meta = getCollection("video");
  const { data, failed } = useLibraryData<OtherVideo>("video-others");
  const videos = data?.items ?? NONE;
  const { getLenis } = useLenis();

  const [q, setQ] = useQueryState("q");
  const [who, setWho] = useQueryState("who");
  const [pair, setPair] = useQueryState("pair");
  const [kind, setKind] = useQueryState("kind");
  const [canon, setCanon] = useQueryState("canon");
  const [length, setLength] = useQueryState("length");
  const [groupParam, setGroupParam] = useQueryState("group");
  const mode = isGroupMode(groupParam) ? groupParam : "kind";

  const {
    id: openId,
    t: openT,
    open: openVideo,
    show: showVideo,
    setT,
    from,
    close,
  } = useOpenVideo();
  const { saved, seen, markSeen, rememberAt, forgetAt } = useRoomMemory();

  const filters: VideoFilters = useMemo(
    () => ({ who, pair, kind, canon, length, q }),
    [who, pair, kind, canon, length, q],
  );
  const active = hasFilters(filters);
  const shown = useMemo(() => filterVideos(videos, filters), [videos, filters]);
  const counts = useMemo(() => facets(videos, filters), [videos, filters]);
  const groups = useMemo(() => groupVideos(shown, mode), [shown, mode]);
  const order = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const setFilter = useCallback(
    (key: keyof VideoFilters, value: string) => {
      const setters = {
        who: setWho,
        pair: setPair,
        kind: setKind,
        canon: setCanon,
        length: setLength,
        q: setQ,
      } as const;
      setters[key](value);
    },
    [setWho, setPair, setKind, setCanon, setLength, setQ],
  );
  const clear = useCallback(() => {
    setWho("");
    setPair("");
    setKind("");
    setCanon("");
    setLength("");
    setQ("");
  }, [setWho, setPair, setKind, setCanon, setLength, setQ]);

  // The wall is built in slices: the first shelves at once, the others when the browser is idle.
  const [built, setBuilt] = useState(FIRST_SHELVES);
  useEffect(() => {
    if (!data || built >= groups.length) return;
    return whenIdle(() => {
      setBuilt((b) => Math.min(b + SLICE_SHELVES, groups.length));
    });
  }, [data, built, groups.length]);

  const finderRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState("");

  // The width of the wall, the height of a row and the gap, for the estimated height of a shelf.
  const [size, setSize] = useState<WallSize>({ width: 0, rowHeight: 0, gap: 0 });
  useEffect(() => {
    const wall = wallRef.current;
    const probe = probeRef.current;
    if (!wall || !probe) return;
    const measure = () => {
      const cs = getComputedStyle(wall);
      const width = wall.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const next = { width, rowHeight: probe.offsetHeight, gap: probe.offsetWidth };
      setSize((prev) =>
        prev.width === next.width && prev.rowHeight === next.rowHeight && prev.gap === next.gap
          ? prev
          : next,
      );
    };
    // The observer reports the size once as soon as it starts, so there is no first call here.
    const watcher = new ResizeObserver(measure);
    watcher.observe(wall);
    return () => {
      watcher.disconnect();
    };
  }, []);
  const estimates = useMemo(() => groups.map((g) => estimateShelf(g.items, size)), [groups, size]);

  /** The y of the line under the top bar and the finder, below which the wall is in view. */
  const line = useCallback(() => finderRef.current?.getBoundingClientRect().bottom ?? 0, []);

  // The shelf under the finder (for the index), and the video there (for the memory of the place).
  useEffect(() => {
    if (groups.length === 0) return;
    let raf = 0;
    let rememberTimer = 0;
    const read = () => {
      raf = 0;
      const edge = line() + 24;
      let found: Group = groups[0]!;
      for (const g of groups) {
        const el = document.getElementById(`shelf-${g.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= edge) found = g;
        else break;
      }
      setCurrent((prev) => (prev === found.id ? prev : found.id));
      window.clearTimeout(rememberTimer);
      rememberTimer = window.setTimeout(() => {
        if (window.scrollY < 500) {
          rememberAt("");
          return;
        }
        for (const v of found.items) {
          const r = figureRect(v.id);
          if (r && r.bottom > line()) {
            rememberAt(v.id);
            return;
          }
        }
      }, REMEMBER_AFTER_MS);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(rememberTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [groups, line, rememberAt]);

  // Jumps: to a shelf (from the index) or to a tile (the place that was remembered, or the video the
  // viewer stepped to). The shelves are all built first. A shelf that is not on the screen has only an
  // estimated height (`content-visibility`), and shelves change height as they come into view, so once
  // the glide ends the target is measured again and the page is corrected until it stops moving. Any
  // input of the visitor ends the correction: it never fights them.
  const cancelJump = useRef<() => void>(() => undefined);
  useEffect(
    () => () => {
      cancelJump.current();
    },
    [],
  );
  const jump = useCallback(
    (job: Jump) => {
      cancelJump.current();
      setBuilt(groups.length);
      const wanted = order.length;
      const lenis = getLenis();
      const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
      let raf = 0;
      let late = 0;
      let stopped = false;
      let correcting = false;
      let frames = 0;
      const find = () =>
        job.kind === "shelf"
          ? document.getElementById(`shelf-${job.id}`)
          : document.querySelector<HTMLElement>(
              `[data-tile="${CSS.escape(job.id)}"] [data-figure]`,
            );
      const target = () => {
        const el = find();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const top = line();
        if (job.kind === "shelf") return r.top + window.scrollY - (top + 12);
        const room = window.innerHeight - top;
        return r.top + window.scrollY - (top + Math.max(16, (room - r.height) / 2));
      };
      const finish = () => {
        stopped = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(late);
        for (const type of inputs) window.removeEventListener(type, finish);
      };
      const correct = () => {
        if (stopped) return;
        const y = target();
        if (y === null) return finish();
        if (Math.abs(y - window.scrollY) > 4) {
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
        }
        // About three quarters of a second of corrections, for the shelves that settle as they arrive.
        if (++frames < 45) raf = requestAnimationFrame(correct);
        else finish();
      };
      const startCorrecting = () => {
        if (correcting || stopped) return;
        correcting = true;
        frames = 0;
        raf = requestAnimationFrame(correct);
      };
      const start = () => {
        const y = target();
        if (y === null) return finish();
        if (lenis) {
          lenis.scrollTo(y, {
            immediate: !job.smooth,
            force: true,
            duration: 0.9,
            onComplete: startCorrecting,
          });
        } else {
          window.scrollTo({ top: y, behavior: job.smooth ? "smooth" : "auto" });
        }
        if (!job.smooth) startCorrecting();
        // A safety: a glide that never reports its end is corrected anyway.
        late = window.setTimeout(startCorrecting, job.smooth ? 1500 : 150);
      };
      // Wait until every tile is in the page, then go.
      let waited = 0;
      const wait = () => {
        if (stopped) return;
        if (document.querySelectorAll("[data-tile]").length < wanted && waited++ < 90) {
          raf = requestAnimationFrame(wait);
          return;
        }
        start();
      };
      for (const type of inputs) window.addEventListener(type, finish, { passive: true });
      cancelJump.current = finish;
      raf = requestAnimationFrame(wait);
    },
    [groups.length, order.length, getLenis, line],
  );

  const jumpToShelf = useCallback(
    (id: string) => {
      jump({ kind: "shelf", id, smooth: true });
    },
    [jump],
  );

  // The viewer.
  const open = findVideo(videos, openId);
  const origin = useRef<DOMRect | null>(null);
  const list = open && order.includes(open) ? order : videos;
  const openGroup: { title: string; items: readonly OtherVideo[] } | null = open
    ? (groups.find((g) => g.items.includes(open)) ?? {
        title: shelfOf(open.kind).title,
        items: videos.filter((v) => shelfOf(v.kind) === shelfOf(open.kind)),
      })
    : null;

  const onOpen = useCallback(
    (video: OtherVideo) => {
      origin.current = figureRect(video.id);
      openVideo(video.id);
    },
    [openVideo],
  );

  const show = useCallback(
    (video: OtherVideo) => {
      origin.current = null;
      showVideo(video.id);
      // The wall moves behind the viewer, so the way back lands on the right tile.
      jump({ kind: "video", id: video.id, smooth: false });
    },
    [showVideo, jump],
  );

  const before = open ? neighbour(list, open, -1) : undefined;
  const afterThis = open ? neighbour(list, open, 1) : undefined;
  const step = (direction: 1 | -1) => {
    const next = direction === 1 ? afterThis : before;
    if (next) show(next);
  };

  const getOrigin = useCallback((id: string) => figureRect(id), []);
  /** The viewer asks as it opens: the tile it grows out of, or null (it then fades in). */
  const takeOrigin = useCallback(() => origin.current, []);
  // Forgotten when the viewer closes, so a video opened later by a link never grows out of an old tile.
  useEffect(() => {
    if (!open) origin.current = null;
  }, [open]);

  const onSeek = useCallback(
    (seconds: number) => {
      setT(seconds > 0 ? String(Math.round(seconds * 10) / 10) : "");
    },
    [setT],
  );

  useEffect(() => {
    if (open) markSeen(open.id);
  }, [open, markSeen]);

  // "Continue where you stopped": offered at the top of the wall, never forced, and never when the
  // address names a video (a link wins over the memory).
  const [dismissed, setDismissed] = useState(false);
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const read = () => {
      setAtTop(window.scrollY < 320);
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => {
      window.removeEventListener("scroll", read);
    };
  }, []);
  const resume = findVideo(videos, saved.at);
  const offerResume = Boolean(resume) && !openId && !dismissed && atTop && !active;

  const continueHere = useCallback(() => {
    if (!resume) return;
    setDismissed(true);
    jump({ kind: "video", id: resume.id, smooth: true });
  }, [resume, jump]);

  const summary = !data
    ? "Reading the videos"
    : active
      ? `${shown.length} of ${videos.length} videos`
      : `${videos.length} videos, ${runtimeWords(totalRuntime(videos))}`;

  const mosaic = useMemo(
    () =>
      groupVideos(videos, "kind")
        .slice(0, 8)
        .map((g) => g.items[0]!),
    [videos],
  );

  const vars = {
    "--lib-colour": meta.colour,
    "--lib-ink": meta.ink,
  } as CSSProperties;

  return (
    <ThemeZone theme="daybreak" as="div" className={styles.page} style={vars}>
      <header className={`${styles.header} below-nav`}>
        <div className={`${styles.gridArt} grid-hex fade-edges`} aria-hidden="true" />
        <div className="relative shell">
          <BackToCollection
            tone="dark"
            href={from?.href}
            label={from?.label}
            style={{ position: "static", display: "inline-flex", marginBottom: "1.1rem" }}
          />
          <div className={styles.headGrid}>
            <div className={styles.headText}>
              <p className={`${styles.eyebrow} hud-label`}>
                <StarGlyph className="size-3 text-accent" />
                <span>{meta.index} Video</span>
              </p>
              <h1 className={`${styles.title} display`}>Others</h1>
              <p className={styles.lead}>
                Every video that is not one of the ten films: shorts, showcases, interviews, the
                drama, streams, reels, clips and fan work. Scroll the whole wall, or find one.
              </p>
              <p className={`${styles.stats} hud-label`}>
                <span className={styles.count}>{data ? videos.length : "..."}</span>
                <span>videos</span>
                <span aria-hidden="true" className={styles.dot} />
                <span>{data ? runtimeWords(totalRuntime(videos)) : "..."}</span>
                <span aria-hidden="true" className={styles.dot} />
                <span>{data ? groupVideos(videos, "kind").length : "..."} shelves</span>
              </p>
            </div>
            <div className={styles.mosaic} aria-hidden="true">
              {mosaic.map((v) => (
                <span
                  key={v.id}
                  className={styles.mosaicCell}
                  style={{ "--field": v.c } as CSSProperties}
                >
                  {/* A thumbnail of the library. Plain <img>: static export, art already sized. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(v)} alt="" decoding="async" draggable={false} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <Finder
        rootRef={finderRef}
        filters={filters}
        onFilter={setFilter}
        onClear={clear}
        facets={counts}
        mode={mode}
        onMode={(m) => {
          setGroupParam(m === "kind" ? "" : m);
        }}
        groups={groups}
        active={current}
        onJump={jumpToShelf}
        summary={summary}
      />

      <main
        ref={wallRef}
        className={`${styles.wall} shell`}
        aria-label="The videos"
        onKeyDown={(e) => {
          if (!e.key.startsWith("Arrow") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
            return;
          const from = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]");
          const wall = wallRef.current;
          if (!from || !wall) return;
          const all = Array.from(wall.querySelectorAll<HTMLElement>("[data-tile]"));
          const next = arrowTarget(from, e.key, all);
          e.preventDefault();
          next?.querySelector("button")?.focus();
        }}
      >
        <span ref={probeRef} className={wallStyles.probe} aria-hidden="true" />
        {failed ? (
          <p className={styles.empty}>
            The videos could not be read. Check your connection and reload the page.
          </p>
        ) : null}
        {data && groups.length === 0 ? (
          <div className={styles.empty}>
            <p>No video matches. Try fewer words, or clear the filters.</p>
            <button type="button" className={styles.clear} onClick={clear}>
              Clear the filters
            </button>
          </div>
        ) : null}
        {groups.map((g, i) => (
          <Shelf
            key={g.id}
            group={g}
            number={i + 1}
            built={i < built}
            estimate={estimates[i] ?? 0}
            openId={open?.id ?? ""}
            seen={seen}
            onOpen={onOpen}
          />
        ))}
      </main>

      <footer className={`${styles.foot} shell`}>
        <p className={styles.footLine}>
          {data ? `${shown.length} ${shown.length === 1 ? "video" : "videos"}` : ""}
          {data && active ? " match. " : data ? " on the wall. " : ""}
          The ten films are on their own page of the collection.
        </p>
        <p className={styles.note}>
          A fan made archive. Aspirant and Mobile Legends: Bang Bang belong to Moonton, and this
          site is not affiliated with them. Fan work belongs to the people who made it and is shown
          with credit. To ask for something to be taken down, use the{" "}
          <TLink href={TAKEDOWN_URL} className="link">
            takedown page
          </TLink>
          .
        </p>
      </footer>

      {offerResume && resume ? (
        <div className={styles.resume} role="region" aria-label="Continue where you stopped">
          <p>
            <span className="hud-label">Where you stopped</span>
            <span className={styles.resumeTitle}>{resume.title}</span>
          </p>
          <button type="button" className={styles.resumeGo} onClick={continueHere}>
            Continue
          </button>
          <button
            type="button"
            className={styles.resumeX}
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              forgetAt();
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      ) : null}

      {open && openGroup ? (
        <Viewer
          key="viewer"
          video={open}
          position={Math.max(1, list.indexOf(open) + 1)}
          total={list.length}
          groupTitle={openGroup.title}
          more={after(openGroup.items, open)}
          start={parseSeconds(openT, open.video.dur)}
          takeOrigin={takeOrigin}
          getOrigin={getOrigin}
          onSeek={onSeek}
          onShow={show}
          onStep={step}
          onClose={close}
        />
      ) : null}
    </ThemeZone>
  );
}
