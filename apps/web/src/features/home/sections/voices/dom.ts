/**
 * The DOM of the voices section after the server drew it: the portrait picker, the panel of
 * each Aspirant, the art of each Aspirant and the play buttons. It wires the clicks and the keys,
 * keeps the aria state, makes the pictures when they are wanted and writes the emerge and the leave
 * (opacity and transform, only when a value changed). It knows nothing about the audio or the
 * drones: the runtime hands it the events.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";
import { asset } from "@/lib/asset";
import { imageItem, runPreload } from "@/lib/preload";

import { emergeAt, leaveAt, rowLook } from "./choreo";

export type LineState = "idle" | "loading" | "playing";

const q = (v: number, step: number): number => Math.round(v / step) * step;

export interface VoicesDomHandlers {
  /** The visitor chose a portrait in the picker. */
  select(index: number, slug: string): void;
  /** The visitor pressed the play button of a line. */
  play(line: HTMLElement): void;
}

export class VoicesDom {
  readonly artFrame: HTMLElement | null;
  private readonly tabs: HTMLButtonElement[];
  private readonly panels: HTMLElement[];
  private readonly figs: HTMLElement[];
  private readonly rows: HTMLElement[][];
  private readonly header: HTMLElement | null;
  readonly listening: HTMLElement | null;
  private readonly picker: HTMLDialogElement | null;
  private readonly large = new Set<number>();
  /** The Aspirants whose art is ready to show: the large picture decoded (or gone for good). */
  private readonly settled = new Set<number>();
  /** The art was on the screen in the last frame written (its opacity above 0). */
  private artSeen = false;
  private disposed = false;
  private current = 0;
  private readonly look = { opacity: 0, lift: 0 };

  constructor(
    private readonly root: HTMLElement,
    below: HTMLElement,
    private readonly handlers: VoicesDomHandlers,
  ) {
    const all = <T extends HTMLElement>(scope: ParentNode, selector: string): T[] =>
      Array.from(scope.querySelectorAll<T>(selector));
    this.tabs = all<HTMLButtonElement>(root, "[data-voices-tab]");
    this.panels = all(root, "[data-voices-panel]");
    this.figs = all(below, "[data-voices-fig]");
    this.rows = this.panels.map((panel) => all(panel, "[data-voices-line]"));
    this.header = root.querySelector('[data-voices-part="header"]');
    this.listening = root.querySelector('[data-voices-part="listening"]');
    this.picker = root.querySelector("[data-voices-picker]");
    this.artFrame = below.querySelector<HTMLElement>("[data-voices-art] > div");
    const active = this.panels.findIndex((p) => p.dataset.active === "1");
    this.current = Math.max(0, active);
    root.addEventListener("click", this.onClick);
    root.addEventListener("keydown", this.onKey);
    this.makeThumbs();
    this.wantLarge(this.current);
  }

  get index(): number {
    return this.current;
  }

  get dock(): HTMLElement | null {
    return this.panels[this.current]?.querySelector<HTMLElement>("[data-voices-dock]") ?? null;
  }

  get count(): number {
    return this.tabs.length;
  }

  /** The line buttons of the Aspirant that is shown. */
  activeRows(): readonly HTMLElement[] {
    return this.rows[this.current] ?? [];
  }

  /**
   * The art of the Aspirant that is shown can be drawn at once: her large picture has arrived and is
   * decoded. The way in waits for it (the runtime's ready gate), so the picture opens with the words.
   */
  artReady(): boolean {
    return this.settled.has(this.current);
  }

