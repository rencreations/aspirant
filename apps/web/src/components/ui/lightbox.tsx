"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { wrap } from "@/lib/math";

import styles from "./lightbox.module.css";

/** One item in a <Lightbox>. */
export interface LightboxItem {
  type: "image" | "video";
  /** Public path (passed through asset()). */
  src: string;
  /** Text alternative (images) or a short description (videos). */
  alt: string;
  width: number;
  height: number;
  caption?: ReactNode;
  /** Artist or source credit. Fan art must always carry one. */
  credit?: { name: string; href?: string };
  /** Poster image for videos (public path). */
  poster?: string;
}

export interface LightboxProps {
  items: readonly LightboxItem[];
  /** Index of the open item, or null when closed. */
  index: number | null;
  /** Called with the new index, or null to close. */
  onIndexChange: (index: number | null) => void;
  /** Name of the collection, used in the dialog title. Default "Gallery". */
  label?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={dir === "left" ? "M10 2L4 8l6 6" : "M6 2l6 6-6 6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Modal viewer for images and videos (Radix Dialog): focus is trapped and returns to the
 * opener, Esc closes, arrow keys and the Previous and Next buttons move through the items
 * (looping), and a horizontal swipe does the same on touch. Page scrolling pauses while open.
 *
 * const [i, setI] = useState<number | null>(null);
 * <Lightbox items={art} index={i} onIndexChange={setI} label="Fan art" />
 */
export function Lightbox({ items, index, onIndexChange, label = "Gallery" }: LightboxProps) {
  const open = index !== null && items.length > 0;
  const current = open ? items[wrap(index, items.length)] : undefined;
  const { pause, resume } = useLenis();
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  // Warm the neighbours so moving through the set feels instant.
  useEffect(() => {
    if (index === null || items.length < 2) return;
    for (const step of [1, -1]) {
      const item = items[wrap(index + step, items.length)];
      if (item?.type === "image") {
        const img = new Image();
        img.decoding = "async";
        img.src = asset(item.src);
      }
    }
  }, [index, items]);

  const go = (step: number) => {
    if (index === null) return;
    audio.blip("click");
    onIndexChange(wrap(index + step, items.length));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (s?.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  };

  const position = index === null ? 0 : wrap(index, items.length) + 1;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-theme="storm" />
        <Dialog.Content
          className={styles.content}
          data-theme="storm"
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        >
          <div className={styles.head}>
            <Dialog.Title className={styles.counter}>
              <span className="sr-only">
                {label}, item {position} of {items.length}
              </span>
              <span aria-hidden="true">
                {label} <strong>{pad(position)}</strong> / {pad(items.length)}
              </span>
            </Dialog.Title>
            <Dialog.Close className={styles.button} aria-label="Close">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </Dialog.Close>
          </div>

          <div
            className={styles.stage}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            {current && (
              <figure key={`${current.src}-${position}`} className={styles.frame}>
                {current.type === "image" ? (
                  // Static export: plain <img> with object-fit contain inside the stage.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.media}
                    src={asset(current.src)}
                    alt={current.alt}
                    width={current.width}
                    height={current.height}
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <video
                    className={styles.media}
                    src={asset(current.src)}
                    poster={current.poster ? asset(current.poster) : undefined}
                    width={current.width}
                    height={current.height}
                    aria-label={current.alt}
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
              </figure>
            )}
          </div>

          <div className={styles.foot}>
            <div>
              {current?.caption != null && <p className={styles.caption}>{current.caption}</p>}
              {current?.credit && (
                <p className={styles.credit}>
                  Art:{" "}
                  {current.credit.href ? (
                    <a href={current.credit.href} target="_blank" rel="noopener noreferrer">
                      {current.credit.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    current.credit.name
                  )}
                </p>
              )}
            </div>
            {items.length > 1 && (
              <div className={styles.nav}>
                <button type="button" className={styles.button} onClick={() => go(-1)}>
                  <Chevron dir="left" />
                  <span className="sr-only">Previous</span>
                </button>
                <button type="button" className={styles.button} onClick={() => go(1)}>
                  <Chevron dir="right" />
                  <span className="sr-only">Next</span>
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
