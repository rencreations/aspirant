"use client";

import { useEffect, useState } from "react";

/**
 * Rough device capability tier for heavy effects (post-processing, particle counts).
 *   high: desktop class GPU and CPU
 *   mid:  recent phones, small laptops
 *   low:  old or throttled devices, or the visitor asked for reduced motion
 */
export type DeviceTier = "low" | "mid" | "high";

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean };
  connection?: { saveData?: boolean };
};

/** Static guess from hardware hints. Safe on the server (returns "mid"). @public */
export function guessDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "mid";
  const nav = navigator as NavigatorHints;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 8;
  const mobile =
    nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  if (nav.connection?.saveData) return "low";
  if (cores <= 2 || memory <= 2) return "low";
  if (mobile || cores <= 4 || memory <= 4) return "mid";
  return "high";
}

/** Measure the frame rate for `ms` milliseconds. Resolves to frames per second. @public */
export function probeFps(ms = 600): Promise<number> {
  if (typeof window === "undefined") return Promise.resolve(60);
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (now - start));
    };
    requestAnimationFrame(tick);
  });
}

let cachedTier: DeviceTier | null = null;
let pendingTier: Promise<DeviceTier> | null = null;

/** Static guess refined once per session by a short FPS probe (low if under 40 fps). @public */
export function detectDeviceTier(): Promise<DeviceTier> {
  if (cachedTier) return Promise.resolve(cachedTier);
  pendingTier ??= probeFps().then((fps) => {
    let tier = guessDeviceTier();
    if (fps < 40) tier = "low";
    else if (fps < 52 && tier === "high") tier = "mid";
    cachedTier = tier;
    return tier;
  });
  return pendingTier;
}

/** Device tier as state: starts with the static guess, then the probed value. */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("mid");
  useEffect(() => {
    let alive = true;
    void detectDeviceTier().then((t) => {
      if (alive) setTier(t);
    });
    return () => {
      alive = false;
    };
  }, []);
  return tier;
}
