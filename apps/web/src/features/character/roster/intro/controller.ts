import type { Slug } from "@/content/types";
import { asset } from "@/lib/asset";
import { mediaUrl, releaseMedia } from "@/lib/media-store";
import { expectReady } from "@/lib/page-ready";
import { perfLevel, perfReady } from "@/lib/perf";

import { splashPath } from "../splash";
import { INTRO_CLIPS } from "./clips";
import { introView, measurePage, panelElement } from "./geometry";
import { type Assets, IntroRenderer, type Source } from "./gl/renderer";
import { STILL_NAMES, STILLS } from "./stills";
import { createScene, DURATION, PANEL_SLUGS, sceneAt } from "./timeline";

declare global {
  interface Window {
    __rosterIntro?: RosterIntroApi;
  }
}

/** What the checks and the comparison tool use (`window.__rosterIntro`). */
interface RosterIntroApi {
  /** Freeze the intro at `t` and draw it. Resolves once the frame is on the screen. */
  seek: (t: number) => Promise<void>;
  /** Run the intro from the start. */
  play: () => void;
  duration: number;
  /** loading, ready, playing, frozen or ended. */
  state: string;
  /** With `?introDebug`: the frames whose own work took more than 4 ms, as [time, ms]. */
  slow?: Array<[number, number]>;
}

const CLIPS_DIR = "/video/roster-intro/";
/** A clip that has not shown a picture by now is dropped: its panel stands on its splash art. */
const CLIP_WAIT_MS = 6000;
const SKIP_FADE_MS = 200;
/** Times that between them use every program of the renderer. */
const WARM_TIMES = [0.9, 1.7, 2.3, 2.55, 2.82, 2.95, 3.2, 3.3, 3.6] as const;

/** Load a picture and shrink it to what the panels can show. */
async function loadImage(path: string, maxWidth: number): Promise<Source | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = asset(path);
    await img.decode();
    if (typeof createImageBitmap === "function" && img.naturalWidth > maxWidth) {
      const h = Math.round((img.naturalHeight / img.naturalWidth) * maxWidth);
      return await createImageBitmap(img, {
        resizeWidth: maxWidth,
        resizeHeight: h,
        resizeQuality: "high",
      });
    }
    return img;
  } catch {
    return null;
  }
}

function makeVideo(slug: Slug): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.src = mediaUrl(INTRO_CLIPS[slug].src);
  return v;
}

function whenVideoReady(v: HTMLVideoElement, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (v.readyState >= 2) {
      resolve(true);
      return;
    }
    if (v.error) {
      resolve(false);
      return;
    }
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      v.removeEventListener("loadeddata", onData);
      v.removeEventListener("error", onError);
      resolve(ok);
    };
    const onData = () => {
      done(true);
    };
    const onError = () => {
      done(false);
    };
    const timer = window.setTimeout(() => {
      done(false);
    }, ms);
    v.addEventListener("loadeddata", onData);
    v.addEventListener("error", onError);
  });
}

function seeked(v: HTMLVideoElement, to: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - to) < 0.0005 && v.readyState >= 2) {
      resolve();
      return;
    }
    const done = () => {
      window.clearTimeout(timer);
      v.removeEventListener("seeked", done);
      resolve();
    };
    const timer = window.setTimeout(done, 1500);
    v.addEventListener("seeked", done);
    v.currentTime = to;
  });
}

/**
 * Start a clip's decoder before the intro needs it: play a moment, stop, come back to the start.
 * Starting a decoder in the middle of the intro costs a frame or two.
 */
