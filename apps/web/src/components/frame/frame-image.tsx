"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { asset } from "@/lib/asset";
import { prefersReducedMotion } from "@/lib/hooks";

export interface FrameImageProps {
  /** Public path (passed through asset()), for example "/img/char/layla/splash-sm.webp". */
  src: string;
  /** Describe the image; use "" only when it is purely decorative. */
  alt: string;
  /** Intrinsic width in px (prevents layout shift). */
  width: number;
  /** Intrinsic height in px. */
  height: number;
  /**
   * Parallax inside the frame while it scrolls past: true for 6 percent, or a number for a
   * custom strength in percent. Off under reduced motion.
   */
  parallax?: boolean | number;
  /** Load eagerly with high priority (above the fold). Default false (lazy). */
  priority?: boolean;
  /** Responsive `sizes` hint. */
  sizes?: string;
  /** Responsive `srcSet` (paths are passed through asset()). */
  srcSet?: string;
  /** CSS object-position, for example "50% 20%" to keep a face in view. */
  objectPosition?: string;
  className?: string;
}

/**
 * The image inside a <Frame>: fills the clipped media layer with object-fit cover and can
 * drift with the scroll (parallax) inside the shape.
 *
 * <FrameImage src="/img/char/layla/splash-sm.webp" alt="Layla" width={800} height={450} parallax />
 */
export function FrameImage({
  src,
  alt,
  width,
  height,
  parallax = false,
  priority = false,
  sizes,
  srcSet,
  objectPosition,
  className,
}: FrameImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const strength = parallax === true ? 6 : typeof parallax === "number" ? parallax : 0;

  useEffect(() => {
    const img = ref.current;
    if (!img || !strength || prefersReducedMotion()) return;
    let raf = 0;
    let listening = false;
    const update = () => {
      raf = 0;
      const host = img.parentElement ?? img;
      const r = host.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      const clamped = Math.max(-1, Math.min(1, p));
      img.style.transform = `translate3d(0, ${(-clamped * strength).toFixed(3)}%, 0) scale(${1 + (strength * 2.2) / 100})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const start = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      schedule();
    };
    const stop = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) start();
      else stop();
    });
    io.observe(img);
    return () => {
      io.disconnect();
      stop();
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  const style: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    ...(objectPosition ? { objectPosition } : {}),
    ...(strength
      ? { transform: `scale(${1 + (strength * 2.2) / 100})`, willChange: "transform" }
      : {}),
  };

  const resolvedSrcSet = srcSet
    ?.split(",")
    .map((part) => {
      const [path, descriptor] = part.trim().split(/\s+/);
      return path ? `${asset(path)}${descriptor ? ` ${descriptor}` : ""}` : "";
    })
    .filter(Boolean)
    .join(", ");

  return (
    // A plain <img>: the site is a static export with unoptimised images, and the frame
    // needs direct control over object-fit and the parallax transform.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={asset(src)}
      srcSet={resolvedSrcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={cn("select-none", className)}
      style={style}
    />
  );
}
