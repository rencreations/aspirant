"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { prefersReducedMotion } from "@/lib/hooks";

export interface MagneticProps {
  children: ReactNode;
  /** Fraction of the pointer offset to follow. Default 0.3. */
  strength?: number;
  /** Maximum travel in px. Default 14. */
  max?: number;
  /** Wrapper element. Default "span". */
  as?: keyof HTMLElementTagNameMap;
  className?: string;
}

/**
 * Magnetic hover: the content leans toward a mouse or pen pointer and springs back on leave.
 * Wrap any button or link (the wrapper is not focusable). No effect on touch or under reduced
 * motion. Pure transforms, no re-renders.
 */
export function Magnetic({ children, strength = 0.3, max = 14, as, className }: MagneticProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "span") as "span";
  const ref = useRef<HTMLElement>(null);

  const move = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const dx = Math.max(-max, Math.min(max, (e.clientX - (r.left + r.width / 2)) * strength));
    const dy = Math.max(-max, Math.min(max, (e.clientY - (r.top + r.height / 2)) * strength));
    el.style.transition = "transform 120ms linear";
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  };

  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform var(--dur-slower) var(--ease-spring)";
    el.style.transform = "translate3d(0, 0, 0)";
  };

  return (
    <Tag
      ref={ref}
      className={cn("inline-block", className)}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {children}
    </Tag>
  );
}
