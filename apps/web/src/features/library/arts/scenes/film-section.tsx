"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { TLink } from "@/components/transition/t-link";
import { pairs } from "@/content/pairs";
import { libUrl } from "@/lib/library";

import { videoHref } from "../../video/links";
import { formatDuration, fractionOf, nearestIndex, sceneFocus } from "./logic";
import styles from "./scenes.module.css";
import type { Scene, SceneBeat, SceneFilm, SceneGroup, SceneView } from "./types";

/** The size of a thumbnail (480 on the long side), so the picture holds its place before it loads. */
function thumbSize(img: { w: number; h: number }): { width: number; height: number } {
  const k = 480 / Math.max(img.w, img.h, 1);
  return { width: Math.round(img.w * k), height: Math.round(img.h * k) };
}

const Cell = memo(function Cell({ scene, index, k }: { scene: Scene; index: number; k: number }) {
  const { width, height } = thumbSize(scene.img);
  const label = scene.note ? `${scene.time}. ${scene.note}` : scene.time;
  return (
    <button
      type="button"
      className={styles.cell}
      data-cell={index}
      data-id={scene.id}
      style={{ "--k": k } as CSSProperties}
      aria-label={label}
    >
      <span className={styles.frame} style={{ backgroundColor: scene.img.c }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={libUrl(scene.img.t)}
          width={width}
          height={height}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {scene.note ? <span className={styles.note}>{scene.note}</span> : null}
      </span>
      <span className={`${styles.time} hud-label`} aria-hidden="true">
        {scene.time}
      </span>
    </button>
  );
});

function Group({ group, base, view }: { group: SceneGroup; base: number; view: SceneView }) {
  return (
    <div className={styles.group}>
      {view === "strips" && group.beat?.note ? <GroupHead beat={group.beat} /> : null}
      <div className={styles.cells}>
        {group.scenes.map((s, i) => (
          <Cell key={s.id} scene={s} index={base + i} k={Math.min(i, 14)} />
        ))}
      </div>
    </div>
  );
}

function GroupHead({ beat }: { beat: SceneBeat }) {
  const from = formatDuration(beat.from);
  const to = formatDuration(beat.to);
  return (
    <div className={styles.groupHead}>
      <span className={`${styles.groupNo} hud-label`}>
        Scene {String(beat.i).padStart(2, "0")}, {from} to {to}
      </span>
      <p className={styles.groupNote}>{beat.note}</p>
    </div>
  );
}

interface ScrubberProps {
  film: SceneFilm;
  scenes: readonly Scene[];
  onSeek: (index: number, immediate: boolean) => void;
}

/**
 * The scrubber of a film: a track with a tick for every still and a line for every section. The
 * play head follows the scroll (the page writes its transform). Press or drag on the track to go
 * to the nearest still, or use the arrow keys.
 */
function Scrubber({ film, scenes, onSeek }: ScrubberProps) {
  const track = useRef<HTMLDivElement>(null);
  const down = useRef(false);

  const go = (i: number, immediate: boolean) => {
    if (i < 0 || i >= scenes.length) return;
    sceneFocus.set(film.id, i);
    onSeek(i, immediate);
    // The page may not scroll (the still is in the row on the reading line): ask the tracker to look again.
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("scroll"));
    });
  };

  const seekAt = (e: PointerEvent<HTMLDivElement>, immediate: boolean) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    go(nearestIndex(scenes, f, film.duration), immediate);
  };

  // The arrow keys step from the still that was chosen last, or from the one on the reading line.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let cur = sceneFocus.get(film.id);
    if (cur === undefined) {
      const read = track.current?.closest("[data-film]")?.querySelector<HTMLElement>("[data-read]");
      const now = read?.textContent?.slice(0, 5) ?? "";
      cur = Math.max(
        0,
        scenes.findIndex((s) => s.time === now),
      );
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      go(Math.min(scenes.length - 1, cur + 1), false);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(Math.max(0, cur - 1), false);
    else if (e.key === "Home") go(0, false);
    else if (e.key === "End") go(scenes.length - 1, false);
    else return;
    e.preventDefault();
  };

  return (
    <div className={styles.scrub} data-scrub="">
      <span className={`${styles.scrubName} hud-label`}>{film.title}</span>
      <span className={`${styles.readout} hud-label`} data-read="">
        0:00
      </span>
      <div
        ref={track}
        className={styles.track}
        data-track=""
        role="slider"
        tabIndex={0}
        aria-label={`Scrub ${film.title}`}
        aria-valuemin={0}
        aria-valuemax={film.duration}
        aria-valuenow={0}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          down.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e, false);
        }}
        onPointerMove={(e) => {
          if (down.current) seekAt(e, true);
        }}
        onPointerUp={() => {
          down.current = false;
        }}
        onPointerCancel={() => {
          down.current = false;
        }}
      >
        <span className={styles.trackLine} />
        <span className={styles.fill} data-fill="" />
        {film.beats.map((b) => (
          <span
            key={b.i}
            className={styles.beatTick}
            style={{ left: `${(fractionOf(b.from, film.duration) * 100).toFixed(2)}%` }}
          />
        ))}
        {scenes.map((s, i) => (
          <span
            key={s.id}
            className={styles.tick}
            data-tick={i}
            style={{ left: `${(fractionOf(s.t, film.duration) * 100).toFixed(2)}%` }}
          />
        ))}
        <span className={styles.head} data-head="" />
      </div>
    </div>
  );
}

