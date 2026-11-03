"use client";

/**
 * A plain picture viewer for the story. A picture in the text is a button; pressing it opens the
 * picture large over the page. Press the picture to zoom in on the spot you pressed, press it again
 * to zoom out (like a messaging app). While zoomed in, drag to move it. Press the empty space around
 * the picture, the close button or Esc to close. Nothing else: no wheel, no gallery, no toolbar.
 * Only transform moves.
 */
import { Dialog } from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import type { ImageMedia } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import s from "./reader.module.css";

interface Shown {
  readonly src: string;
  readonly alt: string;
  readonly w: number;
  readonly h: number;
}

const ViewerContext = createContext<(picture: Shown) => void>(() => undefined);

/** How far a press zooms in. */
const ZOOM = 2.6;
/** A press that moves less than this (px) is a press, not a drag. */
const DRAG_SLOP = 5;

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [picture, setPicture] = useState<Shown | null>(null);
  const open = useCallback((next: Shown) => {
    audio.blip("click");
    setPicture(next);
  }, []);
  return (
    <ViewerContext.Provider value={open}>
      {children}
      {/* A new picture is a new viewer, so it always opens whole. */}
      <Viewer key={picture?.src ?? "closed"} picture={picture} onClose={() => setPicture(null)} />
    </ViewerContext.Provider>
  );
}

function clampAxis(value: number, shown: number, view: number): number {
  const half = (shown - view) / 2;
  if (half <= 0) return 0;
  return Math.max(-half, Math.min(half, value));
}

function Viewer({ picture, onClose }: { picture: Shown | null; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const press = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(
    null,
  );
  const { pause, resume } = useLenis();

  useEffect(() => {
    if (!picture) return;
    pause();
    return resume;
  }, [picture, pause, resume]);

  const fit = useCallback((x: number, y: number, scale: number) => {
    const el = img.current;
    const box = stage.current;
    if (!el || !box) return { x, y };
    return {
      x: clampAxis(x, el.offsetWidth * scale, box.clientWidth),
      y: clampAxis(y, el.offsetHeight * scale, box.clientHeight),
    };
  }, []);

  const toggle = useCallback(
    (clientX: number, clientY: number) => {
      const el = img.current;
      if (!el) return;
      if (zoomed) {
        setZoomed(false);
        setPos({ x: 0, y: 0 });
        return;
      }
      // Keep the pressed spot where it is while the picture grows.
      const r = el.getBoundingClientRect();
      const dx = clientX - (r.left + r.width / 2);
      const dy = clientY - (r.top + r.height / 2);
      setZoomed(true);
      setPos(fit(-dx * (ZOOM - 1), -dy * (ZOOM - 1), ZOOM));
    },
    [zoomed, fit],
  );

  const onDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false };
  };

  const onMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const p = press.current;
    if (!p || !zoomed) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!p.moved) {
      p.moved = true;
      setDragging(true);
    }
    setPos(fit(p.px + dx, p.py + dy, ZOOM));
  };

  const onUp = (e: ReactPointerEvent<HTMLImageElement>) => {
    const p = press.current;
    press.current = null;
    setDragging(false);
    if (p && !p.moved) toggle(e.clientX, e.clientY);
  };

  return (
    <Dialog.Root open={picture !== null} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.viewerOverlay} />
        <Dialog.Content
          className={s.viewer}
          data-lenis-prevent=""
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <Dialog.Title className="sr-only">{`Picture: ${picture?.alt ?? ""}`}</Dialog.Title>
          <div
            ref={stage}
            className={s.viewerStage}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {picture && (
              // Plain <img>: static export, art already sized.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={img}
                className={s.viewerImage}
                src={asset(`/${picture.src}`)}
                alt={picture.alt}
                width={picture.w}
                height={picture.h}
                draggable={false}
                data-zoomed={zoomed}
                data-dragging={dragging}
                data-cursor={zoomed ? "OUT" : "ZOOM"}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoomed ? ZOOM : 1})`,
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={() => {
                  press.current = null;
                  setDragging(false);
                }}
              />
            )}
          </div>
          <Dialog.Close className={s.viewerClose} aria-label="Close the picture">
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * A picture of the text that opens in the viewer. Wide pictures are cropped to their frame in the
 * page, so the viewer shows the whole of it.
 */
export function ZoomImage({ media, eager = false }: { media: ImageMedia; eager?: boolean }) {
  const open = useContext(ViewerContext);
  const picture = useMemo<Shown>(
    () => ({ src: media.src, alt: media.alt, w: media.w, h: media.h }),
    [media],
  );
  return (
    <button
      type="button"
      className={s.zoomHit}
      aria-label={`View larger: ${media.alt}`}
      data-cursor="ZOOM"
      onClick={() => open(picture)}
    >
      {/* Plain <img>: static export, art already sized. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(`/${media.src}`)}
        alt=""
        width={media.w}
        height={media.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
    </button>
  );
}
