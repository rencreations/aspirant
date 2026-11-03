"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { StarButton } from "@/components/ui/star-button";
import { put } from "@/features/character/vexana/seams/scroll-kit";
import { asset } from "@/lib/asset";
import { expectReady } from "@/lib/page-ready";
import { mediaUrl } from "@/lib/media-store";
import { useSiteStore } from "@/lib/stores";

import { chapterHref } from "../chapter-href";
import { HeroTitle } from "./hero-title";
import styles from "./hero.module.css";
import { HERO_POSTER, HERO_VIDEO } from "./media";
import type { StoryProgress } from "./progress";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The top of an element in the page, from the layout (a transform, such as the rise, does not move it). */
export function layoutTop(el: HTMLElement): number {
  let y = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null)
    y += node.offsetTop;
  return y;
}

/**
 * The first screen of the story page. A film fills the display behind a subtle shade, with the
 * title in the middle, the ways in below it and a cue to scroll at the bottom. The film plays muted
 * and in a loop while it is on screen and not covered, and is held still behind its still when it
 * cannot play. `progressRef` is how the join below it tells it how far the page has risen over it.
 */
export function StoryHero({
  progress,
  progressRef,
}: {
  progress: StoryProgress;
  progressRef: MutableRefObject<(p: number) => void>;
}) {
  const section = useRef<HTMLElement>(null);
  const film = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLButtonElement>(null);
  const state = useRef({ visible: false, covered: false });
  const sync = useRef<() => void>(() => undefined);
  const { scrollTo } = useLenis();
  const entered = useSiteStore((s) => s.entered);
  const [intro, setIntro] = useState(false);

  // The title comes in once the loading screen has gone (or at once for a returning visitor).
  useEffect(() => {
    if (!entered || intro) return;
    const t = window.setTimeout(() => setIntro(true), 420);
    return () => window.clearTimeout(t);
  }, [entered, intro]);

  // The film: the loaded copy if the page has it in memory, else the file. It holds the curtain until
  // it can show a picture (the still shows in its place if it can never play).
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.defaultMuted = true;
    el.muted = true;
    el.src = mediaUrl(HERO_VIDEO);
    const mark = expectReady("story-hero");
    const done = () => mark();
    if (el.readyState >= 2) done();
    el.addEventListener("loadeddata", done);
    el.addEventListener("error", done);
    return () => {
      el.removeEventListener("loadeddata", done);
      el.removeEventListener("error", done);
      mark();
    };
  }, []);

  // Plays only while it is on screen, the tab is shown and the page has not covered it.
  useEffect(() => {
    const el = video.current;
    const root = section.current;
    if (!el || !root) return;
    const s = state.current;
    const update = () => {
      if (s.visible && !s.covered && document.visibilityState === "visible")
        void el.play().catch(() => undefined);
      else el.pause();
    };
    sync.current = update;
    const io = new IntersectionObserver(
      (entries) => {
        s.visible = entries[entries.length - 1]?.isIntersecting ?? false;
        update();
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      el.pause();
    };
  }, []);

  // As the page rises over the hero: the title and the buttons lift away and fade, the cue goes first,
  // the film comes a little closer. Transform and opacity only. Once covered, the film rests.
  useEffect(() => {
    progressRef.current = (p) => {
      put(content.current, "opacity", String(Number((1 - clamp01(p * 1.5)).toFixed(3))));
      put(content.current, "transform", `translate3d(0, ${(-p * 7).toFixed(2)}vh, 0)`);
      put(cue.current, "opacity", String(Number((1 - clamp01(p * 10)).toFixed(3))));
      put(film.current, "transform", `scale(${(1 + 0.05 * p).toFixed(4)})`);
      const covered = p >= 1;
      if (covered !== state.current.covered) {
        state.current.covered = covered;
        sync.current();
      }
    };
    const set = progressRef;
    return () => {
      set.current = () => undefined;
    };
  }, [progressRef]);

  const toChapters = useCallback(() => {
    const el = document.getElementById("chapters");
    if (!el) return;
    scrollTo(layoutTop(el) - 88, { duration: 1.4 });
  }, [scrollTo]);

  const toStory = useCallback(() => {
    const el = document.getElementById("story-rise");
    if (el) scrollTo(layoutTop(el), { duration: 1.2 });
  }, [scrollTo]);

  const { resume, loaded } = progress;
  return (
    <section ref={section} className={styles.hero} data-theme="storm" aria-label="Aspirant Story">
      <div ref={film} className={styles.film} aria-hidden="true">
        <video
          ref={video}
          className={styles.video}
          poster={asset(HERO_POSTER)}
          muted
          loop
          playsInline
          preload="auto"
          tabIndex={-1}
        />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div ref={content} className={styles.content}>
        <HeroTitle play={intro} />
        <div className={styles.actions} data-ready={loaded ? "true" : "false"} data-play={intro}>
          {resume ? (
            <>
              <StarButton
                pulse
                size="lg"
                href={resume.href}
                transitionLabel="Story"
                aria-label="Continue reading where you stopped"
              >
                Continue
              </StarButton>
              <StarButton
                variant="ghost"
                size="lg"
                href={chapterHref("c00")}
                transitionLabel="Prologue"
              >
                Start reading
              </StarButton>
            </>
          ) : (
            <StarButton pulse size="lg" href={chapterHref("c00")} transitionLabel="Prologue">
              Start reading
            </StarButton>
          )}
          <StarButton variant="ghost" size="lg" arrow={false} onClick={toChapters}>
            Select Chapter
          </StarButton>
        </div>
      </div>
      <button ref={cue} type="button" className={styles.cue} onClick={toStory}>
        <span>Scroll for more</span>
        <span className={styles.cueLine} aria-hidden="true" />
      </button>
    </section>
  );
}
