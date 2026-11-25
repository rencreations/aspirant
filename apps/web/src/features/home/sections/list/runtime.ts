import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureSelena, type SelenaActor } from "../../actors/selena";
import { ensureSilverbolt, type SilverboltActor } from "../../actors/silverbolt";
import { beatFor } from "../../kernel/beat";
import type { FrameInfo, PointerState, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionScreens, sectionStart } from "../../kernel/where";
import { whenIdle } from "../idle";
import { isPortrait, mix, seg } from "../vp";

import { onWideSelena, wideSelena } from "../vp";
import { showDragon } from "./dragon";
import { PICTURE_FRAMES } from "./frames";
import { CHROME_PAD, listGeometry, mixRectInto, type ListGeometry, type Rect } from "./layout";
import { LoopVideo } from "./loop-video";
import { createListPair, type ListPair } from "./pair";
import { SKY, selenaEnd, selenaInFrame, type Placement } from "./selena-frame";
import { FRAME_COUNT, frameRestScreens, LIST_LAST } from "./stations";
import { backOut, listBeats, newListBeats, thumbRise, type ListBeats } from "./timeline";
import styles from "./list.module.css";
import { PictureViewer } from "./viewer";

const SELENA_AT = FRAME_COUNT - 1;
/** The sky fades over the half screen of the section's tail, in screens after its end. */
const SKY_FADE = 0.5;
/**
 * Her first real draw (her clip, her skin, her ink) costs one long frame (0.8 s measured on the dev
 * server) the first time she is drawn. Left to the turn to her frame it freezes the scene in the
 * middle of a play. It is spent here instead, at the rest of the third frame, with a window that
 * shows nothing (a zero width clip): the visitor stands in a still frame and the later turn is smooth.
 */
const PRIME_AT = 2;
const PRIME_FRAMES = 3;
/** She is drawn once the strip has sat on that frame this long (seconds): the turn's landing is over. */
const PRIME_AFTER = 0.5;
const NO_WINDOW: Rect = { x: -64, y: -64, w: 0, h: 0 };
/** The frame lifts this far (px) and grows this much while the pointer is on it. */
const LIFT = 6;
const LIFT_SCALE = 0.012;
const f = (v: number): string => String(Math.round(v * 1000) / 1000);
const px = (n: number): string => `${Math.round(n * 100) / 100}px`;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

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

/** A small picture of a row: its frame's number and its element. */
interface Thumb {
  i: number;
  el: HTMLElement;
}

type Side = "left" | "right";
const SIDES: readonly Side[] = ["left", "right"];

/**
 * The characters (round six): nine pictures and Selena in a 4:5 window, with the frames before and
 * after it in a row on each side (the oryzo.ai strip). Each frame is one scroll zone: the strip turns
 * to the next frame with the scroll and rests on it. The words, the strip, the small pictures, the
 * dashed line and the open buttons are DOM; the tenth frame is Selena, drawn in the stage through the
 * window and growing into the whole screen, and the pair (drone and doll) is the descent's, docked at
 * the bottom right (`pair.ts` only helps at the end). Everything is a function of the list's beat `u`
 * plus the section's own state: which frame is open in the viewer and the loops' play state. The
 * ground is the plain page ground: nothing here paints a background of its own.
 */
class ListRuntime implements SectionRuntime {
  private readonly b: ListBeats = newListBeats();
  private readonly win: HTMLElement | null;
  private readonly row: HTMLElement | null;
  private readonly items: Item[] = [];
  private readonly chrome: HTMLElement | null;
  private readonly edges: Array<HTMLElement | null>;
  private readonly ticks: HTMLElement[];
  private readonly dot: HTMLElement | null;
  private readonly veil: HTMLElement | null;
  private readonly sides: Record<Side, HTMLElement | null>;
  private readonly thumbRows: Record<Side, HTMLElement | null>;
  private readonly thumbs: Record<Side, Thumb[]> = { left: [], right: [] };
  private readonly panel: HTMLElement | null;
  private readonly panelOuter: HTMLElement | null;
  private readonly panelInner: HTMLElement | null;
  private readonly panelCounter: HTMLElement | null;
  private readonly head: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly namesBox: HTMLElement | null;
  private readonly names: HTMLElement[];
  private readonly nameLinks: HTMLElement[];
  private readonly opens: Array<HTMLButtonElement | null>;
  /** What each button's state was last written as (null: never, so the first frame writes it). */
  private readonly opensOn: Array<boolean | null>;
  private readonly cueRow: HTMLElement | null;
  private readonly cue: HTMLElement | null;
  private readonly viewer: PictureViewer;
  private readonly pointer: PointerState;

