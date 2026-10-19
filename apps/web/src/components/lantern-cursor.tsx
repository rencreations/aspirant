"use client";

import { useEffect, useRef } from "react";

import { useMediaQuery, useMounted, useReducedMotion } from "@/lib/hooks";
import { damp } from "@/lib/math";

import styles from "./lantern-cursor.module.css";

const INTERACTIVE =
  'a[href], button, [role="button"], input, select, textarea, label, summary, [data-cursor]';

/**
 * The lantern: a soft light disc that follows a mouse or pen closely and a ring that lags
 * behind. The ring grows over interactive elements; `data-cursor="PLAY"` on an element shows
 * a short label, `data-cursor-theme="light|dark"` forces the ring colour. An element with
 * `data-snap` pulls the ring to its centre while the pointer is over it, and keeps it there if
 * the element moves. `data-state` on the root says what the cursor is doing: idle, hover, snap
 * or pressed. The native cursor stays visible. Off for touch-first devices and reduced motion.
 *
 * It also publishes the light position: --lx/--ly (viewport px) on <html>, and --mx/--my
 * (local px) on every in-view element with `data-lantern`, for `lantern-mask` reveals.
 * Mounted once in the root layout.
 */
export function LanternCursor() {
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reduced = useReducedMotion();
  const mounted = useMounted();
  if (!mounted || !fine || reduced) return null;
  return <Lantern />;
}

function Lantern() {
  const rootRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const disc = discRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!root || !disc || !ring || !label) return;
    const html = document.documentElement;
    html.dataset.lantern = "on";

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let dx = tx;
    let dy = ty;
    let rx = tx;
    let ry = ty;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;
    let last = 0;
    let visible = false;
    // The element the ring is snapped to, and where its centre is now.
    let snapEl: HTMLElement | null = null;
    let sx = 0;
    let sy = 0;
    const SNAP_SCALE = 1.7;
    const release = () => {
      snapEl = null;
      root.dataset.snap = "false";
    };

    // Elements that want local --mx/--my, tracked while in view.
    const lanterns = new Set<HTMLElement>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) lanterns.add(el);
        else lanterns.delete(el);
      }
    });
    const observed = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-lantern]").forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          io.observe(el);
        }
      });
      for (const el of lanterns) if (!el.isConnected) lanterns.delete(el);
    };
    let scanRaf = 0;
    const mo = new MutationObserver(() => {
      if (!scanRaf) {
        scanRaf = requestAnimationFrame(() => {
          scanRaf = 0;
          scan();
        });
      }
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });

    const rects: DOMRect[] = [];
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (snapEl && (!snapEl.isConnected || snapEl.matches(":disabled"))) release();
      if (snapEl) {
        const r = snapEl.getBoundingClientRect();
        sx = r.left + r.width / 2;
        sy = r.top + r.height / 2;
      }
      const gx = snapEl ? sx : tx;
      const gy = snapEl ? sy : ty;
      dx = damp(dx, tx, 32, dt);
      dy = damp(dy, ty, 32, dt);
      rx = damp(rx, gx, snapEl ? 18 : 11, dt);
      ry = damp(ry, gy, snapEl ? 18 : 11, dt);
      scale = damp(scale, targetScale, 14, dt);

      disc.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale})`;
      label.style.transform = `translate3d(${rx + 18 * scale + 6}px, ${ry + 14 * scale}px, 0)`;
      html.style.setProperty("--lx", `${dx.toFixed(1)}px`);
      html.style.setProperty("--ly", `${dy.toFixed(1)}px`);

      // Read every rect first, then write, so the browser lays out once.
      let i = 0;
      for (const el of lanterns) rects[i++] = el.getBoundingClientRect();
      i = 0;
      for (const el of lanterns) {
        const r = rects[i++];
        if (!r) continue;
        el.style.setProperty("--mx", `${(dx - r.left).toFixed(1)}px`);
        el.style.setProperty("--my", `${(dy - r.top).toFixed(1)}px`);
      }

      const settled =
        !snapEl &&
        Math.abs(rx - tx) < 0.2 &&
        Math.abs(ry - ty) < 0.2 &&
        Math.abs(dx - tx) < 0.2 &&
        Math.abs(scale - targetScale) < 0.002;
      if (!settled) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const syncState = () => {
      root.dataset.state =
        root.dataset.pressed === "true"
          ? "pressed"
          : snapEl
            ? "snap"
            : root.dataset.hover === "true"
              ? "hover"
              : "idle";
    };
    const show = (on: boolean) => {
      if (visible === on) return;
      visible = on;
      root.dataset.visible = String(on);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        show(false);
        return;
      }
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        // Appear in place instead of flying in from the last position.
        dx = rx = tx;
        dy = ry = ty;
      }
      show(true);
      wake();
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target instanceof Element ? e.target : null;
      const hit = target?.closest<HTMLElement>(INTERACTIVE) ?? null;
      const disabled = hit?.matches(":disabled, [aria-disabled='true']") ?? false;
      const text = hit?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      const snap = target?.closest<HTMLElement>("[data-snap]") ?? null;
      if (snap && !snap.matches(":disabled")) {
        snapEl = snap;
        root.dataset.snap = "true";
      } else if (snapEl) {
        release();
      }
      targetScale = snapEl ? SNAP_SCALE : hit && !disabled ? 1.75 : 1;
      root.dataset.hover = String(Boolean(hit) && !disabled);
      label.textContent = text;
      root.dataset.label = String(Boolean(text) && !disabled);
      const forced = target?.closest<HTMLElement>("[data-cursor-theme]")?.dataset.cursorTheme;
      if (forced === "light" || forced === "dark") root.dataset.ring = forced;
      else delete root.dataset.ring;
      const zone = target?.closest<HTMLElement>("[data-theme]")?.dataset.theme;
      root.dataset.theme = zone === "daybreak" ? "daybreak" : "storm";
      syncState();
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        show(false);
        return;
      }
      root.dataset.pressed = "true";
      targetScale *= 0.85;
      syncState();
      wake();
    };
    const onUp = () => {
      root.dataset.pressed = "false";
      targetScale = snapEl ? SNAP_SCALE : root.dataset.hover === "true" ? 1.75 : 1;
      syncState();
      wake();
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) show(false);
    };
    const onBlur = () => show(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseout", onLeave, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scanRaf);
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("blur", onBlur);
      delete html.dataset.lantern;
      html.style.removeProperty("--lx");
      html.style.removeProperty("--ly");
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-visible="false"
      data-hover="false"
      data-snap="false"
      data-state="idle"
      data-label="false"
      data-theme="storm"
      data-overlay="cursor"
      aria-hidden="true"
    >
      <div ref={discRef} className={styles.disc} />
      <div ref={ringRef} className={styles.ring} />
      <span ref={labelRef} className={styles.label} />
    </div>
  );
}
