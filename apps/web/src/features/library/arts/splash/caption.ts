/**
 * The letter wave of the caption, outside React. Each line is split into words and each word into
 * letters; every letter sits in a mask (`overflow: hidden`) and its inner box moves in `y` only.
 * The order is a wave from the middle of the whole caption outwards: the middle letters go first,
 * the edges last. A change first lets the old letters rise out of their masks (0.28 s, speeding up,
 * over a spread of 0.18 s), then builds the new text and lets its letters come up from below (0.40 s,
 * slowing down, over 0.40 s). The direction is always the same, whichever way the stage stepped.
 * A change that comes while this runs does not wait: the letters still showing leave from where
 * they are. Web Animations of `transform`: the compositor runs them.
 */
import { ARRIVE, LEAVE, waveDelays } from "./model";

/** Quadratic in and cubic out: the reference's power2.in and power3.out. */
const EASE_IN = "cubic-bezier(0.11, 0, 0.5, 0)";
const EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)";

export interface CaptionText {
  /** The lines of the caption, top to bottom (two for the title, one for the meta). Empty lines stay empty. */
  lines: readonly string[];
}

interface Letter {
  el: HTMLElement;
  /** Distance from the middle of the whole caption, in pixels. */
  dist: number;
}

export class CaptionWave {
  private letters: Letter[] = [];
  private anims: Animation[] = [];
  /** The newest text. The one on screen follows it once the old letters have left. */
  private pending: CaptionText | null = null;
  private phase: "idle" | "leaving" | "arriving" = "idle";
  private token = 0;
  private dead = false;

  /**
   * `lines` are the elements that hold one line each, in the order of `CaptionText.lines`. `centre`
   * is the element whose middle is the middle of the wave (the whole caption).
   */
  constructor(
    private readonly lines: readonly HTMLElement[],
    private readonly centre: HTMLElement,
  ) {}

  /** Show a text. With `instant` the letters are in place at once (a jump, the first draw under a viewer). */
  show(text: CaptionText, instant = false): void {
    if (this.dead) return;
    this.pending = text;
    if (instant) {
      this.cancel();
      this.build(text);
      this.phase = "idle";
      return;
    }
    if (this.phase === "leaving") return;
    this.leave();
  }

  /** Empty the caption at once. */
  clear(): void {
    this.pending = null;
    this.cancel();
    this.build({ lines: [] });
    this.phase = "idle";
  }

  destroy(): void {
    this.dead = true;
    this.cancel();
  }

  // ---------------------------------------------------------------------------------------------

  private cancel(): void {
    this.token += 1;
    for (const a of this.anims) a.cancel();
    this.anims = [];
  }

  /** Where a letter is now, in pixels from its rest place (a letter that is mid-move). */
  private offsetNow(el: HTMLElement): number {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    return new DOMMatrixReadOnly(t).m42;
  }

  private leave(): void {
    const mine = ++this.token;
    const live = this.letters;
    if (live.length === 0) {
      this.phase = "idle";
      this.arrive();
      return;
    }
    this.phase = "leaving";
    // Where each letter is, before the running animations are dropped (letters at rest are at zero).
    const moving = this.anims.length > 0;
    const from = live.map((l) => (moving ? this.offsetNow(l.el) : 0));
    for (const a of this.anims) a.cancel();
    this.anims = [];
    const delays = waveDelays(
      live.map((l) => l.dist),
      LEAVE.spread,
    );
    const finished: Array<Promise<unknown>> = [];
    live.forEach((l, i) => {
      const y = from[i] ?? 0;
      const a = l.el.animate(
        [{ transform: `translateY(${y}px)` }, { transform: "translateY(-110%)" }],
        {
          duration: LEAVE.duration * 1000,
          delay: (delays[i] ?? 0) * 1000,
          easing: EASE_IN,
          fill: "both",
        },
      );
      this.anims.push(a);
      finished.push(a.finished.catch(() => undefined));
    });
    void Promise.all(finished).then(() => {
      // A newer call took over (it cancelled these): nothing to do here.
      if (mine !== this.token || this.dead) return;
      this.arrive();
    });
  }

  private arrive(): void {
    const mine = ++this.token;
    for (const a of this.anims) a.cancel();
    this.anims = [];
    const text = this.pending;
    this.pending = null;
    if (!text) {
      this.build({ lines: [] });
      this.phase = "idle";
      return;
    }
    this.build(text);
    this.phase = "arriving";
    const delays = waveDelays(
      this.letters.map((l) => l.dist),
      ARRIVE.spread,
    );
    const finished: Array<Promise<unknown>> = [];
    this.letters.forEach((l, i) => {
      const a = l.el.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0%)" }], {
        duration: ARRIVE.duration * 1000,
        delay: (delays[i] ?? 0) * 1000,
        easing: EASE_OUT,
        fill: "both",
      });
      this.anims.push(a);
      finished.push(a.finished.catch(() => undefined));
    });
    void Promise.all(finished).then(() => {
      if (mine !== this.token || this.dead) return;
      // At rest the letters need no animation: drop them (their layers go with them).
      for (const a of this.anims) a.cancel();
      this.anims = [];
      this.phase = "idle";
      if (this.pending) this.leave();
    });
  }

  /** Make the letters of a text. They are measured once, here, for the wave. */
  private build(text: CaptionText): void {
    this.letters = [];
    this.lines.forEach((line, i) => {
      line.textContent = "";
      const value = text.lines[i] ?? "";
      if (!value) return;
      const frag = document.createDocumentFragment();
      value.split(" ").forEach((word, w) => {
        if (word === "") return;
        if (w > 0) frag.append(document.createTextNode(" "));
        const wrap = document.createElement("span");
        wrap.className = "cw";
        wrap.setAttribute("aria-hidden", "true");
        for (const ch of Array.from(word)) {
          const mask = document.createElement("span");
          mask.className = "cm";
          const inner = document.createElement("span");
          inner.className = "ci";
          inner.textContent = ch;
          mask.append(inner);
          wrap.append(mask);
          this.letters.push({ el: inner, dist: 0 });
        }
        frag.append(wrap);
      });
      line.append(frag);
    });
    this.measure();
  }

  private measure(): void {
    if (this.letters.length === 0) return;
    const c = this.centre.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    for (const l of this.letters) {
      const r = l.el.getBoundingClientRect();
      l.dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    }
  }
}