  private pair: ListPair | null = null;
  private g: ListGeometry | null = null;
  private vw = 0;
  private vh = 0;
  private running = false;
  private seen = false;
  private disposed = false;
  private scrollTo: (screens: number) => void = () => undefined;
  private current = -1;
  private selena: SelenaActor | null = null;
  /** Silverbolt, behind her in the frame (round seven): it joins after her. */
  private dragon: SilverboltActor | null = null;
  private selenaFrame: Placement | null = null;
  private selenaTail: Placement | null = null;
  /** The clip chosen at the last endpoint of the card expansion. */
  private returning = false;
  private primed = 0;
  /** Since when (the page's time) the strip has sat on the priming frame. */
  private sinceAtPrime = -1;
  /** The pointer is on the frame in the window, eased (0 to 1). */
  private hover = 0;
  private readonly clip: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly win0: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly full: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** The whole card (not the part the screen shows): the lens of her camera is centred on it. */
  private readonly card: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly lensRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Her small picture beside the frame: its whole card, and the part of it the row shows. */
  private readonly thumbCard: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly thumbShown: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly place = { x: 0, y: 0, z: 0, height: 0 };
  private readonly removers: Array<() => void> = [];

  constructor(ctx: SectionCtx) {
    const below = ctx.dom.below;
    const text = ctx.dom.text;
    this.pointer = ctx.pointer.state;
    this.win = below.querySelector<HTMLElement>("[data-list-window]");
    this.row = below.querySelector<HTMLElement>("[data-list-row]");
    this.chrome = below.querySelector<HTMLElement>("[data-list-chrome]");
    this.edges = [0, 1, 2, 3].map((i) =>
      below.querySelector<HTMLElement>(`[data-list-edge="${i}"] b`),
    );
    this.ticks = Array.from(below.querySelectorAll<HTMLElement>("[data-list-tick]"));
    this.dot = below.querySelector<HTMLElement>("[data-list-dot]");
    this.veil = text.querySelector<HTMLElement>("[data-list-veil]");
    this.sides = {
      left: below.querySelector<HTMLElement>('[data-list-side="left"]'),
      right: below.querySelector<HTMLElement>('[data-list-side="right"]'),
    };
    this.thumbRows = {
      left: below.querySelector<HTMLElement>('[data-list-thumbs="left"]'),
      right: below.querySelector<HTMLElement>('[data-list-thumbs="right"]'),
    };
    for (const side of SIDES) {
      this.thumbRows[side]?.querySelectorAll<HTMLElement>("[data-list-thumb]").forEach((el) => {
        this.thumbs[side].push({ i: Number(el.dataset.listThumb), el });
      });
    }
    this.panel = below.querySelector<HTMLElement>("[data-list-panel]");
    this.panelOuter = below.querySelector<HTMLElement>("[data-list-panel-outer]");
    this.panelInner = below.querySelector<HTMLElement>("[data-list-panel-inner]");
    this.panelCounter = below.querySelector<HTMLElement>("[data-list-panel-counter]");
    const sky = below.querySelector<HTMLElement>("[data-list-sky]");
    if (sky) sky.style.background = SKY;
    this.head = text.querySelector<HTMLElement>("[data-list-head]");
    this.title = text.querySelector<HTMLElement>("[data-list-title]");
    this.namesBox = text.querySelector<HTMLElement>("[data-list-names]");
    this.names = Array.from(text.querySelectorAll<HTMLElement>("[data-list-name]"));
    this.nameLinks = this.names.map((el) => el.querySelector<HTMLElement>("a")!);
    this.opens = this.names.map((_, i) =>
      text.querySelector<HTMLButtonElement>(`[data-list-open="${i}"]`),
    );
    this.opensOn = this.opens.map(() => null);
    this.cueRow = text.querySelector<HTMLElement>("[data-list-cuerow]");
    this.cue = text.querySelector<HTMLElement>("[data-list-cue]");

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
    const focusable = [...this.nameLinks, ...this.opens];
    focusable.forEach((el, k) => {
      if (!el) return;
      const i = k % this.names.length;
      const go = () => {
        this.bringFrame(i);
      };
      el.addEventListener("focus", go);
      this.removers.push(() => {
        el.removeEventListener("focus", go);
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
        this.scrollTo(sectionStart("list") + frameRestScreens(i));
      });
    });
  }

