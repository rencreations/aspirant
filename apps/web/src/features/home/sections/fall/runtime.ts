import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { BOLT_SCREENS, FALL_SCREENS } from "../bolt/journey";
import { BoltScene } from "../bolt/scene";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const easeOut = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3);

/** When each line arrives and leaves, in the section's local 0 to 1: [in from, in to, out from, out to]. */
const TIMES = [
  [0.1, 0.23, 0.4, 0.5],
  [0.47, 0.6, 0.86, 0.97],
] as const;

/**
 * The fall: the doll is thrown off the dragon's head and falls with a camera that follows and zooms
 * (the scene is shared with the bolt section), and two big lines come in one after the other on each
 * side of her. "5 Phases" slides in from both edges and leaves to them; "10 Characters" rises from
 * below, as if left behind by the fall, and leaves upward. Transform and opacity only.
 */
class FallRuntime implements SectionRuntime {
  private readonly scene: BoltScene;
  private readonly lefts: HTMLElement[];
  private readonly rights: HTMLElement[];

  constructor(ctx: SectionCtx) {
    this.scene = BoltScene.acquire(ctx);
    this.lefts = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-fall-left]"));
    this.rights = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-fall-right]"));
  }

  update(local: number, frame: FrameInfo): void {
    this.scene.update(BOLT_SCREENS + local * FALL_SCREENS, frame);
    for (let i = 0; i < this.lefts.length; i += 1) {
      const [a, b, c, d] = TIMES[Math.min(i, TIMES.length - 1)]!;
      // The right half comes a little after the left one and leaves a little after it.
      this.piece(this.lefts[i], i, -1, local, a, b, c, d);
      this.piece(this.rights[i], i, 1, local, a + 0.02, b + 0.02, c + 0.015, d + 0.015);
    }
  }

  /** One half of a line: `side` is -1 for the left half and 1 for the right half. */
  private piece(
    el: HTMLElement | undefined,
    line: number,
    side: -1 | 1,
    local: number,
    a: number,
    b: number,
    c: number,
    d: number,
  ): void {
    if (!el) return;
    const inn = easeOut((local - a) / (b - a));
    const out = smooth((local - c) / (d - c));
    const opacity = inn * (1 - out);
    let x: number;
    let y: number;
    let scale = 1;
    if (line === 0) {
      // From the edges to the doll, and back to the edges.
      x = side * (1 - inn) * 34 + side * out * 34;
      y = 0;
    } else {
      // From below, and out through the top.
      x = side * (1 - inn) * 6;
      y = (1 - inn) * 26 - out * 38;
      scale = 0.92 + 0.08 * inn;
    }
    put(el, "opacity", opacity.toFixed(3));
    put(
      el,
      "transform",
      `translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}vh, 0) scale(${scale.toFixed(3)})`,
    );
  }

  dispose(): void {
    for (const el of [...this.lefts, ...this.rights]) {
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
    }
    this.scene.release();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new FallRuntime(ctx);
}
