import { useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_QUERY) : null;
  mq?.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  return () => {
    mq?.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function readReducedMotion() {
  const media = typeof window.matchMedia === "function" && window.matchMedia(REDUCED_QUERY).matches;
  return media || document.documentElement.dataset.motion === "reduced";
}

/** True for prefers-reduced-motion or the site's own html[data-motion="reduced"] switch. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, readReducedMotion, () => false);
}

let webglSupport: boolean | undefined;

function probeWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      webglSupport = gl !== null;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const subscribeNever = () => () => undefined;

/** Whether WebGL is available. Null during server render and hydration. */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(subscribeNever, probeWebGL, () => null);
}
