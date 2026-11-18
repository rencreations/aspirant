"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { PREVIEW } from "../content";
import { loadFull, onFull, peekFull } from "./files";
import { flipBetween, isOnScreen, wrapIndex, type Box } from "./math";
import { PREVIEW_PICTURES } from "./pictures";
import { cardBoxOf, useHomePreview } from "./store";
import styles from "./preview.module.css";

const COUNT = PREVIEW_PICTURES.length;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN = "cubic-bezier(0.5, 0, 0.75, 0)";
/** How far a finger must travel across the picture to step to another one. */
const SWIPE_PX = 48;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The element's box on the screen, in the preview's own terms. */
function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

function subscribeFull(onChange: () => void): () => void {
  return onFull(() => {
    onChange();
  });
}

/**
 * The one control that opens the window for the keyboard and for a screen reader. The cards of the
 * wall are drawn on the canvas, so this is their way in. It is hidden until it has the focus, and
 * then it shows as a small pill at the foot of the wall's frame (see `aspirants.module.css`).
 */
export function PreviewTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        useHomePreview.getState().show(0, null);
      }}
    >
      {PREVIEW.open}
    </button>
  );
}

/** The window itself. It draws nothing until a card has been pressed. */
export function PreviewHost() {
  const open = useHomePreview((s) => s.open);
  const close = useHomePreview((s) => s.close);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-home-hit="dom" />
        <PreviewContent open={open} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewContent({ open }: { open: boolean }) {
  const index = useHomePreview((s) => s.index);
  const step = useHomePreview((s) => s.step);
  const pic = PREVIEW_PICTURES[index]!;

  // The full size pictures are brought in behind the list; the ones next to this one first.
  useEffect(() => {
    for (const by of [0, 1, -1]) {
      const next = PREVIEW_PICTURES[wrapIndex(index, by, COUNT)];
      if (next) {
        loadFull(next).catch(() => undefined);
      }
    }
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1, COUNT);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1, COUNT);
    }
  };

  return (
    <Dialog.Content
      className={styles.content}
      data-home-hit="dom"
      data-lenis-prevent
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // The empty space around the picture closes the window (a press on a control or the picture does not).
        if (e.target instanceof Element && e.target.closest("button, a, [data-keep]")) return;
        useHomePreview.getState().close();
      }}
    >
      <Dialog.Title className="sr-only">{`${PREVIEW.dialog}: ${pic.title}`}</Dialog.Title>
      <Dialog.Description className="sr-only">{`${pic.alt} ${PREVIEW.help}`}</Dialog.Description>

      <div className={styles.top}>
        <p className={styles.count} aria-hidden="true">
          <b>{pad(index + 1)}</b> / {pad(COUNT)}
        </p>
        <Dialog.Close className={styles.round} aria-label={PREVIEW.close}>
          <X aria-hidden="true" />
        </Dialog.Close>
      </div>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.round} ${styles.prev}`}
          aria-label={PREVIEW.previous}
          onClick={() => {
            step(-1, COUNT);
          }}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <PreviewFrame open={open} />
        <button
          type="button"
          className={`${styles.round} ${styles.next}`}
          aria-label={PREVIEW.next}
          onClick={() => {
            step(1, COUNT);
          }}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.foot}>
        <div data-keep="">
          <p className={styles.title}>{pic.title}</p>
          <p className={styles.help} aria-hidden="true">
            {PREVIEW.help}
          </p>
        </div>
        <TLink href={collectionRoute("arts")} className={styles.more} transitionLabel="Collection">
          {PREVIEW.more}
        </TLink>
      </div>
    </Dialog.Content>
  );
}

/**
 * The picture. It grows out of the card that was pressed and flies back into it, and a step to
 * another picture slides it in from the side. All three are Web Animations on transform and opacity.
 */
function PreviewFrame({ open }: { open: boolean }) {
  const index = useHomePreview((s) => s.index);
  const pic = PREVIEW_PICTURES[index]!;
  const frameRef = useRef<HTMLDivElement>(null);
  const shownIndex = useRef(index);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const fullUrl = useSyncExternalStore(
    subscribeFull,
    () => peekFull(pic.id),
    () => null,
  );

  // Open: grow out of the card.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const end = boxOf(el);
    const start = useHomePreview.getState().from;
    if (start && isOnScreen(start, window.innerWidth, window.innerHeight)) {
      const t = flipBetween(start, end);
      el.animate(
        [
          { transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.scale})`, opacity: 0 },
          { opacity: 1, offset: 0.22 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 620, easing: EASE_OUT, fill: "backwards" },
      );
    } else {
      el.animate(
        [
          { transform: "translate(0, 24px) scale(0.94)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 460, easing: EASE_OUT, fill: "backwards" },
      );
    }
  }, []);

  // Close: fly back into the card (or sink and fade when it is not on the screen).
  useEffect(() => {
    if (open) return;
    const el = frameRef.current;
    if (!el) return;
    const end = boxOf(el);
    const card = cardBoxOf(pic.id);
    if (card && isOnScreen(card, window.innerWidth, window.innerHeight)) {
      const t = flipBetween(card, end);
      el.animate(
        [
          { transform: "none", opacity: 1 },
          { opacity: 1, offset: 0.7 },
          { transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.scale})`, opacity: 0 },
        ],
        { duration: 300, easing: EASE_IN, fill: "forwards" },
      );
    } else {
      el.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "translate(0, 18px) scale(0.95)", opacity: 0 },
        ],
        { duration: 260, easing: EASE_IN, fill: "forwards" },
      );
    }
  }, [open, pic.id]);

  // A step: the new picture slides in from the side it came from.
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    const el = frameRef.current;
    if (!el) return;
    const dir = useHomePreview.getState().dir || 1;
    el.animate(
      [
        { transform: `translate3d(${dir * 44}px, 0, 0)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 420, easing: EASE_OUT },
    );
  }, [index]);

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
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 1.6 * Math.abs(dy)) {
      useHomePreview.getState().step(dx < 0 ? 1 : -1, COUNT);
    }
  };

  return (
    <div className={styles.frameBox}>
      <div
        ref={frameRef}
        className={styles.frame}
        data-keep=""
        style={{ "--aspect": pic.w / pic.h } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
        <img
          key={`p-${pic.id}`}
          className={styles.pic}
          src={libUrl(pic.p)}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
        />
        {fullUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- an object URL of the whole file
          <img
            key={`f-${pic.id}`}
            className={`${styles.pic} ${styles.full}`}
            src={fullUrl}
            alt={pic.alt}
            data-loaded={loadedId === pic.id ? "1" : "0"}
            draggable={false}
            onLoad={() => {
              setLoadedId(pic.id);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
