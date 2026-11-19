/**
 * The deck of the open window (round three, 20 Nov 2026). The owner asked for the big window to be
 * dressed like `/character/vexana` section "02, the film": "PLAY" on the left of the play button and
 * "FILMS" on the right, a button and words that react to a hover, and components above and below the
 * picture that move when idle and on a hover. This is that section's controller
 * (`features/character/vexana/reel/reel-controller.ts`, its `renderDecor` and its variations), taken
 * for the strip's window and written with the strip's own words and colours:
 *
 *  - two bands, above and below the picture, each with five marks (a plus, an x, a circle, a triangle,
 *    a half disc) that spin in once the window is complete, swap shape in mirrored pairs every few
 *    seconds, and slide out of their band on a hover while a strip of running words rises into it;
 *  - the readout pill at the picture's top left, which rolls between its lines;
 *  - the two big words, built letter by letter: they rise in, one letter rolls over every two
 *    seconds, and on a hover the letters lean toward the button, the nearest first;
 *  - the button: a disc rises through it on a hover, it grows a little, squashes on a press, and when
 *    nobody touches it the triangle hops forward and a ring ripples off it every few seconds.
 *
 * Everything is a function of the frame's `dt` (a frozen frame holds it) and writes transform and
 * opacity only, through `put`, which skips a value that has not changed. Nothing is allocated in a
 * frame. The hover is the button's own (a mouse or a pen, or the keyboard's focus ring); a finger has
 * no hover, a press opens the player.
 */
import {
  easeSettle,
  expoInOut,
  fit,
  saturate,
  stepSpring,
} from "@/features/character/vexana/reel/reel-math";
import { put } from "@/features/character/vexana/seams/scroll-kit";

const MARK_KINDS = ["plus", "x", "circle", "triangle", "half"] as const;
type MarkKind = (typeof MARK_KINDS)[number];

/** A mark in a swap: it shrinks away, changes shape at `SWAP_IN`, and grows back with a spin. */
const SWAP_IN = 0.24;
const SWAP_OUT = 0.62;
const SWAP_TOTAL = SWAP_IN + SWAP_OUT;

/** How long a roll of a strip's or the readout's line takes at most (the stagger included). */
const STRIP_ROLL_TOTAL = 0.06 + 0.55 + 7 * 0.03 + 0.05;
const READOUT_ROLL_TOTAL = 0.6;
const NUDGE_TOTAL = 1.3;

const backOut = (x: number, k = 2.4): number => {
  const t = x - 1;
  return 1 + (k + 1) * t * t * t + k * t * t;
};
const power2In = (x: number): number => x * x;
const power2Out = (x: number): number => 1 - (1 - x) * (1 - x);
const power2InOut = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const power3Out = (x: number): number => 1 - Math.pow(1 - x, 3);
const power3InOut = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const elasticOut = (x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const p = 0.45;
  return Math.pow(2, -10 * x) * Math.sin(((x - p / 4) * (2 * Math.PI)) / p) + 1;
};

interface MarkSwap {
  els: HTMLElement[];
  t: number;
  next: MarkKind;
  changed: boolean;
}

export interface DeckOptions {
  /** The lines the two strips take turns with. */
  strips: readonly string[];
  /** The lines the readout takes turns with. */
  readout: readonly string[];
  /** A press on the button (or its key). */
  onPress: () => void;
}

export class WindowDeck {
  private readonly all: HTMLElement | null;
  private readonly allBelow: HTMLElement | null;
  private readonly watch: HTMLElement | null;
  private readonly icon: HTMLElement | null;
  private readonly ring: HTMLElement | null;
  private readonly slots: HTMLElement[];
  private readonly emerges: HTMLElement[];
  private readonly swapEls: HTMLElement[];
  private readonly strips: HTMLElement[];
  private readonly stripItems: HTMLElement[];
  private readonly stripTexts: Array<[HTMLElement, HTMLElement]>;
  private readonly readoutBox: HTMLElement | null;
  private readonly readoutLines: HTMLElement[];
  private readonly words: HTMLElement[][];
  private readonly tracks: HTMLElement[][];
  private readonly leans: Array<Array<[number, number]>>;
  private readonly offs: Array<() => void> = [];

