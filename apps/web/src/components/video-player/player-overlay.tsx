"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { CaptionLayer, type CaptionControl } from "./caption-layer";
import {
  CAPTION_BACKGROUNDS,
  CAPTION_SIZES,
  DEFAULT_CAPTIONS,
  normalizeCaptions,
  type CaptionSettings,
} from "./caption-math";
import {
  autoQuality,
  cursorShape,
  formatTime,
  fractionAt,
  inLeaveZone,
  snapToTrack,
  type CursorShape,
  type QualityOption,
} from "./player-math";
import styles from "./video-player.module.css";

export interface PlayerVideo {
  /** The video in one or more sizes (public paths, passed through asset()). */
  sources: readonly QualityOption[];
  /** Public path of the poster. It is what the thumbnail shows, and the player fades out of it. */
  poster: string;
  title: string;
  /** Public path of a WebVTT track, if there is one. */
  captions?: string;
  /** Colours for a character's page: the dark plate, the keyline and the accent. */
  skin?: PlayerSkin;
}

/** The three colours of the player's plate language (see video-player.module.css). */
interface PlayerSkin {
  ink: string;
  keyline: string;
  accent: string;
}

interface Props {
  video: PlayerVideo;
  /** Where the thumbnail was. The player grows out of it and shrinks back into it. */
  getOrigin: () => DOMRect | null;
  onClosed: () => void;
}

const STORE_KEY = "aspirants:player";
const CAPTION_KEY = "aspirants:captions";

/** The captions as the viewer left them (on, size, background, place). They start on. */
function readCaptions(): CaptionSettings {
  try {
    const raw = window.localStorage.getItem(CAPTION_KEY);
    return raw ? normalizeCaptions(JSON.parse(raw)) : { ...DEFAULT_CAPTIONS };
  } catch {
    return { ...DEFAULT_CAPTIONS };
  }
}

function writeCaptions(settings: CaptionSettings) {
  try {
    window.localStorage.setItem(CAPTION_KEY, JSON.stringify(settings));
  } catch {
    // Not saved: the settings last until the player closes.
  }
}
const EASE = "cubic-bezier(0.83, 0, 0.17, 1)";
const ENTER_MS = 760;
const EXIT_MS = 560;
const POSTER_MS = 900;

/** Only the volume is remembered. Whether the sound is on follows the site's sound button. */
function readVolume(): number {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { volume?: unknown };
      if (typeof v.volume === "number") return Math.min(1, Math.max(0, v.volume));
    }
  } catch {
    /* ignore */
  }
  return 0.9;
}

function writeVolume(volume: number): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ volume }));
  } catch {
    /* ignore */
  }
}

