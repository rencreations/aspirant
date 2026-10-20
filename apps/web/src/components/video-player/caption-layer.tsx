"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import {
  captionFontPx,
  CAPTION_MAX_WIDTH,
  clampCaption,
  containRect,
  cueLines,
  type CaptionSettings,
  type Rect,
} from "./caption-math";
import styles from "./caption-layer.module.css";

/** The words of the cues that are on now, as lines. The browser loads the track but draws nothing. */
function useActiveCues(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): string[] {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !enabled) {
      setLines([]);
      return;
    }
    const listening: TextTrack[] = [];
    const read = () => {
      const out: string[] = [];
      for (const track of listening) {
        for (const cue of Array.from(track.activeCues ?? [])) {
          out.push(...cueLines((cue as VTTCue).text ?? ""));
        }
      }
      setLines((before) =>
        before.length === out.length && before.every((l, i) => l === out[i]) ? before : out,
      );
    };
    const attach = () => {
      for (const track of Array.from(el.textTracks)) {
        if (listening.includes(track)) continue;
        // "Hidden": the cues load and fire their events, and the browser draws none of them.
        track.mode = "hidden";
        track.addEventListener("cuechange", read);
        listening.push(track);
      }
      read();
    };
    attach();
    el.textTracks.addEventListener("addtrack", attach);
    el.addEventListener("loadedmetadata", attach);
    return () => {
      el.textTracks.removeEventListener("addtrack", attach);
      el.removeEventListener("loadedmetadata", attach);
      for (const track of listening) track.removeEventListener("cuechange", read);
      setLines([]);
    };
  }, [videoRef, enabled]);
  return lines;
}

/** What the settings panel can ask of the captions. */
export interface CaptionControl {
  /** Move the captions one step (-1, 0 or 1 on each axis), kept on the picture. */
  nudge: (dx: number, dy: number) => void;
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  settings: CaptionSettings;
  /** Called with the new place while it is dragged, and `done` once when the drag ends. */
  onChange: (next: Partial<CaptionSettings>, done: boolean) => void;
  /** The settings panel is open: show sample words so the changes can be seen. */
  preview: boolean;
  control: RefObject<CaptionControl | null>;
}

const SAMPLE = "Captions look like this.";
const STEP = 0.02;

/**
 * The captions of the player: a plate with the words of the cue that is on, over the picture. The
 * viewer can drag it anywhere on the picture, and change its size and background (see the settings
 * panel of the player). It lives over the picture itself (not the screen), so the place it was
 * given stays on the same part of the picture at any size, and it is kept inside the picture.
 */
export function CaptionLayer({ videoRef, settings, onChange, preview, control }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const lines = useActiveCues(videoRef, settings.on);
  const [area, setArea] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; sx: number; sy: number; x: number; y: number } | null>(null);

  // The picture is fitted inside the player, so the captions are placed on the picture, not on the
  // whole player.
  useLayoutEffect(() => {
    const el = layer.current;
    const video = videoRef.current;
    if (!el) return;
    const measure = () => {
      const next = containRect(
        el.clientWidth,
        el.clientHeight,
        video?.videoWidth ?? 0,
        video?.videoHeight ?? 0,
      );
      setArea((a) =>
        a.left === next.left &&
        a.top === next.top &&
        a.width === next.width &&
        a.height === next.height
          ? a
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    video?.addEventListener("loadedmetadata", measure);
    video?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      video?.removeEventListener("loadedmetadata", measure);
      video?.removeEventListener("resize", measure);
    };
  }, [videoRef]);

  // The size of the plate (it changes with the words and the text size), to keep it on the picture.
  useLayoutEffect(() => {
    if (!boxEl) return;
    const measure = () => {
      setBoxSize((b) =>
        b.w === boxEl.offsetWidth && b.h === boxEl.offsetHeight
          ? b
          : { w: boxEl.offsetWidth, h: boxEl.offsetHeight },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boxEl);
    return () => {
      ro.disconnect();
    };
  }, [boxEl]);

  const words = lines.length > 0 ? lines : preview ? [SAMPLE] : [];
  const fontPx = captionFontPx(area.height, settings.size);

  /** The place, kept on the picture, for the size the plate has now. */
  const keep = useCallback(
    (x: number, y: number) => clampCaption(x, y, boxSize.w, boxSize.h, area.width, area.height),
    [boxSize.w, boxSize.h, area.width, area.height],
  );

  const place = keep(settings.x, settings.y);

  useImperativeHandle(
    control,
    () => ({
      nudge: (dx, dy) => {
        onChange(keep(place.x + dx * STEP * 2, place.y + dy * STEP * 2), true);
      },
    }),
    [keep, onChange, place.x, place.y],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: place.x, y: place.y };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = layer.current;
    if (d?.id !== e.pointerId || !el || area.width <= 0) return;
    // The player may be scaled while it opens: measure the screen size of the picture.
    const r = el.getBoundingClientRect();
    const k = el.clientWidth > 0 ? r.width / el.clientWidth : 1;
    const next = keep(
      d.x + (e.clientX - d.sx) / (area.width * k),
      d.y + (e.clientY - d.sy) / (area.height * k),
    );
    onChange(next, false);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onChange({}, true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dx = e.key === "ArrowLeft" ? -STEP : e.key === "ArrowRight" ? STEP : 0;
    const dy = e.key === "ArrowUp" ? -STEP : e.key === "ArrowDown" ? STEP : 0;
    if (dx === 0 && dy === 0) return;
    // The arrow keys move the captions here, and do not seek or change the volume.
    e.preventDefault();
    e.stopPropagation();
    onChange(keep(place.x + dx, place.y + dy), true);
  };

  const areaStyle: CSSProperties = {
    left: area.left,
    top: area.top,
    width: area.width,
    height: area.height,
  };

  return (
    <div ref={layer} className={styles.layer}>
      <div className={styles.area} style={areaStyle}>
        {words.length > 0 && area.width > 0 ? (
          <div
            ref={setBoxEl}
            className={styles.caption}
            role="group"
            aria-label="Captions. Drag to move them, or use the arrow keys."
            tabIndex={-1}
            data-zone="button"
            data-bg={settings.background}
            data-dragging={dragging}
            data-preview={lines.length === 0}
            style={{
              left: `${place.x * 100}%`,
              top: `${place.y * 100}%`,
              fontSize: `${fontPx}px`,
              maxWidth: `${CAPTION_MAX_WIDTH * 100}%`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {words.map((line, i) => (
              <span key={`${i}-${line}`}>{line}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
