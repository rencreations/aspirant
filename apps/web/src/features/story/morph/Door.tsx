"use client";

/**
 * The card at the foot of a chapter: a small, live copy of the next chapter's title card (the same
 * picture with the same crop, its loop playing while the card is on screen), with the next
 * chapter's number, title and time line. A press opens it into that title card (the chapter
 * morph); a press with a modifier, a middle click or no script follows the plain link. After the
 * last chapter it leads to the end page.
 */
import type { Route } from "next";
import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import {
  useTransitionRouter,
  type TransitionRouter,
} from "@/components/transition/transition-provider";
import { chapterLabel } from "@/content/story";
import type { ChapterEntry } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { mediaUrl } from "@/lib/media-store";
import { OFFLINE_BLOCKED_EVENT } from "@/lib/offline";

import { chapterHref, END_HREF } from "../chapter-href";
import { END_KICKER, END_TITLE } from "../reader/end-copy";
import rs from "../reader/reader.module.css";
import { useReader } from "../reader/reader-context";
import { registerDoor } from "./doors";
import { parseFocus, place, stageFit } from "./morph-math";
import s from "./morph.module.css";
import { isMorphing, loadOverlay, startMorph } from "./morph-store";
import { warmRoute } from "./warm";
import { Words } from "./words";

/** A dialog (the picture viewer, the contents, the settings) is open: no morph starts. */
export function dialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

/**
 * A press always leads somewhere: when its morph did not start (and none is running, the link is
 * still on the page and the page can be opened), the page opens the plain way, with the curtain.
 */
export function orPlain(
  started: Promise<boolean>,
  router: TransitionRouter,
  href: Route,
  alive: () => boolean,
): void {
  const plain = () => {
    if (alive() && !isMorphing() && !router.isTransitioning() && router.canOpen(href))
      router.push(href);
  };
  void started.then((ok) => {
    if (!ok) plain();
  }, plain);
}

export function Door({ next, from }: { next: ChapterEntry | null; from: ChapterEntry }) {
  const href = next ? chapterHref(next.id) : END_HREF;
  const key = next ? next.id : "end";
  const router = useTransitionRouter();
  const { theme, textScale } = useReader();
  const root = useRef<HTMLAnchorElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const zoom = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [warmed, setWarmed] = useState(false);

  const first = next?.first[0];
  const clip = next && !next.sealed && first?.kind === "clip" ? first : null;
  const still = next
    ? (next.sealed ?? (first ? (first.kind === "clip" ? first.poster : first.src) : next.thumb))
    : null;

  // The stage: a box of the title card's size, scaled down to fill the card on the focus point.
  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    const z = zoom.current;
    if (!el || !st || !z || !next) return;
    const focus = parseFocus(next.focus);
    const fit = () => {
      const vw = document.documentElement.clientWidth;
      st.style.width = `${vw}px`;
      const view = { w: vw, h: st.offsetHeight };
      const card = { w: el.clientWidth, h: el.clientHeight };
      if (!card.w || !card.h || !view.h) return;
      const p = stageFit(card, view, focus);
      st.style.transform = place(p);
      z.style.transformOrigin = `${(card.w / 2 - p.x) / p.s}px ${(card.h / 2 - p.y) / p.s}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [next]);

  // Within about a screen of the card: warm the next chapter and the morph's code.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    void loadOverlay();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const warm = warmRoute(href, router.prefetch);
        void warm.ready.then(() => setWarmed(true));
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [href, router]);

  // The loop: from memory once the chapter is warm (so it is fetched once), playing while seen.
  useEffect(() => {
    const v = video.current;
    if (!v || !clip || !warmed) return;
    v.defaultMuted = true;
    v.muted = true;
    v.src = mediaUrl(`/${clip.src}`);
    let seen = false;
    const update = () => {
      if (seen && document.visibilityState === "visible" && !isMorphing())
        void v.play().catch(() => undefined);
      else if (!isMorphing()) v.pause();
    };
    const io = new IntersectionObserver(
      (entries) => {
        seen = entries[entries.length - 1]?.isIntersecting ?? false;
        update();
      },
      { threshold: 0.2 },
    );
    io.observe(v);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      v.pause();
    };
  }, [clip, warmed]);

  const go = useCallback(
    async (keyboard: boolean): Promise<boolean> => {
      const el = root.current;
      if (!el || isMorphing() || router.isTransitioning() || dialogOpen()) return false;
      if (!router.canOpen(href)) {
        window.dispatchEvent(new Event(OFFLINE_BLOCKED_EVENT));
        return false;
      }
      const warm = warmRoute(href, router.prefetch);
      if (!warm.done) {
        // Quicker than the files: the card shows how far they are and opens when they are in.
        setLoading(warm.progress);
        el.style.setProperty("--load", String(warm.progress));
        const stop = warm.listen((p) => {
          setLoading(p);
          el.style.setProperty("--load", String(p));
        });
        await warm.ready;
        stop();
        setLoading(null);
      }
      await loadOverlay();
      if (!el.isConnected) return false;
      const base = { href, theme, textScale, keyboard, door: el };
      return startMorph(
        next ? { ...base, kind: "forward", entry: next } : { ...base, kind: "end", from },
      );
    },
    [from, href, next, router, textScale, theme],
  );

  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return registerDoor(key, { el, start: (keyboard) => goRef.current(keyboard) });
  }, [key]);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    audio.blip("click");
    // A press with no pointer behind it (Enter) is the keyboard's.
    orPlain(go(e.detail === 0), router, href, () => !!root.current?.isConnected);
  };

  const pct = loading === null ? null : `${Math.round(loading * 100)}%`;
  return (
    <TLink
      ref={root}
      href={href}
      transition={false}
      blip={false}
      onClick={onClick}
      className={s.door}
      style={{ "--tint": next ? next.color : from.color } as CSSProperties}
      data-cursor="NEXT"
      data-loading={loading === null ? undefined : "true"}
    >
      {next && (
        <span ref={stage} className={s.doorStage}>
          <span ref={zoom} className={s.doorZoom}>
            <span className={s.doorPull}>
              {clip ? (
                <video
                  ref={video}
                  className={s.media}
                  style={{ objectPosition: next.focus }}
                  poster={asset(`/${clip.poster}`)}
                  muted
                  loop
                  playsInline
                  preload="none"
                  data-door="media"
                />
              ) : (
                <>
                  {/* Plain <img>: static export. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={s.media}
                    style={{ objectPosition: next.focus }}
                    src={asset(`/${still}`)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    data-door="media"
                  />
                </>
              )}
              <span className={rs.cardShade} aria-hidden="true" />
            </span>
          </span>
        </span>
      )}
      <span className={s.doorShade} aria-hidden="true" data-door="shade" />
      <span className={s.doorText}>
        <span className={s.doorNext} data-door="next">
          {next ? "Next" : "The story stops here"}
          {pct && ` ${pct}`}
        </span>
        <span className={s.doorLabel} data-door="label">
          <Words text={next ? chapterLabel(next) : END_KICKER} />
        </span>
        <span className={s.doorTitle} data-door="title">
          <Words text={next ? next.title : END_TITLE} />
        </span>
        {next?.dateline ? (
          <span className={s.doorDate} data-door="date">
            <Words text={next.dateline} />
          </span>
        ) : !next ? (
          <span className={s.doorDate} data-door="date">
            and when it all happened
          </span>
        ) : null}
      </span>
      <span className={s.doorLoad} aria-hidden="true" />
    </TLink>
  );
}
