"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { videoFile, videoPoster } from "../media";
import { comicsGate, toneHint } from "../seams/gates";
import { Doors, type DoorsApi } from "../seams/doors";
import { easeInOut, lvh, put, seg } from "../seams/scroll-kit";
import { PlayerButton, videoFor } from "../shared/player-button";
import styles from "./cover.module.css";

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
 * It rises as a card whose corners are rounded and sharpen as it comes (the panel grows from a
 * little under full size to full size, and the radius goes to nothing), so when it has come all the
 * way it covers the whole screen with no corner and no gap.
 *
 * Then it stays held for a long time and the page leaves it by doors: two dark doors in the colours
 * of the comic close from the left and the right and meet (the film is hidden behind them), and open
 * again on the comic, which was already waiting in place under them (see `Under` and `Comics`). The
 * doors are opaque, so nothing of either section shows while they move. Scroll distances are in
 * screens, counted from the moment the panel is in place:
 *
 *   0 to 1.3   the film, the picture pushing in
 *   1.3 to 2.1 the doors close          (the film is hidden at 2.1)
 *   2.1 to 2.4 closed
 *   2.4 to 3.3 the doors open on the comic (the comic is in place from 2.4: `OPEN` in comics.tsx)
 *
 * Only `transform` and `opacity` move, except the radius of the corners while the panel rises.
 */
export function Cover() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const zoom = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const doors = useRef<DoorsApi>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** The film plays only while the panel is on screen and not hidden behind the doors. */
  const play = useRef({
    visible: false,
    shut: false,
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
      if (state.visible && !state.shut && document.visibilityState === "visible")
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

  // The shadow on what is covered, the corners, the push-in of the picture, and the doors.
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
        onUpdate: (self) => {
          if (shade.current)
            shade.current.style.opacity = String(Math.min(1, self.progress * 1.15));
          const el = panel.current;
          if (!el || reduced) return;
          const p = self.progress;
          if (p >= 1) {
            el.style.transform = "";
            el.style.borderRadius = "0";
          } else {
            const e = easeInOut(p);
            const r = radius() * (1 - e);
            el.style.transform = `scale(${(0.9 + 0.1 * e).toFixed(4)})`;
            el.style.borderRadius = `${r.toFixed(1)}px ${r.toFixed(1)}px 0 0`;
          }
        },
        onLeaveBack: () => {
          if (shade.current) shade.current.style.opacity = "0";
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
      // The doors: closing 1.3 to 2.1, shut to 2.4, open 2.4 to 3.3 (screens from the panel in place).
      triggers.push(
        ScrollTrigger.create({
          trigger: root,
          start: at(1.3),
          end: at(3.3),
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const t = 1.3 + 2 * self.progress;
            const shut = t < 2.4 ? easeInOut(seg(t, 1.3, 2.1)) : 1 - easeInOut(seg(t, 2.4, 3.3));
            doors.current?.set(shut);
            put(panel.current, "visibility", t >= 2.1 ? "hidden" : "visible");
            if (play.current.shut !== t >= 2.1) {
              play.current.shut = t >= 2.1;
              play.current.sync();
            }
            comicsGate.set(t >= 2.4);
            // The dark doors are over the corner (where the nav text is) once they have closed a little.
            toneHint.set(shut >= 0.2 ? "dark" : null);
          },
        }),
      );
    }

    return () => {
      for (const t of triggers) t.kill();
      if (card) {
        card.style.transform = "";
        card.style.borderRadius = "";
        card.style.visibility = "";
      }
      comicsGate.set(false);
      toneHint.set(null);
    };
  }, [reduced]);

  return (
    <section
      ref={section}
      id="cover"
      className={styles.cover}
      data-plain={reduced}
      data-theme="storm"
      aria-labelledby="cover-title"
    >
      <div ref={shade} className={styles.shade} aria-hidden="true" />
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
              <span>She carries</span>
              <span className={styles.serif}>all of it.</span>
            </h2>
            <p className={styles.text}>
              Alone in the ruins, with a staff that is too heavy and a promise that is heavier. Then
              someone comes back for her.
            </p>
          </div>
          <PlayerButton
            className={styles.play}
            label="Play the film with sound"
            video={videoFor("final2", "Vexana, the one who carries it all")}
          >
            <span className={styles.ring} aria-hidden="true" />
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span className={styles.playLabel}>Watch with sound</span>
          </PlayerButton>
        </div>
        {reduced ? null : (
          <div className={styles.doors}>
            <Doors ref={doors} tone="comic" />
          </div>
        )}
      </div>
    </section>
  );
}
