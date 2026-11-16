"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { TLink } from "@/components/transition/t-link";
import { formatTime } from "@/components/video-player/player-math";
import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";

import { stageRefs } from "../../stage-bus";
import kit from "../kit.module.css";

import { PhasePlayer } from "./phase-player";
import type { PhaseVideo } from "./types";
import { usePageCovered } from "./video-covered";
import styles from "./video-deck.module.css";
import {
  feedOf,
  pinnedFirst,
  previewWindow,
  revealOffset,
  splitGroups,
  stepIndex,
  two,
  wheelBelongs,
  type PreviewFeed,
  type VideoGroup,
} from "./video-logic";

interface VideoDeckProps {
  /** 1 to 5. Each phase's deck arrives, and changes its picture, in its own way. */
  phase: number;
  videos: readonly PhaseVideo[];
  /** The phase's art is on the left: the small parts of the deck lean the other way. */
  flip: boolean;
}

/** One picture in the window. `seq` counts the changes: a new one is a new layer. */
interface Shown {
  /** The video's place in the deck's whole list. */
  readonly at: number;
  readonly seq: number;
  /** 1 when the list moved on, -1 when it moved back. The change follows it. */
  readonly dir: 1 | -1;
}

interface Stack {
  readonly now: Shown;
  /** The picture that is leaving, until the new one has arrived. */
  readonly was: Shown | null;
  /** The newest picture has arrived: it rests as one plain layer. */
  readonly settled: boolean;
}

/** The first phase's picture changes as a shutter of this many upright strips. */
const STRIPS: Readonly<Record<number, number>> = { 1: 6 };

const GROUPS: readonly VideoGroup[] = ["films", "others"];
const GROUP_NAME: Readonly<Record<VideoGroup, string>> = { films: "Films", others: "Others" };

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function PlayMark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path
        d="M12 9.6v16.8c0 1.3 1.4 2.1 2.5 1.4l13.3-8.4c1-.6 1-2.1 0-2.8L14.5 8.2c-1.1-.7-2.5.1-2.5 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PinMark() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
      <path
        d="M9.9 1.6 14.4 6.1l-1.5.5-2.2 2.2.2 3.2-1 1L6.8 9.9 2.6 14.1l-.7-.7L6.1 9.2 3 6.1l1-1 3.2.2 2.2-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A vertical video is taller than wide: its picture's own numbers, for the browser's box. */
const boxOf = (video: PhaseVideo, wide: number) =>
  video.ratio < 1
    ? { width: Math.round((wide * 9) / 16), height: wide }
    : { width: wide, height: Math.round((wide * 9) / 16) };

/** Let a preview's file go, so the page does not hold a stream it does not show. */
function release(el: HTMLVideoElement): void {
  el.pause();
  if (!el.hasAttribute("src")) return;
  el.removeAttribute("src");
  el.load();
}

/**
 * One picture of the window: the video's poster, whole and in its own shape, on a plate of the
 * page's ink, and under the poster the video itself, which plays as a preview: muted, a short
 * stretch of it over and over. The poster stays until the preview has drawn a frame and then
 * fades. A picture that is leaving holds the frame it had, and gives its file back when it is
 * gone.
 *
 * In the wide window a vertical poster stands in the middle of the plate and is never cut to a
 * sliver; two faint copies of it stand beside it, so the plate is not an empty wall.
 *
 * While it arrives the layer may be cut into upright strips (the first phase's shutter): each
 * strip is a window on the same sheet, so together they are one picture. It has no video then:
 * six strips must not be six streams. At rest it is one strip.
 */
