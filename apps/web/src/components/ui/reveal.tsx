"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import styles from "./reveal.module.css";

export interface RevealProps {
  children: ReactNode;
  /** Element to render. Default "div". */
  as?: keyof HTMLElementTagNameMap;
  /** "fade-up" (default), "fade", "mask-up" (rises from a mask), "scale" or "clip" (wipe down). */
  variant?: "fade-up" | "fade" | "mask-up" | "scale" | "clip";
  /** Delay in milliseconds (use for simple staggers). */
  delay?: number;
  /** Reveal once (default) or hide again when it leaves the screen. */
  once?: boolean;
  className?: string;
}

const VARIANT_CLASS = {
  "fade-up": styles.fadeUp,
  fade: styles.fade,
  "mask-up": styles.maskUp,
  scale: styles.scale,
  clip: styles.clip,
} as const;

/**
 * Reveal content as it scrolls into view (IntersectionObserver, CSS transitions, no
 * per-frame JS). Content is visible without JS, to crawlers and under reduced motion.
 *
 * <Reveal variant="mask-up" delay={120}><h2>The Cycle</h2></Reveal>
 */
export function Reveal({
  children,
  as,
  variant = "fade-up",
  delay = 0,
  once = true,
  className,
}: RevealProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "div") as "span";
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        if (visible) {
          el.dataset.revealed = "true";
          if (once) observer.disconnect();
        } else if (!once) {
          el.dataset.revealed = "false";
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const style = { "--rv-delay": `${delay}ms` } as CSSProperties;

  return (
    <Tag
      ref={ref}
      data-revealed="false"
      className={cn(styles.reveal, VARIANT_CLASS[variant], className)}
      style={style}
    >
      {variant === "mask-up" ? <div className={styles.inner}>{children}</div> : children}
    </Tag>
  );
}
