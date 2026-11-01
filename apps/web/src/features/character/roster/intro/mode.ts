import { routeBefore } from "@/lib/route-history";

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

/** True when the visitor is coming back from one of the characters' pages (not from another page). */
function cameFromCharacterPage(): boolean {
  return (routeBefore("/character") ?? "").startsWith("/character/");
}

/**
 * Whether the intro plays. It does not when the address says `?intro=off`, when the end to end specs
 * turn it off, when the visitor came from one of the roster's own pages (`/character/selena/`), or
 * when the browser has no WebGL 2: the finished page shows at once. Kept apart from the renderer so
 * the loading list can ask without carrying it.
 */
export function introPlays(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("intro") === "off") return false;
  try {
    // The end to end specs turn the opening off so it never covers the page they drive.
    if (window.sessionStorage.getItem("aspirants:intro") === "off") return false;
  } catch {
    // No storage: carry on.
  }
  if (cameFromCharacterPage()) return false;
  return hasWebGL2();
}
