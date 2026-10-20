"use client";

import { Dialog } from "radix-ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { wrap } from "@/lib/math";
import { mediaUrl } from "@/lib/media-store";

import {
  clampPan,
  clampZoom,
  fitScale,
  naturalZoom,
  wheelZoom,
  zoomAround,
  zoomPercent,
  type Box,
  type View,
} from "./image-viewer-math";
import styles from "./image-viewer.module.css";

/** One picture in the viewer. */
export interface ViewerImage {
  /** The full size (a public path). */
  src: string;
  /** The small size, shown while the full one loads (a public path). */
  thumb: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  /** Pictures of one set (a post, the official art) belong together: the strip shows them. */
  set: string;
  /** The name of the set, for the info card, for example "Fan art by jlen_ismyname". */
  setLabel: string;
  credit: { name: string; platform: string; href?: string };
}

interface Props {
  items: readonly ViewerImage[];
  /** The open picture, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Name of the whole collection, for the dialog's title. */
  label: string;
  /** Colours for a character's page: the ground, the keyline and the accent of the links. */
  skin?: { ground: string; keyline: string; accent: string };
}

const FIT: View = { z: 1, x: 0, y: 0 };
/** Two taps this close together, in time and in place, are a double tap. */
const DOUBLE_TAP_MS = 320;
const TAP_SLOP = 10;
const SWIPE_MIN = 56;

