"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { lvh } from "@/features/character/vexana/seams/scroll-kit";
import { isScrollKey, useScrollLock } from "@/features/character/vexana/seams/scroll-lock";
import { useScrollSnap } from "@/features/character/vexana/seams/snap";
import { asset } from "@/lib/asset";
import { useNavLock } from "@/lib/nav-lock";

import { LETTERS, LOGO, M_ASPECT, M_POINTS, M_QUAD, M_SOLID, type PlateClip } from "./assets";
import {
  barCovered,
  clamp01,
  CLOSE,
  closeParts,
  FLAT,
  FLAT_FADE,
  LAND,
  LAST_SCALE,
  LETTER_FLIGHT,
  LETTER_START,
  LOGO_WIDTH,
  openScale,
  PLATE_FLAT,
  PLATE_LIFE,
  PLATE_RISE,
  PLATE_SCALE,
  PLATE_START,
  quadMatrix,
  SCENE_END,
  sheetScale,
  SHORT_END,
  SHORT_START,
} from "./choreo";
import {
  dropFootage,
  footageProgress,
  footageUrl,
  hurryFootage,
  loadFootage,
  onFootage,
  pickedClips,
} from "./footage";
import styles from "./mlabel.module.css";

/** Screens of scroll the close is drawn over, and for which the finished logo then stands. */
const CLOSE_SCREENS = 0.9;
const RUNWAY_SCREENS = 0.4;

/** The share of the M's height the black sheet is scaled about: inside its solid band. */
const PIVOT = (M_SOLID.top + M_SOLID.bottom) / 2;
/** The M as a clip-path, in percent of its box. Static: only transforms move. */
const M_CLIP = `polygon(${M_POINTS.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(",")})`;
/** The black sheet: far more than a screen of black, with the M cut out of it. */
const SHEET_PATH = `M-3000-3000H3100V3100H-3000Z M${M_POINTS.map(([x, y]) => `${x * 100} ${y * 100}`).join("L")}Z`;
const M_OUTLINE = `M${M_POINTS.map(([x, y]) => `${x * 100} ${y * 100}`).join("L")}Z`;
const IDENTITY = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
const PLATES = [0, 1, 2, 3, 4] as const;
/** The eight silver letters (the M is the plate's). */
const SILVER = LETTERS.filter((letter) => letter.id !== "m");
const LOGO_M = LETTERS.find((letter) => letter.id === "m") ?? LETTERS[3];
/** A letter and the two fainter copies that trail it, as the streak of its flight. */
const TRAIL = [0, 1, 2] as const;

type Group = "long" | "short" | "flat";
type Mode = "scroll" | "waiting" | "playing" | "held";

interface Track {
  anim: Animation;
  group: Group;
}

interface Probe {
  state: () => { mode: Mode; played: boolean; progress: number; ready: boolean; loaded: number };
  seek: (seconds: number) => void;
  freeze: (on: boolean) => void;
}

declare global {
  interface Window {
    __aboutLabel?: Probe;
  }
}

/** One letter of the logo, cut out of the whole picture by its box. */
function Slice({
  box,
  className,
  part,
}: {
  box: (typeof LETTERS)[number];
  className?: string;
  part: string;
}) {
  const style: CSSProperties = {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
  const inner: CSSProperties = {
    left: `${(-box.x / box.w) * 100}%`,
    top: `${(-box.y / box.h) * 100}%`,
    width: `${100 / box.w}%`,
    height: `${100 / box.h}%`,
  };
  return (
    <span className={className} style={style} data-part={part}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a slice of the logo, moved by a transform */}
      <img
        src={asset(LOGO.src)}
        alt=""
        width={LOGO.width}
        height={LOGO.height}
        style={inner}
        decoding="async"
      />
    </span>
  );
}

