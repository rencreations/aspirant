"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { useLenis } from "@/components/smooth-scroll";
import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { CanonBadge, CreditLine } from "../shell/credit";
import { getCollection } from "../registry";
import {
  captionParts,
  clock,
  formatDate,
  kindLabel,
  ratioLabel,
  sizeLabel,
  videoSources,
} from "./model";
import { PaletteCard, PaletteStrip } from "./palette";
import type { DesignCampaign, DesignPost, DesignSlide } from "./types";
import styles from "./viewer.module.css";
import type { View } from "./wall";

interface ViewerProps {
  post: DesignPost;
  /** Position among the posts on show, from 1. */
  position: number;
  total: number;
  campaign: DesignCampaign | undefined;
  view: View;
  onView: (v: View) => void;
  onClose: () => void;
  /** Move to the next (1) or the previous (-1) post on show. */
  onStep: (delta: number) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The study table. The piece large on the left, at its true shape, and everything known about it
 * on the right. A carousel moves slide by slide, a reel plays in the site's player. "Details"
 * puts measuring lines and the palette around the piece.
 */
export function PostViewer({
  post,
  position,
  total,
  campaign,
  view,
  onView,
  onClose,
  onStep,
}: ViewerProps) {
  const meta = getCollection("design");
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const { pause, resume } = useLenis();
  const [pos, setPos] = useState({ id: post.id, n: 0 });

  const slides = post.slides ?? [];
  const slide = pos.id === post.id ? Math.min(pos.n, Math.max(0, slides.length - 1)) : 0;
  const goSlide = useCallback(
    (n: number) => {
      if (n < 0 || n >= slides.length) return;
      audio.blip("click");
      setPos({ id: post.id, n });
    },
    [post.id, slides.length],
  );

  // Page scrolling waits while the table is open. Focus moves in and comes back to the tile.
  useEffect(() => {
    pause();
    const before = document.activeElement as HTMLElement | null;
    const id = post.id;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      resume();
      const back =
        document.querySelector<HTMLElement>(
          `[data-id="${CSS.escape(before?.dataset.id ?? id)}"]`,
        ) ?? before;
      back?.focus({ preventScroll: true });
    };
    // Only on open and close: moving between posts keeps the focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause, resume]);

  // The keys are read on the window, so they keep working after a click on the empty table.
  const latest = useRef({ post, slide, goSlide, onClose, onStep });
  useEffect(() => {
    latest.current = { post, slide, goSlide, onClose, onStep };
  });

  useEffect(() => {
    const root = () => rootRef.current;
    const playerOpen = () => Boolean(root()?.querySelector('[data-open="true"]'));
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (playerOpen() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const { post: p, slide: s, goSlide: go, onClose: close, onStep: step } = latest.current;
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        const nodes = Array.from(
          root()?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first || !last) return;
        const inside = root()?.contains(document.activeElement) ?? false;
        if (!inside) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (!typing && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const d = e.key === "ArrowRight" ? 1 : -1;
        if (p.kind === "carousel") go(s + d);
        else step(d);
      } else if (!typing && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        step(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (post.kind !== "carousel") return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (s?.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) goSlide(slide + (dx < 0 ? 1 : -1));
  };

  const current: DesignSlide | undefined = slides[slide];
  const pal = post.kind === "reel" ? (post.video?.pal ?? []) : (current?.pal ?? []);
  const dims =
    post.kind === "reel" && post.video
      ? { w: post.video.w, h: post.video.h }
      : { w: current?.img.w ?? 0, h: current?.img.h ?? 0 };
  const weight = post.kind === "reel" ? (post.video?.kb ?? 0) : (current?.kb ?? 0);
  const details = view === "details";
  const parts = captionParts(post.caption);
  const vars = { "--lib-colour": meta.colour, "--lib-ink": meta.ink } as CSSProperties;

  return createPortal(
    <div
      ref={rootRef}
      className={styles.root}
      style={vars}
      role="dialog"
      aria-modal="true"
      aria-label={post.title}
      data-lenis-prevent
    >
      <button
        type="button"
        className={styles.scrim}
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
      />

      <div className={styles.sheet}>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <p className={`${styles.where} hud-label`}>
              {campaign?.title ?? "Design"}
              <span aria-hidden="true" className={styles.dot} />
              {pad(position)} / {pad(total)}
            </p>
            <div className={styles.seg} role="group" aria-label="View of the piece">
              {(
                [
                  ["posted", "As posted"],
                  ["details", "Details"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => {
                    audio.blip("click");
                    onView(v);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={styles.stage}
            data-details={details}
            data-kind={post.kind}
            onPointerDown={down}
            onPointerUp={up}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            {post.kind === "reel" && post.video ? (
              <div
                key={post.id}
                className={styles.reel}
                style={{ "--reel-ar": `${post.video.w} / ${post.video.h}` } as CSSProperties}
                data-shape={post.video.h > post.video.w ? "tall" : "wide"}
              >
                <VideoCard
                  className={styles.reelCard}
                  tag="Reel"
                  duration={post.video.dur}
                  video={{
                    title: post.title,
                    poster: libUrl(post.video.poster),
                    sources: videoSources(post.video, libUrl),
                  }}
                />
                <p className={`${styles.reelNote} hud-label`}>
                  Press play. The player opens full screen.
                </p>
              </div>
            ) : (
              <div className={styles.viewport}>
                <div className={styles.track} style={{ transform: `translateX(${-slide * 100}%)` }}>
                  {slides.map((s, i) => (
                    <div key={`${post.id}-${i}`} className={styles.slide} aria-hidden={i !== slide}>
                      <div className={styles.frame}>
                        {/* Plain <img>: static export, and the library lives on another origin. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={libUrl(s.img.p)}
                          alt={
                            slides.length > 1
                              ? `${post.title}, slide ${i + 1} of ${slides.length}`
                              : post.title
                          }
                          width={s.img.w}
                          height={s.img.h}
                          draggable={false}
                          decoding="async"
                          style={{ backgroundColor: s.img.c }}
                        />
                        {details ? (
                          <>
                            <span className={styles.gTop} aria-hidden="true">
                              <span className={`${styles.gLabel} hud-label`}>{s.img.w} px</span>
                            </span>
                            <span className={styles.gLeft} aria-hidden="true">
                              <span className={`${styles.gLabel} ${styles.gLabelV} hud-label`}>
                                {s.img.h} px
                              </span>
                            </span>
                            <span className={styles.gFoot} aria-hidden="true">
                              <PaletteStrip pal={s.pal} label="Dominant colours of this slide" />
                              <span className={`${styles.gMeta} hud-label`}>
                                {ratioLabel(s.img.w, s.img.h)}, {sizeLabel(s.kb)}
                              </span>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {post.kind === "carousel" ? (
              <>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.prev}`}
                  aria-label="Previous slide"
                  disabled={slide === 0}
                  onClick={() => {
                    goSlide(slide - 1);
                  }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M10 2L4 8l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.next}`}
                  aria-label="Next slide"
                  disabled={slide === slides.length - 1}
                  onClick={() => {
                    goSlide(slide + 1);
                  }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              </>
            ) : null}
          </div>

          <div className={styles.tableFoot}>
            {post.kind === "carousel" ? (
              <div className={styles.dots} role="group" aria-label="Slides">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1} of ${slides.length}`}
                    aria-current={i === slide ? "true" : undefined}
                    onClick={() => {
                      goSlide(i);
                    }}
                  />
                ))}
                <span className={`${styles.count} hud-label`} role="status" aria-live="polite">
                  {pad(slide + 1)} / {pad(slides.length)}
                </span>
              </div>
            ) : (
              <span />
            )}
            <p className={`${styles.keys} hud-label`}>
              {post.kind === "carousel"
                ? "Left and right: slides. Up and down: posts. Esc: close."
                : "Arrow keys: posts. Esc: close."}
            </p>
          </div>
        </div>

        <aside className={styles.side} data-side data-lenis-prevent aria-label="About this post">
          <div className={styles.sideHead}>
            <p className={`${styles.kind} hud-label`}>{kindLabel(post)}</p>
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close the viewer"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>

          <h2 className={`${styles.title} display`}>{post.title}</h2>
          <p className={`${styles.byline} hud-label`}>
            {formatDate(post.date)}
            <span aria-hidden="true" className={styles.dot} />
            {post.account}
            {post.kind === "reel" && post.video ? (
              <>
                <span aria-hidden="true" className={styles.dot} />
                {clock(post.video.dur)}
              </>
            ) : null}
          </p>

          {post.canon !== "official" ? (
            <div className={styles.fan}>
              <CanonBadge canon={post.canon} />
              <CreditLine credit={post.credit} canon={post.canon} />
            </div>
          ) : null}

          <section className={styles.caption} aria-label="Caption">
            {parts.map((para, i) => (
              <p key={i}>
                {para.map((part, j) =>
                  part.href ? (
                    <a
                      key={j}
                      href={part.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      {part.text}
                    </a>
                  ) : (
                    <span key={j}>{part.text}</span>
                  ),
                )}
              </p>
            ))}
            {post.note ? <p className={styles.note}>{post.note}</p> : null}
          </section>

          <section className={styles.block} aria-labelledby={`pal-${post.id}`}>
            <h3 id={`pal-${post.id}`} className="hud-label">
              Colours{post.kind === "carousel" ? `, slide ${slide + 1}` : ""}
            </h3>
            <PaletteCard key={`${post.id}-${slide}`} pal={pal} />
          </section>

          <section className={styles.block} aria-labelledby={`spec-${post.id}`}>
            <h3 id={`spec-${post.id}`} className="hud-label">
              Specs
            </h3>
            <dl className={styles.facts}>
              <div>
                <dt className="hud-label">Size</dt>
                <dd>
                  {dims.w} x {dims.h} px
                </dd>
              </div>
              <div>
                <dt className="hud-label">Ratio</dt>
                <dd>{ratioLabel(dims.w, dims.h)}</dd>
              </div>
              <div>
                <dt className="hud-label">File</dt>
                <dd>{sizeLabel(weight)}</dd>
              </div>
              <div>
                <dt className="hud-label">Format</dt>
                <dd>{kindLabel(post)}</dd>
              </div>
            </dl>
          </section>

          <div className={styles.links}>
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="link">
              View the original post
            </a>
            {post.kind !== "reel" && current ? (
              <a
                href={libUrl(current.img.f)}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Open the full size picture
              </a>
            ) : null}
          </div>

          <nav className={styles.step} aria-label="Other posts">
            <button
              type="button"
              disabled={position <= 1}
              onClick={() => {
                audio.blip("click");
                onStep(-1);
              }}
            >
              <span className="hud-label">Previous</span>
            </button>
            <button
              type="button"
              disabled={position >= total}
              onClick={() => {
                audio.blip("click");
                onStep(1);
              }}
            >
              <span className="hud-label">Next</span>
            </button>
          </nav>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
