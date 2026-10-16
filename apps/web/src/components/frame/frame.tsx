"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { prefersReducedMotion } from "@/lib/hooks";
import { springs, springStep } from "@/lib/motion";

import styles from "./frame.module.css";
import { FRAME_CLIP_PATHS, framePath, type FrameShape } from "./frame-shapes";

interface FrameOwnProps {
  /** Silhouette. Default "chamfer". */
  shape?: FrameShape;
  /** Springy 3D tilt toward the pointer (and the finger while pressed). Default true. */
  tilt?: boolean;
  /** Maximum tilt in degrees. Default 8. */
  maxTilt?: number;
  /** Glow around the shape on hover and focus. Default true. */
  glow?: boolean;
  /** Local accent and glow colour (any CSS colour), for example a character's palette. */
  accent?: string;
  /** HUD caption under the frame, for example "UNIT 07 / TWILIGHT STAR". */
  label?: ReactNode;
  /** Class for the clipped media layer (put aspect ratios on the frame itself). */
  mediaClassName?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Props for <Frame>: own props plus the props of the element given in `as`. */
export type FrameProps = FrameOwnProps & {
  /**
   * Container element: "div" (default), "figure" (the label becomes a figcaption), "li",
   * "article" and so on. For a linked frame, wrap <Frame> in <TLink> instead.
   */
  as?: "div" | "figure" | "li" | "article" | "section" | "span";
} & Omit<HTMLAttributes<HTMLElement>, keyof FrameOwnProps | "as">;

/**
 * Custom-shaped frame for images and media. The shape clips an inner media layer (never the
 * root, so focus outlines on a linked frame stay visible); an SVG outline follows the shape
 * and draws in on hover and focus; the frame tilts toward the pointer with a spring and
 * glows. Touch: tilt follows the finger while pressed. Reduced motion: no tilt, static
 * outline. Size it from outside (width, aspect ratio) or let the image set the height.
 *
 * <Frame shape="hex" accent="#ff6ac8" label="UNIT 08 / TWILIGHT STAR" className="aspect-[7/8] w-64">
 *   <FrameImage src="/img/char/vexana/splash-sm.webp" alt="Vexana" width={800} height={450} />
 * </Frame>
 */
export function Frame({
  shape = "chamfer",
  tilt = true,
  maxTilt = 8,
  glow = true,
  accent,
  label,
  mediaClassName,
  className,
  style,
  children,
  as,
  ...rest
}: FrameProps) {
  const Tag = (as ?? "div") as "div";
  const rootRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const motion = useRef({
    rx: { x: 0, v: 0 },
    ry: { x: 0, v: 0 },
    tx: 0,
    ty: 0,
    pressed: false,
    raf: 0,
    last: 0,
  });

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      setSize((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
      );
    });
    ro.observe(el);
    const m = motion.current;
    return () => {
      ro.disconnect();
      cancelAnimationFrame(m.raf);
    };
  }, []);

  const run = () => {
    const m = motion.current;
    if (m.raf) return;
    m.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - m.last) / 1000);
      m.last = now;
      springStep(m.rx, m.tx, dt, springs.soft);
      springStep(m.ry, m.ty, dt, springs.soft);
      const el = tiltRef.current;
      if (el) {
        el.style.transform = `rotateX(${m.rx.x.toFixed(3)}deg) rotateY(${m.ry.x.toFixed(3)}deg)`;
      }
      const settled =
        Math.abs(m.rx.x - m.tx) + Math.abs(m.ry.x - m.ty) < 0.01 &&
        Math.abs(m.rx.v) + Math.abs(m.ry.v) < 0.01;
      if (settled && m.tx === 0 && m.ty === 0) {
        m.raf = 0;
        if (el) el.style.transform = "";
        return;
      }
      m.raf = requestAnimationFrame(frame);
    };
    m.raf = requestAnimationFrame(frame);
  };

  const aim = (e: PointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
    root.style.setProperty("--fx", `${(fx * 100).toFixed(1)}%`);
    root.style.setProperty("--fy", `${(fy * 100).toFixed(1)}%`);
    if (!tilt || prefersReducedMotion()) return;
    const m = motion.current;
    m.ty = (fx * 2 - 1) * maxTilt;
    m.tx = -(fy * 2 - 1) * maxTilt;
    run();
  };

  const release = () => {
    const m = motion.current;
    m.pressed = false;
    m.tx = 0;
    m.ty = 0;
    const root = rootRef.current;
    if (root) root.dataset.active = "false";
    if (m.rx.x !== 0 || m.ry.x !== 0) run();
  };

  const handlers = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch") aim(e);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "touch" && !motion.current.pressed) return;
      aim(e);
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch") return;
      motion.current.pressed = true;
      const root = rootRef.current;
      if (root) root.dataset.active = "true";
      aim(e);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "touch") release();
    },
    onPointerCancel: release,
    onPointerLeave: release,
  };

  const vars = accent ? ({ "--accent": accent, "--glow": accent } as CSSProperties) : undefined;
  const LabelTag = (as === "figure" ? "figcaption" : "span") as "span";

  return (
    <Tag
      ref={rootRef}
      className={cn(styles.frame, className)}
      style={{ ...vars, ...style }}
      data-shape={shape}
      data-glow={glow}
      data-active="false"
      {...rest}
      {...handlers}
    >
      <div ref={tiltRef} className={styles.tilt}>
        <div className={styles.glow}>
          <div
            ref={mediaRef}
            className={cn(styles.media, mediaClassName)}
            style={{ clipPath: FRAME_CLIP_PATHS[shape] }}
          >
            {children}
            <span className={styles.sheen} aria-hidden="true" />
          </div>
        </div>
        {size.w > 0 && size.h > 0 && (
          <svg
            className={styles.outline}
            viewBox={`0 0 ${size.w.toFixed(2)} ${size.h.toFixed(2)}`}
            aria-hidden="true"
            focusable="false"
          >
            <path className={styles.outlineBase} d={framePath(shape, size.w, size.h)} />
            <path
              className={styles.outlineDraw}
              d={framePath(shape, size.w, size.h)}
              pathLength={1}
            />
          </svg>
        )}
        <span className={styles.tick} data-pos="tl" aria-hidden="true" />
        <span className={styles.tick} data-pos="tr" aria-hidden="true" />
        <span className={styles.tick} data-pos="bl" aria-hidden="true" />
        <span className={styles.tick} data-pos="br" aria-hidden="true" />
      </div>
      {label != null && <LabelTag className={cn(styles.label, "hud-label")}>{label}</LabelTag>}
    </Tag>
  );
}
