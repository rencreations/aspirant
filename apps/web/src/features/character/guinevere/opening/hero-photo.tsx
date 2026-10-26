"use client";

import { useEffect, useRef, type RefObject } from "react";

import { asset } from "@/lib/asset";

import { HERO } from "../media";
import styles from "./opening.module.css";

/** Four-pointed star, for the sparkles that pop where the visitor presses. */
const SPARKS = 9;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Props {
  /** The element the pointer is read on (the pinned screen of the hero). */
  host: RefObject<HTMLElement | null>;
  /** True while the hero is the thing on screen (the scroll writes it). */
  active: RefObject<boolean>;
  reduced: boolean;
}

/**
 * The one photo of Guinevere, made to answer a visitor. Two pictures lie on top of each other, the
 * same cut-out twice: the photo as it is, and the same photo in the colours of the first light of
 * day (`scripts/guinevere/glow.py`: her pink hair turns to gold, the lavender tips to amber).
 *
 *   - The dawn picture shows through a soft circle that follows the pointer, so moving over her
 *     pulls the day over her. A touch does the same.
 *   - With nobody there, the circle wanders over her by itself, and now and then the whole day
 *     breaks over her and withdraws.
 *   - A press (or tap) makes the day break at once and pops a handful of sparkles.
 *   - She leans toward the pointer in 3D (a few degrees), and the halo behind her head follows a
 *     little less, so the three layers have depth.
 *
 * All of it is one rAF loop that writes a mask on one element and a transform on two, and it only
 * runs while the hero is on screen. Reduced motion keeps the pointer circle and drops the rest.
 */
