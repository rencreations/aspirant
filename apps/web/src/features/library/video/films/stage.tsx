"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { expectReady } from "@/lib/page-ready";
import { cancelDeferred } from "@/lib/preload";

import { getCollection } from "../../registry";
import { Contents } from "./contents";
import { FilmControls } from "./controls";
import { FilmDeck, type DeckView } from "./deck";
import {
  KIND_LABEL,
  PARALLAX,
  addressFor,
  clock,
  coverScale,
  defaultFill,
  mod,
  pairNames,
  placeFilms,
  readDeepLink,
  two,
  type Override,
} from "./film-math";
import { keepFilms, poolSnapshot } from "./film-pool";
import styles from "./films.module.css";
import { FilmMotion } from "./motion";
import { filmSource } from "./preload";
import type { FilmWork } from "./types";

interface SlideProps {
  film: FilmWork;
  index: number;
  count: number;
  current: boolean;
  /** Load the poster (the film is on screen or next to it, or was). */
  near: boolean;
  register: Register;
}

type Part = "slides" | "medias" | "infos" | "frames" | "hosts";
type Register = (part: Part, index: number, el: HTMLElement | null) => void;

type SlideRefs = Record<Part, Array<HTMLElement | null>>;

/**
 * One film, one screen. The slide moves with the strip and hides what is outside it; its picture
 * lags behind it a little (parallax); its words are moved back by as much as the slide moves, so
 * they stay still on the screen and the slide's edge uncovers them (the reference does this with a
 * clip; here it is two transforms, so nothing but transforms changes while it moves).
 */
const Slide = memo(function Slide({ film, index, count, current, near, register }: SlideProps) {
  const [a, b] = pairNames(film);
  const ar = film.video.w / film.video.h;
  return (
    <section
      ref={(el) => {
        register("slides", index, el);
      }}
      className={styles.slide}
      style={{ "--ar": ar } as CSSProperties}
      aria-roledescription="slide"
      aria-label={`${two(index + 1)} of ${two(count)}, ${film.title}`}
      aria-hidden={current ? undefined : true}
      inert={!current}
    >
      <div
        ref={(el) => {
          register("medias", index, el);
        }}
        className={styles.media}
      >
        {near ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.backdrop} src={libUrl(film.backdrop)} alt="" decoding="async" />
        ) : null}
        <div className={styles.backdropDim} />
        {near ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.poster}
            src={libUrl(film.video.poster)}
            alt=""
            decoding="async"
            fetchPriority={current ? "high" : "low"}
            draggable={false}
          />
        ) : null}
        <div
          ref={(el) => {
            register("frames", index, el);
          }}
          className={styles.frame}
        >
          <div
            ref={(el) => {
              register("hosts", index, el);
            }}
            className={styles.host}
          />
        </div>
      </div>
      <div className={styles.scrim} />
      <div
        ref={(el) => {
          register("infos", index, el);
        }}
        className={styles.info}
      >
        <p className={`${styles.label} ${styles.names}`}>
          <span>{a}</span>
          {b ? (
            <>
              <span className={styles.rule} aria-hidden="true" />
              <span>{b}</span>
            </>
          ) : null}
        </p>
        <h2 className={`display ${styles.title}`}>{film.title}</h2>
        <p className={`${styles.label} ${styles.meta}`}>
          <span>{clock(film.video.dur)}</span>
          <span className={styles.rule} aria-hidden="true" />
          <span>{KIND_LABEL[film.kind]}</span>
        </p>
      </div>
    </section>
  );
});

const IDLE_VIEW: DeckView = {
  index: -1,
  state: "loading",
  progress: 0,
  audible: false,
  blocked: false,
};

/** The page lets its films go a moment after it leaves (a dev build mounts twice: keep them then). */
let releaseTimer = 0;

/**
 * The strip of the Films room: the ten films on an endless vertical strip, one to a screen, the
 * one on screen playing. Its own scroll (wheel, drag, keys), the bar at the foot, the contents.
 */