  wideCleanup: () => void = () => undefined;

  get isDisposed(): boolean {
    return this.disposed;
  }

  setPair(pair: ListPair | null): void {
    this.pair = pair;
  }

  /** Selena arrives after the section is built (her model is the largest file). */
  setSelena(sl: SelenaActor | null): void {
    this.selena = sl;
  }

  /** The dragon arrives after her (the second biggest file of the page). */
  setDragon(sb: SilverboltActor | null): void {
    this.dragon = sb;
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
    const place = (el: HTMLElement | null, r: Rect) => {
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

    // The small pictures: two clips (one on each side of the window) and a row in each.
    const { thumb } = g;
    for (const side of SIDES) {
      const clip = this.sides[side];
      const r = side === "left" ? g.left : g.right;
      if (clip) {
        clip.style.left = px(r.x);
        clip.style.width = px(r.w);
      }
      const row = this.thumbRows[side];
      if (row) {
        row.style.top = px(thumb.y);
        row.style.gap = px(thumb.pitch - thumb.w);
      }
      for (const t of this.thumbs[side]) {
        t.el.style.width = px(thumb.w);
        t.el.style.height = px(thumb.h);
      }
    }

    // The words: the muted line over the name, both placed from the screen's top left.
    const u = g.head.unit;
    this.head?.style.setProperty("--list-u", px(u));
    const namesH = 1.15 * 1.5 * u;
    const namesTop = g.head.bottom - namesH;
    if (this.namesBox) {
      this.namesBox.style.left = px(g.head.x);
      this.namesBox.style.top = px(namesTop);
    }
    if (this.title) {
      this.title.style.left = px(g.head.x);
      this.title.style.top = px(namesTop - 1.1 * u - 0.1 * u);
    }
    // The buttons are in the names' box: put them over the frame.
    for (const btn of this.opens) {
      if (!btn) continue;
      place(btn, { x: fr.x - g.head.x, y: fr.y - namesTop, w: fr.w, h: fr.h });
    }
    if (this.chrome) {
      this.chrome.style.left = px(fr.x - CHROME_PAD);
      this.chrome.style.top = px(fr.y - CHROME_PAD);
      this.chrome.style.width = px(fr.w + 2 * CHROME_PAD);
      this.chrome.style.height = px(fr.h + 2 * CHROME_PAD);
    }
    if (this.cueRow) this.cueRow.style.top = px(g.cueY - 12);
    this.selenaFrame = selenaInFrame(vp, fr);
    this.selenaTail = selenaEnd(vp);
  }

  // ------------------------------------------------------------------ the frame

  update(v: number, frame: FrameInfo): void {
    // The list's beat: 0 to `LIST_LAST` across the zones, the lead (the rise) below 0 and the tail
    // above `LIST_LAST` in real screens.
    const u = beatFor(v, 0, LIST_LAST, sectionScreens("list"));
    const vp = frame.viewport;
    if (!this.seen) {
      this.seen = true;
      this.followFocus();
    }
    if (vp.w !== this.vw || vp.h !== this.vh || !this.g) this.layout(vp);
    const g = this.g;
    if (!g) return;
    const b = listBeats(u, this.b);
    if (Math.abs(b.index - PRIME_AT) < 0.001) {
      if (this.sinceAtPrime < 0) this.sinceAtPrime = frame.time;
    } else {
      this.sinceAtPrime = -1;
    }

    this.strip(b, g, frame);
    this.selenaDraw(b, u, g, vp, frame.time);
    this.words(b);
    // The pair is the descent's and is docked: the list only tells it how far the last frame has
    // grown, from the section's start on (in the lead the pair is not touched).
    if (u >= 0) this.pair?.step(b.expand, g.frame.y * (1 - b.expand), frame);
  }

  /** The pointer is on the frame in the window, at rest: it lifts a little and its line brightens. */
  private hoverTarget(b: ListBeats, g: ListGeometry): number {
    const ps = this.pointer;
    if (ps.type !== "mouse" || !ps.inside || this.viewer.isOpen) return 0;
    if (b.rise < 0.999 || b.expandRaw > 0) return 0;
    if (Math.abs(b.index - Math.round(b.index)) > 0.05 || Math.round(b.index) >= SELENA_AT) {
      return 0;
    }
    const fr = g.frame;
    return ps.x >= fr.x && ps.x <= fr.x + fr.w && ps.y >= fr.y && ps.y <= fr.y + fr.h ? 1 : 0;
  }

  /** The strip: its rise, its slide, each frame's seam, the loops, the small pictures, the chrome. */
  private strip(b: ListBeats, g: ListGeometry, frame: FrameInfo): void {
    const idx = b.index;
    const fw = g.frame.w;
    const grow = seg(b.expandRaw, 0, 0.35);
    const k = 1 - Math.exp(-12 * frame.dt);
    this.hover += (this.hoverTarget(b, g) - this.hover) * k;
    if (this.hover < 0.001) this.hover = 0;
    const lift = this.hover;
    const at = `translate3d(0, ${f((1 - b.strip) * this.vh - lift * LIFT)}px, 0) scale(${f(1 + lift * LIFT_SCALE)})`;
    put(this.win, "opacity", f(1 - grow));
    put(this.win, "visibility", grow >= 1 ? "hidden" : "inherit");
    put(this.win, "transform", at);
    put(this.row, "transform", `translate3d(${f(-idx * fw)}px, 0, 0)`);

    for (let i = 0; i < this.items.length; i += 1) {
      const it = this.items[i];
      if (!it) continue;
      const show = clamp01(idx - (i - 1));
      const hide = clamp01(idx - i);
      const visible = show > 0 && hide < 1;
      if (visible !== it.shown) {
        it.shown = visible;
        put(it.el, "visibility", visible ? "inherit" : "hidden");
      }
      if (visible) {
        // The seam of Oryzo: the picture that arrives is turned and too large, and settles.
        const o = show - 1 + hide;
        put(it.inner, "transform", `rotate(${f(o * -10)}deg) scale(${f(1 + Math.abs(o) * 0.2)})`);
      }
      // Loops and the slow push of a still run for the frames that are on screen only.
      const live = visible && this.running && b.strip > 0.5;
      if (live !== it.live) {
        it.live = live;
        it.video?.play(live);
        if (it.still) it.poster?.classList.toggle(styles.push ?? "push", live);
      }
      // Ask for the loops of the frames to come, and urgently for the one that is here.
      if (it.video && Math.abs(i - idx) < 2.2) it.video.want(Math.abs(i - idx) < 1.2);
    }

    this.thumbRowsDraw(b, g, idx);

    // The dashed line draws itself side by side as the strip arrives (each side is a bar that
    // translates into its clip), the marks and the dot come last. All of it rides with the window.
    put(this.chrome, "transform", at);
    put(this.chrome, "opacity", f((1 - seg(b.expandRaw, 0, 0.25)) * (0.75 + 0.25 * lift)));
    const c = b.chrome;
    put(this.edges[0], "transform", `translate3d(${f(-(1 - seg(c, 0, 0.3)) * 100)}%, 0, 0)`);
    put(this.edges[1], "transform", `translate3d(0, ${f(-(1 - seg(c, 0.2, 0.5)) * 100)}%, 0)`);
    put(this.edges[2], "transform", `translate3d(${f((1 - seg(c, 0.4, 0.7)) * 100)}%, 0, 0)`);
    put(this.edges[3], "transform", `translate3d(0, ${f((1 - seg(c, 0.6, 0.9)) * 100)}%, 0)`);
    const tickOp = f(seg(c, 0.8, 1));
    for (const t of this.ticks) put(t, "opacity", tickOp);
    put(this.dot, "transform", `scale(${f(backOut(seg(c, 0.65, 1)))})`);
  }

  /**
   * The two rows of small pictures. At position `idx` the left row shows the frames before the one in
   * the window, the next one right beside it, and the right row the ones to come; a step of the strip
   * moves both by one picture and its gap (Oryzo's 210 px at 1440). They rise from below at the start,
   * the near ones first, and leave with the growth of the last frame.
   */
  private thumbRowsDraw(b: ListBeats, g: ListGeometry, idx: number): void {
    const { thumb } = g;
    const rest = Math.round(idx);
    const op = f(1 - seg(b.expandRaw, 0, 0.3));
    put(this.sides.left, "opacity", op);
    put(this.sides.right, "opacity", op);
    // The left row's picture `i` stands at `leftW - w - (idx - 1 - i) * pitch` from the clip's left
    // (it is at `i * pitch` in its flex row), the right row's picture `i` at `(i - idx - 1) * pitch`
    // (at `(i - 1) * pitch` in its row).
    put(
      this.thumbRows.left,
      "transform",
      `translate3d(${f(g.left.w - thumb.w - (idx - 1) * thumb.pitch)}px, 0, 0)`,
    );
    put(this.thumbRows.right, "transform", `translate3d(${f(-idx * thumb.pitch)}px, 0, 0)`);
    for (const side of SIDES) {
      for (const t of this.thumbs[side]) {
        const order = Math.max(0, side === "left" ? rest - 1 - t.i : t.i - rest - 1);
        const y = thumbRise(b.rise, order) * this.vh;
        put(t.el, "transform", y > 0.5 ? `translate3d(0, ${f(y)}px, 0)` : "none");
      }
    }
  }

  /**
   * Selena in the tenth frame, and the sky behind her that grows with the frame. She is drawn to the
   * end of the section and through its tail, in the state the section after it starts from (J8):
   * `city_idle` at `selenaEnd`, no clip. The sky stays full to the end and fades over the tail.
   */
  private selenaDraw(
    b: ListBeats,
    u: number,
    g: ListGeometry,
    vp: { w: number; h: number },
    time: number,
  ): void {
    const wide = wideSelena(vp);
    const sl = wide ? this.selena : null;
    const idx = b.index;
    const e = b.expand;
    const slide = (SELENA_AT - idx) * g.frame.w;
    const peeks = idx > SELENA_AT - 1 + 0.001;
    // Before the strip turns to her she is the small picture beside the frame, and it is her model too
    // (the owner, 24 Nov 2026): drawn in that card, in the part of it the row shows. Her small picture
    // of the markup stays hidden for as long as her model can be drawn there.
    const preview = sl !== null && !peeks && e <= 0 && this.previewRect(b, g, vp, idx);
    const drawn = sl !== null && (peeks || e > 0 || preview);
    const poster = this.items[SELENA_AT]?.poster;
    put(poster, "opacity", sl && peeks ? "0" : "1");
    // Once the strip has turned to her the small picture goes on with the row, to the left under the
    // window's edge, like every other one (25 Nov 2026): it is hidden only while her model is drawn there.
    for (const t of this.thumbs.right) {
      // Hidden while her model stands there; otherwise the class decides (the pale small pictures).
      if (t.i === SELENA_AT) put(t.el, "opacity", sl && preview ? "0" : "");
    }
    // Her model over the small picture is as pale as the pictures beside it (`.thumb` is 0.66).
    if (preview) {
      const r = this.thumbShown;
      put(
        this.veil,
        "transform",
        `translate3d(${f(r.x)}px, ${f(r.y)}px, 0) scale(${f(r.w)}, ${f(r.h)})`,
      );
      put(this.veil, "opacity", "0.34");
    } else {
      put(this.veil, "opacity", "0");
    }

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
    put(this.panel, "visibility", rect.w > 1 && peeks ? "inherit" : "hidden");
    put(this.panel, "opacity", f(1 - seg(u, LIST_LAST, LIST_LAST + SKY_FADE)));
    if (sl && preview) {
      this.drawPreview(sl, vp);
      return;
    }
    const prime =
      sl !== null &&
      !drawn &&
      this.primed < PRIME_FRAMES &&
      this.sinceAtPrime >= 0 &&
      time - this.sinceAtPrime > PRIME_AFTER;
    if (!sl || (!drawn && !prime)) {
      // Not drawn: the next time she is, she jumps to the loop that matches (no half played clip).
      return;
    }

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
    if (prime) {
      this.primed += 1;
      sl.clipRectangle(NO_WINDOW);
      sl.jump(0);
      return;
    }
    sl.clipRectangle(e >= 1 ? null : rect);
    this.selenaStates(e, sl);
    // Round seven: her picture is the fitted camera of the clip she plays (`actors/selena/camera-r7.ts`),
    // the portrait lens in the 4:5 window and the recording's whole frame at the end of the growth,
    // mixed in pixels as the window grows.
    // The lens takes the whole card, not the slice the screen shows while it slides in, so she
    // moves with the card and not at half its speed. The scissor takes the visible `rect`.
    const card = this.card;
    card.x = g.frame.x + slide;
    card.y = g.frame.y;
    card.w = g.frame.w;
    card.h = g.frame.h;
    // On a phone the room after the list covers the screen with the portrait crop, so the frame
    // keeps the crop all the way (the lens rect grows to the whole screen): no change of lens at the
    // handover. On a wide screen the crop gives way to the recording's whole frame.
    sl.frame(vp, {
      portrait: isPortrait(vp) ? 1 : 1 - e,
      rect: mixRectInto(this.lensRect, card, full, e),
      clip: rect,
    });
    // The dragon is in her picture, behind her: the clip that matches hers, at her time.
    if (this.dragon) showDragon(sl, this.dragon);
  }

  /**
   * Where her small picture is in the right row (the card) and how much of it the row shows (the part
   * inside the row's clip, also while the picture rises into it). False when none of it is on the screen.
   */
  private previewRect(
    b: ListBeats,
    g: ListGeometry,
    vp: { w: number; h: number },
    idx: number,
  ): boolean {
    if (b.rise <= 0.001) return false;
    const { thumb, right } = g;
    const card = this.thumbCard;
    // The right row's picture `i` stands at `(i - idx - 1) * pitch` from the row's clip, and rises from
    // below with the near ones first (`thumbRise`), exactly as the markup's picture does.
    const order = Math.max(0, SELENA_AT - Math.round(idx) - 1);
    card.x = right.x + (SELENA_AT - idx - 1) * thumb.pitch;
    card.y = thumb.y + thumbRise(b.rise, order) * this.vh;
    card.w = thumb.w;
    card.h = thumb.h;
    const shown = this.thumbShown;
    const x0 = Math.max(card.x, right.x);
    const x1 = Math.min(card.x + card.w, right.x + right.w, vp.w);
    const y0 = Math.max(card.y, right.y);
    const y1 = Math.min(card.y + card.h, right.y + right.h);
    shown.x = x0;
    shown.y = y0;
    shown.w = x1 - x0;
    shown.h = y1 - y0;
    return shown.w > 1 && shown.h > 1;
  }

  /** Her model in her small picture, in the lens of that card, with the dragon behind her. */
  private drawPreview(sl: SelenaActor, vp: { w: number; h: number }): void {
    const a = selenaInFrame(vp, this.thumbCard);
    const p = this.place;
    p.x = a.x;
    p.y = a.y;
    p.z = 0;
    p.height = a.height;
    sl.visible = true;
    sl.place(p);
    sl.clipRectangle(this.thumbShown);
    this.selenaStates(0, sl);
    sl.frame(vp, { portrait: 1, rect: this.thumbCard, clip: this.thumbShown });
    if (this.dragon) showDragon(sl, this.dragon);
  }

  private selenaStates(e: number, sl: SelenaActor): void {
    if (e <= 0 || e >= 1) {
      sl.drive(e);
      this.returning = e >= 1;
    } else {
      // Pick the authored return on departure from the full room. Reversing mid-shot
      // scrubs that same take back, so there is no cut between unrelated poses.
      const clip = this.returning ? "city_interaction_R" : "city_interaction_back_R";
      sl.clip(clip, this.returning ? (1 - e) * 3.291667 : e * 3.208333);
    }
  }

  /** The heading, the names, the hint and the open buttons. */
  private words(b: ListBeats): void {
    const idx = b.index;
    const out = 1 - seg(b.expandRaw, 0, 0.3);
    const lift = f((1 - b.head) * this.vh);
    put(this.title, "opacity", f(b.head * out));
    put(this.title, "translate", `0 ${lift}px`);

    const rest = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(idx)));
    for (let i = 0; i < this.names.length; i += 1) {
      const o = i - idx;
      // The name of the frame in the window is the line under the muted one; a step of the strip
      // takes the old name up and out and brings the next from below, as the picture changes.
      const op = clamp01(1 - Math.abs(o) * 1.8) * b.head * out;
      const el = this.names[i];
      put(el, "opacity", f(op));
      put(el, "transform", `translate3d(0, ${f(o * 55)}%, 0)`);
      put(el, "translate", `0 ${lift}px`);
    }
    if (rest !== this.current) {
      this.current = rest;
      this.names.forEach((el, i) => {
        if (i === rest) el.dataset.current = "1";
        else delete el.dataset.current;
        put(this.nameLinks[i], "pointer-events", i === rest ? "auto" : "none");
      });
    }

