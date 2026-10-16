"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@aspirant/ui/lib/utils";

import { audio } from "@/lib/audio";

import styles from "./hover-card.module.css";

export interface HoverCardProps {
  /** The trigger: inline text inside running copy, for example a name. */
  children: ReactNode;
  /** Card content: portrait, name, one line, link. Links make the card focusable when pinned. */
  card: ReactNode;
  /** Accent colour for the underline, border and arrow (any CSS colour). */
  accent?: string;
  /** Accessible name for the trigger. Must contain the visible text. */
  label?: string;
  className?: string;
}

const OPEN_DELAY = 150;
const CLOSE_DELAY = 120;
const MARGIN = 8;
const GAP = 10;
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Entity card for running text. Hover (with a 150 ms intent delay), keyboard focus or a tap
 * opens it; it stays open while the pointer is over the card; Esc closes it. The card is
 * portaled to <body>, kept inside the viewport (flips above or below, shifts sideways) and
 * described to assistive tech through aria-describedby. Clicking, tapping or pressing Enter
 * pins it open; when the card holds links, focus moves into it and returns to the trigger on
 * Esc or when focus leaves.
 *
 * <HoverCard accent="#5ce1ff" card={<EntityCard id="layla" />}>Layla</HoverCard>
 */
export function HoverCard({ children, card, accent, label, className }: HoverCardProps) {
  const reactId = useId();
  const cardId = `hovercard-${reactId.replace(/:/g, "")}`;
  const triggerId = `${cardId}-trigger`;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [theme, setTheme] = useState<string | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const lastPointer = useRef<string>("mouse");

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const show = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    const zone = triggerRef.current?.closest<HTMLElement>("[data-theme]");
    setTheme(zone?.dataset.theme);
    setOpen((was) => {
      if (!was) audio.blip("hover");
      return true;
    });
  }, []);

  const hide = useCallback((returnFocus = false) => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    setPinned(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const scheduleOpen = () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(show, OPEN_DELAY);
  };

  const scheduleClose = () => {
    window.clearTimeout(openTimer.current);
    if (pinned) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => hide(), CLOSE_DELAY);
  };

  // Position the card next to the trigger, inside the viewport.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const el = cardRef.current;
    if (!trigger || !el) return;
    const rects = trigger.getClientRects();
    const t = rects[0] ?? trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const below = vh - t.bottom - GAP - MARGIN;
    const above = t.top - GAP - MARGIN;
    const side = below >= h || below >= above ? "bottom" : "top";
    const top = side === "bottom" ? t.bottom + GAP : t.top - GAP - h;
    const centre = t.left + t.width / 2;
    const left = Math.min(Math.max(MARGIN, centre - w / 2), Math.max(MARGIN, vw - w - MARGIN));
    el.style.top = `${Math.round(Math.max(MARGIN, Math.min(top, vh - h - MARGIN)))}px`;
    el.style.left = `${Math.round(left)}px`;
    el.style.setProperty(
      "--arrow-x",
      `${Math.round(Math.min(Math.max(14, centre - left), w - 14))}px`,
    );
    el.dataset.side = side;
    el.dataset.measuring = "false";
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, card]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          place();
        });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const inside = cardRef.current?.contains(document.activeElement) ?? false;
      hide(inside || document.activeElement === triggerRef.current);
    };
    const onDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || cardRef.current?.contains(target)))
        return;
      hide();
    };
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, place, hide]);

  // Pinned with links inside: move focus into the card.
  useEffect(() => {
    if (!open || !pinned) return;
    const first = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
  }, [open, pinned]);

  useEffect(() => clearTimers, []);

  const onTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
    const viaTouch = lastPointer.current === "touch" && e.detail !== 0;
    if (open && (pinned || viaTouch)) {
      hide();
      return;
    }
    show();
    setPinned(true);
    audio.blip("click");
  };

  const onTriggerFocus = (e: FocusEvent<HTMLButtonElement>) => {
    let keyboard = false;
    try {
      keyboard = e.currentTarget.matches(":focus-visible");
    } catch {
      keyboard = false;
    }
    if (keyboard) show();
  };

  const onTriggerBlur = (e: FocusEvent<HTMLButtonElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && cardRef.current?.contains(next)) return;
    if (!pinned) hide();
  };

  const onCardBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && (cardRef.current?.contains(next) || next === triggerRef.current)) return;
    hide();
  };

  const vars = accent ? ({ "--accent": accent, "--glow": accent } as CSSProperties) : undefined;
  const hasFocusable = open && pinned;

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={cn(styles.trigger, className)}
        style={vars}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? cardId : undefined}
        aria-controls={open ? cardId : undefined}
        onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
          lastPointer.current = e.pointerType;
        }}
        onPointerEnter={(e: PointerEvent<HTMLButtonElement>) => {
          lastPointer.current = e.pointerType;
          if (e.pointerType !== "touch") scheduleOpen();
        }}
        onPointerLeave={(e: PointerEvent<HTMLButtonElement>) => {
          if (e.pointerType !== "touch") scheduleClose();
        }}
        onFocus={onTriggerFocus}
        onBlur={onTriggerBlur}
        onClick={onTriggerClick}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role={hasFocusable ? "dialog" : "tooltip"}
            aria-labelledby={hasFocusable ? triggerId : undefined}
            className={styles.card}
            data-theme={theme}
            data-measuring="true"
            data-side="bottom"
            style={vars}
            onPointerEnter={() => window.clearTimeout(closeTimer.current)}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") scheduleClose();
            }}
            onBlur={onCardBlur}
          >
            {card}
            <span className={styles.arrow} aria-hidden="true" />
          </div>,
          document.body,
        )}
    </>
  );
}