export function FilmsStage({ films }: { films: readonly FilmWork[] }) {
  const count = films.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const refs = useRef<SlideRefs>({ slides: [], medias: [], infos: [], frames: [], hosts: [] });
  const motion = useRef<FilmMotion | null>(null);
  const deck = useRef<FilmDeck | null>(null);
  const [active, setActive] = useState(-1);
  const [view, setView] = useState<DeckView>(IDLE_VIEW);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [fill, setFill] = useState(true);
  const fillChosen = useRef(false);
  const [cc, setCc] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set());
  const meta = getCollection("video");
  const register = useCallback<Register>((part, index, el) => {
    refs.current[part][index] = el;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const strip = stripRef.current;
    if (!root || !strip || count === 0) return;
    window.clearTimeout(releaseTimer);
    const mark = expectReady("library-video-films-frame");
    const r = refs.current;
    const { index: first, t } = readDeepLink(
      window.location.search,
      films.map((f) => f.id),
    );
    let width = root.clientWidth;
    let height = root.clientHeight;
    const lit = new Set<number>();
    let moved = false;

    const cover = () => {
      films.forEach((film, i) => {
        r.frames[i]?.style.setProperty(
          "--cover",
          coverScale(film.video.w / film.video.h, width / Math.max(1, height)).toFixed(4),
        );
      });
    };

    const frame = (pos: number, override: Override | null) => {
      const places = placeFilms(pos, count, override);
      for (let i = 0; i < count; i += 1) {
        const slide = r.slides[i];
        if (!slide) continue;
        const off = places[i];
        if (off === null || off === undefined) {
          if (lit.has(i)) {
            lit.delete(i);
            delete slide.dataset.on;
          }
          continue;
        }
        if (!lit.has(i)) {
          lit.add(i);
          slide.dataset.on = "true";
        }
        const y = off * height;
        slide.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
        const media = r.medias[i];
        if (media) media.style.transform = `translate3d(0, ${(-PARALLAX * y).toFixed(2)}px, 0)`;
        const info = r.infos[i];
        if (info) info.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
      }
    };

    const d = new FilmDeck(
      films.map((f) => ({
        source: filmSource(f),
        captions: f.video.captions ? libUrl(f.video.captions) : undefined,
      })),
      {
        host: (i) => r.hosts[i] ?? null,
        slide: (i) => r.slides[i] ?? null,
        view: setView,
        caption: (text) => {
          if (captionRef.current) captionRef.current.textContent = text;
        },
        ended: () => motion.current?.step(1),
        firstFrame: () => {
          requestAnimationFrame(() => requestAnimationFrame(mark));
        },
      },
    );
    if (t > 0) d.startAt(first, t);
    deck.current = d;

    const m = new FilmMotion(
      count,
      first,
      {
        frame,
        active: (film, fast) => {
          d.activate(film, fast);
          setActive(film);
          setVideo(d.video());
          setNear((prev) => {
            const want = [film, mod(film + 1, count), mod(film - 1, count)];
            if (want.every((i) => prev.has(i))) return prev;
            const next = new Set(prev);
            for (const i of want) next.add(i);
            return next;
          });
        },
        settle: (film, dir) => {
          d.settle(film, dir);
          setVideo(d.video());
          if (dir !== 0) moved = true;
          const id = films[film]?.id;
          if (moved && id) {
            const to = addressFor(window.location.href, id);
            if (
              to !== `${window.location.pathname}${window.location.search}${window.location.hash}`
            ) {
              window.history.replaceState(window.history.state, "", to);
            }
          }
        },
      },
      () => height,
    );
    motion.current = m;
    cover();
    if (!fillChosen.current) setFill(defaultFill(width, height));
    m.begin();

    const dialogOpen = () => document.querySelector("[role='dialog']") !== null;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || dialogOpen()) return;
      e.preventDefault();
      m.wheel(e.deltaY, e.deltaMode);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || dialogOpen()) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='slider']"))
        return;
      const onControl = !!target?.closest("button, a[href]");
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          m.step(1);
          break;
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          m.step(-1);
          break;
        case " ":
        case "k":
        case "K":
          if (onControl && e.key === " ") return;
          e.preventDefault();
          d.togglePlay();
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          const el = d.video();
          if (!el) return;
          e.preventDefault();
          d.seek(el.currentTime + (e.key === "ArrowRight" ? 5 : -5));
          break;
        }
        case "c":
        case "C":
          setCc((on) => !on);
          break;
        case "f":
        case "F":
          fillChosen.current = true;
          setFill((on) => !on);
          break;
        case "i":
        case "I":
          setSheet(true);
          break;
        default:
      }
    };

    // The drag: a press that moves is a drag of the strip, a press that does not is play or pause.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return;
      strip.setPointerCapture(e.pointerId);
      m.down(e.pointerId, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      m.move(e.pointerId, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (m.up(e.pointerId, e.clientY)) {
        d.togglePlay();
        audio.blip("click");
      }
    };
    const onCancel = (e: PointerEvent) => {
      m.cancel(e.pointerId);
    };

    const onResize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      cover();
      m.resize();
      if (!fillChosen.current) setFill(defaultFill(width, height));
    };

    // A read-only look at the films' buffers for the probes in scripts/qa (like `__chapterMorph`).
    (window as Window & { __filmsRoom?: unknown }).__filmsRoom = { snapshot: poolSnapshot };

    // The library search opens a film of this room by rewriting `?i=` (and says so with a
    // `popstate`): go to it, as the contents would.
    const onAddress = () => {
      const link = readDeepLink(
        window.location.search,
        films.map((f) => f.id),
      );
      if (!link.asked || link.index === m.restingFilm()) return;
      if (link.t > 0) d.startAt(link.index, link.t);
      d.prepare(link.index);
      setNear((prev) => (prev.has(link.index) ? prev : new Set([...prev, link.index])));
      m.jumpTo(link.index);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("popstate", onAddress);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    strip.addEventListener("pointerdown", onDown);
    strip.addEventListener("pointermove", onMove);
    strip.addEventListener("pointerup", onUp);
    strip.addEventListener("pointercancel", onCancel);

    // While a film can be heard, the page's music and any voice line stop. The music carries on
    // when the room is left.
    const music = audio.getMusicElement();
    const musicWas = music !== null && !music.paused;
    if (musicWas) audio.pauseMusic(900);
    audio.stopVoice();

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("popstate", onAddress);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      strip.removeEventListener("pointerdown", onDown);
      strip.removeEventListener("pointermove", onMove);
      strip.removeEventListener("pointerup", onUp);
      strip.removeEventListener("pointercancel", onCancel);
      delete (window as Window & { __filmsRoom?: unknown }).__filmsRoom;
      m.destroy();
      d.destroy();
      motion.current = null;
      deck.current = null;
      mark();
      if (musicWas) audio.resumeMusic(1800);
      cancelDeferred("library-video-films");
      // Let every film go: they hold big buffers. A dev build mounts again at once: keep them then.
      releaseTimer = window.setTimeout(() => {
        keepFilms(new Set());
      }, 0);
    };
  }, [films, count]);

  useEffect(() => {
    deck.current?.setCaptions(cc);
  }, [cc]);

  // Tell the cursor what a press does now (it reads the label when the pointer comes over).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const label = view.state === "playing" ? "Pause" : "Play";
    if (strip.dataset.cursor === label) return;
    strip.dataset.cursor = label;
    // The cursor reads the label when the pointer comes over: say it again where it already is.
    if (strip.matches(":hover")) {
      strip.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
    }
  }, [view.state]);

  const step = useCallback((dir: 1 | -1) => {
    motion.current?.step(dir);
  }, []);

  const pick = useCallback((index: number) => {
    setSheet(false);
    deck.current?.prepare(index);
    // Its poster first: it is what shows until the film has its first seconds.
    setNear((prev) => (prev.has(index) ? prev : new Set([...prev, index])));
    // After the sheet has begun to close, so the move is seen.
    requestAnimationFrame(() => {
      motion.current?.jumpTo(index);
    });
  }, []);

  const film = films[active] ?? films[0];
  const roomStyle = useMemo(
    () => ({ "--lib-colour": meta.colour }) as CSSProperties,
    [meta.colour],
  );

  return (
    <div
      ref={rootRef}
      className={styles.room}
      data-theme="storm"
      data-fill={fill ? "true" : "false"}
      data-lenis-prevent
      style={roomStyle}
      role="region"
      aria-roledescription="carousel"
      aria-label="Films"
    >
      <div ref={stripRef} className={styles.strip} data-cursor="Play">
        {films.map((f, i) => (
          <Slide
            key={f.id}
            film={f}
            index={i}
            count={count}
            current={i === active}
            near={near.has(i)}
            register={register}
          />
        ))}
      </div>

      <p ref={captionRef} className={styles.caption} aria-live="off" hidden={!cc} />

      <FilmControls
        film={film}
        index={Math.max(0, active)}
        count={count}
        view={view}
        video={video}
        fill={fill}
        captions={cc}
        onContents={() => {
          audio.blip("click");
          setSheet(true);
        }}
        onStep={step}
        onPlay={() => deck.current?.togglePlay()}
        onSound={(on) => {
          deck.current?.setSound(on);
        }}
        onFill={() => {
          fillChosen.current = true;
          setFill((on) => !on);
        }}
        onCaptions={() => {
          setCc((on) => !on);
        }}
        onSeek={(s) => deck.current?.seek(s)}
        onRetry={() => deck.current?.retry()}
      />

      <Contents open={sheet} onOpenChange={setSheet} films={films} active={active} onPick={pick} />
    </div>
  );
}
