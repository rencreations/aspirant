/**
 * The end of the list: the joint J8, written for the pair (round six, 20 Nov 2026). The pair are docked
 * at the bottom right while the list is on. When the last frame (Selena's) grows into the screen, the
 * drone flies across with the doll on its head, lifts her to the top edge of the growing frame, she
 * lets go of it, takes hold of the edge with one hand and hangs there, and the drone flies off to the
 * upper right. At `grow = 1` the doll is exactly the picture the Selena section starts from
 * (`selena/hang.ts`), so the joint has no seam. A pure function of `grow` and the edge, so the
 * scroll plays it both ways (going back, she is put on the drone's head again).
 *
 * The list's runtime calls `step` once a frame for the whole of its `local >= 0`; before the growth
 * it keeps the pair at the dock (`descent/dock.ts`) and does nothing else.
 */
import { ensureBuddies, type BuddyPair } from "../../actors/buddies";
import { isCompactView } from "../../drone-route";
import type { FrameInfo, SectionCtx } from "../../kernel/types";
import { dockPlace } from "../descent/dock";
import { holdDoll } from "../selena/hang";
import { mix, seg, smooth } from "../vp";

import { dollHang } from "./selena-frame";

export interface ListPair {
  /**
   * `grow`: 0 to 1, the growth of Selena's frame into the screen (0 until it begins, exactly 1 at the
   * end). `edgeY`: the frame's top edge in CSS pixels from the top of the screen (0 when grown).
   */
  step(grow: number, edgeY: number, frame: FrameInfo): void;
  dispose(): void;
}

/** The share of `grow` in which the drone flies from the dock to the edge with her on its head. */
const LIFT: readonly [number, number] = [0.04, 0.5];
/** In which she lets go of the drone's head and takes hold of the edge. */
const GRAB: readonly [number, number] = [0.5, 0.78];
/** In which the drone leaves (it starts as she lets go). */
const LEAVE: readonly [number, number] = [0.58, 0.97];
/** The drone's height at the edge, as a share of the screen's height (it comes a little closer). */
const LIFT_HEIGHT = 0.17;
/** The drone's middle stands this many of its heights under the doll's hand when it lifts her. */
const UNDER = 1.0;

const dock = { x: 0, y: 0, height: 0 };
const put = { x: 0, y: 0, height: 0 };
const from = { x: 0, y: 0, height: 0 };

class ListPairRuntime implements ListPair {
  private pair: BuddyPair | null = null;
  private disposed = false;
  /** Where she was when she let go (stage pixels), kept while she is free. */
  private readonly held = { x: 0, y: 0, height: 0, set: false };

  constructor(private readonly ctx: SectionCtx) {
    void ensureBuddies(ctx).then(
      (pair) => {
        if (!this.disposed) this.pair = pair;
      },
      () => undefined,
    );
  }

  step(grow: number, edgeY: number, frame: FrameInfo): void {
    const pair = this.pair;
    if (!pair) return;
    const vp = frame.viewport;
    const g = Math.min(1, Math.max(0, grow));
    dockPlace(vp, dock);
    pair.visible = true;

    if (g <= 0) {
      this.held.set = false;
      pair.place(dock);
      pair.mode("dock");
      return;
    }

    const hang = dollHang(vp);
    // Where her hand is when she holds the edge: the edge itself, a little inside the screen (it is
    // `hang.y` when the frame has grown and `edgeY` is 0).
    const handY = hang.y - edgeY;
    const lift = smooth(seg(g, LIFT[0], LIFT[1]));
    const compact = isCompactView(vp.w, vp.h);
    const height = mix(dock.height, (compact ? 0.13 : LIFT_HEIGHT) * vp.h, lift);
    const atX = hang.x;
    const atY = handY - UNDER * height;

    // The drone: dock to the edge, then off to the upper right.
    const leave = smooth(seg(g, LEAVE[0], LEAVE[1]));
    put.x = mix(mix(dock.x, atX, lift), 0.7 * vp.w, leave);
    put.y = mix(mix(dock.y, atY, lift), 0.62 * vp.h, leave);
    put.height = mix(height, 0.1 * vp.h, leave);
    pair.place(put);

    if (g < GRAB[0]) {
      this.held.set = false;
      pair.mode("carry");
      return;
    }

    // She lets go: from where the drone had her to the hang, standing up and taking hold.
    pair.mode("apart");
    const doll = pair.doll;
    if (!this.held.set) {
      const s = pair.state().doll;
      this.held.x = s.x;
      this.held.y = s.y;
      this.held.height = s.drawnHeight;
      this.held.set = true;
    }
    from.x = this.held.x;
    from.y = this.held.y;
    from.height = this.held.height;
    const w = smooth(seg(g, GRAB[0], GRAB[1]));
    // She rises on a small arc (a hop up to the edge).
    const arc = Math.sin(Math.PI * w) * 0.03 * vp.h;
    holdDoll(
      doll,
      mix(from.x, hang.x, w),
      mix(from.y, handY, w) + arc,
      mix(from.height, hang.height, w),
      w,
      smooth(seg(w, 0.4, 1)),
      frame,
      this.ctx.pointer.state,
    );
    // The pair stays "shown" to the end: it steps the doll while she is free, and the drone is off
    // the top right by then (`leave` 1), out of sight.
  }

  dispose(): void {
    this.disposed = true;
    this.pair = null;
  }
}

export function createListPair(ctx: SectionCtx): ListPair {
  return new ListPairRuntime(ctx);
}
