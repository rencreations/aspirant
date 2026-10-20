"use client";

import { useEffect, useId, useRef } from "react";

import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";

import { LogoLayers } from "./logo-art";
import { LOGO_H, LOGO_W } from "./logo-geometry";
import { ambientLoop, clickPop, hoverIn, hoverOut, queryLogoParts } from "./logo-motion";

export interface AspirantLogoProps {
  className?: string;
  /**
   * `static` draws the logo. `interactive` adds a light mascot loop plus hover and click
   * animations on the nearest `[data-logo-host]` ancestor (or on the logo itself).
   */
  variant?: "static" | "interactive";
  /** Hide the logo from assistive technology when a nearby label already names it. */
  decorative?: boolean;
}

/**
 * The Aspirant logo as an animatable SVG. Use it wherever the logo appears.
 *
 * <AspirantLogo className="h-9 w-auto" variant="interactive" />
 */
export function AspirantLogo({
  className,
  variant = "static",
  decorative = false,
}: AspirantLogoProps) {
  const uid = `logo${useId().replace(/[^a-z0-9]/gi, "")}`;
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || variant !== "interactive") return;
    const parts = queryLogoParts(svg);
    const host = svg.closest<HTMLElement>("[data-logo-host]") ?? svg;
    // The flourish moves SVG attributes, so it only runs on a device that can spare it.
    const still = () => prefersReducedMotion() || perfLevel() !== "full";
    let stopAmbient = still() ? () => undefined : ambientLoop(parts);
    const over = (e: Event) => {
      if (prefersReducedMotion()) return;
      if (e instanceof PointerEvent && e.pointerType === "touch") return;
      hoverIn(parts);
    };
    const out = () => {
      hoverOut(parts);
    };
    const click = () => {
      audio.blip("star");
      if (!prefersReducedMotion()) clickPop(parts);
    };
    host.addEventListener("pointerenter", over);
    host.addEventListener("focusin", over);
    host.addEventListener("pointerleave", out);
    host.addEventListener("focusout", out);
    host.addEventListener("click", click);
    const onVisibility = () => {
      stopAmbient();
      stopAmbient = document.hidden || still() ? () => undefined : ambientLoop(parts);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      host.removeEventListener("pointerenter", over);
      host.removeEventListener("focusin", over);
      host.removeEventListener("pointerleave", out);
      host.removeEventListener("focusout", out);
      host.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", onVisibility);
      stopAmbient();
    };
  }, [variant]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "The Aspirants"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <LogoLayers uid={uid} />
    </svg>
  );
}
