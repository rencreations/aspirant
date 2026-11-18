import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureSelena, type SelenaActor } from "../../actors/selena";
import type { FrameInfo, PointerState, SectionCtx, SectionRuntime } from "../../kernel/types";
import { ensureCarry, type Carry } from "../hand/carry";
import { whenIdle } from "../hand/idle";
import {
  FRAME_COUNT,
  HAND_SCREENS,
  LIST_AT,
  LIST_SCREENS,
  listBeats,
  mix,
  newListBeats,
  restOf,
  seg,
  type ListBeats,
} from "../hand/timeline";

import { PICTURE_FRAMES } from "./frames";
import { listGeometry, mixRectInto, type ListGeometry, type Rect } from "./layout";
import { LoopVideo } from "./loop-video";
import { SKY, selenaEnd, selenaInFrame, type Placement } from "./selena-frame";
import styles from "./list.module.css";
import { PictureViewer } from "./viewer";

const SELENA_AT = FRAME_COUNT - 1;
/** The sky fades over the half screen of the section's tail, in screens after its end. */
const SKY_FADE = 0.5;
const f = (v: number): string => String(Math.round(v * 1000) / 1000);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const backOut = (u: number): number => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;

interface Item {
  el: HTMLElement;
  inner: HTMLElement;
  poster: HTMLImageElement | null;
  video: LoopVideo | null;
  still: boolean;
  /** Last written state, so the DOM is touched only when it changes. */
  shown: boolean;
  live: boolean;
}

/**
 * The list: nine pictures and Selena in a 4:5 window, one at a time, by the scroll. The strip, the
 * names, the chrome and the open buttons are DOM; the doll and the hand are driven by `Carry`
 * (shared with the hand section); the tenth frame is Selena, drawn in the stage through the
 * window and growing into the whole screen. Everything is a function of `local` plus the section's
 * own state: which frame is open in the viewer and the loops' play state. The strip, the words and
 * the viewer work before the actors have arrived.
 */
class ListRuntime implements SectionRuntime {
  private readonly b: ListBeats = newListBeats();
  private readonly win: HTMLElement | null;
  private readonly row: HTMLElement | null;
  private readonly items: Item[] = [];
  private readonly chrome: SVGElement | null;
  private readonly chromeRect: SVGElement | null;
  private readonly dot: HTMLElement | null;
  private readonly panel: HTMLElement | null;
  private readonly panelOuter: HTMLElement | null;
  private readonly panelInner: HTMLElement | null;
  private readonly panelCounter: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly namesBox: HTMLElement | null;
  private readonly names: HTMLElement[];
  private readonly nameLinks: HTMLElement[];
  private readonly opens: Array<HTMLButtonElement | null>;
  /** What each button's state was last written as (null: never, so the first frame writes it). */
  private readonly opensOn: Array<boolean | null>;
  private readonly viewer: PictureViewer;
  private readonly pointer: PointerState;

  private carry: Carry | null = null;
  private g: ListGeometry | null = null;
  private vw = 0;
  private vh = 0;
  private startS = 0;
  private running = false;
  private seen = false;
  private disposed = false;
  private scrollTo: (screens: number) => void = () => undefined;
  private current = -1;
  private selena: SelenaActor | null = null;
  private selenaFrame: Placement | null = null;
  private selenaTail: Placement | null = null;
  private releasing = false;
  private interactive: boolean | null = null;
  private readonly clip: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly win0: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly full: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly place = { x: 0, y: 0, z: 0, height: 0 };
  private readonly removers: Array<() => void> = [];

