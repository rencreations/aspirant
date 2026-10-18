import gsap from "gsap";

import { LOGO } from "./logo-data.generated";
import { LOGO_W } from "./logo-geometry";

/** Handles to the animatable parts of a rendered logo. */
export interface LogoParts {
  letters: SVGGElement[];
  letterGroup: SVGGElement | null;
  head: SVGGElement | null;
  antL: SVGGElement | null;
  antR: SVGGElement | null;
  lid: SVGRectElement | null;
  energy: SVGPathElement | null;
  shine: SVGRectElement | null;
}

const geo = LOGO.mascotGeo;
const headOrigin = `${geo.cx} ${geo.cy}`;
const lidOrigin = `${geo.cx} ${geo.eyes[1]}`;
const pivotL = `${geo.antLPivot[0]} ${geo.antLPivot[1]}`;
const pivotR = `${geo.antRPivot[0]} ${geo.antRPivot[1]}`;

/** Find the parts inside a rendered `LogoLayers`. */
export function queryLogoParts(root: Element): LogoParts {
  const one = <T extends Element>(name: string) => root.querySelector<T>(`[data-part="${name}"]`);
  const letters = Array.from(root.querySelectorAll<SVGGElement>('[data-part="letter"]')).sort(
    (a, b) => Number(a.dataset.i) - Number(b.dataset.i),
  );
  return {
    letters,
    letterGroup: one<SVGGElement>("letters"),
    head: one<SVGGElement>("head"),
    antL: one<SVGGElement>("antL"),
    antR: one<SVGGElement>("antR"),
    lid: one<SVGRectElement>("lid"),
    energy: one<SVGPathElement>("energy"),
    shine: one<SVGRectElement>("shine"),
  };
}

function blink(p: LogoParts, repeatDelay: number) {
  if (!p.lid) return;
  gsap.set(p.lid, { svgOrigin: lidOrigin });
  gsap
    .timeline({ repeat: -1, repeatDelay, delay: 0.6 })
    .to(p.lid, { scaleY: 1, duration: 0.07, ease: "power2.out" })
    .to(p.lid, { scaleY: 0, duration: 0.11, ease: "power2.in" }, "+=0.07");
}

