"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import styles from "./marquee.module.css";

export interface MarqueeProps {
  children: ReactNode;
  /** Pixels per second. Default 40. */
  speed?: number;
  /** Scroll left to right instead of right to left. */
  reverse?: boolean;
  /** Pause while hovered or focused. Default true. */
  pauseOnHover?: boolean;
  /** Gap between items and between copies (any CSS length). Default "3rem". */
  gap?: string;
  /** Accessible name for the strip (rendered as a labelled group). */
  label?: string;
  className?: string;
}

/**
 * A slow, endless strip (HUD tickers, names, credits). CSS animation sized to the content,
 * paused off screen, on hover and on focus. Extra copies are aria-hidden and inert, so
 * screen readers and the Tab key meet the content once. Under reduced motion it stops and
 * wraps. Clips itself, so it never widens the page.
 *
 * <Marquee label="Archive ticker">{items}</Marquee>
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  pauseOnHover = true,
  gap = "3rem",
  label,
  className,
}: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ copies: 2, width: 0 });

  useEffect(() => {
    const root = rootRef.current;
    const copy = copyRef.current;
    if (!root || !copy) return;
    const measure = () => {
      const width = copy.offsetWidth;
      const copies = width > 0 ? Math.max(2, Math.ceil(root.offsetWidth / width) + 1) : 2;
      setLayout((prev) =>
        prev.width === width && prev.copies === copies ? prev : { copies, width },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(copy);
    const io = new IntersectionObserver(([entry]) => {
      root.dataset.paused = entry?.isIntersecting ? "false" : "true";
    });
    io.observe(root);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const style = {
    "--mq-gap": gap,
    "--mq-shift": layout.width ? `${layout.width}px` : "50%",
    "--mq-duration": `${Math.max(4, (layout.width || 800) / Math.max(1, speed))}s`,
    "--mq-direction": reverse ? "reverse" : "normal",
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn(styles.root, pauseOnHover && styles.pauseOnHover, className)}
      style={style}
      data-paused="false"
    >
      <div className={styles.track}>
        <div ref={copyRef} className={styles.copy}>
          {children}
        </div>
        {Array.from({ length: layout.copies - 1 }, (_, i) => (
          <div key={i} className={cn(styles.copy, styles.clone)} aria-hidden="true" inert>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
