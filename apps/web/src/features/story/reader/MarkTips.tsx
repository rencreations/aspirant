"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TLink } from "@/components/transition/t-link";
import { collectionRoute } from "@/lib/site";

import { marksOf, type Mark } from "./marks";
import styles from "./mark-tips.module.css";

const SEEN_KEY = "aspirants:marks";
const KIND: Readonly<Record<string, string>> = {
  person: "Person",
  place: "Place",
  thing: "Thing",
  group: "Group",
  creature: "Creature",
  idea: "Idea",
  event: "Event",
};

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* kept for this visit only */
  }
}

interface Open {
  mark: Mark;
  el: HTMLElement;
  /** Opened by a press or a key: it stays until it is closed. Otherwise it follows the pointer. */
  pinned: boolean;
  left: number;
  top: number;
  above: boolean;
}

/**
 * The tips of a chapter's marks. The marked words are in the page's HTML (`Blocks.tsx`); this adds
 * what they do: pointer over them (or a press, or Enter) opens a small card with a few words and a
 * way to the full page of the lore room; Esc, a press elsewhere or scrolling closes it. A mark
 * the reader has opened stops pulsing for good, and one that comes into view pulses once.
 */
export function MarkTips({ chapterId }: { chapterId: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const openRef = useRef<Open | null>(null);
  useEffect(() => {
    openRef.current = open;
  });

  const find = useCallback(
    (el: HTMLElement): Mark | undefined => {
      const slug = el.dataset.mark;
      const text = el.textContent;
      for (const list of marksOf(chapterId).values()) {
        const m = list.find((x) => x.slug === slug && x.phrase === text);
        if (m) return m;
      }
      return undefined;
    },
    [chapterId],
  );

  const place = useCallback((el: HTMLElement): Pick<Open, "left" | "top" | "above"> => {
    const r = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(window.innerWidth - width - 12, r.left + r.width / 2 - width / 2),
    );
    const room = window.innerHeight - r.bottom;
    const above = room < 220 && r.top > room;
    return { left, top: above ? r.top - 10 : r.bottom + 10, above };
  }, []);

  const show = useCallback(
    (el: HTMLElement, pinned: boolean) => {
      const mark = find(el);
      if (!mark) return;
      window.clearTimeout(timer.current);
      const seen = readSeen();
      if (!seen.has(mark.slug)) {
        seen.add(mark.slug);
        writeSeen(seen);
        document.querySelectorAll<HTMLElement>(`[data-mark="${mark.slug}"]`).forEach((n) => {
          n.removeAttribute("data-pulse");
        });
      }
      el.setAttribute("aria-expanded", "true");
      setOpen({ mark, el, pinned, ...place(el) });
    },
    [find, place],
  );

  const hide = useCallback((refocus = false) => {
    window.clearTimeout(timer.current);
    const cur = openRef.current;
    if (!cur) return;
    cur.el.setAttribute("aria-expanded", "false");
    if (refocus) cur.el.focus();
    setOpen(null);
  }, []);

  // The words of the page: pulse once when they come into view, unless the reader has opened them.
  useEffect(() => {
    const seen = readSeen();
    const marks = Array.from(document.querySelectorAll<HTMLElement>("[data-mark]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          if (!seen.has(el.dataset.mark ?? "")) el.setAttribute("data-pulse", "");
        }
      },
      { threshold: 1 },
    );
    marks.forEach((m) => io.observe(m));
    return () => {
      io.disconnect();
    };
  }, [chapterId]);

  // Pointer, press and keys on the marked words, by delegation.
  useEffect(() => {
    const target = (e: Event): HTMLElement | null =>
      e.target instanceof Element ? e.target.closest<HTMLElement>("[data-mark]") : null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = target(e);
      if (!el || openRef.current?.el === el) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        show(el, false);
      }, 140);
    };
    const out = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !target(e)) return;
      window.clearTimeout(timer.current);
      const cur = openRef.current;
      if (cur && !cur.pinned)
        timer.current = window.setTimeout(() => {
          hide();
        }, 220);
    };
    const click = (e: MouseEvent) => {
      const el = target(e);
      if (el) {
        e.preventDefault();
        if (openRef.current?.el === el && openRef.current.pinned) hide();
        else show(el, true);
        return;
      }
      if (openRef.current && !card.current?.contains(e.target as Node)) hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        hide(true);
        return;
      }
      const el = target(e);
      if (el && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        show(el, true);
      }
    };
    const scroll = () => {
      if (openRef.current) hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll);
      window.clearTimeout(timer.current);
    };
  }, [show, hide]);

  // A card opened by a key takes the focus (its link is the next thing a reader wants).
  useEffect(() => {
    if (open?.pinned) card.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;
  const { mark } = open;
  return createPortal(
    <div
      ref={card}
      className={styles.card}
      role="dialog"
      aria-label={`About ${mark.name}`}
      data-above={open.above ? "1" : undefined}
      style={{ left: open.left, top: open.top }}
      onPointerEnter={() => {
        window.clearTimeout(timer.current);
      }}
      onPointerLeave={() => {
        if (!open.pinned)
          timer.current = window.setTimeout(() => {
            hide();
          }, 220);
      }}
    >
      <p className={styles.kind}>{KIND[mark.kind] ?? "Lore"}</p>
      <p className={styles.name}>{mark.name}</p>
      <p className={styles.tip}>{mark.tip}</p>
      <TLink
        href={collectionRoute(`lore/${mark.slug}`)}
        transitionLabel={mark.name}
        className={styles.more}
      >
        More in the collection
      </TLink>
    </div>,
    document.body,
  );
}
