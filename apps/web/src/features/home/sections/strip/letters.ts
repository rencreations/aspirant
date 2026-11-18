/**
 * Letters that come in one by one. The server markup splits each word into letter elements
 * (`data-ch`); a group keeps which of them are on and writes only the letters whose state changed.
 * The moment of each letter is `letterMoment` (a fixed hash), so the words appear in no order and
 * leave the same way when the visitor scrolls back.
 */
import { letterIn } from "./journey";

export class LetterGroup {
  private readonly chars: HTMLElement[];
  private readonly on: boolean[];
  private last = Number.NaN;

  /** `salt` makes the order of this group differ from the others'. */
  constructor(
    root: ParentNode,
    group: string,
    private readonly salt = 0,
  ) {
    this.chars = Array.from(
      root.querySelectorAll<HTMLElement>(`[data-strip-chars="${group}"] [data-ch]`),
    );
    this.on = this.chars.map(() => false);
  }

  get length(): number {
    return this.chars.length;
  }

  /** Show the letters that have come in at `amount` (0 none, 1 all). `spread` is how much of the progress the moments cover. */
  set(amount: number, spread = 0.8): void {
    if (amount === this.last) return;
    this.last = amount;
    for (let i = 0; i < this.chars.length; i++) {
      const on = letterIn(i, amount, spread, this.salt);
      if (on === this.on[i]) continue;
      this.on[i] = on;
      this.chars[i]!.style.opacity = on ? "1" : "0";
    }
  }

  /** Put the letters back to what the server drew (a section that goes). */
  clear(): void {
    for (const el of this.chars) el.style.removeProperty("opacity");
    this.on.fill(false);
    this.last = Number.NaN;
  }
}
