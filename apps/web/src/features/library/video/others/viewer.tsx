"use client";

import type { Route } from "next";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { TLink } from "@/components/transition/t-link";
import { VideoCard } from "@/components/video-player/video-card";
import { ReportLink } from "@/features/legal/takedown/report-link";
import { audio } from "@/lib/audio";

import { CanonBadge, CreditLine } from "../../shell/credit";
import { getCollection } from "../../registry";
import type { OtherVideo } from "./types";
import { useCaptionsBlob } from "./use-captions-blob";
import styles from "./viewer.module.css";
import {
  KIND_LABEL,
  captionsUrl,
  clock,
  dateWords,
  notice,
  pairName,
  posterUrl,
  runtimeWords,
  sceneAt,
  sizeWords,
  thumbUrl,
  videoUrlAt,
} from "./video-data";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const OPEN_MS = 520;
const CLOSE_MS = 400;

interface ViewerProps {
  video: OtherVideo;
  /** Where the video is on the wall, and how many there are, for the counter. */
  position: number;
  total: number;
  /** The title of the shelf (or pair, or length) the video is in. */
  groupTitle: string;
  /** More from the same shelf, after this one. */
  more: readonly OtherVideo[];
  /** Where playback starts, in seconds (from the address, or a scene that was chosen). */
  start: number;
  /** Asked once, as the viewer opens: the picture on the wall it grows out of, or null (it then fades in). */
  takeOrigin: () => DOMRect | null;
  /** The picture on the wall now, for the way back. */
  getOrigin: (id: string) => DOMRect | null;
  onSeek: (seconds: number) => void;
  onShow: (video: OtherVideo) => void;
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}

/** The transform that puts a box of `from` size and place over a box of `to`. */
function between(from: DOMRect, to: DOMRect): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}

/**
 * The viewer of one video. It grows out of the tile that was pressed (the picture moves with a
 * transform, the sheet fades in), shows the site's player card with its poster and a play button,
 * the words about the video, the scenes when there are any, and a row of more from the same shelf.
 * Previous and next, the arrow keys and Esc work. Pressing play opens the site's player over it.
 * Nothing plays by itself, and the page behind keeps its place and its scrollbar.
 */
