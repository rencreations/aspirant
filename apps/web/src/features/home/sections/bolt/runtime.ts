import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { BOLT_SCREENS } from "./journey";
import { BoltScene } from "./scene";
import { wheelEnvelope, wheelItem, wheelPlace, wheelTransform, type WheelItem } from "./wheel";

const smooth = (v: number): number => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

/**
 * The bolt section: Silverbolt flies in from the lower right with the doll on its head, hovers in the
 * middle while the five pair names turn on the wheel, and leaves toward the upper left. The scene is
 * shared with the fall (`scene.ts`); this runtime adds the DOM of the section: the wheel and the bloom.
 */
class BoltRuntime implements SectionRuntime {
  private readonly scene: BoltScene;
  private readonly items: HTMLElement[];
  private readonly tint: HTMLElement | null;
  private readonly glow: HTMLElement | null;
  private readonly band: HTMLElement | null;
  private readonly item: WheelItem = { y: 0, z: 0, scale: 1, rotX: 0, opacity: 0 };

  constructor(ctx: SectionCtx) {
    this.scene = BoltScene.acquire(ctx);
    this.items = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-bolt-item]"));
    this.tint = ctx.dom.below.querySelector<HTMLElement>("[data-bolt-tint]");
    this.glow = ctx.dom.below.querySelector<HTMLElement>("[data-bolt-glow]");
    this.band = ctx.dom.below.querySelector<HTMLElement>("[data-bolt-band]");
  }

  update(local: number, frame: FrameInfo): void {
    const t = local * BOLT_SCREENS;
    this.scene.update(t, frame);
    this.wheel(t);
    this.bloom(t);
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

  /**
   * The ground turns dark green-black as the dragon comes in (over the storm ground, so no ground
   * crosses another), and a green bloom rises from below; both sink when the dragon has gone.
   */
  private bloom(t: number): void {
    put(this.tint, "opacity", (smooth((t + 0.5) / 0.8) * (1 - smooth((t - 3.3) / 1.1))).toFixed(3));
    const b = smooth((t + 0.4) / 1.6) * (1 - smooth((t - 3.2) / 1.2));
    put(this.glow, "opacity", b.toFixed(3));
    put(this.glow, "transform", `translate3d(0, ${((1 - b) * 35).toFixed(2)}%, 0)`);
    put(this.band, "opacity", (b * 0.9).toFixed(3));
  }

  dispose(): void {
    for (const el of this.items) {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
    }
    this.tint?.style.removeProperty("opacity");
    this.glow?.style.removeProperty("opacity");
    this.glow?.style.removeProperty("transform");
    this.band?.style.removeProperty("opacity");
    this.scene.release();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new BoltRuntime(ctx);
}
