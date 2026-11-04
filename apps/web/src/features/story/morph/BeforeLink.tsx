"use client";

/**
 * "Before: ..." at the foot of a chapter, with a small picture of that chapter. A press unrolls
 * the chapter's title card from the top over this page (the blind) and opens it at its start; a
 * press with a modifier or no script follows the plain link.
 */
import { ChevronUp } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import type { ChapterEntry } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { OFFLINE_BLOCKED_EVENT } from "@/lib/offline";

import { chapterHref } from "../chapter-href";
import { useReader } from "../reader/reader-context";
import { dialogOpen, orPlain } from "./Door";
import s from "./morph.module.css";
import { isMorphing, loadOverlay, startMorph } from "./morph-store";
import { warmRoute } from "./warm";

export function BeforeLink({ previous }: { previous: ChapterEntry }) {
  const href = chapterHref(previous.id);
  const router = useTransitionRouter();
  const { theme, textScale } = useReader();
  const root = useRef<HTMLAnchorElement>(null);
  const [loading, setLoading] = useState<number | null>(null);

  // Near the end of the page: warm the chapter before too.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        warmRoute(href, router.prefetch);
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [href, router]);

  const go = async (keyboard: boolean): Promise<boolean> => {
    if (isMorphing() || router.isTransitioning() || dialogOpen()) return false;
    if (!router.canOpen(href)) {
      window.dispatchEvent(new Event(OFFLINE_BLOCKED_EVENT));
      return false;
    }
    const warm = warmRoute(href, router.prefetch);
    if (!warm.done) {
      setLoading(warm.progress);
      const stop = warm.listen(setLoading);
      await warm.ready;
      stop();
      setLoading(null);
    }
    await loadOverlay();
    if (!root.current?.isConnected) return false;
    return startMorph({ kind: "blind", entry: previous, href, theme, textScale, keyboard });
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    audio.blip("click");
    orPlain(go(e.detail === 0), router, href, () => !!root.current?.isConnected);
  };

  const name = previous.number === 0 ? "Prologue" : previous.title;
  return (
    <TLink
      ref={root}
      href={href}
      transition={false}
      blip={false}
      onClick={onClick}
      className={s.before}
      style={{ "--tint": previous.color } as CSSProperties}
    >
      <span className={s.beforeThumb} aria-hidden="true">
        {/* Plain <img>: static export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(`/${previous.sealed ?? previous.thumb}`)}
          alt=""
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <span className={s.beforeArrow}>
          <ChevronUp size={16} strokeWidth={1.75} />
        </span>
      </span>
      <span className={s.beforeText}>
        {`Before: ${name}`}
        {loading !== null && ` ${Math.round(loading * 100)}%`}
      </span>
    </TLink>
  );
}
