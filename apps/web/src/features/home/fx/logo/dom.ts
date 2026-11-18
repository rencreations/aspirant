/**
 * The two places the logo actor meets the DOM, both for a section to call (the actor itself never
 * reads the page): where the bar's logo is, and whether the bar shows it.
 */
import { useNavLock } from "@/lib/nav-lock";

import { navTargetFor, sameNavTarget, type NavTarget } from "./math";

/** The bar's logo: the vector inside the brand link of the top bar. */
const NAV_LOGO = 'header[data-overlay="nav"] [data-logo-host] svg';

/**
 * Where the bar's logo really is, in the stage frame, as the browser snaps it to device pixels.
 * Read it when the home starts, on every resize and when the bar changes (a `ResizeObserver` on the
 * header). `vw` and `vh` are the stage's size (`ctx.viewport()`). Null when the bar is not there,
 * and the section keeps the last target it had.
 */
export function readNavTarget(vw: number, vh: number): NavTarget | null {
  const svg = document.querySelector<SVGSVGElement>(NAV_LOGO);
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return navTargetFor(
    { left: r.left, top: r.top, width: r.width, height: r.height },
    window.devicePixelRatio || 1,
    vw,
    vh,
  );
}

/**
 * Show or hide the bar's own logo (`useNavLock.hideLogo`). Writes only when it changes, so a
 * section may call it every frame. The hide has no fade on purpose: the swap with the actor happens
 * in one frame.
 */
export function showNavLogo(shown: boolean): void {
  const hidden = !shown;
  if (useNavLock.getState().hideLogo !== hidden) useNavLock.setState({ hideLogo: hidden });
}

/**
 * The bar's logo target, kept up to date for a section that asks for it every frame. It re-reads
 * the page only when the bar's box, the window or the pixel ratio changed (a `ResizeObserver` and
 * the window's `resize`), so a frame that asks costs a comparison and allocates nothing. Make one
 * when the section mounts, call `dispose` when it goes.
 */
export class NavTargetWatch {
  private target: NavTarget | null = null;
  private stale = true;
  private vw = 0;
  private vh = 0;
  private dpr = 0;
  private readonly observer: ResizeObserver | null;
  private readonly onResize = (): void => {
    this.stale = true;
  };

  constructor() {
    const mark = this.onResize;
    this.observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(mark);
    const header = document.querySelector('header[data-overlay="nav"]');
    const svg = document.querySelector(NAV_LOGO);
    if (header) this.observer?.observe(header);
    if (svg) this.observer?.observe(svg);
    window.addEventListener("resize", mark);
  }

  /** The target for a stage of `vw` by `vh`, or the last good one (null before the first). */
  get(vw: number, vh: number): NavTarget | null {
    const dpr = window.devicePixelRatio || 1;
    if (this.stale || vw !== this.vw || vh !== this.vh || dpr !== this.dpr) {
      const next = readNavTarget(vw, vh);
      this.vw = vw;
      this.vh = vh;
      this.dpr = dpr;
      // A bar that is not there yet keeps the last target and is asked again next frame.
      this.stale = next === null;
      if (next && !sameNavTarget(this.target, next)) this.target = next;
    }
    return this.target;
  }

  dispose(): void {
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onResize);
  }
}
