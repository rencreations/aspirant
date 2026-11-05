"use client";

/**
 * The shared picture viewer of the collection rooms. It opens one picture at full quality.
 *
 *   const lb = useLightboxParam(items);
 *   <Lightbox items={items} index={lb.index} onIndexChange={lb.setIndex} label="Official art" />
 *
 *  - Quality: the thumbnail shows at once (it is already in the page), then the 1280 preview, then
 *    the full size file swaps in when it arrives. The previews of the pictures on either side are
 *    warmed, so moving through them is quick.
 *  - Zoom: wheel or trackpad pinch (around the pointer), two fingers on a screen, double click or
 *    double tap (on the spot, and back out), the plus and minus buttons or keys, `0` for the whole
 *    picture and `1` for its natural size. Drag a zoomed picture to move it.
 *  - Move: arrow keys (a zoomed picture is panned instead), the side buttons, Home and End, or a
 *    swipe on a whole picture. A click on the dark ground closes. Esc closes. `i` shows or hides
 *    the details, `f` goes full screen.
 *  - Details panel: title, characters, pair, canon label, credit, size, the original file with a
 *    download button, and a button that copies the share link (`?i=<id>`, see `useLightboxParam`).
 *  - Focus stays inside while it is open and goes back to the tile that opened it.
 *
 * The picture moves with one `transform` set straight from the gestures, so only the compositor
 * works while it moves. No blur and no filter: the picture is the light.
 */
import { Dialog } from "radix-ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import type { Route } from "next";
import { CHARACTER_NAMES } from "@/lib/slugs";
import type { ExternalHref } from "@/lib/site";

import {
  clampPan,
  clampZoom,
  doubleTapView,
  FIT,
  fileKind,
  fitScale,
  formatBytes,
  isDoubleTap,
  naturalZoom,
  neighbourIndexes,
  shareUrl,
  stepIndex,
  swipeStep,
  TAP_SLOP,
  wheelZoom,
  zoomAround,
  zoomPercent,
  type Box,
  type Tap,
  type View,
} from "./lightbox-math";
import styles from "./lightbox.module.css";
import type { Download, GalleryItem } from "./types";

export interface LightboxProps<T extends GalleryItem> {
  items: readonly T[];
  /** The open picture, or null when closed. */
  index: number | null;
  /** Moves to another picture, or closes it with null. */
  onIndexChange: (next: number | null) => void;
  /** Name of the set, for the dialog's title and the panel, for example "Official art". */
  label: string;
  /** The address parameter that holds the open picture. Default `i`. */
  param?: string;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
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
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  link: "M10 14l4-4M8.5 15.5l-1 1a3 3 0 004.2 4.2l1-1M15.5 8.5l1-1a3 3 0 00-4.2-4.2l-1 1",
};

function nameOf(slug: string): string {
  return (CHARACTER_NAMES as Record<string, string>)[slug] ?? slug;
}

