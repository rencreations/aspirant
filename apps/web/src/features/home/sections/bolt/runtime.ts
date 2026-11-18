import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { beatFor } from "../../kernel/beat";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionScreens } from "../../kernel/where";

import { newBackdropPlan, planBackdrop } from "./backdrop-plan";
import { BoltScene } from "./scene";
import { BOLT_LAST } from "./stations";
import { wheelEnvelope, wheelItem, wheelPlace, wheelTransform, type WheelItem } from "./wheel";

/**
 * The bolt section: Silverbolt flies in from the lower right with the doll on its head and hovers in
 * the middle while the five pair names turn on the wheel, one pair for each play. The scene is shared
 * with the fall (`scene.ts`); this runtime adds the wheel and the live backdrop (a green aurora). It
 * runs on beat time: the plays of `stations.ts` move it on a clock, the lead goes with the scroll.
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
    this.items = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-bolt-item]"));
  }

  update(v: number, frame: FrameInfo): void {
    // The tail is nothing: the fall takes the scene over at the last station.
    const t = Math.min(BOLT_LAST, beatFor(v, 0, BOLT_LAST, sectionScreens("bolt")));
    this.scene.update(t, frame);
    this.wheel(t);
    const plan = planBackdrop(t, this.plan);
    this.backdrop?.set(plan.kind, plan.options);
  }

  enter(): void {
    this.scene.fresh();
  }

  /** The five names turn on a barrel: one in focus, the neighbours dim, shrink and tilt away. */
  private wheel(t: number): void {
    const place = wheelPlace(t);
    const envelope = wheelEnvelope(t);
    for (let i = 0; i < this.items.length; i += 1) {
      const el = this.items[i]!;
      const it = wheelItem(i - place, this.item);
      const opacity = it.opacity * envelope;
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
