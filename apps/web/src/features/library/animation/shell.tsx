"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import type { StageState } from "@/features/character/stage/director";
import { CharacterStage, type StageApi } from "@/features/character/stage/stage";
import { useLibrarySearch } from "@/features/library/search/search-store";
import { useTransparentNav } from "@/features/library/shell/room-chrome";
import { audio } from "@/lib/audio";
import { isTypingTarget, useMounted } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";
import type { CharacterSlug } from "@/lib/slugs";

import { useLibraryData } from "../data";
import { Background } from "./background";
import { CarouselUi, fullHref } from "./carousel-ui";
import { ORDER, orderIndex } from "./characters";
import { fieldColors } from "./colors";
import { fullPhase, optionViews, waitOf } from "./full-state";
import { FullUi } from "./full-ui";
import { Panel } from "./panel";
import {
  dragTarget,
  dragTurn,
  feedWheel,
  newWheel,
  PRESS_STEP_MS,
  ringGeometry,
  SNAP_BACK_MS,
  wheelPixels,
  wrapIndex,
  wrapOffset,
  type RingGeometry,
} from "./ring";
import { MORPH_MS, RingDriver, type PanelEls } from "./ring-driver";
import { optionButtons, sceneProgress, type RoomButton } from "./room-math";
import scene from "./scene.module.css";
import styles from "./shell.module.css";
import { splashFor } from "./splash";
import { rememberActive, slugFromAddress, startSlug } from "./start";
import { useThemeMusic } from "./theme-music";
import type { AnimationFile, AnimChar, AnimClip } from "./types";
import { useControls } from "./use-controls";
import { useClips, useCore, useWarmth } from "./use-core";
import { useFullscreen } from "./use-fullscreen";

type View = "ring" | "expanding" | "full" | "collapsing";

const NO_CLIPS: AnimClip[] = [];
/** The live stage of the panel that leaves the front fades to its splash this fast at most. */
const LIVE_OUT_MS = 480;
/** A screen at most this tall gets the small landscape layout of the full screen view. */
const LOW_PX = 520;

/** The library search or another sheet (the site menu) is open over the room: it owns the keys. */
function overlayOpen(): boolean {
  return (
    useLibrarySearch.getState().open ||
    document.querySelector('[role="dialog"][data-state="open"]') !== null
  );
}

/** The character of the full screen route, or null on the carousel. */
function fullOf(pathname: string | null): CharacterSlug | null {
  const m = /\/collection\/animation\/([a-z]+)\/?$/u.exec(pathname ?? "");
  return m && orderIndex(m[1]) >= 0 ? (m[1] as CharacterSlug) : null;
}

