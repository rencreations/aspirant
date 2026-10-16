import { useEffect, type RefObject } from "react";

/** Furthest the button travels toward the pointer, in CSS pixels. */
const MAX_SHIFT = 18;

/**
 * Pulls `targetRef` toward a mouse pointer that comes near its parent (the untransformed
 * button). Touch and reduced motion skip it.
 */
export function useMagnet(
  surfaceRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const surface = surfaceRef.current;
    const target = targetRef.current;
    if (!enabled || !surface || !target) return;
    const anchor = target.parentElement ?? target;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = anchor.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const radius = Math.max(r.width, r.height) * 0.55 + 50;
      const d = Math.hypot(dx, dy);
      const pull = d < radius ? 0.22 * Math.min(1, (radius - d) / (radius * 0.35)) : 0;
      const k = pull ? Math.min(1, MAX_SHIFT / Math.max(1, d * pull)) * pull : 0;
      target.style.transform = k ? `translate3d(${dx * k}px, ${dy * k}px, 0)` : "";
    };
    const reset = () => {
      target.style.transform = "";
    };
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", reset);
    return () => {
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [enabled, surfaceRef, targetRef]);
}
