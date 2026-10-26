"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { videoFile, videoPoster } from "../media";
import { comicsGate, toneHint } from "../seams/gates";
import { Doors, type DoorsApi } from "../seams/doors";
import { easeInOut, lvh, put } from "../seams/scroll-kit";
import { useScrollSnap, type SnapRange } from "../seams/snap";
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
 * It rises as a card of the full width of the screen whose top corners are rounded and sharpen
 * slowly at first, then quickly: the radius is `R * (1 - (p / 0.6)^3)` and is square from 60
 * percent of the way, so when it has come all the way it covers the whole screen with no corner and
 * no gap. The rise can never be left half way (`useScrollSnap`).
 *
 * Then it stays held for a while and the page leaves it by doors: two dark doors in the colours of
 * the comic close from the left and the right and meet (the film is hidden behind them): that part
 * follows the scroll and can never be left half way. When the doors have met, TIME takes over: they
 * open again by themselves on the comic, which was already waiting in place under them (see
 * `Comics`), whether the visitor scrolls or not, and the comic is there to be pressed at once. The
 * doors are opaque, so nothing of either section shows while they move. Scroll distances are in
 * screens, counted from the moment the panel is in place:
 *
 *   0 to 1.3   the film, the picture pushing in
 *   1.3 to 2.1 the doors close          (the film is hidden at 2.1, the comic is in place)
 *   2.1 on     the doors open by time on the comic
 *
 * Only `transform` and `opacity` move, except the radius of the corners while the panel rises.
 */
export function Cover() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const zoom = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const doors = useRef<DoorsApi>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** The two stretches of the page that can never be left half way, in scroll pixels. */
  const spans = useRef<{ rise: SnapRange | null; close: SnapRange | null }>({
    rise: null,
    close: null,
  });
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
    const cleanup: Array<() => void> = [];
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
          // The corners sharpen slowly at first and are square from 60 percent of the way.
          const q = Math.min(1, self.progress / 0.6);
          const r = self.progress >= 1 ? 0 : radius() * (1 - q * q * q);
          el.style.transform = "";
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
      // The doors close with the scroll (1.3 to 2.1 screens from the panel in place). Once they have
      // met they open by themselves, by time, on the comic that is already in place under them.
      const open = { v: 1 };
      let opening: gsap.core.Tween | null = null;
      let shutAlready = false;
      const draw = (shut: number) => {
        doors.current?.set(shut);
        // The dark doors are over the corner (where the nav text is) once they have closed a little.
        toneHint.set(shut >= 0.2 ? "dark" : null);
      };
      triggers.push(
        ScrollTrigger.create({
          trigger: root,
          start: at(1.3),
          end: at(2.1),
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            spans.current.close = { start: self.start, end: self.end };
          },
          onUpdate: (self) => {
            const closedNow = self.progress >= 0.9995;
            if (!closedNow) {
              // Scrolled back (or still closing): the doors follow the scroll, the comic waits.
              opening?.kill();
              opening = null;
              open.v = 1;
              draw(easeInOut(self.progress));
            }
            put(panel.current, "visibility", closedNow ? "hidden" : "visible");
            if (play.current.shut !== closedNow) {
              play.current.shut = closedNow;
              play.current.sync();
            }
            if (closedNow !== shutAlready) {
              shutAlready = closedNow;
              comicsGate.set(closedNow);
              if (closedNow) {
                open.v = 1;
                draw(1);
                opening = gsap.to(open, {
                  v: 0,
                  duration: 1.15,
                  delay: 0.15,
                  ease: "power2.inOut",
                  onUpdate: () => {
                    draw(open.v);
                  },
                });
              }
            }
          },
        }),
      );
      // Taken past the end in one go (a reload below, a fast fling): the doors are simply open.
      triggers.push(
        ScrollTrigger.create({
          trigger: root,
          start: at(2.1),
          end: "max",
          onEnter: () => {
            if (!shutAlready) {
              shutAlready = true;
              put(panel.current, "visibility", "hidden");
              comicsGate.set(true);
              draw(0);
            }
          },
        }),
      );
      cleanup.push(() => {
        opening?.kill();
      });
    }

    return () => {
      for (const t of triggers) t.kill();
      for (const c of cleanup) c();
      if (card) {
        card.style.transform = "";
        card.style.borderRadius = "";
        card.style.visibility = "";
      }
      comicsGate.set(false);
      toneHint.set(null);
    };
  }, [reduced]);

  // Neither stretch can be left half way: from half on the page goes on by itself, before it goes back.
  useScrollSnap("cover-rise", () => spans.current.rise, { enabled: !reduced });
  useScrollSnap("cover-doors", () => spans.current.close, { enabled: !reduced });

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
