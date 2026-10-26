"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { guinevereArrive } from "./arrive";
import { toneHint } from "./gates";
import { HeartHole, type HeartHoleApi } from "./heart-hole";
import { useHold, useHoldProgress } from "./hold";
import { seg } from "./scroll-kit";
import { useScrollSnap } from "./snap";

/** The share of the hold where the heart starts to close and where it has shut. */
const HEART_FROM = 0.06;
const HEART_SHUT = 0.7;

/**
 * Her theme to her best friend. The last screen of the music film is held. Over it a layer in her
 * cream (the colour of her section) with a heart cut out of it closes in from all the sides,
 * following the scroll: the film shows through the heart, and the heart shrinks until the cream is
 * all there is. The stretch it closes over can never be left half way (`useScrollSnap`: from half
 * on it goes on and shuts, before it the heart opens again), and it works the same going back up.
 * When it has shut, TIME takes over: the film is hidden, her section (already in place under the
 * cream, see `Under`) is switched on (`guinevereArrive`, it fades in by itself) and the cream fades
 * away on it.
 */
export function HeartCover() {
  const hole = useRef<HeartHoleApi>(null);
  const { hideContent, range } = useHold();
  const shut = useRef(false);
  const tween = useRef<gsap.core.Tween | null>(null);
  const corner = useRef(0.5);
  /** The cream has faded away, so the hint is no longer needed. */
  const faded = useRef(false);

  useEffect(() => {
    const measure = () => {
      corner.current = hole.current?.cornerAt() ?? 0.5;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      tween.current?.kill();
      toneHint.set(null);
      guinevereArrive.set(false);
    };
  }, []);

  useHoldProgress((p) => {
    const q = seg(p, HEART_FROM, HEART_SHUT);
    const now = q >= 1 - 0.0005;
    const layer = hole.current?.el();
    hole.current?.set(q);
    if (now !== shut.current) {
      shut.current = now;
      faded.current = false;
      hideContent(now);
      guinevereArrive.set(now);
      tween.current?.kill();
      if (now) {
        tween.current = gsap.to(layer ?? null, {
          opacity: 0,
          duration: 1.0,
          delay: 0.15,
          ease: "power2.inOut",
          onComplete: () => {
            faded.current = true;
            toneHint.set(null);
          },
        });
      } else {
        tween.current = gsap.to(layer ?? null, { opacity: 1, duration: 0.2, overwrite: true });
      }
    }
    // The cream is over the corner (the nav text) once the heart has shrunk past it, and stays
    // there until it has faded (the fade clears the hint).
    if (now) {
      if (!faded.current) toneHint.set("light");
    } else {
      toneHint.set(q > 0 && q >= corner.current ? "light" : null);
    }
  });

  // Never left half way: the heart is taken to shut (her section) or to open (the film).
  useScrollSnap("music-guinevere", () => {
    const r = range();
    if (!r) return null;
    const at = (p: number) => r.start + (r.end - r.start) * p;
    return { start: at(HEART_FROM), end: at(HEART_SHUT) };
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <HeartHole ref={hole} tone="cream" />
    </div>
  );
}