/** Holds the page from going further down while the footage is still arriving. Up stays free. */
function holdDown(at: () => number, jump: (y: number) => void): () => void {
  let touch = 0;
  const wheel = (e: WheelEvent) => {
    if (e.deltaY <= 0) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const start = (e: TouchEvent) => {
    touch = e.touches[0]?.clientY ?? 0;
  };
  const move = (e: TouchEvent) => {
    if ((e.touches[0]?.clientY ?? 0) >= touch) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const key = (e: KeyboardEvent) => {
    if (!isScrollKey(e) || ["ArrowUp", "PageUp", "Home"].includes(e.key)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const scroll = () => {
    if (window.scrollY > at() + 2) jump(at());
  };
  const opts = { passive: false, capture: true } as const;
  window.addEventListener("wheel", wheel, opts);
  window.addEventListener("touchstart", start, { passive: true, capture: true });
  window.addEventListener("touchmove", move, opts);
  window.addEventListener("keydown", key, true);
  window.addEventListener("scroll", scroll, { passive: true });
  return () => {
    window.removeEventListener("wheel", wheel, opts);
    window.removeEventListener("touchstart", start, true);
    window.removeEventListener("touchmove", move, opts);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("scroll", scroll);
  };
}

/**
 * The stage of TheMLabel's scene, stuck to the screen at the head of the section.
 *
 * The drone's ring is held on the screen under it. As the visitor scrolls on, a black sheet with
 * an M cut out of it comes down in scale, so the black closes in from every side and the page is
 * seen only through the M. That part follows the scroll both ways, and a stop inside it settles
 * after a second. When the M stands, the scene plays by itself with the scroll held: five M
 * plates with footage flip up from the floor, each over the one before, the last one in the
 * logo's orange draws back to the logo's M and the letters fly in from the sides. The scroll is
 * given back the moment the logo stands; the M's footage then gives way to its flat orange, and
 * nothing else passes over the logo.
 *
 * The scene plays in full once. After that (and in the tests, where `aspirants:intro` is off) the
 * last plate and the letters simply follow the scroll, down and up, so nobody is held twice.
 *
 * Everything that moves is a transform or an opacity, as paused Web Animations on one clock:
 * playing the scene, scrubbing it with the scroll and holding it for a frame sheet (`seek`) are
 * the same animations at a time that is set.
 */
export function Stage() {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<SVGSVGElement>(null);
  const lenis = useLenis();
  const { lock } = useScrollLock();
  const live = useRef({ lenis, lock });
  // Picked on the visitor's side only: the pick is random, so the server draws none.
  const [clips, setClips] = useState<readonly PlateClip[]>([]);
  const [urls, setUrls] = useState<ReadonlyArray<string | null>>([]);

  useEffect(() => {
    live.current = { lenis, lock };
  });

  // The stretch of the page the close is drawn over, read live: the page above changes height.
  const range = () => {
    const el = track.current;
    if (!el) return null;
    const start = el.getBoundingClientRect().top + window.scrollY;
    return { start, end: start + CLOSE_SCREENS * lvh() };
  };
  useScrollSnap("about-mlabel", range, { idleMs: 1000 });

  // The footage: asked for when the end of the page is a few screens away, and by the loading list.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const mine = pickedClips();
    setClips(mine);
    const sync = () => {
      setUrls(mine.map((clip) => footageUrl(clip)));
    };
    const off = onFootage(sync);
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        near.disconnect();
        void loadFootage().then(sync);
      },
      { rootMargin: "400% 0px 100% 0px" },
    );
    near.observe(el);
    return () => {
      off();
      near.disconnect();
      dropFootage();
    };
  }, []);

  useEffect(() => {
    const root = stage.current;
    const svg = sheet.current;
    if (!root || !svg) return;

    // The videos are drawn after the first pick, so they are looked up when they are needed.
    const films = () => Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    const introOff = (() => {
      try {
        return window.sessionStorage.getItem("aspirants:intro") === "off";
      } catch {
        return false;
      }
    })();

    let mode: Mode = "scroll";
    let played = false;
    let fx = false;
    let last = 0;
    let tracks: Track[] = [];
    let geo = { vw: 1, vh: 1, mw: 1, mh: 1, open: 1 };
    let unlock: (() => void) | null = null;
    let unhold: (() => void) | null = null;
    let safety = 0;
    let fxTimer = 0;
    let dark = false;

    const setNav = (on: boolean) => {
      if (on === dark) return;
      dark = on;
      useNavLock.setState({ theme: on ? "storm" : "daybreak" });
    };

    // Geometry: the M's box by the smaller side of the screen, the logo's box, and where the
    // logo's own M is on the screen (the last plate lands on it).
    const measure = () => {
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      const mh = Math.min(0.46 * vh, (0.62 * vw) / M_ASPECT);
      const mw = mh * M_ASPECT;
      const lw = Math.min(1100, vw * (vw < 700 ? LOGO_WIDTH.narrow : LOGO_WIDTH.wide));
      const lh = (lw * LOGO.height) / LOGO.width;
      root.style.setProperty("--mw", `${mw}px`);
      root.style.setProperty("--mh", `${mh}px`);
      root.style.setProperty("--lw", `${lw}px`);
      root.style.setProperty("--lh", `${lh}px`);
      geo = { vw, vh, mw, mh, open: openScale(vw, vh, mw, mh, M_SOLID, PIVOT) };
      // The corners of the logo's M, from the top left of the plate's own box.
      const ox = (vw - lw) / 2 - (vw - mw) / 2;
      const oy = (vh - lh) / 2 - (vh - mh) / 2;
      const corner = (i: number): readonly [number, number] => {
        const [x, y] = M_QUAD[i] ?? [0, 0];
        return [ox + x * lw, oy + y * lh];
      };
      return quadMatrix(mw, mh, [corner(0), corner(1), corner(2), corner(3)]);
    };

    const build = () => {
      for (const t of tracks) t.anim.cancel();
      tracks = [];
      const landing = measure();
      const add = (
        el: Element | undefined,
        group: Group,
        frames: Keyframe[],
        start: number,
        duration: number,
        easing = "linear",
        fill: FillMode = "both",
      ) => {
        if (!el) return;
        const anim = el.animate(frames, { delay: start, duration, easing, fill });
        anim.pause();
        tracks.push({ anim, group });
      };
      const swing = "cubic-bezier(0.2, 0.72, 0.24, 1)";
      const flip = [
        { transform: `perspective(calc(var(--mh) * 1.6)) rotateX(${PLATE_FLAT}deg)` },
        { transform: "perspective(calc(var(--mh) * 1.6)) rotateX(0deg)" },
      ];
      const streak = [
        { transform: "translate3d(-130%, 0, 0) skewX(-24deg)", opacity: 0.85 },
        { transform: "translate3d(230%, 0, 0) skewX(-24deg)", opacity: 0 },
      ];

      PLATES.forEach((i) => {
        const start = PLATE_START[i];
        const group: Group = i === 4 ? "short" : "long";
        const dolly = root.querySelector(`[data-plate="${i}"] [data-part="dolly"]`) ?? undefined;
        const up = PLATE_RISE / PLATE_LIFE;
        if (i < 4) {
          add(
            dolly,
            group,
            [
              {
                transform: `translate3d(0, -16%, 0) scale(${PLATE_SCALE.flat})`,
                opacity: 1,
                easing: swing,
              },
              {
                transform: `translate3d(0, 0, 0) scale(${PLATE_SCALE.up})`,
                opacity: 1,
                offset: up,
                easing: "cubic-bezier(0.3, 0.2, 0.3, 1)",
              },
              {
                transform: `translate3d(0, 0, 0) scale(${PLATE_SCALE.far * 1.06})`,
                opacity: 1,
                offset: 0.9,
              },
              { transform: `translate3d(0, 0, 0) scale(${PLATE_SCALE.far})`, opacity: 0 },
            ],
            start,
            PLATE_LIFE,
            "linear",
            "forwards",
          );
        } else {
          add(
            dolly,
            group,
            [
              { transform: `translate3d(0, -16%, 0) scale(${LAST_SCALE.flat})`, opacity: 0 },
              {
                transform: `translate3d(0, -14%, 0) scale(${LAST_SCALE.flat * 0.97})`,
                opacity: 1,
                offset: 0.06,
              },
              { transform: `translate3d(0, 0, 0) scale(${LAST_SCALE.up})`, opacity: 1 },
            ],
            start,
            PLATE_RISE * 1.25,
            swing,
            "forwards",
          );
          const land = root.querySelector(`[data-plate="${i}"]`) ?? undefined;
          add(
            land,
            "short",
            [{ transform: IDENTITY }, { transform: landing }],
            LAND.start,
            LAND.end - LAND.start,
            "cubic-bezier(0.35, 0, 0.15, 1)",
          );
          // The footage gives way to the logo's own flat M, which is already under it.
          add(land, "flat", [{ opacity: 1 }, { opacity: 0 }], FLAT.end, FLAT_FADE);
        }
        add(
          root.querySelector(`[data-plate="${i}"] [data-part="flip"]`) ?? undefined,
          group,
          flip,
          start,
          i === 4 ? PLATE_RISE * 1.25 : PLATE_RISE,
          swing,
        );
        add(
          root.querySelector(`[data-plate="${i}"] [data-part="streak"]`) ?? undefined,
          group,
          streak,
          start + PLATE_RISE * 0.25,
          PLATE_RISE * 1.7,
          "cubic-bezier(0.3, 0, 0.4, 1)",
        );
      });

      // The black behind the plates. In the long scene it comes in under the first plate; in the
      // short one under the last, so a scroll back up opens the window again.
      const under = root.querySelector('[data-part="under"]') ?? undefined;
      const cover = [{ opacity: 0 }, { opacity: 1 }];
      add(
        root.querySelector('[data-part="under-long"]') ?? undefined,
        "long",
        [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
        PLATE_RISE * 0.45,
        SHORT_START + PLATE_RISE * 1.4 - PLATE_RISE * 0.45,
        "linear",
        "forwards",
      );
      add(under, "short", cover, SHORT_START + PLATE_RISE * 0.5, PLATE_RISE * 0.5);

      // The letters, from the sides, turned on the vertical axis, each with its trail.
      SILVER.forEach((letter, i) => {
        const side = i < 3 ? -1 : 1;
        const from = `perspective(900px) translate3d(${side * geo.vw * 0.5}px, ${geo.vh * 0.05}px, 0) rotateY(${side * -74}deg) rotateX(-16deg) scale(2.7)`;
        const to = "perspective(900px) translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg) scale(1)";
        TRAIL.forEach((g) => {
          const el = root.querySelector(`[data-part="letter-${letter.id}-${g}"]`) ?? undefined;
          const frames: Keyframe[] =
            g === 0
              ? [
                  { transform: from, opacity: 0 },
                  { opacity: 1, offset: 0.3 },
                  { transform: to, opacity: 1 },
                ]
              : [
                  { transform: from, opacity: 0 },
                  { opacity: 0.4 / g, offset: 0.35 },
                  { transform: to, opacity: 0 },
                ];
          add(
            el,
            "short",
            frames,
            (LETTER_START[i] ?? 0) + g * 34,
            LETTER_FLIGHT + g * 30,
            "cubic-bezier(0.14, 0.74, 0.2, 1)",
          );
        });
      });

      add(
        root.querySelector('[data-part="logo-m"]') ?? undefined,
        "flat",
        cover,
        FLAT.start,
        FLAT.end - FLAT.start,
      );
    };

    const setTimes = (at: (group: Group) => number) => {
      for (const t of tracks) {
        t.anim.pause();
        t.anim.currentTime = at(t.group);
      }
    };

    const setSheet = (progress: number) => {
      const scale = sheetScale(progress, geo.open);
      svg.style.visibility = progress <= 0.0005 ? "hidden" : "visible";
      svg.style.transform = `scale(${scale.toFixed(4)})`;
      return scale;
    };

    /** Everything as a function of the scroll: the sheet, then the short scene, then the flat M. */
    const apply = (p: number) => {
      const parts = closeParts(p);
      const scale = setSheet(parts.sheet);
      setNav(p > 0 && barCovered(scale, geo.mh, geo.vh, PIVOT));
      root.dataset.on = p > 0 ? "true" : "false";
      // Once the black is whole, what is under it (the drone's button) is out of reach.
      root.dataset.covered = parts.sheet >= 1 ? "true" : "false";
      if (fx) {
        // The M is still turning flat on the clock: leave it, unless the visitor turns back.
        if (p >= 0.995) return;
        endFx();
      }
      setTimes((group) => {
        if (group === "short") {
          return parts.short <= 0
            ? SHORT_START - 1
            : SHORT_START + parts.short * (SHORT_END - SHORT_START);
        }
        if (group === "flat") {
          return parts.short < 1
            ? FLAT.start - 1
            : FLAT.start + parts.flat * (FLAT.end + FLAT_FADE - FLAT.start);
        }
        return SCENE_END + 1000;
      });
    };

    /** The M has turned flat (or the visitor cut it short): the footage is hidden and stops. */
    function endFx() {
      window.clearTimeout(fxTimer);
      fx = false;
      for (const v of films()) v.pause();
    }

    const jump = (y: number) => {
      const l = live.current.lenis.getLenis();
      if (l) l.scrollTo(y, { immediate: true, force: true });
      window.scrollTo(0, y);
    };

    /** The logo stands: the page is put at the end of the close and the scroll is given back. */
    const finish = () => {
      if (mode !== "playing") return;
      window.clearTimeout(safety);
      mode = "scroll";
      played = true;
      fx = !document.hidden;
      root.dataset.mode = mode;
      const r = range();
      if (r) {
        window.scrollTo(0, r.end);
        last = 1;
      }
      unlock?.();
      unlock = null;
      if (fx) {
        fxTimer = window.setTimeout(
          () => {
            endFx();
            onScroll();
          },
          SCENE_END - SHORT_END + 200,
        );
      } else {
        endFx();
        apply(1);
      }
    };

    const play = () => {
      mode = "playing";
      root.dataset.mode = mode;
      setSheet(1);
      setNav(true);
      root.dataset.covered = "true";
      unlock = live.current.lock(SHORT_END + 900);
      for (const t of tracks) {
        t.anim.currentTime = 0;
        t.anim.play();
      }
      for (const v of films()) void v.play().catch(() => undefined);
      // The clock is the authority: the lock's own limit is only a net under it.
      safety = window.setTimeout(finish, SHORT_END + 60);
    };

    const stopWaiting = () => {
      unhold?.();
      unhold = null;
    };

    /** The M stands for the first time: play, or wait for the footage with the real count. */
    const begin = () => {
      apply(CLOSE.sheet);
      if (footageProgress().ready) {
        play();
        return;
      }
      mode = "waiting";
      root.dataset.mode = mode;
      hurryFootage();
      void loadFootage();
      unhold = holdDown(() => (range()?.start ?? 0) + CLOSE.sheet * CLOSE_SCREENS * lvh(), jump);
    };

    const meter = root.querySelector<HTMLElement>('[data-part="meter"]');
    const offFootage = onFootage(() => {
      const { fraction, ready } = footageProgress();
      if (meter) meter.style.transform = `scaleX(${fraction.toFixed(3)})`;
      if (ready && mode === "waiting") {
        stopWaiting();
        // A frame for the videos to take their addresses.
        requestAnimationFrame(() => {
          if (mode === "waiting") play();
        });
      }
    });

    const onScroll = () => {
      const r = range();
      if (!r) return;
      const p = (window.scrollY - r.start) / (r.end - r.start);
      if (mode === "playing" || mode === "held") return;
      if (mode === "waiting") {
        if (p < CLOSE.sheet - 0.03) {
          stopWaiting();
          mode = "scroll";
          root.dataset.mode = mode;
        } else return;
      }
      const down = p > last;
      const crossed = last < CLOSE.sheet && p >= CLOSE.sheet && p < 1.1;
      last = p;
      if (!played && !introOff && down && crossed) {
        begin();
        return;
      }
      apply(clamp01(p));
      // Past the stage, in the dark content, the bar stays on black.
      if (p >= 1) setNav(true);
    };

    const onHidden = () => {
      if (!document.hidden) return;
      if (mode === "playing") {
        for (const t of tracks) t.anim.finish();
        finish();
      } else if (fx) {
        endFx();
        onScroll();
      }
    };

    const onResize = () => {
      build();
      if (mode === "playing") {
        for (const t of tracks) t.anim.finish();
        finish();
      }
      if (mode === "scroll") {
        fx = false;
        onScroll();
      }
    };

    build();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onHidden);

    window.__aboutLabel = {
      state: () => {
        const { fraction, ready } = footageProgress();
        return { mode, played, progress: last, ready, loaded: fraction };
      },
      seek: (seconds) => {
        // A scene that is playing is taken over: its hold on the scroll is given back.
        window.clearTimeout(safety);
        unlock?.();
        unlock = null;
        mode = "held";
        fx = false;
        root.dataset.mode = mode;
        root.dataset.on = "true";
        root.dataset.covered = "true";
        setSheet(1);
        setNav(true);
        setTimes(() => seconds * 1000);
      },
      freeze: (on) => {
        if (on) {
          mode = "held";
          for (const t of tracks) t.anim.pause();
        } else {
          mode = "scroll";
          fx = false;
          onScroll();
        }
        root.dataset.mode = mode;
      },
    };

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onHidden);
      window.clearTimeout(safety);
      window.clearTimeout(fxTimer);
      offFootage();
      stopWaiting();
      unlock?.();
      for (const t of tracks) t.anim.cancel();
      delete window.__aboutLabel;
      // Back to the page's own bar, unless the page itself has already let go of it.
      if (useNavLock.getState().theme === "storm") useNavLock.setState({ theme: "daybreak" });
    };
  }, []);

  // Each clip starts at a point of its own, so no two visits show the same frames.
  const offsets = useRef<number[]>([]);
  const onMeta = (i: number, video: HTMLVideoElement) => {
    offsets.current[i] ??= Math.random() * 0.35;
    const at = (offsets.current[i] ?? 0) * (Number.isFinite(video.duration) ? video.duration : 1);
    if (video.currentTime < 0.01) video.currentTime = at;
  };

  const vars = { "--close": CLOSE_SCREENS, "--runway": RUNWAY_SCREENS } as CSSProperties;

  return (
    <div ref={track} className={styles.track} style={vars}>
      <div
        ref={stage}
        className={styles.stage}
        data-mode="scroll"
        data-on="false"
        aria-hidden="true"
      >
        <svg
          ref={sheet}
          className={styles.sheet}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ transformOrigin: `50% ${PIVOT * 100}%` }}
        >
          <path d={SHEET_PATH} fillRule="evenodd" fill="#000" />
          <path d={M_OUTLINE} className={styles.rim} />
        </svg>
        <span className={styles.under} data-part="under-long" />
        <span className={styles.under} data-part="under" />

        <div className={styles.plates}>
          {PLATES.map((i) => {
            const clip = clips[i];
            return (
              <div key={i} className={styles.land} data-plate={i}>
                <div className={styles.dolly} data-part="dolly">
                  <div className={styles.flip} data-part="flip">
                    <span className={styles.edge} data-depth="2" style={{ clipPath: M_CLIP }} />
                    <span className={styles.edge} data-depth="1" style={{ clipPath: M_CLIP }} />
                    <div className={styles.face} style={{ clipPath: M_CLIP }} data-tone={i}>
                      {clip ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- the still under a plate's footage */}
                          <img
                            src={asset(clip.still)}
                            alt=""
                            width={480}
                            height={436}
                            decoding="async"
                          />
                          <video
                            src={urls[i] ?? undefined}
                            muted
                            loop
                            playsInline
                            preload="auto"
                            tabIndex={-1}
                            onLoadedMetadata={(e) => {
                              onMeta(i, e.currentTarget);
                            }}
                          />
                        </>
                      ) : null}
                      <span className={styles.streak} data-part="streak" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.logo}>
          {LOGO_M ? <Slice box={LOGO_M} className={styles.logoM} part="logo-m" /> : null}
          {SILVER.map((letter) =>
            TRAIL.map((g) => (
              <Slice
                key={`${letter.id}-${g}`}
                box={letter}
                className={styles.letter}
                part={`letter-${letter.id}-${g}`}
              />
            )),
          )}
        </div>

        <div className={styles.wait}>
          <span className={styles.waitLine}>
            <span className={styles.waitFill} data-part="meter" />
          </span>
        </div>
      </div>
    </div>
  );
}