function antennae(p: LogoParts, amount: number, duration: number) {
  if (p.antL) {
    gsap.to(p.antL, {
      rotation: -amount,
      svgOrigin: pivotL,
      duration,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  }
  if (p.antR) {
    gsap.to(p.antR, {
      rotation: amount,
      svgOrigin: pivotR,
      duration: duration * 1.15,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.25,
    });
  }
}

/**
 * A light loop that only touches the mascot: it blinks and its antennae sway. For the logo
 * in the navigation. Returns a cleanup that restores every part.
 */
export function ambientLoop(p: LogoParts): () => void {
  const ctx = gsap.context(() => {
    blink(p, 3.4);
    antennae(p, 6, 1.5);
    if (p.head) {
      gsap.to(p.head, { y: -4, duration: 1.7, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }
  });
  return () => ctx.revert();
}

/**
 * The idle loop of the loading screen: the letters ripple in a wave, a band of light sweeps
 * across them, a spark runs round the outline, and the mascot bobs, blinks and twitches.
 */
export function idleLoop(p: LogoParts): () => void {
  const ctx = gsap.context(() => {
    gsap.to(p.letters, {
      y: -12,
      duration: 0.5,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      repeatDelay: 1.5,
      stagger: { each: 0.075, repeat: -1, repeatDelay: 1.5 },
    });
    if (p.head) {
      gsap.to(p.head, { y: -9, duration: 1.15, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }
    antennae(p, 9, 0.8);
    blink(p, 2.2);
    if (p.shine) {
      gsap.set(p.shine, { opacity: 1 });
      gsap.fromTo(
        p.shine,
        { x: 0 },
        { x: LOGO_W + 900, duration: 2.1, ease: "power1.inOut", repeat: -1, repeatDelay: 1.2 },
      );
    }
    if (p.energy) {
      gsap.set(p.energy, { opacity: 0.95 });
      gsap.fromTo(
        p.energy,
        { strokeDashoffset: 0 },
        { strokeDashoffset: -1000, duration: 3.4, ease: "none", repeat: -1 },
      );
    }
  });
  return () => ctx.revert();
}

/**
 * The loop of the page-transition loading state, deliberately different from the boot loop: the
 * letters flicker in sequence like a scanner, the mascot looks left and right, antennae twitch.
 */
export function waitingLoop(p: LogoParts): () => void {
  const ctx = gsap.context(() => {
    gsap.to(p.letters, {
      opacity: 0.28,
      duration: 0.32,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.085, repeat: -1, yoyo: true },
    });
    if (p.head) {
      gsap.set(p.head, { svgOrigin: headOrigin });
      gsap.to(p.head, {
        x: 16,
        rotation: 5,
        duration: 0.75,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }
    antennae(p, 14, 0.28);
    blink(p, 0.9);
    if (p.energy) {
      gsap.set(p.energy, { opacity: 0.95 });
      gsap.fromTo(
        p.energy,
        { strokeDashoffset: 0 },
        { strokeDashoffset: 1000, duration: 1.6, ease: "none", repeat: -1 },
      );
    }
  });
  return () => ctx.revert();
}

/** Hover: the letters hop in a quick wave, the antennae twitch and the head tilts. */
export function hoverIn(p: LogoParts): void {
  gsap.to(p.letters, {
    y: -14,
    duration: 0.22,
    ease: "power2.out",
    yoyo: true,
    repeat: 1,
    stagger: 0.03,
    overwrite: "auto",
  });
  if (p.antL) {
    gsap.to(p.antL, { rotation: -22, svgOrigin: pivotL, duration: 0.14, yoyo: true, repeat: 3 });
  }
  if (p.antR) {
    gsap.to(p.antR, { rotation: 22, svgOrigin: pivotR, duration: 0.14, yoyo: true, repeat: 3 });
  }
  if (p.head) {
    gsap.to(p.head, { rotation: -6, svgOrigin: headOrigin, duration: 0.3, ease: "back.out(2)" });
  }
  if (p.energy) {
    gsap.set(p.energy, { opacity: 1 });
    gsap.fromTo(
      p.energy,
      { strokeDashoffset: 0 },
      { strokeDashoffset: -1000, duration: 0.9, ease: "power1.inOut" },
    );
    gsap.to(p.energy, { opacity: 0, duration: 0.3, delay: 0.7 });
  }
}

export function hoverOut(p: LogoParts): void {
  if (p.head) {
    gsap.to(p.head, {
      rotation: 0,
      svgOrigin: headOrigin,
      duration: 0.45,
      ease: "elastic.out(1,0.5)",
    });
  }
}

/** Click: the mascot jumps, the letters pop in sequence, the eyes blink. */
export function clickPop(p: LogoParts): void {
  const tl = gsap.timeline();
  if (p.head) {
    tl.to(
      p.head,
      { y: -38, scaleY: 1.06, svgOrigin: headOrigin, duration: 0.2, ease: "power2.out" },
      0,
    )
      .to(p.head, { y: 0, scaleY: 0.9, duration: 0.16, ease: "power2.in" })
      .to(p.head, { scaleY: 1, duration: 0.5, ease: "elastic.out(1,0.35)" });
  }
  tl.to(
    p.letters,
    {
      scale: 1.14,
      transformOrigin: "50% 50%",
      duration: 0.14,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
      stagger: 0.025,
    },
    0.05,
  );
  if (p.lid) {
    tl.set(p.lid, { svgOrigin: lidOrigin }, 0.1)
      .to(p.lid, { scaleY: 1, duration: 0.06 }, 0.1)
      .to(p.lid, { scaleY: 0, duration: 0.1 }, 0.3);
  }
}
