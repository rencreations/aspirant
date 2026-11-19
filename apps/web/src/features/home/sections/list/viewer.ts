/**
 * The open view of a frame of the list (the owner's request: a click reveals the rest of the
 * picture or video with empty space on the sides, and a back or close button). A plain class that
 * builds its own dialog on the body, so no transformed ancestor can break its fixed position.
 *
 * Opening: the window `F` (the frame as it stands) grows to `T` (the whole picture, contained in
 * the screen with margins) while the picture inside goes from the frame's crop to its whole,
 * through the chapter morph's nested clips: transform and opacity only, two keyframes, one easing.
 * Closing is the same in reverse. Escape, a press on the margin and the button close it; the
 * focus goes to the button on open and back to the frame's button on close; Tab stays inside.
 */
import { loadMedia, mediaUrl } from "@/lib/media-store";
import { libUrl } from "@/lib/library";
import { asset } from "@/lib/asset";

import {
  cubicBezier,
  windowFrames,
  type Rect as MorphRect,
} from "@/features/story/morph/morph-math";

import type { PictureFrame } from "./frames";
import { containIn, pictureSize, placements } from "./layout";
import styles from "./viewer.module.css";

const EASE = cubicBezier(0.645, 0.045, 0.355, 1);
const DURATION = 720;

export interface ViewerHost {
  /** Hold the page still while the view is open. Returns the release. */
  hold(): () => void;
  /** The frame's window, in CSS pixels, now. */
  frameRect(): MorphRect;
}

const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';

export class PictureViewer {
  private root: HTMLElement | null = null;
  private opener: HTMLElement | null = null;
  private release: (() => void) | null = null;
  private animations: Animation[] = [];
  private layers: HTMLElement[] = [];
  private fades: HTMLElement[] = [];
  private closing = false;
  private disposed = false;
  private frame: PictureFrame | null = null;
  private video: HTMLVideoElement | null = null;