export function HeroPhoto({ host, active, reduced }: Props) {
  const figure = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLImageElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const sparks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fig = figure.current;
    const til = tilt.current;
    const gl = glow.current;
    const hal = halo.current;
    const hostEl = host.current;
    if (!fig || !til || !gl || !hal || !hostEl) return;

    // Where the circle is (px inside the figure), how big, and where each wants to be.
    const cur = { x: 0, y: 0, r: 0, tx: 0, ty: 0 };
    const goal = { x: 0, y: 0, r: 0 };
    let ready = false;
    let rect = fig.getBoundingClientRect();
    let pointerAt = -1e9; // time of the last pointer move
    let burstUntil = 0;
    let wander = 0;
    let nextBreak = 5200;
    let breakUntil = 0;
    let raf = 0;
    let running = false;
    let visible = true;
    let touched = false;
    let lastMask = "";
    let lastTilt = "";

    const measure = () => {
      rect = fig.getBoundingClientRect();
      if (!ready && rect.width > 0) {
        ready = true;
        cur.x = goal.x = rect.width * 0.5;
        cur.y = goal.y = rect.height * 0.42;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!running) return;
      const w = rect.width || 1;
      const h = rect.height || 1;
      const idle = now - pointerAt > 2600;
      let r = w * 0.17;
      if (idle && !reduced) {
        // A slow figure of eight over her hair and face, the circle breathing as it goes.
        wander += 0.0006 * 16.7;
        goal.x = w * (0.5 + 0.27 * Math.sin(wander * 1.1));
        goal.y = h * (0.42 + 0.22 * Math.sin(wander * 1.7 + 1.2));
        r = w * (0.13 + 0.04 * Math.sin(wander * 2.3));
        if (now > nextBreak && now > breakUntil) {
          breakUntil = now + 2600;
          nextBreak = now + 11000;
        }
      } else if (idle) {
        r = 0;
      }
      if (now < breakUntil) {
        const t = 1 - (breakUntil - now) / 2600;
        const bell = Math.sin(Math.PI * clamp(t, 0, 1));
        r = Math.max(r, w * 1.1 * bell);
      }
      if (now < burstUntil) {
        const t = 1 - (burstUntil - now) / 900;
        r = Math.max(r, w * 1.15 * Math.sin(Math.PI * clamp(t, 0, 1)));
      }
      goal.r = r;
      const k = 0.14;
      cur.x += (goal.x - cur.x) * k;
      cur.y += (goal.y - cur.y) * k;
      cur.r += (goal.r - cur.r) * 0.1;

      const mask = `radial-gradient(circle ${Math.max(1, cur.r).toFixed(0)}px at ${cur.x.toFixed(0)}px ${cur.y.toFixed(0)}px, #000 0%, #000 55%, transparent 100%)`;
      if (mask !== lastMask) {
        lastMask = mask;
        gl.style.maskImage = mask;
        gl.style.webkitMaskImage = mask;
      }

      if (!reduced) {
        // The lean: the figure turns toward the pointer, and the halo shifts the other way a little.
        const nx = clamp(cur.x / w - 0.5, -0.5, 0.5);
        const ny = clamp(cur.y / h - 0.5, -0.5, 0.5);
        const t = `rotateY(${(nx * 7).toFixed(2)}deg) rotateX(${(-ny * 4).toFixed(2)}deg)`;
        if (t !== lastTilt) {
          lastTilt = t;
          til.style.transform = t;
          hal.style.transform = `translate3d(${(-nx * 18).toFixed(1)}px, ${(-ny * 10).toFixed(1)}px, 0)`;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || !visible || !active.current || document.hidden) return;
      running = true;
      measure();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const sync = () => {
      if (visible && active.current && !document.hidden) start();
      else stop();
    };

    const onMove = (e: PointerEvent) => {
      if (!active.current) return;
      if (!running) sync();
      measure();
      pointerAt = performance.now();
      goal.x = e.clientX - rect.left;
      goal.y = e.clientY - rect.top;
      if (!touched) {
        touched = true;
        hint.current?.setAttribute("data-gone", "true");
      }
    };
    const onLeave = () => {
      pointerAt = -1e9;
    };
    const onDown = (e: PointerEvent) => {
      if (!active.current) return;
      measure();
      onMove(e);
      burstUntil = performance.now() + 900;
      if (reduced || !sparks.current) return;
      const box = sparks.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      for (let i = 0; i < SPARKS; i += 1) {
        const el = document.createElement("i");
        el.className = styles.spark2 ?? "";
        const a = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.5;
        const d = 60 + Math.random() * 110;
        const s = 0.6 + Math.random() * 0.9;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        box.appendChild(el);
        const anim = el.animate(
          [
            { transform: "translate(-50%,-50%) scale(0) rotate(0deg)", opacity: 0 },
            {
              transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.55}px), calc(-50% + ${Math.sin(a) * d * 0.55}px)) scale(${s}) rotate(90deg)`,
              opacity: 1,
              offset: 0.35,
            },
            {
              transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 24}px)) scale(0) rotate(200deg)`,
              opacity: 0,
            },
          ],
          { duration: 900 + Math.random() * 300, easing: "cubic-bezier(0.2,0.7,0.3,1)" },
        );
        anim.onfinish = () => {
          el.remove();
        };
      }
    };

    hostEl.addEventListener("pointermove", onMove, { passive: true });
    hostEl.addEventListener("pointerdown", onDown, { passive: true });
    hostEl.addEventListener("pointerleave", onLeave, { passive: true });
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        visible = e?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(hostEl);
    const ro = new ResizeObserver(measure);
    ro.observe(fig);
    document.addEventListener("visibilitychange", sync);
    // The scroll flips `active` without an event of its own: look again now and then (cheap).
    const watch = window.setInterval(sync, 400);
    sync();

    return () => {
      stop();
      window.clearInterval(watch);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      hostEl.removeEventListener("pointermove", onMove);
      hostEl.removeEventListener("pointerdown", onDown);
      hostEl.removeEventListener("pointerleave", onLeave);
    };
  }, [host, active, reduced]);

  return (
    <>
      <div ref={figure} className={styles.dFigure}>
        <div ref={halo} className={styles.halo} aria-hidden="true">
          <i className={styles.haloRingA} />
          <i className={styles.haloRingB} />
          <i className={styles.haloDots} />
        </div>
        <div ref={tilt} className={styles.dTilt}>
          {/* Plain <img>: static export. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.dBase} src={asset(HERO.front)} alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={glow}
            className={styles.dGlow}
            src={asset("/img/guinevere/hero/glow.webp")}
            alt=""
            draggable={false}
          />
        </div>
        <div ref={sparks} className={styles.sparks} aria-hidden="true" />
      </div>
      <p ref={hint} className={styles.hint} aria-hidden="true">
        Move over her. Press for sunrise.
      </p>
    </>
  );
}