export function Lightbox<T extends GalleryItem>({
  items,
  index,
  onIndexChange,
  label,
  param = "i",
}: LightboxProps<T>) {
  const open = index !== null && items.length > 0;
  const at = open ? stepIndex(index, 0, items.length) : 0;
  const item = open ? items[at] : undefined;
  const { pause, resume } = useLenis();

  const content = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // The dialog's content mounts a moment after `open` turns true, so the effects below follow the
  // element itself.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage.current = el;
    setStageEl(el);
  }, []);
  const sheet = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const view = useRef<View>({ ...FIT });
  const box = useRef<Box>({ cw: 1, ch: 1, iw: 1, ih: 1 });
  const [direction, setDirection] = useState<1 | -1>(1);

  const [info, setInfo] = useState(true);
  // Which picture's preview and full file have arrived (by id, so a new picture starts clean).
  const [arrived, setArrived] = useState<{ p: string | null; f: string | null }>({
    p: null,
    f: null,
  });
  const [status, setStatus] = useState("");
  const previewIn = arrived.p === item?.id;
  const fullIn = arrived.f === item?.id;

  // The page does not scroll while the viewer is open.
  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  // A message (link copied, download started) shows for a moment.
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => {
      setStatus("");
    }, 2600);
    return () => {
      window.clearTimeout(t);
    };
  }, [status]);

  /** Write the view to the picture. `animated` eases it (buttons, keys, a double tap), not a drag. */
  const apply = useCallback((animated = false) => {
    const el = sheet.current;
    if (!el) return;
    const v = view.current;
    const b = box.current;
    if (animated) {
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
      setDirection(delta < 0 ? -1 : 1);
      onIndexChange(stepIndex(at, delta, items.length));
    },
    [open, at, items.length, onIndexChange],
  );

  // The picture starts whole in the middle, and follows the size of the stage.
  const iw = item?.img.w ?? 1;
  const ih = item?.img.h ?? 1;
  const itemId = item?.id;
  useEffect(() => {
    const el = stageEl;
    if (!open || !el || !itemId) return;
    const measure = () => {
      box.current = { cw: el.clientWidth, ch: el.clientHeight, iw, ih };
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
  }, [open, itemId, iw, ih, apply, stageEl]);

  // The previews of the pictures on either side are warmed, so moving through them is quick.
  useEffect(() => {
    if (!open) return;
    for (const i of neighbourIndexes(at, items.length)) {
      const near = items[i];
      if (near) new Image().src = libUrl(near.img.p);
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
    /** When a tap just ended: the click that follows it acts (see `onStageClick`). */
    tapped: 0,
    lastTap: null as Tap | null,
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

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    stage.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = pointers.current.size > 1;
    rebase();
  };

  const onPointerMove = (e: ReactPointerEvent) => {
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

  const onPointerUp = (e: ReactPointerEvent) => {
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
    if (g.moved && view.current.z <= 1.02) {
      const step = swipeStep(dx, dy);
      if (step !== 0) {
        go(-step);
        return;
      }
    }
    if (g.moved) return;
    // A tap. Two close together zoom in on the spot, or back out.
    const tap: Tap = { t: performance.now(), x: e.clientX, y: e.clientY };
    if (isDoubleTap(g.lastTap, tap)) {
      g.lastTap = null;
      const p = rel(e.clientX, e.clientY);
      setView(doubleTapView(view.current, p.x, p.y, box.current), true);
      return;
    }
    g.lastTap = tap;
    // The click that follows acts on the ground (see `onStageClick`). Acting here, on pointer up,
    // would close the viewer first, and on a touch screen the click would then land on the page.
    g.tapped = tap.t;
  };

  /** A click on the ground around the picture (the gap beside it, the dark backdrop) closes. */
  const onStageClick = (e: ReactMouseEvent) => {
    const g = gesture.current;
    const when = g.tapped;
    g.tapped = 0;
    // A click that ends a drag, a pinch or a swipe is not a tap.
    if (!when || performance.now() - when > 600) return;
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    const r = sheet.current?.getBoundingClientRect();
    const onPicture =
      !!r &&
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!onPicture) onIndexChange(null);
  };

  const toggleFullscreen = () => {
    const el = content.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // Enter and Space belong to the button or link that has focus.
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
        setDirection(-1);
        onIndexChange(0);
        break;
      case "End":
        setDirection(1);
        onIndexChange(items.length - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const copyLink = async () => {
    if (!item) return;
    const url = shareUrl(window.location.href, param, item.id);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setStatus(url);
    }
  };

  const download: Download | null = item
    ? (item.download ?? {
        key: item.img.f,
        name: `${item.id}.webp`,
      })
    : null;

  // The file is fetched and saved as a blob, because a browser ignores the `download` attribute
  // on an address from another origin. When that fails the plain link opens the file instead.
  const saveFile = async (e: ReactMouseEvent<HTMLAnchorElement>, d: Download) => {
    e.preventDefault();
    const url = libUrl(d.key);
    setStatus("Download started");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = d.name;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(href);
      }, 15000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const bytes = formatBytes(download?.bytes);
  const kind = download ? fileKind(download.name) : "";
  const pair = item?.pair ? pairs.find((p) => p.id === item.pair) : undefined;
  const credit = item?.credit;

  let facts: ReactNode = null;
  if (item) {
    const rows: Array<readonly [string, ReactNode]> = [];
    if (item.chars?.length)
      rows.push([
        item.chars.length > 1 ? "Characters" : "Character",
        item.chars.map(nameOf).join(", "),
      ]);
    if (pair) rows.push(["Pair", pair.names]);
    for (const [k, v] of item.facts ?? []) rows.push([k, v]);
    rows.push(["Size", `${item.img.w} × ${item.img.h} px`]);
    if (download) rows.push(["File", [kind, bytes].filter(Boolean).join(", ") || "Image"]);
    facts = (
      <dl className={styles.facts}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="hud-label">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onIndexChange(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          ref={content}
          className={styles.viewer}
          data-info={info}
          data-cursor-theme="light"
          data-lenis-prevent
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            // Remember what opened the viewer (it has no trigger of its own, so the dialog cannot
            // give focus back by itself), and focus the stage so the keys work at once.
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
          aria-describedby="lightbox-help"
        >
          <Dialog.Title className="sr-only">{`${label}: ${item?.title ?? ""}`}</Dialog.Title>
          <Dialog.Description id="lightbox-help" className="sr-only">
            Arrow keys change picture. Plus and minus zoom, 0 shows the whole picture, 1 shows it at
            its natural size. Double click the picture to zoom in and double click again to zoom
            out. Drag a zoomed picture to move it. Click the dark ground to close. I shows or hides
            the details, F goes full screen, Escape closes.
          </Dialog.Description>

          <div className={styles.bar} data-ui>
            <p className={`${styles.count} hud-label`} aria-hidden="true">
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
            onClick={onStageClick}
          >
            {item ? (
              <div key={item.id} className={styles.slide} data-dir={direction}>
                {/* The sheet is moved and scaled. Under the full picture sit the preview and the
                    thumbnail, so something is there from the first frame. */}
                <div
                  ref={sheet}
                  className={styles.sheet}
                  style={{
                    width: item.img.w,
                    height: item.img.h,
                    marginLeft: -item.img.w / 2,
                    marginTop: -item.img.h / 2,
                    backgroundColor: item.img.c,
                  }}
                >
                  {/* Plain <img>: static export, and the library lives on another origin. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.layer}
                    src={libUrl(item.img.t)}
                    alt=""
                    draggable={false}
                    aria-hidden="true"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.layer}
                    data-in={previewIn}
                    src={libUrl(item.img.p)}
                    alt={previewIn ? "" : (item.alt ?? item.title)}
                    draggable={false}
                    onLoad={() => {
                      setArrived((s) => ({ ...s, p: item.id }));
                    }}
                    onError={() => {
                      setArrived((s) => ({ ...s, p: item.id }));
                    }}
                  />
                  {previewIn ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.layer}
                      data-in={fullIn}
                      src={libUrl(item.img.f)}
                      alt={item.alt ?? item.title}
                      draggable={false}
                      onLoad={() => {
                        setArrived((s) => ({ ...s, f: item.id }));
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            <p className={`${styles.quality} hud-label`} aria-hidden="true">
              {item
                ? fullIn
                  ? `Full size ${item.img.w} × ${item.img.h}`
                  : "Loading full size"
                : ""}
            </p>

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
          </div>

          {info && item ? (
            <aside className={styles.panel} data-ui aria-label="Details">
              <p className={`${styles.kicker} hud-label`}>
                {label}
                {item.canon && item.canon !== "official" ? (
                  <span className={styles.canon} data-canon={item.canon}>
                    {item.canon === "fan" ? "Fan work" : "Non-canon parody"}
                  </span>
                ) : null}
              </p>
              <h2 className={`${styles.title} display`}>{item.title}</h2>
              {item.note ? <p className={styles.note}>{item.note}</p> : null}
              {facts}
              {credit || item.canon === "fan" ? (
                <p className={styles.credit}>
                  <span>
                    {credit?.by ?? "Artist not named"}
                    {credit?.platform ? ` on ${credit.platform}` : ""}
                    {credit?.date ? `, ${credit.date}` : ""}
                  </span>
                  {credit?.url ? (
                    <TLink href={credit.url as ExternalHref} className={styles.textLink}>
                      View the original post
                    </TLink>
                  ) : null}
                </p>
              ) : null}
              {item.link ? (
                <p className={styles.credit}>
                  <TLink
                    href={item.link.href as Route | ExternalHref}
                    className={styles.textLink}
                    transitionLabel={item.link.label}
                  >
                    {item.link.label}
                  </TLink>
                </p>
              ) : null}
              <div className={styles.actions}>
                {download ? (
                  <a
                    className={styles.cta}
                    href={libUrl(download.key)}
                    download={download.name}
                    onClick={(e) => {
                      void saveFile(e, download);
                    }}
                  >
                    <Icon d={ICON.download} />
                    <span>{item.download ? "Download original" : "Download"}</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  className={styles.cta}
                  onClick={() => {
                    void copyLink();
                  }}
                >
                  <Icon d={ICON.link} />
                  <span>Copy link</span>
                </button>
              </div>
              <p className={styles.status} role="status" aria-live="polite">
                {status}
              </p>
            </aside>
          ) : (
            <p role="status" aria-live="polite" className="sr-only">
              {status}
            </p>
          )}

          <p role="status" aria-live="polite" className="sr-only">
            {item ? `${item.title}, picture ${at + 1} of ${items.length}` : ""}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
