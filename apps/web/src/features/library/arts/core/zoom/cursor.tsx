"use client";

/**
 * The cursor of the zoom: a dark disc with a plus and the words ZOOM IN over a picture that opens,
 * a minus and ZOOM OUT over the open picture. It is one element, moved with `transform` by one
 * frame loop that sleeps when the pointer rests, and it is there only for a fine pointer (a mouse
 * or a pen). A touch screen has none: a tap does the work.
 *
 * It takes over from the site's lantern only while it shows: the lantern's ring fades out and the
 * native cursor is hidden on the one element under the pointer, and both come back the moment the
 * pointer leaves a `data-zoom` element. Nothing is written to `<html>` or `<body>`. What is under
 * the pointer is read when the pointer moves (`closest("[data-zoom]")`, a few ancestors) and again
 * when the page scrolls or a layer opens under a pointer that is not moving (`recheckZoomCursor`).
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useMediaQuery, useMounted } from "@/lib/hooks";

import styles from "./cursor.module.css";

type Mode = "none" | "in" | "out";

const TARGET = '[data-zoom="in"], [data-zoom="out"]';
/** Spring: stiffness and damping ratio (a little under 1 gives a soft overshoot). */
const STIFFNESS = 430;
const DAMPING = 2 * 0.8 * Math.sqrt(STIFFNESS);

let recheck: (() => void) | null = null;
let onLinger: ((id: string) => void) | null = null;

/** Read what is under the pointer again (a layer opened or closed, or the page moved under it). */
export function recheckZoomCursor(): void {
  recheck?.();
}

/**
 * Be told when the pointer has rested on a tile for a moment (`data-zoom-id`): the provider warms
 * that picture's preview, so it is in by the time the press has grown the picture. One handler.
 */
export function setZoomLingerHandler(handler: ((id: string) => void) | null): void {
  onLinger = handler;
}

/** How long the pointer rests on a tile before its preview is warmed. */
const LINGER_MS = 140;

function zoomTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(TARGET) : null;
}

export function ZoomCursor() {
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");
  const mounted = useMounted();
  if (!mounted || !fine) return null;
  return createPortal(<Cursor />, document.body);
}

function Cursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const follow = followRef.current;
    if (!root || !follow) return;

    let mode: Mode = "none";
    // The pointer, the follower and its speed.
    let px = 0;
    let py = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let known = false;
    let raf = 0;
    let last = 0;
    let timer = 0;
    // What was changed on the page, to put back.
    let hidden: HTMLElement | null = null;
    let hiddenWas = "";
    let lantern: HTMLElement | null = null;
    let lingerTimer = 0;
    let lingerOn: HTMLElement | null = null;

    const hideNative = (el: HTMLElement | null) => {
      if (el === hidden) return;
      if (hidden) hidden.style.cursor = hiddenWas;
      hidden = el;
      if (el) {
        hiddenWas = el.style.cursor;
        el.style.cursor = "none";
      }
    };

    const dimLantern = (on: boolean) => {
      if (on) {
        lantern = lantern?.isConnected
          ? lantern
          : document.querySelector<HTMLElement>('[data-overlay="cursor"]');
        lantern?.style.setProperty("opacity", "0");
      } else {
        lantern?.style.removeProperty("opacity");
      }
    };

    const draw = () => {
      follow.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      // Two small steps when a frame was long, so the spring never blows up.
      const steps = dt > 0.022 ? 2 : 1;
      const h = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        vx += ((px - x) * STIFFNESS - vx * DAMPING) * h;
        vy += ((py - y) * STIFFNESS - vy * DAMPING) * h;
        x += vx * h;
        y += vy * h;
      }
      draw();
      const rest =
        Math.abs(px - x) < 0.1 &&
        Math.abs(py - y) < 0.1 &&
        Math.abs(vx) < 0.5 &&
        Math.abs(vy) < 0.5;
      if (rest) {
        x = px;
        y = py;
        draw();
      } else if (mode !== "none") {
        raf = requestAnimationFrame(frame);
      }
    };

    const wake = () => {
      if (!raf && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const setMode = (next: Mode, el: HTMLElement | null) => {
      if (next === mode) {
        if (next !== "none") hideNative(el);
        return;
      }
      const was = mode;
      mode = next;
      if (next === "none") {
        root.dataset.mode = "none";
        root.dataset.pressed = "false";
        hideNative(null);
        dimLantern(false);
        return;
      }
      if (was === "none") {
        // It appears in place, never flying in from where it last was.
        x = px;
        y = py;
        vx = 0;
        vy = 0;
        draw();
        dimLantern(true);
      }
      root.dataset.mode = next;
      hideNative(el);
      wake();
    };

    const read = (target: EventTarget | null) => {
      const el = zoomTarget(target);
      const kind = el?.dataset.zoom;
      setMode(kind === "in" || kind === "out" ? kind : "none", kind ? el : null);
      const tile = kind === "in" ? el : null;
      if (tile === lingerOn) return;
      lingerOn = tile;
      window.clearTimeout(lingerTimer);
      const id = tile?.dataset.zoomId;
      if (id) lingerTimer = window.setTimeout(() => onLinger?.(id), LINGER_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        known = false;
        setMode("none", null);
        return;
      }
      px = e.clientX;
      py = e.clientY;
      known = true;
      read(e.target);
      if (mode !== "none") wake();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || mode === "none") return;
      root.dataset.pressed = "true";
    };
    const onUp = () => {
      root.dataset.pressed = "false";
    };

    const leave = () => {
      known = false;
      setMode("none", null);
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) leave();
    };

    const again = () => {
      if (!known) return;
      read(document.elementFromPoint(px, py));
      if (mode !== "none") wake();
    };
    recheck = again;
    // The page moves under a pointer that rests (a wheel turn, a row that slides): look again soon.
    const onScroll = () => {
      if (timer || !known) return;
      timer = window.setTimeout(() => {
        timer = 0;
        again();
      }, 90);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", leave);
    document.addEventListener("mouseout", onOut, { passive: true });

    return () => {
      if (recheck === again) recheck = null;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(lingerTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", leave);
      document.removeEventListener("mouseout", onOut);
      hideNative(null);
      dimLantern(false);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-overlay="zoom-cursor"
      data-mode="none"
      data-pressed="false"
      aria-hidden="true"
    >
      <div ref={followRef} className={styles.follow}>
        <div className={styles.mark}>
          <i className={styles.tick} data-at="n" />
          <i className={styles.tick} data-at="e" />
          <i className={styles.tick} data-at="s" />
          <i className={styles.tick} data-at="w" />
          <span className={styles.glyph}>
            <i className={styles.bar} data-axis="x" />
            <i className={styles.bar} data-axis="y" />
            <i className={styles.dot} />
          </span>
        </div>
        <span className={styles.label}>
          <span className={styles.word} data-for="in">
            Zoom in
          </span>
          <span className={styles.word} data-for="out">
            Zoom out
          </span>
        </span>
      </div>
    </div>
  );
}