  constructor(ctx: SectionCtx) {
    const below = ctx.dom.below;
    const text = ctx.dom.text;
    this.pointer = ctx.pointer.state;
    this.win = below.querySelector<HTMLElement>("[data-list-window]");
    this.row = below.querySelector<HTMLElement>("[data-list-row]");
    this.chrome = below.querySelector<SVGElement>("[data-list-chrome]");
    this.chromeRect = below.querySelector<SVGElement>("[data-list-chrome-rect]");
    this.dot = below.querySelector<HTMLElement>("[data-list-dot]");
    this.panel = below.querySelector<HTMLElement>("[data-list-panel]");
    this.panelOuter = below.querySelector<HTMLElement>("[data-list-panel-outer]");
    this.panelInner = below.querySelector<HTMLElement>("[data-list-panel-inner]");
    this.panelCounter = below.querySelector<HTMLElement>("[data-list-panel-counter]");
    const sky = below.querySelector<HTMLElement>("[data-list-sky]");
    if (sky) sky.style.background = SKY;
    this.title = text.querySelector<HTMLElement>("[data-list-title]");
    this.namesBox = text.querySelector<HTMLElement>("[data-list-names]");
    this.names = Array.from(text.querySelectorAll<HTMLElement>("[data-list-name]"));
    this.nameLinks = this.names.map((el) => el.querySelector<HTMLElement>("a")!);
    this.opens = this.names.map((_, i) =>
      text.querySelector<HTMLButtonElement>(`[data-list-open="${i}"]`),
    );
    this.opensOn = this.opens.map(() => null);

    below.querySelectorAll<HTMLElement>("[data-list-item]").forEach((el, i) => {
      const inner = el.querySelector<HTMLElement>("[data-list-inner]");
      if (!inner) return;
      const frame = PICTURE_FRAMES[i];
      const video =
        frame?.kind === "video"
          ? new LoopVideo(frame.video.path, inner, frame.video, frame.window)
          : null;
      this.items.push({
        el,
        inner,
        poster: inner.querySelector<HTMLImageElement>("[data-list-poster]"),
        video,
        still: frame?.kind === "still",
        shown: true,
        live: false,
      });
    });

    this.viewer = new PictureViewer({
      hold: () => ctx.scroll.hold(60_000),
      frameRect: () => {
        const g = this.g;
        return g ? { ...g.frame } : { x: 0, y: 0, w: 1, h: 1 };
      },
    });

    // One button over the window for each picture, right after its name in the tab order. A press
    // opens the picture only for the frame that stands in the window; the keyboard's focus on any
    // button or name brings its frame there first.
    this.opens.forEach((btn, i) => {
      if (!btn) return;
      const onClick = () => {
        const frame = PICTURE_FRAMES[i];
        if (!frame || this.opensOn[i] !== true || this.viewer.isOpen) return;
        this.viewer.open(frame, btn, this.items[i]?.video?.el ?? null);
      };
      btn.addEventListener("click", onClick);
      this.removers.push(() => {
        btn.removeEventListener("click", onClick);
      });
    });
    // A name or a button that gets the focus (the keyboard) brings its frame to the window.
    this.nameLinks.forEach((a, i) => {
      const go = () => {
        this.bringFrame(i);
      };
      a.addEventListener("focus", go);
      this.removers.push(() => {
        a.removeEventListener("focus", go);
      });
    });
    this.opens.forEach((btn, i) => {
      if (!btn) return;
      const go = () => {
        this.bringFrame(i);
      };
      btn.addEventListener("focus", go);
      this.removers.push(() => {
        btn.removeEventListener("focus", go);
      });
    });
    this.scrollTo = (screens) => {
      ctx.scroll.to(screens, { immediate: false });
    };
  }

  /**
   * A control of this section had the focus before the section was built (the keyboard went from far
   * away and the home jumped to the middle of the section): bring that control's frame to the window.
   */
  private followFocus(): void {
    const at = document.activeElement;
    if (!at) return;
    let i = this.nameLinks.indexOf(at as HTMLElement);
    if (i < 0) i = this.opens.indexOf(at as HTMLButtonElement);
    if (i >= 0) this.bringFrame(i);
  }

