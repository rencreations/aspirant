"use client";

/**
 * One hover card for the whole book. Entity names in the text are plain buttons
 * (`button[data-ent]`); this controller listens once on the reader root and opens a single
 * portaled card next to whichever name is hovered, focused or tapped. It copies the shell
 * HoverCard's behaviour and look (150 ms intent, focus opens, tap or Enter pins and moves focus
 * in, Esc closes and returns focus, viewport-aware placement) without a component per name.
 * The glossary and the voice lines load on first use, so they stay out of the first bundle.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@aspirant/ui/lib/utils";

import { TLink } from "@/components/transition/t-link";
import hc from "@/components/ui/hover-card.module.css";
import type * as GlossaryModule from "@/content/entities";
import type { Entity } from "@/content/entities";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { withSound } from "@/lib/sound-prompt";
import { characterRoute } from "@/lib/site";
import { isCharacterSlug } from "@/lib/slugs";
import { useSiteStore } from "@/lib/stores";

import { ASPIRANT_NAMES, portraitFor, SPEAKER_ACCENT } from "./portraits";
import s from "./reader.module.css";

const OPEN_DELAY = 150;
const CLOSE_DELAY = 120;
const MARGIN = 8;
const GAP = 10;
const CARD_ID = "reader-entity-card";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const KIND_LABEL: Readonly<Record<Entity["kind"], string>> = {
  character: "Aspirant",
  person: "Person",
  place: "Place",
  term: "Word to know",
  org: "Group",
  object: "Object",
};

type Glossary = typeof GlossaryModule;
let glossaryPromise: Promise<Glossary> | null = null;
function loadGlossary(): Promise<Glossary> {
  glossaryPromise ??= import("@/content/entities");
  return glossaryPromise;
}

interface Open {
  readonly el: HTMLButtonElement;
  readonly id: string;
  readonly pinned: boolean;
}

/** The button for an entity element (the drop cap span points at the button after it). */
function triggerFor(node: EventTarget | null): HTMLButtonElement | null {
  if (!(node instanceof Element)) return null;
  const hit = node.closest<HTMLElement>("[data-ent]");
  if (!hit) return null;
  if (hit instanceof HTMLButtonElement) return hit;
  const next = hit.nextElementSibling;
  return next instanceof HTMLButtonElement && next.dataset.ent === hit.dataset.ent ? next : null;
}

