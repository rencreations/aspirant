/**
 * The pair through the list (round six, changed in round seven). The drone and the doll are docked at
 * the bottom right while the list is on and stay there while Selena's frame grows into the screen:
 * the old handover (the drone lifting the doll to the top edge so she hung there for the Selena
 * section) is gone. They stay docked through the Selena section too (`selena/scene.ts` shows them
 * there) and fly off when the white sheet comes.
 *
 * The list's runtime calls `step` once a frame for the whole of its `local >= 0`.
 */
import { ensureBuddies, type BuddyPair } from "../../actors/buddies";
import type { FrameInfo, SectionCtx } from "../../kernel/types";
import { dockPlace } from "../descent/dock";

export interface ListPair {
  /**
   * `grow`: 0 to 1, the growth of Selena's frame into the screen. `edgeY`: the frame's top edge in
   * CSS pixels from the top of the screen. Neither moves the pair any more; the arguments stay so the
   * list's runtime keeps its call.
   */
  step(grow: number, edgeY: number, frame: FrameInfo): void;
  dispose(): void;
}

const dock = { x: 0, y: 0, height: 0 };

class ListPairRuntime implements ListPair {
  private pair: BuddyPair | null = null;
  private disposed = false;

  constructor(ctx: SectionCtx) {
    void ensureBuddies(ctx).then(
      (pair) => {
        if (!this.disposed) this.pair = pair;
      },
      () => undefined,
    );
  }

  step(grow: number, _edgeY: number, frame: FrameInfo): void {
    const pair = this.pair;
    if (!pair) return;
    dockPlace(frame.viewport, dock);
    const arc = Math.sin(Math.PI * grow) ** 2;
    dock.x -= arc * frame.viewport.w * 0.28;
    dock.y += arc * frame.viewport.h * 0.19;
    pair.visible = true;
    // The pair that arrives from the descent keeps the calm flight to the dock (round nine).
    pair.capFlight(true);
    pair.place(dock);
    pair.mode("dock");
  }

  dispose(): void {
    this.disposed = true;
    this.pair = null;
  }
}

export function createListPair(ctx: SectionCtx): ListPair {
  return new ListPairRuntime(ctx);
}
