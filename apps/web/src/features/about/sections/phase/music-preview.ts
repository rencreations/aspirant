"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** A preview shows the first seconds of its film again and again, so it never streams the whole. */
export const PREVIEW_SECONDS = 24;

/** Where a preview goes back to its start: the end of its window, or of a film shorter than it. */
export function loopsAt(time: number, duration: number, window = PREVIEW_SECONDS): boolean {
  const end =
    Number.isFinite(duration) && duration > 0 ? Math.min(window, duration - 0.25) : window;
  return time >= end;
}

/** Is the site's player open? It is a modal dialog placed straight in the body. */
function playerOpen(): boolean {
  for (const child of document.body.children)
    if (child.getAttribute("role") === "dialog" && child.getAttribute("aria-modal") === "true")
      return true;
  return false;
}

/**
 * A film of the page as a small preview that plays by itself: muted, in a loop, with no controls.
 * It has sound nowhere but in the site's player.
 *
 * - The film's file is given to the `<video>` only when its part is near the screen, and taken
 *   away again when the part is far, so the page never holds many open streams.
 * - It plays only while it is on screen, the tab is visible, the site's player is closed and
 *   `hold` is false. Otherwise it is paused.
 * - Its still stays under it until the first frame has really been drawn: the hook returns true
 *   from then on, and the stylesheet shows the video.
 *
 * `box` is a plain box that never moves, which is what is watched.
 */
export function usePreview(
  video: RefObject<HTMLVideoElement | null>,
  box: RefObject<HTMLElement | null>,
  src: string,
  hold = false,
): boolean {
  const [drawn, setDrawn] = useState(false);
  const held = useRef(hold);
  const again = useRef<() => void>(() => undefined);

  // The hold changes without the film being given again.
  useEffect(() => {
    held.current = hold;
    again.current();
  }, [hold]);

  useEffect(() => {
    const el = video.current;
    const target = box.current;
    if (!el || !target || typeof IntersectionObserver === "undefined") return;
    // The attribute, which a rendered `muted` does not write: a browser lets a film start by itself
    // only when it is muted from the start.
    el.setAttribute("muted", "");

    let near = false;
    let seen = false;
    let given = false;

    const decide = () => {
      if (near && !given) {
        given = true;
        el.preload = "auto";
        el.src = src;
      } else if (!near && given) {
        given = false;
        el.pause();
        el.removeAttribute("src");
        el.load();
        setDrawn(false);
      }
      if (!given) return;
      const go = seen && !held.current && document.visibilityState === "visible" && !playerOpen();
      if (go && el.paused) void el.play().catch(() => undefined);
      else if (!go && !el.paused) el.pause();
    };

    again.current = decide;

    const onTime = () => {
      if (el.currentTime > 0.05) setDrawn(true);
      if (loopsAt(el.currentTime, el.duration)) el.currentTime = 0;
    };

    const nearby = new IntersectionObserver(
      ([entry]) => {
        near = entry?.isIntersecting ?? false;
        decide();
      },
      { rootMargin: "80% 0px 80% 0px" },
    );
    const onScreen = new IntersectionObserver(
      ([entry]) => {
        seen = entry?.isIntersecting ?? false;
        decide();
      },
      { threshold: 0.15 },
    );
    // The site's player is added to the body and removed from it: that is all that is watched.
    const body = new MutationObserver(decide);
    nearby.observe(target);
    onScreen.observe(target);
    body.observe(document.body, { childList: true });
    document.addEventListener("visibilitychange", decide);
    el.addEventListener("timeupdate", onTime);
    return () => {
      nearby.disconnect();
      onScreen.disconnect();
      body.disconnect();
      document.removeEventListener("visibilitychange", decide);
      el.removeEventListener("timeupdate", onTime);
      again.current = () => undefined;
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [video, box, src]);

  return drawn;
}
