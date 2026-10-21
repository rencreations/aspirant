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
import { startGovernor } from "@/lib/perf";
import { characterRoute } from "@/lib/site";

import type { RosterCharacter, RosterPair } from "./entries";
import { createHoverFx } from "./hover-fx";
import { BAYS, BOARD_H, BOARD_W, END, mid, SLOTS, type Slot } from "./layout";
import styles from "./roster.module.css";
import { splashPath } from "./splash";

const pad = (n: number) => String(n).padStart(2, "0");

/** The click flourish before the page opens. */
const CHOOSE_MS = 360;

export interface RosterProps {
  characters: readonly RosterCharacter[];
  pairs: readonly RosterPair[];
  voiceLines: number;
  next: { href: Route; label: string; name: string };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The slots of each pair, in the order of the bays. */
const SLOTS_OF_BAY = BAYS.map((id) => SLOTS.filter((s) => s.pair === id));
/** Where each pair is across the board (the middle of its panels), and the closing plate. */
const BAY_CENTRES = [
  ...SLOTS_OF_BAY.map((ss) => ss.reduce((sum, s) => sum + mid(s), 0) / ss.length),
  (END.x1 + END.x2) / 2,
];

interface Actions {
  enter: (c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => void;
  move: (e: PointerEvent<HTMLAnchorElement>) => void;
  leave: () => void;
  focus: (c: RosterCharacter, bay: number, e: FocusEvent<HTMLAnchorElement>) => void;
  choose: (c: RosterCharacter, e: MouseEvent<HTMLAnchorElement>) => void;
}

interface PanelProps {
  slot: Slot;
  character: RosterCharacter;
  bay: number;
  index: number;
  chosen: boolean;
  actions: Actions;
}

/** One panel. It only draws again when it is chosen, not on every scroll. It is shaded until it is hovered. */
const PanelView = memo(function PanelView({
  slot: s,
  character: c,
  bay,
  index,
  chosen,
  actions,
}: PanelProps) {
  const style = {
    "--x0": s.x0,
    "--x1": s.x1,
    "--x2": s.x2,
    "--x3": s.x3,
    "--y0": s.y0,
    "--y1": s.y1,
    "--z": s.z,
    "--zoom": s.zoom,
    "--fx": s.fx,
    "--fy": s.fy,
    "--tx": s.tx,
    "--ty": s.ty,
    "--c": c.colour,
    "--i": index,
  } as CSSProperties;
  return (
    <li className={styles.panel} style={style} data-slug={c.slug} data-chosen={chosen}>
      <TLink
        href={characterRoute(c.slug)}
        transitionLabel={c.name}
        className={styles.card}
        draggable={false}
        onClick={(e) => {
          actions.choose(c, e);
        }}
        onPointerEnter={(e) => {
          actions.enter(c, e);
        }}
        onPointerMove={actions.move}
        onPointerLeave={actions.leave}
        onFocus={(e) => {
          actions.focus(c, bay, e);
        }}
      >
        <span className={styles.lift}>
          <span className={styles.rim} aria-hidden="true" />
          <span className={styles.face}>
            <span className={styles.art} aria-hidden="true">
              <span className={styles.tilt} data-fx="pic">
                {/* Plain <img>: static export. The splash art is the only picture here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(splashPath(c.slug))}
                  alt=""
                  width={2048}
                  height={1152}
                  decoding="async"
                  draggable={false}
                />
              </span>
            </span>
            <span className={styles.veil} aria-hidden="true" />
            <span className={styles.tag}>
              <span>{c.name}</span>
            </span>
          </span>
        </span>
        {/* The part that answers the pointer: the same slanted shape as the frame, and nothing else. */}
        <span className={styles.hit} aria-hidden="true" />
      </TLink>
    </li>
  );
});

/**
 * The roster wall, drawn from the owner's reference strip: one row of slanted panels of splash
 * art, each pair laid out its own way (one over the other, one tall, one narrow), the newest pair
 * first and big on a crimson plate, and a blue plate at the end. It scrolls
 * sideways (wheel, drag, swipe, keys, the rail). The pair in front is lit and the rest sleep behind
 * a blue haze. A hover lifts a panel and lights its pair. A click closes the others and opens the
 * character. Nothing plays on a hover.
 *
 * The page does not scroll up and down: the row is a native `overflow-x` box, so touch, keys and
 * find-in-page keep working, and the wheel is turned into sideways easing on top of it. Only
 * transforms and opacity move.
 */
export function Roster({ characters, pairs, voiceLines, next }: RosterProps) {
  const router = useTransitionRouter();
  const { pause, resume } = useLenis();

  const bySlug = useMemo(() => new Map(characters.map((c) => [c.slug, c])), [characters]);
  const pairNames = useMemo(() => new Map(pairs.map((p) => [p.id, p])), [pairs]);
  const entries = useMemo(
    () =>
      SLOTS.flatMap((slot) => {
        const character = bySlug.get(slot.slug);
        return character ? [{ slot, character, bay: BAYS.indexOf(slot.pair) }] : [];
      }),
    [bySlug],
  );
  const count = entries.length;
  const STOPS = BAYS.length + 1;

  const scroller = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const engine = useRef({
    u: 1,
    left: 0,
    vw: 0,
    max: 0,
    bays: [] as number[],
    centers: [] as number[],
    target: 0,
    wheeling: false,
    wheelRaf: 0,
    glideRaf: 0,
    frame: 0,
    drag: { on: false, moved: false, x: 0, from: 0, v: 0, last: 0, lastX: 0 },
    suppress: false,
    active: 0,
  });

  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [moved, setMoved] = useState(false);
  const [chosen, setChosen] = useState<Slug | null>(null);

  // ---- the engine -------------------------------------------------------------------------

  const measure = useCallback(() => {
    const el = scroller.current;
    const b = board.current;
    if (!el || !b) return;
    const e = engine.current;
    e.vw = el.clientWidth;
    e.max = Math.max(0, el.scrollWidth - e.vw);
    e.u = b.offsetHeight / BOARD_H;
    e.left = b.offsetLeft;
    e.bays = BAY_CENTRES.map((c) => e.left + e.u * c);
    e.centers = e.bays.map((x) => clamp(x - e.vw / 2, 0, e.max));
  }, []);

  /** The pair (or the closing plate) in the middle of the screen. */
  const bayAt = (sl: number) => {
    const { bays, vw } = engine.current;
    const middle = sl + vw / 2;
    let best = 0;
    for (let i = 1; i < bays.length; i++) {
      if (Math.abs((bays[i] ?? 0) - middle) < Math.abs((bays[best] ?? 0) - middle)) best = i;
    }
    return best;
  };

  /** What follows the scroll: the progress line and the pair in front. Nothing else moves. */
  const update = useCallback(() => {
    const el = scroller.current;
    const e = engine.current;
    e.frame = 0;
    if (!el) return;
    const sl = el.scrollLeft;
    if (fill.current)
      fill.current.style.transform = `scaleX(${e.max > 0 ? (sl / e.max).toFixed(4) : 0})`;
    const a = bayAt(sl);
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
    e.glideRaf = 0;
    e.wheelRaf = 0;
    e.wheeling = false;
  };

  /** Ease the row to a scroll position. */
  const glide = useCallback((to: number) => {
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
    const dur = clamp(520 + Math.abs(target - from) * 0.4, 560, 1300);
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      el.scrollLeft = from + (target - from) * easeOut(p);
      e.glideRaf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    e.glideRaf = requestAnimationFrame(step);
  }, []);

  /** Go to a pair: 0 is the newest, the last stop is the closing plate. */
  const goBay = useCallback(
    (bay: number) => {
      glide(engine.current.centers[clamp(bay, 0, STOPS - 1)] ?? 0);
    },
    [glide, STOPS],
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
      e.target = clamp((e.wheeling ? e.target : el.scrollLeft) + d * 1.2, 0, e.max);
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
          el.scrollLeft = cur + diff * 0.14;
          e.wheelRaf = requestAnimationFrame(run);
        };
        e.wheelRaf = requestAnimationFrame(run);
      }
    };

