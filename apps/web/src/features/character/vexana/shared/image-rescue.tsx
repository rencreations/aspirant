"use client";

import { useEffect } from "react";

import { IMAGE_RETRIES, retryDelay, retryUrl } from "./retry-url";

const failed = (img: HTMLImageElement) =>
  img.complete && img.naturalWidth === 0 && !!img.currentSrc;

/**
 * A picture that fails to load (a dropped connection, a busy host) is asked for again twice, a
 * little later each time. When it still fails it is hidden (`data-vx-failed`) instead of leaving a
 * broken-image mark, and it is tried once more when the browser says the connection is back. Mount
 * once on the long page (it renders nothing).
 */
export function ImageRescue() {
  useEffect(() => {
    const root = document.querySelector("[data-vexana]");
    if (!root) return;
    const timers = new Set<number>();
    const tries = new WeakMap<HTMLImageElement, number>();
    // The pictures given up on, kept here so nothing has to look for them by an attribute.
    const gone = new Set<HTMLImageElement>();

    const lost = (img: HTMLImageElement) => {
      const n = tries.get(img) ?? 0;
      if (n >= IMAGE_RETRIES) {
        img.setAttribute("data-vx-failed", "");
        gone.add(img);
        return;
      }
      tries.set(img, n + 1);
      const t = window.setTimeout(() => {
        timers.delete(t);
        if (!img.isConnected) return;
        img.src = retryUrl(img.getAttribute("src") ?? img.currentSrc, n + 1);
      }, retryDelay(n));
      timers.add(t);
    };

    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) lost(e.target);
    };
    const onLoad = (e: Event) => {
      if (!(e.target instanceof HTMLImageElement)) return;
      e.target.removeAttribute("data-vx-failed");
      gone.delete(e.target);
    };
    // Pictures that failed before this mounted (the page was already on screen).
    for (const img of root.querySelectorAll("img")) if (failed(img)) lost(img);

    const online = () => {
      for (const img of gone) {
        if (!img.isConnected) {
          gone.delete(img);
          continue;
        }
        tries.set(img, 0);
        img.src = retryUrl(img.getAttribute("src") ?? "", 99);
      }
    };
    root.addEventListener("error", onError, true);
    root.addEventListener("load", onLoad, true);
    window.addEventListener("online", online);
    return () => {
      root.removeEventListener("error", onError, true);
      root.removeEventListener("load", onLoad, true);
      window.removeEventListener("online", online);
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);
  return null;
}