  private clock = 0;
  private decoT = 0;
  private showT = 0;
  private hov2 = 0;
  private hov3 = 0;
  private hoverTime = 0;
  private hoverSince = 0;
  private hoverCount = 0;
  private hoverWas = false;
  private buttonHover = false;
  private buttonFocus = false;
  private pressTarget = 0;
  private readonly press: [number, number] = [0, 0];
  private rollTime = 0;
  private readonly rollChars: [number, number] = [0, 0];
  private nextNudgeAt = 2.2;
  private nextSwapAt = 3;
  private nextStripAt = 3.5;
  private nextReadoutAt = 3.2;
  private nudgeT = -1;
  private readonly swaps: MarkSwap[] = [];
  private stripIndex = 0;
  private stripFront = 0;
  private stripRollT = -1;
  private stripImmediate = false;
  private readoutIndex = 0;
  private readoutFront = 0;
  private readoutRollT = -1;
  private lastLabel = "";
  private fitted = false;

  /**
   * `root` holds the dress on the picture (the words, the button, the readout). `below` holds the two
   * bands, which hang outside the picture and stand in the layer under the canvas so that the drone is
   * drawn in front of them (round five); without it the bands are looked for in `root`.
   */
  constructor(
    root: ParentNode,
    private readonly options: DeckOptions,
    below: ParentNode = root,
  ) {
    const all = (sel: string): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-deck="${sel}"]`));
    const inBands = (sel: string): HTMLElement[] =>
      Array.from(below.querySelectorAll<HTMLElement>(`[data-deck="${sel}"]`));
    this.all = root.querySelector<HTMLElement>("[data-strip-deck]");
    this.allBelow = below.querySelector<HTMLElement>("[data-strip-deck-below]");
    this.watch = root.querySelector<HTMLElement>("[data-strip-play]");
    this.icon = root.querySelector<HTMLElement>('[data-deck="watch-icon"]');
    this.ring = root.querySelector<HTMLElement>('[data-deck="watch-ring"]');
    this.slots = inBands("mark-slot");
    this.emerges = inBands("mark-emerge");
    this.swapEls = inBands("mark-swap");
    this.strips = inBands("strip");
    this.stripItems = inBands("strip-item");
    this.stripTexts = this.stripItems.map((item) => {
      const t = Array.from(item.querySelectorAll<HTMLElement>('[data-deck="strip-text"]'));
      return [t[0]!, t[1]!];
    });
    this.readoutBox = root.querySelector<HTMLElement>('[data-deck="readout"]');
    this.readoutLines = all("readout-line");
    this.words = Array.from(root.querySelectorAll<HTMLElement>('[data-deck="word"]')).map((w) =>
      Array.from(w.querySelectorAll<HTMLElement>('[data-deck="char"]')),
    );
    this.tracks = Array.from(root.querySelectorAll<HTMLElement>('[data-deck="word"]')).map((w) =>
      Array.from(w.querySelectorAll<HTMLElement>('[data-deck="char-track"]')),
    );
    this.leans = this.words.map((chars) => chars.map(() => [0, 0] as [number, number]));
    this.rollChars[0] = this.randomInt(0, Math.max(0, (this.tracks[0]?.length ?? 1) - 1));
    this.rollChars[1] = this.randomInt(0, Math.max(0, (this.tracks[1]?.length ?? 1) - 1));
    this.bind();
  }

  // ---------------------------------------------------------------------------------------------

  /** Whether the pointer or the focus is on the button now (the runtime lets the film's hover wait for it). */
  get hovered(): boolean {
    return this.buttonHover || this.buttonFocus;
  }

  /**
   * One frame. `up` is how present the window's dress is, 0 to 1 (the play button and the words come
   * in with it and go as the pull starts); `cross` is the height of a band in px and `half` the width
   * of the picture, which the strips run along.
   */
  step(dt: number, up: number, cross: number, half: number): void {
    this.clock += dt;
    const full = up >= 0.98;
    const btnR = fit(up, 0.3, 1, 0, 1);
    put(this.all, "opacity", up > 0.001 ? "1" : "0");
    put(this.allBelow, "opacity", up > 0.001 ? "1" : "0");
    // The pill is as wide as its first line, once the fonts are in and the deck can be measured.
    if (!this.fitted && up > 0.001) {
      const first = this.readoutLines[0];
      const mask = first?.parentElement;
      if (first && mask && first.offsetWidth > 0) {
        put(mask, "width", `${Math.ceil(first.offsetWidth) + 1}px`);
        this.fitted = true;
      }
    }

    const hovered = (this.buttonHover || this.buttonFocus) && full;
    // Each new hover brings the next line to the strips (the first shows the first).
    if (hovered && !this.hoverWas) {
      if (this.hoverCount > 0 && this.hov2 < 0.2) this.cycleStrip(true);
      else this.nextStripAt = this.clock + 3.6;
      this.hoverCount += 1;
    }
    this.hoverWas = hovered;
    this.hov2 = saturate(this.hov2 + (hovered ? dt : -dt) * 1.5);
    this.hov3 = saturate(this.hov3 + (hovered ? dt : -dt) * 3);
    if (hovered) this.hoverTime += dt * 2;
    this.decoT = Math.min(1.4, Math.max(0, this.decoT + (btnR >= 1 ? dt : -2 * dt)));

    this.stepMarks(dt, cross);
    this.stepStrips(dt, cross, half);
    this.stepButton(dt, btnR, hovered);
    this.stepWords(dt, full, hovered);

    if (this.readoutBox) {
      put(this.readoutBox, "opacity", fit(this.decoT, 0.3, 0.9, 0, 1).toFixed(3));
    }
    this.stepRolls(dt);

    // Idle variations while the window stands complete.
    if (hovered || this.pressTarget)
      this.nextNudgeAt = Math.max(this.nextNudgeAt, this.clock + 2.4);
    if (btnR >= 1 && this.decoT >= 1.4) {
      if (this.clock >= this.nextNudgeAt) this.nudge();
      if (this.clock >= this.nextSwapAt) this.swapMarks();
      if (hovered && this.clock >= this.nextStripAt) this.cycleStrip(false);
      if (this.clock >= this.nextReadoutAt) this.rollReadout();
    }
  }

  /** A section that goes: the button lets go of everything it held. */
  reset(): void {
    this.buttonHover = false;
    this.buttonFocus = false;
    this.pressTarget = 0;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  // ---------------------------------------------------------------------------------------------
  // The marks

  private stepMarks(dt: number, cross: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const column = i % 5;
      const slide = fit(this.hov2 - column / 10, 0, 0.7, 0, 1, expoInOut);
      put(
        this.slots[i],
        "transform",
        slide ? `translate3d(0,${(slide * cross).toFixed(2)}px,0)` : "none",
      );
      const grow = fit(this.decoT - column / 10, 0, 0.6, 0, 1, easeSettle);
      put(
        this.emerges[i],
        "transform",
        grow >= 1 ? "none" : `scale(${grow.toFixed(4)}) rotate(${(grow * 180).toFixed(2)}deg)`,
      );
    }
    for (let n = this.swaps.length - 1; n >= 0; n--) {
      const sw = this.swaps[n]!;
      sw.t += dt;
      let scale: number;
      let rot: number;
      if (sw.t < SWAP_IN) {
        const e = power2In(sw.t / SWAP_IN);
        scale = 1 - e;
        rot = 110 * e;
      } else {
        if (!sw.changed) {
          sw.changed = true;
          for (const el of sw.els) el.dataset.kind = sw.next;
        }
        const e = backOut(Math.min(1, (sw.t - SWAP_IN) / SWAP_OUT));
        scale = e;
        rot = 110 + 250 * e;
      }
      const done = sw.t >= SWAP_TOTAL;
      for (const el of sw.els) {
        put(
          el,
          "transform",
          done ? "none" : `scale(${scale.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`,
        );
      }
      if (done) this.swaps.splice(n, 1);
    }
  }

  private swapMarks(): void {
    this.nextSwapAt = this.clock + 2.8 + Math.random() * 2.4;
    if (!this.swapEls.length) return;
    const count = Math.random() < 0.35 ? 2 : 1;
    for (let n = 0; n < count; n++) {
      const column = this.randomInt(0, 4);
      // A column swaps on both rows, mirrored, so the frame stays balanced.
      const first = this.swapEls[column];
      const second = this.swapEls[5 + (4 - column)];
      if (!first || !second) return;
      if (this.swaps.some((s) => s.els.includes(first) || s.els.includes(second))) continue;
      const current = first.dataset.kind as MarkKind;
      // Plus is home: every other swap returns there.
      const others = MARK_KINDS.filter((k) => k !== current);
      const next =
        current !== "plus" && Math.random() < 0.5
          ? "plus"
          : others[this.randomInt(0, others.length - 1)]!;
      this.swaps.push({ els: [first, second], t: 0, next, changed: false });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // The strips of running words

  private stepStrips(dt: number, cross: number, half: number): void {
    const items = this.stripItems;
    for (let i = 0; i < items.length; i++) {
      const index = i % 8;
      const y = fit(this.hov2 - index / 25, 0.2, 1, 1.2, 0, expoInOut);
      put(items[i], "transform", y ? `translate3d(0,${(y * cross).toFixed(2)}px,0)` : "none");
    }
    const phase = (this.hoverTime % 15) / 15;
    for (let k = 0; k < this.strips.length; k++) {
      const x = k % 2 === 0 ? -phase * half : -(1 - phase) * half;
      put(this.strips[k], "transform", `translate3d(${x.toFixed(2)}px,0,0)`);
    }
    if (this.stripRollT >= 0) {
      this.stripRollT += dt;
      const t = this.stripRollT;
      for (let i = 0; i < this.stripTexts.length; i++) {
        const delay = this.stripImmediate ? 0 : (i % 8) * 0.03;
        const pair = this.stripTexts[i]!;
        const incoming = this.stripFront === 0 ? pair[0] : pair[1];
        const outgoing = this.stripFront === 0 ? pair[1] : pair[0];
        const o = Math.min(1, Math.max(0, (t - delay) / 0.45));
        const n = Math.min(1, Math.max(0, (t - delay - 0.06) / 0.55));
        put(outgoing, "transform", `translate3d(0,${(-110 * power3InOut(o)).toFixed(2)}%,0)`);
        put(incoming, "transform", `translate3d(0,${(110 * (1 - power3Out(n))).toFixed(2)}%,0)`);
      }
      if (t >= STRIP_ROLL_TOTAL) this.stripRollT = -1;
    }
  }

  private cycleStrip(immediate: boolean): void {
    this.nextStripAt = this.clock + 3.6;
    const lines = this.options.strips;
    if (lines.length < 2) return;
    this.stripIndex = (this.stripIndex + 1) % lines.length;
    const text = lines[this.stripIndex];
    if (text === undefined) return;
    // The roll that was running is settled first, so the front and the back never swap mid-way.
    if (this.stripRollT >= 0) this.finishStripRoll();
    this.stripFront = 1 - this.stripFront;
    for (const pair of this.stripTexts) {
      const incoming = this.stripFront === 0 ? pair[0] : pair[1];
      incoming.textContent = text;
    }
    this.stripImmediate = immediate;
    this.stripRollT = 0;
  }

  private finishStripRoll(): void {
    for (const pair of this.stripTexts) {
      const incoming = this.stripFront === 0 ? pair[0] : pair[1];
      const outgoing = this.stripFront === 0 ? pair[1] : pair[0];
      put(outgoing, "transform", "translate3d(0,-110%,0)");
      put(incoming, "transform", "translate3d(0,0%,0)");
    }
    this.stripRollT = -1;
  }

  // ---------------------------------------------------------------------------------------------
  // The button

  private stepButton(dt: number, btnR: number, hovered: boolean): void {
    const watch = this.watch;
    if (!watch) return;
    const shown = this.buttonFocus ? 1 : btnR;
    // Scrolled away from a focused button: let the focus go too, so it never sits on a button that has gone.
    if (!this.buttonFocus && btnR < 0.3 && document.activeElement === watch) watch.blur();
    const pressed = stepSpring(this.press, this.pressTarget, dt, 520, 22);
    const scale = expoInOut(shown) + 0.1 * expoInOut(this.hov3);
    const sx = scale * (1 + 0.08 * pressed);
    const sy = scale * (1 - 0.1 * pressed);
    put(watch, "opacity", expoInOut(shown).toFixed(3));
    put(watch, "transform", `scale(${sx.toFixed(4)},${sy.toFixed(4)})`);
    put(watch, "pointer-events", shown > 0.5 ? "auto" : "none");
    const hoverOn = hovered ? "true" : "false";
    if (watch.dataset.hover !== hoverOn) watch.dataset.hover = hoverOn;

    // The idle call: the triangle hops forward and a ring ripples off the button.
    if (this.nudgeT >= 0) {
      this.nudgeT += dt;
      const t = this.nudgeT;
      let x: number;
      let sxi: number;
      if (t < 0.16) {
        const e = power2Out(t / 0.16);
        x = 16 * e;
        sxi = 1 - 0.1 * e;
      } else if (t < 0.34) {
        const e = power2InOut((t - 0.16) / 0.18);
        x = 16 + (-4 - 16) * e;
        sxi = 0.9 + (1.04 - 0.9) * e;
      } else {
        const e = elasticOut(Math.min(1, (t - 0.34) / 0.7));
        x = -4 + 4 * e;
        sxi = 1.04 - 0.04 * e;
      }
      put(this.icon, "transform", `translate3d(${x.toFixed(2)}%,0,0) scaleX(${sxi.toFixed(3)})`);
      const r = Math.min(1, Math.max(0, (t - 0.12) / 1.1));
      const e = power2Out(r);
      put(this.ring, "transform", `scale(${(1 + 0.32 * e).toFixed(4)})`);
      put(this.ring, "opacity", (0.7 * (1 - e) * (r > 0 ? 1 : 0)).toFixed(3));
      if (t >= NUDGE_TOTAL) {
        this.nudgeT = -1;
        put(this.icon, "transform", "none");
        put(this.ring, "opacity", "0");
      }
    }
  }

  private nudge(): void {
    this.nextNudgeAt = this.clock + 3.2 + Math.random() * 1.6;
    this.nudgeT = 0;
  }

  // ---------------------------------------------------------------------------------------------
  // The two words

  private stepWords(dt: number, full: boolean, hovered: boolean): void {
    this.showT = full ? Math.min(2, this.showT + dt) : Math.max(0, this.showT - dt * 2);
    this.rollTime += dt;
    if (this.rollTime >= 2) {
      this.rollTime -= 2;
      this.rollChars[0] = this.randomInt(0, Math.max(0, (this.tracks[0]?.length ?? 1) - 1));
      this.rollChars[1] = this.randomInt(0, Math.max(0, (this.tracks[1]?.length ?? 1) - 1));
    }
    const hoverAge = this.clock - this.hoverSince;
    for (let w = 0; w < this.tracks.length; w++) {
      const tracks = this.tracks[w]!;
      const chars = this.words[w]!;
      const leanRow = this.leans[w]!;
      const count = tracks.length;
      for (let c = 0; c < count; c++) {
        const rise = fit(this.showT - w / 4 - c / 20, 0, 0.6, 200, 0, easeSettle);
        const roll =
          c === this.rollChars[w] ? fit(this.rollTime - w / 10, 0.5, 1.3, 0, -100, easeSettle) : 0;
        const y = rise + roll;
        put(tracks[c], "transform", y === 0 ? "none" : `translate3d(0,${(y / 2).toFixed(3)}%,0)`);
        // Nearest the button leans first and most.
        const fromButton = w === 0 ? count - 1 - c : c;
        const target = hovered && hoverAge > fromButton * 0.035 ? 1 : 0;
        const lean = stepSpring(leanRow[c]!, target, dt, 190, 11);
        const amount = lean * (1 - fromButton * 0.14);
        const sign = w === 0 ? 1 : -1;
        put(
          chars[c],
          "transform",
          Math.abs(amount) < 0.001
            ? "none"
            : `translate3d(${(sign * amount * 0.04).toFixed(4)}em,0,0) rotate(${(sign * amount * 7).toFixed(3)}deg)`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // The readout

  private stepRolls(dt: number): void {
    if (this.readoutRollT < 0) return;
    this.readoutRollT += dt;
    const t = this.readoutRollT;
    const incoming = this.readoutLines[this.readoutFront];
    const outgoing = this.readoutLines[1 - this.readoutFront];
    const o = Math.min(1, Math.max(0, t / 0.4));
    const n = Math.min(1, Math.max(0, (t - 0.05) / 0.5));
    put(outgoing, "transform", `translate3d(0,${(-110 * power3InOut(o)).toFixed(2)}%,0)`);
    put(incoming, "transform", `translate3d(0,${(110 * (1 - power3Out(n))).toFixed(2)}%,0)`);
    if (t >= READOUT_ROLL_TOTAL) this.readoutRollT = -1;
  }

  private rollReadout(): void {
    this.nextReadoutAt = this.clock + 3.4;
    const lines = this.options.readout;
    if (lines.length < 2 || this.readoutLines.length < 2) return;
    this.readoutIndex = (this.readoutIndex + 1) % lines.length;
    const text = lines[this.readoutIndex]!;
    this.readoutFront = 1 - this.readoutFront;
    const incoming = this.readoutLines[this.readoutFront]!;
    incoming.textContent = text;
    // The pill is as wide as the line it shows (the width eases in CSS).
    const mask = incoming.parentElement;
    if (mask && text !== this.lastLabel)
      put(mask, "width", `${Math.ceil(incoming.offsetWidth) + 1}px`);
    this.lastLabel = text;
    this.readoutRollT = 0;
  }

  // ---------------------------------------------------------------------------------------------

  private randomInt(a: number, b: number): number {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  private bind(): void {
    const watch = this.watch;
    if (!watch) return;
    const on = (type: string, handler: (e: Event) => void): void => {
      watch.addEventListener(type, handler);
      this.offs.push(() => watch.removeEventListener(type, handler));
    };
    on("pointerenter", (e) => {
      const t = (e as PointerEvent).pointerType;
      if (t !== "mouse" && t !== "pen") return;
      this.buttonHover = true;
      this.hoverSince = this.clock;
    });
    on("pointerleave", () => {
      this.buttonHover = false;
      this.pressTarget = 0;
    });
    on("pointerdown", () => {
      this.pressTarget = 1;
    });
    on("pointerup", () => {
      this.pressTarget = 0;
    });
    on("pointercancel", () => {
      this.pressTarget = 0;
    });
    on("focus", () => {
      this.buttonFocus = watch.matches(":focus-visible");
      if (this.buttonFocus) this.hoverSince = this.clock;
    });
    on("blur", () => {
      this.buttonFocus = false;
    });
    on("click", () => {
      this.buttonHover = false;
      this.options.onPress();
    });
  }
}
