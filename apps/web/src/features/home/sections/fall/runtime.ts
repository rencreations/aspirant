import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { newBackdropPlan, planBackdrop } from "../bolt/backdrop-plan";
import { easeInOut } from "../bolt/journey";
import { BoltScene } from "../bolt/scene";
import { BOLT_SCREENS, FALL_AT, FALL_SCREENS } from "../bolt/stations";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
/** 0 before the range starts, 1 after it ends. */
const seg = (v: number, range: readonly [number, number]): number =>
  clamp01((v - range[0]) / (range[1] - range[0]));

/** How far a line rises while it comes in, and again while it leaves, in viewport heights over 100. */
const RISE_VH = 3.5;

/**
 * The fall: the doll falls from where she let go and the camera eases in and out to centre her
 * (the scene is shared with the bolt section), then FIVE | PHASES come in smoothly once she is centred
 * and the camera is still, turn into TEN | HEROES, and leave upward while the hand rises. The left
 * word is centred in the left half of the screen, the right one in the right half, all at the middle of
 * the height. Plain scroll, no zones. Transform and opacity only.
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

  update(local: number, frame: FrameInfo): void {
    // The scroll since the fall's start: the lead (negative) and the tail go with it.
    const f = local * FALL_SCREENS;
    const u = BOLT_SCREENS + f;
    this.scene.update(u, frame);
    const plan = planBackdrop(u, this.plan);
    if (plan.on) this.backdrop?.set(plan.kind, plan.options);

    // Line one stands from `one` to `swap`, line two from `swap` to `out`; the last one leaves upward.
    const inOne = seg(f, FALL_AT.one);
    const outOne = seg(f, FALL_AT.swap);
    const inTwo = seg(f, FALL_AT.swap);
    const outTwo = seg(f, FALL_AT.out);
    this.piece(0, easeInOut(inOne) * (1 - smooth(outOne)), inOne, outOne);
    this.piece(1, easeInOut(inTwo) * (1 - smooth(outTwo)), inTwo, outTwo);
  }

  /**
   * One line (a left half and a right half): `opacity` is how much of it shows, `inn` how far it has come
   * in and `out` how far it has left. It rises into place and rises away, the right half a touch later.
   */
  private piece(line: number, opacity: number, inn: number, out: number): void {
    const l = this.lefts[line];
    const r = this.rights[line];
    const leave = easeInOut(out) * RISE_VH;
    const yl = (1 - easeInOut(inn)) * RISE_VH - leave;
    const yr = (1 - easeInOut(clamp01((inn - 0.08) / 0.92))) * RISE_VH - leave;
    put(l, "opacity", opacity.toFixed(3));
    put(l, "transform", `translate3d(0, ${yl.toFixed(2)}vh, 0)`);
    put(r, "opacity", opacity.toFixed(3));
    put(r, "transform", `translate3d(0, ${yr.toFixed(2)}vh, 0)`);
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
