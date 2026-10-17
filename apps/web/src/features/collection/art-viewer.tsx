"use client";

import { Dialog } from "radix-ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { clamp, wrap } from "@/lib/math";

import styles from "./dialogs.module.css";
import { pad2 } from "./format";
import { restoreFocusTo, shieldNextHotkey, useModalScrollLock } from "./modal-utils";
import type { ArtItem, FanArtItem } from "./types";

interface ArtViewerProps {
  items: readonly (ArtItem | FanArtItem)[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  label: string;
  opener: HTMLElement | null;
}

const MIN = 1;
const MAX = 6;

interface View {
  s: number;
  x: number;
  y: number;
}

/**
 * Image viewer for art and fan art. Wheel, pinch, double click and the plus and minus keys
 * zoom; drag or the arrow keys pan once zoomed; arrows and swipe move through the set at the
 * normal size. Nothing here offers a download. Fan art always shows its credit and, when we
 * trust it, a link to the original.
 */
export default function ArtViewer({ items, index, onIndexChange, label, opener }: ArtViewerProps) {
  const open = index !== null && items.length > 0;
  const position = index === null ? 0 : wrap(index, items.length);
  const item = open ? items[position] : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ startDist: 0, startScale: 1, dragged: false, startX: 0, startY: 0 });
  const [percent, setPercent] = useState(100);
  const [dragging, setDragging] = useState(false);
  useModalScrollLock(open);

  const apply = useCallback(() => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return;
    const v = view.current;
    const maxX = Math.max(0, (img.offsetWidth * v.s - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * v.s - stage.clientHeight) / 2);
    v.x = clamp(v.x, -maxX, maxX);
    v.y = clamp(v.y, -maxY, maxY);
    img.style.transform = `translate3d(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px, 0) scale(${v.s.toFixed(3)})`;
    setPercent(Math.round(v.s * 100));
  }, []);

  const zoomTo = useCallback(
    (next: number, around?: { x: number; y: number }) => {
      const stage = stageRef.current;
      const v = view.current;
      const s2 = clamp(next, MIN, MAX);
      if (stage && around) {
        const rect = stage.getBoundingClientRect();
        const px = around.x - (rect.left + rect.width / 2);
        const py = around.y - (rect.top + rect.height / 2);
        const k = s2 / v.s;
        v.x = px - (px - v.x) * k;
        v.y = py - (py - v.y) * k;
      }
      v.s = s2;
      if (s2 === 1) {
        v.x = 0;
        v.y = 0;
      }
      apply();
    },
    [apply],
  );

  const reset = useCallback(() => {
    view.current = { s: 1, x: 0, y: 0 };
    apply();
  }, [apply]);

  // A new image starts at the normal size.
  const itemId = item?.id;
  useEffect(() => {
    view.current = { s: 1, x: 0, y: 0 };
    setPercent(100);
    if (imgRef.current) imgRef.current.style.transform = "";
  }, [itemId]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, apply]);

  // Warm the neighbours so stepping feels instant.
  useEffect(() => {
    if (index === null || items.length < 2) return;
    for (const step of [1, -1]) {
      const neighbour = items[wrap(index + step, items.length)];
      if (neighbour) {
        const img = new Image();
        img.decoding = "async";
        img.src = asset(neighbour.src);
      }
    }
  }, [index, items]);

  const go = (step: number) => {
    if (index === null) return;
    audio.blip("click");
    onIndexChange(wrap(position + step, items.length));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    shieldNextHotkey(e);
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const zoomed = view.current.s > 1.01;
    const step = 80;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(view.current.s * 1.35);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomTo(view.current.s / 1.35);
    } else if (e.key === "0") {
      e.preventDefault();
      reset();
    } else if (e.key.startsWith("Arrow")) {
      if (zoomed) {
        e.preventDefault();
        const v = view.current;
        if (e.key === "ArrowLeft") v.x += step;
        if (e.key === "ArrowRight") v.x -= step;
        if (e.key === "ArrowUp") v.y += step;
        if (e.key === "ArrowDown") v.y -= step;
        apply();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomTo(view.current.s * factor, { x: e.clientX, y: e.clientY });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.dragged = false;
    g.startX = e.clientX;
    g.startY = e.clientY;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) g.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.startScale = view.current.s;
    }
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const g = gesture.current;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b && g.startDist > 0) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        zoomTo(g.startScale * (dist / g.startDist), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        g.dragged = true;
      }
      return;
    }
    if (view.current.s > 1.01) {
      view.current.x += e.clientX - prev.x;
      view.current.y += e.clientY - prev.y;
      g.dragged = true;
      apply();
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const wasOne = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    if (wasOne && view.current.s <= 1.01 && e.pointerType !== "mouse") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (view.current.s > 1.01) reset();
    else zoomTo(2.6, { x: e.clientX, y: e.clientY });
  };

  const fan = item?.kind === "fanart" ? item : null;

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-theme="storm" />
        <Dialog.Content
          className={styles.content}
          data-theme="storm"
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            stageRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={restoreFocusTo(opener)}
        >
          <Dialog.Description className="sr-only">
            Image viewer. Plus and minus zoom, zero resets, arrow keys pan when zoomed and change
            the image otherwise. Escape closes.
          </Dialog.Description>
          <div className={styles.head}>
            <div className={styles.headText}>
              <p className={styles.kicker}>
                {label} <strong>{pad2(position + 1)}</strong> / {pad2(items.length)}
              </p>
              <Dialog.Title className={styles.title}>{item?.title ?? label}</Dialog.Title>
            </div>
            <Dialog.Close className={styles.btn} data-square aria-label="Close the viewer">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
              </svg>
            </Dialog.Close>
          </div>

          <div
            ref={stageRef}
            className={styles.viewer}
            tabIndex={0}
            role="group"
            aria-label={`${item?.title ?? "Image"}. Zoom with plus and minus, drag to pan.`}
            data-zoomed={percent > 101}
            data-dragging={dragging && percent > 101}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            {item && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                ref={imgRef}
                className={styles.viewerImg}
                src={asset(item.src)}
                alt={item.alt}
                width={item.width}
                height={item.height}
                decoding="async"
                draggable={false}
                onLoad={apply}
              />
            )}
          </div>

          <div className={styles.foot}>
            <p className={styles.footText}>
              {fan ? (
                <>
                  <span>Art: {fan.credit}.</span>{" "}
                  {fan.url ? (
                    <a href={fan.url} target="_blank" rel="noopener noreferrer">
                      View the original
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span>No link is known for this piece.</span>
                  )}
                </>
              ) : (
                item?.alt
              )}
            </p>
            <div className={styles.tools}>
              <button
                type="button"
                className={styles.btn}
                data-square
                onClick={() => zoomTo(view.current.s / 1.35)}
                aria-label="Zoom out"
                disabled={percent <= 100}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button type="button" className={styles.btn} onClick={reset} aria-label="Reset zoom">
                <span className={styles.zoomReadout}>{percent}%</span>
              </button>
              <button
                type="button"
                className={styles.btn}
                data-square
                onClick={() => zoomTo(view.current.s * 1.35)}
                aria-label="Zoom in"
                disabled={percent >= MAX * 100}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    className={styles.btn}
                    data-square
                    onClick={() => go(-1)}
                    aria-label="Previous image"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    data-square
                    onClick={() => go(1)}
                    aria-label="Next image"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
