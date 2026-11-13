"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import type { StageChibi, StagePanel } from "../types";
import styles from "./stage.module.css";

/** Where a part stands, in percent of the stage: its left and top, its width and height, and its turn in degrees. */
export interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

/** A function that turns a box in the pixels of a drawing `w` by `h` into a `Place`. */
export function drawing(w: number, h: number) {
  return (x: number, y: number, pw: number, ph: number, r = 0): Place => ({
    x: (x / w) * 100,
    y: (y / h) * 100,
    w: (pw / w) * 100,
    h: (ph / h) * 100,
    r,
  });
}

interface StageApi {
  /** A burst of sparks at a point of the screen. */
  burst: (clientX: number, clientY: number) => void;
}

const StageContext = createContext<StageApi>({ burst: () => undefined });

const SPARK_COUNT = 9;

/**
 * A burst of sparks at a point of the screen, drawn in `layer` (which sits over `area`). Each spark
 * is a small star that flies out, turns and fades, on the compositor.
 */
export function sparkBurst(
  layer: HTMLElement,
  area: DOMRect,
  clientX: number,
  clientY: number,
  count = SPARK_COUNT,
): void {
  const reach = area.width * 0.07;
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("span");
    spark.className = styles.spark ?? "";
    spark.style.left = `${clientX - area.left}px`;
    spark.style.top = `${clientY - area.top}px`;
    layer.appendChild(spark);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const far = reach * (0.7 + Math.random() * 0.9);
    const turn = (Math.random() - 0.5) * 240;
    const anim = spark.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * far}px), calc(-50% + ${Math.sin(angle) * far}px)) scale(1) rotate(${turn}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * far * 1.25}px), calc(-50% + ${Math.sin(angle) * far * 1.25}px)) scale(0.1) rotate(${turn * 1.4}deg)`,
          opacity: 0,
        },
      ],
      { duration: 620 + Math.random() * 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    anim.onfinish = () => {
      spark.remove();
    };
  }
}

interface StageProps {
  /** The stage's own colours: `--spark` (a list of two or three colours, as `a, b, c`) and any other variable the composition uses. */
  vars?: CSSProperties;
  /** Wide and narrow shape of the stage, as a CSS ratio. */
  ratio?: { wide: string; narrow: string };
  className?: string;
  label: string;
  children: ReactNode;
}

/**
 * A composition made of live parts. It is drawn on a fixed shape (wide, or a taller one on a narrow
 * screen) and everything in it is placed in percent of it and sized in `cqw`, so it scales with the
 * screen. The parts come in one after the other when it reaches the screen, drift on their own while
 * it is there, follow the pointer by their depth, rise under it, and pop with a burst of sparks when
 * pressed. Only transform properties and opacity are written.
 */
export function Stage({ vars, ratio, className, label, children }: StageProps) {
  const root = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  // The parts come in when the stage reaches the screen, once.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.in = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.in = "true";
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  // The pointer, from -1 to 1 across the stage, one frame at a time, on the stage only.
  const onMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    pointer.current = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      el.style.setProperty("--px", pointer.current.x.toFixed(3));
      el.style.setProperty("--py", pointer.current.y.toFixed(3));
    });
  }, []);
  const onLeave = useCallback(() => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  }, []);
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const burst = useCallback((clientX: number, clientY: number) => {
    const layer = fx.current;
    const el = root.current;
    if (layer && el) sparkBurst(layer, el.getBoundingClientRect(), clientX, clientY);
  }, []);

  const api = useMemo(() => ({ burst }), [burst]);
  const style = {
    "--ar-wide": ratio?.wide ?? "1280 / 595",
    "--ar-narrow": ratio?.narrow ?? "4 / 5",
    ...vars,
  } as CSSProperties;

  return (
    <StageContext.Provider value={api}>
      <div
        ref={root}
        className={[styles.stage, className].filter(Boolean).join(" ")}
        style={style}
        role="group"
        data-stage="true"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {children}
        <div ref={fx} className={styles.fx} aria-hidden="true" />
      </div>
    </StageContext.Provider>
  );
}

interface PartProps {
  /** A name, for tests and for the transition. */
  id: string;
  /** The order the parts come in. */
  order: number;
  wide: Place;
  /** Where it stands on a narrow screen. Left out, it is not shown there. */
  narrow?: Place;
  /** How far it moves with the pointer: negative is behind, positive in front. */
  depth?: number;
  /** How far it drifts on its own, in px, how long a drift takes, and where in it the part starts. */
  amp?: number;
  dur?: number;
  delay?: number;
  z?: number;
  /** A part that is only there to look at: nothing happens when it is pressed. */
  still?: boolean;
  className?: string;
  children: ReactNode;
}

const pct = (v: number) => `${v.toFixed(3)}%`;

/** One piece of a composition. */
export function Part({
  id,
  order,
  wide,
  narrow,
  depth = 0,
  amp = 6,
  dur = 7,
  delay = 0,
  z = 1,
  still = false,
  className,
  children,
}: PartProps) {
  const { burst } = useContext(StageContext);
  const inner = useRef<HTMLDivElement>(null);
  const style = {
    "--x": pct(wide.x),
    "--y": pct(wide.y),
    "--w": pct(wide.w),
    "--h": pct(wide.h),
    "--r": `${wide.r ?? 0}deg`,
    ...(narrow
      ? {
          "--nx": pct(narrow.x),
          "--ny": pct(narrow.y),
          "--nw": pct(narrow.w),
          "--nh": pct(narrow.h),
          "--nr": `${narrow.r ?? 0}deg`,
        }
      : {}),
    "--i": order,
    "--d": depth,
    "--amp": `${amp}px`,
    "--dur": `${dur}s`,
    "--delay": `${delay}s`,
    zIndex: z,
  } as CSSProperties;

  const press = (e: React.MouseEvent) => {
    const el = inner.current;
    if (!el) return;
    audio.blip("click");
    burst(e.clientX, e.clientY);
    el.removeAttribute("data-pop");
    // Read a layout value so the animation starts again when the part is pressed twice.
    void el.offsetWidth;
    el.setAttribute("data-pop", "true");
  };

  return (
    <div
      className={[styles.part, className].filter(Boolean).join(" ")}
      data-part={id}
      data-narrow={narrow ? "show" : "hide"}
      data-still={still ? "true" : undefined}
      style={style}
    >
      <div className={styles.depth}>
        <div
          ref={inner}
          className={styles.inner}
          onPointerEnter={(e) => {
            if (!still && e.pointerType === "mouse") audio.blip("hover");
          }}
          onClick={still ? undefined : press}
          onAnimationEnd={(e) => {
            if (e.animationName.includes("pop")) e.currentTarget.removeAttribute("data-pop");
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** A panel of a comic, in its frame. The frame takes the colours of the stage. */
export function PanelArt({
  panel,
  alt = "",
  position = "50% 50%",
  eager = false,
}: {
  panel: StagePanel;
  alt?: string;
  /** Which part of the cut shows when the frame has another shape. */
  position?: string;
  eager?: boolean;
}) {
  return (
    <span className={styles.frame} style={{ background: panel.c }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={libUrl(panel.p)}
        srcSet={`${libUrl(panel.p)} 720w, ${libUrl(panel.f)} 1280w`}
        sizes="(min-width: 58rem) 28vw, 70vw"
        alt={alt}
        draggable={false}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        style={{ objectPosition: position }}
      />
    </span>
  );
}

/** A chibi sticker. Its ground is see-through and its white edge is in the file. */
export function Chibi({ chibi, alt = "" }: { chibi: StageChibi; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.chibi}
      src={libUrl(chibi.src)}
      width={chibi.w}
      height={chibi.h}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}
