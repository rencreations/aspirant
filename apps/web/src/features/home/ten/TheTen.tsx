"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import type { FrameShape } from "@/components/frame/frame-shapes";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";
import { characterRoute } from "@/lib/site";

import type { RosterCard } from "../types";
import styles from "./ten.module.css";

const SHAPES: readonly FrameShape[] = [
  "chamfer",
  "arch",
  "rift",
  "ticket",
  "parallelogram",
  "star",
  "chamfer",
  "arch",
  "ticket",
  "rift",
];

const RAIL_ID = "ten-rail";

function play(card: RosterCard) {
  void audio.playVoice(asset(card.voice.file));
}

/**
 * The ten: a horizontal rail of custom-framed cards. Drag it with a mouse (with momentum),
 * swipe it on touch, scroll it with the buttons, or move through the cards with the arrow
 * keys. Hover or focus tilts a card, brightens it and plays her line; each card opens her
 * page.
 */
export function TheTen({ cards }: { cards: readonly RosterCard[] }) {
  const railRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ id: -1, x: 0, left: 0, v: 0, t: 0, moved: false, raf: 0 });
  const focusTimer = useRef(0);
  const [edge, setEdge] = useState<"start" | "middle" | "end">("start");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = rail.scrollWidth - rail.clientWidth;
      const next = rail.scrollLeft <= 4 ? "start" : rail.scrollLeft >= max - 4 ? "end" : "middle";
      setEdge((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const d = drag.current;
    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(d.raf);
      window.clearTimeout(focusTimer.current);
    };
  }, []);

  const page = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    audio.blip("click");
    rail.scrollBy({
      left: dir * rail.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    const d = drag.current;
    cancelAnimationFrame(d.raf);
    d.id = e.pointerId;
    d.x = e.clientX;
    d.left = rail.scrollLeft;
    d.v = 0;
    d.t = performance.now();
    d.moved = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const rail = railRef.current;
    if (d.id !== e.pointerId || !rail) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      rail.setPointerCapture(e.pointerId);
      rail.dataset.dragging = "true";
    }
    const now = performance.now();
    const prev = rail.scrollLeft;
    rail.scrollLeft = d.left - dx;
    const dt = Math.max(1, now - d.t);
    d.v = ((rail.scrollLeft - prev) / dt) * 1000 * 0.6 + d.v * 0.4;
    d.t = now;
  };

  const onPointerUp = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const rail = railRef.current;
    if (d.id !== e.pointerId || !rail) return;
    d.id = -1;
    delete rail.dataset.dragging;
    if (!d.moved || prefersReducedMotion()) return;
    let last = performance.now();
    const glide = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      d.v *= Math.exp(-dt * 4.2);
      rail.scrollLeft += d.v * dt;
      d.raf = Math.abs(d.v) > 12 ? requestAnimationFrame(glide) : 0;
    };
    d.raf = requestAnimationFrame(glide);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const rail = railRef.current;
    if (!rail) return;
    const links = Array.from(rail.querySelectorAll<HTMLAnchorElement>("a"));
    const current = links.findIndex((a) => a === document.activeElement);
    if (current < 0) return;
    e.preventDefault();
    const next =
      links[Math.min(links.length - 1, Math.max(0, current + (e.key === "ArrowRight" ? 1 : -1)))];
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <ThemeZone theme="storm" aria-labelledby="ten-title" className={styles.section}>
      <div className={cn(styles.head, "shell")}>
        <div>
          <p className="hud-label">05 / Roster</p>
          <h2 id="ten-title" className={styles.title}>
            The ten
          </h2>
          <p className={styles.intro}>
            Ten Aspirants, five pairings. Drag the rail, or use the arrows, and open anyone&rsquo;s
            file.
          </p>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrowButton}
            aria-controls={RAIL_ID}
            aria-label="Scroll the roster back"
            disabled={edge === "start"}
            onClick={() => page(-1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M10 2L4 8l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.arrowButton}
            aria-controls={RAIL_ID}
            aria-label="Scroll the roster on"
            disabled={edge === "end"}
            onClick={() => page(1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>

      <ul
        ref={railRef}
        id={RAIL_ID}
        className={styles.rail}
        aria-label="The ten Aspirants"
        data-edge={edge}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        {cards.map((card, i) => {
          const glow = `color-mix(in srgb, ${card.primary} 65%, #ffffff)`;
          return (
            <li
              key={card.slug}
              className={styles.item}
              style={
                {
                  "--card-glow": glow,
                  "--pair-a": card.pairColours[0],
                  "--pair-b": card.pairColours[1],
                } as CSSProperties
              }
            >
              <TLink
                href={characterRoute(card.slug)}
                transitionLabel={card.name}
                className={styles.card}
                data-cursor="OPEN"
                onPointerEnter={(e) => {
                  if (e.pointerType !== "mouse" || drag.current.id !== -1) return;
                  audio.blip("hover");
                  play(card);
                }}
                onFocus={(e) => {
                  window.clearTimeout(focusTimer.current);
                  if (!e.currentTarget.matches(":focus-visible")) return;
                  focusTimer.current = window.setTimeout(() => play(card), 260);
                }}
                onBlur={() => window.clearTimeout(focusTimer.current)}
              >
                <Frame shape={SHAPES[i % SHAPES.length]} accent={glow} className={styles.frame}>
                  <FrameImage
                    src={`/img/char/${card.slug}/splash.webp`}
                    srcSet={`/img/char/${card.slug}/splash-sm.webp 800w, /img/char/${card.slug}/splash.webp 2048w`}
                    sizes="(max-width: 40em) 140vw, 44rem"
                    alt=""
                    width={2048}
                    height={1152}
                    objectPosition={card.objectPosition}
                    className={styles.image}
                  />
                </Frame>
                <span className={styles.meta}>
                  <span className={styles.unit} aria-hidden="true">
                    Unit {String(card.order).padStart(2, "0")}
                  </span>
                  <span className={styles.aspirant}>{card.aspirantName}</span>
                  <span className={styles.name}>
                    {card.name}{" "}
                    <span lang="ja" className={styles.jp}>
                      {card.jp}
                    </span>
                  </span>
                  <span className={styles.pair}>
                    <span className={styles.swatch} aria-hidden="true" />
                    {card.pairName}
                  </span>
                </span>
              </TLink>
            </li>
          );
        })}
      </ul>
    </ThemeZone>
  );
}
