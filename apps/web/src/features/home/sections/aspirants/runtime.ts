/**
 * The aspirants: the wall of wide official splash art slides by itself under the owner's words on the
 * right. A card lifts when hovered and stops the wall, the cursor says VIEW, a press opens the preview
 * window (`features/home/preview/`). The close is a play: the words fold away, the wall opens into the
 * full screen rows at the same angle, the glide stops and the ground goes dark (joint J2).
 *
 * Its `local` is virtual (`index.ts`): 0 to 1 runs in step with the hero's play and only moves the
 * words (the hero draws the scene), 1 to 2 is the close. From 1 on the field, the clip, the glide and
 * the drone are set by `FieldScene` from the story position (`aspirantsS`). This runtime owns the
 * words, the scroll hold while the preview is open, the dark ground and the bar's logo (it is the
 * bar's from the end of the hero's morph on).
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { ensureField, type FieldActor } from "../../fx/image-field";
import { showNavLogo } from "../../fx/logo/dom";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { releaseFull } from "../../preview/files";
import { useHomePreview } from "../../preview/store";
import { backdropAt } from "../backdrops";
import { FieldScene } from "../hero/scene";
import { aspirantsS, lineIn, lineOut } from "../hero/timeline";

/** The words leave to the right by this much of the screen's width as they go (the first line first). */
const EXIT_SHARE = 0.16;
/** The words rise this far (px) as they arrive. */
const RISE_PX = 26;

class AspirantsRuntime implements SectionRuntime {
  private readonly scene: FieldScene;
  private readonly lines: HTMLElement[];
  private release: (() => void) | null = null;
  /** The position the words were last written for (a still page writes nothing). */
  private wordsAt = Number.NaN;
  private wordsW = 0;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly ctx: SectionCtx,
    field: FieldActor,
    drone: DroneActor | null,
    private readonly backdrop: Backdrop | null,
  ) {
    this.scene = new FieldScene(field, drone);
    this.lines = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("[data-home-line]"));
    // A window opens: the page is held and the wall rests. It closes: both are given back.
    this.unsubscribe = useHomePreview.subscribe((state, previous) => {
      if (state.open && !previous.open) this.hold();
      else if (!state.open && previous.open) this.unhold();
    });
  }

  update(v: number, frame: FrameInfo): void {
    const S = aspirantsS(v);
    // Before the wall has landed the hero draws the scene (its logo, its burst, its gaze): this
    // section only brings the words in, in step with it.
    if (v >= 1) {
      this.scene.update({ S, viewport: frame.viewport, entrance: 1 });
      // The bar's own logo is the logo from the end of the hero's morph on.
      showNavLogo(true);
    }
    const back = backdropAt(S);
    this.backdrop?.set(back.kind, back.options);
    this.words(S, frame.viewport.w);
  }

  /** Line `k` rises in one after another, and at the end slides out to the right and fades, the first line first. */
  private words(S: number, width: number): void {
    if (Math.abs(S - this.wordsAt) < 1e-5 && width === this.wordsW) return;
    this.wordsAt = S;
    this.wordsW = width;
    for (let k = 0; k < this.lines.length; k++) {
      const el = this.lines[k]!;
      const a = lineIn(S, k);
      const b = lineOut(S, k);
      put(el, "opacity", (a * (1 - b)).toFixed(3));
      put(
        el,
        "transform",
        `translate3d(${(b * EXIT_SHARE * width).toFixed(1)}px, ${((1 - a) * RISE_PX).toFixed(2)}px, 0)`,
      );
      // Not there yet, or folded away: it takes no press. It stays in the page's tree and the tab
      // order (a hidden link could not be reached by a reader or the keyboard): a focus on it moves the
      // page to where it shows (`home-stage.tsx`).
      put(el, "pointer-events", a * (1 - b) < 0.01 ? "none" : "");
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
      for (const prop of ["opacity", "transform", "pointer-events"]) el.style.removeProperty(prop);
    }
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [field, drone, backdrop] = await Promise.all([
    ensureField(ctx),
    ensureDrone(ctx).catch(() => null),
    ensureBackdrop(ctx).catch(() => null),
  ]);
  return new AspirantsRuntime(ctx, field, drone, backdrop);
}
