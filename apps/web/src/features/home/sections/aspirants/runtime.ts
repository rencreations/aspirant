/**
 * The aspirants (screens 4.2 to 5.8): the wall of wide official splash art slides by itself under
 * the owner's words on the right. A card lifts when hovered and stops the wall, the cursor says
 * VIEW, a press opens the preview window (`features/home/preview/`). At the end the words fold away,
 * the wall opens into the full screen rows at the same angle and the glide stops (joint J2).
 *
 * The field, the clip, the glide and the drone are set by `FieldScene` from the absolute scroll
 * (the hero runs the same code in the overlap of the two ranges). This runtime owns the words, the
 * scroll hold while the preview is open, and the bar's logo (it is the bar's from the end of the
 * hero's morph on).
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { ensureField, type FieldActor } from "../../fx/image-field";
import { showNavLogo } from "../../fx/logo/dom";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { releaseFull } from "../../preview/files";
import { useHomePreview } from "../../preview/store";
import { FieldScene } from "../hero/scene";
import { aspirantsS, lineIn, lineOut } from "../hero/timeline";

/** The words fold up on their top edge by this much (degrees) as they go. */
const FOLD_DEG = -86;
/** The words rise this far (px) as they arrive. */
const RISE_PX = 26;

class AspirantsRuntime implements SectionRuntime {
  private readonly scene: FieldScene;
  private readonly lines: HTMLElement[];
  private release: (() => void) | null = null;
  /** The position the words were last written for (a still page writes nothing). */
  private wordsAt = Number.NaN;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly ctx: SectionCtx,
    field: FieldActor,
    drone: DroneActor | null,
  ) {
    this.scene = new FieldScene(field, drone);
    this.lines = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-home-line]"));
    // A window opens: the page is held and the wall rests. It closes: both are given back.
    this.unsubscribe = useHomePreview.subscribe((state, previous) => {
      if (state.open && !previous.open) this.hold();
      else if (!state.open && previous.open) this.unhold();
    });
  }

  update(local: number, frame: FrameInfo): void {
    const S = aspirantsS(local);
    this.scene.update({ S, viewport: frame.viewport, entrance: 1 });
    // The bar's own logo is the logo from the end of the hero's morph on.
    showNavLogo(true);
    this.words(S);
  }

  /** Line `k` rises in one after another, and at the end folds up and goes, the first line first. */
  private words(S: number): void {
    if (Math.abs(S - this.wordsAt) < 1e-5) return;
    this.wordsAt = S;
    for (let k = 0; k < this.lines.length; k++) {
      const el = this.lines[k]!;
      const a = lineIn(S, k);
      const b = lineOut(S, k);
      put(el, "opacity", (a * (1 - b)).toFixed(3));
      put(
        el,
        "transform",
        `perspective(720px) translate3d(0, ${((1 - a) * RISE_PX).toFixed(2)}px, 0) rotateX(${(b * FOLD_DEG).toFixed(2)}deg)`,
      );
      // Not there yet, or folded away: a link in it must not be reachable by the keyboard or a press.
      put(el, "visibility", a * (1 - b) < 0.01 ? "hidden" : "visible");
    }
  }

  private hold(): void {
    this.release?.();
    this.release = this.ctx.scroll.hold(10 * 60_000);
  }

  private unhold(): void {
    this.release?.();
    this.release = null;
  }

  leave(): void {
    // The visitor was moved away with a window open (a jump): the window goes with the section.
    useHomePreview.getState().close();
    this.unhold();
  }

  dispose(): void {
    this.unsubscribe();
    useHomePreview.getState().close();
    this.unhold();
    this.scene.dispose();
    releaseFull();
    for (const el of this.lines) {
      for (const prop of ["opacity", "transform", "visibility"]) el.style.removeProperty(prop);
    }
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [field, drone] = await Promise.all([ensureField(ctx), ensureDrone(ctx).catch(() => null)]);
  return new AspirantsRuntime(ctx, field, drone);
}
