import type { WebGLRenderer } from "three";

import { ScenePass, type Stage } from "../../kernel/stage";
import type { FrameInfo } from "../../kernel/types";

/** What a simulation gives its pass: whether anything is alive, and the step it takes before drawing. */
export interface PassHooks {
  /** The pass is drawn only while this is true: an idle page pays nothing. */
  live(): boolean;
  /** Called once a frame, as late as possible: the actors have moved, the stage has not drawn yet. */
  step(dt: number): void;
}

/**
 * A shared pixel pass that steps its own simulation as the first thing in its draw. The kernel calls
 * `actor.update` only for an actor a section shows, and the marks and the trails are not shown by
 * any section: they are alive while something is. Stepping in the draw also puts the simulation
 * after every actor's own update, so an anchor an actor moved this frame is followed without lag,
 * and gives it the stage's clock (a frozen scene, `dt` 0, freezes the marks too).
 *
 * It is a `ScenePass`, so `stage.scenePass(name, ...)` finds it by name like any shared pass.
 */
export class StepPass extends ScenePass {
  constructor(
    name: string,
    order: number,
    w: number,
    h: number,
    private readonly hooks: PassHooks,
  ) {
    super(name, order, "ortho", w, h);
  }

  override active(): boolean {
    return this.hooks.live();
  }

  override render(renderer: WebGLRenderer, frame?: FrameInfo): void {
    this.hooks.step(frame?.dt ?? 0);
    super.render(renderer);
  }
}

/**
 * Make the pass and put it on the stage. Throws when a pass of that name already exists (someone
 * asked the stage for `scenePass("marks")` directly: ask `ensureMarks` instead).
 */
export function addStepPass(
  stage: Stage,
  name: string,
  order: number,
  hooks: PassHooks,
): { pass: StepPass; remove: () => void } {
  if (stage.passNames().includes(name)) {
    throw new Error(`the "${name}" pass already exists: ask for it through its ensure function`);
  }
  const pass = new StepPass(name, order, stage.width, stage.height, hooks);
  const remove = stage.addPass(pass);
  return { pass, remove };
}
