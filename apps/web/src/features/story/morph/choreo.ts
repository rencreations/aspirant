/**
 * The four chapter morphs, played with the Web Animations API on the layer of `overlay.tsx`:
 *
 * - forward: the card at the foot of a chapter opens into the next chapter's title card.
 * - end: the card after the last chapter opens into the end page's heading.
 * - back (the pull up at the top): the title card closes into the card of the chapter before,
 *   which is at the foot of that chapter (the forward morph played backwards, mirrored easing).
 * - blind (the Before link): the title card of the chapter before unrolls from the top.
 *
 * Every animation is a transform or an opacity with two keyframes and one easing (see
 * `morph-math.ts`), so the compositor plays the whole morph. The layer always starts as an exact
 * copy of what is on screen and ends as an exact copy of what the new page shows under it.
 */
import type { Route } from "next";

import type { SmoothScrollApi } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { REVEAL_EVENT } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";
import { useNavLock } from "@/lib/nav-lock";
import { whenPageReady } from "@/lib/page-ready";

import { whenDoor } from "./doors";
import type { MorphJob } from "./morph-store";
import {
  crossing,
  cubicBezier,
  place,
  stageFit,
  timeAt,
  windowFrames,
  wordFlip,
  type Box,
  type Placement,
  type Rect,
} from "./morph-math";

/** The elements of the morph layer. */
export interface Parts {
  readonly root: HTMLElement;
  readonly scrim: HTMLElement;
  readonly glow: HTMLElement;
  readonly outer: HTMLElement;
  readonly inner: HTMLElement;
  readonly counter: HTMLElement;
  readonly content: HTMLElement;
  readonly poster: HTMLImageElement | null;
  readonly canvas: HTMLCanvasElement | null;
  readonly video: HTMLVideoElement | null;
  readonly sealed: HTMLImageElement | null;
  /** The end page: the reader's background, coming over the chapter's color. */
  readonly fill: HTMLElement | null;
  /** The card's own shade, stretched with the window. */
  readonly shade: HTMLElement | null;
  /** The copy of the title card's text (or of the end page's heading). */
  readonly text: HTMLElement;
  /** The end page: the same heading in white, which hands over to `text`. */
  readonly light: HTMLElement | null;
  readonly clones: HTMLElement;
  readonly edge: HTMLElement | null;
  readonly edgeShade: HTMLElement | null;
}

export interface Env {
  /** The plain client navigation (no scroll). */
  readonly push: (href: Route) => void;
  readonly lenis: SmoothScrollApi;
  /** Resolves when the address is `target`; rejects after `ms`. */
  readonly waitPath: (target: string, ms: number) => Promise<void>;
  /** Becomes true when the morph must stop (the layer went away). */
  readonly aborted: () => boolean;
}

/** What is left to do after the layer is gone (start the new title card's loop). */
export type After = () => void;

// Timing ------------------------------------------------------------------------------------

/** The forward window: a short wind-up, a fast middle and a long settle. */
const OPEN = cubicBezier(0.62, 0, 0.16, 1);
const OPEN_MS = 1150;
/** The way back is the same move played backwards, so its easing is the mirror. */
const CLOSE = cubicBezier(1 - 0.16, 0, 1 - 0.62, 1);
const CLOSE_MS = 1150;
/** The blind. */
const BLIND = cubicBezier(0.66, 0, 0.24, 1);
const BLIND_MS = 920;
const SETTLE = cubicBezier(0.16, 1, 0.3, 1);
const SETTLE_MS = 1180;
const SOFT = "cubic-bezier(0.33, 1, 0.68, 1)";

/** A morph that has handed the page over waits this long at most for the new page's address. */
const ROUTE_MS = 10_000;

// Small helpers -----------------------------------------------------------------------------

const noop = () => undefined;

function frames(n = 1): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** The rectangle of an element's text (its glyphs), transforms included. */
function glyphs(el: Element): Rect {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function fontSize(el: Element): number {
  return Number.parseFloat(getComputedStyle(el).fontSize) || 16;
}

/** The event, or false after `ms` (or at once for a video that cannot play: it shows its still). */
function once(el: EventTarget, type: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (el instanceof HTMLMediaElement && el.error) {
      resolve(false);
      return;
    }
    const end = (value: boolean) => {
      window.clearTimeout(timer);
      el.removeEventListener(type, ok);
      el.removeEventListener("error", fail);
      resolve(value);
    };
    const ok = () => end(true);
    const fail = () => end(false);
    const timer = window.setTimeout(fail, ms);
    el.addEventListener(type, ok, { once: true });
    if (el instanceof HTMLMediaElement) el.addEventListener("error", fail, { once: true });
  });
}

