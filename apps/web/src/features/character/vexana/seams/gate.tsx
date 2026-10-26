"use client";

import gsap from "gsap";
import { useEffect, useRef, type ComponentType, type ReactNode, type RefAttributes } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { perfLevel, type PerfLevel } from "@/lib/perf";

import styles from "./gate.module.css";
import { boundary, toneHint, type Dir } from "./gates";
import { Hold, useHold, useHoldProgress } from "./hold";
import { useScrollSnap } from "./snap";

/** What a scene is given when the transition starts. All times are in seconds on its timeline. */
interface SceneCtx {
  tl: gsap.core.Timeline;
  /** The box the held section sits in. A scene may move it before the swap. */
  held: HTMLElement | null;
  /** A layer behind the held section: it shows where the section has moved away. */
  backdrop: HTMLElement | null;
  level: PerfLevel;
  vw: number;
  vh: number;
  /** Which way the page is crossing the boundary (the scene may play the same way both times). */
  dir: Dir;
  /** The moment the screen is fully covered: the page jumps to the other section there. */
  swapAt: (t: number) => void;
  /** What the corner of the screen is on from `t` (the nav text follows it). Null: the page. */
  hint: (t: number, tone: "light" | "dark" | null) => void;
  /** The transform origin that is the middle of the screen, in the held section's own box. */
  pivot: () => string;
}

/** A scene draws the transition. It is mounted all the time and hidden until it plays. */
export interface SceneHandle {
  build: (ctx: SceneCtx) => void;
  reset: () => void;
}

type SceneComponent = ComponentType<RefAttributes<SceneHandle>>;

interface GateProps {
  /** The boundary this section's end belongs to (the section after it passes the same id to `UpZone`). */
  id: string;
  /** Screens of scrolling the last screen of the section is held for (the threshold is part of it). */
  hold: number;
  /** The share of the hold at which the transition starts by itself. */
  at: number;
  scene: SceneComponent;
  /** False (reduced motion): the section is shown as it is, with the next one right after it. */
  enabled?: boolean;
  children: ReactNode;
}

/** The held section stays at the screen bottom; its own scene plays from the threshold. */
const Z_ABOVE_SECTIONS = "44";

