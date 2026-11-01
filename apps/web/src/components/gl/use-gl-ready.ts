"use client";

import { useSyncExternalStore } from "react";

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
  /** Safe to mount a WebGL scene: WebGL is available. */
  ready: boolean;
}

/**
 * Everything a page needs to decide between a WebGL scene and its static fallback.
 *
 * const { ready } = useGLReady();
 * return ready ? <Scene /> : <StaticArt />;
 * @public
 */
export function useGLReady(): GLReadyState {
  const supported = useSyncExternalStore<boolean | null>(noopSubscribe, hasWebGL, () => null);
  return { supported, ready: supported === true };
}