/** A picture drawn, or given up on after `ms` (it then shows when it can). */
function decoded(img: HTMLImageElement | null | undefined, ms = 6000): Promise<unknown> {
  if (!img) return Promise.resolve();
  return Promise.race([img.decode().catch(noop), new Promise((r) => window.setTimeout(r, ms))]);
}

function navHeight(): number {
  return document.querySelector<HTMLElement>('header[data-overlay="nav"]')?.offsetHeight ?? 64;
}

function full(): Box {
  const d = document.documentElement;
  return { w: d.clientWidth, h: d.clientHeight };
}

/** Stop the smooth scroll where it is, so nothing moves under the first frame. */
function stopMomentum(lenis: SmoothScrollApi): void {
  const l = lenis.getLenis();
  if (l) l.scrollTo(l.animatedScroll, { immediate: true, force: true });
}

/** A video shows a frame (not its still): it has data and has played or been moved. */
function showsFrame(v: HTMLVideoElement | null | undefined): v is HTMLVideoElement {
  return !!v && v.readyState >= 2 && (v.played.length > 0 || v.currentTime > 0);
}

function wordsOf(root: ParentNode, part: string, attr = "data-m"): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}="${part}"] [data-w]`));
}

// The probe hook (the frame sheets of `scripts/qa/probes`): hold a morph and seek it. -----------

interface Probe {
  /** Set before a morph starts: it holds at its first frame until `release()`. */
  freeze: boolean;
  /** Set before a morph starts: it holds once the new page is under it, until `release()`. */
  holdEnd?: boolean;
  /** "idle", "held" or "playing". */
  phase: string;
  /** How long the held part lasts, in ms. */
  duration: number;
  seek: (ms: number) => void;
  release: () => void;
}

declare global {
  interface Window {
    __chapterMorph?: Probe;
  }
}

function probe(): Probe {
  window.__chapterMorph ??= {
    freeze: false,
    phase: "idle",
    duration: 0,
    seek: noop,
    release: noop,
  };
  return window.__chapterMorph;
}

/** The animations of one part of a morph, started together. */
export class Timeline {
  readonly list: Animation[] = [];
  /** Page elements this morph animates (the reader's bar, the row under the card). */
  readonly page: Animation[] = [];

  add(el: Element | null, keyframes: Keyframe[], timing: KeyframeAnimationOptions): void {
    if (!el) return;
    const a = el.animate(keyframes, { fill: "both", ...timing });
    a.pause();
    this.list.push(a);
  }

  addPage(el: Element | null, keyframes: Keyframe[], timing: KeyframeAnimationOptions): void {
    if (!el) return;
    const a = el.animate(keyframes, { fill: "both", ...timing });
    a.pause();
    this.page.push(a);
  }

  /** The end of the longest animation. */
  get duration(): number {
    return Math.max(
      0,
      ...[...this.list, ...this.page].map((a) => {
        const t = a.effect?.getComputedTiming();
        return Number(t?.endTime ?? 0);
      }),
    );
  }

  /** Play everything from the start (or hold at 0 for the probe). */
  async play(): Promise<void> {
    const all = [...this.list, ...this.page];
    const p = probe();
    if (p.freeze) {
      p.phase = "held";
      p.duration = this.duration;
      await new Promise<void>((resolve) => {
        p.seek = (ms) => {
          for (const a of all) a.currentTime = ms;
        };
        p.release = () => {
          p.seek = noop;
          p.release = noop;
          resolve();
        };
      });
    }
    p.phase = "playing";
    for (const a of all) a.play();
  }

  finished(): Promise<unknown> {
    return Promise.all([...this.list, ...this.page].map((a) => a.finished.catch(noop)));
  }

  /** Let go of the page's animations (the page keeps its own look). */
  releasePage(): void {
    for (const a of this.page) a.cancel();
  }

  cancel(): void {
    for (const a of [...this.list, ...this.page]) a.cancel();
  }
}

/** The probe can look at the last frame of the layer over the new page, then let it go. */
export async function holdLanding(): Promise<void> {
  const p = probe();
  if (!p.holdEnd) return;
  p.phase = "landing";
  await new Promise<void>((resolve) => {
    p.release = () => {
      p.release = noop;
      resolve();
    };
  });
}

/** The probe is holding a morph on purpose (the watchdog leaves it alone). */
export function probeHolds(): boolean {
  const p = window.__chapterMorph;
  return !!p && (p.freeze || !!p.holdEnd);
}

export function resetProbe(): void {
  const p = probe();
  p.phase = "idle";
  p.seek = noop;
  p.release = noop;
}

// Media ----------------------------------------------------------------------------------------

/**
 * Show what `source` shows now (a frame of a playing loop, or its still), then bring in the
 * layer's own copy of the loop at the same moment. The still is drawn on a canvas at once, so the
 * first frame never waits for the copy to seek.
 */
async function copyMedia(parts: Parts, src: string | null, source: HTMLVideoElement | null) {
  await decoded(parts.poster);
  await decoded(parts.sealed);
  const video = parts.video;
  if (!video || !src) return;
  const canvas = parts.canvas;
  if (canvas && showsFrame(source)) {
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    try {
      canvas.getContext("2d")?.drawImage(source, 0, 0);
      canvas.style.opacity = "1";
    } catch {
      // A picture that cannot be read leaves the still.
    }
  }
  video.muted = true;
  video.defaultMuted = true;
  video.src = mediaUrl(`/${src}`);
  const at = showsFrame(source) ? source.currentTime : 0;
  void (async () => {
    if (video.readyState < 1 && !(await once(video, "loadedmetadata", 4000))) return;
    if (at > 0) {
      video.currentTime = at;
      await once(video, "seeked", 2000);
    } else if (video.readyState < 2) {
      await once(video, "loadeddata", 2000);
    }
    try {
      await video.play();
    } catch {
      return;
    }
    // The copy is moving: bring it over the still.
    video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "forwards" });
  })();
}

/** The layer's loop is on screen (it has come over the still). */
function liveCopy(v: HTMLVideoElement | null): v is HTMLVideoElement {
  return !!v && !v.paused && v.readyState >= 2;
}

/**
 * Put `to` at the moment `from` shows and hold both still, so the swap is not seen. Resolves
 * when `to` has the frame (or could not get it).
 */
async function align(from: HTMLVideoElement, to: HTMLVideoElement): Promise<void> {
  from.pause();
  to.pause();
  if (to.readyState < 1 && !(await once(to, "loadedmetadata", 1500))) return;
  const t = from.currentTime;
  if (Math.abs(to.currentTime - t) > 0.015) {
    to.currentTime = t;
    await once(to, "seeked", 1500);
  }
  await frames(2);
}

// The text ------------------------------------------------------------------------------------

interface Flip {
  readonly el: HTMLElement;
  readonly flip: Placement;
}

/** For each word of `copy`, the transform that puts it over the same word of `card`. */
function flips(card: HTMLElement[], copy: HTMLElement[]): Flip[] | null {
  if (!card.length || card.length !== copy.length) return null;
  return copy.map((el, i) => {
    const from = card[i]!;
    const box = el.getBoundingClientRect();
    return {
      el,
      flip: wordFlip(
        glyphs(from),
        glyphs(el),
        { x: box.left, y: box.top },
        fontSize(from) / fontSize(el),
      ),
    };
  });
}

/** The words go up the screen (from the first set to the second). */
function rising(from: HTMLElement[], to: HTMLElement[]): boolean {
  const a = from[0];
  const b = to[0];
  return !!a && !!b && b.getBoundingClientRect().top < a.getBoundingClientRect().top;
}

/**
 * When each line of the card sets off. The title leads, the label and the time line follow; on a
 * way up the label (which sits above the title) goes first, so a line never runs into the next.
 */
function wordOrder(up: boolean, gap: number) {
  return [
    { part: "title", delay: up ? gap * 0.6 : 0, step: 12 },
    { part: "label", delay: up ? 0 : gap, step: 0 },
    { part: "date", delay: up ? gap * 1.4 : gap * 1.8, step: 10 },
  ];
}

/** A copy of a card element in the layer, where the element is now. */
function cloneAt(parts: Parts, el: Element | null): HTMLElement | null {
  if (!el) return null;
  const r = rectOf(el);
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-door");
  copy.style.left = `${r.x}px`;
  copy.style.top = `${r.y}px`;
  copy.style.width = `${r.w}px`;
  parts.clones.append(copy);
  return copy;
}

// The page under the layer ----------------------------------------------------------------------

/** The new page is up: put it at its top, tell it, focus its heading, match its picture. */
async function landOnTop(parts: Parts, env: Env, keyboard: boolean): Promise<After> {
  env.lenis.scrollTo(0, { immediate: true });
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event(REVEAL_EVENT));
  // The title card is on screen now: its loop's own autoplay answers first, then it is matched.
  await frames(2);
  const main = document.getElementById("main");
  const heading = main?.querySelector<HTMLElement>("h1[tabindex]");
  // The ring shows for a move made from the keyboard only (a press or a pull leaves none).
  (heading ?? main)?.focus({ preventScroll: true, focusVisible: keyboard });
  const card = main?.querySelector<HTMLElement>("[data-card]");
  let after: After = noop;
  if (card) {
    await decoded(card.querySelector<HTMLImageElement>("img"));
    const real = card.querySelector<HTMLVideoElement>("video");
    if (real && liveCopy(parts.video)) {
      await align(parts.video, real);
      after = () => void real.play().catch(noop);
    } else if (real && real.readyState < 2 && real.poster) {
      // No loop (a browser that cannot play it): its still is what shows.
      const still = new Image();
      still.src = real.poster;
      await decoded(still);
    }
    // The title card's slow push starts now, from where the layer left it (at rest), and its
    // scroll cue keeps the beat of the layer's.
    const cue = parts.text
      .getAnimations({ subtree: true })
      .find((a) => ((a as CSSAnimation).animationName ?? "").endsWith("cue"));
    for (const a of card.getAnimations({ subtree: true })) {
      const name = (a as CSSAnimation).animationName ?? "";
      if (name.includes("card-push")) a.currentTime = 0;
      else if (cue && name.endsWith("cue")) a.currentTime = cue.currentTime;
    }
  }
  await frames(2);
  return after;
}

function setBare(bare: boolean): void {
  useNavLock.setState({ bare });
}

/** Call `fn` when `ms` of the played timeline have passed (not while the probe holds it). */
function at(ms: number, fn: () => void, env: Env): void {
  const start = performance.now();
  const step = () => {
    if (env.aborted()) return;
    if (probe().phase === "held") {
      requestAnimationFrame(step);
      return;
    }
    if (performance.now() - start >= ms) fn();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function check(env: Env): void {
  if (env.aborted()) throw new Error("morph stopped");
}

// The forward morphs ----------------------------------------------------------------------------

/** The card opens into the next title card (or into the end page's heading). */
export async function runForward(
  job: Extract<MorphJob, { kind: "forward" | "end" }>,
  parts: Parts,
  env: Env,
  tl: Timeline,
): Promise<After> {
  const box = full();
  const door = job.door;
  stopMomentum(env.lenis);
  await frames(1);
  check(env);

  // What the card shows now, hover and pull included.
  const win = rectOf(door);
  const doorMedia = door.querySelector<HTMLElement>('[data-door="media"]');
  const stageH = (parts.content.firstElementChild as HTMLElement | null)?.offsetHeight ?? box.h;
  let from: Placement;
  if (doorMedia) {
    const m = rectOf(doorMedia);
    from = { x: m.x, y: m.y, s: m.w / box.w };
  } else {
    const fit = stageFit(win, { w: box.w, h: stageH }, { x: 0.5, y: 0.5 });
    from = { x: win.x + fit.x, y: win.y + fit.y, s: fit.s };
  }
  const doorVideo = door.querySelector<HTMLVideoElement>("video");
  const first = job.kind === "forward" ? job.entry.first[0] : undefined;
  await copyMedia(parts, first?.kind === "clip" ? first.src : null, doorVideo);
  check(env);

  // The window and the picture.
  const screen: Rect = { x: 0, y: 0, w: box.w, h: box.h };
  const f = windowFrames(win, from, screen, { x: 0, y: 0, s: 1 }, box);
  const open = { duration: OPEN_MS, easing: OPEN.css };
  tl.add(parts.outer, [{ transform: f.outer[0] }, { transform: f.outer[1] }], open);
  tl.add(parts.inner, [{ transform: f.inner[0] }, { transform: f.inner[1] }], open);
  tl.add(parts.counter, [{ transform: f.counter[0] }, { transform: f.counter[1] }], open);
  tl.add(parts.content, [{ transform: f.content[0] }, { transform: f.content[1] }], open);
  const doorShade = door.querySelector<HTMLElement>('[data-door="shade"]');
  if (parts.shade) {
    parts.shade.style.width = `${win.w}px`;
    parts.shade.style.height = `${win.h}px`;
    const o = doorShade ? Number(getComputedStyle(doorShade).opacity) : 1;
    tl.add(
      parts.shade,
      [
        { transform: f.shade[0], opacity: o },
        { opacity: 0, offset: 0.55 },
        { transform: f.shade[1], opacity: 0 },
      ],
      open,
    );
  }
  if (parts.sealed) {
    tl.add(parts.sealed, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 640,
      delay: 220,
      easing: "ease-in-out",
    });
  }
  if (parts.fill) {
    tl.add(parts.fill, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 560,
      delay: 520,
      easing: "ease-in-out",
    });
  }

  // The world behind lets go: a scrim, a bloom of the chapter's color, the page's own bars.
  tl.add(parts.scrim, [{ opacity: 0 }, { opacity: 0.62 }], { duration: 720, easing: SOFT });
  const g = Math.max(box.w, box.h) * 1.1;
  parts.glow.style.width = `${g}px`;
  parts.glow.style.height = `${g}px`;
  const cx = win.x + win.w / 2 - g / 2;
  const cy = win.y + win.h / 2 - g / 2;
  tl.add(
    parts.glow,
    [
      { transform: `translate(${cx}px, ${cy}px) scale(0.45)`, opacity: 0 },
      { opacity: 0.5, offset: 0.32 },
      {
        transform: `translate(${box.w / 2 - g / 2}px, ${box.h / 2 - g / 2}px) scale(1.3)`,
        opacity: 0,
      },
    ],
    { duration: 1100, easing: SOFT },
  );
  const fade = { duration: 240, easing: "ease-out" };
  tl.addPage(document.querySelector("[data-minibar]"), [{ opacity: 1 }, { opacity: 0 }], fade);
  tl.addPage(
    door.parentElement?.querySelector("[data-end-row]") ?? null,
    [{ opacity: 1 }, { opacity: 0 }],
    fade,
  );
  for (const el of document.querySelectorAll("[data-pull]")) {
    tl.addPage(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], fade);
  }

  // The words: each one from its place in the card to its place in the title card.
  const layers = [parts.text, parts.light].filter((l): l is HTMLElement => !!l);
  const groups = wordOrder(
    rising(wordsOf(door, "title", "data-door"), wordsOf(parts.text, "title")),
    60,
  ).filter((group) => job.kind === "forward" || group.part !== "date");
  for (const group of groups) {
    const card = wordsOf(door, group.part, "data-door");
    const main = flips(card, wordsOf(parts.text, group.part));
    for (const layer of layers) {
      const copy = wordsOf(layer, group.part);
      if (main) {
        copy.forEach((el, i) => {
          const flip = main[i]?.flip;
          if (!flip) return;
          tl.add(el, [{ transform: place(flip) }, { transform: "none" }], {
            duration: OPEN_MS - 40,
            delay: group.delay + i * group.step,
            easing: OPEN.css,
          });
        });
      } else {
        // The words do not match (they should): the copy comes in where it ends.
        for (const el of copy)
          tl.add(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 760 });
      }
    }
    if (!main) {
      const ghost = cloneAt(parts, door.querySelector(`[data-door="${group.part}"]`));
      tl.add(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
    }
  }
  // "Next" (and on the last card, the line under the title) goes in the first quarter.
  const next = cloneAt(parts, door.querySelector('[data-door="next"]'));
  tl.add(
    next,
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "translateY(-0.4rem)" },
    ],
    { duration: 280, easing: "ease-out" },
  );
  if (job.kind === "end") {
    const line = cloneAt(parts, door.querySelector('[data-door="date"]'));
    tl.add(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out" });
  }
  // The lines only the title card has rise in during the last third.
  const late = { duration: 460, easing: SETTLE.css };
  ["act", "slash", "mood", "cue"].forEach((part, i) => {
    for (const layer of layers) {
      tl.add(
        layer.querySelector(`[data-m="${part}"]`),
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "none" },
        ],
        { ...late, delay: 780 + i * 50 },
      );
    }
  });
  if (parts.light) {
    // The end page: white words on the chapter's color turn into the page's own ink.
    tl.add(parts.light, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 560 });
    tl.add(parts.text, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 560 });
  }

  // Swap: the layer is drawn over the card, identical, then the card goes.
  parts.root.style.visibility = "visible";
  await frames(2);
  check(env);
  door.style.visibility = "hidden";
  doorVideo?.pause();
  audio.blip("whoosh");

  // The bar loses its background when the window reaches it (a title card has none).
  if (job.kind === "forward") {
    const e = crossing(win.y, 0, navHeight());
    at(timeAt(OPEN, e) * OPEN_MS, () => setBare(true), env);
  }
  at(OPEN_MS - 120, () => audio.blip("star"), env);

  await tl.play();
  check(env);
  // The window is full: the next page comes under it.
  await Promise.all(tl.list.slice(0, 4).map((a) => a.finished));
  check(env);
  env.push(job.href);
  await env.waitPath(pathOf(job.href), ROUTE_MS);
  await tl.finished();
  await whenPageReady();
  await frames(1);
  check(env);
  const after = await landOnTop(parts, env, job.keyboard);
  if (job.kind === "end") {
    // The end page has more than its heading: the rest of it comes in as the layer goes.
    await parts.root
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 380,
        easing: "ease-out",
        fill: "forwards",
      })
      .finished.catch(noop);
  }
  return after;
}

// The way back from the top ---------------------------------------------------------------------

/** This chapter's title card closes into its card at the foot of the chapter before. */
export async function runBack(
  job: Extract<MorphJob, { kind: "back" }>,
  parts: Parts,
  env: Env,
  tl: Timeline,
): Promise<After> {
  const box = full();
  stopMomentum(env.lenis);
  await frames(1);
  check(env);

  // A copy of the title card as it is now (its slow push included).
  const card = document.querySelector<HTMLElement>("main [data-card]");
  const realMedia = card?.querySelector<HTMLElement>("video, img");
  const m = realMedia ? rectOf(realMedia) : { x: 0, y: 0, w: box.w, h: box.h };
  const now: Placement = { x: m.x, y: m.y, s: m.w / box.w };
  parts.content.style.transform = place(now);
  const realVideo = card?.querySelector<HTMLVideoElement>("video") ?? null;
  const first = job.entry.first[0];
  await copyMedia(parts, first?.kind === "clip" ? first.src : null, realVideo);
  const realCue = card
    ?.getAnimations({ subtree: true })
    .find((a) => ((a as CSSAnimation).animationName ?? "").endsWith("cue"));
  if (realCue) {
    for (const a of parts.text.getAnimations({ subtree: true }))
      if (((a as CSSAnimation).animationName ?? "").endsWith("cue"))
        a.currentTime = realCue.currentTime;
  }
  check(env);
  parts.root.style.visibility = "visible";
  await frames(2);
  check(env);
  realVideo?.pause();
  audio.blip("whoosh");

  // The chapter before, at its end, under the layer.
  env.push(job.href);
  await env.waitPath(pathOf(job.href), ROUTE_MS);
  await whenPageReady();
  check(env);
  const door = await whenDoor(job.entry.id);
  check(env);
  if (!door) throw new Error("no card");
  await center(door.el, env);
  check(env);
  setBare(true);

  // The loop of the card waits at the layer's moment, so the two are one when the layer goes.
  const doorVideo = door.el.querySelector<HTMLVideoElement>("video");
  let after: After = noop;
  if (doorVideo && liveCopy(parts.video)) {
    if (!doorVideo.currentSrc) await once(doorVideo, "loadedmetadata", 1500);
    await align(parts.video, doorVideo);
    void parts.video.play().catch(noop);
    void doorVideo.play().catch(noop);
  } else if (doorVideo) {
    after = () => void doorVideo.play().catch(noop);
  }
  check(env);

  // Measure the card and close the window into it.
  const win = rectOf(door.el);
  const doorMedia = door.el.querySelector<HTMLElement>('[data-door="media"]');
  const dm = doorMedia ? rectOf(doorMedia) : win;
  const to: Placement = { x: dm.x, y: dm.y, s: dm.w / box.w };
  const screen: Rect = { x: 0, y: 0, w: box.w, h: box.h };
  const f = windowFrames(screen, now, win, to, box, { w: win.w, h: win.h });
  const close = { duration: CLOSE_MS, easing: CLOSE.css };
  tl.add(parts.outer, [{ transform: f.outer[0] }, { transform: f.outer[1] }], close);
  tl.add(parts.inner, [{ transform: f.inner[0] }, { transform: f.inner[1] }], close);
  tl.add(parts.counter, [{ transform: f.counter[0] }, { transform: f.counter[1] }], close);
  tl.add(parts.content, [{ transform: f.content[0] }, { transform: f.content[1] }], close);
  if (parts.shade) {
    parts.shade.style.width = `${win.w}px`;
    parts.shade.style.height = `${win.h}px`;
    tl.add(
      parts.shade,
      [
        { transform: f.shade[0], opacity: 0 },
        { opacity: 0, offset: 0.45 },
        { transform: f.shade[1], opacity: 1 },
      ],
      close,
    );
  }
  tl.add(parts.scrim, [{ opacity: 0.62 }, { opacity: 0.62, offset: 0.25 }, { opacity: 0 }], close);
  const g = Math.max(box.w, box.h) * 1.1;
  parts.glow.style.width = `${g}px`;
  parts.glow.style.height = `${g}px`;
  tl.add(
    parts.glow,
    [
      {
        transform: `translate(${box.w / 2 - g / 2}px, ${box.h / 2 - g / 2}px) scale(1.2)`,
        opacity: 0,
      },
      { opacity: 0, offset: 0.5 },
      { opacity: 0.42, offset: 0.78 },
      {
        transform: `translate(${win.x + win.w / 2 - g / 2}px, ${win.y + win.h / 2 - g / 2}px) scale(0.5)`,
        opacity: 0,
      },
    ],
    close,
  );
  const comeBack = { duration: 420, delay: CLOSE_MS - 420, easing: "ease-out" };
  tl.addPage(document.querySelector("[data-minibar]"), [{ opacity: 0 }, { opacity: 1 }], comeBack);
  tl.addPage(
    door.el.parentElement?.querySelector("[data-end-row]") ?? null,
    [{ opacity: 0 }, { opacity: 1 }],
    comeBack,
  );

  // The words go back into the card; the title still leads.
  const groups = wordOrder(
    rising(wordsOf(parts.text, "title"), wordsOf(door.el, "title", "data-door")),
    50,
  );
  for (const group of groups) {
    const cardWords = wordsOf(door.el, group.part, "data-door");
    const copy = wordsOf(parts.text, group.part);
    const main = flips(cardWords, copy);
    if (main) {
      main.forEach(({ el, flip }, i) => {
        tl.add(el, [{ transform: "none" }, { transform: place(flip) }], {
          duration: CLOSE_MS - 40,
          delay: group.delay + i * group.step,
          easing: CLOSE.css,
        });
      });
    } else {
      for (const el of copy) tl.add(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    }
  }
  ["act", "slash", "mood", "cue"].forEach((part, i) => {
    tl.add(
      parts.text.querySelector(`[data-m="${part}"]`),
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(10px)" },
      ],
      { duration: 300, delay: i * 30, easing: "ease-in" },
    );
  });
  // "Next" comes back on the card in the last third.
  const realNext = door.el.querySelector<HTMLElement>('[data-door="next"]');
  const next = cloneAt(parts, realNext);
  if (realNext) realNext.style.visibility = "hidden";
  tl.add(
    next,
    [
      { opacity: 0, transform: "translateY(-0.4rem)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 380, delay: CLOSE_MS - 380, easing: "ease-out" },
  );

  // The bar gets its background back when the window has left it.
  const e = crossing(0, win.y, navHeight());
  at(timeAt(CLOSE, e) * CLOSE_MS, () => setBare(false), env);
  at(CLOSE_MS - 150, () => audio.blip("star"), env);

  await tl.play();
  await tl.finished();
  check(env);
  if (realNext) realNext.style.visibility = "";
  document.getElementById("main")?.focus({ preventScroll: true, focusVisible: false });
  return after;
}

/** Scroll so `el` sits in the middle of the screen, and wait until it holds still. */
async function center(el: HTMLElement, env: Env): Promise<void> {
  const put = () => {
    const r = el.getBoundingClientRect();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = Math.max(
      0,
      Math.min(max, window.scrollY + r.top - (window.innerHeight - r.height) / 2),
    );
    env.lenis.scrollTo(y, { immediate: true });
    window.scrollTo(0, y);
  };
  put();
  let last = Number.NaN;
  let still = 0;
  for (let i = 0; i < 90 && still < 2; i += 1) {
    await frames(1);
    const top = el.getBoundingClientRect().top;
    if (Math.abs(top - last) < 0.5) still += 1;
    else {
      still = 0;
      if (i > 0) put();
    }
    last = top;
  }
  // The pictures on screen are drawn before the layer lets them be seen.
  const shown = Array.from(document.querySelectorAll<HTMLImageElement>("main img")).filter(
    (img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
    },
  );
  await Promise.all(shown.map((img) => decoded(img)));
  await frames(1);
}

// The Before link -----------------------------------------------------------------------------

/** The title card of the chapter before unrolls from the top, over the page that drops away. */
export async function runBlind(
  job: Extract<MorphJob, { kind: "blind" }>,
  parts: Parts,
  env: Env,
  tl: Timeline,
): Promise<After> {
  const box = full();
  stopMomentum(env.lenis);
  const first = job.entry.first[0];
  // The loop starts at its beginning, playing, before the blind moves.
  await copyMedia(parts, first?.kind === "clip" ? first.src : null, null);
  if (parts.video && parts.video.readyState < 2) await once(parts.video, "loadeddata", 1500);
  check(env);
  const stageH = (parts.content.firstElementChild as HTMLElement | null)?.offsetHeight ?? box.h;
  // Where the title sits in the copy (before anything moves it).
  const title = parts.text.querySelector<HTMLElement>('[data-m="title"]');
  const titleBottom = title ? title.getBoundingClientRect().bottom : box.h * 0.7;

  const top: Rect = { x: 0, y: 0, w: box.w, h: 0 };
  const screen: Rect = { x: 0, y: 0, w: box.w, h: box.h };
  const zoom = 1.12;
  const big: Placement = { x: (box.w * (1 - zoom)) / 2, y: (stageH * (1 - zoom)) / 2, s: zoom };
  const f = windowFrames(top, big, screen, { x: 0, y: 0, s: 1 }, box);
  const roll = { duration: BLIND_MS, easing: BLIND.css };
  tl.add(parts.inner, [{ transform: f.inner[0] }, { transform: f.inner[1] }], roll);
  tl.add(parts.counter, [{ transform: f.counter[0] }, { transform: f.counter[1] }], roll);
  tl.add(parts.content, [{ transform: f.content[0] }, { transform: f.content[1] }], {
    duration: SETTLE_MS,
    easing: SETTLE.css,
  });
  tl.add(parts.edge, [{ opacity: 1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], roll);
  tl.add(
    parts.edgeShade,
    [
      { transform: "translateY(0px)", opacity: 0 },
      { opacity: 1, offset: 0.1 },
      { opacity: 1, offset: 0.78 },
      { transform: `translateY(${box.h}px)`, opacity: 0 },
    ],
    roll,
  );
  // The page under it drops away a little and darkens.
  tl.add(parts.scrim, [{ opacity: 0 }, { opacity: 0.72 }], roll);
  tl.addPage(
    document.querySelector("main [data-reader]"),
    [{ transform: "none" }, { transform: `translateY(${Math.round(box.h * 0.03)}px)` }],
    roll,
  );
  tl.addPage(document.querySelector("[data-minibar]"), [{ opacity: 1 }, { opacity: 0 }], {
    duration: 260,
  });

  // The words rise into place as the blind passes them.
  const reach = timeAt(BLIND, crossing(0, box.h, titleBottom)) * BLIND_MS;
  const rise = (el: Element | null, delay: number, lift: number) =>
    tl.add(
      el,
      [
        { opacity: 0, transform: `translateY(${lift}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: 640, delay, easing: SETTLE.css },
    );
  const words = wordsOf(parts.text, "title");
  const lift = title ? fontSize(title) * 0.55 : 40;
  words.forEach((el, i) => rise(el, Math.max(0, reach - 220) + i * 45, lift));
  ["act", "slash", "label"].forEach((part) =>
    rise(parts.text.querySelector(`[data-m="${part}"]`), reach - 260, 10),
  );
  rise(parts.text.querySelector('[data-m="date"]'), reach - 40 + words.length * 45, 12);
  rise(parts.text.querySelector('[data-m="mood"]'), reach + 60 + words.length * 45, 12);
  rise(parts.text.querySelector('[data-m="cue"]'), reach + 160 + words.length * 45, 12);

  parts.root.style.visibility = "visible";
  await frames(1);
  check(env);
  audio.blip("whoosh");
  at(timeAt(BLIND, crossing(0, box.h, navHeight())) * BLIND_MS, () => setBare(true), env);
  at(BLIND_MS, () => audio.blip("star"), env);
  await tl.play();
  check(env);
  await Promise.all(tl.list.slice(0, 2).map((a) => a.finished));
  check(env);
  env.push(job.href);
  await env.waitPath(pathOf(job.href), ROUTE_MS);
  await tl.finished();
  await whenPageReady();
  await frames(1);
  check(env);
  return landOnTop(parts, env, job.keyboard);
}