    // The hint at the foot comes at the end of the rise and goes with the growth.
    put(this.cue, "opacity", f(b.cue * out));
    put(this.cue, "transform", `translate3d(0, ${f((1 - b.cue) * 12)}px, 0)`);

    // A button is live for the frame in the window once the strip stands still on it. It is never
    // `disabled` (that would take it out of the tab order): `aria-disabled` says it is not ready.
    const atRest = Math.abs(idx - rest) < 0.05;
    const ready = atRest && rest < SELENA_AT && b.expandRaw <= 0 && b.rise > 0.999;
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
    this.pair?.dispose();
    this.pair = null;
    this.wideCleanup();
    this.viewer.dispose();
    for (const r of this.removers) r();
    for (const it of this.items) it.video?.dispose();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  const runtime = new ListRuntime(ctx);
  runtime.setPair(createListPair(ctx));
  // Selena is the biggest file of the page: the section is built without her and she joins when
  // ready (a jump into the list before she arrives shows the frames and the words). She is built
  // when the page is idle, so the long task falls between two scroll events.
  runtime.wideCleanup = onWideSelena(() =>
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
      // Silverbolt stands behind her in the same picture. A failure only leaves the frame without it.
      void ensureSilverbolt(ctx).then(
        (sb) => {
          runtime.setDragon(sb);
        },
        () => {
          runtime.setDragon(null);
        },
      );
    }, 3000),
  );
  return runtime;
}