  /**
   * Move the page so frame `i` stands in the window. A control of a section the page is not at makes
   * the home jump to the middle of the section first (`home-stage.tsx`), and this section's start is
   * only known once it has run, so the move waits two frames.
   */
  private bringFrame(i: number): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.disposed || !this.seen || i === this.current) return;
        this.scrollTo(this.startS + restOf(i));
      });
    });
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** The hand and the doll are built (the hand section shares them). */
  setCarry(carry: Carry | null): void {
    this.carry = carry;
  }

  /** Selena arrives after the section is built (her model is the largest file). */
  setSelena(sl: SelenaActor | null): void {
    this.selena = sl;
    this.interactive = null;
  }

  enter(): void {
    this.running = true;
  }

  leave(): void {
    this.running = false;
    for (const it of this.items) it.video?.play(false);
  }

  // ------------------------------------------------------------------ layout (when the screen changes)

  private layout(vp: { w: number; h: number }): void {
    const g = listGeometry(vp);
    this.g = g;
    this.vw = vp.w;
    this.vh = vp.h;
    const fr = g.frame;
    const px = (n: number) => `${Math.round(n * 100) / 100}px`;
    const place = (el: HTMLElement | SVGElement | null, r: Rect) => {
      if (!el) return;
      el.style.left = px(r.x);
      el.style.top = px(r.y);
      el.style.width = px(r.w);
      el.style.height = px(r.h);
    };
    place(this.win, fr);
    if (this.row) this.row.style.width = px(fr.w * FRAME_COUNT);
    for (const it of this.items) {
      it.el.style.width = px(fr.w);
      it.video?.fit(fr.w, fr.h);
    }
    // The buttons are in the names' box (it never moves or turns): put them over the frame.
    const box = this.namesBox?.getBoundingClientRect();
    const ox = box ? box.left : 0;
    const oy = box ? box.top : 0;
    for (const btn of this.opens) {
      if (!btn) continue;
      place(btn, { x: fr.x - ox, y: fr.y - oy, w: fr.w, h: fr.h });
    }
    if (this.chrome) {
      this.chrome.style.left = px(fr.x - 6);
      this.chrome.style.top = px(fr.y - 6);
      this.chrome.style.width = px(fr.w + 12);
      this.chrome.style.height = px(fr.h + 12);
    }
    this.chromeRect?.setAttribute("x", "0.5");
    this.chromeRect?.setAttribute("y", "0.5");
    this.chromeRect?.setAttribute("width", f(fr.w + 11));
    this.chromeRect?.setAttribute("height", f(fr.h + 11));
    if (this.dot) {
      this.dot.style.left = px(fr.x + fr.w - 13);
      this.dot.style.top = px(fr.y + 13);
    }
    this.selenaFrame = selenaInFrame(vp, fr);
    this.selenaTail = selenaEnd(vp);
  }

  // ------------------------------------------------------------------ the frame

  update(local: number, frame: FrameInfo): void {
    const s = local * LIST_SCREENS;
    const vp = frame.viewport;
    this.startS = frame.S - local * LIST_SCREENS;
    if (!this.seen) {
      this.seen = true;
      this.followFocus();
    }
    if (vp.w !== this.vw || vp.h !== this.vh || !this.g) this.layout(vp);
    const g = this.g;
    if (!g) return;
    const b = listBeats(s, this.b);

    this.carry?.apply(HAND_SCREENS + s, frame, true);
    this.strip(b, g);
    this.selenaDraw(b, s, g, vp);
    this.words(b, s);
  }

  /** The strip: its slide, each frame's seam, the loops, the chrome. */
  private strip(b: ListBeats, g: ListGeometry): void {
    const idx = b.index;
    const fw = g.frame.w;
    const grow = seg(b.expandRaw, 0, 0.35);
    put(this.win, "opacity", f(b.appear * (1 - grow)));
    put(this.win, "visibility", grow >= 1 ? "hidden" : "visible");
    put(this.win, "transform", `translate3d(0, ${f((1 - b.appear) * 0.06 * this.vh)}px, 0)`);
    put(this.row, "transform", `translate3d(${f(-idx * fw)}px, 0, 0)`);

    for (let i = 0; i < this.items.length; i += 1) {
      const it = this.items[i];
      if (!it) continue;
      const show = clamp01(idx - (i - 1));
      const hide = clamp01(idx - i);
      const visible = show > 0 && hide < 1;
      if (visible !== it.shown) {
        it.shown = visible;
        put(it.el, "visibility", visible ? "visible" : "hidden");
      }
      if (visible) {
        const o = show - 1 + hide;
        put(it.inner, "transform", `rotate(${f(o * -10)}deg) scale(${f(1 + Math.abs(o) * 0.2)})`);
      }
      // Loops and the slow push of a still run for the frames that are on screen only.
      const live = visible && this.running && b.appear > 0.5;
      if (live !== it.live) {
        it.live = live;
        it.video?.play(live);
        if (it.still) it.poster?.classList.toggle(styles.push ?? "push", live);
      }
      // Ask for the loops of the frames to come, and urgently for the one that is here.
      if (it.video && Math.abs(i - idx) < 2.2) it.video.want(Math.abs(i - idx) < 1.2);
    }

    const chromeOp = b.appear * (1 - seg(b.expandRaw, 0, 0.25));
    put(this.chrome, "opacity", f(chromeOp));
    put(this.dot, "opacity", f(chromeOp));
    put(this.dot, "transform", `scale(${f(backOut(clamp01((b.appear - 0.4) / 0.6)))})`);
  }

  /**
   * Selena in the tenth frame, and the sky behind her that grows with the frame. She is drawn to the
   * end of the section and through its tail, in the state the section after it starts from (J8):
   * `city_idle` at `selenaEnd`, no clip. The sky stays full to the end and fades over the tail.
   */
  private selenaDraw(b: ListBeats, s: number, g: ListGeometry, vp: { w: number; h: number }): void {
    const sl = this.selena;
    const idx = b.index;
    const e = b.expand;
    const slide = (SELENA_AT - idx) * g.frame.w;
    const peeks = idx > SELENA_AT - 1 + 0.001;
    const drawn = sl !== null && (peeks || e > 0);
    const poster = this.items[SELENA_AT]?.poster;
    put(poster, "opacity", sl && peeks ? "0" : "1");

    if (!this.selenaFrame || !this.selenaTail) return;
    // The window the picture shows through: the frame's part that Selena's item covers, growing
    // to the whole screen.
    const w0 = this.win0;
    w0.x = g.frame.x + slide;
    w0.y = g.frame.y;
    w0.w = Math.max(0, g.frame.w - slide);
    w0.h = g.frame.h;
    const full = this.full;
    full.x = 0;
    full.y = 0;
    full.w = vp.w;
    full.h = vp.h;
    const rect = mixRectInto(this.clip, w0, full, e);

    // The sky: a window onto one full screen picture, so it grows with the frame and slides in.
    // The three layers only translate (the chapter morph's nested clips).
    const iw = Math.min(rect.w, vp.w) - vp.w;
    const ih = Math.min(rect.h, vp.h) - vp.h;
    put(this.panelOuter, "transform", `translate3d(${f(rect.x)}px, ${f(rect.y)}px, 0)`);
    put(this.panelInner, "transform", `translate3d(${f(iw)}px, ${f(ih)}px, 0)`);
    put(
      this.panelCounter,
      "transform",
      `translate3d(${f(-(rect.x + iw))}px, ${f(-(rect.y + ih))}px, 0)`,
    );
    put(this.panel, "visibility", sl && rect.w > 1 && peeks ? "visible" : "hidden");
    put(this.panel, "opacity", f(1 - seg(s, LIST_SCREENS, LIST_SCREENS + SKY_FADE)));
    if (!sl || !drawn) return;

    // Her place: the frame's fit, carried by the slide, then the end placement.
    const a = this.selenaFrame;
    const z = this.selenaTail;
    const p = this.place;
    p.x = mix(a.x + slide, z.x, e);
    p.y = mix(a.y, z.y, e);
    p.z = 0;
    p.height = mix(a.height, z.height, e);
    sl.visible = true;
    sl.place(p);
    sl.clipRectangle(e >= 1 ? null : rect);
    this.selenaClips(e, idx, sl);
    // Her touch targets answer only where she is drawn: inside the window, with the pointer on it.
    const ps = this.pointer;
    const over =
      ps.type !== "touch" || ps.down
        ? ps.inside &&
          ps.x >= rect.x &&
          ps.x <= rect.x + rect.w &&
          ps.y >= rect.y &&
          ps.y <= rect.y + rect.h
        : false;
    const at = Math.abs(idx - SELENA_AT) < 0.02 && (e >= 0.85 || over);
    if (at !== this.interactive) {
      this.interactive = at;
      sl.interactive(at);
    }
  }

  /**
   * Her clips. In the frame she plays the hands at the mouth in a loop. When the frame starts to
   * grow she waits for the loop to come round, plays the way out, and goes on to the idle, all by
   * herself (her own clock: after a fast scroll she may still be on the way out at the end, and
   * the section after this one must not start her again). A jump to the end puts her in the idle
   * at once.
   */
  private selenaClips(e: number, idx: number, sl: SelenaActor): void {
    const state = sl.clipState();
    if (e <= 0) {
      if (idx > SELENA_AT - 0.5 || state.clip !== "city_interaction_R_loop") {
        sl.play("city_interaction_R_loop");
      }
      this.releasing = false;
      return;
    }
    if (e >= 1 && state.clip === "city_interaction_R_loop") {
      sl.play("city_idle");
      this.releasing = false;
      return;
    }
    if (!this.releasing && state.clip === "city_interaction_R_loop") {
      this.releasing = true;
      sl.playRelease();
    }
  }

  /** The title, the names and the open buttons over the window. */
  private words(b: ListBeats, s: number): void {
    const idx = b.index;
    const out = 1 - seg(b.expandRaw, 0, 0.3);
    put(this.title, "opacity", f(b.appear * out));
    put(this.title, "transform", `translate3d(0, ${f((1 - b.appear) * 24)}px, 0)`);

    const rest = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(idx)));
    for (let i = 0; i < this.names.length; i += 1) {
      const o = i - idx;
      const op = clamp01(1 - Math.abs(o) * 1.8) * b.nameIn * out;
      const el = this.names[i];
      put(el, "opacity", f(op));
      put(el, "transform", `translate3d(0, ${f(o * 55)}%, 0)`);
    }
    if (rest !== this.current) {
      this.current = rest;
      this.names.forEach((el, i) => {
        if (i === rest) el.dataset.current = "1";
        else delete el.dataset.current;
        put(this.nameLinks[i], "pointer-events", i === rest ? "auto" : "none");
      });
    }

    // A button is live for the frame in the window once the strip stands still on it. It is never
    // `disabled` (that would take it out of the tab order): `aria-disabled` says it is not ready.
    const atRest = Math.abs(idx - rest) < 0.05;
    const ready =
      atRest && rest < SELENA_AT && b.expandRaw <= 0 && b.appear > 0.99 && s >= LIST_AT.nameIn[0];
    for (let i = 0; i < this.opens.length; i += 1) {
      const btn = this.opens[i];
      if (!btn) continue;
      const on = ready && i === rest;
      if (on === this.opensOn[i]) continue;
      this.opensOn[i] = on;
      btn.setAttribute("aria-disabled", on ? "false" : "true");
      put(btn, "pointer-events", on ? "auto" : "none");
    }
  }

  dispose(): void {
    this.disposed = true;
    this.carry = null;
    this.viewer.dispose();
    for (const r of this.removers) r();
    for (const it of this.items) it.video?.dispose();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  const runtime = new ListRuntime(ctx);
  // The hand, the doll and Selena are the biggest files: the section is built without them and they
  // join when ready (a jump into the list before they arrive shows the frames and the words). Each
  // is built when the page is idle, so the long task falls between two scroll events.
  whenIdle(() => {
    if (runtime.isDisposed) return;
    void ensureCarry(ctx).then(
      (carry) => {
        runtime.setCarry(carry);
      },
      () => {
        runtime.setCarry(null);
      },
    );
  }, 1200);
  whenIdle(() => {
    if (runtime.isDisposed) return;
    void ensureSelena(ctx).then(
      (sl) => {
        runtime.setSelena(sl);
      },
      () => {
        runtime.setSelena(null);
      },
    );
  }, 3000);
  return runtime;
}
