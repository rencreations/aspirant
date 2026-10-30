import { prefersReducedMotion } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";

/**
 * Whether the intro plays, and how. Kept apart from the renderer so the loading list can ask
 * without carrying it.
 *
 *   off    reduced motion, no WebGL, or `?intro=off`: the finished page shows at once
 *   light  the lite performance level: splash art only, no clips
 *   full   everything
 */
export type IntroMode = "off" | "light" | "full";

let webgl: boolean | null = null;

function hasWebGL2(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    webgl = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

export function introMode(): IntroMode {
  if (typeof window === "undefined") return "off";
  if (new URLSearchParams(window.location.search).get("intro") === "off") return "off";
  try {
    // The end to end specs turn the opening off so it never covers the page they drive.
    if (window.sessionStorage.getItem("aspirants:intro") === "off") return "off";
  } catch {
    // No storage: carry on.
  }
  if (prefersReducedMotion()) return "off";
  if (!hasWebGL2()) return "off";
  return perfLevel() === "lite" ? "light" : "full";
}
