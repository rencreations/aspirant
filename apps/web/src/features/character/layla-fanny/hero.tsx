"use client";

import { useEffect, useRef } from "react";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { CONFIG } from "./config";
import styles from "./hero.module.css";
import { HERO, type Who } from "./media";

/** Where the shot leaves the figure, as a share of the picture (Layla's muzzle, Fanny's hip rig). */
const ORIGIN: Record<Who, { x: number; y: number }> = {
  layla: { x: 0.015, y: 0.5 },
  fanny: { x: 0.36, y: 0.55 },
};

/** The most beams alive at once, so a storm of presses stays cheap. */
const MAX_LIVE = 10;

/**
 * The first screen. Layla fires her cannon at the point you press, along a thin aim line that follows
 * the pointer. Fanny fires her grapple at it and is hauled a little toward it. Both idle by
 * themselves while nobody is touching the page. Everything that moves is a transform or an opacity,
 * made with the Web Animations API, so the compositor does the work.
 */
export function Hero({ who }: { who: Who }) {
  const c = getCharacter(who);
  const cfg = CONFIG[who];
  const art = HERO[who];
  const reduced = useReducedMotion();
  const stage = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const parallax = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const recoil = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const aim = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = stage.current;
    const box = layer.current;
    const fig = recoil.current;
    const pic = img.current;
    if (!root || !box || !fig || !pic) return;
    let lastInput = performance.now();
    let visible = true;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    const live: HTMLElement[] = [];

    const originPoint = () => {
      const r = pic.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const o = ORIGIN[who];
      const x = Math.max(r.left + r.width * o.x, b.left + 6);
      return { x: x - b.left, y: r.top + r.height * o.y - b.top };
    };

    const keep = (el: HTMLElement) => {
      live.push(el);
      while (live.length > MAX_LIVE) live.shift()?.remove();
    };

    const fire = (clientX: number, clientY: number) => {
      const b = box.getBoundingClientRect();
      const tx = clientX - b.left;
      const ty = clientY - b.top;
      const o = originPoint();
      const dx = tx - o.x;
      const dy = ty - o.y;
      const len = Math.max(24, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const base = `translate3d(${o.x}px, ${o.y}px, 0) rotate(${ang}rad)`;
      const layla = who === "layla";

      const beam = document.createElement("span");
      beam.className = (layla ? styles.beam : styles.cable) ?? "";
      beam.style.width = `${len}px`;
      beam.style.transform = `${base} scaleX(0)`;
      box.appendChild(beam);
      keep(beam);
      const grow = reduced ? 1 : 0;
      const done = beam.animate(
        layla
          ? [
              { transform: `${base} scaleX(${grow})`, opacity: 1 },
              { transform: `${base} scaleX(1)`, opacity: 1, offset: 0.22 },
              { transform: `${base} scaleX(1)`, opacity: 0 },
            ]
          : [
              { transform: `${base} scaleX(${grow})`, opacity: 1 },
              { transform: `${base} scaleX(1)`, opacity: 1, offset: 0.2 },
              { transform: `${base} scaleX(1)`, opacity: 1, offset: 0.7 },
              { transform: `${base} scaleX(1)`, opacity: 0 },
            ],
        { duration: layla ? 560 : 900, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      );
      void done.finished.then(
        () => {
          beam.remove();
        },
        () => undefined,
      );

      const ring = document.createElement("span");
      ring.className = (layla ? styles.impact : styles.hook) ?? "";
      const at = `translate3d(${tx}px, ${ty}px, 0)`;
      ring.style.transform = `${at} scale(0.2)`;
      box.appendChild(ring);
      keep(ring);
      const rd = ring.animate(
        [
          { transform: `${at} scale(${reduced ? 1 : 0.2})`, opacity: 1 },
          { transform: `${at} scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `${at} scale(${layla ? 1.7 : 1})`, opacity: 0 },
        ],
        { duration: layla ? 620 : 1000, delay: reduced ? 0 : 90, fill: "backwards" },
      );
      void rd.finished.then(
        () => {
          ring.remove();
        },
        () => undefined,
      );

      if (reduced) return;
      // Layla's cannon kicks back. Fanny is hauled a little toward the hook and leans into it.
      const mx = layla ? -1.4 : (dx / Math.max(1, b.width)) * 36;
      const my = layla ? 0.4 : (dy / Math.max(1, b.height)) * 36;
      fig.animate(
        [
          { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          {
            transform: `translate3d(${mx}%, ${my}%, 0) rotate(${layla ? 0 : Math.sign(dx) * 2.4}deg)`,
            offset: 0.3,
          },
          { transform: "translate3d(0, 0, 0) rotate(0deg)" },
        ],
        { duration: layla ? 460 : 1100, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
      );
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      lastInput = performance.now();
      fire(e.clientX, e.clientY);
    };

    const paint = () => {
      frame = 0;
      if (!pointer) return;
      const b = box.getBoundingClientRect();
      const px = pointer.x - b.left;
      const py = pointer.y - b.top;
      if (mark.current) mark.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      if (aim.current) {
        const o = originPoint();
        const dx = px - o.x;
        const dy = py - o.y;
        aim.current.style.transform = `translate3d(${o.x}px, ${o.y}px, 0) rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy) / 1000})`;
      }
      if (!reduced && parallax.current && title.current) {
        const nx = (pointer.x / window.innerWidth - 0.5) * 2;
        const ny = (pointer.y / window.innerHeight - 0.5) * 2;
        parallax.current.style.transform = `translate3d(${nx * -10}px, ${ny * -6}px, 0)`;
        title.current.style.transform = `translate3d(${nx * 14}px, ${ny * 8}px, 0)`;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      lastInput = performance.now();
      pointer = { x: e.clientX, y: e.clientY };
      if (mark.current) mark.current.style.opacity = "1";
      if (aim.current) aim.current.style.opacity = "0.55";
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onLeave = () => {
      if (mark.current) mark.current.style.opacity = "0";
      if (aim.current) aim.current.style.opacity = "0";
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);

    // By itself: a shot every few seconds while the first screen is showing and nobody is moving.
    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? false;
    });
    io.observe(root);
    const idle = reduced
      ? 0
      : window.setInterval(() => {
          if (!visible || document.hidden || performance.now() - lastInput < 3200) return;
          const b = root.getBoundingClientRect();
          fire(
            b.left + b.width * (0.45 + Math.random() * 0.5),
            b.top + b.height * (0.15 + Math.random() * 0.6),
          );
        }, 4600);

    return () => {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      window.clearInterval(idle);
      if (frame) cancelAnimationFrame(frame);
      live.splice(0).forEach((el) => {
        el.remove();
      });
    };
  }, [who, reduced]);

  return (
    <section
      ref={stage}
      id="top"
      className={styles.hero}
      data-who={who}
      data-cursor={cfg.cursor}
      aria-labelledby="lf-name"
    >
      <div className={styles.back} aria-hidden="true">
        <span className={styles.slab} />
        <span className={styles.ruler} />
      </div>

      <div ref={title} className={styles.titleWrap}>
        <p className={styles.kicker}>
          <span>{c.aspirantName}</span>
          <span lang="ja">{c.jp.script}</span>
        </p>
        <h1 id="lf-name" className={styles.name}>
          {c.name}
        </h1>
      </div>

      <div ref={parallax} className={styles.figure}>
        <div className={styles.bob}>
          <div ref={recoil} className={styles.recoil}>
            {/* Plain <img>: static export, art already sized. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={img}
              className={styles.art}
              src={asset(art.src)}
              alt={art.alt}
              width={art.width}
              height={art.height}
              draggable={false}
              fetchPriority="high"
            />
          </div>
        </div>
      </div>

      <div ref={layer} className={styles.layer} aria-hidden="true">
        {who === "layla" ? <span ref={aim} className={styles.aim} /> : null}
        <span ref={mark} className={styles.mark} />
      </div>

      <div className={styles.foot}>
        <p className={styles.tagline}>{c.tagline}</p>
        <p className={styles.hint}>{cfg.hint}</p>
        <p className={styles.cue} aria-hidden="true">
          <span>Scroll</span>
          <i />
        </p>
      </div>
    </section>
  );
}
