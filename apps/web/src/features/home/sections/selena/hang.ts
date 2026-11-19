/**
 * The doll at the start of the Selena section (joint J8): she hangs by one hand from the top edge of
 * the screen, in the face she wore as the last frame of the list grew. The list's end draws the same
 * picture (`list/pair.ts`, which ends on `dollHang`), so the joint has no seam. Round six: this is
 * the end state of the old carry, with no hand and no drone in it.
 */
import type { DollActor } from "../../actors/doll";
import type { MoodStep } from "../../actors/doll/face/sequence";
import type { FrameInfo, PointerState } from "../../kernel/types";
import type { DollHang } from "../list/selena-frame";

const FACE: readonly MoodStep[] = [{ face: "determined", hold: 99 }];

const place = {
  x: 0,
  y: 0,
  z: 0,
  height: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  pivot: "feet" as "feet" | "hips",
};
const lookPt = { x: 0, y: 0 };

/**
 * Set the doll at a place on her way to the hang: `standW` 0 is sitting, 1 is standing; `hangW` 0 is
 * free, 1 is hanging by one hand from the point (`x`, `y`: the hand, stage pixels, y up). The list's
 * end uses it while the pair lift her to the edge (`list/pair.ts`); the room uses it at (1, 1).
 */
export function holdDoll(
  doll: DollActor,
  x: number,
  y: number,
  height: number,
  standW: number,
  hangW: number,
  frame: FrameInfo,
  pointer: PointerState,
): void {
  if (doll.parentSocket) doll.detach();
  doll.reset();
  doll.visible = true;
  doll.blinkAuto(true);
  doll.mood(FACE, 0);
  if (pointer.type === "touch" ? !pointer.down : !pointer.inside) {
    doll.look(null);
  } else {
    lookPt.x = pointer.x - frame.viewport.w / 2;
    lookPt.y = frame.viewport.h / 2 - pointer.y;
    doll.look(lookPt);
  }
  place.x = x;
  place.y = y;
  place.height = height;
  doll.setPose("sit", "stand", standW);
  doll.hang(hangW, 1);
  doll.place(place);
}

/** Set the doll for the first frame of the room. Call it every frame the room shows her hanging. */
export function hangDoll(
  doll: DollActor,
  hang: DollHang,
  frame: FrameInfo,
  pointer: PointerState,
): void {
  holdDoll(doll, hang.x, hang.y, hang.height, 1, 1, frame, pointer);
}