  /** Show another Aspirant: the tab, the panel and the art. No handler is called. */
  setActive(index: number): void {
    if (index < 0 || index >= this.tabs.length) return;
    this.current = index;
    this.tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-pressed", on ? "true" : "false");
    });
    this.panels.forEach((panel, i) => {
      panel.dataset.active = i === index ? "1" : "0";
    });
    this.figs.forEach((fig, i) => {
      fig.dataset.active = i === index ? "1" : "0";
    });
    this.wantLarge(index);
  }

  /** Move the keyboard focus to the tab of the Aspirant that is shown. */
  focusTab(index: number): void {
    this.tabs[index]?.focus();
  }

  /** The state of one line's play button. Every other line goes quiet. */
  setLine(line: HTMLElement | null, state: LineState): void {
    for (const list of this.rows) {
      for (const row of list) {
        const next = row === line ? state : "idle";
        if (row.dataset.state !== next) row.dataset.state = next;
        const button = row.querySelector<HTMLElement>("[data-voices-play]");
        if (button) {
          const pressed = row === line && state !== "idle" ? "true" : "false";
          if (button.getAttribute("aria-pressed") !== pressed) {
            button.setAttribute("aria-pressed", pressed);
          }
        }
      }
    }
  }

  /** Every line quiet. */
  clearLines(): void {
    this.setLine(null, "idle");
  }

  /** The line of this key (the whole page's), or null. */
  lineOfKey(key: string): HTMLElement | null {
    for (const list of this.rows) {
      for (const row of list) if (row.dataset.key === key) return row;
    }
    return null;
  }

  /** The emerge and the leave for a scroll position. Writes only what changed. */
  apply(local: number, viewportW: number): void {
    const leave = leaveAt(local);
    const out = 1 - leave;
    const fade = (el: HTMLElement | null, index: number, rise: number) => {
      if (!el) return;
      const e = emergeAt(local, index);
      put(el, "opacity", String(q(e * out, 0.005)));
      put(el, "transform", `translate3d(0, ${q((1 - e) * rise - leave * 28, 0.2)}px, 0)`);
    };
    fade(this.header, 1, 16);
    if (this.listening) {
      rowLook(local, 0, this.look);
      put(
        this.listening,
        "opacity",
        String(q(this.look.opacity * Math.max(0, 1 - leave / 0.64), 0.005)),
      );
      put(this.listening, "transform", `translate3d(0, ${q(this.look.lift, 0.2)}px, 0)`);
    }
    if (this.artFrame) {
      const e = emergeAt(local, 0.4);
      const slide = (1 - e) * 0.1 * viewportW + leave * 0.12 * viewportW;
      const opacity = q(e * out, 0.005);
      this.artSeen = opacity > 0;
      put(this.artFrame, "opacity", String(opacity));
      put(this.artFrame, "transform", `translate3d(${q(slide, 0.5)}px, 0, 0)`);
    }
  }

  closePicker(): void {
    if (this.picker?.open) this.picker.close();
  }

  dispose(): void {
    this.disposed = true;
    this.closePicker();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("keydown", this.onKey);
  }

  // ---- pictures --------------------------------------------------------------------------

  /** The chooser's small pictures: they are the first thing the visitor sees, so they are made at once. */
  private makeThumbs(): void {
    for (const span of this.root.querySelectorAll<HTMLElement>("[data-src]")) {
      if (span.querySelector("img")) continue;
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.src = asset(span.dataset.src ?? "");
      span.append(img);
    }
  }

  /**
   * The art of one Aspirant. The small picture stands in at once (it is the chooser's own file). The
   * large one comes through the site's loader, as the same item as the section's loading list (a
   * download that started there is not made twice, and one that stalls or drops is started again),
   * is decoded, and only then shown: at once when the art is not on the screen (the way in waits for
   * it, `artReady`), with a short fade over the small one when it is (a choice of Aspirant). The large
   * one is asked for only when its Aspirant is shown, so the ten do not all download together.
   */
  private wantLarge(index: number): void {
    const fig = this.figs[index];
    if (!fig || this.large.has(index)) return;
    this.large.add(index);
    const slug = fig.dataset.voicesFig ?? "";
    const small = new Image();
    small.alt = "";
    small.decoding = "async";
    small.dataset.size = "small";
    small.src = asset(`/img/char/${slug}/splash-sm.webp`);
    const big = new Image();
    big.alt = "";
    big.decoding = "async";
    big.dataset.size = "large";
    fig.append(small, big);
    const path = `/img/char/${slug}/splash.webp`;
    void runPreload([imageItem(path, "Loading her splash art", 2)])
      .then(async () => {
        if (this.disposed) return;
        big.src = asset(path);
        await big.decode();
        if (this.disposed) return;
        big.dataset.ready = this.artSeen ? "1" : "now";
        this.settled.add(index);
      })
      .catch(async () => {
        // The large picture is gone for good (the loader logged it, or it will not decode): the small
        // one stands in, and the way in does not wait for what nothing can fix.
        await small.decode().catch(() => undefined);
        this.settled.add(index);
      });
  }

  // ---- events ----------------------------------------------------------------------------

  private readonly onClick = (e: MouseEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (target.closest("[data-voices-open]")) {
      this.picker?.showModal();
      this.focusTab(this.current);
      return;
    }
    if (target.closest("[data-voices-close]")) {
      this.closePicker();
      return;
    }
    const tab = target.closest<HTMLElement>("[data-voices-tab]");
    if (tab) {
      const index = this.tabs.indexOf(tab as HTMLButtonElement);
      if (index >= 0) this.handlers.select(index, tab.dataset.voicesTab ?? "");
      this.closePicker();
      return;
    }
    const button = target.closest<HTMLElement>("[data-voices-play]");
    const line = button?.closest<HTMLElement>("[data-voices-line]");
    if (!line) return;
    const language = line.dataset.voicesLine;
    const panel = this.panels[this.current];
    if (!panel) return;
    for (const caption of panel.querySelectorAll<HTMLElement>("[data-voices-caption]")) {
      caption.dataset.active = caption.dataset.voicesCaption === language ? "1" : "0";
    }
    for (const row of this.activeRows()) row.dataset.selected = row === line ? "1" : "0";
    this.handlers.play(line);
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    const tab =
      e.target instanceof Element ? e.target.closest<HTMLButtonElement>("[data-voices-tab]") : null;
    if (!tab) return;
    const at = this.tabs.indexOf(tab);
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const column = this.tabs.filter((button) => button.offsetLeft === tab.offsetLeft);
      const row = column.indexOf(tab);
      const neighbor =
        column[(row + (e.key === "ArrowDown" ? 1 : -1) + column.length) % column.length];
      if (neighbor) next = this.tabs.indexOf(neighbor);
    } else if (e.key === "ArrowRight") next = (at + 1) % this.tabs.length;
    else if (e.key === "ArrowLeft") {
      next = (at - 1 + this.tabs.length) % this.tabs.length;
    } else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = this.tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    this.focusTab(next);
  };
}
