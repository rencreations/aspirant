"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { currentIndex, formatDuration, fractionOf, sceneFocus } from "./logic";
import type { ShownFilm } from "./types";

/**
 * Follows the page while it scrolls. One passive scroll listener, one frame at a time:
 *  - the film that holds the reading line (the rail shows it, as React state, only when it changes);
 *  - the still at the reading line of that film, which moves its scrubber's play head. The head,
 *    the fill and the readout are written straight to the elements (`transform` and text), never
 *    through React, so the scroll costs no render.
 * Films above the line sit at the end of their scrubber, films below it at the start.
 */
export function useFilmTracker(
  root: RefObject<HTMLElement | null>,
  shown: readonly ShownFilm[],
  view: string,
  ready: boolean,
): { activeId: string } {
  const [activeId, setActiveId] = useState("");
  const state = useRef({
    active: "",
    last: new Map<string, string>(),
    index: new Map<string, number>(),
  });

  useEffect(() => {
    const el = root.current;
    if (!el || !ready || shown.length === 0) return;
    const st = state.current;
    st.last.clear();
    st.index.clear();
    const byId = new Map(shown.map((s) => [s.film.id, s]));
    const cellsOf = new Map<string, HTMLElement[]>();
    let frame = 0;

    const narrowQuery = window.matchMedia("(max-width: 70em)");

    const paint = (section: HTMLElement, fraction: number, label: string, seconds: number) => {
      const track = section.querySelector<HTMLElement>("[data-track]");
      const head = section.querySelector<HTMLElement>("[data-head]");
      const fill = section.querySelector<HTMLElement>("[data-fill]");
      const read = section.querySelector<HTMLElement>("[data-read]");
      if (track && head)
        head.style.transform = `translate3d(${(fraction * track.clientWidth).toFixed(1)}px,0,0)`;
      if (fill) fill.style.transform = `scaleX(${fraction.toFixed(4)})`;
      if (read && label) read.textContent = label;
      track?.setAttribute("aria-valuenow", String(Math.round(seconds)));
    };

    const run = () => {
      frame = 0;
      const bar = el.querySelector<HTMLElement>("[data-bar]")?.firstElementChild;
      const rail = el.querySelector<HTMLElement>("[data-rail]");
      const stick = Math.max(
        bar ? bar.getBoundingClientRect().bottom : 0,
        narrowQuery.matches && rail ? rail.getBoundingClientRect().bottom : 0,
      );
      const firstScrub = el.querySelector<HTMLElement>("[data-scrub]");
      const probe = stick + (firstScrub ? firstScrub.offsetHeight : 64) + 28;

      const sections = Array.from(el.querySelectorAll<HTMLElement>("[data-film]"));
      let activeIdx = -1;
      for (let i = 0; i < sections.length; i += 1) {
        if ((sections[i]?.getBoundingClientRect().top ?? Infinity) <= probe) activeIdx = i;
        else break;
      }
      if (activeIdx < 0 && sections.length > 0) activeIdx = 0;
      const active = sections[activeIdx];
      const activeKey = active?.dataset.film ?? "";

      // Films above the line are played to the end, films below it have not started.
      sections.forEach((s, i) => {
        if (i === activeIdx) return;
        const id = s.dataset.film ?? "";
        const item = byId.get(id);
        if (!item) return;
        const mode = i < activeIdx ? "after" : "before";
        if (st.last.get(id) === mode) return;
        st.last.set(id, mode);
        st.index.delete(id);
        paint(
          s,
          mode === "after" ? 1 : 0,
          mode === "after" ? formatDuration(item.film.duration) : "0:00",
          mode === "after" ? item.film.duration : 0,
        );
      });

      if (active) {
        const item = byId.get(activeKey);
        if (item) {
          let cells = cellsOf.get(activeKey);
          if (!cells) {
            cells = Array.from(active.querySelectorAll<HTMLElement>("[data-cell]"));
            cellsOf.set(activeKey, cells);
          }
          const bottoms = cells.map((c) => c.getBoundingClientRect().bottom);
          let idx = currentIndex(bottoms, probe);
          // The still the visitor chose, when it is in the row on the reading line.
          const pin = sceneFocus.get(activeKey);
          if (
            pin !== undefined &&
            idx >= 0 &&
            Math.abs((bottoms[pin] ?? Infinity) - (bottoms[idx] ?? 0)) < 2
          ) {
            idx = pin;
          }
          st.last.set(activeKey, "active");
          if (idx >= 0 && st.index.get(activeKey) !== idx) {
            st.index.set(activeKey, idx);
            const scene = item.scenes[Number(cells[idx]?.dataset.cell ?? idx)];
            if (scene) {
              const total = formatDuration(item.film.duration);
              paint(
                active,
                fractionOf(scene.t, item.film.duration),
                `${scene.time} of ${total}`,
                scene.t,
              );
            }
          }
        }
      }
      if (activeKey !== st.active) {
        st.active = activeKey;
        setActiveId(activeKey);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root, shown, view, ready]);

  return { activeId };
}
