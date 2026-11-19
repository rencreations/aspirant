/**
 * The aspirants: the wall of big tilted official pictures on the left 65 percent, the owner's words on the
 * right (round three, 20 Nov 2026). The pictures slide with the scroll (`FieldScene.follow`), a card
 * lifts when hovered, the cursor says VIEW, a press opens the preview window
 * (`features/home/preview/`). The words are a trigger (`words.ts`): a short clock that plays them in when
 * the wall has landed and out when the visitor leaves, whatever the scroll does in between. The close is
 * a scroll zone (`index.ts`): the clip opens and the wall becomes the rows.
 *
 * Its `local` is the section's own (`index.ts`): negative in the lead (the hero's zone: the hero draws
 * the scene), 1 at rest, 1 to 2 across the close. From 1 on the field, the clip and the drone are set by
 * `FieldScene` from the story position (`aspirantsS`). This runtime owns the words, the scroll hold
 * while the preview is open and the bar's logo (it is the bar's from the end of the hero's morph on).
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
import { aspirantsS } from "../hero/timeline";

import { lineAt, stepWordsClock, WORDS_SHOW_AT, wordsShown } from "./words";

/** The words rise this far (px) as they arrive and sink as they leave. */
const RISE_PX = 28;

class AspirantsRuntime implements SectionRuntime {
  private readonly scene: FieldScene;
  private readonly lines: HTMLElement[];
  private release: (() => void) | null = null;
  /** The words' clock (seconds, 0 to `WORDS_SECONDS`) and whether the trigger says they are shown. */
  private clock = 0;
  private shown = false;
  /** What was last written (a still page writes nothing). */
  private wordsAt = Number.NaN;
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
    // The pictures slide with the page's scroll, wherever the visitor is (this section runs in the
    // hero's lead too), so the plane is exact when the wall lands and when the rows take it over.
    this.scene.follow(frame.S, frame.viewport);
    // Before the wall has landed the hero draws the scene (its logo, its burst, its gaze). In the hero's
    // zone this section's `v` already stands at its rest (1), so the scroll says where the zone ends.
    if (v >= 1 && frame.S >= WORDS_SHOW_AT) {
      this.scene.update({ S, viewport: frame.viewport, entrance: 1 });
      // The bar's own logo is the logo from the end of the hero's morph on.
      showNavLogo(true);
    }
    // Nothing behind the wall (the owner: no dynamic background on the right): the backdrop is
    // there only from the rows on, and this call stays so the answer is one function of S.
    const back = backdropAt(S);
    if (back) this.backdrop?.set(back.kind, back.options);
    this.words(frame, v);
  }

  /**
   * The words: a trigger on a clock. The three lines rise in one after another when the wall has landed
   * and sink out when the visitor leaves the rest, back or on. The scroll never moves them.
   */
  private words(frame: FrameInfo, v: number): void {
    this.shown = wordsShown(this.shown, frame.S, v);
    this.clock = stepWordsClock(this.clock, this.shown, frame.dt);
    if (this.clock === this.wordsAt) return;
    this.wordsAt = this.clock;
    for (let k = 0; k < this.lines.length; k++) {
      const el = this.lines[k]!;
      const a = lineAt(this.clock, k);
      put(el, "opacity", a.toFixed(3));
      put(el, "transform", `translate3d(0, ${((1 - a) * RISE_PX).toFixed(2)}px, 0)`);
      // Not there yet, or gone: it takes no press. It stays in the page's tree and the tab order (a
      // hidden link could not be reached by a reader or the keyboard): a focus on it moves the page
      // to where it shows (`home-stage.tsx`).
      put(el, "pointer-events", a < 0.01 ? "none" : "");
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
