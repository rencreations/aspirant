"use client";

import { useEffect, useRef, type RefObject } from "react";

import { approach, REST_RATE, SPIN_MS, tiltToward } from "./disc-math";
import { deckElement } from "./music-store";
import { drifted, lengthOf, RING_FRAMES } from "./music-time";

interface DiscParts {
  /** The disc's plain box: it never moves, so it is what is watched and measured. */
  box: RefObject<HTMLElement | null>;
  /** Leans toward the pointer. */
  tilt: RefObject<HTMLElement | null>;
  /** The light on the face: it turns to the side the disc leans to. */
  sheen: RefObject<HTMLElement | null>;
  /** Turns round, slowly at rest and faster while the track plays. */
  spin: RefObject<HTMLElement | null>;
  /** Rocks when the disc is pressed. */
  wobble: RefObject<HTMLElement | null>;
}

const fixed = (v: number) => v.toFixed(2);

/**
 * How a disc of the music decks moves. Four motions, one element each, so none of them has to
 * know about the others:
 *
 * - it turns round for ever, one Web Animation whose rate is eased up when its track plays and
 *   down again when it stops (the compositor runs it);
 * - it leans so that its face looks at the pointer, eased, and a little with the scroll, so it is
 *   alive on a phone too. A frame loop runs only while the lean is still changing;
 * - the light on its face turns with the lean;
 * - a press rocks it about the point that was pressed (`press`, a Web Animation).
 *
 * Everything stops while the disc is off screen. Only transform and opacity are written.
 */
export function useDiscMotion(parts: DiscParts, playing: boolean): (x: number, y: number) => void {
  const { box, tilt, sheen, spin, wobble } = parts;
  const turning = useRef<Animation | null>(null);
  const rate = useRef(REST_RATE);
  const wanted = useRef(REST_RATE);
  const kick = useRef<() => void>(() => undefined);

  // The turn, the lean and the light.
  useEffect(() => {
    const boxEl = box.current;
    const tiltEl = tilt.current;
    const spinEl = spin.current;
    if (!boxEl || !tiltEl || !spinEl || typeof spinEl.animate !== "function") return;

    const anim = spinEl.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: SPIN_MS,
      iterations: Infinity,
      easing: "linear",
    });
    anim.playbackRate = rate.current;
    anim.pause();
    turning.current = anim;

    let seen = false;
    let raf = 0;
    let last = 0;
    // Where the pointer is, or null when there is none to look at.
    let pointer: { x: number; y: number } | null = null;
    const lean = { x: 0, y: 0 };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const r = boxEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const vh = window.innerHeight || 1;
      // With the scroll: the disc looks a little up while it is low on the screen, down when high.
      const pass = Math.min(1, Math.max(-1, (cy - vh / 2) / (vh / 2)));
      const to = pointer
        ? tiltToward(pointer.x - cx, pointer.y - cy, Math.max(420, r.width * 1.5))
        : { x: 0, y: 0 };
      const tx = to.x + pass * 5;
      lean.x = approach(lean.x, tx, dt, 110);
      lean.y = approach(lean.y, to.y, dt, 110);
      tiltEl.style.transform = `rotateX(${fixed(lean.x)}deg) rotateY(${fixed(lean.y)}deg)`;
      const light = sheen.current;
      if (light) {
        // The bright band lies across the lean, and is stronger the further the disc leans.
        const size = Math.hypot(lean.x, lean.y);
        const angle = (Math.atan2(lean.y, lean.x) * 180) / Math.PI;
        light.style.transform = `translateZ(1px) rotate(${fixed(angle)}deg)`;
        light.style.opacity = fixed(0.55 + Math.min(1, size / 18) * 0.45);
      }
      // The rate of the turn is eased in the same loop.
      if (Math.abs(rate.current - wanted.current) > 0.004) {
        rate.current = approach(rate.current, wanted.current, dt, 260);
        anim.updatePlaybackRate(rate.current);
      } else if (rate.current !== wanted.current) {
        rate.current = wanted.current;
        anim.updatePlaybackRate(rate.current);
      }
      const settled =
        Math.abs(lean.x - tx) < 0.02 &&
        Math.abs(lean.y - to.y) < 0.02 &&
        rate.current === wanted.current;
      if (seen && !settled) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const ask = () => {
      if (seen && !raf) raf = requestAnimationFrame(frame);
    };
    kick.current = ask;

    const onMove = (e: PointerEvent) => {
      // A finger is not a pointer to follow: it leans the disc only while it presses it.
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      ask();
    };
    const onLeave = () => {
      pointer = null;
      ask();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      ask();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") onLeave();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        seen = entry?.isIntersecting ?? false;
        // The stylesheet holds the idle lean while the disc is out of sight.
        boxEl.dataset.seen = String(seen);
        if (seen) {
          anim.play();
          ask();
        } else {
          anim.pause();
        }
      },
      { rootMargin: "12% 0px 12% 0px" },
    );
    observer.observe(boxEl);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", ask, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    boxEl.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", ask);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      boxEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (raf) cancelAnimationFrame(raf);
      anim.cancel();
      turning.current = null;
      kick.current = () => undefined;
    };
  }, [box, tilt, sheen, spin]);

  // Faster while its track plays.
  useEffect(() => {
    wanted.current = playing ? 1 : REST_RATE;
    kick.current();
  }, [playing]);

  // A press rocks the disc about the point that was pressed: that side goes back, then it rings
  // out. A press in the middle is a plain dip.
  return (x: number, y: number) => {
    const boxEl = box.current;
    const el = wobble.current;
    if (!boxEl || !el || typeof el.animate !== "function") return;
    const r = boxEl.getBoundingClientRect();
    const dx = (x - (r.left + r.width / 2)) / (r.width / 2 || 1);
    const dy = (y - (r.top + r.height / 2)) / (r.height / 2 || 1);
    const reach = Math.min(1, Math.hypot(dx, dy));
    const ux = reach > 0.05 ? dx / Math.hypot(dx, dy) : 0;
    const uy = reach > 0.05 ? dy / Math.hypot(dx, dy) : -1;
    const depth = 6 + reach * 10;
    const at = (k: number, scale: number, offset: number): Keyframe => ({
      transform: `rotateX(${fixed(-uy * depth * k)}deg) rotateY(${fixed(ux * depth * k)}deg) scale(${scale})`,
      offset,
    });
    el.animate(
      [
        at(0, 1, 0),
        at(1, 0.962, 0.14),
        at(-0.56, 1.012, 0.38),
        at(0.3, 1, 0.6),
        at(-0.14, 1, 0.8),
        at(0, 1, 1),
      ],
      { duration: 900, easing: "cubic-bezier(0.3, 0.6, 0.4, 1)" },
    );
  };
}