/** Give the card back its look (a morph that stopped before the page changed). */
export function showAgain(el: HTMLElement | null): void {
  if (el) el.style.visibility = "";
}

export function pathOf(href: string): string {
  return (href.split(/[?#]/u)[0] ?? "/").replace(/\/+$/u, "") || "/";
}

/** Hold the scroll while a morph runs (wheel, touch and the scrolling keys do nothing). */
export function holdScroll(): () => Promise<void> {
  const keys = new Set([" ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"]);
  let lastWheel = 0;
  const stop = (e: Event) => {
    if (e.type === "wheel") lastWheel = performance.now();
    if (e instanceof KeyboardEvent && !keys.has(e.key)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const opts = { capture: true, passive: false } as const;
  window.addEventListener("wheel", stop, opts);
  window.addEventListener("touchmove", stop, opts);
  window.addEventListener("keydown", stop, opts);
  return async () => {
    // The momentum of the wheel that started the morph runs out first (a quiet 150 ms, or 1.2 s).
    const until = performance.now() + 1200;
    while (performance.now() - lastWheel < 150 && performance.now() < until) await frames(1);
    window.removeEventListener("wheel", stop, opts);
    window.removeEventListener("touchmove", stop, opts);
    window.removeEventListener("keydown", stop, opts);
  };
}
