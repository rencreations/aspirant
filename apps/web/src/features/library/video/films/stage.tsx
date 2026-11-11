"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { expectReady } from "@/lib/page-ready";
import { cancelDeferred } from "@/lib/preload";

import { getCollection } from "../../registry";
import { FilmsBack } from "./back";
import { Contents } from "./contents";
import { FilmControls, Icon } from "./controls";
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
  wordsAt,
  wordsTravel,
  type FullscreenWay,
  type Override,
} from "./film-math";
import { keepFilms, poolSnapshot } from "./film-pool";
import styles from "./films.module.css";
import {
  enterFullscreen,
  exitFullscreen,
  fullscreenElement,
  onFullscreenChange,
  readFullscreenWay,
  unlockOrientation,
  videoFullscreen,
} from "./fullscreen";
import { IdleWatch } from "./idle";
import { FilmMotion } from "./motion";
import { filmSource } from "./preload";
import type { FilmWork } from "./types";

type Part = "slides" | "medias" | "infos" | "frames" | "hosts" | "lines";
type Register = (part: Part, index: number, el: HTMLElement | null) => void;
type SlideRefs = Record<Part, Array<HTMLElement | null>>;

/** The lines of a film's words, top to bottom: the pair, the title, the length and kind. */
const LINES = 3;

/** Keys the time line uses itself while it has the focus. */
const SLIDER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

interface SlideProps {
  film: FilmWork;
  index: number;
  count: number;
  current: boolean;
  /** Load the poster (the film is on screen or next to it, or was). */
  near: boolean;
  register: Register;
}

/**
 * One film, one screen. The slide moves with the strip and hides what is outside it; its picture
 * lags behind it a little (parallax). Around a film that does not fill the screen there is plain
 * black. Its words are in a layer of their own above the strip (`Words`).
 */
const Slide = memo(function Slide({ film, index, count, current, near, register }: SlideProps) {
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
    </section>
  );
});

/**
 * The words of one film, in a layer above the strip so no slide edge cuts them. Each line has an
 * outer box that places it (and moves smoothly when Whole frame changes the layout, a CSS
 * transition of its transform) and an inner one that the strip moves while it scrolls (`wordsAt`).
 */