function Icon({ d, label }: { d: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON = {
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  full: "M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8h.01M12 11v5",
  link: "M10 14l4-4M8.5 15.5l-1 1a3 3 0 004.2 4.2l1-1M15.5 8.5l1-1a3 3 0 00-4.2-4.2l-1 1",
};

/**
 * A viewer for pictures, built for looking closely. It opens in a dialog (focus is kept inside and
 * goes back to what opened it, Esc closes) and shows one picture at a time:
 *
 *  - Zoom with the wheel or a trackpad pinch (around the pointer), two fingers on a screen, a
 *    double click or double tap, the + and - buttons or keys, `0` for the whole picture and `1`
 *    for its natural size. The picture can be zoomed to three times its natural size.
 *  - Move a zoomed picture by dragging it or with the arrow keys.
 *  - Previous and next with the buttons, the arrow keys (when the picture is not zoomed), Home and
 *    End, or a swipe. The strip below shows the other pictures of the same post and jumps to them.
 *  - The info card (`i`) names the piece and links to where it came from. `f` goes full screen.
 *
 * The picture is moved and scaled with one `transform`, set directly from the gestures, so nothing
 * but the compositor works while it moves. The small size shows while the full size loads, and the
 * pictures on either side are loaded ahead.
 */
export function ImageViewer({ items, index, onIndexChange, label, skin }: Props) {
  const skinStyle = skin
    ? ({
        "--viewer-bg": skin.ground,
        "--light-gold": skin.keyline,
        "--light-cyan": skin.accent,
      } as React.CSSProperties)
    : undefined;
  const open = index !== null && items.length > 0;
  const at = open ? wrap(index, items.length) : 0;
  const item = open ? items[at] : undefined;
  const { pause, resume } = useLenis();

  const content = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // The dialog's content mounts a moment after `open` turns true, so the effects below follow the
  // element itself, and not the moment the viewer opens.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage.current = el;
    setStageEl(el);
  }, []);
  const img = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const view = useRef<View>({ ...FIT });
  const box = useRef<Box>({ cw: 1, ch: 1, iw: 1, ih: 1 });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [info, setInfo] = useState(true);
  const loaded = loadedSrc === item?.src;

  // The page does not scroll while the viewer is open.
  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  /** Write the view to the picture. `animated` eases it (buttons, keys, double tap), not a drag. */
  const apply = useCallback((animated = false) => {
    const el = img.current;
    if (!el) return;
    const v = view.current;
    const b = box.current;
    if (animated && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.ease = "true";
      window.setTimeout(() => {
        delete el.dataset.ease;
      }, 280);
    }
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${fitScale(b) * v.z})`;
    if (readout.current) readout.current.textContent = `${zoomPercent(v.z, b)}%`;
    stage.current?.setAttribute("data-zoomed", String(v.z > 1.02));
  }, []);

  const setView = useCallback(
    (next: View, animated = false) => {
      view.current = next;
      apply(animated);
    },
    [apply],
  );

  const zoomTo = useCallback(
    (z: number, px = 0, py = 0, animated = true) => {
      setView(zoomAround(view.current, z, px, py, box.current), animated);
    },
    [setView],
  );

  const go = useCallback(
    (delta: number) => {
      if (!open) return;
      audio.blip("click");
      onIndexChange(wrap(at + delta, items.length));
    },
    [open, at, items.length, onIndexChange],
  );

  // The picture starts whole in the middle, and follows the size of the stage.
  useEffect(() => {
    const el = stageEl;
    if (!open || !el || !item) return;
    const measure = () => {
      box.current = { cw: el.clientWidth, ch: el.clientHeight, iw: item.width, ih: item.height };
      const [x, y] = clampPan(view.current.x, view.current.y, view.current.z, box.current);
      view.current = { z: clampZoom(view.current.z, box.current), x, y };
      apply();
    };
    view.current = { ...FIT };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [open, item, apply, stageEl]);

  // The pictures on either side are loaded ahead, so moving through them is quick.
  useEffect(() => {
    if (!open || items.length < 2) return;
    for (const step of [1, -1]) {
      const near = items[wrap(at + step, items.length)];
      if (near) new Image().src = mediaUrl(near.src);
    }
  }, [open, at, items]);

  // Wheel and pinch on a trackpad: native, because the page must be told not to scroll.
  useEffect(() => {
    const el = stageEl;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left - r.width / 2;
      const py = e.clientY - r.top - r.height / 2;
      const v = view.current;
      if (v.z <= 1.001 && e.deltaY > 0 && !e.ctrlKey) return;
      setView(zoomAround(v, wheelZoom(v.z, e.deltaY, e.ctrlKey), px, py, box.current));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [open, setView, stageEl]);

  // Pointer gestures: drag to move, two fingers to pinch, a swipe to change picture, a double tap.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    start: { x: 0, y: 0 },
    v0: { ...FIT },
    d0: 1,
    c0: { x: 0, y: 0 },
    moved: false,
    lastTap: { t: 0, x: 0, y: 0 },
  });

  const rel = (x: number, y: number) => {
    const r = stage.current?.getBoundingClientRect();
    return r ? { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 } : { x: 0, y: 0 };
  };

  const rebase = () => {
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    g.v0 = { ...view.current };
    if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      g.d0 = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      g.c0 = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (pts[0]) {
      g.start = { x: pts[0].x, y: pts[0].y };
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    stage.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = pointers.current.size > 1;
    rebase();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      const zoomed = zoomAround(g.v0, g.v0.z * (d / g.d0), g.c0.x, g.c0.y, box.current);
      const [x, y] = clampPan(
        zoomed.x + (c.x - g.c0.x),
        zoomed.y + (c.y - g.c0.y),
        zoomed.z,
        box.current,
      );
      g.moved = true;
      setView({ z: zoomed.z, x, y });
      return;
    }
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (g.v0.z > 1.02) {
      const [x, y] = clampPan(g.v0.x + dx, g.v0.y + dy, g.v0.z, box.current);
      setView({ z: g.v0.z, x, y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const had = pointers.current.has(e.pointerId);
    const single = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (!had) return;
    if (!single) {
      rebase();
      return;
    }
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    // A swipe, when the picture is whole: the next or the previous one.
    if (
      g.moved &&
      view.current.z <= 1.02 &&
      Math.abs(dx) > SWIPE_MIN &&
      Math.abs(dy) < Math.abs(dx) * 0.6
    ) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (g.moved) return;
    // A tap. Two of them close together zoom in on the point, or back out.
    const now = performance.now();
    const last = g.lastTap;
    if (now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
      g.lastTap = { t: 0, x: 0, y: 0 };
      const p = rel(e.clientX, e.clientY);
      if (view.current.z > 1.05) setView({ ...FIT }, true);
      else zoomTo(Math.max(2.6, naturalZoom(box.current)), p.x, p.y);
      return;
    }
    g.lastTap = { t: now, x: e.clientX, y: e.clientY };
  };

  const toggleFullscreen = () => {
    const el = content.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // Enter and Space belong to the button that has focus.
    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).closest("button, a"))
      return;
    const zoomed = view.current.z > 1.02;
    const v = view.current;
    const pan = (dx: number, dy: number) => {
      const [x, y] = clampPan(v.x + dx, v.y + dy, v.z, box.current);
      setView({ z: v.z, x, y }, true);
    };
    switch (e.key) {
      case "ArrowLeft":
        if (zoomed) pan(90, 0);
        else go(-1);
        break;
      case "ArrowRight":
        if (zoomed) pan(-90, 0);
        else go(1);
        break;
      case "ArrowUp":
        if (zoomed) pan(0, 90);
        break;
      case "ArrowDown":
        if (zoomed) pan(0, -90);
        break;
      case "+":
      case "=":
        zoomTo(v.z * 1.5);
        break;
      case "-":
      case "_":
        zoomTo(v.z / 1.5);
        break;
      case "0":
        setView({ ...FIT }, true);
        break;
      case "1":
        zoomTo(naturalZoom(box.current));
        break;
      case "i":
      case "I":
        setInfo((s) => !s);
        break;
      case "f":
      case "F":
        toggleFullscreen();
        break;
      case "Home":
        onIndexChange(0);
        break;
      case "End":
        onIndexChange(items.length - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  // The strip of the pictures of the same set.
  const set = item
    ? items.map((it, idx) => ({ it, idx })).filter((x) => x.it.set === item.set)
    : [];
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const current = stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [at, open, stageEl]);

  const here = set.findIndex((x) => x.idx === at);
  const crumb: ReactNode = item ? (
    <>
      <span>{item.setLabel}</span>
      {set.length > 1 ? (
        <span>
          {here + 1} of {set.length}
        </span>
      ) : null}
    </>
  ) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onIndexChange(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} style={skinStyle} />
        <Dialog.Content
          ref={content}
          className={styles.viewer}
          style={skinStyle}
          data-cursor-theme="light"
          data-lenis-prevent
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            // Remember what opened the viewer (it has no trigger of its own, so the dialog cannot
            // give focus back by itself), and focus the stage, so the keys work at once and no
            // button shows a ring.
            e.preventDefault();
            const from = document.activeElement;
            returnTo.current = from instanceof HTMLElement ? from : null;
            stage.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const to = returnTo.current;
            returnTo.current = null;
            if (to?.isConnected) to.focus({ preventScroll: true });
          }}
          aria-describedby="viewer-help"
        >
          <Dialog.Title className="sr-only">{`${label}: ${item?.title ?? ""}`}</Dialog.Title>
          <Dialog.Description id="viewer-help" className="sr-only">
            Arrow keys change picture. Plus and minus zoom, 0 shows the whole picture, 1 shows it at
            its natural size. Drag a zoomed picture to move it. I shows or hides the details, F goes
            full screen, Escape closes.
          </Dialog.Description>

          <div className={styles.bar} data-ui>
            <p className={styles.count} aria-hidden="true">
              {open ? `${at + 1} / ${items.length}` : ""}
            </p>
            <div className={styles.tools} role="toolbar" aria-label="Picture tools">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => zoomTo(view.current.z / 1.5)}
              >
                <Icon d={ICON.minus} />
              </button>
              <span ref={readout} className={styles.readout} aria-live="off">
                100%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => zoomTo(view.current.z * 1.5)}
              >
                <Icon d={ICON.plus} />
              </button>
              <button
                type="button"
                aria-label="Whole picture"
                onClick={() => setView({ ...FIT }, true)}
              >
                <Icon d={ICON.fit} />
              </button>
              <button
                type="button"
                aria-label="Natural size"
                className={styles.natural}
                onClick={() => zoomTo(naturalZoom(box.current))}
              >
                1:1
              </button>
              <button
                type="button"
                aria-label="Details"
                aria-pressed={info}
                onClick={() => {
                  setInfo((s) => !s);
                }}
              >
                <Icon d={ICON.info} />
              </button>
              <button
                type="button"
                aria-label="Full screen"
                className={styles.full}
                onClick={toggleFullscreen}
              >
                <Icon d={ICON.full} />
              </button>
              <Dialog.Close className={styles.close} aria-label="Close">
                <Icon d={ICON.close} />
              </Dialog.Close>
            </div>
          </div>

          <div
            ref={stageRef}
            className={styles.stage}
            tabIndex={-1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {item ? (
              <>
                {/* The sheet is moved and scaled; the small size shows under the full one until it is in. */}
                <div
                  key={item.src}
                  ref={img}
                  className={styles.sheet}
                  data-loaded={loaded}
                  style={{
                    width: item.width,
                    height: item.height,
                    marginLeft: -item.width / 2,
                    marginTop: -item.height / 2,
                  }}
                >
                  {/* Plain <img>: static export. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.under}
                    src={mediaUrl(item.thumb)}
                    alt=""
                    draggable={false}
                    aria-hidden="true"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.picture}
                    src={mediaUrl(item.src)}
                    alt={item.alt}
                    draggable={false}
                    onLoad={() => {
                      setLoadedSrc(item.src);
                    }}
                  />
                </div>
              </>
            ) : null}

            {set.length > 1 || open ? (
              <>
                <button
                  type="button"
                  className={styles.nav}
                  data-ui
                  data-side="left"
                  aria-label="Previous picture"
                  disabled={items.length < 2}
                  onClick={() => {
                    go(-1);
                  }}
                >
                  <Icon d={ICON.left} />
                </button>
                <button
                  type="button"
                  className={styles.nav}
                  data-ui
                  data-side="right"
                  aria-label="Next picture"
                  disabled={items.length < 2}
                  onClick={() => {
                    go(1);
                  }}
                >
                  <Icon d={ICON.right} />
                </button>
              </>
            ) : null}
          </div>

          <div className={styles.foot} data-ui>
            {set.length > 1 ? (
              <div
                ref={stripRef}
                className={styles.strip}
                role="group"
                aria-label={`Pictures of ${item?.setLabel ?? ""}`}
              >
                {set.map(({ it, idx }, k) => (
                  <button
                    key={it.src}
                    type="button"
                    aria-label={`Picture ${k + 1} of ${set.length}`}
                    aria-current={idx === at}
                    style={{ aspectRatio: `${it.width} / ${it.height}` }}
                    onClick={() => {
                      onIndexChange(idx);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(it.thumb)} alt="" draggable={false} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            {info && item ? (
              <div className={styles.card}>
                <p className={styles.crumb}>{crumb}</p>
                <p className={styles.name}>{item.title}</p>
                <p className={styles.credit}>
                  {item.credit.href ? (
                    <a href={item.credit.href} target="_blank" rel="noopener noreferrer">
                      <Icon d={ICON.link} />
                      <span>
                        {item.credit.name} on {item.credit.platform}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                    </a>
                  ) : (
                    <span>
                      {item.credit.name}, {item.credit.platform}
                    </span>
                  )}
                </p>
              </div>
            ) : null}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {item ? `${item.title}, picture ${at + 1} of ${items.length}` : ""}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