export interface FilmSectionProps {
  film: SceneFilm;
  scenes: readonly Scene[];
  groups: readonly SceneGroup[];
  view: SceneView;
  /** Called with the id of the still that was pressed. */
  onOpen: (id: string) => void;
  onSeek: (filmId: string, index: number, immediate: boolean) => void;
}

/** One film: its heading, the scrubber and the strip of stills. */
export const FilmSection = memo(
  function FilmSection({ film, scenes, groups, view, onOpen, onSeek }: FilmSectionProps) {
    const ref = useRef<HTMLElement>(null);
    const [seen, setSeen] = useState(false);
    const pair = pairs.find((p) => p.id === film.pair);
    const total = film.scenes.length;

    // The strip rises when the film comes near the screen.
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setSeen(true);
            io.disconnect();
          }
        },
        { rootMargin: "120px 0px 120px 0px" },
      );
      io.observe(el);
      return () => {
        io.disconnect();
      };
    }, []);

    const bases = useMemo(() => {
      const out: number[] = [];
      groups.reduce((n, g) => {
        out.push(n);
        return n + g.scenes.length;
      }, 0);
      return out;
    }, [groups]);

    const sceneAt = (target: EventTarget | null): string | null => {
      const cell = (target as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
      return cell?.dataset.id ?? null;
    };

    const setHot = (index: number, on: boolean) => {
      const tick = ref.current?.querySelector<HTMLElement>(`[data-tick="${index}"]`);
      tick?.classList.toggle(styles.tickHot ?? "hot", on);
    };

    return (
      <section
        ref={ref}
        className={`${styles.film} ${view === "sheet" ? styles.sheetMode : ""} ${seen ? styles.in : ""}`}
        id={`scenes-${film.id}`}
        data-film={film.id}
        aria-label={film.title}
        style={{ "--ar": film.w > 0 && film.h > 0 ? film.w / film.h : 16 / 9 } as CSSProperties}
      >
        <header className={styles.filmHead}>
          <div>
            <p className={`${styles.filmKicker} hud-label`}>
              {pair ? (
                <span className={styles.pairDots} aria-hidden="true">
                  <i style={{ background: pair.colours[0] }} />
                  <i style={{ background: pair.colours[1] }} />
                </span>
              ) : null}
              <span>{pair?.names ?? ""}</span>
              <span aria-hidden="true">/</span>
              <span>{film.kind}</span>
            </p>
            <h2 className={`${styles.filmTitle} display`}>{film.title}</h2>
            <p className={`${styles.filmFacts} hud-label`}>
              <span>{formatDuration(film.duration)} long</span>
              <span>
                {scenes.length === total
                  ? `${total} stills`
                  : `${scenes.length} of ${total} stills`}
              </span>
              {film.beats.length > 0 ? <span>{film.beats.length} scenes noted</span> : null}
            </p>
          </div>
          <TLink
            href={videoHref(film.id, undefined, "arts")}
            transitionLabel="Films"
            className={styles.watchFilm}
          >
            Watch the film
          </TLink>
        </header>

        <Scrubber
          film={film}
          scenes={scenes}
          onSeek={(i, immediate) => {
            onSeek(film.id, i, immediate);
          }}
        />

        <div
          onClick={(e) => {
            const id = sceneAt(e.target);
            if (id) onOpen(id);
          }}
          onPointerOver={(e) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
            if (cell) setHot(Number(cell.dataset.cell), true);
          }}
          onPointerOut={(e) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
            if (cell) setHot(Number(cell.dataset.cell), false);
          }}
          onFocus={(e) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
            if (cell) setHot(Number(cell.dataset.cell), true);
          }}
          onBlur={(e) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
            if (cell) setHot(Number(cell.dataset.cell), false);
          }}
        >
          {view === "sheet" ? (
            <Group group={{ key: "sheet", beat: null, scenes: [...scenes] }} base={0} view={view} />
          ) : (
            groups.map((g, gi) => (
              <Group
                key={`${g.key}-${g.scenes[0]?.id ?? gi}`}
                group={g}
                base={bases[gi] ?? 0}
                view={view}
              />
            ))
          )}
        </div>
      </section>
    );
  },
  (a, b) =>
    a.film === b.film &&
    a.scenes === b.scenes &&
    a.view === b.view &&
    a.onOpen === b.onOpen &&
    a.onSeek === b.onSeek,
);