export function Viewer({
  video,
  position,
  total,
  groupTitle,
  more,
  start,
  takeOrigin,
  getOrigin,
  onSeek,
  onShow,
  onStep,
  onClose,
}: ViewerProps) {
  const meta = getCollection("video");
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const playerOpen = useRef(false);
  const wantPress = useRef(false);
  const closing = useRef(false);
  const firstId = useRef(video.id);
  const [cardKey, setCardKey] = useState(0);
  const [morphing, setMorphing] = useState(true);
  const captions = useCaptionsBlob(captionsUrl(video));
  const label = notice(video);

  const playFrom = Math.min(start, Math.max(0, video.video.dur - 1));
  const current = sceneAt(video.chapters, playFrom);

  const player = useMemo(
    () => ({
      sources: [{ label: "Original", height: video.video.h, src: videoUrlAt(video, playFrom) }],
      poster: posterUrl(video),
      title: video.title,
      captions,
    }),
    [video, playFrom, captions],
  );

  const pressPlay = useCallback(() => {
    stage.current?.querySelector<HTMLButtonElement>("button[data-cursor='PLAY']")?.click();
  }, []);

  // The opening: the picture grows out of its tile, the sheet fades in, the words rise.
  useLayoutEffect(() => {
    const s = stage.current;
    const b = backdrop.current;
    const i = info.current;
    if (!s || !b || !i) return;
    const animations: Animation[] = [];
    const origin = takeOrigin();
    if (origin) {
      animations.push(
        s.animate(
          [
            { transformOrigin: "0 0", transform: between(origin, s.getBoundingClientRect()) },
            { transformOrigin: "0 0", transform: "none" },
          ],
          { duration: OPEN_MS, easing: EASE },
        ),
      );
    } else {
      animations.push(
        s.animate(
          [
            { opacity: 0, transform: "scale(0.97)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: OPEN_MS, easing: EASE },
        ),
      );
    }
    const top = panel.current?.querySelector("header");
    animations.push(
      b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.7, easing: "linear" }),
      ...(top
        ? [
            top.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: OPEN_MS * 0.7,
              easing: "linear",
            }),
          ]
        : []),
      i.animate(
        [
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 460, delay: 140, easing: EASE, fill: "backwards" },
      ),
    );
    const settle = window.setTimeout(() => {
      setMorphing(false);
    }, OPEN_MS * 0.6);
    return () => {
      window.clearTimeout(settle);
      animations.forEach((a) => {
        a.cancel();
      });
    };
    // Only on the way in: a step to another video has its own short change below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A step to another video: the picture and the words change with a short fade.
  useEffect(() => {
    if (firstId.current === video.id) return;
    firstId.current = video.id;
    const targets = [stage.current, info.current].filter((e): e is HTMLDivElement => e !== null);
    const animations = targets.map((t) =>
      t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "linear" }),
    );
    panel.current?.scrollTo({ top: 0 });
    return () => {
      animations.forEach((a) => {
        a.cancel();
      });
    };
  }, [video.id]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const s = stage.current;
    const b = backdrop.current;
    const i = info.current;
    const target = getOrigin(video.id);
    const done = () => {
      onClose();
    };
    if (!s || !b || !i) {
      done();
      return;
    }
    setMorphing(true);
    for (const fading of [i, panel.current?.querySelector("header"), field.current]) {
      fading?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: CLOSE_MS * 0.5,
        easing: "linear",
        fill: "forwards",
      });
    }
    b.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: CLOSE_MS,
      easing: "linear",
      fill: "forwards",
    });
    const moved = s.animate(
      target
        ? [
            { transformOrigin: "0 0", transform: "none" },
            { transformOrigin: "0 0", transform: between(target, s.getBoundingClientRect()) },
          ]
        : [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "scale(0.97)" },
          ],
      { duration: CLOSE_MS, easing: EASE, fill: "forwards" },
    );
    moved.onfinish = done;
    moved.oncancel = done;
  }, [getOrigin, onClose, video.id]);

  // A scene (or "from the beginning") presses play at once: the visitor asked for it.
  useEffect(() => {
    if (!wantPress.current) return;
    // Cleared when the press is made, not before: a dev build runs this effect twice.
    const id = window.requestAnimationFrame(() => {
      wantPress.current = false;
      pressPlay();
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [cardKey, video.id, pressPlay]);

  // The site's player is a second layer over this one. Know when it is open: Esc and the arrow
  // keys are its own then.
  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    const read = () => {
      const btn = host.querySelector<HTMLElement>("button[data-cursor='PLAY']");
      const open = btn?.getAttribute("data-open") === "true";
      if (open !== playerOpen.current) {
        playerOpen.current = open;
        // The player gives the page back when it closes. This view still covers it.
        const shell = document.getElementById("site-shell");
        if (shell && !open) shell.inert = true;
        if (!open) panel.current?.focus({ preventScroll: true });
      }
    };
    const mo = new MutationObserver(read);
    mo.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-open"],
    });
    return () => {
      mo.disconnect();
    };
  }, [cardKey, video.id]);

  // Page chrome: the page behind is still and unreachable, focus is kept here and given back.
  useEffect(() => {
    const shell = document.getElementById("site-shell");
    if (shell) shell.inert = true;
    const back = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (shell) shell.inert = false;
      if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (playerOpen.current) return;
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (t?.closest("input, [role='slider']")) return;
        e.preventDefault();
        onStep(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose, onStep]);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || playerOpen.current) return;
    const items = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]):not([tabindex='-1'])",
      ) ?? [],
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === panel.current)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const go = (index: number) => {
    const scene = video.chapters[index];
    if (!scene) return;
    audio.blip("click");
    wantPress.current = true;
    onSeek(scene.t);
    setCardKey((k) => k + 1);
  };

  const vars = {
    "--lib-colour": meta.colour,
    "--lib-ink": meta.ink,
    "--ar": video.ar,
    "--field": video.c,
  } as CSSProperties;
  const date = dateWords(video.date);
  const pair = pairName(video.pair);
  const titleId = `viewer-title-${video.id}`;

  return createPortal(
    <div className={styles.root} data-theme="daybreak" style={vars}>
      <div ref={backdrop} className={styles.backdrop} data-lenis-prevent />
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        onKeyDown={trap}
      >
        <header className={styles.top}>
          <p className={`${styles.crumb} hud-label`}>
            <span>Others</span>
            <span aria-hidden="true">/</span>
            <span>{groupTitle}</span>
            <span className={styles.counter} aria-label={`Video ${position} of ${total}`}>
              {String(position).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.square}
              aria-label="Previous video"
              onClick={() => {
                onStep(-1);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.square}
              aria-label="Next video"
              onClick={() => {
                onStep(1);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.square}
              aria-label="Close"
              onClick={requestClose}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M5 5l14 14M19 5L5 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.stageCol}>
            <div ref={field} className={styles.field} aria-hidden="true" />
            <div ref={stage} className={styles.stage} data-morph={morphing || undefined}>
              <VideoCard
                key={`${video.id}:${cardKey}`}
                video={player}
                duration={video.video.dur}
                tag={KIND_LABEL[video.kind]}
                className={styles.card}
              />
            </div>
            {playFrom > 0 ? (
              <p className={`${styles.startNote} hud-label`} role="status">
                <span>Plays from {clock(playFrom)}</span>
                <button
                  type="button"
                  onClick={() => {
                    wantPress.current = false;
                    onSeek(0);
                    setCardKey((k) => k + 1);
                  }}
                >
                  From the beginning
                </button>
              </p>
            ) : null}
          </div>

          <div ref={info} className={styles.info}>
            <p className={`${styles.kind} hud-label`}>
              {KIND_LABEL[video.kind]}
              {video.group ? `, chapter ${video.group}` : ""}
            </p>
            <h2 id={titleId} className={`${styles.title} display`}>
              {video.title}
            </h2>
            <p className={styles.lead}>{video.desc}</p>
            {label ? (
              <div className={styles.notice} role="note">
                {label.kind === "badge" ? <CanonBadge canon={video.canon} /> : null}
                {video.kind === "parody" ? (
                  <p>A live-action parody made outside the story. Nothing in it counts as canon.</p>
                ) : label.kind === "badge" ? (
                  <p>Made by a fan. It is not part of the story.</p>
                ) : (
                  <p>
                    <strong>{label.text}.</strong>{" "}
                    {video.kind === "gameplay"
                      ? "Game footage shows the game, not the story."
                      : "It was cut from in-game animation and tells no part of the story."}
                  </p>
                )}
              </div>
            ) : null}
            <CreditLine credit={video.credit} canon={video.canon} />
            {video.canon !== "official" ? (
              <ReportLink item={{ id: video.id, title: video.title }} className={styles.report} />
            ) : null}
            <dl className={`${styles.facts} hud-label`}>
              <div>
                <dt>Runs</dt>
                <dd>{runtimeWords(video.video.dur)}</dd>
              </div>
              <div>
                <dt>Picture</dt>
                <dd>
                  {video.video.w} x {video.video.h}
                </dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{sizeWords(video.bytes)}</dd>
              </div>
              {pair ? (
                <div>
                  <dt>Pair</dt>
                  <dd>{pair}</dd>
                </div>
              ) : null}
              {date ? (
                <div>
                  <dt>Posted</dt>
                  <dd>{date}</dd>
                </div>
              ) : null}
              <div>
                <dt>Captions</dt>
                <dd>{video.video.captions ? "English" : "None"}</dd>
              </div>
            </dl>
            {video.link ? (
              <TLink
                href={video.link.href as Route}
                transitionLabel="Vexana"
                className={styles.moreLink}
              >
                <span className="hud-label">{video.link.label}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </TLink>
            ) : null}
            {video.chapters.length > 0 ? (
              <div className={styles.scenes}>
                <h3 className={`${styles.scenesTitle} hud-label`}>
                  Scenes, {video.chapters.length}
                </h3>
                <ol className={styles.sceneList}>
                  {video.chapters.map((c, i) => (
                    <li key={c.t}>
                      <button
                        type="button"
                        className={styles.scene}
                        aria-current={current === i ? "true" : undefined}
                        onClick={() => {
                          go(i);
                        }}
                      >
                        <span className={styles.sceneTime}>{clock(c.t)}</span>
                        <span className={styles.sceneLabel}>{c.l}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>

        {more.length > 0 ? (
          <section className={styles.more} aria-label={`More from ${groupTitle}`}>
            <div className={styles.moreInner}>
              <h3 className={`${styles.moreTitle} hud-label`}>More from {groupTitle}</h3>
              <ul className={styles.moreList}>
                {more.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={styles.miniHit}
                      onClick={() => {
                        audio.blip("click");
                        onShow(m);
                      }}
                    >
                      <span className={styles.mini} style={{ "--field": m.c } as CSSProperties}>
                        {/* A thumbnail of the library. Plain <img>: static export, art already sized. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbUrl(m)} alt="" loading="lazy" decoding="async" />
                        <span className={styles.miniLength}>{clock(m.video.dur)}</span>
                      </span>
                      <span className={styles.miniTitle}>{m.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
