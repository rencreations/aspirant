"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { videoFile, videoPoster } from "../media";
import { lvh } from "../../vexana/seams/scroll-kit";
import { useScrollSnap, type SnapRange } from "../../vexana/seams/snap";
import { PlayerButton, videoFor } from "../shared/player-button";
import styles from "./cover.module.css";
import { riseRadius, riseScale } from "../../vexana/cover/cover-math";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * The cover-up. This section does not scroll in like the others: it overlaps the section before it
 * (`margin-top: -100lvh`, and that section keeps its stage stuck for that screen: see `.track` in
 * faces.module.css), so plain scrolling makes this panel rise and cover it, with a shadow thrown up
 * onto what it covers. There is no script moving the section underneath, so nothing can lag behind a
 * fast or touch scroll and leave a gap. Then the panel holds while the picture slowly pushes in, and
 * the film plays muted by itself while it is in view. The play button opens the site's player with
 * the full film and its sound.
 *
 * It rises as a card that is narrower than the screen at first, with a padding at both sides (the
 * pair behind it shows there), and the padding fills as it comes (`riseScale`: a scale about its top
 * middle, so it looks as if the film expands and zooms). Its top corners are rounded and sharpen
 * slowly at first, then quickly: the radius is `R * (1 - (p / 0.6)^3)` and is square from 60
 * percent of the way, so when it has come all the way it covers the whole screen with no corner and
 * no gap. The rise can never be left half way (`useScrollSnap`).
 *
 * Then it stays held for a while (the film plays on and the picture slowly pushes in), and the page
 * leaves it by doors (`seams/door-gate.tsx`, dark doors in the colours of the comic, TIME based, both
 * ways): the last screen of this section is held, a little more scrolling starts the scene, the
 * scroll is locked, the doors close on the film and open on the comic, and the scroll comes back when
 * the comic is all in view and can be pressed. Back up from the comic, past its own threshold, the
 * doors close on the comic and open on this screen. This section only has to be the last screen
 * that is held: it has no doors of its own.
 *
 * Only `transform` and `opacity` move, except the radius of the corners while the panel rises.
 */
export function Cover() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const zoom = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** The stretch of the page that can never be left half way, in scroll pixels. */
  const spans = useRef<{ rise: SnapRange | null }>({ rise: null });
  /** The film plays only while the panel is on screen. */
  const play = useRef({
    visible: false,
    sync: () => {
      /* set by the effect below */
    },
  });

  // The film: the loaded copy if the page has it in memory, else the file. Set after mount so the
  // server and the first client render agree.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.defaultMuted = true;
    el.muted = true;
    el.src = mediaUrl(videoFile("final2"));
  }, []);

  // Plays only while it is on screen, and never under reduced motion.
  useEffect(() => {
    const el = video.current;
    const root = section.current;
    if (!el || !root || reduced) return;
    const state = play.current;
    const sync = () => {
      if (state.visible && document.visibilityState === "visible")
        void el.play().catch(() => undefined);
      else el.pause();
    };
    state.sync = sync;
    const io = new IntersectionObserver(
      ([entry]) => {
        state.visible = entry?.isIntersecting ?? false;
        sync();
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      el.pause();
    };
  }, [reduced]);

  // The shadow on what is covered, the corners, and the push-in of the picture.
  useEffect(() => {
    const root = section.current;
    const card = panel.current;
    if (!root) return;
    const triggers: ScrollTrigger[] = [];
    const at = (screens: number) => () => `top top-=${(screens * lvh()).toFixed(0)}`;
    const radius = () => Math.min(72, Math.max(24, window.innerWidth * 0.045));

    triggers.push(
      ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "top top",
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          spans.current.rise = { start: self.start, end: self.end };
        },
        onUpdate: (self) => {
          const el = panel.current;
          if (!el || reduced) return;
          // The panel comes up narrower than the screen, with a padding at both sides that fills as it
          // rises (a scale about its top middle, so it looks as if it expands and zooms), and its
          // corners sharpen slowly at first and are square from 60 percent of the way. Flat, with no
          // transform at all, before it begins and once it has come.
          const p = self.progress;
          const r = riseRadius(p, radius());
          el.style.transform = p <= 0 || p >= 1 ? "" : `scale(${riseScale(p).toFixed(4)})`;
          el.style.borderRadius = r < 0.5 ? "0" : `${r.toFixed(1)}px ${r.toFixed(1)}px 0 0`;
        },
      }),
    );

    if (!reduced) {
      triggers.push(
        ScrollTrigger.create({
          trigger: root,
          start: "top bottom",
          end: at(1.3),
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (zoom.current) {
              zoom.current.style.transform = `scale(${(1.12 + self.progress * 0.12).toFixed(4)})`;
            }
          },
        }),
      );
    }

    return () => {
      for (const t of triggers) t.kill();
      if (card) {
        card.style.transform = "";
        card.style.borderRadius = "";
      }
    };
  }, [reduced]);

  // The rise can never be left half way: from half on the page goes on by itself, before it goes back.
  useScrollSnap("cover-rise", () => spans.current.rise, { enabled: !reduced });

  return (
    <section
      ref={section}
      id="cover"
      className={styles.cover}
      data-plain={reduced}
      data-theme="storm"
      aria-labelledby="cover-title"
    >
      <div className={styles.pin}>
        <div ref={panel} className={styles.panel}>
          <div ref={zoom} className={styles.zoom}>
            <video
              ref={video}
              className={styles.film}
              poster={videoPoster("final2")}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <div className={styles.veil} aria-hidden="true" />
          <div className={styles.copy}>
            <p className={styles.kicker}>Interlude</p>
            <h2 id="cover-title" className={styles.title}>
              <span>She will not</span>
              <span className={styles.serif}>let go.</span>
            </h2>
            <p className={styles.text}>
              In the ruins, with a star at her collar that will not go dark and a promise she will
              not let go of. Then, at last, the star answers.
            </p>
          </div>
          <PlayerButton
            className={styles.play}
            label="Play the film with sound"
            video={videoFor("final2", "Guinevere, the one who will not let go")}
          >
            <span className={styles.ring} aria-hidden="true" />
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span className={styles.playLabel}>Watch with sound</span>
          </PlayerButton>
        </div>
      </div>
    </section>
  );
}