const Words = memo(function Words({
  film,
  index,
  current,
  register,
}: Pick<SlideProps, "film" | "index" | "current" | "register">) {
  const [a, b] = pairNames(film);
  const ar = film.video.w / film.video.h;
  const line = (n: number) => (el: HTMLElement | null) => {
    register("lines", index * LINES + n, el);
  };
  return (
    <div
      ref={(el) => {
        register("infos", index, el);
      }}
      className={styles.info}
      style={{ "--ar": ar } as CSSProperties}
      aria-hidden={current ? undefined : true}
    >
      <div className={styles.head}>
        <p className={styles.names}>
          <span ref={line(0)} className={`${styles.line} ${styles.label}`}>
            <span>{a}</span>
            {b ? (
              <>
                <span className={styles.rule} aria-hidden="true" />
                <span>{b}</span>
              </>
            ) : null}
          </span>
        </p>
        <h2 className={`display ${styles.title}`}>
          <span ref={line(1)} className={styles.line}>
            {film.title}
          </span>
        </h2>
      </div>
      <p className={styles.meta}>
        <span ref={line(2)} className={`${styles.line} ${styles.label}`}>
          <span>{clock(film.video.dur)}</span>
          <span className={styles.rule} aria-hidden="true" />
          <span>{KIND_LABEL[film.kind]}</span>
        </span>
      </p>
    </div>
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

/** The way the probes in scripts/qa look at the room (like `__chapterMorph`). */
interface FilmsProbe {
  snapshot: typeof poolSnapshot;
  /** Draw the strip at `pos` (in screens, `1.3` is 30 percent of the way from film 2 to 3), or back where it is (null). */
  peek: (pos: number | null) => void;
}

/**
 * The strip of the Films room: the ten films on an endless vertical strip, one to a screen, the
 * one on screen playing. Its own scroll (wheel, drag, keys), the controls at the foot, the back
 * button and Index at the top left, the contents, full screen.
 */
export function FilmsStage({ films }: { films: readonly FilmWork[] }) {
  const count = films.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef<HTMLButtonElement>(null);
  const refs = useRef<SlideRefs>({
    slides: [],
    medias: [],
    infos: [],
    frames: [],
    hosts: [],
    lines: [],
  });
  const motion = useRef<FilmMotion | null>(null);
  const deck = useRef<FilmDeck | null>(null);
  const [active, setActive] = useState(-1);
  const [view, setView] = useState<DeckView>(IDLE_VIEW);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [fill, setFill] = useState(true);
  const fillChosen = useRef(false);
  const fillNow = useRef(fill);
  // Full screen (the room's own): the whole frame fitted, no words, controls that hide when idle.
  const fsRef = useRef(false);
  /** The frame mode before full screen, put back when it ends. */
  const fillBefore = useRef<{ fill: boolean; chosen: boolean } | null>(null);
  const idle = useRef<IdleWatch | null>(null);
  /** The press now going on began while the controls were hidden: it only shows them. */
  const pressRevealed = useRef(false);
  // Subtitles are on at every visit; turning them off holds for this visit only (nothing stored).
  const [cc, setCc] = useState(true);
  const ccRef = useRef(cc);
  const [sheet, setSheet] = useState(false);
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set());
  const [fsWay, setFsWay] = useState<FullscreenWay>("none");
  const [fullscreen, setFullscreen] = useState(false);
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);
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
    let travel = wordsTravel(height);
    const lit = new Set<number>();
    // The last values written to each line, so a frame writes only what changed.
    const written = new Map<HTMLElement, string>();
    let moved = false;

    const cover = () => {
      films.forEach((film, i) => {
        r.frames[i]?.style.setProperty(
          "--cover",
          coverScale(film.video.w / film.video.h, width / Math.max(1, height)).toFixed(4),
        );
      });
    };

    const writeLine = (el: HTMLElement | null | undefined, off: number, n: number) => {
      // In full screen the words are not shown: nothing of them is drawn.
      if (!el || fsRef.current) return;
      const { shown, shift } = wordsAt(off, n, LINES);
      const y = shift * travel;
      const key = `${y.toFixed(1)}|${shown.toFixed(3)}`;
      if (written.get(el) === key) return;
      written.set(el, key);
      el.style.transform = Math.abs(y) < 0.05 ? "" : `translate3d(0, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = shown > 0.999 ? "" : shown.toFixed(3);
    };

    const frame = (pos: number, override: Override | null) => {
      const places = placeFilms(pos, count, override);
      for (let i = 0; i < count; i += 1) {
        const slide = r.slides[i];
        if (!slide) continue;
        const info = r.infos[i];
        const off = places[i];
        if (off === null || off === undefined) {
          if (lit.has(i)) {
            lit.delete(i);
            delete slide.dataset.on;
            if (info) delete info.dataset.on;
          }
          continue;
        }
        if (!lit.has(i)) {
          lit.add(i);
          slide.dataset.on = "true";
          if (info) info.dataset.on = "true";
        }
        const y = off * height;
        slide.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
        const media = r.medias[i];
        if (media) media.style.transform = `translate3d(0, ${(-PARALLAX * y).toFixed(2)}px, 0)`;
        for (let n = 0; n < LINES; n += 1) writeLine(r.lines[i * LINES + n], off, n);
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
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      // The time line moves the film with these keys itself; the others still work on it.
      if (target?.closest("[role='slider']") && SLIDER_KEYS.has(e.key)) return;
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
          // Full screen always shows the whole frame.
          if (fsRef.current) break;
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

    // The drag of the strip. A press anywhere but on a control (the picture, or the empty space of
    // the controls' panel) may become a drag; it takes the pointer only once it has moved, so a
    // press that stays put never holds the pointer away from the buttons. A press that does not
    // move is play or pause, but only on the picture itself: a near miss of a button does nothing.
    let pressedFilm = false;
    let captured = -1;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("button, a[href], input, [role='slider'], [role='dialog']")) return;
      pressedFilm = !!target && strip.contains(target);
      m.down(e.pointerId, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (m.move(e.pointerId, e.clientY) && captured !== e.pointerId) {
        captured = e.pointerId;
        try {
          root.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone: the drag ends with its `pointerup`.
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      captured = -1;
      const target = e.target instanceof Element ? e.target : null;
      const tap = m.up(e.pointerId, e.clientY);
      if (tap && pressedFilm && !pressRevealed.current && target && strip.contains(target)) {
        d.togglePlay();
        audio.blip("click");
      }
      pressedFilm = false;
    };
    const onCancel = (e: PointerEvent) => {
      captured = -1;
      pressedFilm = false;
      m.cancel(e.pointerId);
    };

    const onResize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      travel = wordsTravel(height);
      written.clear();
      cover();
      m.resize();
      if (!fillChosen.current && !fsRef.current) setFill(defaultFill(width, height));
    };

    const probe: FilmsProbe = { snapshot: poolSnapshot, peek: (pos) => m.peek(pos) };
    (window as Window & { __filmsRoom?: FilmsProbe }).__filmsRoom = probe;

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
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

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
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      delete (window as Window & { __filmsRoom?: FilmsProbe }).__filmsRoom;
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
    ccRef.current = cc;
    deck.current?.setCaptions(cc);
  }, [cc]);

  useEffect(() => {
    fillNow.current = fill;
  }, [fill]);

  // In full screen the controls (the bar, the time line, Index) hide after a moment with nothing
  // done, and come back with any action: the pointer moving, a key, a press or a touch, the wheel.
  // They stay while the pointer is over them or the contents are open. A press made while they are
  // hidden only shows them (it does not pause the film). Outside full screen they never hide.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const watch = new IdleWatch((hidden) => {
      root.toggleAttribute("data-idle", hidden);
    });
    idle.current = watch;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const overControls = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-films-controls], [data-films-top]");
    const onMove = (e: PointerEvent) => {
      // A browser may send a move for a pointer that stands still: only a real move counts.
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      watch.wake();
      watch.hold("pointer", e.pointerType !== "touch" && overControls(e.target));
    };
    const onPress = () => {
      pressRevealed.current = watch.hidden;
      watch.wake();
    };
    const onLeave = () => {
      watch.hold("pointer", false);
    };
    const onAction = () => {
      watch.wake();
    };
    // The press is seen before the strip's own handler, which reads `pressRevealed`.
    root.addEventListener("pointerdown", onPress, { capture: true });
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onAction, { capture: true });
    window.addEventListener("wheel", onAction, { passive: true });
    return () => {
      root.removeEventListener("pointerdown", onPress, { capture: true });
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onAction, { capture: true });
      window.removeEventListener("wheel", onAction);
      watch.stop();
      idle.current = null;
    };
  }, []);

  useEffect(() => {
    idle.current?.hold("contents", sheet);
  }, [sheet]);

  // Full screen: how this browser can do it, and the state, which follows the browser's own
  // events (so Esc and the browser's own control are seen too). Entering or leaving gives the new
  // shape of the screen its own frame (cover on a wide one); Whole frame still switches it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setFsWay(readFullscreenWay(root));
    let was = false;
    const update = () => {
      const on = fullscreenElement() === root;
      if (on === was) return;
      was = on;
      fsRef.current = on;
      setFullscreen(on);
      setSheetHost(on ? root : null);
      if (on) {
        // The whole frame, every pixel in view, whatever the switch said; put back on leaving.
        fillBefore.current = { fill: fillNow.current, chosen: fillChosen.current };
        setFill(false);
        idle.current?.start();
        return;
      }
      unlockOrientation();
      idle.current?.stop();
      const before = fillBefore.current;
      fillBefore.current = null;
      fillChosen.current = before?.chosen ?? false;
      setFill(before ? before.fill : defaultFill(root.clientWidth, root.clientHeight));
      // The words were not drawn in full screen: draw them where the strip is now.
      motion.current?.resize();
    };
    const stop = onFullscreenChange(update);
    return () => {
      stop();
      if (fullscreenElement() === root) {
        void exitFullscreen(null);
        unlockOrientation();
      }
    };
  }, []);

  // An iPhone plays the film in its own full screen player: the captions go with it there.
  useEffect(() => {
    const el = video;
    if (!el) return;
    const tracks = (showing: boolean) => {
      for (const track of Array.from(el.textTracks)) {
        if (track.kind === "subtitles") track.mode = showing ? "showing" : "hidden";
      }
    };
    const begin = () => {
      setFullscreen(true);
      tracks(ccRef.current);
    };
    const end = () => {
      setFullscreen(false);
      tracks(false);
    };
    el.addEventListener("webkitbeginfullscreen", begin);
    el.addEventListener("webkitendfullscreen", end);
    return () => {
      el.removeEventListener("webkitbeginfullscreen", begin);
      el.removeEventListener("webkitendfullscreen", end);
    };
  }, [video]);

  // A press or drag on the full screen time line keeps the controls shown until it ends.
  const scrubbing = useCallback((on: boolean) => {
    idle.current?.hold("scrub", on);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    audio.blip("click");
    const el = deck.current?.video() ?? null;
    if (fullscreenElement() === root || videoFullscreen(el)) void exitFullscreen(el);
    else void enterFullscreen(root, el, fsWay);
  }, [fsWay]);

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
      data-fullscreen={fullscreen ? "true" : undefined}
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

      <div className={styles.words}>
        {films.map((f, i) => (
          <Words key={f.id} film={f} index={i} current={i === active} register={register} />
        ))}
      </div>

      <p ref={captionRef} className={styles.caption} aria-live="off" hidden={!cc} />

      <div className={styles.top} data-films-top="">
        <FilmsBack />
        <button
          ref={indexRef}
          type="button"
          className={`${styles.pill} ${styles.index}`}
          onClick={() => {
            audio.blip("click");
            setSheet(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={sheet}
        >
          <Icon name="list" />
          <span className={styles.indexText}>Index</span>
        </button>
      </div>

      <FilmControls
        film={film}
        index={Math.max(0, active)}
        count={count}
        view={view}
        video={video}
        fill={fill}
        captions={cc}
        fullscreen={fullscreen}
        canFullscreen={fsWay !== "none"}
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
        onFullscreen={toggleFullscreen}
        onScrubbing={scrubbing}
        onSeek={(s) => deck.current?.seek(s)}
        onRetry={() => deck.current?.retry()}
      />

      <Contents
        open={sheet}
        onOpenChange={setSheet}
        films={films}
        active={active}
        onPick={pick}
        trigger={indexRef}
        container={sheetHost}
      />
    </div>
  );
}