  constructor(private readonly host: ViewerHost) {}

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** `from` is a playing copy of the frame's loop, if there is one: its time is carried over. */
  open(frame: PictureFrame, opener: HTMLElement, from?: HTMLVideoElement | null): void {
    if (this.root || this.disposed) return;
    this.frame = frame;
    this.opener = opener;
    this.closing = false;
    this.release = this.host.hold();

    const vw = window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const pic = pictureSize(frame);
    const margin = Math.max(24, 0.09 * Math.min(vw, vh));
    const T = containIn({ x: 0, y: 0, w: vw, h: vh }, pic.w / pic.h, margin);
    const F = this.host.frameRect();

    const root = document.createElement("div");
    root.className = styles.viewer ?? "";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", `${frame.name}, the whole picture`);
    root.dataset.homeHit = "dom";
    // The view stands on the page, outside the home's slots: say the ground is light for the cursor and the focus ring.
    root.dataset.theme = "daybreak";

    const backdrop = document.createElement("div");
    backdrop.className = styles.backdrop ?? "";
    backdrop.dataset.cursor = "Close";
    backdrop.addEventListener("click", () => {
      this.close();
    });

    const outer = document.createElement("div");
    outer.className = styles.outer ?? "";
    const inner = document.createElement("div");
    inner.className = styles.inner ?? "";
    const counter = document.createElement("div");
    counter.className = styles.counter ?? "";
    const content = document.createElement("div");
    content.className = styles.content ?? "";
    content.style.width = `${T.w}px`;
    content.style.height = `${T.h}px`;
    this.fill(content, frame, T, from ?? null);
    counter.append(content);
    inner.append(counter);
    outer.append(inner);

    const close = document.createElement("button");
    close.type = "button";
    close.className = styles.close ?? "";
    close.setAttribute("aria-label", "Close the picture");
    close.dataset.cursor = "Close";
    close.innerHTML = CLOSE_ICON;
    close.addEventListener("click", () => {
      this.close();
    });

    root.append(backdrop, outer, close);
    document.addEventListener("keydown", this.onKey, true);
    // The picture is laid out for this screen: a change of size closes the view at once.
    window.addEventListener("resize", this.onResize);
    document.body.append(root);
    this.root = root;

    const frames = placements(frame, F, T);
    const full = { w: vw, h: vh };
    const wf = windowFrames(F, frames.from, T, frames.to, full);
    this.animations = [
      this.play(outer, wf.outer),
      this.play(inner, wf.inner),
      this.play(counter, wf.counter),
      this.play(content, wf.content),
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], this.timing()),
      close.animate([{ opacity: 0 }, { opacity: 1 }], { ...this.timing(), delay: 260 }),
    ];
    this.layers = [outer, inner, counter, content];
    this.fades = [backdrop, close];
    // The final state stays after the animations are done.
    outer.style.transform = wf.outer[1];
    inner.style.transform = wf.inner[1];
    counter.style.transform = wf.counter[1];
    content.style.transform = wf.content[1];
    backdrop.style.opacity = "1";
    close.style.opacity = "1";
    close.focus({ preventScroll: true });
  }

  close(): void {
    const root = this.root;
    const frame = this.frame;
    if (!root || this.closing || !frame) return;
    this.closing = true;
    const vw = window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const pic = pictureSize(frame);
    const margin = Math.max(24, 0.09 * Math.min(vw, vh));
    const T = containIn({ x: 0, y: 0, w: vw, h: vh }, pic.w / pic.h, margin);
    const F = this.host.frameRect();
    const frames = placements(frame, F, T);
    const wf = windowFrames(T, frames.to, F, frames.from, { w: vw, h: vh });
    const [outer, inner, counter, content] = this.layers;
    for (const a of this.animations) a.cancel();
    const [backdrop, close] = this.fades;
    const pairs: Array<[Element | null | undefined, [string, string]]> = [
      [outer, wf.outer],
      [inner, wf.inner],
      [counter, wf.counter],
      [content, wf.content],
    ];
    const runs = pairs.map(([el, f]) => (el ? this.play(el, f) : null));
    const fade = [
      backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], this.timing()),
      close?.animate([{ opacity: 1 }, { opacity: 0 }], { ...this.timing(), duration: 260 }),
    ];
    const all = [...runs, ...fade].filter((a): a is Animation => a != null);
    void Promise.all(all.map((a) => a.finished.catch(() => undefined))).then(() => {
      this.finish();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.finish();
  }

  private finish(): void {
    const root = this.root;
    if (!root) return;
    for (const a of this.animations) a.cancel();
    this.animations = [];
    this.video?.pause();
    this.video = null;
    document.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("resize", this.onResize);
    root.remove();
    this.root = null;
    this.release?.();
    this.release = null;
    this.closing = false;
    const opener = this.opener;
    this.opener = null;
    if (opener && !this.disposed && opener.isConnected) opener.focus({ preventScroll: true });
  }

  private timing(): KeyframeAnimationOptions {
    return { duration: DURATION, easing: EASE.css, fill: "both" };
  }

  private play(el: Element, keys: [string, string]): Animation {
    return el.animate([{ transform: keys[0] }, { transform: keys[1] }], this.timing());
  }

  /** The picture inside the content box: a still of the crop first, then the whole. */
  private fill(
    content: HTMLElement,
    frame: PictureFrame,
    T: { w: number; h: number },
    from: HTMLVideoElement | null,
  ): void {
    const win = frame.window;
    const place = (el: HTMLElement, box: { x: number; y: number; w: number; h: number }) => {
      el.style.left = `${box.x * T.w}px`;
      el.style.top = `${box.y * T.h}px`;
      el.style.width = `${box.w * T.w}px`;
      el.style.height = `${box.h * T.h}px`;
    };
    const whole = { x: 0, y: 0, w: 1, h: 1 };
    // The crop's own still, where the crop is: it is there from the first frame.
    const crop = document.createElement("img");
    crop.alt = "";
    crop.src = asset(frame.poster);
    place(crop, win);
    content.append(crop);

    if (frame.kind === "video") {
      const full = document.createElement("img");
      full.alt = frame.alt;
      full.src = asset(frame.posterFull);
      place(full, whole);
      content.append(full);
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("aria-label", frame.alt);
      place(video, whole);
      video.style.opacity = "0";
      video.style.transition = "opacity 300ms ease";
      content.append(video);
      this.video = video;
      const start = from?.currentTime ?? 0;
      void loadMedia(frame.video.path, { background: false }).then((url) => {
        if (!this.root) return;
        video.src = url || mediaUrl(frame.video.path);
        video.currentTime = start;
        void video.play().then(
          () => {
            video.style.opacity = "1";
          },
          () => undefined,
        );
      });
    } else {
      const full = document.createElement("img");
      full.alt = frame.alt;
      full.decoding = "async";
      full.style.opacity = "0";
      full.style.transition = "opacity 300ms ease";
      full.addEventListener("load", () => {
        full.style.opacity = "1";
      });
      full.src = libUrl(frame.full.lib);
      place(full, whole);
      content.append(full);
    }
  }

  private readonly onResize = (): void => {
    this.finish();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    // The button is the one control: Tab and Shift+Tab stay on it.
    if (e.key === "Tab") {
      e.preventDefault();
      this.root?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    }
  };
}
