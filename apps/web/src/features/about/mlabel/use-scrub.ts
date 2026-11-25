"use client";

import { useEffect, type RefObject } from "react";

import { isScene, SCENES } from "./scenes";
import { follow, keyframes, PASS_MS, passOf, restOf, timeAt, travelled } from "./scrub";

/** Below this width the parts take their phone layout, and some moves are shorter. */
const NARROW = 720;

interface Live {
  readonly root: HTMLElement;
  readonly span: number;
  /** The point of the pass that is drawn, in screens. It follows `target` on a short spring. */
  shown: number;
  target: number;
  readonly anims: readonly Animation[];
}

/**
 * Draws TheMLabel's content by the scroll. Every `[data-scene]` inside the host is a part; its
 * moving elements get one paused Web Animation each (`scenes.ts`), and the clock of all of them is
 * set from how far the part has travelled up the screen. The drawn point follows the scroll on a
 * short spring, so a jump or a hard flick plays the moves through quickly instead of cutting to
 * the end, and a scroll back up plays them back.
 *
 * Per frame it reads the parts' boxes first and then sets the clocks: no layout is forced, and
 * nothing is written to the page's root. It runs only while the content is near the screen and
 * something is still moving.
 */
export function useScrub(host: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const roots = Array.from(el.querySelectorAll<HTMLElement>("[data-scene]"));
    let parts: Live[] = [];
    let raf = 0;
    let rebuildRaf = 0;
    let last = 0;
    let near = false;
    let width = window.innerWidth;

    const build = () => {
      const screen = window.innerHeight;
      const narrow = window.innerWidth < NARROW;
      // Every box is read before any animation is made.
      const heights = roots.map((root) => root.getBoundingClientRect().height);
      const before = new Map(parts.map((p) => [p.root, p.shown]));
      for (const p of parts) for (const a of p.anims) a.cancel();
      parts = [];
      roots.forEach((root, i) => {
        const name = root.dataset.scene;
        if (!isScene(name)) return;
        const height = heights[i] ?? 0;
        const span = passOf(height, screen);
        const tracks = SCENES[name]({ root, span, len: height / screen, narrow });
        const shown = before.get(root) ?? -0.02;
        const at = timeAt(Math.max(0, shown), span);
        const anims = tracks.map(({ el: target, keys }) => {
          const anim = target.animate(keyframes(keys, span), {
            duration: PASS_MS,
            fill: "both",
            easing: "linear",
          });
          anim.pause();
          anim.currentTime = at;
          return anim;
        });
        parts.push({ root, span, shown, target: shown, anims });
      });
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const screen = window.innerHeight;
      for (const p of parts) p.target = travelled(p.root.getBoundingClientRect().top, screen);
      let moving = false;
      for (const p of parts) {
        const next = follow(p.shown, p.target, p.span, dt);
        if (next !== p.shown) {
          p.shown = next;
          const t = timeAt(next, p.span);
          for (const a of p.anims) a.currentTime = t;
        }
        if (next !== restOf(p.target, p.span)) moving = true;
      }
      if (moving && near) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf && near) raf = requestAnimationFrame(frame);
    };

    const rebuild = () => {
      if (rebuildRaf) return;
      rebuildRaf = requestAnimationFrame(() => {
        rebuildRaf = 0;
        build();
        wake();
      });
    };

    build();

    // Work only while the content is within a screen of being seen.
    const io = new IntersectionObserver(
      (entries) => {
        near = entries.some((entry) => entry.isIntersecting);
        if (near) wake();
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    io.observe(el);
    // A part whose height changes (the fonts arrive, the screen turns) is measured again.
    const ro = new ResizeObserver(rebuild);
    for (const root of roots) ro.observe(root);

    // A phone's address bar changes the height of the screen as the page scrolls: that only moves
    // the drawn point (read each frame), so the moves are made again only for a new width.
    const onResize = () => {
      if (window.innerWidth === width) {
        wake();
        return;
      }
      width = window.innerWidth;
      rebuild();
    };

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rebuildRaf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      for (const p of parts) for (const a of p.anims) a.cancel();
    };
  }, [host]);
}
