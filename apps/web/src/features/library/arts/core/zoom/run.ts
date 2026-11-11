/**
 * The moves of one picture of the viewer, outside React. A move is Web Animations with two
 * keyframes per layer and one easing (`zoom-math.ts` makes the keyframes): the window (two nested
 * clips that only translate), the counter that puts the picture back in place, the picture, and the
 * backdrop. Only transform and opacity change. Every animation of a move is paused together, played
 * together and reversed together, so a press in the middle of a move turns it round from where it is.
 *
 * The probe `window.__artsZoom` holds a move at its first frame for frame sheets: set `freeze`
 * before it, wait for `phase === "held"`, then `seek(ms)` and `release()`.
 */
import { recheckZoomCursor } from "./cursor";
import { findZoomTile } from "./tile";
import type { RunHandle, ZoomPhase, ZoomView } from "./types";
import {
  CLOSE_MS,
  EASE,
  OPEN_MS,
  PRESS_GRACE_MS,
  STEP_MS,
  canFlyTo,
  dragProgress,
  fadePose,
  morphFrames,
  openLayout,
  sourcePose,
  type Box,
  type Layout,
  type Pose,
  type Rect,
  type WindowFrames,
} from "./zoom-math";

export interface RunEls {
  root: HTMLElement;
  drag: HTMLElement;
  outer: HTMLElement;
  inner: HTMLElement;
  counter: HTMLElement;
  scroller: HTMLElement;
  content: HTMLElement;
  backdrop: HTMLElement | null;
  /** The thumbnail layer: it must be drawn before the tile is hidden. */
  thumb: () => HTMLImageElement | null;
}

export interface RunHooks {
  phase: (phase: ZoomPhase) => void;
  closeStart: () => void;
  closed: () => void;
  scrolled: (progress: number) => void;
}

const noop = () => undefined;

