import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { beatFor } from "../../kernel/beat";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd, sectionScreens } from "../../kernel/where";
import { newBackdropPlan, planBackdrop } from "../bolt/backdrop-plan";
import { BoltScene } from "../bolt/scene";
import { BEAT, BOLT_LAST } from "../bolt/stations";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const easeOut = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3);

/**
 * When each line arrives, in beat time: [in from, in to]. "5 Phases" leaves again at `PHASES_OUT`;
 * "10 Characters" stays at the rest and leaves with the scroll, in the screens before the section's
 * end (the hand's fingertips come up there): `CHARACTERS_OUT` is [from, to] in screens past that end.
 */
const IN = [
  [4.25, 4.6],
  [5.25, 5.65],
] as const;
const PHASES_OUT = [5.1, 5.4] as const;
const CHARACTERS_OUT = [-0.45, -0.1] as const;

/**
 * The fall: the doll is thrown off the dragon's head and falls with a camera that follows and zooms
 * (the scene is shared with the bolt section), one play of about three seconds, and two big lines come
 * in one after the other on each side of her. "5 Phases" slides in from both edges and leaves to them;
 * "10 Characters" rises from below, as if left behind by the fall, and stands. It leaves upward as the
 * page goes on to the hand. Transform and opacity only.
 */
class FallRuntime implements SectionRuntime {
  private readonly scene: BoltScene;
  private readonly lefts: HTMLElement[];
  private readonly rights: HTMLElement[];
  private readonly plan = newBackdropPlan();

  constructor(
    ctx: SectionCtx,
    private readonly backdrop: Backdrop | null,
  ) {
    this.scene = BoltScene.acquire(ctx);
    this.lefts = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-fall-left]"));
    this.rights = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-fall-right]"));
  }

  /** The dragon and the doll are built: the throw does not fire before (the kernel's ready gate). */
  ready(): boolean {
    return this.scene.gate.done;
  }

  update(v: number, frame: FrameInfo): void {
    // The lead rests on the bolt's last station: both sections draw the same moment there.
    const t = Math.max(BOLT_LAST, beatFor(v, BOLT_LAST, BEAT.end, sectionScreens("fall")));
    this.scene.update(t, frame);
    const plan = planBackdrop(t, this.plan);
    this.backdrop?.set(plan.kind, plan.options);
    const ts = frame.S - sectionEnd("fall");
    for (let i = 0; i < this.lefts.length; i += 1) {
      const [a, b] = IN[Math.min(i, IN.length - 1)]!;
      // The right half comes a little after the left one.
      const out0 = i === 0 ? smooth((t - PHASES_OUT[0]) / (PHASES_OUT[1] - PHASES_OUT[0])) : 0;
      const out1 =
        i === 0 ? 0 : smooth((ts - CHARACTERS_OUT[0]) / (CHARACTERS_OUT[1] - CHARACTERS_OUT[0]));
      const out = i === 0 ? out0 : out1;
      this.piece(this.lefts[i], i, -1, easeOut((t - a) / (b - a)), out);
      this.piece(this.rights[i], i, 1, easeOut((t - a - 0.06) / (b - a)), out);
    }
  }

  /** One half of a line: `side` is -1 for the left half and 1 for the right half. */
  private piece(
    el: HTMLElement | undefined,
    line: number,
    side: -1 | 1,
    inn: number,
    out: number,
  ): void {
    if (!el) return;
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

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const backdrop = await ensureBackdrop(ctx).catch(() => null);
  return new FallRuntime(ctx, backdrop);
}