interface RingParts {
  first: RefObject<HTMLElement | null>;
  second: RefObject<HTMLElement | null>;
  head: RefObject<HTMLElement | null>;
}

/**
 * The ring round a disc: how much of its track has played. Three Web Animations as long as the
 * track (the two half rings and the head), run by the compositor while the track plays, held
 * while it is paused, and set to the track's own time again whenever the two come apart. Nothing
 * is written per frame. `active` is true while this disc's track is the one in the player.
 */
export function useDiscRing(parts: RingParts, active: boolean, recorded: number): void {
  const { first, second, head } = parts;

  useEffect(() => {
    if (!active) return;
    const el = deckElement();
    const a = first.current;
    const b = second.current;
    const c = head.current;
    if (!el || !a || !b || !c || typeof a.animate !== "function") return;
    const targets = [
      [a, RING_FRAMES.first],
      [b, RING_FRAMES.second],
      [c, RING_FRAMES.head],
    ] as const;

    let length = lengthOf(el.duration, recorded) * 1000;
    const anims = targets.map(([target, frames]) => {
      const anim = target.animate(frames, {
        duration: length,
        fill: "both",
        easing: "linear",
      });
      anim.pause();
      return anim;
    });

    const sync = (force = false) => {
      const now = lengthOf(el.duration, recorded) * 1000;
      if (Math.abs(now - length) > 1) {
        length = now;
        for (const anim of anims) anim.effect?.updateTiming({ duration: length });
      }
      const at = Math.min(length, el.currentTime * 1000);
      const running = !el.paused && !el.ended && el.readyState > 2;
      for (const anim of anims) {
        if (force || drifted(Number(anim.currentTime ?? 0), at)) anim.currentTime = at;
        if (running && anim.playState !== "running") anim.play();
        else if (!running && anim.playState === "running") anim.pause();
      }
    };
    const soft = () => {
      sync();
    };
    const hard = () => {
      sync(true);
    };
    hard();
    el.addEventListener("timeupdate", soft);
    el.addEventListener("playing", hard);
    el.addEventListener("waiting", soft);
    el.addEventListener("pause", hard);
    el.addEventListener("seeked", hard);
    el.addEventListener("ended", hard);
    el.addEventListener("durationchange", soft);
    return () => {
      el.removeEventListener("timeupdate", soft);
      el.removeEventListener("playing", hard);
      el.removeEventListener("waiting", soft);
      el.removeEventListener("pause", hard);
      el.removeEventListener("seeked", hard);
      el.removeEventListener("ended", hard);
      el.removeEventListener("durationchange", soft);
      for (const anim of anims) anim.cancel();
    };
  }, [active, recorded, first, second, head]);
}
