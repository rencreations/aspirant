"use client";

import { useSyncExternalStore } from "react";

import { useDeviceTier, type DeviceTier } from "@/lib/device";
import { useReducedMotion } from "@/lib/hooks";

let webglCache: boolean | null = null;

/**
 * True when the browser can create a WebGL context (WebGL 2 or 1). Checked once and cached.
 * Returns false on the server.
 */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglCache = ctx !== null;
    // Release the probe context straight away.
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

const noopSubscribe = () => () => undefined;

/** @public */
export interface GLReadyState {
  /** WebGL is available. Null during SSR and the first client render. */
  supported: boolean | null;
  /** Device capability tier (static guess refined by an FPS probe). */
  tier: DeviceTier;
  /** The visitor or OS asked for reduced motion. */
  reduced: boolean;
  /** Safe to mount a WebGL scene: supported and not reduced motion. */
  ready: boolean;
}

/**
 * Everything a page needs to decide between a WebGL scene and its static fallback.
 *
 * const { ready, tier } = useGLReady();
 * return ready ? <Scene quality={tier} /> : <StaticArt />;
 * @public
 */
export function useGLReady(): GLReadyState {
  const supported = useSyncExternalStore<boolean | null>(noopSubscribe, hasWebGL, () => null);
  const tier = useDeviceTier();
  const reduced = useReducedMotion();
  return { supported, tier, reduced, ready: supported === true && !reduced };
}
