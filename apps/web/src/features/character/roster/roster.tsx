"use client";

import type { Route } from "next";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import { AspirantLogo } from "@/components/logo/aspirant-logo";
import { useLenis } from "@/components/smooth-scroll";
import { StarGlyph } from "@/components/star-glyph";
import { ScatterText } from "@/components/text/scatter-text";
import { TLink } from "@/components/transition/t-link";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import type { Slug } from "@/content/types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { isTypingTarget, prefersReducedMotion, useHotkey, useIsoLayoutEffect } from "@/lib/hooks";
import { clamp } from "@/lib/math";
import { characterRoute } from "@/lib/site";

import type { RosterCharacter, RosterPair } from "./entries";
import styles from "./roster.module.css";
import { splashPath, splashSmallPath } from "./splash";

const pad = (n: number) => String(n).padStart(2, "0");

/** Hover intent before a voice line plays, so sweeping across the wall stays quiet. */
const VOICE_DELAY = 240;
/** How long an Aspirant has to be in front of you to count as met. */
const MEET_AFTER = 900;
const MET_KEY = "aspirants:met";
/** The click flourish before the page opens. */
const CHOOSE_MS = 340;

export interface RosterProps {
  characters: readonly RosterCharacter[];
  pairs: readonly RosterPair[];
  voiceLines: number;
  next: { href: Route; label: string; name: string };
}

interface Entry {
  character: RosterCharacter;
  pair: RosterPair;
  pairIndex: number;
  /** 0 for the first of the pair, 1 for the second. */
  place: 0 | 1;
}

function readMet(): Set<Slug> {
  try {
    const raw = window.localStorage.getItem(MET_KEY);
    return new Set(raw ? (JSON.parse(raw) as Slug[]) : []);
  } catch {
    return new Set();
  }
}

