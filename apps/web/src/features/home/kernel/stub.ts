/**
 * The runtime of a section that has no scene yet (the walking skeleton). It fades the section's text
 * in over the first tenth of its range and out over the last tenth, so a scroll through the page
 * shows the copy arriving and leaving in place. A section replaces it with its own runtime.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { SectionCtx, SectionRuntime } from "./types";

const ramp = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

export class StubRuntime implements SectionRuntime {
  private readonly content: HTMLElement | null;

  constructor(
    ctx: SectionCtx,
    private readonly edges: { fadeIn: boolean; fadeOut: boolean } = { fadeIn: true, fadeOut: true },
  ) {
    this.content = ctx.dom.text.querySelector<HTMLElement>("[data-home-content]");
  }

  update(local: number): void {
    const inn = this.edges.fadeIn ? ramp(local, 0, 0.1) : 1;
    const out = this.edges.fadeOut ? 1 - ramp(local, 0.9, 1) : 1;
    put(this.content, "opacity", String(Number((inn * out).toFixed(3))));
  }

  dispose(): void {
    this.content?.style.removeProperty("opacity");
  }
}
