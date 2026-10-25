"use client";

import gsap from "gsap";
import { useEffect, useRef, type ComponentType, type ReactNode, type RefAttributes } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { perfLevel, type PerfLevel } from "@/lib/perf";

import styles from "./gate.module.css";
import { toneHint } from "./gates";
import { Hold, useHold, useHoldProgress } from "./hold";
import { put } from "./scroll-kit";

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
  /** The moment the screen is fully covered: the page jumps to the next section there. */
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
  /** The wait for the next section's media has begun (true) or ended (false). */
  loading?: (show: boolean) => void;
  /** Real progress of that wait, 0 to 1. */
  progress?: (fraction: number) => void;
}

type SceneComponent = ComponentType<RefAttributes<SceneHandle>>;

/** Something the transition must wait for before it shows the next section. */
interface GateWait {
  ready: () => boolean;
  run: (onProgress: (loaded: number, total: number) => void) => Promise<void>;
}

interface GateProps {
  /** Screens of scrolling the last screen of the section is held for (the threshold is part of it). */
  hold: number;
  /** The share of the hold at which the transition starts by itself. */
  at: number;
  /** The small line on the meter: what lies ahead. */
  label: string;
  /** The tone of the held section, for the meter. */
  tone: "light" | "dark";
  scene: SceneComponent;
  /** The next section needs something loaded first (the room). */
  wait?: GateWait;
  /** Called once when the section comes near, so the wait is usually zero. */
  warm?: () => void;
  /** False (reduced motion): the section is shown as it is, with the next one right after it. */
  enabled?: boolean;
  children: ReactNode;
}

/** The held section stays at the screen bottom; its own scene plays from the threshold. */
const Z_ABOVE_SECTIONS = "44";

function GateOverlay({
  at,
  label,
  tone,
  scene: Scene,
  wait,
  warm,
}: Omit<GateProps, "hold" | "enabled" | "children">) {
  const { root, content, backdrop } = useHold();
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  const layer = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const scene = useRef<SceneHandle>(null);
  const waitRef = useRef(wait);
  /** The gate's logic, built in the effect below, called with the progress of the hold. */
  const tick = useRef<(p: number) => void>(() => undefined);

  useEffect(() => {
    lenisRef.current = lenis;
    waitRef.current = wait;
  });

  useEffect(() => {
    if (!warm || typeof IntersectionObserver === "undefined") return;
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          warm();
          io.disconnect();
        }
      },
      { rootMargin: "200% 0px 200% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [warm, root]);

  useEffect(() => {
    const r = root.current;
    const l = layer.current;
    if (!r || !l) return;
    const s = { armed: true, busy: false, last: 0, tl: null as gsap.core.Timeline | null };

    const finish = () => {
      l.style.visibility = "hidden";
      l.style.pointerEvents = "none";
      r.style.zIndex = "";
      scene.current?.reset();
      toneHint.set(null);
      s.tl?.kill();
      s.tl = null;
      s.busy = false;
      lenisRef.current.resume();
    };

    const jump = () => {
      // The next section starts where this wrapper ends.
      const y = r.getBoundingClientRect().bottom + window.scrollY;
      lenisRef.current.scrollTo(y, { immediate: true });
      const held = content.current;
      if (held) gsap.set(held, { clearProps: "transform,opacity,visibility,transformOrigin" });
      const back = backdrop.current;
      if (back) back.style.background = "";
    };

    const swap = (tl: gsap.core.Timeline) => {
      const w = waitRef.current;
      if (w && !w.ready()) {
        tl.pause();
        scene.current?.loading?.(true);
        void w
          .run((loaded, total) => {
            scene.current?.progress?.(total > 0 ? Math.min(1, loaded / total) : 1);
          })
          .catch(() => undefined)
          .then(() => {
            scene.current?.loading?.(false);
            jump();
            tl.resume();
          });
        return;
      }
      jump();
    };

    const play = () => {
      const sc = scene.current;
      if (!sc) return;
      s.busy = true;
      s.armed = false;
      lenisRef.current.pause();
      // Above the sections that follow (they have a z-index of their own), below the nav.
      r.style.zIndex = Z_ABOVE_SECTIONS;
      l.style.visibility = "visible";
      l.style.pointerEvents = "auto";
      put(meter.current, "opacity", "0");
      const held = content.current;
      const tl = gsap.timeline({ paused: true, onComplete: finish });
      s.tl = tl;
      let swapTime = -1;
      const vh = window.innerHeight;
      sc.build({
        tl,
        held,
        backdrop: backdrop.current,
        level: perfLevel(),
        vw: window.innerWidth,
        vh,
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
          const h = held.offsetHeight;
          return `50% ${String(Math.max(h - vh / 2, h / 2))}px`;
        },
      });
      if (swapTime < 0) swapTime = tl.duration() * 0.5;
      tl.call(
        () => {
          swap(tl);
        },
        undefined,
        swapTime,
      );
      tl.play(0);
    };

    tick.current = (p) => {
      const showing = !s.busy && p > 0.035 && p < at;
      put(meter.current, "opacity", showing ? "1" : "0");
      put(bar.current, "transform", `scaleX(${Math.min(1, p / at).toFixed(3)})`);
      if (p < at - 0.2) s.armed = true;
      if (p >= at && p < 0.995 && p > s.last && s.armed && !s.busy) play();
      s.last = p;
    };

    // If the page goes while a transition plays, give the scroll back.
    return () => {
      tick.current = () => undefined;
      s.tl?.kill();
      if (s.busy) lenisRef.current.resume();
      s.busy = false;
      toneHint.set(null);
      r.style.zIndex = "";
    };
  }, [root, content, backdrop, at]);

  useHoldProgress((p) => {
    tick.current(p);
  });

  return (
    <>
      <div ref={meter} className={styles.meter} data-tone={tone} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        <span className={styles.track}>
          <span ref={bar} className={styles.bar} />
        </span>
      </div>
      <div ref={layer} className={styles.gateLayer} aria-hidden="true">
        <Scene ref={scene} />
      </div>
    </>
  );
}

/**
 * A section whose last screen is held. The visitor scrolls on a little (the meter at the bottom
 * fills), and at the threshold the transition starts and finishes by itself: the held section
 * and the scene play together, the page jumps to the next section while the screen is covered,
 * and the scene opens on it. Scrolling back before the threshold takes the meter back down.
 */
export function Gate({
  hold,
  at,
  label,
  tone,
  scene,
  wait,
  warm,
  enabled = true,
  children,
}: GateProps) {
  if (!enabled) return <>{children}</>;
  return (
    <Hold
      hold={hold}
      overlay={
        <GateOverlay at={at} label={label} tone={tone} scene={scene} wait={wait} warm={warm} />
      }
    >
      {children}
    </Hold>
  );
}
