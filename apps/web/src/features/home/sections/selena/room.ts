/**
 * Where the dragon rests in the room, before the film. In the clip's own space it lies across
 * Selena's chest (the clip was made for the camera of the film), so in the room it is moved out of
 * her, to the foot of the frame, and the camera swing brings it back as it arrives. Pure.
 */
import { isPortrait, type Vp } from "../vp";

/** An offset of the dragon from its place in the clip: shares of the screen, and a scale factor. */
export interface RoomPlace {
  /** Right is positive, a share of the screen's width. */
  readonly dx: number;
  /** Up is positive, a share of the screen's height. */
  readonly dy: number;
  /** The dragon's size against its size in the film. */
  readonly scale: number;
}

const LANDSCAPE: RoomPlace = { dx: 0.02, dy: -0.36, scale: 1.05 };
/** On a phone Selena has the upper part and the drawer is a sheet over the foot. */
const PORTRAIT: RoomPlace = { dx: -0.04, dy: -0.2, scale: 0.9 };

export function roomPlace(vp: Vp): RoomPlace {
  return isPortrait(vp) ? PORTRAIT : LANDSCAPE;
}