async function preroll(v: HTMLVideoElement): Promise<void> {
  try {
    v.playbackRate = 1;
    await Promise.race([v.play(), new Promise<void>((r) => window.setTimeout(r, 600))]);
    await new Promise<void>((r) => window.setTimeout(r, 70));
    v.pause();
    await seeked(v, 0);
  } catch {
    // A clip that will not play is simply not used smoothly.
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Wait for the loading curtain to open (a page change or the first visit), then go. */
function whenCurtainOpen(stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const el = document.querySelector<HTMLElement>("[data-mode][data-active]");
    if (el?.dataset.active !== "true") {
      resolve();
      return;
    }
    const obs = new MutationObserver(() => {
      if (el.dataset.active !== "true" || stopped()) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-active"] });
  });
}

let handOverRoot: HTMLElement | null = null;

/** The page below hides its logo block and idle effects while the intro plays. */
export function setHandOver(state: "play" | "done"): void {
  if (!handOverRoot?.isConnected) {
    const el = panelElement("obsidia");
    handOverRoot =
      el?.closest<HTMLElement>("[data-intro]") ??
      document.querySelector<HTMLElement>("[data-intro]");
  }
  if (handOverRoot && handOverRoot.dataset.intro !== state) handOverRoot.dataset.intro = state;
}

/**
 * Run the intro in `host`. It builds the canvas, loads what the panels need, waits for the loading
 * curtain to open, plays the timeline and removes everything at the end (or at a click, a tap or
 * Esc). The returned function stops it at once and frees everything.
 *
 * `?introT=<t>` freezes the picture at `t` instead of playing it.
 */
export function runIntro(host: HTMLElement, light: boolean): () => void {
  const params = new URLSearchParams(window.location.search);
  const freeze = params.has("introT") ? Number(params.get("introT")) : null;
  const scene = createScene();
  const debug = params.has("introDebug");
  const videos = new Map<Slug, HTMLVideoElement>();
  const markReady = expectReady("roster-intro");
  const listeners: Array<() => void> = [];
  let renderer: IntroRenderer | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let raf = 0;
  let t0 = 0;
  let stopped = false;
  let freed = false;
  let pageMeasured = false;

  const api: RosterIntroApi = {
    seek: () => Promise.resolve(),
    play: () => undefined,
    duration: DURATION,
    state: "loading",
  };
  window.__rosterIntro = api;

  const fit = () => {
    if (!renderer) return;
    const level = perfLevel();
    const cap = level === "full" ? 1.25 : level === "balanced" ? 1 : 0.75;
    renderer.resize(
      window.innerWidth,
      window.innerHeight,
      Math.min(window.devicePixelRatio || 1, cap),
    );
    renderer.setView(introView(window.innerWidth, window.innerHeight));
    renderer.setPage(measurePage(window.innerWidth, window.innerHeight));
  };

  /** Free everything the intro holds: the loop, the clips, the textures and the canvas. */
  const free = () => {
    if (freed) return;
    freed = true;
    cancelAnimationFrame(raf);
    for (const off of listeners) off();
    listeners.length = 0;
    for (const v of videos.values()) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
    videos.clear();
    renderer?.dispose();
    renderer = null;
    canvas?.remove();
    canvas = null;
    releaseMedia(CLIPS_DIR);
  };

  /** The intro is over: hand the page over and free everything (after a short fade on a skip). */
  const end = (fade: boolean) => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    setHandOver("done");
    api.state = "ended";
    if (fade && canvas) {
      canvas.style.opacity = "0";
      window.setTimeout(free, SKIP_FADE_MS + 40);
    } else {
      free();
    }
  };

  /** Put the clips where the running scene wants them: play, hold or keep in step. */
  const keepClips = () => {
    if (light) return;
    for (const p of scene.panels) {
      const v = videos.get(p.slug);
      if (!v || v.readyState < 1) continue;
      const want = p.on && p.mix < 0.999 && scene.lineup > 0.05;
      const target = Math.min(Math.max(p.clipT, 0), Math.max(0, v.duration - 0.04));
      if (!want) {
        if (!v.paused) v.pause();
      } else if (p.rate === 0) {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
      } else {
        // The clip runs at the speed the beat asks for, so it stays in step without a seek.
        const rate = Math.min(Math.max(p.rate, 0.0625), 16);
        if (v.playbackRate !== rate) v.playbackRate = rate;
        if (v.paused) {
          v.currentTime = target;
          void v.play().catch(() => undefined);
        } else if (Math.abs(v.currentTime - target) > 0.2) {
          v.currentTime = target;
        }
      }
    }
  };

  /** Put the clips exactly at the scene's picture and wait until they are there. */
  const seekClips = async () => {
    if (light) return;
    const waits: Array<Promise<void>> = [];
    for (const p of scene.panels) {
      const v = videos.get(p.slug);
      if (!v || v.readyState < 1) continue;
      if (!v.paused) v.pause();
      if (p.on && p.mix < 0.999) {
        const target = Math.min(Math.max(p.clipT, 0), Math.max(0, v.duration - 0.04));
        waits.push(seeked(v, target));
      }
    }
    if (waits.length) await Promise.all(waits);
  };

  const loop = (now: number) => {
    if (stopped) return;
    const t = (now - t0) / 1000;
    if (t >= DURATION) {
      end(false);
      return;
    }
    sceneAt(t, scene);
    if (!pageMeasured && t > 3.1) {
      // The page is under the picture now: take its measures for the layers that run over it.
      pageMeasured = true;
      renderer?.setPage(measurePage(window.innerWidth, window.innerHeight));
    }
    const c0 = performance.now();
    keepClips();
    setHandOver(scene.page);
    renderer?.draw(scene);
    if (debug) {
      // Frames whose own work took long (not the browser's): the numbers `?introDebug` collects.
      const took = performance.now() - c0;
      if (took > 4) (api.slow ??= []).push([Math.round(t * 100) / 100, Math.round(took)]);
    }
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (stopped || !renderer) return;
    cancelAnimationFrame(raf);
    for (const v of videos.values()) v.pause();
    api.state = "playing";
    setHandOver("play");
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
  };

  void (async () => {
    await perfReady().catch(() => undefined);
    if (stopped) return;
    const maxWidth = perfLevel() === "lite" ? 1024 : 1280;

    // The pictures: the splash art of the panels, the stills, and the clips when the device can.
    const assets: Assets = { splash: {}, clips: {}, stills: {}, clipInfo: {} };
    const jobs: Array<Promise<void>> = [];
    for (const slug of PANEL_SLUGS) {
      jobs.push(
        loadImage(splashPath(slug), maxWidth).then((img) => {
          if (img) assets.splash[slug] = img;
        }),
      );
      if (!light) {
        const v = makeVideo(slug);
        videos.set(slug, v);
        assets.clips[slug] = v;
        const info = INTRO_CLIPS[slug];
        assets.clipInfo[slug] = { focus: info.focus, aspect: info.width / info.height };
      }
    }
    for (const name of STILL_NAMES) {
      jobs.push(
        loadImage(STILLS[name].path, 2048).then((img) => {
          if (img) assets.stills[name] = img;
        }),
      );
    }
    await Promise.all(jobs);
    if (stopped) return;

    // A clip that has no picture soon is left out: its panel shows the splash art.
    if (!light) {
      await Promise.all(Array.from(videos.values()).map((v) => whenVideoReady(v, CLIP_WAIT_MS)));
      for (const [slug, v] of Array.from(videos)) {
        if (v.readyState < 2) {
          v.removeAttribute("src");
          v.load();
          videos.delete(slug);
          delete assets.clips[slug];
        }
      }
      await Promise.all(Array.from(videos.values()).map(preroll));
    }
    if (stopped) return;

    const cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.dataset.rosterIntroCanvas = "";
    cv.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:45;display:block;" +
      `transition:opacity ${SKIP_FADE_MS}ms linear;touch-action:none;`;
    host.appendChild(cv);
    canvas = cv;
    try {
      renderer = new IntroRenderer(
        cv,
        assets,
        introView(window.innerWidth, window.innerHeight),
        light,
      );
    } catch {
      end(false);
      markReady();
      return;
    }
    renderer.debug = debug;
    renderer.onLost = () => {
      end(false);
    };
    fit();
    // Draw every kind of picture once before the start, so no shader is built in the middle of it.
    for (const t of WARM_TIMES) {
      sceneAt(t, scene);
      renderer.draw(scene);
    }
    renderer.finish();
    sceneAt(0, scene);
    renderer.draw(scene);

    // A click, a tap or Esc skips to the finished page. The click does not reach what is under it.
    const skip = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      end(true);
    };
    cv.addEventListener("pointerdown", skip);
    cv.addEventListener("click", skip);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", fit);
    listeners.push(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    });

    api.seek = async (t: number) => {
      if (stopped || !renderer) return;
      cancelAnimationFrame(raf);
      api.state = "frozen";
      sceneAt(t, scene);
      await seekClips();
      setHandOver(scene.page);
      if (t > 3.1) renderer.setPage(measurePage(window.innerWidth, window.innerHeight));
      renderer.draw(scene);
      await nextFrame();
    };
    api.play = () => {
      pageMeasured = false;
      start();
    };
    api.state = "ready";
    markReady();

    if (freeze !== null && Number.isFinite(freeze)) {
      await api.seek(freeze);
    } else {
      await whenCurtainOpen(() => stopped);
      start();
    }
  })();

  return () => {
    stopped = true;
    markReady();
    setHandOver("done");
    free();
    if (window.__rosterIntro === api) delete window.__rosterIntro;
  };
}
