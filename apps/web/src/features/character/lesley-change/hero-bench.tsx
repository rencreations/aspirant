"use client";

import { useEffect, useRef, useState } from "react";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { CONFIG } from "./config";
import styles from "./hero.module.css";
import { coverPoint, HERO, MARKERS, parsePosition, SPOTS } from "./media";

/** The most pins alive at once. The oldest goes when a sixth is dropped. */
const MAX_PINS = 5;

interface Pin {
  x: number;
  y: number;
  dot: HTMLElement;
  line: HTMLElement | null;
}

/**
 * Chang'e's first screen: her splash art on a bench. Crosshair guides follow the pointer and read
 * out where it is. A press drops a numbered pin, and from the second pin on a dimension line
 * shows how far it is from the last one, in units of one percent of the width. Three markers on
 * her art open a line about what she built. A ring of light ripples out from her head on its own.
 * Everything that moves is a transform or an opacity.
 */
export function BenchHero() {
  const c = getCharacter("change");
  const cfg = CONFIG.change;
  const art = HERO.change;
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const gx = useRef<HTMLSpanElement>(null);
  const gy = useRef<HTMLSpanElement>(null);
  const coord = useRef<HTMLSpanElement>(null);
  const preview = useRef<HTMLSpanElement>(null);
  const drop = useRef<(() => void) | null>(null);
  const clear = useRef<(() => void) | null>(null);
  const [spots, setSpots] = useState<Array<{ x: number; y: number }>>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [pins, setPins] = useState(0);
  const marker = MARKERS.find((m) => m.id === open) ?? null;

  useEffect(() => {
    const el = root.current;
    const box = layer.current;
    if (!el || !box) return;
    const posImg = parsePosition(art.position);
    const pic = { w: art.width, h: art.height };
    let w = 1;
    let h = 1;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let lastText = "";
    let n = 0;
    const list: Pin[] = [];

    const units = (len: number) => ((len / w) * 100).toFixed(1);

    const measure = () => {
      const b = el.getBoundingClientRect();
      w = Math.max(1, b.width);
      h = Math.max(1, b.height);
      setSpots(
        MARKERS.map((m) => {
          const p = coverPoint(m.x, m.y, { w, h }, pic, posImg);
          return { x: p.x, y: p.y };
        }),
      );
      const r = coverPoint(SPOTS.ring.x, SPOTS.ring.y, { w, h }, pic, posImg);
      el.style.setProperty("--rx", `${r.x}px`);
      el.style.setProperty("--ry", `${r.y}px`);
    };

    const segment = (p: { x: number; y: number }, q: { x: number; y: number }, cls: string) => {
      // Drawn from the left end, so the label never reads upside down.
      const [a, b] = q.x < p.x ? [q, p] : [p, q];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const line = document.createElement("span");
      line.className = cls;
      line.style.width = `${len}px`;
      line.style.transform = `translate3d(${a.x}px, ${a.y}px, 0) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
      const tag = document.createElement("b");
      tag.textContent = `${units(len)} u`;
      line.appendChild(tag);
      return line;
    };

    const addPin = (x: number, y: number) => {
      n += 1;
      const dot = document.createElement("span");
      dot.className = styles.pin ?? "";
      dot.textContent = String(n);
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${reduced ? 1 : 0.2})`;
      box.appendChild(dot);
      dot.animate(
        [
          { transform: `translate3d(${x}px, ${y}px, 0) scale(${reduced ? 1 : 0.2})`, opacity: 0 },
          { transform: `translate3d(${x}px, ${y}px, 0) scale(1)`, opacity: 1 },
        ],
        {
          duration: reduced ? 1 : 260,
          easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)",
          fill: "forwards",
        },
      );
      const prev = list[list.length - 1];
      let line: HTMLElement | null = null;
      if (prev) {
        line = segment(prev, { x, y }, styles.dim ?? "");
        box.appendChild(line);
      }
      list.push({ x, y, dot, line });
      while (list.length > MAX_PINS) {
        const old = list.shift();
        old?.dot.remove();
        // The line that led to the oldest pin lives on the next pin.
        list[0]?.line?.remove();
        if (list[0]) list[0].line = null;
      }
      setPins(list.length);
    };

    const clearPins = () => {
      list.splice(0).forEach((p) => {
        p.dot.remove();
        p.line?.remove();
      });
      n = 0;
      setPins(0);
      if (preview.current) preview.current.style.opacity = "0";
    };

    const paint = () => {
      frame = 0;
      if (!pointer) return;
      const b = el.getBoundingClientRect();
      const px = pointer.x - b.left;
      const py = pointer.y - b.top;
      if (gx.current) gx.current.style.transform = `translate3d(${px}px, 0, 0)`;
      if (gy.current) gy.current.style.transform = `translate3d(0, ${py}px, 0)`;
      let text = `${(px / w).toFixed(2)} , ${(py / h).toFixed(2)}`;
      const last = list[list.length - 1];
      if (last && preview.current) {
        const dx = px - last.x;
        const dy = py - last.y;
        const len = Math.hypot(dx, dy);
        preview.current.style.transform = `translate3d(${last.x}px, ${last.y}px, 0) rotate(${Math.atan2(dy, dx)}rad) scaleX(${len / 1000})`;
        preview.current.style.opacity = "1";
        text = `${units(len)} u`;
      } else if (preview.current) {
        preview.current.style.opacity = "0";
      }
      if (coord.current) {
        coord.current.style.transform = `translate3d(${px + 14}px, ${py + 14}px, 0)`;
        if (text !== lastText) {
          lastText = text;
          coord.current.textContent = text;
        }
      }
    };

    const show = (on: boolean) => {
      const o = on ? "1" : "0";
      if (gx.current) gx.current.style.opacity = o;
      if (gy.current) gy.current.style.opacity = o;
      if (coord.current) coord.current.style.opacity = o;
      if (!on && preview.current) preview.current.style.opacity = "0";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      show(true);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      const b = el.getBoundingClientRect();
      pointer = { x: e.clientX, y: e.clientY };
      addPin(e.clientX - b.left, e.clientY - b.top);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onLeave = () => {
      pointer = null;
      show(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearPins();
        setOpen(null);
      }
    };

    drop.current = () => {
      addPin(w * (0.25 + Math.random() * 0.6), h * (0.2 + Math.random() * 0.55));
    };
    clear.current = clearPins;

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKey);

    return () => {
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      if (frame) cancelAnimationFrame(frame);
      clearPins();
      drop.current = null;
      clear.current = null;
    };
  }, [reduced, art.height, art.position, art.width]);

  return (
    <section
      ref={root}
      id="top"
      className={styles.hero}
      data-who="change"
      data-cursor={cfg.cursor}
      aria-labelledby="lc-name"
    >
      <div className={styles.artWrap}>
        {/* Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.art}
          src={asset(art.src)}
          alt={art.alt}
          width={art.width}
          height={art.height}
          style={{ objectPosition: art.position }}
          draggable={false}
          fetchPriority="high"
        />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.ticks} aria-hidden="true" />
      <span className={styles.ripple} aria-hidden="true" />
      <span className={`${styles.ripple} ${styles.rippleB}`} aria-hidden="true" />

      <div ref={layer} className={styles.layer} aria-hidden="true">
        <span ref={gx} className={styles.guideX} />
        <span ref={gy} className={styles.guideY} />
        <span ref={preview} className={styles.preview} />
        <span ref={coord} className={styles.coord} />
      </div>

      {spots.length === MARKERS.length
        ? MARKERS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={styles.marker}
              data-on={open === m.id}
              aria-hidden="true"
              tabIndex={-1}
              style={{ left: spots[i]?.x, top: spots[i]?.y, animationDelay: `${i * 1.4}s` }}
              onClick={() => {
                setOpen((o) => (o === m.id ? null : m.id));
              }}
            >
              <i aria-hidden="true" />
              <span>{m.name}</span>
            </button>
          ))
        : null}

      <div className={styles.plate}>
        <p className={styles.kicker}>
          <span>{c.aspirantName}</span>
          <span lang="ja">{c.jp.script}</span>
        </p>
        <h1 id="lc-name" className={styles.name}>
          {c.name}
        </h1>
        <p className={styles.stripe} aria-hidden="true" />
      </div>

      <aside className={styles.panel}>
        <div aria-live="polite">
          <b>{marker ? marker.name : "Bench"}</b>
          <p>{marker ? marker.text : c.tagline}</p>
        </div>
        <div className={styles.chips} role="group" aria-label="Things she built">
          {MARKERS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={open === m.id}
              onClick={() => {
                setOpen((o) => (o === m.id ? null : m.id));
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.foot}>
        <p className={styles.hint}>{cfg.hint}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              drop.current?.();
            }}
          >
            {cfg.action}
          </button>
          {pins > 0 ? (
            <button
              type="button"
              className={`${styles.action} ${styles.actionQuiet}`}
              onClick={() => {
                clear.current?.();
              }}
            >
              Clear pins
            </button>
          ) : null}
        </div>
        <p className={styles.cue} aria-hidden="true">
          <span>Scroll</span>
          <i />
        </p>
      </div>
    </section>
  );
}
