"use client";

import { useEffect, useRef } from "react";

import { STAR_PATH } from "@/components/star-glyph";

/**
 * The keyboard focus mark: a four-pointed star that lands on the top-left corner of the
 * element with :focus-visible, on top of the outline from base.css. Decorative only.
 */
export function FocusStar() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const star = ref.current;
    if (!star) return;
    let target: Element | null = null;
    let raf = 0;

    const place = () => {
      raf = 0;
      if (!target?.isConnected) {
        star.style.opacity = "0";
        return;
      }
      const r = target.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      star.style.opacity = visible ? "1" : "0";
      star.style.transform = `translate3d(${r.left - 9}px, ${r.top - 9}px, 0)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      let visible = false;
      try {
        visible = el.matches(":focus-visible");
      } catch {
        visible = false;
      }
      target = visible && el.id !== "main" ? el : null;
      schedule();
    };
    const onFocusOut = () => {
      target = null;
      schedule();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none fixed top-0 left-0 z-(--z-cursor) size-[18px] opacity-0 transition-[opacity,transform] duration-200 ease-out"
      style={{ color: "var(--focus)", filter: "drop-shadow(0 0 4px var(--bg))" }}
    >
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}
