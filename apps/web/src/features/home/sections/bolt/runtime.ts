import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { newBackdropPlan, planBackdrop } from "./backdrop-plan";
import { wheelAt, wheelShow, whiteRise } from "./journey";
import { BoltScene } from "./scene";
import { BOLT_SCREENS } from "./stations";
import { wheelItem, wheelTransform, type WheelItem } from "./wheel";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/**
 * How much of the text is ink: the white's solid part reaches the middle of the screen (where the wheel
 * stands) when `rise` is about 0.37 and has passed it at about 0.46 (seen on 1440 by 900). The white copy gives way to the ink
 * copy by opacity only.
 */
export function inkShare(rise: number): number {
  return smooth((rise - 0.37) / 0.09);
}

/**
 * The bolt section: Silverbolt flies in from the lower right with the doll on its head, its head crawls
 * through the middle while the five pair names turn on the wheel, and the white rises from the bottom
 * as the blue backdrop fades to black. The scene is shared with the fall (`scene.ts`). Plain scroll:
 * `update` gets the scroll's own `local`, and everything is a pure function of it.
 */
class BoltRuntime implements SectionRuntime {
  private readonly scene: BoltScene;
  private readonly items: HTMLElement[];
  private readonly lights: HTMLElement[];
  private readonly inks: HTMLElement[];
  private readonly item: WheelItem = { y: 0, z: 0, scale: 1, rotX: 0, opacity: 0 };
  private readonly plan = newBackdropPlan();

  constructor(
    ctx: SectionCtx,
    private readonly backdrop: Backdrop | null,
  ) {
    this.scene = BoltScene.acquire(ctx);
    const text = ctx.dom.text;
    this.items = Array.from(text.querySelectorAll<HTMLElement>("[data-bolt-item]"));
    this.lights = Array.from(text.querySelectorAll<HTMLElement>("[data-bolt-light]"));
    this.inks = Array.from(text.querySelectorAll<HTMLElement>("[data-bolt-ink]"));
  }

  update(local: number, frame: FrameInfo): void {
    const u = local * BOLT_SCREENS;
    this.scene.update(u, frame);
    this.wheel(u);
    const plan = planBackdrop(u, this.plan);
    if (plan.on) this.backdrop?.set(plan.kind, plan.options);
  }

  enter(): void {
    this.scene.fresh();
  }

  /** The five names turn on a barrel with the scroll: one in focus, the neighbours dim and tilt away. */
  private wheel(u: number): void {
    const a = wheelAt(u);
    const show = wheelShow(u);
    const ink = inkShare(whiteRise(u));
    for (let i = 0; i < this.items.length; i += 1) {
      const el = this.items[i]!;
      const it = wheelItem(i - a, this.item);
      const opacity = it.opacity * show;
      // A name that cannot be seen is only made invisible: its place is not worked out.
      if (opacity > 0.002) put(el, "transform", wheelTransform(it));
      put(el, "opacity", opacity.toFixed(3));
      put(this.lights[i], "opacity", (1 - ink).toFixed(3));
      put(this.inks[i], "opacity", ink.toFixed(3));
    }
  }

  dispose(): void {
    for (const el of [...this.items, ...this.lights, ...this.inks]) {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
    }
    this.scene.release();
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  // The backdrop never throws: with no WebGL it is a no-op and the plain ground stays.
  const backdrop = await ensureBackdrop(ctx).catch(() => null);
  return new BoltRuntime(ctx, backdrop);
}