/** Resolve after `n` frames. */
const frames = (n: number) =>
  new Promise<void>((resolve) => {
    let k = 0;
    const tick = () => {
      k += 1;
      if (k >= n) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

/** Frame sheets: `window.__animMorph = { freeze: true }` before a launch holds it at its start. */
interface MorphProbe {
  freeze?: boolean;
  phase?: "idle" | "held" | "running";
  seek?: (ms: number) => void;
  release?: () => void;
}

declare global {
  interface Window {
    __animMorph?: MorphProbe;
  }
}

function hold(anims: Animation[]) {
  const probe = window.__animMorph;
  if (!probe?.freeze) return;
  for (const a of anims) a.pause();
  probe.phase = "held";
  probe.seek = (ms) => {
    for (const a of anims) a.currentTime = ms;
  };
  probe.release = () => {
    probe.phase = "running";
    for (const a of anims) a.play();
  };
}

/**
 * The Animation room: a carousel of the ten characters on a tilted ring (a copy of the hero of
 * apechain.com) and the full screen view of each one (`/collection/animation/<slug>`). It lives in
 * the layout of both routes, so the panel in front and its playing stage stay alive when the
 * address changes: Launch lays the panel flat and opens its window to the screen, Back closes it
 * into its place on the ring, and neither cuts the picture. The ring moves only when the visitor
 * moves it.
 */
export function AnimationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const full = fullOf(pathname);
  const router = useRouter();
  const transition = useTransitionRouter();
  const { pause: pauseLenis, resume: resumeLenis } = useLenis();
  const { data } = useLibraryData<AnimClip>("animation");
  const file = data as AnimationFile | null;
  useTransparentNav("storm");

  const mounted = useMounted();
  const [view, setView] = useState<View>(full ? "full" : "ring");
  const viewRef = useRef<View>(view);
  // Nothing is drawn before the first client render, so the server's guess does not matter.
  const [active, setActive] = useState(() =>
    typeof window === "undefined" ? 0 : Math.max(0, ORDER.indexOf(full ?? startSlug())),
  );
  const activeRef = useRef(active);
  const [target, setTarget] = useState(active);
  const targetRef = useRef(active);
  const [arrival, setArrival] = useState(0);
  const [nonce, setNonce] = useState(0);
  /** The welcome on show was asked for with the Welcome button. */
  const [replay, setReplay] = useState(false);
  const [whole, setWhole] = useState(false);
  const [geo, setGeo] = useState<RingGeometry | null>(null);
  const [dragging, setDragging] = useState(false);
  const driver = useMemo(() => new RingDriver(ORDER.length), []);
  const roomRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const swayRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const stage = useRef<StageApi>(null);
  const claim = useRef<(() => void) | null>(null);

  const slug = ORDER[active]!;
  const core = useCore(slug);
  const controls = useControls(stage);
  const { reset: resetStage, press: pressScene, release: releaseHeld, settle } = controls;
  const files = useClips(core.bundle, view === "full");
  const screen = useFullscreen(roomRef);
  useWarmth(mounted ? active : null);
  // The song of the character on show: the one the ring turns to, or the one full screen.
  useThemeMusic(mounted ? (view === "ring" ? ORDER[target]! : slug) : null);

  const setViewBoth = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  // The page is one screen: nothing scrolls up and down.
  useEffect(() => {
    pauseLenis();
    const html = document.documentElement;
    const before = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = before.html;
      document.body.style.overflow = before.body;
      resumeLenis();
    };
  }, [pauseLenis, resumeLenis]);

  // The curtain waits until the character in front shows something.
  const ready = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const mark = expectReady("animation-room");
    ready.current = mark;
    return mark;
  }, []);
  useEffect(() => {
    if (core.phase !== "loading" && geo) ready.current?.();
  }, [core.phase, geo]);

  // The screen: the ring is placed again when its size changes.
  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el || !mounted) return;
    const measure = () => {
      const g = ringGeometry({ w: el.clientWidth, h: el.clientHeight });
      el.style.perspective = `${Math.round(g.perspective)}px`;
      driver.setGeometry(g);
      setGeo(g);
    };
    measure();
    measureRef.current = measure;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      measureRef.current = null;
    };
  }, [driver, mounted]);

  // First placement: on the ring, or straight into the full screen view (a visit to its page).
  const placed = useRef(false);
  const fading = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!geo || placed.current) return;
    placed.current = true;
    if (viewRef.current === "full") {
      driver.setFull(activeRef.current);
      driver.hide(activeRef.current);
      fading.current = activeRef.current;
    } else driver.write(activeRef.current);
  }, [geo, driver]);

  // A visit straight to a full screen page fades in once the page is uncovered and the character
  // has something to show.
  useEffect(() => {
    if (core.phase === "loading" || fading.current === null) return;
    let timer = 0;
    const go = () => {
      if (transition.isTransitioning()) {
        timer = window.setTimeout(go, 80);
        return;
      }
      if (fading.current !== null) driver.fadeIn(fading.current);
      fading.current = null;
    };
    go();
    return () => {
      window.clearTimeout(timer);
    };
  }, [core.phase, driver, transition]);

  useEffect(() => () => driver.destroy(), [driver]);

  const register = useCallback(
    (index: number, els: PanelEls | null) => {
      driver.attach(index, els);
      if (els && driver.geometry) {
        if (driver.full === index) driver.setFull(index);
        else driver.write(driver.p);
      }
    },
    [driver],
  );

  // Arrival -----------------------------------------------------------------------------------------

  /** The ring stands on a panel: its character comes to the front and plays its welcome. */
  const arrive = useCallback(
    (index: number) => {
      const i = wrapIndex(index, ORDER.length);
      targetRef.current = i;
      setTarget(i);
      if (i === activeRef.current) {
        // Back on the same panel (a drag that sprang back): its stage shows again.
        driver.fadeLive(i, true, 300);
        return;
      }
      driver.fadeLive(i, true, 0);
      activeRef.current = i;
      setActive(i);
      setArrival((n) => n + 1);
      setReplay(false);
      resetStage();
      rememberActive(ORDER[i]!);
    },
    [driver, resetStage],
  );

  // On a page change the router writes the address after the first render, so the character it
  // names (`?i=` of the library search) is read again once the ring is placed.
  const addressed = useRef(false);
  useLayoutEffect(() => {
    if (!geo || addressed.current) return;
    addressed.current = true;
    if (viewRef.current !== "ring") return;
    const named = slugFromAddress(window.location.pathname, window.location.search);
    const i = named ? ORDER.indexOf(named) : -1;
    if (i < 0 || i === activeRef.current) return;
    driver.write(i);
    arrive(i);
  }, [geo, driver, arrive]);

  // Turns ------------------------------------------------------------------------------------------

  const glideTo = useCallback(
    (goal: number, ms: number) => {
      const to = wrapIndex(goal, ORDER.length);
      targetRef.current = to;
      setTarget(to);
      // The stage in front fades to its splash while the ring turns away from it.
      const here = activeRef.current;
      if (to === here) driver.fadeLive(here, true, 300);
      else driver.fadeLive(here, false, Math.min(LIVE_OUT_MS, ms * 0.7));
      void driver.glide(goal, ms).then((ok) => {
        if (ok) arrive(goal);
      });
    },
    [arrive, driver],
  );

  const step = useCallback(
    (dir: 1 | -1, ms = PRESS_STEP_MS) => {
      if (viewRef.current !== "ring") return;
      // From the panel the ring is heading to, so quick presses add up.
      const from = driver.moving ? targetRef.current : activeRef.current;
      const base = driver.current();
      const goal = base + wrapOffset(from + dir - base, ORDER.length);
      glideTo(goal, ms);
    },
    [driver, glideTo],
  );

  const goTo = useCallback(
    (index: number) => {
      if (viewRef.current !== "ring") return;
      const base = driver.current();
      const d = wrapOffset(index - base, ORDER.length);
      glideTo(base + d, PRESS_STEP_MS + Math.max(0, Math.abs(d) - 1) * 160);
    },
    [driver, glideTo],
  );

  // Launch and the way back -------------------------------------------------------------------------

  const releaseClaim = useCallback(() => {
    claim.current?.();
    claim.current = null;
  }, []);

  /**
   * The end of a move, whether it ran or not: the view is in its place and the router is free.
   * A move that could not run (or never ends) lands here too, so nobody is left under a half move
   * with every link of the site held.
   */
  const settleView = useCallback(
    (to: "full" | "ring", index: number) => {
      if (to === "full") {
        if (driver.full !== index) driver.setFull(index);
      } else if (driver.full !== null) {
        driver.setRing(index);
      }
      setViewBoth(to);
      releaseClaim();
    },
    [driver, releaseClaim, setViewBoth],
  );

  /** Run a move with a watchdog; a newer move takes over from an older one. */
  const moveId = useRef(0);
  const run = useCallback(
    async (to: "full" | "ring", index: number, move: () => Promise<boolean>) => {
      const id = (moveId.current += 1);
      const watchdog = window.setTimeout(() => {
        // A frame probe may hold a move as long as it likes.
        if (moveId.current !== id || window.__animMorph?.freeze) return;
        if (viewRef.current === "expanding" || viewRef.current === "collapsing")
          settleView(to, index);
      }, MORPH_MS + 6000);
      const ok = await move();
      window.clearTimeout(watchdog);
      if (moveId.current !== id) return false;
      settleView(to, index);
      return ok;
    },
    [settleView],
  );

  const expand = useCallback(
    async (index: number) => {
      setViewBoth("expanding");
      claim.current ??= transition.claim();
      if (swayRef.current) swayRef.current.style.transform = "none";
      driver.fadeLive(index, true, 0);
      audio.blip("whoosh");
      if (await run("full", index, () => driver.expand(index, hold))) {
        audio.blip("star");
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    },
    [driver, run, setViewBoth, transition],
  );

  const exitScreen = screen.exit;
  const collapse = useCallback(
    async (index: number) => {
      setViewBoth("collapsing");
      claim.current ??= transition.claim();
      // She goes back to rest on the ring: nothing waits, no pose holds.
      settle();
      // Out of full screen first, so the move is worked out for the screen it runs on.
      if (document.fullscreenElement) {
        await exitScreen();
        await frames(2);
        measureRef.current?.();
      }
      setWhole(false);
      if (driver.wholeOn !== null) driver.whole(driver.wholeOn, false, MORPH_MS);
      audio.blip("whoosh");
      // The other panels come back late in the move; a picture still arriving shows when it lands.
      await run("ring", index, () => driver.collapse(index, hold));
    },
    [driver, exitScreen, run, setViewBoth, settle, transition],
  );

  const launch = useCallback(
    (e?: MouseEvent<HTMLAnchorElement>) => {
      if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
      e?.preventDefault();
      if (viewRef.current !== "ring") return;
      // A turn must land first.
      if (driver.moving) return;
      const release = transition.claim();
      if (!release) return;
      claim.current = release;
      const index = activeRef.current;
      void expand(index);
      router.push(fullHref(ORDER[index]!), { scroll: false });
    },
    [driver, expand, router, transition],
  );

  const back = useCallback(
    (e?: MouseEvent<HTMLAnchorElement>) => {
      if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
      e?.preventDefault();
      if (viewRef.current !== "full") return;
      const release = transition.claim();
      if (!release) return;
      claim.current = release;
      void collapse(activeRef.current);
      router.push("/collection/animation", { scroll: false });
    },
    [collapse, router, transition],
  );

  // The address leads: the browser's back and forward run the same moves as the buttons. Only a
  // change of the address counts (Launch and Back have started their move before it commits).
  const seenFull = useRef(full);
  useEffect(() => {
    if (!geo || !placed.current || seenFull.current === full) return;
    seenFull.current = full;
    const v = viewRef.current;
    if (full) {
      if (v === "ring") {
        const i = ORDER.indexOf(full);
        if (i !== activeRef.current) {
          driver.halt();
          driver.write(i);
          arrive(i);
        }
        void expand(i);
      }
    } else if (v === "full" || v === "expanding") {
      void collapse(activeRef.current);
    }
  }, [full, geo, arrive, collapse, driver, expand]);

  // The library search names a clip (`?i=`): its character comes to the front.
  useEffect(() => {
    const onPop = () => {
      if (viewRef.current !== "ring") return;
      const named = slugFromAddress(window.location.pathname, window.location.search);
      if (named) goTo(ORDER.indexOf(named));
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [goTo]);

  // Input on the ring ------------------------------------------------------------------------------

  useEffect(() => {
    const el = sceneRef.current;
    if (!el || !mounted) return;
    let drag: {
      id: number;
      x: number;
      y: number;
      p: number;
      axis: "x" | "y" | null;
      index: number | null;
      now: number;
    } | null = null;
    let frame = 0;
    const meter = newWheel();
    // The lean of the ring, written at most once a frame (the pointer moves far more often).
    const lean = { y: 0, x: 0, held: false };
    let leanFrame = 0;
    const writeLean = () => {
      if (leanFrame) return;
      leanFrame = requestAnimationFrame(() => {
        leanFrame = 0;
        const el = swayRef.current;
        if (!el || viewRef.current !== "ring") return;
        el.style.transform = `rotateY(${lean.y.toFixed(2)}deg) rotateX(${lean.x.toFixed(2)}deg)${lean.held ? " scale(0.98)" : ""}`;
      });
    };

    const onDown = (e: PointerEvent) => {
      if (viewRef.current !== "ring" || e.button !== 0) return;
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
      const index = hit ? Number(hit.dataset.index) : null;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        p: driver.current(),
        axis: null,
        index,
        now: driver.current(),
      };
    };
    const onMove = (e: PointerEvent) => {
      // The pointer leans the ring a little (not while it is flat in full screen).
      if (viewRef.current === "ring" && e.pointerType === "mouse" && geo) {
        lean.y = -((e.clientX / geo.view.w) * 2 - 1) * 2.6;
        lean.x = -((e.clientY / geo.view.h) * 2 - 1) * 2.2;
        writeLean();
      }
      if (drag?.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 8) return;
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        drag.p = driver.halt();
        driver.fadeLive(activeRef.current, false, 320);
        el.setPointerCapture(e.pointerId);
        setDragging(true);
        lean.held = true;
        writeLean();
      }
      const d = drag.axis === "x" ? dx : dy;
      const screen = drag.axis === "x" ? (geo?.view.w ?? 1) : (geo?.view.h ?? 1);
      drag.now = drag.p + dragTurn(d, screen);
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (drag) driver.write(drag.now);
        });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      const d = drag;
      drag = null;
      cancelAnimationFrame(frame);
      frame = 0;
      if (!d.axis) {
        // A press: the panel in front launches, a panel beside it comes to the front.
        if (d.index === null) return;
        if (d.index === activeRef.current && !driver.moving) launch();
        else if (d.index !== activeRef.current) {
          audio.blip("click");
          goTo(d.index);
        }
        return;
      }
      setDragging(false);
      lean.held = false;
      writeLean();
      driver.write(d.now);
      const goal = dragTarget(d.p, d.now);
      const far = Math.abs(goal - d.now);
      glideTo(
        goal,
        goal === d.p ? SNAP_BACK_MS : Math.max(380, PRESS_STEP_MS * Math.min(1, far * 1.4)),
      );
    };
    const onLeave = () => {
      lean.x = 0;
      lean.y = 0;
      writeLean();
    };
    const onWheel = (e: WheelEvent) => {
      if (viewRef.current !== "ring" || overlayOpen()) return;
      const dx = wheelPixels(e.deltaX, e.deltaMode);
      const dy = wheelPixels(e.deltaY, e.deltaMode);
      const s = feedWheel(meter, Math.abs(dy) >= Math.abs(dx) ? dy : dx, performance.now());
      if (s !== 0) step(s, 900);
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(leanFrame);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("wheel", onWheel);
    };
  }, [mounted, geo, driver, glideTo, goTo, launch, step]);

  // What is drawn ----------------------------------------------------------------------------------

  const chars = useMemo(() => {
    const map = new Map<CharacterSlug, AnimChar>();
    for (const c of file?.characters ?? []) map.set(c.slug, c);
    return map;
  }, [file]);
  const clips = file?.items ?? NO_CLIPS;
  const ownClips = useMemo(() => clips.filter((c) => c.chars[0] === slug), [clips, slug]);
  const buttons = useMemo(
    () => (core.phase === "missing" ? [] : optionButtons(ownClips, core.bundle?.timeline ?? null)),
    [ownClips, core.bundle, core.phase],
  );
  const phase = useMemo(
    () => fullPhase({ core: core.phase, stage: controls.state, replay, held: controls.held }),
    [core.phase, controls.state, controls.held, replay],
  );
  const views = useMemo(() => optionViews(phase, buttons), [phase, buttons]);

  // A press waits for its files: once they are all in memory, the stage plays it.
  const heldButton = controls.held ? buttons.find((b) => b.clip.scene === controls.held) : null;
  const heldReady = heldButton ? heldButton.files.every((f) => files.isLoaded(f)) : false;
  useEffect(() => {
    if (heldReady) releaseHeld();
  }, [heldReady, controls.state, releaseHeld]);

  const sizeOf = (f: string) =>
    core.bundle ? (core.bundle.bytes[core.bundle.media.tier()]?.[f] ?? 1) : 1;
  const heldProgress = heldButton ? sceneProgress(heldButton.files, files.fractionOf, sizeOf) : 0;

  const press = useCallback(
    (b: RoomButton) => {
      if (b.role === "welcome") {
        // A new stage begins with the welcome. Nothing else shows until it is done.
        setReplay(true);
        resetStage();
        setNonce((n) => n + 1);
        return;
      }
      const scene = b.clip.scene;
      if (!scene) return;
      const loaded = b.files.every((f) => files.isLoaded(f));
      // Wanted now: its files go first.
      if (!loaded) files.promote(b.files);
      pressScene(scene, loaded);
    },
    [files, pressScene, resetStage],
  );

  // Keys.
  const viewsRef = useRef(views);
  useEffect(() => {
    viewsRef.current = views;
  }, [views]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target))
        return;
      if (overlayOpen()) return;
      const v = viewRef.current;
      if (v === "ring") {
        const next = ["ArrowRight", "ArrowDown", "PageDown"].includes(e.key);
        const before = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key);
        if (next || before) {
          e.preventDefault();
          step(next ? 1 : -1);
        } else if (
          e.key === "Enter" &&
          !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
        ) {
          e.preventDefault();
          launch();
        }
      } else if (v === "full") {
        if (e.key === "Escape") {
          // In full screen the browser takes Escape to leave it; the next one goes back.
          if (document.fullscreenElement) return;
          e.preventDefault();
          back();
        } else if (/^[1-9]$/u.test(e.key) && !e.repeat) {
          // Only a button that shows can be pressed.
          const hit = viewsRef.current.find((o) => o.shown && o.button.key === Number(e.key));
          if (hit) {
            audio.blip("click");
            press(hit.button);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [back, launch, press, step]);

  // Whole frame follows the shape of the screen: it is for a tall one, and the full screen view.
  const tall = geo?.narrow ?? false;
  useEffect(() => {
    if (!geo) return;
    const want = whole && viewRef.current === "full" && geo.narrow;
    const i = activeRef.current;
    if (want !== (driver.wholeOn === i)) driver.whole(i, want, 0);
  }, [geo, whole, driver]);
  const toggleWhole = useCallback(() => {
    if (viewRef.current !== "full") return;
    const next = driver.wholeOn !== activeRef.current;
    driver.whole(activeRef.current, next, 520);
    setWhole(next);
  }, [driver]);

  const fields = useMemo(
    () =>
      ORDER.map((s) => {
        const c = chars.get(s);
        return { slug: s, ...(c ? fieldColors(c.palette) : { main: "#1b1f2a", deep: "#0b0d12" }) };
      }),
    [chars],
  );
  const splashes = useMemo(
    () =>
      ORDER.map((s) => {
        const { src, focus } = splashFor(s);
        return {
          src,
          at: `${Math.round(focus.x * 1000) / 10}% ${Math.round(focus.y * 1000) / 10}%`,
        };
      }),
    [],
  );

  const showStage = core.phase === "ready" && core.bundle !== null;
  const liveKey = `${slug}:${arrival}:${nonce}`;
  // A stage that was replaced (Welcome again, another character) may still finish a hand over
  // after it is gone: only the stage on show reports its state.
  const liveKeyRef = useRef(liveKey);
  useLayoutEffect(() => {
    liveKeyRef.current = liveKey;
  }, [liveKey]);
  const takeState = controls.onState;
  const onStageState = useCallback(
    (s: StageState) => {
      if (liveKeyRef.current === liveKey) takeState(s);
    },
    [liveKey, takeState],
  );
  const live =
    showStage && core.bundle ? (
      <CharacterStage
        key={liveKey}
        ref={stage}
        timeline={core.bundle.timeline}
        media={core.bundle.media}
        skip={core.bundle.skip}
        onState={onStageState}
        welcome
        onBegin={noop}
      />
    ) : null;

  return (
    <div
      ref={roomRef}
      className={styles.room}
      data-animation-room=""
      data-view={view}
      data-active={mounted ? slug : undefined}
      data-target={mounted ? ORDER[target] : undefined}
      data-core={mounted ? core.phase : undefined}
      data-stage={mounted ? controls.state.mode : undefined}
      data-phase={mounted ? phase.phase : undefined}
      data-shape={geo ? (tall ? "tall" : "wide") : undefined}
      data-low={geo ? geo.view.h <= LOW_PX : undefined}
      data-whole={whole && view === "full" && tall}
      data-fullscreen={screen.on}
    >
      {mounted ? (
        <>
          <Background fields={fields} active={target} geometry={geo} />
          <div
            ref={sceneRef}
            className={scene.scene}
            data-view={view}
            data-dragging={dragging}
            data-animation-ring=""
            aria-hidden="true"
          >
            <div ref={swayRef} className={scene.sway}>
              {ORDER.map((s, i) => (
                <Panel
                  key={s}
                  index={i}
                  slug={s}
                  focus={chars.get(s)?.focus ?? 50}
                  splash={splashes[i]!.src}
                  splashAt={splashes[i]!.at}
                  live={i === active ? live : null}
                  liveKey={liveKey}
                  waiting={i === active && core.phase === "loading"}
                  load={i === active && core.phase === "loading" ? core.load : null}
                  register={register}
                />
              ))}
            </div>
          </div>
          {file ? (
            <>
              <div className={styles.layer} data-for="ring">
                <CarouselUi
                  chars={chars}
                  clips={clips}
                  target={target}
                  onStep={(dir) => {
                    step(dir);
                  }}
                  onGo={goTo}
                  onLaunch={launch}
                />
              </div>
              <div className={styles.layer} data-for="full">
                {view === "full" || view === "collapsing" ? (
                  <FullUi
                    name={chars.get(slug)?.name ?? ""}
                    phase={phase}
                    views={views}
                    wait={waitOf(phase, controls.held)}
                    progress={heldProgress}
                    timing={phase.phase === "loading" ? controls.state.wait : null}
                    tall={tall}
                    low={geo ? geo.view.h <= LOW_PX : false}
                    whole={whole && tall}
                    fullscreen={screen}
                    onBack={back}
                    onPress={press}
                    onWhole={toggleWhole}
                    onWarm={(b) => {
                      files.promote(b.files);
                      if (b.clip.scene && b.files.every((f) => files.isLoaded(f)))
                        controls.warm(b.clip.scene);
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      <div className={styles.page}>{children}</div>
    </div>
  );
}

function noop() {
  /* The room's music is its own (the theme of the character on show). */
}