function probe(): NonNullable<Window["__artsZoom"]> {
  window.__artsZoom ??= { freeze: false, phase: "idle", duration: 0, seek: noop, release: noop };
  return window.__artsZoom;
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface BuildOptions {
  duration: number;
  /** Fade the whole picture (a move with no tile at the other end). */
  fade: "in" | "out" | null;
  backFrom: number;
  backTo: number;
  /** The viewer was dragged this far down: it comes home with the move. */
  dragFrom?: number;
}

/**
 * Start the moves of one picture. `view.entry` says how it comes in. Call `dispose` when the slide
 * goes (it puts everything back); `fadeOut` is for a slide that a neighbour replaces.
 */
export function startRun(
  view: ZoomView,
  els: RunEls,
  hooks: RunHooks,
): { handle: RunHandle; dispose: () => void; fadeOut: () => void } {
  const picture = view.picture;
  const aspect = picture.img.w / picture.img.h;
  const mode = picture.mode ?? "fit";

  let phase: ZoomPhase = "opening";
  let anims: Animation[] = [];
  let primary: Animation | null = null;
  let layout: Layout = openLayout({ w: 1, h: 1 }, aspect, mode);
  let full: Box = { w: 1, h: 1 };
  let started = false;
  let disposed = false;
  let lastPress = performance.now();
  let watchdog = 0;
  let hidden: HTMLElement | null = null;
  let hiddenWas = "";
  let backdropNow = 0;
  let scrollRaf = 0;
  let resizeRaf = 0;

  const setPhase = (next: ZoomPhase) => {
    phase = next;
    probe().phase = next === "closed" ? "idle" : next;
    hooks.phase(next);
  };

  const measure = (): Box => ({ w: els.root.clientWidth || 1, h: els.root.clientHeight || 1 });

  // The source tile: hidden while its picture is open (no layout change), shown again on landing.
  const hideSource = (el: HTMLElement | null) => {
    if (!el || hidden === el) return;
    restoreSource();
    hidden = el;
    hiddenWas = el.style.visibility;
    el.style.visibility = "hidden";
  };
  const restoreSource = () => {
    if (!hidden) return;
    hidden.style.visibility = hiddenWas;
    hidden = null;
  };

  const sizeContent = () => {
    els.content.style.width = `${layout.box.w}px`;
    els.content.style.height = `${layout.box.h}px`;
    els.scroller.tabIndex = layout.scrollable ? 0 : -1;
  };

  /** The layers at rest in the open pose. */
  const setStatic = () => {
    const f = morphFrames(layout.open, layout.open, full);
    els.outer.style.transform = f.outer[1];
    els.inner.style.transform = f.inner[1];
    els.counter.style.transform = f.counter[1];
    els.content.style.transform = f.content[1];
    if (els.backdrop) els.backdrop.style.opacity = "1";
    backdropNow = 1;
  };

  const cancelAnimations = () => {
    for (const a of anims) {
      a.onfinish = null;
      a.cancel();
    }
    anims = [];
    primary = null;
  };

  const build = (from: Pose, to: Pose, o: BuildOptions): void => {
    const f: WindowFrames = morphFrames(from, to, full);
    const timing: KeyframeAnimationOptions = { duration: o.duration, easing: EASE, fill: "both" };
    const outerFrames: Keyframe[] = [{ transform: f.outer[0] }, { transform: f.outer[1] }];
    if (o.fade) {
      outerFrames[0] = { ...outerFrames[0], opacity: o.fade === "in" ? 0 : 1 };
      outerFrames[1] = { ...outerFrames[1], opacity: o.fade === "in" ? 1 : 0 };
    }
    const content = els.content.animate(
      [{ transform: f.content[0] }, { transform: f.content[1] }],
      timing,
    );
    anims = [
      els.outer.animate(outerFrames, timing),
      els.inner.animate([{ transform: f.inner[0] }, { transform: f.inner[1] }], timing),
      els.counter.animate([{ transform: f.counter[0] }, { transform: f.counter[1] }], timing),
      content,
    ];
    if (els.backdrop) {
      anims.push(els.backdrop.animate([{ opacity: o.backFrom }, { opacity: o.backTo }], timing));
    }
    if (o.dragFrom) {
      anims.push(
        els.drag.animate(
          [
            { transform: `translate3d(0, ${o.dragFrom}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          timing,
        ),
      );
      els.drag.style.transform = "";
    }
    primary = content;
    primary.onfinish = onEnd;
  };

  /** Hold the move for a frame sheet, when the probe asks for it. Resolves when it is released. */
  const hold = async (duration: number): Promise<void> => {
    const p = probe();
    if (!p.freeze) return;
    p.phase = "held";
    p.duration = duration;
    await new Promise<void>((resolve) => {
      p.seek = (ms) => {
        for (const a of anims) a.currentTime = ms;
      };
      p.release = () => {
        p.seek = noop;
        p.release = noop;
        resolve();
      };
    });
    p.phase = phase === "closed" ? "idle" : phase;
  };

  const armWatchdog = (ms: number) => {
    window.clearTimeout(watchdog);
    // A move that has not ended long after it should have is ended by hand: the page is never left under it.
    watchdog = window.setTimeout(() => {
      if (disposed || probe().freeze) return;
      if (phase === "opening") settleOpen();
      else if (phase === "closing") settleClosed();
    }, ms + 2500);
  };

  const settleOpen = () => {
    window.clearTimeout(watchdog);
    layout = openLayout(full, aspect, mode);
    sizeContent();
    setStatic();
    cancelAnimations();
    els.scroller.dataset.scroll = layout.scrollable ? "true" : "false";
    setPhase("open");
    if (layout.scrollable) els.scroller.focus({ preventScroll: true });
    recheckZoomCursor();
  };

  const settleClosed = () => {
    window.clearTimeout(watchdog);
    // The animations stay (they hold the last frame: the picture on its tile, the backdrop gone)
    // until the viewer is removed, so no frame shows the open picture again in between.
    restoreSource();
    setPhase("closed");
    hooks.closed();
  };

  function onEnd() {
    if (disposed) return;
    if (phase === "opening") settleOpen();
    else if (phase === "closing") settleClosed();
  }

  const start = async () => {
    full = measure();
    layout = openLayout(full, aspect, mode);
    sizeContent();
    els.scroller.dataset.scroll = "false";
    const entry = view.entry;

    if (entry === "step") {
      // A neighbour replaces the picture: it fades in over the old one, already in its place.
      setStatic();
      hideSource(view.source);
      els.outer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: STEP_MS, easing: "linear" });
      settleOpen();
      return;
    }

    const rect = view.rect;
    const fly = entry === "morph" && rect !== null && canFlyTo(rect, full);
    const from: Pose = fly
      ? sourcePose(rect, view.frame ?? picture.frame, layout.box, full)
      : fadePose(layout.open, full);
    build(from, layout.open, {
      duration: OPEN_MS,
      fade: fly ? null : "in",
      backFrom: 0,
      backTo: 1,
    });
    for (const a of anims) a.pause();
    setPhase("opening");
    recheckZoomCursorSoon();

    // The thumbnail is drawn first (it is the tile's own picture, already in the cache), then the tile
    // goes and the move begins: no frame shows a hole where the tile was.
    const thumb = els.thumb();
    await Promise.race([thumb ? thumb.decode().catch(noop) : Promise.resolve(), wait(220)]);
    if (disposed || phase !== "opening") return;
    hideSource(view.source);
    started = true;
    await hold(OPEN_MS);
    if (disposed || phase !== "opening") return;
    for (const a of anims) a.play();
    armWatchdog(OPEN_MS);
  };

  function recheckZoomCursorSoon() {
    requestAnimationFrame(() => {
      requestAnimationFrame(recheckZoomCursor);
    });
  }

  /** The tile that shows this picture now. The one the viewer opened from, or the one in the page. */
  const resolveSource = (): HTMLElement | null => {
    const el = view.source;
    if (el?.isConnected && el.dataset.zoomId === picture.id) return el;
    return findZoomTile(picture.id) ?? (el?.isConnected ? el : null);
  };

  const closeFromOpen = async (dragY: number) => {
    // The window may have changed size while the picture was open.
    if (Math.abs(measure().w - full.w) > 0.5 || Math.abs(measure().h - full.h) > 0.5) refit();
    setPhase("closing");
    const st = layout.scrollable ? els.scroller.scrollTop : 0;
    const el = resolveSource();
    const rect = el ? rectOf(el) : null;
    const fly = canFlyTo(rect, full);
    const nowPose: Pose = {
      win: layout.open.win,
      c: { x: layout.open.c.x, y: layout.open.c.y - st, s: layout.open.c.s },
    };
    const to: Pose =
      fly && rect ? sourcePose(rect, picture.frame, layout.box, full) : fadePose(layout.open, full);
    // The tile is hidden by the viewer, but the cursor and the page must see it once the picture lands.
    if (el) hideSource(el);
    build(nowPose, to, {
      duration: CLOSE_MS,
      fade: fly ? null : "out",
      backFrom: backdropNow,
      backTo: 0,
      dragFrom: dragY,
    });
    els.scroller.dataset.scroll = "false";
    els.scroller.scrollTop = 0;
    armWatchdog(CLOSE_MS);
    for (const a of anims) a.pause();
    await hold(CLOSE_MS);
    if (disposed || phase !== "closing") return;
    for (const a of anims) a.play();
  };

  const close = (force = false): boolean => {
    if (disposed || phase === "closing" || phase === "closed") return false;
    const now = performance.now();
    if (!force && now - lastPress < PRESS_GRACE_MS) return false;
    lastPress = now;
    hooks.closeStart();
    if (phase === "opening") {
      if (!started) {
        // It had not begun: nothing to undo (the paused first frame stays until the viewer goes).
        restoreSource();
        setPhase("closed");
        hooks.closed();
        return true;
      }
      // Turn the move round from where it is.
      setPhase("closing");
      for (const a of anims) a.reverse();
      armWatchdog(OPEN_MS);
      return true;
    }
    void closeFromOpen(0);
    return true;
  };

  const drag = (dy: number) => {
    if (phase !== "open") return;
    els.drag.style.transform = `translate3d(0, ${dy}px, 0)`;
    backdropNow = 1 - 0.75 * dragProgress(dy, full.h);
    if (els.backdrop) els.backdrop.style.opacity = String(backdropNow);
  };

  const release = (dy: number, dismiss: boolean) => {
    if (phase !== "open") return;
    if (dismiss) {
      lastPress = performance.now();
      hooks.closeStart();
      void closeFromOpen(dy);
      return;
    }
    els.drag.style.transform = "";
    els.drag.animate(
      [{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
      { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    els.backdrop?.animate([{ opacity: backdropNow }, { opacity: 1 }], {
      duration: 320,
      easing: "linear",
    });
    backdropNow = 1;
    if (els.backdrop) els.backdrop.style.opacity = "1";
  };

  /** The window changed size: put the open picture back in the new size, keeping the place in a strip. */
  function refit() {
    if (phase === "opening") {
      if (!started) return;
      // Skip to the end of the move, then fit.
      cancelAnimations();
      setPhase("open");
    }
    if (phase !== "open") return;
    const travel = layout.travel;
    const ratio = travel > 0 ? els.scroller.scrollTop / travel : 0;
    full = measure();
    layout = openLayout(full, aspect, mode);
    sizeContent();
    setStatic();
    els.scroller.dataset.scroll = layout.scrollable ? "true" : "false";
    if (layout.scrollable) els.scroller.scrollTop = ratio * layout.travel;
    hooks.scrolled(layout.travel > 0 ? els.scroller.scrollTop / layout.travel : 0);
  }

  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!disposed) refit();
    });
  };

  const onScroll = () => {
    if (scrollRaf || phase !== "open") return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      hooks.scrolled(layout.travel > 0 ? els.scroller.scrollTop / layout.travel : 0);
    });
  };

  window.addEventListener("resize", onResize, { passive: true });
  els.scroller.addEventListener("scroll", onScroll, { passive: true });
  void start();

  const handle: RunHandle = {
    close,
    drag,
    release,
    scroller: () => (layout.scrollable ? els.scroller : null),
    atTop: () => !layout.scrollable || els.scroller.scrollTop <= 0,
  };

  return {
    handle,
    fadeOut: () => {
      restoreSource();
      els.outer.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: STEP_MS,
        easing: "linear",
        fill: "forwards",
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(watchdog);
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      els.scroller.removeEventListener("scroll", onScroll);
      cancelAnimations();
      restoreSource();
      const p = probe();
      if (p.phase !== "idle") p.phase = "idle";
    },
  };
}
