/**
 * The DOM of the voices section after the server drew it: the chooser (a tablist), the panel of
 * each Aspirant, the art of each Aspirant and the play buttons. It wires the clicks and the keys,
 * keeps the aria state, makes the pictures when they are wanted and writes the emerge and the leave
 * (opacity and transform, only when a value changed). It knows nothing about the audio or the
 * drones: the runtime hands it the events.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";
import { asset } from "@/lib/asset";

import { emergeAt, leaveAt, rowLook } from "./choreo";

export type LineState = "idle" | "loading" | "playing";

const q = (v: number, step: number): number => Math.round(v / step) * step;

export interface VoicesDomHandlers {
  /** The visitor chose another Aspirant (by a press or by the arrow keys). */
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
  private readonly titles: Array<HTMLElement | null>;
  private readonly title: HTMLElement | null;
  private readonly chooser: HTMLElement | null;
  private readonly actions: HTMLElement | null;
  private readonly large = new Set<number>();
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
    this.titles = this.panels.map((panel) => panel.querySelector<HTMLElement>("h3"));
    this.title = root.querySelector<HTMLElement>('[data-voices-part="title"]');
    this.chooser = root.querySelector<HTMLElement>('[data-voices-part="chooser"]');
    this.actions = root.querySelector<HTMLElement>('[data-voices-part="actions"]');
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

  get count(): number {
    return this.tabs.length;
  }

  slugAt(index: number): string {
    return this.tabs[index]?.dataset.voicesTab ?? "";
  }

  /** The line buttons of the Aspirant that is shown. */
  activeRows(): readonly HTMLElement[] {
    return this.rows[this.current] ?? [];
  }

  /** Show another Aspirant: the tab, the panel and the art. No handler is called. */
  setActive(index: number): void {
    if (index < 0 || index >= this.tabs.length) return;
    this.current = index;
    this.tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
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
    fade(this.title, 1, 22);
    fade(this.chooser, 2, 18);
    fade(this.actions, 9, 16);
    fade(this.titles[this.current] ?? null, 3, 18);
    const rows = this.rows[this.current] ?? [];
    rows.forEach((row, i) => {
      rowLook(local, i, this.look);
      put(row, "opacity", String(q(this.look.opacity, 0.005)));
      put(row, "transform", `translate3d(0, ${q(this.look.lift, 0.2)}px, 0)`);
    });
    if (this.artFrame) {
      const e = emergeAt(local, 0.4);
      const slide = (1 - e) * 0.1 * viewportW + leave * 0.12 * viewportW;
      put(this.artFrame, "opacity", String(q(e * out, 0.005)));
      put(this.artFrame, "transform", `translate3d(${q(slide, 0.5)}px, 0, 0)`);
    }
  }

  dispose(): void {
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
   * The art of one Aspirant: the small picture stands in at once (it is the chooser's own file,
   * already in the cache) and the large one fades in over it when it has arrived. The large one is
   * asked for only when its Aspirant is shown, so the ten do not all download together.
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
    const ready = () => {
      big.dataset.ready = "1";
    };
    big.addEventListener("load", ready, { once: true });
    big.src = asset(`/img/char/${slug}/splash.webp`);
    fig.append(small, big);
    if (big.complete && big.naturalWidth > 0) ready();
  }

  // ---- events ----------------------------------------------------------------------------

  private readonly onClick = (e: MouseEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const tab = target.closest<HTMLElement>("[data-voices-tab]");
    if (tab) {
      const index = this.tabs.indexOf(tab as HTMLButtonElement);
      if (index >= 0) this.handlers.select(index, tab.dataset.voicesTab ?? "");
      return;
    }
    const button = target.closest<HTMLElement>("[data-voices-play]");
    const line = button?.closest<HTMLElement>("[data-voices-line]");
    if (line) this.handlers.play(line);
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    const tab = e.target instanceof Element ? e.target.closest("[data-voices-tab]") : null;
    if (!tab) return;
    const at = this.tabs.indexOf(tab as HTMLButtonElement);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (at + 1) % this.tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (at - 1 + this.tabs.length) % this.tabs.length;
    } else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = this.tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    this.focusTab(next);
    this.handlers.select(next, this.slugAt(next));
  };
}