function writeMet(met: ReadonlySet<Slug>) {
  try {
    window.localStorage.setItem(MET_KEY, JSON.stringify([...met]));
  } catch {
    // Private window: the count lives for this visit only.
  }
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Actions {
  enter: (c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => void;
  tilt: (e: PointerEvent<HTMLAnchorElement>) => void;
  tiltEnd: (e: PointerEvent<HTMLAnchorElement>) => void;
  release: () => void;
  focus: (c: RosterCharacter, stop: number, e: FocusEvent<HTMLAnchorElement>) => void;
  choose: (c: RosterCharacter, e: MouseEvent<HTMLAnchorElement>) => void;
}

interface PanelProps {
  entry: Entry;
  stop: number;
  index: number;
  lit: boolean;
  met: boolean;
  chosen: boolean;
  actions: Actions;
  registerStop: (el: HTMLLIElement | null) => void;
  registerArt: (el: HTMLSpanElement | null) => void;
}

/** One panel. It only draws again when it lights up, is met or is chosen, not on every scroll. */
const PanelView = memo(function PanelView({
  entry: { character: c, pair, pairIndex, place },
  stop,
  index: i,
  lit,
  met,
  chosen,
  actions,
  registerStop,
  registerArt,
}: PanelProps) {
  return (
    <li
      ref={registerStop}
      className={styles.panel}
      style={{ "--c": c.colour, "--i": i, "--focus": c.focus } as CSSProperties}
      data-active={lit}
      data-met={met}
      data-chosen={chosen}
      data-place={place}
      data-pair={pairIndex}
    >
      <TLink
        href={characterRoute(c.slug)}
        transitionLabel={c.name}
        className={styles.card}
        data-cursor="OPEN"
        draggable={false}
        onClick={(e) => {
          actions.choose(c, e);
        }}
        onPointerEnter={(e) => {
          actions.enter(c, e);
        }}
        onPointerMove={actions.tilt}
        onPointerLeave={(e) => {
          actions.release();
          actions.tiltEnd(e);
        }}
        onFocus={(e) => {
          actions.focus(c, stop, e);
        }}
        onBlur={actions.release}
      >
        <span className={styles.echo} aria-hidden="true" />
        <span className={styles.rim} aria-hidden="true" />
        <span className={styles.face}>
          <span className={styles.art} ref={registerArt} aria-hidden="true">
            <span className={styles.tilt} data-tilt>
              {/* Plain <img>: static export. The splash art is the only picture here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(splashPath(c.slug))}
                srcSet={`${asset(splashSmallPath(c.slug))} 800w, ${asset(splashPath(c.slug))} 2048w`}
                sizes="(min-width: 48em) 60vw, 100vw"
                alt=""
                width={2048}
                height={1152}
                decoding="async"
                draggable={false}
              />
            </span>
          </span>
          <span className={styles.veil} aria-hidden="true" />
          <span className={styles.scrim} aria-hidden="true" />
          <span className={styles.shine} aria-hidden="true" />
          <span className={styles.num} aria-hidden="true">
            {pad(c.order)}
          </span>
          <span className={styles.chips}>
            <span className={styles.chip}>
              Pair {pad(pairIndex + 1)} <span aria-hidden="true">/</span> {pair.names}
            </span>
            <span className={styles.chip} data-side={c.side}>
              {c.side === "storm" ? "Storm" : "Daybreak"}
            </span>
          </span>
          <span className={styles.info}>
            <span className={styles.name}>{c.name}</span>
            <span className={styles.aspirant}>{c.aspirantName}</span>
            <span className={styles.more}>
              <span className={styles.jp} lang="ja">
                {c.jp}
                {c.romaji ? <span> {c.romaji}</span> : null}
              </span>
              <span className={styles.tagline}>{c.tagline}</span>
              {c.voice ? (
                <span className={styles.voice}>
                  {/^["“']/.test(c.voice.en) ? c.voice.en : `“${c.voice.en}”`}
                </span>
              ) : null}
            </span>
          </span>
          <span className={styles.ribbon} aria-hidden="true">
            <span>Open file</span>
            <svg viewBox="0 0 24 12" width="22" height="11" focusable="false">
              <path d="M0 4h14V0l10 6-10 6V8H0z" fill="currentColor" />
            </svg>
            <span className={styles.badge}>
              <StarGlyph />
            </span>
          </span>
        </span>
      </TLink>
      {place === 0 ? (
        <span className={styles.seam} aria-hidden="true">
          <StarGlyph />
        </span>
      ) : null}
    </li>
  );
});

/**
 * The roster wall: the ten as big slanted panels of their splash art, side by side, that you
 * scroll sideways (wheel, drag, swipe, keys, the rail). The panel in front lights up and shows
 * its file, the others sleep behind a blue haze. Scrolling settles on a panel like a magnet. A
 * hover or a stop on a panel plays its voice line and counts it as met. A click closes the other
 * panels and opens the character.
 *
 * The page does not scroll up and down: the row is a native `overflow-x` box, so touch, keys and
 * find-in-page keep working, and the wheel is turned into sideways easing on top of it. Only
 * transforms and opacity move.
 */
export function Roster({ characters, pairs, voiceLines, next }: RosterProps) {
  const router = useTransitionRouter();
  const { pause, resume } = useLenis();

  // The ten in the order the wall shows them: pair by pair.
  const list = useMemo<Entry[]>(() => {
    const bySlug = new Map(characters.map((c) => [c.slug, c]));
    return pairs.flatMap((pair, pairIndex) =>
      pair.members
        .map((slug) => bySlug.get(slug))
        .filter((c): c is RosterCharacter => c !== undefined)
        .sort((a, b) => a.order - b.order)
        .map((character, i) => ({ character, pair, pairIndex, place: i === 0 ? 0 : 1 })),
    );
  }, [characters, pairs]);
  const count = list.length;
  /** Stops: the opening plate, the ten, the closing plate. */
  const STOPS = count + 2;

  const scroller = useRef<HTMLDivElement>(null);
  const stops = useRef<Array<HTMLLIElement | null>>([]);
  const arts = useRef<Array<HTMLSpanElement | null>>([]);
  const ghost = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const engine = useRef({
    centers: [] as number[],
    mids: [] as number[],
    max: 0,
    vw: 0,
    target: 0,
    wheeling: false,
    wheelRaf: 0,
    glideRaf: 0,
    programmatic: false,
    settle: 0,
    frame: 0,
    touching: false,
    drag: { on: false, moved: false, x: 0, from: 0, v: 0, last: 0, lastX: 0 },
    suppress: false,
    active: 0,
  });

  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [moved, setMoved] = useState(false);
  const [met, setMet] = useState<ReadonlySet<Slug>>(() => new Set());
  const metRef = useRef<Set<Slug>>(new Set());
  const [pop, setPop] = useState(0);
  const [chosen, setChosen] = useState<Slug | null>(null);
  const voiceTimer = useRef(0);
  const meetTimer = useRef(0);

  // ---- the engine -------------------------------------------------------------------------

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const e = engine.current;
    e.vw = el.clientWidth;
    e.max = Math.max(0, el.scrollWidth - e.vw);
    e.mids = stops.current.map((li) => (li ? li.offsetLeft + li.offsetWidth / 2 : 0));
    e.centers = e.mids.map((m) => clamp(m - e.vw / 2, 0, e.max));
  }, []);

  /** The scroll position that puts a stop in the middle. */
  const nearest = (x: number) => {
    const { centers } = engine.current;
    let best = 0;
    for (let i = 1; i < centers.length; i++) {
      if (Math.abs((centers[i] ?? 0) - x) < Math.abs((centers[best] ?? 0) - x)) best = i;
    }
    return best;
  };

  /** Everything that follows the scroll: the parallax, the progress line, the stop in front. */
  const update = useCallback(() => {
    const el = scroller.current;
    const e = engine.current;
    e.frame = 0;
    if (!el) return;
    const sl = el.scrollLeft;
    if (ghost.current)
      ghost.current.style.transform = `translate3d(${(-sl * 0.32).toFixed(1)}px,0,0)`;
    if (fill.current)
      fill.current.style.transform = `scaleX(${e.max > 0 ? (sl / e.max).toFixed(4) : 0})`;
    const still = prefersReducedMotion();
    for (let i = 0; i < arts.current.length; i++) {
      const art = arts.current[i];
      if (!art) continue;
      // Where the panel is relative to the middle of the screen, in screens.
      const d = ((e.mids[i + 1] ?? 0) - sl - e.vw / 2) / Math.max(1, e.vw);
      if (Math.abs(d) > 1.1) continue;
      art.style.transform = still
        ? "translate3d(0,0,0) scale(1.1)"
        : `translate3d(${(-d * 9).toFixed(2)}%,0,0) scale(1.14)`;
    }
    const a = nearest(sl);
    if (a !== e.active) {
      e.active = a;
      setActive(a);
    }
    if (sl > 8) setMoved(true);
  }, []);

  const schedule = useCallback(() => {
    const e = engine.current;
    if (!e.frame) e.frame = requestAnimationFrame(update);
  }, [update]);

  const stopMotion = () => {
    const e = engine.current;
    cancelAnimationFrame(e.glideRaf);
    cancelAnimationFrame(e.wheelRaf);
    window.clearTimeout(e.settle);
    e.glideRaf = 0;
    e.wheelRaf = 0;
    e.wheeling = false;
    e.programmatic = false;
  };

  /** Ease the row to a scroll position. */
  const glide = useCallback((to: number, fast = false) => {
    const el = scroller.current;
    if (!el) return;
    const e = engine.current;
    stopMotion();
    const target = clamp(to, 0, e.max);
    const from = el.scrollLeft;
    if (Math.abs(target - from) < 1) return;
    if (prefersReducedMotion()) {
      el.scrollLeft = target;
      return;
    }
    const dur = fast ? 380 : clamp(420 + Math.abs(target - from) * 0.45, 460, 1200);
    const t0 = performance.now();
    e.programmatic = true;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      el.scrollLeft = from + (target - from) * easeOut(p);
      if (p < 1) e.glideRaf = requestAnimationFrame(step);
      else {
        e.glideRaf = 0;
        e.programmatic = false;
      }
    };
    e.glideRaf = requestAnimationFrame(step);
  }, []);

  const goStop = useCallback(
    (stop: number, fast = false) => {
      const i = clamp(stop, 0, STOPS - 1);
      glide(engine.current.centers[i] ?? 0, fast);
    },
    [glide, STOPS],
  );

  /** After the last push, come to rest on the nearest panel. */
  const settleSoon = useCallback(
    (from: () => number, wait: number) => {
      const e = engine.current;
      window.clearTimeout(e.settle);
      e.settle = window.setTimeout(() => {
        const x = from();
        cancelAnimationFrame(e.wheelRaf);
        e.wheeling = false;
        glide(e.centers[nearest(x)] ?? 0, true);
      }, wait);
    },
    [glide],
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const e = engine.current;
    measure();
    update();

    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) return;
      let d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      if (ev.deltaMode === 1) d *= 32;
      else if (ev.deltaMode === 2) d *= e.vw;
      ev.preventDefault();
      if (prefersReducedMotion()) {
        el.scrollLeft += d;
        return;
      }
      cancelAnimationFrame(e.glideRaf);
      e.glideRaf = 0;
      e.programmatic = false;
      e.target = clamp((e.wheeling ? e.target : el.scrollLeft) + d * 1.15, 0, e.max);
      if (!e.wheeling) {
        e.wheeling = true;
        const run = () => {
          const cur = el.scrollLeft;
          const diff = e.target - cur;
          if (Math.abs(diff) < 0.6) {
            el.scrollLeft = e.target;
            e.wheeling = false;
            e.wheelRaf = 0;
            return;
          }
          el.scrollLeft = cur + diff * 0.16;
          e.wheelRaf = requestAnimationFrame(run);
        };
        e.wheelRaf = requestAnimationFrame(run);
      }
      settleSoon(() => e.target, 190);
    };

    const onScroll = () => {
      schedule();
      // A touch swipe scrolls by itself (native momentum): settle when it has stopped.
      if (!e.programmatic && !e.wheeling && !e.drag.on && !e.touching) {
        settleSoon(() => el.scrollLeft, 150);
      }
    };

    const onDown = (ev: globalThis.PointerEvent) => {
      if (ev.pointerType === "touch") {
        e.touching = true;
        stopMotion();
        return;
      }
      if (ev.pointerType !== "mouse" || ev.button !== 0) return;
      stopMotion();
      e.drag = {
        on: true,
        moved: false,
        x: ev.clientX,
        from: el.scrollLeft,
        v: 0,
        last: ev.timeStamp,
        lastX: ev.clientX,
      };
    };
    const onMove = (ev: globalThis.PointerEvent) => {
      const d = e.drag;
      if (!d.on) return;
      const dx = ev.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 6) return;
      if (!d.moved) {
        d.moved = true;
        el.dataset.dragging = "true";
      }
      const dt = Math.max(1, ev.timeStamp - d.last);
      d.v = d.v * 0.7 + ((ev.clientX - d.lastX) / dt) * 0.3;
      d.last = ev.timeStamp;
      d.lastX = ev.clientX;
      el.scrollLeft = d.from - dx;
    };
    const endTouch = () => {
      if (!e.touching) return;
      e.touching = false;
      settleSoon(() => el.scrollLeft, 220);
    };
    const onUp = () => {
      endTouch();
      const d = e.drag;
      if (!d.on) return;
      d.on = false;
      delete el.dataset.dragging;
      if (d.moved) {
        e.suppress = true;
        window.setTimeout(() => {
          e.suppress = false;
        }, 0);
        // Carry on a little in the direction it was thrown, then land on a panel.
        const thrown = clamp(el.scrollLeft - d.v * 260, 0, e.max);
        glide(e.centers[nearest(thrown)] ?? 0);
      }
    };
    const onClickCapture = (ev: Event) => {
      if (e.suppress) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClickCapture, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const ro = new ResizeObserver(() => {
      measure();
      schedule();
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    void document.fonts?.ready.then(() => {
      measure();
      schedule();
    });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ro.disconnect();
      cancelAnimationFrame(e.frame);
      stopMotion();
    };
  }, [measure, update, schedule, settleSoon, glide]);

  // The page is one wall: nothing scrolls up and down.
  useEffect(() => {
    pause();
    const html = document.documentElement;
    const before = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = before.html;
      document.body.style.overflow = before.body;
      resume();
    };
  }, [pause, resume]);

  // The panels slide in once the page is painted.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  // The pictures are decoded one by one while the page is quiet, so a panel that slides in later
  // does not have to decode a 2048 pixel picture in the middle of its own move.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>("img"));
    let alive = true;
    let i = 0;
    let timer = 0;
    const next = () => {
      const img = imgs[i++];
      if (!alive || !img) return;
      void img
        .decode()
        .catch(() => undefined)
        .then(() => {
          timer = window.setTimeout(next, 120);
        });
    };
    timer = window.setTimeout(next, 900);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  // Who has been met is kept in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      metRef.current = readMet();
      setMet(new Set(metRef.current));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const meet = useCallback((slug: Slug) => {
    if (metRef.current.has(slug)) return;
    metRef.current.add(slug);
    writeMet(metRef.current);
    setMet(new Set(metRef.current));
    setPop((n) => n + 1);
  }, []);

  // Stopping on a panel for a moment meets it.
  useEffect(() => {
    window.clearTimeout(meetTimer.current);
    const entry = list[active - 1];
    if (!entry) return;
    meetTimer.current = window.setTimeout(() => {
      meet(entry.character.slug);
    }, MEET_AFTER);
    return () => {
      window.clearTimeout(meetTimer.current);
    };
  }, [active, list, meet]);

  useEffect(
    () => () => {
      window.clearTimeout(voiceTimer.current);
    },
    [],
  );

  // Keys: sideways by one panel, to the ends.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || isTypingTarget(ev.target)) return;
      if (document.querySelector("[role='dialog']")) return;
      const at = engine.current.active;
      const go = (to: number) => {
        ev.preventDefault();
        setMoved(true);
        goStop(to, true);
      };
      if (ev.key === "ArrowRight" || ev.key === "PageDown") go(at + 1);
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") go(at - 1);
      else if (ev.key === "Home") go(0);
      else if (ev.key === "End") go(STOPS - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [goStop, STOPS]);

  const goNext = useCallback(() => {
    audio.blip("click");
    router.push(next.href, { label: next.label });
  }, [router, next.href, next.label]);

  useHotkey("n", () => {
    if (!document.querySelector("[role='dialog']")) goNext();
  });

  // ---- a panel ----------------------------------------------------------------------------

  const engage = (c: RosterCharacter) => {
    window.clearTimeout(voiceTimer.current);
    window.setTimeout(() => {
      meet(c.slug);
    }, 500);
    if (!c.voice) return;
    const src = asset(c.voice.src);
    audio.preloadVoice(src);
    voiceTimer.current = window.setTimeout(() => void audio.playVoice(src), VOICE_DELAY);
  };
  const release = () => {
    window.clearTimeout(voiceTimer.current);
  };

  const onEnter = (c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse" || engine.current.drag.on) return;
    audio.blip("hover");
    engage(c);
  };

  const onTilt = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const card = e.currentTarget;
    const tilt = card.querySelector<HTMLElement>("[data-tilt]");
    if (!tilt) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `translate3d(${(-x * 26).toFixed(1)}px,${(-y * 18).toFixed(1)}px,0) scale(1.06)`;
  };
  const onTiltEnd = (e: PointerEvent<HTMLAnchorElement>) => {
    const tilt = e.currentTarget.querySelector<HTMLElement>("[data-tilt]");
    if (tilt) tilt.style.transform = "";
  };

  const onFocus = (c: RosterCharacter, stop: number, e: FocusEvent<HTMLAnchorElement>) => {
    if (!e.currentTarget.matches(":focus-visible")) return;
    goStop(stop, true);
    engage(c);
  };

  const choose = (c: RosterCharacter, e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (chosen) return;
    audio.blip("click");
    window.clearTimeout(voiceTimer.current);
    setChosen(c.slug);
    window.setTimeout(
      () => {
        router.push(characterRoute(c.slug), { label: c.name });
      },
      prefersReducedMotion() ? 0 : CHOOSE_MS,
    );
  };

  // The panels get the same functions on every render, so they do not draw again on a scroll.
  const act = useRef<Actions>({
    enter: onEnter,
    tilt: onTilt,
    tiltEnd: onTiltEnd,
    release,
    focus: onFocus,
    choose,
  });
  useIsoLayoutEffect(() => {
    act.current = {
      enter: onEnter,
      tilt: onTilt,
      tiltEnd: onTiltEnd,
      release,
      focus: onFocus,
      choose,
    };
  });
  const actions = useMemo<Actions>(
    () => ({
      enter: (c, e) => {
        act.current.enter(c, e);
      },
      tilt: (e) => {
        act.current.tilt(e);
      },
      tiltEnd: (e) => {
        act.current.tiltEnd(e);
      },
      release: () => {
        act.current.release();
      },
      focus: (c, stop, e) => {
        act.current.focus(c, stop, e);
      },
      choose: (c, e) => {
        act.current.choose(c, e);
      },
    }),
    [],
  );
  const registerStops = useMemo(
    () =>
      Array.from({ length: STOPS }, (_, n) => (el: HTMLLIElement | null) => {
        stops.current[n] = el;
      }),
    [STOPS],
  );
  const registerArts = useMemo(
    () =>
      Array.from({ length: count }, (_, n) => (el: HTMLSpanElement | null) => {
        arts.current[n] = el;
      }),
    [count],
  );

  const here = list[active - 1];
  const metCount = met.size;
  const allMet = metCount >= count;

  return (
    <section
      className={styles.wall}
      aria-label="Roster"
      data-ready={ready}
      data-moved={moved}
      data-chosen={chosen !== null}
    >
      {/* The world behind the panels: silver and blue, slanted stripes and a huge ghost word. */}
      <div className={styles.chrome} aria-hidden="true">
        <span className={styles.stripes} />
        <span className={styles.dots} />
        <div ref={ghost} className={styles.ghost}>
          <span>ASPIRANTS</span>
        </div>
        <span className={styles.sparks}>
          {Array.from({ length: 14 }, (_, n) => (
            <i key={n} style={{ "--n": n } as CSSProperties} />
          ))}
        </span>
      </div>

      <div
        ref={scroller}
        className={styles.scroller}
        role="region"
        aria-label="The ten Aspirants, scrolls sideways"
        tabIndex={0}
        data-lenis-prevent
      >
        <ol className={styles.track}>
          <li
            ref={(el) => {
              stops.current[0] = el;
            }}
            className={styles.plate}
            data-kind="intro"
            data-active={active === 0}
          >
            <div className={styles.plateBody}>
              <p className={styles.plateLogo}>
                <AspirantLogo className={styles.logo} decorative />
              </p>
              <p className={`${styles.kicker} hud-label`}>
                <StarGlyph className={styles.star} />
                04 / Roster <span aria-hidden="true">/</span> Selrick Academy registry
              </p>
              <h1 className={styles.title}>
                <span className={styles.line}>
                  <ScatterText text="Meet" className={styles.titleText} radius={120} />
                </span>{" "}
                <span className={styles.line}>
                  <ScatterText text="the ten" className={styles.titleText} radius={120} />
                </span>
              </h1>
              <p className={styles.lead}>
                Ten names in the registry, in the pairs the story puts together. Scroll sideways.
                Hover a panel to hear a voice. Open one to read her file.
              </p>
              <dl className={styles.readout}>
                <div>
                  <dt className="hud-label">Aspirants</dt>
                  <dd>{pad(count)}</dd>
                </div>
                <div>
                  <dt className="hud-label">Pairs</dt>
                  <dd>{pad(pairs.length)}</dd>
                </div>
                <div>
                  <dt className="hud-label">Voice lines</dt>
                  <dd>{voiceLines}</dd>
                </div>
              </dl>
            </div>
            <span className={styles.slash} aria-hidden="true" />
          </li>

          {list.map((entry, i) => (
            <PanelView
              key={entry.character.slug}
              entry={entry}
              stop={i + 1}
              index={i}
              lit={active === i + 1}
              met={met.has(entry.character.slug)}
              chosen={chosen === entry.character.slug}
              actions={actions}
              registerStop={registerStops[i + 1] as (el: HTMLLIElement | null) => void}
              registerArt={registerArts[i] as (el: HTMLSpanElement | null) => void}
            />
          ))}

          <li
            ref={(el) => {
              stops.current[count + 1] = el;
            }}
            className={styles.plate}
            data-kind="outro"
            data-active={active === count + 1}
          >
            <div className={styles.plateBody}>
              <p className={`${styles.kicker} hud-label`}>
                <StarGlyph className={styles.star} />
                05 / Next
              </p>
              <h2 className={styles.outroTitle}>The collection</h2>
              <p className={styles.lead}>Every film, song, comic and drawing, in one archive.</p>
              <button
                type="button"
                className={styles.bigRibbon}
                tabIndex={-1}
                aria-hidden="true"
                onClick={goNext}
              >
                <span>Enter</span>
                <svg viewBox="0 0 24 12" width="26" height="13" focusable="false">
                  <path d="M0 4h14V0l10 6-10 6V8H0z" fill="currentColor" />
                </svg>
                <span className={styles.badge}>
                  <StarGlyph />
                </span>
              </button>
            </div>
          </li>
        </ol>
      </div>

      {/* The HUD over the wall. */}
      <div
        className={styles.hud}
        style={{ "--accent-now": here?.character.colour ?? "#e0245e" } as CSSProperties}
      >
        <p className={`${styles.where} hud-label`} aria-hidden="true">
          <span key={active} className={styles.whereValue}>
            {active === 0
              ? "Registry"
              : active === count + 1
                ? "End"
                : pad(here?.character.order ?? 0)}
          </span>
          <span> / {pad(count)}</span>
          <span className={styles.whereName}>{here ? here.character.name : ""}</span>
        </p>

        <div className={styles.met} data-complete={allMet}>
          <p className={styles.metText}>
            Aspirants met:{" "}
            <b key={pop}>
              {metCount}/{count}
            </b>
            <span className={styles.help} title="Hover a panel or stay on it to meet an Aspirant.">
              ?
            </span>
          </p>
          <ul className={styles.medals} aria-hidden="true">
            {list.map(({ character: c }) => (
              <li
                key={c.slug}
                data-met={met.has(c.slug)}
                data-now={here?.character.slug === c.slug}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(splashSmallPath(c.slug))}
                  alt=""
                  width={800}
                  height={450}
                  style={{ objectPosition: c.focus }}
                  draggable={false}
                />
              </li>
            ))}
          </ul>
          <span className={styles.sheen} aria-hidden="true" />
        </div>

        <nav className={styles.rail} aria-label="Jump to an Aspirant">
          <span className={styles.railLine} aria-hidden="true">
            <span ref={fill} className={styles.railFill} />
          </span>
          <ul>
            {list.map(({ character: c, place }, i) => (
              <li key={c.slug} data-gap={place === 0 && i > 0}>
                <button
                  type="button"
                  aria-label={c.name}
                  aria-current={active === i + 1 ? "true" : undefined}
                  style={{ "--c": c.colour } as CSSProperties}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") audio.blip("hover");
                  }}
                  onClick={() => {
                    audio.blip("click");
                    setMoved(true);
                    goStop(i + 1);
                  }}
                >
                  <span aria-hidden="true">{pad(c.order)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous"
            disabled={active === 0}
            onClick={() => {
              audio.blip("click");
              goStop(engine.current.active - 1);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next"
            disabled={active === STOPS - 1}
            onClick={() => {
              audio.blip("click");
              goStop(engine.current.active + 1);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.next}
            aria-label={`Continue to ${next.name}`}
            onClick={goNext}
          >
            <span className={styles.nextTop}>Next</span>
            <span className={styles.nextName}>{next.name}</span>
          </button>
        </div>

        <p className={styles.hint} data-gone={moved} aria-hidden="true">
          <span>Scroll or drag sideways</span>
          <i />
          <i />
          <i />
        </p>
      </div>

      <p className="sr-only" aria-live="polite">
        {here ? `${here.character.name}, ${pad(here.character.order)} of ${count}.` : ""}
      </p>
    </section>
  );
}
