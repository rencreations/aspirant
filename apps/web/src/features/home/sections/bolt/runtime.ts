import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { newBackdropPlan, planBackdrop } from "./backdrop-plan";
import { wheelAt, wheelShow } from "./journey";
import { BoltScene } from "./scene";
import { BOLT_SCREENS } from "./stations";
import { wheelItem, wheelTransform, type WheelItem } from "./wheel";

/**
 * The bolt section: Silverbolt flies in from the lower right with the doll on its head, its head crawls
 * through the middle while the five pair names turn on the wheel, and the white rises from the bottom
 * as the pale blue mist thins out (light mode only). The scene is shared with the fall (`scene.ts`).
 * Plain scroll: `update` gets the scroll's own `local`, and everything is a pure function of it.
 */
class BoltRuntime implements SectionRuntime {
  private readonly scene: BoltScene;
  private readonly items: HTMLElement[];
  private readonly item: WheelItem = { y: 0, z: 0, scale: 1, rotX: 0, opacity: 0 };
  private readonly plan = newBackdropPlan();

  constructor(
    ctx: SectionCtx,
    private readonly backdrop: Backdrop | null,
  ) {
    this.scene = BoltScene.acquire(ctx);
    const text = ctx.dom.text;
    this.items = Array.from(text.querySelectorAll<HTMLElement>("[data-bolt-item]"));
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
    for (let i = 0; i < this.items.length; i += 1) {
      const el = this.items[i]!;
      const it = wheelItem(i - a, this.item);
      const opacity = it.opacity * show;
      // A name that cannot be seen is only made invisible: its place is not worked out.
      if (opacity > 0.002) put(el, "transform", wheelTransform(it));
      put(el, "opacity", opacity.toFixed(3));
    }
  }

  dispose(): void {
    for (const el of this.items) {
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
