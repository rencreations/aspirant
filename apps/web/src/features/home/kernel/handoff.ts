/**
 * The way out of the home page: the footer's end leads to `/about`. The logo curtain does not run
 * here. The handoff claims the transition router (so no curtain and no second change starts), calls
 * the exit hook the last section has set (the drone flies out to the right, where About's opening
 * brings it in), covers the page with the daybreak ground, changes the page, waits for it to be
 * ready, and uncovers it. The cover is an element of its own on `document.body`, owned by this
 * module, because the home page unmounts in the middle of the change. Nothing here is a timer that
 * waits for a file: each wait is for the real thing (the address, the page's own readiness).
 *
 * Any failure releases the claim and falls back to the plain curtain (`transition.push`).
 */
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { NAVIGATED_EVENT, REVEAL_EVENT } from "@/lib/hooks";
import { OFFLINE_BLOCKED_EVENT, isOffline } from "@/lib/offline";
import { whenPageReady } from "@/lib/page-ready";
import { runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";
import { routes } from "@/lib/site";

/** The daybreak ground the cover paints (`--bg` of the daybreak theme). */
const COVER_COLOUR = "#f4f6f9";
/** How long the cover takes to come and to go. */
const COVER_MS = 380;
const EASE = "cubic-bezier(.32, .72, 0, 1)";
/** A page that is not ready this long after the push gets the loading words (as the logo curtain does). */
const LOADING_STATE_AFTER_MS = 500;

type ExitHook = () => Promise<void> | void;

let exitHook: ExitHook | null = null;
let running = false;

/**
 * The last section says how its actors leave the screen before the page changes (the drone exits
 * to the right). The hook may return a promise; the change waits for it. Returns the way to take
 * the hook out.
 */
/** @public */
export function setExitHook(hook: ExitHook): () => void {
  exitHook = hook;
  return () => {
    if (exitHook === hook) exitHook = null;
  };
}

function normal(path: string): string {
  return path.replace(/\/+$/u, "") || "/";
}

/** The words on the cover while About is not ready: what it loads, how far it is, or that the line is down. */
export function handoffWords(progress: number, offline: boolean): string {
  if (offline) return "Offline. Waiting for the connection";
  return `Loading About ${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
}

/** Resolve when the address is `target`. No timer: the new page's files may be slow. */
export function pathReached(target: string): Promise<void> {
  return new Promise((resolve) => {
    const goal = normal(target);
    let frame = 0;
    const look = () => {
      if (normal(window.location.pathname) !== goal) return false;
      window.removeEventListener(NAVIGATED_EVENT, look);
      cancelAnimationFrame(frame);
      resolve();
      return true;
    };
    if (look()) return;
    window.addEventListener(NAVIGATED_EVENT, look);
    const poll = () => {
      if (!look()) frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
  });
}

/** Hold the scroll while the page changes (guards only: the smooth scroller keeps running). */
function guardScroll(): () => void {
  const keys = new Set([" ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"]);
  const stop = (e: Event) => {
    if (e instanceof KeyboardEvent && !keys.has(e.key)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const opts = { capture: true, passive: false } as const;
  window.addEventListener("wheel", stop, opts);
  window.addEventListener("touchmove", stop, opts);
  window.addEventListener("keydown", stop, opts);
  return () => {
    window.removeEventListener("wheel", stop, opts);
    window.removeEventListener("touchmove", stop, opts);
    window.removeEventListener("keydown", stop, opts);
  };
}

interface Cover {
  show(): Promise<void>;
  hide(): Promise<void>;
  /** The loading words and the real progress under them (0 to 1), shown on the first call. */
  note(words: string, progress: number): void;
  remove(): void;
}

/** A fixed plate of the daybreak ground over everything, made and removed here. */
function makeCover(): Cover {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.homeCover = "";
  el.style.cssText =
    `position:fixed;inset:0;z-index:var(--z-transition, 90);pointer-events:none;opacity:0;` +
    `background-color:${COVER_COLOUR};` +
    `background-image:radial-gradient(circle, rgb(11 11 14 / .09) 1px, transparent 1.4px);` +
    `background-size:28px 28px;`;
  document.body.appendChild(el);
  // The loading words: a mono line and a hairline that fills (transform only), made on the first note.
  let words: HTMLElement | null = null;
  let line: HTMLElement | null = null;
  const makeNote = () => {
    const box = document.createElement("div");
    box.style.cssText =
      "position:absolute;left:50%;top:50%;width:min(240px,60vw);transform:translate(-50%,-50%);" +
      "display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;transition:opacity .4s ease;";
    words = document.createElement("p");
    words.style.cssText =
      "margin:0;font:500 11px/1 var(--font-mono, ui-monospace, monospace);letter-spacing:.14em;" +
      "text-transform:uppercase;color:rgb(11 11 14 / .62);text-align:center;";
    const rail = document.createElement("div");
    rail.style.cssText = "width:100%;height:1px;background:rgb(11 11 14 / .14);overflow:hidden;";
    line = document.createElement("div");
    line.style.cssText =
      "width:100%;height:100%;background:rgb(11 11 14 / .8);transform-origin:left;transform:scaleX(0);";
    rail.appendChild(line);
    box.append(words, rail);
    el.appendChild(box);
    requestAnimationFrame(() => {
      box.style.opacity = "1";
    });
  };
  const fade = (to: 0 | 1) =>
    new Promise<void>((resolve) => {
      const a = el.animate([{ opacity: to === 1 ? 0 : 1 }, { opacity: to }], {
        duration: COVER_MS,
        easing: EASE,
        fill: "forwards",
      });
      a.onfinish = () => {
        el.style.opacity = String(to);
        resolve();
      };
      a.oncancel = () => {
        resolve();
      };
    });
  return {
    show: () => fade(1),
    hide: () => fade(0),
    note: (text, progress) => {
      if (!words) makeNote();
      if (words) words.textContent = text;
      if (line) line.style.transform = `scaleX(${Math.min(1, Math.max(0, progress)).toFixed(3)})`;
    },
    remove: () => {
      el.remove();
    },
  };
}

interface HandoffDeps {
  release: () => void;
  push: (href: Route) => void;
  fallback: () => void;
  scrollTo: (y: number, options?: { immediate?: boolean }) => void;
}

async function change(deps: HandoffDeps): Promise<void> {
  const cover = makeCover();
  const unguard = guardScroll();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    deps.release();
  };
  let progress = 0;
  let waiting = false;
  const say = () => {
    if (waiting) cover.note(handoffWords(progress, isOffline()), progress);
  };
  try {
    // The page we are going to loads while the drone leaves, as the curtain's change does, and the
    // change waits for all of it: a slow connection waits behind the cover, with the real percentage.
    const assets = runPreload(routeItems(routes.about), (p) => {
      progress = p.progress;
      say();
    });
    // The exit first (the drone flies out to the right), then the cover: the cover is mostly opaque
    // within 150 ms, so run together the flight would never be seen. A hook has nothing to wait for
    // when the scroll has already taken the drone out, so the scroll's way in is not delayed.
    await Promise.resolve(exitHook?.());
    await cover.show();
    // Back to the top while the cover hides the page, so About mounts at its top: its opening (the
    // drone crossing the title) is skipped for a page that is already scrolled down when its drone
    // is ready, and that moment comes before `whenPageReady`.
    deps.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    const pushedAt = performance.now();
    deps.push(routes.about);
    let ready = false;
    const arrived = Promise.all([pathReached(routes.about), assets])
      .then(() => whenPageReady())
      .then(() => {
        ready = true;
      });
    const left = LOADING_STATE_AFTER_MS - (performance.now() - pushedAt);
    await Promise.race([arrived, new Promise<void>((r) => window.setTimeout(r, left))]);
    if (!ready) {
      waiting = true;
      say();
      window.addEventListener("offline", say);
      window.addEventListener("online", say);
      await arrived;
      window.removeEventListener("offline", say);
      window.removeEventListener("online", say);
    }
    deps.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
    await cover.hide();
    cover.remove();
    window.dispatchEvent(new Event(REVEAL_EVENT));
    release();
  } catch {
    release();
    deps.fallback();
  } finally {
    cover.remove();
    unguard();
    running = false;
  }
}

/**
 * The function that takes the visitor from the home page to About. The footer's button, the N key
 * and the scroll to the end of the page all call it. It does nothing while a change is running.
 */
export function useHomeHandoff(): () => void {
  const transition = useTransitionRouter();
  const router = useRouter();
  const { scrollTo } = useLenis();
  const live = useRef({ transition, router, scrollTo });
  useEffect(() => {
    live.current = { transition, router, scrollTo };
  });
  return useCallback(() => {
    if (running) return;
    const { transition: t, router: r, scrollTo: to } = live.current;
    // Offline, a page that was never opened cannot load: the calm notice, and the home stays.
    if (!t.canOpen(routes.about)) {
      window.dispatchEvent(new Event(OFFLINE_BLOCKED_EVENT));
      return;
    }
    const release = t.claim();
    if (!release) return;
    running = true;
    void change({
      release,
      push: (href) => {
        r.push(href, { scroll: false });
      },
      fallback: () => {
        t.push(routes.about, { label: "About" });
      },
      scrollTo: to,
    });
  }, []);
}