/** The shape a rect makes as a clip-path inset on a viewport sized box. */
function insetFor(rect: DOMRect, vw: number, vh: number): string {
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, vw - rect.right);
  const bottom = Math.max(0, vh - rect.bottom);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 6px)`;
}

type IconName =
  "play" | "pause" | "back" | "forward" | "volume" | "mute" | "cc" | "replay" | "gear";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
  } as const;
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6 } as const;
  switch (name) {
    case "play":
      return (
        <svg {...common}>
          <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <path d="M12 5a7 7 0 1 1-6.6 4.7M12 2v6L7.5 5z" {...stroke} />
          <text
            x="12"
            y="16"
            fontSize="6.5"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="monospace"
          >
            10
          </text>
        </svg>
      );
    case "forward":
      return (
        <svg {...common}>
          <path d="M12 5a7 7 0 1 0 6.6 4.7M12 2v6l4.5-3z" {...stroke} />
          <text
            x="12"
            y="16"
            fontSize="6.5"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="monospace"
          >
            10
          </text>
        </svg>
      );
    case "volume":
      return (
        <svg {...common}>
          <path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" fill="currentColor" />
          <path d="M14.5 9a4.2 4.2 0 0 1 0 6M17 6.5a8 8 0 0 1 0 11" {...stroke} />
        </svg>
      );
    case "mute":
      return (
        <svg {...common}>
          <path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" fill="currentColor" />
          <path d="M15 9.5l5 5m0-5l-5 5" {...stroke} />
        </svg>
      );
    case "cc":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="1.5" {...stroke} />
          <path
            d="M10 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"
            {...stroke}
            strokeWidth={1.5}
          />
        </svg>
      );
    case "replay":
      return (
        <svg {...common}>
          <path d="M5 12a7 7 0 1 0 2.3-5.2M5 4v4.5h4.5" {...stroke} strokeWidth={1.7} />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" {...stroke} />
          <path
            d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
            {...stroke}
          />
        </svg>
      );
  }
}

/**
 * The custom player. It grows out of the thumbnail to fill the page (not the display), fades from
 * the poster into the first frame, and plays. The picture is as wide as the window and never
 * taller than it. It has its own controls, loading state and a cursor that changes shape with the
 * place it is over: Play or Pause in the middle half of the screen, Leave in the outer quarters,
 * and the time over the timeline, where the cursor snaps onto the track and follows it. The cursor
 * and the controls hide together while the video plays. Esc and the Leave zones shrink it back into
 * the thumbnail.
 */
export function PlayerOverlay({ video, getOrigin, onClosed }: Props) {
  const reduced = useReducedMotion();
  const { pause: pauseScroll, resume: resumeScroll } = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const pointer = useRef({ x: -100, y: -100, sx: -100, sy: -100, raf: 0, inside: false });
  const snapRef = useRef<{ fraction: number } | null>(null);
  const hideTimer = useRef(0);
  const closing = useRef(false);
  const menuRef = useRef(false);

  const [ready, setReady] = useState(false); // enter animation finished
  const [poster, setPoster] = useState<"on" | "out" | "in" | "off">("on");
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ended, setEnded] = useState(false);
  // The file could not be loaded (a network or server error), or has been loading for a long time.
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(readVolume);
  // The video's sound is on whenever the site's sound is on, and follows the sound button.
  const [muted, setMuted] = useState(() => useSiteStore.getState().muted);
  const [quality, setQuality] = useState<string>("auto");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cap, setCap] = useState<CaptionSettings>(readCaptions);
  const [capMenu, setCapMenu] = useState(false);
  const capRef = useRef(cap);
  const capControl = useRef<CaptionControl | null>(null);
  const [controls, setControls] = useState(true);
  const [shape, setShape] = useState<CursorShape>("dot");
  const [cursorOn, setCursorOn] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [flash, setFlash] = useState<{ id: number; icon: "play" | "pause" } | null>(null);

  const v = () => videoRef.current;

  // The size in use. "Auto" is worked out once, for this screen.
  const auto = useMemo(() => {
    const conn = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
    return autoQuality(video.sources, {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      downlinkMbps: conn?.downlink,
    });
  }, [video.sources]);
  const active =
    quality === "auto" ? auto : (video.sources.find((s) => s.label === quality) ?? auto);

  useEffect(() => {
    menuRef.current = menuOpen || capMenu;
  }, [menuOpen, capMenu]);

  /** Change the captions. Saved when `done` is true (a drag saves once, when it ends). */
  const changeCaptions = useCallback((next: Partial<CaptionSettings>, done: boolean) => {
    const merged = { ...capRef.current, ...next };
    capRef.current = merged;
    setCap(merged);
    if (done) writeCaptions(merged);
  }, []);

  // Close ------------------------------------------------------------------------------------
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setControls(false);
    setMenuOpen(false);
    const el = v();
    el?.pause();
    audio.blip("hover");
    const root = rootRef.current;
    const frame = frameRef.current;
    const finish = () => {
      onClosed();
    };
    if (!root || !frame) {
      finish();
      return;
    }
    const rect = getOrigin();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = rect && rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
    if (reduced || !visible) {
      root
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 180,
          easing: "ease-out",
          fill: "forwards",
        })
        .finished.then(finish, finish);
      return;
    }
    // The poster comes back over the picture first, so what shrinks into the thumbnail is the
    // thumbnail's own picture and nothing jumps when the player goes.
    setPoster("in");
    const shrink = () => {
      const sx = rect.width / vw;
      const dx = rect.left + rect.width / 2 - vw / 2;
      const dy = rect.top + rect.height / 2 - vh / 2;
      const opts = { duration: EXIT_MS, easing: EASE, fill: "forwards" } as const;
      frame.animate(
        [
          { transform: "translate(0,0) scale(1)" },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx})` },
        ],
        opts,
      );
      root
        .animate(
          [{ clipPath: "inset(0 0 0 0 round 0px)" }, { clipPath: insetFor(rect, vw, vh) }],
          opts,
        )
        .finished.then(finish, finish);
    };
    window.setTimeout(shrink, 480);
  }, [getOrigin, onClosed, reduced]);

  // Open: grow out of the thumbnail, then play ----------------------------------------------
  useLayoutEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    if (!root || !frame) return;
    returnFocus.current = document.activeElement;
    root.focus({ preventScroll: true });
    const rect = getOrigin();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let finished: Promise<unknown>;
    if (reduced || !rect) {
      finished = root.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        fill: "both",
      }).finished;
    } else {
      const sx = rect.width / vw;
      const dx = rect.left + rect.width / 2 - vw / 2;
      const dy = rect.top + rect.height / 2 - vh / 2;
      const opts = { duration: ENTER_MS, easing: EASE, fill: "both" } as const;
      frame.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx})` },
          { transform: "translate(0,0) scale(1)" },
        ],
        opts,
      );
      finished = root.animate(
        [{ clipPath: insetFor(rect, vw, vh) }, { clipPath: "inset(0 0 0 0 round 0px)" }],
        opts,
      ).finished;
    }
    let alive = true;
    void finished.then(() => {
      if (!alive) return;
      setReady(true);
      const el = videoRef.current;
      if (el) {
        el.volume = volume;
        el.muted = muted;
        void el.play().catch(() => {
          el.muted = true;
          setMuted(true);
          void el.play().catch(() => undefined);
        });
      }
    });
    audio.blip("click");
    return () => {
      alive = false;
    };
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The poster fades into the first frame with a soft gradient once a frame is on screen.
  useEffect(() => {
    const el = v();
    if (!el) return;
    const reveal = () => {
      const show = () => {
        setPoster((p) => (p === "on" ? "out" : p));
      };
      if (typeof el.requestVideoFrameCallback === "function") el.requestVideoFrameCallback(show);
      else show();
    };
    el.addEventListener("playing", reveal, { once: true });
    return () => {
      el.removeEventListener("playing", reveal);
    };
  }, []);

  useEffect(() => {
    if (poster !== "out") return;
    const t = window.setTimeout(() => {
      setPoster("off");
    }, POSTER_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [poster]);

  // Page chrome: freeze the page behind, make it inert, give focus back on the way out ------
  useEffect(() => {
    pauseScroll();
    const shell = document.getElementById("site-shell");
    if (shell) shell.inert = true;
    return () => {
      resumeScroll();
      if (shell) shell.inert = false;
      const back = returnFocus.current;
      if (back instanceof HTMLElement) back.focus({ preventScroll: true });
    };
  }, [pauseScroll, resumeScroll]);

  // Escape works from the first moment, even before the opening animation has finished.
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (menuRef.current) {
        setMenuOpen(false);
        setCapMenu(false);
      } else close();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [close]);

  // Another size: carry on from the same moment ---------------------------------------------
  const lastSrc = useRef(active.src);
  useEffect(() => {
    const el = v();
    if (!el || lastSrc.current === active.src) return;
    lastSrc.current = active.src;
    const at = el.currentTime;
    const wasPlaying = !el.paused;
    setBusy(true);
    el.src = mediaUrl(active.src);
    el.addEventListener(
      "loadedmetadata",
      () => {
        el.currentTime = at;
        if (wasPlaying) void el.play().catch(() => undefined);
      },
      { once: true },
    );
  }, [active.src]);

  // A file that has been loading for a long time says so (the connection is slow, it is not stuck).
  useEffect(() => {
    if (!busy || !ready || failed) return;
    const id = window.setTimeout(() => {
      setSlow(true);
    }, 9000);
    return () => {
      window.clearTimeout(id);
      setSlow(false);
    };
  }, [busy, ready, failed]);

  /** Ask for the file again after a failure. */
  const retry = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setFailed(false);
    setBusy(true);
    el.load();
    void el.play().catch(() => undefined);
  }, []);

  // Video events ----------------------------------------------------------------------------
  useEffect(() => {
    const el = v();
    if (!el) return;
    const on = <K extends keyof HTMLMediaElementEventMap>(
      type: K,
      fn: (e: HTMLMediaElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, fn);
      return () => {
        el.removeEventListener(type, fn);
      };
    };
    const syncBuffered = () => {
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0 || el.buffered.length === 0) return;
      let end = 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= el.currentTime + 0.25) end = Math.max(end, el.buffered.end(i));
      }
      setBuffered(end / d);
    };
    const offs = [
      on("play", () => {
        setPlaying(true);
        setEnded(false);
      }),
      on("pause", () => {
        setPlaying(false);
      }),
      on("playing", () => {
        setBusy(false);
        setFailed(false);
      }),
      on("canplay", () => {
        setBusy(false);
        setFailed(false);
      }),
      on("error", () => {
        setFailed(true);
        setBusy(false);
        setPlaying(false);
      }),
      on("waiting", () => {
        setBusy(true);
      }),
      on("seeking", () => {
        setBusy(true);
      }),
      on("seeked", () => {
        setBusy(false);
      }),
      on("durationchange", () => {
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      }),
      on("loadedmetadata", () => {
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      }),
      on("timeupdate", () => {
        setTime(el.currentTime);
        syncBuffered();
      }),
      on("progress", syncBuffered),
      on("ended", () => {
        setEnded(true);
        setPlaying(false);
        setControls(true);
      }),
    ];
    return () => {
      offs.forEach((off) => {
        off();
      });
    };
  }, []);

  useEffect(() => {
    const el = v();
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    writeVolume(volume);
  }, [volume, muted]);

  // The sound button in the nav and the M key reach the player too.
  useEffect(
    () =>
      useSiteStore.subscribe((s, prev) => {
        if (s.muted !== prev.muted) setMuted(s.muted);
      }),
    [],
  );

  // While the player is open nothing else makes a sound: the page's music and any voice line
  // stop, and the music carries on when the player closes.
  useEffect(() => {
    const el = audio.getMusicElement();
    const resume = el !== null && !el.paused;
    if (resume) audio.pauseMusic(1100);
    audio.stopVoice();
    return () => {
      if (resume) audio.resumeMusic(2600);
    };
  }, []);

  // Actions ---------------------------------------------------------------------------------
  const toggle = useCallback((withFlash = true) => {
    const el = v();
    if (!el) return;
    if (el.ended) el.currentTime = 0;
    if (el.paused) {
      void el.play().catch(() => undefined);
      if (withFlash) setFlash({ id: Math.random(), icon: "play" });
    } else {
      el.pause();
      if (withFlash) setFlash({ id: Math.random(), icon: "pause" });
    }
    audio.blip("hover");
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const el = v();
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + seconds));
    setTime(el.currentTime);
  }, []);

  const seekTo = useCallback((fraction: number) => {
    const el = v();
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = fraction * el.duration;
    setTime(el.currentTime);
  }, []);

  const changeVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  // Controls and cursor hide together while it plays and the pointer rests -------------------
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const el = v();
      if (el && !el.paused && !menuRef.current) setControls(false);
    }, 2600);
  }, []);

  const wake = useCallback(() => {
    setControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (playing) scheduleHide();
    return () => {
      window.clearTimeout(hideTimer.current);
    };
  }, [playing, scheduleHide]);

  // Cursor ----------------------------------------------------------------------------------
  useEffect(() => {
    const p = pointer.current;
    const tick = () => {
      p.sx += (p.x - p.sx) * 0.22;
      p.sy += (p.y - p.sy) * 0.22;
      const c = cursorRef.current;
      if (c) c.style.transform = `translate3d(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px, 0)`;
      p.raf = requestAnimationFrame(tick);
    };
    p.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(p.raf);
    };
  }, []);

  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return;
    const p = pointer.current;
    if (!p.inside) {
      p.sx = e.clientX;
      p.sy = e.clientY;
      p.inside = true;
      setCursorOn(true);
    }
    // Near the timeline the cursor lets go of the pointer and sits on the track.
    const rect = trackRef.current?.getBoundingClientRect();
    const snap = controls && rect ? snapToTrack(e.clientX, e.clientY, rect) : null;
    if (snap) {
      p.x = snap.x;
      p.y = snap.y;
      snapRef.current = { fraction: snap.fraction };
      setHoverFraction(snap.fraction);
    } else {
      p.x = e.clientX;
      p.y = e.clientY;
      snapRef.current = null;
      setHoverFraction(null);
    }
    setSnapped(snap !== null);
    const el = e.target instanceof Element ? e.target : null;
    const zone = (el?.closest("[data-zone]")?.getAttribute("data-zone") ?? "stage") as
      "controls" | "button" | "stage";
    setShape(
      cursorShape({
        snapped: snap !== null,
        zone,
        leave: inLeaveZone(e.clientX, window.innerWidth),
        playing,
        busy: busy && !playing,
      }),
    );
    wake();
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (snapRef.current) {
      seekTo(snapRef.current.fraction);
      wake();
      return;
    }
    if (inLeaveZone(e.clientX, window.innerWidth)) {
      close();
      return;
    }
    toggle();
    wake();
  };

  // Timeline --------------------------------------------------------------------------------
  const fractionFromEvent = (e: { clientX: number }) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r ? fractionAt(e.clientX, r.left, r.width) : 0;
  };

  const onTrackDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekTo(fractionFromEvent(e));
  };
  const onTrackMove = (e: ReactPointerEvent) => {
    if (scrubbing) seekTo(fractionFromEvent(e));
  };
  const onTrackUp = (e: ReactPointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setScrubbing(false);
  };

  // Keyboard --------------------------------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const onControl = target.matches("button, [role='slider'], input");
    switch (e.key) {
      case " ":
      case "k":
        if (target.matches("button")) return;
        e.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
        if (target.getAttribute("role") === "slider" && onControl) break;
        e.preventDefault();
        seekBy(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        break;
      case "j":
        seekBy(-10);
        break;
      case "l":
        seekBy(10);
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(volume + 0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(volume - 0.05);
        break;
      case "m":
        setMuted((m) => !m);
        break;
      case "c":
        if (video.captions) changeCaptions({ on: !capRef.current.on }, true);
        break;
      case "Home":
        if (!onControl) seekTo(0);
        break;
      case "End":
        if (!onControl) seekTo(0.999);
        break;
      case "Tab": {
        // Keep focus inside the player.
        const focusable = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [tabindex='0']",
          ) ?? [],
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === rootRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      default:
        if (/^[0-9]$/.test(e.key) && !onControl) seekTo(Number(e.key) / 10);
        return;
    }
    wake();
  };

  const progress = duration > 0 ? time / duration : 0;
  const previewTime = hoverFraction === null ? 0 : hoverFraction * duration;
  const label =
    shape === "play"
      ? ended
        ? "Replay"
        : "Play"
      : shape === "pause"
        ? "Pause"
        : shape === "leave"
          ? "Leave"
          : shape === "busy"
            ? "Wait"
            : shape === "scrub"
              ? formatTime(previewTime)
              : "";
  const cursorShown = cursorOn && (controls || !playing);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      tabIndex={-1}
      data-playing={playing}
      data-controls={controls || !playing || !ready}
      data-ready={ready}
      data-busy={busy}
      data-shape={shape}
      style={
        video.skin
          ? ({
              "--ink": video.skin.ink,
              "--orange": video.skin.keyline,
              "--pink": video.skin.accent,
            } as React.CSSProperties)
          : undefined
      }
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointer.current.inside = false;
        snapRef.current = null;
        setCursorOn(false);
        setSnapped(false);
        setHoverFraction(null);
        setShape("dot");
      }}
    >
      <div ref={frameRef} className={styles.frame}>
        {/* The stage: the video and the whole area around it. A click here plays, pauses or leaves. */}
        <div className={styles.stage} onClick={onStageClick} data-zone="stage">
          <video
            ref={videoRef}
            className={styles.video}
            src={mediaUrl(active.src)}
            playsInline
            preload="auto"
          >
            {video.captions ? (
              <track kind="captions" src={asset(video.captions)} srcLang="en" label="English" />
            ) : null}
          </video>
          {/* The poster sits over the first frame and fades out with a soft wipe. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.poster}
            src={asset(video.poster)}
            alt=""
            draggable={false}
            data-state={poster}
          />
        </div>
        <div className={styles.scrim} aria-hidden="true" />
        {video.captions ? (
          <CaptionLayer
            videoRef={videoRef}
            settings={cap}
            onChange={changeCaptions}
            preview={capMenu}
            control={capControl}
          />
        ) : null}
      </div>

      {/* Big feedback pulse for play and pause. */}
      {flash ? (
        <span key={flash.id} className={styles.flash} aria-hidden="true">
          <Icon name={flash.icon} />
        </span>
      ) : null}

      {/* Loading state: a plate that draws itself while the video buffers. */}
      <div className={styles.loader} data-on={busy && ready && poster === "off"} aria-hidden="true">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <path className={styles.loaderOuter} d="M40 6 L70 23 L70 57 L40 74 L10 57 L10 23 Z" />
          <path className={styles.loaderInner} d="M40 22 L56 31 L56 49 L40 58 L24 49 L24 31 Z" />
        </svg>
        <span>{slow ? "Still loading" : "Loading"}</span>
      </div>

      {failed ? (
        <div className={styles.failed} role="alert" data-zone="button">
          <p>This video could not be loaded.</p>
          <span>Check your connection and try again.</span>
          <div>
            <button type="button" onClick={retry}>
              Try again
            </button>
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {ended ? (
        <button
          type="button"
          className={styles.replay}
          onClick={() => {
            toggle(false);
          }}
          data-zone="button"
        >
          <Icon name="replay" />
          <span>Replay</span>
        </button>
      ) : null}

      <div className={styles.top} data-zone="controls">
        <p className={styles.title}>{video.title}</p>
      </div>

      <div className={styles.bar} data-zone="controls">
        <div
          ref={trackRef}
          className={styles.timeline}
          data-snapped={snapped}
          data-scrubbing={scrubbing}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onPointerDown={onTrackDown}
          onPointerMove={onTrackMove}
          onPointerUp={onTrackUp}
          onPointerCancel={onTrackUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              e.stopPropagation();
              seekBy(-5);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              seekBy(5);
            }
          }}
        >
          <span className={styles.trackBase} />
          <span className={styles.trackBuffered} style={{ transform: `scaleX(${buffered})` }} />
          <span className={styles.trackFill} style={{ transform: `scaleX(${progress})` }} />
          <span className={styles.thumb} style={{ left: `${progress * 100}%` }} />
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                toggle(false);
              }}
              aria-label={playing ? "Pause" : "Play"}
              data-zone="button"
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                seekBy(-10);
              }}
              aria-label="Back 10 seconds"
              data-zone="button"
            >
              <Icon name="back" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                seekBy(10);
              }}
              aria-label="Forward 10 seconds"
              data-zone="button"
            >
              <Icon name="forward" />
            </button>
            <div className={styles.volume} data-zone="button">
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  setMuted((m) => !m);
                }}
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                aria-pressed={muted || volume === 0}
              >
                <Icon name={muted || volume === 0 ? "mute" : "volume"} />
              </button>
              <input
                className={styles.volumeRange}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  changeVolume(Number(e.target.value));
                }}
                style={{ ["--v" as string]: `${(muted ? 0 : volume) * 100}%` }}
              />
            </div>
            <span className={styles.time} aria-hidden="true">
              {formatTime(time)} <i>/</i> {formatTime(duration)}
            </span>
          </div>
          <div className={styles.group}>
            {video.sources.length > 1 ? (
              <div className={styles.quality} data-zone="button">
                <button
                  type="button"
                  className={styles.textButton}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  aria-label={`Quality, ${quality === "auto" ? `Auto, ${auto.label}` : active.label}`}
                  onClick={() => {
                    setMenuOpen((o) => !o);
                    setCapMenu(false);
                  }}
                >
                  <Icon name="gear" />
                  <span>{quality === "auto" ? "Auto" : active.label}</span>
                </button>
                {menuOpen ? (
                  <ul className={styles.menu} aria-label="Quality">
                    {[
                      { id: "auto", text: `Auto (${auto.label})` },
                      ...video.sources.map((s) => ({ id: s.label, text: s.label })),
                    ].map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={item.id === quality}
                          onClick={() => {
                            setQuality(item.id);
                            setMenuOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {video.captions ? (
              <div className={styles.quality} data-zone="button">
                <button
                  type="button"
                  className={styles.textButton}
                  aria-haspopup="true"
                  aria-expanded={capMenu}
                  aria-label="Caption settings"
                  onClick={() => {
                    setCapMenu((o) => !o);
                    setMenuOpen(false);
                  }}
                >
                  <span aria-hidden="true">Aa</span>
                </button>
                {capMenu ? (
                  <div className={styles.capPanel} role="group" aria-label="Caption settings">
                    <div className={styles.capRow} role="group" aria-label="Size">
                      <span className={styles.capLabel}>Size</span>
                      <div className={styles.capSegment}>
                        {CAPTION_SIZES.map((size, i) => (
                          <button
                            key={size.label}
                            type="button"
                            aria-pressed={cap.size === i}
                            onClick={() => {
                              changeCaptions({ size: i }, true);
                            }}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.capRow} role="group" aria-label="Background">
                      <span className={styles.capLabel}>Background</span>
                      <div className={styles.capSegment}>
                        {CAPTION_BACKGROUNDS.map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            aria-pressed={cap.background === bg.id}
                            onClick={() => {
                              changeCaptions({ background: bg.id }, true);
                            }}
                          >
                            {bg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.capRow} role="group" aria-label="Position">
                      <span className={styles.capLabel}>Position</span>
                      <div className={styles.capNudge}>
                        {(
                          [
                            ["Move up", "↑", 0, -1],
                            ["Move down", "↓", 0, 1],
                            ["Move left", "←", -1, 0],
                            ["Move right", "→", 1, 0],
                          ] as const
                        ).map(([name, glyph, dx, dy]) => (
                          <button
                            key={name}
                            type="button"
                            aria-label={`${name} captions`}
                            onClick={() => {
                              capControl.current?.nudge(dx, dy);
                            }}
                          >
                            <span aria-hidden="true">{glyph}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          className={styles.capReset}
                          onClick={() => {
                            changeCaptions({ x: DEFAULT_CAPTIONS.x, y: DEFAULT_CAPTIONS.y }, true);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <p className={styles.capHint}>You can also drag the captions on the picture.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {video.captions ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-pressed={cap.on}
                aria-label="Captions"
                onClick={() => {
                  changeCaptions({ on: !cap.on }, true);
                }}
                data-zone="button"
              >
                <Icon name="cc" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={cursorRef}
        className={styles.cursor}
        data-shape={shape}
        data-on={cursorShown}
        aria-hidden="true"
      >
        <span className={styles.blob}>
          <span className={styles.glyph} data-for="play">
            <Icon name="play" />
          </span>
          <span className={styles.glyph} data-for="pause">
            <Icon name="pause" />
          </span>
          <span className={styles.glyph} data-for="leave">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <span className={styles.glyph} data-for="busy">
            <span className={styles.dots}>
              <i />
              <i />
              <i />
            </span>
          </span>
        </span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