    const onScroll = () => {
      schedule();
    };

    const onDown = (ev: globalThis.PointerEvent) => {
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
    const onUp = () => {
      const d = e.drag;
      if (!d.on) return;
      d.on = false;
      delete el.dataset.dragging;
      if (d.moved) {
        e.suppress = true;
        window.setTimeout(() => {
          e.suppress = false;
        }, 0);
        // Carry on a little in the direction it was thrown.
        glide(clamp(el.scrollLeft - d.v * 320, 0, e.max));
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
    if (board.current) ro.observe(board.current);
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
  }, [measure, update, schedule, glide]);

  // A device that cannot keep the frame rate loses effects (lib/perf.ts), here and on the other pages.
  useEffect(() => startGovernor(), []);

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

  // The panels slide in only when their pictures are decoded, so a panel is never an empty dark
  // shape while its picture is still arriving. (The pictures are in the loading bar, so this is
  // normally at once. It never waits longer than four seconds.)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let alive = true;
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>("img"));
    const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, 4000));
    void Promise.race([decoded, cap]).then(() => {
      if (!alive) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (alive) setReady(true);
        });
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keys: sideways by one pair, to the ends.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || isTypingTarget(ev.target)) return;
      if (document.querySelector("[role='dialog']")) return;
      const at = engine.current.active;
      const go = (to: number) => {
        ev.preventDefault();
        setMoved(true);
        goBay(to);
      };
      if (ev.key === "ArrowRight" || ev.key === "PageDown") go(at + 1);
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") go(at - 1);
      else if (ev.key === "Home") {
        ev.preventDefault();
        setMoved(true);
        glide(0);
      } else if (ev.key === "End") {
        ev.preventDefault();
        setMoved(true);
        glide(engine.current.max);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [goBay, glide]);

  const goNext = useCallback(() => {
    audio.blip("click");
    router.push(next.href, { label: next.label });
  }, [router, next.href, next.label]);

  useHotkey("n", () => {
    if (!document.querySelector("[role='dialog']")) goNext();
  });

  // ---- a panel ----------------------------------------------------------------------------

  const [hoverFx] = useState(createHoverFx);
  useEffect(
    () => () => {
      hoverFx.destroy();
    },
    [hoverFx],
  );

  const onEnter = (_c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "touch" || engine.current.drag.on) return;
    const li = e.currentTarget.closest("li");
    if (!li || li.dataset.hover === "true") return;
    audio.blip("hover");
    hoverFx.enter(li, e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "touch" || engine.current.drag.on) return;
    const li = e.currentTarget.closest("li");
    // A move onto a panel counts as an enter, even if the enter itself was missed.
    if (li && li.dataset.hover !== "true") hoverFx.enter(li, e.clientX, e.clientY);
    hoverFx.move(e.clientX, e.clientY);
  };
  const onLeave = () => {
    hoverFx.leave();
  };

  const onFocus = (_c: RosterCharacter, bay: number, e: FocusEvent<HTMLAnchorElement>) => {
    if (!e.currentTarget.matches(":focus-visible")) return;
    goBay(bay);
  };

  const choose = (c: RosterCharacter, e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (chosen) return;
    audio.blip("click");
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
    move: onMove,
    leave: onLeave,
    focus: onFocus,
    choose,
  });
  useIsoLayoutEffect(() => {
    act.current = { enter: onEnter, move: onMove, leave: onLeave, focus: onFocus, choose };
  });
  const actions = useMemo<Actions>(
    () => ({
      enter: (c, e) => {
        act.current.enter(c, e);
      },
      move: (e) => {
        act.current.move(e);
      },
      leave: () => {
        act.current.leave();
      },
      focus: (c, bay, e) => {
        act.current.focus(c, bay, e);
      },
      choose: (c, e) => {
        act.current.choose(c, e);
      },
    }),
    [],
  );

  const here = BAYS[active] ? pairNames.get(BAYS[active]) : undefined;

  return (
    <section
      className={styles.wall}
      aria-label="Roster"
      data-ready={ready}
      data-moved={moved}
      data-chosen={chosen !== null}
    >
      {/* The world behind the panels: silver and blue, slanted stripes. */}
      <div className={styles.chrome} aria-hidden="true">
        <span className={styles.stripes} />
        <span className={styles.dots} />
      </div>

      <div
        ref={scroller}
        className={styles.scroller}
        role="region"
        aria-label="The ten Aspirants, scrolls sideways"
        tabIndex={0}
        data-lenis-prevent
      >
        <div ref={board} className={styles.board} style={{ "--bw": BOARD_W } as CSSProperties}>
          {/* A huge word behind the panels, drifting slower than they do. */}
          <div className={styles.ghost} aria-hidden="true">
            <span>ASPIRANTS</span>
          </div>

          {/* The blue plate at the end of the row. */}
          <div
            className={styles.end}
            data-active={active === BAYS.length}
            style={{ "--e0": END.x0, "--e1": END.x1, "--e2": END.x2 } as CSSProperties}
          >
            <span className={styles.endRim} aria-hidden="true" />
            <div className={styles.endBody}>
              <p className={`${styles.endKicker} hud-label`}>
                <StarGlyph className={styles.star} />
                05 / Next
              </p>
              <h2 className={styles.endTitle}>The collection</h2>
              <p className={styles.endLead}>Every film, song, comic and drawing, in one archive.</p>
              <button
                type="button"
                className={styles.bigRibbon}
                tabIndex={-1}
                aria-hidden="true"
                onClick={goNext}
              >
                <span>Enter</span>
                <svg viewBox="0 0 28 14" width="30" height="15" focusable="false">
                  <path d="M0 5h16V0l12 7-12 7V9H0z" fill="currentColor" />
                </svg>
                <span className={styles.badge}>
                  <StarGlyph />
                </span>
              </button>
            </div>
          </div>

          <ul className={styles.panels}>
            {entries.map(({ slot, character, bay }, i) => (
              <PanelView
                key={slot.slug}
                slot={slot}
                character={character}
                bay={bay}
                index={i}
                chosen={chosen === slot.slug}
                actions={actions}
              />
            ))}
          </ul>

          {/* The newest pair, at the front: a crimson plate with the logo, a pink trim along its
              slant. */}
          <div className={styles.hero}>
            <div className={styles.plate}>
              <div className={styles.plateText}>
                <p className={styles.logoWrap}>
                  <AspirantLogo className={styles.logo} decorative />
                </p>
                <p className={`${styles.kicker} hud-label`}>
                  <StarGlyph className={styles.star} />
                  04 / Roster
                </p>
                <h1 className={styles.title}>
                  <span className={styles.line}>
                    <ScatterText text="Meet" className={styles.titleText} radius={90} />
                  </span>{" "}
                  <span className={styles.line}>
                    <ScatterText text="the ten" className={styles.titleText} radius={90} />
                  </span>
                </h1>
                <dl className={styles.readout}>
                  <div>
                    <dt>Aspirants</dt>
                    <dd>{pad(count)}</dd>
                  </div>
                  <div>
                    <dt>Pairs</dt>
                    <dd>{pad(pairs.length)}</dd>
                  </div>
                  <div>
                    <dt>Voices</dt>
                    <dd>{voiceLines}</dd>
                  </div>
                </dl>
                <span className={styles.emblem} aria-hidden="true">
                  <StarGlyph />
                </span>
              </div>
            </div>
            <span className={styles.trim} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* The HUD over the wall. */}
      <div className={styles.hud}>
        <p className={`${styles.where} hud-label`} aria-hidden="true">
          <span key={active} className={styles.whereValue}>
            {active < BAYS.length ? `Pair ${pad(active + 1)}` : "End"}
          </span>
          <span> / {pad(BAYS.length)}</span>
          <span className={styles.whereName}>{here ? here.names : ""}</span>
        </p>

        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Position in the roster"
          aria-valuemin={1}
          aria-valuemax={BAYS.length}
          aria-valuenow={Math.min(active + 1, BAYS.length)}
          aria-valuetext={here ? here.names : "The collection"}
        >
          <span ref={fill} className={styles.railFill} />
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous"
            disabled={active === 0}
            onClick={() => {
              audio.blip("click");
              goBay(engine.current.active - 1);
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
              goBay(engine.current.active + 1);
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
        {here ? `${here.names}, pair ${active + 1} of ${BAYS.length}.` : ""}
      </p>
    </section>
  );
}
