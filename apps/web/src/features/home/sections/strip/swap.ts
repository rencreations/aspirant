/**
 * A word of the strip that changes letter by letter when its button is hovered (the owner's words of
 * 19 Nov). The server draws two layers of letters in one grid cell, the word at rest and the word of
 * the hover, so the cell is as wide as the wider of the two (nothing under it moves). This class gives
 * each letter its own moment from `swap-plan.ts` and writes only opacity and a small transform, only
 * for the letters that moved. It runs on the frame's own time, so a frozen frame holds it. The text a
 * screen reader gets is one plain copy, written once when the goal changes.
 */
import { letterValue, swapPlan } from "./swap-plan";

/** A letter that arrives rises from this share of its height; one that leaves drifts up by the second. */
const RISE = 14;
const DRIFT = 10;

export class WordSwap {
  private readonly rest: HTMLElement[];
  private readonly hover: HTMLElement[];
  private readonly plain: HTMLElement | null;
  /** Every letter of both layers: the rest layer first. */
  private readonly letters: HTMLElement[];
  private readonly value: number[];
  private readonly base: number[];
  private readonly target: number[];
  private readonly start: number[];
  private readonly shown: string[];
  private readonly words: readonly [string, string];
  private goal = 0;
  private time = 0;
  private duration = 0;

  /** `seed` makes the order of this word differ from its neighbour's. */
  constructor(
    root: ParentNode,
    private readonly seed: number,
  ) {
    const layer = (name: string): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-sw-layer="${name}"] [data-sw]`));
    this.rest = layer("rest");
    this.hover = layer("hover");
    this.plain = root.querySelector<HTMLElement>("[data-sw-plain]");
    this.letters = [...this.rest, ...this.hover];
    const word = (els: HTMLElement[]): string => els.map((el) => el.textContent ?? "").join("");
    this.words = [word(this.rest), word(this.hover)];
    this.value = this.letters.map((_, i) => (i < this.rest.length ? 1 : 0));
    this.base = this.value.slice();
    this.target = this.value.slice();
    this.start = this.letters.map(() => -1);
    this.shown = this.letters.map(() => "");
    this.time = Infinity;
  }

  /** True while a letter is still on its way (the runtime need not step an idle word). */
  get running(): boolean {
    return this.time < this.duration;
  }

  /** The word the swap is going to, 0 the word at rest and 1 the word of the hover. */
  get goalState(): number {
    return this.goal;
  }

  /** Begin changing to the word at rest (0) or the word of the hover (1). The letters move from where they are. */
  go(goal: 0 | 1): void {
    if (goal === this.goal) return;
    this.goal = goal;
    const [restWord, hoverWord] = this.words;
    const from = goal === 1 ? restWord : hoverWord;
    const to = goal === 1 ? hoverWord : restWord;
    const plan = swapPlan(from, to, this.seed + goal * 13);
    for (let i = 0; i < this.letters.length; i++) {
      this.base[i] = this.value[i]!;
      this.start[i] = -1;
    }
    // The letters of the layer that is leaving come first in `letters` when the goal is the hover.
    const leaveAt = goal === 1 ? 0 : this.rest.length;
    const leaveCount = goal === 1 ? this.rest.length : this.hover.length;
    const arriveAt = goal === 1 ? this.rest.length : 0;
    const arriveCount = goal === 1 ? this.hover.length : this.rest.length;
    for (let k = 0; k < leaveCount; k++) {
      this.target[leaveAt + k] = 0;
      this.start[leaveAt + k] = plan.out[k] ?? -1;
    }
    for (let k = 0; k < arriveCount; k++) {
      this.target[arriveAt + k] = 1;
      this.start[arriveAt + k] = plan.in[k] ?? -1;
    }
    this.time = 0;
    this.duration = plan.duration;
    if (this.plain) this.plain.textContent = to;
  }

  /** Move the letters on by `dt` seconds. */
  step(dt: number): void {
    if (!this.running) return;
    this.time += Math.max(0, dt);
    const done = this.time >= this.duration;
    for (let i = 0; i < this.letters.length; i++) {
      const v = done
        ? this.target[i]!
        : letterValue(this.base[i]!, this.target[i]!, this.start[i]!, this.time);
      this.value[i] = v;
      this.write(i, v);
    }
  }

  /** Back to the word at rest with no motion (the section is left, or the frame is held). */
  reset(): void {
    this.goal = 0;
    this.time = Infinity;
    this.duration = 0;
    for (let i = 0; i < this.letters.length; i++) {
      const v = i < this.rest.length ? 1 : 0;
      this.value[i] = v;
      this.base[i] = v;
      this.target[i] = v;
      this.start[i] = -1;
      this.shown[i] = "";
      this.letters[i]!.style.removeProperty("opacity");
      this.letters[i]!.style.removeProperty("transform");
    }
    if (this.plain) this.plain.textContent = this.words[0];
  }

  private write(i: number, v: number): void {
    const arriving = this.target[i]! > 0.5;
    const y = arriving ? (1 - v) * RISE : -(1 - v) * DRIFT;
    const css = `${v.toFixed(3)}|${y.toFixed(2)}`;
    if (css === this.shown[i]) return;
    this.shown[i] = css;
    const el = this.letters[i]!;
    el.style.opacity = v.toFixed(3);
    el.style.transform = `translate3d(0,${y.toFixed(2)}%,0)`;
  }
}