function HexGlyph({ kind }: { kind: Entity["kind"] | undefined }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M24 3 42 13.5v21L24 45 6 34.5v-21Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M24 11 35 17.5v13L24 37l-11-6.5v-13Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.6"
      />
      {kind === "place" ? (
        <circle cx="24" cy="24" r="3.2" fill="currentColor" />
      ) : (
        <path
          d="M24 16c.6 5.6 2.4 7.4 8 8-5.6.6-7.4 2.4-8 8-.6-5.6-2.4-7.4-8-8 5.6-.6 7.4-2.4 8-8Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

const voiceTurn = new Map<string, number>();

function HearHer({ slug, name }: { slug: string; name: string }) {
  const [caption, setCaption] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const muted = useSiteStore((st) => st.muted);

  const play = async () => {
    audio.unlock();
    if (!isCharacterSlug(slug)) return;
    const { keyVoiceLines } = await import("@/content/characters");
    const lines = keyVoiceLines(slug);
    if (!lines.length) return;
    const turn = voiceTurn.get(slug) ?? 0;
    voiceTurn.set(slug, turn + 1);
    const line = lines[turn % lines.length];
    if (!line) return;
    setCaption(line.en);
    const started = await audio.playVoice(asset(line.file), { onEnd: () => setPlaying(false) });
    setPlaying(started);
  };

  return (
    <div className={s.cardVoice}>
      <button
        type="button"
        className={s.cardButton}
        aria-label={`Hear her: ${name}`}
        aria-pressed={playing}
        data-cursor="PLAY"
        onClick={() => {
          audio.unlock();
          withSound("Her voice", () => void play());
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2 6h2.6L8 3v10L4.6 10H2z" fill="currentColor" />
          <path
            d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.3 6.3 0 0 1 0 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        Hear her
      </button>
      {caption && (
        <p className={s.cardCaption} aria-live="polite">
          <span>&ldquo;{caption}&rdquo;</span>
          {muted && <span className={s.cardHint}>Sound is off. Press M to turn it on.</span>}
        </p>
      )}
    </div>
  );
}

function CardBody({
  id,
  fallback,
  glossary,
}: {
  id: string;
  fallback: string;
  glossary: Glossary | null;
}) {
  const entity = glossary?.getEntity(id);
  const slug = entity?.characterSlug ?? null;
  const portrait = portraitFor(slug);
  const aspirant = slug ? ASPIRANT_NAMES[slug] : undefined;
  const label = entity?.label ?? fallback;
  let short = entity?.short ?? "";
  if (aspirant && short.startsWith(`${aspirant}. `)) short = short.slice(aspirant.length + 2);
  return (
    <>
      <span className={s.cardArt} aria-hidden="true">
        {portrait ? (
          // Decorative portrait: the name is the card's text.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset(portrait.src)}
            alt=""
            width={800}
            height={450}
            style={{ objectPosition: portrait.position }}
          />
        ) : (
          <HexGlyph kind={entity?.kind} />
        )}
      </span>
      <span className={s.cardText}>
        <span className={cn(s.cardKicker, "hud-label")}>
          {aspirant ?? (entity ? KIND_LABEL[entity.kind] : "Archive")}
        </span>
        <span className={s.cardName}>{label}</span>
        <span className={s.cardShort}>{entity ? short : "Opening the file."}</span>
      </span>
      {slug && isCharacterSlug(slug) && (
        <span className={s.cardActions}>
          <HearHer slug={slug} name={label} />
          <TLink
            href={characterRoute(slug)}
            transitionLabel={label}
            className={cn(s.cardLink, "link")}
          >
            Open {label}&rsquo;s page
          </TLink>
        </span>
      )}
    </>
  );
}

export function EntityCards({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [theme, setTheme] = useState<string | undefined>(undefined);
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<Open | null>(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const lastPointer = useRef("mouse");
  const returning = useRef<HTMLButtonElement | null>(null);

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const commit = useCallback((next: Open | null) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  const show = useCallback(
    (el: HTMLButtonElement, pinned = false) => {
      clearTimers();
      const id = el.dataset.ent ?? "";
      const current = openRef.current;
      if (current?.el !== el) audio.blip("hover");
      setTheme(el.closest<HTMLElement>("[data-theme]")?.dataset.theme);
      commit({ el, id, pinned: pinned || (current?.el === el && current.pinned) });
      void loadGlossary().then(setGlossary);
    },
    [commit],
  );

  const hide = useCallback(
    (returnFocus = false) => {
      clearTimers();
      const current = openRef.current;
      commit(null);
      if (returnFocus && current) {
        // Focus goes back to the name without reopening the card it just closed.
        returning.current = current.el;
        current.el.focus();
        returning.current = null;
      }
    },
    [commit],
  );

  const scheduleClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    if (openRef.current?.pinned) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => hide(), CLOSE_DELAY);
  }, [hide]);

  // Delegated listeners on the reader root.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onOver = (e: PointerEvent) => {
      const el = triggerFor(e.target);
      if (!el) return;
      lastPointer.current = e.pointerType;
      void loadGlossary();
      if (e.pointerType === "touch") return;
      if (openRef.current?.el === el) {
        window.clearTimeout(closeTimer.current);
        return;
      }
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => show(el), OPEN_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      const el = triggerFor(e.target);
      if (!el || e.pointerType === "touch") return;
      const to = e.relatedTarget;
      if (to instanceof Node && (el.contains(to) || triggerFor(to) === el)) return;
      scheduleClose();
    };
    const onDown = (e: PointerEvent) => {
      lastPointer.current = e.pointerType;
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target instanceof HTMLButtonElement && e.target.dataset.ent ? e.target : null;
      if (!el) return;
      let keyboard = false;
      try {
        keyboard = el.matches(":focus-visible");
      } catch {
        keyboard = false;
      }
      if (keyboard && returning.current !== el) show(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = e.target instanceof HTMLButtonElement && e.target.dataset.ent ? e.target : null;
      if (!el || openRef.current?.el !== el) return;
      const next = e.relatedTarget;
      if (next instanceof Node && cardRef.current?.contains(next)) return;
      if (!openRef.current.pinned) hide();
    };
    const onClick = (e: MouseEvent) => {
      const el = triggerFor(e.target);
      if (!el) return;
      const viaTouch = lastPointer.current === "touch" && e.detail !== 0;
      const current = openRef.current;
      if (current?.el === el && (current.pinned || viaTouch)) {
        hide();
        return;
      }
      show(el, true);
      audio.blip("click");
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerout", onOut);
    root.addEventListener("pointerdown", onDown, { passive: true });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("click", onClick);
    return () => {
      clearTimers();
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("click", onClick);
    };
  }, [rootRef, show, hide, scheduleClose]);

  // Position next to the trigger, inside the viewport (as the shell HoverCard does).
  const place = useCallback(() => {
    const trigger = openRef.current?.el;
    const el = cardRef.current;
    if (!trigger || !el) return;
    const t = trigger.getClientRects()[0] ?? trigger.getBoundingClientRect();
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
  }, [open, glossary, place]);

  // While open: keep placed, Esc closes, a press elsewhere closes. Mark the trigger.
  useEffect(() => {
    if (!open) return;
    const { el } = open;
    el.setAttribute("aria-expanded", "true");
    el.setAttribute("aria-describedby", CARD_ID);
    el.setAttribute("aria-controls", CARD_ID);
    let raf = 0;
    const onMove = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          place();
        });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const inside = cardRef.current?.contains(document.activeElement) ?? false;
      hide(inside || document.activeElement === el);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && (el.contains(target) || cardRef.current?.contains(target))) return;
      if (triggerFor(target) === el) return;
      hide();
    };
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      el.removeAttribute("aria-expanded");
      el.removeAttribute("aria-describedby");
      el.removeAttribute("aria-controls");
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, place, hide]);

  // Pinned: move focus into the card when it has something to press.
  const pinned = open?.pinned ?? false;
  const focusable = pinned && glossary?.getEntity(open?.id ?? "")?.characterSlug !== undefined;
  useEffect(() => {
    if (!focusable) return;
    cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }, [focusable]);

  if (!open) return null;
  const slug = glossary?.getEntity(open.id)?.characterSlug;
  const accent = slug ? SPEAKER_ACCENT[slug] : undefined;
  const vars = accent ? ({ "--accent": accent, "--glow": accent } as CSSProperties) : undefined;
  return createPortal(
    <div
      ref={cardRef}
      id={CARD_ID}
      role={focusable ? "dialog" : "tooltip"}
      aria-label={
        focusable
          ? (open.el.getAttribute("aria-label") ?? open.el.textContent ?? undefined)
          : undefined
      }
      className={cn(hc.card, s.entCard)}
      data-theme={theme}
      data-measuring="true"
      data-side="bottom"
      data-overlay="card"
      style={vars}
      onPointerEnter={() => window.clearTimeout(closeTimer.current)}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") scheduleClose();
      }}
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && (cardRef.current?.contains(next) || next === open.el)) return;
        hide();
      }}
    >
      <CardBody
        id={open.id}
        fallback={open.el.getAttribute("aria-label") ?? open.el.textContent ?? ""}
        glossary={glossary}
      />
      <span className={hc.arrow} aria-hidden="true" />
    </div>,
    document.body,
  );
}