function GateOverlay({ id, at, scene: Scene }: Omit<GateProps, "hold" | "enabled" | "children">) {
  const { root, content, backdrop, range } = useHold();
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  const layer = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle>(null);
  const rangeRef = useRef(range);
  /** The gate's logic, built in the effect below. */
  const tick = useRef<(p: number) => void>(() => undefined);
  const playRef = useRef<(dir: Dir) => void>(() => undefined);

  useEffect(() => {
    lenisRef.current = lenis;
    rangeRef.current = range;
  });

  useEffect(() => {
    const r = root.current;
    const l = layer.current;
    if (!r || !l) return;
    const b = boundary(id);
    const s = { armed: true, last: 0, tl: null as gsap.core.Timeline | null };

    const finish = () => {
      l.style.visibility = "hidden";
      l.style.pointerEvents = "none";
      r.style.zIndex = "";
      scene.current?.reset();
      toneHint.set(null);
      s.tl?.kill();
      s.tl = null;
      b.busy = false;
      lenisRef.current.resume();
    };

    /** Where the page goes while the screen is covered. */
    const target = (dir: Dir): number => {
      if (dir === "down") {
        // The next section starts where the up zone in front of it ends (or where this wrapper ends).
        const up = b.up?.range();
        if (up) return up.end;
        return r.getBoundingClientRect().bottom + window.scrollY;
      }
      // Back up: the last screen of this section, with the hold below it (no threshold above it).
      const own = rangeRef.current();
      if (own) return own.start;
      const h = content.current?.offsetHeight ?? 0;
      return r.getBoundingClientRect().top + window.scrollY + Math.max(0, h - window.innerHeight);
    };

    const heldOf = (dir: Dir): { held: HTMLElement | null; back: HTMLElement | null } =>
      dir === "down"
        ? { held: content.current, back: backdrop.current }
        : { held: b.up?.held ?? null, back: b.up?.backdrop ?? null };

    const jump = (dir: Dir) => {
      lenisRef.current.scrollTo(target(dir), { immediate: true });
      const { held, back } = heldOf(dir);
      if (held) gsap.set(held, { clearProps: "transform,opacity,visibility,transformOrigin" });
      if (back) back.style.background = "";
    };

    const swap = (dir: Dir) => {
      jump(dir);
    };

    const play = (dir: Dir) => {
      const sc = scene.current;
      if (!sc || b.busy) return;
      b.busy = true;
      s.armed = false;
      lenisRef.current.pause();
      // Above the sections that follow (they have a z-index of their own), below the nav.
      r.style.zIndex = Z_ABOVE_SECTIONS;
      l.style.visibility = "visible";
      l.style.pointerEvents = "auto";
      const { held, back } = heldOf(dir);
      const tl = gsap.timeline({ paused: true, onComplete: finish });
      s.tl = tl;
      let swapTime = -1;
      const vh = window.innerHeight;
      sc.build({
        tl,
        held,
        backdrop: back,
        level: perfLevel(),
        vw: window.innerWidth,
        vh,
        dir,
        swapAt: (t) => {
          swapTime = t;
        },
        hint: (t, hintTone) => {
          tl.call(
            () => {
              toneHint.set(hintTone);
            },
            undefined,
            t,
          );
        },
        pivot: () => {
          if (!held) return "50% 50%";
          // Going down the held screen is the last one of the section (at the bottom of its box);
          // going back it is the first one of the next section (at the top).
          if (dir === "up") return `50% ${String(vh / 2)}px`;
          const h = held.offsetHeight;
          return `50% ${String(Math.max(h - vh / 2, h / 2))}px`;
        },
      });
      if (swapTime < 0) swapTime = tl.duration() * 0.5;
      tl.call(
        () => {
          swap(dir);
        },
        undefined,
        swapTime,
      );
      tl.play(0);
    };

    playRef.current = play;
    b.play = play;

    tick.current = (p) => {
      if (p < at - 0.2) s.armed = true;
      if (p >= at && p < 0.995 && p > s.last && s.armed && !b.busy) play("down");
      s.last = p;
    };

    // If the page goes while a transition plays, give the scroll back.
    return () => {
      tick.current = () => undefined;
      playRef.current = () => undefined;
      if (b.play === play) b.play = null;
      s.tl?.kill();
      if (b.busy) lenisRef.current.resume();
      b.busy = false;
      toneHint.set(null);
      r.style.zIndex = "";
    };
  }, [id, root, content, backdrop, at]);

  useHoldProgress((p) => {
    tick.current(p);
  });

  // The visitor stops scrolling in the threshold: from the half on the transition goes on by itself,
  // before it the page goes back to the start of the hold.
  useScrollSnap(`${id}:down`, () => (boundary(id).busy ? null : rangeRef.current()), {
    onSnap: (side) => {
      if (side !== "end") return false;
      playRef.current("down");
      return true;
    },
  });

  return (
    <div ref={layer} className={styles.gateLayer} aria-hidden="true">
      <Scene ref={scene} />
    </div>
  );
}

/**
 * A section whose last screen is held. The visitor scrolls on a little, and at the threshold the transition starts and finishes by itself: the held
 * section and the scene play together, the page jumps to the next section while the screen is
 * covered, and the scene opens on it. Scrolling back before the threshold takes the bar back down,
 * and a stop in the middle snaps to the nearer end. The next section carries the way back
 * (`UpZone` with the same id).
 */
export function Gate({ id, hold, at, scene, enabled = true, children }: GateProps) {
  if (!enabled) return <>{children}</>;
  return (
    <Hold hold={hold} overlay={<GateOverlay id={id} at={at} scene={scene} />}>
      {children}
    </Hold>
  );
}
