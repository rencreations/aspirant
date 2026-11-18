/**
 * The tie between the engine and the backdrop, kept tiny on purpose: the engine chunk is waited for
 * by the loading screen, so it must not pull in the shaders. The engine binds the host element (the
 * box in the ground stack) to its stage and runs `draw` from its clock; the backdrop, when a section
 * first asks for it, finds the host here and puts itself in.
 */
import type { FrameInfo } from "../../kernel/types";
import type { Stage } from "../../kernel/stage";

/** What the backdrop gives the engine: a draw per frame and a way to let go. */
export interface BackdropDrawable {
  drawFrame(frame: FrameInfo, jumped: boolean): void;
  dispose(): void;
}

interface Entry {
  host: HTMLElement | null;
  drawable: BackdropDrawable | null;
}

const entries = new WeakMap<Stage, Entry>();

export interface BackdropBinding {
  /** Called every frame by the engine, after the sections have run. */
  draw(frame: FrameInfo, jumped: boolean): void;
  dispose(): void;
}

/** Bind the host element of the ground stack to a stage. `host` is null when the page has none. */
export function bindBackdrop(stage: Stage, host: HTMLElement | null): BackdropBinding {
  const entry: Entry = { host, drawable: null };
  entries.set(stage, entry);
  return {
    draw: (frame, jumped) => {
      entry.drawable?.drawFrame(frame, jumped);
    },
    dispose: () => {
      entry.drawable?.dispose();
      entry.drawable = null;
      if (entries.get(stage) === entry) entries.delete(stage);
    },
  };
}

/** The host a stage was bound to, or null (a page without one, or an engine that is gone). */
export function backdropHost(stage: Stage): HTMLElement | null {
  return entries.get(stage)?.host ?? null;
}

/** The backdrop tells the engine it exists, so the engine can draw it. */
export function attachBackdrop(stage: Stage, drawable: BackdropDrawable): void {
  const entry = entries.get(stage);
  if (entry) entry.drawable = drawable;
}
