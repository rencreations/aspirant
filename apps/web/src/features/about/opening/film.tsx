"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

import { useLenis } from "@/components/smooth-scroll";
import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";
import { lvh, put } from "@/features/character/vexana/seams/scroll-kit";
import { useScrollSnap, type SnapRange } from "@/features/character/vexana/seams/snap";
import { asset } from "@/lib/asset";
import { loadMedia, releaseMedia } from "@/lib/media-store";
import { expectReady } from "@/lib/page-ready";

import { morphEnd, type Box } from "../film-geometry";
import { LAYER } from "../layout";
import { pickStart, START_POSTER } from "../media";
import { stageRefs } from "../stage-bus";
import styles from "./film.module.css";
import { copyAt, PERCH, pictureAt, placementCss, tagAt, tintAt } from "./geometry";

const fixed = (v: number) => String(Number(v.toFixed(3)));

/** The play mark: one triangle, drawn in the colour of its button. */
function PlayMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path
        d="M12 9.6v16.8c0 1.3 1.4 2.1 2.5 1.4l13.3-8.4c1-.6 1-2.1 0-2.8L14.5 8.2c-1.1-.7-2.5.1-2.5 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The film: the reel's small preview on the first screen, which grows into a big window as the
 * page is scrolled.
 *
 * There is ONE picture. Its wrapper is laid out as the big window (by the stylesheet, from the
 * same arithmetic as `windowBox`), inside a stage that is stuck to the screen for the whole track.
 * At the top of the page one transform draws it on the preview's slot; the scroll takes it home
 * (`pictureAt`). So the preview and the window are the same playing film and nothing is swapped.
 * Each frame that the scroll moves, the scroll is read once and only transform and opacity are
 * written, and the picture's box is told to the drone, which flies behind it.
 *
 * A veil of the page's own paper lies over the preview. The pointer lifts it, a key's focus does
 * too, and the scroll takes it away for good. In the big window the play control opens the whole
 * film (`film`, the collection's own file) in the site's player, with sound. A stop inside the
 * morph settles after one second.
 */
export function Film({ film }: { film: PlayerVideo }) {
  const stage = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const range = useRef<SnapRange | null>(null);
  /** The preview was opened with a key: the play control takes the focus when the window is up. */
  const focusPlay = useRef(false);
  const { scrollTo } = useLenis();

  const [small, setSmall] = useState(true);
  const [complete, setComplete] = useState(false);
  const [lift, setLift] = useState(false);
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(true);
  const [shown, setShown] = useState(true);
  const [playing, setPlaying] = useState(false);

  useScrollSnap("about-film", () => range.current, { idleMs: 1000 });

  // The morph: written from the scroll, one frame at a time.
  useLayoutEffect(() => {
    const root = stage.current;
    const pic = picture.current;
    const track = root?.parentElement;
    if (!root || !pic || !track) return;
    const slotEl = track.querySelector<HTMLElement>("[data-about-slot]");
    const copyEl = track.querySelector<HTMLElement>("[data-about-copy]");
    let slot: Box = { x: 0, y: 0, w: 1, h: 1 };
    let win: Box = { x: 0, y: 0, w: 1, h: 1 };
    let vh = 1;
    let raf = 0;
    let wasSmall: boolean | null = null;
    let wasComplete: boolean | null = null;

    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      const { box, place } = pictureAt(slot, win, y, vh);
      stageRefs.film = box;
      put(pic, "transform", placementCss(place));
      put(veil.current, "opacity", fixed(tintAt(y, vh)));
      // The preview's button rides on the lower left corner of the picture while it is small.
      const tag = tagAt(y, vh);
      put(
        preview.current,
        "transform",
        `translate3d(${box.x.toFixed(2)}px, ${(box.y + box.h - slot.h).toFixed(2)}px, 0)`,
      );
      put(preview.current, "opacity", fixed(tag));
      put(copyEl, "opacity", fixed(copyAt(y, vh)));

      const nowSmall = tag > 0.4;
      if (nowSmall !== wasSmall) {
        wasSmall = nowSmall;
        setSmall(nowSmall);
      }
      // The snap leaves a pixel at the end, and the end itself is not a whole number.
      const nowComplete = y >= morphEnd(vh) - 1.5;
      if (nowComplete !== wasComplete) {
        wasComplete = nowComplete;
        setComplete(nowComplete);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const measure = () => {
      vh = lvh();
      // The window is the wrapper's own box, as the stylesheet lays it out (a transform does not
      // change these), in the stage, which is the screen while it is stuck.
      const cs = getComputedStyle(pic);
      win = {
        x: parseFloat(cs.left) || 0,
        y: parseFloat(cs.top) || 0,
        w: parseFloat(cs.width) || 1,
        h: parseFloat(cs.height) || 1,
      };
      if (slotEl) {
        // Nothing above the slot is transformed, so its box plus the scroll is its place in the page.
        const r = slotEl.getBoundingClientRect();
        slot = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
        root.style.setProperty("--slot-w", `${slot.w.toFixed(2)}px`);
        root.style.setProperty("--slot-h", `${slot.h.toFixed(2)}px`);
      }
      range.current = { start: 0, end: morphEnd(vh) };
      apply();
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    if (slotEl) ro.observe(slotEl);
    void document.fonts.ready.then(measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      range.current = null;
      stageRefs.film = null;
    };
  }, []);

  // The reel: the copy the loading list holds in memory, or its own download when the list never
  // ran (a returning tab, Back). It holds the curtain until it can show a picture; a reel that
  // can never play leaves its still.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.defaultMuted = true;
    el.muted = true;
    const picked = pickStart(window.innerWidth);
    const mark = expectReady("about-reel");
    const done = () => {
      setReady(true);
      // One frame later, so the curtain opens on a drawn picture.
      requestAnimationFrame(() => {
        requestAnimationFrame(mark);
      });
    };
    let live = true;
    void loadMedia(picked.src, {
      type: "video/mp4",
      ...(picked.bytes ? { expectedBytes: picked.bytes } : {}),
    }).then(
      (src) => {
        if (live) el.src = src;
      },
      () => {
        if (live) el.src = asset(picked.src);
      },
    );
    if (el.readyState >= 2) done();
    el.addEventListener("loadeddata", done);
    el.addEventListener("error", mark);
    return () => {
      live = false;
      el.removeEventListener("loadeddata", done);
      el.removeEventListener("error", mark);
      mark();
      el.pause();
      releaseMedia(picked.src);
    };
  }, []);

  // It plays only while the stage is on screen, the tab is shown and the player is closed.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      setNear(entries[entries.length - 1]?.isIntersecting ?? false);
    });
    io.observe(root);
    const onVisibility = () => {
      setShown(document.visibilityState === "visible");
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (ready && near && shown && !playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [ready, near, shown, playing]);

  // The window is up: a visitor who opened it with a key is taken to the play control.
  useEffect(() => {
    if (!complete || !focusPlay.current) return;
    focusPlay.current = false;
    playButton.current?.focus({ preventScroll: true });
  }, [complete]);

  const openWindow = useCallback(
    (event: ReactMouseEvent) => {
      // A press with no pointer is a key.
      focusPlay.current = event.detail === 0;
      setLift(false);
      scrollTo(morphEnd(lvh()), { duration: 1.25 });
    },
    [scrollTo],
  );

  const getOrigin = useCallback(() => picture.current?.getBoundingClientRect() ?? null, []);
  const onClosed = useCallback(() => {
    setPlaying(false);
  }, []);

  return (
    <div
      ref={stage}
      className={styles.stage}
      data-about-film=""
      data-complete={complete ? "" : undefined}
      data-lift={lift ? "" : undefined}
      style={
        {
          "--layer": LAYER.film,
          "--perch": `clamp(${PERCH.min}px, ${PERCH.vw}vw, ${PERCH.max}px)`,
          "--perch-inset": PERCH.inset,
          "--perch-lift": PERCH.lift,
        } as CSSProperties
      }
    >
      <div className={styles.perch} data-drone-anchor="perch" aria-hidden="true" />

      <div ref={picture} className={styles.picture} aria-hidden="true">
        <div className={styles.intro}>
          <div className={styles.media}>
            <video
              ref={video}
              className={styles.video}
              poster={asset(START_POSTER)}
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              tabIndex={-1}
            />
          </div>
          <div ref={veil} className={styles.veil}>
            <div className={styles.tint} />
          </div>
        </div>
      </div>

      <button
        ref={preview}
        type="button"
        className={styles.preview}
        aria-label="Open the film in its big window"
        data-cursor="OPEN"
        inert={!small}
        onClick={openWindow}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setLift(true);
        }}
        onPointerLeave={() => {
          setLift(false);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setLift(true);
        }}
        onBlur={() => {
          setLift(false);
        }}
      >
        <span className={styles.tag}>
          <span className={styles.tagMark}>
            <PlayMark />
          </span>
          <span className={styles.tagText}>Open the film</span>
        </span>
      </button>

      <div className={styles.controls} inert={!complete}>
        <p className={styles.index}>
          <span className={styles.mask}>
            <span>
              <span className={styles.indexNo}>02</span> / How it started
            </span>
          </span>
          <span className={styles.indexRule} aria-hidden="true" />
          <span className={styles.mask}>
            <span>From concept and design to production</span>
          </span>
        </p>
        <p className={styles.under} aria-hidden="true">
          <span className={styles.mask}>
            <span>From concept and design to production</span>
          </span>
        </p>

        <div className={styles.playAt}>
          <button
            ref={playButton}
            type="button"
            className={styles.play}
            aria-label={`Play ${film.title}, with sound`}
            aria-haspopup="dialog"
            data-cursor="PLAY"
            onClick={() => {
              setPlaying(true);
            }}
          >
            <PlayMark className={styles.playMark} />
          </button>
        </div>
      </div>

      {playing
        ? createPortal(
            <PlayerOverlay video={film} getOrigin={getOrigin} onClosed={onClosed} />,
            document.body,
          )
        : null}
    </div>
  );
}