function Layer({
  video,
  role,
  dir,
  strips,
  lazy,
  feed,
  ghosts,
  onArrived,
}: {
  video: PhaseVideo;
  role: "rest" | "in" | "out";
  dir: 1 | -1;
  strips: number;
  lazy: boolean;
  /** What the deck allows its preview right now. */
  feed: PreviewFeed;
  /** The window is wide and this picture is not: faint copies stand beside it. */
  ghosts: boolean;
  onArrived: () => void;
}) {
  const count = role === "in" ? strips : 1;
  const large = boxOf(video, 1280);
  const source = video.player.sources[0]?.src;
  const span = useMemo(() => previewWindow(video.duration), [video.duration]);
  // The preview's element comes and goes with the layer's role, not with the layer. Whether it
  // is there is kept as state, so what follows it runs again when it arrives.
  const node = useRef<HTMLVideoElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const attach = useCallback((el: HTMLVideoElement | null) => {
    node.current = el;
    setMounted(el !== null);
  }, []);
  /** The preview has drawn a frame: said once, not on every tick of the film. */
  const drawn = useRef(false);
  const [live, setLive] = useState(false);

  const previews = role !== "in" && Boolean(source);
  // A picture that is leaving never plays: it holds its frame for as long as it has its file.
  const want: PreviewFeed = role === "out" && feed === "play" ? "hold" : feed;

  useEffect(() => {
    const el = node.current;
    if (!mounted || !el || !source) return;
    if (want === "none") {
      release(el);
      return;
    }
    if (!el.hasAttribute("src")) {
      el.defaultMuted = true;
      el.muted = true;
      el.src = mediaUrl(source);
    }
    if (want === "play") void el.play().catch(() => undefined);
    else el.pause();
  }, [mounted, want, source]);

  // An element that goes gives its file back.
  useEffect(() => {
    const el = node.current;
    if (!mounted || !el) return;
    return () => {
      release(el);
    };
  }, [mounted]);

  const onTime = (el: HTMLVideoElement) => {
    if (span.end > 0 && el.currentTime >= span.end - 0.06) {
      el.currentTime = span.start;
      return;
    }
    if (drawn.current || el.seeking || el.readyState < 2) return;
    if (el.currentTime <= span.start + 0.04) return;
    drawn.current = true;
    setLive(true);
  };

  return (
    <div
      className={styles.layer}
      data-role={role}
      style={{ "--d": dir } as CSSProperties}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && role === "in") onArrived();
      }}
    >
      {Array.from({ length: count }, (_, k) => (
        <div
          key={k}
          className={styles.strip}
          style={{ "--k": k, "--of": count, "--s": k % 2 === 0 ? 1 : -1 } as CSSProperties}
        >
          <div className={styles.stripIn}>
            <div className={styles.sheet} data-live={live && want !== "none"}>
              {ghosts
                ? (["before", "after"] as const).map((side) => (
                    // eslint-disable-next-line @next/next/no-img-element -- a file of the collection, already sized
                    <img
                      key={side}
                      className={styles.ghost}
                      data-side={side}
                      src={asset(video.thumb)}
                      alt=""
                      {...boxOf(video, 480)}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ))
                : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- a file of the collection, already sized */}
              <img
                className={styles.under}
                src={asset(video.thumb)}
                alt=""
                {...boxOf(video, 480)}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {previews ? (
                <video
                  ref={attach}
                  className={styles.film}
                  muted
                  loop
                  playsInline
                  preload="none"
                  disablePictureInPicture
                  disableRemotePlayback
                  tabIndex={-1}
                  aria-hidden="true"
                  onLoadedMetadata={(event) => {
                    if (span.start > 0) event.currentTarget.currentTime = span.start;
                  }}
                  onTimeUpdate={(event) => {
                    onTime(event.currentTarget);
                  }}
                  onEmptied={() => {
                    drawn.current = false;
                    setLive(false);
                  }}
                />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- a file of the collection, already sized */}
              <img
                className={styles.poster}
                src={asset(video.poster)}
                alt=""
                {...large}
                loading={lazy ? "lazy" : "eager"}
                decoding="async"
                draggable={false}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A line of the window that changes with the picture: the old one leaves upward under its mask
 * and the new one rises into its place, the way the page's titles arrive.
 */
function Swap({ stack, children }: { stack: Stack; children: (at: number) => ReactNode }) {
  const { now, was } = stack;
  return (
    <span className={styles.swap}>
      {was ? (
        <span key={was.seq} className={styles.swapLine} data-role="out" aria-hidden="true">
          {children(was.at)}
        </span>
      ) : null}
      <span key={now.seq} className={styles.swapLine} data-role={now.seq === 0 ? "rest" : "in"}>
        {children(now.at)}
      </span>
    </span>
  );
}

/**
 * The videos of a phase: a list to choose from on the left and a large window on the right.
 *
 * The window plays the chosen video by itself as a preview: muted, a short stretch in a loop,
 * only while the window is on screen, the tab is shown and nothing covers the page. Its file is
 * asked for only when the deck is near the screen and let go when it is far. Sound is the site's
 * player: the round control, or a press anywhere on the window, opens it out of the window.
 *
 * A press on a row changes the window. The row is marked at once; the picture changes when the new
 * poster has been decoded, so the change is never a blank. Each phase changes its picture in its
 * own way (a shutter of strips, a slide with depth, a scale through, a door on its hinge, a
 * slanted wipe), all of them transforms and opacity on two layers at most.
 *
 * A deck that holds both films and vertical videos has a switch between the two. The films keep
 * the wide window. The others stand in a tall window, like a phone held up, with their tall
 * pictures as cards beside it and the words on its other side. The switch deals the deck again:
 * what is there leaves, the layout changes while nothing shows, and the new kind arrives.
 *
 * The list is never taller than the window: it fills the height the window gives it and scrolls
 * inside itself, with a soft fade at an end that has more. The wheel is the list's only while the
 * list can still move that way, so it never holds the page. On a narrow box the window stands on
 * top and the list lies on its side under it.
 */
export function VideoDeck({ phase, videos, flip }: VideoDeckProps) {
  const sorted = useMemo(() => pinnedFirst(videos), [videos]);
  const groups = useMemo(() => splitGroups(sorted), [sorted]);
  const split = groups.films.length > 0 && groups.others.length > 0;
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drift = useRef<HTMLDivElement>(null);
  /** The newest choice: a poster that arrives for an older one is dropped. */
  const ticket = useRef(0);
  /** The row each kind was left on, so coming back to a kind finds it as it was. */
  const left = useRef<Partial<Record<VideoGroup, number>>>({});

  const [group, setGroup] = useState<VideoGroup>("films");
  /** The kind the switch points at. It leads `group` by the time the deck takes to clear. */
  const [wanted, setWanted] = useState<VideoGroup>("films");
  const [deal, setDeal] = useState<"out" | "in" | null>(null);
  const [chosen, setChosen] = useState(0);
  const [stack, setStack] = useState<Stack>({
    now: { at: 0, seq: 0, dir: 1 },
    was: null,
    settled: true,
  });
  const [ends, setEnds] = useState({ before: false, after: false });
  const [flat, setFlat] = useState(false);
  const [playing, setPlaying] = useState<PhaseVideo | null>(null);
  const [near, setNear] = useState(false);
  const [seen, setSeen] = useState(false);
  const [shownTab, setShownTab] = useState(true);
  const covered = usePageCovered();

  const strips = STRIPS[phase] ?? 1;
  /** The rows on show, as places in the whole list. */
  const visible = useMemo(
    () => (split ? groups[group] : sorted.map((_, k) => k)),
    [split, groups, group, sorted],
  );
  /** The tall layout: a deck with both kinds, showing its vertical videos. */
  const tall = split && group === "others";

  const choose = useCallback(
    (index: number) => {
      const video = sorted[index];
      if (!video) return;
      setChosen(index);
      ticket.current += 1;
      const mine = ticket.current;
      const show = () => {
        if (mine !== ticket.current) return;
        setStack((s) =>
          s.now.at === index
            ? s
            : {
                now: { at: index, seq: s.now.seq + 1, dir: index > s.now.at ? 1 : -1 },
                was: s.now,
                settled: false,
              },
        );
      };
      // The change waits for the poster itself, for as long as it takes. A poster that cannot be
      // read still changes the window: the small picture under it is already there.
      const image = new Image();
      image.src = asset(video.poster);
      void image.decode().then(show, show);
    },
    [sorted],
  );

  /** A pointer that rests on a row fetches that row's poster, so the press finds it ready. */
  const warm = useCallback((video: PhaseVideo) => {
    new Image().src = asset(video.poster);
  }, []);

  const arrived = useCallback((seq: number) => {
    setStack((s) => (s.now.seq === seq ? { now: s.now, was: null, settled: true } : s));
  }, []);

  /** Point the switch at a kind. The deck clears first, then changes, then deals the new kind. */
  const switchTo = (next: VideoGroup) => {
    if (!split || next === wanted) return;
    setWanted(next);
    setDeal("out");
  };

  /** The deck's own two steps of a change of kind end here, on the box that holds the deck. */
  const onDealEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (deal === "in") {
      setDeal(null);
      return;
    }
    if (deal !== "out") return;
    if (wanted !== group) {
      // Nothing shows now: the kind, the chosen row and the window change in one step. A poster
      // still on its way for the kind that left is dropped.
      ticket.current += 1;
      left.current[group] = chosen;
      const at = left.current[wanted] ?? groups[wanted][0] ?? 0;
      setGroup(wanted);
      setChosen(at);
      setStack((s) => ({ now: { at, seq: s.now.seq + 1, dir: 1 }, was: null, settled: true }));
    }
    setDeal("in");
  };

  const onSwitchKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = stepIndex(event.key, GROUPS.indexOf(wanted), GROUPS.length);
    const next = step === null ? undefined : GROUPS[step];
    if (!next) return;
    event.preventDefault();
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[step ?? 0]?.focus();
    switchTo(next);
  };

  // The list: which of its ends has more, and whether it lies on its side.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const sideways = el.scrollWidth - el.clientWidth > 1;
      const at = sideways ? el.scrollLeft : el.scrollTop;
      const max = sideways ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
      const before = at > 1;
      const after = at < max - 1;
      setEnds((e) => (e.before === before && e.after === after ? e : { before, after }));
      setFlat(getComputedStyle(el).flexDirection === "row");
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    // The wheel is the list's only while the list can still move that way. Lenis reads this mark
    // on the way up from the list, after this listener, and leaves such a turn to the browser.
    let owned = false;
    const onWheel = (event: WheelEvent) => {
      const own =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX) &&
        wheelBelongs(event.deltaY, el.scrollTop, el.clientHeight, el.scrollHeight);
      if (own === owned) return;
      owned = own;
      if (own) el.setAttribute("data-lenis-prevent-wheel", "");
      else el.removeAttribute("data-lenis-prevent-wheel");
    };
    read();
    el.addEventListener("scroll", ask, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    const observer = new ResizeObserver(ask);
    observer.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", ask);
      el.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);

  // The preview: its file while the deck is within a screen of the view, its play while the
  // window itself is on screen and the tab is shown.
  useEffect(() => {
    const deck = root.current;
    const pane = frame.current;
    if (!deck || !pane || typeof IntersectionObserver === "undefined") return;
    const last = (entries: IntersectionObserverEntry[]) =>
      entries[entries.length - 1]?.isIntersecting ?? false;
    const nearby = new IntersectionObserver(
      (entries) => {
        setNear(last(entries));
      },
      { rootMargin: "90% 0px 90% 0px" },
    );
    const onScreen = new IntersectionObserver(
      (entries) => {
        setSeen(last(entries));
      },
      { threshold: 0.2 },
    );
    nearby.observe(deck);
    onScreen.observe(pane);
    const onVisibility = () => {
      setShownTab(document.visibilityState === "visible");
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      nearby.disconnect();
      onScreen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // A deck with two kinds fetches the small pictures of both once it is near, so the kind that
  // is not on show is dealt with its pictures and not with empty plates.
  useEffect(() => {
    if (!near || !split) return;
    for (const video of sorted) new Image().src = asset(video.thumb);
  }, [near, split, sorted]);

  useEffect(
    () => () => {
      stageRefs.gaze = null;
    },
    [],
  );

  /** Bring a row into view inside the list. The page is not moved. */
  const reveal = useCallback((row: HTMLElement) => {
    const el = list.current;
    if (!el) return;
    const sideways = el.scrollWidth - el.clientWidth > 1;
    const a = row.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    if (sideways) {
      const to = revealOffset(
        a.left - b.left + el.scrollLeft,
        a.width,
        el.scrollLeft,
        el.clientWidth,
        16,
      );
      el.scrollTo({ left: to, behavior: "smooth" });
    } else {
      const to = revealOffset(
        a.top - b.top + el.scrollTop,
        a.height,
        el.scrollTop,
        el.clientHeight,
        8,
      );
      el.scrollTo({ top: to, behavior: "smooth" });
    }
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const place = stepIndex(event.key, Math.max(0, visible.indexOf(chosen)), visible.length);
    const next = place === null ? undefined : visible[place];
    if (place === null || next === undefined) return;
    event.preventDefault();
    const row = list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[place];
    if (!row) return;
    row.focus({ preventScroll: true });
    reveal(row);
    choose(next);
  };

  /** The drone looks at the window while the visitor is choosing. Only read by the drone. */
  const look = () => {
    const box = frame.current?.getBoundingClientRect();
    if (box) stageRefs.gaze = { x: box.left + box.width * 0.5, y: box.top + box.height * 0.5 };
  };
  const rest = () => {
    stageRefs.gaze = null;
  };

  // The picture leans a little toward the pointer inside the window. One write a frame at most,
  // of one transform; the stylesheet eases it.
  const lean = useRef(0);
  const onFrameMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = drift.current;
    const box = event.currentTarget.getBoundingClientRect();
    if (!el || box.width === 0) return;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    cancelAnimationFrame(lean.current);
    lean.current = requestAnimationFrame(() => {
      el.style.transform = `translate3d(${(x * -1.6).toFixed(2)}%, ${(y * -1.6).toFixed(2)}%, 0) scale(1.045)`;
    });
  };
  const onFrameLeave = () => {
    cancelAnimationFrame(lean.current);
    if (drift.current) drift.current.style.transform = "";
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(lean.current);
    },
    [],
  );

  const getOrigin = useCallback(() => frame.current?.getBoundingClientRect() ?? null, []);
  const onClosed = useCallback(() => {
    setPlaying(null);
  }, []);

  const picked = sorted[chosen];
  const shown = sorted[stack.now.at];
  if (!picked || !shown) return null;

  const tabId = (k: number) => `${uid}-tab-${k}`;
  const panelId = `${uid}-panel`;
  const total = sorted.length;
  const count = visible.length;
  const feed = feedOf({ near, seen, shown: shownTab, covered: covered || playing !== null });

  return (
    <div
      ref={root}
      className={styles.deck}
      data-phase-part="videos"
      data-phase={phase}
      data-flip={flip}
      data-group={tall ? "others" : "films"}
      style={{ "--n": count } as CSSProperties}
    >
      <header className={styles.head} data-in="false">
        <p className={kit.eyebrow}>
          <span className={styles.headMask}>
            <b className={styles.headWord}>Videos</b>
          </span>
          <span className={kit.eyebrowRule} aria-hidden="true" />
          <span className={styles.headMask}>
            <span className={styles.headCount}>
              {two(total)} official {total === 1 ? "video" : "videos"}
            </span>
          </span>
        </p>
        {split ? (
          <div
            className={`${styles.switch} ${kit.rise}`}
            role="radiogroup"
            aria-label={`The kinds of video of phase ${phase}`}
            data-at={wanted}
            style={i(3)}
            onKeyDown={onSwitchKey}
          >
            {GROUPS.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                className={styles.pill}
                aria-checked={name === wanted}
                tabIndex={name === wanted ? 0 : -1}
                data-cursor={name === wanted ? undefined : "SHOW"}
                onClick={() => {
                  switchTo(name);
                }}
              >
                <span>{GROUP_NAME[name]}</span>
                <span className={styles.pillCount}>{two(groups[name].length)}</span>
              </button>
            ))}
            <span className={styles.switchPlate} aria-hidden="true">
              <span className={styles.switchInk}>
                {GROUPS.map((name) => (
                  <span key={name} className={styles.pill}>
                    <span>{GROUP_NAME[name]}</span>
                    <span className={styles.pillCount}>{two(groups[name].length)}</span>
                  </span>
                ))}
              </span>
            </span>
          </div>
        ) : null}
      </header>

      <div className={styles.body} data-deal={deal ?? undefined} onAnimationEnd={onDealEnd}>
        <div
          className={styles.chooser}
          data-in="false"
          data-in-at="18"
          data-before={ends.before}
          data-after={ends.after}
          onPointerEnter={look}
          onPointerLeave={rest}
          onFocus={look}
          onBlur={rest}
        >
          <div
            ref={list}
            className={styles.list}
            role="tablist"
            aria-label={
              split
                ? `The ${group === "films" ? "films" : "other videos"} of phase ${phase}`
                : `The videos of phase ${phase}`
            }
            aria-orientation={flat ? "horizontal" : "vertical"}
            onKeyDown={onKeyDown}
          >
            {visible.map((k, place) => {
              const video = sorted[k];
              if (!video) return null;
              return (
                <button
                  key={video.id}
                  type="button"
                  role="tab"
                  id={tabId(k)}
                  className={styles.row}
                  aria-selected={k === chosen}
                  aria-controls={panelId}
                  tabIndex={k === chosen ? 0 : -1}
                  data-cursor="SHOW"
                  style={i(place)}
                  onClick={(event) => {
                    choose(k);
                    reveal(event.currentTarget);
                  }}
                  onPointerEnter={() => {
                    warm(video);
                  }}
                  onFocus={() => {
                    warm(video);
                  }}
                >
                  <span className={styles.rowLine} aria-hidden="true" />
                  <span className={styles.rowBody}>
                    <span className={styles.no} aria-hidden="true">
                      {two(place + 1)}
                    </span>
                    <span className={styles.thumb}>
                      <span className={styles.thumbMask}>
                        <span className={styles.thumbIn}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- a file of the collection, already sized */}
                          <img
                            src={asset(video.thumb)}
                            alt=""
                            {...boxOf(video, 480)}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </span>
                      </span>
                      <span className={styles.showing} aria-hidden="true">
                        <PlayMark />
                      </span>
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{video.title}</span>
                      <span className={styles.rowMeta}>
                        {video.pinned ? (
                          <span className={styles.pin}>
                            <PinMark />
                            <span className="sr-only">Pinned. </span>
                          </span>
                        ) : null}
                        <span className={styles.kind}>{video.kind}</span>
                        <span className={`${styles.sep} ${styles.kind}`} aria-hidden="true" />
                        <span>{formatTime(video.duration)}</span>
                        {video.nonCanon ? <span className={styles.badge}>Not canon</span> : null}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <span className={styles.fade} data-end="before" aria-hidden="true" />
          <span className={styles.fade} data-end="after" aria-hidden="true" />
        </div>

        <div
          className={styles.window}
          data-in="false"
          data-in-at="22"
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(chosen)}
        >
          <div
            ref={frame}
            className={styles.frame}
            onPointerMove={onFrameMove}
            onPointerLeave={onFrameLeave}
          >
            <div className={styles.open}>
              <div className={styles.openIn}>
                <div className={styles.plate}>
                  <div ref={drift} className={styles.drift}>
                    {stack.was ? (
                      <Layer
                        key={stack.was.seq}
                        video={sorted[stack.was.at] ?? shown}
                        role="out"
                        dir={stack.now.dir}
                        strips={1}
                        lazy={false}
                        feed={feed}
                        ghosts={!tall && (sorted[stack.was.at] ?? shown).ratio < 1}
                        onArrived={() => undefined}
                      />
                    ) : null}
                    <Layer
                      key={stack.now.seq}
                      video={shown}
                      role={stack.settled ? "rest" : "in"}
                      dir={stack.now.dir}
                      strips={strips}
                      lazy={stack.now.seq === 0}
                      feed={feed}
                      ghosts={!tall && shown.ratio < 1}
                      onArrived={() => {
                        arrived(stack.now.seq);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {Array.from({ length: 5 }, (_, k) => (
              <span key={k} className={styles.cover} style={i(k)} aria-hidden="true" />
            ))}
            <button
              type="button"
              className={styles.hit}
              aria-label={`Play ${picked.title} with sound`}
              aria-haspopup="dialog"
              data-cursor="PLAY"
              onClick={() => {
                setPlaying(picked);
              }}
            >
              <span className={styles.play}>
                <span className={styles.playRing} aria-hidden="true" />
                <span className={styles.playDisc}>
                  <PlayMark />
                </span>
              </span>
            </button>
          </div>

          <div className={styles.meta}>
            {tall ? (
              <p className={`display ${styles.big}`} aria-hidden="true">
                <Swap stack={stack}>{(at) => two(Math.max(0, visible.indexOf(at)) + 1)}</Swap>
              </p>
            ) : null}
            <p className={`${styles.kicker} ${kit.rise}`}>
              <Swap stack={stack}>
                {(at) => (
                  <span className={styles.kickerLine}>
                    <b>
                      {two(Math.max(0, visible.indexOf(at)) + 1)} / {two(count)}
                    </b>
                    <span>{sorted[at]?.kind}</span>
                    <span className={styles.sep} aria-hidden="true" />
                    <span>{formatTime(sorted[at]?.duration ?? 0)}</span>
                    {sorted[at]?.nonCanon ? <span className={styles.badge}>Not canon</span> : null}
                  </span>
                )}
              </Swap>
            </p>
            <p className={`${styles.links} ${kit.rise}`} style={i(2)}>
              <TLink
                href={picked.href}
                className={styles.link}
                transitionLabel="Collection"
                aria-label={`Open ${picked.title} in the collection`}
              >
                <span>Open in the collection</span>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5" />
                </svg>
              </TLink>
            </p>
            <h4 className={`display ${styles.title}`}>
              <span className={kit.mask}>
                <span className={kit.line} style={i(1)}>
                  <Swap stack={stack}>{(at) => sorted[at]?.title}</Swap>
                </span>
              </span>
            </h4>
          </div>
        </div>
      </div>

      {playing
        ? createPortal(
            <PhasePlayer video={playing.player} getOrigin={getOrigin} onClosed={onClosed} />,
            document.body,
          )
        : null}
    </div>
  );
}
